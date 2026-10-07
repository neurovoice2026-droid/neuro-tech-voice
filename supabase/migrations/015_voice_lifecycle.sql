-- ══════════════════════════════════════════════════════════════════════════════
-- 015 · Voices: retirement of the ElevenLabs default voices, curated platform
--       voices, library-voice lifecycle, voice design, pronunciation
--       dictionaries and the voice purge queue (slice F)
--
-- Idempotent and additive: no DROP statements, safe to re-run. Requires 010.
-- Adds:
--   • provider_voices: languages (every verified language, filtered with an
--     array match), featured_languages / featured_rank (curated platform voices
--     per language), and the lifecycle state read from the provider every day
--     (notice, retiring_at, sharing_status, safety_control, lifecycle_checked_at)
--   • agents.pronunciation: the organization's pronunciation dictionary
--     {dictionary_id, version_id, rules}, written by the platform only
--   • voice_design_previews: the generated voice ids an organization received
--     from Voice Design (a saved voice must come from this table, never from an
--     arbitrary id sent by the browser)
--   • provider_voice_purge: voices and dictionaries left in the shared provider
--     workspace when an organization row is deleted (queued by a BEFORE DELETE
--     trigger, drained by the maintenance job)
-- Hardens:
--   • platform-wide registry rows never keep the provisioning tenant's user id
--     (every tenant can read those rows): existing values are cleared and a
--     trigger keeps it that way (the actor stays in audit_log)
--   • guard_voice_columns(): a tenant JWT cannot write agents.pronunciation
-- Deploy order: apply this file BEFORE deploying the code of slice F (the agent
-- loader selects agents.pronunciation).
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── Voice registry: languages, curation and lifecycle ───────────────────────
-- Every language the voice is verified for (language stays the primary one).
ALTER TABLE public.provider_voices ADD COLUMN IF NOT EXISTS languages text[];
-- Curated platform voices: offered first, and the default for new agents and
-- for the migration away from the retired default voices, per language.
ALTER TABLE public.provider_voices ADD COLUMN IF NOT EXISTS featured_languages text[];
ALTER TABLE public.provider_voices ADD COLUMN IF NOT EXISTS featured_rank integer;
-- Lifecycle read from GET /v2/voices (sharing.status, sharing.disable_at_unix,
-- live moderation, custom rates, safety_control). A voice with a notice is no
-- longer offered for new selections.
ALTER TABLE public.provider_voices ADD COLUMN IF NOT EXISTS notice text;
ALTER TABLE public.provider_voices ADD COLUMN IF NOT EXISTS retiring_at timestamptz;
ALTER TABLE public.provider_voices ADD COLUMN IF NOT EXISTS sharing_status text;
ALTER TABLE public.provider_voices ADD COLUMN IF NOT EXISTS safety_control text;
ALTER TABLE public.provider_voices ADD COLUMN IF NOT EXISTS lifecycle_checked_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.provider_voices ADD CONSTRAINT provider_voices_notice_check
    CHECK (notice IS NULL OR notice IN ('removal_scheduled', 'removed', 'moderation', 'custom_rate', 'blocked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.provider_voices ADD CONSTRAINT provider_voices_featured_rank_check
    CHECK (featured_rank IS NULL OR featured_rank BETWEEN 0 AND 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Only platform-wide rows can be curated: a tenant's own clone is never offered to others.
DO $$ BEGIN
  ALTER TABLE public.provider_voices ADD CONSTRAINT provider_voices_featured_platform_check
    CHECK (featured_languages IS NULL OR owner_org_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.provider_voices
SET languages = ARRAY[language]
WHERE languages IS NULL AND language IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_voices_featured
  ON public.provider_voices USING gin (featured_languages)
  WHERE featured_languages IS NOT NULL;
CREATE INDEX IF NOT EXISTS provider_voices_languages
  ON public.provider_voices USING gin (languages)
  WHERE languages IS NOT NULL;
CREATE INDEX IF NOT EXISTS provider_voices_lifecycle
  ON public.provider_voices (lifecycle_checked_at NULLS FIRST)
  WHERE source = 'library' AND status = 'ready';
-- Agents using one voice (lifecycle banner, migrations, diagnostics).
CREATE INDEX IF NOT EXISTS agents_voice_id
  ON public.agents (voice_id)
  WHERE voice_id IS NOT NULL;

-- ─── Platform-wide rows never keep a tenant's user id ─────────────────────────
-- provider_voices_visible lets every tenant read platform-wide rows (all
-- columns). The provisioning tenant's user id stays in audit_log only.
UPDATE public.provider_voices SET created_by = NULL WHERE owner_org_id IS NULL AND created_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.scrub_platform_voice_creator()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_org_id IS NULL THEN
    NEW.created_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.scrub_platform_voice_creator() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER provider_voices_scrub_creator
  BEFORE INSERT OR UPDATE ON public.provider_voices
  FOR EACH ROW EXECUTE FUNCTION public.scrub_platform_voice_creator();

-- ─── Pronunciation dictionary of the organization's agent ────────────────────
-- {dictionary_id, version_id, rules: [{term, say_as, case_sensitive, word_boundaries}]}.
-- The ids address a resource of the SHARED provider workspace: written by the
-- server only, never accepted from a browser.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS pronunciation jsonb;

-- Runs alongside guard_platform_columns() (010), which it does not replace.
CREATE OR REPLACE FUNCTION public.guard_voice_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.pronunciation IS NOT NULL THEN
    RAISE EXCEPTION 'pronunciation rules are managed by the platform' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.pronunciation IS DISTINCT FROM OLD.pronunciation THEN
    RAISE EXCEPTION 'pronunciation rules are changed through the API only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_voice_columns() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER agents_guard_voice
  BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.guard_voice_columns();

-- ─── Voice Design previews ────────────────────────────────────────────────────
-- A generated_voice_id is a bearer handle in the shared workspace: a voice is
-- only ever created from a row of the requesting organization, unexpired and
-- not consumed yet. Rows are pruned by the maintenance job after expiry.
CREATE TABLE IF NOT EXISTS public.voice_design_previews (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id           uuid NOT NULL,
  generated_voice_id text NOT NULL,
  description        text NOT NULL,
  language           text,
  model_id           text,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  consumed_at        timestamptz,
  saved_voice_id     text
);
CREATE UNIQUE INDEX IF NOT EXISTS voice_design_previews_generated
  ON public.voice_design_previews (generated_voice_id);
CREATE INDEX IF NOT EXISTS voice_design_previews_org
  ON public.voice_design_previews (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_design_previews_batch
  ON public.voice_design_previews (batch_id);
CREATE INDEX IF NOT EXISTS voice_design_previews_expires
  ON public.voice_design_previews (expires_at);

ALTER TABLE public.voice_design_previews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "voice_design_previews_owner_select" ON public.voice_design_previews FOR SELECT
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- No insert/update/delete policies: written by the API (service role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.voice_design_previews FROM anon, authenticated;

-- ─── Purge queue: provider resources of deleted organizations ─────────────────
-- provider_voices.owner_org_id cascades on delete (and must never become NULL:
-- NULL means platform-wide), so an organization deleted by hand would leave its
-- cloned/designed voices (voice biometrics) and its pronunciation dictionary
-- in the shared workspace. The trigger below queues them; the maintenance job
-- deletes the voices (and their speech history) and archives the dictionaries.
CREATE TABLE IF NOT EXISTS public.provider_voice_purge (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL DEFAULT 'elevenlabs',
  kind            text NOT NULL,
  resource_id     text NOT NULL,
  -- No foreign key: the organization row is being deleted.
  org_id          uuid,
  reason          text NOT NULL DEFAULT 'organization_deleted',
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  queued_at       timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  done_at         timestamptz
);
DO $$ BEGIN
  ALTER TABLE public.provider_voice_purge ADD CONSTRAINT provider_voice_purge_kind_check
    CHECK (kind IN ('voice', 'pronunciation_dictionary'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.provider_voice_purge ADD CONSTRAINT provider_voice_purge_provider_check
    CHECK (provider = 'elevenlabs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS provider_voice_purge_resource
  ON public.provider_voice_purge (provider, kind, resource_id);
CREATE INDEX IF NOT EXISTS provider_voice_purge_pending
  ON public.provider_voice_purge (next_attempt_at)
  WHERE done_at IS NULL;

-- Service role only: the organization these rows belonged to no longer exists.
ALTER TABLE public.provider_voice_purge ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.provider_voice_purge FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_org_voice_purge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.provider_voice_purge (provider, kind, resource_id, org_id)
  SELECT 'elevenlabs', 'voice', pv.voice_id, OLD.id
  FROM public.provider_voices pv
  WHERE pv.owner_org_id = OLD.id
    AND pv.provider = 'elevenlabs'
    AND pv.source IN ('cloned', 'designed')
    AND pv.status <> 'deleted'
  ON CONFLICT (provider, kind, resource_id) DO NOTHING;

  INSERT INTO public.provider_voice_purge (provider, kind, resource_id, org_id)
  SELECT 'elevenlabs', 'pronunciation_dictionary', a.pronunciation->>'dictionary_id', OLD.id
  FROM public.agents a
  WHERE a.org_id = OLD.id
    AND jsonb_typeof(a.pronunciation) = 'object'
    AND coalesce(a.pronunciation->>'dictionary_id', '') <> ''
  ON CONFLICT (provider, kind, resource_id) DO NOTHING;

  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.queue_org_voice_purge() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER organizations_queue_voice_purge
  BEFORE DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.queue_org_voice_purge();

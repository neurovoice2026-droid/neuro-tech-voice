-- ══════════════════════════════════════════════════════════════════════════════
-- 011_security_hardening.sql
--
-- What it does
--   Hardens the tables, functions and storage that existed before 010:
--   - increment_minutes_used is service-role only with a fixed search_path
--     (today anyone with the anon key can change any org's minutes);
--     handle_new_user is no longer callable through the API; set_updated_at
--     gets a fixed search_path;
--   - every owner policy becomes TO authenticated + (select auth.uid()) +
--     WITH CHECK, with verbs narrowed to what the browser really needs;
--   - triggers keep billing columns on organizations and provider columns on
--     agents out of reach of signed-in users (service role and sessions
--     without a JWT, such as the SQL editor, are unaffected);
--   - integrations tokens are no longer selectable by API roles;
--   - indexes for unindexed foreign keys;
--   - storage: knowledge-documents objects are scoped to the org folder, the
--     bucket gets size and MIME limits, and private voice-clips,
--     voice-previews and voice-lab-uploads buckets are created (service role only).
--
-- Idempotent
--   Safe to run more than once: policies and triggers are dropped before being
--   created, functions use CREATE OR REPLACE, grants are revoked then granted,
--   indexes use IF NOT EXISTS and buckets are upserted.
--
-- Prerequisites
--   - 010_voice_platform.sql applied first (checked below): the triggers and
--     grants reference columns that 010 adds.
--   - App code that writes protected columns or reads calls/phone numbers/
--     knowledge documents/integrations through a user session must already use
--     the admin client or explicit column lists (see the build contract §3.4).
--   - Run as the postgres role (Supabase SQL editor or `supabase db push`); it
--     needs to manage policies on storage.objects and rows in storage.buckets.
--
-- Order
--   Apply 010_voice_platform.sql BEFORE this file.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Prerequisite check ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.usage_ledger') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_attribute
       WHERE attrelid = 'public.organizations'::regclass
         AND attname = 'usage_period_end'
         AND NOT attisdropped
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_attribute
       WHERE attrelid = 'public.integrations'::regclass
         AND attname = 'google_refresh_token_encrypted'
         AND NOT attisdropped
     ) THEN
    RAISE EXCEPTION '011_security_hardening.sql requires 010_voice_platform.sql to be applied first';
  END IF;
END $$;

-- ─── Functions ────────────────────────────────────────────────────────────────
-- Same behaviour as 003, but callable only by the service role (the ElevenLabs
-- webhook) and immune to search_path tricks.
CREATE OR REPLACE FUNCTION public.increment_minutes_used(p_org_id uuid, p_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.organizations
     SET minutes_used = coalesce(minutes_used, 0) + p_minutes
   WHERE id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_minutes_used(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_minutes_used(uuid, integer) TO service_role;

-- Only ever runs as the auth.users trigger. Postgres checks EXECUTE on a trigger
-- function when the trigger is created, not when it fires, so signups keep working.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Protected columns ────────────────────────────────────────────────────────
-- RLS decides which rows a user may update, not which columns. These triggers
-- silently keep server-owned columns unchanged for API users, so an owner can
-- still rename the org or edit the agent from the browser but cannot grant
-- themselves a plan, minutes or a provider agent.
--
-- Allowed to write them:
--   - requests whose JWT role is service_role (createAdminClient, webhooks);
--   - sessions with no JWT at all that are not an API role (SQL editor,
--     migrations, SECURITY DEFINER jobs run by postgres).
-- PostgREST sets request.jwt.claims per transaction, so on a reused connection
-- the setting reads as '' rather than NULL; both mean "no JWT".

CREATE OR REPLACE FUNCTION public.protect_org_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
BEGIN
  IF (v_claims IS NULL AND current_user NOT IN ('anon', 'authenticated'))
     OR (v_claims IS NOT NULL AND (v_claims::jsonb ->> 'role') = 'service_role') THEN
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.minutes_used := OLD.minutes_used;
  NEW.minutes_limit := OLD.minutes_limit;
  NEW.trial_ends_at := OLD.trial_ends_at;
  NEW.billing_interval := OLD.billing_interval;
  NEW.usage_period_start := OLD.usage_period_start;
  NEW.usage_period_end := OLD.usage_period_end;
  NEW.user_id := OLD.user_id;
  -- Written only by the onboarding route and the billing webhook: an owner
  -- flipping onboarding_completed back could re-run setup and restart the trial.
  NEW.onboarding_completed := OLD.onboarding_completed;
  NEW.onboarding_step := OLD.onboarding_step;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_org_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_org_columns ON public.organizations;
CREATE TRIGGER protect_org_columns
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_org_columns();

-- Provider ids and sync state are written by the sync job with the admin client;
-- a user must not point their agent at another tenant's provider agent or force
-- a pipeline mode.
CREATE OR REPLACE FUNCTION public.protect_agent_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
BEGIN
  IF (v_claims IS NULL AND current_user NOT IN ('anon', 'authenticated'))
     OR (v_claims IS NOT NULL AND (v_claims::jsonb ->> 'role') = 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.elevenlabs_agent_id := NULL;
    NEW.cartesia_agent_id := NULL;
    NEW.provider_sync := '{}'::jsonb;
    NEW.pipeline_mode_override := NULL;
  ELSE
    NEW.elevenlabs_agent_id := OLD.elevenlabs_agent_id;
    NEW.cartesia_agent_id := OLD.cartesia_agent_id;
    NEW.provider_sync := OLD.provider_sync;
    NEW.pipeline_mode_override := OLD.pipeline_mode_override;
    NEW.org_id := OLD.org_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_agent_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_agent_columns ON public.agents;
CREATE TRIGGER protect_agent_columns
  BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_agent_columns();

-- ─── Owner policies ───────────────────────────────────────────────────────────
-- The 001-006 policies apply to every role, evaluate auth.uid() per row and have
-- no WITH CHECK. Each is replaced by the narrowest set of verbs the browser uses;
-- everything else goes through server routes with the admin client.

-- organizations: read and update own row (no insert: handle_new_user creates it;
-- no delete: account deletion runs server-side)
DROP POLICY IF EXISTS "organizations_owner" ON public.organizations;
DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
CREATE POLICY organizations_select_own ON public.organizations
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS organizations_update_own ON public.organizations;
CREATE POLICY organizations_update_own ON public.organizations
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- agents: read, create and edit own
DROP POLICY IF EXISTS "agents_owner" ON public.agents;
DROP POLICY IF EXISTS agents_select_own ON public.agents;
CREATE POLICY agents_select_own ON public.agents
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS agents_insert_own ON public.agents;
CREATE POLICY agents_insert_own ON public.agents
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS agents_update_own ON public.agents;
CREATE POLICY agents_update_own ON public.agents
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- phone_numbers, calls, knowledge_documents, integrations: read own only
DROP POLICY IF EXISTS "phone_numbers_owner" ON public.phone_numbers;
DROP POLICY IF EXISTS phone_numbers_select_own ON public.phone_numbers;
CREATE POLICY phone_numbers_select_own ON public.phone_numbers
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "calls_owner" ON public.calls;
DROP POLICY IF EXISTS calls_select_own ON public.calls;
CREATE POLICY calls_select_own ON public.calls
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "knowledge_documents_owner" ON public.knowledge_documents;
DROP POLICY IF EXISTS knowledge_documents_select_own ON public.knowledge_documents;
CREATE POLICY knowledge_documents_select_own ON public.knowledge_documents
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "integrations_owner" ON public.integrations;
DROP POLICY IF EXISTS integrations_select_own ON public.integrations;
CREATE POLICY integrations_select_own ON public.integrations
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- workflows: full control of own
DROP POLICY IF EXISTS "workflows_owner" ON public.workflows;
DROP POLICY IF EXISTS workflows_all_own ON public.workflows;
CREATE POLICY workflows_all_own ON public.workflows
  FOR ALL TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- workflow_runs: read own (the executor writes with the admin client)
DROP POLICY IF EXISTS "workflow_runs_owner" ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_select_own ON public.workflow_runs;
CREATE POLICY workflow_runs_select_own ON public.workflow_runs
  FOR SELECT TO authenticated
  USING (
    workflow_id IN (
      SELECT w.id
      FROM public.workflows w
      WHERE w.org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid()))
    )
  );

-- invoices: read own (the Stripe webhook writes with the service role)
DROP POLICY IF EXISTS "invoices_owner_read" ON public.invoices;
DROP POLICY IF EXISTS invoices_select_own ON public.invoices;
CREATE POLICY invoices_select_own ON public.invoices
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- ─── integrations: hide tokens from API roles ─────────────────────────────────
-- A table-level SELECT covers every column, so it is revoked and SELECT is
-- granted column by column, skipping the refresh tokens. The column list is read
-- from the catalog so columns that exist only in the live database are kept
-- readable too. Revoking the table privilege also drops earlier column grants,
-- so a re-run lands on the same state. Browser code must name its columns:
-- select('*') on integrations fails for API roles after this.
REVOKE SELECT ON public.integrations FROM anon, authenticated;

DO $$
DECLARE
  v_columns text;
BEGIN
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
    INTO v_columns
    FROM pg_attribute a
   WHERE a.attrelid = 'public.integrations'::regclass
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.attname NOT IN ('google_refresh_token', 'google_refresh_token_encrypted');

  EXECUTE format('GRANT SELECT (%s) ON public.integrations TO authenticated', v_columns);
END $$;

-- ─── Indexes for unindexed foreign keys ───────────────────────────────────────
-- Same names as 010 where it already created them, so nothing is duplicated.
CREATE INDEX IF NOT EXISTS idx_calls_agent           ON public.calls (agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_phone_number    ON public.calls (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_agent   ON public.phone_numbers (agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_call    ON public.workflow_runs (call_id);

-- ─── Storage: buckets ─────────────────────────────────────────────────────────
-- Limits are enforced by Supabase Storage on upload, including signed upload URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-documents',
  'knowledge-documents',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/x-markdown'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Voice clone source recordings (consent evidence). No policies: service role only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-clips', 'voice-clips', false, 16777216, ARRAY['audio/*']) -- 16 MB
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Cached voice previews, served through /api/voices/[voiceId]/preview. Service role only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-previews', 'voice-previews', false, 2097152, ARRAY['audio/mpeg', 'audio/wav']) -- 2 MB
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Voice Lab speech-to-text uploads (<org_id>/<file>), deleted after transcription. Service role only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-lab-uploads', 'voice-lab-uploads', false, 26214400, ARRAY['audio/*']) -- 25 MB
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Storage: knowledge-documents policies ────────────────────────────────────
-- Uploads are stored as <org_id>/<agent_id>/<file>. The old knowledge_docs_rw
-- policy let any signed-in user read, overwrite or delete every org's files.
-- Owners may now only read their own org's files. Writes need no browser
-- policy: uploads go through service-role signed upload URLs (rate limited in
-- /upload-url) and deletes through the API, so a signed-in user can't store
-- objects directly, bypass that limit, or overwrite extracted text after the
-- server validated a file.
DROP POLICY IF EXISTS "knowledge_docs_rw" ON storage.objects;

DROP POLICY IF EXISTS knowledge_docs_select_own ON storage.objects;
CREATE POLICY knowledge_docs_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'knowledge-documents'
    AND (storage.foldername(objects.name))[1] IN (
      SELECT o.id::text FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS knowledge_docs_insert_own ON storage.objects;
DROP POLICY IF EXISTS knowledge_docs_update_own ON storage.objects;
DROP POLICY IF EXISTS knowledge_docs_delete_own ON storage.objects;

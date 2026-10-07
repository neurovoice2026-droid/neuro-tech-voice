-- ══════════════════════════════════════════════════════════════════════════════
-- 016 · Platform tools: race-safe creation, reconcile and monitoring
--
-- Additive and idempotent (safe to re-run, no DROP of any kind).
--
-- platform_resources (migration 010) holds the deployment's shared provider
-- resources (the ElevenLabs transfer webhook tool, the workspace secret behind
-- its X-NTV-Tool-Key header, Cartesia resources). Adds:
--   • status ('creating' | 'ready'), lease_owner, lease_until: before the
--     non-idempotent POST that creates a resource, a caller claims the key with
--     a 'creating' lease row (external_id '' until it is created). Exactly one
--     caller wins the insert; an expired lease (crashed creator) can be taken
--     over with a conditional UPDATE. Existing rows default to 'ready'.
--   • checked_at: last successful remote verification (maintenance).
--   • monitor: counts and timestamps from tool execution monitoring
--     (never payloads, never caller data).
--
-- The table stays service-role only: RLS is enabled with no policy
-- (migration 010) and the API roles get no table privilege at all.
-- No function or trigger is added: the lease logic is two conditional
-- statements issued by the service role (lib/voice-providers/platform-resources.ts).
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

ALTER TABLE public.platform_resources ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';
ALTER TABLE public.platform_resources ADD COLUMN IF NOT EXISTS lease_owner text;
ALTER TABLE public.platform_resources ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE public.platform_resources ADD COLUMN IF NOT EXISTS checked_at timestamptz;
ALTER TABLE public.platform_resources ADD COLUMN IF NOT EXISTS monitor jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.platform_resources
    ADD CONSTRAINT platform_resources_status_check CHECK (status IN ('creating', 'ready'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A ready row always carries the provider id; '' only ever marks a creation in progress.
DO $$ BEGIN
  ALTER TABLE public.platform_resources
    ADD CONSTRAINT platform_resources_ready_has_id CHECK (status <> 'ready' OR external_id <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A creation lease always expires (a crashed creator never blocks the key forever).
DO $$ BEGIN
  ALTER TABLE public.platform_resources
    ADD CONSTRAINT platform_resources_creating_has_lease CHECK (status <> 'creating' OR lease_until IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.platform_resources.status IS
  '''creating'' = a lease row claimed before the provider POST (external_id is ''''), ''ready'' = external_id is usable.';
COMMENT ON COLUMN public.platform_resources.monitor IS
  'Tool execution monitoring summary (counts, error types, timestamps only; service role only).';

-- Service role only (defense in depth on top of RLS without policies).
ALTER TABLE public.platform_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_resources FROM anon, authenticated;

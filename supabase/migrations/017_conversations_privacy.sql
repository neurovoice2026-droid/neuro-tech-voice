-- ══════════════════════════════════════════════════════════════════════════════
-- 017 · Conversations, post-call data, analytics and privacy retention (slice D)
--
-- Additive and idempotent: no DROP of any kind, safe to re-run.
--   • calls.channel / calls.is_test: conversations that are not phone calls
--     (dashboard tests, widget/SDK sessions) are stored as test calls, never
--     billed, never trigger workflows (lib/voice-providers/call-store.ts)
--   • calls.call_metadata: provider details for support (language, queue
--     wait, tool timeline, provider error) — never cost
--   • calls.owner_feedback: the owner's thumbs up/down on a call
--   • calls.retention_applied_at + apply_call_retention(): the agent's privacy
--     retention also purges OUR copy of transcripts, summaries and analysis
--   • calls.reconcile_*: bounded recovery of calls whose post-call webhook
--     was lost (lib/voice-providers/conversation-reconcile.ts)
--   • call_provider_costs: provider cost of goods moves to a service-only
--     table. calls.cost_usd / cost_credits were readable by every tenant
--     through PostgREST and Realtime (RLS has no column filter); they are
--     copied, cleared, and kept NULL by a trigger from now on
--   • maintenance_state: last-run timestamps and watermarks of maintenance
--     steps (cadence no longer depends on the cron schedule)
--   • call_search_vector() + GIN index + search_org_calls(): tenant-scoped
--     full-text search over titles, summaries and transcripts
-- New columns on calls are platform-managed: calls_guard
-- (guard_platform_columns, migration 010) already rejects every tenant
-- INSERT/UPDATE on calls, so no new guard function is needed for them.
-- Deploy order: apply this file BEFORE deploying the slice D code (the call
-- store and the calls API select the new columns).
-- Large calls table: this file runs in ONE transaction, so every ALTER TABLE
-- below holds its ACCESS EXCLUSIVE lock on calls until COMMIT, and each
-- CREATE INDEX (btree and the GIN calls_search_fts) blocks writes to calls
-- while it builds. On a large table, split it: create those indexes first
-- with CREATE INDEX CONCURRENTLY (outside any transaction, same names and
-- definitions, so the IF NOT EXISTS here then skips them), and run each
-- VALIDATE CONSTRAINT in its own transaction afterwards. Production's calls
-- table is tiny today, so the file is applied as is.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── calls: new platform-managed columns ─────────────────────────────────────
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'phone';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS owner_feedback text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS owner_feedback_at timestamptz;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS retention_applied_at timestamptz;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS reconcile_attempts smallint NOT NULL DEFAULT 0;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS reconcile_checked_at timestamptz;

-- Constraints are added NOT VALID, then validated. Inside this one
-- transaction that does NOT shorten any lock: the ACCESS EXCLUSIVE lock taken
-- by ALTER TABLE is held until COMMIT, through the validation scan. The split
-- only pays off when VALIDATE runs in a separate transaction (it then needs
-- only SHARE UPDATE EXCLUSIVE): see the note at the top for a large table.
DO $$ BEGIN
  ALTER TABLE public.calls ADD CONSTRAINT calls_channel_check CHECK (channel IN ('phone', 'web', 'other')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.calls VALIDATE CONSTRAINT calls_channel_check;
DO $$ BEGIN
  ALTER TABLE public.calls ADD CONSTRAINT calls_owner_feedback_check CHECK (owner_feedback IS NULL OR owner_feedback IN ('like', 'dislike')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.calls VALIDATE CONSTRAINT calls_owner_feedback_check;
DO $$ BEGIN
  ALTER TABLE public.calls ADD CONSTRAINT calls_reconcile_attempts_check CHECK (reconcile_attempts BETWEEN 0 AND 100) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.calls VALIDATE CONSTRAINT calls_reconcile_attempts_check;

-- Reconciliation scan: ElevenLabs calls without a final provider result.
CREATE INDEX IF NOT EXISTS calls_el_reconcile ON public.calls (created_at)
  WHERE provider = 'elevenlabs' AND lifecycle_rank < 50;
-- Retention scan: per agent, oldest first, only rows not purged yet.
CREATE INDEX IF NOT EXISTS calls_retention_pending ON public.calls (agent_id, created_at)
  WHERE retention_applied_at IS NULL;
-- Outcome filter and dashboard breakdown.
CREATE INDEX IF NOT EXISTS calls_org_outcome ON public.calls (org_id, outcome) WHERE outcome IS NOT NULL;

-- ─── Provider cost of goods: service role only ───────────────────────────────
-- No foreign key to calls: like usage_ledger, cost history survives a deleted
-- call row (amounts only, no PII). The org cascade still removes it.
CREATE TABLE IF NOT EXISTS public.call_provider_costs (
  call_id          uuid NOT NULL,
  provider         text NOT NULL,
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_call_id text,
  cost_credits     numeric,
  cost_usd         numeric,
  is_burst         boolean,
  tier             text,
  dev_discount     boolean,
  llm_price        numeric,
  platform_price   numeric,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, provider)
);
CREATE INDEX IF NOT EXISTS call_provider_costs_org_created ON public.call_provider_costs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_provider_costs_created ON public.call_provider_costs (created_at DESC);
ALTER TABLE public.call_provider_costs ENABLE ROW LEVEL SECURITY; -- no policy: tenants see nothing
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.call_provider_costs FROM anon, authenticated;

-- Copy existing costs, then clear them on calls (readable by tenants).
INSERT INTO public.call_provider_costs (call_id, provider, org_id, provider_call_id, cost_credits, cost_usd, created_at)
SELECT c.id, COALESCE(c.provider, 'elevenlabs'), c.org_id, c.provider_call_id, c.cost_credits, c.cost_usd, c.created_at
FROM public.calls c
WHERE c.cost_credits IS NOT NULL OR c.cost_usd IS NOT NULL
ON CONFLICT (call_id, provider) DO NOTHING;
UPDATE public.calls SET cost_credits = NULL, cost_usd = NULL
WHERE cost_credits IS NOT NULL OR cost_usd IS NOT NULL;

-- Any later write of a cost on calls (an older deployment still running, a
-- forgotten code path) is diverted to call_provider_costs and cleared.
-- Named so it runs after calls_guard (triggers fire in name order).
CREATE OR REPLACE FUNCTION public.divert_call_provider_costs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cost_credits IS NOT NULL OR NEW.cost_usd IS NOT NULL THEN
    INSERT INTO public.call_provider_costs AS c (call_id, provider, org_id, provider_call_id, cost_credits, cost_usd)
    VALUES (NEW.id, COALESCE(NEW.provider, 'elevenlabs'), NEW.org_id, NEW.provider_call_id, NEW.cost_credits, NEW.cost_usd)
    ON CONFLICT (call_id, provider) DO UPDATE
      SET cost_credits = COALESCE(EXCLUDED.cost_credits, c.cost_credits),
          cost_usd = COALESCE(EXCLUDED.cost_usd, c.cost_usd),
          updated_at = now();
    NEW.cost_credits := NULL;
    NEW.cost_usd := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.divert_call_provider_costs() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER calls_provider_costs_divert
  BEFORE INSERT OR UPDATE OF cost_credits, cost_usd ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.divert_call_provider_costs();

-- ─── Maintenance state: last runs and watermarks (service role only) ─────────
CREATE TABLE IF NOT EXISTS public.maintenance_state (
  key         text PRIMARY KEY,
  last_run_at timestamptz NOT NULL,
  watermark   timestamptz,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_state ENABLE ROW LEVEL SECURITY; -- no policy: tenants see nothing
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.maintenance_state FROM anon, authenticated;

-- ─── Privacy retention of OUR copy ────────────────────────────────────────────
-- Clears transcript, summary, title, analysis, the provider error text, the
-- transfer reason the AI wrote (routing.transfer.reason, may quote the
-- caller) and the recording link of up to p_limit calls of one agent that
-- ended before p_cutoff. Billing and statistics columns (status, duration,
-- outcome, call_successful, numbers, usage, the rest of routing) are kept.
-- Idempotent (retention_applied_at).
CREATE OR REPLACE FUNCTION public.apply_call_retention(p_agent_id uuid, p_cutoff timestamptz, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH target AS (
    SELECT c.id
    FROM public.calls c
    WHERE c.agent_id = p_agent_id
      AND c.retention_applied_at IS NULL
      -- Index-friendly bound (started_at may precede created_at by a call's length).
      AND c.created_at < p_cutoff + interval '1 day'
      AND COALESCE(c.ended_at, c.started_at, c.created_at) < p_cutoff
    ORDER BY c.created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 1000))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.calls c
  SET transcript = '[]'::jsonb,
      summary = NULL,
      summary_title = NULL,
      analysis = '{}'::jsonb,
      call_metadata = c.call_metadata - 'provider_error' - 'warnings',
      routing = c.routing #- '{transfer,reason}',
      has_recording = false,
      recording_status = 'deleted',
      retention_applied_at = now()
  FROM target
  WHERE c.id = target.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_call_retention(uuid, timestamptz, integer) FROM PUBLIC, anon, authenticated;

-- ─── Full-text search over our own call data ─────────────────────────────────
-- 'simple' configuration: no stemming, works for Romanian and English alike.
CREATE OR REPLACE FUNCTION public.call_search_vector(p_title text, p_summary text, p_transcript jsonb)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT to_tsvector(
    'simple'::regconfig,
    COALESCE(p_title, '') || ' ' || COALESCE(p_summary, '') || ' ' ||
    COALESCE((
      SELECT string_agg(t.elem ->> 'message', ' ')
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_transcript) = 'array' THEN p_transcript ELSE '[]'::jsonb END) AS t(elem)
    ), '')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.call_search_vector(text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS calls_search_fts ON public.calls
  USING gin (public.call_search_vector(summary_title, summary, transcript));

-- Ids of one organization's calls matching a tsquery built by the server
-- (lib/calls/search.ts: sanitized words with prefix match). Called with the
-- service role and the org id resolved from the signed-in user, never with an
-- id from the browser.
CREATE OR REPLACE FUNCTION public.search_org_calls(p_org_id uuid, p_tsquery text, p_limit integer)
RETURNS TABLE (call_id uuid)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id
  FROM public.calls c
  WHERE public.call_search_vector(c.summary_title, c.summary, c.transcript) @@ to_tsquery('simple'::regconfig, p_tsquery)
    AND c.org_id = p_org_id
  ORDER BY c.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
$$;
REVOKE EXECUTE ON FUNCTION public.search_org_calls(uuid, text, integer) FROM PUBLIC, anon, authenticated;

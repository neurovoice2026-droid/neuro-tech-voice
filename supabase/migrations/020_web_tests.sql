-- ══════════════════════════════════════════════════════════════════════════════
-- 020 · Browser test sessions and platform regression test runs (slice G)
--
-- Additive and idempotent: no DROP of any kind, safe to re-run.
--   • web_test_usage: per-organisation count of browser test sessions
--     ("Talk to your agent" / "Chat with your agent"). Unpaid organisations
--     (trial) have a lifetime cap, enforced atomically by
--     claim_web_test_session(). Kept apart from calls: an owner can delete
--     test calls, which must not reset the cap.
--   • server-side seconds budget of browser tests (the panel's timer is
--     client-side only): web_test_usage.seconds_total (lifetime) and
--     day_utc/day_seconds (current UTC day), accounted once per conversation
--     by record_web_test_seconds() (ledger web_test_call_seconds, keyed by
--     calls.id) when its post-call data is merged. blocked_at: set when one
--     session lasted far longer than the cap (the cap was bypassed); only a
--     platform admin lifts it (reset_web_test_block()).
--   • agent_test_runs: results of the platform regression suite (ElevenLabs
--     agent testing), started by platform admins only. Platform data:
--     RLS on, no policy, no tenant privileges.
--   • calls_web_test_open: partial index for the maintenance step that closes
--     browser test rows whose post-call result never arrived.
-- Tenants can SELECT their own usage row; every write goes through the
-- service role (POST /api/agent/web-session, maintenance, admin routes).
-- Deploy order: apply this file BEFORE deploying the slice G code (without
-- it, unpaid organisations cannot start browser tests: the cap fails closed).
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── Browser test session counter ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.web_test_usage (
  org_id           uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  sessions_started integer NOT NULL DEFAULT 0,
  last_started_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.web_test_usage ADD CONSTRAINT web_test_usage_sessions_check CHECK (sessions_started >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.web_test_usage VALIDATE CONSTRAINT web_test_usage_sessions_check;

ALTER TABLE public.web_test_usage ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "web_test_usage_owner_select" ON public.web_test_usage FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.web_test_usage FROM anon, authenticated;
REVOKE SELECT ON public.web_test_usage FROM anon;

-- ─── Browser test seconds budget ─────────────────────────────────────────────
-- Platform-managed like sessions_started: tenants keep SELECT on their own row
-- (policy above), every write goes through the service role.
ALTER TABLE public.web_test_usage ADD COLUMN IF NOT EXISTS seconds_total integer NOT NULL DEFAULT 0;
ALTER TABLE public.web_test_usage ADD COLUMN IF NOT EXISTS day_utc date;
ALTER TABLE public.web_test_usage ADD COLUMN IF NOT EXISTS day_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.web_test_usage ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE public.web_test_usage ADD COLUMN IF NOT EXISTS blocked_reason text;
DO $$ BEGIN
  ALTER TABLE public.web_test_usage ADD CONSTRAINT web_test_usage_seconds_check CHECK (seconds_total >= 0 AND day_seconds >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.web_test_usage VALIDATE CONSTRAINT web_test_usage_seconds_check;

-- One row per accounted browser test conversation (idempotency of the
-- accounting: webhook retries and the reconciliation never count twice). No
-- foreign key to calls: deleting a test call must not give its seconds back.
CREATE TABLE IF NOT EXISTS public.web_test_call_seconds (
  call_id    uuid PRIMARY KEY,
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seconds    integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_test_call_seconds_org ON public.web_test_call_seconds (org_id);
ALTER TABLE public.web_test_call_seconds ENABLE ROW LEVEL SECURITY; -- no policy: tenants see nothing
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.web_test_call_seconds FROM anon, authenticated;

-- Counts one browser test session for p_org_id. With p_limit (unpaid
-- organisations) the claim succeeds only while fewer than p_limit sessions
-- were started: the check and the increment are one statement, so two
-- concurrent requests can never both take the last session. p_limit NULL
-- only counts. Returns whether the session may start and the count after it.
CREATE OR REPLACE FUNCTION public.claim_web_test_session(p_org_id uuid, p_limit integer)
RETURNS TABLE (allowed boolean, used integer)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_org_id IS NULL OR (p_limit IS NOT NULL AND p_limit < 1) THEN
    SELECT u.sessions_started INTO v_count FROM public.web_test_usage u WHERE u.org_id = p_org_id;
    RETURN QUERY SELECT false, COALESCE(v_count, 0);
    RETURN;
  END IF;
  INSERT INTO public.web_test_usage AS u (org_id, sessions_started, last_started_at, updated_at)
  VALUES (p_org_id, 1, now(), now())
  ON CONFLICT (org_id) DO UPDATE
    SET sessions_started = u.sessions_started + 1, last_started_at = now(), updated_at = now()
    WHERE p_limit IS NULL OR u.sessions_started < p_limit
  RETURNING u.sessions_started INTO v_count;
  IF FOUND THEN
    RETURN QUERY SELECT true, v_count;
    RETURN;
  END IF;
  SELECT u.sessions_started INTO v_count FROM public.web_test_usage u WHERE u.org_id = p_org_id;
  RETURN QUERY SELECT false, COALESCE(v_count, 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_web_test_session(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Gives back a session that could not start (the provider refused to mint
-- its token): provider outages must not consume a trial's sessions.
CREATE OR REPLACE FUNCTION public.release_web_test_session(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.web_test_usage u
  SET sessions_started = GREATEST(u.sessions_started - 1, 0), updated_at = now()
  WHERE u.org_id = p_org_id
  RETURNING u.sessions_started INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.release_web_test_session(uuid) FROM PUBLIC, anon, authenticated;

-- Accounts the length of one browser test conversation once (keyed by its
-- calls.id) into the lifetime total and the current UTC day. A session longer
-- than p_block_over seconds bypassed the panel's cap: the organisation's
-- browser tests are blocked (blocked_at) until reset_web_test_block(). Returns
-- whether this call counted now, the totals after it, and whether this call
-- set the block.
CREATE OR REPLACE FUNCTION public.record_web_test_seconds(p_org_id uuid, p_call_id uuid, p_seconds integer, p_block_over integer)
RETURNS TABLE (recorded boolean, total_seconds integer, today_seconds integer, is_blocked boolean, newly_blocked boolean)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_seconds integer;
  v_over boolean;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_row public.web_test_usage%ROWTYPE;
BEGIN
  IF p_org_id IS NULL OR p_call_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, false, false;
    RETURN;
  END IF;
  v_seconds := LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 86400);
  v_over := p_block_over IS NOT NULL AND v_seconds > p_block_over;
  INSERT INTO public.web_test_call_seconds (call_id, org_id, seconds)
  VALUES (p_call_id, p_org_id, v_seconds)
  ON CONFLICT (call_id) DO NOTHING;
  IF NOT FOUND THEN
    -- Already accounted: report the current totals only.
    SELECT * INTO v_row FROM public.web_test_usage u WHERE u.org_id = p_org_id;
    RETURN QUERY SELECT false, COALESCE(v_row.seconds_total, 0),
      CASE WHEN v_row.day_utc = v_today THEN v_row.day_seconds ELSE 0 END,
      v_row.blocked_at IS NOT NULL, false;
    RETURN;
  END IF;
  INSERT INTO public.web_test_usage AS u (org_id, seconds_total, day_utc, day_seconds, blocked_at, blocked_reason, updated_at)
  VALUES (p_org_id, v_seconds, v_today, v_seconds,
          CASE WHEN v_over THEN now() END, CASE WHEN v_over THEN 'session_over_limit' END, now())
  ON CONFLICT (org_id) DO UPDATE
    SET seconds_total = LEAST(u.seconds_total::bigint + v_seconds, 2147483647)::integer,
        day_seconds = CASE WHEN u.day_utc = v_today THEN LEAST(u.day_seconds::bigint + v_seconds, 2147483647)::integer ELSE v_seconds END,
        day_utc = v_today,
        blocked_at = CASE WHEN v_over AND u.blocked_at IS NULL THEN now() ELSE u.blocked_at END,
        blocked_reason = CASE WHEN v_over AND u.blocked_at IS NULL THEN 'session_over_limit' ELSE u.blocked_reason END,
        updated_at = now()
  RETURNING u.* INTO v_row;
  -- now() is the transaction start: equal only when this statement set the block.
  RETURN QUERY SELECT true, v_row.seconds_total, v_row.day_seconds, v_row.blocked_at IS NOT NULL, v_over AND v_row.blocked_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_web_test_seconds(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;

-- Platform admin: lifts the block set by record_web_test_seconds(). Returns
-- true when the organisation was blocked.
CREATE OR REPLACE FUNCTION public.reset_web_test_block(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.web_test_usage u
  SET blocked_at = NULL, blocked_reason = NULL, updated_at = now()
  WHERE u.org_id = p_org_id AND u.blocked_at IS NOT NULL;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reset_web_test_block(uuid) FROM PUBLIC, anon, authenticated;

-- ─── Platform regression test runs (admin only) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_test_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invocation_id     text NOT NULL,
  agent_external_id text NOT NULL,
  agent_id          uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  suite_version     integer NOT NULL,
  platform_version  integer NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  started_by        text NOT NULL DEFAULT 'admin',
  results           jsonb NOT NULL DEFAULT '[]'::jsonb,
  passed            integer NOT NULL DEFAULT 0,
  failed            integer NOT NULL DEFAULT 0,
  pending           integer NOT NULL DEFAULT 0,
  credits_used      integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);
DO $$ BEGIN
  ALTER TABLE public.agent_test_runs ADD CONSTRAINT agent_test_runs_status_check CHECK (status IN ('pending', 'passed', 'failed', 'cancelled', 'error')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.agent_test_runs VALIDATE CONSTRAINT agent_test_runs_status_check;
CREATE UNIQUE INDEX IF NOT EXISTS agent_test_runs_invocation ON public.agent_test_runs (invocation_id);
CREATE INDEX IF NOT EXISTS agent_test_runs_recent ON public.agent_test_runs (created_at DESC);

ALTER TABLE public.agent_test_runs ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.agent_test_runs FROM anon, authenticated;

-- ─── Browser test rows still open (maintenance: web_test_finalize) ──────────
CREATE INDEX IF NOT EXISTS calls_web_test_open ON public.calls (created_at)
  WHERE channel = 'web' AND is_test AND status = 'in-progress';

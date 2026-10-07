-- ══════════════════════════════════════════════════════════════════════════════
-- 020 · Browser test sessions and platform regression test runs (slice G)
--
-- Additive and idempotent: no DROP of any kind, safe to re-run.
--   • web_test_usage: per-organisation count of browser test sessions
--     ("Talk to your agent" / "Chat with your agent"). Unpaid organisations
--     (trial) have a lifetime cap, enforced atomically by
--     claim_web_test_session(). Kept apart from calls: an owner can delete
--     test calls, which must not reset the cap.
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

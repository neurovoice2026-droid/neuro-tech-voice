-- ══════════════════════════════════════════════════════════════════════════════
-- 014 · Platform agent config rollout
--
-- Additive and idempotent (safe to re-run, no DROP of any kind).
--
-- Adds:
--   • agent_provider_resources.rollout_checked_at: when the maintenance step
--     `config_rollout` last compared this agent's current config hash with the
--     one it was synced with. The step scans the least recently checked agents
--     first, so every agent is eventually compared even when most are in sync.
--
-- Tenants keep read-only access to agent_provider_resources: the table has no
-- insert/update/delete policy (migration 010), so the new column needs no
-- tenant guard; only the service role writes it.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

ALTER TABLE public.agent_provider_resources ADD COLUMN IF NOT EXISTS rollout_checked_at timestamptz;

COMMENT ON COLUMN public.agent_provider_resources.rollout_checked_at IS
  'Last time the config_rollout maintenance step compared this agent''s config hash (service role only).';

-- Candidates of the rollout scan: synced agents with a remote id, oldest check first.
CREATE INDEX IF NOT EXISTS agent_provider_resources_rollout
  ON public.agent_provider_resources (provider, rollout_checked_at NULLS FIRST)
  WHERE status = 'ready' AND external_id IS NOT NULL;

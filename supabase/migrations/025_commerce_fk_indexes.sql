-- ══════════════════════════════════════════════════════════════════════════════
-- 025 · Covering indexes for the commerce foreign keys (Supabase performance
--       advisor "unindexed_foreign_keys" after 024). They keep ON DELETE
--       CASCADE / SET NULL cheap when a connection, order, customer, agent or
--       call row goes away, and serve the per-connection and per-order listings.
-- Additive and idempotent: CREATE INDEX IF NOT EXISTS only, safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

CREATE INDEX IF NOT EXISTS commerce_audit_log_connection ON public.commerce_audit_log (connection_id);
CREATE INDEX IF NOT EXISTS commerce_audit_log_automation ON public.commerce_audit_log (automation_id);
CREATE INDEX IF NOT EXISTS commerce_audit_log_call ON public.commerce_audit_log (call_id);
CREATE INDEX IF NOT EXISTS commerce_automation_runs_connection ON public.commerce_automation_runs (connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_automation_runs_order ON public.commerce_automation_runs (order_id);
CREATE INDEX IF NOT EXISTS commerce_automations_agent ON public.commerce_automations (agent_id);
CREATE INDEX IF NOT EXISTS commerce_carts_customer ON public.commerce_carts (customer_id);
CREATE INDEX IF NOT EXISTS commerce_order_items_connection ON public.commerce_order_items (connection_id);
CREATE INDEX IF NOT EXISTS commerce_order_items_org ON public.commerce_order_items (org_id);
CREATE INDEX IF NOT EXISTS commerce_sync_jobs_org ON public.commerce_sync_jobs (org_id);
CREATE INDEX IF NOT EXISTS commerce_webhook_events_org ON public.commerce_webhook_events (org_id);

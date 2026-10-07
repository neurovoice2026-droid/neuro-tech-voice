-- ══════════════════════════════════════════════════════════════════════════════
-- 022 · Security & performance hardening (Supabase advisor findings)
--
-- Formerly 011_security_performance_hardening.sql: renumbered so it sorts
-- AFTER every migration the new application needs (013-021). Its restrictive
-- policies break the previous application's tenant-client deletes of calls
-- and phone numbers, so it is applied last, after the application deploy.
--
-- Idempotent and additive: no DROP statements, safe to re-run.
--   • tenants can no longer DELETE call / phone-number rows directly through
--     PostgREST (the API routes delete them server-side after the provider,
--     Twilio and Stripe cleanup) and cannot INSERT them either
--   • fixed search_path on the remaining functions (lint 0011)
--   • handle_new_user() (auth trigger) is not callable through /rest/v1/rpc
--   • RLS policies evaluate auth.uid() once per statement (lint 0003)
--   • covering indexes for foreign keys (lint 0001)
-- Requires 010. Deploy the application version that deletes calls/numbers
-- with the service role BEFORE applying this file (a project that already
-- applied it as 011 can re-run it: every statement is idempotent).
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── Restrictive policies: no direct tenant INSERT/DELETE ─────────────────────
-- calls_owner and phone_numbers_owner (001) are FOR ALL; restrictive policies
-- are AND-ed with them, so SELECT/UPDATE keep working (UPDATE stays limited by
-- the guard trigger) while INSERT/DELETE are denied for signed-in users.
DO $$ BEGIN
  CREATE POLICY "calls_no_tenant_delete" ON calls AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "calls_no_tenant_insert" ON calls AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "phone_numbers_no_tenant_delete" ON phone_numbers AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "phone_numbers_no_tenant_insert" ON phone_numbers AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Functions ────────────────────────────────────────────────────────────────
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.increment_minutes_used(uuid, integer) SET search_path = public;
ALTER FUNCTION public.guard_platform_columns() SET search_path = public;
-- Trigger function on auth.users: it runs as a trigger, never through RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ─── RLS: evaluate auth.uid() once per statement ──────────────────────────────
ALTER POLICY "organizations_owner_select" ON organizations USING (user_id = (SELECT auth.uid()));
ALTER POLICY "organizations_owner_update" ON organizations
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "agents_owner_select" ON agents
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "agents_owner_update" ON agents
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));

ALTER POLICY "knowledge_documents_owner_select" ON knowledge_documents
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "knowledge_documents_owner_update" ON knowledge_documents
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));

ALTER POLICY "phone_numbers_owner" ON phone_numbers
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "calls_owner" ON calls
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "integrations_owner" ON integrations
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "invoices_owner_read" ON invoices
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "workflows_owner" ON workflows
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "workflow_runs_owner" ON workflow_runs
  USING (workflow_id IN (
    SELECT w.id FROM workflows w
    WHERE w.org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid()))
  ));

ALTER POLICY "agent_provider_resources_owner_read" ON agent_provider_resources
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "usage_ledger_owner_read" ON usage_ledger
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "provider_voices_visible" ON provider_voices
  USING (owner_org_id IS NULL OR owner_org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));
ALTER POLICY "audit_log_owner_read" ON audit_log
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = (SELECT auth.uid())));

-- Same guard as 010: where the migration role does not own storage.objects
-- the policy is left as it is (NOTICE) instead of aborting the migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'knowledge_docs_owner') THEN
    BEGIN
      EXECUTE $p$
        ALTER POLICY "knowledge_docs_owner" ON storage.objects
          USING (
            bucket_id = 'knowledge-documents'
            AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.organizations WHERE user_id = (SELECT auth.uid()))
          )
      $p$;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'storage.objects policy knowledge_docs_owner not changed (%): apply it as the owner of storage.objects', SQLERRM;
    END;
  END IF;
END $$;

-- ─── Foreign-key covering indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS calls_agent_id ON calls (agent_id);
CREATE INDEX IF NOT EXISTS calls_phone_number_id ON calls (phone_number_id);
CREATE INDEX IF NOT EXISTS phone_numbers_agent_id ON phone_numbers (agent_id);
CREATE INDEX IF NOT EXISTS usage_ledger_call_id ON usage_ledger (call_id);
CREATE INDEX IF NOT EXISTS webhook_events_call_id ON webhook_events (call_id);
CREATE INDEX IF NOT EXISTS webhook_events_org_id ON webhook_events (org_id);
CREATE INDEX IF NOT EXISTS workflow_runs_call_id ON workflow_runs (call_id);

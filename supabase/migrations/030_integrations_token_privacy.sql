-- ══════════════════════════════════════════════════════════════════════════════
-- 030 · Integration token privacy.
--   • integrations.google_refresh_token (Gmail send, Calendar, Sheets, Docs,
--     Drive) is no longer readable or writable from the owner's browser
--     session. Signed-in tenants keep SELECT on the status and metadata
--     columns only (column-level grant, like commerce_connections in 024);
--     anon keeps nothing. The server reads the token with the service role,
--     always with an explicit org filter (workflows, in-call booking, call
--     exports, account deletion).
--   • No tenant INSERT, UPDATE or DELETE either: integrations are written by
--     the server routes only, so a Google integration becomes active only by
--     completing OAuth (the callback stores the token), and the webhook one
--     only through POST /api/integrations/webhook. Restrictive policies deny
--     the writes even if a privilege is granted again later (pattern of 022);
--     integrations_owner keeps serving the owner's reads.
--   • A Google integration is active only with a refresh token (CHECK). Rows
--     that were active without one (connected through the old POST route and
--     never usable: workflows and call exports refuse them) are switched off
--     first, so the integrations page stops calling them connected. Nothing
--     is deleted; the owner reconnects through Google.
-- Re-runnable: REVOKE and GRANT are idempotent, the policies and the CHECK are
-- created only if missing, the UPDATE matches nothing the second time. No DROP.
-- Apply it AFTER deploying the app version that ships it (like 022): the
-- previous version writes integrations and reads the token for call exports
-- with the owner's session, which this migration refuses.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── Privileges: the owner's session reads status and metadata only ──────────
-- REVOKE ALL also clears column privileges, so a re-run starts from the same
-- state before the column grant.
REVOKE ALL ON public.integrations FROM anon, authenticated;
GRANT SELECT (id, org_id, type, config, is_active, connected_at, created_at)
  ON public.integrations TO authenticated;

-- ─── Policies: reads for the owner, no tenant writes ─────────────────────────
ALTER POLICY "integrations_owner" ON public.integrations TO authenticated;
DO $$ BEGIN
  CREATE POLICY "integrations_no_tenant_insert" ON public.integrations AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "integrations_no_tenant_update" ON public.integrations AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "integrations_no_tenant_delete" ON public.integrations AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── A Google integration is active only with a refresh token ────────────────
-- Last, so the privileges above are in place even if a token-less row is
-- written between the UPDATE and the CHECK (a re-run then completes it).
UPDATE public.integrations
   SET is_active = false
 WHERE type <> 'webhook'
   AND is_active IS TRUE
   AND coalesce(google_refresh_token, '') = '';

DO $$ BEGIN
  ALTER TABLE public.integrations ADD CONSTRAINT integrations_google_active_needs_token
    CHECK (type = 'webhook' OR is_active IS NOT TRUE OR coalesce(google_refresh_token, '') <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

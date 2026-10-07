-- ══════════════════════════════════════════════════════════════════════════════
-- 021 · Account deletion and tenant offboarding (slice H)
--
-- Additive and idempotent: no DROP of any kind, safe to re-run.
--   • organizations.deletion_requested_at: set when an owner (or a platform
--     admin) asks for the account to be deleted. requireOrg() refuses every
--     tenant API call of such an organization and syncAgent() never recreates
--     its provider agents. Platform-managed: guard_account_columns() rejects
--     tenant writes (guard_platform_columns() is not touched).
--   • account_deletions: one durable, resumable deletion job per request
--     (status, current step, attempts, last error, counts, resume cursors).
--     No foreign key and no personal data beyond ids: the row outlives the
--     organization and the sign-in as the tombstone of the erasure.
--   • account_deletion_items: provider call records to delete (ElevenLabs
--     conversations, Cartesia calls, Twilio call and message records), each
--     idempotent and retried on its own. Emptied when the job completes.
--   • invoices_archive / usage_archive: fiscal records the law requires us to
--     keep (Romanian accounting law 82/1991, art. 25: supporting documents for
--     10 years from the end of the financial year). invoices rows are copied
--     by a BEFORE DELETE trigger, so neither the organization cascade nor a
--     manual delete destroys them; usage_ledger is kept as monthly totals only
--     (no call ids, no numbers). Service role only: no tenant access at all.
-- Deploy order: apply this file BEFORE deploying the slice H code
-- (requireOrg reads deletion_requested_at; it tolerates the column missing).
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── organizations: deletion marker (platform-managed) ───────────────────────
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_account_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.deletion_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'account deletion is managed by the platform' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at THEN
    RAISE EXCEPTION 'account deletion is managed by the platform' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_account_columns() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER organizations_guard_account
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_account_columns();

-- ─── Deletion jobs (tombstones once completed) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_deletions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No foreign keys: the row outlives the organization and the sign-in.
  org_id           uuid NOT NULL,
  user_id          uuid,
  requested_by     uuid,
  requested_via    text NOT NULL DEFAULT 'self_service',
  status           text NOT NULL DEFAULT 'pending',
  step             text,
  attempts         integer NOT NULL DEFAULT 0,
  last_error       text,
  counts           jsonb NOT NULL DEFAULT '{}'::jsonb,
  state            jsonb NOT NULL DEFAULT '{}'::jsonb,
  lease_owner      uuid,
  lease_until      timestamptz,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  followup_done_at timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.account_deletions ADD CONSTRAINT account_deletions_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'needs_attention'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.account_deletions ADD CONSTRAINT account_deletions_via_check
    CHECK (requested_via IN ('self_service', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.account_deletions ADD CONSTRAINT account_deletions_attempts_check
    CHECK (attempts BETWEEN 0 AND 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.account_deletions ADD CONSTRAINT account_deletions_error_length_check
    CHECK (last_error IS NULL OR char_length(last_error) <= 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One open job per organization (a second request reuses it).
CREATE UNIQUE INDEX IF NOT EXISTS account_deletions_one_open
  ON public.account_deletions (org_id) WHERE status IN ('pending', 'running', 'needs_attention');
CREATE INDEX IF NOT EXISTS account_deletions_due
  ON public.account_deletions (next_attempt_at) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS account_deletions_org
  ON public.account_deletions (org_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS account_deletions_followup
  ON public.account_deletions (completed_at) WHERE status = 'completed' AND followup_done_at IS NULL;

CREATE OR REPLACE TRIGGER account_deletions_updated_at
  BEFORE UPDATE ON public.account_deletions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
-- The owner can read the job while the organization still exists; written by the service role only.
DO $$ BEGIN
  CREATE POLICY "account_deletions_owner_select" ON public.account_deletions FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.account_deletions FROM anon, authenticated;

-- ─── Provider call records to delete (service role only) ─────────────────────
CREATE TABLE IF NOT EXISTS public.account_deletion_items (
  deletion_id     uuid NOT NULL REFERENCES public.account_deletions(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  resource_id     text NOT NULL,
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  outcome         text,
  last_error      text,
  done_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deletion_id, kind, resource_id)
);
DO $$ BEGIN
  ALTER TABLE public.account_deletion_items ADD CONSTRAINT account_deletion_items_kind_check
    CHECK (kind IN ('elevenlabs_conversation', 'cartesia_call', 'twilio_call', 'twilio_message'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.account_deletion_items ADD CONSTRAINT account_deletion_items_outcome_check
    CHECK (outcome IS NULL OR outcome IN ('deleted', 'already_gone', 'skipped_not_configured', 'invalid', 'gave_up'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.account_deletion_items ADD CONSTRAINT account_deletion_items_resource_check
    CHECK (char_length(resource_id) BETWEEN 1 AND 200);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS account_deletion_items_pending
  ON public.account_deletion_items (deletion_id, next_attempt_at) WHERE done_at IS NULL;

ALTER TABLE public.account_deletion_items ENABLE ROW LEVEL SECURITY; -- no policy: tenants see nothing
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.account_deletion_items FROM anon, authenticated;

-- ─── Fiscal archive: invoices (kept 10 years after the financial year) ───────
CREATE TABLE IF NOT EXISTS public.invoices_archive (
  id                uuid PRIMARY KEY,
  -- No foreign key: the organization is gone.
  org_id            uuid NOT NULL,
  stripe_invoice_id text,
  smartbill_series  text,
  smartbill_number  text,
  amount            numeric(10, 2),
  currency          text,
  status            text,
  pdf_url           text,
  client_name       text,
  client_vat_code   text,
  issued_at         timestamptz,
  created_at        timestamptz,
  retain_until      date NOT NULL,
  archived_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_archive_org ON public.invoices_archive (org_id);
CREATE INDEX IF NOT EXISTS invoices_archive_retain ON public.invoices_archive (retain_until);
ALTER TABLE public.invoices_archive ENABLE ROW LEVEL SECURITY; -- no policy: no app or tenant access
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.invoices_archive FROM anon, authenticated;

-- ─── Fiscal archive: monthly usage totals (no call ids, no numbers) ──────────
CREATE TABLE IF NOT EXISTS public.usage_archive (
  org_id           uuid NOT NULL,
  month            date NOT NULL,
  ledger_entries   bigint NOT NULL DEFAULT 0,
  billable_seconds bigint NOT NULL DEFAULT 0,
  minutes          bigint NOT NULL DEFAULT 0,
  retain_until     date NOT NULL,
  archived_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, month)
);
CREATE INDEX IF NOT EXISTS usage_archive_retain ON public.usage_archive (retain_until);
ALTER TABLE public.usage_archive ENABLE ROW LEVEL SECURITY; -- no policy: no app or tenant access
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.usage_archive FROM anon, authenticated;

-- Every deleted invoice row is copied first (organization cascade, manual delete).
CREATE OR REPLACE FUNCTION public.archive_deleted_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.invoices_archive (
    id, org_id, stripe_invoice_id, smartbill_series, smartbill_number, amount, currency, status,
    pdf_url, client_name, client_vat_code, issued_at, created_at, retain_until
  ) VALUES (
    OLD.id, OLD.org_id, OLD.stripe_invoice_id, OLD.smartbill_series, OLD.smartbill_number, OLD.amount, OLD.currency, OLD.status,
    OLD.pdf_url, OLD.client_name, OLD.client_vat_code, OLD.issued_at, OLD.created_at,
    make_date(EXTRACT(YEAR FROM (COALESCE(OLD.issued_at, OLD.created_at, now()) AT TIME ZONE 'Europe/Bucharest'))::integer + 10, 12, 31)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.archive_deleted_invoice() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER invoices_archive_on_delete
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_invoice();

-- Monthly usage totals of one organization (recomputed: idempotent).
CREATE OR REPLACE FUNCTION public.archive_org_usage(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_months integer;
BEGIN
  INSERT INTO public.usage_archive (org_id, month, ledger_entries, billable_seconds, minutes, retain_until)
  SELECT p_org_id,
         date_trunc('month', u.created_at AT TIME ZONE 'UTC')::date AS month,
         count(*),
         COALESCE(sum(u.billable_seconds), 0),
         COALESCE(sum(u.minutes), 0),
         make_date(EXTRACT(YEAR FROM date_trunc('month', u.created_at AT TIME ZONE 'UTC'))::integer + 10, 12, 31)
  FROM public.usage_ledger u
  WHERE u.org_id = p_org_id
  GROUP BY 2, 6
  ON CONFLICT (org_id, month) DO UPDATE
    SET ledger_entries = EXCLUDED.ledger_entries,
        billable_seconds = EXCLUDED.billable_seconds,
        minutes = EXCLUDED.minutes,
        retain_until = EXCLUDED.retain_until,
        archived_at = now();
  GET DIAGNOSTICS v_months = ROW_COUNT;
  RETURN v_months;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.archive_org_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_org_usage(uuid) TO service_role;

-- The deletion job archives explicitly (and checks the counts) before deleting
-- the organization; the triggers are the safety net for any other delete.
CREATE OR REPLACE FUNCTION public.archive_org_billing_records(p_org_id uuid)
RETURNS TABLE (invoices_total integer, invoices_archived integer, usage_months integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_archived integer;
  v_months integer;
BEGIN
  INSERT INTO public.invoices_archive (
    id, org_id, stripe_invoice_id, smartbill_series, smartbill_number, amount, currency, status,
    pdf_url, client_name, client_vat_code, issued_at, created_at, retain_until
  )
  SELECT i.id, i.org_id, i.stripe_invoice_id, i.smartbill_series, i.smartbill_number, i.amount, i.currency, i.status,
         i.pdf_url, i.client_name, i.client_vat_code, i.issued_at, i.created_at,
         make_date(EXTRACT(YEAR FROM (COALESCE(i.issued_at, i.created_at, now()) AT TIME ZONE 'Europe/Bucharest'))::integer + 10, 12, 31)
  FROM public.invoices i
  WHERE i.org_id = p_org_id
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO v_total FROM public.invoices WHERE org_id = p_org_id;
  SELECT count(*) INTO v_archived
  FROM public.invoices_archive a
  WHERE a.org_id = p_org_id AND a.id IN (SELECT i.id FROM public.invoices i WHERE i.org_id = p_org_id);
  v_months := public.archive_org_usage(p_org_id);
  RETURN QUERY SELECT v_total, v_archived, v_months;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.archive_org_billing_records(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_org_billing_records(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.archive_org_usage_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.archive_org_usage(OLD.id);
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.archive_org_usage_on_delete() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER organizations_archive_usage
  BEFORE DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.archive_org_usage_on_delete();

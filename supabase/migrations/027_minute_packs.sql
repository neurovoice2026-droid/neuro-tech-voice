-- ══════════════════════════════════════════════════════════════════════════════
-- 027 · Prepaid extra-minute packs, hard minute cap, billing-period reset and
--       optional auto top-up.
--   • organizations: extra_minutes_balance (purchased minutes, never expire,
--     used only after the period's included minutes), usage_period_start (the
--     Stripe period minutes_used counts from), minutes_exhausted_notified_at
--     and usage_alert_notified_at (one "out of minutes" and one 80% e-mail
--     per period), and the auto top-up settings and state (auto_topup_*).
--     All platform-written: a tenant JWT cannot
--     change them (guard_minute_columns), the billing API and the Stripe
--     webhook do (service role).
--   • minute_purchases: one row per pack bought (Checkout), charged (auto
--     top-up) or granted (admin), credited or failed. Tenants read their own
--     rows; only the service role writes.
--   • credit_minute_purchase(): records a purchase and adds its minutes to the
--     balance, once per Checkout session / Stripe invoice.
--   • start_usage_period(): minutes_used back to 0 when Stripe starts a new
--     period (idempotent per period start); the purchased balance is kept.
--   • claim_auto_topup(): at most one auto top-up attempt per cooldown.
--   • record_call_usage(): same signature, return type and SECURITY DEFINER
--     as 010; minutes beyond the included ones are drawn from the balance,
--     and minutes_used counts only the included minutes a call used.
--   • commerce_automation_runs.minutes_wait_since: when a store automation
--     run first found its organization out of minutes (its scheduled time
--     then). The dispatcher defers such a run for up to 24 hours from it,
--     then skips it (lib/commerce/automations/dispatch.ts).
-- Additive and re-runnable: no DROP, no row rewritten, no default changed.
-- Deploy order: apply this file BEFORE deploying the code that reads the new
-- columns.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── Organizations: purchased minutes, usage period, auto top-up ────────────
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS extra_minutes_balance integer NOT NULL DEFAULT 0;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS usage_period_start timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS minutes_exhausted_notified_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS usage_alert_notified_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_topup_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_topup_pack integer;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_topup_threshold integer;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_topup_last_attempt_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_topup_failed_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS auto_topup_failure text;

DO $$ BEGIN
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_extra_minutes_balance_check
    CHECK (extra_minutes_balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- The pack sizes of lib/billing/minute-packs.ts (MINUTE_PACKS).
DO $$ BEGIN
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_auto_topup_pack_check
    CHECK (auto_topup_pack IS NULL OR auto_topup_pack IN (100, 500, 1000, 2500));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- AUTO_TOPUP_THRESHOLD of lib/billing/minute-packs.ts.
DO $$ BEGIN
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_auto_topup_threshold_check
    CHECK (auto_topup_threshold IS NULL OR auto_topup_threshold BETWEEN 10 AND 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Column guard (tenant JWTs cannot write the minute columns) ─────────────
CREATE OR REPLACE FUNCTION public.guard_minute_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND (
       NEW.extra_minutes_balance IS DISTINCT FROM 0
    OR NEW.usage_period_start IS NOT NULL
    OR NEW.minutes_exhausted_notified_at IS NOT NULL
    OR NEW.usage_alert_notified_at IS NOT NULL
    OR NEW.auto_topup_enabled IS DISTINCT FROM false
    OR NEW.auto_topup_pack IS NOT NULL
    OR NEW.auto_topup_threshold IS NOT NULL
    OR NEW.auto_topup_last_attempt_at IS NOT NULL
    OR NEW.auto_topup_failed_at IS NOT NULL
    OR NEW.auto_topup_failure IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'extra minutes and auto top-up are managed by the platform' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (
       NEW.extra_minutes_balance IS DISTINCT FROM OLD.extra_minutes_balance
    OR NEW.usage_period_start IS DISTINCT FROM OLD.usage_period_start
    OR NEW.minutes_exhausted_notified_at IS DISTINCT FROM OLD.minutes_exhausted_notified_at
    OR NEW.usage_alert_notified_at IS DISTINCT FROM OLD.usage_alert_notified_at
    OR NEW.auto_topup_enabled IS DISTINCT FROM OLD.auto_topup_enabled
    OR NEW.auto_topup_pack IS DISTINCT FROM OLD.auto_topup_pack
    OR NEW.auto_topup_threshold IS DISTINCT FROM OLD.auto_topup_threshold
    OR NEW.auto_topup_last_attempt_at IS DISTINCT FROM OLD.auto_topup_last_attempt_at
    OR NEW.auto_topup_failed_at IS DISTINCT FROM OLD.auto_topup_failed_at
    OR NEW.auto_topup_failure IS DISTINCT FROM OLD.auto_topup_failure
  ) THEN
    RAISE EXCEPTION 'extra minutes and auto top-up are managed by the platform' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_minute_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_minute_columns() TO service_role;
CREATE OR REPLACE TRIGGER organizations_guard_minutes BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_minute_columns();

-- ─── Minute purchases ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.minute_purchases (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  minutes                    integer NOT NULL,
  amount_cents               integer NOT NULL,
  currency                   text NOT NULL DEFAULT 'usd',
  source                     text NOT NULL,
  status                     text NOT NULL,
  -- Stripe references (never a secret): one purchase per Checkout session and per invoice.
  stripe_checkout_session_id text,
  stripe_invoice_id          text,
  stripe_payment_intent_id   text,
  -- Owner-facing reason of a failed auto top-up (no card data).
  failure_message            text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT minute_purchases_minutes_check CHECK (minutes > 0),
  CONSTRAINT minute_purchases_amount_cents_check CHECK (amount_cents >= 0),
  CONSTRAINT minute_purchases_source_check CHECK (source IN ('checkout', 'auto_topup', 'admin')),
  CONSTRAINT minute_purchases_status_check CHECK (status IN ('credited', 'failed')),
  CONSTRAINT minute_purchases_checkout_session_key UNIQUE (stripe_checkout_session_id),
  CONSTRAINT minute_purchases_invoice_key UNIQUE (stripe_invoice_id)
);
CREATE INDEX IF NOT EXISTS minute_purchases_org_created ON public.minute_purchases (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minute_purchases_payment_intent ON public.minute_purchases (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.minute_purchases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "minute_purchases_owner_select" ON public.minute_purchases FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.minute_purchases FROM anon, authenticated;
REVOKE SELECT ON public.minute_purchases FROM anon;

-- ─── Store automations: out-of-minutes deferral anchor ──────────────────────
ALTER TABLE public.commerce_automation_runs ADD COLUMN IF NOT EXISTS minutes_wait_since timestamptz;

-- ─── Credit a purchase (service role only; plain function, RLS is not bypassed) ─
-- Idempotent per Checkout session, invoice and payment intent: every key
-- given is locked (a Checkout purchase can be reported by
-- checkout.session.completed and by its invoice), then looked up. Already
-- credited: credited = false with the current balance. A failed row of the
-- same invoice and organization (an auto top-up invoice paid later) becomes
-- the credited purchase. The UNIQUE keys stay the last line of defence (ON
-- CONFLICT DO NOTHING). Without a Stripe reference (an admin grant) every
-- call credits.
CREATE OR REPLACE FUNCTION public.credit_minute_purchase(
  p_org_id uuid, p_minutes integer, p_amount_cents integer, p_currency text, p_source text,
  p_checkout_session_id text, p_invoice_id text, p_payment_intent_id text
)
RETURNS TABLE (credited boolean, balance_after integer)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_existing_id uuid;
  v_existing_org uuid;
  v_existing_status text;
  v_balance integer;
BEGIN
  IF p_org_id IS NULL OR p_minutes IS NULL OR p_minutes <= 0 THEN
    RAISE EXCEPTION 'credit_minute_purchase: an organization and a positive number of minutes are required' USING ERRCODE = '22023';
  END IF;
  IF p_checkout_session_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('minute_purchase:' || p_checkout_session_id));
  END IF;
  IF p_invoice_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('minute_purchase:' || p_invoice_id));
  END IF;
  IF p_payment_intent_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('minute_purchase:' || p_payment_intent_id));
  END IF;

  IF p_checkout_session_id IS NOT NULL OR p_invoice_id IS NOT NULL OR p_payment_intent_id IS NOT NULL THEN
    SELECT mp.id, mp.org_id, mp.status INTO v_existing_id, v_existing_org, v_existing_status
      FROM public.minute_purchases mp
     WHERE (p_checkout_session_id IS NOT NULL AND mp.stripe_checkout_session_id = p_checkout_session_id)
        OR (p_invoice_id IS NOT NULL AND mp.stripe_invoice_id = p_invoice_id)
        OR (p_payment_intent_id IS NOT NULL AND mp.stripe_payment_intent_id = p_payment_intent_id)
     ORDER BY (mp.status = 'credited') DESC
     LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL AND v_existing_status = 'credited' THEN
    SELECT o.extra_minutes_balance INTO v_balance FROM public.organizations o WHERE o.id = p_org_id;
    RETURN QUERY SELECT false, v_balance;
    RETURN;
  END IF;

  IF v_existing_id IS NOT NULL AND v_existing_org IS DISTINCT FROM p_org_id THEN
    RAISE EXCEPTION 'credit_minute_purchase: the Stripe reference is recorded for another organization' USING ERRCODE = '22023';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.minute_purchases
       SET status = 'credited',
           minutes = p_minutes,
           amount_cents = COALESCE(p_amount_cents, amount_cents),
           currency = COALESCE(p_currency, currency),
           stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, p_checkout_session_id),
           stripe_invoice_id = COALESCE(stripe_invoice_id, p_invoice_id),
           stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
           failure_message = NULL
     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.minute_purchases (org_id, minutes, amount_cents, currency, source, status, stripe_checkout_session_id, stripe_invoice_id, stripe_payment_intent_id)
    VALUES (p_org_id, p_minutes, COALESCE(p_amount_cents, 0), COALESCE(p_currency, 'usd'), p_source, 'credited', p_checkout_session_id, p_invoice_id, p_payment_intent_id)
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN
      SELECT o.extra_minutes_balance INTO v_balance FROM public.organizations o WHERE o.id = p_org_id;
      RETURN QUERY SELECT false, v_balance;
      RETURN;
    END IF;
  END IF;

  UPDATE public.organizations o
     SET extra_minutes_balance = o.extra_minutes_balance + p_minutes
   WHERE o.id = p_org_id
   RETURNING o.extra_minutes_balance INTO v_balance;
  RETURN QUERY SELECT true, v_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.credit_minute_purchase(uuid, integer, integer, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_minute_purchase(uuid, integer, integer, text, text, text, text, text) TO service_role;

-- ─── Start a usage period (service role only) ───────────────────────────────
-- Called for every renewal (and the first) invoice of the plan subscription:
-- only a later period start resets minutes_used, so a replayed or
-- out-of-order event changes nothing. The purchased balance is kept.
CREATE OR REPLACE FUNCTION public.start_usage_period(p_org_id uuid, p_period_start timestamptz)
RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_current timestamptz;
BEGIN
  IF p_org_id IS NULL OR p_period_start IS NULL THEN
    RETURN false;
  END IF;
  SELECT o.usage_period_start INTO v_current FROM public.organizations o WHERE o.id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_current IS NOT NULL AND p_period_start <= v_current THEN
    RETURN false;
  END IF;
  UPDATE public.organizations SET minutes_used = 0, usage_period_start = p_period_start WHERE id = p_org_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.start_usage_period(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_usage_period(uuid, timestamptz) TO service_role;

-- ─── Claim an auto top-up attempt (service role only) ───────────────────────
-- One attempt per organization per cooldown, across instances: the row lock
-- of the UPDATE serializes concurrent claims and the second sees the first's
-- timestamp.
CREATE OR REPLACE FUNCTION public.claim_auto_topup(p_org_id uuid, p_cooldown_seconds integer)
RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_org_id IS NULL OR p_cooldown_seconds IS NULL OR p_cooldown_seconds < 0 THEN
    RETURN false;
  END IF;
  UPDATE public.organizations
     SET auto_topup_last_attempt_at = now()
   WHERE id = p_org_id
     AND auto_topup_enabled
     AND (auto_topup_last_attempt_at IS NULL OR auto_topup_last_attempt_at < now() - make_interval(secs => p_cooldown_seconds));
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_auto_topup(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auto_topup(uuid, integer) TO service_role;

-- ─── Call usage: included minutes first, then the purchased balance ─────────
-- Same signature, return type, SECURITY DEFINER and search_path as 010; only
-- the organizations update changes. The org row is locked, the minutes past
-- the included ones (minutes_limit - minutes_used) are taken from
-- extra_minutes_balance (never below 0), and minutes_used grows only by the
-- minutes the balance did not cover: it is the period's included usage, so
-- purchased minutes are never counted again against the included ones (an
-- in-place upgrade, which changes minutes_limit only, gets exactly the
-- difference between the two allowances). It passes minutes_limit only when
-- the balance is empty too (the 60-second minimum of a capped call, or no cap
-- at all). usage_ledger keeps every minute of every call.
CREATE OR REPLACE FUNCTION public.record_call_usage(
  p_org_id uuid, p_call_id uuid, p_key text, p_seconds integer, p_provider text, p_source text
)
RETURNS TABLE (recorded boolean, minutes integer, minutes_used_after integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_minutes integer := GREATEST(0, CEIL(GREATEST(p_seconds, 0) / 60.0))::integer;
  v_after integer;
  v_used integer;
  v_limit integer;
  v_extra integer;
  v_included_left integer;
  v_from_extra integer;
BEGIN
  INSERT INTO usage_ledger (org_id, call_id, idempotency_key, provider, billable_seconds, minutes, source)
  VALUES (p_org_id, p_call_id, p_key, p_provider, GREATEST(p_seconds, 0), v_minutes, p_source)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, v_minutes, NULL::integer;
    RETURN;
  END IF;
  SELECT o.minutes_used, o.minutes_limit, o.extra_minutes_balance
    INTO v_used, v_limit, v_extra
    FROM organizations o WHERE o.id = p_org_id FOR UPDATE;
  v_included_left := GREATEST(COALESCE(v_limit, 0) - COALESCE(v_used, 0), 0);
  v_from_extra := LEAST(GREATEST(v_minutes - v_included_left, 0), COALESCE(v_extra, 0));
  UPDATE organizations o
     SET minutes_used = COALESCE(o.minutes_used, 0) + (v_minutes - v_from_extra),
         extra_minutes_balance = o.extra_minutes_balance - v_from_extra
   WHERE o.id = p_org_id
   RETURNING o.minutes_used INTO v_after;
  IF p_call_id IS NOT NULL THEN
    UPDATE calls SET usage_recorded_at = now() WHERE id = p_call_id;
  END IF;
  RETURN QUERY SELECT true, v_minutes, v_after;
END;
$$;
REVOKE ALL ON FUNCTION public.record_call_usage(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_call_usage(uuid, uuid, text, integer, text, text) TO service_role;

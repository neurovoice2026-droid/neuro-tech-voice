-- ══════════════════════════════════════════════════════════════════════════════
-- 028 · Service plans Growth and Scale, and monthly minutes on annual plans.
--   • organizations.plan accepts the owner's service price list (trial,
--     starter, growth, pro, business, scale and custom, shown as Enterprise)
--     next to the store tiers of 026 (store_starter, store_growth,
--     store_scale, store_enterprise); PLANS in types/index.ts is the source of
--     truth for prices and minutes.
--   • organizations.billing_interval: 'month' or 'year', the interval of the
--     plan subscription's price, written by the billing webhook whenever it
--     applies a subscription (NULL without one). Platform-written like the
--     027 minute columns, with its own guard (guard_billing_interval, own
--     trigger): 027 stays the only owner of guard_minute_columns, so
--     re-applying either migration, in any order, keeps both guards.
--   • roll_annual_usage_periods(): every plan card says "N minutes a month",
--     but Stripe renews an annual subscription (and start_usage_period resets
--     minutes_used) once a year. The 5-minute maintenance cron calls this to
--     start the monthly periods in between: minutes_used back to 0 and
--     usage_period_start moved forward by the whole months elapsed. The
--     purchased balance is kept.
-- Re-runnable: the plan CHECK is dropped and re-added with the full list, the
-- column, its CHECK, the functions and the trigger are created only if
-- missing or replaced in place. No row is rewritten, no default changes.
-- Requires 027 (roll_annual_usage_periods works on its usage_period_start).
-- Apply it BEFORE deploying the code that can write 'growth', 'scale' or
-- billing_interval (the billing webhook, onboarding).
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN (
    'trial', 'starter', 'growth', 'pro', 'business', 'scale', 'custom',
    'store_starter', 'store_growth', 'store_scale', 'store_enterprise'
  ));

-- ─── Billing interval of the plan subscription ──────────────────────────────
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS billing_interval text;
DO $$ BEGIN
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_interval_check
    CHECK (billing_interval IN ('month', 'year'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Column guard: billing_interval (tenant JWTs cannot write it) ──────────
-- Same pattern as guard_minute_columns (027) and guard_commerce_columns (024),
-- in a function and trigger of its own. A tenant that could set 'year' on a
-- monthly plan would have roll_annual_usage_periods() reset its minutes every
-- month, renewal paid or not.
CREATE OR REPLACE FUNCTION public.guard_billing_interval()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.billing_interval IS NOT NULL THEN
    RAISE EXCEPTION 'the billing interval is managed by the platform' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.billing_interval IS DISTINCT FROM OLD.billing_interval THEN
    RAISE EXCEPTION 'the billing interval is managed by the platform' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_billing_interval() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_billing_interval() TO service_role;
CREATE OR REPLACE TRIGGER organizations_guard_billing_interval BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_billing_interval();

-- ─── Monthly usage periods on annual plans (service role only) ──────────────
-- One set-based UPDATE. A due organization (billing_interval 'year', a paid
-- plan, usage_period_start + 1 month <= now()) gets minutes_used = 0 and
-- usage_period_start + n months, n the largest whole number of months with
-- usage_period_start + n months <= now() (calendar arithmetic: Jan 31 +
-- 1 month = Feb 28 or 29). The row lock of the UPDATE serializes it with
-- record_call_usage, start_usage_period and a concurrent run; the period
-- start the row was read with must still be there when it is written
-- (re-checked on a concurrently updated row), so a run never rolls a period a
-- renewal or another run has just moved, and a second run finds nothing due.
-- Returns the number of organizations rolled.
CREATE OR REPLACE FUNCTION public.roll_annual_usage_periods()
RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_rolled integer;
BEGIN
  UPDATE public.organizations o
     SET minutes_used = 0,
         usage_period_start = d.next_start
    FROM (
      SELECT x.id,
             x.start,
             x.start + make_interval(months => x.months - CASE WHEN x.start + make_interval(months => x.months) > now() THEN 1 ELSE 0 END) AS next_start
        FROM (
          SELECT oo.id,
                 oo.usage_period_start AS start,
                 ((EXTRACT(YEAR FROM now()) - EXTRACT(YEAR FROM oo.usage_period_start)) * 12
                   + (EXTRACT(MONTH FROM now()) - EXTRACT(MONTH FROM oo.usage_period_start)))::integer AS months
            FROM public.organizations oo
           WHERE oo.billing_interval = 'year'
             AND oo.plan IS NOT NULL
             AND oo.plan <> 'trial'
             AND oo.usage_period_start + interval '1 month' <= now()
        ) x
    ) d
   WHERE o.id = d.id
     AND o.usage_period_start = d.start
     AND o.billing_interval = 'year'
     AND o.plan IS NOT NULL
     AND o.plan <> 'trial'
     AND d.next_start > d.start;
  GET DIAGNOSTICS v_rolled = ROW_COUNT;
  RETURN v_rolled;
END;
$$;
REVOKE ALL ON FUNCTION public.roll_annual_usage_periods() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_annual_usage_periods() TO service_role;

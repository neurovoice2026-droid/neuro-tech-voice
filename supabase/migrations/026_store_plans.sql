-- ══════════════════════════════════════════════════════════════════════════════
-- 026 · Store plans. organizations.plan accepts the four online-store tiers
--       (store_starter, store_growth, store_scale, store_enterprise) next to the
--       service tiers of 007 (trial, starter, pro, business, custom); PLANS in
--       types/index.ts is the source of truth for prices and minutes.
-- Idempotent: the CHECK is dropped and re-added with the full list, so a
-- re-run ends in the same state. No row is rewritten, no default changes and
-- nothing else is touched (additive otherwise).
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN (
    'trial', 'starter', 'pro', 'business', 'custom',
    'store_starter', 'store_growth', 'store_scale', 'store_enterprise'
  ));

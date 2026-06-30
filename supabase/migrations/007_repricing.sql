-- ─── Repricing: new plan tiers ────────────────────────────────────────────────
-- Replaces free/pro/enterprise with trial/starter/pro/business/custom and
-- resizes minute allowances to the 60%-margin pricing model.

-- Drop the old default + CHECK so we can remap values that the old constraint
-- would reject (e.g. 'trial').
ALTER TABLE organizations ALTER COLUMN plan DROP DEFAULT;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;

-- Remap existing rows to the closest new tier.
UPDATE organizations SET plan = 'trial'    WHERE plan = 'free';
UPDATE organizations SET plan = 'business' WHERE plan = 'enterprise';
-- 'pro' keeps its name.

-- New allowance per tier (matches PLANS in types/index.ts).
UPDATE organizations SET minutes_limit = 30   WHERE plan = 'trial';
UPDATE organizations SET minutes_limit = 150  WHERE plan = 'starter';
UPDATE organizations SET minutes_limit = 850  WHERE plan = 'pro';
UPDATE organizations SET minutes_limit = 1750 WHERE plan = 'business';
UPDATE organizations SET minutes_limit = 3500 WHERE plan = 'custom';

-- Re-add the constraint with the new tiers and set the new defaults.
ALTER TABLE organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('trial', 'starter', 'pro', 'business', 'custom'));

ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'trial';
ALTER TABLE organizations ALTER COLUMN minutes_limit SET DEFAULT 30;

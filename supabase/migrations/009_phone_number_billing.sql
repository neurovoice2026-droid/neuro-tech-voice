-- ─── Phone number billing: recurring $1.15/mo pass-through subscription ─────
-- Each phone number gets its own dedicated Stripe subscription (not bundled
-- into the org's plan subscription), so the webhook can tell them apart and
-- release a number automatically if its subscription is ever cancelled.

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_phone_numbers_stripe_subscription
  ON phone_numbers (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Reflects the real pass-through rate (was a placeholder default of 1.00).
ALTER TABLE phone_numbers ALTER COLUMN monthly_cost SET DEFAULT 1.15;

-- ══════════════════════════════════════════════════════════════════════════════
-- 029 · Trial minutes default.
--   organizations.minutes_limit still defaults to 30 (007_repricing), while
--   the trial grants 5 minutes (PLANS.trial in types/index.ts, the site's
--   promise). handle_new_user inserts only user_id, so every new sign-up got
--   30 until onboarding wrote PLANS.trial. The default now matches PLANS.trial
--   (tests/migrations/029-trial-minutes-default.test.ts keeps them aligned).
-- Only the column DEFAULT changes: no existing row is rewritten (whether to
-- bring the organizations already at 30 down to 5 is the owner's decision).
-- Re-runnable.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

ALTER TABLE public.organizations ALTER COLUMN minutes_limit SET DEFAULT 5;

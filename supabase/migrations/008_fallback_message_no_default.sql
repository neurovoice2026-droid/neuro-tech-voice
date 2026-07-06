-- ─── Remove the hardcoded English fallback_message default ──────────────────
-- Every agent row got 'I apologize, I cannot help with that right now.' at
-- creation regardless of the agent's language, which silently defeated the
-- per-language default in lib/elevenlabs/prompt.ts (that logic only applies
-- when fallback_message is empty, but the DB default meant it never was).

-- Existing rows that still hold exactly the untouched default (i.e. nobody
-- customized it) go back to NULL, so the app's language-aware default takes
-- over for them too. Rows a Customer has actually edited are left alone.
UPDATE agents
SET fallback_message = NULL
WHERE fallback_message = 'I apologize, I cannot help with that right now.';

ALTER TABLE agents ALTER COLUMN fallback_message DROP DEFAULT;

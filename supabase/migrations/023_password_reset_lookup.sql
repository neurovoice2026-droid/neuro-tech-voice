-- ══════════════════════════════════════════════════════════════════════════════
-- 023 · Account lookup for app-sent password-reset emails
--
-- lib/auth/password-reset.ts asks whether an address belongs to an account that
-- can reset its password BEFORE minting a recovery token, so requests for
-- unknown addresses never count against the overall send caps (which would let
-- anyone exhaust them with made-up addresses) and never touch GoTrue.
--
-- Only the service role may call it: through PostgREST it would let anyone
-- test which addresses have accounts. Banned accounts (account deletion in
-- progress, lib/account) are treated as absent.
-- Idempotent and additive.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auth_account_can_reset(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = lower(btrim(p_email))
      AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until < now())
  )
$$;

REVOKE ALL ON FUNCTION public.auth_account_can_reset(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_account_can_reset(text) TO service_role;

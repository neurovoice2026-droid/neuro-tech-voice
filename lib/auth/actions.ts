'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { appUrl } from '@/lib/env'
import { ONBOARDED_COOKIE, isSupabaseAuthCookie, safeNextPath } from '@/lib/auth/paths'
import { RECOVERY_COOKIE, consumeRecoveryGrant, hasRecoveryGrant } from '@/lib/auth/recovery'
import { allowAccountSignIn, allowAuthAttempt, ipFromHeaders, recordFailedSignIn, type AuthAction } from '@/lib/auth/throttle'
import {
  AUTH_MESSAGES,
  passwordUpdateErrorMessage,
  resetRequestErrorOutcome,
  signInErrorMessage,
  signUpErrorOutcome,
  type AuthErrorLike,
} from '@/lib/auth/errors'
import {
  newPasswordFormSchema,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
  type NewPasswordInput,
  type PasswordResetRequestInput,
  type SignInInput,
  type SignUpInput,
} from '@/lib/auth/schemas'

// Server actions are public POST endpoints: every input is re-validated here,
// every attempt is rate limited, and no message reveals whether an email has
// an account. Upstream error text is logged (code/status only) and never
// returned.

export type AuthActionResult = { error: string } | { ok: true; message: string }

async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers())
}

/**
 * Base URL for links Supabase sends people back to. The PKCE code verifier
 * lives in a cookie on the host that started the flow, so return to that host
 * (a preview deployment, localhost) when the browser's Origin matches the
 * request's own host; otherwise the configured app URL. Supabase only
 * redirects to URLs on its allow list, so this can't become an open redirect.
 */
async function siteOrigin(): Promise<string> {
  const h = await headers()
  const origin = h.get('origin')
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (origin && host) {
    try {
      const url = new URL(origin)
      if ((url.protocol === 'https:' || url.protocol === 'http:') && url.host === host) return url.origin
    } catch {
      // Malformed Origin header: fall through to the configured URL.
    }
  }
  return appUrl()
}

async function throttled(
  action: AuthAction,
  subject: { email?: string; userId?: string },
  options: { countIp?: boolean } = {}
): Promise<boolean> {
  const ip = options.countIp === false ? null : await clientIp()
  return !(await allowAuthAttempt(action, { ip, ...subject }))
}

function logAuthError(action: AuthAction, error: AuthErrorLike | null | undefined): void {
  if (!error) return
  console.warn('[auth]', action, 'failed', error.code ?? 'no_code', error.status ?? 0)
}

// ─── Sign in with email + password ────────────────────────────────────────────
export async function signInWithEmail(input: SignInInput & { next?: string | null }): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return { error: AUTH_MESSAGES.invalidCredentials }
  const { email, password } = parsed.data

  // Every attempt counts per IP; per account only failures count (below).
  if (await throttled('sign_in', {})) return { error: AUTH_MESSAGES.tooManyAttempts }
  if (!(await allowAccountSignIn(email))) return { error: AUTH_MESSAGES.tooManyAttempts }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    logAuthError('sign_in', error)
    await recordFailedSignIn(email).catch((countError: unknown) =>
      console.warn('[auth] could not count a failed sign-in', countError instanceof Error ? countError.message : countError)
    )
    return { error: error ? signInErrorMessage(error) : AUTH_MESSAGES.signInUnavailable }
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('onboarding_completed')
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (orgError) console.error('[auth] onboarding lookup after sign-in failed', orgError.code)

  if (!org?.onboarding_completed) redirect('/onboarding')

  const cookieStore = await cookies()
  cookieStore.set(ONBOARDED_COOKIE, data.user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  redirect(safeNextPath(input?.next) ?? '/dashboard')
}

// ─── Sign up with email + password ────────────────────────────────────────────
export async function signUpWithEmail(input: SignUpInput): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return { error: AUTH_MESSAGES.invalidInput }
  const { fullName, email, password } = parsed.data

  if (await throttled('sign_up', { email })) return { error: AUTH_MESSAGES.tooManyAttempts }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // The confirmation link lands on the code exchange, which then routes
      // new accounts to onboarding.
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  })

  if (error) {
    logAuthError('sign_up', error)
    const outcome = signUpErrorOutcome(error)
    return 'error' in outcome ? outcome : { ok: true, message: AUTH_MESSAGES.checkEmailSignUp }
  }

  // With email confirmation on, Supabase returns no session, both for a new
  // account and (deliberately) for an address that is already registered.
  if (!data.session) return { ok: true, message: AUTH_MESSAGES.checkEmailSignUp }

  // Database trigger creates the organization row; new accounts start onboarding.
  redirect('/onboarding')
}

// ─── Sign in / sign up with Google OAuth ─────────────────────────────────────
export async function signInWithGoogle(): Promise<AuthActionResult> {
  if (await throttled('google', {})) return { error: AUTH_MESSAGES.tooManyAttempts }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback`,
      // Sign-in only needs the identity. Calendar and Gmail access is granted
      // separately from Integrations, with its own consent screen.
      queryParams: { prompt: 'select_account' },
    },
  })

  if (error || !data.url) {
    logAuthError('google', error)
    return { error: AUTH_MESSAGES.googleUnavailable }
  }

  redirect(data.url)
}

// ─── Password reset: request the email ───────────────────────────────────────
export async function requestPasswordReset(input: PasswordResetRequestInput): Promise<AuthActionResult> {
  const parsed = passwordResetRequestSchema.safeParse(input)
  if (!parsed.success) return { error: AUTH_MESSAGES.invalidEmail }
  const { email } = parsed.data

  if (await throttled('password_reset', { email })) return { error: AUTH_MESSAGES.tooManyAttempts }

  const supabase = await createClient()
  // PKCE: the code verifier is stored in a cookie on this browser, and the
  // link in the email is exchanged for a session by /reset-password/callback.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/reset-password/callback`,
  })

  if (error) {
    logAuthError('password_reset', error)
    const outcome = resetRequestErrorOutcome(error)
    if ('error' in outcome) return outcome
  }
  return { ok: true, message: AUTH_MESSAGES.resetSent }
}

// ─── Password reset: choose the new password ─────────────────────────────────
export async function updatePassword(input: NewPasswordInput): Promise<AuthActionResult> {
  const parsed = newPasswordFormSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? AUTH_MESSAGES.invalidInput }

  if (await throttled('password_update', {})) return { error: AUTH_MESSAGES.tooManyAttempts }

  const supabase = await createClient()
  // getUser() asks the Auth server, so a revoked recovery session can't be used.
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    logAuthError('password_update', userError)
    return { error: AUTH_MESSAGES.resetLinkExpired }
  }

  // The IP was already counted for this attempt above.
  if (await throttled('password_update', { userId: userData.user.id }, { countIp: false })) {
    return { error: AUTH_MESSAGES.tooManyAttempts }
  }

  // Only a session that came through the emailed reset link: an ordinary
  // signed-in session can't replace the password without knowing it.
  const cookieStore = await cookies()
  if (!(await hasRecoveryGrant(userData.user.id, cookieStore.get(RECOVERY_COOKIE)?.value))) {
    console.warn('[auth] password update without a recovery grant refused')
    return { error: AUTH_MESSAGES.resetLinkExpired }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    logAuthError('password_update', error)
    return { error: passwordUpdateErrorMessage(error) }
  }

  await consumeRecoveryGrant(userData.user.id).catch((grantError: unknown) =>
    console.warn('[auth] could not remove the used recovery grant', grantError instanceof Error ? grantError.message : grantError)
  )
  cookieStore.delete({ name: RECOVERY_COOKIE, path: '/' })

  // Whoever knew the old password shouldn't stay signed in elsewhere.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
  if (signOutError) logAuthError('password_update', signOutError)

  return { ok: true, message: AUTH_MESSAGES.passwordUpdated }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const { error } = await supabase.auth.signOut()
  if (error) {
    // The Auth server couldn't revoke the session (network error, outage).
    // supabase-js then keeps the session cookies, and a retry with
    // scope 'local' makes the same failing call first, so end the session in
    // this browser by removing the auth cookies directly: the session cookie,
    // its chunks (.0, .1…) and the PKCE code verifier.
    console.warn('[auth] sign-out failed', error.code ?? 'no_code', error.status ?? 0)
    for (const { name } of cookieStore.getAll()) {
      if (isSupabaseAuthCookie(name)) cookieStore.delete({ name, path: '/' })
    }
  }
  cookieStore.delete({ name: ONBOARDED_COOKIE, path: '/' })
  redirect('/login')
}

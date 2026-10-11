'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/observability/logger'
import { checkPwnedPassword } from '@/lib/security/pwned-passwords'
import {
  emailSchema,
  fullNameSchema,
  newPasswordSchema,
  PWNED_PASSWORD_MESSAGE,
  type AuthFormField,
  type PasswordActionResult,
} from '@/lib/auth/password-policy'

// Server actions are public endpoints: the form's schema is re-applied here.
const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
})

const FORM_FIELDS: readonly AuthFormField[] = ['fullName', 'email', 'password']

/** First schema problem as an action result, shown under the field it is about. */
function invalid(error: z.ZodError): PasswordActionResult {
  const issue = error.issues[0]
  const field = FORM_FIELDS.find((f) => f === issue?.path[0])
  return { error: issue?.message ?? 'Please check the form.', ...(field ? { field } : {}) }
}

/** The breach check result as an action result, or undefined to proceed (also when the check could not run). */
async function rejectPwned(password: string, route: string): Promise<PasswordActionResult> {
  const pwned = await checkPwnedPassword(password, { log: createLogger({ route }) })
  return pwned.status === 'pwned' ? { error: PWNED_PASSWORD_MESSAGE, field: 'password', reason: 'pwned' } : undefined
}

/**
 * The auth server's own password refusals, under the password field: its
 * password requirements (dashboard setting) or, on Pro, its leaked-password
 * check. Its raw weak_password text lists whole alphabets, so it is reworded.
 */
function authPasswordError(error: { message: string; code?: string; reasons?: unknown }): PasswordActionResult {
  if (error.code === 'weak_password') {
    const pwned = Array.isArray(error.reasons) && error.reasons.includes('pwned')
    return pwned
      ? { error: PWNED_PASSWORD_MESSAGE, field: 'password', reason: 'pwned' }
      : { error: "This password doesn't meet the security requirements. Please choose a stronger one.", field: 'password', reason: 'weak' }
  }
  if (error.code === 'same_password') return { error: error.message, field: 'password', reason: 'same' }
  return { error: error.message }
}

// ─── Sign in with email + password ────────────────────────────────────────────
export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Authentication failed. Please try again.' }

  const { data: org } = await supabase
    .from('organizations')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (!org?.onboarding_completed) {
    redirect('/onboarding')
  }
  redirect('/dashboard')
}

// ─── Sign up with email + password ────────────────────────────────────────────
export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string
): Promise<PasswordActionResult> {
  const parsed = signUpSchema.safeParse({ fullName, email, password })
  if (!parsed.success) return invalid(parsed.error)
  const rejected = await rejectPwned(parsed.data.password, 'auth.sign_up')
  if (rejected) return rejected

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  })

  if (error) return authPasswordError(error)

  // DB trigger creates organization row automatically.
  // New users always go to onboarding.
  redirect('/onboarding')
}

// ─── Open a password-reset link (token-hash email template) ───────────────────
// /reset-password/confirm posts the link's token here from a button, so mail
// scanners that open links do not use up the one-time token. Unlike the PKCE
// link handled by /auth/callback, this works in any browser or device.
export async function confirmPasswordReset(formData: FormData): Promise<void> {
  const tokenHash = formData.get('token_hash')
  if (typeof tokenHash !== 'string' || !/^[A-Za-z0-9_-]{8,512}$/.test(tokenHash)) redirect('/forgot-password/expired')

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  if (error) {
    createLogger({ route: 'auth.confirm_reset' }).warn('auth.recovery_verify_failed', { code: error.code ?? null, status: error.status ?? null })
    redirect('/forgot-password/expired')
  }
  redirect('/reset-password')
}

// ─── Set a new password (password recovery) ──────────────────────────────────
// The reset link signs the user in (/reset-password/confirm or /auth/callback);
// this sets the new password on that session. Every password change goes through here, never
// through the browser client, so the rules and the breach check always apply.
export async function updatePassword(password: string): Promise<PasswordActionResult> {
  const parsed = newPasswordSchema.safeParse(password)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please choose a different password.', field: 'password', reason: 'weak' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Your reset link has expired. Please request a new one.' }

  const rejected = await rejectPwned(parsed.data, 'auth.update_password')
  if (rejected) return rejected

  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) return authPasswordError(error)

  // The proxy sends accounts that have not finished onboarding there instead.
  redirect('/dashboard')
}

// ─── Sign in / sign up with Google OAuth ─────────────────────────────────────
export async function signInWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })

  if (error || !data.url) {
    return { error: error?.message ?? 'Google sign-in failed. Please try again.' }
  }

  redirect(data.url)
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

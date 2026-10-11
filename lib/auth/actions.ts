'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/observability/logger'
import { checkPwnedPassword } from '@/lib/security/pwned-passwords'
import { newPasswordSchema, PWNED_PASSWORD_MESSAGE, type PasswordActionResult } from '@/lib/auth/password-policy'

// Server actions are public endpoints: the form's schema is re-applied here.
const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Please enter a valid email'),
  password: newPasswordSchema,
})

/** First schema problem as an action result; password problems go under the password field. */
function invalid(error: z.ZodError): PasswordActionResult {
  const issue = error.issues[0]
  return issue?.path[0] === 'password' ? { error: issue.message, field: 'password' } : { error: issue?.message ?? 'Please check the form.' }
}

/** The breach check result as an action result, or undefined to proceed (also when the check could not run). */
async function rejectPwned(password: string, route: string): Promise<PasswordActionResult> {
  const pwned = await checkPwnedPassword(password, { log: createLogger({ route }) })
  return pwned.status === 'pwned' ? { error: PWNED_PASSWORD_MESSAGE, field: 'password' } : undefined
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

  if (error) return { error: error.message }

  // DB trigger creates organization row automatically.
  // New users always go to onboarding.
  redirect('/onboarding')
}

// ─── Set a new password (password recovery) ──────────────────────────────────
// The reset link signs the user in through /auth/callback; this sets the new
// password on that session. Every password change goes through here, never
// through the browser client, so the rules and the breach check always apply.
export async function updatePassword(password: string): Promise<PasswordActionResult> {
  const parsed = newPasswordSchema.safeParse(password)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please choose a different password.', field: 'password' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Your reset link has expired. Please request a new one.' }

  const rejected = await rejectPwned(parsed.data, 'auth.update_password')
  if (rejected) return rejected

  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) {
    const aboutPassword = error.code === 'same_password' || error.code === 'weak_password'
    return aboutPassword ? { error: error.message, field: 'password' } : { error: error.message }
  }

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

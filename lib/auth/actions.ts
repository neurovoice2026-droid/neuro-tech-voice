'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) return { error: error.message }

  // DB trigger creates organization row automatically.
  // New users always go to onboarding.
  redirect('/onboarding')
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

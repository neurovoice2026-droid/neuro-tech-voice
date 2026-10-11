import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Where a link may ask to land after sign-in. An exact allow-list: `next` is
// user-controlled, so it never becomes an arbitrary redirect target.
const NEXT_PATHS = new Set(['/reset-password'])

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Password recovery: the reset email's link signs the user in, then the new password is set there.
        if (next && NEXT_PATHS.has(next)) return NextResponse.redirect(`${origin}${next}`)

        const { data: org } = await supabase
          .from('organizations')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .single()

        if (!org?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    }
  }

  // An expired or reused reset link: offer a new one instead of the sign-in page.
  if (next === '/reset-password') return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`)
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

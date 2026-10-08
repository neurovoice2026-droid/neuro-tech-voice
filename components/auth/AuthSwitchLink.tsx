'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// The "switch" line in the auth header (right of the wordmark): register offers
// sign-in, every other auth page (login, forgot password) offers sign-up.
const toSignIn = { prompt: 'Already have an account?', label: 'Sign in', href: '/login' }
const toSignUp = { prompt: 'New to NeuroVoice?', label: 'Create an account', href: '/register' }

export function AuthSwitchLink() {
  const pathname = usePathname()
  const { prompt, label, href } = pathname === '/register' ? toSignIn : toSignUp

  return (
    <p className="flex items-center gap-1 text-[13px] leading-[19px] text-muted-foreground">
      <span className="hidden sm:inline">{prompt}</span>
      <Link
        href={href}
        className="rounded-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {label}
      </Link>
    </p>
  )
}

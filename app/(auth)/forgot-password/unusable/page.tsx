import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Reset password',
}

// Where /auth/callback sends a reset link it cannot use in this browser: the
// PKCE code verifier is missing (link opened in another browser or device, or
// a link already used here). A static page, so the notice is in the first HTML.
export default function ResetLinkUnusablePage() {
  return <ForgotPasswordForm notice="unusable" />
}

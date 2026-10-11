import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Reset password',
}

// Where an expired or already-used reset link sends the user (/auth/callback,
// /reset-password/confirm). A static page, so the notice is in the first HTML.
export default function ResetLinkExpiredPage() {
  return <ForgotPasswordForm notice="expired" />
}

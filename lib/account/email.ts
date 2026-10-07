import 'server-only'
// Confirmation sent to the account's sign-in address once the account is
// deleted. The address is read from the sign-in just before it is deleted
// and is never stored or logged.

import { sendEmail } from '@/lib/email/client'
import type { Logger } from '@/lib/observability/logger'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Neuro Tech Voice'

export function accountDeletedEmail(): { subject: string; html: string } {
  const p = (text: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151">${text}</p>`
  return {
    subject: `Your ${APP_NAME} account has been deleted`,
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
<h1 style="margin:0 0 16px;font-size:20px;color:#111827">Your account has been deleted</h1>
${p('As you asked, your subscription was cancelled, your phone numbers were released, and your AI agent, call records, recordings, knowledge base, custom voices and files were deleted, here and at our voice providers.')}
${p('As Romanian accounting law requires, we keep your invoices (and the monthly minute totals they were based on) for 10 years. Nothing else is kept.')}
${p('If you did not ask for this, reply to this email straight away.')}
</div></body></html>`,
  }
}

/** Never throws (sendEmail logs and returns false on failure). */
export async function sendAccountDeletedEmail(to: string, log: Logger): Promise<boolean> {
  const content = accountDeletedEmail()
  const sent = await sendEmail({ to, subject: content.subject, html: content.html })
  if (!sent) log.warn('account_deletion.confirmation_not_sent')
  return sent
}

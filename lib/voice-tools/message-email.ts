// The e-mail the business receives when the agent takes a message during a
// call. Inline styles only; every value is escaped. Pure.

import type { MessageUrgency } from '@/types'
import { safeTimeZone } from '@/lib/scheduling/time'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Neuro Tech Voice'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** No line breaks or control characters in a header value. */
function headerSafe(s: string): string {
  return s.replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim()
}

export interface MessageEmailInput {
  businessName: string | null
  callerName: string | null
  callbackNumber: string | null
  reason: string
  urgency: MessageUrgency
  receivedAt: Date
  timezone: string
  isTest: boolean
  /** The caller corrected a message already sent. */
  updated: boolean
  /** Absolute dashboard URL (NEXT_PUBLIC_APP_URL); omitted when unknown. */
  dashboardUrl: string | null
}

export function messageTakenEmail(input: MessageEmailInput): { subject: string; html: string } {
  const urgent = input.urgency === 'urgent'
  const who = input.callerName?.trim() || 'a caller'
  const prefix = `${input.isTest ? 'Test call: ' : ''}${urgent ? '[URGENT] ' : ''}`
  const subject = headerSafe(`${prefix}${input.updated ? 'Updated message' : 'New message'} from ${who}`).slice(0, 200)
  const when = new Intl.DateTimeFormat('en-GB', { timeZone: safeTimeZone(input.timezone), dateStyle: 'full', timeStyle: 'short' }).format(input.receivedAt)
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;color:#111827;font-size:14px">${esc(value)}</td></tr>`
  const banner = urgent
    ? `<p style="margin:0 0 16px;padding:10px 14px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:14px;font-weight:600">Marked urgent during the call: please call back as soon as possible.</p>`
    : ''
  const test = input.isTest ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280">This message comes from a test call.</p>` : ''
  const link = input.dashboardUrl
    ? `<p style="margin:20px 0 0"><a href="${esc(input.dashboardUrl)}" style="color:#7c3aed;font-size:14px">Open your messages to follow up</a></p>`
    : ''
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<h1 style="margin:0 0 16px;font-size:19px;color:#111827">${esc(input.updated ? 'Updated message' : 'New message')} for ${esc(input.businessName?.trim() || 'your business')}</h1>
${test}${banner}
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151">${esc(input.reason)}</p>
<table role="presentation" cellpadding="0" cellspacing="0">
${row('Caller', input.callerName?.trim() || 'Not given')}
${row('Call back on', input.callbackNumber || 'Not given')}
${row('Urgency', urgent ? 'Urgent' : 'Normal')}
${row('Received', when)}
</table>
${link}
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">Taken by your AI phone assistant (${esc(APP_NAME)}). You receive this because message alerts are on in your agent's Call handling settings.</p>
</td></tr></table>
</td></tr></table>
</body></html>`
  return { subject, html }
}

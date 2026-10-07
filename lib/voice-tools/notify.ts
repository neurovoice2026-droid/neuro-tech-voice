import 'server-only'
// Instant e-mail alert when the agent takes a message (platform e-mail
// client, lib/email/client.ts). Recipients come ONLY from the org's settings:
// the owner's verified account address (when enabled) and the extra
// addresses the owner added, never from the call or the model. Bounded: at
// most MAX_MESSAGE_EMAILS_PER_CALL per call (the first message and one
// correction) and MESSAGE_EMAIL_DAILY_CAP per organisation per day.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { isConfigured as emailConfigured, sendEmail } from '@/lib/email/client'
import { rateLimit } from '@/lib/security/rate-limit'
import type { MessageSettings } from '@/lib/voice-providers/types'
import type { MessageUrgency } from '@/types'
import type { ToolCallContext } from './call-context'
import { messageTakenEmail } from './message-email'

export const MAX_MESSAGE_EMAILS_PER_CALL = 2

/** MESSAGE_EMAIL_DAILY_CAP: alert e-mails per organisation per day (1–1000, default 100). */
export function messageEmailDailyCap(): number {
  const raw = (process.env.MESSAGE_EMAIL_DAILY_CAP ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isInteger(v) && v >= 1 && v <= 1000 ? v : 100
}

/** Whether a message of this urgency is e-mailed under these settings. */
export function shouldEmail(settings: MessageSettings, urgency: MessageUrgency): boolean {
  if (settings.email_notifications === 'off') return false
  if (settings.email_notifications === 'urgent_only') return urgency === 'urgent'
  return true
}

/** The owner's account address, only when Supabase Auth confirmed it. */
export async function ownerVerifiedEmail(db: SupabaseClient, userId: string, log: Logger): Promise<string | null> {
  const { data, error } = await db.auth.admin.getUserById(userId)
  if (error) {
    log.error('message_alert.owner_lookup_failed', error)
    return null
  }
  const user = data?.user
  if (!user?.email || !user.email_confirmed_at) return null
  return user.email.trim().toLowerCase()
}

/** Owner (verified) + the extra addresses from the settings, de-duplicated. */
export async function messageRecipients(db: SupabaseClient, ownerUserId: string | null, settings: MessageSettings, log: Logger): Promise<string[]> {
  const out = new Set<string>()
  if (settings.notify_owner && ownerUserId) {
    const owner = await ownerVerifiedEmail(db, ownerUserId, log)
    if (owner) out.add(owner)
  }
  for (const address of settings.extra_recipients) out.add(address.trim().toLowerCase())
  return [...out]
}

export interface MessageAlert {
  id: string
  callerName: string | null
  callbackNumber: string | null
  reason: string
  urgency: MessageUrgency
  /** notify_count read with the message: the per-call budget is claimed with compare-and-set on it. */
  notifyCount: number
  updated: boolean
}

export type AlertOutcome = 'sent' | 'skipped' | 'failed'

async function recordOutcome(db: SupabaseClient, id: string, orgId: string, patch: Record<string, unknown>, log: Logger): Promise<void> {
  const { error } = await db.from('call_messages').update(patch).eq('id', id).eq('org_id', orgId)
  if (error) log.error('message_alert.status_write_failed', error)
}

export async function notifyMessageTaken(ctx: ToolCallContext, alert: MessageAlert, log: Logger): Promise<AlertOutcome> {
  const settings = ctx.agent.messages
  if (!shouldEmail(settings, alert.urgency)) return 'skipped'
  if (!emailConfigured()) {
    log.warn('message_alert.email_not_configured')
    await recordOutcome(ctx.db, alert.id, ctx.org.id, { notify_error: 'email_not_configured' }, log)
    return 'skipped'
  }
  if (alert.notifyCount >= MAX_MESSAGE_EMAILS_PER_CALL) return 'skipped'
  // Per-call budget: compare-and-set, so parallel corrections send one e-mail each at most.
  const { data: claimed, error: claimErr } = await ctx.db
    .from('call_messages')
    .update({ notify_count: alert.notifyCount + 1 })
    .eq('id', alert.id)
    .eq('org_id', ctx.org.id)
    .eq('notify_count', alert.notifyCount)
    .select('id')
  if (claimErr) {
    log.error('message_alert.claim_failed', claimErr)
    return 'failed'
  }
  if (!claimed || claimed.length === 0) return 'skipped'

  const recipients = await messageRecipients(ctx.db, ctx.org.userId, settings, log)
  if (recipients.length === 0) {
    log.warn('message_alert.no_recipients')
    await recordOutcome(ctx.db, alert.id, ctx.org.id, { notify_error: 'no_recipients' }, log)
    return 'skipped'
  }
  const cap = await rateLimit({ name: 'message_alert_email', limit: messageEmailDailyCap(), windowSeconds: 86_400 }, ctx.org.id)
  if (!cap.allowed) {
    log.warn('message_alert.daily_cap_reached')
    await recordOutcome(ctx.db, alert.id, ctx.org.id, { notify_error: 'daily_cap' }, log)
    return 'skipped'
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  const email = messageTakenEmail({
    businessName: ctx.org.name,
    callerName: alert.callerName,
    callbackNumber: alert.callbackNumber,
    reason: alert.reason,
    urgency: alert.urgency,
    receivedAt: ctx.now,
    timezone: ctx.org.timezone,
    isTest: ctx.call.is_test,
    updated: alert.updated,
    dashboardUrl: appUrl && URL.canParse(appUrl) ? `${appUrl}/dashboard` : null,
  })
  const sent = await sendEmail({ to: recipients, subject: email.subject, html: email.html })
  if (!sent) {
    log.error('message_alert.send_failed', undefined, { recipients: recipients.length })
    await recordOutcome(ctx.db, alert.id, ctx.org.id, { notify_error: 'send_failed' }, log)
    return 'failed'
  }
  await recordOutcome(ctx.db, alert.id, ctx.org.id, { notified_at: new Date().toISOString(), notify_error: null }, log)
  log.info('message_alert.sent', { recipients: recipients.length, urgent: alert.urgency === 'urgent' })
  return 'sent'
}

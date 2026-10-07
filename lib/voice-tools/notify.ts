import 'server-only'
// Instant e-mail alert when the agent takes a message (platform e-mail
// client, lib/email/client.ts). Recipients come ONLY from the org's settings:
// the owner's verified account address (when enabled) and, on a paid plan
// only, the extra addresses the owner added; never from the call or the
// model. Bounded: at most MAX_MESSAGE_EMAILS_PER_CALL per call (the first
// message and one correction) and a daily cap per organisation (lower on the
// trial). The alert is sent from the PLATFORM's domain with text a caller
// dictated, so it must not become a relay: links are removed from the
// caller-provided texts and from the business name (organizations.name is
// tenant data) before they reach the e-mail.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { isConfigured as emailConfigured, sendEmail } from '@/lib/email/client'
import { rateLimit } from '@/lib/security/rate-limit'
import type { MessageSettings } from '@/lib/voice-providers/types'
import { PLANS, type MessageUrgency } from '@/types'
import type { ToolCallContext } from './call-context'
import { messageTakenEmail } from './message-email'

export const MAX_MESSAGE_EMAILS_PER_CALL = 2

function envCap(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isInteger(v) && v >= 1 && v <= 1000 ? v : fallback
}

/**
 * Alert e-mails per organisation per day: MESSAGE_EMAIL_DAILY_CAP (1–1000,
 * default 100) on a paid plan, MESSAGE_EMAIL_DAILY_CAP_TRIAL (1–1000,
 * default 20, never above the paid cap) otherwise.
 */
export function messageEmailDailyCap(paid = true): number {
  const cap = envCap('MESSAGE_EMAIL_DAILY_CAP', 100)
  return paid ? cap : Math.min(cap, envCap('MESSAGE_EMAIL_DAILY_CAP_TRIAL', 20))
}

/** A plan the organisation pays for (unknown or missing = trial: never more rights). */
export function isPaidMessagePlan(plan: string | null | undefined): boolean {
  return !!plan && plan !== 'trial' && Object.hasOwn(PLANS, plan)
}

export const LINK_REMOVED = '[link removed]'

// Schemes ("https://", "hxxp://", "ftp://"), "www." hosts, IP hosts with a
// port or path, and bare domains of common TLDs, which mail clients turn
// into links. E-mail addresses are kept (a caller may leave one).
const LINK_PATTERNS: readonly RegExp[] = [
  /\b[a-z][a-z0-9+.-]{0,20}:\/\/[^\s<>"'()]*/gi,
  /\bwww\d{0,3}\.[^\s<>"'()]+/gi,
  /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?\/[^\s<>"'()]*/g,
  /\b\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}\b/g,
  /(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|info|biz|io|co|ai|app|dev|me|ly|to|tv|cc|ws|pw|su|xyz|top|site|online|link|click|live|shop|store|club|icu|buzz|win|bid|vip|tk|ml|ga|cf|gq|ro|md|ru|ua|eu|uk|de|fr|it|es|nl|pl|hu|bg|cn|us)\b(?![@\w-])(?:[/?#:][^\s<>"'()]*)?/gi,
]

/** `text` with every URL-like part replaced by "[link removed]" (caller and tenant text in the alert e-mail). */
export function withoutLinks(text: string): string {
  let out = text
  for (const re of LINK_PATTERNS) out = out.replace(re, LINK_REMOVED)
  return out
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

/**
 * Owner (verified) + the extra addresses from the settings, de-duplicated.
 * Extra addresses only on a paid plan: on the trial the alert goes to the
 * owner's verified address only.
 */
export async function messageRecipients(
  db: SupabaseClient,
  ownerUserId: string | null,
  settings: MessageSettings,
  log: Logger,
  opts: { extraRecipients: boolean } = { extraRecipients: true },
): Promise<string[]> {
  const out = new Set<string>()
  if (settings.notify_owner && ownerUserId) {
    const owner = await ownerVerifiedEmail(db, ownerUserId, log)
    if (owner) out.add(owner)
  }
  if (opts.extraRecipients) for (const address of settings.extra_recipients) out.add(address.trim().toLowerCase())
  else if (settings.extra_recipients.length) log.info('message_alert.extra_recipients_need_paid_plan', { skipped: settings.extra_recipients.length })
  return [...out]
}

/** The organisation's plan (null when unreadable: treated as the trial). */
async function orgPlan(db: SupabaseClient, orgId: string, log: Logger): Promise<string | null> {
  const { data, error } = await db.from('organizations').select('plan').eq('id', orgId).maybeSingle()
  if (error) {
    log.error('message_alert.plan_lookup_failed', error)
    return null
  }
  return typeof data?.plan === 'string' ? data.plan : null
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

  const paid = isPaidMessagePlan(await orgPlan(ctx.db, ctx.org.id, log))
  const recipients = await messageRecipients(ctx.db, ctx.org.userId, settings, log, { extraRecipients: paid })
  if (recipients.length === 0) {
    log.warn('message_alert.no_recipients')
    await recordOutcome(ctx.db, alert.id, ctx.org.id, { notify_error: 'no_recipients' }, log)
    return 'skipped'
  }
  const cap = await rateLimit({ name: 'message_alert_email', limit: messageEmailDailyCap(paid), windowSeconds: 86_400 }, ctx.org.id)
  if (!cap.allowed) {
    log.warn('message_alert.daily_cap_reached')
    await recordOutcome(ctx.db, alert.id, ctx.org.id, { notify_error: 'daily_cap' }, log)
    return 'skipped'
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  const email = messageTakenEmail({
    // Caller-dictated and tenant texts never carry a link (no relay through our domain).
    businessName: ctx.org.name === null ? null : withoutLinks(ctx.org.name),
    callerName: alert.callerName === null ? null : withoutLinks(alert.callerName),
    callbackNumber: alert.callbackNumber,
    reason: withoutLinks(alert.reason),
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
  log.info('message_alert.sent', { recipients: recipients.length, urgent: alert.urgency === 'urgent', paid })
  return 'sent'
}

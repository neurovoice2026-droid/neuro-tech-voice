import 'server-only'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { isTwilioConfigured } from '@/lib/env'
import { isPremiumRateNumber } from '@/lib/phone/destinations'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTwilioClient, twilioErrorInfo } from '@/lib/twilio/client'
import { telephonyUrl } from '@/lib/twilio/webhooks'
import type { Plan, SmsKind } from '@/types'

// Caller-facing SMS (booking confirmations, reminders, the send_sms tool,
// team notifications). Every send passes the same guard: telephony
// configured, a valid E.164 destination, the org's SMS switch and plan, the
// recipient's STOP opt-out and an SMS-capable number to send from. Every
// attempt, sent or failed at Twilio, is logged in sms_messages.

export const MAX_SMS_BODY_CHARACTERS = 480

export type SmsFailureReason =
  | 'not_configured'
  | 'sms_disabled'
  | 'opted_out'
  | 'no_sms_number'
  | 'invalid_number'
  | 'provider_error'

export type SendSmsResult = { ok: true; sid: string } | { ok: false; reason: SmsFailureReason }

export interface SendSmsInput {
  orgId: string
  to: string
  body: string
  kind: SmsKind
  callId?: string | null
  bookingId?: string | null
}

export interface SmsGuardFacts {
  twilioConfigured: boolean
  /** E.164 after normalisation, or null. */
  to: string | null
  org: { plan: Plan; sms_enabled: boolean } | null
  optedOut: boolean
  fromNumber: string | null
  /** 'notification' texts go to the business's own team, which the caller-texts switch doesn't cover. */
  kind?: SmsKind
}

/** First reason the message can't be sent, in the order an owner would fix them; null = send. */
export function smsGuardReason(facts: SmsGuardFacts): Exclude<SmsFailureReason, 'provider_error'> | null {
  if (!facts.twilioConfigured) return 'not_configured'
  // Premium-rate ranges are where SMS pumping fraud earns: never texted.
  if (!facts.to || isPremiumRateNumber(facts.to)) return 'invalid_number'
  if (!facts.org || !entitlementsFor(facts.org.plan).smsConfirmations) return 'sms_disabled'
  // organizations.sms_enabled is the owner's switch for texts to callers; alerts to their own team still go out.
  if (!facts.org.sms_enabled && facts.kind !== 'notification') return 'sms_disabled'
  if (facts.optedOut) return 'opted_out'
  if (!facts.fromNumber) return 'no_sms_number'
  return null
}

/** Collapses whitespace runs inside lines and trims to the limit at a word boundary. */
export function normalizeSmsBody(body: string): string {
  const clean = String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const chars = Array.from(clean)
  if (chars.length <= MAX_SMS_BODY_CHARACTERS) return clean
  const cut = chars.slice(0, MAX_SMS_BODY_CHARACTERS - 1).join('')
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > cut.length * 0.8 ? cut.slice(0, lastSpace) : cut}…`
}

// Twilio 21610: the recipient replied STOP to this sender at the carrier level.
const TWILIO_UNSUBSCRIBED = 21610

type SenderRow = { id: string; number: string; is_active: boolean; sms_capable: boolean }

async function loadSender(orgId: string, callId: string | null): Promise<string | null> {
  const supabase = createAdminClient()
  // Prefer the number the call came in on, so the caller gets the text from
  // the number they just dialled.
  if (callId) {
    const { data: call } = await supabase
      .from('calls')
      .select('phone_number_id')
      .eq('id', callId)
      .eq('org_id', orgId)
      .maybeSingle()
    const phoneNumberId = (call as { phone_number_id: string | null } | null)?.phone_number_id
    if (phoneNumberId) {
      const { data } = await supabase
        .from('phone_numbers')
        .select('id, number, is_active, sms_capable')
        .eq('id', phoneNumberId)
        .eq('org_id', orgId)
        .maybeSingle()
      const row = data as SenderRow | null
      if (row?.is_active && row.sms_capable) return row.number
    }
  }
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('id, number, is_active, sms_capable')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .eq('sms_capable', true)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) {
    console.error('[telephony] sms sender lookup failed', error.code, error.message)
    return null
  }
  return ((data ?? []) as SenderRow[])[0]?.number ?? null
}

async function logSms(row: {
  org_id: string
  call_id: string | null
  booking_id: string | null
  kind: SmsKind
  to_number: string
  from_number: string
  body: string
  twilio_sid: string | null
  status: string
  error_code: string | null
}): Promise<void> {
  const { error } = await createAdminClient()
    .from('sms_messages')
    .insert({ ...row, direction: 'outbound' })
  if (error) console.error('[telephony] sms log insert failed', error.code, error.message)
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const to = normalizeE164(input.to)
  const body = normalizeSmsBody(input.body)
  const callId = input.callId ?? null
  const bookingId = input.bookingId ?? null

  if (!isTwilioConfigured()) return { ok: false, reason: 'not_configured' }
  if (!to) return { ok: false, reason: 'invalid_number' }
  if (!body) {
    console.error('[telephony] sendSms called with an empty body', input.kind)
    return { ok: false, reason: 'provider_error' }
  }

  const supabase = createAdminClient()
  const [orgResult, optOutResult, fromNumber] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', input.orgId).maybeSingle(),
    supabase.from('sms_opt_outs').select('phone').eq('org_id', input.orgId).eq('phone', to).maybeSingle(),
    loadSender(input.orgId, callId),
  ])
  if (orgResult.error) {
    console.error('[telephony] sms org lookup failed', orgResult.error.code, orgResult.error.message)
    return { ok: false, reason: 'provider_error' }
  }
  if (optOutResult.error) {
    // Never text someone we can't prove hasn't opted out.
    console.error('[telephony] sms opt-out lookup failed', optOutResult.error.code, optOutResult.error.message)
    return { ok: false, reason: 'provider_error' }
  }
  const orgRow = orgResult.data as { plan: Plan; sms_enabled?: boolean } | null
  const reason = smsGuardReason({
    twilioConfigured: true,
    to,
    // sms_enabled defaults to true (migration 010), same as the dashboard reads it.
    org: orgRow ? { plan: orgRow.plan, sms_enabled: orgRow.sms_enabled ?? true } : null,
    optedOut: !!optOutResult.data,
    fromNumber,
    kind: input.kind,
  })
  if (reason) return { ok: false, reason }
  const from = fromNumber as string

  try {
    const message = await getTwilioClient().messages.create({
      to,
      from,
      body,
      statusCallback: telephonyUrl('sms', { event: 'status' }),
    })
    await logSms({
      org_id: input.orgId,
      call_id: callId,
      booking_id: bookingId,
      kind: input.kind,
      to_number: to,
      from_number: from,
      body,
      twilio_sid: message.sid,
      status: message.status ?? 'queued',
      error_code: null,
    })
    return { ok: true, sid: message.sid }
  } catch (error) {
    const info = twilioErrorInfo(error)
    console.error('[telephony] sms send failed', info.status, info.code, maskPhone(to))
    await logSms({
      org_id: input.orgId,
      call_id: callId,
      booking_id: bookingId,
      kind: input.kind,
      to_number: to,
      from_number: from,
      body,
      twilio_sid: null,
      status: 'failed',
      error_code: info.code !== null ? String(info.code) : null,
    })
    if (info.code === TWILIO_UNSUBSCRIBED) {
      // Keep our own list in step with the carrier's so we stop trying.
      const { error: optOutError } = await supabase
        .from('sms_opt_outs')
        .upsert({ org_id: input.orgId, phone: to }, { onConflict: 'org_id,phone', ignoreDuplicates: true })
      if (optOutError) console.error('[telephony] sms opt-out insert failed', optOutError.code, optOutError.message)
      return { ok: false, reason: 'opted_out' }
    }
    return { ok: false, reason: 'provider_error' }
  }
}

// ─── Delivery status callbacks ───────────────────────────────────────────────

// Twilio can deliver status callbacks out of order (a late "sent" after
// "delivered"), so a status only replaces one at the same or an earlier stage.
const SMS_STATUS_STAGE: Record<string, number> = {
  accepted: 0,
  scheduled: 0,
  queued: 0,
  sending: 1,
  sent: 2,
  partially_delivered: 3,
  delivered: 3,
  undelivered: 3,
  failed: 3,
  canceled: 3,
  read: 4,
}

/**
 * The stored statuses a delivery callback may overwrite, or null when the
 * incoming status is unknown (then it is ignored rather than guessed at).
 */
export function smsStatusesReplaceableBy(status: string): string[] | null {
  const stage = SMS_STATUS_STAGE[status]
  if (stage === undefined) return null
  return Object.keys(SMS_STATUS_STAGE).filter((known) => SMS_STATUS_STAGE[known] <= stage)
}

// ─── Inbound keywords ────────────────────────────────────────────────────────

const OPT_OUT_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'REVOKE'])
const OPT_IN_KEYWORDS = new Set(['START', 'UNSTOP'])

/** Carrier-style keyword detection: the whole message is the keyword (case and punctuation ignored). */
export function smsKeyword(body: string): 'opt_out' | 'opt_in' | 'help' | null {
  const word = String(body ?? '')
    .trim()
    .replace(/[.!?\s]+$/u, '')
    .replace(/^[\s"'“”]+|[\s"'“”]+$/gu, '')
    .toUpperCase()
  if (OPT_OUT_KEYWORDS.has(word)) return 'opt_out'
  if (OPT_IN_KEYWORDS.has(word)) return 'opt_in'
  if (word === 'HELP' || word === 'INFO') return 'help'
  return null
}

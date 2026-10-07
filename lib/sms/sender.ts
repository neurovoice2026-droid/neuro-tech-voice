import 'server-only'
// Transactional texts from the organisation's own SMS-capable Twilio number
// (platform Twilio account), to the other party of one of its calls. Never a
// destination chosen by the model or the browser. Guards, in order:
// - E.164 destination, never one of the org's own numbers
// - recipients who opted out (sms_opt_outs; Twilio error 21610 records one)
// - one text per idempotency key (workflow step + call): retries never resend
// - caps: SMS_DAILY_CAP_PER_ORG per org per day, 2 per recipient per day
// - an SMS-capable sending number, else a clear non-retrying failure
// Every outcome is final (no automatic retry): texts cost money and a retry
// after an ambiguous failure could double-send.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { isE164 } from '@/lib/phone/e164'
import { rateLimit } from '@/lib/security/rate-limit'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import { isOwnNumber, smsSenderForOrg, twilioErrorInfo } from './capability'

export type SmsFailure = 'not_configured' | 'no_sms_number' | 'opted_out' | 'invalid_number' | 'daily_cap' | 'recipient_cap' | 'empty' | 'failed'

export type SmsSendResult = { ok: true; duplicate: boolean } | { ok: false; reason: SmsFailure }

/** SMS_DAILY_CAP_PER_ORG: texts per organisation per day (1–1000, default 50). */
export function smsDailyCapPerOrg(): number {
  const raw = (process.env.SMS_DAILY_CAP_PER_ORG ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isInteger(v) && v >= 1 && v <= 1000 ? v : 50
}

const RECIPIENT_DAILY_CAP = 2
/** Twilio: "Attempt to send to unsubscribed recipient" (the person replied STOP). */
const TWILIO_OPTED_OUT = 21610
/** Twilio: invalid or unreachable "To" numbers. */
const TWILIO_BAD_TO = new Set([21211, 21614, 21408, 21612])

export interface SendSmsInput {
  db: SupabaseClient
  log: Logger
  orgId: string
  callId: string | null
  /** The call's own number: preferred as the sender when it can text. */
  preferredNumberId: string | null
  to: string
  body: string
  idempotencyKey: string
}

async function finish(db: SupabaseClient, id: string, patch: Record<string, unknown>, log: Logger): Promise<void> {
  const { error } = await db.from('sms_messages').update(patch).eq('id', id)
  if (error) log.error('sms.status_write_failed', error)
}

export async function sendTransactionalSms(input: SendSmsInput): Promise<SmsSendResult> {
  const { db, log } = input
  if (!isTwilioConfigured()) return { ok: false, reason: 'not_configured' }
  if (!input.body.trim()) return { ok: false, reason: 'empty' }
  if (!isE164(input.to) || (await isOwnNumber(db, input.orgId, input.to))) return { ok: false, reason: 'invalid_number' }

  const { data: optOut, error: optErr } = await db.from('sms_opt_outs').select('phone').eq('org_id', input.orgId).eq('phone', input.to).maybeSingle()
  if (optErr) throw new Error(`sms_opt_outs read failed: ${optErr.message}`)
  if (optOut) return { ok: false, reason: 'opted_out' }

  const sender = await smsSenderForOrg(db, input.orgId, input.preferredNumberId, log)
  if (!sender) return { ok: false, reason: 'no_sms_number' }

  // Claim the key first: a retried workflow run never sends the same text twice.
  const { data: row, error: insErr } = await db
    .from('sms_messages')
    .insert({
      org_id: input.orgId,
      call_id: input.callId,
      phone_number_id: sender.id,
      kind: 'workflow',
      to_number: input.to,
      body: input.body,
      status: 'sending',
      idempotency_key: input.idempotencyKey,
    })
    .select('id')
    .single()
  if (insErr?.code === '23505') {
    // Already attempted for this step and call: report that attempt, never send again.
    const { data: prior, error: priorErr } = await db.from('sms_messages').select('status').eq('org_id', input.orgId).eq('idempotency_key', input.idempotencyKey).maybeSingle()
    if (priorErr) throw new Error(`sms_messages read failed: ${priorErr.message}`)
    return prior?.status === 'failed' ? { ok: false, reason: 'failed' } : { ok: true, duplicate: true }
  }
  if (insErr || !row) throw new Error(`sms_messages insert failed: ${insErr?.message ?? 'no row'}`)
  const id = String(row.id)

  const orgCap = await rateLimit({ name: 'sms_org_day', limit: smsDailyCapPerOrg(), windowSeconds: 86_400 }, input.orgId)
  if (!orgCap.allowed) {
    await finish(db, id, { status: 'failed', error_code: 'daily_cap' }, log)
    return { ok: false, reason: 'daily_cap' }
  }
  const recipientCap = await rateLimit({ name: 'sms_recipient_day', limit: RECIPIENT_DAILY_CAP, windowSeconds: 86_400 }, `${input.orgId}:${input.to}`)
  if (!recipientCap.allowed) {
    await finish(db, id, { status: 'failed', error_code: 'recipient_cap' }, log)
    return { ok: false, reason: 'recipient_cap' }
  }

  try {
    const message = await getTwilioClient().messages.create({ from: sender.number, to: input.to, body: input.body })
    await finish(db, id, { status: 'sent', twilio_sid: message.sid ?? null }, log)
    log.info('sms.sent', { phoneNumberId: sender.id })
    return { ok: true, duplicate: false }
  } catch (err) {
    const info = twilioErrorInfo(err)
    if (info.code === TWILIO_OPTED_OUT) {
      const { error } = await db.from('sms_opt_outs').upsert({ org_id: input.orgId, phone: input.to, source: 'carrier' }, { onConflict: 'org_id,phone', ignoreDuplicates: true })
      if (error) log.error('sms.opt_out_write_failed', error)
      await finish(db, id, { status: 'failed', error_code: 'opted_out' }, log)
      return { ok: false, reason: 'opted_out' }
    }
    const reason: SmsFailure = info.code !== null && TWILIO_BAD_TO.has(info.code) ? 'invalid_number' : 'failed'
    log.warn('sms.send_failed', { ...info, reason })
    await finish(db, id, { status: 'failed', error_code: info.code !== null ? String(info.code) : reason }, log)
    return { ok: false, reason }
  }
}

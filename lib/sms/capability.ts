import 'server-only'
// Whether an organisation can send texts: only from one of its own Twilio
// numbers that has SMS capability (many Romanian numbers are voice-only).
// The capability is read from Twilio (IncomingPhoneNumbers fetch) and cached
// on the row (phone_numbers.sms_capable / sms_checked_at, migration 018,
// platform-managed) for a day.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'

export const SMS_CAPABILITY_TTL_MS = 24 * 3_600_000

export interface SmsNumberRow {
  id: string
  number: string
  twilio_sid: string | null
  is_active: boolean | null
  sms_capable: boolean | null
  sms_checked_at: string | null
}

const NUMBER_COLUMNS = 'id, number, twilio_sid, is_active, sms_capable, sms_checked_at'

/** Status and Twilio error code only (messages can echo account and number ids). */
export function twilioErrorInfo(err: unknown): { status: number | null; code: number | null } {
  const e = (err ?? {}) as { status?: unknown; code?: unknown }
  return { status: typeof e.status === 'number' ? e.status : null, code: typeof e.code === 'number' ? e.code : null }
}

function fresh(row: SmsNumberRow, now: number): boolean {
  const checked = row.sms_checked_at ? Date.parse(row.sms_checked_at) : NaN
  return row.sms_capable !== null && Number.isFinite(checked) && now - checked < SMS_CAPABILITY_TTL_MS
}

/** The number's SMS capability, refreshed from Twilio when the cached value is missing or older than a day. */
export async function numberCanSendSms(db: SupabaseClient, row: SmsNumberRow, log: Logger, now = Date.now()): Promise<boolean> {
  if (fresh(row, now) || !row.twilio_sid || !isTwilioConfigured()) return row.sms_capable === true
  try {
    const twilioNumber = await getTwilioClient().incomingPhoneNumbers(row.twilio_sid).fetch()
    const capable = twilioNumber.capabilities?.sms === true
    const { error } = await db.from('phone_numbers').update({ sms_capable: capable, sms_checked_at: new Date(now).toISOString() }).eq('id', row.id)
    if (error) log.error('sms.capability_write_failed', error, { phoneNumberId: row.id })
    return capable
  } catch (err) {
    // Keep the last known answer (unknown = not capable) and try again next time.
    log.warn('sms.capability_check_failed', { phoneNumberId: row.id, ...twilioErrorInfo(err) })
    return row.sms_capable === true
  }
}

/** The org's active numbers, the preferred one (the call's own number) first. */
async function orgNumbers(db: SupabaseClient, orgId: string, preferredId: string | null): Promise<SmsNumberRow[]> {
  const { data, error } = await db.from('phone_numbers').select(NUMBER_COLUMNS).eq('org_id', orgId).limit(20)
  if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
  const rows = ((data ?? []) as SmsNumberRow[]).filter((r) => r.is_active !== false)
  return rows.sort((a, b) => Number(b.id === preferredId) - Number(a.id === preferredId))
}

/** The org's number to text from (the call's own number when it can), or null. */
export async function smsSenderForOrg(db: SupabaseClient, orgId: string, preferredId: string | null, log: Logger): Promise<SmsNumberRow | null> {
  for (const row of await orgNumbers(db, orgId, preferredId)) {
    if (await numberCanSendSms(db, row, log)) return row
  }
  return null
}

export type SmsAvailability = { available: true } | { available: false; reason: 'not_configured' | 'no_number' | 'not_capable' }

/** For the workflow builder: can this org send texts at all? */
export async function orgSmsAvailability(db: SupabaseClient, orgId: string, log: Logger): Promise<SmsAvailability> {
  if (!isTwilioConfigured()) return { available: false, reason: 'not_configured' }
  const rows = await orgNumbers(db, orgId, null)
  if (rows.length === 0) return { available: false, reason: 'no_number' }
  for (const row of rows) if (await numberCanSendSms(db, row, log)) return { available: true }
  return { available: false, reason: 'not_capable' }
}

/** The org's own numbers (never text one of them). */
export async function isOwnNumber(db: SupabaseClient, orgId: string, e164: string): Promise<boolean> {
  const { data, error } = await db.from('phone_numbers').select('id').eq('org_id', orgId).eq('number', e164).limit(1)
  if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
  return (data ?? []).length > 0
}

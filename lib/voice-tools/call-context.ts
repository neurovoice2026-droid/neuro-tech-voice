import 'server-only'
// What every in-call business tool runs with: the call, its organisation and
// agent AS STORED, resolved from the call id of a verified per-call token
// (or, for the Cartesia fallback, from the numbers of the live call). Never
// from anything the model or the request body says: the org, the agent, the
// calendar, the recipients and the caller's number all come from here.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { countryCallingCode, isE164, normalizeE164 } from '@/lib/phone/e164'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { safeTimeZone } from '@/lib/scheduling/time'
import { readBookingSettings, readMessageSettings } from '@/lib/voice-providers/settings'
import type { BookingSettings, MessageSettings } from '@/lib/voice-providers/types'

/**
 * A tool request that arrives just after the caller hung up (the model was
 * finishing its turn) is still served; anything later is a replay.
 */
export const ENDED_GRACE_MS = 60_000

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'canceled', 'busy', 'no-answer', 'after-hours'])

export interface ToolCallRow {
  id: string
  org_id: string
  agent_id: string | null
  direction: 'inbound' | 'outbound'
  status: string
  provider: string | null
  from_number: string | null
  to_number: string | null
  caller_number: string | null
  ended_at: string | null
  is_test: boolean
}

export interface ToolCallContext {
  call: ToolCallRow
  org: { id: string; name: string | null; timezone: string; userId: string | null }
  agent: {
    id: string
    name: string
    language: string
    workingHours: unknown
    booking: BookingSettings
    messages: MessageSettings
  }
  /** E.164 of the other party (the caller on inbound calls); null when withheld or unknown. */
  callerPhone: string | null
  /** E.164 of the business line of this call (for national callback numbers). */
  businessPhone: string | null
  now: Date
  db: SupabaseClient
}

export type ToolCallFailure = 'not_found' | 'ended' | 'no_agent' | 'error'

const CALL_COLUMNS = 'id, org_id, agent_id, direction, status, provider, from_number, to_number, caller_number, ended_at, is_test'

/** The caller's E.164 number from the stored call (never from the request). */
export function callerPhoneOf(call: Pick<ToolCallRow, 'direction' | 'from_number' | 'to_number' | 'caller_number'>): string | null {
  const candidate = call.direction === 'outbound' ? call.to_number : call.from_number ?? call.caller_number
  return candidate && isE164(candidate) ? candidate : null
}

function businessPhoneOf(call: Pick<ToolCallRow, 'direction' | 'from_number' | 'to_number'>): string | null {
  const candidate = call.direction === 'outbound' ? call.from_number : call.to_number
  return candidate && isE164(candidate) ? candidate : null
}

/** Whether the call is over (beyond the short grace for a tool request racing the hang-up). */
export function callHasEnded(call: Pick<ToolCallRow, 'status' | 'ended_at'>, now: number): boolean {
  const endedAt = call.ended_at ? Date.parse(call.ended_at) : NaN
  if (Number.isFinite(endedAt)) return now - endedAt > ENDED_GRACE_MS
  // A terminal status without ended_at (written by a path that does not stamp it).
  return TERMINAL_STATUSES.has(call.status)
}

/**
 * The context of the call `callId` (from a verified token). Rejects calls
 * that are unknown or over; the org and agent are read with the call's own
 * org id, so a call can only ever reach its own organisation.
 */
export async function loadToolCallContext(callId: string, opts: { now?: Date; db?: SupabaseClient; log?: Logger } = {}): Promise<ToolCallContext | ToolCallFailure> {
  const db = opts.db ?? createAdminClient()
  const now = opts.now ?? new Date()
  const { data: row, error } = await db.from('calls').select(CALL_COLUMNS).eq('id', callId).maybeSingle()
  if (error) {
    opts.log?.error('tools.call_read_failed', error, { callId })
    return 'error'
  }
  if (!row) return 'not_found'
  const call: ToolCallRow = {
    id: String(row.id),
    org_id: String(row.org_id),
    agent_id: (row.agent_id as string | null) ?? null,
    direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
    status: String(row.status ?? ''),
    provider: (row.provider as string | null) ?? null,
    from_number: (row.from_number as string | null) ?? null,
    to_number: (row.to_number as string | null) ?? null,
    caller_number: (row.caller_number as string | null) ?? null,
    ended_at: (row.ended_at as string | null) ?? null,
    is_test: row.is_test === true,
  }
  if (callHasEnded(call, now.getTime())) return 'ended'
  if (!call.agent_id) return 'no_agent'

  const [orgRes, agentRes] = await Promise.all([
    db.from('organizations').select('id, name, timezone, user_id').eq('id', call.org_id).maybeSingle(),
    db
      .from('agents')
      .select('id, name, language, working_hours, booking_settings, message_settings')
      .eq('id', call.agent_id)
      .eq('org_id', call.org_id)
      .maybeSingle(),
  ])
  if (orgRes.error || agentRes.error) {
    opts.log?.error('tools.context_read_failed', orgRes.error ?? agentRes.error, { callId, orgId: call.org_id })
    return 'error'
  }
  if (!orgRes.data) return 'not_found'
  if (!agentRes.data) return 'no_agent'
  const a = agentRes.data as Record<string, unknown>
  return {
    call,
    org: {
      id: call.org_id,
      name: ((orgRes.data.name as string | null) ?? '').trim() || null,
      timezone: safeTimeZone(orgRes.data.timezone as string | null),
      userId: (orgRes.data.user_id as string | null) ?? null,
    },
    agent: {
      id: String(a.id),
      name: String(a.name ?? ''),
      language: normalizeAgentLanguage(a.language as string | null),
      workingHours: a.working_hours ?? null,
      booking: readBookingSettings(a.booking_settings),
      messages: readMessageSettings(a.message_settings),
    },
    callerPhone: callerPhoneOf(call),
    businessPhone: businessPhoneOf(call),
    now,
    db,
  }
}

/**
 * A callback number the caller dictated: E.164 as is; a national number
 * ("0721 234 567") in the country of the business line; otherwise the digits
 * as said (readable, at most 32 characters) when there are enough of them.
 */
export function normalizeCallbackNumber(raw: string | null, businessPhone: string | null): string | null {
  if (!raw) return null
  const e164 = normalizeE164(raw)
  if (e164) return e164
  const digits = raw.replace(/\D/g, '')
  const cc = businessPhone ? countryCallingCode(businessPhone) : null
  if (cc && /^0[1-9]\d{6,12}$/.test(digits)) {
    const candidate = `+${cc}${digits.slice(1)}`
    if (isE164(candidate)) return candidate
  }
  const cleaned = raw.replace(/[^\d+()\s-]/g, '').replace(/\s+/g, ' ').trim()
  return digits.length >= 6 ? cleaned.slice(0, 32) : null
}

/** Last four digits only: the model reads numbers aloud, and the caller knows their own. */
export function lastFour(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

/** Guidance for the model when the call cannot run tools (unknown, over, misconfigured). */
export function contextFailureMessage(kind: ToolCallFailure): string {
  switch (kind) {
    case 'ended':
      return 'This call has already ended, so nothing was done.'
    case 'error':
      return 'This could not be done right now. Apologise briefly, repeat the details back to the caller and tell them the team will follow up.'
    default:
      return 'This is not available on this call. Take the caller’s name, number and reason by voice and tell them the team will call back.'
  }
}

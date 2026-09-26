import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { entitlementsFor, type Entitlements } from '@/lib/billing/entitlements'
import { isE164 } from '@/lib/phone/e164'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { safeTimeZone } from '@/lib/scheduling/time'
import type { KnowledgeSourceRef, ToolAction, ToolRequest } from '@/lib/voice/contracts'
import type { EscalationContact, LeadField, Plan, WorkingHours } from '@/types'

// What every voice tool runs with: the call, its organisation and agent as
// stored (never as the model describes them), the caller's number from the
// call row, plan entitlements, a deadline signal and a way to push work past
// the response.

/** Tool results the model reads are capped (Cartesia truncates webhook tool responses at 4 KiB too). */
export const MAX_RESULT_BYTES = 4096

export type Defer = (task: () => Promise<unknown>) => void

export interface ToolCall {
  id: string
  org_id: string
  agent_id: string | null
  direction: 'inbound' | 'outbound'
  from_number: string | null
  to_number: string | null
  caller_number: string | null
  is_test: boolean
  status: string
  twilio_call_sid: string | null
  extracted: Record<string, string>
  ended_at: string | null
}

export interface ToolOrg {
  id: string
  name: string | null
  timezone: string
  plan: Plan
  sms_enabled: boolean
  /** The only site texts from the agent may link to. */
  website?: string | null
}

export interface ToolAgent {
  id: string
  name: string
  language: string
  lead_fields: LeadField[]
  working_hours: WorkingHours | null
}

export interface ToolContext {
  request: ToolRequest
  call: ToolCall
  org: ToolOrg
  agent: ToolAgent | null
  language: string
  timezone: string
  businessName: string | null
  /** E.164 of the other party (caller on inbound, the person dialled on outbound); null for browser tests or withheld numbers. */
  callerPhone: string | null
  entitlements: Entitlements
  now: Date
  signal: AbortSignal
  defer: Defer
  admin: SupabaseClient
}

export interface ToolOutcome {
  ok: boolean
  /** What the model reads: the facts and what to say or do next. */
  result: string
  action?: ToolAction | null
  sources?: KnowledgeSourceRef[]
}

export type ToolHandler = (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolOutcome>

export function success(result: string, extra: Omit<ToolOutcome, 'ok' | 'result'> = {}): ToolOutcome {
  return { ok: true, result, ...extra }
}

export function failure(result: string, extra: Omit<ToolOutcome, 'ok' | 'result'> = {}): ToolOutcome {
  return { ok: false, result, ...extra }
}

/** Cuts text to at most `maxBytes` of UTF-8 without splitting a character. */
export function capUtf8(text: string, maxBytes = MAX_RESULT_BYTES): string {
  const encoder = new TextEncoder()
  if (encoder.encode(text).length <= maxBytes) return text
  const marker = ' …[truncated]'
  const budget = maxBytes - encoder.encode(marker).length
  let bytes = 0
  let out = ''
  for (const char of text) {
    const size = encoder.encode(char).length
    if (bytes + size > budget) break
    bytes += size
    out += char
  }
  return `${out}${marker}`
}

/** The E.164 number of the person on the other end, from the stored call. */
export function callerPhoneOf(call: Pick<ToolCall, 'direction' | 'from_number' | 'to_number' | 'caller_number'>): string | null {
  const candidate = call.direction === 'outbound' ? call.to_number : call.from_number ?? call.caller_number
  return candidate && isE164(candidate) ? candidate : null
}

export type ContextFailure = { kind: 'not_found' } | { kind: 'ended' } | { kind: 'error' }

/** Calls that ended this long ago no longer run tools (replays, stuck retries). */
const ENDED_GRACE_MS = 2 * 60_000

const CALL_COLUMNS =
  'id, org_id, agent_id, direction, from_number, to_number, caller_number, is_test, status, twilio_call_sid, extracted, ended_at'

export async function loadToolContext(
  request: ToolRequest,
  opts: { signal: AbortSignal; defer: Defer; now?: Date }
): Promise<ToolContext | ContextFailure> {
  const admin = createAdminClient()
  const callResult = await admin.from('calls').select(CALL_COLUMNS).eq('id', request.call_id).abortSignal(opts.signal).maybeSingle()
  if (callResult.error) {
    console.error('[tools] call lookup failed', callResult.error.code, callResult.error.message)
    return { kind: 'error' }
  }
  if (!callResult.data) return { kind: 'not_found' }
  const row = callResult.data as Record<string, unknown>
  const now = opts.now ?? new Date()
  const endedAt = typeof row.ended_at === 'string' ? Date.parse(row.ended_at) : NaN
  if (Number.isFinite(endedAt) && now.getTime() - endedAt > ENDED_GRACE_MS) return { kind: 'ended' }

  const orgId = row.org_id as string
  const [orgResult, agentResult] = await Promise.all([
    admin.from('organizations').select('id, name, timezone, plan, sms_enabled, website').eq('id', orgId).abortSignal(opts.signal).maybeSingle(),
    row.agent_id
      ? admin
          .from('agents')
          .select('id, name, language, lead_fields, working_hours')
          .eq('id', row.agent_id as string)
          .eq('org_id', orgId)
          .abortSignal(opts.signal)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (orgResult.error || !orgResult.data) {
    if (orgResult.error) console.error('[tools] organization lookup failed', orgResult.error.code, orgResult.error.message)
    return orgResult.error ? { kind: 'error' } : { kind: 'not_found' }
  }
  if (agentResult.error) console.error('[tools] agent lookup failed', agentResult.error.code, agentResult.error.message)

  const extracted = row.extracted && typeof row.extracted === 'object' && !Array.isArray(row.extracted) ? (row.extracted as Record<string, string>) : {}
  const call: ToolCall = {
    id: row.id as string,
    org_id: orgId,
    agent_id: (row.agent_id as string | null) ?? null,
    direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
    from_number: (row.from_number as string | null) ?? null,
    to_number: (row.to_number as string | null) ?? null,
    caller_number: (row.caller_number as string | null) ?? null,
    is_test: row.is_test === true,
    status: String(row.status ?? ''),
    twilio_call_sid: (row.twilio_call_sid as string | null) ?? null,
    extracted,
    ended_at: (row.ended_at as string | null) ?? null,
  }
  const orgRow = orgResult.data as Record<string, unknown>
  const org: ToolOrg = {
    id: orgId,
    name: (orgRow.name as string | null) ?? null,
    timezone: safeTimeZone(orgRow.timezone as string | null),
    plan: (orgRow.plan as Plan) ?? 'trial',
    sms_enabled: orgRow.sms_enabled !== false,
    website: typeof orgRow.website === 'string' && orgRow.website.trim() ? orgRow.website.trim() : null,
  }
  const agentRow = (agentResult.data as Record<string, unknown> | null) ?? null
  const agent: ToolAgent | null = agentRow
    ? {
        id: agentRow.id as string,
        name: (agentRow.name as string) ?? '',
        language: normalizeAgentLanguage(agentRow.language as string | null),
        lead_fields: Array.isArray(agentRow.lead_fields) ? (agentRow.lead_fields as LeadField[]) : [],
        working_hours: (agentRow.working_hours as WorkingHours | null) ?? null,
      }
    : null

  return {
    request,
    call,
    org,
    agent,
    language: agent?.language ?? 'en',
    timezone: org.timezone,
    businessName: org.name?.trim() || null,
    callerPhone: callerPhoneOf(call),
    entitlements: entitlementsFor(org.plan),
    now,
    signal: opts.signal,
    defer: opts.defer,
    admin,
  }
}

export type ToolContact = Pick<
  EscalationContact,
  'id' | 'name' | 'role' | 'phone' | 'email' | 'transfer_enabled' | 'notify_sms' | 'notify_email' | 'is_on_call' | 'sort_order'
>

export async function loadContacts(ctx: ToolContext): Promise<ToolContact[]> {
  const { data, error } = await ctx.admin
    .from('escalation_contacts')
    .select('id, name, role, phone, email, transfer_enabled, notify_sms, notify_email, is_on_call, sort_order')
    .eq('org_id', ctx.org.id)
    .order('sort_order', { ascending: true })
    .limit(50)
    .abortSignal(ctx.signal)
  if (error) {
    console.error('[tools] contact lookup failed', error.code, error.message)
    throw new Error('Contact lookup failed')
  }
  return (data ?? []) as ToolContact[]
}

/** "Wednesday 18 March at 14:30" for the model, in English (it speaks the agent's language itself). */
export function spokenDateTime(instant: string | number | Date, timezone: string): string {
  const date = instant instanceof Date ? instant : new Date(instant)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timezone),
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

/** Last four digits only: the model reads numbers aloud, and the caller knows their own. */
export function lastFour(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

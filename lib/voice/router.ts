import 'server-only'

// The call router: every Twilio voice webhook for a number the app owns ends
// up here and must answer within a few seconds. It decides whether a call may
// be taken (plan, trial, paused agent or number, outside-hours message),
// records the call row, picks the pipeline mode (lib/voice/mode.ts) and
// answers with TwiML:
//   cartesia_self | cartesia_managed → <Connect action><Stream url=gateway> with a signed session token
//   elevenlabs                       → TwiML from ElevenLabs register-call
//   nothing available                → apology (inbound: hand the caller to the on-call contact when there is one)
// The only provider call made while Twilio waits is register-call (3 s timeout).

import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { callBlockReason, type CallBlockReason } from '@/lib/billing/entitlements'
import { registerElevenLabsCall } from '@/lib/elevenlabs/register-call'
import { env, gatewayWsUrl, isElevenLabsConfigured, isGatewayConfigured } from '@/lib/env'
import { isE164, maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { signSessionToken } from '@/lib/security/signing'
import { kvGet, kvSet } from '@/lib/kv'
import { notifyContacts } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRANSFER_TIME_LIMIT_SECONDS, callDestinationRefusal } from '@/lib/twilio/calls'
import { CALL_SID_REGEX } from '@/lib/twilio/client'
import { TECHNICAL_TROUBLE, TEAM_MEMBER, TRANSFER_UNAVAILABLE } from '@/lib/twilio/messages'
import {
  EMPTY_TWIML,
  connectStream,
  dial,
  hangup,
  reject,
  say,
  sayAndHangup,
  twimlDocument,
} from '@/lib/twilio/twiml'
import { telephonyUrl } from '@/lib/twilio/webhooks'
import { STREAM_SESSION_PARAMETER, type CallDirection, type VoicePipelineMode } from '@/lib/voice/contracts'
import {
  APOLOGY_MESSAGE,
  RESUME_AFTER_HANDOFF,
  TRANSFER_ANNOUNCE,
  UNAVAILABLE_MESSAGE,
  localized,
} from '@/lib/voice/greetings'
import type { BreakerKey } from '@/lib/voice/breaker'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { resolvePipelineMode } from '@/lib/voice/mode'
import {
  CALL_ROW_COLUMNS,
  buildSessionForCall,
  loadAgent,
  loadCallById,
  loadCallByTwilioSid,
  loadOrganization,
  loadPhoneNumberByNumber,
  type CallRow,
  type PhoneNumberRow,
} from '@/lib/voice/session-loader'
import { executeWorkflows } from '@/lib/workflows/executor'
import type { Agent, OutsideHoursConfig, Organization, WorkingHours } from '@/types'

/** Twilio session tokens live 120 s: long enough for Twilio to open the stream. */
export const TWILIO_SESSION_TOKEN_TTL_SECONDS = 120

export function twimlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// ─── Background work ─────────────────────────────────────────────────────────

/** Work that must not delay Twilio's answer. Errors are logged, never thrown. */
function inBackground(label: string, work: () => Promise<unknown>): void {
  const task = async () => {
    try {
      await work()
    } catch (error) {
      console.error('[telephony]', label, 'failed', error instanceof Error ? error.message : error)
    }
  }
  try {
    after(task)
  } catch {
    void task()
  }
}

// ─── Stream markers (set by /api/voice/internal/events) ──────────────────────

const STREAM_MARKER_TTL_SECONDS = 6 * 60 * 60

function streamStartedKey(callId: string): string {
  return `call:stream-started:${callId}`
}

export async function markStreamStarted(callId: string): Promise<void> {
  await kvSet(streamStartedKey(callId), 1, STREAM_MARKER_TTL_SECONDS)
}

export async function wasStreamStarted(callId: string): Promise<boolean> {
  return (await kvGet<number>(streamStartedKey(callId))) !== null
}

function handoffKey(callId: string): string {
  return `call:elevenlabs-handoff:${callId}`
}

/**
 * The app connected a live caller to ElevenLabs after the primary path failed.
 * Stored outside the call row: the failed gateway leg's finalize can still
 * write its own mode and end_reason='error' there afterwards, and the status
 * callback must not read that as a call nobody answered.
 */
export async function markElevenLabsHandoff(callId: string): Promise<void> {
  await kvSet(handoffKey(callId), 1, STREAM_MARKER_TTL_SECONDS)
}

export async function wasHandedOffToElevenLabs(callId: string): Promise<boolean> {
  return (await kvGet<number>(handoffKey(callId))) !== null
}

// ─── Working hours ───────────────────────────────────────────────────────────

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

function minutesOf(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = TIME.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function localClock(now: Date, timezone: string): { weekday: number; minutes: number } {
  let zone = timezone
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
  } catch {
    zone = 'UTC'
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { weekday: weekday < 0 ? 0 : weekday, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

/**
 * Whether the business is open now in its time zone, or null when hours are
 * missing or invalid (callers treat that as open). A slot whose end is before
 * its start runs past midnight into the next day.
 */
export function isWithinWorkingHours(hours: WorkingHours | null | undefined, timezone: string, now: Date): boolean | null {
  if (!hours || typeof hours !== 'object') return null
  const { weekday, minutes } = localClock(now, timezone)
  let anyValid = false

  const today = hours[WEEKDAYS[weekday]]
  const todayStart = minutesOf(today?.start)
  // Times are stored as HH:MM up to 23:59, so a slot ending at 23:59 (the
  // dashboard's "Answer 24/7" preset) stays open through midnight.
  const rawEnd = minutesOf(today?.end)
  const todayEnd = rawEnd === 23 * 60 + 59 ? 24 * 60 : rawEnd
  if (today && typeof today.enabled === 'boolean') anyValid = true
  if (today?.enabled && todayStart !== null && todayEnd !== null) {
    if (todayStart < todayEnd && minutes >= todayStart && minutes < todayEnd) return true
    if (todayStart > todayEnd && minutes >= todayStart) return true
    if (todayStart === todayEnd) return true
  }

  const yesterday = hours[WEEKDAYS[(weekday + 6) % 7]]
  const yStart = minutesOf(yesterday?.start)
  const yEnd = minutesOf(yesterday?.end)
  if (yesterday?.enabled && yStart !== null && yEnd !== null && yStart > yEnd && minutes < yEnd) return true

  if (!anyValid) {
    anyValid = WEEKDAYS.some((day) => typeof hours[day]?.enabled === 'boolean')
  }
  return anyValid ? false : null
}

function outsideHoursConfig(agent: Agent): OutsideHoursConfig | null {
  const raw = agent.metadata?.outside_hours
  if (!raw || typeof raw !== 'object') return null
  const config = raw as Partial<OutsideHoursConfig>
  if (config.type !== 'message' && config.type !== 'voicemail' && config.type !== 'always_answer') return null
  return { type: config.type, message: typeof config.message === 'string' ? config.message : '', notify_email: '' }
}

export type InboundBlock = { reason: CallBlockReason | 'outside_hours'; message: string }

/**
 * Why an inbound call is refused (with the line to say), or null to answer
 * it. Outside hours only refuses when the owner chose "play a message";
 * the default is to always answer.
 */
export function inboundBlock(input: {
  org: Organization
  agent: Agent | null
  number: Pick<PhoneNumberRow, 'is_active'>
  now: Date
}): InboundBlock | null {
  const language = normalizeAgentLanguage(input.agent?.language)
  const unavailable = localized(UNAVAILABLE_MESSAGE, language)
  const orgReason = callBlockReason(input.org, input.now)
  if (orgReason) return { reason: orgReason, message: unavailable }
  if (!input.agent || !input.agent.is_active) return { reason: 'agent_inactive', message: unavailable }
  if (!input.number.is_active) return { reason: 'number_inactive', message: unavailable }

  const outsideHours = outsideHoursConfig(input.agent)
  if (outsideHours?.type === 'message') {
    const open = isWithinWorkingHours(input.agent.working_hours, input.org.timezone || 'UTC', input.now)
    if (open === false) {
      return { reason: 'outside_hours', message: outsideHours.message.trim() || unavailable }
    }
  }
  return null
}

// ─── Call rows ───────────────────────────────────────────────────────────────

type CallInsert = Partial<Omit<CallRow, 'extracted'>> & { id: string; org_id: string }

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}

/** Inserts a call row; a concurrent insert for the same Twilio call returns the existing row. */
async function insertCall(row: CallInsert): Promise<CallRow> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('calls').insert(row).select(CALL_ROW_COLUMNS).single()
  if (!error && data) return data as unknown as CallRow
  if (isUniqueViolation(error) && row.twilio_call_sid) {
    const existing = await loadCallByTwilioSid(row.twilio_call_sid)
    if (existing && existing.org_id === row.org_id) return existing
  }
  console.error('[telephony] call insert failed', error?.code, error?.message)
  throw new Error('Call insert failed')
}

async function updateCall(call: Pick<CallRow, 'id' | 'org_id'>, patch: Record<string, unknown>): Promise<void> {
  const { error } = await createAdminClient().from('calls').update(patch).eq('id', call.id).eq('org_id', call.org_id)
  if (error) console.error('[telephony] call update failed', error.code, error.message)
}

function voiceProviderFor(mode: VoicePipelineMode): 'cartesia' | 'elevenlabs' {
  return mode === 'elevenlabs' ? 'elevenlabs' : 'cartesia'
}

/** call_missed workflows run after the response; test calls never trigger them. */
export function fireMissedCallWorkflows(call: Pick<CallRow, 'id' | 'org_id' | 'is_test' | 'direction' | 'from_number' | 'to_number' | 'caller_number' | 'started_at' | 'status' | 'duration_seconds'>): void {
  if (call.is_test) return
  inBackground('call_missed workflows', () =>
    executeWorkflows(call.org_id, 'call_missed', {
      call_id: call.id,
      caller_number: call.caller_number,
      from_number: call.from_number,
      to_number: call.to_number,
      direction: call.direction,
      status: call.status,
      duration_seconds: call.duration_seconds ?? 0,
      outcome: 'missed',
      started_at: call.started_at,
      is_test: false,
    })
  )
}

// ─── Gateway events ──────────────────────────────────────────────────────────

/**
 * Which breaker a gateway provider_error counts against (foundation notes):
 * gateway → gateway; Cartesia or OpenAI STT/TTS/LLM → cartesia_self; a
 * Cartesia agent → cartesia_managed; ElevenLabs → elevenlabs. Without a
 * component, a Cartesia error belongs to the mode the call runs in.
 */
export function breakerKeyForProviderError(
  data: { provider?: 'cartesia' | 'openai' | 'elevenlabs' | 'gateway'; component?: 'stt' | 'tts' | 'llm' | 'agent' },
  callMode: VoicePipelineMode | null
): BreakerKey | null {
  switch (data.provider) {
    case 'gateway':
      return 'gateway'
    case 'elevenlabs':
      return 'elevenlabs'
    case 'openai':
      return 'cartesia_self'
    case 'cartesia':
      if (data.component === 'agent') return 'cartesia_managed'
      if (data.component === 'stt' || data.component === 'tts' || data.component === 'llm') return 'cartesia_self'
      return callMode === 'cartesia_managed' ? 'cartesia_managed' : 'cartesia_self'
    default:
      return null
  }
}

/**
 * Error facts for breakerFailureKind from a gateway provider_error. The
 * gateway sends the provider's error code, or the HTTP status as a string when
 * there is none ("404"). A bare three-digit code is passed on as a status, so
 * 401/403 count as terminal and 400/404/422 as configuration errors, which
 * never trip the breaker. WebSocket close codes have four digits and stay codes.
 */
export function providerErrorFacts(code: string | null | undefined): { code: string | null; status?: number } {
  const value = code?.trim() ?? ''
  if (/^[1-5][0-9]{2}$/.test(value)) return { code: null, status: Number(value) }
  return { code: value || null }
}

// ─── Answers ─────────────────────────────────────────────────────────────────

/** The org's own number on this call: the dialled number inbound, the caller id outbound. */
export function orgNumberOf(call: Pick<CallRow, 'direction' | 'from_number' | 'to_number'>): string | null {
  const number = call.direction === 'inbound' ? call.to_number : call.from_number
  return number && isE164(number) ? number : null
}

type OnCallContact = { id: string; name: string; phone: string }

async function loadOnCallContact(orgId: string): Promise<OnCallContact | null> {
  const { data, error } = await createAdminClient()
    .from('escalation_contacts')
    .select('id, name, phone')
    .eq('org_id', orgId)
    .eq('is_on_call', true)
    .eq('transfer_enabled', true)
    .not('phone', 'is', null)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') {
      console.error('[telephony] on-call contact lookup failed', error.code, error.message)
    }
    return null
  }
  const row = data as OnCallContact | null
  return row && isE164(row.phone) ? row : null
}

/**
 * Last resort when no agent can take the call. Inbound callers are handed to
 * the on-call team member when one allows transfers; everyone else hears the
 * apology. Never throws.
 */
export async function finalFallbackTwiml(input: { call: CallRow | null; language: string }): Promise<string> {
  const language = normalizeAgentLanguage(input.language)
  const call = input.call
  if (call && call.direction === 'inbound' && !call.is_test) {
    const callerId = orgNumberOf(call)
    const contact = callerId ? await loadOnCallContact(call.org_id).catch(() => null) : null
    const refusal = contact && callerId ? callDestinationRefusal(contact.phone, callerId) : null
    if (refusal) console.warn('[telephony] on-call contact number not allowed for the fallback transfer', refusal)
    if (contact && callerId && !refusal) {
      return twimlDocument(
        say(localized(TECHNICAL_TROUBLE, language), language),
        say(localized(TRANSFER_ANNOUNCE, language, { name: localized(TEAM_MEMBER, language) }), language),
        dial({
          number: contact.phone,
          callerId,
          timeoutSeconds: 25,
          timeLimitSeconds: TRANSFER_TIME_LIMIT_SECONDS,
          action: telephonyUrl('transfer-status', { call_id: call.id, contact_id: contact.id, reason: 'fallback' }),
        })
      )
    }
  }
  return sayAndHangup(localized(APOLOGY_MESSAGE, language), language)
}

async function gatewayTwiml(call: CallRow, agent: Agent, mode: VoicePipelineMode): Promise<string> {
  const secret = env.VOICE_GATEWAY_SECRET as string
  const token = signSessionToken(
    {
      v: 1,
      sid: call.id,
      org: call.org_id,
      agt: agent.id,
      ch: 'twilio',
      mode,
      exp: Math.floor(Date.now() / 1000) + TWILIO_SESSION_TOKEN_TTL_SECONDS,
    },
    secret
  )
  return twimlDocument(
    connectStream({
      action: telephonyUrl('stream-ended', { call_id: call.id }),
      streamUrl: gatewayWsUrl('/twilio'),
      statusCallback: telephonyUrl('stream-status', { call_id: call.id }),
      parameters: { [STREAM_SESSION_PARAMETER]: token },
    })
  )
}

/** Withheld caller ids have no E.164 form; register-call still needs a from_number. */
const WITHHELD_CALLER = 'anonymous'

/** Keeps the override prompt small enough for Twilio's answer window. */
const MAX_HANDOFF_TRANSCRIPT_CHARS = 6_000

/** Register-call TwiML for this call, or null. The call context rides in the prompt override. */
export async function elevenLabsTwiml(input: {
  call: CallRow
  org: Organization
  agent: Agent
  reason: string
  /**
   * Set when the caller was already talking to the agent (the gateway stream
   * had started): ElevenLabs then carries on with the conversation so far and
   * a short "I'm back" line instead of greeting the caller a second time.
   */
  handoff?: { priorTranscript: string } | null
}): Promise<string | null> {
  const { call, org, agent } = input
  if (!isElevenLabsConfigured() || !agent.elevenlabs_agent_id) return null
  // Inbound callers who withhold their number are still answered; outbound
  // calls always have both numbers (the org's and the one dialled).
  const from = call.from_number ?? (call.direction === 'inbound' ? WITHHELD_CALLER : null)
  const to = call.to_number
  if (!from || !to) return null
  const config = await buildSessionForCall({ call, org, agent, channel: 'twilio', mode: 'elevenlabs' })

  let prompt = `${config.elevenlabs.prompt}\n\n${config.call_context}`
  let firstMessage = config.elevenlabs.first_message
  const prior = (input.handoff?.priorTranscript ?? '').trim().slice(-MAX_HANDOFF_TRANSCRIPT_CHARS)
  if (input.handoff) {
    if (prior) prompt += `\n\nConversation so far:\n${prior}`
    firstMessage = localized(RESUME_AFTER_HANDOFF, normalizeAgentLanguage(agent.language))
  }

  return registerElevenLabsCall({
    agentId: agent.elevenlabs_agent_id,
    from,
    to,
    direction: call.direction,
    callId: call.id,
    overrides: { ...config.elevenlabs, prompt, first_message: firstMessage },
    reason: input.reason,
    orgId: org.id,
    twilioCallSid: call.twilio_call_sid,
    priorTranscript: prior,
  })
}

/** TwiML for a call that may be answered, in the mode the router picked. */
async function answerCall(input: {
  call: CallRow
  org: Organization
  agent: Agent
  /** reason: the mode decision reason, or the stored fallback reason when Twilio retried. */
  decision: { mode: VoicePipelineMode; reason: string }
}): Promise<string> {
  const { call, org, agent, decision } = input
  const language = normalizeAgentLanguage(agent.language)

  if (decision.reason !== 'no_provider') {
    if (decision.mode !== 'elevenlabs' && isGatewayConfigured()) {
      return gatewayTwiml(call, agent, decision.mode)
    }
    if (decision.mode === 'elevenlabs') {
      const twiml = await elevenLabsTwiml({ call, org, agent, reason: decision.reason })
      if (twiml) return twiml
    }
  }

  const reason = decision.reason === 'no_provider' ? 'no_provider' : 'elevenlabs_unavailable'
  console.error('[telephony] no voice pipeline could take the call', call.id, reason)
  await updateCall(call, {
    end_reason: decision.reason === 'no_provider' ? 'no_provider' : 'error',
    fallback_used: true,
    fallback_reason: reason,
  })
  return finalFallbackTwiml({ call, language })
}

// ─── Inbound ─────────────────────────────────────────────────────────────────

export async function handleInboundCall(form: Record<string, string>): Promise<Response> {
  const callSid = form.CallSid ?? ''
  const to = normalizeE164(form.To ?? '')
  // Withheld numbers arrive as "anonymous" or a fake short code; keep them null.
  const from = normalizeE164(form.From ?? '')
  if (!CALL_SID_REGEX.test(callSid) || !to) {
    console.warn('[telephony] inbound webhook without a valid CallSid or To')
    return twimlResponse(twimlDocument(reject()))
  }

  const [number, existing] = await Promise.all([loadPhoneNumberByNumber(to), loadCallByTwilioSid(callSid)])
  if (!number) {
    console.warn('[telephony] inbound call to an unknown number', maskPhone(to))
    return twimlResponse(twimlDocument(reject()))
  }
  const [org, agent] = await Promise.all([loadOrganization(number.org_id), loadAgent(number.org_id, number.agent_id)])
  if (!org) {
    console.warn('[telephony] number without an organization', number.id)
    return twimlResponse(twimlDocument(reject()))
  }
  const language = normalizeAgentLanguage(agent?.language)
  const now = new Date()

  // Twilio retried a webhook we already answered: answer the same way again.
  if (existing && existing.org_id === org.id) {
    if (existing.status !== 'in-progress' || !agent) {
      return twimlResponse(sayAndHangup(localized(UNAVAILABLE_MESSAGE, language), language))
    }
    if (!existing.pipeline_mode) {
      return twimlResponse(await finalFallbackTwiml({ call: existing, language }))
    }
    return twimlResponse(
      await answerCall({ call: existing, org, agent, decision: { mode: existing.pipeline_mode, reason: existing.fallback_reason ?? 'retry' } })
    )
  }

  const base = {
    org_id: org.id,
    agent_id: agent?.id ?? null,
    phone_number_id: number.id,
    twilio_call_sid: callSid,
    direction: 'inbound' as CallDirection,
    is_test: false,
    caller_number: from,
    from_number: from,
    to_number: to,
    started_at: now.toISOString(),
  }

  const block = inboundBlock({ org, agent, number, now })
  if (block) {
    const call = await insertCall({
      ...base,
      id: randomUUID(),
      status: 'no-answer',
      outcome: 'missed',
      end_reason: block.reason,
    })
    fireMissedCallWorkflows(call)
    return twimlResponse(sayAndHangup(block.message, language))
  }

  // inboundBlock returned null, so the agent exists and is active.
  const activeAgent = agent as Agent
  const decision = await resolvePipelineMode({ agent: activeAgent, channel: 'twilio' })
  const routed = decision.reason !== 'no_provider'
  const call = await insertCall({
    ...base,
    id: randomUUID(),
    status: 'in-progress',
    voice_provider: voiceProviderFor(decision.mode),
    pipeline_mode: routed ? decision.mode : null,
    fallback_reason: decision.fallback ? decision.reason : null,
  })
  if (decision.skipped.length > 0) {
    console.info('[telephony] mode', decision.mode, decision.reason, decision.skipped.map((s) => `${s.mode}:${s.reason}`).join(','))
  }
  // A call no pipeline could take is marked missed by the status callback,
  // unless the on-call hand-off in finalFallbackTwiml connected it.
  return twimlResponse(await answerCall({ call, org, agent: activeAgent, decision }))
}

// ─── Outbound ────────────────────────────────────────────────────────────────

const MACHINE_ANSWERS = new Set(['machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', 'fax'])

export async function handleOutboundCall(callId: string, form: Record<string, string>): Promise<Response> {
  const callSid = form.CallSid ?? ''
  const call = await loadCallById(callId)
  if (!call || call.direction !== 'outbound') {
    console.warn('[telephony] outbound webhook for an unknown call', callId)
    return twimlResponse(twimlDocument(hangup()))
  }
  if (!CALL_SID_REGEX.test(callSid) || (call.twilio_call_sid && call.twilio_call_sid !== callSid)) {
    console.warn('[telephony] outbound webhook CallSid does not match the call', callId)
    return twimlResponse(twimlDocument(hangup()))
  }
  if (call.status !== 'in-progress' || call.ended_at) {
    return twimlResponse(twimlDocument(hangup()))
  }

  const [org, agent] = await Promise.all([loadOrganization(call.org_id), loadAgent(call.org_id, call.agent_id)])
  const answeredAt = new Date().toISOString()
  if (!org || !agent) {
    await updateCall(call, { twilio_call_sid: callSid, status: 'failed', end_reason: 'error' })
    return twimlResponse(twimlDocument(hangup()))
  }

  if (!call.is_test && MACHINE_ANSWERS.has(form.AnsweredBy ?? '')) {
    await updateCall(call, { twilio_call_sid: callSid, status: 'no-answer', end_reason: 'voicemail', outcome: 'missed' })
    return twimlResponse(twimlDocument(hangup()))
  }

  // Test calls reach the owner even while the agent is paused or the trial is over: that is the point of a test.
  if (!call.is_test) {
    const blocked = callBlockReason(org) ?? (agent.is_active ? null : 'agent_inactive')
    if (blocked) {
      console.warn('[telephony] outbound call refused at answer time', callId, blocked)
      await updateCall(call, { twilio_call_sid: callSid, status: 'failed', end_reason: blocked })
      return twimlResponse(twimlDocument(hangup()))
    }
  }

  const decision = await resolvePipelineMode({ agent, channel: 'twilio' })
  const routed = decision.reason !== 'no_provider'
  const patch = {
    twilio_call_sid: callSid,
    started_at: answeredAt,
    voice_provider: voiceProviderFor(decision.mode),
    pipeline_mode: routed ? decision.mode : null,
    fallback_reason: decision.fallback ? decision.reason : null,
  }
  await updateCall(call, patch)
  const updated: CallRow = { ...call, ...patch, agent_id: agent.id }
  return twimlResponse(await answerCall({ call: updated, org, agent, decision }))
}

// ─── Voice fallback URL ──────────────────────────────────────────────────────

/**
 * Twilio calls the number's voice_fallback_url (or the outbound fallbackUrl)
 * when the primary webhook failed or timed out. Try ElevenLabs directly, else
 * apologise. Never throws: this is the caller's last chance to hear anything.
 */
export async function handleFallbackCall(form: Record<string, string>, callId: string | null): Promise<Response> {
  let language = 'en'
  let call: CallRow | null = null
  try {
    const callSid = CALL_SID_REGEX.test(form.CallSid ?? '') ? form.CallSid : null
    call = callId ? await loadCallById(callId) : callSid ? await loadCallByTwilioSid(callSid) : null

    let orgId = call?.org_id ?? null
    let number: PhoneNumberRow | null = null
    if (!call) {
      if (callId) return twimlResponse(twimlDocument(hangup()))
      const to = normalizeE164(form.To ?? '')
      number = to ? await loadPhoneNumberByNumber(to) : null
      if (!number) return twimlResponse(twimlDocument(reject()))
      orgId = number.org_id
    }

    const [org, agent] = await Promise.all([
      loadOrganization(orgId as string),
      loadAgent(orgId as string, call?.agent_id ?? number?.agent_id ?? null),
    ])
    language = normalizeAgentLanguage(agent?.language)
    console.warn('[telephony] voice fallback URL used', call?.id ?? 'no call row', form.ErrorCode ?? '')

    if (!org || !agent) return twimlResponse(sayAndHangup(localized(APOLOGY_MESSAGE, language), language))

    if (!call && number) {
      const now = new Date()
      const from = normalizeE164(form.From ?? '')
      const base = {
        org_id: org.id,
        agent_id: agent.id,
        phone_number_id: number.id,
        twilio_call_sid: callSid,
        direction: 'inbound' as CallDirection,
        is_test: false,
        caller_number: from,
        from_number: from,
        to_number: number.number,
        started_at: now.toISOString(),
      }
      const block = inboundBlock({ org, agent, number, now })
      if (block) {
        const missed = await insertCall({ ...base, id: randomUUID(), status: 'no-answer', outcome: 'missed', end_reason: block.reason }).catch(() => null)
        if (missed) fireMissedCallWorkflows(missed)
        return twimlResponse(sayAndHangup(block.message, language))
      }
      call = await insertCall({
        ...base,
        id: randomUUID(),
        status: 'in-progress',
        voice_provider: 'elevenlabs',
        pipeline_mode: 'elevenlabs',
        fallback_used: true,
        fallback_reason: 'voice_url_error',
      }).catch(() => null)
      if (!call) {
        // The database is the likely failure; still try to connect the caller.
        const transient: CallRow = {
          ...base,
          id: randomUUID(),
          phone_number_id: number.id,
          status: 'in-progress',
          end_reason: null,
          outcome: null,
          pipeline_mode: 'elevenlabs',
          voice_provider: 'elevenlabs',
          fallback_used: true,
          fallback_reason: 'voice_url_error',
          duration_seconds: 0,
          ended_at: null,
          recording_sid: null,
          extracted: null,
        }
        const twiml = await elevenLabsTwiml({ call: transient, org, agent, reason: 'voice_url_error' }).catch(() => null)
        return twimlResponse(twiml ?? sayAndHangup(localized(APOLOGY_MESSAGE, language), language))
      }
    } else if (call && call.status !== 'in-progress') {
      return twimlResponse(sayAndHangup(localized(UNAVAILABLE_MESSAGE, language), language))
    }

    const current = call as CallRow
    const twiml = await elevenLabsTwiml({ call: current, org, agent, reason: 'voice_url_error' })
    if (twiml) {
      await Promise.all([
        updateCall(current, {
          voice_provider: 'elevenlabs',
          pipeline_mode: 'elevenlabs',
          fallback_used: true,
          fallback_reason: 'voice_url_error',
        }),
        markElevenLabsHandoff(current.id).catch((error: unknown) =>
          console.error('[telephony] storing the hand-over marker failed', current.id, error instanceof Error ? error.message : error)
        ),
      ])
      return twimlResponse(twiml)
    }
    // The status callback marks it missed (and runs call_missed) unless the on-call hand-off connects.
    await updateCall(current, { end_reason: 'error', fallback_used: true, fallback_reason: current.fallback_reason ?? 'voice_url_error' })
    return twimlResponse(await finalFallbackTwiml({ call: current, language }))
  } catch (error) {
    console.error('[telephony] fallback handler failed', error instanceof Error ? error.message : error)
    return twimlResponse(sayAndHangup(localized(APOLOGY_MESSAGE, language), language))
  }
}

// ─── <Connect action>: the gateway stream ended ─────────────────────────────

/** End reasons that mean the call was ended on purpose; anything else is a failure. */
const DELIBERATE_END_REASONS = new Set([
  'agent_hangup',
  'transferred',
  'caller_hangup',
  'silence_timeout',
  'max_duration',
  'voicemail',
  'test_ended',
])

type TranscriptTurnRow = { role?: unknown; message?: unknown }

function priorTranscriptText(transcript: unknown): string {
  if (!Array.isArray(transcript)) return ''
  return (transcript as TranscriptTurnRow[])
    .slice(-20)
    .map((turn) => {
      const message = typeof turn.message === 'string' ? turn.message.trim() : ''
      if (!message) return null
      return `${turn.role === 'agent' ? 'Agent' : 'Caller'}: ${message}`
    })
    .filter(Boolean)
    .join('\n')
}

export async function handleStreamEnded(form: Record<string, string>, callId: string | null): Promise<Response> {
  // The caller already hung up: nothing to say.
  if (form.CallStatus && form.CallStatus !== 'in-progress') return twimlResponse(EMPTY_TWIML)

  let language = 'en'
  try {
    const callSid = CALL_SID_REGEX.test(form.CallSid ?? '') ? form.CallSid : null
    const call = callId ? await loadCallById(callId) : callSid ? await loadCallByTwilioSid(callSid) : null
    if (!call || (callSid && call.twilio_call_sid && call.twilio_call_sid !== callSid)) {
      return twimlResponse(sayAndHangup(localized(APOLOGY_MESSAGE, language), language))
    }
    if (call.end_reason && DELIBERATE_END_REASONS.has(call.end_reason)) {
      return twimlResponse(twimlDocument(hangup()))
    }

    const [org, agent] = await Promise.all([loadOrganization(call.org_id), loadAgent(call.org_id, call.agent_id)])
    language = normalizeAgentLanguage(agent?.language)
    console.warn('[telephony] stream ended without a deliberate end; falling back', call.id, call.pipeline_mode)

    // Already on ElevenLabs (the gateway's own last resort) and still failed: don't try it twice.
    if (org && agent && call.pipeline_mode !== 'elevenlabs') {
      const [{ data }, streamStarted] = await Promise.all([
        createAdminClient().from('calls').select('transcript').eq('id', call.id).eq('org_id', call.org_id).maybeSingle(),
        wasStreamStarted(call.id).catch(() => false),
      ])
      const prior = priorTranscriptText((data as { transcript?: unknown } | null)?.transcript)
      // A caller who already heard the agent gets "sorry, I'm back", not a second greeting.
      const handoff = streamStarted || prior ? { priorTranscript: prior } : null
      const twiml = await elevenLabsTwiml({ call, org, agent, reason: 'stream_ended', handoff })
      if (twiml) {
        await Promise.all([
          updateCall(call, {
            voice_provider: 'elevenlabs',
            pipeline_mode: 'elevenlabs',
            fallback_used: true,
            fallback_reason: 'stream_ended',
          }),
          markElevenLabsHandoff(call.id).catch((error: unknown) =>
            console.error('[telephony] storing the hand-over marker failed', call.id, error instanceof Error ? error.message : error)
          ),
        ])
        return twimlResponse(twiml)
      }
    }

    await updateCall(call, { end_reason: 'error', fallback_used: true, fallback_reason: call.fallback_reason ?? 'stream_ended' })
    return twimlResponse(await finalFallbackTwiml({ call, language }))
  } catch (error) {
    console.error('[telephony] stream-ended handler failed', error instanceof Error ? error.message : error)
    return twimlResponse(sayAndHangup(localized(APOLOGY_MESSAGE, language), language))
  }
}

// ─── <Dial action>: a live transfer finished ─────────────────────────────────

const ANSWERED_DIAL_STATUSES = new Set(['completed', 'answered'])

const KEEP_OUTCOME_AFTER_TRANSFER = new Set(['booked', 'rescheduled', 'cancelled'])

export async function handleTransferStatus(
  form: Record<string, string>,
  params: { callId: string; contactId: string | null; reason: 'transfer' | 'fallback' }
): Promise<Response> {
  const dialStatus = form.DialCallStatus ?? ''
  let language = 'en'
  try {
    const call = await loadCallById(params.callId)
    if (!call) return twimlResponse(twimlDocument(hangup()))
    const agent = await loadAgent(call.org_id, call.agent_id)
    language = normalizeAgentLanguage(agent?.language)

    if (ANSWERED_DIAL_STATUSES.has(dialStatus)) {
      await updateCall(call, { end_reason: call.end_reason ?? 'transferred', outcome: call.outcome ?? 'transferred' })
      return twimlResponse(twimlDocument(hangup()))
    }

    const supabase = createAdminClient()
    let contact: { id: string; name: string } | null = null
    if (params.contactId) {
      const { data } = await supabase
        .from('escalation_contacts')
        .select('id, name')
        .eq('id', params.contactId)
        .eq('org_id', call.org_id)
        .maybeSingle()
      contact = (data as { id: string; name: string } | null) ?? null
    }
    const callerNumber = call.direction === 'inbound' ? call.from_number : call.to_number
    const who = contact?.name ?? 'your team'
    const callBack = callerNumber ? ` Please call them back at ${callerNumber}.` : ' Please check the call in your dashboard.'
    const body =
      params.reason === 'fallback'
        ? `A caller reached your line while the AI agent was unavailable and was put through to ${who}, but nobody answered.${callBack}`
        : `A caller asked to be transferred to ${who}, but the call wasn't answered.${callBack}`
    const { data: message, error } = await supabase
      .from('agent_messages')
      .insert({
        org_id: call.org_id,
        agent_id: call.agent_id,
        call_id: call.id,
        recipient_contact_id: contact?.id ?? null,
        recipient_name: contact?.name ?? null,
        caller_number: callerNumber,
        callback_number: callerNumber,
        body,
        urgency: 'normal',
        status: 'new',
      })
      .select('id')
      .single()
    if (error) console.error('[telephony] transfer message insert failed', error.code, error.message)
    // Post-call analysis usually runs first (the stream closes before the Dial
    // rings out) and has stored 'transferred'; an unanswered transfer is a
    // message taken unless the call also booked, moved or cancelled something.
    await updateCall(call, { outcome: call.outcome && KEEP_OUTCOME_AFTER_TRANSFER.has(call.outcome) ? call.outcome : 'message_taken' })

    // Tell the team now (text and/or email; the owner when no contact can be
    // reached), so the line the caller hears is true.
    const messageId = (message as { id: string } | null)?.id ?? null
    inBackground('missed transfer notification', async () => {
      const result = await notifyContacts({
        orgId: call.org_id,
        urgency: 'normal',
        subject: 'Missed call transfer',
        body,
        contactIds: contact ? [contact.id] : null,
        callId: call.id,
      })
      if (result.delivered && messageId) {
        const { error: notifiedError } = await createAdminClient()
          .from('agent_messages')
          .update({ status: 'notified', notified_at: new Date().toISOString() })
          .eq('id', messageId)
          .eq('org_id', call.org_id)
          .eq('status', 'new')
        if (notifiedError) console.error('[telephony] message status update failed', notifiedError.code, notifiedError.message)
      }
    })

    return twimlResponse(sayAndHangup(localized(TRANSFER_UNAVAILABLE, language), language))
  } catch (err) {
    console.error('[telephony] transfer-status handler failed', err instanceof Error ? err.message : err)
    return twimlResponse(sayAndHangup(localized(TRANSFER_UNAVAILABLE, language), language))
  }
}

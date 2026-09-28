import 'server-only'

// Loads the rows a call needs and turns them into the SessionBuildInput that
// lib/voice/session.ts assembles into a VoiceSessionConfig. Shared by the
// telephony router (ElevenLabs overrides), the gateway's /session route and
// the fallback routes. Every query uses the service-role client with an
// explicit org filter; nothing here selects token columns.

import { withAgentDefaults, withOrganizationDefaults } from '@/lib/api/auth'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { isGoogleConfigured, isTwilioConfigured } from '@/lib/env'
import { hasReadyKnowledge } from '@/lib/knowledge/search'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CallDirection, VoiceChannel, VoicePipelineMode, VoiceSessionConfig } from '@/lib/voice/contracts'
import { buildSessionConfig, summarizeWorkingHours, type SessionBuildInput } from '@/lib/voice/session'
import { resolveElevenLabsVoice } from '@/lib/voice/sync/voices'
import type { ToolCapabilities } from '@/lib/voice/tools/definitions'
import type { Agent, CallStatus, Organization, PhoneNumber, ServiceOffering, WorkingHours } from '@/types'

// ─── Rows ─────────────────────────────────────────────────────────────────────

/** The call columns the router, the gateway routes and the status callbacks read. */
export const CALL_ROW_COLUMNS = [
  'id', 'org_id', 'agent_id', 'phone_number_id', 'twilio_call_sid', 'direction', 'is_test',
  'caller_number', 'from_number', 'to_number', 'status', 'end_reason', 'outcome', 'pipeline_mode',
  'voice_provider', 'fallback_used', 'fallback_reason', 'duration_seconds', 'started_at', 'ended_at',
  'recording_sid', 'extracted',
].join(', ')

export interface CallRow {
  id: string
  org_id: string
  agent_id: string | null
  phone_number_id: string | null
  twilio_call_sid: string | null
  direction: CallDirection
  is_test: boolean
  caller_number: string | null
  from_number: string | null
  to_number: string | null
  status: CallStatus
  end_reason: string | null
  outcome: string | null
  pipeline_mode: VoicePipelineMode | null
  voice_provider: 'cartesia' | 'elevenlabs'
  fallback_used: boolean
  fallback_reason: string | null
  duration_seconds: number | null
  started_at: string | null
  ended_at: string | null
  recording_sid: string | null
  extracted: Record<string, unknown> | null
}

export type PhoneNumberRow = Pick<
  PhoneNumber,
  'id' | 'org_id' | 'number' | 'agent_id' | 'is_active' | 'sms_capable' | 'twilio_sid' | 'country'
>

export async function loadCallById(callId: string): Promise<CallRow | null> {
  const { data, error } = await createAdminClient().from('calls').select(CALL_ROW_COLUMNS).eq('id', callId).maybeSingle()
  if (error) {
    console.error('[voice] call lookup failed', error.code, error.message)
    throw new Error('Call lookup failed')
  }
  return (data as unknown as CallRow | null) ?? null
}

export async function loadCallByTwilioSid(callSid: string): Promise<CallRow | null> {
  const { data, error } = await createAdminClient()
    .from('calls')
    .select(CALL_ROW_COLUMNS)
    .eq('twilio_call_sid', callSid)
    .maybeSingle()
  if (error) {
    console.error('[voice] call lookup by sid failed', error.code, error.message)
    throw new Error('Call lookup failed')
  }
  return (data as unknown as CallRow | null) ?? null
}

export async function loadOrganization(orgId: string): Promise<Organization | null> {
  // select('*'): one small row, and the column set differs before and after migration 010.
  const { data, error } = await createAdminClient().from('organizations').select('*').eq('id', orgId).maybeSingle()
  if (error) {
    console.error('[voice] organization lookup failed', error.code, error.message)
    throw new Error('Organization lookup failed')
  }
  return data ? withOrganizationDefaults(data as Record<string, unknown>) : null
}

/** The given agent when it belongs to the org, else the org's newest agent. */
export async function loadAgent(orgId: string, preferredAgentId?: string | null): Promise<Agent | null> {
  const supabase = createAdminClient()
  if (preferredAgentId) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', preferredAgentId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (error) {
      console.error('[voice] agent lookup failed', error.code, error.message)
      throw new Error('Agent lookup failed')
    }
    if (data) return withAgentDefaults(data as Record<string, unknown>)
  }
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[voice] agent lookup failed', error.code, error.message)
    throw new Error('Agent lookup failed')
  }
  return data ? withAgentDefaults(data as Record<string, unknown>) : null
}

const PHONE_ROW_COLUMNS = 'id, org_id, number, agent_id, is_active, sms_capable, twilio_sid, country'

export async function loadPhoneNumberByNumber(number: string): Promise<PhoneNumberRow | null> {
  const { data, error } = await createAdminClient()
    .from('phone_numbers')
    .select(PHONE_ROW_COLUMNS)
    .eq('number', number)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[voice] phone number lookup failed', error.code, error.message)
    throw new Error('Phone number lookup failed')
  }
  return (data as PhoneNumberRow | null) ?? null
}

export async function loadPhoneNumber(phoneNumberId: string, orgId: string): Promise<PhoneNumberRow | null> {
  const { data, error } = await createAdminClient()
    .from('phone_numbers')
    .select(PHONE_ROW_COLUMNS)
    .eq('id', phoneNumberId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) {
    console.error('[voice] phone number lookup failed', error.code, error.message)
    throw new Error('Phone number lookup failed')
  }
  return (data as PhoneNumberRow | null) ?? null
}

// ─── Capabilities and summaries ──────────────────────────────────────────────

/** Tables added by migration 010 may be missing on an older database: treat as empty. */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export interface ContactSummaryRow {
  name: string
  role: string | null
  phone: string | null
  transfer_enabled: boolean
  is_on_call: boolean
  conditions: string | null
}

function oneLine(value: string | null | undefined, max: number): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * The team list the agent reads: names, roles and when to involve each
 * person. Phone numbers and emails never reach the model; the tool runner
 * looks them up when it transfers or notifies.
 */
export function summarizeContacts(contacts: ContactSummaryRow[], opts: { transfersAvailable: boolean }): string | null {
  const lines = contacts
    .map((contact) => {
      const name = oneLine(contact.name, 80)
      if (!name) return null
      const role = oneLine(contact.role, 80)
      const conditions = oneLine(contact.conditions, 300)
      const flags: string[] = []
      if (opts.transfersAvailable && contact.transfer_enabled && contact.phone) flags.push('can take live transfers')
      if (contact.is_on_call) flags.push('on call')
      let line = `- ${name}${role ? ` (${role})` : ''}`
      if (conditions) line += `: ${conditions.replace(/[.\s]+$/, '')}`
      if (flags.length > 0) line += ` [${flags.join(', ')}]`
      return line
    })
    .filter((line): line is string => line !== null)
  return lines.length > 0 ? lines.join('\n') : null
}

export function parseServices(value: unknown): ServiceOffering[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Record<string, unknown>
      const name = typeof raw.name === 'string' ? oneLine(raw.name, 120) : ''
      const minutes = Number(raw.duration_minutes)
      if (!name) return null
      return { name, duration_minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0 }
    })
    .filter((service): service is ServiceOffering => service !== null)
    .slice(0, 30)
}

export interface CapabilityFacts {
  channel: VoiceChannel
  plan: Organization['plan']
  smsEnabled: boolean
  twilioConfigured: boolean
  googleConfigured: boolean
  calendarIntegrationActive: boolean
  schedulingSettingsExist: boolean
  knowledgeReady: boolean
  hasSmsCapableNumber: boolean
  hasTransferContact: boolean
  leadFieldCount: number
}

export function computeCapabilities(facts: CapabilityFacts): ToolCapabilities {
  const entitlements = entitlementsFor(facts.plan)
  const phone = facts.channel === 'twilio'
  const calendar =
    facts.googleConfigured && facts.calendarIntegrationActive && entitlements.googleIntegrations && facts.schedulingSettingsExist
  return {
    calendar,
    knowledge: facts.knowledgeReady,
    // A browser test call has no caller number to text or live call to transfer.
    sms: phone && facts.twilioConfigured && facts.smsEnabled && entitlements.smsConfirmations && facts.hasSmsCapableNumber,
    transfer: phone && facts.twilioConfigured && facts.hasTransferContact,
    take_message: true,
    waitlist: calendar,
    // save_lead_details also stores the email a calendar invitation is sent to.
    lead_fields: facts.leadFieldCount > 0 || calendar,
  }
}

export interface SessionContext {
  capabilities: ToolCapabilities
  services: ServiceOffering[]
  contactsSummary: string | null
  businessHoursSummary: string | null
  elevenLabsVoiceId: string | null
  voiceGender: 'masculine' | 'feminine' | 'gender_neutral' | null
}

let warnedMissingTables = false

function warnMissingTable(table: string): void {
  if (warnedMissingTables) return
  warnedMissingTables = true
  console.warn('[voice]', `${table} is missing (migration 010 not applied); treating it as empty`)
}

export async function loadSessionContext(input: { org: Organization; agent: Agent; channel: VoiceChannel }): Promise<SessionContext> {
  const { org, agent, channel } = input
  const supabase = createAdminClient()

  const [integration, scheduling, contacts, smsNumbers, knowledgeReady, fallbackVoice] = await Promise.all([
    supabase
      .from('integrations')
      .select('id, is_active')
      .eq('org_id', org.id)
      .eq('type', 'google_calendar')
      .maybeSingle(),
    supabase.from('scheduling_settings').select('business_hours, services').eq('org_id', org.id).maybeSingle(),
    supabase
      .from('escalation_contacts')
      .select('name, role, phone, transfer_enabled, is_on_call, conditions, sort_order')
      .eq('org_id', org.id)
      .order('sort_order', { ascending: true })
      .limit(25),
    supabase
      .from('phone_numbers')
      .select('id')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .eq('sms_capable', true)
      .limit(1),
    hasReadyKnowledge(agent.id).catch((error: unknown) => {
      console.error('[voice] knowledge readiness check failed', error instanceof Error ? error.message : error)
      return false
    }),
    // Never throws; capped so the router still answers Twilio in time.
    resolveElevenLabsVoice(supabase, org.id, agent.cartesia_voice_id, { lookupMs: 700 }),
  ])

  for (const [table, result] of [
    ['integrations', integration],
    ['scheduling_settings', scheduling],
    ['escalation_contacts', contacts],
    ['phone_numbers', smsNumbers],
  ] as const) {
    if (!result.error) continue
    if (isMissingTable(result.error) || result.error.code === '42703') warnMissingTable(table)
    else console.error('[voice] session context query failed', table, result.error.code, result.error.message)
  }

  const schedulingRow = scheduling.error ? null : (scheduling.data as { business_hours: unknown; services: unknown } | null)
  const contactRows = contacts.error ? [] : ((contacts.data ?? []) as ContactSummaryRow[])
  const integrationRow = integration.error ? null : (integration.data as { is_active: boolean } | null)

  const capabilities = computeCapabilities({
    channel,
    plan: org.plan,
    smsEnabled: org.sms_enabled,
    twilioConfigured: isTwilioConfigured(),
    googleConfigured: isGoogleConfigured(),
    calendarIntegrationActive: !!integrationRow?.is_active,
    schedulingSettingsExist: !!schedulingRow,
    knowledgeReady,
    hasSmsCapableNumber: !smsNumbers.error && (smsNumbers.data ?? []).length > 0,
    hasTransferContact: contactRows.some((c) => c.transfer_enabled && !!c.phone),
    leadFieldCount: (agent.lead_fields ?? []).length,
  })

  const hours = (schedulingRow?.business_hours as WorkingHours | undefined) ?? agent.working_hours
  return {
    capabilities,
    services: parseServices(schedulingRow?.services),
    contactsSummary: summarizeContacts(contactRows, { transfersAvailable: capabilities.transfer }),
    businessHoursSummary: hours ? summarizeWorkingHours(hours, org.timezone || 'UTC') : null,
    elevenLabsVoiceId: fallbackVoice.twinVoiceId,
    voiceGender: fallbackVoice.gender,
  }
}

// ─── Session config ──────────────────────────────────────────────────────────

export const OUTBOUND_PURPOSE_KEY = 'outbound_purpose'

function outboundPurpose(call: Pick<CallRow, 'direction' | 'extracted'>): string | null {
  if (call.direction !== 'outbound') return null
  const value = call.extracted?.[OUTBOUND_PURPOSE_KEY]
  return typeof value === 'string' && value.trim() ? oneLine(value, 500) : null
}

export async function buildSessionForCall(input: {
  call: CallRow
  org: Organization
  agent: Agent
  channel: VoiceChannel
  mode: VoicePipelineMode
  now?: Date
}): Promise<VoiceSessionConfig> {
  const context = await loadSessionContext({ org: input.org, agent: input.agent, channel: input.channel })
  const buildInput: SessionBuildInput = {
    call: {
      id: input.call.id,
      direction: input.call.direction,
      is_test: input.call.is_test,
      from_number: input.call.from_number,
      to_number: input.call.to_number,
      twilio_call_sid: input.call.twilio_call_sid,
    },
    channel: input.channel,
    mode: input.mode,
    org: { id: input.org.id, name: input.org.name, timezone: input.org.timezone, plan: input.org.plan },
    agent: input.agent,
    capabilities: context.capabilities,
    businessHoursSummary: context.businessHoursSummary,
    services: context.services,
    contactsSummary: context.contactsSummary,
    now: input.now ?? new Date(),
    elevenLabsVoiceId: context.elevenLabsVoiceId,
    voiceGender: context.voiceGender,
  }
  const config = buildSessionConfig(buildInput)

  // Why the business is calling (set when the call was placed). Per call, so
  // it goes into the call context, never into the cacheable instructions.
  const purpose = outboundPurpose(input.call)
  if (purpose) {
    const line = `Purpose of this outbound call, set by the business: ${purpose}`
    config.call_context = `${config.call_context}\n- ${line}`
    config.elevenlabs = { ...config.elevenlabs, prompt: `${config.elevenlabs.prompt}\n\n# This call\n${line}` }
  }
  return config
}

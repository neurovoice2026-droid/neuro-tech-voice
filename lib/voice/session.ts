import 'server-only'

// Assembles the VoiceSessionConfig the gateway runs a call with. Pure given
// its inputs (the loader in lib/voice/session-loader.ts fetches the rows), so
// the whole call setup is unit-testable without Supabase or providers.

import { createHash } from 'node:crypto'
import type { Agent, BehaviorSettings, Organization, ServiceOffering, WorkingHours } from '@/types'
import type {
  CallBehavior,
  CallDirection,
  VoiceChannel,
  VoicePipelineMode,
  VoiceSessionConfig,
} from '@/lib/voice/contracts'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { cartesiaTtsModel } from '@/lib/cartesia/client'
import { envString } from '@/lib/env'
import { APOLOGY_MESSAGE, applyDisclosure, greetingFor, localized, outboundGreetingFor } from '@/lib/voice/greetings'
import { normalizeAgentLanguage, sttConfigFor } from '@/lib/voice/languages'
import { composeCallContext, composeSystemPrompt, defaultFallbackMessage } from '@/lib/voice/prompt'
import { normalizeTone, voiceStyleFor } from '@/lib/voice/tone'
import { toolsFor, type ToolCapabilities } from '@/lib/voice/tools/definitions'
import { defaultCartesiaVoice, fallbackElevenLabsVoiceId } from '@/lib/voice/voice-map'

export interface SessionBuildInput {
  call: {
    id: string
    direction: CallDirection
    is_test: boolean
    from_number: string | null
    to_number: string | null
    twilio_call_sid: string | null
  }
  channel: VoiceChannel
  mode: VoicePipelineMode
  org: Pick<Organization, 'id' | 'name' | 'timezone' | 'plan'>
  agent: Agent
  capabilities: ToolCapabilities
  businessHoursSummary: string | null
  services: ServiceOffering[]
  contactsSummary: string | null
  now: Date
  /**
   * ElevenLabs twin of the owner's cloned voice, resolved by the loader. Null
   * picks a premade voice matching `voiceGender` (see fallbackElevenLabsVoiceId).
   */
  elevenLabsVoiceId?: string | null
  /** Gender of the agent's Cartesia voice when known, so the fallback voice sounds alike. */
  voiceGender?: 'masculine' | 'feminine' | 'gender_neutral' | null
}

// Same default as openAIVoiceModel() in lib/openai/client.ts (a test keeps them
// equal); read here directly so building a session doesn't load the OpenAI SDK.
const DEFAULT_VOICE_MODEL = 'gpt-5.6-luna'

// Same defaults the dashboard shows (components/agent/tabs/TabConversation.tsx),
// so an agent whose owner never opened that tab behaves the way the tab reads.
const DEFAULT_BEHAVIOR: BehaviorSettings = {
  allow_interruptions: true,
  auto_end_call: true,
  auto_end_silence_seconds: 10,
  max_call_duration_enabled: false,
  max_call_duration_minutes: 30,
  record_calls: true,
  voicemail_detection: true,
}

/** Even "no limit" calls stop here: a stuck line must not burn minutes all night. */
const HARD_MAX_CALL_SECONDS = 60 * 60
const TEST_CALL_MAX_SECONDS = 180

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function behaviorFor(agent: Agent, opts: { isTest: boolean }): CallBehavior {
  const raw = agent.metadata?.behavior_settings
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof BehaviorSettings, unknown>>

  const autoEnd = bool(saved.auto_end_call, DEFAULT_BEHAVIOR.auto_end_call)
  const silence = clamp(Math.round(num(saved.auto_end_silence_seconds, DEFAULT_BEHAVIOR.auto_end_silence_seconds)), 5, 120)
  const capEnabled = bool(saved.max_call_duration_enabled, DEFAULT_BEHAVIOR.max_call_duration_enabled)
  const capMinutes = num(saved.max_call_duration_minutes, DEFAULT_BEHAVIOR.max_call_duration_minutes)
  const maxDuration = capEnabled ? clamp(Math.round(capMinutes * 60), 60, HARD_MAX_CALL_SECONDS) : HARD_MAX_CALL_SECONDS

  return {
    allow_interruptions: bool(saved.allow_interruptions, DEFAULT_BEHAVIOR.allow_interruptions),
    silence_timeout_seconds: autoEnd ? silence : null,
    max_duration_seconds: opts.isTest ? Math.min(maxDuration, TEST_CALL_MAX_SECONDS) : maxDuration,
    record: bool(saved.record_calls, DEFAULT_BEHAVIOR.record_calls),
    voicemail_detection: bool(saved.voicemail_detection, DEFAULT_BEHAVIOR.voicemail_detection),
  }
}

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function dayLabel(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

/**
 * "Monday to Friday 09:00 to 18:00; Saturday and Sunday closed (Europe/Bucharest time)".
 * Consecutive days with the same hours are grouped so the model (and the
 * caller hearing it) gets one short sentence instead of seven.
 */
export function summarizeWorkingHours(hours: WorkingHours, timezone: string): string {
  if (!hours || typeof hours !== 'object') return 'not set'
  const values = WEEKDAYS.map((day) => {
    const slot = hours[day]
    if (!slot || typeof slot !== 'object') return null
    if (!slot.enabled) return 'closed'
    if (!TIME.test(slot.start) || !TIME.test(slot.end)) return null
    // The dashboard's "Answer 24/7" preset stores 00:00 to 23:59.
    return slot.start === '00:00' && slot.end === '23:59' ? 'open 24 hours' : `${slot.start} to ${slot.end}`
  })
  if (values.every((v) => v === null)) return 'not set'

  const groups: { from: number; to: number; value: string }[] = []
  values.forEach((value, index) => {
    const label = value ?? 'hours not set'
    const last = groups[groups.length - 1]
    if (last && last.value === label && last.to === index - 1) last.to = index
    else groups.push({ from: index, to: index, value: label })
  })
  if (groups.length === 1 && groups[0].value === 'closed') return `closed every day (${timezone} time)`
  if (groups.length === 1 && groups[0].value === 'open 24 hours') return `open 24 hours, every day (${timezone} time)`

  const text = groups
    .map(({ from, to, value }) => {
      const days =
        from === to
          ? dayLabel(WEEKDAYS[from])
          : to === from + 1
            ? `${dayLabel(WEEKDAYS[from])} and ${dayLabel(WEEKDAYS[to])}`
            : `${dayLabel(WEEKDAYS[from])} to ${dayLabel(WEEKDAYS[to])}`
      return `${days} ${value}`
    })
    .join('; ')
  return `${text} (${timezone} time)`
}

/** The owner's custom line for questions the documents don't answer, when set. */
export function notInDocumentsMessage(agent: Pick<Agent, 'metadata'>): string | null {
  const value = agent.metadata?.not_in_documents_message
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** OpenAI safety_identifier: stable per organisation, never a phone number or raw id. */
function safetyIdentifierFor(orgId: string): string {
  return createHash('sha256').update(orgId).digest('hex').slice(0, 32)
}

export function buildSessionConfig(input: SessionBuildInput): VoiceSessionConfig {
  const { agent, org, call, capabilities, mode } = input
  const language = normalizeAgentLanguage(agent.language)
  const tone = normalizeTone(agent.tone)
  const timezone = org.timezone?.trim() || 'UTC'
  const businessName = org.name?.trim() || ''
  const agentName = agent.name?.trim() || ''
  const fallbackMessage = agent.fallback_message?.trim() || defaultFallbackMessage(language)
  const behavior = behaviorFor(agent, { isTest: call.is_test })
  // The owner's switch alone doesn't record: recordings are a plan feature.
  const record = behavior.record && entitlementsFor(org.plan).recordings

  const tools = toolsFor(capabilities, mode)
  const promptInput = {
    system_prompt: agent.system_prompt,
    language,
    fallback_message: fallbackMessage,
    tone,
    agent_name: agentName,
    business_name: businessName,
    lead_fields: agent.lead_fields ?? [],
    contacts_summary: input.contactsSummary,
    services: input.services,
    not_in_documents_message: notInDocumentsMessage(agent),
  }
  const instructions = composeSystemPrompt({ ...promptInput, tools: tools.map((t) => t.name) })

  const greeting =
    call.direction === 'outbound'
      ? outboundGreetingFor({ language, company: businessName, agentName })
      : agent.first_message?.trim() || greetingFor({ language, tone, company: businessName, agentName })
  const initialMessage = applyDisclosure(greeting, {
    language,
    businessName,
    // A recorded call is announced even if the owner forgot the notice switch.
    recordingNotice: agent.recording_notice || record,
  })

  const style = voiceStyleFor({ tone, language, speed: agent.voice_speed, emotion: agent.voice_emotion })
  const pronunciationDict = agent.metadata?.pronunciation_dict_id

  return {
    session_id: call.id,
    call_id: call.id,
    org_id: org.id,
    agent_id: agent.id,
    mode,
    channel: input.channel,
    direction: call.direction,
    is_test: call.is_test,
    from_number: call.from_number,
    to_number: call.to_number,
    twilio_call_sid: call.twilio_call_sid,
    language,
    timezone,
    agent_name: agentName,
    business_name: businessName,
    instructions,
    call_context: composeCallContext({
      now: input.now,
      timezone,
      direction: call.direction,
      // The other party: the caller on inbound calls, the person we dialled on outbound ones.
      caller_number: call.direction === 'inbound' ? call.from_number : call.to_number,
      business_hours_summary: input.businessHoursSummary,
      is_test: call.is_test,
    }),
    initial_message: initialMessage,
    fallback_message: fallbackMessage,
    apology_message: localized(APOLOGY_MESSAGE, language),
    voice: {
      voice_id: agent.cartesia_voice_id || defaultCartesiaVoice(language).voice_id,
      tts_model: cartesiaTtsModel(),
      language,
      speed: style.speed,
      volume: null,
      emotion: style.emotion,
      pronunciation_dict_id: typeof pronunciationDict === 'string' && pronunciationDict ? pronunciationDict : null,
    },
    stt: sttConfigFor(language, agent.keyterms ?? []),
    llm: {
      // envString applies the same placeholder rules as every other integration.
      model: envString('OPENAI_VOICE_MODEL', DEFAULT_VOICE_MODEL),
      max_output_tokens: 400,
      reasoning_effort: 'none',
      max_tool_hops: 4,
    },
    tools,
    behavior: { ...behavior, record },
    cartesia_agent_id: agent.cartesia_agent_id,
    elevenlabs: {
      agent_id: agent.elevenlabs_agent_id,
      voice_id: fallbackElevenLabsVoiceId({
        twinVoiceId: input.elevenLabsVoiceId,
        cartesiaVoiceId: agent.cartesia_voice_id,
        legacyVoiceId: agent.voice_id,
        gender: input.voiceGender,
      }),
      // The ElevenLabs bridge exposes none of our tools, so its prompt carries
      // no tool rules: instructions for tools it can't call invite made-up actions.
      prompt: composeSystemPrompt({ ...promptInput, tools: [] }),
      first_message: initialMessage,
      language,
    },
    safety_identifier: safetyIdentifierFor(org.id),
  }
}

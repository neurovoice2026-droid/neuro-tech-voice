// Pure onboarding state: the shape of the draft kept in the tab's session
// storage, how an older draft is migrated, which step a returning owner may
// resume at, the completion request body and the "regenerate unless edited"
// rules for the greeting and the instructions. No React and no browser
// globals, so the store, the steps and the tests share one definition.
//
// Lives in a private folder (`_lib`) so the router ignores it.

import '@/lib/zod-setup'
import { z } from 'zod'
import { PLANS, type AgentTone, type Organization, type Plan } from '@/types'
import { buildIndustrySystemPrompt } from '@/lib/agent-prompts'
import { greetingFor } from '@/lib/voice/greetings'
import { isSupportedAgentLanguage, normalizeAgentLanguage } from '@/lib/voice/languages'
import { normalizeTone } from '@/lib/voice/tone'

// ─── Steps ────────────────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = [
  { num: 1, id: 'company', label: 'Company' },
  { num: 2, id: 'agent', label: 'Agent' },
  { num: 3, id: 'voice', label: 'Voice' },
  { num: 4, id: 'launch', label: 'Go live' },
] as const

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length

export { ONBOARDING_STORAGE_KEY } from './storage-key'
/** v1 was the in-memory store (personality, ElevenLabs voice); v2 adds tone, timezone and the Cartesia voice. */
export const ONBOARDING_STORE_VERSION = 2

export function clampStep(step: unknown): number {
  const n = typeof step === 'number' && Number.isFinite(step) ? Math.round(step) : 1
  return Math.min(TOTAL_ONBOARDING_STEPS, Math.max(1, n))
}

// ─── Shapes ───────────────────────────────────────────────────────────────────

export type VoiceGender = 'masculine' | 'feminine' | 'gender_neutral'

export interface OnboardingCompany {
  name: string
  industry: string
  website: string
  description: string
  /** IANA zone, e.g. Europe/Bucharest. */
  timezone: string
}

export interface OnboardingAgent {
  name: string
  language: string
  system_prompt: string
  first_message: string
  tone: AgentTone
}

/** Shared with Step3Voice (S5) through setVoice(). */
export interface OnboardingVoice {
  cartesia_voice_id: string
  cartesia_voice_name: string
  preview_url: string | null
  gender: VoiceGender | null
}

/** Whether the owner changed the generated text; untouched text follows tone, language and industry. */
export interface OnboardingEdits {
  first_message: boolean
  system_prompt: boolean
}

export interface OnboardingData {
  /** Organization the draft belongs to; a draft from another account in the same tab is discarded. */
  orgId: string | null
  currentStep: number
  company: OnboardingCompany
  agent: OnboardingAgent
  voice: OnboardingVoice
  /**
   * Agent language the voice was picked for. Voices are chosen per language,
   * so a voice picked before the owner changed the language is cleared and the
   * voice step starts again with native speakers. null = unknown (kept).
   */
  voiceLanguage: string | null
  edited: OnboardingEdits
  plan: Plan
  annual: boolean
}

/** The organisation fields onboarding needs; nothing billing-related reaches the browser. */
export type OnboardingOrganization = Pick<Organization, 'id' | 'name' | 'industry' | 'website' | 'description' | 'timezone'>

/** What the server already has for the agent (a returning owner after a cancelled checkout). */
export interface ExistingAgentDraft {
  name: string
  language: string
  system_prompt: string | null
  first_message: string | null
  tone: AgentTone
  cartesia_voice_id: string | null
  cartesia_voice_name: string | null
}

/** Body of POST /api/onboarding/complete (contract section 9). */
export interface OnboardingCompletionBody {
  plan: Plan
  annual: boolean
  company: { name: string; industry: string; website: string; description: string; timezone: string }
  agent: { name: string; language: string; system_prompt: string; first_message: string; tone: AgentTone }
  voice: { cartesia_voice_id: string; cartesia_voice_name: string; gender: VoiceGender | null }
}

// ─── Time zones ───────────────────────────────────────────────────────────────

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** The device's zone, which is what almost every owner means; UTC when the runtime can't tell. */
export function browserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimeZone(zone) ? zone : 'UTC'
  } catch {
    return 'UTC'
  }
}

// ─── Validation (shared by the forms and the resume logic) ────────────────────

export function normalizeWebsite(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** Accepts "yoursite.com" and "www.yoursite.com" as well as full URLs. */
export function isValidWebsite(value: string): boolean {
  const normalized = normalizeWebsite(value)
  if (!normalized) return true
  try {
    const url = new URL(normalized)
    return /^[^\s.]+(\.[^\s.]+)+$/.test(url.hostname)
  } catch {
    return false
  }
}

export const LIMITS = {
  companyName: { min: 2, max: 100 },
  website: { max: 200 },
  description: { min: 20, max: 500 },
  agentName: { min: 2, max: 30 },
  firstMessage: { min: 10, max: 500 },
  systemPrompt: { max: 4000 },
} as const

export const companySchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.companyName.min, 'Company name must be at least 2 characters')
    .max(LIMITS.companyName.max, 'Company name can be at most 100 characters'),
  industry: z.string().min(1, 'Please pick the closest industry'),
  website: z
    .string()
    .trim()
    .max(LIMITS.website.max, 'That address is too long')
    .refine((value) => isValidWebsite(value), 'Please enter a valid address (e.g. www.yoursite.com)'),
  description: z
    .string()
    .trim()
    .min(LIMITS.description.min, 'Please add at least 20 characters')
    .max(LIMITS.description.max, 'Maximum 500 characters'),
  timezone: z.string().refine((value) => isValidTimeZone(value), 'Please pick your time zone'),
})

export const TONE_VALUES = ['formal', 'professional', 'empathetic', 'casual', 'friendly', 'energetic'] as const

export const agentSchema = z.object({
  tone: z.enum(TONE_VALUES),
  name: z
    .string()
    .trim()
    .min(LIMITS.agentName.min, 'Name must be at least 2 characters')
    .max(LIMITS.agentName.max, 'Max 30 characters'),
  language: z.string().refine((value) => isSupportedAgentLanguage(value), 'Please select a language'),
  first_message: z
    .string()
    .trim()
    .min(LIMITS.firstMessage.min, 'Greeting must be at least 10 characters')
    .max(LIMITS.firstMessage.max, 'Greeting can be at most 500 characters'),
  system_prompt: z.string().max(LIMITS.systemPrompt.max, 'Max 4000 characters'),
})

export function isCompanyComplete(company: OnboardingCompany): boolean {
  return companySchema.safeParse(company).success
}

export function isAgentComplete(agent: OnboardingAgent): boolean {
  return agentSchema.safeParse(agent).success
}

export function isVoiceComplete(voice: OnboardingVoice): boolean {
  return voice.cartesia_voice_id.trim().length > 0
}

/** First step whose data is missing or invalid, or null when everything is ready to launch. */
export function firstIncompleteStep(data: Pick<OnboardingData, 'company' | 'agent' | 'voice'>): 1 | 2 | 3 | null {
  if (!isCompanyComplete(data.company)) return 1
  if (!isAgentComplete(data.agent)) return 2
  if (!isVoiceComplete(data.voice)) return 3
  return null
}

/** False when the chosen voice was picked for a different language than the agent speaks now. */
export function voiceMatchesLanguage(data: Pick<OnboardingData, 'agent' | 'voice' | 'voiceLanguage'>): boolean {
  if (!isVoiceComplete(data.voice) || data.voiceLanguage === null) return true
  return normalizeAgentLanguage(data.voiceLanguage) === normalizeAgentLanguage(data.agent.language)
}

/** Furthest step the owner may open: every step before it must be complete. */
export function furthestAllowedStep(data: Pick<OnboardingData, 'company' | 'agent' | 'voice'>): number {
  return firstIncompleteStep(data) ?? TOTAL_ONBOARDING_STEPS
}

/**
 * Step to show when the page loads. A draft from this tab wins (the owner may
 * have gone back on purpose); without one, the server's step counts (a
 * cancelled checkout comes back at step 4). Either way the owner never lands
 * past a step whose data is incomplete.
 */
export function resolveResumeStep(
  data: Pick<OnboardingData, 'currentStep' | 'company' | 'agent' | 'voice'>,
  opts: { serverStep: number; hasDraft: boolean }
): number {
  const desired = opts.hasDraft ? clampStep(data.currentStep) : Math.max(clampStep(data.currentStep), clampStep(opts.serverStep))
  return Math.min(desired, furthestAllowedStep(data))
}

// ─── Generated text: regenerate unless the owner edited it ────────────────────

export interface GreetingContext {
  language: string
  tone: AgentTone
  company: string
  agentName: string
}

function sameText(a: string, b: string): boolean {
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
  return squash(a) === squash(b)
}

export function suggestedGreeting(ctx: GreetingContext): string {
  return greetingFor({ language: ctx.language, tone: ctx.tone, company: ctx.company, agentName: ctx.agentName })
}

/** True when typed text differs from what we'd generate right now. An empty field counts as not edited. */
export function isGreetingCustomized(text: string, ctx: GreetingContext): boolean {
  return text.trim().length > 0 && !sameText(text, suggestedGreeting(ctx))
}

/**
 * The greeting to show after the tone, language, agent name or company
 * changed: the owner's own words stay; generated (or empty) text follows the
 * new context.
 */
export function resolveGreeting(input: GreetingContext & { current: string; edited: boolean }): { text: string; edited: boolean } {
  if (input.edited && input.current.trim()) return { text: input.current, edited: true }
  return { text: suggestedGreeting(input), edited: false }
}

export interface PromptContext {
  name: string
  description: string
  industry: string
}

export function suggestedSystemPrompt(ctx: PromptContext): string {
  return buildIndustrySystemPrompt({ name: ctx.name.trim(), description: ctx.description, industry: ctx.industry })
}

export function isSystemPromptCustomized(text: string, ctx: PromptContext): boolean {
  return text.trim().length > 0 && !sameText(text, suggestedSystemPrompt(ctx))
}

export function resolveSystemPrompt(input: PromptContext & { current: string; edited: boolean }): { text: string; edited: boolean } {
  if (input.edited && input.current.trim()) return { text: input.current, edited: true }
  return { text: suggestedSystemPrompt(input), edited: false }
}

// ─── Defaults, sanitising and migration ───────────────────────────────────────

export const DEFAULT_PLAN: Plan = 'starter'

export function createOnboardingDefaults(timezone: string = browserTimeZone()): OnboardingData {
  return {
    orgId: null,
    currentStep: 1,
    company: { name: '', industry: '', website: '', description: '', timezone: isValidTimeZone(timezone) ? timezone : 'UTC' },
    agent: { name: '', language: 'en', system_prompt: '', first_message: '', tone: 'professional' },
    voice: { cartesia_voice_id: '', cartesia_voice_name: '', preview_url: null, gender: null },
    voiceLanguage: null,
    edited: { first_message: false, system_prompt: false },
    plan: DEFAULT_PLAN,
    annual: false,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function str(value: unknown, max = 10_000): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

const VOICE_GENDERS: readonly VoiceGender[] = ['masculine', 'feminine', 'gender_neutral']

/**
 * Turns whatever came out of storage into a valid draft. Unknown fields are
 * dropped and invalid values fall back to defaults, so a corrupted or
 * hand-edited entry can never crash the wizard.
 */
export function sanitizeOnboardingData(raw: unknown, fallbackTimezone: string = browserTimeZone()): OnboardingData {
  const defaults = createOnboardingDefaults(fallbackTimezone)
  const src = asRecord(raw)
  const company = asRecord(src.company)
  const agent = asRecord(src.agent)
  const voice = asRecord(src.voice)
  const edited = asRecord(src.edited)

  const agentData: OnboardingAgent = {
    name: str(agent.name, 200),
    language: typeof agent.language === 'string' && agent.language ? normalizeAgentLanguage(agent.language) : defaults.agent.language,
    system_prompt: str(agent.system_prompt, 8000),
    first_message: str(agent.first_message, 2000),
    // v1 stored the same six options as `personality`.
    tone: normalizeTone(agent.tone ?? agent.personality),
  }

  const companyData: OnboardingCompany = {
    name: str(company.name, 200),
    industry: str(company.industry, 100),
    website: str(company.website, 500),
    description: str(company.description, 2000),
    timezone: isValidTimeZone(company.timezone) ? company.timezone : defaults.company.timezone,
  }

  // Only Cartesia ids count: v1 kept ElevenLabs voice ids under `voice_id`,
  // which would fail as a Cartesia voice, so those owners pick again.
  const voiceId = str(voice.cartesia_voice_id, 200).trim()
  const voiceData: OnboardingVoice = voiceId
    ? {
        cartesia_voice_id: voiceId,
        cartesia_voice_name: str(voice.cartesia_voice_name, 200),
        preview_url: typeof voice.preview_url === 'string' && voice.preview_url ? voice.preview_url : null,
        gender: VOICE_GENDERS.includes(voice.gender as VoiceGender) ? (voice.gender as VoiceGender) : null,
      }
    : defaults.voice

  const promptContext = { name: companyData.name, description: companyData.description, industry: companyData.industry }
  const editedData: OnboardingEdits = {
    // v1 had no flag: a greeting the owner already has (typed or picked) is kept.
    first_message:
      typeof edited.first_message === 'boolean'
        ? edited.first_message && agentData.first_message.trim().length > 0
        : agentData.first_message.trim().length > 0,
    system_prompt:
      typeof edited.system_prompt === 'boolean'
        ? edited.system_prompt && agentData.system_prompt.trim().length > 0
        : isSystemPromptCustomized(agentData.system_prompt, promptContext),
  }

  const plan = typeof src.plan === 'string' && Object.prototype.hasOwnProperty.call(PLANS, src.plan) ? (src.plan as Plan) : defaults.plan

  return {
    orgId: typeof src.orgId === 'string' && src.orgId ? src.orgId : null,
    currentStep: clampStep(src.currentStep),
    company: companyData,
    agent: agentData,
    voice: voiceData,
    voiceLanguage:
      voiceId && typeof src.voiceLanguage === 'string' && src.voiceLanguage ? normalizeAgentLanguage(src.voiceLanguage) : null,
    edited: editedData,
    plan,
    annual: src.annual === true,
  }
}

/** zustand persist `migrate`: every older shape goes through the same tolerant sanitiser. */
export function migrateOnboardingState(persisted: unknown, _fromVersion: number): OnboardingData {
  return sanitizeOnboardingData(persisted)
}

// ─── Completion ───────────────────────────────────────────────────────────────

export function buildCompletionBody(data: OnboardingData): OnboardingCompletionBody {
  return {
    plan: data.plan,
    annual: data.annual,
    company: {
      name: data.company.name.trim(),
      industry: data.company.industry,
      website: normalizeWebsite(data.company.website),
      description: data.company.description.trim(),
      timezone: data.company.timezone,
    },
    agent: {
      name: data.agent.name.trim(),
      language: normalizeAgentLanguage(data.agent.language),
      system_prompt: data.agent.system_prompt.trim(),
      first_message: data.agent.first_message.trim(),
      tone: data.agent.tone,
    },
    voice: {
      cartesia_voice_id: data.voice.cartesia_voice_id,
      cartesia_voice_name: data.voice.cartesia_voice_name,
      gender: data.voice.gender,
    },
  }
}

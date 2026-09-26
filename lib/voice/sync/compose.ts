import 'server-only'
import type { Agent, AgentTone } from '@/types'
import type { VoiceToolName } from '@/lib/voice/contracts'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { applyDisclosure, greetingFor } from '@/lib/voice/greetings'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { composeSystemPrompt, defaultFallbackMessage } from '@/lib/voice/prompt'
import { behaviorFor, notInDocumentsMessage } from '@/lib/voice/session'
import { normalizeTone } from '@/lib/voice/tone'
import type { AgentSyncContext, SyncOrg } from '@/lib/voice/sync/context'

// The text every provider agent is built from, derived exactly the way
// buildSessionConfig derives it for a live inbound call, so a Cartesia
// Managed Agent or the ElevenLabs standby says the same things the self-run
// pipeline would.

export const PROVIDER_AGENT_NAME_MAX = 64

/** "Acme Dental - Mara", cut to 64 characters (Cartesia's limit) on a code point boundary. */
export function providerAgentName(orgName: string | null | undefined, agentName: string | null | undefined): string {
  const parts = [orgName?.trim(), agentName?.trim()].filter((part): part is string => !!part)
  const full = parts.length > 0 ? parts.join(' - ') : 'Neuro Tech Voice agent'
  const chars = Array.from(full)
  return chars.length <= PROVIDER_AGENT_NAME_MAX ? full : chars.slice(0, PROVIDER_AGENT_NAME_MAX).join('').trimEnd()
}

/**
 * Both providers read `{{name}}` as a dynamic variable (Cartesia fills
 * `{{system__time}}` and friends, ElevenLabs its conversation variables).
 * Owner-written text can contain braces ("{{first_name}}" pasted from a CRM
 * template), so they are broken up before any prompt or greeting is sent.
 */
export function escapeDynamicVariables(text: string): string {
  return text.replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }')
}

/** Machine-readable tenant tag on the provider agent, used to find it again after a crash. */
export function providerAgentDescription(orgId: string, agentId: string): string {
  return `org:${orgId} agent:${agentId}`
}

export function safeTimeZone(timezone: string | null | undefined): string {
  const zone = timezone?.trim()
  if (!zone) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone
  } catch {
    return 'UTC'
  }
}

export interface ProviderAgentText {
  language: string
  tone: AgentTone
  businessName: string
  agentName: string
  fallbackMessage: string
  /** composeSystemPrompt output for the given tools. */
  instructions: string
  /** Inbound greeting with the AI disclosure (and recording notice when calls are recorded). */
  initialMessage: string
  /** Calls are recorded: the owner's switch is on and the plan includes recordings. */
  recorded: boolean
}

export function composeProviderAgentText(
  agent: Agent,
  org: Pick<SyncOrg, 'name' | 'plan'>,
  ctx: Pick<AgentSyncContext, 'services' | 'contactsSummary'>,
  tools: VoiceToolName[]
): ProviderAgentText {
  const language = normalizeAgentLanguage(agent.language)
  const tone = normalizeTone(agent.tone)
  const businessName = org.name?.trim() || ''
  const agentName = agent.name?.trim() || ''
  const fallbackMessage = agent.fallback_message?.trim() || defaultFallbackMessage(language)
  // Same rule as buildSessionConfig: a recorded call is always announced.
  const recorded = behaviorFor(agent, { isTest: false }).record && entitlementsFor(org.plan).recordings

  const instructions = composeSystemPrompt({
    system_prompt: agent.system_prompt,
    language,
    fallback_message: fallbackMessage,
    tone,
    agent_name: agentName,
    business_name: businessName,
    lead_fields: agent.lead_fields ?? [],
    tools,
    contacts_summary: ctx.contactsSummary,
    services: ctx.services,
    not_in_documents_message: notInDocumentsMessage(agent),
  })

  const greeting = agent.first_message?.trim() || greetingFor({ language, tone, company: businessName, agentName })
  const initialMessage = applyDisclosure(greeting, {
    language,
    businessName,
    recordingNotice: agent.recording_notice || recorded,
  })

  return { language, tone, businessName, agentName, fallbackMessage, instructions, initialMessage, recorded }
}

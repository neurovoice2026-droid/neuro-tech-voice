// Per-call routing decision. Pure: every input is passed in, so the policy is
// unit-tested without Twilio, providers or a database.
//
// The five situations the product distinguishes (also stored on the call):
//   1. conversational fallback  — inside a conversation, the agent says its
//      fallback phrase (agents.fallback_message). Prompt-level; NOT decided here.
//   2. after-hours              — routing_reason 'after_hours' (message/forward),
//      or the AI answers with after-hours context (mode 'ai').
//   3. human handoff/transfer   — routing_reason 'transferred' (set later by the
//      transfer tool / native transfer), never a provider failure.
//   4. provider fallback        — routing_reason 'provider_fallback': ElevenLabs
//      could not take the call, Cartesia did. failover_reason says why.
//   5. final failure            — routing_reason 'no_provider': nobody could take
//      the call; the caller hears an apology (or is forwarded to a human).

import type { VoiceProvider } from './errors'
import type { CircuitStateName } from './circuit-breaker'
import type { AfterHoursConfig, WorkingHoursVerdict } from './working-hours'

export type RoutingReason =
  | 'primary'
  | 'provider_fallback'
  | 'after_hours'
  | 'transferred'
  | 'no_provider'
  | 'agent_inactive'
  | 'number_inactive'
  | 'quota_exhausted'

export type SkipReason =
  | 'not_configured'
  | 'resource_missing'
  | 'circuit_open'
  | 'fallback_disabled'
  | 'forced_elsewhere'

export interface ProviderAvailability {
  configured: boolean
  /** External agent id exists (the agent can take calls even if the last update failed). */
  hasResource: boolean
  circuit: CircuitStateName
}

export interface RoutingInput {
  agentActive: boolean
  numberActive: boolean
  primary: VoiceProvider
  /** null = no provider fallback for this agent. */
  fallback: VoiceProvider | null
  /** Org-level switch (organizations.voice_fallback_enabled). */
  fallbackEnabled: boolean
  /** Platform kill switch: VOICE_FORCE_PROVIDER. */
  force: 'auto' | VoiceProvider
  providers: Record<VoiceProvider, ProviderAvailability>
  hours: WorkingHoursVerdict
  afterHours: AfterHoursConfig
}

export interface Candidate {
  provider: VoiceProvider
  /** 'primary' for the first choice, 'provider_fallback' otherwise. */
  role: 'primary' | 'provider_fallback'
  /** Why the earlier candidates were skipped (only on a fallback candidate). */
  failoverReason: string | null
  probe: boolean
}

export type RoutingPlan =
  | { kind: 'connect'; candidates: Candidate[]; afterHoursContext: boolean; skipped: Array<{ provider: VoiceProvider; reason: SkipReason }> }
  | { kind: 'after_hours'; mode: 'message' | 'forward'; message: string | null; forwardNumber: string | null }
  | { kind: 'reject'; reason: 'agent_inactive' | 'number_inactive' | 'no_provider'; skipped: Array<{ provider: VoiceProvider; reason: SkipReason }> }

function skipReason(p: ProviderAvailability): SkipReason | null {
  if (!p.configured) return 'not_configured'
  if (!p.hasResource) return 'resource_missing'
  if (p.circuit === 'open') return 'circuit_open'
  return null
}

export function planRouting(input: RoutingInput): RoutingPlan {
  if (!input.numberActive) return { kind: 'reject', reason: 'number_inactive', skipped: [] }
  if (!input.agentActive) return { kind: 'reject', reason: 'agent_inactive', skipped: [] }

  // After-hours is decided before any provider: same behaviour on both.
  const afterHoursContext = !input.hours.open
  if (afterHoursContext && input.afterHours.mode !== 'ai') {
    const forward = input.afterHours.mode === 'forward' && input.afterHours.forward_number
    return {
      kind: 'after_hours',
      mode: forward ? 'forward' : 'message',
      message: input.afterHours.message?.trim() || null,
      forwardNumber: forward ? (input.afterHours.forward_number ?? null) : null,
    }
  }

  // Order: forced provider first (kill switch), else the agent's primary then fallback.
  const order: VoiceProvider[] = []
  if (input.force !== 'auto') {
    order.push(input.force)
  } else {
    order.push(input.primary)
    if (input.fallback && input.fallback !== input.primary) order.push(input.fallback)
  }

  const skipped: Array<{ provider: VoiceProvider; reason: SkipReason }> = []
  const candidates: Candidate[] = []
  for (const provider of order) {
    const isFallback = provider !== order[0]
    if (isFallback && !input.fallbackEnabled) {
      skipped.push({ provider, reason: 'fallback_disabled' })
      continue
    }
    const reason = skipReason(input.providers[provider])
    if (reason) {
      skipped.push({ provider, reason })
      continue
    }
    const role: Candidate['role'] = candidates.length === 0 && !isFallback ? 'primary' : 'provider_fallback'
    candidates.push({
      provider,
      role,
      failoverReason: role === 'provider_fallback' ? skipped.map((s) => `${s.provider}:${s.reason}`).join(',') || null : null,
      probe: input.providers[provider].circuit === 'half_open',
    })
  }

  if (candidates.length === 0) return { kind: 'reject', reason: 'no_provider', skipped }
  // At most one fallback attempt per call: no loops between providers.
  return { kind: 'connect', candidates: candidates.slice(0, 2), afterHoursContext, skipped }
}

/**
 * Outbound calls are business-initiated: the after-hours gate never applies
 * (same input for the pre-check before dialing and for the decision at answer).
 */
export function outboundRoutingInput(input: RoutingInput): RoutingInput {
  return { ...input, hours: { ...input.hours, open: true }, afterHours: { ...input.afterHours, enabled: false } }
}

import 'server-only'
import { after } from 'next/server'
import {
  isCartesiaConfigured,
  isElevenLabsConfigured,
  isGatewayConfigured,
  isOpenAIConfigured,
  voicePipelineModeOverride,
} from '@/lib/env'
import { getBreakerPhase, isBreakerOpen, type BreakerKey, type BreakerPhase } from '@/lib/voice/breaker'
import { getCartesiaBudget, type CartesiaBudgetState } from '@/lib/voice/budget'
import { VOICE_PIPELINE_MODES, type VoiceChannel, type VoicePipelineMode } from '@/lib/voice/contracts'
import { DEFAULT_CARTESIA_VOICES } from '@/lib/voice/voice-map'
import type { Agent } from '@/types'

// Picks how one call is served (contract 1.1). decideMode() is the whole
// policy as a pure function; resolvePipelineMode() only gathers its inputs
// (configuration, breakers, budget) and claims half-open breaker probes.
//
// Order, first match wins:
//   1. agent override, else VOICE_PIPELINE_MODE (ignored when that mode can't
//      run at all, e.g. cartesia_self without a gateway)
//   2. no gateway or gateway breaker open → elevenlabs
//   3. cartesia_self: Cartesia + OpenAI, a voice, credits left, breaker closed
//   4. cartesia_managed: Cartesia, a Managed Agent, agent dollars, breaker closed
//   5. elevenlabs: ElevenLabs key + the agent's standby ElevenLabs agent
//   6. last resort: any mode that is configured at all, ignoring budgets and
//      breakers (a call that might fail beats refusing it); else no_provider
//
// `reason` explains the choice: for the first choice 'credits_available', for
// a fallback why the mode just above it was skipped. `skipped` lists every
// rejected mode with its reason, for logs and the call row.

export interface ModeDecision {
  mode: VoicePipelineMode
  reason: string
  fallback: boolean
}

export interface ModeSkip {
  mode: VoicePipelineMode
  reason: ModeReason
}

export interface ModeDecisionDetail extends ModeDecision {
  reason: ModeReason
  skipped: ModeSkip[]
}

export type ModeReason =
  | 'override'
  | 'override_unavailable'
  | 'gateway_not_configured'
  | 'gateway_breaker_open'
  | 'credits_available'
  | 'credits_exhausted'
  | 'self_breaker_open'
  | 'cartesia_not_configured'
  | 'openai_not_configured'
  | 'cartesia_voice_missing'
  | 'managed_agent_missing'
  | 'agent_budget_exhausted'
  | 'managed_breaker_open'
  | 'elevenlabs_not_configured'
  | 'elevenlabs_agent_missing'
  | 'last_resort'
  | 'no_provider'

export interface ModeInputs {
  channel: VoiceChannel
  /** Agent override, else the VOICE_PIPELINE_MODE kill switch; null = automatic. */
  override: VoicePipelineMode | null
  gatewayConfigured: boolean
  cartesiaConfigured: boolean
  openaiConfigured: boolean
  elevenLabsConfigured: boolean
  /** agents.cartesia_voice_id, or a default Cartesia voice for the agent language. */
  hasCartesiaVoice: boolean
  hasManagedAgent: boolean
  hasElevenLabsAgent: boolean
  gatewayBreakerOpen: boolean
  selfBreakerOpen: boolean
  managedBreakerOpen: boolean
  creditsExhausted: boolean
  agentBudgetExhausted: boolean
}

type AgentModeFields = Pick<
  Agent,
  'pipeline_mode_override' | 'cartesia_agent_id' | 'elevenlabs_agent_id' | 'cartesia_voice_id' | 'language'
>

/** How long the router waits for the budget before assuming it is available. */
export const BUDGET_LOOKUP_DEADLINE_MS = 1_500

// ─── Pure policy ─────────────────────────────────────────────────────────────

/** Why a mode can't run at all (configuration only), or null when it can. */
function configReason(mode: VoicePipelineMode, inputs: ModeInputs): ModeReason | null {
  switch (mode) {
    case 'cartesia_self':
      if (!inputs.gatewayConfigured) return 'gateway_not_configured'
      if (!inputs.cartesiaConfigured) return 'cartesia_not_configured'
      if (!inputs.openaiConfigured) return 'openai_not_configured'
      if (!inputs.hasCartesiaVoice) return 'cartesia_voice_missing'
      return null
    case 'cartesia_managed':
      if (!inputs.gatewayConfigured) return 'gateway_not_configured'
      if (!inputs.cartesiaConfigured) return 'cartesia_not_configured'
      if (!inputs.hasManagedAgent) return 'managed_agent_missing'
      return null
    case 'elevenlabs':
      // Phone calls reach ElevenLabs through register-call; the browser test
      // call can only reach it through the gateway bridge.
      if (inputs.channel === 'browser' && !inputs.gatewayConfigured) return 'gateway_not_configured'
      if (!inputs.elevenLabsConfigured) return 'elevenlabs_not_configured'
      if (!inputs.hasElevenLabsAgent) return 'elevenlabs_agent_missing'
      return null
  }
}

export function decideMode(inputs: ModeInputs): ModeDecisionDetail {
  const skipped: ModeSkip[] = []
  const choose = (mode: VoicePipelineMode, reason: ModeReason): ModeDecisionDetail => ({
    mode,
    reason,
    fallback: mode !== 'cartesia_self',
    skipped,
  })
  const lastResort = (): ModeDecisionDetail => {
    const runnable = VOICE_PIPELINE_MODES.find((mode) => configReason(mode, inputs) === null)
    return runnable ? choose(runnable, 'last_resort') : choose('elevenlabs', 'no_provider')
  }

  // 1. Override: support/debug or incident kill switch; budgets and breakers don't apply.
  if (inputs.override) {
    if (configReason(inputs.override, inputs) === null) return choose(inputs.override, 'override')
    skipped.push({ mode: inputs.override, reason: 'override_unavailable' })
  }

  const elevenLabsReason = configReason('elevenlabs', inputs)

  // 2. Both Cartesia modes need the gateway.
  if (!inputs.gatewayConfigured || inputs.gatewayBreakerOpen) {
    const reason: ModeReason = inputs.gatewayConfigured ? 'gateway_breaker_open' : 'gateway_not_configured'
    skipped.push({ mode: 'cartesia_self', reason }, { mode: 'cartesia_managed', reason })
    if (elevenLabsReason === null) return choose('elevenlabs', reason)
    skipped.push({ mode: 'elevenlabs', reason: elevenLabsReason })
    return lastResort()
  }

  // 3. Our own pipeline, paid from model credits.
  const selfReason: ModeReason | null =
    configReason('cartesia_self', inputs) ??
    (inputs.creditsExhausted ? 'credits_exhausted' : inputs.selfBreakerOpen ? 'self_breaker_open' : null)
  if (selfReason === null) return choose('cartesia_self', 'credits_available')
  skipped.push({ mode: 'cartesia_self', reason: selfReason })

  // 4. Cartesia Managed Agents, paid from agent dollars.
  const managedReason: ModeReason | null =
    configReason('cartesia_managed', inputs) ??
    (inputs.agentBudgetExhausted ? 'agent_budget_exhausted' : inputs.managedBreakerOpen ? 'managed_breaker_open' : null)
  if (managedReason === null) return choose('cartesia_managed', selfReason)
  skipped.push({ mode: 'cartesia_managed', reason: managedReason })

  // 5. ElevenLabs standby agent.
  if (elevenLabsReason === null) return choose('elevenlabs', managedReason)
  skipped.push({ mode: 'elevenlabs', reason: elevenLabsReason })

  // 6.
  return lastResort()
}

// ─── Input gathering ─────────────────────────────────────────────────────────

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

/** True when voice-map has default voices for the agent language ('pt-BR' → 'pt'). */
export function hasDefaultCartesiaVoice(language: string | null | undefined): boolean {
  const base = (language ?? '').trim().toLowerCase().split(/[-_]/)[0]
  return base !== '' && Object.prototype.hasOwnProperty.call(DEFAULT_CARTESIA_VOICES, base)
}

function validMode(value: unknown): VoicePipelineMode | null {
  return typeof value === 'string' && (VOICE_PIPELINE_MODES as readonly string[]).includes(value)
    ? (value as VoicePipelineMode)
    : null
}

/** Inputs that need no I/O; runtime conditions start optimistic (closed breakers, budget left). */
export function staticModeInputs(agent: AgentModeFields, channel: VoiceChannel): ModeInputs {
  return {
    channel,
    override: validMode(agent.pipeline_mode_override) ?? voicePipelineModeOverride(),
    gatewayConfigured: isGatewayConfigured(),
    cartesiaConfigured: isCartesiaConfigured(),
    openaiConfigured: isOpenAIConfigured(),
    elevenLabsConfigured: isElevenLabsConfigured(),
    hasCartesiaVoice: nonEmpty(agent.cartesia_voice_id) || hasDefaultCartesiaVoice(agent.language),
    hasManagedAgent: nonEmpty(agent.cartesia_agent_id),
    hasElevenLabsAgent: nonEmpty(agent.elevenlabs_agent_id),
    gatewayBreakerOpen: false,
    selfBreakerOpen: false,
    managedBreakerOpen: false,
    creditsExhausted: false,
    agentBudgetExhausted: false,
  }
}

/**
 * Lets a lookup that lost the race finish after the response. On serverless
 * hosts unfinished work is frozen with the request, so without this a budget
 * source slower than the deadline would never fill the 60 s cache and every
 * call would wait the full deadline again.
 */
function finishAfterResponse(work: Promise<unknown>): void {
  const settled = work.then(
    () => undefined,
    () => undefined
  )
  try {
    after(() => settled)
  } catch {
    // Outside a request scope (scripts, tests) the promise simply keeps running.
  }
}

async function loadBudget(): Promise<CartesiaBudgetState | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), BUDGET_LOOKUP_DEADLINE_MS)
  })
  const lookup = getCartesiaBudget()
  try {
    const budget = await Promise.race([lookup, deadline])
    if (budget === null) {
      console.warn('[voice-mode] budget lookup timed out; assuming budget is available')
      finishAfterResponse(lookup)
    }
    return budget
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.warn('[voice-mode] budget lookup failed; assuming budget is available', detail)
    return null
  } finally {
    clearTimeout(timer)
  }
}

function applyPhases(inputs: ModeInputs, phases: Map<BreakerKey, BreakerPhase>): void {
  // Half-open counts as available here; the probe is claimed once the mode is chosen.
  inputs.gatewayBreakerOpen = phases.get('gateway') === 'open'
  inputs.selfBreakerOpen = phases.get('cartesia_self') === 'open'
  inputs.managedBreakerOpen = phases.get('cartesia_managed') === 'open'
}

function breakersFor(mode: VoicePipelineMode): BreakerKey[] {
  return mode === 'elevenlabs' ? [] : ['gateway', mode]
}

/**
 * Mode for one call. Never throws: unreachable KV reads as closed breakers
 * and a slow or failing budget lookup as budget available, which keeps calls
 * on the primary path while the gateway's per-call failover covers the rest.
 */
export async function resolvePipelineMode(input: {
  agent: AgentModeFields
  channel: VoiceChannel
}): Promise<ModeDecisionDetail> {
  const inputs = staticModeInputs(input.agent, input.channel)

  // Breakers and budgets can only rule Cartesia modes out, so when even the
  // best case is an override or ElevenLabs there is nothing to look up.
  const bestCase = decideMode(inputs)
  if (bestCase.reason === 'override' || bestCase.mode === 'elevenlabs') return bestCase

  const selfPossible = configReason('cartesia_self', inputs) === null
  const managedPossible = configReason('cartesia_managed', inputs) === null
  const keys: BreakerKey[] = ['gateway']
  if (selfPossible) keys.push('cartesia_self')
  if (managedPossible) keys.push('cartesia_managed')

  const [phaseList, budget] = await Promise.all([
    Promise.all(keys.map((key) => getBreakerPhase(key).catch((): BreakerPhase => 'closed'))),
    selfPossible || managedPossible ? loadBudget() : Promise.resolve(null),
  ])
  const phases = new Map<BreakerKey, BreakerPhase>(keys.map((key, i) => [key, phaseList[i]]))
  inputs.creditsExhausted = budget?.credits_exhausted ?? false
  inputs.agentBudgetExhausted = budget?.agent_exhausted ?? false
  applyPhases(inputs, phases)

  // Each pass settles at least one half-open breaker, so this ends within keys.length passes.
  for (let pass = 0; pass <= keys.length; pass++) {
    const decision = decideMode(inputs)
    const probes = breakersFor(decision.mode).filter((key) => phases.get(key) === 'half_open')
    if (probes.length === 0) return decision
    let refused = false
    for (const key of probes) {
      const open = await isBreakerOpen(key).catch(() => false)
      phases.set(key, open ? 'open' : 'closed')
      refused ||= open
    }
    if (!refused) return decision
    applyPhases(inputs, phases)
  }
  return decideMode(inputs)
}

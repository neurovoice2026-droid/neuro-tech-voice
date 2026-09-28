import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BreakerKey, BreakerPhase } from './breaker'
import type { CartesiaBudgetState } from './budget'

const runtime = vi.hoisted(() => ({
  phases: {} as Partial<Record<BreakerKey, BreakerPhase>>,
  /** isBreakerOpen answers per key (true = probe refused). */
  probeRefused: {} as Partial<Record<BreakerKey, boolean>>,
  budget: null as Partial<CartesiaBudgetState> | Error | 'hang' | null,
  phaseCalls: [] as BreakerKey[],
  probeCalls: [] as BreakerKey[],
  budgetCalls: 0,
  /** Callbacks handed to next/server after(). */
  afterCallbacks: [] as (() => unknown)[],
}))

vi.mock('next/server', () => ({
  after: (callback: () => unknown) => {
    runtime.afterCallbacks.push(callback)
  },
}))

vi.mock('@/lib/voice/breaker', () => ({
  getBreakerPhase: async (key: BreakerKey) => {
    runtime.phaseCalls.push(key)
    return runtime.phases[key] ?? 'closed'
  },
  isBreakerOpen: async (key: BreakerKey) => {
    runtime.probeCalls.push(key)
    return runtime.probeRefused[key] ?? false
  },
}))

vi.mock('@/lib/voice/budget', () => ({
  getCartesiaBudget: () => {
    runtime.budgetCalls++
    const budget = runtime.budget
    if (budget === 'hang') return new Promise(() => {})
    if (budget instanceof Error) return Promise.reject(budget)
    return Promise.resolve({ credits_exhausted: false, agent_exhausted: false, ...budget })
  },
}))

import {
  BUDGET_LOOKUP_DEADLINE_MS,
  decideMode,
  hasDefaultCartesiaVoice,
  resolvePipelineMode,
  type ModeInputs,
} from './mode'

// ─── decideMode ──────────────────────────────────────────────────────────────

function inputs(overrides: Partial<ModeInputs> = {}): ModeInputs {
  return {
    channel: 'twilio',
    override: null,
    gatewayConfigured: true,
    cartesiaConfigured: true,
    openaiConfigured: true,
    elevenLabsConfigured: true,
    hasCartesiaVoice: true,
    hasManagedAgent: true,
    hasElevenLabsAgent: true,
    gatewayBreakerOpen: false,
    selfBreakerOpen: false,
    managedBreakerOpen: false,
    creditsExhausted: false,
    agentBudgetExhausted: false,
    ...overrides,
  }
}

function pick(overrides: Partial<ModeInputs>) {
  const { mode, reason, fallback } = decideMode(inputs(overrides))
  return { mode, reason, fallback }
}

describe('decideMode', () => {
  it('prefers our own Cartesia pipeline when everything is available', () => {
    expect(decideMode(inputs())).toEqual({ mode: 'cartesia_self', reason: 'credits_available', fallback: false, skipped: [] })
  })

  describe('1. override', () => {
    it('forces the mode regardless of budgets and breakers', () => {
      expect(pick({ override: 'elevenlabs', creditsExhausted: true })).toEqual({ mode: 'elevenlabs', reason: 'override', fallback: true })
      expect(pick({ override: 'cartesia_self', selfBreakerOpen: true, creditsExhausted: true })).toEqual({
        mode: 'cartesia_self',
        reason: 'override',
        fallback: false,
      })
      expect(pick({ override: 'cartesia_managed', gatewayBreakerOpen: true })).toMatchObject({ mode: 'cartesia_managed', reason: 'override' })
    })

    it('falls through to automatic selection when the forced mode cannot run', () => {
      const decision = decideMode(inputs({ override: 'cartesia_managed', hasManagedAgent: false }))
      expect(decision).toMatchObject({ mode: 'cartesia_self', reason: 'credits_available' })
      expect(decision.skipped).toEqual([{ mode: 'cartesia_managed', reason: 'override_unavailable' }])

      expect(pick({ override: 'cartesia_self', gatewayConfigured: false })).toMatchObject({
        mode: 'elevenlabs',
        reason: 'gateway_not_configured',
      })
    })
  })

  describe('2. gateway', () => {
    it('uses ElevenLabs when the gateway is not configured', () => {
      const decision = decideMode(inputs({ gatewayConfigured: false }))
      expect(decision).toMatchObject({ mode: 'elevenlabs', reason: 'gateway_not_configured', fallback: true })
      expect(decision.skipped).toEqual([
        { mode: 'cartesia_self', reason: 'gateway_not_configured' },
        { mode: 'cartesia_managed', reason: 'gateway_not_configured' },
      ])
    })

    it('uses ElevenLabs when the gateway breaker is open', () => {
      expect(pick({ gatewayBreakerOpen: true })).toEqual({ mode: 'elevenlabs', reason: 'gateway_breaker_open', fallback: true })
    })

    it('still tries the gateway as a last resort when ElevenLabs cannot take the call', () => {
      expect(pick({ gatewayBreakerOpen: true, hasElevenLabsAgent: false })).toEqual({
        mode: 'cartesia_self',
        reason: 'last_resort',
        fallback: false,
      })
    })

    it('has no provider without a gateway and without ElevenLabs', () => {
      const decision = decideMode(inputs({ gatewayConfigured: false, elevenLabsConfigured: false }))
      expect(decision).toMatchObject({ mode: 'elevenlabs', reason: 'no_provider' })
      expect(decision.skipped.at(-1)).toEqual({ mode: 'elevenlabs', reason: 'elevenlabs_not_configured' })
    })

    it('needs the gateway for ElevenLabs on browser test calls', () => {
      expect(pick({ channel: 'browser', gatewayConfigured: false })).toMatchObject({ mode: 'elevenlabs', reason: 'no_provider' })
      expect(pick({ channel: 'twilio', gatewayConfigured: false })).toMatchObject({ mode: 'elevenlabs', reason: 'gateway_not_configured' })
    })
  })

  describe('3 → 4. cartesia_self skipped, Managed Agent used', () => {
    it.each([
      [{ creditsExhausted: true }, 'credits_exhausted'],
      [{ selfBreakerOpen: true }, 'self_breaker_open'],
      [{ openaiConfigured: false }, 'openai_not_configured'],
      [{ hasCartesiaVoice: false }, 'cartesia_voice_missing'],
    ] as const)('%o → %s', (overrides, reason) => {
      const decision = decideMode(inputs(overrides))
      expect(decision).toMatchObject({ mode: 'cartesia_managed', reason, fallback: true })
      expect(decision.skipped).toEqual([{ mode: 'cartesia_self', reason }])
    })

    it('checks credits before the breaker', () => {
      expect(pick({ creditsExhausted: true, selfBreakerOpen: true }).reason).toBe('credits_exhausted')
    })
  })

  describe('5. ElevenLabs after both Cartesia modes', () => {
    it.each([
      [{ hasManagedAgent: false }, 'managed_agent_missing'],
      [{ agentBudgetExhausted: true }, 'agent_budget_exhausted'],
      [{ managedBreakerOpen: true }, 'managed_breaker_open'],
    ] as const)('credits exhausted and %o → %s', (overrides, reason) => {
      const decision = decideMode(inputs({ creditsExhausted: true, ...overrides }))
      expect(decision).toMatchObject({ mode: 'elevenlabs', reason, fallback: true })
      expect(decision.skipped).toEqual([
        { mode: 'cartesia_self', reason: 'credits_exhausted' },
        { mode: 'cartesia_managed', reason },
      ])
    })

    it('says Cartesia is not configured when that is why', () => {
      expect(pick({ cartesiaConfigured: false })).toEqual({ mode: 'elevenlabs', reason: 'cartesia_not_configured', fallback: true })
    })
  })

  describe('6. last resort', () => {
    it('uses a configured Cartesia mode despite budgets and breakers when ElevenLabs is unavailable', () => {
      const decision = decideMode(inputs({ selfBreakerOpen: true, agentBudgetExhausted: true, hasElevenLabsAgent: false }))
      expect(decision).toMatchObject({ mode: 'cartesia_self', reason: 'last_resort', fallback: false })
      expect(decision.skipped).toEqual([
        { mode: 'cartesia_self', reason: 'self_breaker_open' },
        { mode: 'cartesia_managed', reason: 'agent_budget_exhausted' },
        { mode: 'elevenlabs', reason: 'elevenlabs_agent_missing' },
      ])

      expect(pick({ openaiConfigured: false, managedBreakerOpen: true, elevenLabsConfigured: false })).toEqual({
        mode: 'cartesia_managed',
        reason: 'last_resort',
        fallback: true,
      })
    })

    it('reports no_provider when nothing is configured', () => {
      expect(
        pick({ cartesiaConfigured: false, openaiConfigured: false, elevenLabsConfigured: false, hasManagedAgent: false })
      ).toEqual({ mode: 'elevenlabs', reason: 'no_provider', fallback: true })
    })
  })
})

describe('hasDefaultCartesiaVoice', () => {
  it('matches the base language of voice-map entries', () => {
    expect(hasDefaultCartesiaVoice('ro')).toBe(true)
    expect(hasDefaultCartesiaVoice('pt-BR')).toBe(true)
    expect(hasDefaultCartesiaVoice(' EN ')).toBe(true)
    expect(hasDefaultCartesiaVoice('sv')).toBe(false)
    expect(hasDefaultCartesiaVoice('')).toBe(false)
    expect(hasDefaultCartesiaVoice('constructor')).toBe(false)
  })
})

// ─── resolvePipelineMode ─────────────────────────────────────────────────────

const agent = {
  pipeline_mode_override: null,
  cartesia_agent_id: 'agent_cartesia_1',
  elevenlabs_agent_id: 'agent_el_1',
  cartesia_voice_id: 'voice-1',
  language: 'en',
} as const

function configureAll(values: Record<string, string> = {}) {
  const env: Record<string, string> = {
    VOICE_GATEWAY_URL: 'wss://gateway.example.com',
    // Not all one character: lib/env treats "xxx…" as a placeholder.
    VOICE_GATEWAY_SECRET: 'gw-secret-0123456789abcdef0123456789abcdef',
    CARTESIA_API_KEY: 'sk_car_test',
    OPENAI_API_KEY: 'sk-test',
    ELEVENLABS_API_KEY: 'el-test',
    VOICE_PIPELINE_MODE: '',
    ...values,
  }
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
}

describe('resolvePipelineMode', () => {
  beforeEach(() => {
    runtime.phases = {}
    runtime.probeRefused = {}
    runtime.budget = null
    runtime.phaseCalls = []
    runtime.probeCalls = []
    runtime.budgetCalls = 0
    runtime.afterCallbacks = []
    configureAll()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('chooses cartesia_self after checking breakers and budget', async () => {
    const decision = await resolvePipelineMode({ agent, channel: 'twilio' })
    expect(decision).toMatchObject({ mode: 'cartesia_self', reason: 'credits_available', fallback: false })
    expect(runtime.phaseCalls.sort()).toEqual(['cartesia_managed', 'cartesia_self', 'gateway'])
    expect(runtime.budgetCalls).toBe(1)
    expect(runtime.probeCalls).toEqual([])
  })

  it('moves to the Managed Agent when credits are exhausted', async () => {
    runtime.budget = { credits_exhausted: true }
    expect(await resolvePipelineMode({ agent, channel: 'twilio' })).toMatchObject({
      mode: 'cartesia_managed',
      reason: 'credits_exhausted',
    })
  })

  it('moves to ElevenLabs when the gateway breaker is open', async () => {
    runtime.phases = { gateway: 'open' }
    expect(await resolvePipelineMode({ agent, channel: 'twilio' })).toMatchObject({
      mode: 'elevenlabs',
      reason: 'gateway_breaker_open',
    })
  })

  it('does no lookups when Cartesia is not configured', async () => {
    configureAll({ CARTESIA_API_KEY: '' })
    expect(await resolvePipelineMode({ agent, channel: 'twilio' })).toMatchObject({
      mode: 'elevenlabs',
      reason: 'cartesia_not_configured',
    })
    expect(runtime.phaseCalls).toEqual([])
    expect(runtime.budgetCalls).toBe(0)
  })

  it('treats a short gateway secret as not configured', async () => {
    configureAll({ VOICE_GATEWAY_SECRET: 'short' })
    expect(await resolvePipelineMode({ agent, channel: 'twilio' })).toMatchObject({ reason: 'gateway_not_configured' })
  })

  it('honours the VOICE_PIPELINE_MODE kill switch and the agent override, agent first', async () => {
    configureAll({ VOICE_PIPELINE_MODE: 'elevenlabs' })
    expect(await resolvePipelineMode({ agent, channel: 'twilio' })).toMatchObject({ mode: 'elevenlabs', reason: 'override' })
    expect(
      await resolvePipelineMode({ agent: { ...agent, pipeline_mode_override: 'cartesia_managed' }, channel: 'twilio' })
    ).toMatchObject({ mode: 'cartesia_managed', reason: 'override', fallback: true })
    expect(runtime.budgetCalls).toBe(0)
  })

  it('ignores an invalid agent override value', async () => {
    const odd = { ...agent, pipeline_mode_override: 'turbo' as unknown as null }
    expect(await resolvePipelineMode({ agent: odd, channel: 'twilio' })).toMatchObject({ mode: 'cartesia_self' })
  })

  it('uses a default voice for supported languages only', async () => {
    const noVoice = { ...agent, cartesia_voice_id: null }
    expect(await resolvePipelineMode({ agent: { ...noVoice, language: 'ro' }, channel: 'twilio' })).toMatchObject({
      mode: 'cartesia_self',
    })
    expect(await resolvePipelineMode({ agent: { ...noVoice, language: 'sv' }, channel: 'twilio' })).toMatchObject({
      mode: 'cartesia_managed',
      reason: 'cartesia_voice_missing',
    })
  })

  it('assumes budget is available when the lookup fails', async () => {
    runtime.budget = new Error('kv down')
    expect(await resolvePipelineMode({ agent, channel: 'twilio' })).toMatchObject({ mode: 'cartesia_self' })
  })

  it('assumes budget is available when the lookup is too slow', async () => {
    vi.useFakeTimers()
    runtime.budget = 'hang'
    const pending = resolvePipelineMode({ agent, channel: 'twilio' })
    await vi.advanceTimersByTimeAsync(BUDGET_LOOKUP_DEADLINE_MS)
    expect(await pending).toMatchObject({ mode: 'cartesia_self', reason: 'credits_available' })
    expect(console.warn).toHaveBeenCalledWith('[voice-mode] budget lookup timed out; assuming budget is available')
    // The slow lookup keeps running after the response so it can still fill the cache.
    expect(runtime.afterCallbacks).toHaveLength(1)
  })

  it('does not schedule background work when the budget answers in time', async () => {
    await resolvePipelineMode({ agent, channel: 'twilio' })
    expect(runtime.budgetCalls).toBe(1)
    expect(runtime.afterCallbacks).toHaveLength(0)
  })

  it('claims half-open probes for the chosen path', async () => {
    runtime.phases = { gateway: 'half_open', cartesia_self: 'half_open' }
    expect(await resolvePipelineMode({ agent, channel: 'twilio' })).toMatchObject({ mode: 'cartesia_self' })
    expect(runtime.probeCalls).toEqual(['gateway', 'cartesia_self'])
  })

  it('moves on when another call holds the half-open probe', async () => {
    runtime.phases = { cartesia_self: 'half_open', cartesia_managed: 'half_open' }
    runtime.probeRefused = { cartesia_self: true, cartesia_managed: true }
    const decision = await resolvePipelineMode({ agent, channel: 'twilio' })
    expect(decision).toMatchObject({ mode: 'elevenlabs', reason: 'managed_breaker_open' })
    expect(decision.skipped).toEqual([
      { mode: 'cartesia_self', reason: 'self_breaker_open' },
      { mode: 'cartesia_managed', reason: 'managed_breaker_open' },
    ])
    expect(runtime.probeCalls).toEqual(['cartesia_self', 'cartesia_managed'])
  })

  it('does not probe breakers of modes it does not use', async () => {
    runtime.phases = { cartesia_managed: 'half_open' }
    expect(await resolvePipelineMode({ agent, channel: 'twilio' })).toMatchObject({ mode: 'cartesia_self' })
    expect(runtime.probeCalls).toEqual([])
  })
})

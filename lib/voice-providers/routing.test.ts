import { describe, expect, it } from 'vitest'
import { planRouting, type RoutingInput } from './routing'
import { DEFAULT_AFTER_HOURS } from './working-hours'

const OPEN_HOURS = { open: true, reason: 'in_window', timeZone: 'UTC', localWeekday: 'monday', localTime: '10:00' } as const
const CLOSED_HOURS = { open: false, reason: 'outside_window', timeZone: 'UTC', localWeekday: 'monday', localTime: '22:00' } as const

function input(over: Partial<RoutingInput> = {}): RoutingInput {
  return {
    agentActive: true,
    numberActive: true,
    primary: 'elevenlabs',
    fallback: 'cartesia',
    fallbackEnabled: true,
    force: 'auto',
    providers: {
      elevenlabs: { configured: true, hasResource: true, circuit: 'closed' },
      cartesia: { configured: true, hasResource: true, circuit: 'closed' },
    },
    hours: OPEN_HOURS,
    afterHours: DEFAULT_AFTER_HOURS,
    ...over,
  }
}

describe('planRouting', () => {
  it('tries ElevenLabs first and keeps exactly one Cartesia fallback candidate', () => {
    const plan = planRouting(input())
    expect(plan.kind).toBe('connect')
    if (plan.kind !== 'connect') return
    expect(plan.candidates.map((c) => [c.provider, c.role])).toEqual([
      ['elevenlabs', 'primary'],
      ['cartesia', 'provider_fallback'],
    ])
  })

  it('routes new calls to Cartesia while the ElevenLabs circuit is open, with the reason', () => {
    const plan = planRouting(input({
      providers: {
        elevenlabs: { configured: true, hasResource: true, circuit: 'open' },
        cartesia: { configured: true, hasResource: true, circuit: 'closed' },
      },
    }))
    if (plan.kind !== 'connect') throw new Error('expected connect')
    expect(plan.candidates).toHaveLength(1)
    expect(plan.candidates[0]).toMatchObject({ provider: 'cartesia', role: 'provider_fallback', failoverReason: 'elevenlabs:circuit_open' })
  })

  it('marks a half-open provider as the probe', () => {
    const plan = planRouting(input({
      providers: {
        elevenlabs: { configured: true, hasResource: true, circuit: 'half_open' },
        cartesia: { configured: true, hasResource: true, circuit: 'closed' },
      },
    }))
    if (plan.kind !== 'connect') throw new Error('expected connect')
    expect(plan.candidates[0]).toMatchObject({ provider: 'elevenlabs', probe: true })
  })

  it('does not fall back when the org disabled provider fallback', () => {
    const plan = planRouting(input({
      fallbackEnabled: false,
      providers: {
        elevenlabs: { configured: true, hasResource: true, circuit: 'open' },
        cartesia: { configured: true, hasResource: true, circuit: 'closed' },
      },
    }))
    expect(plan).toMatchObject({ kind: 'reject', reason: 'no_provider' })
  })

  it('reports final failure when no provider can take the call', () => {
    const plan = planRouting(input({
      providers: {
        elevenlabs: { configured: false, hasResource: false, circuit: 'closed' },
        cartesia: { configured: true, hasResource: false, circuit: 'closed' },
      },
    }))
    expect(plan).toMatchObject({
      kind: 'reject',
      reason: 'no_provider',
      skipped: [
        { provider: 'elevenlabs', reason: 'not_configured' },
        { provider: 'cartesia', reason: 'resource_missing' },
      ],
    })
  })

  it('applies after-hours before choosing any provider (message and forward)', () => {
    expect(planRouting(input({ hours: CLOSED_HOURS, afterHours: { enabled: true, mode: 'message', message: 'Closed' } })))
      .toEqual({ kind: 'after_hours', mode: 'message', message: 'Closed', forwardNumber: null })
    expect(planRouting(input({ hours: CLOSED_HOURS, afterHours: { enabled: true, mode: 'forward', forward_number: '+40712345678' } })))
      .toMatchObject({ kind: 'after_hours', mode: 'forward', forwardNumber: '+40712345678' })
    // forward without a number degrades to the message, never to a dead line
    expect(planRouting(input({ hours: CLOSED_HOURS, afterHours: { enabled: true, mode: 'forward', forward_number: null } })))
      .toMatchObject({ kind: 'after_hours', mode: 'message' })
  })

  it("lets the AI answer after hours in 'ai' mode, flagged as after-hours context", () => {
    const plan = planRouting(input({ hours: CLOSED_HOURS, afterHours: { enabled: true, mode: 'ai' } }))
    expect(plan).toMatchObject({ kind: 'connect', afterHoursContext: true })
  })

  it('rejects paused agents and inactive numbers before anything else', () => {
    expect(planRouting(input({ agentActive: false }))).toMatchObject({ kind: 'reject', reason: 'agent_inactive' })
    expect(planRouting(input({ numberActive: false }))).toMatchObject({ kind: 'reject', reason: 'number_inactive' })
  })

  it('honours the platform kill switch', () => {
    const plan = planRouting(input({ force: 'cartesia' }))
    if (plan.kind !== 'connect') throw new Error('expected connect')
    expect(plan.candidates.map((c) => c.provider)).toEqual(['cartesia'])
    expect(plan.candidates[0].role).toBe('primary')
  })
})

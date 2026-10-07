import { describe, expect, it } from 'vitest'
import { composeSystemPrompt, PLATFORM_VARIABLES } from './prompt'

// Slice A2 rules: the tenant's transfer condition, transfer-tool routing for
// orgs with both kinds of numbers, and opening hours for native calls.

describe('transfer condition', () => {
  it('reaches the handoff rule quoted, on one line and capped, for every call context', () => {
    for (const callContext of ['variables', 'tool', 'none'] as const) {
      const out = composeSystemPrompt({ transferEnabled: true, transferLabel: 'Desk', transferCondition: 'When the caller\nasks about "billing"', callContext })
      expect(out).toContain('this business condition applies: "When the caller asks about \'billing\'"')
    }
    const long = composeSystemPrompt({ transferEnabled: true, transferCondition: 'x'.repeat(800) })
    expect(long).toContain(`"${'x'.repeat(500)}"`)
    expect(long).not.toContain('x'.repeat(501))
  })

  it('keeps the generic wording without a condition, and no rule when transfer is off', () => {
    expect(composeSystemPrompt({ transferEnabled: true, transferCondition: '  ' })).toContain('or the configured condition applies')
    expect(composeSystemPrompt({ transferEnabled: false, transferCondition: 'x' })).not.toContain('Human handoff')
  })
})

describe('mixed routing', () => {
  it('tells the ElevenLabs agent which transfer tool to use from the routing variable', () => {
    const out = composeSystemPrompt({ transferEnabled: true, mixedTransferTools: true })
    expect(out).toContain(`{{${PLATFORM_VARIABLES.routingMode}}}`)
    expect(out).toContain('transfer_to_human')
    expect(out).toContain('transfer_to_number')
    expect(composeSystemPrompt({ transferEnabled: true })).not.toContain('Transfer tool:')
    expect(composeSystemPrompt({ transferEnabled: false, mixedTransferTools: true })).not.toContain('Transfer tool:')
    expect(composeSystemPrompt({ transferEnabled: true, mixedTransferTools: true, callContext: 'tool' })).not.toContain('Transfer tool:')
  })
})

describe('opening hours for native calls', () => {
  it('adds the decide-from-hours rule only with hours and per-call variables', () => {
    const out = composeSystemPrompt({ openingHours: 'Monday 09:00-17:00; Sunday closed.' })
    expect(out).toContain(`If {{${PLATFORM_VARIABLES.afterHours}}} is "unknown"`)
    expect(out).toContain('Opening hours: Monday 09:00-17:00; Sunday closed.')
    expect(composeSystemPrompt({})).not.toContain('is "unknown"')
    expect(composeSystemPrompt({ openingHours: 'Monday 09:00-17:00.', callContext: 'tool' })).not.toContain('is "unknown"')
  })
})

import { describe, expect, it } from 'vitest'
import { composeSystemPrompt, type ComposePromptInput } from './prompt'

// Slice B1: when the platform transfer tool (app-routed calls) cannot be set
// up, the prompt must never promise a transfer that cannot happen.

const base: ComposePromptInput = {
  system_prompt: 'You answer calls for Smile Clinic.',
  language: 'en',
  transferEnabled: true,
  transferLabel: 'the front desk',
  transferCondition: 'The caller asks about billing',
  callContext: 'variables',
}

describe('composeSystemPrompt: app-routed transfer tool unavailable', () => {
  it('app-routed only: no handoff rule, the agent offers to take a message', () => {
    const ok = composeSystemPrompt(base)
    const down = composeSystemPrompt({ ...base, appTransferUnavailable: true })
    expect(ok).toContain('Human handoff')
    expect(down).not.toContain('Human handoff')
    expect(down).not.toContain('transfer_to_human')
    expect(down).toContain('You cannot transfer calls')
  })

  it('mixed routing: native calls still transfer with transfer_to_number, app-routed calls are told it is not possible', () => {
    const down = composeSystemPrompt({ ...base, mixedTransferTools: true, appTransferUnavailable: true })
    expect(down).toContain('Human handoff')
    expect(down).toContain('transfer with the transfer_to_number tool')
    expect(down).toContain('"app_routed", transferring is not possible right now')
    expect(down).not.toContain('transfer with the transfer_to_human tool')
    const ok = composeSystemPrompt({ ...base, mixedTransferTools: true })
    expect(ok).toContain('transfer with the transfer_to_human tool')
  })

  it('does not change the Cartesia fallback prompt (no ElevenLabs tools there)', () => {
    for (const callContext of ['tool', 'none'] as const) {
      expect(composeSystemPrompt({ ...base, callContext, appTransferUnavailable: true })).toBe(composeSystemPrompt({ ...base, callContext }))
    }
  })

  it('no platform variable or token reaches the prompt', () => {
    const down = composeSystemPrompt({ ...base, mixedTransferTools: true, appTransferUnavailable: true })
    expect(down).not.toMatch(/ntv_call_token|secret__/)
  })
})

import { describe, expect, it } from 'vitest'
import { composeSystemPrompt, type ComposePromptInput } from './prompt'

// Slice G: browser test sessions carry ntv_routing_mode "web". The platform
// tools refuse them (placeholder call token), so the ElevenLabs prompt tells
// the agent that transfers, bookings and messages only work on phone calls.

const base: ComposePromptInput = {
  system_prompt: 'You answer calls for Smile Clinic.',
  language: 'en',
  callContext: 'variables',
}

const RULE = '{{ntv_routing_mode}} is "web"'

describe('composeSystemPrompt: browser test sessions', () => {
  it('is present whenever an action tool exists on the ElevenLabs agent', () => {
    expect(composeSystemPrompt({ ...base, transferEnabled: true, transferLabel: 'the desk' })).toContain(RULE)
    expect(composeSystemPrompt({ ...base, bookingMode: 'tools' })).toContain(RULE)
    expect(composeSystemPrompt({ ...base, takeMessageTool: true })).toContain(RULE)
  })

  it('is absent without any action tool, and on the Cartesia fallback (no variables)', () => {
    expect(composeSystemPrompt(base)).not.toContain(RULE)
    expect(composeSystemPrompt({ ...base, transferEnabled: true, callContext: 'tool' })).not.toContain('ntv_routing_mode')
    expect(composeSystemPrompt({ ...base, takeMessageTool: true, callContext: 'none' })).not.toContain('ntv_routing_mode')
  })
})

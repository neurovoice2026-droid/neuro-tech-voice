import { describe, expect, it } from 'vitest'
import { composeSystemPrompt } from './prompt'
import { businessToolRules } from './prompt-business'

const base = { system_prompt: 'You answer for Smile Clinic.', language: 'en', callContext: 'variables' as const }

describe('booking and message rules (slice B2)', () => {
  it('booking tools: at most 2-3 offered times, read back, never invented, confirmed only after ok = true', () => {
    const prompt = composeSystemPrompt({ ...base, bookingMode: 'tools' })
    expect(prompt).toContain('call check_availability')
    expect(prompt).toContain('Offer at most 2 or 3 of the times it returns')
    expect(prompt).toContain('never invent, guess or promise availability')
    expect(prompt).toContain('read the date and time back and ask them to confirm')
    expect(prompt).toContain('only after book_appointment answers ok = true')
    // Native inbound calls carry no tool token ({{ntv_call_id}} = "unknown").
    expect(prompt).toContain('If the variable {{ntv_call_id}} is "unknown", the check_availability, book_appointment tools cannot be used')
  })

  it('booking enabled without the tools: never promises a time, takes a message with preferred times', () => {
    const prompt = composeSystemPrompt({ ...base, bookingMode: 'take_message', takeMessageTool: true })
    expect(prompt).toContain('you cannot see the calendar or book appointments on this call')
    expect(prompt).toContain('take a message with take_message')
    expect(prompt).not.toContain('call check_availability')
  })

  it('take_message: read the callback number back before calling it, success only on ok = true', () => {
    const prompt = composeSystemPrompt({ ...base, takeMessageTool: true })
    expect(prompt).toContain('read the callback number back in short groups of digits and ask them to confirm it')
    expect(prompt).toContain('Then call take_message once')
    expect(prompt).toContain('only after it answers ok = true')
    expect(prompt).toContain('the take_message tools cannot be used on this call')
  })

  it('nothing enabled: no business tool rule at all (existing behaviour unchanged)', () => {
    expect(businessToolRules({ callContext: 'variables', callIdVariable: 'ntv_call_id' })).toEqual([])
    const prompt = composeSystemPrompt(base)
    expect(prompt).not.toContain('take_message')
    expect(prompt).not.toContain('check_availability')
  })

  it('Cartesia fallback (tool context): no {{variables}}, take_message with a verbal fallback, never booking', () => {
    const rules = businessToolRules({ callContext: 'tool', callIdVariable: 'ntv_call_id', bookingMode: 'take_message', takeMessageTool: true })
    expect(rules.join('\n')).not.toContain('{{')
    expect(rules.join('\n')).toContain('If take_message is not available or fails, repeat the details back')
    expect(rules.join('\n')).toContain('you cannot see the calendar')
  })
})

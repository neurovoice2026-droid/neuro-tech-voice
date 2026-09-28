import { describe, expect, it } from 'vitest'
import { callingMessage, outboundAvailability, outboundErrorOutcome, validateOutboundInput, type OutboundCallSetup } from './outbound-call'

const READY: OutboundCallSetup = { entitled: true, requiredPlan: 'starter', configured: true, phoneNumber: '+40312345678', agentActive: true }

describe('outboundAvailability', () => {
  it('is ready with a paid plan, Twilio, a number and an active agent', () => {
    expect(outboundAvailability(READY)).toEqual({ kind: 'ready', from: '+40312345678' })
  })

  it('names the first thing to fix, plan first', () => {
    expect(outboundAvailability({ ...READY, entitled: false, configured: false, phoneNumber: null })).toEqual({ kind: 'locked', requiredPlan: 'starter' })
    expect(outboundAvailability({ ...READY, configured: false, phoneNumber: null })).toEqual({ kind: 'not_configured' })
    expect(outboundAvailability({ ...READY, agentActive: null })).toEqual({ kind: 'no_agent' })
    expect(outboundAvailability({ ...READY, phoneNumber: null, agentActive: false })).toEqual({ kind: 'no_number' })
    expect(outboundAvailability({ ...READY, agentActive: false })).toEqual({ kind: 'agent_paused' })
  })
})

describe('validateOutboundInput', () => {
  it('normalises typed numbers and keeps an optional reason', () => {
    expect(validateOutboundInput(' 0040 712-345 678 ', '  Confirm tomorrow’s appointment ', '+40312345678')).toEqual({
      ok: true,
      to: '+40712345678',
      purpose: 'Confirm tomorrow’s appointment',
    })
    expect(validateOutboundInput('+447911123456', '   ', null)).toEqual({ ok: true, to: '+447911123456', purpose: null })
  })

  it('refuses national formats, the agent’s own number, premium-rate numbers and long reasons', () => {
    expect(validateOutboundInput('0712345678', '', null)).toMatchObject({ ok: false, field: 'to_number' })
    expect(validateOutboundInput('+40312345678', '', '+40312345678')).toMatchObject({ ok: false, field: 'to_number', message: expect.stringMatching(/own number/) })
    expect(validateOutboundInput('+40900123456', '', '+40312345678')).toMatchObject({ ok: false, field: 'to_number', message: expect.stringMatching(/Premium-rate/) })
    expect(validateOutboundInput('+40712345678', 'x'.repeat(501), null)).toMatchObject({ ok: false, field: 'purpose' })
  })
})

describe('outboundErrorOutcome', () => {
  it('puts number problems on the field and plan or setup problems in a blocking state', () => {
    expect(outboundErrorOutcome({ status: 409, code: 'opted_out', message: 'This person asked not to be contacted.' })).toEqual({
      field: 'to_number',
      message: 'This person asked not to be contacted.',
      blocking: null,
    })
    expect(outboundErrorOutcome({ status: 403, code: 'upgrade_required', message: null }).blocking).toBe('locked')
    expect(outboundErrorOutcome({ status: 409, code: 'no_phone_number', message: null }).blocking).toBe('no_number')
    expect(outboundErrorOutcome({ status: 409, code: 'agent_inactive', message: null }).blocking).toBe('agent_paused')
    expect(outboundErrorOutcome({ status: 503, code: 'not_configured', message: null }).blocking).toBe('not_configured')
    expect(outboundErrorOutcome({ status: 429, code: 'rate_limited', message: 'Slow down.' })).toEqual({ field: null, message: 'Slow down.', blocking: null })
    expect(outboundErrorOutcome({ status: 502, code: 'call_failed', message: null }).message).toMatch(/couldn’t be started/)
  })

  it('never echoes the full number back', () => {
    expect(callingMessage('+40712345678')).toContain('+40 7** *** 678')
  })
})

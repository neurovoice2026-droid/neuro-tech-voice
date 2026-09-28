import { beforeEach, describe, expect, it, vi } from 'vitest'

const twilio = vi.hoisted(() => ({ creates: [] as Record<string, unknown>[], updates: [] as Record<string, unknown>[] }))

vi.mock('@/lib/twilio/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/twilio/client')>()),
  getTwilioClient: () => {
    const calls = (sid?: string) => ({
      update: async (params: Record<string, unknown>) => {
        twilio.updates.push({ sid, ...params })
        return { sid }
      },
    })
    calls.create = async (params: Record<string, unknown>) => {
      twilio.creates.push(params)
      return { sid: 'CA00000000000000000000000000000001' }
    }
    return { calls }
  },
}))

import { DestinationNotAllowedError, TRANSFER_TIME_LIMIT_SECONDS, createOutboundCall, transferCall, transferTwiml } from './calls'

const CALL_SID = 'CA0123456789abcdef0123456789abcdef'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
  vi.stubEnv('CALL_DESTINATION_COUNTRY_CODES', '')
  twilio.creates = []
  twilio.updates = []
})

describe('platform-paid call legs (toll fraud)', () => {
  it('caps a bridged transfer instead of letting Twilio run it for 4 hours', () => {
    const xml = transferTwiml({ callId: 'c1', to: '+40712345678', callerId: '+40312345678' })
    expect(xml).toContain(`timeLimit="${TRANSFER_TIME_LIMIT_SECONDS}"`)
    expect(TRANSFER_TIME_LIMIT_SECONDS).toBeLessThanOrEqual(3600)
  })

  it('never places or bridges a call to a premium-rate or out-of-policy number', async () => {
    await expect(createOutboundCall({ to: '+19005550123', from: '+14155550123', callId: 'c1', voicemailDetection: false })).rejects.toBeInstanceOf(DestinationNotAllowedError)
    await expect(createOutboundCall({ to: '+37120000000', from: '+40312345678', callId: 'c1', voicemailDetection: false })).rejects.toThrow('country_not_allowed')
    await expect(transferCall({ callSid: CALL_SID, callId: 'c1', to: '+447011223344', callerId: '+447911123456' })).rejects.toThrow('premium_rate')
    expect(twilio.creates).toHaveLength(0)
    expect(twilio.updates).toHaveLength(0)

    await createOutboundCall({ to: '+40712345678', from: '+40312345678', callId: 'c1', voicemailDetection: false })
    await transferCall({ callSid: CALL_SID, callId: 'c1', to: '+40712345678', callerId: '+40312345678' })
    expect(twilio.creates).toHaveLength(1)
    expect(String(twilio.updates[0].twiml)).toContain('timeLimit="3600"')
  })

  it('follows the operator’s extra country list', async () => {
    vi.stubEnv('CALL_DESTINATION_COUNTRY_CODES', '371')
    await createOutboundCall({ to: '+37120000000', from: '+40312345678', callId: 'c1', voicemailDetection: false })
    expect(twilio.creates).toHaveLength(1)
  })
})

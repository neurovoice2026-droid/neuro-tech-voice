import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall } from '@/tests/helpers/fake-db'
import { createLogger } from '@/lib/observability/logger'
import { ProviderError } from '@/lib/voice-providers/errors'

// releaseNumberEverywhere: a number nobody pays for any more leaves every
// provider (ElevenLabs import, Cartesia import, then Twilio, which stops its
// cost) and its row is deleted, so the number can be bought again; a provider
// failure leaves the row inactive with its ids and throws, so the caller's
// retry finishes the job. Every provider is a mock.

const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const PN_SID = 'PN0123456789abcdef0123456789abcdef'

const providers = vi.hoisted(() => ({
  el: { configured: true, get: vi.fn(), delete: vi.fn() },
  ct: { configured: true, deleteNumber: vi.fn() },
  twilio: { configured: true, remove: vi.fn(), sids: [] as string[] },
}))
vi.mock('@/lib/elevenlabs/client', () => ({
  isConfigured: () => providers.el.configured,
  phoneNumbers: { get: (...a: unknown[]) => providers.el.get(...a), delete: (...a: unknown[]) => providers.el.delete(...a) },
}))
vi.mock('@/lib/cartesia/client', () => ({
  isConfigured: () => providers.ct.configured,
  telephony: { deleteNumber: (...a: unknown[]) => providers.ct.deleteNumber(...a) },
}))
vi.mock('@/lib/twilio/client', () => ({
  isTwilioConfigured: () => providers.twilio.configured,
  getTwilioClient: () => ({
    incomingPhoneNumbers: (sid: string) => {
      providers.twilio.sids.push(sid)
      return { remove: () => providers.twilio.remove(sid) }
    },
  }),
}))

import { releaseNumberEverywhere, type ReleasableNumber } from './release'

const log = createLogger({ component: 'test' })

function row(over: Partial<ReleasableNumber> = {}): ReleasableNumber {
  return {
    id: 'num-1',
    org_id: ORG,
    number: '+14155550100',
    is_active: true,
    twilio_sid: PN_SID,
    elevenlabs_phone_number_id: 'phnum_1',
    cartesia_phone_number_id: 'ct_num_1',
    ...over,
  }
}

const updates = (db: ReturnType<typeof fakeDb>) => db.calls.filter((c: FakeCall) => c.table === 'phone_numbers' && c.op === 'update')
const deletes = (db: ReturnType<typeof fakeDb>) => db.calls.filter((c: FakeCall) => c.table === 'phone_numbers' && c.op === 'delete')

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  providers.el.configured = true
  providers.ct.configured = true
  providers.twilio.configured = true
  providers.twilio.sids = []
  providers.el.get.mockReset().mockResolvedValue({ phone_number_id: 'phnum_1', label: `ntv:production:${ORG}` })
  providers.el.delete.mockReset().mockResolvedValue(undefined)
  providers.ct.deleteNumber.mockReset().mockResolvedValue(undefined)
  providers.twilio.remove.mockReset().mockResolvedValue(true)
})

describe('releaseNumberEverywhere', () => {
  it('deactivates the number, removes both imports, releases it on Twilio, then deletes the row', async () => {
    const db = fakeDb(() => ({ data: null, error: null }))
    await expect(releaseNumberEverywhere(db as never, row(), log)).resolves.toBeUndefined()
    expect(providers.el.delete).toHaveBeenCalledWith('phnum_1', { orgId: ORG })
    expect(providers.ct.deleteNumber).toHaveBeenCalledWith('ct_num_1')
    expect(providers.twilio.sids).toEqual([PN_SID])
    expect(db.calls.map((c) => c.op)).toEqual(['update', 'delete'])
    expect(updates(db)[0].payload).toEqual({ is_active: false })
    // No row keeps holding the number (phone_numbers.number is UNIQUE): it can be bought again.
    expect(deletes(db)[0].filters).toEqual([['eq', 'id', 'num-1'], ['eq', 'org_id', ORG]])
  })

  it('a row with no provider ids left (inactive) calls no provider and is deleted', async () => {
    const db = fakeDb(() => ({ data: null, error: null }))
    await releaseNumberEverywhere(db as never, row({ is_active: false, twilio_sid: null, elevenlabs_phone_number_id: null, cartesia_phone_number_id: null }), log)
    expect(db.calls.map((c) => c.op)).toEqual(['delete'])
    expect(providers.el.get).not.toHaveBeenCalled()
    expect(providers.twilio.remove).not.toHaveBeenCalled()
  })

  it('a resource the provider no longer has counts as removed', async () => {
    providers.el.get.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'phone_numbers.get', status: 404 }))
    providers.twilio.remove.mockRejectedValue(Object.assign(new Error('not found'), { status: 404, code: 20404 }))
    const db = fakeDb(() => ({ data: null, error: null }))
    await releaseNumberEverywhere(db as never, row(), log)
    expect(updates(db)).toHaveLength(1)
    expect(deletes(db)).toHaveLength(1)
  })

  it('a Twilio failure throws and keeps the ids, so a retry releases it; only the status is logged', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    providers.twilio.remove.mockRejectedValue(Object.assign(new Error('Accounts/AC0000/IncomingPhoneNumbers/PN… unavailable'), { status: 503 }))
    const db = fakeDb(() => ({ data: null, error: null }))
    await expect(releaseNumberEverywhere(db as never, row(), log)).rejects.toThrow('phone number release incomplete: twilio')
    // Deactivated, but kept with its ids.
    expect(updates(db).map((c) => c.payload)).toEqual([{ is_active: false }])
    expect(deletes(db)).toHaveLength(0)
    const line = errorLog.mock.calls.map((c) => String(c[0])).find((l) => l.includes('phone.release_twilio_failed'))
    expect(line).toBeDefined()
    expect(JSON.parse(line!)).toMatchObject({ status: 503 })
    expect(line).not.toContain('AC0000')

    // The retry (inactive row, ids still there) finishes the job.
    providers.twilio.remove.mockResolvedValue(true)
    const retry = fakeDb(() => ({ data: null, error: null }))
    await releaseNumberEverywhere(retry as never, row({ is_active: false }), log)
    expect(retry.calls.map((c) => c.op)).toEqual(['delete'])
  })

  it('a number still bought on Twilio while Twilio is not configured here is not marked released', async () => {
    providers.twilio.configured = false
    const db = fakeDb(() => ({ data: null, error: null }))
    await expect(releaseNumberEverywhere(db as never, row(), log)).rejects.toThrow('twilio')
    expect(updates(db)).toHaveLength(1)
    expect(deletes(db)).toHaveLength(0)
  })

  it('an import failure throws too; a missing ElevenLabs or Cartesia key does not block the release', async () => {
    providers.ct.deleteNumber.mockRejectedValue(new ProviderError({ system: 'cartesia', code: 'network', operation: 'numbers.delete', status: 503 }))
    await expect(releaseNumberEverywhere(fakeDb(() => ({ data: null, error: null })) as never, row(), log)).rejects.toThrow('cartesia')

    providers.ct.deleteNumber.mockResolvedValue(undefined)
    providers.el.configured = false
    providers.ct.configured = false
    const db = fakeDb(() => ({ data: null, error: null }))
    await releaseNumberEverywhere(db as never, row(), log)
    expect(deletes(db)).toHaveLength(1)
    expect(providers.twilio.sids).toEqual([PN_SID, PN_SID])
  })

  it('an ElevenLabs import labelled for another organization or environment is never deleted', async () => {
    providers.el.get.mockResolvedValue({ phone_number_id: 'phnum_1', label: 'ntv:preview:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })
    const db = fakeDb(() => ({ data: null, error: null }))
    await releaseNumberEverywhere(db as never, row(), log)
    expect(providers.el.delete).not.toHaveBeenCalled()
    expect(deletes(db)).toHaveLength(1)
  })

  it('a development placeholder sid was never bought: nothing to release on Twilio', async () => {
    const db = fakeDb(() => ({ data: null, error: null }))
    await releaseNumberEverywhere(db as never, row({ twilio_sid: 'mock_123', elevenlabs_phone_number_id: null, cartesia_phone_number_id: null }), log)
    expect(providers.twilio.remove).not.toHaveBeenCalled()
    expect(deletes(db)).toHaveLength(1)
  })

  it('a refused database write throws before or after the providers', async () => {
    const refuseFirst = fakeDb(() => ({ data: null, error: { message: 'connection reset' } }))
    await expect(releaseNumberEverywhere(refuseFirst as never, row(), log)).rejects.toThrow('phone_numbers deactivate failed')
    expect(providers.twilio.remove).not.toHaveBeenCalled()

    const refuseDelete = fakeDb((c) => (c.op === 'delete' ? { data: null, error: { message: 'connection reset' } } : { data: null, error: null }))
    await expect(releaseNumberEverywhere(refuseDelete as never, row(), log)).rejects.toThrow('phone_numbers delete failed')
  })
})

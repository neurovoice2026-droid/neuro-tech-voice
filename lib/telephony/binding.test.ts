// Native ElevenLabs import (slice C): idempotent like the Cartesia import —
// a stored id that is gone is re-imported, a duplicate import is adopted
// (only when unassigned or ours), a stale import of another agent is
// replaced, and another environment's import is never touched.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderError } from '@/lib/voice-providers/errors'
import { createLogger } from '@/lib/observability/logger'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { FAKE_TWILIO_ACCOUNT_SID } from '@/tests/helpers/fixtures'

const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const NUMBER = '+40312345678'

const phoneNumbers = vi.hoisted(() => ({ update: vi.fn(), importTwilio: vi.fn(), delete: vi.fn(), get: vi.fn() }))
vi.mock('@/lib/elevenlabs/client', () => ({ phoneNumbers }))
const findImportedNumber = vi.fn()
vi.mock('@/lib/elevenlabs/api/phone-numbers', () => ({ findImportedNumber: (...a: unknown[]) => findImportedNumber(...a) }))
vi.mock('@/lib/twilio/client', () => ({ isTwilioConfigured: () => true, getTwilioClient: () => ({}) }))
vi.mock('@/lib/cartesia/client', () => ({ isConfigured: () => false, telephony: {} }))
let db: MemoryDb
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

import { applyNumberRouting, bindElevenLabsNumber } from './binding'

const log = createLogger({ test: 'binding' })
const err = (code: 'not_found' | 'conflict' | 'validation' | 'upstream') => new ProviderError({ system: 'elevenlabs', code, operation: 'phone_numbers.x' })

beforeEach(() => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', FAKE_TWILIO_ACCOUNT_SID)
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'twilio-auth-token-for-tests')
  vi.stubEnv('VERCEL_ENV', 'production')
  for (const fn of Object.values(phoneNumbers)) fn.mockReset().mockResolvedValue({})
  phoneNumbers.importTwilio.mockResolvedValue({ phone_number_id: 'phnum_new' })
  findImportedNumber.mockReset().mockResolvedValue(null)
})

describe('bindElevenLabsNumber', () => {
  it('a stored import is re-assigned and its label refreshed (env + full org id)', async () => {
    const id = await bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: 'phnum_1' }, 'el_agent_1', log)
    expect(id).toBe('phnum_1')
    expect(phoneNumbers.update).toHaveBeenCalledWith('phnum_1', { agent_id: 'el_agent_1', label: `ntv:production:${ORG}` }, { orgId: ORG })
    expect(phoneNumbers.importTwilio).not.toHaveBeenCalled()
  })

  it('a stored import that returns 404 is imported again (no longer stuck failed)', async () => {
    phoneNumbers.update.mockRejectedValueOnce(err('not_found'))
    const id = await bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: 'phnum_gone' }, 'el_agent_1', log)
    expect(id).toBe('phnum_new')
    const body = phoneNumbers.importTwilio.mock.calls[0][0] as Record<string, unknown>
    expect(body).toMatchObject({ phone_number: NUMBER, label: `ntv:production:${ORG}`, agent_id: 'el_agent_1', sid: FAKE_TWILIO_ACCOUNT_SID })
  })

  it('other update failures are not mistaken for a missing import', async () => {
    phoneNumbers.update.mockRejectedValueOnce(err('upstream'))
    await expect(bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: 'phnum_1' }, 'el_agent_1', log)).rejects.toMatchObject({ code: 'upstream' })
    expect(phoneNumbers.importTwilio).not.toHaveBeenCalled()
  })

  it.each(['conflict', 'validation'] as const)('a duplicate import (%s) that is unassigned is adopted', async (code) => {
    phoneNumbers.importTwilio.mockRejectedValueOnce(err(code))
    findImportedNumber.mockResolvedValueOnce({ phone_number_id: 'phnum_old', phone_number: NUMBER, label: 'ntv aaaaaaaa', assigned_agent: null })
    const id = await bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: null }, 'el_agent_1', log)
    expect(id).toBe('phnum_old')
    expect(phoneNumbers.update).toHaveBeenCalledWith('phnum_old', { agent_id: 'el_agent_1', label: `ntv:production:${ORG}` }, { orgId: ORG })
    expect(phoneNumbers.delete).not.toHaveBeenCalled()
  })

  it('a duplicate import already assigned to our agent (lost response) is adopted', async () => {
    phoneNumbers.importTwilio.mockRejectedValueOnce(err('conflict'))
    findImportedNumber.mockResolvedValueOnce({ phone_number_id: 'phnum_ours', phone_number: NUMBER, label: `ntv:production:${ORG}`, assigned_agent: { agent_id: 'el_agent_1' } })
    expect(await bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: null }, 'el_agent_1', log)).toBe('phnum_ours')
  })

  it('a stale import assigned to another agent is deleted and the number imported for this org', async () => {
    phoneNumbers.importTwilio.mockRejectedValueOnce(err('conflict')).mockResolvedValueOnce({ phone_number_id: 'phnum_fresh' })
    findImportedNumber.mockResolvedValueOnce({ phone_number_id: 'phnum_stale', phone_number: NUMBER, label: 'ntv:production:bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee', assigned_agent: { agent_id: 'el_agent_old' } })
    expect(await bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: null }, 'el_agent_1', log)).toBe('phnum_fresh')
    expect(phoneNumbers.delete).toHaveBeenCalledWith('phnum_stale', { orgId: ORG })
    expect(phoneNumbers.update).not.toHaveBeenCalled()
  })

  it("never adopts or deletes another environment's import (shared workspace)", async () => {
    phoneNumbers.importTwilio.mockRejectedValueOnce(err('conflict'))
    findImportedNumber.mockResolvedValueOnce({ phone_number_id: 'phnum_staging', phone_number: NUMBER, label: `ntv:preview:${ORG}`, assigned_agent: null })
    await expect(bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: null }, 'el_agent_1', log)).rejects.toMatchObject({ code: 'conflict', operation: 'phone_numbers.adopt' })
    expect(phoneNumbers.update).not.toHaveBeenCalled()
    expect(phoneNumbers.delete).not.toHaveBeenCalled()
  })

  it('a real rejection (no existing import found) is rethrown as is', async () => {
    const e = err('validation')
    phoneNumbers.importTwilio.mockRejectedValueOnce(e)
    await expect(bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: null }, 'el_agent_1', log)).rejects.toBe(e)
  })

  it('non-duplicate failures never trigger a workspace lookup', async () => {
    phoneNumbers.importTwilio.mockRejectedValueOnce(err('upstream'))
    await expect(bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: null }, 'el_agent_1', log)).rejects.toMatchObject({ code: 'upstream' })
    expect(findImportedNumber).not.toHaveBeenCalled()
  })

  it('refuses to import without Twilio credentials', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', '')
    await expect(bindElevenLabsNumber({ number: NUMBER, orgId: ORG, storedId: null }, 'el_agent_1', log)).rejects.toThrow(/Twilio is not configured/)
    expect(phoneNumbers.importTwilio).not.toHaveBeenCalled()
  })
})

describe('applyNumberRouting (native)', () => {
  function seed(storedId: string | null) {
    db = memoryDb({
      phone_numbers: [{ id: 'num_1', org_id: ORG, agent_id: null, number: NUMBER, twilio_sid: 'PN0123', routing_mode: 'native_elevenlabs', elevenlabs_phone_number_id: storedId, cartesia_phone_number_id: null }],
      agents: [{ id: 'agent_1', org_id: ORG, created_at: '2026-01-01T00:00:00Z' }],
      agent_provider_resources: [{ agent_id: 'agent_1', provider: 'elevenlabs', external_id: 'el_agent_1' }],
    })
  }

  it('persists the re-imported id and reports ready', async () => {
    seed('phnum_gone')
    phoneNumbers.update.mockRejectedValueOnce(err('not_found'))
    const res = await applyNumberRouting('num_1', log)
    expect(res.status).toBe('ready')
    expect(db.tables.phone_numbers[0]).toMatchObject({ elevenlabs_phone_number_id: 'phnum_new', routing_status: 'ready', routing_error: null, agent_id: 'agent_1' })
  })

  it('reports the safe message when another environment holds the number', async () => {
    seed(null)
    phoneNumbers.importTwilio.mockRejectedValueOnce(err('conflict'))
    findImportedNumber.mockResolvedValueOnce({ phone_number_id: 'phnum_x', phone_number: NUMBER, label: `ntv:development:${ORG}`, assigned_agent: null })
    const res = await applyNumberRouting('num_1', log)
    expect(res.status).toBe('failed')
    expect(db.tables.phone_numbers[0].routing_error).toMatch(/another environment/)
    expect(db.tables.phone_numbers[0].elevenlabs_phone_number_id).toBeNull()
  })
})

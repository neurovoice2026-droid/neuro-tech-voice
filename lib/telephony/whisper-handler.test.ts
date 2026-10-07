// The whisper document served to the human before a transfer is bridged:
// the call comes from the signed token only, the language from the call's own
// agent, and nothing ever fails the transfer.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { createLogger } from '@/lib/observability/logger'
import { findAll, findOne, parseXml } from '@/tests/helpers/xml'

let db: MemoryDb | { from: () => never }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

import { handleWhisper } from './whisper-handler'

const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const log = createLogger({ test: 'whisper' })

beforeEach(() => {
  db = memoryDb({
    calls: [{ id: 'c1', org_id: ORG, agent_id: 'agent_1', routing: { transfer: { via: 'tool', reason: 'Wants to move the appointment, call 0712 345 678' } } }],
    agents: [{ id: 'agent_1', org_id: ORG, language: 'ro' }],
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('handleWhisper', () => {
  it("speaks the sanitized reason in the agent's language, without hanging up", async () => {
    const doc = parseXml(await handleWhisper('c1', log))
    const say = findOne(doc, 'Say')
    expect(say.attrs.language).toBe('ro-RO')
    expect(say.text).toBe('Aveți un apel transferat de asistentul virtual. Motivul: Wants to move the appointment, call.')
    expect(say.text).not.toMatch(/\d/)
    expect(findAll(doc, 'Hangup')).toHaveLength(0)
  })

  it('without a stored reason (race with the redirect): the announcement only', async () => {
    ;(db as MemoryDb).tables.calls[0].routing = {}
    expect(findOne(parseXml(await handleWhisper('c1', log)), 'Say').text).toBe('Aveți un apel transferat de asistentul virtual.')
  })

  it('an unknown call or a database error gives an empty document (the caller is still bridged)', async () => {
    expect(parseXml(await handleWhisper('missing', log)).children).toHaveLength(0)
    db = { from: () => { throw new Error('db down') } }
    expect(parseXml(await handleWhisper('c1', log)).children).toHaveLength(0)
  })
})

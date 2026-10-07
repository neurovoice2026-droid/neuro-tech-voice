import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const lifecycle = vi.hoisted(() => ({ checkLibraryVoices: vi.fn() }))
vi.mock('./library-lifecycle', () => lifecycle)

import { processVoiceNotice, readVoiceNotice, recordVoiceNotice, voiceNoticeDedupeKey } from './voice-notice'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ test: true })

beforeEach(() => {
  state.db = memoryDb({ webhook_events: [] }, { unique: { webhook_events: [['provider', 'dedupe_key']] } })
  lifecycle.checkLibraryVoices.mockReset()
})

describe('readVoiceNotice', () => {
  it('reads voice ids defensively from known keys and validates them', () => {
    const n = readVoiceNotice({
      type: 'voice_removal_notice',
      event_timestamp: 1_790_000_000,
      data: { voice_id: 'VoiceAAAA0000000001', voice: { original_voice_id: 'VoiceBBBB0000000001' }, voice_ids: ['VoiceCCCC0000000001', 'not valid!', 42] },
    })
    expect(n.type).toBe('voice_removal_notice')
    expect(n.voiceIds.sort()).toEqual(['VoiceAAAA0000000001', 'VoiceBBBB0000000001', 'VoiceCCCC0000000001'])
    expect(readVoiceNotice('garbage')).toEqual({ type: '', eventTimestamp: null, voiceIds: [] })
    expect(voiceNoticeDedupeKey({ type: 'voice_removed', eventTimestamp: 5, voiceIds: ['B0000000', 'A0000000'] })).toBe('voice_removed:A0000000,B0000000:5')
  })
})

describe('record and process', () => {
  it('dedupes retries, stores only type/ids/timestamp, then triggers the lifecycle check and closes the receipt', async () => {
    const n = { type: 'voice_removed', eventTimestamp: 7, voiceIds: ['VoiceAAAA0000000001'] }
    const first = await recordVoiceNotice(n)
    const again = await recordVoiceNotice(n)
    expect(first.isNew).toBe(true)
    expect(again).toEqual({ id: first.id, isNew: false })
    expect(state.db.tables.webhook_events[0]).toMatchObject({ provider: 'elevenlabs', event_type: 'voice_removed', payload: { type: 'voice_removed', voice_ids: ['VoiceAAAA0000000001'], event_timestamp: 7 } })

    lifecycle.checkLibraryVoices.mockResolvedValue({ checked: 1, removed: 1, notices: {} })
    await processVoiceNotice(first.id, n, log)
    expect(lifecycle.checkLibraryVoices).toHaveBeenCalledWith(expect.objectContaining({ voiceIds: ['VoiceAAAA0000000001'] }))
    expect(state.db.tables.webhook_events[0]).toMatchObject({ status: 'processed', payload: null })
  })

  it('a notice about voices we do not hold is ignored; a failing check is recorded, never thrown', async () => {
    const n = { type: 'voice_removal_notice', eventTimestamp: 8, voiceIds: ['VoiceZZZZ0000000001'] }
    const { id } = await recordVoiceNotice(n)
    lifecycle.checkLibraryVoices.mockResolvedValueOnce({ checked: 0, removed: 0, notices: {} })
    await processVoiceNotice(id, n, log)
    expect(state.db.tables.webhook_events[0]).toMatchObject({ status: 'ignored' })
    lifecycle.checkLibraryVoices.mockRejectedValueOnce(new Error('db down'))
    await expect(processVoiceNotice(id, n, log)).resolves.toBeUndefined()
    expect(state.db.tables.webhook_events[0]).toMatchObject({ status: 'ignored', last_error: 'db down' })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const hist = vi.hoisted(() => ({ listHistory: vi.fn(), deleteHistoryItem: vi.fn() }))
vi.mock('@/lib/elevenlabs/api/history', () => hist)

import { ProviderError } from './errors'
import { historyRetentionDays, purgeOldTtsHistory, purgeVoiceHistory } from './tts-history'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ test: true })
const item = (id: string, extra: Record<string, unknown> = {}) => ({ history_item_id: id, voice_id: 'Voice0000000000001', voice_category: 'cloned', date_unix: 1_000, source: 'TTS', state: 'created', text: 'Bună ziua Ana', ...extra })

beforeEach(() => {
  hist.listHistory.mockReset()
  hist.deleteHistoryItem.mockReset().mockResolvedValue({ status: 'ok' })
})

describe('purgeVoiceHistory', () => {
  it('deletes only the TTS items of that voice; a 404 counts as done; never throws', async () => {
    hist.listHistory
      .mockResolvedValueOnce({ history: [item('h1'), item('h2', { voice_id: 'Other' }), item('h3')], has_more: true, last_history_item_id: 'h3' })
      .mockResolvedValueOnce({ history: [], has_more: false })
    hist.deleteHistoryItem.mockResolvedValueOnce({ status: 'ok' }).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'history.delete', code: 'not_found', status: 404 }))
    expect(await purgeVoiceHistory('Voice0000000000001', log)).toEqual({ deleted: 2, failed: 0 })
    expect(hist.listHistory).toHaveBeenCalledWith(expect.objectContaining({ voice_id: 'Voice0000000000001', source: 'TTS' }))
    expect(hist.deleteHistoryItem.mock.calls.map((c) => c[0])).toEqual(['h1', 'h3'])

    hist.listHistory.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'history.list', code: 'auth', status: 401 }))
    expect(await purgeVoiceHistory('Voice0000000000001', log)).toEqual({ deleted: 0, failed: 1 })
  })
})

describe('purgeOldTtsHistory', () => {
  it('dry run counts items older than N days by voice category (no text), apply deletes up to the limit', async () => {
    const now = 100 * 86_400_000
    hist.listHistory.mockResolvedValue({ history: [item('h1'), item('h2', { voice_category: 'premade' }), item('h3', { date_unix: 99 * 86_400 + 1 })], has_more: false })
    const dry = await purgeOldTtsHistory({ olderThanDays: 7, apply: false, limit: 100, log, now })
    expect(hist.listHistory).toHaveBeenCalledWith(expect.objectContaining({ source: 'TTS', date_before_unix: 93 * 86_400 }))
    expect(dry).toMatchObject({ apply: false, matched: 2, deleted: 0, by_voice_category: { cloned: 1, premade: 1 } })
    expect(JSON.stringify(dry)).not.toContain('Bună')
    expect(hist.deleteHistoryItem).not.toHaveBeenCalled()

    const applied = await purgeOldTtsHistory({ olderThanDays: 7, apply: true, limit: 1, log, now })
    expect(applied).toMatchObject({ matched: 1, deleted: 1, truncated: true })
  })

  it('maintenance retention is opt-in (1–365 days)', () => {
    expect(historyRetentionDays()).toBeNull()
    vi.stubEnv('ELEVENLABS_TTS_HISTORY_RETENTION_DAYS', '14')
    expect(historyRetentionDays()).toBe(14)
    vi.stubEnv('ELEVENLABS_TTS_HISTORY_RETENTION_DAYS', '0')
    expect(historyRetentionDays()).toBeNull()
  })
})

import 'server-only'
// Speech-history hygiene for the SHARED ElevenLabs workspace. Voice previews
// (tenant-entered text, rendered in the tenant's own clone voice) used to be
// stored in the workspace history (enable_logging defaulted to true). Previews
// now ask for zero retention; these helpers remove what is still there:
//   • purgeVoiceHistory: every TTS item of one voice (clone/designed voice
//     deleted, organization purged);
//   • purgeOldTtsHistory: TTS items older than N days (admin route, dry run by
//     default; optional daily maintenance via ELEVENLABS_TTS_HISTORY_RETENTION_DAYS).
// Item texts are never read into logs or responses.

import { deleteHistoryItem, listHistory, type ELHistoryItem } from '@/lib/elevenlabs/api/history'
import type { Logger } from '@/lib/observability/logger'
import { isProviderError } from './errors'

const PAGE_SIZE = 100

async function deleteItems(items: ELHistoryItem[], log: Logger): Promise<{ deleted: number; failed: number }> {
  let deleted = 0
  let failed = 0
  for (const item of items) {
    try {
      await deleteHistoryItem(item.history_item_id)
      deleted++
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found') {
        deleted++
        continue
      }
      failed++
      log.error('tts_history.delete_failed', err, { historyItemId: item.history_item_id })
    }
  }
  return { deleted, failed }
}

/**
 * Deletes the TTS history items generated with `voiceId` (at most maxItems per
 * call). Never throws: returns counts, logs failures.
 */
export async function purgeVoiceHistory(voiceId: string, log: Logger, maxItems = 300): Promise<{ deleted: number; failed: number }> {
  const out = { deleted: 0, failed: 0 }
  try {
    let cursor: string | null = null
    while (out.deleted + out.failed < maxItems) {
      const page: Awaited<ReturnType<typeof listHistory>> = await listHistory({
        voice_id: voiceId,
        source: 'TTS',
        page_size: PAGE_SIZE,
        start_after_history_item_id: cursor,
      })
      // The listing is filtered by voice_id already; never delete another voice's item.
      const items = (page.history ?? []).filter((i) => i.voice_id === voiceId && i.state !== 'deleted')
      const res = await deleteItems(items.slice(0, maxItems - out.deleted - out.failed), log)
      out.deleted += res.deleted
      out.failed += res.failed
      // Deleted items leave the listing, so the cursor only advances past failures.
      if (!page.has_more || !page.last_history_item_id || items.length === 0) break
      cursor = res.failed > 0 ? page.last_history_item_id : null
    }
  } catch (err) {
    out.failed++
    log.error('tts_history.voice_purge_failed', err, { voiceId })
  }
  if (out.deleted || out.failed) log.info('tts_history.voice_purged', { voiceId, ...out })
  return out
}

export interface HistoryPurgeReport {
  apply: boolean
  older_than_days: number
  matched: number
  deleted: number
  failed: number
  /** Counts only (no text, no voice names). */
  by_voice_category: Record<string, number>
  truncated: boolean
}

/**
 * TTS items older than `olderThanDays`. Dry run by default: counts what would
 * be deleted. With apply, deletes at most `limit` items per call.
 */
export async function purgeOldTtsHistory(params: { olderThanDays: number; apply: boolean; limit: number; log: Logger; now?: number }): Promise<HistoryPurgeReport> {
  const { apply, limit, log } = params
  const before = Math.floor(((params.now ?? Date.now()) - params.olderThanDays * 86_400_000) / 1000)
  const report: HistoryPurgeReport = { apply, older_than_days: params.olderThanDays, matched: 0, deleted: 0, failed: 0, by_voice_category: {}, truncated: false }
  let cursor: string | null = null
  for (let page = 0; page < 50; page++) {
    const res: Awaited<ReturnType<typeof listHistory>> = await listHistory({
      source: 'TTS',
      date_before_unix: before,
      page_size: PAGE_SIZE,
      start_after_history_item_id: cursor,
    })
    const items = (res.history ?? []).filter((i) => typeof i.date_unix === 'number' && i.date_unix < before && i.state !== 'deleted')
    const room = limit - report.matched
    const batch = items.slice(0, Math.max(0, room))
    report.matched += batch.length
    for (const i of batch) {
      const k = i.voice_category ?? 'unknown'
      report.by_voice_category[k] = (report.by_voice_category[k] ?? 0) + 1
    }
    let failedHere = 0
    if (apply && batch.length) {
      const r = await deleteItems(batch, log)
      report.deleted += r.deleted
      report.failed += r.failed
      failedHere = r.failed
    }
    if (report.matched >= limit) {
      report.truncated = res.has_more || items.length > batch.length
      break
    }
    if (!res.has_more || !res.last_history_item_id) break
    // Deleted items leave the listing: after a clean delete, read from the start again.
    cursor = apply && failedHere === 0 ? null : res.last_history_item_id
  }
  log.info('tts_history.retention', { ...report, by_voice_category: undefined })
  return report
}

/** ELEVENLABS_TTS_HISTORY_RETENTION_DAYS (1–365): daily maintenance purge; unset = off. */
export function historyRetentionDays(): number | null {
  const raw = (process.env.ELEVENLABS_TTS_HISTORY_RETENTION_DAYS ?? '').trim()
  if (!raw) return null
  const v = Number(raw)
  return Number.isInteger(v) && v >= 1 && v <= 365 ? v : null
}

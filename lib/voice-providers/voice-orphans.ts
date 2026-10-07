import 'server-only'
// Custom voices (instant clones, designed voices) in the SHARED workspace that
// no registry row owns any more: an organization deleted by hand (the
// registry rows cascade away), a failed compensating delete, a lost DB write.
// They are voice biometrics kept after the customer left, and they use slots.
//
// • scanOrphanVoices: lists the workspace's cloned and generated voices
//   (GET /v2/voices?voice_type=non-community, one category per call), keeps
//   the ones this platform created (provider name tagged "[xxxxxxxx]" with the
//   org id prefix, or our description), older than 24 h and without ANY
//   provider_voices row (any status, any owner), and deletes them only with
//   apply=true (admin route, or maintenance with ELEVENLABS_VOICE_ORPHAN_DELETE=true).
//   Library (community) copies are never touched.
// • drainVoicePurgeQueue: the purge queue filled by the organizations BEFORE
//   DELETE trigger (migration 015): voices are deleted (and their speech
//   history purged), pronunciation dictionaries emptied and archived.

import { listWorkspaceVoices, type ELVoiceDetail } from '@/lib/elevenlabs/api/voices'
import * as el from '@/lib/elevenlabs/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { isProviderError } from './errors'
import { retireDictionary } from './pronunciation'
import { historyRetentionDays, purgeOldTtsHistory, purgeVoiceHistory } from './tts-history'
import { EL_VOICE_ID_RE, writeAudit } from './voice-catalog'
import { pruneDesignPreviews } from './voice-design'
import { inDailyWindow, inHourlyWindow } from './voice-schedule'

const OUR_NAME_TAG = /\[([0-9a-f]{8})\]\s*$/
const OUR_DESCRIPTION = /^(Instant clone|Designed voice) for org ([0-9a-f]{8})-[0-9a-f-]{27}$/

/** The org-id prefix of a custom voice this platform created, or null when it is not ours. */
export function platformOrgTag(v: Pick<ELVoiceDetail, 'name' | 'description'>): string | null {
  const desc = typeof v.description === 'string' ? OUR_DESCRIPTION.exec(v.description.trim()) : null
  if (desc) return desc[2]
  const name = typeof v.name === 'string' ? OUR_NAME_TAG.exec(v.name) : null
  return name ? name[1] : null
}

export interface OrphanVoice {
  voice_id: string
  category: string
  /** First 8 characters of the organization id (no names: they can be personal). */
  org_tag: string
  age_hours: number | null
  deleted: boolean
  error?: string
}

export interface OrphanReport {
  apply: boolean
  scanned: number
  ours: number
  orphans: OrphanVoice[]
  truncated: boolean
}

export function orphanDeleteEnabled(): boolean {
  return process.env.ELEVENLABS_VOICE_ORPHAN_DELETE === 'true'
}

export async function scanOrphanVoices(params: { apply: boolean; log: Logger; minAgeHours?: number; maxPages?: number; now?: number }): Promise<OrphanReport> {
  const { apply, log } = params
  const now = params.now ?? Date.now()
  const minAgeMs = (params.minAgeHours ?? 24) * 3600_000
  const report: OrphanReport = { apply, scanned: 0, ours: 0, orphans: [], truncated: false }
  if (!el.isConfigured()) return report
  const candidates: Array<{ v: ELVoiceDetail; tag: string }> = []
  for (const category of ['cloned', 'generated'] as const) {
    let token: string | null = null
    for (let page = 0; page < (params.maxPages ?? 20); page++) {
      const res: Awaited<ReturnType<typeof listWorkspaceVoices>> = await listWorkspaceVoices({ voice_type: 'non-community', category, next_page_token: token })
      for (const v of res.voices ?? []) {
        report.scanned++
        if (!EL_VOICE_ID_RE.test(v.voice_id) || v.category !== category) continue
        const tag = platformOrgTag(v)
        if (!tag) continue
        report.ours++
        const created = typeof v.created_at_unix === 'number' ? v.created_at_unix * 1000 : null
        // Unknown age: never treated as old enough (a create may still be registering).
        if (created === null || now - created < minAgeMs) continue
        candidates.push({ v, tag })
      }
      if (!res.has_more || !res.next_page_token) break
      token = res.next_page_token
      if (page === (params.maxPages ?? 20) - 1) report.truncated = true
    }
  }
  if (!candidates.length) return report

  const db = createAdminClient()
  const registered = new Set<string>()
  const ids = candidates.map((c) => c.v.voice_id)
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { data, error } = await db.from('provider_voices').select('voice_id').eq('provider', 'elevenlabs').in('voice_id', chunk)
    if (error) throw new Error(`provider_voices read failed: ${error.message}`)
    for (const r of data ?? []) registered.add(r.voice_id as string)
    // Also queued for purge = known, handled by the queue.
    const { data: queued, error: qErr } = await db.from('provider_voice_purge').select('resource_id').eq('kind', 'voice').in('resource_id', chunk)
    if (qErr) throw new Error(`provider_voice_purge read failed: ${qErr.message}`)
    for (const r of queued ?? []) registered.add(r.resource_id as string)
  }

  for (const { v, tag } of candidates) {
    if (registered.has(v.voice_id)) continue
    const created = typeof v.created_at_unix === 'number' ? v.created_at_unix * 1000 : null
    const orphan: OrphanVoice = { voice_id: v.voice_id, category: v.category, org_tag: tag, age_hours: created ? Math.floor((now - created) / 3600_000) : null, deleted: false }
    if (apply) {
      try {
        await el.voices.delete(v.voice_id)
        orphan.deleted = true
      } catch (err) {
        if (isProviderError(err) && err.code === 'not_found') orphan.deleted = true
        else {
          orphan.error = isProviderError(err) ? err.code : 'failed'
          log.error('voice_orphans.delete_failed', err, { voiceId: v.voice_id })
        }
      }
      if (orphan.deleted) {
        await purgeVoiceHistory(v.voice_id, log)
        await writeAudit(
          db,
          { orgId: null, userId: null, actorKind: 'system', action: 'voice.orphan.deleted', targetId: v.voice_id, details: { category: v.category, org_tag: tag } },
          log,
        )
      }
    }
    report.orphans.push(orphan)
  }
  if (report.orphans.length) {
    log.warn('voice_orphans.found', { count: report.orphans.length, deleted: report.orphans.filter((o) => o.deleted).length, apply })
  }
  return report
}

// ─── Purge queue (organizations deleted by hand) ─────────────────────────────

export interface PurgeQueueReport {
  processed: number
  done: number
  failed: number
}

const MAX_PURGE_ATTEMPTS = 10

export async function drainVoicePurgeQueue(params: { limit: number; log: Logger; now?: number }): Promise<PurgeQueueReport> {
  const { log } = params
  const report: PurgeQueueReport = { processed: 0, done: 0, failed: 0 }
  if (!el.isConfigured()) return report
  const db = createAdminClient()
  const nowIso = new Date(params.now ?? Date.now()).toISOString()
  const { data, error } = await db
    .from('provider_voice_purge')
    .select('id, kind, resource_id, attempts, org_id')
    .is('done_at', null)
    .lte('next_attempt_at', nowIso)
    .lt('attempts', MAX_PURGE_ATTEMPTS)
    .order('next_attempt_at', { ascending: true })
    .limit(params.limit)
  if (error) throw new Error(`provider_voice_purge scan failed: ${error.message}`)
  for (const row of data ?? []) {
    report.processed++
    const id = row.resource_id as string
    try {
      if (row.kind === 'voice') {
        if (EL_VOICE_ID_RE.test(id)) {
          try {
            await el.voices.delete(id)
          } catch (err) {
            if (!(isProviderError(err) && err.code === 'not_found')) throw err
          }
          const history = await purgeVoiceHistory(id, log)
          if (history.failed) throw new Error('speech history purge incomplete')
        }
      } else if (row.kind === 'pronunciation_dictionary') {
        await retireDictionary(id)
      }
      const { error: doneErr } = await db
        .from('provider_voice_purge')
        .update({ done_at: new Date().toISOString(), last_error: null, attempts: (row.attempts as number) + 1 })
        .eq('id', row.id)
      if (doneErr) throw new Error(`provider_voice_purge update failed: ${doneErr.message}`)
      report.done++
    } catch (err) {
      report.failed++
      const attempts = (row.attempts as number) + 1
      log.error('voice_purge.failed', err, { kind: row.kind, resourceId: id, attempts })
      const { error: failErr } = await db
        .from('provider_voice_purge')
        .update({
          attempts,
          last_error: (isProviderError(err) ? `${err.code}` : err instanceof Error ? err.message : 'failed').slice(0, 200),
          next_attempt_at: new Date(Date.now() + Math.min(24 * 3600_000, 15 * 60_000 * 2 ** attempts)).toISOString(),
        })
        .eq('id', row.id)
      if (failErr) log.error('voice_purge.mark_failed', failErr, { resourceId: id })
    }
  }
  return report
}

// ─── Maintenance steps (registered in maintenance.ts) ────────────────────────

/** UTC hours of the daily runs (the cron fires every 5 minutes). */
const ORPHAN_SCAN_HOUR_UTC = 4
const HISTORY_RETENTION_HOUR_UTC = 5

/**
 * `voice_orphans`: the purge queue on every run (an empty queue is one query),
 * the orphan scan once a day (report only unless ELEVENLABS_VOICE_ORPHAN_DELETE=true).
 */
export async function runVoiceOrphanMaintenance(log: Logger, now: Date = new Date()) {
  const purge = await drainVoicePurgeQueue({ limit: 25, log, now: now.getTime() })
  if (!inDailyWindow(ORPHAN_SCAN_HOUR_UTC, now)) return { purge, orphans: 'not_scheduled' as const }
  const orphans = await scanOrphanVoices({ apply: orphanDeleteEnabled(), log, maxPages: 10, now: now.getTime() })
  return { purge, orphans: { apply: orphans.apply, scanned: orphans.scanned, ours: orphans.ours, orphans: orphans.orphans.length, deleted: orphans.orphans.filter((o) => o.deleted).length } }
}

/**
 * `voice_housekeeping`: expired Voice Design previews once an hour; the TTS
 * history retention once a day, when ELEVENLABS_TTS_HISTORY_RETENTION_DAYS is set.
 */
export async function runVoiceHousekeeping(log: Logger, now: Date = new Date()) {
  const out: Record<string, unknown> = {}
  if (!inHourlyWindow(now)) return { skipped: 'not_scheduled' as const }
  out.design_previews = await pruneDesignPreviews(log)
  const days = historyRetentionDays()
  if (days !== null && el.isConfigured() && inDailyWindow(HISTORY_RETENTION_HOUR_UTC, now)) {
    const r = await purgeOldTtsHistory({ olderThanDays: days, apply: true, limit: 500, log })
    out.tts_history = { matched: r.matched, deleted: r.deleted, failed: r.failed, truncated: r.truncated }
  }
  return out
}

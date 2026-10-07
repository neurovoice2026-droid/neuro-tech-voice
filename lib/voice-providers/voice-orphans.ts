import 'server-only'
// Custom voices (instant clones, designed voices) in the SHARED workspace that
// no registry row owns any more: an organization deleted by hand (the
// registry rows cascade away), a failed compensating delete, a lost DB write.
// They are voice biometrics kept after the customer left, and they use slots.
//
// • scanOrphanVoices: lists the workspace's cloned and generated voices
//   (GET /v2/voices?voice_type=non-community, one category per call), keeps
//   the ones this platform created (provider description "… for org <uuid>
//   [ntv-env:<env>]", or the legacy "[xxxxxxxx]" org-id name tag), older than
//   24 h and without ANY provider_voices row (any status, any owner) or purge
//   queue entry. The workspace can be shared by several deployments, so:
//     - a voice marked for ANOTHER environment is not ours: never listed;
//     - a voice without an environment marker (created before the marker
//       existed) is report-only, never deleted;
//     - a voice of THIS environment is deleted (apply=true: admin route, or
//       maintenance with ELEVENLABS_VOICE_ORPHAN_DELETE=true) only when its
//       organization is known to be gone: no organizations row AND an
//       account_deletions record or provider_voice_purge history for it.
//       Otherwise it is report-only.
//   Library (community) copies are never touched.
// • drainVoicePurgeQueue: the purge queue filled by the organizations BEFORE
//   DELETE trigger (migration 015): voices are deleted (and their speech
//   history purged), pronunciation dictionaries emptied and archived.

import type { SupabaseClient } from '@supabase/supabase-js'
import { listWorkspaceVoices, type ELVoiceDetail } from '@/lib/elevenlabs/api/voices'
import * as el from '@/lib/elevenlabs/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { isProviderError } from './errors'
import { retireDictionary } from './pronunciation'
import { historyRetentionDays, purgeOldTtsHistory, purgeVoiceHistory } from './tts-history'
import { EL_VOICE_ID_RE, platformEnvMarker, writeAudit } from './voice-catalog'
import { pruneDesignPreviews } from './voice-design'
import { runIfDue } from './maintenance-state'
import { DAILY_MS, HOUR_MS, VOICE_STEP_KEYS } from './voice-schedule'

const OUR_NAME_TAG = /\[([0-9a-f]{8})\]\s*$/
// platformVoiceDescription (voice-catalog.ts); the marker is absent on voices created before it existed.
const OUR_DESCRIPTION = /^(Instant clone|Designed voice) for org ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?: \[ntv-env:([^\]\s]{1,40})\])?$/

export interface PlatformVoiceMarker {
  /** First 8 characters of the organization id. */
  orgTag: string
  /** Full organization id (from the description; the legacy name tag only carries 8 characters). */
  orgId: string | null
  /** Environment of the deployment that created the voice (`ntv-env:` value), null when unmarked. */
  env: string | null
}

/** What this platform wrote on a custom voice it created, or null when the voice is not ours. */
export function platformVoiceMarker(v: Pick<ELVoiceDetail, 'name' | 'description'>): PlatformVoiceMarker | null {
  const desc = typeof v.description === 'string' ? OUR_DESCRIPTION.exec(v.description.trim()) : null
  if (desc) return { orgTag: desc[2].slice(0, 8), orgId: desc[2], env: desc[3] ?? null }
  const name = typeof v.name === 'string' ? OUR_NAME_TAG.exec(v.name) : null
  return name ? { orgTag: name[1], orgId: null, env: null } : null
}

/** The org-id prefix of a custom voice this platform created, or null when it is not ours. */
export function platformOrgTag(v: Pick<ELVoiceDetail, 'name' | 'description'>): string | null {
  return platformVoiceMarker(v)?.orgTag ?? null
}

/** This deployment's environment, as written in the voices it creates. */
function thisEnv(): string {
  return platformEnvMarker().slice('ntv-env:'.length)
}

/** Why an orphan is only reported, never deleted. */
export type OrphanHold = 'no_env_marker' | 'org_exists' | 'org_not_known_gone'

export interface OrphanVoice {
  voice_id: string
  category: string
  /** First 8 characters of the organization id (no names: they can be personal). */
  org_tag: string
  age_hours: number | null
  /** Eligible for deletion (this environment's marker and the organization is known to be gone). */
  deletable: boolean
  /** Why it is report-only (absent when deletable). */
  hold?: OrphanHold
  deleted: boolean
  error?: string
}

export interface OrphanReport {
  apply: boolean
  scanned: number
  /** Our voices of this environment, plus unmarked legacy ones. */
  ours: number
  /** Voices marked for another deployment sharing the workspace (never listed, never touched). */
  other_env: number
  orphans: OrphanVoice[]
  truncated: boolean
}

/**
 * Organizations known to be gone: no organizations row AND an account
 * deletion record or a voice purge history. Anything else (still there,
 * never seen) keeps its voices.
 */
async function knownGoneOrgs(db: SupabaseClient, orgIds: string[], log: Logger): Promise<{ gone: Set<string>; existing: Set<string> }> {
  const gone = new Set<string>()
  const existing = new Set<string>()
  for (let i = 0; i < orgIds.length; i += 100) {
    const chunk = orgIds.slice(i, i + 100)
    const { data: orgs, error: orgErr } = await db.from('organizations').select('id').in('id', chunk)
    if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
    for (const r of orgs ?? []) existing.add(String(r.id))
    const missing = chunk.filter((id) => !existing.has(id))
    if (!missing.length) continue
    const evidence = new Set<string>()
    const { data: deletions, error: delErr } = await db.from('account_deletions').select('org_id').in('org_id', missing)
    // Migration 021 missing: no deletion evidence from that table (never a reason to delete).
    if (delErr) log.warn('voice_orphans.account_deletions_unreadable', { error: delErr.message.slice(0, 200) })
    for (const r of deletions ?? []) evidence.add(String(r.org_id))
    const { data: purged, error: purgeErr } = await db.from('provider_voice_purge').select('org_id').in('org_id', missing)
    if (purgeErr) throw new Error(`provider_voice_purge read failed: ${purgeErr.message}`)
    for (const r of purged ?? []) evidence.add(String(r.org_id))
    for (const id of missing) if (evidence.has(id)) gone.add(id)
  }
  return { gone, existing }
}

export function orphanDeleteEnabled(): boolean {
  return process.env.ELEVENLABS_VOICE_ORPHAN_DELETE === 'true'
}

export async function scanOrphanVoices(params: { apply: boolean; log: Logger; minAgeHours?: number; maxPages?: number; now?: number }): Promise<OrphanReport> {
  const { apply, log } = params
  const now = params.now ?? Date.now()
  const minAgeMs = (params.minAgeHours ?? 24) * 3600_000
  const report: OrphanReport = { apply, scanned: 0, ours: 0, other_env: 0, orphans: [], truncated: false }
  if (!el.isConfigured()) return report
  const env = thisEnv()
  const candidates: Array<{ v: ELVoiceDetail; marker: PlatformVoiceMarker }> = []
  for (const category of ['cloned', 'generated'] as const) {
    let token: string | null = null
    for (let page = 0; page < (params.maxPages ?? 20); page++) {
      const res: Awaited<ReturnType<typeof listWorkspaceVoices>> = await listWorkspaceVoices({ voice_type: 'non-community', category, next_page_token: token })
      for (const v of res.voices ?? []) {
        report.scanned++
        if (!EL_VOICE_ID_RE.test(v.voice_id) || v.category !== category) continue
        const marker = platformVoiceMarker(v)
        if (!marker) continue
        // Another deployment sharing the workspace: its registry is not ours to judge.
        if (marker.env !== null && marker.env !== env) {
          report.other_env++
          continue
        }
        report.ours++
        const created = typeof v.created_at_unix === 'number' ? v.created_at_unix * 1000 : null
        // Unknown age: never treated as old enough (a create may still be registering).
        if (created === null || now - created < minAgeMs) continue
        candidates.push({ v, marker })
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
  const unregistered = candidates.filter((c) => !registered.has(c.v.voice_id))
  if (!unregistered.length) return report

  // Deletion needs this environment's marker (full org id) and an organization known to be gone.
  const markedOrgIds = [...new Set(unregistered.filter((c) => c.marker.env === env && c.marker.orgId).map((c) => c.marker.orgId as string))]
  const orgs = markedOrgIds.length ? await knownGoneOrgs(db, markedOrgIds, log) : { gone: new Set<string>(), existing: new Set<string>() }

  for (const { v, marker } of unregistered) {
    const created = typeof v.created_at_unix === 'number' ? v.created_at_unix * 1000 : null
    let hold: OrphanHold | undefined
    if (marker.env === null || !marker.orgId) hold = 'no_env_marker'
    else if (orgs.existing.has(marker.orgId)) hold = 'org_exists'
    else if (!orgs.gone.has(marker.orgId)) hold = 'org_not_known_gone'
    const orphan: OrphanVoice = {
      voice_id: v.voice_id,
      category: v.category,
      org_tag: marker.orgTag,
      age_hours: created ? Math.floor((now - created) / 3600_000) : null,
      deletable: !hold,
      ...(hold ? { hold } : {}),
      deleted: false,
    }
    if (apply && !hold) {
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
          { orgId: null, userId: null, actorKind: 'system', action: 'voice.orphan.deleted', targetId: v.voice_id, details: { category: v.category, org_tag: marker.orgTag, env } },
          log,
        )
      }
    }
    report.orphans.push(orphan)
  }
  if (report.orphans.length) {
    log.warn('voice_orphans.found', {
      count: report.orphans.length,
      deletable: report.orphans.filter((o) => o.deletable).length,
      deleted: report.orphans.filter((o) => o.deleted).length,
      apply,
    })
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
// Cadence from the stored last run (runIfDue), not the clock: the cron may
// fire once a day (Vercel Hobby) or every 5 minutes.

/**
 * `voice_orphans`: the purge queue on every run (an empty queue is one query),
 * the orphan scan at most once a day (report only unless ELEVENLABS_VOICE_ORPHAN_DELETE=true).
 */
export async function runVoiceOrphanMaintenance(log: Logger, now: Date = new Date()) {
  const purge = await drainVoicePurgeQueue({ limit: 25, log, now: now.getTime() })
  const orphans = await runIfDue(
    VOICE_STEP_KEYS.orphanScan,
    DAILY_MS,
    log,
    async () => {
      const r = await scanOrphanVoices({ apply: orphanDeleteEnabled(), log, maxPages: 10, now: now.getTime() })
      return {
        apply: r.apply,
        scanned: r.scanned,
        ours: r.ours,
        other_env: r.other_env,
        orphans: r.orphans.length,
        deletable: r.orphans.filter((o) => o.deletable).length,
        deleted: r.orphans.filter((o) => o.deleted).length,
      }
    },
    now.getTime(),
  )
  return { purge, orphans }
}

/**
 * `voice_housekeeping`: expired Voice Design previews at most once an hour;
 * the TTS history retention at most once a day, when
 * ELEVENLABS_TTS_HISTORY_RETENTION_DAYS is set.
 */
export async function runVoiceHousekeeping(log: Logger, now: Date = new Date()) {
  const out: Record<string, unknown> = {}
  out.design_previews = await runIfDue(VOICE_STEP_KEYS.designPreviews, HOUR_MS, log, () => pruneDesignPreviews(log), now.getTime())
  const days = historyRetentionDays()
  if (days !== null && el.isConfigured()) {
    out.tts_history = await runIfDue(
      VOICE_STEP_KEYS.ttsHistoryRetention,
      DAILY_MS,
      log,
      async () => {
        const r = await purgeOldTtsHistory({ olderThanDays: days, apply: true, limit: 500, log })
        return { matched: r.matched, deleted: r.deleted, failed: r.failed, truncated: r.truncated }
      },
      now.getTime(),
    )
  }
  return out
}

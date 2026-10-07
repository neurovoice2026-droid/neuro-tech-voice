import 'server-only'
// Daily lifecycle check of the Voice Library voices the platform provisioned
// (platform-wide registry rows, possibly used by many tenants).
//
// A library voice's owner can stop sharing it (immediately without a notice
// period, or after it: sharing.disable_at_unix), turn on live moderation or a
// custom rate, or the voice can be banned (safety_control). The workspace
// copy carries that state: GET /v2/voices?voice_ids=… (100 per call).
//   • scheduled removal / moderation / custom rate / captcha → the row gets a
//     `notice` (and `retiring_at`): no longer offered for new selections, a
//     banner for the tenants whose agent uses it; the voice keeps working.
//   • removed (copy disabled, ban, gone, removal date passed) → the row is
//     'failed'; agents on it are marked failed and, unless
//     ELEVENLABS_LIBRARY_REMOVAL_AUTO_SWITCH=false, switched to the curated
//     voice of their language through the PUT /api/agent/voice path.
//   • a withdrawn notice clears the row again.
// The workspace webhook `voice_library_removal_notice` only triggers this
// check early (app/api/elevenlabs/voice-notice): polling is the source of truth.

import { getVoiceDetail, getVoicesByIds, type ELVoiceDetail } from '@/lib/elevenlabs/api/voices'
import * as el from '@/lib/elevenlabs/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { isProviderError } from './errors'
import { curatedDefaultVoice } from './curated-default'
import { applyAgentVoice } from './voice-apply'
import { EL_VOICE_ID_RE, writeAudit } from './voice-catalog'

export type LifecycleNotice = 'removal_scheduled' | 'removed' | 'moderation' | 'custom_rate' | 'blocked'

export interface LifecycleEvaluation {
  state: 'ok' | 'notice' | 'removed'
  notice: LifecycleNotice | null
  retiringAt: string | null
  sharingStatus: string | null
  safetyControl: string | null
}

const BANNED = new Set(['BAN', 'ENTERPRISE_BAN'])

/** Pure: what the provider's state of a workspace copy means for us. `null` = the voice is gone. */
export function evaluateLibraryVoice(v: ELVoiceDetail | null, nowMs = Date.now()): LifecycleEvaluation {
  if (!v) return { state: 'removed', notice: 'removed', retiringAt: null, sharingStatus: null, safetyControl: null }
  const sharing = v.sharing ?? null
  const sharingStatus = sharing?.status ?? null
  const safetyControl = v.safety_control ?? null
  const base = { sharingStatus, safetyControl }
  if (safetyControl && BANNED.has(safetyControl)) return { ...base, state: 'removed', notice: 'removed', retiringAt: null }
  if (sharingStatus === 'copied_disabled') return { ...base, state: 'removed', notice: 'removed', retiringAt: null }
  const disableAt = typeof sharing?.disable_at_unix === 'number' && sharing.disable_at_unix > 0 ? sharing.disable_at_unix * 1000 : null
  if (disableAt !== null) {
    const at = new Date(disableAt).toISOString()
    return disableAt <= nowMs
      ? { ...base, state: 'removed', notice: 'removed', retiringAt: at }
      : { ...base, state: 'notice', notice: 'removal_scheduled', retiringAt: at }
  }
  if (safetyControl && safetyControl !== 'NONE') return { ...base, state: 'notice', notice: 'blocked', retiringAt: null }
  if (sharingStatus === 'disabled') return { ...base, state: 'notice', notice: 'blocked', retiringAt: null }
  if (sharing?.live_moderation_enabled === true) return { ...base, state: 'notice', notice: 'moderation', retiringAt: null }
  if ((sharing?.fiat_rate !== null && sharing?.fiat_rate !== undefined) || (typeof sharing?.rate === 'number' && sharing.rate > 1)) {
    return { ...base, state: 'notice', notice: 'custom_rate', retiringAt: null }
  }
  return { ...base, state: 'ok', notice: null, retiringAt: null }
}

export function autoSwitchOnRemoval(): boolean {
  return process.env.ELEVENLABS_LIBRARY_REMOVAL_AUTO_SWITCH !== 'false'
}

interface LibraryRow {
  id: string
  voice_id: string
  notice: string | null
  status: string
  lifecycle_checked_at?: string | null
}

/** A row is re-checked once it was last checked this long ago (the step runs every 5 minutes). */
const RECHECK_AFTER_HOURS = 20

export interface LifecycleReport {
  checked: number
  ok: number
  notices: Record<string, number>
  removed: number
  unknown: number
  agents_affected: number
  agents_switched: number
  agents_switch_failed: number
}

const REMOVED_VOICE_ERROR = 'The voice provider removed this voice. Choose a new voice.'

/**
 * Agents (any org) on a removed voice: marked failed, then switched to the
 * curated voice of their language (bounded). Each org only ever receives a
 * platform-wide curated voice.
 */
async function handleRemovedVoice(voiceId: string, report: LifecycleReport, log: Logger, maxSwitches: number): Promise<void> {
  const db = createAdminClient()
  const { data: agents, error } = await db.from('agents').select('id, org_id, language, voice_id').eq('voice_id', voiceId).limit(500)
  if (error) throw new Error(`agents read failed: ${error.message}`)
  for (const a of agents ?? []) {
    report.agents_affected++
    const l = log.child({ orgId: a.org_id, agentId: a.id })
    const { error: markErr } = await db
      .from('agents')
      .update({ voice_sync_status: 'failed', voice_sync_error: REMOVED_VOICE_ERROR, voice_sync_started_at: null })
      .eq('id', a.id)
      .eq('voice_id', voiceId)
    if (markErr) l.error('library_voice.agent_mark_failed', markErr)
    if (!autoSwitchOnRemoval() || report.agents_switched + report.agents_switch_failed >= maxSwitches) continue
    try {
      const language = normalizeAgentLanguage(a.language as string | null)
      const curated = await curatedDefaultVoice(db, language)
      if (!curated || curated.voiceId === voiceId) {
        l.error('library_voice.no_replacement', null, { language })
        continue
      }
      const outcome = await applyAgentVoice({
        orgId: a.org_id as string,
        agentId: a.id as string,
        voiceId: curated.voiceId,
        voiceName: curated.name,
        expectedCurrentVoiceId: voiceId,
        log: l,
      })
      if (!outcome) continue
      await writeAudit(
        db,
        {
          orgId: a.org_id as string,
          userId: null,
          actorKind: 'system',
          action: 'voice.library_removed_migrated',
          targetId: curated.voiceId,
          targetType: 'agent_voice',
          details: { agent_id: a.id, from_voice_id: voiceId, to_voice_id: curated.voiceId, status: outcome.status },
        },
        l,
      )
      if (outcome.status === 'failed') report.agents_switch_failed++
      else report.agents_switched++
    } catch (err) {
      report.agents_switch_failed++
      l.error('library_voice.switch_failed', err)
    }
  }
}

async function confirmMissing(voiceId: string, log: Logger): Promise<ELVoiceDetail | null | undefined> {
  try {
    return await getVoiceDetail(voiceId)
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') return null
    log.warn('library_voice.confirm_failed', { voiceId, error: isProviderError(err) ? err.code : 'unknown' })
    return undefined
  }
}

/**
 * Checks the given rows (webhook, admin), or the ready library rows not
 * checked for RECHECK_AFTER_HOURS (maintenance: about once a day per row).
 */
export async function checkLibraryVoices(params: { log?: Logger; limit?: number; voiceIds?: string[]; now?: number; maxSwitches?: number } = {}): Promise<LifecycleReport> {
  const log = (params.log ?? createLogger()).child({ component: 'library_lifecycle' })
  const report: LifecycleReport = { checked: 0, ok: 0, notices: {}, removed: 0, unknown: 0, agents_affected: 0, agents_switched: 0, agents_switch_failed: 0 }
  if (!el.isConfigured()) return report
  const db = createAdminClient()
  let query = db
    .from('provider_voices')
    .select('id, voice_id, notice, status, lifecycle_checked_at')
    .eq('provider', 'elevenlabs')
    .eq('source', 'library')
    .eq('status', 'ready')
    .is('owner_org_id', null)
  if (params.voiceIds) {
    const ids = params.voiceIds.filter((v) => EL_VOICE_ID_RE.test(v)).slice(0, 100)
    if (!ids.length) return report
    // ids are validated alphanumerics, safe in the filter expression.
    query = query.or(`voice_id.in.(${ids.join(',')}),source_voice_id.in.(${ids.join(',')})`)
  }
  const { data, error } = await query.order('lifecycle_checked_at', { ascending: true, nullsFirst: true }).limit(params.limit ?? 500)
  if (error) throw new Error(`provider_voices scan failed: ${error.message}`)
  const now = params.now ?? Date.now()
  const recheckBefore = now - RECHECK_AFTER_HOURS * 3600_000
  const rows = ((data ?? []) as LibraryRow[]).filter((r) => {
    if (!EL_VOICE_ID_RE.test(r.voice_id)) return false
    // Targeted checks (webhook, admin) always run; the scheduled one only for stale rows.
    if (params.voiceIds || !r.lifecycle_checked_at) return true
    const checkedAt = Date.parse(r.lifecycle_checked_at)
    return !Number.isFinite(checkedAt) || checkedAt < recheckBefore
  })

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    let page: Awaited<ReturnType<typeof getVoicesByIds>>
    try {
      page = await getVoicesByIds(chunk.map((r) => r.voice_id))
    } catch (err) {
      // Nothing is concluded from a failed read: the rows are checked next run.
      log.error('library_voice.batch_read_failed', err, { count: chunk.length })
      report.unknown += chunk.length
      continue
    }
    const byId = new Map((page.voices ?? []).map((v) => [v.voice_id, v]))
    for (const row of chunk) {
      report.checked++
      let detail: ELVoiceDetail | null | undefined = byId.get(row.voice_id)
      // Absent from the batch: confirm one by one before calling it removed.
      if (!detail) detail = await confirmMissing(row.voice_id, log)
      if (detail === undefined) {
        report.unknown++
        continue
      }
      const ev = evaluateLibraryVoice(detail, now)
      const patch: Record<string, unknown> = {
        notice: ev.notice,
        retiring_at: ev.retiringAt,
        sharing_status: ev.sharingStatus,
        safety_control: ev.safetyControl,
        lifecycle_checked_at: new Date(now).toISOString(),
      }
      if (ev.state === 'removed') patch.status = 'failed'
      const { error: updErr } = await db.from('provider_voices').update(patch).eq('id', row.id).eq('status', 'ready')
      if (updErr) {
        log.error('library_voice.update_failed', updErr, { voiceId: row.voice_id })
        continue
      }
      if (ev.state === 'ok') {
        report.ok++
        if (row.notice) log.info('library_voice.notice_cleared', { voiceId: row.voice_id, previous: row.notice })
        continue
      }
      if (ev.state === 'notice') {
        report.notices[ev.notice as string] = (report.notices[ev.notice as string] ?? 0) + 1
        if (row.notice !== ev.notice) log.warn('library_voice.notice', { voiceId: row.voice_id, notice: ev.notice, retiringAt: ev.retiringAt })
        continue
      }
      report.removed++
      log.error('library_voice.removed', null, { voiceId: row.voice_id, sharingStatus: ev.sharingStatus, safetyControl: ev.safetyControl })
      try {
        await handleRemovedVoice(row.voice_id, report, log, params.maxSwitches ?? 10)
      } catch (err) {
        log.error('library_voice.removed_handling_failed', err, { voiceId: row.voice_id })
      }
    }
  }
  return report
}

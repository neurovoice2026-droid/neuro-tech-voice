import 'server-only'
// Retirement of the ElevenLabs default ("premade") voices.
//
// FACT (ElevenLabs help center): every default voice expires on 2026-12-31 and
// is not accessible afterwards; replacements are not 1:1. So:
//   • default voices are no longer offered (voice-catalog.ts);
//   • a NEW agent always gets an explicit voice: the curated platform voice for
//     its language (featured_languages/featured_rank, provisioned by an admin
//     through POST /api/admin/voice/curated) when the tenant picked none;
//   • an agent created without a voice_id runs on the API default voice: its
//     voice is pinned (read back from the provider) so the tenant sees it and
//     the retirement banner;
//   • the maintenance step `default_voice_migration` reports agents on a
//     default (or unknown/NULL) voice at most once an hour and, from
//     ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT (default 2026-12-15), switches them
//     to the top curated voice of their language through the same path as
//     PUT /api/agent/voice (save, full sync, echo check), with audit_log rows.
// Tenant isolation: replacement voices are platform-wide registry rows only.

import type { SupabaseClient } from '@supabase/supabase-js'
import * as el from '@/lib/elevenlabs/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { isProviderError } from './errors'
import { curatedDefaultVoice, type CuratedVoice } from './curated-default'
import { applyAgentVoice } from './voice-apply'
import { DEFAULT_VOICE_RETIREMENT_DATE, EL_VOICE_ID_RE, defaultVoiceIds, writeAudit } from './voice-catalog'
import { runIfDue } from './maintenance-state'
import { HOUR_MS, QUARTER_HOUR_MS, VOICE_STEP_KEYS } from './voice-schedule'

const DEFAULT_MIGRATION_AT = '2026-12-15T00:00:00Z'

/** ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT (ISO date/time); invalid or unset → 2026-12-15T00:00:00Z. */
export function defaultVoiceMigrationAt(): Date {
  const raw = (process.env.ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT ?? '').trim()
  const parsed = raw ? Date.parse(raw) : NaN
  return new Date(Number.isFinite(parsed) ? parsed : Date.parse(DEFAULT_MIGRATION_AT))
}

export function defaultVoiceMigrationConfigProblem(): string | null {
  const raw = (process.env.ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT ?? '').trim()
  if (!raw || Number.isFinite(Date.parse(raw))) return null
  return `ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT is not a date; ${DEFAULT_MIGRATION_AT} is used.`
}

export const DEFAULT_VOICE_RETIREMENT_AT = `${DEFAULT_VOICE_RETIREMENT_DATE}T23:59:59Z`

// Curated platform voices (and the default for new agents) live in curated-default.ts.
export { curatedDefaultVoice, curatedVoices, defaultVoiceForNewAgent, type CuratedVoice } from './curated-default'

// ─── Pinning the provider's voice of agents saved without one ────────────────

async function voiceName(db: SupabaseClient, voiceId: string, log: Logger): Promise<string> {
  const { data, error } = await db.from('provider_voices').select('name').eq('provider', 'elevenlabs').eq('voice_id', voiceId).maybeSingle()
  if (error) log.warn('default_voice.name_lookup_failed', { error: error.message })
  if (typeof data?.name === 'string' && data.name.trim()) return data.name.trim().slice(0, 100)
  try {
    const v = await el.voices.get(voiceId)
    if (v?.name) return v.name.trim().slice(0, 100) || 'Default voice'
  } catch (err) {
    log.warn('default_voice.name_read_failed', { error: isProviderError(err) ? err.code : 'unknown' })
  }
  return 'Default voice'
}

/**
 * An agent saved without voice_id uses whatever the provider applied (the
 * API default voice, or the curated voice it was created with). Reads that
 * voice back and records it (voice_id still NULL only), so the dashboard and
 * the migration see the real voice. Returns the pinned id, or null.
 */
export async function pinRemoteVoice(params: { orgId: string; agentId: string; log: Logger }): Promise<string | null> {
  const { orgId, agentId } = params
  const log = params.log.child({ component: 'default_voice', agentId })
  const db = createAdminClient()
  const { data: res, error } = await db
    .from('agent_provider_resources')
    .select('external_id')
    .eq('agent_id', agentId)
    .eq('org_id', orgId)
    .eq('provider', 'elevenlabs')
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  const externalId = res?.external_id as string | null | undefined
  if (!externalId) return null
  const remote = await el.agents.get(externalId, { orgId, agentId })
  const voiceId = remote.conversation_config?.tts?.voice_id
  if (typeof voiceId !== 'string' || !EL_VOICE_ID_RE.test(voiceId)) return null
  const name = await voiceName(db, voiceId, log)
  const { data: updated, error: updErr } = await db
    .from('agents')
    .update({ voice_id: voiceId, voice_name: name, voice_sync_status: 'synced', voice_sync_error: null, voice_sync_started_at: null })
    .eq('id', agentId)
    .eq('org_id', orgId)
    .is('voice_id', null)
    .select('id')
  if (updErr) throw new Error(`agents voice pin failed: ${updErr.message}`)
  if (!updated?.length) return null // a voice was chosen meanwhile
  log.info('default_voice.pinned', { voiceId })
  await writeAudit(db, { orgId, userId: null, actorKind: 'system', action: 'voice.pinned', targetId: voiceId, targetType: 'agent_voice', details: { agent_id: agentId } }, log)
  return voiceId
}

// ─── Daily report / migration ────────────────────────────────────────────────

export interface DefaultVoiceMigrationReport {
  mode: 'report' | 'migrate'
  migration_at: string
  default_voice_set_known: boolean
  agents_on_default_voice: number
  /** The agent's voice no longer exists at the provider (e.g. a default voice after its expiry). */
  agents_on_missing_voice: number
  agents_without_voice: number
  pinned: number
  migrated: number
  failed: number
  skipped_changed: number
  no_curated_voice: Record<string, number>
  remaining: number
}

type VoiceClass = 'default' | 'missing' | 'other' | 'unknown'

const MAX_VOICE_LOOKUPS = 200
// Voices looked up as "not a default voice" (legacy workspace voices outside
// the registry) are not looked up again for a while on this instance.
const OTHER_TTL_MS = 12 * 3600_000
const otherVoiceCache = new Map<string, number>()

/** For tests. */
export function resetDefaultVoiceLookupCache(): void {
  otherVoiceCache.clear()
}

/**
 * Voice ids outside the registry: in the provider's default-voice listing, or
 * (the listing is empty after the expiry) looked up one by one: category
 * premade → default, 404 → missing.
 */
async function classifyUnregistered(ids: string[], defaults: Set<string> | null, log: Logger): Promise<Map<string, VoiceClass>> {
  const out = new Map<string, VoiceClass>()
  let lookups = 0
  for (const id of ids) {
    if (defaults?.has(id)) {
      out.set(id, 'default')
      continue
    }
    const knownOther = otherVoiceCache.get(id)
    if (knownOther !== undefined && Date.now() - knownOther < OTHER_TTL_MS) {
      out.set(id, 'other')
      continue
    }
    if (lookups >= MAX_VOICE_LOOKUPS) {
      out.set(id, 'unknown')
      continue
    }
    lookups++
    try {
      const v = await el.voices.get(id)
      const cls: VoiceClass = v.category === 'premade' ? 'default' : 'other'
      out.set(id, cls)
      if (cls === 'other') otherVoiceCache.set(id, Date.now())
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found') out.set(id, 'missing')
      else {
        out.set(id, 'unknown')
        log.warn('default_voice.lookup_failed', { voiceId: id, error: isProviderError(err) ? err.code : 'unknown' })
      }
    }
  }
  return out
}

interface AgentVoiceRow {
  id: string
  org_id: string
  language: string | null
  voice_id: string | null
  voice_name: string | null
}

const PAGE = 500

async function loadAgents(db: SupabaseClient, maxAgents: number): Promise<AgentVoiceRow[]> {
  const out: AgentVoiceRow[] = []
  for (let offset = 0; offset < maxAgents; offset += PAGE) {
    const { data, error } = await db
      .from('agents')
      .select('id, org_id, language, voice_id, voice_name')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`agents scan failed: ${error.message}`)
    out.push(...((data ?? []) as AgentVoiceRow[]))
    if ((data ?? []).length < PAGE) break
  }
  return out
}

async function agentsWithRemote(db: SupabaseClient, agentIds: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < agentIds.length; i += 100) {
    const { data, error } = await db
      .from('agent_provider_resources')
      .select('agent_id, external_id')
      .eq('provider', 'elevenlabs')
      .in('agent_id', agentIds.slice(i, i + 100))
    if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
    for (const r of data ?? []) if (r.external_id) out.add(r.agent_id as string)
  }
  return out
}

/**
 * Reports (every day) and, from the migration date, migrates agents still on
 * a retired default voice. `force` (admin route) migrates before the date.
 * Bounded by `timeBudgetMs` and `maxMigrations`; the rest is done next run.
 */
export async function runDefaultVoiceMigration(params: {
  log?: Logger
  now?: Date
  force?: boolean
  dryRun?: boolean
  timeBudgetMs?: number
  maxMigrations?: number
  maxAgents?: number
} = {}): Promise<DefaultVoiceMigrationReport> {
  const log = (params.log ?? createLogger()).child({ component: 'default_voice_migration' })
  const now = params.now ?? new Date()
  const started = Date.now()
  const budget = params.timeBudgetMs ?? 90_000
  const maxMigrations = params.maxMigrations ?? 40
  const migrationAt = defaultVoiceMigrationAt()
  const migrate = !params.dryRun && (params.force === true || now.getTime() >= migrationAt.getTime())
  const db = createAdminClient()

  const report: DefaultVoiceMigrationReport = {
    mode: migrate ? 'migrate' : 'report',
    migration_at: migrationAt.toISOString(),
    default_voice_set_known: false,
    agents_on_default_voice: 0,
    agents_on_missing_voice: 0,
    agents_without_voice: 0,
    pinned: 0,
    migrated: 0,
    failed: 0,
    skipped_changed: 0,
    no_curated_voice: {},
    remaining: 0,
  }
  if (!el.isConfigured()) return report

  const defaults = await defaultVoiceIds(log)
  report.default_voice_set_known = defaults !== null
  const agents = await loadAgents(db, params.maxAgents ?? 5_000)

  // Registry voices (platform, curated, custom) are never default voices.
  const registered = new Set<string>()
  const registeredLookup = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await db.from('provider_voices').select('voice_id').eq('provider', 'elevenlabs').in('voice_id', ids.slice(i, i + 100))
      if (error) throw new Error(`provider_voices read failed: ${error.message}`)
      for (const r of data ?? []) registered.add(r.voice_id as string)
    }
  }
  await registeredLookup([...new Set(agents.map((a) => a.voice_id).filter((v): v is string => !!v))])

  // Agents saved without a voice but with a provider agent: pin the provider's
  // actual voice first (bounded per run), so it is classified like the others.
  const withoutVoice = agents.filter((a) => !a.voice_id)
  const remotes = await agentsWithRemote(db, withoutVoice.map((a) => a.id))
  const unpinned: AgentVoiceRow[] = []
  for (const a of withoutVoice) {
    // No provider agent yet: it is created with the curated default voice.
    if (!remotes.has(a.id)) continue
    if (!params.dryRun && Date.now() - started < budget / 2) {
      try {
        const pinned = await pinRemoteVoice({ orgId: a.org_id, agentId: a.id, log })
        if (pinned) {
          report.pinned++
          a.voice_id = pinned
          continue
        }
      } catch (err) {
        log.error('default_voice.pin_failed', err, { agentId: a.id })
      }
    }
    report.agents_without_voice++
    unpinned.push(a)
  }
  await registeredLookup(agents.map((a) => a.voice_id).filter((v): v is string => !!v && !registered.has(v)))

  const unregistered = [...new Set(agents.map((a) => a.voice_id).filter((v): v is string => !!v && !registered.has(v)))]
  const classes = await classifyUnregistered(unregistered, defaults, log)
  const targets: AgentVoiceRow[] = [...unpinned]
  for (const a of agents) {
    if (!a.voice_id || registered.has(a.voice_id)) continue
    const c = classes.get(a.voice_id)
    if (c === 'default') report.agents_on_default_voice++
    else if (c === 'missing') report.agents_on_missing_voice++
    else continue
    targets.push(a)
  }

  if (targets.length) {
    log.warn('default_voice.agents_on_retiring_voice', {
      onDefaultVoice: report.agents_on_default_voice,
      onMissingVoice: report.agents_on_missing_voice,
      withoutVoice: report.agents_without_voice,
      migrationAt: report.migration_at,
      mode: report.mode,
    })
  }
  if (!migrate) {
    report.remaining = targets.length
    return report
  }

  for (const a of targets) {
    if (report.migrated + report.failed >= maxMigrations || Date.now() - started > budget) break
    const language = normalizeAgentLanguage(a.language)
    let curated: CuratedVoice | null
    try {
      curated = await curatedDefaultVoice(db, language)
    } catch (err) {
      log.error('default_voice.curated_read_failed', err)
      break
    }
    if (!curated) {
      report.no_curated_voice[language] = (report.no_curated_voice[language] ?? 0) + 1
      continue
    }
    const l = log.child({ orgId: a.org_id, agentId: a.id })
    try {
      const outcome = await applyAgentVoice({
        orgId: a.org_id,
        agentId: a.id,
        voiceId: curated.voiceId,
        voiceName: curated.name,
        expectedCurrentVoiceId: a.voice_id,
        log: l,
      })
      if (!outcome) {
        // The tenant chose a voice since the scan: never overwritten.
        report.skipped_changed++
        continue
      }
      await writeAudit(
        db,
        {
          orgId: a.org_id,
          userId: null,
          actorKind: 'system',
          action: 'voice.default_migrated',
          targetId: curated.voiceId,
          targetType: 'agent_voice',
          details: { agent_id: a.id, from_voice_id: a.voice_id, to_voice_id: curated.voiceId, language, status: outcome.status },
        },
        l,
      )
      if (outcome.status === 'failed') {
        report.failed++
        l.error('default_voice.migration_not_confirmed', null, { status: outcome.status })
      } else {
        report.migrated++
        l.info('default_voice.migrated', { toVoiceId: curated.voiceId, status: outcome.status })
      }
    } catch (err) {
      report.failed++
      l.error('default_voice.migration_failed', err)
    }
  }
  report.remaining = Math.max(0, targets.length - report.migrated - report.skipped_changed)
  if (Object.keys(report.no_curated_voice).length) {
    log.error('default_voice.no_curated_voice_for_language', null, { languages: report.no_curated_voice })
  }
  return report
}

/**
 * Maintenance entry (`default_voice_migration`): the report (and the pinning
 * of NULL voices) runs at most once an hour, the migration from
 * ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT at most every quarter hour. The slot
 * is claimed in maintenance_state (runIfDue), never read from the clock
 * minute, so it also runs with the daily Vercel Hobby cron.
 */
export async function runScheduledDefaultVoiceMigration(log: Logger, now: Date = new Date()): Promise<DefaultVoiceMigrationReport | { skipped: 'not_due' }> {
  const migrating = now.getTime() >= defaultVoiceMigrationAt().getTime()
  return migrating
    ? runIfDue(VOICE_STEP_KEYS.defaultVoiceMigration, QUARTER_HOUR_MS, log, () => runDefaultVoiceMigration({ log, now }), now.getTime())
    : runIfDue(VOICE_STEP_KEYS.defaultVoiceReport, HOUR_MS, log, () => runDefaultVoiceMigration({ log, now }), now.getTime())
}

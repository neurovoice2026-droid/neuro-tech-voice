import 'server-only'
// Admin diagnostics for voices (GET /api/admin/voice/diagnostics → `voices`):
// counts only, never a tenant's data. Agents still on a retired default voice
// or without a voice, curated voices per language, library-voice lifecycle,
// custom voices, the purge queue and the voice-related configuration.

import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { defaultVoiceMigrationAt, defaultVoiceMigrationConfigProblem } from './default-voices'
import { autoSwitchOnRemoval } from './library-lifecycle'
import { historyRetentionDays } from './tts-history'
import { maxCustomVoicesPerOrg } from './voice-capacity'
import { DEFAULT_VOICE_RETIREMENT_DATE, defaultVoiceIds } from './voice-catalog'
import { voiceDesignModel } from './voice-design'
import { orphanDeleteEnabled } from './voice-orphans'

export interface VoiceDiagnostics {
  retirement_date: string
  migration_at: string
  agents: { total: number; on_default_voice: number | null; unregistered_voice: number; without_voice: number }
  curated_by_language: Record<string, number>
  languages_without_curated_voice: string[]
  library_voices: { ready: number; with_notice: Record<string, number>; removed: number }
  custom_voices: { active: number }
  purge_queue_pending: number
  config: {
    zero_retention_previews: boolean
    voice_notice_webhook_secret: boolean
    orphan_delete: boolean
    tts_history_retention_days: number | null
    max_custom_voices_per_org: number
    voice_design_model: string
    library_removal_auto_switch: boolean
  }
  problems: Array<{ key: string; severity: 'warning' | 'error'; message: string }>
}

const MAX_ROWS = 10_000

export async function voiceDiagnostics(log: Logger): Promise<VoiceDiagnostics> {
  const db = createAdminClient()
  const [agentsRes, voicesRes, purgeRes] = await Promise.all([
    db.from('agents').select('voice_id').limit(MAX_ROWS),
    db.from('provider_voices').select('voice_id, source, status, owner_org_id, notice, featured_languages').eq('provider', 'elevenlabs').limit(MAX_ROWS),
    db.from('provider_voice_purge').select('id').is('done_at', null).limit(MAX_ROWS),
  ])
  for (const r of [agentsRes, voicesRes, purgeRes]) if (r.error) throw new Error(`voice diagnostics read failed: ${r.error.message}`)

  const voices = voicesRes.data ?? []
  const registered = new Set(voices.map((v) => v.voice_id as string))
  const defaults = await defaultVoiceIds(log)
  const agents = agentsRes.data ?? []
  const unregistered = agents.filter((a) => a.voice_id && !registered.has(a.voice_id as string))

  const curated: Record<string, number> = {}
  const notices: Record<string, number> = {}
  let ready = 0
  let removed = 0
  let custom = 0
  for (const v of voices) {
    if (v.source === 'library' && v.owner_org_id === null) {
      if (v.status === 'ready') {
        ready++
        if (v.notice) notices[v.notice as string] = (notices[v.notice as string] ?? 0) + 1
        else for (const l of (v.featured_languages as string[] | null) ?? []) curated[l] = (curated[l] ?? 0) + 1
      } else if (v.status === 'failed') removed++
    }
    if ((v.source === 'cloned' || v.source === 'designed') && (v.status === 'ready' || v.status === 'pending')) custom++
  }

  const problems: VoiceDiagnostics['problems'] = []
  const migrationProblem = defaultVoiceMigrationConfigProblem()
  if (migrationProblem) problems.push({ key: 'ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT', severity: 'warning', message: migrationProblem })
  const missing = AGENT_LANGUAGES.map((l) => l.value).filter((l) => !curated[l])
  if (missing.includes('ro') || missing.includes('en')) {
    problems.push({
      key: 'curated_voices',
      severity: 'error',
      message: `No curated voice for ${missing.filter((l) => l === 'ro' || l === 'en').join(', ')}: new agents fall back to the provider default voice and the default-voice migration cannot run. Use POST /api/admin/voice/curated.`,
    })
  }
  const onDefault = defaults ? agents.filter((a) => a.voice_id && !registered.has(a.voice_id as string) && defaults.has(a.voice_id as string)).length : null
  if (onDefault) {
    problems.push({ key: 'default_voices', severity: 'warning', message: `${onDefault} agent(s) still use an ElevenLabs default voice (retired ${DEFAULT_VOICE_RETIREMENT_DATE}).` })
  }
  if (removed) problems.push({ key: 'library_voices', severity: 'warning', message: `${removed} library voice(s) were removed by their owner.` })

  return {
    retirement_date: DEFAULT_VOICE_RETIREMENT_DATE,
    migration_at: defaultVoiceMigrationAt().toISOString(),
    agents: { total: agents.length, on_default_voice: onDefault, unregistered_voice: unregistered.length, without_voice: agents.filter((a) => !a.voice_id).length },
    curated_by_language: curated,
    languages_without_curated_voice: missing,
    library_voices: { ready, with_notice: notices, removed },
    custom_voices: { active: custom },
    purge_queue_pending: (purgeRes.data ?? []).length,
    config: {
      zero_retention_previews: process.env.ELEVENLABS_TTS_ZERO_RETENTION !== 'false',
      voice_notice_webhook_secret: (process.env.ELEVENLABS_VOICE_NOTICE_WEBHOOK_SECRET ?? '').trim().length > 0,
      orphan_delete: orphanDeleteEnabled(),
      tts_history_retention_days: historyRetentionDays(),
      max_custom_voices_per_org: maxCustomVoicesPerOrg(),
      voice_design_model: voiceDesignModel(),
      library_removal_auto_switch: autoSwitchOnRemoval(),
    },
    problems,
  }
}

import 'server-only'
// Model and LLM checks for GET /api/admin/voice/diagnostics. They are reported
// as configuration problems and never block a call or a sync: a mistyped
// ELEVENLABS_TTS_MODEL_* is replaced by the default in models.ts, and this is
// where that silent replacement becomes visible. Messages never carry secret
// values (model ids and env variable names only).

import type { SupabaseClient } from '@supabase/supabase-js'
import { isConfigured } from '@/lib/elevenlabs/client'
import { cachedAgentLlms, cachedModels } from '@/lib/elevenlabs/model-catalog'
import {
  AGENT_TTS_MODELS,
  LLM_REASONING_EFFORTS,
  TEXT_NORMALISATION_TYPES,
  TTS_CONVERSATIONAL_MODELS,
  agentLlm,
  isAgentTtsModel,
  isDeprecatedTts,
  isEnglishOnlyTts,
  previewTtsModel,
  ttsModelFor,
} from '@/lib/elevenlabs/models'
import { AGENT_LANGUAGE_CODES, baseLanguage } from '@/lib/voice/languages'
import { describeError, type Logger } from '@/lib/observability/logger'
import type { ConfigProblem } from '@/lib/voice-providers/config'

const ALLOWED = AGENT_TTS_MODELS.join(', ')

/** Env-only checks (no network): what models.ts silently corrects. */
export function modelEnvProblems(): ConfigProblem[] {
  const problems: ConfigProblem[] = []
  const warn = (key: string, message: string) => problems.push({ key, severity: 'warning', message })

  for (const key of ['ELEVENLABS_TTS_MODEL_EN', 'ELEVENLABS_TTS_MODEL_MULTILINGUAL'] as const) {
    const raw = (process.env[key] ?? '').trim()
    if (!raw) continue
    if (!(TTS_CONVERSATIONAL_MODELS as readonly string[]).includes(raw)) {
      warn(key, `Unknown TTS model: the platform default is used instead. Allowed: ${ALLOWED}.`)
    } else if (isDeprecatedTts(raw)) {
      warn(key, 'Deprecated TTS model: its flash replacement is used instead. Update the variable.')
    } else if (!isAgentTtsModel(raw)) {
      warn(key, `Not a real-time agent model: the platform default is used instead. Allowed: ${ALLOWED}.`)
    } else if (key === 'ELEVENLABS_TTS_MODEL_MULTILINGUAL' && isEnglishOnlyTts(raw)) {
      warn(key, 'English-only model: non-English agents use eleven_flash_v2_5 instead.')
    }
  }

  const norm = (process.env.ELEVENLABS_TEXT_NORMALISATION ?? '').trim()
  if (norm && !(TEXT_NORMALISATION_TYPES as readonly string[]).includes(norm)) {
    warn('ELEVENLABS_TEXT_NORMALISATION', `Unknown value: 'elevenlabs' is used. Allowed: ${TEXT_NORMALISATION_TYPES.join(', ')}.`)
  }
  const effort = (process.env.ELEVENLABS_REASONING_EFFORT ?? '').trim().toLowerCase()
  if (effort && effort !== 'auto' && !(LLM_REASONING_EFFORTS as readonly string[]).includes(effort)) {
    warn('ELEVENLABS_REASONING_EFFORT', `Unknown value: the lowest level the LLM supports is used. Allowed: auto, ${LLM_REASONING_EFFORTS.join(', ')}.`)
  }
  const llm = (process.env.ELEVENLABS_LLM ?? '').trim()
  if (llm && llm !== agentLlm()) warn('ELEVENLABS_LLM', 'Malformed LLM id: the platform default LLM is used instead.')
  return problems
}

/** Checks against GET /v1/models and GET /v1/convai/llm/list (cached for an hour). */
export async function remoteModelProblems(log: Logger): Promise<ConfigProblem[]> {
  if (!isConfigured()) return []
  const problems: ConfigProblem[] = []

  try {
    const models = await cachedModels()
    const byId = new Map(models.map((m) => [m.model_id, m]))
    const unsupported = new Map<string, string[]>()
    const unlisted = new Set<string>()
    for (const lang of AGENT_LANGUAGE_CODES) {
      const live = ttsModelFor(lang)
      // A conversational-only model may be absent from /v1/models: its
      // plain-TTS sibling (used for previews) then stands in for the check.
      const entry = byId.get(live) ?? byId.get(previewTtsModel(lang))
      if (!entry) {
        unlisted.add(live)
        continue
      }
      const langs = (entry.languages ?? []).map((l) => baseLanguage(l.language_id))
      if (langs.length > 0 && !langs.includes(lang)) unsupported.set(live, [...(unsupported.get(live) ?? []), lang])
    }
    for (const [model, langs] of unsupported) {
      problems.push({ key: 'ELEVENLABS_TTS_MODEL', severity: 'error', message: `${model} does not list these agent languages: ${langs.join(', ')}.` })
    }
    for (const model of unlisted) {
      problems.push({ key: 'ELEVENLABS_TTS_MODEL', severity: 'warning', message: `${model} is not listed by GET /v1/models: its language support cannot be verified.` })
    }
    for (const lang of ['en', 'ro']) {
      const preview = byId.get(previewTtsModel(lang))
      if (preview && preview.can_do_text_to_speech === false) {
        problems.push({ key: 'ELEVENLABS_TTS_MODEL', severity: 'warning', message: `${preview.model_id} cannot do text-to-speech: voice previews will fail.` })
      }
    }
  } catch (err) {
    log.warn('diagnostics.models_unavailable', { error: describeError(err) })
    problems.push({ key: 'ELEVENLABS_TTS_MODEL', severity: 'warning', message: 'Could not read GET /v1/models: TTS model support was not verified.' })
  }

  try {
    const llm = agentLlm()
    const info = (await cachedAgentLlms()).find((l) => l.llm === llm)
    if (!info) {
      problems.push({ key: 'ELEVENLABS_LLM', severity: 'error', message: `${llm} is not offered to agents by GET /v1/convai/llm/list: agent syncs will be rejected.` })
    } else {
      if (info.deprecation_info?.is_deprecated) {
        const replacement = info.deprecation_info.replacement_model ? ` Replacement: ${info.deprecation_info.replacement_model}.` : ''
        problems.push({ key: 'ELEVENLABS_LLM', severity: 'warning', message: `${llm} is deprecated.${replacement}` })
      }
      const pref = (process.env.ELEVENLABS_REASONING_EFFORT ?? '').trim().toLowerCase()
      const available = info.available_reasoning_efforts ?? []
      if (pref && pref !== 'auto' && !available.includes(pref as (typeof available)[number])) {
        problems.push({
          key: 'ELEVENLABS_REASONING_EFFORT',
          severity: 'warning',
          message: available.length
            ? `${llm} does not support '${pref}': the lowest supported level is used (${available.join(', ')}).`
            : `${llm} has no configurable reasoning: no reasoning effort is sent.`,
        })
      }
    }
  } catch (err) {
    log.warn('diagnostics.llms_unavailable', { error: describeError(err) })
    problems.push({ key: 'ELEVENLABS_LLM', severity: 'warning', message: 'Could not read GET /v1/convai/llm/list: the agent LLM was not verified.' })
  }
  return problems
}

/**
 * Synced ElevenLabs agents whose recorded TTS model (details.tts_model, as the
 * provider reported it after the last write) is deprecated, outside the agent
 * allow-list or different from what ttsModelFor(language) resolves today.
 * Counts only: no tenant identifiers in the diagnostics payload.
 */
export async function agentModelDriftProblems(db: SupabaseClient, log: Logger): Promise<ConfigProblem[]> {
  const unavailable: ConfigProblem[] = [{ key: 'agent_sync.tts_model', severity: 'warning', message: 'Could not read synced agents: model drift was not checked.' }]
  let data: unknown[] | null
  try {
    const res = await db
      .from('agent_provider_resources')
      .select('details, agents(language)')
      .eq('provider', 'elevenlabs')
      .eq('status', 'ready')
      .limit(5000)
    if (res.error) {
      log.warn('diagnostics.model_drift_unavailable', { error: res.error.message })
      return unavailable
    }
    data = res.data
  } catch (err) {
    log.warn('diagnostics.model_drift_unavailable', { error: describeError(err) })
    return unavailable
  }
  let deprecated = 0
  let notAllowed = 0
  let drifted = 0
  for (const row of (data ?? []) as Array<{ details?: Record<string, unknown> | null; agents?: { language?: string | null } | Array<{ language?: string | null }> | null }>) {
    const model = typeof row.details?.tts_model === 'string' ? row.details.tts_model : null
    if (!model) continue
    const agent = Array.isArray(row.agents) ? row.agents[0] : row.agents
    if (isDeprecatedTts(model)) deprecated++
    else if (!isAgentTtsModel(model)) notAllowed++
    else if (model !== ttsModelFor(agent?.language ?? 'en')) drifted++
  }
  const problems: ConfigProblem[] = []
  if (deprecated) problems.push({ key: 'agent_sync.tts_model', severity: 'warning', message: `${deprecated} synced agent(s) still use a deprecated TTS model: re-sync them.` })
  if (notAllowed) problems.push({ key: 'agent_sync.tts_model', severity: 'warning', message: `${notAllowed} synced agent(s) use a TTS model outside the agent allow-list: re-sync them.` })
  if (drifted) problems.push({ key: 'agent_sync.tts_model', severity: 'warning', message: `${drifted} synced agent(s) use a different TTS model than the current configuration: re-sync them.` })
  return problems
}

/** Every model/LLM problem; never throws (a failing check becomes a warning). */
export async function diagnoseModels(db: SupabaseClient, log: Logger): Promise<ConfigProblem[]> {
  const [remote, drift] = await Promise.all([remoteModelProblems(log), agentModelDriftProblems(db, log)])
  return [...modelEnvProblems(), ...remote, ...drift]
}

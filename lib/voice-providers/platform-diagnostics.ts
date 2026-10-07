import 'server-only'
// Admin diagnostics for the platform-owned agent configuration (slice A2):
// env values that are ignored or risky, the LLM actually used, and counts of
// synced agents whose read-back revealed a problem (analysis items, stale map
// keys, rejected transcript redaction) or that still wait for the config
// rollout. Counts only: no tenant identifiers, no secret values.

import type { SupabaseClient } from '@supabase/supabase-js'
import { PLATFORM_AGENT_CONFIG_VERSION } from '@/lib/elevenlabs/agent-config'
import { llmSelectionProblems } from '@/lib/elevenlabs/llm-selection'
import {
  TRUST_CONTEXTS,
  guardrailSettings,
  llmCascadeConfig,
  piiRedactionConfig,
  trustContext,
  unknownContentGuardrails,
} from '@/lib/elevenlabs/platform-settings'
import { describeError, type Logger } from '@/lib/observability/logger'
import { PLAN_CONCURRENCY, burstingEnabled, dailyCallLimit, invalidCallLimitEnv, planConcurrency } from './call-limits'
import { rolloutBatch, rolloutCanaryOrgs, rolloutScan } from './config-rollout'
import type { ConfigProblem } from './config'

type Env = Record<string, string | undefined>

/** Env-only checks (no I/O). */
export function platformEnvProblems(env: Env = process.env): ConfigProblem[] {
  const problems: ConfigProblem[] = []
  const warn = (key: string, message: string) => problems.push({ key, severity: 'warning', message })

  if ((env.ELEVENLABS_AGENT_AUTH ?? '').trim() === 'false') {
    problems.push({
      key: 'ELEVENLABS_AGENT_AUTH',
      severity: env.NODE_ENV === 'production' ? 'error' : 'warning',
      message:
        'Agent authentication is disabled: anyone who knows an agent id can start a conversation on a tenant agent (minutes, dynamic variables, call history). Remove the variable unless a live test proved a telephony path needs it.',
    })
  }
  for (const key of invalidCallLimitEnv(env)) warn(key, 'Invalid value: the default call limit is used instead.')
  const unknown = unknownContentGuardrails(env)
  if (unknown.length) warn('ELEVENLABS_CONTENT_GUARDRAILS', `Unknown categories ignored: ${unknown.join(', ')}.`)
  const threshold = (env.ELEVENLABS_CONTENT_GUARDRAIL_THRESHOLD ?? '').trim()
  if (threshold && !(Number(threshold) > 0 && Number(threshold) <= 1)) warn('ELEVENLABS_CONTENT_GUARDRAIL_THRESHOLD', 'Must be above 0 and at most 1: 0.3 is used.')
  const g = guardrailSettings(env)
  if (!g.focus && !g.promptInjection) warn('ELEVENLABS_ENABLE_GUARDRAILS', 'The focus and prompt-injection guardrails are off for every agent.')
  const trust = (env.ELEVENLABS_TRUST_CONTEXT ?? '').trim().toLowerCase()
  if (trust && !(TRUST_CONTEXTS as readonly string[]).includes(trust)) warn('ELEVENLABS_TRUST_CONTEXT', `Allowed: ${TRUST_CONTEXTS.join(', ')}. 'unknown' is used.`)
  const backup = (env.ELEVENLABS_BACKUP_LLM ?? '').trim().toLowerCase()
  if (backup && backup !== 'default' && backup !== 'disabled') warn('ELEVENLABS_BACKUP_LLM', "Allowed: default, disabled. 'default' is used.")
  const cascade = (env.ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS ?? '').trim()
  if (cascade && !(Number(cascade) >= 2 && Number(cascade) <= 15)) warn('ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS', 'Must be between 2 and 15: 4 is used.')
  for (const [key, min, max] of [['ELEVENLABS_ROLLOUT_BATCH', 0, 100], ['ELEVENLABS_ROLLOUT_SCAN', 1, 1000]] as const) {
    const raw = (env[key] ?? '').trim()
    if (raw && !(Number.isInteger(Number(raw)) && Number(raw) >= min && Number(raw) <= max)) warn(key, `Must be an integer from ${min} to ${max}: the default is used.`)
  }
  if (rolloutBatch(env) === 0) warn('ELEVENLABS_ROLLOUT_BATCH', 'The platform config rollout is off: platform changes reach agents only when tenants save.')
  return problems
}

interface ResourceRow {
  details?: Record<string, unknown> | null
}

/** Counts over synced ElevenLabs agents (read-back flags and rollout progress). */
export async function agentStateProblems(db: SupabaseClient, log: Logger): Promise<{ problems: ConfigProblem[]; counts: Record<string, number> }> {
  let rows: ResourceRow[]
  try {
    const res = await db.from('agent_provider_resources').select('details').eq('provider', 'elevenlabs').eq('status', 'ready').limit(5000)
    if (res.error) throw new Error(res.error.message)
    rows = (res.data ?? []) as ResourceRow[]
  } catch (err) {
    log.warn('diagnostics.agent_state_unavailable', { error: describeError(err) })
    return { problems: [{ key: 'agent_sync.read_back', severity: 'warning', message: 'Could not read synced agents: read-back checks were skipped.' }], counts: {} }
  }
  const counts = { agents: rows.length, analysis_items_migrated: 0, stale_keys: 0, pii_redaction_rejected: 0, outdated_platform_config: 0, paused: 0 }
  for (const r of rows) {
    const d = r.details ?? {}
    if (d.analysis_items_migrated === true) counts.analysis_items_migrated++
    const stale = d.stale_keys as Record<string, unknown> | undefined
    if (stale && Object.values(stale).some((v) => Array.isArray(v) && v.length > 0)) counts.stale_keys++
    if (d.pii_redaction === 'rejected') counts.pii_redaction_rejected++
    if (d.platform_version !== PLATFORM_AGENT_CONFIG_VERSION) counts.outdated_platform_config++
    if (d.paused === true) counts.paused++
  }
  const problems: ConfigProblem[] = []
  if (counts.analysis_items_migrated) {
    problems.push({
      key: 'agent_sync.analysis_items',
      severity: 'error',
      message: `${counts.analysis_items_migrated} agent(s) have platform_settings.analysis_items set at ElevenLabs: their success criteria and data collection may no longer be evaluated. Do not edit Analysis in the ElevenLabs dashboard for tenant agents; see docs/elevenlabs/A2.md.`,
    })
  }
  if (counts.stale_keys) {
    problems.push({ key: 'agent_sync.stale_keys', severity: 'warning', message: `${counts.stale_keys} agent(s) still hold data-collection fields, variables or language presets that were removed here (PATCH merge semantics).` })
  }
  if (counts.pii_redaction_rejected) {
    problems.push({
      key: 'ELEVENLABS_PII_REDACTION',
      severity: 'warning',
      message: `The workspace rejected transcript redaction for ${counts.pii_redaction_rejected} agent(s) (enterprise feature): card numbers are not redacted. Set ELEVENLABS_PII_REDACTION=false to stop trying, or upgrade the workspace.`,
    })
  }
  if (counts.outdated_platform_config) {
    problems.push({
      key: 'config_rollout',
      severity: 'warning',
      message: `${counts.outdated_platform_config} synced agent(s) are not yet on platform config version ${PLATFORM_AGENT_CONFIG_VERSION}: the config_rollout step re-syncs ${rolloutBatch()} per maintenance run (POST /api/admin/voice/rollout to see or force it).`,
    })
  }
  return { problems, counts }
}

/** Everything for GET /api/admin/voice/diagnostics; never throws. */
export async function platformAgentDiagnostics(db: SupabaseClient, log: Logger): Promise<{ problems: ConfigProblem[]; summary: Record<string, unknown> }> {
  const [llm, state] = await Promise.all([
    llmSelectionProblems(log).catch((err: unknown) => {
      log.warn('diagnostics.llm_selection_failed', { error: describeError(err) })
      return [] as ConfigProblem[]
    }),
    agentStateProblems(db, log),
  ])
  const guardrails = guardrailSettings()
  return {
    problems: [...platformEnvProblems(), ...llm, ...state.problems],
    summary: {
      platform_version: PLATFORM_AGENT_CONFIG_VERSION,
      call_limits: {
        concurrency_by_plan: Object.fromEntries(Object.keys(PLAN_CONCURRENCY).map((p) => [p, planConcurrency(p)])),
        daily_limit: dailyCallLimit(),
        bursting_enabled: burstingEnabled(),
      },
      guardrails: { focus: guardrails.focus, prompt_injection: guardrails.promptInjection, content: guardrails.content },
      pii_redaction: piiRedactionConfig().enabled,
      trust_context: trustContext(),
      llm_cascade: llmCascadeConfig(),
      agent_auth: (process.env.ELEVENLABS_AGENT_AUTH ?? '').trim() !== 'false',
      rollout: { batch: rolloutBatch(), scan: rolloutScan(), canary_orgs: rolloutCanaryOrgs().length },
      agents: state.counts,
    },
  }
}

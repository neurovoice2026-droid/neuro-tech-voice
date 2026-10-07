import 'server-only'
// Health of the ElevenLabs post-call webhook and of the workspace ConvAI
// settings it depends on. Every tenant's call data (transcripts, analysis,
// native-number billing) arrives through ONE workspace webhook: if ElevenLabs
// auto-disables it (≥ 10 consecutive failures with the last success more than
// 7 days ago) or someone edits it, data stops silently for everybody.
//
//   • resolvePostCallWebhookId(): the id sent in every agent's
//     platform_settings.workspace_overrides.webhooks — ELEVENLABS_POST_CALL_WEBHOOK_ID,
//     else the workspace webhook whose URL is our /api/elevenlabs/webhook
//     (discovered once, remembered in platform_resources).
//   • checkPostCallWebhook(): missing / disabled / auto-disabled / wrong URL /
//     not HMAC / recent delivery failures, plus the workspace default webhook
//     and conversation-embedding retention from GET /v1/convai/settings.
//   • runWorkspaceHealth(): the hourly maintenance step (error log + provider
//     event when unhealthy) and a workspace concurrency sample.
// Platform/admin only: nothing here is ever shown to a tenant. No secret is
// read, returned or logged.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { isConfigured } from '@/lib/elevenlabs/client'
import { liveCount } from '@/lib/elevenlabs/api/conversations'
import {
  getConvaiSettings,
  listWorkspaceWebhooks,
  type ELConvaiSettings,
  type ELWorkspaceWebhook,
} from '@/lib/elevenlabs/api/workspace'
import { publicBaseUrl } from './config'
import { isProviderError } from './errors'
import { runIfDue } from './maintenance-state'

export const POST_CALL_WEBHOOK_PATH = '/api/elevenlabs/webhook'
/** platform_resources key of the discovered post-call webhook id. */
export const POST_CALL_WEBHOOK_RESOURCE = 'elevenlabs.post_call_webhook'
/** Post-call events every agent needs (agent-config.ts sends the same set). */
export const REQUIRED_POST_CALL_EVENTS = ['transcript', 'call_initiation_failure'] as const

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export function expectedWebhookUrl(): string | null {
  const base = publicBaseUrl()
  return base ? `${base}${POST_CALL_WEBHOOK_PATH}` : null
}

const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, '').toLowerCase()

/** Shortest retention a tenant can pick in the dashboard (TabCallHandling: 30 days). */
export function embeddingRetentionPolicyDays(): number {
  const raw = (process.env.ELEVENLABS_EMBEDDING_RETENTION_DAYS ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isInteger(v) && v >= 1 && v <= 365 ? v : 30
}

export function concurrencyLimit(): number | null {
  const raw = (process.env.ELEVENLABS_CONCURRENCY_LIMIT ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isInteger(v) && v >= 1 && v <= 100_000 ? v : null
}

// ─── Webhook id used in agent bodies ─────────────────────────────────────────

const POSITIVE_TTL_MS = 10 * 60_000
const NEGATIVE_TTL_MS = 15 * 60_000
let memo: { id: string | null; at: number } | null = null

/** Test hook. */
export function resetPostCallWebhookMemo() {
  memo = null
}

/** The newest enabled HMAC workspace webhook pointing at our receiver. */
export function matchPostCallWebhook(webhooks: ELWorkspaceWebhook[], expectedUrl: string): ELWorkspaceWebhook | null {
  const want = normalizeUrl(expectedUrl)
  const hits = webhooks.filter((w) => normalizeUrl(w.webhook_url ?? '') === want && w.auth_type === 'hmac')
  hits.sort((a, b) => Number(a.is_disabled || a.is_auto_disabled) - Number(b.is_disabled || b.is_auto_disabled) || (b.created_at_unix ?? 0) - (a.created_at_unix ?? 0))
  return hits[0] ?? null
}

/**
 * ELEVENLABS_POST_CALL_WEBHOOK_ID, else the discovered id (cached on the
 * instance and in platform_resources), else null (agents then rely on the
 * workspace default webhook, which diagnostics check). A provider failure
 * during discovery never fails an agent sync; a database failure does (the
 * sync is retried) so a transient error cannot flip the agent body.
 */
export async function resolvePostCallWebhookId(log: Logger = createLogger({ component: 'webhook_health' }), now = Date.now()): Promise<string | null> {
  const env = (process.env.ELEVENLABS_POST_CALL_WEBHOOK_ID ?? '').trim()
  if (env) return env
  if (memo && now - memo.at < (memo.id ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS)) return memo.id
  const db = createAdminClient()
  const { data, error } = await db.from('platform_resources').select('external_id').eq('key', POST_CALL_WEBHOOK_RESOURCE).maybeSingle()
  if (error) throw new Error(`platform_resources read failed: ${error.message}`)
  if (data?.external_id) {
    memo = { id: data.external_id as string, at: now }
    return memo.id
  }
  const url = expectedWebhookUrl()
  if (!isConfigured() || !url) {
    memo = { id: null, at: now }
    return null
  }
  try {
    const { webhooks } = await listWorkspaceWebhooks()
    const hit = matchPostCallWebhook(webhooks ?? [], url)
    if (!hit) {
      log.warn('webhook_health.post_call_webhook_not_found')
      memo = { id: null, at: now }
      return null
    }
    const { error: writeErr } = await db
      .from('platform_resources')
      .upsert(
        { key: POST_CALL_WEBHOOK_RESOURCE, provider: 'elevenlabs', external_id: hit.webhook_id, details: { discovered: true }, updated_at: new Date(now).toISOString() },
        { onConflict: 'key' },
      )
    if (writeErr) throw new Error(`platform_resources write failed: ${writeErr.message}`)
    log.info('webhook_health.post_call_webhook_discovered', { webhookId: hit.webhook_id })
    memo = { id: hit.webhook_id, at: now }
    return hit.webhook_id
  } catch (err) {
    if (!isProviderError(err)) throw err
    log.warn('webhook_health.discovery_failed', { code: err.code })
    memo = { id: null, at: now }
    return null
  }
}

// ─── Health check ────────────────────────────────────────────────────────────

export interface HealthProblem {
  level: 'error' | 'warning'
  code: string
  message: string
}

export interface PostCallWebhookHealth {
  configured: boolean
  healthy: boolean
  webhook_id: string | null
  source: 'env' | 'discovered' | 'workspace_default' | null
  webhook: {
    name: string
    url_matches: boolean | null
    is_disabled: boolean
    is_auto_disabled: boolean
    auth_type: string
    most_recent_failure_error_code: number | null
    most_recent_failure_at: string | null
    usage: string[]
  } | null
  workspace_settings: {
    default_post_call_webhook_set: boolean
    default_is_ours: boolean | null
    default_events: string[]
    conversation_embedding_retention_days: number | null
    embedding_retention_policy_days: number
    rag_retention_period_days: number | null
  } | null
  problems: HealthProblem[]
}

export async function checkPostCallWebhook(log: Logger = createLogger({ component: 'webhook_health' }), now = Date.now()): Promise<PostCallWebhookHealth> {
  const out: PostCallWebhookHealth = { configured: isConfigured(), healthy: false, webhook_id: null, source: null, webhook: null, workspace_settings: null, problems: [] }
  const err = (code: string, message: string) => out.problems.push({ level: 'error', code, message })
  const warn = (code: string, message: string) => out.problems.push({ level: 'warning', code, message })
  if (!out.configured) {
    warn('not_configured', 'ElevenLabs is not configured; the post-call webhook was not checked.')
    return out
  }
  if (!(process.env.ELEVENLABS_WEBHOOK_SECRET ?? '').trim()) err('secret_missing', 'ELEVENLABS_WEBHOOK_SECRET is not set: every post-call delivery is rejected.')
  const expected = expectedWebhookUrl()
  if (!expected) warn('no_public_url', 'VOICE_PUBLIC_BASE_URL is not set: the webhook URL cannot be checked.')

  let webhooks: ELWorkspaceWebhook[] = []
  try {
    webhooks = (await listWorkspaceWebhooks({ includeUsages: true })).webhooks ?? []
  } catch (e) {
    // include_usages is admin-only: retry without it before giving up.
    try {
      webhooks = (await listWorkspaceWebhooks()).webhooks ?? []
    } catch (e2) {
      log.warn('webhook_health.list_failed', { code: isProviderError(e2) ? e2.code : 'unknown', firstCode: isProviderError(e) ? e.code : 'unknown' })
      err('list_failed', 'The workspace webhooks could not be read.')
      return out
    }
  }

  let settings: ELConvaiSettings | null = null
  try {
    settings = await getConvaiSettings()
  } catch (e) {
    log.warn('webhook_health.settings_failed', { code: isProviderError(e) ? e.code : 'unknown' })
    warn('settings_failed', 'The workspace ConvAI settings could not be read.')
  }

  // Which webhook carries the agents' post-call events.
  const env = (process.env.ELEVENLABS_POST_CALL_WEBHOOK_ID ?? '').trim()
  let id: string | null = env || null
  out.source = env ? 'env' : null
  if (!id) {
    try {
      id = await resolvePostCallWebhookId(log, now)
      if (id) out.source = 'discovered'
    } catch (e) {
      log.error('webhook_health.resolve_failed', e)
    }
  }
  const defaultId = settings?.webhooks?.post_call_webhook_id ?? null
  if (!id && defaultId) {
    id = defaultId
    out.source = 'workspace_default'
  }
  out.webhook_id = id

  if (settings) {
    const events = settings.webhooks?.events ?? []
    const def = defaultId ? webhooks.find((w) => w.webhook_id === defaultId) : undefined
    out.workspace_settings = {
      default_post_call_webhook_set: !!defaultId,
      default_is_ours: def && expected ? normalizeUrl(def.webhook_url) === normalizeUrl(expected) : null,
      default_events: events,
      conversation_embedding_retention_days: settings.conversation_embedding_retention_days ?? null,
      embedding_retention_policy_days: embeddingRetentionPolicyDays(),
      rag_retention_period_days: settings.rag_retention_period_days ?? null,
    }
    if (out.source === 'workspace_default') {
      // Agents carry no override: the workspace default must send what we need.
      const missing = REQUIRED_POST_CALL_EVENTS.filter((e) => !events.includes(e))
      if (missing.length) err('default_events_missing', `The workspace default webhook does not send: ${missing.join(', ')}.`)
    }
    if (events.includes('audio')) warn('default_sends_audio', 'The workspace default webhook sends audio events (multi-MB bodies); recordings are fetched on demand instead.')
    const embeddingDays = settings.conversation_embedding_retention_days ?? 30
    if (embeddingDays > embeddingRetentionPolicyDays()) {
      warn('embedding_retention', `Conversation embeddings are kept ${embeddingDays} days, longer than the platform policy (${embeddingRetentionPolicyDays()} days). POST /api/admin/voice/convai-settings aligns it.`)
    }
  }

  if (!id) {
    err('webhook_missing', 'No post-call webhook: set ELEVENLABS_POST_CALL_WEBHOOK_ID or create a workspace webhook pointing at /api/elevenlabs/webhook.')
    return finish(out)
  }
  const hook = webhooks.find((w) => w.webhook_id === id)
  if (!hook) {
    err('webhook_not_found', 'The post-call webhook does not exist in the workspace (deleted?).')
    return finish(out)
  }
  const urlMatches = expected ? normalizeUrl(hook.webhook_url) === normalizeUrl(expected) : null
  const failureAt = typeof hook.most_recent_failure_timestamp === 'number' ? hook.most_recent_failure_timestamp * 1000 : null
  out.webhook = {
    name: hook.name,
    url_matches: urlMatches,
    is_disabled: hook.is_disabled === true,
    is_auto_disabled: hook.is_auto_disabled === true,
    auth_type: hook.auth_type,
    most_recent_failure_error_code: hook.most_recent_failure_error_code ?? null,
    most_recent_failure_at: failureAt ? new Date(failureAt).toISOString() : null,
    usage: (hook.usage ?? []).map((u) => u.usage_type).filter((u): u is string => typeof u === 'string'),
  }
  if (hook.is_auto_disabled) err('auto_disabled', 'ElevenLabs auto-disabled the post-call webhook after repeated delivery failures: no call data arrives. Re-enable it with POST /api/admin/voice/webhooks.')
  else if (hook.is_disabled) err('disabled', 'The post-call webhook is disabled: no call data arrives. Re-enable it with POST /api/admin/voice/webhooks.')
  if (hook.auth_type !== 'hmac') err('not_hmac', `The post-call webhook uses ${hook.auth_type} authentication; the receiver only verifies HMAC.`)
  if (urlMatches === false) err('url_mismatch', 'The post-call webhook points at another URL than this deployment\'s /api/elevenlabs/webhook.')
  if (failureAt !== null && now - failureAt < DAY_MS) {
    warn('recent_failures', `Last delivery failure ${Math.round((now - failureAt) / 60_000)} min ago (HTTP ${hook.most_recent_failure_error_code ?? 'unknown'}).`)
  }
  return finish(out)
}

function finish(out: PostCallWebhookHealth): PostCallWebhookHealth {
  out.healthy = out.configured && !out.problems.some((p) => p.level === 'error')
  return out
}

// ─── Maintenance step ────────────────────────────────────────────────────────

export async function sampleWorkspaceConcurrency(log: Logger): Promise<{ count: number | null; limit: number | null; ratio: number | null }> {
  const limit = concurrencyLimit()
  try {
    const { count } = await liveCount()
    const ratio = limit ? Math.round((count / limit) * 100) / 100 : null
    if (ratio !== null && ratio >= 0.8) {
      log.warn('workspace_health.concurrency_high', { count, limit })
      emitProviderEvent({ system: 'elevenlabs', kind: 'health_check', ok: false, operation: 'workspace_concurrency', errorCode: 'concurrency_high', details: { count, limit } })
    }
    return { count, limit, ratio }
  } catch (err) {
    log.warn('workspace_health.live_count_failed', { code: isProviderError(err) ? err.code : 'unknown' })
    return { count: null, limit, ratio: null }
  }
}

/** Hourly (any cron cadence): error log + provider event when the webhook is unhealthy. */
export async function runWorkspaceHealth(log: Logger, opts: { force?: boolean; now?: number } = {}) {
  const now = opts.now ?? Date.now()
  if (!isConfigured()) return { skipped: 'not_configured' as const }
  const run = async () => {
    const health = await checkPostCallWebhook(log, now)
    const errors = health.problems.filter((p) => p.level === 'error')
    if (errors.length) {
      log.error('webhook_health.unhealthy', null, { problems: errors.map((p) => p.code), source: health.source })
      emitProviderEvent({
        system: 'elevenlabs',
        kind: 'health_check',
        ok: false,
        operation: 'post_call_webhook',
        errorCode: errors[0].code,
        details: { problems: errors.map((p) => p.code), last_failure_code: health.webhook?.most_recent_failure_error_code ?? null },
      })
    }
    const concurrency = await sampleWorkspaceConcurrency(log)
    return { healthy: health.healthy, problems: health.problems.map((p) => p.code), source: health.source, concurrency }
  }
  return opts.force ? run() : runIfDue('elevenlabs_workspace_health', HOUR_MS, log, run, now)
}

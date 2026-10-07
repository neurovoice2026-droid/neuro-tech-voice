import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'
import type { ELWorkspaceWebhook } from '@/lib/elevenlabs/api/workspace'

const state: { db: MemoryDb | null; configured: boolean } = { db: null, configured: true }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => state.configured }))
const wsApi = { listWorkspaceWebhooks: vi.fn(), getConvaiSettings: vi.fn(), updateConvaiSettings: vi.fn(), updateWorkspaceWebhook: vi.fn() }
vi.mock('@/lib/elevenlabs/api/workspace', async (orig) => ({
  ...(await orig<typeof import('@/lib/elevenlabs/api/workspace')>()),
  listWorkspaceWebhooks: (...a: unknown[]) => wsApi.listWorkspaceWebhooks(...a),
  getConvaiSettings: (...a: unknown[]) => wsApi.getConvaiSettings(...a),
  updateConvaiSettings: (...a: unknown[]) => wsApi.updateConvaiSettings(...a),
  updateWorkspaceWebhook: (...a: unknown[]) => wsApi.updateWorkspaceWebhook(...a),
}))
const liveCount = vi.fn()
vi.mock('@/lib/elevenlabs/api/conversations', () => ({ liveCount: (...a: unknown[]) => liveCount(...a) }))
vi.mock('./maintenance-state', () => ({ runIfDue: async (_k: string, _i: number, _l: unknown, fn: () => Promise<unknown>) => fn() }))

import {
  checkPostCallWebhook,
  matchPostCallWebhook,
  resetPostCallWebhookMemo,
  resolvePostCallWebhookId,
  runWorkspaceHealth,
} from './webhook-health'
import { alignEmbeddingRetention, embeddingRetentionBody, planWebhookRepair, repairPostCallWebhook } from './workspace-settings'
import { ProviderError } from './errors'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ component: 'test' })
const NOW = Date.parse('2026-10-07T12:00:00.000Z')
const OURS = 'https://app.example.com/api/elevenlabs/webhook'

function hook(over: Partial<ELWorkspaceWebhook> = {}): ELWorkspaceWebhook {
  return { name: 'ntv post-call', webhook_id: 'wh_1', webhook_url: OURS, is_disabled: false, is_auto_disabled: false, created_at_unix: 100, auth_type: 'hmac', usage: [{ usage_type: 'ConvAI Agent Settings' }], ...over }
}

let events: ProviderEvent[] = []
let restore: () => void

beforeEach(() => {
  state.db = memoryDb({ platform_resources: [] }, { unique: { platform_resources: [['key']] } })
  state.configured = true
  resetPostCallWebhookMemo()
  for (const f of Object.values(wsApi)) f.mockReset()
  liveCount.mockReset()
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://app.example.com')
  vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', 'whsec_test')
  vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', '')
  vi.stubEnv('ELEVENLABS_CONCURRENCY_LIMIT', '')
  vi.stubEnv('ELEVENLABS_EMBEDDING_RETENTION_DAYS', '')
  events = []
  restore = setProviderEventSink((e) => events.push(e))
  wsApi.getConvaiSettings.mockResolvedValue({ webhooks: { post_call_webhook_id: null, events: [] }, conversation_embedding_retention_days: null })
})
afterEach(() => restore())

describe('post-call webhook id for agent bodies', () => {
  it('uses ELEVENLABS_POST_CALL_WEBHOOK_ID when set (no provider call)', async () => {
    vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', 'wh_env')
    expect(await resolvePostCallWebhookId(log, NOW)).toBe('wh_env')
    expect(wsApi.listWorkspaceWebhooks).not.toHaveBeenCalled()
  })

  it('discovers the HMAC webhook pointing at our receiver once, remembers it, and reuses it', async () => {
    wsApi.listWorkspaceWebhooks.mockResolvedValue({ webhooks: [hook({ webhook_id: 'wh_other', webhook_url: 'https://elsewhere.test/hook' }), hook({ webhook_id: 'wh_ours' })] })
    expect(await resolvePostCallWebhookId(log, NOW)).toBe('wh_ours')
    expect(state.db?.tables.platform_resources[0]).toMatchObject({ key: 'elevenlabs.post_call_webhook', external_id: 'wh_ours' })
    resetPostCallWebhookMemo()
    expect(await resolvePostCallWebhookId(log, NOW)).toBe('wh_ours')
    expect(wsApi.listWorkspaceWebhooks).toHaveBeenCalledTimes(1)
  })

  it('a provider failure never fails the sync, and is not retried on every hash', async () => {
    wsApi.listWorkspaceWebhooks.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'workspace.webhooks_list', status: 500 }))
    expect(await resolvePostCallWebhookId(log, NOW)).toBeNull()
    expect(await resolvePostCallWebhookId(log, NOW + 60_000)).toBeNull()
    expect(wsApi.listWorkspaceWebhooks).toHaveBeenCalledTimes(1)
  })

  it('matches only HMAC webhooks with our exact URL, enabled ones first', () => {
    const picked = matchPostCallWebhook([
      hook({ webhook_id: 'disabled', is_disabled: true, created_at_unix: 500 }),
      hook({ webhook_id: 'oauth', auth_type: 'oauth2' }),
      hook({ webhook_id: 'ok', webhook_url: `${OURS}/` }),
    ], OURS)
    expect(picked?.webhook_id).toBe('ok')
  })
})

describe('checkPostCallWebhook', () => {
  it('healthy: enabled HMAC webhook at our URL', async () => {
    wsApi.listWorkspaceWebhooks.mockResolvedValue({ webhooks: [hook()] })
    const h = await checkPostCallWebhook(log, NOW)
    expect(h).toMatchObject({ healthy: true, webhook_id: 'wh_1', source: 'discovered', webhook: { url_matches: true, usage: ['ConvAI Agent Settings'] } })
    expect(h.problems.filter((p) => p.level === 'error')).toEqual([])
  })

  it.each([
    [{ is_auto_disabled: true }, 'auto_disabled'],
    [{ is_disabled: true }, 'disabled'],
    [{ webhook_url: 'https://old.example.com/api/elevenlabs/webhook' }, 'url_mismatch'],
  ] as const)('reports %j as an error', async (over, code) => {
    vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', 'wh_1')
    wsApi.listWorkspaceWebhooks.mockResolvedValue({ webhooks: [hook(over)] })
    const h = await checkPostCallWebhook(log, NOW)
    expect(h.healthy).toBe(false)
    expect(h.problems.map((p) => p.code)).toContain(code)
  })

  it('reports a deleted webhook, a recent delivery failure and a long embedding retention', async () => {
    vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', 'wh_gone')
    wsApi.listWorkspaceWebhooks.mockResolvedValue({ webhooks: [hook()] })
    wsApi.getConvaiSettings.mockResolvedValue({ webhooks: { events: ['transcript'] }, conversation_embedding_retention_days: 90 })
    const h = await checkPostCallWebhook(log, NOW)
    expect(h.problems.map((p) => p.code)).toEqual(expect.arrayContaining(['webhook_not_found', 'embedding_retention']))
    vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', 'wh_1')
    wsApi.listWorkspaceWebhooks.mockResolvedValue({ webhooks: [hook({ most_recent_failure_error_code: 500, most_recent_failure_timestamp: NOW / 1000 - 600 })] })
    const h2 = await checkPostCallWebhook(log, NOW)
    expect(h2.healthy).toBe(true)
    expect(h2.problems.map((p) => p.code)).toContain('recent_failures')
  })

  it('falls back to the workspace default webhook and requires its events', async () => {
    wsApi.listWorkspaceWebhooks.mockResolvedValue({ webhooks: [hook({ webhook_id: 'wh_def', webhook_url: 'https://elsewhere.test/x' })] })
    wsApi.getConvaiSettings.mockResolvedValue({ webhooks: { post_call_webhook_id: 'wh_def', events: ['transcript', 'audio'] } })
    const h = await checkPostCallWebhook(log, NOW)
    expect(h.source).toBe('workspace_default')
    expect(h.problems.map((p) => p.code)).toEqual(expect.arrayContaining(['default_events_missing', 'default_sends_audio', 'url_mismatch']))
  })

  it('retries the listing without include_usages (admin-only) and never needs the secret value', async () => {
    vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', 'wh_1')
    wsApi.listWorkspaceWebhooks
      .mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'permission', operation: 'workspace.webhooks_list', status: 403 }))
      .mockResolvedValueOnce({ webhooks: [hook()] })
    const h = await checkPostCallWebhook(log, NOW)
    expect(h.healthy).toBe(true)
    expect(wsApi.listWorkspaceWebhooks.mock.calls).toEqual([[{ includeUsages: true }], []])
    expect(JSON.stringify(h)).not.toContain('whsec_test')
  })
})

describe('maintenance step', () => {
  it('logs and emits a provider event when unhealthy; samples workspace concurrency against the limit', async () => {
    vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', 'wh_1')
    vi.stubEnv('ELEVENLABS_CONCURRENCY_LIMIT', '10')
    wsApi.listWorkspaceWebhooks.mockResolvedValue({ webhooks: [hook({ is_auto_disabled: true })] })
    liveCount.mockResolvedValue({ count: 9 })
    const res = await runWorkspaceHealth(log, { now: NOW })
    expect(res).toMatchObject({ healthy: false, concurrency: { count: 9, limit: 10, ratio: 0.9 } })
    expect(events.map((e) => [e.kind, e.operation, e.errorCode])).toEqual([
      ['health_check', 'post_call_webhook', 'auto_disabled'],
      ['health_check', 'workspace_concurrency', 'concurrency_high'],
    ])
  })
})

describe('admin repairs (dry run by default)', () => {
  it('plans a PATCH with the current name, enabled and retries on; never events', () => {
    const plan = planWebhookRepair({ configured: true, healthy: false, webhook_id: 'wh_1', source: 'env', workspace_settings: null, problems: [], webhook: { name: 'n', url_matches: true, is_disabled: false, is_auto_disabled: true, auth_type: 'hmac', most_recent_failure_error_code: null, most_recent_failure_at: null, usage: [] } }, { enableRetries: true, reenable: true })
    expect(plan.patch).toEqual({ name: 'n', is_disabled: false, retry_enabled: true })
  })

  it('applies the webhook repair only when not a dry run', async () => {
    vi.stubEnv('ELEVENLABS_POST_CALL_WEBHOOK_ID', 'wh_1')
    wsApi.listWorkspaceWebhooks.mockResolvedValue({ webhooks: [hook({ is_auto_disabled: true })] })
    const dry = await repairPostCallWebhook({ dryRun: true, enableRetries: true, reenable: true, log })
    expect(dry.applied).toBe(false)
    expect(wsApi.updateWorkspaceWebhook).not.toHaveBeenCalled()
    wsApi.updateWorkspaceWebhook.mockResolvedValue({ status: 'ok' })
    const done = await repairPostCallWebhook({ dryRun: false, enableRetries: true, reenable: true, log })
    expect(done.applied).toBe(true)
    expect(wsApi.updateWorkspaceWebhook).toHaveBeenCalledWith('wh_1', { name: 'ntv post-call', is_disabled: false, retry_enabled: true })
  })

  it('embedding retention: read-modify-write without the deprecated send_audio, then read back', async () => {
    const current = {
      conversation_initiation_client_data_webhook: { url: 'https://x.test/init', request_headers: { Authorization: 'Bearer secret' } },
      webhooks: { post_call_webhook_id: 'wh_1', events: ['transcript'] as Array<'transcript'>, transcript_format: 'json' as const, send_audio: false },
      can_use_mcp_servers: false,
      rag_retention_period_days: 10,
      conversation_embedding_retention_days: null,
      default_livekit_stack: 'standard' as const,
    }
    const body = embeddingRetentionBody(current, 30)
    expect(body.conversation_embedding_retention_days).toBe(30)
    expect(body.webhooks).toEqual({ post_call_webhook_id: 'wh_1', events: ['transcript'], transcript_format: 'json' })
    expect(body.rag_retention_period_days).toBe(10)

    wsApi.getConvaiSettings.mockResolvedValueOnce(current).mockResolvedValueOnce({ ...current, conversation_embedding_retention_days: 30 })
    const dry = await alignEmbeddingRetention({ dryRun: true, log })
    expect(dry).toMatchObject({ applied: false, change: { from: null, to: 30, effective_from: 30 } })
    expect(JSON.stringify(dry)).not.toContain('secret')
    wsApi.getConvaiSettings.mockReset().mockResolvedValueOnce(current).mockResolvedValueOnce({ ...current, conversation_embedding_retention_days: 30 })
    const applied = await alignEmbeddingRetention({ dryRun: false, days: 30, log })
    expect(applied).toMatchObject({ applied: true, other_fields_changed: [] })
    expect(wsApi.updateConvaiSettings).toHaveBeenCalledWith(expect.objectContaining({ conversation_embedding_retention_days: 30 }))
    expect(JSON.stringify(applied)).not.toContain('secret')
    await expect(alignEmbeddingRetention({ dryRun: true, days: 0, log })).rejects.toThrow()
  })
})

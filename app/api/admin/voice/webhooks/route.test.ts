import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestError } from '@/lib/api/http'
import { fakeDb } from '@/tests/helpers/fake-db'

// Admin routes of slice D: post-call webhook repair, embedding retention,
// conversation reconciliation. Admin only, dry run by default, audited.

const state = { admin: true, db: fakeDb(() => ({ data: null, error: null })) }
const repairPostCallWebhook = vi.fn()
const alignEmbeddingRetention = vi.fn()
const reconcile = vi.fn()

vi.mock('@/lib/api/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new RequestError('forbidden', 'Forbidden', 403)
    return { kind: 'token', userId: null }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/security/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/lib/security/rate-limit')>()), enforceRateLimit: async () => undefined }))
vi.mock('@/lib/voice-providers/workspace-settings', () => ({
  repairPostCallWebhook: (...a: unknown[]) => repairPostCallWebhook(...a),
  alignEmbeddingRetention: (...a: unknown[]) => alignEmbeddingRetention(...a),
}))
vi.mock('@/lib/voice-providers/conversation-reconcile', () => ({ reconcileElevenLabsConversations: (...a: unknown[]) => reconcile(...a) }))

import { POST as webhooksPOST } from './route'
import { POST as settingsPOST } from '../convai-settings/route'
import { POST as conversationsPOST } from '../conversations/route'

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://app.example/api/admin/voice/x', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
}

beforeEach(() => {
  state.admin = true
  state.db = fakeDb(() => ({ data: null, error: null }))
  repairPostCallWebhook.mockReset().mockResolvedValue({ dry_run: true, applied: false, plan: { webhook_id: 'wh_1', patch: { name: 'n', is_disabled: false, retry_enabled: true } } })
  alignEmbeddingRetention.mockReset().mockResolvedValue({ dry_run: true, applied: false, change: { from: null, to: 30 }, other_fields_changed: [] })
  reconcile.mockReset().mockResolvedValue({ scanned: 0, applied: 0, swept: { applied: 0 } })
})

describe('POST /api/admin/voice/webhooks', () => {
  it('is a dry run by default (retries on, re-enable) with no audit', async () => {
    const res = await webhooksPOST(req({}))
    expect(res.status).toBe(200)
    expect(repairPostCallWebhook).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, enableRetries: true, reenable: true }))
    expect(state.db.calls.filter((c) => c.table === 'audit_log' || c.table === 'platform_resources')).toHaveLength(0)
  })

  it('applies, audits and can forget a discovered id when asked', async () => {
    repairPostCallWebhook.mockResolvedValue({ dry_run: false, applied: true, plan: { webhook_id: 'wh_1', patch: { name: 'n', is_disabled: false } } })
    const res = await webhooksPOST(req({ dry_run: false, rediscover: true }))
    expect(res.status).toBe(200)
    expect(state.db.calls.find((c) => c.table === 'platform_resources')?.op).toBe('delete')
    expect(state.db.calls.find((c) => c.table === 'audit_log')?.payload).toMatchObject({ action: 'voice.post_call_webhook.updated', details: { webhook_id: 'wh_1', applied: true } })
  })

  it('rejects non-admins, unknown fields and cross-site requests', async () => {
    expect((await webhooksPOST(req({ events: ['x'] }))).status).toBe(400)
    expect((await webhooksPOST(req({}, { origin: 'https://evil.example', host: 'app.example' }))).status).toBe(403)
    state.admin = false
    expect((await webhooksPOST(req({}))).status).toBe(403)
    expect(repairPostCallWebhook).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/voice/convai-settings', () => {
  it('dry run by default; validates the spec range; audits an applied change', async () => {
    await settingsPOST(req({}))
    expect(alignEmbeddingRetention).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, days: undefined }))
    expect((await settingsPOST(req({ embedding_retention_days: 0 }))).status).toBe(400)
    expect((await settingsPOST(req({ embedding_retention_days: 366 }))).status).toBe(400)
    alignEmbeddingRetention.mockResolvedValue({ dry_run: false, applied: true, change: { from: null, to: 14 }, other_fields_changed: [] })
    await settingsPOST(req({ dry_run: false, embedding_retention_days: 14 }))
    expect(state.db.calls.find((c) => c.table === 'audit_log')?.payload).toMatchObject({ action: 'voice.convai_settings.embedding_retention' })
  })
})

describe('POST /api/admin/voice/conversations', () => {
  it('runs the reconciliation with bounded parameters', async () => {
    const res = await conversationsPOST(req({ limit: 10 }))
    expect(res.status).toBe(200)
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, sweep: true }))
    expect((await conversationsPOST(req({ limit: 1000 }))).status).toBe(400)
  })
})

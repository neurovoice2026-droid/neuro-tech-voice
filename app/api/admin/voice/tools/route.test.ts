import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestError } from '@/lib/api/http'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state: { admin: boolean; db: MemoryDb | null } = { admin: true, db: null }
vi.mock('@/lib/api/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new RequestError('forbidden', 'Forbidden', 403)
    return { kind: 'token', userId: null }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const enforceRateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a) }))
const reconcilePlatformTools = vi.fn()
vi.mock('@/lib/voice-providers/platform-tools', () => ({
  TRANSFER_TOOL_DEGRADED: { code: 'transfer_tool_unavailable', message: 'x' },
  reconcilePlatformTools: (...a: unknown[]) => reconcilePlatformTools(...a),
}))
const syncAgent = vi.fn()
vi.mock('@/lib/voice-providers/agent-sync', () => ({ syncAgent: (...a: unknown[]) => syncAgent(...a) }))

import { POST } from './route'

const URL_ = 'https://app.example/api/admin/voice/tools'
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

beforeEach(() => {
  state.admin = true
  state.db = memoryDb({
    agent_provider_resources: [
      { id: 'r1', agent_id: 'a1', provider: 'elevenlabs', status: 'degraded', last_error_code: 'transfer_tool_unavailable' },
      { id: 'r2', agent_id: 'a2', provider: 'elevenlabs', status: 'degraded', last_error_code: 'upstream' },
      { id: 'r3', agent_id: 'a3', provider: 'elevenlabs', status: 'ready', last_error_code: null },
    ],
    audit_log: [],
  })
  enforceRateLimit.mockReset().mockResolvedValue(undefined)
  reconcilePlatformTools.mockReset().mockResolvedValue({ configured: true, secret: { status: 'ok' }, tools: [{ key: 'elevenlabs.transfer_tool', status: 'ok', toolId: 'tool_secret_id_1', action: 'patched' }] })
  syncAgent.mockReset().mockResolvedValue([{ provider: 'elevenlabs', status: 'ready' }])
})

describe('POST /api/admin/voice/tools', () => {
  it('reconciles the platform tools, audits the run and never returns provider ids', async () => {
    const res = await POST(post({}))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body).toEqual({ configured: true, secret: { status: 'ok' }, tools: [{ key: 'elevenlabs.transfer_tool', status: 'ok', action: 'patched', code: null, message: null }], resynced: [] })
    expect(JSON.stringify(body)).not.toContain('tool_secret_id_1')
    expect(syncAgent).not.toHaveBeenCalled()
    expect(state.db!.tables.audit_log).toEqual([expect.objectContaining({ action: 'voice.platform_tools.reconciled', actor_kind: 'admin_token' })])
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({ name: 'admin_voice_tools' }), 'platform', expect.any(String))
  })

  it('resync_degraded re-syncs only agents degraded because of the transfer tool, once the tool is back', async () => {
    const body = await (await POST(post({ resync_degraded: true, limit: 5 }))).json()
    expect(syncAgent).toHaveBeenCalledTimes(1)
    expect(syncAgent).toHaveBeenCalledWith('a1', expect.objectContaining({ providers: ['elevenlabs'] }))
    expect(body.resynced).toEqual([{ agentId: 'a1', status: 'ready', degraded: null }])

    syncAgent.mockClear()
    reconcilePlatformTools.mockResolvedValue({ configured: true, secret: { status: 'error' }, tools: [{ key: 'elevenlabs.transfer_tool', status: 'error', code: 'upstream', message: 'down' }] })
    await POST(post({ resync_degraded: true }))
    expect(syncAgent).not.toHaveBeenCalled()
  })

  it('refuses non-admins, cross-site requests, unknown fields and rate-limited runs before any provider call', async () => {
    state.admin = false
    expect((await POST(post({}))).status).toBe(403)
    state.admin = true
    expect((await POST(post({}, { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await POST(post({ limit: 500 }))).status).toBe(400)
    expect((await POST(post({ tool_id: 'x' }))).status).toBe(400)
    const { rateLimitedError } = await import('@/lib/api/http')
    enforceRateLimit.mockRejectedValueOnce(rateLimitedError(Date.now() + 60_000))
    expect((await POST(post({}))).status).toBe(429)
    expect(reconcilePlatformTools).not.toHaveBeenCalled()
  })
})

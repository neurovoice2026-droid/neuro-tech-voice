import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall, type Handler } from '@/tests/helpers/fake-db'

// PATCH /api/agent privacy_settings: an explicitly saved retention_days purges
// our own copies of call content, so a patch without retention_days keeps an
// earlier explicit value and never invents one (the 365-day default stays
// implicit).

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'
const state = vi.hoisted(() => ({ user: null as unknown, admin: null as unknown }))

vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({ supabase: state.user, user: { id: 'u1' }, org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'trial' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: () => {}, emitProviderEvent: () => {} }))
const ensure = vi.hoisted(() => ({ ensureAgent: vi.fn(), syncAgentProviders: vi.fn(), hasExternalAgent: vi.fn() }))
vi.mock('@/lib/agents/ensure-agent', async (orig) => ({ ...(await orig<object>()), ...ensure }))
vi.mock('@/lib/voice-providers/knowledge-rag', () => ({ scheduleKnowledgeReindex: vi.fn() }))
vi.mock('@/lib/security/rate-limit', async (orig) => ({ ...(await orig<object>()), enforceRateLimit: vi.fn(async () => {}) }))

import { PATCH } from '@/app/api/agent/route'

const baseAgent = {
  id: AGENT, org_id: ORG, name: 'Acme Agent', language: 'en', system_prompt: null, first_message: null, fallback_message: null,
  is_active: true, working_hours: {}, metadata: {}, primary_provider: 'elevenlabs', fallback_provider: 'cartesia', fallback_voice_id: null, conversation_settings: {},
}
const handler: Handler = (c) => {
  if (c.table === 'agents' && c.op === 'select') return { data: baseAgent, error: null }
  return { data: null, error: null }
}
const req = (body: unknown) =>
  new Request('http://localhost/api/agent', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

function agentUpdates(): FakeCall[] {
  return (state.user as ReturnType<typeof fakeDb>).calls.filter((c) => c.table === 'agents' && c.op === 'update')
}

function withStoredPrivacy(privacy: unknown) {
  ensure.ensureAgent.mockResolvedValue({ ...baseAgent, privacy_settings: privacy })
}

beforeEach(() => {
  vi.resetAllMocks()
  state.user = fakeDb(handler)
  state.admin = fakeDb(() => ({ data: null, error: null }))
  withStoredPrivacy(null)
  ensure.syncAgentProviders.mockResolvedValue([{ provider: 'elevenlabs', status: 'ready', error: null }])
  ensure.hasExternalAgent.mockResolvedValue(true)
})

describe('PATCH /api/agent → privacy_settings', () => {
  it('keeps retention_days absent when it was never saved and the patch omits it', async () => {
    withStoredPrivacy({ record_audio: true })
    const res = await PATCH(req({ privacy_settings: { record_audio: false } }))
    expect(res.status).toBe(200)
    expect(agentUpdates()).toHaveLength(1)
    expect(agentUpdates()[0].payload).toEqual({ privacy_settings: { record_audio: false } })
  })

  it('keeps retention_days absent for an agent without stored privacy settings', async () => {
    const res = await PATCH(req({ privacy_settings: { record_audio: false } }))
    expect(res.status).toBe(200)
    expect(agentUpdates()[0].payload).toEqual({ privacy_settings: { record_audio: false } })
  })

  it('keeps an explicitly saved retention_days when the patch omits it', async () => {
    withStoredPrivacy({ record_audio: true, retention_days: 90 })
    const res = await PATCH(req({ privacy_settings: { record_audio: false } }))
    expect(res.status).toBe(200)
    expect(agentUpdates()[0].payload).toEqual({ privacy_settings: { record_audio: false, retention_days: 90 } })
  })

  it('saves retention_days when the owner sends one', async () => {
    withStoredPrivacy({ record_audio: true, retention_days: 90 })
    const res = await PATCH(req({ privacy_settings: { record_audio: true, retention_days: 30 } }))
    expect(res.status).toBe(200)
    expect(agentUpdates()[0].payload).toEqual({ privacy_settings: { record_audio: true, retention_days: 30 } })
  })

  it('does not push to the provider when the merged settings equal the stored ones', async () => {
    withStoredPrivacy({ record_audio: true, retention_days: 90 })
    const res = await PATCH(req({ privacy_settings: { record_audio: true } }))
    expect(res.status).toBe(200)
    expect(ensure.syncAgentProviders).not.toHaveBeenCalled()
  })

  it('still rejects an invalid retention period', async () => {
    const res = await PATCH(req({ privacy_settings: { record_audio: true, retention_days: -5 } }))
    expect(res.status).toBe(400)
    expect(agentUpdates()).toHaveLength(0)
  })
})

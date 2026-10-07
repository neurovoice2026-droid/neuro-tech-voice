import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Handler } from '@/tests/helpers/fake-db'

// A language change switches the agent's RAG embedding model: PATCH /api/agent
// must schedule re-indexing of the organization's knowledge for it.

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
const rag = vi.hoisted(() => ({ scheduleKnowledgeReindex: vi.fn() }))
vi.mock('@/lib/voice-providers/knowledge-rag', () => rag)

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

beforeEach(() => {
  vi.resetAllMocks()
  state.user = fakeDb(handler)
  state.admin = fakeDb(() => ({ data: null, error: null }))
  ensure.ensureAgent.mockResolvedValue({ ...baseAgent })
  ensure.syncAgentProviders.mockResolvedValue([{ provider: 'elevenlabs', status: 'ready', error: null }])
  ensure.hasExternalAgent.mockResolvedValue(true)
})

describe('PATCH /api/agent → knowledge re-index', () => {
  it('schedules re-indexing when the language changes', async () => {
    const res = await PATCH(req({ language: 'ro' }))
    expect(res.status).toBe(200)
    expect(rag.scheduleKnowledgeReindex).toHaveBeenCalledWith(AGENT, expect.anything())
  })
  it('does not when the language is unchanged or not sent', async () => {
    await PATCH(req({ language: 'en' }))
    await PATCH(req({ name: 'Other name' }))
    expect(rag.scheduleKnowledgeReindex).not.toHaveBeenCalled()
  })
})

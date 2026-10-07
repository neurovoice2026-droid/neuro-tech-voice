import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const ORG = '11111111-1111-4111-8111-111111111111'
const USER = '55555555-5555-4555-8555-555555555555'
const AGENT = '22222222-2222-4222-8222-222222222222'
const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb }))
vi.mock('@/lib/api/auth', () => ({ requireOrg: async () => ({ supabase: state.db, user: { id: USER }, org: { id: ORG, name: 'Acme', timezone: null, plan: 'pro' } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/security/rate-limit', () => ({
  RATE_LIMITS: { agentSync: { name: 'agent_sync' }, voiceCatalog: { name: 'voice_catalog' }, voiceProvision: { name: 'voice_provision' }, ttsPreview: { name: 'tts_preview' }, ttsPreviewDaily: { name: 'tts_preview_day' } },
  enforceRateLimit: async () => {},
}))
const el = vi.hoisted(() => ({ isConfigured: vi.fn(() => true), voices: { get: vi.fn(), search: vi.fn() }, agents: { get: vi.fn() } }))
vi.mock('@/lib/elevenlabs/client', () => el)
const apply = vi.hoisted(() => ({ applyAgentVoice: vi.fn() }))
vi.mock('@/lib/voice-providers/voice-apply', () => apply)
const sync = vi.hoisted(() => ({ hasExternalAgent: vi.fn(), runAgentSync: vi.fn() }))
vi.mock('@/lib/agents/ensure-agent', () => sync)
vi.mock('@/lib/voice-providers/agent-sync', () => ({ bumpRevision: vi.fn(async () => 2) }))
const pron = vi.hoisted(() => ({ savePronunciationRules: vi.fn(), PRONUNCIATION_SAVE_LIMIT: { name: 'pronunciation_save' } }))
vi.mock('@/lib/voice-providers/pronunciation', () => pron)

import { GET as statusRoute, PUT as putVoice } from '@/app/api/agent/voice/route'
import { GET as getPron, PUT as putPron } from '@/app/api/agent/voice/pronunciation/route'

const H = { host: 'app.test', origin: 'http://app.test', 'content-type': 'application/json' }
const PREMADE = 'Premade00000000000001'

function seed(voiceId: string | null) {
  state.db = memoryDb({
    agents: [{ id: AGENT, org_id: ORG, voice_id: voiceId, voice_name: voiceId ? 'Brian' : null, created_at: '1', pronunciation: null }],
    provider_voices: [
      { id: 'p1', provider: 'elevenlabs', voice_id: 'Curated0000000000001', source: 'library', owner_org_id: null, status: 'ready', notice: null, name: 'Ana' },
      { id: 'p2', provider: 'elevenlabs', voice_id: 'Leaving0000000000001', source: 'library', owner_org_id: null, status: 'ready', notice: 'removal_scheduled', retiring_at: '2027-01-10T00:00:00Z', name: 'Leaving' },
    ],
    agent_provider_resources: [],
    audit_log: [],
  })
}

beforeEach(() => {
  seed(PREMADE)
  el.voices.search.mockReset().mockResolvedValue({ voices: [{ voice_id: PREMADE, name: 'Brian', category: 'premade' }], has_more: false })
  el.voices.get.mockReset()
  apply.applyAgentVoice.mockReset().mockResolvedValue({ status: 'synced', error: null })
  pron.savePronunciationRules.mockReset()
  sync.hasExternalAgent.mockReset()
  sync.runAgentSync.mockReset()
})

describe('GET /api/agent/voice (retirement banner)', () => {
  it('flags a default voice with the retirement date and the automatic switch date', async () => {
    const body = await (await statusRoute(new Request('http://app.test/api/agent/voice'))).json()
    expect(body).toMatchObject({ voice_id: PREMADE, kind: 'premade', notice: { code: 'default_voice_retirement', at: '2026-12-31T23:59:59Z', auto_switch_at: '2026-12-15T00:00:00.000Z' } })
    expect(body.notice.message).toContain('This voice will stop working on 31 Dec 2026 — choose a new voice')
  })
  it('flags a library voice being removed; a healthy voice has no notice', async () => {
    seed('Leaving0000000000001')
    let body = await (await statusRoute(new Request('http://app.test/api/agent/voice'))).json()
    expect(body).toMatchObject({ kind: 'library', notice: { code: 'removal_scheduled', at: '2027-01-10T00:00:00Z' } })
    seed('Curated0000000000001')
    body = await (await statusRoute(new Request('http://app.test/api/agent/voice'))).json()
    expect(body).toMatchObject({ kind: 'library', notice: null })
  })
})

describe('PUT /api/agent/voice', () => {
  it('re-saving the current (retiring) voice works; picking another default voice is refused', async () => {
    el.voices.get.mockResolvedValue({ voice_id: PREMADE, name: 'Brian', category: 'premade' })
    const res = await putVoice(new Request('http://app.test/api/agent/voice', { method: 'PUT', headers: H, body: JSON.stringify({ voice_id: PREMADE, voice_name: 'Brian' }) }))
    expect(res.status).toBe(200)
    expect(apply.applyAgentVoice).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG, agentId: AGENT, voiceId: PREMADE }))

    seed('Curated0000000000001')
    apply.applyAgentVoice.mockClear()
    const refused = await putVoice(new Request('http://app.test/api/agent/voice', { method: 'PUT', headers: H, body: JSON.stringify({ voice_id: PREMADE, voice_name: 'Brian' }) }))
    expect(refused.status).toBe(403)
    expect(apply.applyAgentVoice).not.toHaveBeenCalled()
  })
  it('a voice with a lifecycle notice is refused as a new pick', async () => {
    seed('Curated0000000000001')
    const res = await putVoice(new Request('http://app.test/api/agent/voice', { method: 'PUT', headers: H, body: JSON.stringify({ voice_id: 'Leaving0000000000001', voice_name: 'Leaving' }) }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ details: { reason: 'voice_retiring' } })
  })
})

describe('/api/agent/voice/pronunciation', () => {
  it('GET returns the stored rules only (never dictionary ids)', async () => {
    state.db.tables.agents[0].pronunciation = { dictionary_id: 'dict_0001', version_id: 'ver_0001', rules: [{ term: 'Acme', say_as: 'acmi', case_sensitive: false, word_boundaries: true }] }
    const body = await (await getPron(new Request('http://app.test/api/agent/voice/pronunciation'))).json()
    expect(body).toEqual({ rules: [{ term: 'Acme', say_as: 'acmi', case_sensitive: false, word_boundaries: true }], max_rules: 100 })
    expect(JSON.stringify(body)).not.toContain('dict_0001')
  })

  it('PUT validates, saves for the org agent, pushes to the ElevenLabs agent only when it changed', async () => {
    const put = (body: unknown, headers = H) => putPron(new Request('http://app.test/api/agent/voice/pronunciation', { method: 'PUT', headers, body: JSON.stringify(body) }))
    expect((await put({ rules: [{ term: 'Acme', say_as: 'acmi' }] }, { ...H, origin: 'https://evil.example' })).status).toBe(403)
    expect((await put({ rules: [{ term: '', say_as: 'x' }] })).status).toBe(400)
    expect((await put({ rules: [{ term: 'a', say_as: 'b' }], dictionary_id: 'dict_x' })).status).toBe(400)

    const saved = { dictionary_id: 'dict_0001', version_id: 'ver_0002', rules: [{ term: 'Acme', say_as: 'acmi', case_sensitive: false, word_boundaries: true }] }
    pron.savePronunciationRules.mockResolvedValue({ state: saved, changed: true })
    sync.hasExternalAgent.mockResolvedValue(true)
    sync.runAgentSync.mockResolvedValue([{ provider: 'elevenlabs', status: 'ready', error: null }])
    const res = await put({ rules: [{ term: 'Acme', say_as: 'acmi' }] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ rules: saved.rules, max_rules: 100, sync: { status: 'ready', error: null } })
    expect(pron.savePronunciationRules).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG, agentId: AGENT, userId: USER, rules: [{ term: 'Acme', say_as: 'acmi', case_sensitive: false, word_boundaries: true }] }))
    expect(sync.runAgentSync).toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['elevenlabs'] }))

    pron.savePronunciationRules.mockResolvedValue({ state: saved, changed: false })
    sync.runAgentSync.mockClear()
    expect(await (await put({ rules: [{ term: 'Acme', say_as: 'acmi' }] })).json()).toMatchObject({ sync: null })
    expect(sync.runAgentSync).not.toHaveBeenCalled()
  })
})

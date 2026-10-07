import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestError } from '@/lib/api/http'

const state = { admin: true }
const diagnoseModels = vi.fn()

vi.mock('@/lib/api/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new RequestError('forbidden', 'Forbidden', 403)
    return { kind: 'token', userId: null }
  },
}))
/** Any query chain resolves to an empty result (the counts are not under test here). */
function emptyDb() {
  const chain: unknown = new Proxy(() => {}, {
    get: (_t, prop) => (prop === 'then' ? (res: (v: unknown) => unknown) => res({ data: [], error: null }) : () => chain),
  })
  return { from: () => chain }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => emptyDb() }))
vi.mock('@/lib/voice-providers/circuit-registry', () => ({
  peek: async () => ({ state: 'closed', raw: { state: 'closed' } }),
}))
vi.mock('@/lib/voice-providers/platform-resources', () => ({ listPlatformResources: async () => ({}) }))
vi.mock('@/lib/voice-providers/maintenance', () => ({ probeProviders: async () => [] }))
vi.mock('@/lib/elevenlabs/model-diagnostics', () => ({ diagnoseModels: (...a: unknown[]) => diagnoseModels(...a) }))
const platformToolDiagnostics = vi.fn()
vi.mock('@/lib/voice-providers/platform-tool-monitor', () => ({ platformToolDiagnostics: (...a: unknown[]) => platformToolDiagnostics(...a) }))

import { GET } from './route'

beforeEach(() => {
  state.admin = true
  diagnoseModels.mockReset()
  platformToolDiagnostics.mockReset().mockResolvedValue({ problems: [], summary: {} })
})

describe('GET /api/admin/voice/diagnostics', () => {
  it('reports TTS model / LLM problems with the other configuration problems', async () => {
    diagnoseModels.mockResolvedValue([{ key: 'ELEVENLABS_TTS_MODEL', severity: 'error', message: 'eleven_v4_turbo does not list these agent languages: hi.' }])
    const res = await GET(new Request('https://app.example/api/admin/voice/diagnostics'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body.problems).toEqual(
      expect.arrayContaining([{ key: 'ELEVENLABS_TTS_MODEL', severity: 'error', message: 'eleven_v4_turbo does not list these agent languages: hi.' }]),
    )
    expect(diagnoseModels).toHaveBeenCalledTimes(1)
  })

  it('reports the platform agent config (limits, guardrails, rollout) and warns when agent auth is off', async () => {
    diagnoseModels.mockResolvedValue([])
    vi.stubEnv('ELEVENLABS_AGENT_AUTH', 'false')
    const res = await GET(new Request('https://app.example/api/admin/voice/diagnostics'))
    const body = await res.json()
    expect(body.problems.map((p: { key: string }) => p.key)).toContain('ELEVENLABS_AGENT_AUTH')
    expect(body.platform_agent_config).toMatchObject({
      platform_version: expect.any(Number),
      agent_auth: false,
      call_limits: { concurrency_by_plan: { trial: 2, starter: 2, pro: 4, business: 6, custom: 10 } },
      guardrails: { focus: true, prompt_injection: true },
      rollout: { batch: 10 },
    })
    vi.unstubAllEnvs()
  })

  it('is refused to non-admins before any check runs', async () => {
    state.admin = false
    const res = await GET(new Request('https://app.example/api/admin/voice/diagnostics'))
    expect(res.status).toBe(403)
    expect(diagnoseModels).not.toHaveBeenCalled()
    expect(platformToolDiagnostics).not.toHaveBeenCalled()
  })

  it('reports the platform tool checks (live only with ?probe=1), and survives their failure', async () => {
    diagnoseModels.mockResolvedValue([])
    platformToolDiagnostics.mockResolvedValue({
      problems: [{ key: 'PLATFORM_TOOLS', severity: 'error', message: '2 of 3 app-routed agents with human transfer do not reference elevenlabs.transfer_tool' }],
      summary: { 'elevenlabs.transfer_tool': { stored: true } },
    })
    const body = await (await GET(new Request('https://app.example/api/admin/voice/diagnostics'))).json()
    expect(body.problems.map((p: { key: string }) => p.key)).toContain('PLATFORM_TOOLS')
    expect(body.platform_tools).toEqual({ 'elevenlabs.transfer_tool': { stored: true } })
    expect(platformToolDiagnostics.mock.calls[0][2]).toEqual({ probe: false })

    await GET(new Request('https://app.example/api/admin/voice/diagnostics?probe=1'))
    expect(platformToolDiagnostics.mock.calls[1][2]).toEqual({ probe: true })

    vi.spyOn(console, 'error').mockImplementation(() => {})
    platformToolDiagnostics.mockRejectedValue(new Error('db down'))
    const failed = await GET(new Request('https://app.example/api/admin/voice/diagnostics'))
    expect(failed.status).toBe(200)
    expect((await failed.json()).platform_tools).toEqual({ error: 'unavailable' })
  })
})

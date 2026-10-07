import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { createLogger } from '@/lib/observability/logger'

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: vi.fn(() => true) }))
vi.mock('@/lib/elevenlabs/api/tools', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/elevenlabs/api/tools')>()
  return { collectPages: real.collectPages, getTool: vi.fn(), toolExecutions: vi.fn(), toolDependentAgents: vi.fn() }
})
vi.mock('./platform-tools', () => ({
  TRANSFER_TOOL_DEGRADED: { code: 'transfer_tool_unavailable', message: 'x' },
  reconcilePlatformTools: vi.fn(),
}))
const syncAgent = vi.fn()
vi.mock('./agent-sync', () => ({ syncAgent: (...a: unknown[]) => syncAgent(...a) }))
const events: Array<Record<string, unknown>> = []
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: (e: Record<string, unknown>) => events.push(e) }))
const rateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }))

import * as toolsApi from '@/lib/elevenlabs/api/tools'
import { reconcilePlatformTools } from './platform-tools'
import {
  checkToolDependents,
  expectedTransferAgents,
  isErrorSpike,
  platformToolDiagnostics,
  runPlatformToolMaintenance,
  summarizeToolExecutions,
} from './platform-tool-monitor'

const NOW = Date.UTC(2026, 9, 7, 12, 0, 0)
const log = createLogger({ component: 'test' })
const TRANSFER = { enabled: true, number: '+40712345678', condition: null, label: null }

function exec(i: number, over: Record<string, unknown> = {}) {
  return { id: `e${i}`, tool_id: 't1', agent_id: `ag${i % 2}`, conversation_id: `c${i}`, timestamp: NOW / 1000 - 3600 + i, latency_secs: 1.2, request_payload: '{"reason":"secret caller text"}', ...over }
}

function seedAgents() {
  state.db = memoryDb({
    agent_provider_resources: [
      { id: 'r1', agent_id: 'a1', org_id: 'o1', provider: 'elevenlabs', status: 'ready', external_id: 'el_1' }, // app-routed, transfer: expected, references
      { id: 'r2', agent_id: 'a2', org_id: 'o1', provider: 'elevenlabs', status: 'ready', external_id: 'el_2' }, // expected, missing
      { id: 'r3', agent_id: 'a3', org_id: 'o2', provider: 'elevenlabs', status: 'ready', external_id: 'el_3' }, // native only: not expected
      { id: 'r4', agent_id: 'a4', org_id: 'o3', provider: 'elevenlabs', status: 'ready', external_id: 'el_4' }, // transfer off
      { id: 'r5', agent_id: 'a5', org_id: 'o4', provider: 'elevenlabs', status: 'ready', external_id: 'el_5' }, // paused
      { id: 'r6', agent_id: 'a6', org_id: 'o5', provider: 'elevenlabs', status: 'ready', external_id: 'el_6' }, // no number yet (app routing by default)
      { id: 'r7', agent_id: 'a7', org_id: 'o1', provider: 'elevenlabs', status: 'degraded', external_id: 'el_7', last_error_code: 'transfer_tool_unavailable' },
      { id: 'r8', agent_id: 'a8', org_id: 'o1', provider: 'cartesia', status: 'ready', external_id: 'ct_8' },
    ],
    agents: [
      { id: 'a1', is_active: true, transfer_settings: TRANSFER },
      { id: 'a2', is_active: true, transfer_settings: TRANSFER },
      { id: 'a3', is_active: true, transfer_settings: TRANSFER },
      { id: 'a4', is_active: true, transfer_settings: { ...TRANSFER, enabled: false } },
      { id: 'a5', is_active: false, transfer_settings: TRANSFER },
      { id: 'a6', is_active: true, transfer_settings: TRANSFER },
    ],
    phone_numbers: [
      { id: 'n1', org_id: 'o1', routing_mode: 'app_routed' },
      { id: 'n2', org_id: 'o1', routing_mode: 'native_elevenlabs' },
      { id: 'n3', org_id: 'o2', routing_mode: 'native_elevenlabs' },
      { id: 'n4', org_id: 'o3', routing_mode: 'app_routed' },
      { id: 'n5', org_id: 'o4', routing_mode: 'app_routed' },
    ],
    platform_resources: [{ key: 'elevenlabs.transfer_tool', provider: 'elevenlabs', external_id: 't1', status: 'ready', details: { config_hash: 'old', auth: 'headers' }, monitor: {} }],
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://voice.example.com')
  vi.stubEnv('ELEVENLABS_TOOL_SECRET', 'tool-key-0123456789abcdef-0123456789abcdef')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  for (const fn of [toolsApi.getTool, toolsApi.toolExecutions, toolsApi.toolDependentAgents]) vi.mocked(fn).mockReset()
  vi.mocked(reconcilePlatformTools).mockReset().mockResolvedValue({ configured: true, secret: { status: 'ok' }, tools: [{ key: 'elevenlabs.transfer_tool', status: 'ok', toolId: 't1', action: 'verified' }] })
  syncAgent.mockReset().mockResolvedValue([{ provider: 'elevenlabs', status: 'ready' }])
  rateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 1, resetAt: NOW })
  events.length = 0
  seedAgents()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('executions summary', () => {
  it('counts the last 24 h (errors, types, last error, agents) and keeps no payload', async () => {
    vi.mocked(toolsApi.toolExecutions).mockImplementation(async (_id, p) =>
      p?.is_error
        ? { executions: [exec(1, { is_error: true, error_type: 'client_timeout', error_message: 'caller said 0712345678' }), exec(2, { is_error: true, error_type: 'external_server' }), exec(3, { is_error: true, error_type: 'weird type!' })], has_more: false }
        : { executions: Array.from({ length: 10 }, (_, i) => exec(i)), has_more: false },
    )
    const s = await summarizeToolExecutions('t1', NOW)
    expect(vi.mocked(toolsApi.toolExecutions).mock.calls[0][1]).toMatchObject({ is_error: true, start_time: NOW / 1000 - 86_400 })
    expect(s).toMatchObject({ total: 10, errors: 3, error_rate: 0.3, error_types: { client_timeout: 1, external_server: 1, unknown: 1 }, agents_with_errors: 2, truncated: false, spike: true })
    expect(s.last_error_at).toBe(new Date((NOW / 1000 - 3600 + 3) * 1000).toISOString())
    expect(JSON.stringify(s)).not.toMatch(/secret caller text|0712345678|conversation|c1/)
  })

  it('a spike needs both a minimum count and a minimum share', () => {
    expect(isErrorSpike(2, 2)).toBe(false)
    expect(isErrorSpike(3, 100)).toBe(false)
    expect(isErrorSpike(3, 10)).toBe(true)
    expect(isErrorSpike(5, 0)).toBe(true)
  })
})

describe('dependent agents', () => {
  it('expects exactly the ready, active, app-routed ElevenLabs agents with transfer configured', async () => {
    const expected = await expectedTransferAgents(state.db as never)
    expect(expected.map((e) => e.agentId).sort()).toEqual(['a1', 'a2', 'a6'])
  })

  it('reports expected agents that do not reference the tool, and unexpected references (counts only)', async () => {
    vi.mocked(toolsApi.toolDependentAgents).mockResolvedValue({ agents: [{ id: 'el_1', type: 'available' }, { id: 'el_6', type: 'available' }, { id: 'el_foreign', type: 'unknown' }], has_more: false })
    expect(await checkToolDependents(state.db as never, 't1')).toEqual({ expected: 3, referencing: 3, missing: 1, unexpected: 1, truncated: false, missing_agent_ids: ['a2'] })
  })

  it('a truncated listing never claims an agent is missing', async () => {
    let i = 0
    vi.mocked(toolsApi.toolDependentAgents).mockImplementation(async () => ({ agents: [{ id: `x${i}` }], next_cursor: `c${i++}`, has_more: true }))
    const res = await checkToolDependents(state.db as never, 't1')
    expect(res).toMatchObject({ truncated: true, missing: 0, missing_agent_ids: [] })
  })
})

describe('maintenance step platform_tools', () => {
  it('reconciles, stores the monitor summary, alerts on a spike and re-syncs agents missing the tool', async () => {
    vi.mocked(toolsApi.toolExecutions).mockImplementation(async (_id, p) =>
      p?.is_error ? { executions: [1, 2, 3, 4].map((i) => exec(i, { is_error: true, error_type: 'customer_auth' })), has_more: false } : { executions: Array.from({ length: 8 }, (_, i) => exec(i)), has_more: false },
    )
    vi.mocked(toolsApi.toolDependentAgents).mockResolvedValue({ agents: [{ id: 'el_1' }, { id: 'el_6' }], has_more: false })
    const report = await runPlatformToolMaintenance(log, NOW)
    expect(reconcilePlatformTools).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(report)).not.toContain('"t1"') // no provider ids in the cron report
    const monitor = state.db!.tables.platform_resources[0].monitor as Record<string, unknown>
    expect(monitor).toMatchObject({ executions: { errors: 4, total: 8, spike: true }, dependents: { expected: 3, missing: 1 }, repaired: 1 })
    expect((monitor.dependents as Record<string, unknown>).missing_agent_ids).toBeUndefined()
    expect(events).toEqual([expect.objectContaining({ system: 'elevenlabs', kind: 'health_check', operation: 'tools.executions', ok: false, errorCode: 'tool_error_spike' })])
    expect(syncAgent).toHaveBeenCalledWith('a2', expect.objectContaining({ providers: ['elevenlabs'], force: true, noCreate: true }))
  })

  it('skips monitoring for a tool the reconcile could not obtain, and does nothing when ElevenLabs is not configured', async () => {
    vi.mocked(reconcilePlatformTools).mockResolvedValue({ configured: true, secret: { status: 'error', code: 'upstream' }, tools: [{ key: 'elevenlabs.transfer_tool', status: 'error', code: 'upstream' }] })
    await runPlatformToolMaintenance(log, NOW)
    expect(toolsApi.toolExecutions).not.toHaveBeenCalled()
    const el = await import('@/lib/elevenlabs/client')
    vi.mocked(el.isConfigured).mockReturnValueOnce(false)
    expect(await runPlatformToolMaintenance(log, NOW)).toEqual({ skipped: 'not_configured' })
  })
})

describe('admin diagnostics', () => {
  it('DB only by default: degraded agents, config drift and missing monitoring are problems; no provider call, no ids', async () => {
    const res = await platformToolDiagnostics(state.db as never, log)
    expect(toolsApi.getTool).not.toHaveBeenCalled()
    const messages = res.problems.map((p) => p.message).join('\n')
    expect(messages).toMatch(/1 agent\(s\) cannot transfer calls/)
    expect(messages).toMatch(/older configuration/)
    expect(messages).toMatch(/no monitoring data yet/)
    expect(res.summary).toMatchObject({ agents_without_transfer_tool: 1, tool_secret: { configured: true, stored: false }, 'elevenlabs.transfer_tool': { stored: true, header_auth: true, config_current: false } })
    expect(JSON.stringify(res)).not.toContain('tool-key-0123456789')
    expect(JSON.stringify(res.summary)).not.toContain('"t1"')
  })

  it('?probe=1 checks live (usage, executions, dependents) and reports a missing tool; rate limited', async () => {
    vi.mocked(toolsApi.getTool).mockResolvedValue({ id: 't1', tool_config: {}, usage_stats: { total_calls: 12, avg_latency_secs: 0.8 } })
    vi.mocked(toolsApi.toolExecutions).mockResolvedValue({ executions: [], has_more: false })
    vi.mocked(toolsApi.toolDependentAgents).mockResolvedValue({ agents: [{ id: 'el_1' }, { id: 'el_2' }, { id: 'el_6' }], has_more: false })
    const res = await platformToolDiagnostics(state.db as never, log, { probe: true })
    expect(res.summary['elevenlabs.transfer_tool']).toMatchObject({ usage: { total_calls: 12, avg_latency_secs: 0.8 }, monitor: { live: true, executions: { errors: 0 }, dependents: { missing: 0 } } })
    expect(JSON.stringify(res.summary)).not.toMatch(/missing_agent_ids/)

    const { ProviderError } = await import('./errors')
    vi.mocked(toolsApi.getTool).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'tools.get' }))
    const missing = await platformToolDiagnostics(state.db as never, log, { probe: true })
    expect(missing.problems.some((p) => p.severity === 'error' && /no longer exists/.test(p.message))).toBe(true)

    rateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: NOW })
    vi.mocked(toolsApi.getTool).mockClear()
    const limited = await platformToolDiagnostics(state.db as never, log, { probe: true })
    expect(limited.summary.probe).toBe('rate_limited')
    expect(toolsApi.getTool).not.toHaveBeenCalled()
  })

  it('reports a stored error spike and missing tool references from the last maintenance run', async () => {
    state.db!.tables.platform_resources[0].monitor = {
      checked_at: new Date(NOW - 3_600_000).toISOString(),
      executions: { total: 10, errors: 5, spike: true, error_types: { customer_auth: 5 } },
      dependents: { expected: 3, missing: 2, truncated: false },
    }
    const res = await platformToolDiagnostics(state.db as never, log)
    const messages = res.problems.map((p) => p.message).join('\n')
    expect(messages).toMatch(/5 of 10 executions failed.*customer_auth/)
    expect(messages).toMatch(/2 of 3 app-routed agents/)
    expect(messages).not.toMatch(/has not run/)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// Platform regression suite (slice G): idempotent sync with ids in
// platform_resources, environment-scoped names, adoption/recreation, runs on
// the canary or a picked agent only, stored results without conversation
// content.

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => true }))
const api = vi.hoisted(() => ({
  createAgentTest: vi.fn(),
  getAgentTest: vi.fn(),
  updateAgentTest: vi.fn(),
  listAgentTests: vi.fn(),
  runAgentTests: vi.fn(),
  getTestInvocation: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/api/agent-testing', () => api)
const claim = vi.hoisted(() => ({ result: 'claimed' as 'claimed' | 'not_due' | 'unavailable' }))
vi.mock('./maintenance-state', () => ({ claimStep: async () => claim.result }))
const candidate = vi.hoisted(() => ({ body: vi.fn() }))
vi.mock('./adapters', () => ({ elevenLabsCandidateBody: (...a: unknown[]) => candidate.body(...a) }))
vi.mock('./agent-spec', () => ({ loadAgentRow: async (_db: unknown, id: string) => ({ id }), buildAgentSpec: async () => ({ spec: true }) }))

import { RequestError } from '@/lib/api/http'
import { createLogger } from '@/lib/observability/logger'
import { PLATFORM_AGENT_CONFIG_VERSION } from '@/lib/elevenlabs/agent-config'
import { ProviderError } from './errors'
import {
  AGENT_TEST_SUITE_VERSION,
  PLATFORM_TEST_KEYS,
  platformTestSuite,
  pollInvocation,
  resolveRunTarget,
  runPlatformTests,
  summarizeInvocation,
  syncPlatformTests,
  testBodyHash,
  testName,
  testRunStatus,
} from './agent-tests'

const log = createLogger({ component: 'test' })
const LOCAL_AGENT = 'a1111111-1111-4111-8111-111111111111'
const ORG = '11111111-1111-4111-8111-111111111111'

function seed(extra: Record<string, Record<string, unknown>[]> = {}) {
  state.db = memoryDb(
    {
      platform_resources: [{ key: 'elevenlabs.transfer_tool', provider: 'elevenlabs', external_id: 'tool_transfer_1', status: 'ready', details: {} }],
      agent_provider_resources: [{ id: 'r1', org_id: ORG, agent_id: LOCAL_AGENT, provider: 'elevenlabs', external_id: 'agent_el_1', status: 'ready' }],
      agent_test_runs: [],
      ...extra,
    },
    { unique: { platform_resources: [['key']], agent_test_runs: [['invocation_id']] } },
  )
  return state.db
}

/** Rows a previous sync stored for the current suite. */
function syncedRows() {
  return platformTestSuite({ transferToolId: 'tool_transfer_1' }).map((d, i) => ({
    key: `elevenlabs.tests.${d.key}`,
    provider: 'elevenlabs',
    external_id: `test_${i}`,
    status: 'ready',
    details: { suite_version: AGENT_TEST_SUITE_VERSION, hash: testBodyHash(d.body as NonNullable<typeof d.body>) },
  }))
}

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  candidate.body.mockReset()
  claim.result = 'claimed'
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('ELEVENLABS_TEST_AGENT_ID', '')
  api.listAgentTests.mockResolvedValue({ tests: [], has_more: false })
  let n = 0
  api.createAgentTest.mockImplementation(async () => ({ id: `new_${++n}` }))
  api.updateAgentTest.mockResolvedValue({ id: 'x' })
  api.getAgentTest.mockResolvedValue({ id: 'x', name: 'x' })
})

describe('suite definition', () => {
  it('covers the platform promises with environment-scoped names, never as a telephony source', () => {
    const suite = platformTestSuite({ transferToolId: 'tool_transfer_1' })
    expect(suite.map((d) => d.key)).toEqual([...PLATFORM_TEST_KEYS])
    for (const d of suite) {
      expect(d.body?.name).toBe(`ntv-platform preview ${d.key}`)
      // A webhook from a test run must classify as a test call (never billed, no workflows).
      expect(d.body?.conversation_initiation_source).toBeUndefined()
    }
    expect(testName('ai_disclosure', 'production')).toBe('ntv-platform production ai_disclosure')
    const transfer = suite.find((d) => d.key === 'transfer_to_human')?.body
    expect(transfer).toMatchObject({ type: 'tool', tool_call_parameters: { referenced_tool: { id: 'tool_transfer_1', type: 'webhook' }, verify_absence: false } })
    expect(suite.find((d) => d.key === 'after_hours')?.body?.dynamic_variables).toMatchObject({ after_hours: 'true' })
    expect(suite.find((d) => d.key === 'ai_disclosure')?.body?.dynamic_variables).toMatchObject({ after_hours: 'false', ntv_routing_mode: 'app_routed' })
  })

  it('skips the transfer test without the platform transfer tool', () => {
    const t = platformTestSuite({ transferToolId: null }).find((d) => d.key === 'transfer_to_human')
    expect(t).toMatchObject({ body: null })
    expect(t?.skipped).toMatch(/transfer tool/)
  })

  it('hashes bodies deterministically', () => {
    const [a] = platformTestSuite({ transferToolId: 'x' })
    expect(testBodyHash(a.body as NonNullable<typeof a.body>)).toBe(testBodyHash(JSON.parse(JSON.stringify(a.body))))
  })
})

describe('syncPlatformTests', () => {
  it('dry run compares with the stored rows only (no provider call)', async () => {
    const rows = syncedRows()
    rows[0].details.hash = 'stale'
    seed({ platform_resources: [{ key: 'elevenlabs.transfer_tool', provider: 'elevenlabs', external_id: 'tool_transfer_1', status: 'ready', details: {} }, ...rows.slice(0, 2)] })
    const report = await syncPlatformTests({ dryRun: true, log })
    expect(report.tests.map((t) => t.action)).toEqual(['would_update', 'unchanged', 'would_create', 'would_create', 'would_create', 'would_create'])
    expect(api.createAgentTest).not.toHaveBeenCalled()
    expect(api.getAgentTest).not.toHaveBeenCalled()
  })

  it('creates every test once and stores ids with the suite version and hash; a second sync is a no-op', async () => {
    const db = seed()
    const first = await syncPlatformTests({ dryRun: false, log })
    expect(first.tests.every((t) => t.action === 'created')).toBe(true)
    expect(api.createAgentTest).toHaveBeenCalledTimes(PLATFORM_TEST_KEYS.length)
    const stored = db.tables.platform_resources.filter((r) => String(r.key).startsWith('elevenlabs.tests.'))
    expect(stored).toHaveLength(PLATFORM_TEST_KEYS.length)
    expect(stored[0]).toMatchObject({ provider: 'elevenlabs', status: 'ready', details: { suite_version: AGENT_TEST_SUITE_VERSION } })

    api.createAgentTest.mockClear()
    const second = await syncPlatformTests({ dryRun: false, log })
    expect(second.tests.every((t) => t.action === 'unchanged')).toBe(true)
    expect(api.createAgentTest).not.toHaveBeenCalled()
    expect(api.updateAgentTest).not.toHaveBeenCalled()
  })

  it('PUTs a changed test, recreates one deleted in the dashboard, adopts one left by a crash', async () => {
    const rows = syncedRows()
    rows[0].details.hash = 'old'
    seed({ platform_resources: [{ key: 'elevenlabs.transfer_tool', provider: 'elevenlabs', external_id: 'tool_transfer_1', status: 'ready', details: {} }, rows[0], rows[1]] })
    api.getAgentTest.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'agent_testing.get', code: 'not_found', status: 404 }))
    const leftoverName = testName('transfer_to_human')
    api.listAgentTests.mockImplementation(async ({ search }: { search: string }) => ({
      tests: search === leftoverName ? [{ id: 'leftover_1', name: leftoverName, type: 'tool' }, { id: 'other_env', name: `${leftoverName} copy`, type: 'tool' }] : [],
      has_more: false,
    }))
    const report = await syncPlatformTests({ dryRun: false, log })
    const byKey = Object.fromEntries(report.tests.map((t) => [t.key, t]))
    expect(byKey.ai_disclosure).toMatchObject({ action: 'updated', id: 'test_0' })
    expect(byKey.refuse_card_numbers.action).toBe('recreated')
    expect(byKey.transfer_to_human).toMatchObject({ action: 'adopted', id: 'leftover_1' })
    expect(api.updateAgentTest).toHaveBeenCalledWith('leftover_1', expect.objectContaining({ name: leftoverName }))
  })

  it('refuses a second sync within a minute, and reports per-test failures', async () => {
    seed()
    claim.result = 'not_due'
    await expect(syncPlatformTests({ dryRun: false, log })).rejects.toBeInstanceOf(RequestError)
    claim.result = 'claimed'
    api.createAgentTest.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'agent_testing.create', code: 'permission', status: 403 }))
    const report = await syncPlatformTests({ dryRun: false, log })
    expect(report.tests[0]).toMatchObject({ action: 'error', reason: 'permission' })
    expect(report.tests.slice(1).every((t) => t.action === 'created')).toBe(true)
  })
})

describe('runs', () => {
  it('summarizes an invocation without conversation content', () => {
    const s = summarizeInvocation(
      {
        test_runs: [
          { test_run_id: '1', test_id: 't1', status: 'passed', credits_used: 3, condition_result: { result: 'success' }, test_name: 'a' },
          { test_run_id: '2', test_id: 't2', status: 'failed', credits_used: 2, test_name: 'b', ...({ agent_responses: [{ message: 'secret business content' }] } as object) },
        ],
      },
      new Map([['t1', 'ai_disclosure']]),
    )
    expect(s).toMatchObject({ status: 'failed', passed: 1, failed: 1, pending: 0, credits_used: 5 })
    expect(s.results[0]).toEqual({ key: 'ai_disclosure', name: 'a', status: 'passed', result: 'success', credits_used: 3 })
    expect(JSON.stringify(s)).not.toContain('secret business content')
    expect(summarizeInvocation({ test_runs: [{ test_run_id: '1', test_id: 't', status: 'pending' }] }).status).toBe('pending')
    expect(summarizeInvocation({ test_runs: [{ test_run_id: '1', test_id: 't', status: 'pending' }], cancelled: true }).status).toBe('cancelled')
    expect(summarizeInvocation({ test_runs: [] }).status).toBe('error')
  })

  it('targets the canary from the env or an agent picked by its local id only', async () => {
    seed()
    expect(await resolveRunTarget(null)).toBeNull()
    vi.stubEnv('ELEVENLABS_TEST_AGENT_ID', 'agent_canary_1')
    expect(await resolveRunTarget(null)).toEqual({ externalId: 'agent_canary_1', localAgentId: null, orgId: null })
    vi.stubEnv('ELEVENLABS_TEST_AGENT_ID', 'bad id&x=1')
    expect(await resolveRunTarget(null)).toBeNull()
    expect(await resolveRunTarget(LOCAL_AGENT)).toEqual({ externalId: 'agent_el_1', localAgentId: LOCAL_AGENT, orgId: ORG })
    expect(await resolveRunTarget('b1111111-1111-4111-8111-111111111111')).toBeNull()
  })

  it('refuses to run tests that are not synced for the current suite', async () => {
    seed()
    await expect(runPlatformTests({ target: { externalId: 'agent_canary_1', localAgentId: null, orgId: null }, candidate: false, startedBy: 'admin_token', waitMs: 0, log })).rejects.toMatchObject({ status: 409 })
    expect(api.runAgentTests).not.toHaveBeenCalled()
  })

  it('runs the synced suite, stores the run and polls it', async () => {
    const db = seed({ platform_resources: [{ key: 'elevenlabs.transfer_tool', provider: 'elevenlabs', external_id: 'tool_transfer_1', status: 'ready', details: {} }, ...syncedRows()] })
    api.runAgentTests.mockResolvedValue({ id: 'inv_1', test_runs: [{ test_run_id: 'r0', test_id: 'test_0', status: 'pending' }] })
    api.getTestInvocation.mockResolvedValue({ id: 'inv_1', test_runs: PLATFORM_TEST_KEYS.map((_, i) => ({ test_run_id: `r${i}`, test_id: `test_${i}`, status: 'passed', credits_used: 1 })) })
    const report = await runPlatformTests({ target: { externalId: 'agent_canary_1', localAgentId: null, orgId: null }, candidate: false, startedBy: 'admin_token', waitMs: 10_000, log })
    expect(api.runAgentTests).toHaveBeenCalledWith('agent_canary_1', { testIds: PLATFORM_TEST_KEYS.map((_, i) => `test_${i}`), agentConfigOverride: null }, { orgId: null, agentId: null })
    expect(report).toMatchObject({ invocation_id: 'inv_1', status: 'passed', passed: PLATFORM_TEST_KEYS.length, candidate: false, platform_version: PLATFORM_AGENT_CONFIG_VERSION })
    expect(db.tables.agent_test_runs[0]).toMatchObject({ invocation_id: 'inv_1', agent_external_id: 'agent_canary_1', status: 'passed', suite_version: AGENT_TEST_SUITE_VERSION })
    expect(db.tables.agent_test_runs[0].completed_at).toBeTruthy()
  })

  it('a candidate run sends the body this deployment would push (minus transcript redaction)', async () => {
    seed({ platform_resources: [{ key: 'elevenlabs.transfer_tool', provider: 'elevenlabs', external_id: 'tool_transfer_1', status: 'ready', details: {} }, ...syncedRows()] })
    candidate.body.mockResolvedValue({
      name: 'n',
      tags: ['t'],
      conversation_config: { agent: { prompt: { prompt: 'new template' } } },
      platform_settings: { privacy: { record_voice: true, conversation_history_redaction: { enabled: true } }, auth: { enable_auth: true } },
    })
    api.runAgentTests.mockResolvedValue({ id: 'inv_2', test_runs: [{ test_run_id: 'r', test_id: 'test_0', status: 'passed' }] })
    await expect(runPlatformTests({ target: { externalId: 'agent_canary_1', localAgentId: null, orgId: null }, candidate: true, startedBy: 'x', waitMs: 0, log })).rejects.toMatchObject({ status: 400 })
    await runPlatformTests({ target: { externalId: 'agent_el_1', localAgentId: LOCAL_AGENT, orgId: ORG }, candidate: true, startedBy: 'x', waitMs: 0, log })
    const [, params, ctx] = api.runAgentTests.mock.calls[0] as [string, { agentConfigOverride: Record<string, unknown> }, unknown]
    expect(params.agentConfigOverride).toEqual({
      conversation_config: { agent: { prompt: { prompt: 'new template' } } },
      platform_settings: { privacy: { record_voice: true }, auth: { enable_auth: true } },
    })
    expect(ctx).toEqual({ orgId: ORG, agentId: LOCAL_AGENT })
  })

  it('polls with backoff until nothing is pending or the wait is spent', async () => {
    const db = seed({ agent_test_runs: [{ invocation_id: 'inv_3', status: 'pending' }] })
    api.getTestInvocation
      .mockResolvedValueOnce({ id: 'inv_3', test_runs: [{ test_run_id: 'r', test_id: 't', status: 'pending' }] })
      .mockResolvedValueOnce({ id: 'inv_3', test_runs: [{ test_run_id: 'r', test_id: 't', status: 'failed' }] })
    const waits: number[] = []
    const s = await pollInvocation('inv_3', { waitMs: 60_000, log, sleepFn: async (ms) => waits.push(ms) })
    expect(s.status).toBe('failed')
    expect(waits).toEqual([2000])
    expect(db.tables.agent_test_runs[0]).toMatchObject({ status: 'failed', failed: 1 })
  })

  it('status refreshes only runs started here', async () => {
    seed({ agent_test_runs: [{ invocation_id: 'inv_4', status: 'pending', created_at: '2026-10-07T10:00:00Z' }] })
    api.getTestInvocation.mockResolvedValue({ id: 'inv_4', test_runs: [{ test_run_id: 'r', test_id: 't', status: 'passed' }] })
    expect(await testRunStatus({ invocationId: 'inv_unknown', log })).toBeNull()
    expect(api.getTestInvocation).not.toHaveBeenCalled()
    const status = await testRunStatus({ invocationId: 'inv_4', log })
    expect(status?.runs[0]).toMatchObject({ invocation_id: 'inv_4', status: 'passed' })
    expect(status?.tests).toHaveLength(PLATFORM_TEST_KEYS.length)
  })
})

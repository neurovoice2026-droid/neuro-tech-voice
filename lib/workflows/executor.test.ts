import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeliveryOptions, DeliveryResult } from './webhook'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const deliveries: DeliveryOptions[] = []
let deliveryResults: DeliveryResult[] = []

vi.mock('./webhook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./webhook')>()
  return {
    ...actual,
    deliverJson: vi.fn(async (options: DeliveryOptions) => {
      deliveries.push(options)
      return deliveryResults.shift() ?? { ok: true, attempts: 1, outcome: { kind: 'response', status: 200 }, duration_ms: 3 }
    }),
  }
})

const sendSms = vi.fn()
vi.mock('@/lib/twilio/sms', () => ({ sendSms: (...args: unknown[]) => sendSms(...args) }))

vi.mock('./google', () => ({
  sendGmail: vi.fn(async () => ({ success: true, attempts: 1, message: 'Email sent.' })),
  appendSheetRow: vi.fn(async () => ({ success: true, attempts: 1, message: 'Row added.' })),
  createFollowUpEvent: vi.fn(async () => ({ success: true, attempts: 1, message: 'Event added.' })),
  createCallDoc: vi.fn(async () => ({ success: true, attempts: 1, message: 'Doc created.' })),
  saveTranscriptToDrive: vi.fn(async () => ({ success: true, attempts: 1, message: 'Saved.' })),
}))

const claimed = new Map<string, number>()
vi.mock('@/lib/kv', () => ({
  kvIncr: vi.fn(async (key: string) => {
    const next = (claimed.get(key) ?? 0) + 1
    claimed.set(key, next)
    return next
  }),
}))

// A tiny stand-in for the Supabase query builder: records every call chain and
// answers from per-table fixtures.
interface Recorded {
  table: string
  op: string
  payload?: unknown
  filters: [string, unknown][]
}
const recorded: Recorded[] = []
const rpcCalls: { fn: string; args: unknown }[] = []
let fixtures: Record<string, unknown> = {}

function builder(table: string) {
  const entry: Recorded = { table, op: 'select', filters: [] }
  recorded.push(entry)
  const result = () => {
    if (entry.op === 'insert') return { data: { id: 'run-1' }, error: null }
    if (entry.op === 'update') return { data: [{ id: 'x' }], error: null }
    return { data: fixtures[table] ?? null, error: null }
  }
  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: (payload: unknown) => ((entry.op = 'insert'), (entry.payload = payload), chain),
    update: (payload: unknown) => ((entry.op = 'update'), (entry.payload = payload), chain),
    eq: (column: string, value: unknown) => (entry.filters.push([column, value]), chain),
    is: (column: string, value: unknown) => (entry.filters.push([column, value]), chain),
    order: () => chain,
    limit: () => chain,
    single: async () => result(),
    maybeSingle: async () => result(),
    then: (resolve: (value: unknown) => void) => resolve(result()),
  }
  return chain
}

const adminClient = {
  from: (table: string) => builder(table),
  rpc: async (fn: string, args: unknown) => {
    rpcCalls.push({ fn, args })
    return { error: null }
  },
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminClient }))

const { executeWorkflows, runWorkflowSteps, runWorkflowTest } = await import('./executor')
const { sampleCallData } = await import('./payload')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = '11111111-2222-4333-8444-555555555555'
const CALL_ID = '99999999-8888-4777-8666-555555555555'
const org = { id: ORG_ID, name: 'Acme Dental', timezone: 'Europe/Bucharest', plan: 'pro' as const }

function workflow(actions: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    org_id: ORG_ID,
    name: 'Test workflow',
    trigger: 'call_ended' as const,
    trigger_config: {},
    actions,
    enabled: true,
    signing_secret: 'a'.repeat(64),
    ...overrides,
  }
}

const webhookStep = { id: 'w1', type: 'send_webhook', config: { url: 'https://hooks.example.com/in' } }
const slackStep = { id: 's1', type: 'notify_slack', config: { webhook_url: 'https://hooks.slack.com/services/T/B/x' } }
const smsStep = { id: 'm1', type: 'send_sms', config: { message: 'Thanks for calling {{business_name}}' } }
const tagStep = { id: 't1', type: 'add_tag', config: { tag: 'follow-up' } }

function env(actions: unknown[], overrides: Partial<Parameters<typeof runWorkflowSteps>[0]> = {}) {
  return {
    admin: null,
    org,
    call: { ...sampleCallData(), call_id: CALL_ID },
    workflow: workflow(actions),
    trigger: 'call_ended' as const,
    test: false,
    deadline: Date.now() + 60_000,
    ...overrides,
  }
}

beforeEach(() => {
  deliveries.length = 0
  deliveryResults = []
  recorded.length = 0
  rpcCalls.length = 0
  claimed.clear()
  fixtures = {}
  sendSms.mockReset()
})

// ─── Steps ────────────────────────────────────────────────────────────────────

describe('runWorkflowSteps', () => {
  it('runs steps in order and skips everything after the first failure', async () => {
    deliveryResults = [{ ok: false, attempts: 3, outcome: { kind: 'response', status: 500 }, duration_ms: 5000 }]
    const { success, results } = await runWorkflowSteps(env([webhookStep, slackStep, tagStep]))
    expect(success).toBe(false)
    expect(results.map((r) => [r.action_id, r.success, r.skipped ?? false])).toEqual([
      ['w1', false, false],
      ['s1', false, true],
      ['t1', false, true],
    ])
    expect(results[0]).toMatchObject({ attempts: 3, status_code: 500 })
    expect(deliveries).toHaveLength(1)
  })

  it('signs webhook deliveries with the workflow secret and a stable delivery id', async () => {
    await runWorkflowSteps(env([webhookStep]))
    const [delivery] = deliveries
    const first = delivery.headers(1)
    const second = delivery.headers(2)
    expect(first['X-NTV-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
    expect(first['X-NTV-Delivery']).toBe(second['X-NTV-Delivery'])
    expect(second['X-NTV-Attempt']).toBe('2')
    const body = JSON.parse(delivery.body)
    expect(body).toMatchObject({ event: 'workflow_triggered', test: false, call: { id: CALL_ID }, workflow: { name: 'Test workflow' } })
  })

  it('fails a webhook step when the workflow has no signing secret', async () => {
    const { results } = await runWorkflowSteps(env([webhookStep], { workflow: workflow([webhookStep], { signing_secret: null }) }))
    expect(results[0]).toMatchObject({ success: false })
    expect(deliveries).toHaveLength(0)
  })

  it('escapes call data in Slack messages and marks tests', async () => {
    const call = { ...sampleCallData(), call_id: CALL_ID, summary: 'Said <!channel> & hung up' }
    await runWorkflowSteps(env([slackStep], { call, test: true }))
    expect(JSON.parse(deliveries[0].body).text).toBe(
      '[Test] :telephone_receiver: inbound call from +15555550142 (positive). Said &lt;!channel&gt; &amp; hung up'
    )
  })

  it('in a test, runs only webhook and Slack steps', async () => {
    const { success, results } = await runWorkflowSteps(env([smsStep, webhookStep, tagStep], { test: true }))
    expect(success).toBe(true)
    expect(results.map((r) => [r.action_id, r.skipped ?? false])).toEqual([
      ['m1', true],
      ['w1', false],
      ['t1', true],
    ])
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('turns a broken saved step into a fixable failure', async () => {
    const broken = { id: 'b1', type: 'send_webhook', config: { url: 'http://not-https.example.com' } }
    const { results } = await runWorkflowSteps(env([broken, slackStep]))
    expect(results[0].message).toMatch(/needs attention/)
    expect(results[1].skipped).toBe(true)
  })

  describe('send_sms', () => {
    it('texts the caller with the rendered template', async () => {
      sendSms.mockResolvedValue({ ok: true, sid: 'SM1' })
      const { results } = await runWorkflowSteps(env([smsStep]))
      expect(sendSms).toHaveBeenCalledWith({ orgId: ORG_ID, to: '+15555550142', body: 'Thanks for calling Acme Dental', kind: 'custom', callId: CALL_ID })
      expect(results[0].success).toBe(true)
    })

    it('skips without failing when the number is hidden or the caller opted out', async () => {
      const hidden = { ...sampleCallData(), caller_number: null, from_number: 'anonymous' }
      const first = await runWorkflowSteps(env([smsStep, slackStep], { call: hidden }))
      expect(first.results[0]).toMatchObject({ success: true, skipped: true })
      expect(first.results[1].skipped).toBeUndefined()
      expect(sendSms).not.toHaveBeenCalled()

      sendSms.mockResolvedValue({ ok: false, reason: 'opted_out' })
      const second = await runWorkflowSteps(env([smsStep]))
      expect(second.results[0]).toMatchObject({ success: true, skipped: true })
    })

    it('fails when texting is not set up', async () => {
      sendSms.mockResolvedValue({ ok: false, reason: 'no_sms_number' })
      const { success } = await runWorkflowSteps(env([smsStep]))
      expect(success).toBe(false)
    })
  })

  it('stops starting steps once the time budget is spent', async () => {
    const { results } = await runWorkflowSteps(env([slackStep], { deadline: Date.now() - 1 }))
    expect(results[0]).toMatchObject({ success: false })
    expect(deliveries).toHaveLength(0)
  })

  it('runWorkflowTest records nothing', async () => {
    await runWorkflowTest({ workflow: workflow([slackStep]), org, call: sampleCallData() })
    expect(recorded).toHaveLength(0)
    expect(rpcCalls).toHaveLength(0)
  })
})

// ─── executeWorkflows ─────────────────────────────────────────────────────────

describe('executeWorkflows', () => {
  const orgRow = { id: ORG_ID, name: 'Acme Dental', timezone: 'Europe/Bucharest', plan: 'pro' }

  it('runs matching workflows, records the run and bumps counters atomically', async () => {
    fixtures = { workflows: [workflow([slackStep])], organizations: orgRow }
    await executeWorkflows(ORG_ID, 'call_ended', { ...sampleCallData(), call_id: null })
    expect(deliveries).toHaveLength(1)
    const insert = recorded.find((r) => r.table === 'workflow_runs' && r.op === 'insert')
    const update = recorded.find((r) => r.table === 'workflow_runs' && r.op === 'update')
    expect(insert?.payload).toMatchObject({ status: 'running', call_id: null })
    expect(update?.payload).toMatchObject({ status: 'completed', error: null })
    expect(rpcCalls).toEqual([{ fn: 'increment_workflow_counters', args: { p_workflow_id: workflow([]).id, p_success: true } }])
    // Every workflow query is scoped to the organisation.
    expect(recorded.find((r) => r.table === 'workflows')?.filters).toContainEqual(['org_id', ORG_ID])
  })

  it('runs a workflow only once per call', async () => {
    const call = {
      id: CALL_ID, org_id: ORG_ID, agent_id: null, provider_call_id: 'ac_1', elevenlabs_conversation_id: null,
      caller_number: '+15555550142', from_number: '+15555550142', to_number: null, direction: 'inbound',
      duration_seconds: 30, status: 'completed', sentiment: 'neutral', summary: 's', outcome: 'answered', intent: null,
      tags: [], extracted: {}, transcript: [], started_at: null, ended_at: null, is_test: false, caller_name: null,
    }
    fixtures = { workflows: [workflow([slackStep])], organizations: orgRow, calls: call }
    await executeWorkflows(ORG_ID, 'call_ended', { call_id: CALL_ID })
    await executeWorkflows(ORG_ID, 'call_ended', { call_id: CALL_ID })
    expect(deliveries).toHaveLength(1)
    expect(JSON.parse(deliveries[0].body).text).toContain('+15555550142')
  })

  it('never runs for test calls or for another organisation’s context', async () => {
    fixtures = { workflows: [workflow([slackStep])], organizations: orgRow }
    await executeWorkflows(ORG_ID, 'call_ended', { ...sampleCallData(), call_id: null, is_test: true })
    await executeWorkflows(ORG_ID, 'call_ended', { org_id: '00000000-0000-4000-8000-000000000000' })
    await executeWorkflows('not-a-uuid', 'call_ended', {})
    expect(deliveries).toHaveLength(0)
  })

  it('checks sentiment and keywords before running', async () => {
    fixtures = {
      workflows: [workflow([slackStep], { trigger: 'keyword_detected', trigger_config: { keyword: 'urgenta, refund' } })],
      organizations: orgRow,
    }
    const turns = (message: string) => [{ role: 'user', message }]
    await executeWorkflows(ORG_ID, 'keyword_detected', { ...sampleCallData(), call_id: null, transcript: turns('Vreau o programare') })
    expect(deliveries).toHaveLength(0)
    await executeWorkflows(ORG_ID, 'keyword_detected', { ...sampleCallData(), call_id: null, transcript: turns('Este o urgență!') })
    expect(deliveries).toHaveLength(1)

    fixtures = { workflows: [workflow([slackStep], { trigger: 'sentiment_negative' })], organizations: orgRow }
    await executeWorkflows(ORG_ID, 'sentiment_negative', { ...sampleCallData(), call_id: null, sentiment: 'positive' })
    expect(deliveries).toHaveLength(1)
    await executeWorkflows(ORG_ID, 'sentiment_negative', { ...sampleCallData(), call_id: null, sentiment: 'negative' })
    expect(deliveries).toHaveLength(2)
  })
})

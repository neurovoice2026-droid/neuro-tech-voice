import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// send_webhook and notify_slack call a URL the tenant typed: every request goes
// through the SSRF guard (DNS mocked here, fetch stubbed), never straight to fetch.

const state = vi.hoisted(() => ({ db: null as unknown, addresses: ['93.184.216.34'] as string[] }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn(async () => state.addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))) },
}))

import { executeWorkflows, type CallContext } from './executor'

const CALL = '55555555-5555-4555-8555-555555555555'
let db: MemoryDb
const fetchMock = vi.fn()

function ctx(over: Partial<CallContext> = {}): CallContext {
  return {
    call_id: CALL,
    org_id: 'org1',
    conversation_id: 'conv1',
    caller_number: '+40799999999',
    direction: 'inbound',
    duration_seconds: 60,
    status: 'completed',
    sentiment: null,
    summary: 'Asked about prices',
    transcript: [],
    started_at: '2026-10-07T07:00:00Z',
    business_name: 'Smile Clinic',
    ...over,
  }
}

function seedStep(type: 'send_webhook' | 'notify_slack', config: Record<string, string>) {
  db = memoryDb({
    workflows: [{ id: 'wf1', org_id: 'org1', trigger: 'call_ended', trigger_config: {}, enabled: true, runs: 0, successful_runs: 0, actions: [{ id: 'a0', type, config }] }],
  })
  state.db = db
}

const run = () => db.tables.workflow_runs[0] as { status: string; error?: string; results: Array<{ success: boolean; message: string }> }

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.addresses = ['93.184.216.34']
  fetchMock.mockReset().mockImplementation(async () => new Response('ok', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

describe('workflow action send_webhook', () => {
  it('delivers to a public https URL with a timeout and without following redirects', async () => {
    seedStep('send_webhook', { url: 'https://example.com/hook?call={{call_id}}' })
    await executeWorkflows('call_ended', ctx())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://example.com/hook?call=${CALL}`)
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(init.body as string)).toMatchObject({ event: 'workflow_triggered', call: { id: CALL } })
    expect(run()).toMatchObject({ status: 'completed' })
    expect(run().results[0].message).toBe('Webhook sent (200)')
  })

  it('never fetches http, loopback, link-local metadata or private addresses', async () => {
    for (const url of ['http://example.com/hook', 'https://127.0.0.1:443/', 'https://169.254.169.254/latest/meta-data/', 'https://10.0.0.8/hook', 'https://[::1]/hook']) {
      seedStep('send_webhook', { url })
      await executeWorkflows('call_ended', ctx())
      expect(run(), url).toMatchObject({ status: 'failed', error: expect.stringMatching(/^Webhook error: URL not allowed \(/) })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('checks the URL after interpolation, so call data cannot pick an internal host', async () => {
    // Saving refuses a template in the host, but a row written directly under RLS skips that check.
    seedStep('send_webhook', { url: 'https://{{summary}}/hook' })
    await executeWorkflows('call_ended', ctx({ summary: '169.254.169.254' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(run()).toMatchObject({ status: 'failed', error: 'Webhook error: URL not allowed (private or reserved address)' })
  })

  it('never fetches a host whose DNS answer is private', async () => {
    state.addresses = ['93.184.216.34', '192.168.1.10']
    seedStep('send_webhook', { url: 'https://rebind.example.com/hook' })
    await executeWorkflows('call_ended', ctx())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(run()).toMatchObject({ status: 'failed', error: 'Webhook error: URL not allowed (host resolves to a private or reserved address)' })
  })

  it('does not follow a redirect to an internal address', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 307, headers: { location: 'https://169.254.169.254/' } }))
    seedStep('send_webhook', { url: 'https://example.com/hook' })
    await executeWorkflows('call_ended', ctx())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(run()).toMatchObject({ status: 'failed', error: expect.stringContaining('redirect (307)') })
  })

  it('fails the step on a timeout instead of waiting for the endpoint', async () => {
    fetchMock.mockImplementation(async () => {
      throw new DOMException('timed out', 'TimeoutError')
    })
    seedStep('send_webhook', { url: 'https://slow.example.com/hook' })
    await executeWorkflows('call_ended', ctx())
    expect(run()).toMatchObject({ status: 'failed', error: 'Webhook error: no answer within 10s' })
  })

  it('refuses methods that cannot carry the JSON body', async () => {
    seedStep('send_webhook', { url: 'https://example.com/hook', method: 'get' })
    await executeWorkflows('call_ended', ctx())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(run()).toMatchObject({ status: 'failed', error: 'Webhook error: the method must be POST, PUT or PATCH' })
  })
})

describe('workflow action notify_slack', () => {
  it('posts to hooks.slack.com through the guard', async () => {
    seedStep('notify_slack', { webhook_url: 'https://hooks.slack.com/services/T0/B0/x' })
    await executeWorkflows('call_ended', ctx())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://hooks.slack.com/services/T0/B0/x')
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual' })
    expect(run()).toMatchObject({ status: 'completed' })
    expect(run().results[0].message).toBe('Slack notified')
  })

  it('never posts to anything but hooks.slack.com', async () => {
    for (const url of ['https://example.com/services/x', 'http://hooks.slack.com/services/x', 'https://169.254.169.254/']) {
      seedStep('notify_slack', { webhook_url: url })
      await executeWorkflows('call_ended', ctx())
      expect(run(), url).toMatchObject({ status: 'failed', error: expect.stringMatching(/^Slack error: URL not allowed \(Slack webhook URLs must start with/) })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a Slack error status', async () => {
    fetchMock.mockImplementation(async () => new Response('invalid_token', { status: 403 }))
    seedStep('notify_slack', { webhook_url: 'https://hooks.slack.com/services/T0/B0/x' })
    await executeWorkflows('call_ended', ctx())
    expect(run()).toMatchObject({ status: 'failed', error: 'Slack failed (403)' })
  })
})

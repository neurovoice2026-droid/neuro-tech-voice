import { describe, expect, it, vi } from 'vitest'

import {
  SLACK_WEBHOOK_HOST,
  WORKFLOW_HTTP_MAX_BYTES,
  WORKFLOW_HTTP_TIMEOUT_MS,
  assertWorkflowUrl,
  sendWorkflowRequest,
  validateWorkflowActions,
} from './outbound'

const publicLookup = async () => ['93.184.216.34']
const privateLookup = async () => ['10.0.0.5']
const ok = () => vi.fn(async (..._args: unknown[]) => new Response('ok', { status: 200 }))
const asFetch = (fn: unknown) => fn as typeof fetch

describe('assertWorkflowUrl', () => {
  it('accepts a public https webhook and a Slack incoming webhook', async () => {
    await expect(assertWorkflowUrl('send_webhook', 'https://hooks.zapier.com/hooks/catch/1/abc', { lookup: publicLookup })).resolves.toBeInstanceOf(URL)
    await expect(assertWorkflowUrl('notify_slack', `https://${SLACK_WEBHOOK_HOST}/services/T0/B0/x`, { lookup: publicLookup })).resolves.toBeInstanceOf(URL)
  })

  it('refuses http, loopback, metadata, private and local addresses for webhooks', async () => {
    for (const url of ['http://example.com/hook', 'https://127.0.0.1/hook', 'https://169.254.169.254/latest/meta-data', 'https://10.1.2.3/', 'https://[::1]/', 'https://localhost/hook', 'https://db.internal/']) {
      await expect(assertWorkflowUrl('send_webhook', url, { lookup: publicLookup }), url).rejects.toMatchObject({ name: 'UnsafeUrlError' })
    }
  })

  it('refuses a host that resolves to a private address', async () => {
    await expect(assertWorkflowUrl('send_webhook', 'https://rebind.example.com/hook', { lookup: privateLookup })).rejects.toThrow(/private or reserved/)
  })

  it('allows Slack steps on hooks.slack.com only, without resolving any other host', async () => {
    const lookup = vi.fn(publicLookup)
    for (const url of ['https://example.com/services/x', 'http://hooks.slack.com/services/x', 'https://hooks.slack.com.evil.example/x', 'https://hooks.slack.com:8443/x', 'not a url']) {
      await expect(assertWorkflowUrl('notify_slack', url, { lookup }), url).rejects.toThrow(/must start with https:\/\/hooks\.slack\.com/)
    }
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('sendWorkflowRequest', () => {
  it('posts JSON to an allowed URL with a timeout, no redirect following and a size cap', async () => {
    const fetchImpl = ok()
    const res = await sendWorkflowRequest('send_webhook', 'https://example.com/hook', { a: 1 }, { method: 'PUT', lookup: publicLookup, fetchImpl: asFetch(fetchImpl) })
    expect(res).toEqual({ kind: 'response', ok: true, status: 200 })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://example.com/hook')
    expect(init).toMatchObject({ method: 'PUT', redirect: 'manual', body: '{"a":1}' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('reports a non-2xx answer with its status', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 500 }))
    expect(await sendWorkflowRequest('send_webhook', 'https://example.com/hook', {}, { lookup: publicLookup, fetchImpl: asFetch(fetchImpl) })).toEqual({ kind: 'response', ok: false, status: 500 })
  })

  it('never calls fetch for a blocked URL', async () => {
    const fetchImpl = ok()
    for (const url of ['https://169.254.169.254/latest/meta-data', 'http://example.com/hook']) {
      const res = await sendWorkflowRequest('send_webhook', url, {}, { lookup: publicLookup, fetchImpl: asFetch(fetchImpl) })
      expect(res).toMatchObject({ kind: 'error', message: expect.stringMatching(/^URL not allowed \(/) })
    }
    expect(await sendWorkflowRequest('send_webhook', 'https://rebind.example.com/', {}, { lookup: privateLookup, fetchImpl: asFetch(fetchImpl) })).toMatchObject({ kind: 'error' })
    expect(await sendWorkflowRequest('notify_slack', 'https://example.com/services/x', {}, { lookup: publicLookup, fetchImpl: asFetch(fetchImpl) })).toMatchObject({ kind: 'error' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not follow a redirect (one request only) and says so', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/' } }))
    const res = await sendWorkflowRequest('send_webhook', 'https://example.com/hook', {}, { lookup: publicLookup, fetchImpl: asFetch(fetchImpl) })
    expect(res).toMatchObject({ kind: 'error', message: expect.stringContaining('redirect (302)') })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('maps timeouts, oversized replies and network failures to plain messages without the URL', async () => {
    const timeout = vi.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError')
    })
    expect(await sendWorkflowRequest('send_webhook', 'https://example.com/secret-path', {}, { lookup: publicLookup, fetchImpl: asFetch(timeout) })).toEqual({
      kind: 'error',
      message: `no answer within ${WORKFLOW_HTTP_TIMEOUT_MS / 1000}s`,
    })
    const big = vi.fn(async () => new Response('x'.repeat(WORKFLOW_HTTP_MAX_BYTES + 1), { status: 200 }))
    expect(await sendWorkflowRequest('send_webhook', 'https://example.com/secret-path', {}, { lookup: publicLookup, fetchImpl: asFetch(big) })).toMatchObject({ kind: 'error', message: expect.stringContaining('larger than') })
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const res = await sendWorkflowRequest('send_webhook', 'https://example.com/secret-path', {}, { lookup: publicLookup, fetchImpl: asFetch(down) })
    expect(res).toEqual({ kind: 'error', message: 'the URL could not be reached' })
  })
})

describe('validateWorkflowActions', () => {
  const step = (type: string, config: Record<string, unknown>, id = 'a0') => ({ id, type, config })

  it('accepts safe webhook and Slack URLs (template variables in the path too) and steps without a URL', async () => {
    const actions = [
      step('send_webhook', { url: 'https://example.com/hook/{{call_id}}', method: 'post' }, 'a0'),
      step('notify_slack', { webhook_url: 'https://hooks.slack.com/services/T0/B0/x' }, 'a1'),
      step('send_webhook', {}, 'a2'),
      step('add_tag', { tag: 'vip' }, 'a3'),
    ]
    expect(await validateWorkflowActions(actions, { lookup: publicLookup })).toEqual({ ok: true, actions })
  })

  it('refuses unsafe webhook URLs with the step number', async () => {
    const res = await validateWorkflowActions([step('add_tag', { tag: 'x' }, 'a0'), step('send_webhook', { url: 'https://169.254.169.254/latest' }, 'a1')], { lookup: publicLookup })
    expect(res).toEqual({ ok: false, error: 'The webhook URL in step 2 is not allowed: private or reserved address.' })
    expect(await validateWorkflowActions([step('send_webhook', { url: 'http://example.com/hook' })], { lookup: publicLookup })).toMatchObject({ ok: false, error: expect.stringContaining('only https') })
    expect(await validateWorkflowActions([step('send_webhook', { url: 'https://rebind.example.com/' })], { lookup: privateLookup })).toMatchObject({ ok: false })
    // A template in the host would let call data choose the server.
    expect(await validateWorkflowActions([step('send_webhook', { url: 'https://{{summary}}.example.com/' })], { lookup: publicLookup })).toMatchObject({ ok: false })
  })

  it('refuses a Slack step that does not point at hooks.slack.com (either config key)', async () => {
    for (const config of [{ webhook_url: 'https://example.com/services/x' }, { url: 'https://example.com/services/x' }]) {
      expect(await validateWorkflowActions([step('notify_slack', config)], { lookup: publicLookup })).toEqual({
        ok: false,
        error: 'The Slack webhook URL in step 1 is not allowed: Slack webhook URLs must start with https://hooks.slack.com/.',
      })
    }
  })

  it('refuses malformed steps, unknown types, non-text URLs and unsupported methods', async () => {
    expect(await validateWorkflowActions('nope')).toMatchObject({ ok: false, details: [expect.objectContaining({ path: 'actions' })] })
    expect(await validateWorkflowActions([step('drop_tables', {})])).toMatchObject({ ok: false, details: [expect.objectContaining({ path: 'actions.0.type' })] })
    expect(await validateWorkflowActions([step('send_webhook', { url: 42 })])).toEqual({ ok: false, error: 'The webhook URL in step 1 must be text.' })
    expect(await validateWorkflowActions([step('send_webhook', { url: 'https://example.com/', method: 'GET' })], { lookup: publicLookup })).toEqual({
      ok: false,
      error: 'The webhook method in step 1 must be POST, PUT or PATCH.',
    })
    const tooMany = Array.from({ length: 11 }, (_, i) => step('add_tag', { tag: 't' }, `a${i}`))
    expect(await validateWorkflowActions(tooMany)).toMatchObject({ ok: false })
  })
})

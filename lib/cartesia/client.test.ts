import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as ct from './client'
import { ProviderError } from '@/lib/voice-providers/errors'
import { setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink } from '@/lib/observability/telemetry'
import { callAt, installFetch, jsonResponse, type FetchMock } from '@/tests/helpers/fetch'

const API_KEY = 'ct_test_key_0123456789abcdef'
const BASE = 'https://api.cartesia.ai'

let fetchMock: FetchMock
let restoreSink: () => void

beforeEach(() => {
  vi.stubEnv('CARTESIA_API_KEY', API_KEY)
  vi.stubEnv('CARTESIA_API_VERSION', '')
  vi.stubEnv('CARTESIA_API_BASE_URL', '')
  setCircuitStore(new MemoryCircuitStore())
  restoreSink = setProviderEventSink(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0) // zero backoff between retries
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  fetchMock = installFetch()
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

const CONFIG: ct.CartesiaAgentConfig = {
  instructions: 'You are the fallback receptionist.',
  initial_message: 'Hello!',
  timezone: 'Europe/Bucharest',
  model: { id: 'gpt-5.4-mini', temperature: null, max_output_tokens: null },
  language: { primary: 'en' },
  audio: {
    input: { noise_suppression: 'auto', keyterms: [] },
    output: { voice_id: 'voice_1', speed: null, volume: null, emotion: null },
  },
  turn: { inactivity_end_call_secs: 20, inactivity_check_in_secs: null },
  tools: [],
  system_tools: { end_call: null, send_dtmf: null, transfer_to_number: null },
  dynamic_variable_placeholders: {},
}

describe('cartesia client — auth headers and configuration', () => {
  it('sends X-API-Key and the pinned Cartesia-Version on every request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'agent_1', name: 'A', description: null, config: {} }))
    await ct.agents.get('agent_1')
    const { headers, url } = callAt(fetchMock)
    expect(url.href).toBe(`${BASE}/v1/agents/agent_1`)
    expect(headers.get('x-api-key')).toBe(API_KEY)
    expect(headers.get('cartesia-version')).toBe(ct.CARTESIA_API_VERSION_DEFAULT)
    expect(ct.CARTESIA_API_VERSION_DEFAULT).toBe('2026-08-14')
    expect(headers.get('authorization')).toBeNull()
  })

  it('uses a valid CARTESIA_API_VERSION override and ignores a malformed one', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'a', name: 'A', description: null, config: {} }))
    vi.stubEnv('CARTESIA_API_VERSION', '2026-03-01')
    await ct.agents.get('a')
    expect(callAt(fetchMock, 0).headers.get('cartesia-version')).toBe('2026-03-01')
    vi.stubEnv('CARTESIA_API_VERSION', 'latest')
    await ct.agents.get('a')
    expect(callAt(fetchMock, 1).headers.get('cartesia-version')).toBe('2026-08-14')
  })

  it('isConfigured is false without a key or with the placeholder; requests then fail without fetch', async () => {
    vi.stubEnv('CARTESIA_API_KEY', 'your-cartesia-api-key')
    expect(ct.isConfigured()).toBe(false)
    vi.stubEnv('CARTESIA_API_KEY', '')
    expect(ct.isConfigured()).toBe(false)
    const err = await Promise.resolve().then(() => ct.agents.get('a')).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect(err).toMatchObject({ system: 'cartesia', code: 'not_configured' })
    await expect(ct.voices.previewAudio('https://files.cartesia.ai/p.wav')).rejects.toMatchObject({ code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('cartesia client — managed agents', () => {
  it('create POSTs to /v1/agents and is not retried on 503', async () => {
    fetchMock.mockResolvedValue(new Response('unavailable', { status: 503 }))
    const body = { name: 'Smile · fallback', description: 'ntv-agent:local_1', config: CONFIG }
    await expect(ct.agents.create(body)).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = callAt(fetchMock)
    expect(call.method).toBe('POST')
    expect(call.url.href).toBe(`${BASE}/v1/agents`)
    expect(call.headers.get('content-type')).toBe('application/json')
    expect(call.json).toEqual(body)
  })

  it('create returns the created agent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'agent_ct_1', name: 'x', description: null, config: {} }))
    const created = await ct.agents.create({ name: 'x', description: null, config: CONFIG })
    expect(created.id).toBe('agent_ct_1')
  })

  it('update PATCHes /v1/agents/{id} and retries a 5xx (idempotent full config)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'agent ct/1', name: 'x', description: null, config: {} }))
    await ct.agents.update('agent ct/1', { name: 'x', config: CONFIG })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const call = callAt(fetchMock, 1)
    expect(call.method).toBe('PATCH')
    expect(call.url.pathname).toBe('/v1/agents/agent%20ct%2F1')
    expect(call.json).toEqual({ name: 'x', config: CONFIG })
  })

  it('list GETs /v1/agents with q, limit and starting_after', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], has_more: false }))
    await ct.agents.list({ q: 'ntv-agent:local_1', starting_after: 'agent_9' })
    const { url, method } = callAt(fetchMock)
    expect(method).toBe('GET')
    expect(url.origin + url.pathname).toBe(`${BASE}/v1/agents`)
    expect(url.searchParams.get('q')).toBe('ntv-agent:local_1')
    expect(url.searchParams.get('starting_after')).toBe('agent_9')
    expect(url.searchParams.get('limit')).toBe('100')
  })

  it('attachWebhook uses the legacy /agents/{id} endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await ct.agents.attachWebhook('agent_1', 'wh_1')
    expect(callAt(fetchMock)).toMatchObject({ method: 'PATCH', json: { webhook_id: 'wh_1' } })
    expect(callAt(fetchMock).url.pathname).toBe('/agents/agent_1')
  })
})

describe('cartesia client — voices', () => {
  it('list passes the gender filter and expands preview_file_url', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'v1', name: 'Ana', gender: 'feminine' }], has_more: false }))
    const page = await ct.voices.list({ language: 'ro', gender: 'feminine', q: 'warm', limit: 20 })
    expect(page.data[0].id).toBe('v1')
    const { url } = callAt(fetchMock)
    expect(url.pathname).toBe('/voices')
    expect(url.searchParams.get('gender')).toBe('feminine')
    expect(url.searchParams.get('language')).toBe('ro')
    expect(url.searchParams.get('q')).toBe('warm')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.getAll('expand[]')).toEqual(['preview_file_url'])
  })

  it('list maps masculine, caps the page size and omits unset filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], has_more: false }))
    await ct.voices.list({ gender: 'masculine', limit: 1000 })
    const { url } = callAt(fetchMock)
    expect(url.searchParams.get('gender')).toBe('masculine')
    expect(url.searchParams.get('limit')).toBe('100')
    expect(url.searchParams.has('language')).toBe(false)
    expect(url.searchParams.has('q')).toBe(false)
    expect(url.searchParams.has('starting_after')).toBe(false)
  })

  it('get also expands preview_file_url', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'v1', name: 'Ana' }))
    await ct.voices.get('v1')
    const { url } = callAt(fetchMock)
    expect(url.pathname).toBe('/voices/v1')
    expect(url.searchParams.getAll('expand[]')).toEqual(['preview_file_url'])
  })

  it.each([
    'http://files.cartesia.ai/preview.wav',
    'https://evil.example.com/preview.wav',
    'https://cartesia.ai.evil.example/preview.wav',
    'https://notcartesia.ai/preview.wav',
    'https://files.cartesia.ai@evil.example/preview.wav',
  ])('previewAudio refuses non-Cartesia URL %s without calling fetch', async (url) => {
    const err = await ct.voices.previewAudio(url).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect(err).toMatchObject({ system: 'cartesia', code: 'validation' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('previewAudio downloads a Cartesia file with the API key and returns the Response', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/wav' } }))
    const res = await ct.voices.previewAudio('https://files.cartesia.ai/voices/v1/preview.wav?sig=abc')
    expect(res).toBeInstanceOf(Response)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    const call = callAt(fetchMock)
    expect(call.url.href).toBe('https://files.cartesia.ai/voices/v1/preview.wav?sig=abc')
    expect(call.headers.get('x-api-key')).toBe(API_KEY)
    expect(call.headers.get('cartesia-version')).toBe('2026-08-14')
  })
})

describe('cartesia client — calls', () => {
  it('calls.audio returns the raw Response for proxying', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([82, 73, 70, 70]), { status: 200, headers: { 'content-type': 'audio/wav' } }))
    const res = await ct.calls.audio('call_1')
    expect(res).toBeInstanceOf(Response)
    expect(res.headers.get('content-type')).toBe('audio/wav')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]))
    expect(callAt(fetchMock).url.href).toBe(`${BASE}/agents/calls/call_1/audio`)
  })

  it('calls.audio maps a 404 to not_found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'not_found' }, 404))
    await expect(ct.calls.audio('call_1')).rejects.toMatchObject({ code: 'not_found' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('calls.list expands the transcript and filters by agent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], has_more: false }))
    await ct.calls.list({ agent_id: 'agent_1', start_time_gte: '2026-10-01T00:00:00Z' })
    const { url } = callAt(fetchMock)
    expect(url.pathname).toBe('/agents/calls')
    expect(url.searchParams.get('agent_id')).toBe('agent_1')
    expect(url.searchParams.get('expand')).toBe('transcript')
    expect(url.searchParams.get('start_time_gte')).toBe('2026-10-01T00:00:00Z')
    expect(url.searchParams.get('limit')).toBe('20')
  })

  it('calls.outbound is a single, non-retried POST', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }))
    await expect(ct.calls.outbound({ agent_id: 'a', from_number_id: 'n', outbound_calls: [{ to_number: '+40712345678' }] }))
      .rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

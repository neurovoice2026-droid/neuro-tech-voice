import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as el from './client'
import { ProviderError } from '@/lib/voice-providers/errors'
import { setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink } from '@/lib/observability/telemetry'
import { callAt, installFetch, jsonResponse, timeoutError, type FetchMock } from '@/tests/helpers/fetch'

const API_KEY = 'sk_0123456789abcdef0123456789abcdef0123'
const BASE = 'https://api.elevenlabs.io'

let fetchMock: FetchMock
let restoreSink: () => void

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', API_KEY)
  vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
  setCircuitStore(new MemoryCircuitStore())
  restoreSink = setProviderEventSink(() => {})
  // Full-jitter backoff with random()=0 → zero delay: retries run immediately.
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  fetchMock = installFetch()
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

const AGENT_BODY = {
  name: 'Smile Clinic Receptionist',
  tags: ['ntv', 'ntv-agent:11111111-2222-4333-8444-555555555555'],
  conversation_config: { agent: { first_message: 'Hello' } },
  platform_settings: {},
}

/** Turns a synchronous throw into a rejection so both shapes can be asserted the same way. */
function settle<T>(fn: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(fn)
}

describe('elevenlabs client — configuration', () => {
  it('isConfigured is false without a key or with the placeholder', () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    expect(el.isConfigured()).toBe(false)
    vi.stubEnv('ELEVENLABS_API_KEY', '   ')
    expect(el.isConfigured()).toBe(false)
    vi.stubEnv('ELEVENLABS_API_KEY', 'your-elevenlabs-api-key')
    expect(el.isConfigured()).toBe(false)
    vi.stubEnv('ELEVENLABS_API_KEY', API_KEY)
    expect(el.isConfigured()).toBe(true)
  })

  it('requests fail with not_configured and never call fetch when the key is missing', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    const attempts: Array<() => Promise<unknown>> = [
      () => el.agents.get('agent_1'),
      () => el.agents.create(AGENT_BODY),
      () => el.voices.search({}),
      () => el.textToSpeech('voice_1', 'hi', 'eleven_flash_v2_5'),
      () => el.subscription(),
    ]
    for (const attempt of attempts) {
      const err = await settle(attempt).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ProviderError)
      expect(err).toMatchObject({ system: 'elevenlabs', code: 'not_configured' })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('honours ELEVENLABS_API_BASE_URL without doubling slashes', async () => {
    vi.stubEnv('ELEVENLABS_API_BASE_URL', 'https://api.eu.residency.elevenlabs.io/')
    fetchMock.mockResolvedValue(jsonResponse({ agent_id: 'agent_1', name: 'x', conversation_config: {} }))
    await el.agents.get('agent_1')
    expect(callAt(fetchMock).url.href).toBe('https://api.eu.residency.elevenlabs.io/v1/convai/agents/agent_1')
  })
})

describe('elevenlabs client — agents', () => {
  it('create POSTs the JSON body to /v1/convai/agents/create with the xi-api-key header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ agent_id: 'agent_new' }))
    const res = await el.agents.create(AGENT_BODY, { orgId: 'org_1', agentId: 'local_1' })
    expect(res).toEqual({ agent_id: 'agent_new' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = callAt(fetchMock)
    expect(call.method).toBe('POST')
    expect(call.url.href).toBe(`${BASE}/v1/convai/agents/create`)
    expect(call.headers.get('xi-api-key')).toBe(API_KEY)
    expect(call.headers.get('content-type')).toBe('application/json')
    expect(call.json).toEqual(AGENT_BODY)
  })

  it('create is NOT retried on 503 (non-idempotent POST: no duplicate agents)', async () => {
    fetchMock.mockResolvedValue(new Response('service unavailable', { status: 503 }))
    await expect(el.agents.create(AGENT_BODY)).rejects.toMatchObject({ code: 'upstream', status: 503 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('create is NOT retried on 422 and maps it to a validation error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: [{ loc: ['body', 'conversation_config'], msg: 'invalid' }] }, 422))
    const err = await el.agents.create(AGENT_BODY).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect(err).toMatchObject({ code: 'validation', status: 422, retryable: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('get is retried on 503 and then succeeds', async () => {
    const agent = { agent_id: 'agent_1', name: 'A', conversation_config: { tts: { voice_id: 'v1' } } }
    fetchMock
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(agent))
    const res = await el.agents.get('agent_1')
    expect(res).toEqual(agent)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const i of [0, 1]) {
      const call = callAt(fetchMock, i)
      expect(call.method).toBe('GET')
      expect(call.url.href).toBe(`${BASE}/v1/convai/agents/agent_1`)
      expect(call.rawBody).toBeUndefined()
    }
  })

  it('get gives up after the retry budget on persistent 5xx', async () => {
    fetchMock.mockImplementation(async () => new Response('down', { status: 502 }))
    await expect(el.agents.get('agent_1')).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('encodes path segments (ids can never escape the resource path)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ agent_id: 'x', name: 'x', conversation_config: {} }))
    await el.agents.get('../voices/abc?x=1')
    expect(callAt(fetchMock).url.pathname).toBe('/v1/convai/agents/..%2Fvoices%2Fabc%3Fx%3D1')
    expect(callAt(fetchMock).url.search).toBe('')
  })

  it('update PATCHes and is retried on 5xx (full-config PATCH is idempotent)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ agent_id: 'agent_1', name: 'A', conversation_config: {} }))
    await el.agents.update('agent_1', { name: 'A' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callAt(fetchMock, 1)).toMatchObject({ method: 'PATCH', json: { name: 'A' } })
  })

  it('list sends tags as repeated query params and a default page size', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ agents: [], has_more: false }))
    await el.agents.list({ tags: ['ntv', 'ntv-agent:abc'], search: 'Smile' })
    const { url } = callAt(fetchMock)
    expect(url.pathname).toBe('/v1/convai/agents')
    expect(url.searchParams.getAll('tags')).toEqual(['ntv', 'ntv-agent:abc'])
    expect(url.searchParams.get('search')).toBe('Smile')
    expect(url.searchParams.get('page_size')).toBe('100')
    expect(url.searchParams.has('cursor')).toBe(false)
  })
})

describe('elevenlabs client — errors never leak secrets or upstream bodies', () => {
  it('401 → ProviderError auth with a product-level safeMessage', async () => {
    const upstream = { detail: { status: 'invalid_api_key', message: `Invalid API key: ${API_KEY} for +40712345678` } }
    fetchMock.mockResolvedValue(jsonResponse(upstream, 401))
    const err = await el.agents.get('agent_1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    const pe = err as ProviderError
    expect(pe.code).toBe('auth')
    expect(pe.status).toBe(401)
    expect(pe.retryable).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pe.safeMessage).toBe('The platform could not authenticate with the voice provider. Please contact support if this persists.')
    for (const text of [pe.safeMessage, pe.message, JSON.stringify(pe.toSafeJSON())]) {
      expect(text).not.toContain(API_KEY)
      expect(text).not.toContain('+40712345678')
    }
    expect(pe.safeMessage).not.toContain('invalid_api_key')
    expect(pe.safeMessage).not.toContain('Invalid API key')
  })

  it('a non-JSON error page is not echoed anywhere', async () => {
    fetchMock.mockResolvedValue(new Response('<html><body>Internal trace: db=prod-1 key=abc</body></html>', { status: 403 }))
    const pe = (await el.agents.get('agent_1').catch((e: unknown) => e)) as ProviderError
    expect(pe.code).toBe('auth')
    expect(pe.detail).toBeNull()
    expect(pe.message).not.toContain('prod-1')
    expect(pe.safeMessage).not.toContain('prod-1')
  })

  it('a timeout (AbortSignal TimeoutError) maps to code timeout; POSTs are not retried', async () => {
    fetchMock.mockRejectedValue(timeoutError())
    await expect(el.agents.create(AGENT_BODY)).rejects.toMatchObject({ code: 'timeout', retryable: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a timeout on an idempotent GET is retried and still reported as timeout', async () => {
    fetchMock.mockRejectedValue(timeoutError())
    const err = await el.agents.get('agent_1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect(err).toMatchObject({ code: 'timeout', safeMessage: 'The voice provider took too long to respond. Please try again.' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('passes an AbortSignal to every request (no open-ended fetch)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ agent_id: 'a', name: 'a', conversation_config: {} }))
    await el.agents.get('a')
    const init = fetchMock.mock.calls[0][1]
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('elevenlabs client — voices', () => {
  it('search builds the /v2/voices query and passes next_page_token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ voices: [], has_more: true, next_page_token: 'tok_2' }))
    const res = await el.voices.search({ search: 'anna', voice_type: 'personal', page_size: 500, next_page_token: 'tok_1', voice_ids: ['v1', 'v2'] })
    expect(res.next_page_token).toBe('tok_2')
    const { url, method } = callAt(fetchMock)
    expect(method).toBe('GET')
    expect(url.origin + url.pathname).toBe(`${BASE}/v2/voices`)
    expect(url.searchParams.get('search')).toBe('anna')
    expect(url.searchParams.get('voice_type')).toBe('personal')
    expect(url.searchParams.get('next_page_token')).toBe('tok_1')
    expect(url.searchParams.get('page_size')).toBe('100') // capped
    expect(url.searchParams.get('include_total_count')).toBe('false')
    expect(url.searchParams.getAll('voice_ids')).toEqual(['v1', 'v2'])
    expect(url.searchParams.has('category')).toBe(false)
  })

  it('search omits empty optional params and defaults page_size to 50', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ voices: [], has_more: false }))
    await el.voices.search({ search: '', next_page_token: null })
    const { url } = callAt(fetchMock)
    expect(url.searchParams.has('search')).toBe(false)
    expect(url.searchParams.has('next_page_token')).toBe(false)
    expect(url.searchParams.get('page_size')).toBe('50')
  })

  it('sharedVoices.list excludes live-moderated and custom-rate voices', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ voices: [], has_more: false }))
    await el.sharedVoices.list({ language: 'ro', gender: 'female', page: 2, min_notice_period_days: 30 })
    const { url } = callAt(fetchMock)
    expect(url.pathname).toBe('/v1/shared-voices')
    expect(url.searchParams.get('include_live_moderated')).toBe('false')
    expect(url.searchParams.get('include_custom_rates')).toBe('false')
    expect(url.searchParams.get('language')).toBe('ro')
    expect(url.searchParams.get('gender')).toBe('female')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('page_size')).toBe('30')
    expect(url.searchParams.get('min_notice_period_days')).toBe('30')
  })

  it('sharedVoices.add is a single, non-retried POST', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }))
    await expect(el.sharedVoices.add('owner_1', 'voice_1', 'Anna')).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(callAt(fetchMock)).toMatchObject({ method: 'POST', json: { new_name: 'Anna', bookmarked: true } })
    expect(callAt(fetchMock).url.pathname).toBe('/v1/voices/add/owner_1/voice_1')
  })
})

describe('elevenlabs client — text to speech', () => {
  it('returns the audio bytes and uses the given model id', async () => {
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00])
    fetchMock.mockResolvedValue(new Response(bytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } }))
    const audio = await el.textToSpeech('voice_1', 'Bună ziua', 'eleven_flash_v2_5', 'ro')
    expect(audio).toBeInstanceOf(ArrayBuffer)
    expect(new Uint8Array(audio)).toEqual(bytes)
    const call = callAt(fetchMock)
    expect(call.method).toBe('POST')
    expect(call.url.pathname).toBe('/v1/text-to-speech/voice_1')
    expect(call.url.searchParams.get('output_format')).toBe('mp3_22050_32')
    expect(call.url.searchParams.has('enable_logging')).toBe(false)
    expect(call.headers.get('accept')).toBe('audio/mpeg')
    expect(call.headers.get('xi-api-key')).toBe(API_KEY)
    expect(call.json).toEqual({ text: 'Bună ziua', model_id: 'eleven_flash_v2_5', language_code: 'ro' })
  })

  it('never sends language_code with eleven_multilingual_v2 (unsupported per the spec)', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }))
    await el.textToSpeech('voice_1', 'Bună ziua', 'eleven_multilingual_v2', 'ro')
    expect(callAt(fetchMock).json).toEqual({ text: 'Bună ziua', model_id: 'eleven_multilingual_v2' })
  })

  it('sends the agent tuning, the dictionary locators (max 3), zero retention and the phone format', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }))
    const locators = ['a', 'b', 'c', 'd'].map((x) => ({ pronunciation_dictionary_id: `dict_${x}`, version_id: `ver_${x}` }))
    await el.textToSpeech('voice_1', 'hi', 'eleven_flash_v2', 'en', {
      voiceSettings: { stability: 0.4, similarity_boost: 0.7, speed: 1.1 },
      pronunciationLocators: locators,
      enableLogging: false,
      outputFormat: 'wav_8000',
    })
    const call = callAt(fetchMock)
    expect(call.url.searchParams.get('enable_logging')).toBe('false')
    expect(call.url.searchParams.get('output_format')).toBe('wav_8000')
    expect(call.headers.get('accept')).toBe('audio/wav')
    expect(call.json).toEqual({
      text: 'hi',
      model_id: 'eleven_flash_v2',
      language_code: 'en',
      voice_settings: { stability: 0.4, similarity_boost: 0.7, speed: 1.1 },
      pronunciation_dictionary_locators: locators.slice(0, 3),
    })
  })

  it('omits language_code when none is given and is not retried', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }))
    await expect(el.textToSpeech('voice_1', 'hi', 'eleven_flash_v2_5')).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(callAt(fetchMock).json).toEqual({ text: 'hi', model_id: 'eleven_flash_v2_5' })
  })
})

describe('elevenlabs client — twilio + knowledge base', () => {
  it('twilio.registerCall returns the TwiML text verbatim', async () => {
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://x"/></Connect></Response>'
    fetchMock.mockResolvedValue(new Response(twiml, { status: 200, headers: { 'content-type': 'text/xml' } }))
    const params = { agent_id: 'agent_1', from_number: '+40712345678', to_number: '+40312345678', direction: 'inbound' as const }
    const res = await el.twilio.registerCall(params, { callId: 'call_1' })
    expect(res).toBe(twiml)
    const call = callAt(fetchMock)
    expect(call.method).toBe('POST')
    expect(call.url.pathname).toBe('/v1/convai/twilio/register-call')
    expect(call.json).toEqual(params)
  })

  it('twilio.registerCall is not retried (the router fails over instead)', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }))
    await expect(el.twilio.registerCall({ agent_id: 'a', from_number: '+40712345678', to_number: '+40312345678', direction: 'inbound' }))
      .rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('knowledgeBase.delete passes force=true and resolves without a body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(el.knowledgeBase.delete('doc_1', true)).resolves.toBeUndefined()
    const { url, method } = callAt(fetchMock)
    expect(method).toBe('DELETE')
    expect(url.pathname).toBe('/v1/convai/knowledge-base/doc_1')
    expect(url.searchParams.get('force')).toBe('true')
  })

  it('knowledgeBase.content returns plain text', async () => {
    fetchMock.mockResolvedValue(new Response('Opening hours: 9-17', { status: 200 }))
    await expect(el.knowledgeBase.content('doc_1')).resolves.toBe('Opening hours: 9-17')
    expect(callAt(fetchMock).url.pathname).toBe('/v1/convai/knowledge-base/doc_1/content')
  })
})

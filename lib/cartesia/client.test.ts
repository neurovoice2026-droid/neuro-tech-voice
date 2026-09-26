import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/http'
import {
  CARTESIA_API_VERSION,
  CartesiaError,
  cartesia,
  cartesiaTtsModel,
  isCartesiaConfigError,
  isCartesiaQuotaError,
  isCartesiaTransientError,
  parseCartesiaError,
  ttsGenerationConfig,
  ttsOutputFormat,
} from './client'

type FetchCall = { url: URL; init: RequestInit }

const calls: FetchCall[] = []
let responses: (Response | Error | (() => Response | Promise<Response>))[] = []

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function queue(...items: (Response | Error | (() => Response | Promise<Response>))[]) {
  responses.push(...items)
}

function header(call: FetchCall, name: string): string | null {
  return new Headers(call.init.headers).get(name)
}

function jsonBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init.body))
}

beforeEach(() => {
  calls.length = 0
  responses = []
  vi.stubEnv('CARTESIA_API_KEY', 'sk_car_test_standard')
  vi.stubEnv('CARTESIA_ADMIN_API_KEY', 'sk_car_admin_test')
  vi.stubEnv('CARTESIA_TTS_MODEL', '')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      calls.push({ url: new URL(String(input)), init })
      const next = responses.shift()
      if (!next) throw new Error(`Unexpected fetch ${String(input)}`)
      if (next instanceof Error) throw next
      return typeof next === 'function' ? next() : next
    })
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const RAW_VOICE = {
  id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
  name: 'Skylar',
  tagline: 'Friendly Guide',
  description: 'Approachable American female ideal for customer care and support.',
  gender: 'feminine',
  language: 'en',
  country: 'US',
  accents: [
    { accent: 'general-american', locale: 'en-US', is_native: true },
    { accent: 'mexican', locale: 'es-MX', is_native: false },
    { broken: true },
  ],
  is_owner: false,
  is_pro: false,
  status: 'active',
  access: 'public',
  visibility: 'all',
  created_at: '2026-03-31T17:37:05.961Z',
  preview_file_url: 'https://files.cartesia.ai/files/file_abc/download?format=wav',
  some_new_field: 'not forwarded',
}

describe('transport', () => {
  it('sends the bearer key and the pinned API version', async () => {
    queue(json({ data: [], has_more: false, next_page: null }))
    await cartesia.voices.list({})
    expect(calls[0].url.origin).toBe('https://api.cartesia.ai')
    expect(header(calls[0], 'authorization')).toBe('Bearer sk_car_test_standard')
    expect(header(calls[0], 'cartesia-version')).toBe(CARTESIA_API_VERSION)
    expect(CARTESIA_API_VERSION).toBe('2026-08-14')
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal)
  })

  it('throws ApiError 503 not_configured without a key', async () => {
    vi.stubEnv('CARTESIA_API_KEY', '')
    await expect(cartesia.voices.list({})).rejects.toMatchObject({ status: 503, code: 'not_configured' })
    await expect(cartesia.voices.list({})).rejects.toBeInstanceOf(ApiError)
    expect(calls).toHaveLength(0)
  })

  it('treats placeholder keys as missing', async () => {
    vi.stubEnv('CARTESIA_API_KEY', 'your-cartesia-api-key')
    await expect(cartesia.voices.get('x')).rejects.toMatchObject({ code: 'not_configured' })
  })

  it('retries an idempotent GET once on a 5xx', async () => {
    queue(json({ title: 'Oops', message: 'upstream' }, 503), json(RAW_VOICE))
    const voice = await cartesia.voices.get(RAW_VOICE.id)
    expect(voice.name).toBe('Skylar')
    expect(calls).toHaveLength(2)
  })

  it('never retries a POST', async () => {
    queue(json({ error_code: null, title: 'Internal', message: 'boom' }, 500))
    await expect(
      cartesia.tts.bytes({ transcript: 'Salut.', voiceId: 'v', language: 'ro', format: 'mp3' })
    ).rejects.toMatchObject({ status: 500 })
    expect(calls).toHaveLength(1)
  })

  it('wraps timeouts as CartesiaError status 0 / timeout', async () => {
    queue(new DOMException('The operation timed out.', 'TimeoutError'), new DOMException('again', 'TimeoutError'))
    const error = await cartesia.voices.get('v').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CartesiaError)
    expect(error).toMatchObject({ status: 0, errorCode: 'timeout' })
    expect(isCartesiaTransientError(error)).toBe(true)
  })

  it('rethrows the caller abort untouched', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortError = new DOMException('This operation was aborted', 'AbortError')
    queue(abortError)
    await expect(
      cartesia.tts.bytes({ transcript: 'Hi.', voiceId: 'v', language: 'en', format: 'mp3', signal: controller.signal })
    ).rejects.toBe(abortError)
  })

  it('url-encodes ids in paths', async () => {
    queue(new Response(null, { status: 204 }))
    await cartesia.voices.delete('../agents/x')
    expect(calls[0].url.pathname).toBe('/voices/..%2Fagents%2Fx')
    expect(calls[0].init.method).toBe('DELETE')
  })
})

describe('errors', () => {
  it('parses the structured error body', async () => {
    const res = json(
      {
        error_code: 'voice_not_found',
        message: 'The requested voice was not found.',
        title: 'Voice not found',
        request_id: '9a70647d-9f5a-4e1a-9dfd-e2b62681c0ff',
      },
      404
    )
    const error = await parseCartesiaError(res, 'POST /tts/bytes')
    expect(error).toMatchObject({
      status: 404,
      errorCode: 'voice_not_found',
      title: 'Voice not found',
      requestId: '9a70647d-9f5a-4e1a-9dfd-e2b62681c0ff',
      endpoint: 'POST /tts/bytes',
    })
    expect(error.message).toContain('The requested voice was not found.')
  })

  it('parses the v1 PublicErrorResponse without error_code', async () => {
    const res = json({ request_id: 'r1', message: 'The requested agent does not exist.', title: 'Agent not found' }, 404)
    const error = await parseCartesiaError(res, 'GET /v1/agents/{id}')
    expect(error).toMatchObject({ status: 404, errorCode: null, title: 'Agent not found', requestId: 'r1' })
  })

  it('unwraps errors nested under "error"', async () => {
    const res = json(
      { error: { request_id: 'r2', message: 'version_description is only allowed when the agent configuration changes.', title: 'Invalid version description' } },
      400
    )
    const error = await parseCartesiaError(res, 'PATCH /v1/agents/{id}')
    expect(error).toMatchObject({ status: 400, errorCode: null, title: 'Invalid version description', requestId: 'r2' })
    expect(error.message).toContain('only allowed when the agent configuration changes')
  })

  it('parses legacy plain-text "Title: Message" errors', async () => {
    const res = new Response('Invalid model: sonic-nope is not a model', { status: 400 })
    const error = await parseCartesiaError(res, 'POST /tts/bytes')
    expect(error).toMatchObject({ status: 400, title: 'Invalid model', errorCode: null })
    expect(error.message).toContain('sonic-nope is not a model')
  })

  it('does not copy HTML error pages into the message', async () => {
    const res = new Response('<html><body>502 Bad Gateway secret-ish</body></html>', { status: 502 })
    const error = await parseCartesiaError(res, 'GET /voices')
    expect(error.status).toBe(502)
    expect(error.message).not.toContain('html')
  })

  it('classifies quota errors by code or HTTP 402', () => {
    expect(isCartesiaQuotaError(new CartesiaError({ status: 429, errorCode: 'quota_exceeded', message: 'x' }))).toBe(true)
    expect(isCartesiaQuotaError(new CartesiaError({ status: 402, message: 'x' }))).toBe(true)
    // WebSocket error event shape.
    expect(isCartesiaQuotaError({ type: 'error', error_code: 'quota_exceeded', status_code: 402 })).toBe(true)
    expect(isCartesiaQuotaError(new CartesiaError({ status: 429, errorCode: 'concurrency_limited', message: 'x' }))).toBe(false)
    expect(isCartesiaQuotaError(new Error('quota_exceeded'))).toBe(false)
    expect(isCartesiaQuotaError(null)).toBe(false)
  })

  it('classifies config errors by status or code, never quota', () => {
    for (const status of [400, 404, 422]) {
      expect(isCartesiaConfigError(new CartesiaError({ status, message: 'x' }))).toBe(true)
    }
    for (const code of ['voice_not_found', 'model_not_found', 'voice_model_mismatch', 'language_not_supported']) {
      expect(isCartesiaConfigError(new CartesiaError({ status: 500, errorCode: code, message: 'x' }))).toBe(true)
    }
    expect(isCartesiaConfigError(new CartesiaError({ status: 400, errorCode: 'quota_exceeded', message: 'x' }))).toBe(false)
    expect(isCartesiaConfigError(new CartesiaError({ status: 402, message: 'x' }))).toBe(false)
    expect(isCartesiaConfigError(new CartesiaError({ status: 429, errorCode: 'concurrency_limited', message: 'x' }))).toBe(false)
    expect(isCartesiaConfigError(new CartesiaError({ status: 503, message: 'x' }))).toBe(false)
    expect(isCartesiaConfigError(new CartesiaError({ status: 0, errorCode: 'timeout', message: 'x' }))).toBe(false)
    expect(isCartesiaConfigError({ type: 'error', error_code: 'model_not_found', status_code: 404 })).toBe(true)
  })
})

describe('voices', () => {
  it('lists with every filter and normalises voices', async () => {
    queue(json({ data: [RAW_VOICE], has_more: true, next_page: RAW_VOICE.id }))
    const page = await cartesia.voices.list({
      q: ' sky ',
      gender: 'feminine',
      language: 'en',
      isOwner: false,
      limit: 500,
      startingAfter: 'abc',
      expandPreview: true,
    })
    const params = calls[0].url.searchParams
    expect(calls[0].url.pathname).toBe('/voices')
    expect(params.get('q')).toBe('sky')
    expect(params.get('gender')).toBe('feminine')
    expect(params.get('language')).toBe('en')
    expect(params.get('is_owner')).toBe('false')
    expect(params.get('limit')).toBe('100')
    expect(params.get('starting_after')).toBe('abc')
    expect(params.getAll('expand[]')).toEqual(['preview_file_url'])
    expect(page.has_more).toBe(true)
    expect(page.next_page).toBe(RAW_VOICE.id)
    const [voice] = page.data
    expect(voice.accents).toEqual([
      { accent: 'general-american', locale: 'en-US', is_native: true },
      { accent: 'mexican', locale: 'es-MX', is_native: false },
    ])
    expect(voice.gender).toBe('feminine')
    expect(voice.preview_file_url).toContain('files.cartesia.ai')
    expect(voice).not.toHaveProperty('some_new_field')
  })

  it('tolerates missing optional fields', async () => {
    queue(json({ data: [{ id: 'v1', name: 'X', gender: 'robot' }], has_more: false, next_page: null }))
    const page = await cartesia.voices.list({})
    expect(page.data[0]).toMatchObject({ id: 'v1', gender: null, accents: [], description: null, is_owner: false })
    expect(page.data[0]).not.toHaveProperty('preview_file_url')
  })

  it('clones with multipart form data and no deprecated fields', async () => {
    queue(json({ id: 'clone-1', name: 'Owner', description: null, tagline: null, language: 'ro', created_at: 'now' }))
    const clip = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' })
    const meta = await cartesia.voices.clone({
      clip,
      filename: 'owner.wav',
      name: 'Owner',
      language: 'ro',
      accent: 'romanian',
      tagline: 'Front desk',
    })
    expect(meta.id).toBe('clone-1')
    const form = calls[0].init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(calls[0].init.method).toBe('POST')
    expect(header(calls[0], 'content-type')).toBeNull()
    expect(form.get('name')).toBe('Owner')
    expect(form.get('language')).toBe('ro')
    expect(form.get('accent')).toBe('romanian')
    expect(form.get('tagline')).toBe('Front desk')
    expect(form.get('access')).toBe('private')
    expect((form.get('clip') as File).name).toBe('owner.wav')
    expect(form.has('mode')).toBe(false)
    expect(form.has('enhance')).toBe(false)
    expect(form.has('description')).toBe(false)
  })

  it('fetches previews with auth only on Cartesia hosts', async () => {
    queue(json(RAW_VOICE), new Response('RIFF', { status: 200, headers: { 'content-type': 'audio/wav' } }))
    const res = await cartesia.voices.fetchPreview(RAW_VOICE.id)
    expect(res.headers.get('content-type')).toBe('audio/wav')
    expect(calls[1].url.host).toBe('files.cartesia.ai')
    expect(header(calls[1], 'authorization')).toBe('Bearer sk_car_test_standard')

    queue(json({ ...RAW_VOICE, preview_file_url: 'https://evil.example.com/steal' }))
    await expect(cartesia.voices.fetchPreview(RAW_VOICE.id)).rejects.toMatchObject({ errorCode: 'invalid_response' })
    expect(calls).toHaveLength(3)

    queue(json({ ...RAW_VOICE, preview_file_url: null }))
    const missing = await cartesia.voices.fetchPreview(RAW_VOICE.id).catch((e: unknown) => e)
    expect(missing).toMatchObject({ status: 404, errorCode: 'preview_not_found' })
    expect(isCartesiaConfigError(missing)).toBe(true)
  })

  it('lists accents', async () => {
    queue(json({ accents: [{ id: 'romanian', name: 'Romanian', language: 'ro', locale: 'ro-RO', is_locale_default: true, is_localizable: false }] }))
    const accents = await cartesia.voices.listAccents({ language: 'ro' })
    expect(calls[0].url.searchParams.get('language')).toBe('ro')
    expect(accents).toEqual([
      { id: 'romanian', name: 'Romanian', language: 'ro', locale: 'ro-RO', is_locale_default: true, is_localizable: false },
    ])
  })
})

describe('tts.bytes', () => {
  it('maps formats to Cartesia output_format', () => {
    expect(ttsOutputFormat('mp3')).toEqual({ container: 'mp3', sample_rate: 44100, bit_rate: 128000 })
    expect(ttsOutputFormat('wav')).toEqual({ container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 })
    expect(ttsOutputFormat('mulaw8k')).toEqual({ container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 })
  })

  it('includes only the generation settings that were provided', () => {
    expect(ttsGenerationConfig({})).toBeUndefined()
    expect(ttsGenerationConfig({ speed: null, volume: null, emotion: null })).toBeUndefined()
    expect(ttsGenerationConfig({ speed: 1.1 })).toEqual({ speed: 1.1 })
    expect(ttsGenerationConfig({ volume: 0.8, emotion: ' calm ' })).toEqual({ volume: 0.8, emotion: 'calm' })
    expect(ttsGenerationConfig({ speed: 0.9, emotion: '' })).toEqual({ speed: 0.9 })
  })

  it('posts the pinned model and returns the streamed response', async () => {
    queue(new Response(new Uint8Array([0x49, 0x44, 0x33]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }))
    const res = await cartesia.tts.bytes({
      transcript: 'Bună ziua!',
      voiceId: '34acfaee-c556-41ee-a5f6-c687fb20357c',
      language: 'ro',
      format: 'mp3',
      speed: 1.2,
      volume: null,
    })
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
    expect(calls[0].url.pathname).toBe('/tts/bytes')
    expect(header(calls[0], 'content-type')).toBe('application/json')
    expect(jsonBody(calls[0])).toEqual({
      model_id: 'sonic-3.6-2026-08-27',
      transcript: 'Bună ziua!',
      voice: '34acfaee-c556-41ee-a5f6-c687fb20357c',
      language: 'ro',
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
      generation_config: { speed: 1.2 },
    })
  })

  it('omits generation_config entirely and honours model overrides', async () => {
    vi.stubEnv('CARTESIA_TTS_MODEL', 'sonic-3.5-2026-05-04')
    expect(cartesiaTtsModel()).toBe('sonic-3.5-2026-05-04')
    queue(new Response('x'), new Response('y'))
    await cartesia.tts.bytes({ transcript: 'Hi.', voiceId: 'v', language: 'en', format: 'mulaw8k' })
    await cartesia.tts.bytes({ transcript: 'Hi.', voiceId: 'v', language: 'en', format: 'wav', modelId: 'sonic-3.6' })
    expect(jsonBody(calls[0])).not.toHaveProperty('generation_config')
    expect(jsonBody(calls[0]).model_id).toBe('sonic-3.5-2026-05-04')
    expect(jsonBody(calls[0])).not.toHaveProperty('locale')
    expect(jsonBody(calls[1]).model_id).toBe('sonic-3.6')
  })

  it('surfaces upstream errors as CartesiaError', async () => {
    queue(json({ error_code: 'quota_exceeded', title: 'Quota exceeded', message: 'Out of credits', request_id: 'q1' }, 402))
    const error = await cartesia.tts
      .bytes({ transcript: 'Hi.', voiceId: 'v', language: 'en', format: 'mp3' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CartesiaError)
    expect(isCartesiaQuotaError(error)).toBe(true)
    expect(isCartesiaConfigError(error)).toBe(false)
  })
})

describe('stt.transcribe', () => {
  it('sends ink-whisper multipart and parses the live response shape', async () => {
    queue(
      json({
        type: 'transcript',
        duration: 2.769,
        language: 'ro',
        words: [
          { word: ' Bună', start: 0.08, end: 0.4 },
          { word: ' ziua!', start: 0.4, end: 0.92 },
          { word: ' ', start: 1, end: 1 },
        ],
        request_id: 'r',
        text: 'Bună ziua!',
      })
    )
    const result = await cartesia.stt.transcribe({
      file: new Blob([new Uint8Array([1])], { type: 'audio/mpeg' }),
      filename: 'call.mp3',
      language: 'ro',
      wordTimestamps: true,
    })
    const form = calls[0].init.body as FormData
    expect(calls[0].url.pathname).toBe('/stt')
    expect(form.get('model')).toBe('ink-whisper')
    expect(form.get('language')).toBe('ro')
    expect(form.getAll('timestamp_granularities[]')).toEqual(['word'])
    expect((form.get('file') as File).name).toBe('call.mp3')
    expect(result).toEqual({
      text: 'Bună ziua!',
      language: 'ro',
      duration: 2.769,
      words: [
        { word: 'Bună', start: 0.08, end: 0.4 },
        { word: 'ziua!', start: 0.4, end: 0.92 },
      ],
    })
  })

  it('omits word timestamps unless asked and tolerates missing fields', async () => {
    queue(json({ type: 'transcript', text: ' hello ' }))
    const result = await cartesia.stt.transcribe({ file: new Blob(['x']), filename: 'a.wav', language: 'en' })
    expect((calls[0].init.body as FormData).has('timestamp_granularities[]')).toBe(false)
    expect(result).toEqual({ text: 'hello', language: null, duration: null, words: [] })
  })
})

describe('accessToken', () => {
  it('requests only true grants and returns the token', async () => {
    queue(json({ token: 'jwt.token.value' }))
    const token = await cartesia.accessToken({ tts: true, stt: false }, 60)
    expect(token).toBe('jwt.token.value')
    expect(calls[0].url.pathname).toBe('/access-token')
    expect(jsonBody(calls[0])).toEqual({ grants: { tts: true }, expires_in: 60 })
  })

  it('rejects invalid lifetimes and empty grants before calling Cartesia', async () => {
    await expect(cartesia.accessToken({ tts: true }, 7200)).rejects.toBeInstanceOf(RangeError)
    await expect(cartesia.accessToken({ tts: true }, 0)).rejects.toBeInstanceOf(RangeError)
    await expect(cartesia.accessToken({ stt: false }, 60)).rejects.toBeInstanceOf(RangeError)
    expect(calls).toHaveLength(0)
  })
})

describe('agents', () => {
  it('follows model pagination via next_page', async () => {
    queue(
      json({ data: [{ id: 'claude-haiku-4.5' }, { id: 'claude-sonnet-4.6' }], has_more: true, next_page: 'claude-sonnet-4.6' }),
      json({ data: [{ id: 'gpt-5.6-luna', display_name: 'GPT-5.6 Luna', provider: 'OpenAI' }], has_more: false, next_page: null })
    )
    const models = await cartesia.agents.models()
    expect(models.map((m) => m.id)).toEqual(['claude-haiku-4.5', 'claude-sonnet-4.6', 'gpt-5.6-luna'])
    expect(calls[0].url.searchParams.get('limit')).toBe('100')
    expect(calls[1].url.searchParams.get('starting_after')).toBe('claude-sonnet-4.6')
  })

  it('creates, updates and deletes agents with JSON bodies', async () => {
    const agent = { id: 'agent_1', name: 'Front desk', config: {}, version: { id: 'av_1' } }
    queue(json(agent, 201), json(agent), new Response(null, { status: 204 }))
    await cartesia.agents.create({ name: 'Front desk', config: { model: { id: 'gpt-5.6-luna' }, language: { primary: 'ro' } } })
    await cartesia.agents.update('agent_1', { config: { tools: [] }, version_description: 'sync' })
    await cartesia.agents.delete('agent_1')
    expect(calls.map((c) => `${c.init.method} ${c.url.pathname}`)).toEqual([
      'POST /v1/agents',
      'PATCH /v1/agents/agent_1',
      'DELETE /v1/agents/agent_1',
    ])
    expect(jsonBody(calls[1])).toEqual({ config: { tools: [] }, version_description: 'sync' })
  })

  it('lists client tools with the type filter', async () => {
    queue(json({ data: [], has_more: false, next_page: null }))
    const tools = await cartesia.agents.tools.list({ type: 'client' })
    expect(tools).toEqual([])
    expect(calls[0].url.pathname).toBe('/v1/agents/tools')
    expect(calls[0].url.searchParams.get('type')).toBe('client')
  })

  it('rejects responses without an id', async () => {
    queue(json({ name: 'no id' }, 201))
    await expect(cartesia.agents.create({ name: 'x', config: {} })).rejects.toMatchObject({ errorCode: 'invalid_response' })
  })
})

describe('calls', () => {
  it('drops the transcript only when asked', async () => {
    const call = { id: 'ac_1', agent_id: 'agent_1', status: 'completed', transcript: [{ role: 'user', text: 'hi', start_timestamp: 0, end_timestamp: 1 }] }
    queue(json(call), json(call))
    expect((await cartesia.calls.get('ac_1')).transcript).toHaveLength(1)
    expect(await cartesia.calls.get('ac_1', { transcript: false })).not.toHaveProperty('transcript')
    expect(calls[0].url.pathname).toBe('/agents/calls/ac_1')
  })
})

describe('knowledge', () => {
  it('adds the agent to the folder without dropping existing agents', async () => {
    queue(
      json({ id: 'folder_1', parent_id: null, name: 'KB', created_at: 'now', agents: [{ id: 'agent_a', name: 'A' }] }),
      json({ id: 'folder_1' })
    )
    await cartesia.knowledge.attachFolderToAgent('folder_1', 'agent_b')
    expect(calls[1].init.method).toBe('PATCH')
    expect(calls[1].url.pathname).toBe('/agents/folders/folder_1')
    expect(jsonBody(calls[1])).toEqual({ agents: [{ id: 'agent_a' }, { id: 'agent_b' }] })
  })

  it('skips the PATCH when already attached', async () => {
    queue(json({ id: 'folder_1', agents: [{ id: 'agent_b' }] }))
    await cartesia.knowledge.attachFolderToAgent('folder_1', 'agent_b')
    expect(calls).toHaveLength(1)
  })

  it('creates folders and documents', async () => {
    queue(json({ id: 'folder_9' }, 201), json({ id: 'doc_1' }, 201))
    expect(await cartesia.knowledge.createFolder('org 1')).toEqual({ id: 'folder_9' })
    expect(
      await cartesia.knowledge.createDocument({ folderId: 'folder_9', name: 'Prices', content: 'Cleaning costs 200 lei.' })
    ).toEqual({ id: 'doc_1' })
    expect(jsonBody(calls[0])).toEqual({ name: 'org 1', parent_id: null })
    expect(jsonBody(calls[1])).toEqual({ folder_id: 'folder_9', name: 'Prices', content: 'Cleaning costs 200 lei.' })
  })
})

describe('usage', () => {
  it('sums credits with the admin key', async () => {
    queue(
      json({
        data: [
          { start_ts: '2026-09-01T00:00:00.000Z', end_ts: '2026-09-02T00:00:00.000Z', credits: 1200 },
          { start_ts: '2026-09-02T00:00:00.000Z', end_ts: '2026-09-03T00:00:00.000Z', credits: 34.5 },
        ],
      })
    )
    const credits = await cartesia.usage.credits('2026-09-01T00:00:00Z', '2026-09-17T00:00:00Z')
    expect(credits).toBe(1234.5)
    expect(header(calls[0], 'authorization')).toBe('Bearer sk_car_admin_test')
    expect(calls[0].url.searchParams.get('start_ts')).toBe('2026-09-01T00:00:00Z')
    expect(calls[0].url.searchParams.get('end_ts')).toBe('2026-09-17T00:00:00Z')
  })

  it('sums agent usage buckets', async () => {
    queue(json({ data: [{ cents: 129, minutes: 18.25, calls: 33 }, { cents: 1, minutes: 0.5, calls: 1 }] }))
    expect(await cartesia.usage.agents('2026-09-01T00:00:00Z', '2026-09-17T00:00:00Z')).toEqual({
      cents: 130,
      minutes: 18.75,
      calls: 34,
    })
  })

  it('needs the admin key', async () => {
    vi.stubEnv('CARTESIA_ADMIN_API_KEY', '')
    await expect(cartesia.usage.credits('a', 'b')).rejects.toMatchObject({ status: 503, code: 'not_configured' })
    expect(calls).toHaveLength(0)
  })
})

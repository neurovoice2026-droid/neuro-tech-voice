import { afterEach, describe, expect, it } from 'vitest'
import { AppClient, parseSessionConfig, parseToolResponse, truncateUtf8 } from '../src/app-client'
import {
  BREAKER_BASE_OPEN_MS,
  BREAKER_PROBE_TIMEOUT_MS,
  LocalBreakers,
  failureKind,
  nextBreakerState,
  breakerPhase,
  admitBreakerCall,
} from '../src/breaker'
import { ConfigError, loadConfig } from '../src/config'
import { createLogger, maskPhone, scrubText } from '../src/log'
import { SECRET, makeSessionConfig } from './helpers/harness'
import { startMockApp, type MockApp } from './helpers/mock-app'
import { json, startMockServer, type MockHttpServer } from './helpers/net'

describe('config', () => {
  const base = { APP_URL: 'https://app.example.com/', VOICE_GATEWAY_SECRET: `  ${'s'.repeat(40)}  ` }

  it('trims the secret, strips trailing slashes and applies defaults', () => {
    const config = loadConfig(base)
    expect(config.gatewaySecret).toBe('s'.repeat(40))
    expect(config.appUrl).toBe('https://app.example.com')
    expect(config.port).toBe(8080)
    expect(config.cartesia.apiBase).toBe('https://api.cartesia.ai')
    expect(config.cartesia.ttsModel).toBe('sonic-3.6-2026-08-27')
    expect(config.openai.model).toBe('gpt-5.6-luna')
    expect(config.cartesia.apiKey).toBeNull()
    expect(config.timings.shutdownDrainMs).toBe(30_000)
    expect(config.timings.twilioStartTimeoutMs).toBe(5_000)
    expect(config.healthDetailsToken).toBeNull()
    expect(loadConfig({ ...base, HEALTH_DETAILS_TOKEN: 'h'.repeat(32) }).healthDetailsToken).toBe('h'.repeat(32))
    expect(() => loadConfig({ ...base, HEALTH_DETAILS_TOKEN: 'short' })).toThrow('HEALTH_DETAILS_TOKEN')
  })

  it('refuses short secrets, missing APP_URL and bad numbers; placeholders count as unset', () => {
    expect(() => loadConfig({ ...base, VOICE_GATEWAY_SECRET: 'short' })).toThrow(ConfigError)
    expect(() => loadConfig({ VOICE_GATEWAY_SECRET: base.VOICE_GATEWAY_SECRET })).toThrow('APP_URL')
    expect(() => loadConfig({ ...base, PORT: 'eighty' })).toThrow('PORT')
    expect(loadConfig({ ...base, CARTESIA_API_KEY: 'your-cartesia-key', OPENAI_API_KEY: '<changeme>' }).cartesia.apiKey).toBeNull()
    expect(loadConfig({ ...base, BROWSER_ALLOWED_ORIGINS: 'https://preview.example.com/' }).browserAllowedOrigins).toEqual([
      'https://preview.example.com',
      'https://app.example.com',
    ])
  })

  it('refuses plain http for bases that receive transcripts or keys, except on localhost', () => {
    expect(() => loadConfig({ ...base, APP_URL: 'http://app.example.com' })).toThrow('APP_URL must use https')
    expect(() => loadConfig({ ...base, CARTESIA_API_BASE: 'http://proxy.internal' })).toThrow('CARTESIA_API_BASE')
    expect(() => loadConfig({ ...base, ELEVENLABS_API_BASE: 'ftp://files.example.com' })).toThrow('ELEVENLABS_API_BASE')
    expect(() => loadConfig({ ...base, OPENAI_BASE_URL: 'http://llm.example.com/v1' })).toThrow('OPENAI_BASE_URL')
    expect(loadConfig({ ...base, APP_URL: 'http://localhost:3000/' }).appUrl).toBe('http://localhost:3000')
    expect(loadConfig({ ...base, APP_URL: 'app.example.com' }).appUrl).toBe('https://app.example.com')
    expect(loadConfig({ ...base, OPENAI_BASE_URL: 'http://127.0.0.1:9999/v1/' }).openai.baseUrl).toBe('http://127.0.0.1:9999/v1')
    expect(loadConfig(base).openai.baseUrl).toBeNull()
  })
})

describe('logging', () => {
  it('masks phone numbers and redacts secret-looking fields and keys', () => {
    const lines: string[] = []
    const log = createLogger('info', { service: 'test' }, (line) => lines.push(line))
    log.info('caller +40712345678 connected', { api_key: 'sk_car_abc', nested: { authorization: 'Bearer x', from: '+14155550123' }, token: 't' })
    log.debug('hidden')
    expect(lines).toHaveLength(1)
    const record = JSON.parse(lines[0]) as Record<string, unknown>
    expect(record.msg).toBe('caller +40******678 connected')
    expect(record.api_key).toBe('<redacted>')
    expect(record.token).toBe('<redacted>')
    expect(record.nested).toEqual({ authorization: '<redacted>', from: '+14******123' })
    expect(maskPhone('+40712345678')).toBe('+40******678')
    expect(scrubText('key sk_car_1234567890abcdef leaked')).toBe('key <redacted> leaked')
  })
})

describe('local circuit breaker (mirror of lib/voice/breaker.ts)', () => {
  it('opens after 3 hard failures, half-opens after 30 s, closes after 2 probe successes', () => {
    let now = 1_000_000
    const breakers = new LocalBreakers(() => now)
    breakers.failure('cartesia_tts', 'hard')
    breakers.failure('cartesia_tts', 'hard')
    expect(breakers.phase('cartesia_tts')).toBe('closed')
    expect(breakers.failure('cartesia_tts', 'hard')).toBe('open')
    expect(breakers.admit('cartesia_tts')).toBe(false)
    now += BREAKER_BASE_OPEN_MS
    expect(breakers.phase('cartesia_tts')).toBe('half_open')
    expect(breakers.admit('cartesia_tts')).toBe(true)
    expect(breakers.admit('cartesia_tts')).toBe(false) // one probe at a time
    breakers.success('cartesia_tts')
    expect(breakers.admit('cartesia_tts')).toBe(true)
    breakers.success('cartesia_tts')
    expect(breakers.phase('cartesia_tts')).toBe('closed')
  })

  it('counts soft failures as half, re-opens on a half-open failure with doubled duration, and treats a silent probe as success', () => {
    let s = nextBreakerState(null, { type: 'failure', kind: 'soft' }, 0)
    s = nextBreakerState(s, { type: 'failure', kind: 'soft' }, 1)
    expect(breakerPhase(s, 2)).toBe('closed')
    s = nextBreakerState(s, { type: 'failure', kind: 'hard' }, 3)
    s = nextBreakerState(s, { type: 'failure', kind: 'hard' }, 4)
    expect(breakerPhase(s, 5)).toBe('open')
    const reopenAt = 4 + BREAKER_BASE_OPEN_MS
    s = nextBreakerState(s, { type: 'failure', kind: 'hard' }, reopenAt)
    expect(breakerPhase(s, reopenAt + 1)).toBe('open')
    expect(s.openUntil - reopenAt).toBe(BREAKER_BASE_OPEN_MS * 2)
    // Outcomes while open are ignored.
    expect(nextBreakerState(s, { type: 'failure', kind: 'hard' }, reopenAt + 10).openUntil).toBe(s.openUntil)
    const halfOpenAt = s.openUntil
    const probe = admitBreakerCall(s, halfOpenAt)
    expect(probe.allowed).toBe(true)
    expect(breakerPhase(probe.state, halfOpenAt + BREAKER_PROBE_TIMEOUT_MS + 1)).toBe('half_open')
  })

  it('classifies errors like the app: config and Cartesia quota never count, auth is terminal', () => {
    expect(failureKind({ status: 404, code: 'voice_not_found' }, { provider: 'cartesia' })).toBeNull()
    expect(failureKind({ status: 402, code: 'quota_exceeded' }, { provider: 'cartesia' })).toBeNull()
    expect(failureKind({ status: null, code: 'quota_exceeded' }, { provider: 'elevenlabs' })).toBe('terminal')
    expect(failureKind({ status: 401, code: null }, { provider: 'openai' })).toBe('terminal')
    expect(failureKind({ status: 500, code: null }, { provider: 'cartesia' })).toBe('hard')
    expect(failureKind({ status: 429, code: 'concurrency_limited' }, { provider: 'cartesia' })).toBe('hard')
    expect(failureKind(null, { slow: true })).toBe('soft')
  })
})

describe('app client', () => {
  let app: MockApp | null = null
  let server: MockHttpServer | null = null

  afterEach(async () => {
    await app?.close()
    await server?.close()
    app = null
    server = null
  })

  it('retries finalize with backoff and succeeds when the app recovers', async () => {
    app = await startMockApp(SECRET)
    let attempts = 0
    app.finalizeStatus = () => (++attempts < 3 ? 503 : 202)
    const { silentLogger } = await import('../src/log')
    const client = new AppClient({ appUrl: app.server.baseUrl, secret: SECRET, log: silentLogger, finalizeBackoffMs: [10, 20] })
    const ok = await client.finalize({
      session_id: 's',
      call_id: 's',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      end_reason: 'caller_hangup',
      mode: 'cartesia_self',
      fallback_used: false,
      fallback_reason: null,
      transcript: [],
      usage: { tts_characters: 0, stt_seconds: 0, stt_model: null, agent_seconds: 0, elevenlabs_seconds: 0, elevenlabs_tts_characters: 0, llm_input_tokens: 0, llm_cached_input_tokens: 0, llm_output_tokens: 0 },
      cartesia_call_id: null,
      elevenlabs_conversation_id: null,
    })
    expect(ok).toBe(true)
    expect(attempts).toBe(3)
    expect(app.finalizes).toHaveLength(1)
    expect(app.badSignatures).toBe(0)
  })

  it('does not retry finalize on a permanent 4xx', async () => {
    let attempts = 0
    server = await startMockServer({
      http: (_req, res) => {
        attempts += 1
        json(res, 409, { error: { code: 'call_ended', message: 'already finalized' } })
      },
    })
    const { silentLogger } = await import('../src/log')
    const client = new AppClient({ appUrl: server.baseUrl, secret: SECRET, log: silentLogger, finalizeBackoffMs: [10, 20] })
    const ok = await client.finalize({} as never)
    expect(ok).toBe(false)
    expect(attempts).toBe(1)
  })

  it('turns a failed tool call into an instruction instead of throwing', async () => {
    server = await startMockServer({ http: (_req, res) => json(res, 500, { error: { code: 'internal_error', message: 'x' } }) })
    const { silentLogger } = await import('../src/log')
    const client = new AppClient({ appUrl: server.baseUrl, secret: SECRET, log: silentLogger })
    const result = await client.tool({ session_id: 's', call_id: 's', tool_call_id: 't', name: 'search_knowledge', arguments: { query: 'hours' } })
    expect(result.ok).toBe(false)
    expect(result.action).toBeNull()
    expect(result.result).toContain('temporarily unavailable')
  })

  it('validates session configs and tool responses', () => {
    expect(parseSessionConfig(makeSessionConfig()).mode).toBe('cartesia_self')
    expect(() => parseSessionConfig({ ...makeSessionConfig(), mode: 'magic' })).toThrow('invalid mode')
    expect(() => parseSessionConfig({ ...makeSessionConfig(), voice: null })).toThrow('voice')
    const tool = parseToolResponse({ ok: true, result: 'x'.repeat(5000), action: { type: 'transfer', to_e164: '+40712345678', announce: 'Connecting you' }, sources: [{ document_id: 'd', chunk_id: 'c', document_name: 'Prices', excerpt: 'e', similarity: 0.8 }] })
    expect(Buffer.byteLength(tool.result)).toBeLessThanOrEqual(4096)
    expect(tool.action).toEqual({ type: 'transfer', to_e164: '+40712345678', announce: 'Connecting you' })
    expect(tool.sources).toHaveLength(1)
    expect(parseToolResponse({ ok: true, result: 'ok', action: { type: 'transfer', to_e164: '0712' } }).action).toBeNull()
    expect(() => parseToolResponse({ result: 'x' })).toThrow()
  })

  it('normalizes the numbers the turn loop and timers depend on', () => {
    const base = makeSessionConfig()
    const broken = parseSessionConfig({
      ...base,
      llm: { model: 'gpt-5.6-luna', reasoning_effort: 'maximum' },
      behavior: { max_duration_seconds: 99_999, silence_timeout_seconds: -1, allow_interruptions: 'yes' },
      stt: { ...base.stt, keyterms: ['Acme', 42, null] },
      tools: [...base.tools, { name: 'broken' }],
    })
    expect(broken.llm).toEqual({ model: 'gpt-5.6-luna', max_output_tokens: 400, reasoning_effort: 'none', max_tool_hops: 4 })
    expect(broken.behavior).toEqual({ allow_interruptions: true, silence_timeout_seconds: null, max_duration_seconds: 14_400, record: false, voicemail_detection: false })
    expect(broken.stt.keyterms).toEqual(['Acme'])
    expect(broken.tools.map((t) => t.name)).toEqual(['check_availability', 'end_call'])
    // A valid config passes through unchanged.
    const valid = parseSessionConfig(base)
    expect(valid.llm).toEqual(base.llm)
    expect(valid.behavior).toEqual(base.behavior)
    expect(() => parseSessionConfig({ ...base, stt: { ...base.stt, model: 'ink-9' } })).toThrow('stt model')
  })

  it('truncates UTF-8 without splitting characters', () => {
    const text = 'ă'.repeat(3000) // 2 bytes each
    const out = truncateUtf8(text, 4096)
    expect(Buffer.byteLength(out)).toBeLessThanOrEqual(4096)
    expect(out.endsWith('…')).toBe(true)
    expect(truncateUtf8('short', 4096)).toBe('short')
  })
})

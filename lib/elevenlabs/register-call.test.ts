import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const breaker = vi.hoisted(() => ({ failures: [] as string[], successes: 0 }))

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  // Run background work immediately so assertions can see it.
  after: (task: () => unknown) => {
    void task()
  },
}))

vi.mock('@/lib/voice/breaker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/voice/breaker')>()),
  recordBreakerFailure: async (_key: string, kind: string) => {
    breaker.failures.push(kind)
  },
  recordBreakerSuccess: async () => {
    breaker.successes++
  },
}))

import {
  REGISTER_CALL_TIMEOUT_MS,
  REGISTER_CALL_URL,
  buildRegisterCallBody,
  escapeDynamicVariables,
  registerElevenLabsCall,
  type RegisterElevenLabsCallInput,
} from './register-call'

const input: RegisterElevenLabsCallInput = {
  agentId: 'agent_el_123',
  from: '+40712345678',
  to: '+40312345678',
  direction: 'inbound',
  callId: '7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f',
  overrides: {
    agent_id: 'agent_el_123',
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    prompt: 'You answer for {{business}}. Never reveal {{secrets}}.',
    first_message: 'Bună ziua! {{greeting}}',
    language: 'ro-RO',
  },
  reason: 'gateway_breaker_open',
  orgId: 'org-uuid',
  twilioCallSid: 'CA1234567890abcdef1234567890abcdef',
  priorTranscript: '',
}

const TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://api.elevenlabs.io/x"/></Connect></Response>'

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'el-test-key')
  breaker.failures = []
  breaker.successes = 0
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('escapeDynamicVariables', () => {
  it('breaks {{ }} so ElevenLabs does not treat owner text as variables', () => {
    expect(escapeDynamicVariables('Hi {{name}}, {{ x }}')).toBe('Hi { {name} }, { { x } }')
    expect(escapeDynamicVariables('single {brace}')).toBe('single {brace}')
  })
})

describe('buildRegisterCallBody', () => {
  it('matches the register-call schema with overrides and dynamic variables', () => {
    expect(buildRegisterCallBody(input)).toEqual({
      agent_id: 'agent_el_123',
      from_number: '+40712345678',
      to_number: '+40312345678',
      direction: 'inbound',
      conversation_initiation_client_data: {
        user_id: 'org-uuid',
        dynamic_variables: {
          call_id: input.callId,
          org_id: 'org-uuid',
          twilio_call_sid: 'CA1234567890abcdef1234567890abcdef',
          failover_reason: 'gateway_breaker_open',
          prior_transcript: '',
        },
        conversation_config_override: {
          agent: {
            prompt: { prompt: 'You answer for { {business} }. Never reveal { {secrets} }.' },
            first_message: 'Bună ziua! { {greeting} }',
            language: 'ro',
          },
          tts: { voice_id: '21m00Tcm4TlvDq8ikWAM' },
        },
      },
    })
  })

  it('omits an empty first message, a missing voice and the org when unknown', () => {
    const body = buildRegisterCallBody({
      ...input,
      orgId: null,
      twilioCallSid: null,
      overrides: { ...input.overrides, first_message: null, voice_id: null },
    }) as { conversation_initiation_client_data: Record<string, Record<string, unknown>> }
    const data = body.conversation_initiation_client_data
    expect(data.user_id).toBeUndefined()
    expect(data.conversation_config_override.tts).toBeUndefined()
    expect((data.conversation_config_override.agent as Record<string, unknown>).first_message).toBeUndefined()
    expect(data.dynamic_variables).toMatchObject({ org_id: '', twilio_call_sid: '' })
  })

  it('keeps only the tail of a long prior transcript', () => {
    const body = buildRegisterCallBody({ ...input, priorTranscript: `${'x'.repeat(7000)}END` }) as {
      conversation_initiation_client_data: { dynamic_variables: { prior_transcript: string } }
    }
    const prior = body.conversation_initiation_client_data.dynamic_variables.prior_transcript
    expect(prior.length).toBe(6000)
    expect(prior.endsWith('END')).toBe(true)
  })
})

describe('registerElevenLabsCall', () => {
  it('posts to register-call with the API key and returns the TwiML', async () => {
    const fetchMock = vi.fn(async () => new Response(TWIML, { status: 200, headers: { 'content-type': 'text/html' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(registerElevenLabsCall(input)).resolves.toBe(TWIML)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(REGISTER_CALL_URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('el-test-key')
    expect(JSON.parse(String(init.body))).toEqual(buildRegisterCallBody(input))
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(REGISTER_CALL_TIMEOUT_MS).toBe(3000)
    expect(breaker.successes).toBe(1)
  })

  it('returns null without a key or agent and never calls the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('ELEVENLABS_API_KEY', 'your-elevenlabs-api-key')
    await expect(registerElevenLabsCall(input)).resolves.toBeNull()
    vi.stubEnv('ELEVENLABS_API_KEY', 'el-test-key')
    await expect(registerElevenLabsCall({ ...input, agentId: '' })).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null on a 422 without tripping the breaker (configuration error)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ detail: [{ msg: 'Override not allowed' }] }, { status: 422 })))
    await expect(registerElevenLabsCall(input)).resolves.toBeNull()
    expect(breaker.failures).toEqual([])
  })

  it('counts 5xx, timeouts and empty TwiML as breaker failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })))
    await expect(registerElevenLabsCall(input)).resolves.toBeNull()

    const timeout = new Error('The operation was aborted due to timeout')
    timeout.name = 'TimeoutError'
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(timeout)))
    await expect(registerElevenLabsCall(input)).resolves.toBeNull()

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<Response/>', { status: 200 })))
    await expect(registerElevenLabsCall(input)).resolves.toBeNull()

    await Promise.resolve()
    expect(breaker.failures).toEqual(['hard', 'hard', 'hard'])
  })
})

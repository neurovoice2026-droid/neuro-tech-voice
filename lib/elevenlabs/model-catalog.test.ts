import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agentReasoningEffort, cachedAgentLlms, cachedModels, resetModelCatalogCache } from './model-catalog'
import { diagnoseModels, modelEnvProblems, remoteModelProblems, agentModelDriftProblems } from './model-diagnostics'
import { setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink } from '@/lib/observability/telemetry'
import { createLogger } from '@/lib/observability/logger'
import { AGENT_LANGUAGE_CODES } from '@/lib/voice/languages'
import { callAt, installFetch, jsonResponse, type FetchMock } from '@/tests/helpers/fetch'
import { fakeDb } from '@/tests/helpers/fake-db'

const API_KEY = 'sk_0123456789abcdef0123456789abcdef0123'
const log = createLogger({ test: true })

let fetchMock: FetchMock
let restoreSink: () => void

const ALL_LANGS = AGENT_LANGUAGE_CODES.map((id) => ({ language_id: id, name: id }))
const MODELS = [
  { model_id: 'eleven_flash_v2', can_do_text_to_speech: true, languages: [{ language_id: 'en', name: 'English' }] },
  { model_id: 'eleven_flash_v2_5', can_do_text_to_speech: true, languages: ALL_LANGS },
  { model_id: 'eleven_v4_turbo', can_do_text_to_speech: true, languages: ALL_LANGS.filter((l) => l.language_id !== 'hi') },
]
const LLMS = {
  llms: [
    { llm: 'gpt-5.4-mini', available_reasoning_efforts: ['minimal', 'low', 'medium'], deprecation_info: null },
    { llm: 'gemini-2.5-flash', available_reasoning_efforts: null, deprecation_info: { is_deprecated: true, replacement_model: 'gemini-3-flash-preview' } },
  ],
}

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', API_KEY)
  vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
  for (const k of ['ELEVENLABS_LLM', 'ELEVENLABS_TTS_MODEL_EN', 'ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'ELEVENLABS_REASONING_EFFORT', 'ELEVENLABS_TEXT_NORMALISATION']) vi.stubEnv(k, '')
  setCircuitStore(new MemoryCircuitStore())
  restoreSink = setProviderEventSink(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0)
  resetModelCatalogCache()
  fetchMock = installFetch()
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

describe('model catalogue cache', () => {
  it('reads GET /v1/models and GET /v1/convai/llm/list once per hour', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input)
      return jsonResponse(url.includes('/llm/list') ? LLMS : MODELS)
    })
    expect(await cachedModels()).toHaveLength(3)
    expect(await cachedModels()).toHaveLength(3)
    expect(await cachedAgentLlms()).toHaveLength(2)
    expect(await cachedAgentLlms()).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = callAt(fetchMock, 0)
    expect(first.url.pathname).toBe('/v1/models')
    expect(first.method).toBe('GET')
    expect(first.headers.get('xi-api-key')).toBe(API_KEY)
    expect(callAt(fetchMock, 1).url.pathname).toBe('/v1/convai/llm/list')
  })

  it('serves the stale copy when a refresh fails, and throws when nothing was ever loaded', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      fetchMock.mockResolvedValueOnce(jsonResponse(MODELS))
      await cachedModels()
      vi.setSystemTime(Date.now() + 2 * 3_600_000)
      fetchMock.mockResolvedValue(jsonResponse({ detail: 'nope' }, 500))
      expect(await cachedModels()).toHaveLength(3)
      const callsAfterFailure = fetchMock.mock.calls.length
      // Within 5 minutes of a failure the endpoint is not called again.
      expect(await cachedModels()).toHaveLength(3)
      expect(fetchMock.mock.calls.length).toBe(callsAfterFailure)
      resetModelCatalogCache()
      await expect(cachedModels()).rejects.toMatchObject({ system: 'elevenlabs' })
      const afterColdFailure = fetchMock.mock.calls.length
      await expect(cachedModels()).rejects.toMatchObject({ system: 'elevenlabs' })
      expect(fetchMock.mock.calls.length).toBe(afterColdFailure)
      vi.setSystemTime(Date.now() + 301_000)
      fetchMock.mockResolvedValue(jsonResponse(MODELS))
      expect(await cachedModels()).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('agentReasoningEffort', () => {
  it('is the lowest level the configured LLM supports', async () => {
    fetchMock.mockResolvedValue(jsonResponse(LLMS))
    expect(await agentReasoningEffort(log)).toBe('minimal')
  })

  it('honours a supported ELEVENLABS_REASONING_EFFORT', async () => {
    vi.stubEnv('ELEVENLABS_REASONING_EFFORT', 'low')
    fetchMock.mockResolvedValue(jsonResponse(LLMS))
    expect(await agentReasoningEffort(log)).toBe('low')
  })

  it('is null for a model without configurable reasoning or missing from the list', async () => {
    fetchMock.mockResolvedValue(jsonResponse(LLMS))
    vi.stubEnv('ELEVENLABS_LLM', 'gemini-2.5-flash')
    expect(await agentReasoningEffort(log)).toBeNull()
    vi.stubEnv('ELEVENLABS_LLM', 'gpt-4o')
    expect(await agentReasoningEffort(log)).toBeNull()
  })

  it('never throws: an unreadable catalogue means "not sent"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'down' }, 503))
    expect(await agentReasoningEffort(log)).toBeNull()
  })

  it('does not call the provider when ElevenLabs is not configured', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    expect(await agentReasoningEffort(log)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('modelEnvProblems', () => {
  it('reports nothing for the defaults', () => {
    expect(modelEnvProblems()).toEqual([])
  })

  it('flags unknown, deprecated, non-real-time and English-only values (never their secrets)', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', 'eleven_made_up')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_turbo_v2_5')
    expect(modelEnvProblems().map((p) => p.key)).toEqual(['ELEVENLABS_TTS_MODEL_EN', 'ELEVENLABS_TTS_MODEL_MULTILINGUAL'])
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', 'eleven_multilingual_v2')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_flash_v2')
    const messages = modelEnvProblems().map((p) => p.message)
    expect(messages[0]).toMatch(/Not a real-time agent model/)
    expect(messages[1]).toMatch(/English-only/)
    vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', 'llm')
    vi.stubEnv('ELEVENLABS_REASONING_EFFORT', 'extreme')
    vi.stubEnv('ELEVENLABS_LLM', 'gpt 4o')
    expect(modelEnvProblems().map((p) => p.key)).toEqual(
      expect.arrayContaining(['ELEVENLABS_TEXT_NORMALISATION', 'ELEVENLABS_REASONING_EFFORT', 'ELEVENLABS_LLM']),
    )
    expect(JSON.stringify(modelEnvProblems())).not.toContain(API_KEY)
  })
})

describe('remoteModelProblems', () => {
  function serve(models: unknown, llms: unknown) {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input)
      return jsonResponse(url.includes('/llm/list') ? llms : models)
    })
  }

  it('passes when the configured models list every agent language and the LLM is offered', async () => {
    serve(MODELS, LLMS)
    expect(await remoteModelProblems(log)).toEqual([])
  })

  it('reports a configured model that does not list an agent language', async () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_v4_turbo')
    serve(MODELS, LLMS)
    const problems = await remoteModelProblems(log)
    expect(problems).toEqual([{ key: 'ELEVENLABS_TTS_MODEL', severity: 'error', message: 'eleven_v4_turbo does not list these agent languages: hi.' }])
  })

  it('warns when a configured model is not listed at all, and when the LLM is unknown or deprecated', async () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_v3_conversational')
    serve(MODELS, LLMS)
    expect((await remoteModelProblems(log)).map((p) => p.message)).toContain(
      'eleven_v3_conversational is not listed by GET /v1/models: its language support cannot be verified.',
    )
    resetModelCatalogCache()
    vi.stubEnv('ELEVENLABS_LLM', 'gpt-4o')
    expect((await remoteModelProblems(log)).find((p) => p.key === 'ELEVENLABS_LLM')?.severity).toBe('error')
    resetModelCatalogCache()
    vi.stubEnv('ELEVENLABS_LLM', 'gemini-2.5-flash')
    vi.stubEnv('ELEVENLABS_REASONING_EFFORT', 'low')
    const msgs = (await remoteModelProblems(log)).map((p) => p.message)
    expect(msgs).toContain('gemini-2.5-flash is deprecated. Replacement: gemini-3-flash-preview.')
    expect(msgs).toContain('gemini-2.5-flash has no configurable reasoning: no reasoning effort is sent.')
  })

  it('turns an unreadable catalogue into warnings, never an exception', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500))
    const problems = await remoteModelProblems(log)
    expect(problems.map((p) => p.severity)).toEqual(['warning', 'warning'])
  })

  it('does nothing without an API key', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    expect(await remoteModelProblems(log)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('agentModelDriftProblems', () => {
  it('counts synced agents on deprecated, non-allowed or drifted models (no identifiers)', async () => {
    const db = fakeDb(() => ({
      data: [
        { details: { tts_model: 'eleven_turbo_v2_5' }, agents: { language: 'ro' } },
        { details: { tts_model: 'eleven_multilingual_v2' }, agents: { language: 'ro' } },
        { details: { tts_model: 'eleven_flash_v2_5' }, agents: { language: 'en' } },
        { details: { tts_model: 'eleven_flash_v2_5' }, agents: [{ language: 'ro' }] },
        { details: {}, agents: { language: 'ro' } },
      ],
      error: null,
    }))
    const problems = await agentModelDriftProblems(db as never, log)
    expect(problems.map((p) => p.message)).toEqual([
      '1 synced agent(s) still use a deprecated TTS model: re-sync them.',
      '1 synced agent(s) use a TTS model outside the agent allow-list: re-sync them.',
      '1 synced agent(s) use a different TTS model than the current configuration: re-sync them.',
    ])
    expect(db.calls[0].filters).toEqual([
      ['eq', 'provider', 'elevenlabs'],
      ['eq', 'status', 'ready'],
    ])
  })

  it('reports a read failure as a warning', async () => {
    const db = fakeDb(() => ({ data: null, error: { message: 'boom' } }))
    expect((await agentModelDriftProblems(db as never, log))[0].severity).toBe('warning')
  })
})

describe('diagnoseModels', () => {
  it('combines env, remote and drift checks and never throws', async () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', 'junk')
    fetchMock.mockResolvedValue(jsonResponse({}, 500))
    const db = fakeDb(() => ({ data: [], error: null }))
    const problems = await diagnoseModels(db as never, log)
    expect(problems.map((p) => p.key)).toEqual(['ELEVENLABS_TTS_MODEL_EN', 'ELEVENLABS_TTS_MODEL', 'ELEVENLABS_LLM'])
  })

  it('survives a database client that throws', async () => {
    const db = { from: () => { throw new Error('db down') } }
    fetchMock.mockResolvedValue(jsonResponse(MODELS))
    await expect(diagnoseModels(db as never, log)).resolves.toBeInstanceOf(Array)
  })
})

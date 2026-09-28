import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ElevenLabsKnowledgeError,
  createElevenLabsTextDocument,
  deleteElevenLabsDocument,
  mergeKnowledgeLocators,
  ragModelForAgent,
  updateElevenLabsAgentKnowledge,
} from './knowledge'

const fetchMock = vi.fn()

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'test-elevenlabs-key')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('mergeKnowledgeLocators', () => {
  it('adds, renames and removes by id while keeping other documents', () => {
    const current = [
      { type: 'file' as const, name: 'Owner upload', id: 'keep' },
      { type: 'text' as const, name: 'Old prices', id: 'old' },
      { type: 'text' as const, name: 'Menu', id: 'menu', usage_mode: 'prompt' as const },
    ]
    const merged = mergeKnowledgeLocators(current, {
      add: [
        { type: 'text', name: 'Prices 2026', id: 'new' },
        { type: 'text', name: 'Menu (spring)', id: 'menu' },
      ],
      remove: ['old'],
    })
    expect(merged).toEqual([
      { type: 'file', name: 'Owner upload', id: 'keep' },
      { type: 'text', name: 'Menu (spring)', id: 'menu', usage_mode: 'auto' },
      { type: 'text', name: 'Prices 2026', id: 'new', usage_mode: 'auto' },
    ])
  })
})

describe('ragModelForAgent', () => {
  it('uses the model RAG already runs on, and ignores the default a disabled config reports', () => {
    expect(ragModelForAgent({ enabled: true, embedding_model: 'e5_mistral_7b_instruct' })).toBe('e5_mistral_7b_instruct')
    expect(ragModelForAgent({ enabled: false, embedding_model: 'e5_mistral_7b_instruct' })).toBe('multilingual_e5_large_instruct')
    expect(ragModelForAgent(null)).toBe('multilingual_e5_large_instruct')
  })
})

describe('ElevenLabs knowledge requests', () => {
  it('creates a text document', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: 'doc_1', name: 'FAQ' }))
    await expect(createElevenLabsTextDocument({ name: 'FAQ', text: 'Q and A' })).resolves.toEqual({ id: 'doc_1', name: 'FAQ' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.elevenlabs.io/v1/convai/knowledge-base/text')
    expect(init.method).toBe('POST')
    expect(init.headers['xi-api-key']).toBe('test-elevenlabs-key')
    expect(JSON.parse(init.body)).toEqual({ text: 'Q and A', name: 'FAQ' })
  })

  it('merges the agent knowledge list and PATCHes only that list', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(200, {
          agent_id: 'agent_1',
          conversation_config: {
            agent: { prompt: { prompt: 'secret prompt', knowledge_base: [{ type: 'text', name: 'Old', id: 'old' }] } },
          },
        })
      )
      .mockResolvedValueOnce(json(200, {}))
    const result = await updateElevenLabsAgentKnowledge('agent_1', { add: [{ type: 'text', name: 'New', id: 'new' }], remove: ['old'] })
    expect(result.changed).toBe(true)
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://api.elevenlabs.io/v1/convai/agents/agent_1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({
      conversation_config: { agent: { prompt: { knowledge_base: [{ type: 'text', name: 'New', id: 'new', usage_mode: 'auto' }] } } },
    })
  })

  it('skips the PATCH when nothing changes and enables RAG only when asked', async () => {
    const agent = {
      conversation_config: { agent: { prompt: { knowledge_base: [{ type: 'text', name: 'New', id: 'new', usage_mode: 'auto' }] } } },
    }
    fetchMock.mockResolvedValueOnce(json(200, agent))
    expect((await updateElevenLabsAgentKnowledge('agent_1', { add: [{ type: 'text', name: 'New', id: 'new' }] })).changed).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValueOnce(json(200, agent)).mockResolvedValueOnce(json(200, {}))
    await updateElevenLabsAgentKnowledge('agent_1', { add: [{ type: 'text', name: 'New', id: 'new' }], enableRagModel: 'multilingual_e5_large_instruct' })
    const body = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(body.conversation_config.agent.prompt.rag).toEqual({ enabled: true, embedding_model: 'multilingual_e5_large_instruct' })
  })

  it('switches RAG on with the model the documents were indexed with, keeping the other RAG settings', async () => {
    const agent = {
      conversation_config: {
        agent: {
          prompt: {
            knowledge_base: [{ type: 'text', name: 'Big', id: 'big', usage_mode: 'auto' }],
            rag: { enabled: false, embedding_model: 'e5_mistral_7b_instruct', max_vector_distance: 0.6 },
          },
        },
      },
    }
    fetchMock.mockResolvedValueOnce(json(200, agent)).mockResolvedValueOnce(json(200, {}))
    const result = await updateElevenLabsAgentKnowledge('agent_1', { enableRagModel: 'multilingual_e5_large_instruct' })
    expect(result.rag).toEqual({ enabled: true, embedding_model: 'multilingual_e5_large_instruct', max_vector_distance: 0.6 })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).conversation_config.agent.prompt.rag).toEqual(result.rag)

    // Already on: nothing to change.
    fetchMock.mockResolvedValueOnce(
      json(200, { conversation_config: { agent: { prompt: { knowledge_base: [], rag: { enabled: true, embedding_model: 'e5_mistral_7b_instruct' } } } } })
    )
    expect((await updateElevenLabsAgentKnowledge('agent_1', { enableRagModel: 'e5_mistral_7b_instruct' })).changed).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('deletes with force=true and treats a missing document as deleted', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))
    await deleteElevenLabsDocument('doc_1')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/convai/knowledge-base/doc_1?force=true')

    fetchMock.mockResolvedValueOnce(json(404, { detail: { status: 'document_not_found', message: 'nope' } }))
    await expect(deleteElevenLabsDocument('gone')).resolves.toBeUndefined()
  })

  it('never puts the upstream body in the error message', async () => {
    fetchMock.mockResolvedValueOnce(json(422, { detail: { status: 'invalid', message: 'secret upstream detail' } }))
    const error = await createElevenLabsTextDocument({ name: 'x', text: 'y' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ElevenLabsKnowledgeError)
    expect((error as ElevenLabsKnowledgeError).message).not.toContain('secret upstream detail')
    expect((error as ElevenLabsKnowledgeError).detail).toBe('invalid: secret upstream detail')
    expect((error as ElevenLabsKnowledgeError).status).toBe(422)
  })

  it('answers not_configured without a key', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    await expect(deleteElevenLabsDocument('doc')).rejects.toMatchObject({ status: 503, code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

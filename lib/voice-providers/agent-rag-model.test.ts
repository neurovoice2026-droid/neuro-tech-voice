import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { embeddingModelForAgentRow } from './agent-rag-model'

describe('embeddingModelForAgentRow', () => {
  it('uses the English model only when every language is English', () => {
    expect(embeddingModelForAgentRow({ language: 'en', conversation_settings: {} })).toBe('e5_mistral_7b_instruct')
    expect(embeddingModelForAgentRow(null)).toBe('e5_mistral_7b_instruct')
  })

  it('switches to the multilingual model for a non-English primary language', () => {
    expect(embeddingModelForAgentRow({ language: 'ro', conversation_settings: {} })).toBe('multilingual_e5_large_instruct')
  })

  it('matches the agent body when an English agent has additional languages', () => {
    expect(embeddingModelForAgentRow({ language: 'en', conversation_settings: { additional_languages: ['ro'] } })).toBe('multilingual_e5_large_instruct')
  })

  it('ignores invalid additional languages like the agent body does', () => {
    expect(embeddingModelForAgentRow({ language: 'en', conversation_settings: { additional_languages: ['xx', 'en'] } })).toBe('e5_mistral_7b_instruct')
  })
})

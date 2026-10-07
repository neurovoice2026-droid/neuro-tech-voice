import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ isConfigured: vi.fn(() => true) }))
vi.mock('./model-catalog', () => ({ cachedAgentLlms: vi.fn() }))

import { cachedAgentLlms } from './model-catalog'
import { isConfigured } from './client'
import { effectiveAgentLlm, llmSelectionProblems, selectLlm } from './llm-selection'
import { agentLlm, isKnownAgentLlm } from './models'
import { createLogger } from '@/lib/observability/logger'
import type { ELLlmInfo } from './api/models'

const ok = (llm: string, efforts: ELLlmInfo['available_reasoning_efforts'] = null): ELLlmInfo => ({ llm, available_reasoning_efforts: efforts, deprecation_info: null })
const CATALOG: ELLlmInfo[] = [
  ok('gpt-5.4-mini', ['minimal', 'low']),
  ok('gemini-2.5-flash'),
  { llm: 'gpt-4o', deprecation_info: { is_deprecated: true, is_in_fallback_period: true, fallback_percentage: 40, replacement_model: 'gpt-5.4', provider_deprecation_date: '2026-12-01' } },
  ok('gpt-5.4'),
]
const log = createLogger({ component: 'test' })

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_LLM', '')
  vi.stubEnv('ELEVENLABS_REASONING_EFFORT', '')
  vi.mocked(isConfigured).mockReturnValue(true)
  vi.mocked(cachedAgentLlms).mockReset().mockResolvedValue(CATALOG)
})

describe('agentLlm (configured value)', () => {
  it('rejects malformed ids and custom-llm, keeps anything well-formed for the catalogue check', () => {
    vi.stubEnv('ELEVENLABS_LLM', 'custom-llm')
    expect(agentLlm()).toBe('gpt-5.4-mini')
    vi.stubEnv('ELEVENLABS_LLM', 'gpt 4o')
    expect(agentLlm()).toBe('gpt-5.4-mini')
    vi.stubEnv('ELEVENLABS_LLM', 'glm-52')
    expect(agentLlm()).toBe('glm-52')
    expect(isKnownAgentLlm('glm-52')).toBe(true)
    expect(isKnownAgentLlm('custom-llm')).toBe(false)
  })
})

describe('selectLlm', () => {
  it('keeps an offered, current model', () => {
    expect(selectLlm('gemini-2.5-flash', CATALOG)).toMatchObject({ llm: 'gemini-2.5-flash', reason: 'ok' })
  })

  it('replaces a deprecated model with the platform default and surfaces the provider replacement', () => {
    expect(selectLlm('gpt-4o', CATALOG)).toMatchObject({
      llm: 'gpt-5.4-mini',
      reason: 'deprecated',
      replacement: 'gpt-5.4',
      fallbackPercentage: 40,
      providerDeprecationDate: '2026-12-01',
    })
  })

  it('replaces a model the catalogue does not offer; uses the replacement when the default is unavailable too', () => {
    expect(selectLlm('gpt-9', CATALOG)).toMatchObject({ llm: 'gpt-5.4-mini', reason: 'not_offered' })
    const noDefault = CATALOG.filter((l) => l.llm !== 'gpt-5.4-mini')
    expect(selectLlm('gpt-4o', noDefault)).toMatchObject({ llm: 'gpt-5.4', reason: 'deprecated' })
    // Nothing usable at all: a deprecated model still answers, an unlisted one never would.
    expect(selectLlm('gpt-4o', [CATALOG[2]])).toMatchObject({ llm: 'gpt-4o', reason: 'deprecated' })
  })

  it('without a catalogue, trusts the spec enum only', () => {
    expect(selectLlm('glm-52', null)).toMatchObject({ llm: 'glm-52', reason: 'catalog_unavailable' })
    expect(selectLlm('gpt-9', null)).toMatchObject({ llm: 'gpt-5.4-mini', reason: 'unknown_without_catalog' })
  })
})

describe('effectiveAgentLlm', () => {
  it('returns the selected LLM with the reasoning effort of THAT model', async () => {
    vi.stubEnv('ELEVENLABS_LLM', 'gpt-4o')
    expect(await effectiveAgentLlm(log)).toMatchObject({ llm: 'gpt-5.4-mini', configured: 'gpt-4o', reasoningEffort: 'minimal' })
  })

  it('never throws when the catalogue is unavailable', async () => {
    vi.mocked(cachedAgentLlms).mockRejectedValue(new Error('down'))
    vi.stubEnv('ELEVENLABS_LLM', 'gemini-2.5-flash')
    expect(await effectiveAgentLlm(log)).toMatchObject({ llm: 'gemini-2.5-flash', reason: 'catalog_unavailable', reasoningEffort: undefined })
  })

  it('diagnostics: an error with the fallback and replacement facts, nothing when fine', async () => {
    vi.stubEnv('ELEVENLABS_LLM', 'gpt-4o')
    const [p] = await llmSelectionProblems(log)
    expect(p).toMatchObject({ key: 'ELEVENLABS_LLM', severity: 'error' })
    expect(p.message).toContain('gpt-5.4-mini instead')
    expect(p.message).toContain('provider replacement: gpt-5.4')
    expect(p.message).toContain('40%')
    vi.stubEnv('ELEVENLABS_LLM', 'gemini-2.5-flash')
    expect(await llmSelectionProblems(log)).toEqual([])
    vi.mocked(isConfigured).mockReturnValue(false)
    expect(await llmSelectionProblems(log)).toEqual([])
  })
})

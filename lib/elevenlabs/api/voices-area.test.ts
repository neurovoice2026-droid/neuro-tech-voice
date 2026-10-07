import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as voices from './voices'
import * as pron from './pronunciation'
import * as history from './history'
import * as el from '../client'
import { setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink } from '@/lib/observability/telemetry'
import { callAt, installFetch, jsonResponse, type FetchMock } from '@/tests/helpers/fetch'

// Request shapes of the slice-F endpoint wrappers (paths, methods, query and
// bodies as in the OpenAPI spec). Every call is a mocked fetch.

let fetchMock: FetchMock
let restoreSink: () => void

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'sk_0123456789abcdef0123456789abcdef0123')
  vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
  setCircuitStore(new MemoryCircuitStore())
  restoreSink = setProviderEventSink(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  fetchMock = installFetch()
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

describe('voices area', () => {
  it('getVoicesByIds: GET /v2/voices with repeated voice_ids (max 100)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ voices: [], has_more: false }))
    await voices.getVoicesByIds(['A0000000', 'B0000000'])
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname]).toEqual(['GET', '/v2/voices'])
    expect(c.url.searchParams.getAll('voice_ids')).toEqual(['A0000000', 'B0000000'])
    expect(c.url.searchParams.get('include_total_count')).toBe('false')
    expect(() => voices.getVoicesByIds(Array.from({ length: 101 }, (_, i) => `v${i}`))).toThrow()
  })

  it('listWorkspaceVoices: one category per call, non-community', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ voices: [], has_more: false }))
    await voices.listWorkspaceVoices({ voice_type: 'non-community', category: 'cloned', next_page_token: 'tok' })
    const q = callAt(fetchMock).url.searchParams
    expect([q.get('voice_type'), q.get('category'), q.get('next_page_token'), q.get('page_size')]).toEqual(['non-community', 'cloned', 'tok', '100'])
  })

  it('searchLibrary: all receptionist filters, moderation/custom rates always excluded', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ voices: [], has_more: false }))
    await voices.searchLibrary({ language: 'ro', accent: 'moldovan', age: 'young', gender: 'female', use_cases: ['conversational'], category: 'high_quality', featured: true, sort: 'trending', page: 2, page_size: 200, min_notice_period_days: 30 })
    const q = callAt(fetchMock).url.searchParams
    expect(callAt(fetchMock).url.pathname).toBe('/v1/shared-voices')
    expect(Object.fromEntries(q.entries())).toMatchObject({
      language: 'ro', accent: 'moldovan', age: 'young', gender: 'female', use_cases: 'conversational', category: 'high_quality',
      featured: 'true', sort: 'trending', page: '2', page_size: '100', min_notice_period_days: '30', include_live_moderated: 'false', include_custom_rates: 'false',
    })
    await voices.searchLibrary({})
    const q2 = callAt(fetchMock, 1).url.searchParams
    expect([q2.has('use_cases'), q2.has('featured'), q2.get('sort')]).toEqual([false, false, 'cloned_by_count'])
  })

  it('listAccents and getVoiceQuota are plain reads', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accents: [] }))
    await voices.listAccents({ language: 'ro' })
    expect([callAt(fetchMock).url.pathname, callAt(fetchMock).url.searchParams.get('language')]).toEqual(['/v1/voices/accents', 'ro'])
    fetchMock.mockResolvedValue(jsonResponse({ voice_slots_used: 1, voice_limit: 30 }))
    expect(await voices.getVoiceQuota()).toMatchObject({ voice_limit: 30 })
    expect(callAt(fetchMock, 1).url.pathname).toBe('/v1/user/subscription')
  })

  it('designVoice: never streams, never sends reference audio, not retried; createVoiceFromPreview not retried', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }))
    await expect(voices.designVoice({ voice_description: 'x'.repeat(20), model_id: 'eleven_multilingual_ttv_v2', text: 'y'.repeat(100) }, 'mp3_22050_32')).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname, c.url.searchParams.get('output_format')]).toEqual(['POST', '/v1/text-to-voice/design', 'mp3_22050_32'])
    expect(c.json).toEqual({ voice_description: 'x'.repeat(20), model_id: 'eleven_multilingual_ttv_v2', text: 'y'.repeat(100), stream_previews: false })
    await expect(voices.createVoiceFromPreview({ voice_name: 'n', voice_description: 'd'.repeat(20), generated_voice_id: 'g' })).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callAt(fetchMock, 1).url.pathname).toBe('/v1/text-to-voice')
  })

  it('addInstantClone: remove_background_noise is false unless asked', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ voice_id: 'v1', requires_verification: false }))
    await el.voices.addInstantClone({ name: 'n', files: [{ blob: new Blob([new Uint8Array(4)]), filename: 's.wav' }] })
    await el.voices.addInstantClone({ name: 'n', files: [{ blob: new Blob([new Uint8Array(4)]), filename: 's.wav' }], removeBackgroundNoise: true, labels: { language: 'ro', gender: 'female' } })
    const f1 = callAt(fetchMock, 0).rawBody as FormData
    const f2 = callAt(fetchMock, 1).rawBody as FormData
    expect(f1.get('remove_background_noise')).toBe('false')
    expect(f2.get('remove_background_noise')).toBe('true')
    expect(JSON.parse(f2.get('labels') as string)).toEqual({ language: 'ro', gender: 'female' })
  })
})

describe('pronunciation dictionaries', () => {
  it('create (no workspace access), add/remove/set rules, get, archive', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'd1', version_id: 'v1', version_rules_num: 1 }))
    const rule = { type: 'alias' as const, string_to_replace: 'Acme', alias: 'acmi', case_sensitive: false, word_boundaries: true }
    await pron.createDictionary({ name: 'ntv:test:org:x', rules: [rule] })
    await pron.addRules('d1', [rule])
    await pron.removeRules('d1', ['Acme'])
    await pron.setRules('d1', [rule])
    await pron.getDictionary('d1')
    await pron.archiveDictionary('d1')
    const calls = fetchMock.mock.calls.map((_, i) => callAt(fetchMock, i))
    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
      'POST /v1/pronunciation-dictionaries/add-from-rules',
      'POST /v1/pronunciation-dictionaries/d1/add-rules',
      'POST /v1/pronunciation-dictionaries/d1/remove-rules',
      'POST /v1/pronunciation-dictionaries/d1/set-rules',
      'GET /v1/pronunciation-dictionaries/d1',
      'PATCH /v1/pronunciation-dictionaries/d1',
    ])
    expect(calls[0].json).toEqual({ name: 'ntv:test:org:x', description: null, rules: [rule] })
    expect(calls[0].json).not.toHaveProperty('workspace_access')
    expect(calls[2].json).toEqual({ rule_strings: ['Acme'] })
    expect(calls[5].json).toEqual({ archived: true })
  })

  it('creating is never retried', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 502 }))
    await expect(pron.createDictionary({ name: 'n', rules: [] })).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('speech history', () => {
  it('lists TTS items (page size capped at 1000) and deletes one', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ history: [], has_more: false }))
    await history.listHistory({ voice_id: 'v1', source: 'TTS', page_size: 5000, date_before_unix: 10, start_after_history_item_id: 'h0' })
    const q = callAt(fetchMock).url.searchParams
    expect(callAt(fetchMock).url.pathname).toBe('/v1/history')
    expect(Object.fromEntries(q.entries())).toEqual({ voice_id: 'v1', source: 'TTS', page_size: '1000', date_before_unix: '10', start_after_history_item_id: 'h0' })
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))
    await history.deleteHistoryItem('h1')
    expect([callAt(fetchMock, 1).method, callAt(fetchMock, 1).url.pathname]).toEqual(['DELETE', '/v1/history/h1'])
  })
})

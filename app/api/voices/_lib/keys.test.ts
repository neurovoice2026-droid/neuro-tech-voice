import { describe, expect, it } from 'vitest'
import {
  catalogPageKey,
  newUploadPath,
  normalizeQuery,
  parseUploadPath,
  previewCacheKey,
  sampleObjectPath,
  speedKeyPart,
  textPreviewFolder,
  textPreviewObjectPath,
  voiceMetaKey,
} from './keys'
import { sampleFor, VOICE_SAMPLE_TEXT } from '@/components/voice/voice-samples'

const ORG = '0b1c2d3e-4f50-4a61-8b72-9c83d94ea5f6'
const OTHER_ORG = '11111111-2222-4333-8444-555555555555'

describe('catalogPageKey', () => {
  const base = { q: 'Calm', gender: 'feminine', language: 'en', startingAfter: null }

  it('is stable and ignores case and spacing of the search', () => {
    expect(catalogPageKey(base)).toBe(catalogPageKey({ ...base, q: '  calm ' }))
    expect(catalogPageKey(base)).toMatch(/^voices:catalog:v1:[0-9a-f]{64}$/)
    expect(normalizeQuery('  Two   words ')).toBe('two words')
    expect(normalizeQuery('   ')).toBeNull()
  })

  it('changes with every upstream parameter', () => {
    const keys = new Set([
      catalogPageKey(base),
      catalogPageKey({ ...base, q: null }),
      catalogPageKey({ ...base, gender: null }),
      catalogPageKey({ ...base, language: 'es' }),
      catalogPageKey({ ...base, startingAfter: 'abc' }),
    ])
    expect(keys.size).toBe(5)
  })

  it('does not confuse a missing search with the literal text "null"', () => {
    expect(catalogPageKey({ ...base, q: null })).not.toBe(catalogPageKey({ ...base, q: 'null' }))
  })

  it('normalises voice ids in meta keys', () => {
    expect(voiceMetaKey('ABC')).toBe(voiceMetaKey('abc'))
  })
})

describe('previewCacheKey', () => {
  const input = {
    voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
    model: 'sonic-3.6-2026-08-27',
    language: 'en',
    speed: 1,
    emotion: null,
    text: 'Hello there',
  }

  it('is a sha256 hex digest', () => {
    expect(previewCacheKey(input)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('treats equal speeds and id casing as the same audio', () => {
    expect(previewCacheKey(input)).toBe(previewCacheKey({ ...input, speed: 1.0 }))
    expect(previewCacheKey(input)).toBe(previewCacheKey({ ...input, voiceId: input.voiceId.toUpperCase() }))
    expect(speedKeyPart(0.9)).toBe('0.90')
    expect(speedKeyPart(null)).toBe('')
  })

  it('changes when anything that changes the audio changes', () => {
    const keys = new Set([
      previewCacheKey(input),
      previewCacheKey({ ...input, model: 'sonic-3.6' }),
      previewCacheKey({ ...input, language: 'ro' }),
      previewCacheKey({ ...input, speed: 1.1 }),
      previewCacheKey({ ...input, speed: null }),
      previewCacheKey({ ...input, emotion: 'calm' }),
      previewCacheKey({ ...input, text: 'Hello there!' }),
      previewCacheKey({ ...input, voiceId: '47c38ca4-5f35-497b-b1a3-415245fb35e1' }),
    ])
    expect(keys.size).toBe(8)
  })

  it('cannot be forged by moving the separator between fields', () => {
    expect(previewCacheKey({ ...input, emotion: 'calm', text: 'x' })).not.toBe(
      previewCacheKey({ ...input, emotion: null, text: 'calm|x' })
    )
  })

  it('shards sample paths by prefix and keeps org-specific audio under the org folder', () => {
    const hash = previewCacheKey(input)
    expect(sampleObjectPath(hash, null)).toBe(`samples/${hash.slice(0, 2)}/${hash}.mp3`)
    expect(sampleObjectPath(hash, ORG)).toBe(`${ORG}/samples/${hash.slice(0, 2)}/${hash}.mp3`)
  })

  it('groups spoken previews by voice so a deleted clone can take its audio with it', () => {
    const hash = previewCacheKey(input)
    const upper = input.voiceId.toUpperCase()
    expect(textPreviewFolder(ORG, upper)).toBe(`${ORG}/text/${input.voiceId}`)
    expect(textPreviewObjectPath(hash, ORG, upper)).toBe(`${ORG}/text/${input.voiceId}/${hash}.mp3`)
    expect(textPreviewObjectPath(hash, ORG, upper).startsWith(`${textPreviewFolder(ORG, input.voiceId)}/`)).toBe(true)
  })
})

describe('upload paths', () => {
  it('only accepts paths issued to this organisation with an allowed format', () => {
    const path = newUploadPath(ORG, 'wav')
    expect(parseUploadPath(ORG, path, ['wav', 'mp3'])).toEqual({ format: 'wav' })
    expect(parseUploadPath(OTHER_ORG, path, ['wav'])).toBeNull()
    expect(parseUploadPath(ORG, path, ['mp3'])).toBeNull()
  })

  it('rejects traversal and hand-made names', () => {
    expect(parseUploadPath(ORG, `${ORG}/../${OTHER_ORG}/x.wav`, ['wav'])).toBeNull()
    expect(parseUploadPath(ORG, `${ORG}/clip.wav`, ['wav'])).toBeNull()
    expect(parseUploadPath(ORG, `/${ORG}/0b1c2d3e-4f50-4a61-8b72-9c83d94ea5f6.wav`, ['wav'])).toBeNull()
    expect(parseUploadPath(ORG, `${ORG}/0b1c2d3e-4f50-4a61-8b72-9c83d94ea5f6.wav/extra`, ['wav'])).toBeNull()
  })
})

describe('sampleFor', () => {
  it('has a sample for all 14 agent languages', () => {
    expect(Object.keys(VOICE_SAMPLE_TEXT).sort()).toEqual(
      ['ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ro', 'zh'].sort()
    )
    for (const text of Object.values(VOICE_SAMPLE_TEXT)) expect(text.length).toBeLessThanOrEqual(120)
  })

  it('uses the base language and falls back to English', () => {
    expect(sampleFor('ro-MD').language).toBe('ro')
    expect(sampleFor('ru').language).toBe('en')
    expect(sampleFor(null).text).toBe(VOICE_SAMPLE_TEXT.en)
  })
})

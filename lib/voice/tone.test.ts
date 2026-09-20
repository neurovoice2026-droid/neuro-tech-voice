import { describe, expect, it } from 'vitest'
import { AGENT_TONES } from '@/types'
import { TONES } from '@/lib/site'
import { TONE_PROFILES, isSonicEmotion, normalizeTone, voiceStyleFor } from './tone'

describe('TONE_PROFILES', () => {
  it('covers every tone with a prompt style', () => {
    for (const tone of AGENT_TONES) {
      const profile = TONE_PROFILES[tone]
      expect(profile.id).toBe(tone)
      expect(profile.promptStyle.length).toBeGreaterThan(40)
      if (profile.speed !== null) {
        expect(profile.speed).toBeGreaterThanOrEqual(0.6)
        expect(profile.speed).toBeLessThanOrEqual(1.5)
      }
    }
  })

  it('uses the marketing site labels and blurbs word for word', () => {
    expect(TONES.map((t) => t.id).sort()).toEqual([...AGENT_TONES].sort())
    for (const site of TONES) {
      const profile = TONE_PROFILES[site.id as keyof typeof TONE_PROFILES]
      expect(profile.label).toBe(site.label)
      expect(profile.blurb).toBe(site.blurb)
    }
  })

  it('suggests speed and emotion where the tone calls for it', () => {
    expect(TONE_PROFILES.energetic.speed).toBe(1.08)
    expect(TONE_PROFILES.empathetic.speed).toBe(0.94)
    expect(TONE_PROFILES.formal.speed).toBe(0.98)
    expect(TONE_PROFILES.professional.speed).toBeNull()
    expect(TONE_PROFILES.friendly.emotion).toBe('content')
    expect(TONE_PROFILES.empathetic.emotion).toBe('calm')
    expect(TONE_PROFILES.energetic.emotion).toBeNull()
  })
})

describe('normalizeTone', () => {
  it('keeps valid tones and tolerates case and whitespace', () => {
    expect(normalizeTone('friendly')).toBe('friendly')
    expect(normalizeTone(' Formal ')).toBe('formal')
  })

  it('maps legacy and unknown values to professional', () => {
    expect(normalizeTone('educational')).toBe('professional')
    expect(normalizeTone('pirate')).toBe('professional')
    expect(normalizeTone(null)).toBe('professional')
    expect(normalizeTone(42)).toBe('professional')
  })
})

describe('voiceStyleFor', () => {
  it('uses the tone suggestion when the agent has no explicit setting', () => {
    expect(voiceStyleFor({ tone: 'empathetic', language: 'en' })).toEqual({ speed: 0.94, emotion: 'calm' })
  })

  it('lets explicit agent settings win and clamps speed', () => {
    expect(voiceStyleFor({ tone: 'energetic', language: 'en', speed: 3, emotion: 'sad' })).toEqual({ speed: 1.5, emotion: 'sad' })
    expect(voiceStyleFor({ tone: 'energetic', language: 'en', speed: 0.1 }).speed).toBe(0.6)
  })

  it('only passes emotions the TTS WebSocket accepts (docs F4)', () => {
    expect(voiceStyleFor({ tone: 'energetic', language: 'en', emotion: 'excited' }).emotion).toBe(TONE_PROFILES.energetic.emotion)
    expect(voiceStyleFor({ tone: 'professional', language: 'en', emotion: ' Angry ' }).emotion).toBe('angry')
    for (const profile of Object.values(TONE_PROFILES)) {
      expect(profile.emotion === null || isSonicEmotion(profile.emotion), profile.id).toBe(true)
    }
  })

  it('never sends an emotion for non-English voices', () => {
    expect(voiceStyleFor({ tone: 'friendly', language: 'ro', emotion: 'content' })).toEqual({ speed: null, emotion: null })
    expect(voiceStyleFor({ tone: 'friendly', language: 'en-GB' }).emotion).toBe('content')
  })
})

import { describe, expect, it } from 'vitest'
import { effectiveAdditionalLanguages, languagePresetGreetings } from './language-presets'
import { AI_DISCLOSURE, RECORDING_NOTICE, mentionsAiDisclosure, mentionsRecordingNotice } from '@/lib/voice/greetings'

describe('effectiveAdditionalLanguages', () => {
  it('keeps supported languages in order, without the primary, duplicates or more than three', () => {
    expect(effectiveAdditionalLanguages('ro', ['en', 'RO', 'de', 'en', 'xx', 'fr', 'it'])).toEqual(['en', 'de', 'fr'])
  })

  it('normalizes region tags and ignores garbage', () => {
    expect(effectiveAdditionalLanguages('en', ['pt-BR', 42 as unknown as string, ''])).toEqual(['pt'])
    expect(effectiveAdditionalLanguages('en', null)).toEqual([])
    expect(effectiveAdditionalLanguages('en', undefined)).toEqual([])
  })
})

describe('languagePresetGreetings', () => {
  const base = { tone: 'professional', orgName: 'Smile Clinic', agentName: 'Ana', recordingNotice: false }

  it('composes a greeting per language that always discloses the AI', () => {
    const out = languagePresetGreetings({ ...base, languages: ['ro', 'en', 'ja'] })
    expect(Object.keys(out)).toEqual(['ro', 'en', 'ja'])
    for (const text of Object.values(out)) {
      expect(mentionsAiDisclosure(text, 'Smile Clinic')).toBe(true)
      expect(text).toContain('Smile Clinic')
    }
    expect(out.ro).toContain('Ana')
  })

  it('adds the recording notice in each language when enabled', () => {
    const out = languagePresetGreetings({ ...base, languages: ['ro', 'de'], recordingNotice: true })
    expect(out.ro).toContain(RECORDING_NOTICE.ro)
    expect(out.de).toContain(RECORDING_NOTICE.de)
    for (const text of Object.values(out)) expect(mentionsRecordingNotice(text, 'Smile Clinic')).toBe(true)
  })

  it('never introduces the generated default agent name, and still discloses without a business name', () => {
    const out = languagePresetGreetings({ ...base, languages: ['en'], agentName: 'Smile Clinic Agent' })
    expect(out.en).not.toContain('Smile Clinic Agent')
    const plain = languagePresetGreetings({ ...base, languages: ['en'], orgName: null, agentName: 'My Agent' })
    expect(plain.en).not.toContain('My Agent')
    expect(mentionsAiDisclosure(plain.en)).toBe(true)
  })

  it('a business name that looks like a disclosure does not count as one', () => {
    const out = languagePresetGreetings({ ...base, languages: ['en'], orgName: 'AI Labs', agentName: '' })
    expect(mentionsAiDisclosure(out.en, 'AI Labs')).toBe(true)
    expect(AI_DISCLOSURE.en.length).toBeGreaterThan(0)
  })
})

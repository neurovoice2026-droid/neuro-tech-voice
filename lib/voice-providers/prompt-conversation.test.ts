// Platform rules for the ElevenLabs conversation features (voicemail gating,
// skip_turn, language switching, number formatting, keypad input).
import { describe, expect, it } from 'vitest'
import { composeSystemPrompt, PLATFORM_VARIABLES } from './prompt'

describe('composeSystemPrompt: conversation features', () => {
  it('restricts voicemail detection to outbound calls through {{ntv_call_direction}}', () => {
    expect(PLATFORM_VARIABLES.callDirection).toBe('ntv_call_direction')
    const out = composeSystemPrompt({ voicemailDetection: true })
    expect(out).toContain('{{ntv_call_direction}} is "outbound" only on calls you placed')
    expect(out).toContain('never use voicemail_detection')
    expect(composeSystemPrompt({ voicemailDetection: false })).not.toContain('voicemail_detection')
  })

  it('adds the skip_turn, language, digits and keypad rules only when enabled', () => {
    const on = composeSystemPrompt({ language: 'ro', skipTurn: true, additionalLanguages: ['en', 'de'], numbersAsDigits: true, keypadInput: true })
    expect(on).toContain('use the skip_turn tool')
    expect(on).toContain('Languages: you start in Romanian. If the caller speaks or asks for English, German, switch with the language_detection tool')
    expect(on).toContain('Write phone numbers, prices, dates and times with digits')
    expect(on).toContain('phone keypad')
    const off = composeSystemPrompt({ language: 'ro' })
    for (const text of ['skip_turn', 'language_detection', 'with digits', 'keypad']) expect(off).not.toContain(text)
  })

  it('a Romanian agent that may switch languages keeps the diacritics rule without "always speak Romanian"', () => {
    const switching = composeSystemPrompt({ language: 'ro', additionalLanguages: ['en'] })
    expect(switching).toContain('Whenever you write or speak Romanian, use correct diacritics')
    expect(switching).not.toContain('You must always write and speak in Romanian')
    // The single-language Cartesia fallback keeps the strict rule.
    expect(composeSystemPrompt({ language: 'ro', additionalLanguages: ['en'], callContext: 'tool' })).toContain('You must always write and speak in Romanian')
    expect(composeSystemPrompt({ language: 'ro' })).toContain('You must always write and speak in Romanian')
  })

  it('ignores the primary language in the additional list', () => {
    expect(composeSystemPrompt({ language: 'en', additionalLanguages: ['en'] })).not.toContain('language_detection')
  })

  it('never adds ElevenLabs tool rules or template variables to the Cartesia fallback prompt', () => {
    for (const callContext of ['tool', 'none'] as const) {
      const out = composeSystemPrompt({ callContext, voicemailDetection: true, skipTurn: true, additionalLanguages: ['ro'], numbersAsDigits: true, keypadInput: true })
      expect(out).not.toContain('{{')
      for (const text of ['voicemail_detection', 'skip_turn', 'language_detection', 'keypad']) expect(out, `${callContext}: ${text}`).not.toContain(text)
    }
  })

  it('keeps the new rules after the precedence header', () => {
    const out = composeSystemPrompt({ system_prompt: 'Be brief.', voicemailDetection: true })
    expect(out.indexOf('Voicemail:')).toBeGreaterThan(out.indexOf('Platform rules'))
  })
})

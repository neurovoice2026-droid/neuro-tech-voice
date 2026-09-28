import { describe, expect, it } from 'vitest'
import { AGENT_TONES } from '@/types'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import {
  AI_DISCLOSURE,
  APOLOGY_MESSAGE,
  FILLER_PHRASES,
  GOODBYE_SILENCE,
  RECORDING_NOTICE,
  RESUME_AFTER_HANDOFF,
  STILL_THERE,
  TRANSFER_ANNOUNCE,
  UNAVAILABLE_MESSAGE,
  WRAP_UP,
  applyDisclosure,
  greetingFor,
  localized,
  localizedList,
  mentionsAiDisclosure,
  mentionsRecordingNotice,
  outboundGreetingFor,
} from './greetings'

const LANGS = AGENT_LANGUAGES.map((l) => l.value)

describe('localized maps', () => {
  const maps = { AI_DISCLOSURE, RECORDING_NOTICE, APOLOGY_MESSAGE, UNAVAILABLE_MESSAGE, TRANSFER_ANNOUNCE, RESUME_AFTER_HANDOFF, STILL_THERE, GOODBYE_SILENCE, WRAP_UP }

  it.each(Object.entries(maps))('%s has a non-empty line for all 14 languages', (_, map) => {
    expect(Object.keys(map).sort()).toEqual([...LANGS].sort())
    for (const lang of LANGS) expect(map[lang].trim().length, lang).toBeGreaterThan(0)
  })

  it('has filler phrases for all 14 languages', () => {
    expect(Object.keys(FILLER_PHRASES).sort()).toEqual([...LANGS].sort())
    for (const lang of LANGS) expect(FILLER_PHRASES[lang].length).toBeGreaterThanOrEqual(2)
  })

  it('keeps the {name} placeholder in every transfer line', () => {
    for (const lang of LANGS) expect(TRANSFER_ANNOUNCE[lang]).toContain('{name}')
  })

  it('writes Romanian with diacritics', () => {
    for (const map of Object.values(maps)) expect(map.ro).toMatch(/[ăâîșț]/)
  })

  it('every disclosure and recording line is recognised by the detectors', () => {
    for (const lang of LANGS) {
      expect(mentionsAiDisclosure(AI_DISCLOSURE[lang]), lang).toBe(true)
      expect(mentionsRecordingNotice(RECORDING_NOTICE[lang]), lang).toBe(true)
    }
  })
})

describe('localized', () => {
  it('fills placeholders and falls back to English', () => {
    expect(localized(TRANSFER_ANNOUNCE, 'en', { name: 'Maria' })).toBe('Please hold while I connect you to Maria.')
    expect(localized(TRANSFER_ANNOUNCE, 'sv', { name: 'Maria' })).toBe('Please hold while I connect you to Maria.')
    expect(localized(TRANSFER_ANNOUNCE, 'ro-RO', { name: 'Maria' })).toBe('Vă rog să rămâneți la telefon, vă fac legătura cu Maria.')
  })

  it('leaves unknown placeholders alone', () => {
    expect(localized({ en: 'Hi {name} {other}' }, 'en', { name: 'A' })).toBe('Hi A {other}')
    expect(localized({ en: 'Hi {constructor}' }, 'en', {})).toBe('Hi {constructor}')
  })

  it('returns lists with the same fallback', () => {
    expect(localizedList(FILLER_PHRASES, 'xx')).toEqual(FILLER_PHRASES.en)
  })
})

describe('greetingFor', () => {
  it('mentions the company and agent and discloses the AI in every language and tone', () => {
    for (const language of LANGS) {
      for (const tone of AGENT_TONES) {
        const greeting = greetingFor({ language, tone, company: 'Zenith Clinic', agentName: 'Mara' })
        expect(greeting, `${language}/${tone}`).toContain('Zenith Clinic')
        expect(greeting, `${language}/${tone}`).toContain('Mara')
        expect(mentionsAiDisclosure(greeting, 'Zenith Clinic'), `${language}/${tone}`).toBe(true)
        expect(greeting).not.toMatch(/\{\w+\}/)
      }
    }
  })

  it('changes register with tone', () => {
    for (const language of LANGS) {
      const formal = greetingFor({ language, tone: 'formal', company: 'Zenith', agentName: 'Mara' })
      const neutral = greetingFor({ language, tone: 'professional', company: 'Zenith', agentName: 'Mara' })
      const casual = greetingFor({ language, tone: 'energetic', company: 'Zenith', agentName: 'Mara' })
      expect(new Set([formal, neutral, casual]).size, language).toBe(3)
    }
  })

  it('reads naturally in English', () => {
    expect(greetingFor({ language: 'en', tone: 'professional', company: 'Zenith Clinic', agentName: 'Mara' })).toBe(
      'Thank you for calling Zenith Clinic. This is Mara, an AI assistant. How can I help you today?'
    )
  })

  it('joins Japanese and Chinese sentences without spaces', () => {
    const ja = greetingFor({ language: 'ja', tone: 'professional', company: 'ゼニス', agentName: 'さくら' })
    expect(ja).not.toContain(' ')
    const zh = greetingFor({ language: 'zh', tone: 'formal', company: '天元诊所', agentName: '小美' })
    expect(zh).toBe('您好，感谢致电天元诊所。我是AI智能助理小美。请问有什么可以为您效劳？')
  })

  it('still discloses without a company or agent name', () => {
    for (const language of LANGS) {
      const greeting = greetingFor({ language, tone: 'friendly', company: '  ', agentName: '' })
      expect(mentionsAiDisclosure(greeting), language).toBe(true)
      expect(greeting).not.toMatch(/\{\w+\}|\s{2,}/)
    }
  })

  it('falls back to English for an unsupported language', () => {
    expect(greetingFor({ language: 'sv', tone: 'casual', company: 'Zenith', agentName: 'Mara' })).toBe(
      "Hi, thanks for calling Zenith! I'm Mara, the AI assistant here. What can I do for you?"
    )
  })
})

describe('outboundGreetingFor', () => {
  it('names the agent, the company and discloses in every language', () => {
    for (const language of LANGS) {
      const greeting = outboundGreetingFor({ language, company: 'Zenith Clinic', agentName: 'Mara' })
      expect(greeting, language).toContain('Zenith Clinic')
      expect(greeting, language).toContain('Mara')
      expect(mentionsAiDisclosure(greeting, 'Zenith Clinic'), language).toBe(true)
    }
    expect(outboundGreetingFor({ language: 'en', company: 'Zenith', agentName: 'Mara' })).toBe(
      "Hello, this is Mara, an AI assistant. I'm calling on behalf of Zenith. Is now a good time to talk?"
    )
  })
})

describe('applyDisclosure', () => {
  it('inserts the disclosure before the closing question', () => {
    expect(applyDisclosure('Thanks for calling Zenith. How can I help?', { language: 'en', businessName: 'Zenith', recordingNotice: false })).toBe(
      "Thanks for calling Zenith. Just so you know, I'm an AI assistant. How can I help?"
    )
  })

  it('adds the recording notice after the disclosure when asked', () => {
    expect(applyDisclosure('Thanks for calling Zenith. How can I help?', { language: 'en', businessName: 'Zenith', recordingNotice: true })).toBe(
      "Thanks for calling Zenith. Just so you know, I'm an AI assistant. This call may be recorded for quality purposes. How can I help?"
    )
  })

  it('prepends to a single-question greeting and closes an unterminated one', () => {
    expect(applyDisclosure('Zenith, how can I help?', { language: 'en', businessName: 'Zenith', recordingNotice: false })).toBe(
      "Just so you know, I'm an AI assistant. Zenith, how can I help?"
    )
    expect(applyDisclosure('Welcome to Zenith', { language: 'en', businessName: 'Zenith', recordingNotice: false })).toBe(
      "Welcome to Zenith. Just so you know, I'm an AI assistant."
    )
  })

  it("doesn't split on decimals or times", () => {
    expect(applyDisclosure('We open at 9.30 today. What do you need?', { language: 'en', businessName: 'Zenith', recordingNotice: false })).toBe(
      "We open at 9.30 today. Just so you know, I'm an AI assistant. What do you need?"
    )
  })

  it('leaves a greeting that already discloses untouched', () => {
    const existing = 'Hello! Thank you for calling Zenith. I\'m Mara, your virtual assistant. How can I help you today?'
    expect(applyDisclosure(existing, { language: 'en', businessName: 'Zenith', recordingNotice: false })).toBe(existing)
  })

  it("doesn't take an AI word in the business name as a disclosure", () => {
    const out = applyDisclosure('Thanks for calling Acme AI Labs. How can I help?', { language: 'en', businessName: 'Acme AI Labs', recordingNotice: false })
    expect(out).toContain("I'm an AI assistant")
  })

  it('builds a minimal greeting when there is none', () => {
    expect(applyDisclosure(null, { language: 'en', businessName: 'Zenith', recordingNotice: false })).toBe(
      "Thank you for calling Zenith. Just so you know, I'm an AI assistant. How can I help you today?"
    )
    expect(applyDisclosure('  ', { language: 'de', businessName: '', recordingNotice: true })).toBe(
      'Vielen Dank für Ihren Anruf. Zu Ihrer Information: Ich bin ein virtueller Assistent mit künstlicher Intelligenz. Dieses Gespräch kann zu Qualitätszwecken aufgezeichnet werden. Wie kann ich Ihnen helfen?'
    )
  })

  it('handles Japanese punctuation without spaces', () => {
    expect(applyDisclosure('お電話ありがとうございます。ゼニスです。ご用件をどうぞ？', { language: 'ja', businessName: 'ゼニス', recordingNotice: false })).toBe(
      'お電話ありがとうございます。ゼニスです。なお、このお電話はAIアシスタントが対応しております。ご用件をどうぞ？'
    )
  })

  it.each(LANGS)('is idempotent for %s (custom and generated greetings, with and without the recording notice)', (language) => {
    const custom: Record<string, string> = {
      en: 'Hello, Zenith here. How can we help?',
      ro: 'Bună ziua, Zenith. Cu ce vă putem ajuta?',
      es: 'Hola, Zenith. ¿En qué le podemos ayudar?',
      fr: 'Bonjour, ici Zenith. Que puis-je faire pour vous ?',
      de: 'Hallo, hier ist Zenith. Wie können wir helfen?',
      it: 'Buongiorno, Zenith. Come possiamo aiutarla?',
      pt: 'Olá, Zenith. Em que podemos ajudar?',
      pl: 'Dzień dobry, Zenith. W czym możemy pomóc?',
      nl: 'Goedendag, Zenith. Waarmee kunnen we helpen?',
      ja: 'はい、ゼニスです。ご用件をお伺いします。',
      ko: '네, 제니스입니다. 무엇을 도와드릴까요?',
      zh: '您好，这里是Zenith。有什么可以帮您？',
      ar: 'مرحباً، معكم Zenith. كيف نساعدكم؟',
      hi: 'नमस्ते, Zenith. हम आपकी क्या मदद करें?',
    }
    const inputs = [custom[language], greetingFor({ language, tone: 'formal', company: 'Zenith', agentName: 'Mara' }), null]
    for (const recordingNotice of [false, true]) {
      for (const greeting of inputs) {
        const opts = { language, businessName: 'Zenith', recordingNotice }
        const once = applyDisclosure(greeting, opts)
        expect(mentionsAiDisclosure(once, 'Zenith'), `${language}: ${once}`).toBe(true)
        if (recordingNotice) expect(mentionsRecordingNotice(once, 'Zenith'), `${language}: ${once}`).toBe(true)
        expect(applyDisclosure(once, opts), language).toBe(once)
        expect(applyDisclosure(applyDisclosure(once, opts), opts)).toBe(once)
      }
    }
    // Generated greetings already disclose, so nothing is added.
    const generated = greetingFor({ language, tone: 'casual', company: 'Zenith', agentName: 'Mara' })
    expect(applyDisclosure(generated, { language, businessName: 'Zenith', recordingNotice: false })).toBe(generated)
  })

  it.each(LANGS)('adds exactly one disclosure to an undisclosed %s greeting', (language) => {
    const out = applyDisclosure('Zenith.', { language, businessName: 'Zenith', recordingNotice: false })
    expect(out.split(AI_DISCLOSURE[language]).length - 1).toBe(1)
  })
})

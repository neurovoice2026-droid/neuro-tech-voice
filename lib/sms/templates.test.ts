import { describe, expect, it } from 'vitest'
import {
  bookingCancelledSms,
  bookingConfirmationSms,
  bookingReminderSms,
  bookingRescheduledSms,
  callerMessageSms,
  formatSmsDateTime,
  messageReceivedSms,
  sanitizeSmsText,
  SMS_LANGUAGES,
  SMS_MAX_LENGTH,
  smsLength,
  teamAlertSms,
  waitlistOfferSms,
} from '@/lib/sms/templates'

const LONG_BUSINESS = 'Clinica Stomatologică Dr. Popescu & Asociații Premium Dental Studio București'
const LONG_SERVICE = 'Consultație completă cu radiografie panoramică și plan de tratament personalizat pentru implant'
const LONG_MESSAGE =
  'Bună ziua, sun pentru că am o durere foarte puternică la măseaua din stânga jos de ieri seară, nu pot să mănânc și aș vrea să vin cât mai repede, chiar și astăzi dacă se poate. Vă rog să mă sunați înapoi la numărul acesta sau pe mobil după ora cinci, mulțumesc frumos și o zi bună în continuare. '.repeat(2)

const STARTS_AT = '2026-09-23T11:30:00Z'
const URL_PATTERN = /https?:\/\/|www\./i

describe('booking texts in every language', () => {
  const builders = {
    confirmation: bookingConfirmationSms,
    rescheduled: bookingRescheduledSms,
    cancelled: bookingCancelledSms,
    reminder: bookingReminderSms,
    waitlist: waitlistOfferSms,
  }

  for (const language of SMS_LANGUAGES) {
    for (const [kind, build] of Object.entries(builders)) {
      it(`${kind} (${language}) fits ${SMS_MAX_LENGTH} characters with long names and has no links`, () => {
        const text = build({
          language,
          businessName: `${LONG_BUSINESS} https://example.com/book`,
          startsAt: STARTS_AT,
          timezone: 'Europe/Bucharest',
          service: LONG_SERVICE,
        })
        expect(smsLength(text)).toBeLessThanOrEqual(SMS_MAX_LENGTH)
        expect(text).not.toMatch(URL_PATTERN)
        expect(text).not.toMatch(/\{\w+\}/)
        expect(text.length).toBeGreaterThan(40)
      })
    }

    it(`team texts (${language}) fit with a very long message`, () => {
      for (const urgency of ['normal', 'urgent'] as const) {
        const message = messageReceivedSms({
          language,
          businessName: LONG_BUSINESS,
          callerName: 'Alexandra-Ioana Constantinescu-Vasilescu',
          callbackNumber: '+40712345678',
          message: `${LONG_MESSAGE} see www.example.com`,
          urgency,
        })
        const alert = teamAlertSms({ language, businessName: LONG_BUSINESS, summary: LONG_MESSAGE, callerNumber: '+40712345678', urgency })
        for (const text of [message, alert]) {
          expect(smsLength(text)).toBeLessThanOrEqual(SMS_MAX_LENGTH)
          expect(text).not.toMatch(URL_PATTERN)
          expect(text).toContain('+40712345678')
        }
      }
    })
  }
})

describe('content', () => {
  it('names the business, the local date and time, and the service', () => {
    const text = bookingConfirmationSms({
      language: 'en',
      businessName: 'Bright Smile Dental',
      startsAt: STARTS_AT,
      timezone: 'Europe/Bucharest',
      service: 'Cleaning',
    })
    // ICU versions differ on commas in dates; the rest of the sentence is fixed.
    expect(text).toMatch(
      /^Bright Smile Dental: your appointment on Wednesday,? 23 September,? (at )?14:30 is confirmed\. Service: Cleaning\. To change or cancel it, just call us\.$/
    )
  })

  it('formats in the recipient language and business time zone', () => {
    expect(formatSmsDateTime(STARTS_AT, 'Europe/Bucharest', 'ro')).toMatch(/miercuri.*23 septembrie.*14:30/)
    expect(formatSmsDateTime(STARTS_AT, 'America/New_York', 'en')).toMatch(/Wednesday, September 23.*7:30/)
    expect(formatSmsDateTime(STARTS_AT, 'Asia/Tokyo', 'ja')).toContain('20:30')
    // Arabic keeps Latin digits and the Gregorian calendar.
    expect(formatSmsDateTime(STARTS_AT, 'Asia/Dubai', 'ar')).toMatch(/23/)
  })

  it('leaves out the service line when there is none and falls back to a sender label', () => {
    const text = bookingReminderSms({ language: 'de', businessName: '  ', startsAt: STARTS_AT, timezone: 'Europe/Berlin', service: null })
    expect(text.startsWith('Erinnerung von Terminservice')).toBe(true)
    expect(text).not.toContain('Leistung')
    expect(text).toContain('STOP')
  })

  it('uses English for unsupported languages', () => {
    expect(bookingCancelledSms({ language: 'tr', businessName: 'Acme', startsAt: STARTS_AT, timezone: 'UTC' })).toMatch(/^Acme: your appointment/)
  })

  it('marks urgent team texts', () => {
    const text = messageReceivedSms({ language: 'en', businessName: 'Acme', callerName: null, callbackNumber: null, message: 'Leak in the basement', urgency: 'urgent' })
    expect(text).toBe('URGENT Acme: new message from an unknown caller. Message: Leak in the basement')
  })

  it('signs agent texts with the business name and keeps their links', () => {
    expect(callerMessageSms({ businessName: 'Acme', message: 'Our address is 1 Main St. Map: https://maps.example.com/acme' })).toBe(
      'Acme: Our address is 1 Main St. Map: https://maps.example.com/acme'
    )
    expect(callerMessageSms({ businessName: 'Acme', message: 'acme parking is behind the building' })).toBe('acme parking is behind the building')
    expect(smsLength(callerMessageSms({ businessName: 'Acme', message: LONG_MESSAGE }))).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })

  it('sanitizes control characters and links', () => {
    expect(sanitizeSmsText('Hello\n\tworld  http://x.y/z  ok')).toBe('Hello world ok')
  })
})

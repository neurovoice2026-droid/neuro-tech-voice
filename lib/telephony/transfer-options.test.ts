// Transfer options (slice C): the extension (Twilio sendDigits / ElevenLabs
// post_dial_digits), the warm-transfer whisper TwiML and its sanitized reason.
import { describe, expect, it } from 'vitest'
import { forwardCall, whisperResponse } from './twiml'
import { speakableReason, whisperText, WHISPER_REASON_MAX } from './whisper'
import { twilioSendDigits } from './context'
import { TransferSettingsSchema, readTransferSettings, transferExtension } from '@/lib/voice-providers/settings'
import { findAll, findOne, parseXml } from '@/tests/helpers/xml'

describe('transfer extension setting', () => {
  it('accepts digits, * and # with w/W pauses, and needs at least one key', () => {
    for (const ok of ['123', 'ww123', '1#', '*9', 'W2w3#']) expect(transferExtension.safeParse(ok).success).toBe(true)
    for (const bad of ['', 'www', 'abc', '12 34x', '1'.repeat(25), '12;DROP']) expect(transferExtension.safeParse(bad).success).toBe(false)
  })

  it('is optional in the API schema (older clients) and defaults when read back', () => {
    expect(TransferSettingsSchema.safeParse({ enabled: true, number: '+40712345678', condition: null, label: null }).success).toBe(true)
    expect(TransferSettingsSchema.safeParse({ enabled: true, number: '+40712345678', condition: null, label: null, extension: 'ww12', transfer_type: 'blind', whisper: true }).success).toBe(true)
    expect(TransferSettingsSchema.safeParse({ enabled: true, number: '+40712345678', condition: null, label: null, transfer_type: 'sip_refer' }).success).toBe(false)
    expect(readTransferSettings({ enabled: true, number: '+40712345678' })).toMatchObject({ extension: null, transfer_type: 'conference', whisper: false })
  })

  it('a stored invalid extension is dropped on read (a tenant cannot inject TwiML or digits)', () => {
    const t = readTransferSettings({ enabled: true, number: '+40712345678', condition: null, label: null, extension: '"/><Hangup/>', whisper: true })
    expect(t.extension).toBeNull()
    expect(t.whisper).toBe(true)
    expect(t.enabled).toBe(true)
  })

  it('maps to Twilio sendDigits (W = one second = ww), null when absent or invalid', () => {
    expect(twilioSendDigits('ww123')).toBe('ww123')
    expect(twilioSendDigits('W1#')).toBe('ww1#')
    expect(twilioSendDigits(null)).toBeNull()
    expect(twilioSendDigits('ww')).toBeNull()
    expect(twilioSendDigits('12a')).toBeNull()
  })
})

describe('forwardCall with transfer options', () => {
  const base = { language: 'ro', to: '+40799000111', callerId: '+40712345678', actionUrl: 'https://app.example/api/telephony/twilio/dial-complete?t=x.y&leg=transfer' }

  it('without options keeps the plain <Number> (no behaviour change)', () => {
    const num = findOne(parseXml(forwardCall(base)), 'Number')
    expect(num.attrs).toEqual({})
    expect(num.text).toBe('+40799000111')
  })

  it('adds sendDigits and the whisper url on the <Number>, escaped', () => {
    const xml = forwardCall({ ...base, sendDigits: 'ww123', whisperUrl: 'https://app.example/api/telephony/twilio/whisper?t=a.b&x=1' })
    const num = findOne(parseXml(xml), 'Number')
    expect(num.attrs).toEqual({ sendDigits: 'ww123', url: 'https://app.example/api/telephony/twilio/whisper?t=a.b&x=1', method: 'POST' })
    expect(xml).toContain('t=a.b&amp;x=1')
  })

  it('ignores digits outside the Twilio alphabet', () => {
    const num = findOne(parseXml(forwardCall({ ...base, sendDigits: '1W2' })), 'Number')
    expect(num.attrs.sendDigits).toBeUndefined()
  })
})

describe('whisper', () => {
  it('the document only speaks (never hangs up the human leg)', () => {
    const doc = parseXml(whisperResponse('Hello <Hangup/>', 'en'))
    expect(findAll(doc, 'Hangup')).toHaveLength(0)
    expect(findOne(doc, 'Say').text).toBe('Hello <Hangup/>')
    expect(parseXml(whisperResponse(null, 'en')).children).toHaveLength(0)
  })

  it('reduces the LLM-written reason to one short line without numbers, links or markup', () => {
    expect(speakableReason('Wants to reschedule\nthe appointment.')).toBe('Wants to reschedule the appointment')
    expect(speakableReason('Card 4111 1111 1111 1111, call back +40 712 345 678')).toBe('Card , call back')
    expect(speakableReason('Caller [number] asked about prices')).toBe('Caller asked about prices')
    expect(speakableReason('see https://evil.example/x <b>now</b>')).toBe('see now')
    expect(speakableReason('12345 678')).toBeNull()
    expect(speakableReason(42)).toBeNull()
    expect((speakableReason('word '.repeat(80)) ?? '').length).toBeLessThanOrEqual(WHISPER_REASON_MAX)
  })

  it('announces in the agent language, with the reason when there is one', () => {
    expect(whisperText('ro', 'Programare urgentă')).toBe('Aveți un apel transferat de asistentul virtual. Motivul: Programare urgentă.')
    expect(whisperText('en', '')).toBe('You have a call transferred by the AI assistant.')
    expect(whisperText('xx', undefined)).toBe('You have a call transferred by the AI assistant.')
  })
})

import { describe, expect, it } from 'vitest'
import { redact, redactText } from './redact'
import { summarizeErrorBody, codeForStatus, toProviderError } from '@/lib/voice-providers/errors'

// Built at runtime so the fixture is not a literal credential-shaped string.
const FAKE_ACCOUNT_SID = ['A', 'C', '0123456789abcdef'.repeat(2)].join('')

describe('redact', () => {
  it('masks phone numbers and strips credentials from free text', () => {
    const out = redactText(`call from +40712345123 with Bearer abc.def-ghi and ${FAKE_ACCOUNT_SID}`)
    expect(out).toContain('+40 7** *** 123')
    expect(out).not.toContain('abc.def-ghi')
    expect(out).not.toContain(FAKE_ACCOUNT_SID)
  })

  it('removes secret-looking keys and bulky PII but keeps ids for correlation', () => {
    const out = redact({
      api_key: 'xi-123',
      webhook_secret: 'wsec',
      authorization: 'Bearer x',
      call_sid: 'CA123',
      conversation_id: 'conv_1',
      transcript: [{ role: 'user', message: 'my card is 4111' }],
      nested: { auth_token: 't', from: '+14155550123' },
    }) as Record<string, unknown>
    expect(out.api_key).toBe('[redacted]')
    expect(out.webhook_secret).toBe('[redacted]')
    expect(out.authorization).toBe('[redacted]')
    expect(out.call_sid).toBe('CA123')
    expect(out.conversation_id).toBe('conv_1')
    expect(out.transcript).toBe('[1 items]')
    const nested = out.nested as Record<string, string>
    expect(nested.auth_token).toBe('[redacted]')
    expect(nested.from.startsWith('+1 ')).toBe(true)
    expect(nested.from).not.toContain('5550')
    expect(nested.from.endsWith('123')).toBe(true)
  })
})

describe('provider error helpers', () => {
  it('maps statuses to the taxonomy', () => {
    expect(codeForStatus(401)).toBe('auth')
    expect(codeForStatus(404)).toBe('not_found')
    expect(codeForStatus(422)).toBe('validation')
    expect(codeForStatus(429)).toBe('rate_limited')
    expect(codeForStatus(503)).toBe('upstream')
    expect(codeForStatus(402)).toBe('quota')
  })

  it('summarizes only bounded, structured parts of an error body', () => {
    expect(summarizeErrorBody(JSON.stringify({ detail: { status: 'voice_not_found', message: 'Voice not found' } })))
      .toBe('voice_not_found - Voice not found')
    expect(summarizeErrorBody(JSON.stringify({ detail: [{ loc: ['body', 'tts', 'model_id'], msg: 'bad model' }] })))
      .toBe('body.tts.model_id: bad model')
    expect(summarizeErrorBody('<html>huge page</html>')).toBeNull()
  })

  it('classifies thrown fetch failures', () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' })
    expect(toProviderError(timeout, 'cartesia', 'op').code).toBe('timeout')
    expect(toProviderError(new TypeError('fetch failed'), 'cartesia', 'op').code).toBe('network')
  })
})

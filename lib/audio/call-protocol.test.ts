import { describe, expect, it } from 'vitest'
import {
  MODE_LABELS,
  classifySessionError,
  describeMicError,
  endReasonText,
  formatCallTime,
  isAllowedGatewayUrl,
  parseApiError,
  parseServerMessage,
  parseTestSession,
  phoneTestErrorMessage,
} from './call-protocol'

describe('parseServerMessage', () => {
  it('accepts every message in the browser contract', () => {
    expect(parseServerMessage('{"type":"ready","mode":"cartesia_self"}')).toEqual({ type: 'ready', mode: 'cartesia_self' })
    expect(parseServerMessage('{"type":"user_transcript","text":"hi","final":true}')).toEqual({ type: 'user_transcript', text: 'hi', final: true })
    expect(parseServerMessage('{"type":"user_transcript","text":"hi"}')).toEqual({ type: 'user_transcript', text: 'hi', final: false })
    expect(parseServerMessage('{"type":"agent_text","text":"Hello"}')).toEqual({ type: 'agent_text', text: 'Hello' })
    expect(parseServerMessage('{"type":"agent_text","text":"Hello.","turn":3}')).toEqual({ type: 'agent_text', text: 'Hello.', turn: 3 })
    expect(parseServerMessage('{"type":"agent_text","text":"","turn":3,"interrupted":true}')).toEqual({ type: 'agent_text', text: '', turn: 3, interrupted: true })
    // Anything but a whole non-negative number is not a turn id; only a real true is a flag.
    expect(parseServerMessage('{"type":"agent_text","text":"Hi","turn":"3","interrupted":"yes"}')).toEqual({ type: 'agent_text', text: 'Hi' })
    expect(parseServerMessage('{"type":"agent_text","text":"Hi","turn":1.5}')).toEqual({ type: 'agent_text', text: 'Hi' })
    expect(parseServerMessage('{"type":"clear"}')).toEqual({ type: 'clear' })
    expect(parseServerMessage('{"type":"mode_switched","mode":"elevenlabs"}')).toEqual({ type: 'mode_switched', mode: 'elevenlabs' })
    expect(parseServerMessage('{"type":"ended","reason":"max_duration"}')).toEqual({ type: 'ended', reason: 'max_duration' })
    expect(parseServerMessage('{"type":"error","message":"boom"}')).toEqual({ type: 'error', message: 'boom' })
  })

  it('rejects malformed or unknown frames', () => {
    expect(parseServerMessage('not json')).toBeNull()
    expect(parseServerMessage('null')).toBeNull()
    expect(parseServerMessage('{"type":"ready","mode":"openai"}')).toBeNull()
    expect(parseServerMessage('{"type":"agent_text","text":5}')).toBeNull()
    expect(parseServerMessage('{"type":"mystery"}')).toBeNull()
  })

  it('treats an unknown end reason as an error end', () => {
    expect(parseServerMessage('{"type":"ended","reason":"??"}')).toEqual({ type: 'ended', reason: 'error' })
  })
})

describe('parseTestSession', () => {
  it('validates the test-session response', () => {
    expect(parseTestSession({ ws_url: 'wss://gw.example.com/browser?token=x', call_id: 'c1', mode: 'cartesia_managed' })).toEqual({
      ws_url: 'wss://gw.example.com/browser?token=x',
      call_id: 'c1',
      mode: 'cartesia_managed',
    })
    expect(parseTestSession({ ws_url: 'wss://x', call_id: 'c1', mode: 'nope' })).toBeNull()
    expect(parseTestSession(null)).toBeNull()
  })
})

describe('isAllowedGatewayUrl', () => {
  it('requires wss except for local http development', () => {
    expect(isAllowedGatewayUrl('wss://gw.example.com/browser', 'https:')).toBe(true)
    expect(isAllowedGatewayUrl('ws://localhost:8080/browser', 'http:')).toBe(true)
    expect(isAllowedGatewayUrl('ws://gw.example.com/browser', 'https:')).toBe(false)
    expect(isAllowedGatewayUrl('https://gw.example.com', 'https:')).toBe(false)
    expect(isAllowedGatewayUrl('::nope', 'https:')).toBe(false)
  })
})

describe('parseApiError + classifySessionError', () => {
  it('reads both error body shapes', () => {
    expect(parseApiError(429, { error: { code: 'rate_limited', message: 'Slow down' } })).toEqual({ status: 429, code: 'rate_limited', message: 'Slow down' })
    expect(parseApiError(400, { error: 'Phone number is required' })).toEqual({ status: 400, code: 'http_400', message: 'Phone number is required' })
    expect(parseApiError(500, 'oops')).toEqual({ status: 500, code: 'http_500', message: null })
  })

  it('routes a missing gateway to the call-my-phone form', () => {
    expect(classifySessionError({ status: 503, code: 'gateway_not_configured', message: 'x' })).toEqual({ kind: 'use_phone' })
    expect(classifySessionError({ status: 503, code: 'not_configured', message: null }).kind).toBe('unavailable')
    expect(classifySessionError({ status: 401, code: 'unauthorized', message: null }).kind).toBe('signed_out')
    expect(classifySessionError({ status: 429, code: 'rate_limited', message: null }).kind).toBe('rate_limited')
    expect(classifySessionError({ status: 403, code: 'trial_expired', message: 'Your trial has ended.' })).toEqual({
      kind: 'unavailable',
      message: 'Your trial has ended.',
    })
  })
})

describe('phoneTestErrorMessage', () => {
  it('prefers the server message and has a plain fallback for each case', () => {
    expect(phoneTestErrorMessage({ status: 400, code: 'no_phone_number', message: 'Buy a number first.' })).toBe('Buy a number first.')
    expect(phoneTestErrorMessage({ status: 401, code: 'unauthorized', message: 'x' })).toMatch(/sign in again/)
    expect(phoneTestErrorMessage({ status: 429, code: 'rate_limited', message: null })).toMatch(/today's test calls/)
    expect(phoneTestErrorMessage({ status: 503, code: 'not_configured', message: null })).toMatch(/isn't available/)
    expect(phoneTestErrorMessage({ status: 422, code: 'http_422', message: null })).toMatch(/Check the number/)
  })
})

describe('describeMicError', () => {
  it('maps DOMException names to actionable messages', () => {
    expect(describeMicError({ name: 'NotAllowedError' }).kind).toBe('denied')
    expect(describeMicError({ name: 'NotFoundError' }).kind).toBe('not_found')
    expect(describeMicError({ name: 'NotReadableError' }).kind).toBe('busy')
    expect(describeMicError({ name: 'UnsupportedError' }).kind).toBe('unsupported')
    expect(describeMicError(new Error('x')).kind).toBe('unknown')
    expect(describeMicError(null).kind).toBe('unknown')
  })
})

describe('copy helpers', () => {
  it('labels the three modes', () => {
    expect(MODE_LABELS).toEqual({ cartesia_self: 'Cartesia', cartesia_managed: 'Cartesia Agents', elevenlabs: 'Fallback voice' })
  })

  it('explains end reasons with the agent name', () => {
    expect(endReasonText('agent_hangup', 'Ana')).toBe('Ana ended the call.')
    expect(endReasonText('agent_hangup', ' ')).toBe('Your agent ended the call.')
    expect(endReasonText('max_duration', 'Ana')).toMatch(/3 minutes/)
  })

  it('formats the timer', () => {
    expect(formatCallTime(0)).toBe('0:00')
    expect(formatCallTime(65.9)).toBe('1:05')
    expect(formatCallTime(180)).toBe('3:00')
    expect(formatCallTime(-4)).toBe('0:00')
  })
})

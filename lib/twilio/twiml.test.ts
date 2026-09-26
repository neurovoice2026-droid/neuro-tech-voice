import { describe, expect, it } from 'vitest'
import {
  EMPTY_TWIML,
  MAX_SAY_CHARACTERS,
  connectStream,
  dial,
  escapeXml,
  hangup,
  pause,
  reject,
  say,
  sayAndHangup,
  twimlDocument,
} from './twiml'

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`<Say a="b">Tom & 'Jerry'</Say>`)).toBe(
      '&lt;Say a=&quot;b&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/Say&gt;'
    )
  })

  it('drops characters XML 1.0 cannot encode but keeps emoji and non-Latin text', () => {
    expect(escapeXml('a\u0000b\u0008c\u001Fd\uFFFEe\uFFFF')).toBe('abcde')
    expect(escapeXml('lone \uD800 surrogate')).toBe('lone  surrogate')
    expect(escapeXml('Bună ziua 👋 مرحبا')).toBe('Bună ziua 👋 مرحبا')
    expect(escapeXml('tab\tnew\nline\r')).toBe('tab\tnew\nline\r')
  })
})

describe('twimlDocument', () => {
  it('wraps verbs in a Response with the XML declaration', () => {
    expect(twimlDocument(hangup())).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>')
    expect(EMPTY_TWIML).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  })
})

describe('say', () => {
  it('always sets the language and a matching voice', () => {
    expect(say('Bună ziua', 'ro')).toBe('<Say language="ro-RO" voice="Google.ro-RO-Standard-B">Bună ziua</Say>')
    expect(say('Hello', 'pt-BR')).toContain('language="pt-PT" voice="Google.pt-PT-Standard-E"')
    expect(say('Hi', 'xx')).toContain('language="en-US" voice="Google.en-US-Standard-C"')
  })

  it('cannot be used to inject verbs', () => {
    const xml = say('</Say><Dial>+15550000000</Dial><Say>', 'en')
    expect(xml).not.toContain('<Dial>')
    expect(xml).toContain('&lt;/Say&gt;&lt;Dial&gt;')
  })

  it('collapses whitespace, skips empty text and trims to the Twilio limit', () => {
    expect(say('  hello \n\n there  ', 'en')).toContain('>hello there<')
    expect(say('   ', 'en')).toBe('')
    const long = say('word '.repeat(2000), 'en')
    const text = long.replace(/^<Say[^>]*>/, '').replace(/<\/Say>$/, '')
    expect(text.length).toBeLessThanOrEqual(MAX_SAY_CHARACTERS)
    expect(text.endsWith('word')).toBe(true)
  })
})

describe('reject, pause, hangup', () => {
  it('renders the simple verbs', () => {
    expect(reject()).toBe('<Reject reason="rejected"/>')
    expect(reject('busy')).toBe('<Reject reason="busy"/>')
    expect(pause(2.4)).toBe('<Pause length="2"/>')
    expect(pause(500)).toBe('<Pause length="60"/>')
  })
})

describe('connectStream', () => {
  it('builds Connect/Stream with an escaped Parameter', () => {
    const xml = connectStream({
      action: 'https://app.example.com/api/telephony/stream-ended?call_id=1&x=2',
      streamUrl: 'wss://gw.example.com/twilio',
      statusCallback: 'https://app.example.com/api/telephony/stream-status?call_id=1',
      parameters: { session: 'abc.def"<>' },
    })
    expect(xml).toBe(
      '<Connect action="https://app.example.com/api/telephony/stream-ended?call_id=1&amp;x=2" method="POST">' +
        '<Stream url="wss://gw.example.com/twilio" statusCallback="https://app.example.com/api/telephony/stream-status?call_id=1" statusCallbackMethod="POST">' +
        '<Parameter name="session" value="abc.def&quot;&lt;&gt;"/>' +
        '</Stream></Connect>'
    )
  })

  it('omits the status callback when none is given', () => {
    const xml = connectStream({ action: 'https://a/x', streamUrl: 'wss://g/twilio' })
    expect(xml).not.toContain('statusCallback')
  })

  it('refuses non-WebSocket URLs and parameters over the Twilio limit', () => {
    expect(() => connectStream({ action: 'https://a/x', streamUrl: 'https://g/twilio' })).toThrow()
    expect(() =>
      connectStream({ action: 'https://a/x', streamUrl: 'wss://g/twilio', parameters: { session: 'x'.repeat(495) } })
    ).toThrow(/longer than Twilio allows/)
    // "Under 500": exactly 500 is already too long (docs F5).
    expect(() => connectStream({ action: 'https://a/x', streamUrl: 'wss://g/twilio', parameters: { session: 'x'.repeat(493) } })).toThrow(/longer than Twilio allows/)
    expect(connectStream({ action: 'https://a/x', streamUrl: 'wss://g/twilio', parameters: { session: 'x'.repeat(492) } })).toContain('<Parameter name="session"')
  })
})

describe('dial', () => {
  it('dials one number with caller id, clamped timeout and action', () => {
    expect(
      dial({ number: '+40712345678', callerId: '+40312345678', timeoutSeconds: 25, action: 'https://a/transfer-status?call_id=1&contact_id=2' })
    ).toBe(
      '<Dial callerId="+40312345678" timeout="25" action="https://a/transfer-status?call_id=1&amp;contact_id=2" method="POST"><Number>+40712345678</Number></Dial>'
    )
    expect(dial({ number: '+1', callerId: '+2', timeoutSeconds: 1 })).toContain('timeout="5"')
    expect(dial({ number: '+1', callerId: '+2' })).not.toContain('action=')
  })
})

describe('sayAndHangup', () => {
  it('says each line then hangs up', () => {
    const xml = sayAndHangup(['One.', 'Two & three.'], 'en')
    expect(xml).toMatch(/^<\?xml[^>]*><Response><Say [^>]*>One\.<\/Say><Say [^>]*>Two &amp; three\.<\/Say><Hangup\/><\/Response>$/)
  })
})

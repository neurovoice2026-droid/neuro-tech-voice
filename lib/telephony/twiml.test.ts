import { describe, expect, it } from 'vitest'
import { appendRedirect, dialCartesiaSip, forwardCall, hangup, reject, sayAndHangup, twimlResponse } from './twiml'
import { findAll, findOne, parseXml } from '@/tests/helpers/xml'

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>'
const URL_WITH_QUERY = 'https://app.example/api/telephony/twilio/dial?call=abc&token=x.y&leg=cartesia'

describe('parseXml (test helper sanity)', () => {
  it('rejects malformed documents so the TwiML checks below are meaningful', () => {
    expect(() => parseXml('<Response><Say>a & b</Say></Response>')).toThrow(/Unescaped &/)
    expect(() => parseXml('<Response><Dial action="a?x=1&y=2"/></Response>')).toThrow(/Unescaped &/)
    expect(() => parseXml('<Response><Say>x</Response>')).toThrow()
    expect(() => parseXml('<Response><Say>1 < 2</Say></Response>')).toThrow()
    expect(() => parseXml('<Response></Response><Response></Response>')).toThrow()
    expect(() => parseXml('<Response a=unquoted></Response>')).toThrow()
    expect(parseXml('<Response><Say a="1 &amp; 2">x &lt; y</Say></Response>')).toMatchObject({
      name: 'Response',
      children: [{ name: 'Say', attrs: { a: '1 & 2' }, text: 'x < y' }],
    })
  })
})

describe('sayAndHangup', () => {
  it('speaks the text then hangs up, as a well-formed TwiML document', () => {
    const xml = sayAndHangup('We are closed right now.', 'en')
    expect(xml.startsWith(XML_DECL)).toBe(true)
    const doc = parseXml(xml)
    expect(doc.name).toBe('Response')
    expect(doc.children.map((c) => c.name)).toEqual(['Say', 'Hangup'])
    expect(doc.children[0].text).toBe('We are closed right now.')
  })

  it('escapes XML in the spoken text (never interpolates raw caller/customer text)', () => {
    const text = 'Tom & Jerry <Hangup/> "quoted" </Say><Dial>+40700000000</Dial>'
    const xml = sayAndHangup(text, 'en')
    expect(xml).toContain('Tom &amp; Jerry &lt;Hangup/&gt;')
    expect(xml).not.toContain('<Dial>')
    const doc = parseXml(xml)
    expect(findAll(doc, 'Dial')).toHaveLength(0)
    expect(findAll(doc, 'Hangup')).toHaveLength(1)
    expect(findOne(doc, 'Say').text).toBe(text)
  })

  it('sets the Twilio language and a matching voice', () => {
    const ro = findOne(parseXml(sayAndHangup('Îmi pare rău, suntem închiși.', 'ro')), 'Say')
    expect(ro.attrs).toEqual({ voice: 'Google.ro-RO-Standard-B', language: 'ro-RO' })
    expect(ro.text).toBe('Îmi pare rău, suntem închiși.')
    expect(findOne(parseXml(sayAndHangup('Hi', 'en')), 'Say').attrs).toEqual({ voice: 'Google.en-US-Standard-C', language: 'en-US' })
    expect(findOne(parseXml(sayAndHangup('Ni hao', 'zh')), 'Say').attrs.language).toBe('cmn-CN')
  })

  it('falls back to English for unknown languages', () => {
    expect(findOne(parseXml(sayAndHangup('Hello', 'xx')), 'Say').attrs).toEqual({ voice: 'Google.en-US-Standard-C', language: 'en-US' })
  })
})

describe('hangup / reject', () => {
  it('hangup() is a bare <Hangup/>', () => {
    expect(hangup()).toBe(`${XML_DECL}<Response><Hangup/></Response>`)
  })

  it('reject() rejects the call without answering', () => {
    const xml = reject()
    expect(xml).toBe(`${XML_DECL}<Response><Reject reason="rejected"/></Response>`)
    expect(findOne(parseXml(xml), 'Reject').attrs).toEqual({ reason: 'rejected' })
  })
})

describe('forwardCall', () => {
  it('dials the number with action, POST, default timeout and answerOnBridge', () => {
    const xml = forwardCall({ language: 'en', to: '+40712345678', actionUrl: URL_WITH_QUERY })
    const doc = parseXml(xml)
    expect(doc.children.map((c) => c.name)).toEqual(['Dial'])
    const dial = findOne(doc, 'Dial')
    expect(dial.attrs).toEqual({ action: URL_WITH_QUERY, method: 'POST', timeout: '25', answerOnBridge: 'true' })
    expect(findOne(dial, 'Number').text).toBe('+40712345678')
  })

  it('escapes & in the action URL', () => {
    const xml = forwardCall({ language: 'en', to: '+40712345678', actionUrl: URL_WITH_QUERY })
    expect(xml).toContain('action="https://app.example/api/telephony/twilio/dial?call=abc&amp;token=x.y&amp;leg=cartesia"')
    expect(xml).not.toContain('call=abc&token')
  })

  it('says the optional text first, then dials, with callerId and a custom timeout', () => {
    const doc = parseXml(
      forwardCall({ sayText: 'Connecting you & a colleague.', language: 'ro', to: '+40712345678', callerId: '+40311234567', actionUrl: 'https://a.example/x', timeoutSeconds: 40 }),
    )
    expect(doc.children.map((c) => c.name)).toEqual(['Say', 'Dial'])
    expect(doc.children[0]).toMatchObject({ text: 'Connecting you & a colleague.', attrs: { language: 'ro-RO' } })
    expect(findOne(doc, 'Dial').attrs).toMatchObject({ callerId: '+40311234567', timeout: '40', answerOnBridge: 'true' })
  })

  it('omits callerId and Say when not given', () => {
    const xml = forwardCall({ sayText: null, callerId: null, language: 'en', to: '+40712345678', actionUrl: 'https://a.example/x' })
    expect(xml).not.toContain('callerId')
    expect(findAll(parseXml(xml), 'Say')).toHaveLength(0)
  })
})

describe('dialCartesiaSip', () => {
  const opts = {
    sipUri: 'sip:+40712345678@sip.cartesia.ai;transport=tls',
    username: 'trunk&user',
    password: 'p"a<s>s&w',
    actionUrl: URL_WITH_QUERY,
    referUrl: 'https://app.example/api/telephony/twilio/refer?call=abc&token=r.s',
    timeLimitSeconds: 900,
  }

  it('produces well-formed TwiML with escaped attributes', () => {
    const xml = dialCartesiaSip(opts)
    expect(xml.startsWith(XML_DECL)).toBe(true)
    expect(xml).toContain('action="https://app.example/api/telephony/twilio/dial?call=abc&amp;token=x.y&amp;leg=cartesia"')
    expect(xml).toContain('referUrl="https://app.example/api/telephony/twilio/refer?call=abc&amp;token=r.s"')
    expect(xml).toContain('username="trunk&amp;user"')
    expect(xml).not.toContain('p"a<s>')
    // Decoded values round-trip exactly.
    const sip = findOne(parseXml(xml), 'Sip')
    expect(sip.attrs).toEqual({ username: 'trunk&user', password: 'p"a<s>s&w' })
    expect(sip.text).toBe('sip:+40712345678@sip.cartesia.ai;transport=tls')
  })

  it('bridges on answer, bounds the call, and handles REFER and the leg outcome by POST', () => {
    const dial = findOne(parseXml(dialCartesiaSip(opts)), 'Dial')
    expect(dial.attrs).toEqual({
      action: URL_WITH_QUERY,
      method: 'POST',
      answerOnBridge: 'true',
      timeLimit: '900',
      referUrl: 'https://app.example/api/telephony/twilio/refer?call=abc&token=r.s',
      referMethod: 'POST',
    })
    expect(dial.children.map((c) => c.name)).toEqual(['Sip'])
  })

  it('presents the callerId only when given', () => {
    expect(findOne(parseXml(dialCartesiaSip({ ...opts, callerId: '+40311234567' })), 'Dial').attrs.callerId).toBe('+40311234567')
    expect(findOne(parseXml(dialCartesiaSip({ ...opts, callerId: null })), 'Dial').attrs).not.toHaveProperty('callerId')
  })
})

describe('appendRedirect', () => {
  const REGISTER_CALL_TWIML = `${XML_DECL}<Response><Connect><Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=a&amp;x=1"><Parameter name="k" value="v"/></Stream></Connect></Response>`

  it('inserts <Redirect> right before </Response>', () => {
    const out = appendRedirect(REGISTER_CALL_TWIML, 'https://app.example/api/telephony/twilio/stream-ended?token=t')
    expect(out).toBe(
      `${XML_DECL}<Response><Connect><Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=a&amp;x=1"><Parameter name="k" value="v"/></Stream></Connect><Redirect method="POST">https://app.example/api/telephony/twilio/stream-ended?token=t</Redirect></Response>`,
    )
    const doc = parseXml(out)
    expect(doc.children.map((c) => c.name)).toEqual(['Connect', 'Redirect'])
  })

  it('escapes the redirect URL', () => {
    const out = appendRedirect(REGISTER_CALL_TWIML, URL_WITH_QUERY)
    expect(out).toContain('<Redirect method="POST">https://app.example/api/telephony/twilio/dial?call=abc&amp;token=x.y&amp;leg=cartesia</Redirect>')
    expect(findOne(parseXml(out), 'Redirect')).toMatchObject({ text: URL_WITH_QUERY, attrs: { method: 'POST' } })
    const hostile = appendRedirect(REGISTER_CALL_TWIML, 'https://a.example/x</Redirect><Dial>+1</Dial><Redirect>')
    expect(findAll(parseXml(hostile), 'Dial')).toHaveLength(0)
  })

  it('tolerates surrounding whitespace and a <Response> with attributes', () => {
    const out = appendRedirect(`\n  <Response xmlns:x="y">\n<Connect><Stream url="wss://x"/></Connect>\n</Response>\n\n`, 'https://a.example/r')
    expect(out.endsWith('<Redirect method="POST">https://a.example/r</Redirect></Response>')).toBe(true)
    expect(() => parseXml(out)).not.toThrow()
  })

  it('rejects documents that are not register-call TwiML', () => {
    const bad = [
      '',
      '{"error":"agent not found"}',
      '<html><body>Bad gateway</body></html>',
      `${XML_DECL}<Response><Say>no connect</Say></Response>`, // no <Connect>
      `${XML_DECL}<Response><Connect><Stream url="wss://x"/></Connect>`, // not closed
      '<Connect><Stream url="wss://x"/></Connect>', // no <Response>
    ]
    for (const doc of bad) {
      expect(() => appendRedirect(doc, 'https://a.example/r'), doc).toThrow(/TwiML/)
    }
  })
})

describe('twimlResponse', () => {
  it('returns XML with no-store caching', async () => {
    const res = twimlResponse(hangup())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/xml; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toBe(hangup())
  })

  it('accepts a custom status', () => {
    expect(twimlResponse(reject(), 403).status).toBe(403)
  })
})

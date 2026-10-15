import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderError } from '@/lib/voice-providers/errors'
import { ERROR_TEXT_MAX, FIELD_TEXT_MAX, clipLogText, createLogger, describeError } from './logger'

// A Cloudflare 502 page as supabase-js puts it into error.message (~5 KB, with an egress IP).
const CLOUDFLARE_502 = `<!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<html class="no-js" lang="en-US">
<head>
<title>example.supabase.co | 502: Bad gateway</title>
<meta charset="UTF-8" />
</head>
<body>
<div id="cf-error-details">${'<p>Bad gateway. The web server reported a bad gateway error.</p>\n'.repeat(70)}
<span class="cf-footer-item">Your IP: <span>203.0.113.7</span></span>
</div>
</body>
</html>`

describe('clipLogText', () => {
  it('keeps short text as it is', () => {
    expect(clipLogText('agents read failed: timeout')).toBe('agents read failed: timeout')
  })

  it('reduces an HTML page to its size and title, keeping our own context around it', () => {
    expect(CLOUDFLARE_502.length).toBeGreaterThan(4000)
    const out = clipLogText(`commerce_connections read failed: ${CLOUDFLARE_502} (retrying)`)
    expect(out).toBe(`commerce_connections read failed: <html: ${new TextEncoder().encode(CLOUDFLARE_502).length} bytes, title=example.supabase.co | 502: Bad gateway> (retrying)`)
    expect(out).not.toContain('203.0.113.7')
  })

  it('handles a page without a title or a closing tag', () => {
    expect(clipLogText('failed: <html><body>oops')).toBe('failed: <html: 16 bytes>')
  })

  it('caps long text and says how much was dropped', () => {
    const out = clipLogText('x'.repeat(ERROR_TEXT_MAX + 250))
    expect(out).toBe(`${'x'.repeat(ERROR_TEXT_MAX)}… [+250 chars]`)
    expect(clipLogText('y'.repeat(50), 10)).toBe(`${'y'.repeat(10)}… [+40 chars]`)
  })
})

describe('describeError', () => {
  it('caps the message of an Error, a provider detail and a PostgREST error object', () => {
    const e = describeError(new Error(`commerce_connections read failed: ${CLOUDFLARE_502}`))
    expect(String(e.message)).toMatch(/^commerce_connections read failed: <html: \d+ bytes, title=example\.supabase\.co \| 502: Bad gateway>$/)

    const p = describeError(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'agents.update', status: 502, detail: 'z'.repeat(5000) }))
    expect(String(p.detail).length).toBeLessThan(ERROR_TEXT_MAX + 30)
    expect(describeError(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'agents.update' })).detail).toBeNull()

    const o = describeError({ message: CLOUDFLARE_502, code: '502' })
    expect(o).toEqual({ kind: 'object', message: expect.stringMatching(/^<html: \d+ bytes, title=/), code: '502' })
    expect(String(describeError('w'.repeat(3000)).value).length).toBeLessThan(ERROR_TEXT_MAX + 30)
  })

  it('redacts before it cuts, so a secret on the boundary never survives in part', () => {
    const token = `eyJ${'a'.repeat(20)}.${'b'.repeat(20)}.${'c'.repeat(20)}`
    const msg = `${'m'.repeat(ERROR_TEXT_MAX - 30)} Bearer ${token}`
    const out = String(describeError(new Error(msg)).message)
    expect(out).not.toContain('eyJ')
    expect(out).not.toContain('aaaa')
  })
})

describe('createLogger', () => {
  let lines: string[]
  beforeEach(() => {
    lines = []
    vi.stubEnv('LOG_LEVEL', 'debug')
    const capture = (...args: unknown[]) => void lines.push(String(args[0]))
    vi.spyOn(console, 'log').mockImplementation(capture)
    vi.spyOn(console, 'warn').mockImplementation(capture)
    vi.spyOn(console, 'error').mockImplementation(capture)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('logs an upstream HTML page in an error as its size and title, for every caller', () => {
    const log = createLogger({ component: 'commerce_worker' })
    log.error('commerce.worker.housekeeping_failed', new Error(`commerce_connections read failed: ${CLOUDFLARE_502}`))
    // Passed as a plain field (an Error object or a raw body) instead of the error argument.
    log.warn('commerce.sync_failed', { error: new Error(CLOUDFLARE_502), body: CLOUDFLARE_502, note: 'n'.repeat(FIELD_TEXT_MAX + 100) })
    expect(lines).toHaveLength(2)
    for (const text of lines) {
      expect(text.length).toBeLessThan(FIELD_TEXT_MAX + 600)
      expect(text).not.toContain('203.0.113.7')
      expect(text).not.toContain('cf-error-details')
    }
    const error = JSON.parse(lines[0])
    expect(error).toMatchObject({ level: 'error', event: 'commerce.worker.housekeeping_failed', component: 'commerce_worker' })
    expect(error.error.message).toMatch(/^commerce_connections read failed: <html: \d+ bytes, title=example\.supabase\.co \| 502: Bad gateway>$/)
    const warn = JSON.parse(lines[1])
    expect(warn.error.message).toMatch(/^<html: \d+ bytes/)
    expect(warn.body).toMatch(/^<html: \d+ bytes/)
    expect(warn.note).toMatch(new RegExp(`… \\[\\+100 chars\\]$`))
  })

  it('leaves ordinary fields untouched and still redacts secrets and phone numbers', () => {
    createLogger().info('agent_sync.ok', { externalId: 'agent_123', count: 3, caller: '+40712345678', ok: true, nested: { list: ['a', 'b'] } })
    const line = JSON.parse(lines[0])
    expect(line).toMatchObject({ externalId: 'agent_123', count: 3, ok: true, nested: { list: ['a', 'b'] } })
    expect(line.caller).not.toBe('+40712345678')
  })
})

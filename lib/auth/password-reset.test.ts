// App-sent password-reset emails: a token-hash link to /reset-password/confirm,
// the same answer for unknown addresses, limits before the account lookup,
// and nothing identifying in the logs.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  generateLink: vi.fn(),
  sendEmail: vi.fn(),
  rpc: vi.fn(),
  emailConfigured: true,
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: state.rpc, auth: { admin: { generateLink: state.generateLink } } }) }))
vi.mock('@/lib/email/client', () => ({ isConfigured: () => state.emailConfigured, sendEmail: state.sendEmail }))

import { afterEach } from 'vitest'
import { requestPasswordResetEmail, resetConfirmUrl } from './password-reset'

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcd'
const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
let n = 0
/** A fresh address per test: the limiter's memory window is shared across tests. */
const address = () => `owner${++n}@example.com`

let testIndex = 0
beforeEach(() => {
  // Each test in its own day: the limiter's memory windows (hourly, daily) never carry over.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.UTC(2030, 0, 1, 6) + testIndex++ * 26 * 3_600_000)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com/')
  state.rpc.mockReset().mockResolvedValue({ data: true, error: null })
  state.emailConfigured = true
  state.generateLink.mockReset().mockResolvedValue({ data: { properties: { hashed_token: TOKEN } }, error: null })
  state.sendEmail.mockReset().mockResolvedValue(true)
  for (const fn of [log.debug, log.info, log.warn, log.error]) fn.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

function loggedText() {
  return JSON.stringify([log.debug.mock.calls, log.info.mock.calls, log.warn.mock.calls, log.error.mock.calls])
}

describe('requestPasswordResetEmail', () => {
  it('emails a link to the confirm page carrying the token hash', async () => {
    const email = address()
    await expect(requestPasswordResetEmail(`  ${email} `, { ipKey: 'ip-1', log })).resolves.toEqual({ status: 'sent' })
    expect(state.generateLink).toHaveBeenCalledWith({ type: 'recovery', email })
    const [{ to, subject, html }] = state.sendEmail.mock.calls[0]
    expect(to).toBe(email)
    expect(subject).toMatch(/reset your .* password/i)
    expect(html).toContain(`https://app.example.com/reset-password/confirm?token_hash=${TOKEN}&amp;type=recovery`)
    expect(loggedText()).not.toContain(email)
    expect(loggedText()).not.toContain(TOKEN)
  })

  it('answers the same for an address without an account, and sends nothing', async () => {
    state.rpc.mockResolvedValue({ data: false, error: null })
    const email = address()
    await expect(requestPasswordResetEmail(email, { ipKey: 'ip-2', log })).resolves.toEqual({ status: 'sent' })
    expect(state.rpc).toHaveBeenCalledWith('auth_account_can_reset', { p_email: email })
    expect(state.generateLink).not.toHaveBeenCalled()
    expect(state.sendEmail).not.toHaveBeenCalled()
    expect(loggedText()).not.toContain(email)
  })

  it('never counts unknown addresses against the overall caps', async () => {
    state.rpc.mockResolvedValue({ data: false, error: null })
    for (let i = 0; i < 40; i++) await expect(requestPasswordResetEmail(address(), { ipKey: `ip-u${i}`, log })).resolves.toEqual({ status: 'sent' })
    state.rpc.mockResolvedValue({ data: true, error: null })
    await expect(requestPasswordResetEmail(address(), { ipKey: 'ip-real', log })).resolves.toEqual({ status: 'sent' })
    expect(state.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('lets generateLink decide when the account lookup fails', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'function does not exist' } })
    state.generateLink.mockResolvedValueOnce({ data: { properties: null, user: null }, error: { status: 404, code: 'user_not_found', message: 'User with this email not found' } })
    await expect(requestPasswordResetEmail(address(), { ipKey: 'ip-lf', log })).resolves.toEqual({ status: 'sent' })
    expect(log.warn).toHaveBeenCalledWith('auth.password_reset.lookup_failed', { code: '42883' })
    expect(state.sendEmail).not.toHaveBeenCalled()
  })

  it('allows one email a minute per address, however it is spelled, before looking it up', async () => {
    const email = address()
    await expect(requestPasswordResetEmail(email, { ipKey: 'ip-3', log })).resolves.toEqual({ status: 'sent' })
    await expect(requestPasswordResetEmail(` ${email.toUpperCase()}`, { ipKey: 'ip-3b', log })).resolves.toEqual({ status: 'rate_limited', wait: 'minute' })
    expect(state.generateLink).toHaveBeenCalledTimes(1)
    expect(state.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('limits requests per client IP first, so a blocked client cannot use up anyone\'s address quota', async () => {
    state.rpc.mockResolvedValue({ data: false, error: null })
    for (let i = 0; i < 20; i++) await expect(requestPasswordResetEmail(address(), { ipKey: 'ip-flood', log })).resolves.toEqual({ status: 'sent' })
    const victim = address()
    await expect(requestPasswordResetEmail(victim, { ipKey: 'ip-flood', log })).resolves.toEqual({ status: 'rate_limited', wait: 'later' })
    expect(state.rpc).toHaveBeenCalledTimes(20)
    // The denied request did not count against the victim's address.
    state.rpc.mockResolvedValue({ data: true, error: null })
    await expect(requestPasswordResetEmail(victim, { ipKey: 'ip-victim', log })).resolves.toEqual({ status: 'sent' })
    expect(state.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('stops after five emails an hour for one address', async () => {
    const email = address()
    const hour = Math.floor(Date.now() / 3_600_000) * 3_600_000
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(hour + i * 61_000)
      await expect(requestPasswordResetEmail(email, { ipKey: `ip-h${i}`, log })).resolves.toEqual({ status: 'sent' })
    }
    vi.setSystemTime(hour + 5 * 61_000)
    await expect(requestPasswordResetEmail(email, { ipKey: 'ip-h5', log })).resolves.toEqual({ status: 'rate_limited', wait: 'later' })
  })

  it('caps sends overall and then lets the caller fall back', async () => {
    for (let i = 0; i < 30; i++) await expect(requestPasswordResetEmail(address(), { ipKey: `ip-g${i}`, log })).resolves.toEqual({ status: 'sent' })
    await expect(requestPasswordResetEmail(address(), { ipKey: 'ip-g30', log })).resolves.toEqual({ status: 'unavailable' })
    expect(log.warn).toHaveBeenCalledWith('auth.password_reset.global_cap', { rule: 'password_reset_all_hour' })
    expect(state.generateLink).toHaveBeenCalledTimes(30)
  })

  it('is unavailable (the caller falls back) when email is not configured', async () => {
    state.emailConfigured = false
    await expect(requestPasswordResetEmail(address(), { ipKey: null, log })).resolves.toEqual({ status: 'unavailable' })
    expect(state.generateLink).not.toHaveBeenCalled()
  })

  it('is unavailable without an app URL to link to', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    await expect(requestPasswordResetEmail(address(), { ipKey: null, log })).resolves.toEqual({ status: 'unavailable' })
    expect(state.generateLink).not.toHaveBeenCalled()
  })

  it('is unavailable when the link cannot be generated, send_failed when the email cannot be sent', async () => {
    state.generateLink.mockResolvedValueOnce({ data: null, error: { status: 500, code: 'unexpected_failure', message: 'boom' } })
    await expect(requestPasswordResetEmail(address(), { ipKey: null, log })).resolves.toEqual({ status: 'unavailable' })
    expect(log.error).toHaveBeenCalledWith('auth.password_reset.link_failed', expect.anything(), expect.objectContaining({ status: 500 }))

    // Once a token exists, Supabase's own email would be refused for a minute: no fallback.
    state.sendEmail.mockResolvedValueOnce(false)
    await expect(requestPasswordResetEmail(address(), { ipKey: null, log })).resolves.toEqual({ status: 'send_failed' })
    expect(log.warn).toHaveBeenCalledWith('auth.password_reset.send_failed')
  })
})

describe('resetConfirmUrl', () => {
  it('builds the confirm URL on the app origin with an encoded token', () => {
    expect(resetConfirmUrl('https://app.example.com', 'pkce_abc-123')).toBe('https://app.example.com/reset-password/confirm?token_hash=pkce_abc-123&type=recovery')
  })
})

// App-sent password-reset emails: a token-hash link to /reset-password/confirm,
// the same answer for unknown addresses, limits before the account lookup,
// and nothing identifying in the logs.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  generateLink: vi.fn(),
  sendEmail: vi.fn(),
  emailConfigured: true,
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { generateLink: state.generateLink } } }) }))
vi.mock('@/lib/email/client', () => ({ isConfigured: () => state.emailConfigured, sendEmail: state.sendEmail }))

import { requestPasswordResetEmail, resetConfirmUrl } from './password-reset'

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcd'
const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
let n = 0
/** A fresh address per test: the limiter's memory window is shared across tests. */
const address = () => `owner${++n}@example.com`

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com/')
  state.emailConfigured = true
  state.generateLink.mockReset().mockResolvedValue({ data: { properties: { hashed_token: TOKEN } }, error: null })
  state.sendEmail.mockReset().mockResolvedValue(true)
  for (const fn of [log.debug, log.info, log.warn, log.error]) fn.mockReset()
})

function loggedText() {
  return JSON.stringify([log.debug.mock.calls, log.info.mock.calls, log.warn.mock.calls, log.error.mock.calls])
}

describe('requestPasswordResetEmail', () => {
  it('emails a link to the confirm page carrying the token hash', async () => {
    const email = address()
    await expect(requestPasswordResetEmail(`  ${email} `, { ipKey: 'ip-1', log })).resolves.toBe('sent')
    expect(state.generateLink).toHaveBeenCalledWith({ type: 'recovery', email })
    const [{ to, subject, html }] = state.sendEmail.mock.calls[0]
    expect(to).toBe(email)
    expect(subject).toMatch(/reset your .* password/i)
    expect(html).toContain(`https://app.example.com/reset-password/confirm?token_hash=${TOKEN}&amp;type=recovery`)
    expect(loggedText()).not.toContain(email)
    expect(loggedText()).not.toContain(TOKEN)
  })

  it('answers the same for an address without an account, and sends nothing', async () => {
    state.generateLink.mockResolvedValue({ data: { properties: null, user: null }, error: { status: 404, code: 'user_not_found', message: 'User with this email not found' } })
    const email = address()
    await expect(requestPasswordResetEmail(email, { ipKey: 'ip-2', log })).resolves.toBe('sent')
    expect(state.sendEmail).not.toHaveBeenCalled()
    expect(loggedText()).not.toContain(email)
  })

  it('allows one email a minute per address, however it is spelled, before looking it up', async () => {
    const email = address()
    await expect(requestPasswordResetEmail(email, { ipKey: 'ip-3', log })).resolves.toBe('sent')
    await expect(requestPasswordResetEmail(` ${email.toUpperCase()}`, { ipKey: 'ip-3b', log })).resolves.toBe('rate_limited')
    expect(state.generateLink).toHaveBeenCalledTimes(1)
    expect(state.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('limits requests per client IP across addresses', async () => {
    for (let i = 0; i < 20; i++) await expect(requestPasswordResetEmail(address(), { ipKey: 'ip-flood', log })).resolves.toBe('sent')
    await expect(requestPasswordResetEmail(address(), { ipKey: 'ip-flood', log })).resolves.toBe('rate_limited')
    expect(state.generateLink).toHaveBeenCalledTimes(20)
  })

  it('is unavailable (the caller falls back) when email is not configured', async () => {
    state.emailConfigured = false
    await expect(requestPasswordResetEmail(address(), { ipKey: null, log })).resolves.toBe('unavailable')
    expect(state.generateLink).not.toHaveBeenCalled()
  })

  it('is unavailable without an app URL to link to', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    await expect(requestPasswordResetEmail(address(), { ipKey: null, log })).resolves.toBe('unavailable')
    expect(state.generateLink).not.toHaveBeenCalled()
  })

  it('is unavailable when the link cannot be generated or the email cannot be sent', async () => {
    state.generateLink.mockResolvedValueOnce({ data: null, error: { status: 500, code: 'unexpected_failure', message: 'boom' } })
    await expect(requestPasswordResetEmail(address(), { ipKey: null, log })).resolves.toBe('unavailable')
    expect(log.error).toHaveBeenCalledWith('auth.password_reset.link_failed', expect.anything(), expect.objectContaining({ status: 500 }))

    state.sendEmail.mockResolvedValueOnce(false)
    await expect(requestPasswordResetEmail(address(), { ipKey: null, log })).resolves.toBe('unavailable')
    expect(log.warn).toHaveBeenCalledWith('auth.password_reset.send_failed')
  })
})

describe('resetConfirmUrl', () => {
  it('builds the confirm URL on the app origin with an encoded token', () => {
    expect(resetConfirmUrl('https://app.example.com', 'pkce_abc-123')).toBe('https://app.example.com/reset-password/confirm?token_hash=pkce_abc-123&type=recovery')
  })
})

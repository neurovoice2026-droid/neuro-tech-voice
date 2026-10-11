// Sign-up and set-new-password server actions: the server re-validates the
// password, refuses one found in a data breach, and fails open when the breach
// check cannot run.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/security/pwned-passwords', () => ({ checkPwnedPassword: vi.fn() }))
vi.mock('@/lib/auth/password-reset', () => ({ requestPasswordResetEmail: vi.fn() }))
const requestHeaders = vi.hoisted(() => ({ value: new Headers({ origin: 'https://www.example.com', 'x-forwarded-for': '203.0.113.7' }) }))
vi.mock('next/headers', () => ({ headers: async () => requestHeaders.value }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  }),
}))

import type { User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkPwnedPassword } from '@/lib/security/pwned-passwords'
import { requestPasswordResetEmail } from '@/lib/auth/password-reset'
import { PWNED_PASSWORD_MESSAGE } from './password-policy'
import { confirmPasswordReset, requestPasswordReset, signUpWithEmail, updatePassword } from './actions'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const GOOD = 'Correct-Horse-9'
const USER = { id: '0b5c1d2e-3f40-4a51-8b62-7c83d94e0f1a' } as User

type FakeAuthError = { message: string; code?: string; status?: number; reasons?: string[] }

function fakeClient(opts: { user?: User | null; signUpError?: string | FakeAuthError; updateError?: FakeAuthError; verifyError?: FakeAuthError; resetError?: FakeAuthError } = {}) {
  const signUpError = typeof opts.signUpError === 'string' ? { message: opts.signUpError } : opts.signUpError ?? null
  const signUp = vi.fn(async () => ({ data: {}, error: signUpError }))
  const updateUser = vi.fn(async () => ({ data: {}, error: opts.updateError ?? null }))
  const getUser = vi.fn(async () => ({ data: { user: opts.user === undefined ? USER : opts.user }, error: null }))
  const verifyOtp = vi.fn(async () => ({ data: {}, error: opts.verifyError ?? null }))
  const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: opts.resetError ?? null }))
  vi.mocked(createClient).mockResolvedValue({ auth: { signUp, updateUser, getUser, verifyOtp, resetPasswordForEmail } } as unknown as ServerClient)
  return { signUp, updateUser, getUser, verifyOtp, resetPasswordForEmail }
}

function form(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

async function redirectedTo(p: Promise<unknown>): Promise<string> {
  const err = (await p.then(() => null, (e: unknown) => e)) as { url?: string } | null
  expect(err?.url).toBeTypeOf('string')
  return err!.url!
}

beforeEach(() => {
  vi.mocked(requestPasswordResetEmail).mockReset()
  vi.mocked(checkPwnedPassword).mockReset()
  vi.mocked(createClient).mockReset()
  vi.mocked(redirect).mockClear()
})

describe('signUpWithEmail', () => {
  it('refuses a password found in a data breach without creating the account', async () => {
    const { signUp } = fakeClient()
    vi.mocked(checkPwnedPassword).mockResolvedValue({ status: 'pwned', count: 3 })
    await expect(signUpWithEmail('Ana Pop', 'ana@example.com', GOOD)).resolves.toEqual({ error: PWNED_PASSWORD_MESSAGE, field: 'password', reason: 'pwned' })
    expect(signUp).not.toHaveBeenCalled()
  })

  it('creates the account and goes to onboarding when the password is clean', async () => {
    const { signUp } = fakeClient()
    vi.mocked(checkPwnedPassword).mockResolvedValue({ status: 'clean' })
    expect(await redirectedTo(signUpWithEmail(' Ana Pop ', 'ana@example.com', GOOD))).toBe('/onboarding')
    expect(signUp).toHaveBeenCalledWith({ email: 'ana@example.com', password: GOOD, options: { data: { full_name: 'Ana Pop' } } })
  })

  it('fails open: the account is created when the breach check is unavailable', async () => {
    const { signUp } = fakeClient()
    vi.mocked(checkPwnedPassword).mockResolvedValue({ status: 'unavailable', reason: 'timeout', httpStatus: null })
    expect(await redirectedTo(signUpWithEmail('Ana Pop', 'ana@example.com', GOOD))).toBe('/onboarding')
    expect(signUp).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['too short', 'Ab1'],
    ['no uppercase letter', 'alllowercase1'],
    ['no number', 'NoNumbersHere'],
    ['over 72 bytes', `A1${'x'.repeat(71)}`],
  ])('re-validates the password on the server (%s)', async (_name, password) => {
    const { signUp } = fakeClient()
    const result = await signUpWithEmail('Ana Pop', 'ana@example.com', password)
    expect(result).toMatchObject({ field: 'password' })
    expect(checkPwnedPassword).not.toHaveBeenCalled()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('re-validates the other fields on the server, under their own field', async () => {
    const { signUp } = fakeClient()
    await expect(signUpWithEmail('A ', 'ana@example.com', GOOD)).resolves.toEqual({ error: 'Name must be at least 2 characters', field: 'fullName' })
    await expect(signUpWithEmail('Ana Pop', 'not-an-email', GOOD)).resolves.toEqual({ error: 'Please enter a valid email', field: 'email' })
    expect(signUp).not.toHaveBeenCalled()
  })

  it("puts the auth server's own password refusals under the password field, reworded", async () => {
    vi.mocked(checkPwnedPassword).mockResolvedValue({ status: 'clean' })
    fakeClient({ signUpError: { message: 'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, …', code: 'weak_password', reasons: ['characters'] } })
    await expect(signUpWithEmail('Ana Pop', 'ana@example.com', GOOD)).resolves.toEqual({
      error: "This password doesn't meet the security requirements. Please choose a stronger one.",
      field: 'password',
      reason: 'weak',
    })
    // Supabase Pro's own leaked-password check.
    fakeClient({ signUpError: { message: 'Password is known to be weak and easy to guess', code: 'weak_password', reasons: ['pwned'] } })
    await expect(signUpWithEmail('Ana Pop', 'ana@example.com', GOOD)).resolves.toEqual({ error: PWNED_PASSWORD_MESSAGE, field: 'password', reason: 'pwned' })
  })

  it('returns the auth error when sign-up fails', async () => {
    fakeClient({ signUpError: 'Signups not allowed for this instance' })
    vi.mocked(checkPwnedPassword).mockResolvedValue({ status: 'clean' })
    await expect(signUpWithEmail('Ana Pop', 'ana@example.com', GOOD)).resolves.toEqual({ error: 'Signups not allowed for this instance' })
  })
})

describe('updatePassword', () => {
  it('needs the session the reset link opened', async () => {
    const { updateUser } = fakeClient({ user: null })
    await expect(updatePassword(GOOD)).resolves.toEqual({ error: 'Your reset link has expired. Please request a new one.' })
    expect(checkPwnedPassword).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses a weak password before anything else', async () => {
    const { updateUser, getUser } = fakeClient()
    await expect(updatePassword('short')).resolves.toMatchObject({ field: 'password' })
    expect(getUser).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses a password found in a data breach', async () => {
    const { updateUser } = fakeClient()
    vi.mocked(checkPwnedPassword).mockResolvedValue({ status: 'pwned', count: 1 })
    await expect(updatePassword(GOOD)).resolves.toEqual({ error: PWNED_PASSWORD_MESSAGE, field: 'password', reason: 'pwned' })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('sets the password and goes to the dashboard', async () => {
    const { updateUser } = fakeClient()
    vi.mocked(checkPwnedPassword).mockResolvedValue({ status: 'clean' })
    expect(await redirectedTo(updatePassword(GOOD))).toBe('/dashboard')
    expect(updateUser).toHaveBeenCalledWith({ password: GOOD })
  })

  it('puts password errors from the auth server under the field, others above the form', async () => {
    vi.mocked(checkPwnedPassword).mockResolvedValue({ status: 'clean' })
    fakeClient({ updateError: { message: 'New password should be different from the old password.', code: 'same_password' } })
    await expect(updatePassword(GOOD)).resolves.toEqual({ error: 'New password should be different from the old password.', field: 'password', reason: 'same' })
    fakeClient({ updateError: { message: 'Request rate limit reached', code: 'over_request_rate_limit' } })
    await expect(updatePassword(GOOD)).resolves.toEqual({ error: 'Request rate limit reached' })
  })
})

describe('confirmPasswordReset', () => {
  const TOKEN = 'pkce_0123456789abcdef0123456789abcdef0123456789abcdef01234567'

  it('verifies the recovery token and opens the new-password page', async () => {
    const { verifyOtp } = fakeClient()
    expect(await redirectedTo(confirmPasswordReset(form({ token_hash: TOKEN })))).toBe('/reset-password')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: TOKEN })
  })

  it('offers a new link when the token is expired or used', async () => {
    fakeClient({ verifyError: { message: 'Email link is invalid or has expired', code: 'otp_expired', status: 403 } })
    expect(await redirectedTo(confirmPasswordReset(form({ token_hash: TOKEN })))).toBe('/forgot-password/expired')
  })

  it.each([['missing', {}], ['malformed', { token_hash: '../../etc' }], ['too short', { token_hash: 'abc' }]])(
    'never calls the auth server with a %s token',
    async (_name, entries) => {
      const { verifyOtp } = fakeClient()
      expect(await redirectedTo(confirmPasswordReset(form(entries as Record<string, string>)))).toBe('/forgot-password/expired')
      expect(verifyOtp).not.toHaveBeenCalled()
    },
  )
})

describe('requestPasswordReset', () => {
  it('validates the address before doing anything', async () => {
    await expect(requestPasswordReset('not-an-email')).resolves.toEqual({ error: 'Please enter a valid email' })
    expect(requestPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('sends the app\'s own email, keyed by the hashed client IP, and reports success', async () => {
    const { resetPasswordForEmail } = fakeClient()
    vi.mocked(requestPasswordResetEmail).mockResolvedValue('sent')
    await expect(requestPasswordReset(' ana@example.com ')).resolves.toBeUndefined()
    const [email, opts] = vi.mocked(requestPasswordResetEmail).mock.calls[0]
    expect(email).toBe('ana@example.com')
    expect(opts.ipKey).toMatch(/^[0-9a-f]{32}$/)
    expect(opts.ipKey).not.toContain('203.0.113.7')
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('tells the user to wait when rate limited', async () => {
    vi.mocked(requestPasswordResetEmail).mockResolvedValue('rate_limited')
    await expect(requestPasswordReset('ana@example.com')).resolves.toEqual({
      error: 'You just requested a reset link. Please wait a minute before requesting another one.',
    })
  })

  it("falls back to the auth server's own email, linking back to this host", async () => {
    const { resetPasswordForEmail } = fakeClient()
    vi.mocked(requestPasswordResetEmail).mockResolvedValue('unavailable')
    await expect(requestPasswordReset('ana@example.com')).resolves.toBeUndefined()
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', { redirectTo: 'https://www.example.com/auth/callback?next=/reset-password' })
  })

  it('reports a failed fallback without claiming the email went out', async () => {
    vi.mocked(requestPasswordResetEmail).mockResolvedValue('unavailable')
    fakeClient({ resetError: { message: 'Email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 } })
    await expect(requestPasswordReset('ana@example.com')).resolves.toEqual({
      error: 'You just requested a reset link. Please wait a minute before requesting another one.',
    })
    fakeClient({ resetError: { message: 'boom', status: 500 } })
    await expect(requestPasswordReset('ana@example.com')).resolves.toEqual({ error: "We couldn't send the reset link. Please try again in a moment." })
  })
})

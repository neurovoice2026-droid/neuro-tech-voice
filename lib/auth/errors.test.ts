import { describe, expect, it } from 'vitest'
import {
  AUTH_MESSAGES,
  passwordUpdateErrorMessage,
  resetRequestErrorOutcome,
  signInErrorMessage,
  signUpErrorOutcome,
} from './errors'

describe('signInErrorMessage', () => {
  it('gives one message for a wrong password and an unknown email', () => {
    expect(signInErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe(AUTH_MESSAGES.invalidCredentials)
    expect(signInErrorMessage({ code: 'user_not_found', status: 400 })).toBe(AUTH_MESSAGES.invalidCredentials)
    expect(signInErrorMessage({ status: 400 })).toBe(AUTH_MESSAGES.invalidCredentials)
  })

  it('explains states Supabase only reports after a correct password', () => {
    expect(signInErrorMessage({ code: 'email_not_confirmed', status: 400 })).toBe(AUTH_MESSAGES.emailNotConfirmed)
    expect(signInErrorMessage({ code: 'user_banned', status: 400 })).toBe(AUTH_MESSAGES.banned)
  })

  it('does not blame the password when the service is down or throttling', () => {
    expect(signInErrorMessage({ status: 500 })).toBe(AUTH_MESSAGES.signInUnavailable)
    expect(signInErrorMessage({ status: 0 })).toBe(AUTH_MESSAGES.signInUnavailable)
    expect(signInErrorMessage({})).toBe(AUTH_MESSAGES.signInUnavailable)
    expect(signInErrorMessage({ status: 429 })).toBe(AUTH_MESSAGES.tooManyAttempts)
    expect(signInErrorMessage({ code: 'over_request_rate_limit', status: 429 })).toBe(AUTH_MESSAGES.tooManyAttempts)
  })
})

describe('signUpErrorOutcome', () => {
  it('answers an existing email exactly like a new one', () => {
    expect(signUpErrorOutcome({ code: 'user_already_exists', status: 422 })).toEqual({ checkEmail: true })
    expect(signUpErrorOutcome({ code: 'email_exists', status: 422 })).toEqual({ checkEmail: true })
  })

  it('maps password and email problems to helpful, non-revealing messages', () => {
    expect(signUpErrorOutcome({ code: 'weak_password', status: 422, reasons: ['length'] })).toEqual({ error: AUTH_MESSAGES.weakPassword })
    expect(signUpErrorOutcome({ code: 'weak_password', status: 422, reasons: ['pwned'] })).toEqual({ error: AUTH_MESSAGES.pwnedPassword })
    expect(signUpErrorOutcome({ code: 'email_address_invalid', status: 400 })).toEqual({ error: AUTH_MESSAGES.emailRejected })
    expect(signUpErrorOutcome({ code: 'signup_disabled', status: 422 })).toEqual({ error: AUTH_MESSAGES.signUpDisabled })
    expect(signUpErrorOutcome({ code: 'over_email_send_rate_limit', status: 429 })).toEqual({ error: AUTH_MESSAGES.emailSendLimited })
    expect(signUpErrorOutcome({ status: 429 })).toEqual({ error: AUTH_MESSAGES.tooManyAttempts })
    expect(signUpErrorOutcome({ status: 503 })).toEqual({ error: AUTH_MESSAGES.signUpUnavailable })
  })
})

describe('resetRequestErrorOutcome', () => {
  it('hides whether the account exists', () => {
    // Supabase's 60-second per-user cooldown only triggers for real accounts.
    expect(resetRequestErrorOutcome({ code: 'over_email_send_rate_limit', status: 429 })).toEqual({ sent: true })
    expect(resetRequestErrorOutcome({ code: 'user_not_found', status: 400 })).toEqual({ sent: true })
    expect(resetRequestErrorOutcome({ code: 'validation_failed', status: 400 })).toEqual({ sent: true })
  })

  it('is honest when no email could be sent at all', () => {
    expect(resetRequestErrorOutcome({ status: 500 })).toEqual({ error: AUTH_MESSAGES.resetUnavailable })
    expect(resetRequestErrorOutcome({ status: 0 })).toEqual({ error: AUTH_MESSAGES.resetUnavailable })
  })
})

describe('passwordUpdateErrorMessage', () => {
  it('maps the recoverable cases', () => {
    expect(passwordUpdateErrorMessage({ code: 'same_password', status: 422 })).toBe(AUTH_MESSAGES.samePassword)
    expect(passwordUpdateErrorMessage({ code: 'weak_password', status: 422, reasons: ['characters'] })).toBe(AUTH_MESSAGES.weakPassword)
    expect(passwordUpdateErrorMessage({ code: 'reauthentication_needed', status: 400 })).toBe(AUTH_MESSAGES.reauthenticationNeeded)
  })

  it('treats a missing or dead session as an expired link', () => {
    expect(passwordUpdateErrorMessage({ code: 'session_not_found', status: 403 })).toBe(AUTH_MESSAGES.resetLinkExpired)
    expect(passwordUpdateErrorMessage({ status: 401 })).toBe(AUTH_MESSAGES.resetLinkExpired)
  })

  it('falls back to a generic retry message', () => {
    expect(passwordUpdateErrorMessage({ status: 500 })).toBe(AUTH_MESSAGES.passwordUpdateUnavailable)
  })
})

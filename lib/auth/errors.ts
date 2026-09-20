// Supabase Auth errors → what the person at the form reads.
//
// Rules: never echo upstream messages, never say whether an email has an
// account (except after a correct password, where Supabase itself reveals
// "email not confirmed" or "banned"), and tell the truth when the service is
// down so nobody waits for an email that was never sent.

export interface AuthErrorLike {
  code?: string | null
  status?: number | null
  /** AuthWeakPasswordError: 'length' | 'characters' | 'pwned'. */
  reasons?: readonly string[] | null
}

export const AUTH_MESSAGES = {
  invalidInput: 'Please check the highlighted fields and try again.',
  invalidCredentials: 'Incorrect email or password.',
  emailNotConfirmed: 'Please confirm your email address first. Use the link we sent when you signed up.',
  banned: 'This account has been suspended. Please contact support.',
  tooManyAttempts: 'Too many attempts. Please wait a few minutes and try again.',
  signInUnavailable: 'We couldn’t sign you in right now. Please try again in a moment.',
  signUpUnavailable: 'We couldn’t create your account right now. Please try again in a moment.',
  signUpDisabled: 'New sign-ups are paused right now. Please try again later.',
  emailRejected: 'We can’t use this email address. Please try a different one.',
  emailSendLimited: 'We couldn’t send the email right now. Please try again in a few minutes.',
  checkEmailSignUp:
    'Check your inbox for a confirmation link to finish creating your account. Already registered? Sign in instead.',
  resetSent: 'If an account exists for that email, we’ve sent a link to reset your password.',
  resetUnavailable: 'We couldn’t send the reset email right now. Please try again in a moment.',
  resetLinkExpired: 'This reset link has expired or was already used. Please request a new one.',
  samePassword: 'Your new password must be different from your current one.',
  passwordUpdated: 'Your password has been updated.',
  passwordUpdateUnavailable: 'We couldn’t update your password right now. Please try again in a moment.',
  reauthenticationNeeded: 'For your security, please request a new reset link and use it right away.',
  googleUnavailable: 'Google sign-in isn’t available right now. Please try again or use your email.',
  weakPassword: 'Please choose a stronger password: at least 8 characters with an uppercase letter and a number.',
  pwnedPassword: 'This password has appeared in a known data breach. Please choose a different one.',
  invalidEmail: 'Please enter a valid email address.',
  /** The form couldn't reach the server at all (offline, deploy in progress). */
  connectionFailed: 'We couldn’t reach Neuro Tech Voice. Check your internet connection and try again.',
} as const

function isUnavailable(error: AuthErrorLike): boolean {
  const status = error.status ?? 0
  // status 0/undefined: the request never got an answer (network, timeout).
  return status === 0 || status >= 500 || error.code === 'request_timeout' || error.code === 'unexpected_failure'
}

function isRateLimited(error: AuthErrorLike): boolean {
  return error.status === 429 || error.code === 'over_request_rate_limit'
}

export function weakPasswordMessage(error: AuthErrorLike): string {
  return error.reasons?.includes('pwned') ? AUTH_MESSAGES.pwnedPassword : AUTH_MESSAGES.weakPassword
}

export function signInErrorMessage(error: AuthErrorLike): string {
  if (isRateLimited(error)) return AUTH_MESSAGES.tooManyAttempts
  if (error.code === 'email_not_confirmed') return AUTH_MESSAGES.emailNotConfirmed
  if (error.code === 'user_banned') return AUTH_MESSAGES.banned
  if (isUnavailable(error)) return AUTH_MESSAGES.signInUnavailable
  return AUTH_MESSAGES.invalidCredentials
}

/** Sign-up outcome: an error to show, or the neutral "check your inbox" result. */
export function signUpErrorOutcome(error: AuthErrorLike): { error: string } | { checkEmail: true } {
  // Existing accounts get the same answer as new ones.
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return { checkEmail: true }
  if (error.code === 'weak_password') return { error: weakPasswordMessage(error) }
  if (error.code === 'signup_disabled' || error.code === 'email_provider_disabled') {
    return { error: AUTH_MESSAGES.signUpDisabled }
  }
  if (error.code === 'email_address_invalid' || error.code === 'email_address_not_authorized') {
    return { error: AUTH_MESSAGES.emailRejected }
  }
  if (error.code === 'over_email_send_rate_limit') return { error: AUTH_MESSAGES.emailSendLimited }
  if (isRateLimited(error)) return { error: AUTH_MESSAGES.tooManyAttempts }
  if (error.code === 'validation_failed') return { error: AUTH_MESSAGES.invalidInput }
  return { error: AUTH_MESSAGES.signUpUnavailable }
}

/**
 * Reset request outcome. Client errors (including Supabase's per-user
 * cooldown, which only exists for real accounts) look exactly like success.
 */
export function resetRequestErrorOutcome(error: AuthErrorLike): { error: string } | { sent: true } {
  if (isUnavailable(error)) return { error: AUTH_MESSAGES.resetUnavailable }
  return { sent: true }
}

export function passwordUpdateErrorMessage(error: AuthErrorLike): string {
  if (error.code === 'same_password') return AUTH_MESSAGES.samePassword
  if (error.code === 'weak_password') return weakPasswordMessage(error)
  if (error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid') {
    return AUTH_MESSAGES.reauthenticationNeeded
  }
  if (isRateLimited(error)) return AUTH_MESSAGES.tooManyAttempts
  if (
    error.status === 401 ||
    error.status === 403 ||
    error.code === 'session_not_found' ||
    error.code === 'session_expired' ||
    error.code === 'user_not_found' ||
    error.code === 'bad_jwt'
  ) {
    return AUTH_MESSAGES.resetLinkExpired
  }
  return AUTH_MESSAGES.passwordUpdateUnavailable
}

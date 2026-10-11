// Password rules shared by the auth forms (client validation) and the auth
// server actions (the enforcement point: server actions are public endpoints,
// so the client schema alone proves nothing). No server-only imports here.

import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8
/** GoTrue hashes with bcrypt, which only accepts passwords up to 72 bytes. */
export const PASSWORD_MAX_BYTES = 72

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX_BYTES, 'Password is too long')

export const PWNED_PASSWORD_MESSAGE =
  'This password has appeared in a data breach. Please choose a different one.'

/** What a password-setting server action returns when it does not redirect. */
export type PasswordActionResult = { error: string; field?: 'password' } | undefined

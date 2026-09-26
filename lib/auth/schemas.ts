// Validation for the auth forms, shared by the client forms (instant field
// errors) and the server actions (the real check: actions are public
// endpoints and receive whatever a caller sends).
//
// Plain functions instead of zod: these load on the sign-in and sign-up pages
// (which the home page prefetches), and zod would add ~60 KB gzip of script
// there for a handful of fields. Each schema keeps zod's parse/safeParse shape
// and the messages the forms show; formResolver() plugs one into
// react-hook-form.

import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form'

/** bcrypt, which Supabase Auth uses, only reads the first 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72
export const PASSWORD_MIN_LENGTH = 8

export interface ValidationIssue {
  path: string[]
  message: string
}

export type SafeParseResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: { issues: ValidationIssue[] } }

export interface Schema<T> {
  safeParse(input: unknown): SafeParseResult<T>
  /** Throws an Error carrying `issues` when the input is invalid. */
  parse(input: unknown): T
}

type Check<T> = (input: Record<string, unknown>, issues: ValidationIssue[]) => T

function typeName(value: unknown): string {
  return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
}

function objectSchema<T>(check: Check<T>): Schema<T> {
  const safeParse = (input: unknown): SafeParseResult<T> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { success: false, error: { issues: [{ path: [], message: `Invalid input: expected object, received ${typeName(input)}` }] } }
    }
    const issues: ValidationIssue[] = []
    const data = check(input as Record<string, unknown>, issues)
    return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data }
  }
  return {
    safeParse,
    parse(input) {
      const result = safeParse(input)
      if (result.success) return result.data
      throw Object.assign(new Error(result.error.issues[0]?.message ?? 'Invalid input'), { issues: result.error.issues })
    },
  }
}

/** Same pattern zod's z.email() uses. */
const EMAIL_REGEX = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/
const EMAIL_MESSAGE = 'Please enter a valid email'

function email(value: unknown, issues: ValidationIssue[]): string {
  if (typeof value !== 'string') {
    issues.push({ path: ['email'], message: EMAIL_MESSAGE })
    return ''
  }
  const normalized = value.trim().toLowerCase()
  if (normalized.length > 254) {
    issues.push({ path: ['email'], message: EMAIL_MESSAGE })
  } else if (!EMAIL_REGEX.test(normalized)) {
    issues.push({ path: ['email'], message: EMAIL_MESSAGE })
  }
  return normalized
}

/** Every rule a new password breaks, in the order the form lists them. */
function newPassword(value: unknown, issues: ValidationIssue[], field = 'password'): string {
  if (typeof value !== 'string') {
    issues.push({ path: [field], message: 'Please choose a password' })
    return ''
  }
  if (value.length < PASSWORD_MIN_LENGTH) issues.push({ path: [field], message: `Must be at least ${PASSWORD_MIN_LENGTH} characters` })
  if (value.length > PASSWORD_MAX_LENGTH) issues.push({ path: [field], message: `Must be at most ${PASSWORD_MAX_LENGTH} characters` })
  if (!/[A-Z]/.test(value)) issues.push({ path: [field], message: 'Must contain at least one uppercase letter' })
  if (!/[0-9]/.test(value)) issues.push({ path: [field], message: 'Must contain at least one number' })
  return value
}

/** Rules for choosing a password (sign-up and reset). Sign-in accepts any existing password. */
export const newPasswordSchema: Schema<string> = {
  safeParse(input) {
    const issues: ValidationIssue[] = []
    const data = newPassword(input, issues)
    return issues.length > 0 ? { success: false, error: { issues: issues.map((i) => ({ ...i, path: [] })) } } : { success: true, data }
  },
  parse(input) {
    const result = this.safeParse(input)
    if (result.success) return result.data
    throw Object.assign(new Error(result.error.issues[0]?.message ?? 'Invalid input'), { issues: result.error.issues })
  },
}

export interface SignInInput {
  email: string
  password: string
}

export const signInSchema = objectSchema<SignInInput>((input, issues) => {
  const normalizedEmail = email(input.email, issues)
  let password = ''
  if (typeof input.password !== 'string') issues.push({ path: ['password'], message: 'Password is required' })
  else {
    password = input.password
    if (password.length < 1) issues.push({ path: ['password'], message: 'Password is required' })
    if (password.length > PASSWORD_MAX_LENGTH * 4) issues.push({ path: ['password'], message: 'Password is too long' })
  }
  return { email: normalizedEmail, password }
})

export interface SignUpInput {
  fullName: string
  email: string
  password: string
}

export const signUpSchema = objectSchema<SignUpInput>((input, issues) => {
  let fullName = ''
  if (typeof input.fullName !== 'string') issues.push({ path: ['fullName'], message: 'Please enter your name' })
  else {
    fullName = input.fullName.trim()
    if (fullName.length < 2) issues.push({ path: ['fullName'], message: 'Name must be at least 2 characters' })
    if (fullName.length > 100) issues.push({ path: ['fullName'], message: 'Name must be at most 100 characters' })
  }
  const normalizedEmail = email(input.email, issues)
  const password = newPassword(input.password, issues)
  return { fullName, email: normalizedEmail, password }
})

export interface PasswordResetRequestInput {
  email: string
}

export const passwordResetRequestSchema = objectSchema<PasswordResetRequestInput>((input, issues) => ({
  email: email(input.email, issues),
}))

export interface NewPasswordInput {
  password: string
  confirmPassword: string
}

export const newPasswordFormSchema = objectSchema<NewPasswordInput>((input, issues) => {
  const password = newPassword(input.password, issues)
  let confirmPassword = ''
  if (typeof input.confirmPassword !== 'string') issues.push({ path: ['confirmPassword'], message: 'Please confirm your password' })
  else confirmPassword = input.confirmPassword
  // Compared whenever both are text, even if the password breaks a rule (the form shows both).
  if (typeof input.password === 'string' && typeof input.confirmPassword === 'string' && password !== confirmPassword) {
    issues.push({ path: ['confirmPassword'], message: "Passwords don't match" })
  }
  return { password, confirmPassword }
})

export interface RegisterFormInput extends SignUpInput {
  confirmPassword: string
  terms: boolean
}

/**
 * The sign-up form: signUpSchema plus the confirmation and terms, which only
 * exist in the form (the server action re-checks name, email and password).
 */
export const registerFormSchema = objectSchema<RegisterFormInput>((input, issues) => {
  const base = signUpSchema.safeParse(input)
  if (!base.success) issues.push(...base.error.issues)
  let confirmPassword = ''
  if (typeof input.confirmPassword !== 'string') issues.push({ path: ['confirmPassword'], message: 'Please confirm your password' })
  else confirmPassword = input.confirmPassword
  const terms = input.terms === true
  if (typeof input.terms !== 'boolean') issues.push({ path: ['terms'], message: 'You must accept the terms to continue' })
  else if (!terms) issues.push({ path: ['terms'], message: 'You must accept the terms to continue' })
  if (typeof input.password === 'string' && typeof input.confirmPassword === 'string' && input.password !== confirmPassword) {
    issues.push({ path: ['confirmPassword'], message: "Passwords don't match" })
  }
  const data = base.success ? base.data : { fullName: '', email: '', password: '' }
  return { ...data, confirmPassword, terms }
})

/**
 * A react-hook-form resolver for one of these schemas: the first message per
 * field, and the parsed (trimmed, lower-cased) values on success.
 */
export function formResolver<T extends FieldValues>(schema: Schema<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values)
    if (result.success) return { values: result.data, errors: {} }
    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'root'
      if (!(key in errors)) errors[key] = { type: 'validation', message: issue.message }
    }
    return { values: {}, errors: errors as unknown as FieldErrors<T> }
  }
}

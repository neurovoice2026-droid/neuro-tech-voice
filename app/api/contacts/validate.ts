// The team-contact rules as a plain function, so the dashboard form can check
// input without shipping zod to the browser. ./schema wraps it for the API,
// which keeps one set of rules and messages for both.

import { destinationRefusalMessage, isPremiumRateNumber } from '@/lib/phone/destinations'
import { E164_REGEX, normalizeE164 } from '@/lib/phone/e164'

export interface ContactInput {
  name: string
  role: string | null
  phone: string | null
  email: string | null
  transfer_enabled: boolean
  notify_sms: boolean
  notify_email: boolean
  is_on_call: boolean
  conditions: string | null
}

export type ContactField = keyof ContactInput

export interface ContactIssue {
  /** Empty for a body that isn't an object. */
  path: ContactField[]
  message: string
}

export type ContactValidation = { success: true; data: ContactInput } | { success: false; issues: ContactIssue[] }

/** Same pattern zod's z.email() uses. */
const EMAIL_REGEX = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/

function typeName(value: unknown): string {
  return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
}

export function validateContactInput(input: unknown): ContactValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, issues: [{ path: [], message: `Invalid input: expected object, received ${typeName(input)}` }] }
  }
  const raw = input as Record<string, unknown>
  const issues: ContactIssue[] = []
  const fail = (field: ContactField, message: string) => issues.push({ path: [field], message })
  // A wrong type stops the checks across fields; a format problem doesn't (the form shows both).
  let typeError = false
  const failType = (field: ContactField, message: string) => {
    typeError = true
    fail(field, message)
  }

  let name = ''
  if (typeof raw.name !== 'string') failType('name', `Invalid input: expected string, received ${typeName(raw.name)}`)
  else {
    name = raw.name.trim()
    if (name.length < 1) fail('name', 'Add a name')
    else if (name.length > 80) fail('name', 'Name must be 80 characters or fewer')
  }

  // Optional text: blanks are stored as NULL, not ''.
  const optionalText = (field: 'role' | 'conditions', max: number, label: string): string | null => {
    const value = raw[field]
    if (value === undefined || value === null) return null
    if (typeof value !== 'string') {
      failType(field, `Invalid input: expected string, received ${typeName(value)}`)
      return null
    }
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.length > max) fail(field, `${label} must be ${max} characters or fewer`)
    return trimmed
  }
  const role = optionalText('role', 80, 'Role')
  const conditions = optionalText('conditions', 500, 'Instructions')

  let phone: string | null = null
  // What the rules across fields see: the typed number even when its format is wrong.
  let phoneForRules: string | null = null
  if (raw.phone !== undefined && raw.phone !== null) {
    if (typeof raw.phone !== 'string') failType('phone', `Invalid input: expected string, received ${typeName(raw.phone)}`)
    else if (raw.phone.trim()) {
      // "+40 712 345 678" and "0040712345678" become +40712345678.
      const typed = raw.phone.trim()
      const normalized = normalizeE164(typed) ?? typed
      phoneForRules = normalized
      if (!E164_REGEX.test(normalized)) fail('phone', 'Use the international format with the country code, e.g. +40712345678')
      else phone = normalized
    }
  }

  let email: string | null = null
  let emailForRules: string | null = null
  if (raw.email !== undefined && raw.email !== null) {
    if (typeof raw.email !== 'string') failType('email', 'Enter a valid email address')
    else if (raw.email.trim()) {
      const trimmed = raw.email.trim()
      emailForRules = trimmed
      if (!EMAIL_REGEX.test(trimmed)) fail('email', 'Enter a valid email address')
      else if (trimmed.length > 254) fail('email', 'Too big: expected string to have <=254 characters')
      else email = trimmed
    }
  }

  const flag = (field: 'transfer_enabled' | 'notify_sms' | 'notify_email' | 'is_on_call'): boolean => {
    const value = raw[field]
    if (value === undefined) return false
    if (typeof value !== 'boolean') {
      failType(field, `Invalid input: expected boolean, received ${typeName(value)}`)
      return false
    }
    return value
  }
  const data: ContactInput = {
    name,
    role,
    phone,
    email,
    transfer_enabled: flag('transfer_enabled'),
    notify_sms: flag('notify_sms'),
    notify_email: flag('notify_email'),
    is_on_call: flag('is_on_call'),
    conditions,
  }
  if (typeError) return { success: false, issues }

  // Rules across fields.
  if (!phoneForRules && !emailForRules) fail('phone', 'Add a phone number or an email address')
  // Transfers, on-call fallback and text alerts are paid by the platform: never to premium-rate numbers.
  if (phoneForRules && isPremiumRateNumber(phoneForRules)) fail('phone', destinationRefusalMessage('premium_rate'))
  if (data.transfer_enabled && !phoneForRules) fail('transfer_enabled', 'Live transfers need a phone number')
  if (data.notify_sms && !phoneForRules) fail('notify_sms', 'Text alerts need a phone number')
  if (data.notify_email && !emailForRules) fail('notify_email', 'Email alerts need an email address')
  return issues.length > 0 ? { success: false, issues } : { success: true, data }
}

/** First error message per field, for inline form errors. */
export function contactIssueMessages(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Partial<Record<ContactField, string>> {
  const out: Partial<Record<ContactField, string>> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) out[key as ContactField] = issue.message
  }
  return out
}

// The Google integration types and the OAuth scopes each one asks for. Pure.
//
// Each type is its own integrations row with its own refresh token, and every
// reader uses a row only for its own API (Calendar booking and workflows on
// google_calendar, Gmail on gmail, ...), so a connect asks for that type's
// scope alone: Google's minimum-scope rule, and a shorter consent screen.
// The scopes are the ones the app already requested together (the OAuth
// consent screen lists them), split per type; tokens granted before keep
// every scope they were granted.

import type { IntegrationType } from '@/types'

export type GoogleIntegrationType = Exclude<IntegrationType, 'webhook'>

export const GOOGLE_INTEGRATION_TYPES: readonly GoogleIntegrationType[] = [
  'google_calendar',
  'gmail',
  'google_sheets',
  'google_docs',
  'google_drive',
]

const SCOPES: Record<GoogleIntegrationType, readonly string[]> = {
  // Booking lists the calendars, reads free/busy and creates and finds
  // events: calendar.events alone cannot list calendars or read free/busy.
  google_calendar: ['https://www.googleapis.com/auth/calendar'],
  gmail: ['https://www.googleapis.com/auth/gmail.send'],
  // Workflows append to a spreadsheet the owner names, not only to ones the
  // app created, so drive.file is not enough.
  google_sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  google_docs: ['https://www.googleapis.com/auth/documents'],
  google_drive: ['https://www.googleapis.com/auth/drive.file'],
}

export function isGoogleIntegrationType(value: unknown): value is GoogleIntegrationType {
  return typeof value === 'string' && (GOOGLE_INTEGRATION_TYPES as readonly string[]).includes(value)
}

/** The OAuth scopes a connect of this integration type asks for. */
export function googleScopesFor(type: GoogleIntegrationType): string[] {
  return [...SCOPES[type]]
}

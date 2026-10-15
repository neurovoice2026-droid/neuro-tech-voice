import { describe, expect, it } from 'vitest'
import { GOOGLE_INTEGRATION_TYPES, googleScopesFor, isGoogleIntegrationType } from './scopes'

const BASE = 'https://www.googleapis.com/auth/'

describe('Google OAuth scopes per integration type', () => {
  it('asks each type for its own scope only', () => {
    expect(googleScopesFor('google_calendar')).toEqual([`${BASE}calendar`])
    expect(googleScopesFor('gmail')).toEqual([`${BASE}gmail.send`])
    expect(googleScopesFor('google_sheets')).toEqual([`${BASE}spreadsheets`])
    expect(googleScopesFor('google_docs')).toEqual([`${BASE}documents`])
    expect(googleScopesFor('google_drive')).toEqual([`${BASE}drive.file`])
  })

  it('never asks for more than the five scopes the consent screen already lists', () => {
    const all = new Set(GOOGLE_INTEGRATION_TYPES.flatMap((t) => googleScopesFor(t)))
    expect([...all].sort()).toEqual(
      ['calendar', 'documents', 'drive.file', 'gmail.send', 'spreadsheets'].map((s) => `${BASE}${s}`),
    )
  })

  it('hands out a copy, so a caller cannot widen another connect', () => {
    googleScopesFor('gmail').push(`${BASE}drive`)
    expect(googleScopesFor('gmail')).toEqual([`${BASE}gmail.send`])
  })

  it('recognises the Google types only', () => {
    for (const t of GOOGLE_INTEGRATION_TYPES) expect(isGoogleIntegrationType(t)).toBe(true)
    for (const bad of ['webhook', '', 'GMAIL', 'constructor', 'toString', null, undefined, 1]) {
      expect(isGoogleIntegrationType(bad)).toBe(false)
    }
  })
})

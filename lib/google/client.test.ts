import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGoogleOAuthUrl } from './client'

// The consent URL is built locally by google-auth-library (no network).

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'cid.apps.googleusercontent.com')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret')
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://app.test/api/integrations/google/callback')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getGoogleOAuthUrl', () => {
  it('asks for the chosen type\'s scope only, with incremental authorization', () => {
    const url = new URL(getGoogleOAuthUrl('gmail', 'gmail.nonce'))
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.send')
    expect(url.searchParams.get('include_granted_scopes')).toBe('true')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('gmail.nonce')
    expect(url.searchParams.get('client_id')).toBe('cid.apps.googleusercontent.com')
  })

  it('keeps the calendar scope booking needs (calendar list and free/busy)', () => {
    const url = new URL(getGoogleOAuthUrl('google_calendar', 's'))
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar')
  })
})

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OAUTH_RETURN_PATH,
  oauthReturnKey,
  oauthReturnPath,
  oauthStateCookieValue,
  parseOAuthStateCookie,
  withQuery,
} from './oauth-return'

describe('Google OAuth return path allow-list', () => {
  it('accepts only exact allow-listed same-origin paths', () => {
    expect(oauthReturnKey('/agent?tab=call-handling')).toBe('agent_call_handling')
    expect(oauthReturnKey('/integrations')).toBe('integrations')
    for (const bad of [
      null,
      '',
      'https://evil.example/agent?tab=call-handling',
      '//evil.example/agent',
      '/agent?tab=call-handling&next=//evil.example',
      '/agent',
      '/\\evil.example',
      'javascript:alert(1)',
      '/agent?tab=CALL-HANDLING',
    ]) {
      expect(oauthReturnKey(bad)).toBeNull()
    }
  })

  it('maps keys back to paths, defaulting to /integrations', () => {
    expect(oauthReturnPath('agent_call_handling')).toBe('/agent?tab=call-handling')
    expect(oauthReturnPath('constructor')).toBe(DEFAULT_OAUTH_RETURN_PATH)
    expect(oauthReturnPath('/agent?tab=call-handling')).toBe(DEFAULT_OAUTH_RETURN_PATH)
    expect(oauthReturnPath(null)).toBe(DEFAULT_OAUTH_RETURN_PATH)
  })

  it('round-trips the state cookie (older cookies carry the nonce only)', () => {
    const nonce = 'a'.repeat(32)
    expect(oauthStateCookieValue(nonce, null)).toBe(nonce)
    expect(oauthStateCookieValue(nonce, 'integrations')).toBe(nonce)
    expect(parseOAuthStateCookie(oauthStateCookieValue(nonce, 'agent_call_handling'))).toEqual({ nonce, returnPath: '/agent?tab=call-handling' })
    expect(parseOAuthStateCookie(nonce)).toEqual({ nonce, returnPath: '/integrations' })
    expect(parseOAuthStateCookie(`${nonce}.https://evil.example`)).toEqual({ nonce, returnPath: '/integrations' })
    expect(parseOAuthStateCookie(undefined)).toEqual({ nonce: null, returnPath: '/integrations' })
    expect(parseOAuthStateCookie('.agent_call_handling').nonce).toBeNull()
  })

  it('adds result parameters to the return path', () => {
    expect(withQuery('/agent?tab=call-handling', { connected: 'google_calendar' })).toBe('/agent?tab=call-handling&connected=google_calendar')
    expect(withQuery('/integrations', { error: 'oauth_denied' })).toBe('/integrations?error=oauth_denied')
  })
})

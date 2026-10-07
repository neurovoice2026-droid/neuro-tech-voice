import { describe, expect, it } from 'vitest'
import { REAUTH_WINDOW_MS, expectedDeletionConfirmation, isDeletionConfirmed, isRecentSignIn } from './confirmation'

describe('account deletion confirmation', () => {
  it('expects the business name, trimmed', () => {
    expect(expectedDeletionConfirmation('  Smile Clinic  ')).toBe('Smile Clinic')
    expect(isDeletionConfirmed('Smile Clinic', 'Smile Clinic')).toBe(true)
    expect(isDeletionConfirmed('  Smile Clinic ', 'Smile Clinic')).toBe(true)
  })

  it('is exact: case and partial names do not confirm', () => {
    expect(isDeletionConfirmed('smile clinic', 'Smile Clinic')).toBe(false)
    expect(isDeletionConfirmed('Smile', 'Smile Clinic')).toBe(false)
    expect(isDeletionConfirmed('', 'Smile Clinic')).toBe(false)
  })

  it('falls back to DELETE when the organization has no name', () => {
    expect(expectedDeletionConfirmation(null)).toBe('DELETE')
    expect(expectedDeletionConfirmation('   ')).toBe('DELETE')
    expect(isDeletionConfirmed('DELETE', null)).toBe(true)
    expect(isDeletionConfirmed('delete', null)).toBe(false)
  })
})

describe('fresh sign-in', () => {
  const now = Date.parse('2026-10-07T12:00:00Z')
  it('accepts a sign-in within 30 minutes only', () => {
    expect(REAUTH_WINDOW_MS).toBe(30 * 60_000)
    expect(isRecentSignIn('2026-10-07T11:45:00Z', now)).toBe(true)
    expect(isRecentSignIn('2026-10-07T11:30:00Z', now)).toBe(true)
    expect(isRecentSignIn('2026-10-07T11:29:59Z', now)).toBe(false)
    expect(isRecentSignIn(null, now)).toBe(false)
    expect(isRecentSignIn('not a date', now)).toBe(false)
  })
})

describe('what the marketing pages say about account deletion', () => {
  it('the 30-minute sign-in window and the billing-first order the custom-mobile-applications page quotes', async () => {
    // Importing the page module runs its own guards (DELETION_ORDER first and last step).
    const { FACTS_MOB } = await import('@/lib/pages/custom-mobile-applications')
    expect(FACTS_MOB.reauthMinutes * 60_000).toBe(REAUTH_WINDOW_MS)
  })
})

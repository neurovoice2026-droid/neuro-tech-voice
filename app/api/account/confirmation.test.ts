import { describe, expect, it } from 'vitest'
import { expectedDeletionConfirmation, isDeletionConfirmed } from './confirmation'

describe('account deletion confirmation', () => {
  it('expects the organization name, trimmed', () => {
    expect(expectedDeletionConfirmation('  Acme Dental  ')).toBe('Acme Dental')
    expect(isDeletionConfirmed('Acme Dental', 'Acme Dental')).toBe(true)
    expect(isDeletionConfirmed('  Acme Dental ', 'Acme Dental')).toBe(true)
  })

  it('is exact: case and partial names do not confirm', () => {
    expect(isDeletionConfirmed('acme dental', 'Acme Dental')).toBe(false)
    expect(isDeletionConfirmed('Acme', 'Acme Dental')).toBe(false)
    expect(isDeletionConfirmed('', 'Acme Dental')).toBe(false)
  })

  it('falls back to DELETE when the organization has no name', () => {
    expect(expectedDeletionConfirmation(null)).toBe('DELETE')
    expect(expectedDeletionConfirmation('   ')).toBe('DELETE')
    expect(isDeletionConfirmed('DELETE', null)).toBe(true)
    expect(isDeletionConfirmed('', null)).toBe(false)
  })
})

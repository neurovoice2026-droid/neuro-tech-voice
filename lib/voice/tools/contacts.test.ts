import { describe, expect, it } from 'vitest'
import { contactMatchScore, findContact, pickTransferContact, type MatchableContact } from '@/lib/voice/tools/contacts'

function contact(overrides: Partial<MatchableContact> & { id: string; name: string }): MatchableContact {
  return {
    role: null,
    phone: '+40712345678',
    transfer_enabled: true,
    is_on_call: false,
    sort_order: 0,
    ...overrides,
  }
}

const team = [
  contact({ id: 'maria', name: 'Maria Popescu', role: 'Office manager', sort_order: 0 }),
  contact({ id: 'dan', name: 'Dan Ionescu', role: 'Emergency plumber', is_on_call: true, sort_order: 1, phone: '+40722000111' }),
  contact({ id: 'stefan', name: 'Ștefan Vasile', role: 'Billing', sort_order: 2, transfer_enabled: false }),
  contact({ id: 'noah', name: 'Noah', role: 'Sales', sort_order: 3, phone: '0722 000 111' }),
]

describe('contactMatchScore', () => {
  it('matches names, roles, first names and misheard spellings', () => {
    expect(contactMatchScore(team[0], 'Maria Popescu')).toBe(100)
    expect(contactMatchScore(team[0], 'office manager')).toBe(95)
    expect(contactMatchScore(team[0], 'maria popescu from the office')).toBe(90)
    expect(contactMatchScore(team[0], 'the manager')).toBe(80)
    expect(contactMatchScore(team[0], 'Maria')).toBe(75)
    expect(contactMatchScore(team[0], 'Mariya Popesco')).toBe(60)
    expect(contactMatchScore(team[2], 'stefan')).toBe(75)
    expect(contactMatchScore(team[0], 'billing')).toBe(0)
    expect(contactMatchScore(team[0], 'managerul')).toBe(70)
  })

  it('handles names without spaces in scripts like Chinese', () => {
    expect(contactMatchScore(contact({ id: 'wang', name: '王经理' }), '请转王经理')).toBe(88)
  })
})

describe('findContact', () => {
  it('finds any contact for messages, including ones that take no transfers', () => {
    expect(findContact(team, 'someone from billing')?.id).toBe('stefan')
    expect(findContact(team, 'Stefan')?.id).toBe('stefan')
    expect(findContact(team, 'the accountant')).toBeNull()
    expect(findContact(team, null)).toBeNull()
  })
})

describe('pickTransferContact', () => {
  it('transfers to the requested person when transfers are allowed', () => {
    expect(pickTransferContact(team, 'Maria')).toEqual({ contact: team[0], matchedBy: 'requested' })
    expect(pickTransferContact(team, 'a plumber, it is an emergency')?.contact.id).toBe('dan')
  })

  it('falls back to the on-call contact when the requested person cannot take transfers', () => {
    expect(pickTransferContact(team, 'Stefan from billing')).toEqual({ contact: team[1], matchedBy: 'on_call' })
    expect(pickTransferContact(team, 'Noah')).toEqual({ contact: team[1], matchedBy: 'on_call' })
  })

  it('uses the on-call contact, then the first transferable one, when nobody is named', () => {
    expect(pickTransferContact(team, null)).toEqual({ contact: team[1], matchedBy: 'on_call' })
    const noOnCall = team.map((c) => ({ ...c, is_on_call: false }))
    expect(pickTransferContact(noOnCall, '')).toEqual({ contact: noOnCall[0], matchedBy: 'default' })
  })

  it('offers nothing when a named person is unavailable and nobody is on call', () => {
    const noOnCall = team.map((c) => ({ ...c, is_on_call: false }))
    expect(pickTransferContact(noOnCall, 'Stefan')).toBeNull()
  })

  it('never transfers to contacts without transfers or a valid number', () => {
    const blocked = [
      contact({ id: 'a', name: 'Ana', transfer_enabled: false, is_on_call: true }),
      contact({ id: 'b', name: 'Bogdan', phone: null, is_on_call: true }),
      contact({ id: 'c', name: 'Cristi', phone: '0722000111', is_on_call: true }),
    ]
    expect(pickTransferContact(blocked, null)).toBeNull()
    expect(pickTransferContact([], 'anyone')).toBeNull()
  })
})

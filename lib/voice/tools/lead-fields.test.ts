import { describe, expect, it } from 'vitest'
import { mergeLeadDetails, normalizeSpokenEmail } from '@/lib/voice/tools/lead-fields'
import type { LeadField } from '@/types'

const fields: LeadField[] = [
  { key: 'property_type', label: 'Property type', question: 'Is it a house or an apartment?', required: true },
  { key: 'financing', label: 'Financing', question: 'Do you already have financing?', required: false },
]

const empty = { name: null, email: null, need: null, budget: null, timing: null, notes: null }

describe('mergeLeadDetails', () => {
  it('saves the standard fields and keeps existing values', () => {
    const result = mergeLeadDetails({ need: 'old need', outcome_note: 'kept' }, { ...empty, name: 'Ana Pop', budget: '300k' }, fields)
    expect(result.extracted).toEqual({ need: 'old need', outcome_note: 'kept', name: 'Ana Pop', budget: '300k' })
    expect(result.saved).toEqual(['name', 'budget'])
  })

  it('maps "question: answer" notes onto the owner’s lead questions', () => {
    const result = mergeLeadDetails({}, { ...empty, notes: 'Property type: apartment; financing: pre-approved; pets: one dog' }, fields)
    expect(result.extracted).toEqual({ property_type: 'apartment', financing: 'pre-approved', notes: 'pets: one dog' })
  })

  it('normalises spoken emails and flags incomplete ones', () => {
    expect(normalizeSpokenEmail('Ana.Pop at Example dot com')).toBe('ana.pop@example.com')
    const ok = mergeLeadDetails({}, { ...empty, email: 'ana at example dot com' }, fields)
    expect(ok.extracted.email).toBe('ana@example.com')
    const bad = mergeLeadDetails({}, { ...empty, email: 'ana at example' }, fields)
    expect(bad.invalidEmail).toBe(true)
    expect(bad.extracted.email).toBeUndefined()
  })

  it('ignores non-string values already stored and caps long answers', () => {
    const result = mergeLeadDetails({ weird: 42 as unknown as string }, { ...empty, need: 'x'.repeat(900) }, [])
    expect(result.extracted.weird).toBeUndefined()
    expect(result.extracted.need).toHaveLength(500)
  })
})

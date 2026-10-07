import { describe, expect, it } from 'vitest'
import { isStricterPrivacy, readAppliedPrivacy } from './privacy-change'

describe('isStricterPrivacy', () => {
  const p = (record_audio: boolean, retention_days: number) => ({ record_audio, retention_days })

  it('is true for recording turned off or a shorter retention (a limit replacing unlimited too)', () => {
    expect(isStricterPrivacy(p(true, 365), p(false, 365))).toBe(true)
    expect(isStricterPrivacy(p(true, 365), p(true, 30))).toBe(true)
    expect(isStricterPrivacy(p(true, -1), p(true, 730))).toBe(true)
    expect(isStricterPrivacy(p(true, 30), p(true, 0))).toBe(true)
  })

  it('is false for looser or unchanged settings, and when the previous state is unknown', () => {
    expect(isStricterPrivacy(p(false, 30), p(true, 30))).toBe(false)
    expect(isStricterPrivacy(p(true, 30), p(true, 365))).toBe(false)
    expect(isStricterPrivacy(p(true, 30), p(true, -1))).toBe(false)
    expect(isStricterPrivacy(p(true, 30), p(true, 30))).toBe(false)
    expect(isStricterPrivacy(null, p(false, 0))).toBe(false)
  })

  it('reads only a well-formed recorded state', () => {
    expect(readAppliedPrivacy({ record_audio: true, retention_days: 30 })).toEqual(p(true, 30))
    for (const bad of [null, 'x', [], { record_audio: 'yes', retention_days: 30 }, { record_audio: true, retention_days: 1.5 }]) expect(readAppliedPrivacy(bad)).toBeNull()
  })
})

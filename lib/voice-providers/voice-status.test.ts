import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { defaultVoiceNotice, registryNotice } from './voice-status'

describe('defaultVoiceNotice', () => {
  it('announces the retirement date and the automatic switch date', () => {
    const n = defaultVoiceNotice(new Date('2026-10-07T00:00:00Z'))
    expect(n).toMatchObject({ code: 'default_voice_retirement', at: '2026-12-31T23:59:59Z', auto_switch_at: '2026-12-15T00:00:00.000Z' })
    expect(n.message).toBe(
      "This voice will stop working on 31 Dec 2026 — choose a new voice. If you don't, we will switch your agent to a recommended voice for its language on 15 Dec 2026.",
    )
  })

  it('says the switch is under way once the migration date has passed', () => {
    expect(defaultVoiceNotice(new Date('2026-12-20T00:00:00Z')).message).toContain('We are switching your agent')
  })
})

describe('registryNotice', () => {
  it('maps lifecycle notices to tenant copy, nothing for a clean voice', () => {
    expect(registryNotice(null, null)).toBeNull()
    expect(registryNotice('removal_scheduled', '2026-11-01T00:00:00Z')?.message).toContain('1 Nov 2026')
    expect(registryNotice('removed', null)?.code).toBe('removed')
    expect(registryNotice('custom_rate', null)?.message).toContain('no longer offered for new selections')
  })
})

import { describe, expect, it } from 'vitest'
import { privacySettingsPatch } from '@/components/agent/tabs/TabCallHandling'

// Agent → Call handling → Privacy: an explicitly saved retention period also
// purges the call history here (call_retention), so the card only sends
// retention_days when the owner chose one, now or in an earlier save.

const DEFAULT = { record_audio: true, retention_days: 365 }

describe('privacySettingsPatch', () => {
  it('sends only the recording switch when the default retention was never saved', () => {
    expect(privacySettingsPatch(null, DEFAULT, { ...DEFAULT, record_audio: false })).toEqual({ record_audio: false })
    expect(privacySettingsPatch({ record_audio: true }, DEFAULT, { ...DEFAULT, record_audio: false })).toEqual({ record_audio: false })
  })

  it('keeps a retention period saved earlier', () => {
    const saved = { record_audio: true, retention_days: 90 }
    expect(privacySettingsPatch(saved, saved, { ...saved, record_audio: false })).toEqual({ record_audio: false, retention_days: 90 })
  })

  it('sends the retention period the owner changed', () => {
    expect(privacySettingsPatch(null, DEFAULT, { ...DEFAULT, retention_days: 30 })).toEqual({ record_audio: true, retention_days: 30 })
    expect(privacySettingsPatch(null, DEFAULT, { ...DEFAULT, retention_days: -1 })).toEqual({ record_audio: true, retention_days: -1 })
  })

  it('sends nothing when only other settings (the recording notice) changed', () => {
    expect(privacySettingsPatch(null, DEFAULT, DEFAULT)).toBeNull()
    expect(privacySettingsPatch({ record_audio: true, retention_days: 90 }, { record_audio: true, retention_days: 90 }, { record_audio: true, retention_days: 90 })).toBeNull()
  })
})

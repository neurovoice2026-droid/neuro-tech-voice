import { describe, expect, it } from 'vitest'
import {
  AfterHoursSchema,
  AnalysisSettingsSchema,
  ConversationSettingsSchema,
  DynamicVariablesSchema,
  PrivacySettingsSchema,
  TransferSettingsSchema,
  VoiceTuningSchema,
  WorkingHoursSchema,
  e164,
  readAfterHours,
  readAnalysisSettings,
  readConversationSettings,
  readDynamicVariables,
  readPrivacySettings,
  readTransferSettings,
  readVoiceTuning,
  readWorkingHours,
} from './settings'
import {
  DEFAULT_ANALYSIS_SETTINGS,
  DEFAULT_CONVERSATION_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_TRANSFER_SETTINGS,
} from './types'
import { DEFAULT_AFTER_HOURS } from './working-hours'

function issuePaths(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }): string[] {
  return (result.error?.issues ?? []).map((i) => i.path.map(String).join('.'))
}

describe('e164', () => {
  it('accepts international numbers and trims whitespace', () => {
    expect(e164.parse('+40712345678')).toBe('+40712345678')
    expect(e164.parse('  +14155550123 ')).toBe('+14155550123')
  })

  it('rejects national formats, leading zero country codes and bad lengths', () => {
    for (const bad of ['0712345678', '+0712345678', '+12345', '+1234567890123456', '+40 712 345 678', 'abc', '']) {
      expect(e164.safeParse(bad).success, bad).toBe(false)
    }
  })
})

describe('TransferSettingsSchema', () => {
  it('requires a number when transfer is enabled (error on the number path)', () => {
    const r = TransferSettingsSchema.safeParse({ enabled: true, number: null, condition: null, label: null })
    expect(r.success).toBe(false)
    expect(issuePaths(r)).toContain('number')
  })

  it('accepts a disabled transfer without a number', () => {
    expect(TransferSettingsSchema.safeParse(DEFAULT_TRANSFER_SETTINGS).success).toBe(true)
  })

  it('accepts an enabled transfer with a valid E.164 number', () => {
    const r = TransferSettingsSchema.safeParse({ enabled: true, number: ' +40712345678 ', condition: 'Caller asks for billing', label: 'Billing' })
    expect(r.success).toBe(true)
    expect(r.data?.number).toBe('+40712345678')
  })

  it('rejects a non-E.164 destination and over-long label/condition', () => {
    expect(TransferSettingsSchema.safeParse({ enabled: true, number: '0712345678', condition: null, label: null }).success).toBe(false)
    expect(TransferSettingsSchema.safeParse({ enabled: false, number: null, condition: null, label: 'x'.repeat(81) }).success).toBe(false)
    expect(TransferSettingsSchema.safeParse({ enabled: false, number: null, condition: 'x'.repeat(501), label: null }).success).toBe(false)
  })
})

describe('AfterHoursSchema', () => {
  it('requires a forward number when the gate is enabled in forward mode', () => {
    const r = AfterHoursSchema.safeParse({ enabled: true, mode: 'forward', message: null, forward_number: null })
    expect(r.success).toBe(false)
    expect(issuePaths(r)).toContain('forward_number')
    expect(AfterHoursSchema.safeParse({ enabled: true, mode: 'forward' }).success).toBe(false)
  })

  it('accepts forward mode with a number, and forward mode without a number while disabled', () => {
    expect(AfterHoursSchema.safeParse({ enabled: true, mode: 'forward', forward_number: '+40712345678' }).success).toBe(true)
    expect(AfterHoursSchema.safeParse({ enabled: false, mode: 'forward', forward_number: null }).success).toBe(true)
  })

  it('does not require a number for message / ai modes', () => {
    expect(AfterHoursSchema.safeParse({ enabled: true, mode: 'message', message: 'We are closed.' }).success).toBe(true)
    expect(AfterHoursSchema.safeParse({ enabled: true, mode: 'ai' }).success).toBe(true)
  })

  it('rejects an unknown mode and an invalid forward number', () => {
    expect(AfterHoursSchema.safeParse({ enabled: true, mode: 'voicemail' }).success).toBe(false)
    expect(AfterHoursSchema.safeParse({ enabled: true, mode: 'forward', forward_number: '12345' }).success).toBe(false)
  })
})

describe('DynamicVariablesSchema', () => {
  it('accepts ordinary customer variables', () => {
    expect(DynamicVariablesSchema.safeParse({ clinic_city: 'Cluj', promoCode: 'AUTUMN' }).success).toBe(true)
    expect(DynamicVariablesSchema.safeParse({}).success).toBe(true)
  })

  it('rejects reserved prefixes and platform variable names', () => {
    for (const key of ['system__caller_id', 'secret__token', 'ntv_call_id', 'ntv_anything', 'after_hours', 'business_name']) {
      expect(DynamicVariablesSchema.safeParse({ [key]: 'x' }).success, key).toBe(false)
    }
  })

  it('rejects malformed keys and over-long values', () => {
    expect(DynamicVariablesSchema.safeParse({ '1abc': 'x' }).success).toBe(false)
    expect(DynamicVariablesSchema.safeParse({ 'has-dash': 'x' }).success).toBe(false)
    expect(DynamicVariablesSchema.safeParse({ ['a'.repeat(41)]: 'x' }).success).toBe(false)
    expect(DynamicVariablesSchema.safeParse({ ok: 'x'.repeat(501) }).success).toBe(false)
  })

  it('allows at most 20 variables', () => {
    const vars = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`var_${i}`, String(i)]))
    expect(DynamicVariablesSchema.safeParse(vars(20)).success).toBe(true)
    const r = DynamicVariablesSchema.safeParse(vars(21))
    expect(r.success).toBe(false)
    expect(r.error?.issues.some((i) => i.message === 'At most 20 variables')).toBe(true)
  })
})

describe('ConversationSettingsSchema', () => {
  it('accepts the defaults', () => {
    expect(ConversationSettingsSchema.safeParse(DEFAULT_CONVERSATION_SETTINGS).success).toBe(true)
  })

  it('does not allow AI disclosure to be turned off', () => {
    const r = ConversationSettingsSchema.safeParse({ ...DEFAULT_CONVERSATION_SETTINGS, ai_disclosure: false })
    expect(r.success).toBe(false)
    expect(issuePaths(r)).toContain('ai_disclosure')
  })

  it('enforces ranges', () => {
    const base = DEFAULT_CONVERSATION_SETTINGS
    expect(ConversationSettingsSchema.safeParse({ ...base, turn_timeout_seconds: 0 }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, turn_timeout_seconds: 31 }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, turn_timeout_seconds: 7.5 }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, silence_end_call_seconds: 9 }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, silence_end_call_seconds: null }).success).toBe(true)
    expect(ConversationSettingsSchema.safeParse({ ...base, max_call_duration_minutes: 121 }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, temperature: 1.5 }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, turn_eagerness: 'hasty' }).success).toBe(false)
  })
})

describe('other schemas', () => {
  it('AnalysisSettingsSchema accepts the defaults and validates field ids', () => {
    expect(AnalysisSettingsSchema.safeParse(DEFAULT_ANALYSIS_SETTINGS).success).toBe(true)
    expect(
      AnalysisSettingsSchema.safeParse({ success_criteria: [], data_collection: [{ id: 'Bad-Id', type: 'string', description: 'x' }] }).success,
    ).toBe(false)
  })

  it('PrivacySettingsSchema bounds retention', () => {
    expect(PrivacySettingsSchema.safeParse({ record_audio: true, retention_days: -1 }).success).toBe(true)
    expect(PrivacySettingsSchema.safeParse({ record_audio: true, retention_days: -2 }).success).toBe(false)
    expect(PrivacySettingsSchema.safeParse({ record_audio: true, retention_days: 3651 }).success).toBe(false)
  })

  it('VoiceTuningSchema bounds speed', () => {
    expect(VoiceTuningSchema.safeParse({ stability: 0.5, similarity_boost: null, speed: 1.2 }).success).toBe(true)
    expect(VoiceTuningSchema.safeParse({ stability: null, similarity_boost: null, speed: 1.3 }).success).toBe(false)
  })

  it('WorkingHoursSchema accepts HH:MM and 24:00, rejects other clocks', () => {
    expect(WorkingHoursSchema.safeParse({ monday: { start: '09:00', end: '24:00', enabled: true } }).success).toBe(true)
    expect(WorkingHoursSchema.safeParse({ monday: { start: '9:00', end: '18:00', enabled: true } }).success).toBe(false)
    expect(WorkingHoursSchema.safeParse({ monday: { start: '09:00', end: '24:30', enabled: true } }).success).toBe(false)
  })
})

describe('readConversationSettings (lenient)', () => {
  it('returns the defaults for missing / non-object input', () => {
    expect(readConversationSettings(null)).toEqual(DEFAULT_CONVERSATION_SETTINGS)
    expect(readConversationSettings(undefined)).toEqual(DEFAULT_CONVERSATION_SETTINGS)
    expect(readConversationSettings('garbage')).toEqual(DEFAULT_CONVERSATION_SETTINGS)
    expect(readConversationSettings([1, 2])).toEqual(DEFAULT_CONVERSATION_SETTINGS)
  })

  it('returns a copy, never the shared defaults object', () => {
    const out = readConversationSettings(null)
    expect(out).not.toBe(DEFAULT_CONVERSATION_SETTINGS)
  })

  it('migrates legacy behavior_settings auto_end_call / auto_end_silence_seconds', () => {
    expect(readConversationSettings({ auto_end_call: true, auto_end_silence_seconds: 45 }).silence_end_call_seconds).toBe(45)
    // Minimum of 10 seconds.
    expect(readConversationSettings({ auto_end_call: true, auto_end_silence_seconds: 3 }).silence_end_call_seconds).toBe(10)
    // Non-numeric legacy value → 20 s.
    expect(readConversationSettings({ auto_end_call: true, auto_end_silence_seconds: 'abc' }).silence_end_call_seconds).toBe(20)
    // auto_end_call: false → never end on silence.
    expect(readConversationSettings({ auto_end_call: false, auto_end_silence_seconds: 30 }).silence_end_call_seconds).toBeNull()
  })

  it('prefers the new key over the legacy one when both are present', () => {
    const out = readConversationSettings({ silence_end_call_seconds: 60, auto_end_call: false, auto_end_silence_seconds: 30 })
    expect(out.silence_end_call_seconds).toBe(60)
  })

  it('migrates max_call_duration_enabled = false to the default cap', () => {
    const off = readConversationSettings({ max_call_duration_enabled: false, max_call_duration_minutes: 90 })
    expect(off.max_call_duration_minutes).toBe(DEFAULT_CONVERSATION_SETTINGS.max_call_duration_minutes)
    const on = readConversationSettings({ max_call_duration_enabled: true, max_call_duration_minutes: 90 })
    expect(on.max_call_duration_minutes).toBe(90)
  })

  it('drops the legacy keys from the result', () => {
    const out = readConversationSettings({
      auto_end_call: true,
      auto_end_silence_seconds: 30,
      max_call_duration_enabled: true,
      max_call_duration_minutes: 20,
      record_calls: true,
    }) as unknown as Record<string, unknown>
    for (const legacy of ['auto_end_call', 'auto_end_silence_seconds', 'max_call_duration_enabled', 'record_calls']) {
      expect(out, legacy).not.toHaveProperty(legacy)
    }
    expect(out).toEqual({ ...DEFAULT_CONVERSATION_SETTINGS, silence_end_call_seconds: 30, max_call_duration_minutes: 20 })
  })

  it('does not mutate the stored object', () => {
    const raw = { auto_end_call: true, auto_end_silence_seconds: 30 }
    readConversationSettings(raw)
    expect(raw).toEqual({ auto_end_call: true, auto_end_silence_seconds: 30 })
  })

  it('resets only the invalid fields and keeps the valid ones', () => {
    const out = readConversationSettings({
      allow_interruptions: false,
      turn_timeout_seconds: 99, // invalid (max 30)
      turn_eagerness: 'eager',
      max_call_duration_minutes: 'long', // invalid
      voicemail_message: 'Please call us back.',
    })
    expect(out).toEqual({
      ...DEFAULT_CONVERSATION_SETTINGS,
      allow_interruptions: false,
      turn_eagerness: 'eager',
      voicemail_message: 'Please call us back.',
    })
  })

  it('strips unknown keys whether or not another field is invalid', () => {
    const valid = readConversationSettings({ turn_timeout_seconds: 9, foo: 'bar' }) as unknown as Record<string, unknown>
    expect(valid).not.toHaveProperty('foo')
    const partial = readConversationSettings({ turn_timeout_seconds: 99, foo: 'bar' }) as unknown as Record<string, unknown>
    expect(partial).not.toHaveProperty('foo')
    expect(partial).toEqual(DEFAULT_CONVERSATION_SETTINGS)
  })

  it('forces ai_disclosure back on when stored as false', () => {
    const out = readConversationSettings({ ai_disclosure: false, allow_end_call: false })
    expect(out.ai_disclosure).toBe(true)
    expect(out.allow_end_call).toBe(false)
  })
})

describe('readPrivacySettings (lenient)', () => {
  it('defaults when nothing is stored', () => {
    expect(readPrivacySettings(null)).toEqual(DEFAULT_PRIVACY_SETTINGS)
  })

  it('uses the legacy record_calls flag when record_audio is not stored', () => {
    expect(readPrivacySettings(null, false)).toEqual({ ...DEFAULT_PRIVACY_SETTINGS, record_audio: false })
    expect(readPrivacySettings({ retention_days: 30 }, false)).toEqual({ record_audio: false, retention_days: 30 })
  })

  it('an explicit record_audio wins over the legacy flag', () => {
    expect(readPrivacySettings({ record_audio: true, retention_days: 30 }, false).record_audio).toBe(true)
    expect(readPrivacySettings({ record_audio: false }, true).record_audio).toBe(false)
  })

  it('ignores a non-boolean legacy flag', () => {
    expect(readPrivacySettings(null, 'no')).toEqual(DEFAULT_PRIVACY_SETTINGS)
    expect(readPrivacySettings(null, 0)).toEqual(DEFAULT_PRIVACY_SETTINGS)
  })

  it('resets an invalid retention while keeping record_audio', () => {
    expect(readPrivacySettings({ record_audio: false, retention_days: 99999 })).toEqual({ record_audio: false, retention_days: 365 })
  })
})

describe('other lenient readers', () => {
  it('readTransferSettings never yields an enabled transfer without a number', () => {
    const out = readTransferSettings({ enabled: true, number: null, label: 'Desk' })
    expect(out).toEqual({ ...DEFAULT_TRANSFER_SETTINGS, label: 'Desk' })
    expect(TransferSettingsSchema.safeParse(out).success).toBe(true)
  })

  // Postgres jsonb returns keys ordered by length (label, number, enabled,
  // condition); API input keeps insertion order. Both must give the same result.
  it.each([
    ['jsonb order', { label: 'x'.repeat(200), number: '+40712345678', enabled: true, condition: null }],
    ['insertion order', { enabled: true, number: '+40712345678', condition: null, label: 'x'.repeat(200) }],
  ])('readTransferSettings keeps a valid enabled+number pair when an unrelated field is invalid (%s)', (_label, raw) => {
    expect(readTransferSettings(raw)).toEqual({ enabled: true, number: '+40712345678', condition: null, label: null })
  })

  it('readTransferSettings drops an invalid number and therefore disables the transfer', () => {
    expect(readTransferSettings({ enabled: true, number: '0712345678', label: 'Desk' })).toEqual({ ...DEFAULT_TRANSFER_SETTINGS, label: 'Desk' })
  })

  // The over-long message is the only invalid field; the gate must stay
  // enabled in forward mode whatever order the keys arrive in. Postgres jsonb
  // returns them as mode, enabled, message, forward_number (by key length).
  it.each([
    ['jsonb order', { mode: 'forward', enabled: true, message: 'x'.repeat(600), forward_number: '+40712345678' }],
    ['insertion order', { enabled: true, mode: 'forward', forward_number: '+40712345678', message: 'x'.repeat(600) }],
  ])('readAfterHours keeps a valid forward configuration when an unrelated field is invalid (%s)', (_label, raw) => {
    expect(readAfterHours(raw)).toEqual({ enabled: true, mode: 'forward', message: null, forward_number: '+40712345678' })
  })

  it('readAfterHours defaults when nothing is stored', () => {
    expect(readAfterHours(null)).toEqual(DEFAULT_AFTER_HOURS)
  })

  it('readAnalysisSettings falls back to defaults on invalid input', () => {
    expect(readAnalysisSettings(null)).toEqual(DEFAULT_ANALYSIS_SETTINGS)
    expect(readAnalysisSettings({ success_criteria: 'nope' })).toEqual(DEFAULT_ANALYSIS_SETTINGS)
    const valid = { success_criteria: [], data_collection: [{ id: 'city', type: 'string' as const, description: 'City' }] }
    expect(readAnalysisSettings(valid)).toEqual(valid)
  })

  it('readVoiceTuning keeps valid values and nulls out invalid ones', () => {
    expect(readVoiceTuning({ stability: 0.4, similarity_boost: 7, speed: 1.1 })).toEqual({ stability: 0.4, similarity_boost: null, speed: 1.1 })
  })

  it('readWorkingHours / readDynamicVariables return empty on invalid input', () => {
    expect(readWorkingHours({ monday: { start: 'x', end: '18:00', enabled: true } })).toEqual({})
    expect(readWorkingHours(null)).toEqual({})
    expect(readDynamicVariables({ ntv_call_id: 'x' })).toEqual({})
    expect(readDynamicVariables({ city: 'Cluj' })).toEqual({ city: 'Cluj' })
  })
})

import { describe, expect, it } from 'vitest'
import { forbiddenVariablesIn, hasNoPlatformVariables, isPlatformOnlyVariable, stripPlatformVariables } from './template-variables'
import { AfterHoursSchema, ConversationSettingsSchema, DynamicVariablesSchema, TransferSettingsSchema, readDynamicVariables, readTransferSettings } from './settings'
import { DEFAULT_CONVERSATION_SETTINGS } from './types'

describe('platform-only variables', () => {
  it('reserves ntv_*, secret__* and system__* except the allow-list (case-insensitive)', () => {
    for (const v of ['ntv_call_token', 'NTV_CALL_ID', 'secret__ntv_call_token', 'system__conversation_id', 'system__call_sid', 'system__conversation_history', 'system__agent_id']) {
      expect(isPlatformOnlyVariable(v), v).toBe(true)
    }
    for (const v of ['system__caller_id', 'system__time', 'system__timezone', 'business_name', 'after_hours', 'clinic_city']) {
      expect(isPlatformOnlyVariable(v), v).toBe(false)
    }
  })

  it('finds references with spaces and references formed by removing another one', () => {
    expect(forbiddenVariablesIn('Say {{ ntv_call_token }} now')).toEqual(['ntv_call_token'])
    // Conservative: whatever could become a platform reference once another one is substituted away.
    expect(forbiddenVariablesIn('{{ {{x}}ntv_call_token}}')).toEqual(['ntv_call_token'])
    expect(forbiddenVariablesIn('{{{{x}}ntv_call_token}}')).toEqual(['ntv_call_token'])
    expect(forbiddenVariablesIn('Hello {{business_name}} at {{system__time}}')).toEqual([])
    expect(forbiddenVariablesIn(null)).toEqual([])
  })

  it('strips only platform-only references, repeatedly, and keeps the rest', () => {
    expect(stripPlatformVariables('Token {{ntv_call_token}} for {{business_name}}')).toBe('Token  for {{business_name}}')
    expect(stripPlatformVariables('{{{{ntv_call_id}}secret__ntv_call_token}}')).toBe('')
    expect(stripPlatformVariables(null)).toBeNull()
    expect(hasNoPlatformVariables(stripPlatformVariables('a {{ntv_x}} {{secret__y}} {{system__call_sid}} b'))).toBe(true)
  })
})

describe('tenant text schemas reject platform variables with a clear message', () => {
  it('voicemail message, transfer texts, after-hours message and variable values', () => {
    const conv = ConversationSettingsSchema.safeParse({ ...DEFAULT_CONVERSATION_SETTINGS, voicemail_message: 'Call {{ntv_call_id}}' })
    expect(conv.success).toBe(false)
    expect(conv.error?.issues[0].message).toMatch(/Platform variables/)
    expect(TransferSettingsSchema.safeParse({ enabled: false, number: null, condition: null, label: '{{secret__x}}' }).success).toBe(false)
    expect(AfterHoursSchema.safeParse({ enabled: true, mode: 'message', message: 'Closed {{system__conversation_id}}' }).success).toBe(false)
    expect(DynamicVariablesSchema.safeParse({ city: 'Cluj {{ntv_call_token}}' }).success).toBe(false)
    expect(DynamicVariablesSchema.safeParse({ city: 'Cluj, {{system__time}}' }).success).toBe(true)
  })

  it('stored values with platform variables are dropped field by field, not the whole object', () => {
    expect(readDynamicVariables({ city: 'Cluj', bad: '{{ntv_call_token}}' })).toEqual({ city: 'Cluj' })
    expect(readTransferSettings({ enabled: true, number: '+40712345678', condition: '{{ntv_call_id}}', label: 'Desk' })).toEqual({
      enabled: true,
      number: '+40712345678',
      condition: null,
      label: 'Desk',
    })
  })
})

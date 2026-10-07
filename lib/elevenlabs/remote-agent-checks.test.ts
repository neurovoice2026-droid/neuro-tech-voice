import { describe, expect, it } from 'vitest'
import { inspectRemoteAgent, staleKeyCount } from './remote-agent-checks'

const sent = {
  conversation_config: { agent: { dynamic_variables: { dynamic_variable_placeholders: { ntv_call_id: 'unknown', city: 'Cluj' } } }, language_presets: { en: {} } },
  platform_settings: { data_collection: { caller_name: {}, outcome: {} } },
}

describe('inspectRemoteAgent', () => {
  it('reports nothing for a remote agent equal to what we sent (analysis_items absent or null)', () => {
    const r = inspectRemoteAgent(sent, { conversation_config: sent.conversation_config, platform_settings: { ...sent.platform_settings, analysis_items: null } })
    expect(r.analysisItemsMigrated).toBe(false)
    expect(staleKeyCount(r.staleKeys)).toBe(0)
    expect(inspectRemoteAgent(sent, null).analysisItemsMigrated).toBe(false)
  })

  it('flags migrated analysis items, even an empty migrated set', () => {
    expect(inspectRemoteAgent(sent, { conversation_config: {}, platform_settings: { analysis_items: {} } }).analysisItemsMigrated).toBe(true)
  })

  it('lists remote keys we did not send (capped at 10 per map)', () => {
    const many = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`old_${i}`, {}]))
    const r = inspectRemoteAgent(sent, {
      conversation_config: { agent: { dynamic_variables: { dynamic_variable_placeholders: { ntv_call_id: 'unknown', city: 'Cluj', gone: 'x' } } }, language_presets: { en: {}, de: {} } },
      platform_settings: { data_collection: { caller_name: {}, outcome: {}, ...many } },
    })
    expect(r.staleKeys.dynamic_variable_placeholders).toEqual(['gone'])
    expect(r.staleKeys.language_presets).toEqual(['de'])
    expect(r.staleKeys.data_collection).toHaveLength(10)
    expect(staleKeyCount(r.staleKeys)).toBe(12)
  })
})

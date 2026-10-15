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

  it('reports the shape of analysis_items but flags only attached user items as migrated', () => {
    const read = (analysis_items: unknown) => inspectRemoteAgent(sent, { conversation_config: {}, platform_settings: { analysis_items } })
    // Empty sets and the built-in system evaluations: the legacy fields are still what gets evaluated.
    expect(read({})).toMatchObject({ analysisItemsMigrated: false, analysisItems: { keys: [], evaluation_criteria: 0, data_collection: 0, user_items: 0 } })
    expect(read({ evaluation_criteria: [], data_collection: [] }).analysisItemsMigrated).toBe(false)
    const system = read({ evaluation_criteria: [{ source: 'system', analysis_item_id: '__system_eval_criteria_sentiment' }], data_collection: [] })
    expect(system).toMatchObject({ analysisItemsMigrated: false, analysisItems: { keys: ['evaluation_criteria', 'data_collection'], evaluation_criteria: 1, user_items: 0 } })
    // An operator attached user items: these replace our criteria and fields.
    const user = read({ evaluation_criteria: [{ source: 'system', analysis_item_id: '__system_eval_criteria_sentiment' }], data_collection: [{ source: 'user', analysis_item_id: 'item_1' }] })
    expect(user).toMatchObject({ analysisItemsMigrated: true, analysisItems: { evaluation_criteria: 1, data_collection: 1, user_items: 1 } })
    // Counts only: item ids never reach the details.
    expect(JSON.stringify(user.analysisItems)).not.toContain('item_1')
    // An item without a source is not assumed to be built-in.
    expect(read({ data_collection: [{ analysis_item_id: 'x' }] }).analysisItemsMigrated).toBe(true)
    expect(inspectRemoteAgent(sent, null).analysisItems).toBeNull()
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

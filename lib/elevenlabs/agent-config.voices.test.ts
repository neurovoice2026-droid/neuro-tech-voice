import { describe, expect, it } from 'vitest'
import { buildElevenLabsAgentBody, configHash } from './agent-config'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'
import type { AgentSpec } from '@/lib/voice-providers/types'

// Slice F: tts.voice_id default for new agents and pronunciation locators.

const PLATFORM = { transferToolId: null, postCallWebhookId: null }
const tts = (overrides: Partial<AgentSpec>) =>
  buildElevenLabsAgentBody(makeAgentSpec(overrides), PLATFORM).conversation_config.tts as Record<string, unknown>

describe('agent body: voice default and pronunciation dictionary', () => {
  it('uses the chosen voice, else the curated default of a new agent, else omits voice_id', () => {
    expect(tts({ voiceId: 'Chosen00000000000001', defaultVoiceId: 'Curated0000000000001' }).voice_id).toBe('Chosen00000000000001')
    expect(tts({ voiceId: null, defaultVoiceId: 'Curated0000000000001' }).voice_id).toBe('Curated0000000000001')
    expect(tts({ voiceId: null, defaultVoiceId: null })).not.toHaveProperty('voice_id')
    expect(tts({ voiceId: null })).not.toHaveProperty('voice_id')
  })

  it('always sends the locator array: the org version, or [] to remove a dictionary', () => {
    expect(tts({ pronunciationLocator: { dictionaryId: 'dict_abc123', versionId: 'ver_xyz789' } }).pronunciation_dictionary_locators).toEqual([
      { pronunciation_dictionary_id: 'dict_abc123', version_id: 'ver_xyz789' },
    ])
    expect(tts({ pronunciationLocator: null }).pronunciation_dictionary_locators).toEqual([])
    expect(tts({}).pronunciation_dictionary_locators).toEqual([])
  })

  it('a new dictionary version changes the config hash (the agent gets re-pushed)', async () => {
    const a = await configHash(buildElevenLabsAgentBody(makeAgentSpec({ pronunciationLocator: { dictionaryId: 'dict_abc123', versionId: 'v1aaaa' } }), PLATFORM))
    const b = await configHash(buildElevenLabsAgentBody(makeAgentSpec({ pronunciationLocator: { dictionaryId: 'dict_abc123', versionId: 'v2bbbb' } }), PLATFORM))
    expect(a).not.toBe(b)
  })
})

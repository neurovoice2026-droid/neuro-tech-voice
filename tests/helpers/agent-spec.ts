// Complete AgentSpec fixture for the provider config builders. Every field of
// AgentSpec is set explicitly so a new field in the type breaks the build here
// instead of silently being undefined in the builder tests.

import type { AgentSpec } from '@/lib/voice-providers/types'

export function makeAgentSpec(overrides: Partial<AgentSpec> = {}): AgentSpec {
  const base: AgentSpec = {
    localAgentId: '11111111-2222-4333-8444-555555555555',
    orgId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    orgName: 'Smile Clinic',
    name: 'Smile Clinic Receptionist',
    language: 'en',
    systemPrompt: 'EL SYSTEM PROMPT with {{after_hours}}',
    fallbackSystemPrompt: 'CARTESIA FALLBACK PROMPT (get_call_context)',
    knowledgeAppendix: '',
    firstMessage: 'Hello, thanks for calling Smile Clinic. How can I help?',
    voiceId: 'el-voice-123',
    voiceTuning: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
    fallbackVoiceId: 'cartesia-voice-456',
    timezone: 'Europe/Bucharest',
    conversation: {
      allow_interruptions: true,
      turn_timeout_seconds: 7,
      silence_end_call_seconds: 20,
      max_call_duration_minutes: 15,
      turn_eagerness: 'normal',
      allow_end_call: true,
      voicemail_detection: false,
      voicemail_message: null,
      recording_notice: false,
      ai_disclosure: true,
      temperature: null,
    },
    transfer: { enabled: false, number: null, condition: null, label: null },
    analysis: {
      success_criteria: [{ id: 'caller_helped', name: 'Caller helped', prompt: 'The caller got what they needed.' }],
      data_collection: [
        { id: 'caller_name', type: 'string', description: "The caller's name." },
        { id: 'wants_callback', type: 'boolean', description: 'Whether the caller wants a callback.' },
      ],
    },
    privacy: { record_audio: true, retention_days: 365 },
    knowledge: [],
    dynamicVariables: {},
    appRouted: true,
    revision: 3,
  }
  return { ...base, ...overrides }
}

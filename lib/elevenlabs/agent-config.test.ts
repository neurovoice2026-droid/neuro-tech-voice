import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agentTags,
  buildElevenLabsAgentBody,
  configHash,
  dynamicVariablePlaceholders,
  versionDescription,
  withRetroactivePrivacy,
  withoutPiiRedaction,
  PLATFORM_AGENT_CONFIG_VERSION,
  type PlatformResources,
} from './agent-config'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'
import type { AgentSpec } from '@/lib/voice-providers/types'

/** Reads a nested value by dotted path ("conversation_config.agent.prompt.llm"). */
function at(value: unknown, path: string): unknown {
  let cur: unknown = value
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

const PLATFORM: PlatformResources = { transferToolId: 'tool_transfer_1', postCallWebhookId: 'wh_postcall_1' }
const NO_PLATFORM: PlatformResources = { transferToolId: null, postCallWebhookId: null }
const TRANSFER_ON: AgentSpec['transfer'] = { enabled: true, number: '+40712345678', condition: 'Caller asks for billing', label: 'Billing' }

function build(overrides: Partial<AgentSpec> = {}, platform: PlatformResources = PLATFORM) {
  return buildElevenLabsAgentBody(makeAgentSpec(overrides), platform)
}

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', '')
  vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', '')
  vi.stubEnv('ELEVENLABS_LLM', '')
  vi.stubEnv('ELEVENLABS_ENABLE_GUARDRAILS', '')
  vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', '')
  for (const k of ['ELEVENLABS_PII_REDACTION', 'ELEVENLABS_CONTENT_GUARDRAILS', 'ELEVENLABS_GUARDRAIL_FOCUS', 'ELEVENLABS_GUARDRAIL_PROMPT_INJECTION', 'ELEVENLABS_TRUST_CONTEXT', 'ELEVENLABS_BACKUP_LLM', 'ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS']) {
    vi.stubEnv(k, '')
  }
})

describe('agentTags', () => {
  it('tags the agent with org, local agent and environment', () => {
    const spec = makeAgentSpec()
    expect(agentTags(spec)).toEqual(['ntv', `ntv-org:${spec.orgId}`, `ntv-agent:${spec.localAgentId}`, 'ntv-env:preview'])
  })

  it('falls back to NODE_ENV when VERCEL_ENV is not set, capped at 20 chars', () => {
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('NODE_ENV', 'production')
    expect(agentTags(makeAgentSpec()).at(-1)).toBe('ntv-env:production')
    vi.stubEnv('VERCEL_ENV', 'x'.repeat(40))
    expect(agentTags(makeAgentSpec()).at(-1)).toBe(`ntv-env:${'x'.repeat(20)}`)
  })

  it('is what the body carries', () => {
    const spec = makeAgentSpec()
    expect(buildElevenLabsAgentBody(spec, PLATFORM).tags).toEqual(agentTags(spec))
  })
})

describe('buildElevenLabsAgentBody', () => {
  it('carries the name (capped), first message, language, prompt and timezone', () => {
    const body = build({ name: 'N'.repeat(150), language: 'ro' })
    expect(body.name).toBe('N'.repeat(100))
    expect(at(body, 'conversation_config.agent.first_message')).toBe('Hello, thanks for calling Smile Clinic. How can I help?')
    expect(at(body, 'conversation_config.agent.language')).toBe('ro')
    expect(at(body, 'conversation_config.agent.prompt.prompt')).toBe('EL SYSTEM PROMPT with {{after_hours}}')
    expect(at(body, 'conversation_config.agent.prompt.timezone')).toBe('Europe/Bucharest')
    expect(at(body, 'conversation_config.agent.prompt.llm')).toBe('gpt-5.4-mini')
    expect(at(body, 'platform_settings.summary_language')).toBe('ro')
  })

  describe('telephony audio format', () => {
    it('uses μ-law 8 kHz in and out for app-routed calls (Twilio media streams)', () => {
      const body = build({ appRouted: true })
      expect(at(body, 'conversation_config.asr.user_input_audio_format')).toBe('ulaw_8000')
      expect(at(body, 'conversation_config.tts.agent_output_audio_format')).toBe('ulaw_8000')
    })

    it('uses PCM 16 kHz for native numbers', () => {
      const body = build({ appRouted: false })
      expect(at(body, 'conversation_config.asr.user_input_audio_format')).toBe('pcm_16000')
      expect(at(body, 'conversation_config.tts.agent_output_audio_format')).toBe('pcm_16000')
    })
  })

  describe('human transfer', () => {
    it('native numbers: built-in transfer_to_number with the configured destination, no webhook tool', () => {
      const body = build({ appRouted: false, hasNativeNumbers: true, transfer: TRANSFER_ON })
      expect(at(body, 'conversation_config.agent.prompt.built_in_tools.transfer_to_number')).toEqual({
        type: 'system',
        name: 'transfer_to_number',
        description: '',
        // The agent always announces the transfer and cannot be cut off mid-hand-off.
        pre_tool_speech: 'force',
        interruption_mode: 'disable_during_tool',
        params: {
          system_tool_type: 'transfer_to_number',
          enable_client_message: true,
          transfers: [
            {
              transfer_destination: { type: 'phone', phone_number: '+40712345678' },
              condition: 'Caller asks for billing',
              transfer_type: 'conference',
            },
          ],
        },
      })
      expect(at(body, 'conversation_config.agent.prompt.tool_ids')).toEqual([])
    })

    it('native numbers: default condition when none is configured', () => {
      const body = build({ appRouted: false, hasNativeNumbers: true, transfer: { ...TRANSFER_ON, condition: '   ' } })
      const transfers = at(body, 'conversation_config.agent.prompt.built_in_tools.transfer_to_number.params.transfers') as Array<{ condition: string }>
      expect(transfers[0].condition).toBe('The caller asks to speak with a person.')
    })

    it('app-routed: uses the platform webhook tool via tool_ids, never the native transfer', () => {
      const body = build({ appRouted: true, transfer: TRANSFER_ON })
      expect(at(body, 'conversation_config.agent.prompt.tool_ids')).toEqual(['tool_transfer_1'])
      expect(at(body, 'conversation_config.agent.prompt.built_in_tools.transfer_to_number')).toBeNull()
    })

    it('app-routed without a provisioned transfer tool: no tool at all', () => {
      const body = build({ appRouted: true, transfer: TRANSFER_ON }, { ...PLATFORM, transferToolId: null })
      expect(at(body, 'conversation_config.agent.prompt.tool_ids')).toEqual([])
      expect(at(body, 'conversation_config.agent.prompt.built_in_tools.transfer_to_number')).toBeNull()
    })

    it('mixed routing (app-routed AND native numbers): both tools, the native one says when to use it', () => {
      const body = build({ appRouted: true, hasNativeNumbers: true, transfer: TRANSFER_ON })
      expect(at(body, 'conversation_config.agent.prompt.tool_ids')).toEqual(['tool_transfer_1'])
      const native = at(body, 'conversation_config.agent.prompt.built_in_tools.transfer_to_number') as { description: string; params: { transfers: unknown[] } }
      expect(native.params.transfers).toHaveLength(1)
      expect(native.description).toContain('ntv_routing_mode')
      expect(native.description).toContain('transfer_to_human')
      // The routing variable defaults to native for calls that bypass our router.
      expect(at(body, 'conversation_config.agent.dynamic_variables.dynamic_variable_placeholders.ntv_routing_mode')).toBe('native')
    })

    it('transfer disabled or missing number: no transfer in either mode', () => {
      for (const [appRouted, hasNativeNumbers] of [[true, false], [false, true], [true, true]] as const) {
        for (const transfer of [{ ...TRANSFER_ON, enabled: false }, { ...TRANSFER_ON, number: null }]) {
          const body = build({ appRouted, hasNativeNumbers, transfer })
          expect(at(body, 'conversation_config.agent.prompt.tool_ids')).toEqual([])
          expect(at(body, 'conversation_config.agent.prompt.built_in_tools.transfer_to_number')).toBeNull()
        }
      }
    })
  })

  describe('other built-in tools', () => {
    it('end_call follows allow_end_call', () => {
      expect(at(build(), 'conversation_config.agent.prompt.built_in_tools.end_call')).toEqual({
        type: 'system',
        name: 'end_call',
        description: '',
        params: { system_tool_type: 'end_call' },
      })
      const off = build({ conversation: { ...makeAgentSpec().conversation, allow_end_call: false } })
      expect(at(off, 'conversation_config.agent.prompt.built_in_tools.end_call')).toBeNull()
    })

    it('voicemail detection carries the message (or null when blank)', () => {
      const conv = makeAgentSpec().conversation
      const on = build({ conversation: { ...conv, voicemail_detection: true, voicemail_message: '  Please call back.  ' } })
      expect(at(on, 'conversation_config.agent.prompt.built_in_tools.voicemail_detection.params')).toEqual({
        system_tool_type: 'voicemail_detection',
        voicemail_message: 'Please call back.',
      })
      const blank = build({ conversation: { ...conv, voicemail_detection: true, voicemail_message: '  ' } })
      expect(at(blank, 'conversation_config.agent.prompt.built_in_tools.voicemail_detection.params.voicemail_message')).toBeNull()
      expect(at(build(), 'conversation_config.agent.prompt.built_in_tools.voicemail_detection')).toBeNull()
    })

    it('explicitly nulls every built-in tool we do not use (arrays/objects are replaced on update)', () => {
      const tools = at(build(), 'conversation_config.agent.prompt.built_in_tools') as Record<string, unknown>
      for (const key of ['language_detection', 'transfer_to_agent', 'play_keypad_touch_tone']) {
        expect(tools, key).toHaveProperty(key, null)
      }
      const conv = makeAgentSpec().conversation
      const off = at(build({ conversation: { ...conv, skip_turn: false } }), 'conversation_config.agent.prompt.built_in_tools') as Record<string, unknown>
      expect(off).toHaveProperty('skip_turn', null)
    })

    it('skip_turn is on by default with a positive wait (the end-call-after-silence timer pauses)', () => {
      expect(at(build(), 'conversation_config.agent.prompt.built_in_tools.skip_turn')).toEqual({
        type: 'system',
        name: 'skip_turn',
        description: '',
        params: { system_tool_type: 'skip_turn', wait_timeout_secs: 20 },
      })
    })

    it('voicemail detection is described as outbound-only', () => {
      const conv = makeAgentSpec().conversation
      const on = build({ conversation: { ...conv, voicemail_detection: true } })
      const description = at(on, 'conversation_config.agent.prompt.built_in_tools.voicemail_detection.description') as string
      expect(description).toMatch(/call you placed/)
      expect(description).toMatch(/Never use it on a call where the caller phoned the business/)
    })
  })

  describe('knowledge base', () => {
    const docs: AgentSpec['knowledge'] = [
      { name: 'Price list.pdf', type: 'file', elevenlabsId: 'kb_file_1', cartesiaId: 'c1' },
      { name: 'https://smile.example/faq', type: 'url', elevenlabsId: 'kb_url_2', cartesiaId: null },
      { name: 'Not uploaded yet', type: 'text', elevenlabsId: null, cartesiaId: 'c3' },
    ]

    it('lists only uploaded documents as {type,name,id,usage_mode} and enables RAG with the pinned retrieval limits', () => {
      const body = build({ knowledge: docs })
      expect(at(body, 'conversation_config.agent.prompt.knowledge_base')).toEqual([
        { type: 'file', name: 'Price list.pdf', id: 'kb_file_1', usage_mode: 'auto' },
        { type: 'url', name: 'https://smile.example/faq', id: 'kb_url_2', usage_mode: 'auto' },
      ])
      expect(at(body, 'conversation_config.agent.prompt.rag')).toEqual({
        enabled: true,
        embedding_model: 'e5_mistral_7b_instruct',
        max_documents_length: 12_000,
        max_retrieved_rag_chunks_count: 6,
        max_vector_distance: 0.6,
        num_candidates: null,
      })
    })

    it('maps usage_mode per document; folders (website imports) are always auto and always need RAG', () => {
      const body = build({
        knowledge: [
          { name: 'Hours', type: 'text', elevenlabsId: 'kb_t', cartesiaId: null, usageMode: 'prompt', sizeBytes: 900 },
          { name: 'Website: smile.example', type: 'folder', elevenlabsId: 'fold_1', cartesiaId: null, usageMode: 'prompt', sizeBytes: null },
        ],
      })
      expect(at(body, 'conversation_config.agent.prompt.knowledge_base')).toEqual([
        { type: 'text', name: 'Hours', id: 'kb_t', usage_mode: 'prompt' },
        { type: 'folder', name: 'Website: smile.example', id: 'fold_1', usage_mode: 'auto' },
      ])
      expect(at(body, 'conversation_config.agent.prompt.rag.enabled')).toBe(true)
    })

    it('disables RAG when every document is pinned to the prompt or too small to index (< 500 bytes)', () => {
      const small: AgentSpec['knowledge'] = [
        { name: 'Hours', type: 'text', elevenlabsId: 'kb_t', cartesiaId: null, usageMode: 'auto', sizeBytes: 120 },
        { name: 'Prices', type: 'text', elevenlabsId: 'kb_p', cartesiaId: null, usageMode: 'prompt', sizeBytes: 9_000 },
      ]
      expect(at(build({ knowledge: small }), 'conversation_config.agent.prompt.rag.enabled')).toBe(false)
      // Unknown size counts as large.
      const unknown: AgentSpec['knowledge'] = [{ name: 'Page', type: 'url', elevenlabsId: 'kb_u', cartesiaId: null, usageMode: 'auto', sizeBytes: null }]
      expect(at(build({ knowledge: unknown }), 'conversation_config.agent.prompt.rag.enabled')).toBe(true)
    })

    it('takes retrieval limits from env within the spec bounds; invalid values fall back', () => {
      vi.stubEnv('ELEVENLABS_RAG_MAX_DOCS_LENGTH', '20000')
      vi.stubEnv('ELEVENLABS_RAG_MAX_CHUNKS', '25')
      vi.stubEnv('ELEVENLABS_RAG_MAX_VECTOR_DISTANCE', '0.45')
      vi.stubEnv('ELEVENLABS_RAG_NUM_CANDIDATES', '200')
      expect(at(build({ knowledge: docs }), 'conversation_config.agent.prompt.rag')).toMatchObject({
        max_documents_length: 20_000,
        max_retrieved_rag_chunks_count: 6,
        max_vector_distance: 0.45,
        num_candidates: 200,
      })
      vi.stubEnv('ELEVENLABS_RAG_MAX_DOCS_LENGTH', '999999')
      vi.stubEnv('ELEVENLABS_RAG_MAX_VECTOR_DISTANCE', '1')
      vi.stubEnv('ELEVENLABS_RAG_NUM_CANDIDATES', '50')
      expect(at(build({ knowledge: docs }), 'conversation_config.agent.prompt.rag')).toMatchObject({
        max_documents_length: 12_000,
        max_vector_distance: 0.6,
        num_candidates: null,
      })
    })

    it('uses the multilingual embedding model for non-English agents', () => {
      expect(at(build({ knowledge: docs, language: 'ro' }), 'conversation_config.agent.prompt.rag.embedding_model')).toBe(
        'multilingual_e5_large_instruct',
      )
    })

    it('caps document names at 200 chars', () => {
      const body = build({ knowledge: [{ name: 'd'.repeat(300), type: 'text', elevenlabsId: 'kb1', cartesiaId: null }] })
      const kb = at(body, 'conversation_config.agent.prompt.knowledge_base') as Array<{ name: string }>
      expect(kb[0].name).toHaveLength(200)
    })

    it('sends an empty list and disables RAG when no document is uploaded', () => {
      for (const knowledge of [[], [docs[2]]]) {
        const body = build({ knowledge })
        expect(at(body, 'conversation_config.agent.prompt.knowledge_base')).toEqual([])
        expect(at(body, 'conversation_config.agent.prompt.rag.enabled')).toBe(false)
      }
    })
  })

  describe('TTS', () => {
    it('picks the model per language and never the deprecated eleven_turbo_v2_5', () => {
      expect(at(build({ language: 'en' }), 'conversation_config.tts.model_id')).toBe('eleven_flash_v2')
      expect(at(build({ language: 'ro' }), 'conversation_config.tts.model_id')).toBe('eleven_flash_v2_5')
      vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_turbo_v2_5')
      expect(at(build({ language: 'ro' }), 'conversation_config.tts.model_id')).toBe('eleven_flash_v2_5')
      expect(JSON.stringify(build({ language: 'ro' }))).not.toContain('eleven_turbo_v2_5')
    })

    it('sets the voice and clamps the tuning', () => {
      const body = build({ voiceTuning: { stability: 1.4, similarity_boost: -0.2, speed: 2 } })
      expect(at(body, 'conversation_config.tts')).toEqual({
        model_id: 'eleven_flash_v2',
        agent_output_audio_format: 'ulaw_8000',
        expressive_mode: false,
        text_normalisation_type: 'elevenlabs',
        voice_id: 'el-voice-123',
        stability: 1,
        similarity_boost: 0,
        speed: 1.2,
        pronunciation_dictionary_locators: [],
      })
      expect(at(build({ voiceTuning: { stability: null, similarity_boost: null, speed: 0.5 } }), 'conversation_config.tts.speed')).toBe(0.7)
    })

    it('sends the spec defaults for "default" tuning so an earlier value cannot persist; omits an unset voice', () => {
      const tts = at(build({ voiceId: null, voiceTuning: { stability: null, similarity_boost: null, speed: null } }), 'conversation_config.tts')
      expect(tts).toEqual({
        model_id: 'eleven_flash_v2',
        agent_output_audio_format: 'ulaw_8000',
        expressive_mode: false,
        text_normalisation_type: 'elevenlabs',
        stability: 0.5,
        similarity_boost: 0.8,
        speed: 1,
        pronunciation_dictionary_locators: [],
      })
    })

    it('enables expressive mode only for v3/v4 models (never forced off for them)', () => {
      vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_v3_conversational')
      expect(at(build({ language: 'ro' }), 'conversation_config.tts.expressive_mode')).toBe(true)
      vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_v4_turbo')
      expect(at(build({ language: 'ro' }), 'conversation_config.tts.expressive_mode')).toBe(true)
      expect(at(build({ language: 'en' }), 'conversation_config.tts.expressive_mode')).toBe(false)
    })

    it('uses the ElevenLabs text normaliser by default, env-switchable to system_prompt', () => {
      expect(at(build(), 'conversation_config.tts.text_normalisation_type')).toBe('elevenlabs')
      vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', 'system_prompt')
      expect(at(build(), 'conversation_config.tts.text_normalisation_type')).toBe('system_prompt')
      vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', 'bogus')
      expect(at(build(), 'conversation_config.tts.text_normalisation_type')).toBe('elevenlabs')
    })
  })

  describe('conversation and turn settings', () => {
    it('maps and clamps durations and timeouts', () => {
      const conv = makeAgentSpec().conversation
      const body = build({ conversation: { ...conv, turn_timeout_seconds: 99, silence_end_call_seconds: 2, max_call_duration_minutes: 500, turn_eagerness: 'patient' } })
      expect(at(body, 'conversation_config.turn')).toMatchObject({ mode: 'turn', turn_timeout: 30, silence_end_call_timeout: 5, turn_eagerness: 'patient' })
      expect(at(body, 'conversation_config.conversation.max_duration_seconds')).toBe(7200)
      expect(at(build(), 'conversation_config.conversation.max_duration_seconds')).toBe(900)
    })

    it('uses -1 to disable the silence end-call timeout', () => {
      const conv = makeAgentSpec().conversation
      expect(at(build({ conversation: { ...conv, silence_end_call_seconds: null } }), 'conversation_config.turn.silence_end_call_timeout')).toBe(-1)
    })

    it('enables interruption events only when barge-in is allowed', () => {
      const conv = makeAgentSpec().conversation
      expect(at(build(), 'conversation_config.conversation.client_events')).toEqual(['audio', 'interruption'])
      expect(at(build({ conversation: { ...conv, allow_interruptions: false } }), 'conversation_config.conversation.client_events')).toEqual(['audio'])
    })

    it('always sends temperature: 0 (spec default, never null) when unset, clamped to 0..1 otherwise', () => {
      const conv = makeAgentSpec().conversation
      expect(at(build(), 'conversation_config.agent.prompt.temperature')).toBe(0)
      expect(at(build({ conversation: { ...conv, temperature: 0.3 } }), 'conversation_config.agent.prompt.temperature')).toBe(0.3)
      expect(at(build({ conversation: { ...conv, temperature: 3 } }), 'conversation_config.agent.prompt.temperature')).toBe(1)
    })

    it('boosts recognition of the business name', () => {
      expect(at(build(), 'conversation_config.asr.keywords')).toEqual(['Smile Clinic'])
      expect(at(build({ orgName: null }), 'conversation_config.asr.keywords')).toEqual([])
    })
  })

  describe('dynamic variables', () => {
    it('includes customer variables and the platform placeholders', () => {
      const body = build({ dynamicVariables: { clinic_city: 'Cluj' } })
      expect(at(body, 'conversation_config.agent.dynamic_variables.dynamic_variable_placeholders')).toEqual({
        clinic_city: 'Cluj',
        ntv_call_id: 'unknown',
        ntv_call_token: 'none',
        secret__ntv_call_token: 'none',
        after_hours: 'false',
        business_name: 'Smile Clinic',
        ntv_call_direction: 'inbound',
        ntv_routing_mode: 'native',
      })
    })

    it('has a placeholder for every platform variable (one source of truth, no duplicates)', async () => {
      const { PLATFORM_VARIABLES } = await import('@/lib/voice-providers/prompt')
      const vars = dynamicVariablePlaceholders(makeAgentSpec())
      for (const name of Object.values(PLATFORM_VARIABLES)) expect(typeof vars[name]).toBe('string')
    })

    it('after_hours is "unknown" when opening hours are in the prompt (native calls decide from them)', () => {
      const vars = dynamicVariablePlaceholders(makeAgentSpec({ openingHours: 'Monday 09:00-17:00; Tuesday closed.' }))
      expect(vars.after_hours).toBe('unknown')
    })

    it('platform placeholders win over customer values with the same name', () => {
      const vars = dynamicVariablePlaceholders(makeAgentSpec({ dynamicVariables: { ntv_call_id: 'spoofed', after_hours: 'true' }, orgName: null }))
      expect(vars.ntv_call_id).toBe('unknown')
      expect(vars.after_hours).toBe('false')
      const spoof = dynamicVariablePlaceholders(makeAgentSpec({ dynamicVariables: { secret__ntv_call_token: 'x', ntv_routing_mode: 'app_routed' } }))
      expect(spoof.secret__ntv_call_token).toBe('none')
      expect(spoof.ntv_routing_mode).toBe('native')
      expect(vars.business_name).toBe('')
    })
  })

  describe('platform settings', () => {
    it('subscribes the post-call webhook to transcript and initiation-failure events (no audio)', () => {
      expect(at(build(), 'platform_settings.workspace_overrides')).toEqual({
        webhooks: { post_call_webhook_id: 'wh_postcall_1', events: ['transcript', 'call_initiation_failure'], transcript_format: 'json' },
      })
      expect(at(build({}, NO_PLATFORM), 'platform_settings')).not.toHaveProperty('workspace_overrides')
    })

    it('maps analysis settings to evaluation criteria and data collection', () => {
      const body = build()
      expect(at(body, 'platform_settings.evaluation')).toEqual({
        criteria: [{ id: 'caller_helped', name: 'Caller helped', type: 'prompt', conversation_goal_prompt: 'The caller got what they needed.' }],
      })
      expect(at(body, 'platform_settings.data_collection')).toEqual({
        caller_name: { type: 'string', description: "The caller's name." },
        wants_callback: { type: 'boolean', description: 'Whether the caller wants a callback.' },
      })
    })

    it('caps criteria (30) and data-collection fields (25)', () => {
      const analysis: AgentSpec['analysis'] = {
        success_criteria: Array.from({ length: 35 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, prompt: 'p' })),
        data_collection: Array.from({ length: 30 }, (_, i) => ({ id: `f${i}`, type: 'string' as const, description: 'd' })),
      }
      const body = build({ analysis })
      expect((at(body, 'platform_settings.evaluation.criteria') as unknown[]).length).toBe(30)
      expect(Object.keys(at(body, 'platform_settings.data_collection') as object)).toHaveLength(25)
    })

    it('maps privacy settings', () => {
      expect(at(build({ privacy: { record_audio: false, retention_days: 30 } }), 'platform_settings.privacy')).toEqual({
        record_voice: false,
        retention_days: 30,
        delete_transcript_and_pii: false,
        delete_audio: false,
        apply_to_existing_conversations: false,
        zero_retention_mode: false,
        conversation_history_redaction: { enabled: true, entities: ['financial_id.payment_card'], excluded_data_collection_ids: [] },
      })
    })

    it('one-shot retroactive privacy and the redaction fallback leave the original body and hash untouched', async () => {
      const body = build()
      const hash = await configHash(body)
      const once = withRetroactivePrivacy(body)
      expect(at(once, 'platform_settings.privacy.apply_to_existing_conversations')).toBe(true)
      expect(at(body, 'platform_settings.privacy.apply_to_existing_conversations')).toBe(false)
      const noRedaction = withoutPiiRedaction(body)
      expect(at(noRedaction, 'platform_settings.privacy')).not.toHaveProperty('conversation_history_redaction')
      expect(at(body, 'platform_settings.privacy.conversation_history_redaction.enabled')).toBe(true)
      expect(await configHash(body)).toBe(hash)
    })

    it('PII redaction can be switched off by env (explicitly disabled, never omitted)', () => {
      vi.stubEnv('ELEVENLABS_PII_REDACTION', 'false')
      expect(at(build(), 'platform_settings.privacy.conversation_history_redaction')).toEqual({ enabled: false, entities: [], excluded_data_collection_ids: [] })
    })

    it('sends plan-based call limits and the queue for every routing mode', () => {
      expect(at(build({ callLimits: { concurrency: 4, daily: 500, bursting: true } }), 'platform_settings.call_limits')).toEqual({
        agent_concurrency_limit: 4,
        daily_limit: 500,
        bursting_enabled: true,
      })
      // Any app-routed number: fail fast so the router fails over to Cartesia.
      expect(at(build({ appRouted: true, hasNativeNumbers: true }), 'platform_settings.queueing_config')).toEqual({ enabled: false })
      // Native-only: no failover exists, a short queue instead.
      expect(at(build({ appRouted: false, hasNativeNumbers: true }), 'platform_settings.queueing_config')).toEqual({ enabled: true, wait_timeout_seconds: 30 })
    })

    it('pins the trust context and the backup LLM cascade', () => {
      const body = build()
      expect(at(body, 'platform_settings.trust_context')).toBe('unknown')
      expect(at(body, 'conversation_config.agent.prompt.backup_llm_config')).toEqual({ preference: 'default' })
      expect(at(body, 'conversation_config.agent.prompt.cascade_timeout_seconds')).toBe(4)
      vi.stubEnv('ELEVENLABS_TRUST_CONTEXT', 'low')
      vi.stubEnv('ELEVENLABS_BACKUP_LLM', 'disabled')
      vi.stubEnv('ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS', '3')
      const tuned = build()
      expect(at(tuned, 'platform_settings.trust_context')).toBe('low')
      expect(at(tuned, 'conversation_config.agent.prompt.backup_llm_config')).toEqual({ preference: 'disabled' })
      expect(at(tuned, 'conversation_config.agent.prompt.cascade_timeout_seconds')).toBe(3)
      vi.stubEnv('ELEVENLABS_TRUST_CONTEXT', 'high')
      expect(at(build(), 'platform_settings.trust_context')).toBe('unknown')
    })

    it('uses the validated LLM from the runtime options', () => {
      const body = buildElevenLabsAgentBody(makeAgentSpec(), PLATFORM, { llm: 'gemini-2.5-flash' })
      expect(at(body, 'conversation_config.agent.prompt.llm')).toBe('gemini-2.5-flash')
    })

    it('allows overriding only the first message, the maximum duration and text-only (no initiation webhook without native numbers)', () => {
      expect(at(build(), 'platform_settings.overrides')).toEqual({
        conversation_config_override: { agent: { first_message: true }, conversation: { max_duration_seconds: true, text_only: true } },
        enable_conversation_initiation_client_data_from_webhook: false,
      })
    })

    it('always sends a complete guardrails block: focus and prompt injection on by default, content off', () => {
      const g = at(build(), 'platform_settings.guardrails') as Record<string, unknown>
      expect(g.version).toBe('1')
      expect(g.focus).toEqual({ is_enabled: true })
      expect(g.prompt_injection).toEqual({ is_enabled: true })
      const content = g.content as { execution_mode: string; config: Record<string, { is_enabled: boolean }>; trigger_action: { type: string } }
      expect(content.execution_mode).toBe('streaming')
      expect(Object.keys(content.config)).toHaveLength(7)
      expect(Object.values(content.config).every((c) => c.is_enabled === false)).toBe(true)
      expect(content.trigger_action.type).toBe('retry')
      expect(g.custom).toEqual({ config: { configs: [] } })
    })

    it('switching guardrails off still sends them, explicitly disabled', () => {
      vi.stubEnv('ELEVENLABS_ENABLE_GUARDRAILS', 'false')
      vi.stubEnv('ELEVENLABS_CONTENT_GUARDRAILS', 'violence')
      const g = at(build(), 'platform_settings.guardrails') as Record<string, { is_enabled?: boolean; config?: Record<string, { is_enabled: boolean }> }>
      expect(g.focus).toEqual({ is_enabled: false })
      expect(g.prompt_injection).toEqual({ is_enabled: false })
      expect(g.content.config?.violence.is_enabled).toBe(false)
    })

    it('enables only the content categories named by env', () => {
      vi.stubEnv('ELEVENLABS_CONTENT_GUARDRAILS', 'violence, harassment,bogus')
      vi.stubEnv('ELEVENLABS_GUARDRAIL_FOCUS', 'false')
      const g = at(build(), 'platform_settings.guardrails') as { focus: unknown; content: { config: Record<string, { is_enabled: boolean }> } }
      expect(g.focus).toEqual({ is_enabled: false })
      expect(Object.entries(g.content.config).filter(([, v]) => v.is_enabled).map(([k]) => k).sort()).toEqual(['harassment', 'violence'])
    })
  })

  it('does not leak secrets or the Cartesia prompt into the ElevenLabs body', () => {
    const json = JSON.stringify(build({ transfer: TRANSFER_ON }))
    expect(json).not.toContain('CARTESIA FALLBACK PROMPT')
    expect(json).not.toContain('cartesia-voice-456')
  })
})

describe('platform webhook tools', () => {
  it('are no longer defined here (lib/elevenlabs/tools): the body only references their ids', async () => {
    const mod = await import('./agent-config')
    expect(mod).not.toHaveProperty('transferToolConfig')
    expect(JSON.stringify(build({ transfer: TRANSFER_ON }))).not.toContain('api_schema')
  })
})

describe('configHash', () => {
  it('is stable for equal bodies built independently', async () => {
    const a = await configHash(build({ knowledge: [{ name: 'a', type: 'text', elevenlabsId: 'kb1', cartesiaId: null }] }))
    const b = await configHash(build({ knowledge: [{ name: 'a', type: 'text', elevenlabsId: 'kb1', cartesiaId: null }] }))
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
  })

  it('changes when anything we push changes', async () => {
    const base = await configHash(build())
    expect(await configHash(build({ systemPrompt: 'changed' }))).not.toBe(base)
    expect(await configHash(build({ voiceId: 'other-voice' }))).not.toBe(base)
    expect(await configHash(build({ appRouted: false }))).not.toBe(base)
    expect(await configHash(build({}, NO_PLATFORM))).not.toBe(base)
  })

  it('ignores fields that are not part of the pushed body (e.g. revision, fallback prompt)', async () => {
    const base = await configHash(build())
    expect(await configHash(build({ revision: 99, fallbackSystemPrompt: 'other', fallbackVoiceId: 'x' }))).toBe(base)
  })
})

describe('config versioning', () => {
  it('version_description carries only the revision and the platform version', () => {
    expect(versionDescription(makeAgentSpec({ revision: 12 }))).toBe(`ntv r12 p${PLATFORM_AGENT_CONFIG_VERSION}`)
  })

  it('the hash ignores version_description but changes with plan limits, pause state and routing', async () => {
    const body = build()
    const base = await configHash(body)
    expect(await configHash({ ...body, version_description: 'ntv r1 p1' })).toBe(base)
    expect(await configHash(build({ callLimits: { concurrency: 6, daily: 500, bursting: true } }))).not.toBe(base)
    expect(await configHash(build({ active: false }))).not.toBe(base)
    expect(await configHash(build({ hasNativeNumbers: true, transfer: TRANSFER_ON }))).not.toBe(await configHash(build({ transfer: TRANSFER_ON })))
  })
})

describe('paused agent (native numbers bypass the router)', () => {
  const conversation = { ...makeAgentSpec().conversation, allow_end_call: false, voicemail_detection: true }

  it('says the localized unavailable line, holds no conversation and only keeps end_call', () => {
    const body = build({ active: false, language: 'ro', transfer: TRANSFER_ON, hasNativeNumbers: true, conversation })
    expect(at(body, 'conversation_config.agent.first_message')).toMatch(/Ne pare rău/)
    expect(at(body, 'conversation_config.agent.prompt.prompt')).toContain('end_call')
    expect(at(body, 'conversation_config.agent.prompt.prompt')).not.toContain('EL SYSTEM PROMPT')
    const tools = at(body, 'conversation_config.agent.prompt.built_in_tools') as Record<string, unknown>
    expect(tools.end_call).toMatchObject({ name: 'end_call' })
    for (const k of ['transfer_to_number', 'voicemail_detection', 'language_detection', 'skip_turn']) expect(tools[k]).toBeNull()
    expect(at(body, 'conversation_config.agent.prompt.tool_ids')).toEqual([])
    expect(at(body, 'conversation_config.language_presets')).toEqual({})
    expect(at(body, 'conversation_config.conversation.max_duration_seconds')).toBe(60)
    // Platform-owned settings stay as they are (privacy, limits, guardrails, webhooks).
    expect(at(body, 'platform_settings')).toEqual(at(build({ language: 'ro', transfer: TRANSFER_ON, hasNativeNumbers: true, conversation }), 'platform_settings'))
  })

  it('resuming restores the normal body', () => {
    expect(build({ active: true })).toEqual(build())
  })
})

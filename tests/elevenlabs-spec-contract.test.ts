// Spec contract: every key path, enum value and limit in the agent body we
// send must exist in the official ElevenLabs Create Agent schema, and nothing
// we send may be deprecated. The schema excerpt is extracted from the
// official OpenAPI document by scripts/extract-elevenlabs-agent-schema.mjs
// (tests/fixtures/elevenlabs-agent-schema.json); re-extract it when the spec
// changes and this test tells you which field drifted.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildElevenLabsAgentBody, type AgentRuntimeOptions, type PlatformResources } from '@/lib/elevenlabs/agent-config'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'
import type { AgentSpec } from '@/lib/voice-providers/types'
import { languagePresetGreetings } from '@/lib/voice-providers/language-presets'

type Schema = Record<string, unknown>
interface Fixture {
  root: string
  schemas: Record<string, Schema>
}

let fixture: Fixture

beforeAll(() => {
  // Parsed lazily: only this test needs the excerpt.
  const path = fileURLToPath(new URL('./fixtures/elevenlabs-agent-schema.json', import.meta.url))
  fixture = JSON.parse(readFileSync(path, 'utf8')) as Fixture
})

function resolveRef(schema: Schema): Schema {
  let s = schema
  for (let i = 0; i < 20 && typeof s.$ref === 'string'; i++) {
    const name = (s.$ref as string).split('/').pop() as string
    const target = fixture.schemas[name]
    if (!target) throw new Error(`fixture is missing schema ${name}: re-run scripts/extract-elevenlabs-agent-schema.mjs`)
    s = target
  }
  return s
}

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

function deprecatedEnumValues(schema: Schema): Set<unknown> {
  const fern = schema['x-fern-enum'] as Record<string, { deprecated?: boolean }> | undefined
  return new Set(Object.entries(fern ?? {}).filter(([, v]) => v?.deprecated).map(([k]) => k))
}

/** Minimal JSON-schema validator for the keywords the extracted excerpt keeps. Returns error strings. */
function validate(value: unknown, raw: Schema, path: string): string[] {
  const schema = resolveRef(raw)
  if (schema.deprecated === true) return [`${path}: deprecated in the spec`]

  const branches = (schema.anyOf ?? schema.oneOf) as Schema[] | undefined
  if (branches) {
    let best: string[] | null = null
    for (const branch of branches) {
      const errors = validate(value, branch, path)
      if (errors.length === 0) return []
      if (!best || errors.length < best.length) best = errors
    }
    return best ?? [`${path}: no schema branch`]
  }
  if (Array.isArray(schema.allOf)) return (schema.allOf as Schema[]).flatMap((s) => validate(value, s, path))

  const actual = typeOf(value)
  if ('const' in schema && value !== schema.const) return [`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`]
  const declared = schema.type as string | undefined
  if (declared) {
    const ok = declared === actual || (declared === 'number' && actual === 'integer')
    if (!ok) return [`${path}: expected ${declared}, got ${actual}`]
  }
  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).includes(value)) return [`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`]
  if (deprecatedEnumValues(schema).has(value)) return [`${path}: enum value ${JSON.stringify(value)} is deprecated`]

  const errors: string[] = []
  if (actual === 'string') {
    const s = value as string
    if (typeof schema.minLength === 'number' && s.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`)
    if (typeof schema.maxLength === 'number' && s.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`)
  }
  if (actual === 'number' || actual === 'integer') {
    const n = value as number
    if (typeof schema.minimum === 'number' && n < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`)
    if (typeof schema.maximum === 'number' && n > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`)
    if (typeof schema.exclusiveMinimum === 'number' && n <= schema.exclusiveMinimum) errors.push(`${path}: not above ${schema.exclusiveMinimum}`)
    if (typeof schema.exclusiveMaximum === 'number' && n >= schema.exclusiveMaximum) errors.push(`${path}: not below ${schema.exclusiveMaximum}`)
  }
  if (actual === 'array') {
    const arr = value as unknown[]
    if (typeof schema.maxItems === 'number' && arr.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`)
    if (typeof schema.minItems === 'number' && arr.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`)
    if (schema.items) arr.forEach((item, i) => errors.push(...validate(item, schema.items as Schema, `${path}[${i}]`)))
  }
  if (actual === 'object') {
    const obj = value as Record<string, unknown>
    const props = schema.properties as Record<string, Schema> | undefined
    const extra = schema.additionalProperties
    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in obj)) errors.push(`${path}.${key}: required by the spec but not sent`)
    }
    for (const [key, v] of Object.entries(obj)) {
      const childPath = `${path}.${key}`
      if (props && key in props) errors.push(...validate(v, props[key], childPath))
      else if (extra && typeof extra === 'object') errors.push(...validate(v, extra as Schema, childPath))
      else if (props || extra === false) errors.push(`${childPath}: not in the spec`)
      // A schema with neither properties nor additionalProperties is free-form.
    }
  }
  return errors
}

function bodyErrors(spec: AgentSpec, platform: PlatformResources, runtime: AgentRuntimeOptions = {}): string[] {
  const body = buildElevenLabsAgentBody(spec, platform, runtime)
  // The create call sends exactly these four keys (adapters.ts).
  const createBody = { name: body.name, tags: body.tags, conversation_config: body.conversation_config, platform_settings: body.platform_settings }
  return validate(createBody, fixture.schemas[fixture.root], 'body')
}

const FULL_PLATFORM: PlatformResources = { transferToolId: 'tool_transfer_1', postCallWebhookId: 'wh_postcall_1' }
const NO_PLATFORM: PlatformResources = { transferToolId: null, postCallWebhookId: null }

function withConversation(conv: Partial<AgentSpec['conversation']>, overrides: Partial<AgentSpec> = {}): AgentSpec {
  const base = makeAgentSpec(overrides)
  return { ...base, conversation: { ...base.conversation, ...conv } }
}

beforeEach(() => {
  for (const k of ['ELEVENLABS_TTS_MODEL_EN', 'ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'ELEVENLABS_LLM', 'ELEVENLABS_TEXT_NORMALISATION', 'ELEVENLABS_ENABLE_GUARDRAILS', 'ELEVENLABS_AGENT_AUTH', 'ELEVENLABS_CONTENT_GUARDRAILS', 'ELEVENLABS_CONTENT_GUARDRAIL_THRESHOLD', 'ELEVENLABS_PII_REDACTION', 'ELEVENLABS_TRUST_CONTEXT', 'ELEVENLABS_BACKUP_LLM', 'ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS']) {
    vi.stubEnv(k, '')
  }
})

describe('ElevenLabs agent body vs the official Create Agent schema', () => {
  it('the fixture is the Create Agent closure', () => {
    expect(fixture.root).toBe('Body_Create_Agent_v1_convai_agents_create_post')
    for (const name of ['ConversationalConfigAPIModel-Input', 'TurnConfig', 'SoftTimeoutConfig', 'TTSConversationalConfig-Input', 'LanguagePreset-Input', 'AnalysisProperty']) {
      expect(fixture.schemas, name).toHaveProperty(name)
    }
  })

  it('default English app-routed agent', () => {
    expect(bodyErrors(makeAgentSpec(), FULL_PLATFORM)).toEqual([])
  })

  it('Romanian native agent with every conversation feature on', () => {
    vi.stubEnv('ELEVENLABS_ENABLE_GUARDRAILS', 'true')
    const languages = ['en', 'de', 'hu']
    const spec = withConversation(
      {
        voicemail_detection: true,
        voicemail_message: 'Bună ziua, vă rugăm să ne sunați înapoi. {{business_name}}',
        recording_notice: true,
        temperature: 0.4,
        additional_languages: languages,
        asr_keywords: ['Dr. Ionescu', 'albire dentară', 'Str. Eminescu 12'],
        background_voice_detection: true,
        silence_end_call_seconds: null,
      },
      {
        language: 'ro',
        appRouted: false,
        hasNativeNumbers: true,
        openingHours: 'Monday 09:00-17:00; Sunday closed.',
        transfer: { enabled: true, number: '+40712345678', condition: 'Caller asks for billing', label: 'Billing' },
        knowledge: [{ name: 'Prețuri.pdf', type: 'file', elevenlabsId: 'kb_1', cartesiaId: null }],
        dynamicVariables: { clinic_city: 'Cluj' },
        voiceTuning: { stability: null, similarity_boost: null, speed: null },
        languagePresetGreetings: languagePresetGreetings({ languages: ['en', 'de'], tone: 'friendly', orgName: 'Smile Clinic', agentName: 'Ana', recordingNotice: true }),
        analysis: {
          success_criteria: [{ id: 'caller_helped', name: 'Caller helped', prompt: 'The caller got help.' }],
          data_collection: [
            { id: 'outcome', type: 'string', description: 'One of: booked, other.' },
            { id: 'wants_callback', type: 'boolean', description: 'Callback wanted.' },
            { id: 'party_size', type: 'integer', description: 'People.' },
          ],
        },
      },
    )
    const body = buildElevenLabsAgentBody(spec, FULL_PLATFORM, { reasoningEffort: 'minimal' })
    expect(Object.keys(body.conversation_config.language_presets as object)).toEqual(['en', 'de'])
    expect(bodyErrors(spec, FULL_PLATFORM, { reasoningEffort: 'minimal' })).toEqual([])
  })

  it('platform settings in every variant: mixed routing, paused, content guardrails, redaction off, low trust, cascade off', () => {
    vi.stubEnv('ELEVENLABS_CONTENT_GUARDRAILS', 'sexual,violence,harassment,self_harm,profanity,religion_or_politics,medical_and_legal_information')
    vi.stubEnv('ELEVENLABS_CONTENT_GUARDRAIL_THRESHOLD', '0.5')
    vi.stubEnv('ELEVENLABS_PII_REDACTION', 'false')
    vi.stubEnv('ELEVENLABS_TRUST_CONTEXT', 'low')
    vi.stubEnv('ELEVENLABS_BACKUP_LLM', 'disabled')
    vi.stubEnv('ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS', '2')
    const transfer = { enabled: true, number: '+40712345678', condition: 'Caller asks for billing', label: 'Billing' }
    for (const active of [true, false]) {
      const mixed = makeAgentSpec({ active, appRouted: true, hasNativeNumbers: true, transfer, callLimits: { concurrency: -1, daily: 100000, bursting: false } })
      expect(bodyErrors(mixed, FULL_PLATFORM), `mixed active=${active}`).toEqual([])
      const native = makeAgentSpec({ active, appRouted: false, hasNativeNumbers: true, transfer, language: 'ro', callLimits: { concurrency: 10, daily: 500, bursting: true } })
      expect(bodyErrors(native, NO_PLATFORM), `native active=${active}`).toEqual([])
    }
    vi.stubEnv('ELEVENLABS_PII_REDACTION', '')
    vi.stubEnv('ELEVENLABS_ENABLE_GUARDRAILS', 'false')
    expect(bodyErrors(makeAgentSpec(), FULL_PLATFORM, { llm: 'gemini-2.5-flash' })).toEqual([])
  })

  it('native telephony (slice C): initiation webhook with a secret header, extension, blind and conference transfers, override allow-list', () => {
    const platform: PlatformResources = { ...FULL_PLATFORM, initiationWebhook: { url: 'https://voice.example.com/api/elevenlabs/initiation', secretId: 'sec_1' } }
    for (const transfer_type of ['conference', 'blind'] as const) {
      for (const active of [true, false]) {
        const spec = makeAgentSpec({
          active,
          appRouted: false,
          hasNativeNumbers: true,
          transfer: { enabled: true, number: '+40712345678', condition: 'Caller asks for billing', label: 'Billing', extension: 'ww12#', transfer_type, whisper: true },
        })
        expect(bodyErrors(spec, platform), `${transfer_type} active=${active}`).toEqual([])
      }
    }
    // Without the webhook: the explicit null clearing it.
    expect(bodyErrors(makeAgentSpec({ appRouted: false, hasNativeNumbers: true }), NO_PLATFORM)).toEqual([])
  })

  it('never writes analysis_items (null = legacy evaluation/data_collection are read); the spec still allows null', () => {
    const analysisItems = (fixture.schemas['AgentPlatformSettingsRequestModel'].properties as Record<string, Schema>).analysis_items
    expect(((analysisItems.anyOf ?? []) as Schema[]).some((b) => b.type === 'null')).toBe(true)
    for (const spec of [makeAgentSpec(), makeAgentSpec({ active: false }), makeAgentSpec({ appRouted: false, hasNativeNumbers: true })]) {
      expect(buildElevenLabsAgentBody(spec, FULL_PLATFORM).platform_settings).not.toHaveProperty('analysis_items')
    }
  })

  it('barge-in, fillers, skip turn and backchannels off; v3 conversational model; prompt-based normalisation', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_v3_conversational')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', 'eleven_v4_turbo')
    vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', 'system_prompt')
    const spec = withConversation(
      { allow_interruptions: false, soft_timeout_fillers: false, skip_turn: false, ignore_backchannels: false, allow_end_call: false, turn_eagerness: 'eager' },
      { language: 'fr', orgName: null, voiceId: null },
    )
    expect(bodyErrors(spec, NO_PLATFORM)).toEqual([])
  })

  it('every agent language as primary, with three additional languages', () => {
    for (const language of ['en', 'ro', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ja', 'ko', 'zh', 'ar', 'hi']) {
      const extra = ['en', 'ro', 'ja', 'ar'].filter((l) => l !== language).slice(0, 3)
      const spec = withConversation(
        { additional_languages: extra },
        { language, languagePresetGreetings: languagePresetGreetings({ languages: extra, tone: 'formal', orgName: 'Smile Clinic', agentName: '', recordingNotice: false }) },
      )
      expect(bodyErrors(spec, FULL_PLATFORM), language).toEqual([])
    }
  })

  it('the validator itself catches unknown keys, bad enums, deprecated values and limits', () => {
    const tts = fixture.schemas['TTSConversationalConfig-Input']
    expect(validate({ model_id: 'eleven_turbo_v2_5' }, tts, 'tts')).toEqual(['tts.model_id: enum value "eleven_turbo_v2_5" is deprecated'])
    expect(validate({ model_id: 'eleven_v9' }, tts, 'tts')[0]).toMatch(/not in enum/)
    expect(validate({ speed: 1.5 }, tts, 'tts')).toEqual(['tts.speed: above maximum 1.2'])
    expect(validate({ made_up_field: true }, tts, 'tts')).toEqual(['tts.made_up_field: not in the spec'])
    const soft = fixture.schemas.SoftTimeoutConfig
    expect(validate({ message: 'x'.repeat(201) }, soft, 'soft')).toEqual(['soft.message: longer than 200'])
    expect(validate({ additional_soft_timeout_messages: Array(8).fill('x') }, soft, 'soft')).toEqual(['soft.additional_soft_timeout_messages: more than 7 items'])
    expect(validate({ provider: 'elevenlabs' }, fixture.schemas.ASRConversationalConfig, 'asr')).toEqual(['asr.provider: enum value "elevenlabs" is deprecated'])
  })

  it('the validator reaches nested paths (turn, presets, tools, platform settings)', () => {
    const body = buildElevenLabsAgentBody(withConversation({ additional_languages: ['ro'] }, { languagePresetGreetings: { ro: 'Bună ziua. Sunt asistentul virtual.' } }), FULL_PLATFORM)
    const cc = body.conversation_config as Record<string, Record<string, unknown>>
    cc.turn.bogus_turn_key = 1
    ;(cc.language_presets.ro as { overrides: Record<string, Record<string, unknown>> }).overrides.agent.voice_id = 'x'
    ;((cc.agent.prompt as Record<string, unknown>).built_in_tools as Record<string, { params: Record<string, unknown> }>).skip_turn.params.wait_timeout_secs = 'soon'
    ;(body.platform_settings as Record<string, unknown>).made_up = true
    const errors = validate({ ...body }, fixture.schemas[fixture.root], 'body')
    expect(errors).toEqual(
      expect.arrayContaining([
        'body.conversation_config.turn.bogus_turn_key: not in the spec',
        'body.conversation_config.language_presets.ro.overrides.agent.voice_id: not in the spec',
        'body.platform_settings.made_up: not in the spec',
      ]),
    )
    expect(errors.some((e) => e.startsWith('body.conversation_config.agent.prompt.built_in_tools.skip_turn'))).toBe(true)
  })
})

describe('platform webhook tools vs WebhookToolConfig-Input (slice B1)', () => {
  const CTX = { baseUrl: 'https://voice.example.com', toolKeySecretId: 'sec_123' }

  it('every platform tool config (with and without the workspace key) matches the spec, with no deprecated field', async () => {
    const { buildWebhookToolConfig } = await import('@/lib/elevenlabs/tools/webhook-tool')
    const { PLATFORM_TOOL_KEYS, PLATFORM_WEBHOOK_TOOLS } = await import('@/lib/elevenlabs/tools/definitions')
    for (const key of PLATFORM_TOOL_KEYS) {
      for (const ctx of [CTX, { ...CTX, toolKeySecretId: null }]) {
        expect(validate(buildWebhookToolConfig(PLATFORM_WEBHOOK_TOOLS[key], ctx), fixture.schemas['WebhookToolConfig-Input'], key), key).toEqual([])
      }
    }
  })

  it('every behaviour preset, assignments, response filters and parameter sources match the spec', async () => {
    const { buildWebhookToolConfig } = await import('@/lib/elevenlabs/tools/webhook-tool')
    const { NOTIFY_BEHAVIOUR, READ_BEHAVIOUR, WRITE_BEHAVIOUR } = await import('@/lib/elevenlabs/tools/behaviour')
    for (const behaviour of [READ_BEHAVIOUR, WRITE_BEHAVIOUR, NOTIFY_BEHAVIOUR]) {
      const config = buildWebhookToolConfig(
        {
          key: 'elevenlabs.book_tool',
          name: 'book_appointment',
          description: 'Book one of the offered slots.',
          path: '/api/telephony/tools/book',
          method: 'POST',
          behaviour,
          body: {
            properties: {
              slot_id: { type: 'string', description: 'Offered slot id.', allowedValuesVariable: 'ntv_offered_slots' },
              service: { type: 'string', description: 'Service.', enum: ['a', 'b'] },
              party: { type: 'integer', description: 'People.' },
              business: { type: 'string', dynamicVariable: 'business_name' },
              source: { type: 'string', constant: 'voice' },
            },
            required: ['slot_id'],
          },
          assignments: [{ dynamicVariable: 'ntv_offered_slots', valuePath: 'slot_ids', sanitize: true, preserveNativeType: true }],
          responseFilter: { mode: 'allow', filters: ['ok', 'message', 'slots'] },
        },
        CTX,
      )
      expect(validate(config, fixture.schemas['WebhookToolConfig-Input'], 'book')).toEqual([])
    }
  })

  it('the validator catches a deprecated tool field and a bad tool enum', () => {
    const schema = fixture.schemas['WebhookToolConfig-Input']
    expect(validate({ name: 'x', description: 'x', api_schema: { url: 'https://x' }, force_pre_tool_speech: true }, schema, 't')).toEqual(['t.force_pre_tool_speech: deprecated in the spec'])
    expect(validate({ name: 'x', description: 'x', api_schema: { url: 'https://x' }, execution_mode: 'later' }, schema, 't')[0]).toMatch(/not in enum/)
  })
})

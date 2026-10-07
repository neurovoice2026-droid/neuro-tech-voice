import { describe, expect, it } from 'vitest'
import { CALL_TOKEN_HEADER, TOOL_KEY_HEADER, buildWebhookToolConfig } from './webhook-tool'
import { PLATFORM_TOOL_KEYS, PLATFORM_WEBHOOK_TOOLS, TRANSFER_TOOL } from './definitions'
import { NOTIFY_BEHAVIOUR, READ_BEHAVIOUR, SYSTEM_TRANSFER_BEHAVIOUR, TRANSFER_BEHAVIOUR, WRITE_BEHAVIOUR, assertNoDeprecatedToolKeys } from './behaviour'
import { secretFingerprint, stableStringify, toolConfigHash } from './hash'
import type { WebhookToolDefinition } from './types'

const CTX = { baseUrl: 'https://voice.example.com', toolKeySecretId: 'sec_123' }

describe('transfer_to_human tool config', () => {
  const tool = buildWebhookToolConfig(TRANSFER_TOOL, CTX)

  it('runs after the agent finished announcing the transfer, which the caller cannot cut short, and passes guidance to the LLM', () => {
    expect(tool).toMatchObject({
      type: 'webhook',
      name: 'transfer_to_human',
      execution_mode: 'post_tool_speech',
      pre_tool_speech: 'force',
      interruption_mode: 'disable_during_tool',
      tool_error_handling_mode: 'passthrough',
      tool_call_sound: null,
      tool_call_sound_behavior: 'auto',
      response_timeout_secs: 15,
      follow_redirects: false,
      assignments: [],
    })
  })

  it('authenticates with the workspace secret and the per-call secret variable in HEADERS, nothing in the body', () => {
    expect(tool.api_schema).toEqual({
      url: 'https://voice.example.com/api/telephony/tools/transfer',
      method: 'POST',
      content_type: 'application/json',
      request_headers: {
        [TOOL_KEY_HEADER]: { secret_id: 'sec_123' },
        [CALL_TOKEN_HEADER]: { variable_name: 'secret__ntv_call_token' },
      },
      request_body_schema: {
        type: 'object',
        required: ['reason'],
        properties: { reason: { type: 'string', description: expect.stringContaining('200 characters') } },
      },
      response_filter: { mode: 'allow', filters: ['ok', 'message'] },
    })
    // The correlation token (ntv_call_token) is referenced by no tool.
    expect(JSON.stringify(tool)).not.toContain('"ntv_call_token"')
    expect(JSON.stringify(tool)).not.toMatch(/call_token"\s*:\s*\{/)
  })

  it('without a configured key only the call token header is sent', () => {
    const t = buildWebhookToolConfig(TRANSFER_TOOL, { ...CTX, toolKeySecretId: null })
    expect(Object.keys(t.api_schema.request_headers as object)).toEqual([CALL_TOKEN_HEADER])
  })

  it('uses only the origin of the base URL', () => {
    expect(buildWebhookToolConfig(TRANSFER_TOOL, { ...CTX, baseUrl: 'https://voice.example.com/some/path?q=1' }).api_schema.url).toBe('https://voice.example.com/api/telephony/tools/transfer')
  })

  it('never carries a deprecated key', () => {
    expect(() => assertNoDeprecatedToolKeys(tool)).not.toThrow()
    expect(JSON.stringify(tool)).not.toMatch(/force_pre_tool_speech|disable_interruptions/)
    expect(() => assertNoDeprecatedToolKeys({ ...tool, force_pre_tool_speech: true })).toThrow(/deprecated/)
    expect(() => assertNoDeprecatedToolKeys({ api_schema: { nested: { disable_interruptions: true } } })).toThrow(/deprecated/)
  })
})

describe('behaviour presets', () => {
  it('use only spec enum values and timeouts within 5-300 s', () => {
    for (const b of [TRANSFER_BEHAVIOUR, READ_BEHAVIOUR, WRITE_BEHAVIOUR, NOTIFY_BEHAVIOUR]) {
      expect(['immediate', 'post_tool_speech', 'async']).toContain(b.execution_mode)
      expect(['auto', 'force', 'off']).toContain(b.pre_tool_speech)
      expect(['allow', 'disable_during_tool']).toContain(b.interruption_mode) // never the unresponsive *_and_turn
      expect(['auto', 'summarized', 'passthrough', 'hide']).toContain(b.tool_error_handling_mode)
      expect([null, 'typing', 'elevator1', 'elevator2', 'elevator3', 'elevator4']).toContain(b.tool_call_sound)
      expect(b.response_timeout_secs).toBeGreaterThanOrEqual(5)
      expect(b.response_timeout_secs).toBeLessThanOrEqual(300)
    }
    // Only fire-and-forget tools run async (the LLM never waits for their result).
    expect(READ_BEHAVIOUR.execution_mode).not.toBe('async')
    expect(WRITE_BEHAVIOUR.execution_mode).not.toBe('async')
    expect(SYSTEM_TRANSFER_BEHAVIOUR).toEqual({ pre_tool_speech: 'force', interruption_mode: 'disable_during_tool' })
    expect(SYSTEM_TRANSFER_BEHAVIOUR).not.toHaveProperty('execution_mode')
  })
})

/** A booking-style definition (slice B2 builds on this): offered slots only. */
const BOOK: WebhookToolDefinition = {
  key: 'elevenlabs.book_tool',
  name: 'book_appointment',
  description: 'Book one of the offered slots.',
  path: '/api/telephony/tools/book',
  method: 'POST',
  behaviour: WRITE_BEHAVIOUR,
  body: {
    properties: {
      slot_id: { type: 'string', description: 'The id of one offered slot.', allowedValuesVariable: 'ntv_offered_slots' },
      service: { type: 'string', description: 'The service.', enum: ['cleaning', 'checkup'] },
      business: { type: 'string', dynamicVariable: 'business_name' },
      source: { type: 'string', constant: 'voice' },
    },
    required: ['slot_id'],
  },
  assignments: [{ dynamicVariable: 'ntv_offered_slots', valuePath: 'slot_ids', sanitize: true, preserveNativeType: true }],
  responseFilter: { mode: 'allow', filters: ['ok', 'message', 'slots'] },
}

describe('generic builder: assignments, response filters, parameter sources', () => {
  it('maps every value source and the allowed-values guard to the spec shape', () => {
    const t = buildWebhookToolConfig(BOOK, CTX)
    expect((t.api_schema.request_body_schema as { properties: unknown }).properties).toEqual({
      slot_id: { type: 'string', description: 'The id of one offered slot.', allowed_values: { dynamic_variable: 'ntv_offered_slots' } },
      service: { type: 'string', description: 'The service.', enum: ['cleaning', 'checkup'] },
      business: { type: 'string', dynamic_variable: 'business_name' },
      source: { type: 'string', constant_value: 'voice' },
    })
    expect(t.assignments).toEqual([{ source: 'response', dynamic_variable: 'ntv_offered_slots', value_path: 'slot_ids', sanitize: true, preserve_native_type: true }])
    expect(t.api_schema.response_filter).toEqual({ mode: 'allow', filters: ['ok', 'message', 'slots'] })
    expect(buildWebhookToolConfig({ ...BOOK, responseFilter: { mode: 'hide_all' } }, CTX).api_schema.response_filter).toEqual({ mode: 'hide_all' })
  })

  it('rejects definitions that would leak credentials or break the spec', () => {
    const bad: Array<[string, Partial<WebhookToolDefinition>]> = [
      ['secret variable in the body', { body: { properties: { t: { type: 'string', dynamicVariable: 'secret__ntv_call_token' } } } }],
      ['correlation token in the body', { body: { properties: { t: { type: 'string', dynamicVariable: 'ntv_call_token' } } } }],
      ['invalid name', { name: 'book appointment!' }],
      ['timeout below 5 s', { behaviour: { ...WRITE_BEHAVIOUR, response_timeout_secs: 2 } }],
      ['timeout above 300 s', { behaviour: { ...WRITE_BEHAVIOUR, response_timeout_secs: 301 } }],
      ['assignment to a platform variable', { assignments: [{ dynamicVariable: 'ntv_routing_mode', valuePath: 'x' }] }],
      ['assignment to a system variable', { assignments: [{ dynamicVariable: 'system__caller_id', valuePath: 'x' }] }],
      ['assignment path with wildcards', { assignments: [{ dynamicVariable: 'ntv_offered_slots', valuePath: 'slots[].id' }] }],
      ["'allow' filter without paths", { responseFilter: { mode: 'allow', filters: [] } }],
      ['required parameter not defined', { body: { properties: {}, required: ['slot_id'] } }],
      ['GET with a body', { method: 'GET' }],
      ['path outside /api/', { path: 'https://evil.example.com/x' }],
      ['secret allowed-values variable', { body: { properties: { s: { type: 'string', description: 'x', allowedValuesVariable: 'secret__x' } } } }],
    ]
    for (const [label, over] of bad) expect(() => buildWebhookToolConfig({ ...BOOK, ...over }, CTX), label).toThrow()
    expect(() => buildWebhookToolConfig(BOOK, { ...CTX, baseUrl: 'http://voice.example.com' })).toThrow(/HTTPS/)
    expect(() => buildWebhookToolConfig(BOOK, { ...CTX, baseUrl: 'http://localhost:3000' })).not.toThrow()
  })

  it('every platform definition builds', () => {
    for (const key of PLATFORM_TOOL_KEYS) expect(() => buildWebhookToolConfig(PLATFORM_WEBHOOK_TOOLS[key], CTX)).not.toThrow()
  })
})

describe('hashing', () => {
  it('is independent of key order and changes with the config', () => {
    const t = buildWebhookToolConfig(TRANSFER_TOOL, CTX)
    const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(t).reverse())))
    expect(toolConfigHash(reordered)).toBe(toolConfigHash(t))
    expect(toolConfigHash(t)).toMatch(/^[0-9a-f]{32}$/)
    expect(toolConfigHash(buildWebhookToolConfig(TRANSFER_TOOL, { ...CTX, baseUrl: 'https://other.example.com' }))).not.toBe(toolConfigHash(t))
    expect(toolConfigHash(buildWebhookToolConfig(TRANSFER_TOOL, { ...CTX, toolKeySecretId: 'sec_other' }))).not.toBe(toolConfigHash(t))
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}')
  })

  it('fingerprints a secret without revealing it', () => {
    const value = 'tool-key-0123456789abcdef-0123456789abcdef'
    expect(secretFingerprint(value)).toBe(secretFingerprint(value))
    expect(secretFingerprint(value)).toMatch(/^[0-9a-f]{16}$/)
    expect(secretFingerprint(value)).not.toBe(secretFingerprint(`${value}x`))
    expect(value).not.toContain(secretFingerprint(value))
  })
})

// Generic builder for the platform's ElevenLabs webhook tools
// (WebhookToolConfig-Input). One definition (./definitions.ts) + the build
// context (public base URL, workspace secret id) → the complete tool_config
// we create or PATCH (PATCH replaces the whole config, so it is always
// complete). Pure: no I/O. Field names and enums verified against the spec.
//
// Platform authentication is added to EVERY tool:
//   X-NTV-Tool-Key   ConvAISecretLocator {secret_id}: workspace secret, proves
//                    the request comes from our ElevenLabs workspace;
//   X-NTV-Call-Token ConvAIDynamicVariable {variable_name: secret__ntv_call_token}:
//                    signed, per-call, purpose-'tool' token. secret__ variables
//                    are only usable in headers, never sent to the LLM and
//                    redacted in transcripts and webhooks.
// Nothing that authenticates travels in the body (which ElevenLabs stores in
// transcripts and tool execution logs).

import { PLATFORM_VARIABLES } from '@/lib/voice-providers/prompt'
import { assertNoDeprecatedToolKeys } from './behaviour'
import type { LiteralParam, ToolBuildContext, WebhookToolConfig, WebhookToolDefinition } from './types'

/** Workspace secret header (value = ELEVENLABS_TOOL_SECRET, stored as an ElevenLabs workspace secret). */
export const TOOL_KEY_HEADER = 'X-NTV-Tool-Key'
/** Per-call token header (secret dynamic variable, purpose 'tool'). */
export const CALL_TOKEN_HEADER = 'X-NTV-Call-Token'

const NAME = /^[a-zA-Z0-9_-]{1,64}$/
const VARIABLE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
const DOT_PATH = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+){0,9}$/

/** Variables a tool must never read in its body or overwrite with an assignment. */
const PLATFORM_AUTH_VARIABLES = new Set<string>([PLATFORM_VARIABLES.callToken, PLATFORM_VARIABLES.secretCallToken])
const RESERVED_ASSIGNMENT_TARGETS = new Set<string>(Object.values(PLATFORM_VARIABLES))

function fail(def: WebhookToolDefinition, message: string): never {
  throw new Error(`webhook tool ${def.name}: ${message}`)
}

function literal(def: WebhookToolDefinition, name: string, p: LiteralParam): Record<string, unknown> {
  if (!VARIABLE.test(name)) fail(def, `invalid parameter name ${name}`)
  if ('description' in p) {
    if (!p.description.trim()) fail(def, `${name}: empty description`)
    const out: Record<string, unknown> = { type: p.type, description: p.description }
    if (p.enum) {
      if (p.type !== 'string' || p.enum.length === 0) fail(def, `${name}: enum needs a string type and values`)
      out.enum = [...p.enum]
    }
    if (p.allowedValuesVariable) {
      if (!VARIABLE.test(p.allowedValuesVariable) || p.allowedValuesVariable.startsWith('secret__')) fail(def, `${name}: invalid allowed-values variable`)
      out.allowed_values = { dynamic_variable: p.allowedValuesVariable }
    }
    return out
  }
  if ('dynamicVariable' in p) {
    const v = p.dynamicVariable
    // secret__ variables only resolve in headers; the auth tokens never go in a body.
    if (!VARIABLE.test(v) || v.startsWith('secret__') || PLATFORM_AUTH_VARIABLES.has(v)) fail(def, `${name}: variable ${v} cannot be sent in a body`)
    return { type: p.type, dynamic_variable: v }
  }
  return { type: p.type, constant_value: p.constant }
}

/** Builds the complete tool_config for a definition. Throws on an invalid definition (a code bug, caught by tests). */
export function buildWebhookToolConfig(def: WebhookToolDefinition, ctx: ToolBuildContext): WebhookToolConfig {
  if (!NAME.test(def.name)) fail(def, 'invalid name')
  if (!def.description.trim()) fail(def, 'empty description')
  if (!/^\/api\/[A-Za-z0-9/_-]+$/.test(def.path)) fail(def, 'path must be an /api/ path')
  if (!URL.canParse(ctx.baseUrl)) fail(def, 'invalid base URL')
  const base = new URL(ctx.baseUrl)
  // ElevenLabs sends our secret header: only ever to an HTTPS origin (http://localhost for local tests).
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && base.hostname === 'localhost')) fail(def, 'base URL must be HTTPS')
  const b = def.behaviour
  if (!Number.isInteger(b.response_timeout_secs) || b.response_timeout_secs < 5 || b.response_timeout_secs > 300) fail(def, 'response_timeout_secs must be 5-300')

  const headers: Record<string, unknown> = {}
  if (ctx.toolKeySecretId) headers[TOOL_KEY_HEADER] = { secret_id: ctx.toolKeySecretId }
  headers[CALL_TOKEN_HEADER] = { variable_name: PLATFORM_VARIABLES.secretCallToken }

  const apiSchema: Record<string, unknown> = {
    url: `${base.origin}${def.path}`,
    method: def.method,
    content_type: 'application/json',
    request_headers: headers,
  }
  if (def.body) {
    const properties: Record<string, unknown> = {}
    for (const [name, p] of Object.entries(def.body.properties)) properties[name] = literal(def, name, p)
    const required = def.body.required ?? []
    for (const r of required) if (!(r in properties)) fail(def, `required parameter ${r} is not defined`)
    if (def.method === 'GET') fail(def, 'a GET tool cannot have a body')
    apiSchema.request_body_schema = { type: 'object', required: [...required], properties }
  }
  if (def.responseFilter) {
    const f = def.responseFilter
    const filters = f.filters ?? []
    if (f.mode === 'allow' && filters.length === 0) fail(def, "response filter 'allow' needs paths")
    for (const path of filters) if (!DOT_PATH.test(path)) fail(def, `invalid response filter path ${path}`)
    apiSchema.response_filter = f.mode === 'allow' ? { mode: 'allow', filters: [...filters] } : { mode: f.mode }
  }

  const assignments = (def.assignments ?? []).map((a) => {
    if (!VARIABLE.test(a.dynamicVariable) || RESERVED_ASSIGNMENT_TARGETS.has(a.dynamicVariable) || a.dynamicVariable.startsWith('system__')) {
      fail(def, `assignment cannot write ${a.dynamicVariable}`)
    }
    if (!DOT_PATH.test(a.valuePath)) fail(def, `invalid assignment path ${a.valuePath}`)
    return {
      source: 'response',
      dynamic_variable: a.dynamicVariable,
      value_path: a.valuePath,
      sanitize: a.sanitize === true,
      preserve_native_type: a.preserveNativeType === true,
    }
  })

  const config: WebhookToolConfig = {
    type: 'webhook',
    name: def.name,
    description: def.description,
    response_timeout_secs: b.response_timeout_secs,
    execution_mode: b.execution_mode,
    pre_tool_speech: b.pre_tool_speech,
    interruption_mode: b.interruption_mode,
    tool_error_handling_mode: b.tool_error_handling_mode,
    // Explicit null: a sound picked in the dashboard does not survive a PATCH.
    tool_call_sound: b.tool_call_sound,
    tool_call_sound_behavior: b.tool_call_sound_behavior,
    // Always sent (PATCH replaces): [] removes assignments made elsewhere.
    assignments,
    // Never follow redirects: our secret headers must only reach our endpoint.
    follow_redirects: false,
    api_schema: apiSchema as WebhookToolConfig['api_schema'],
  }
  assertNoDeprecatedToolKeys(config)
  return config
}

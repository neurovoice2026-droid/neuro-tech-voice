// Typed model of the ElevenLabs tool configuration the platform writes.
// Names and enums follow the official OpenAPI spec (2026-10):
// WebhookToolConfig-Input, SystemToolConfig-Input, WebhookToolApiSchemaConfig-Input,
// LiteralJsonSchemaProperty, DynamicVariableAssignment, ResponseFilter.
// The deprecated keys force_pre_tool_speech and disable_interruptions are
// never part of these types (pre_tool_speech / interruption_mode replace them).

/** ToolExecutionMode. 'async' never blocks the conversation: never use it for a tool whose result the LLM needs. */
export type ToolExecutionMode = 'immediate' | 'post_tool_speech' | 'async'
/** PreToolSpeechMode. */
export type PreToolSpeechMode = 'auto' | 'force' | 'off'
/** ToolInterruptionMode. 'disable_during_tool_and_turn' feels unresponsive: avoid it. */
export type ToolInterruptionMode = 'allow' | 'disable_during_tool' | 'disable_during_tool_and_turn'
/** ToolErrorHandlingMode. 'auto' = 'hide' for webhook tools: the LLM would never see our guidance. */
export type ToolErrorHandlingMode = 'auto' | 'summarized' | 'passthrough' | 'hide'
/** ToolCallSoundType (null = no sound). */
export type ToolCallSoundType = 'typing' | 'elevator1' | 'elevator2' | 'elevator3' | 'elevator4'
/** ToolCallSoundBehavior. */
export type ToolCallSoundBehavior = 'auto' | 'always'

/** Behaviour of a webhook tool (WebhookToolConfig-Input). */
export interface WebhookToolBehaviour {
  execution_mode: ToolExecutionMode
  pre_tool_speech: PreToolSpeechMode
  interruption_mode: ToolInterruptionMode
  tool_error_handling_mode: ToolErrorHandlingMode
  tool_call_sound: ToolCallSoundType | null
  tool_call_sound_behavior: ToolCallSoundBehavior
  /** 5–300 seconds (spec). */
  response_timeout_secs: number
}

/** Behaviour of a built-in system tool (SystemToolConfig-Input has no execution_mode). */
export type SystemToolBehaviour = Partial<Pick<WebhookToolBehaviour, 'pre_tool_speech' | 'interruption_mode' | 'tool_error_handling_mode'>>

export type LiteralType = 'string' | 'integer' | 'number' | 'boolean'

/**
 * One request parameter (LiteralJsonSchemaProperty). Exactly one value
 * source, as the spec requires: the LLM (description), a dynamic variable,
 * or a constant.
 */
export type LiteralParam =
  | {
      type: LiteralType
      /** The LLM provides the value from this description. */
      description: string
      enum?: string[]
      /**
       * Server-side guard (spec `allowed_values`): the runtime rejects any value
       * outside the JSON array held by this dynamic variable. Only valid with a
       * description source.
       */
      allowedValuesVariable?: string
    }
  | { type: LiteralType; dynamicVariable: string }
  | { type: LiteralType; constant: string | number | boolean }

/** DynamicVariableAssignment (source is always 'response'). */
export interface ToolAssignment {
  dynamicVariable: string
  /** Dot notation, e.g. 'slot_ids' or 'data.0.id'. */
  valuePath: string
  /** Removes the value from what the LLM and the transcript see. Never for values the LLM must pass back. */
  sanitize?: boolean
  /** Keep arrays/objects as native values (list variables for allowed_values). */
  preserveNativeType?: boolean
}

/** ResponseFilter: what of the JSON response the LLM sees. */
export interface ToolResponseFilter {
  mode: 'all' | 'allow' | 'hide_all'
  /** Dot paths, required with mode 'allow'. */
  filters?: string[]
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * A platform webhook tool. Every platform tool calls our own HTTPS endpoint
 * and is authenticated by two headers: the workspace secret X-NTV-Tool-Key
 * and the per-call X-NTV-Call-Token (a secret dynamic variable the LLM never
 * sees). The business data travels in the body.
 */
export interface WebhookToolDefinition {
  /** platform_resources key, e.g. 'elevenlabs.transfer_tool'. */
  key: string
  /** ^[a-zA-Z0-9_-]{1,64}$ */
  name: string
  description: string
  /** Path on our public base URL, starting with /api/. */
  path: string
  method: HttpMethod
  behaviour: WebhookToolBehaviour
  body?: { properties: Record<string, LiteralParam>; required?: string[] }
  assignments?: ToolAssignment[]
  responseFilter?: ToolResponseFilter
}

/** What the builder needs from the environment. */
export interface ToolBuildContext {
  /** Public HTTPS origin of this deployment (VOICE_PUBLIC_BASE_URL). */
  baseUrl: string
  /** Workspace secret holding ELEVENLABS_TOOL_SECRET (null = not configured: no key header). */
  toolKeySecretId: string | null
}

/** The wire object sent as ToolRequestModel.tool_config. */
export type WebhookToolConfig = Record<string, unknown> & { type: 'webhook'; name: string; api_schema: { url: string } & Record<string, unknown> }

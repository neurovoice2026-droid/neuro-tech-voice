// Provider conversation metadata kept on calls.call_metadata (migration 017)
// for support and the call detail view. Pure and client-safe.
//
// What is stored: the language the call was held in, how it was started
// (initiation source, channel), queue wait, the agent version, which agent
// features fired, a redacted tool timeline (tool name, ok, result type, time;
// never parameters, URLs, headers or bodies) and the provider error/warnings
// (truncated). Provider COST is never stored here: calls rows are readable by
// the tenant, so cost goes to the service-only call_provider_costs table.

export type CallChannel = 'phone' | 'web' | 'other'

export type ToolEventKind = 'transfer' | 'voicemail' | 'end_call' | 'language' | 'skip_turn' | 'knowledge' | 'other'

export interface CallToolEvent {
  /** Tool name as configured on the agent (system or platform tool); never its parameters. */
  tool: string
  kind: ToolEventKind
  ok: boolean
  /** SystemToolResult result_type when the provider returns one (e.g. transfer_to_number_twilio_success). */
  result_type: string | null
  /** Seconds into the call (turn time). */
  at_secs: number
}

export interface CallProviderError {
  code: number
  /** Truncated free text (may mention what the caller said: never logged). */
  reason: string | null
}

export interface CallMetadata {
  main_language?: string | null
  initiation_source?: string | null
  channel?: CallChannel
  text_only?: boolean
  queue_wait_secs?: number | null
  version_id?: string | null
  branch_id?: string | null
  /** ElevenLabs phone_number_id that carried the call (native numbers). */
  phone_number_external_id?: string | null
  /** Agent features that were actually used in the call (features_usage.<name>.used). */
  features_used?: string[]
  call_success_score?: number | null
  /** Guardrail types that fired (prompt_injection, …), for support. */
  guardrails_triggered?: string[]
  tool_events?: CallToolEvent[]
  provider_error?: CallProviderError | null
  warnings?: string[]
}

export const MAX_TOOL_EVENTS = 50
export const MAX_WARNINGS = 5
export const MAX_ERROR_REASON = 200
export const MAX_WARNING_LENGTH = 200

const KINDS: ReadonlySet<string> = new Set(['transfer', 'voicemail', 'end_call', 'language', 'skip_turn', 'knowledge', 'other'])

/** Reads a stored call_metadata value defensively (unknown keys are dropped). */
export function readCallMetadata(raw: unknown): CallMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  const out: CallMetadata = {}
  const str = (v: unknown, max = 80) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  if (str(r.main_language, 16)) out.main_language = str(r.main_language, 16)
  if (str(r.initiation_source, 40)) out.initiation_source = str(r.initiation_source, 40)
  if (r.channel === 'phone' || r.channel === 'web' || r.channel === 'other') out.channel = r.channel
  if (typeof r.text_only === 'boolean') out.text_only = r.text_only
  if (num(r.queue_wait_secs) !== null) out.queue_wait_secs = num(r.queue_wait_secs)
  if (num(r.call_success_score) !== null) out.call_success_score = num(r.call_success_score)
  if (Array.isArray(r.features_used)) out.features_used = r.features_used.filter((f): f is string => typeof f === 'string').slice(0, 20)
  if (Array.isArray(r.tool_events)) {
    out.tool_events = r.tool_events
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((e) => ({
        tool: str(e.tool) ?? 'tool',
        kind: (typeof e.kind === 'string' && KINDS.has(e.kind) ? e.kind : 'other') as ToolEventKind,
        ok: e.ok !== false,
        result_type: str(e.result_type),
        at_secs: Math.max(0, Math.round(num(e.at_secs) ?? 0)),
      }))
      .slice(0, MAX_TOOL_EVENTS)
  }
  const err = r.provider_error
  if (err && typeof err === 'object' && num((err as Record<string, unknown>).code) !== null) {
    out.provider_error = {
      code: num((err as Record<string, unknown>).code) as number,
      reason: str((err as Record<string, unknown>).reason, MAX_ERROR_REASON),
    }
  }
  if (Array.isArray(r.warnings)) out.warnings = r.warnings.filter((w): w is string => typeof w === 'string').map((w) => w.slice(0, MAX_WARNING_LENGTH)).slice(0, MAX_WARNINGS)
  return out
}

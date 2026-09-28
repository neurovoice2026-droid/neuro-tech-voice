import OpenAI from 'openai'
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems'
import type { FunctionTool, Response as OpenAIResponse, ResponseFunctionToolCall, ResponseInputItem } from 'openai/resources/responses/responses'
import type { LlmConfig, VoiceToolDefinition } from '../contracts'
import { keepAliveFetch } from '../http'
import type { Logger } from '../log'
import { ProviderError } from './errors'

// The LLM turn loop for cartesia_self (openai-docs.md §2, §4–§6, §9):
//   - Responses API over HTTP SSE, store:false, reasoning.effort none,
//     text.verbosity low, parallel_tool_calls false, no obfuscation padding,
//     safety_identifier; instructions and tools stay byte-identical for the
//     whole call so the prompt cache holds
//   - history is replayed every hop with toResponseInputItems (keeps reasoning
//     items and call ids intact)
//   - barge-in aborts the HTTP stream through the AbortSignal
//   - one retry per turn, and only while nothing has been spoken
//   - at most `max_tool_hops` model→tool round trips per caller turn

const NO_RETRY_CODES = new Set([
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'insufficient_quota',
])

/** No stream event for this long means the request is stuck. */
const STREAM_STALL_MS = 10_000
/** Time to first byte (headers) for a live turn. */
const REQUEST_TIMEOUT_MS = 10_000

export type LlmErrorClass = 'abort' | 'timeout' | 'retry' | 'fatal'

export function classifyOpenAIError(error: unknown): LlmErrorClass {
  if (error instanceof OpenAI.APIUserAbortError) return 'abort'
  if (error instanceof OpenAI.APIConnectionTimeoutError) return 'timeout'
  if (error instanceof OpenAI.RateLimitError) return NO_RETRY_CODES.has(String(error.code ?? '')) ? 'fatal' : 'retry'
  if (error instanceof OpenAI.InternalServerError || error instanceof OpenAI.APIConnectionError) return 'retry'
  if (error instanceof OpenAI.APIError) {
    if (NO_RETRY_CODES.has(String(error.code ?? ''))) return 'fatal'
    if (error.status === 408 || error.status === 409) return 'retry'
    if (error.status === undefined) return 'retry' // error event mid-stream (server_error etc.)
    return 'fatal'
  }
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return error.name === 'AbortError' ? 'abort' : 'timeout'
  return 'fatal'
}

export function toOpenAITools(defs: VoiceToolDefinition[]): FunctionTool[] {
  return defs.map((def) => ({
    type: 'function',
    name: def.name,
    description: def.description,
    strict: true,
    parameters: def.parameters as unknown as Record<string, unknown>,
  }))
}

export interface LlmToolCall {
  name: string
  callId: string
  /** Raw JSON arguments string from the model. */
  arguments: string
}

export interface LlmTurnHooks {
  /** A text delta the caller should hear (hop index for segmenting). */
  onText(delta: string, hop: number): void
  /** A function call started streaming (before its arguments are complete). */
  onToolCallStart?(call: { name: string; callId: string }, hop: number, spokenThisHop: boolean): void
  /** The hop's text is complete (the engine closes its TTS segment). */
  onHopEnd?(hop: number, hasToolCalls: boolean): void
  /** Runs one tool; returns the function_call_output string. Awaited even after an abort. */
  runTool(call: LlmToolCall): Promise<string>
  /**
   * After a tool round: false stops the loop (e.g. end_call or transfer is
   * pending); 'final_reply' allows exactly one more model reply with tools
   * turned off (a goodbye before the pending hang-up).
   */
  continueAfterTools?(): boolean | 'final_reply'
}

export interface LlmUsage {
  input: number
  cached: number
  output: number
}

export interface LlmTurnResult {
  /** New history items produced by this turn, in order (model outputs and tool outputs). */
  items: ResponseInputItem[]
  /** Items of the final hop only (the part a barge-in may need to rewrite). */
  finalHopStart: number
  text: string
  usage: LlmUsage
  aborted: boolean
  hops: number
  /** The model kept calling tools until max_tool_hops ran out, without a final answer. */
  hopLimitReached?: boolean
}

export class LlmError extends ProviderError {
  constructor(message: string, readonly errorClass: LlmErrorClass, status: number | null, code: string | null, cause?: unknown) {
    super({ provider: 'openai', component: 'llm', message, status, code, cause })
    this.name = 'LlmError'
  }
}

export interface OpenAiLlmOptions {
  apiKey: string
  baseUrl: string | null
  config: LlmConfig
  instructions: string
  tools: VoiceToolDefinition[]
  safetyIdentifier: string
  log: Logger
  /** Test hook: shorter stall detection. */
  stallMs?: number
}

export class OpenAiLlm {
  private readonly client: OpenAI
  private readonly tools: FunctionTool[]

  constructor(private readonly options: OpenAiLlmOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
      // The gateway decides retries: never replay a request after audio started.
      maxRetries: 0,
      timeout: REQUEST_TIMEOUT_MS,
      // Warm connections between turns (src/http.ts).
      fetch: keepAliveFetch,
    })
    this.tools = toOpenAITools(options.tools)
  }

  async runTurn(input: ResponseInputItem[], hooks: LlmTurnHooks, signal: AbortSignal): Promise<LlmTurnResult> {
    const items: ResponseInputItem[] = []
    const usage: LlmUsage = { input: 0, cached: 0, output: 0 }
    let text = ''
    let retried = false
    let hop = 0
    let finalHopStart = 0
    let toolChoice: 'auto' | 'none' = 'auto'
    const maxHops = Math.max(1, this.options.config.max_tool_hops + 1)

    while (hop < maxHops) {
      if (signal.aborted) return { items, finalHopStart, text, usage, aborted: true, hops: hop }
      finalHopStart = items.length
      let hopText = ''
      let response: OpenAIResponse | null = null
      try {
        response = await this.streamHop([...input, ...items], signal, toolChoice, (delta) => {
          hopText += delta
          text += delta
          hooks.onText(delta, hop)
        }, (call) => hooks.onToolCallStart?.(call, hop, hopText.trim().length > 0))
      } catch (error) {
        const kind = error instanceof LlmError ? error.errorClass : classifyOpenAIError(error)
        if (kind === 'abort' || signal.aborted) return { items, finalHopStart, text, usage, aborted: true, hops: hop }
        const canRetry = (kind === 'retry' || kind === 'timeout') && !retried && text.length === 0
        this.options.log.warn('openai turn failed', { kind, retrying: canRetry, error: describe(error) })
        if (canRetry) {
          retried = true
          continue
        }
        throw error instanceof LlmError ? error : toLlmError(error, kind)
      }

      if (response.usage) {
        usage.input += response.usage.input_tokens ?? 0
        usage.cached += response.usage.input_tokens_details?.cached_tokens ?? 0
        usage.output += response.usage.output_tokens ?? 0
      }
      if (response.status === 'incomplete') {
        this.options.log.warn('openai response incomplete', { reason: response.incomplete_details?.reason ?? null })
      }
      items.push(...toResponseInputItems(response.output))
      const calls = response.output.filter((item): item is ResponseFunctionToolCall => item.type === 'function_call')
      hooks.onHopEnd?.(hop, calls.length > 0)
      hop += 1
      if (calls.length === 0 || toolChoice === 'none') return { items, finalHopStart, text, usage, aborted: false, hops: hop }

      for (const call of calls) {
        // Side-effecting tools finish even when the caller barged in: their
        // output must land in history, or the model would retry the booking.
        const output = await hooks.runTool({ name: call.name, callId: call.call_id, arguments: call.arguments })
        items.push({ type: 'function_call_output', call_id: call.call_id, output })
      }
      if (signal.aborted) return { items, finalHopStart: items.length, text, usage, aborted: true, hops: hop }
      const next = hooks.continueAfterTools ? hooks.continueAfterTools() : true
      if (next === false) return { items, finalHopStart: items.length, text, usage, aborted: false, hops: hop }
      if (next === 'final_reply') toolChoice = 'none'
    }
    this.options.log.warn('openai tool hop limit reached', { max_tool_hops: this.options.config.max_tool_hops })
    return { items, finalHopStart: items.length, text, usage, aborted: false, hops: hop, hopLimitReached: true }
  }

  private async streamHop(
    input: ResponseInputItem[],
    signal: AbortSignal,
    toolChoice: 'auto' | 'none',
    onDelta: (delta: string) => void,
    onToolStart: (call: { name: string; callId: string }) => void
  ): Promise<OpenAIResponse> {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal.addEventListener('abort', onAbort, { once: true })
    let stalled = false
    const stallMs = this.options.stallMs ?? STREAM_STALL_MS
    let stallTimer: NodeJS.Timeout = setTimeout(() => {
      stalled = true
      controller.abort()
    }, stallMs + REQUEST_TIMEOUT_MS)
    const bump = () => {
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => {
        stalled = true
        controller.abort()
      }, stallMs)
    }

    try {
      const { config } = this.options
      const stream = await this.client.responses.create(
        {
          model: config.model,
          instructions: this.options.instructions,
          input,
          tools: this.tools,
          tool_choice: toolChoice,
          parallel_tool_calls: false,
          reasoning: { effort: config.reasoning_effort },
          text: { verbosity: 'low' },
          max_output_tokens: config.max_output_tokens,
          store: false,
          stream: true,
          stream_options: { include_obfuscation: false },
          // An empty identifier would be rejected; the app always sends a hash.
          ...(this.options.safetyIdentifier ? { safety_identifier: this.options.safetyIdentifier } : {}),
        },
        { signal: controller.signal }
      )
      bump()
      let final: OpenAIResponse | null = null
      for await (const event of stream) {
        bump()
        switch (event.type) {
          case 'response.output_text.delta':
            if (event.delta) onDelta(event.delta)
            break
          case 'response.output_item.added':
            if (event.item.type === 'function_call') onToolStart({ name: event.item.name, callId: event.item.call_id })
            break
          case 'response.completed':
          case 'response.incomplete':
            final = event.response
            break
          case 'response.failed':
            throw new LlmError(
              `OpenAI response failed${event.response.error?.code ? ` (${event.response.error.code})` : ''}`,
              isRetryableCode(event.response.error?.code) ? 'retry' : 'fatal',
              null,
              event.response.error?.code ?? null
            )
          case 'error':
            throw new LlmError(`OpenAI stream error${event.code ? ` (${event.code})` : ''}`, isRetryableCode(event.code) ? 'retry' : 'fatal', null, event.code ?? null)
          default:
            break
        }
      }
      if (!final) throw new LlmError('OpenAI stream ended without a terminal event', 'retry', null, 'stream_truncated')
      return final
    } catch (error) {
      if (stalled && !signal.aborted) throw new LlmError('OpenAI stream stalled', 'timeout', null, 'timeout', error)
      throw error
    } finally {
      clearTimeout(stallTimer)
      signal.removeEventListener('abort', onAbort)
    }
  }
}

function isRetryableCode(code: string | null | undefined): boolean {
  return code === 'server_error' || code === 'rate_limit_exceeded' || code === 'server_is_overloaded' || code === 'slow_down'
}

function toLlmError(error: unknown, kind: LlmErrorClass): LlmError {
  if (error instanceof OpenAI.APIError) {
    return new LlmError(`OpenAI request failed (${error.status ?? 'stream'})`, kind, error.status ?? null, error.code ? String(error.code) : null, error)
  }
  return new LlmError(`OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`, kind, null, null, error)
}

function describe(error: unknown): Record<string, unknown> {
  if (error instanceof OpenAI.APIError) return { status: error.status ?? null, code: error.code ?? null, type: error.type ?? null }
  if (error instanceof ProviderError) return error.toJSON()
  return { message: error instanceof Error ? error.message : String(error) }
}

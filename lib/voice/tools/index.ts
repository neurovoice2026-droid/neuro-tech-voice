import 'server-only'
import { kvGet, kvIncr, kvSet } from '@/lib/kv'
import type { ToolRequest, ToolResponse, VoiceToolName } from '@/lib/voice/contracts'
import { CARTESIA_TOOL_PREFIX, fromCartesiaToolName, TOOL_DEFINITIONS } from '@/lib/voice/tools/definitions'
import {
  capUtf8,
  loadToolContext,
  type ContextFailure,
  type Defer,
  type ToolContext,
  type ToolHandler,
  type ToolOutcome,
} from '@/lib/voice/tools/runtime'
import { getCallContext } from '@/lib/voice/tools/context'
import { searchKnowledgeTool } from '@/lib/voice/tools/knowledge'
import {
  bookAppointmentTool,
  cancelAppointmentTool,
  checkAvailabilityTool,
  findBookingTool,
  rescheduleAppointmentTool,
} from '@/lib/voice/tools/calendar'
import { addToWaitlistTool } from '@/lib/voice/tools/waitlist'
import { sendSmsTool } from '@/lib/voice/tools/sms'
import { takeMessageTool } from '@/lib/voice/tools/messages'
import { notifyTeamTool } from '@/lib/voice/tools/notify'
import { transferCallTool } from '@/lib/voice/tools/transfer'
import { saveLeadDetailsTool } from '@/lib/voice/tools/lead'
import { endCallTool } from '@/lib/voice/tools/end-call'

// Runs one tool call for a live voice session (self-run pipeline or Cartesia
// Managed Agent client tool, both through the gateway). Contract:
// - never throws: every failure is { ok: false, result } telling the model what
//   to say instead
// - answers within the gateway's 8 s budget; slow work keeps running in the
//   background (defer) so nothing is left half done
// - side-effecting calls are deduplicated by tool_call_id, so a gateway retry
//   or a replayed request can't book or text twice
// - every invocation is logged to tool_invocations (post-call analysis reads it)

export const TOOL_BUDGET_MS = 8_000
/** Reply to the gateway a little before its own budget runs out. */
const RESPONSE_DEADLINE_MS = 7_300
/** How long a timed-out run may keep going in the background (the route's maxDuration is 30 s). */
const BACKGROUND_LIMIT_MS = 20_000
const RESULT_CACHE_SECONDS = 15 * 60
const INFLIGHT_SECONDS = 30
const DUPLICATE_POLL_MS = 400
const MAX_LOGGED_ARGUMENT_BYTES = 4096

const HANDLERS: Record<VoiceToolName, ToolHandler> = {
  get_call_context: getCallContext,
  search_knowledge: searchKnowledgeTool,
  check_availability: checkAvailabilityTool,
  book_appointment: bookAppointmentTool,
  find_booking: findBookingTool,
  reschedule_appointment: rescheduleAppointmentTool,
  cancel_appointment: cancelAppointmentTool,
  add_to_waitlist: addToWaitlistTool,
  send_sms: sendSmsTool,
  take_message: takeMessageTool,
  notify_team: notifyTeamTool,
  transfer_call: transferCallTool,
  save_lead_details: saveLeadDetailsTool,
  end_call: endCallTool,
}

export interface RunVoiceToolOptions {
  /** Aborts provider requests (the route passes the request's own deadline). */
  signal?: AbortSignal
  /** Runs work after the response is sent; route handlers pass Next's `after`. Default: awaited before returning. */
  defer?: (task: () => Promise<unknown>) => void
  now?: Date
  /** When to answer with a timeout result, in ms from the start. Default 7.3 s (tests use less). */
  responseDeadlineMs?: number
}

const GENERIC_FAILURE =
  "That didn't work because of a technical problem. Apologise briefly, don't retry it, and offer to take a message so the team can follow up."

function response(outcome: ToolOutcome): ToolResponse {
  return {
    ok: outcome.ok,
    result: capUtf8(outcome.result),
    action: outcome.action ?? null,
    ...(outcome.sources ? { sources: outcome.sources } : {}),
  }
}

function contextFailureOutcome(failure: ContextFailure): ToolOutcome {
  switch (failure.kind) {
    case 'ended':
      return { ok: false, result: 'This call has already ended, so nothing was done.' }
    case 'not_found':
      return { ok: false, result: GENERIC_FAILURE }
    default:
      return { ok: false, result: GENERIC_FAILURE }
  }
}

function timeoutOutcome(name: VoiceToolName): ToolOutcome {
  if (name === 'transfer_call') {
    return { ok: false, result: "The transfer couldn't be set up in time, so the call was not transferred. Apologise and offer to take a message." }
  }
  if (name === 'book_appointment' || name === 'reschedule_appointment' || name === 'cancel_appointment') {
    return {
      ok: false,
      result:
        "The calendar is taking too long to answer. Don't call this tool again right away: tell the caller you're still confirming, then call find_booking in a moment to see whether the change went through before trying again.",
    }
  }
  if (TOOL_DEFINITIONS[name].side_effects) {
    return {
      ok: false,
      result: "This is taking longer than expected and may still complete. Don't repeat it; tell the caller the team will follow up if anything is missing.",
    }
  }
  return { ok: false, result: 'The lookup timed out. Apologise briefly, try once more, and if it fails again offer to take a message.' }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** The promise's value, or 'timeout' when it takes longer than `ms`. The timer never outlives the race. */
async function raceDeadline<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), Math.max(0, ms))
  })
  try {
    return await Promise.race([promise, timedOut])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function loggableArguments(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {}
  try {
    const json = JSON.stringify(args)
    return new TextEncoder().encode(json).length <= MAX_LOGGED_ARGUMENT_BYTES ? (args as Record<string, unknown>) : { truncated: true }
  } catch {
    return { unserializable: true }
  }
}

async function logInvocation(ctx: ToolContext, req: ToolRequest, res: ToolResponse, latencyMs: number): Promise<void> {
  const { error } = await ctx.admin.from('tool_invocations').insert({
    org_id: ctx.org.id,
    call_id: ctx.call.id,
    tool_name: req.name,
    arguments: loggableArguments(req.arguments),
    ok: res.ok,
    result_summary: Array.from(res.result).slice(0, 500).join(''),
    latency_ms: Math.max(0, Math.round(latencyMs)),
  })
  if (error) console.error('[tools] logging the invocation failed', error.code, error.message)
}

/** Waits for a duplicate request's first run to publish its result. */
async function awaitFirstResult(cacheKey: string, signal: AbortSignal, deadlineAt: number): Promise<ToolResponse | null> {
  while (!signal.aborted && Date.now() + DUPLICATE_POLL_MS < deadlineAt) {
    await sleep(DUPLICATE_POLL_MS)
    const cached = await kvGet<ToolResponse>(cacheKey)
    if (cached) return cached
  }
  return null
}

export async function runVoiceTool(req: ToolRequest, opts: RunVoiceToolOptions = {}): Promise<ToolResponse> {
  const started = Date.now()
  const deadlineAt = started + Math.min(opts.responseDeadlineMs ?? RESPONSE_DEADLINE_MS, RESPONSE_DEADLINE_MS)
  const budget = AbortSignal.timeout(TOOL_BUDGET_MS)
  const signal = opts.signal ? AbortSignal.any([opts.signal, budget]) : budget

  const pending: Promise<unknown>[] = []
  const defer: Defer = (task) => {
    const guarded = async () => {
      try {
        await task()
      } catch (error) {
        console.error('[tools] background task failed', { tool: req.name, error: error instanceof Error ? error.message : error })
      }
    }
    if (opts.defer) opts.defer(guarded)
    else pending.push(guarded())
  }
  const finish = async (res: ToolResponse): Promise<ToolResponse> => {
    if (!opts.defer) await Promise.all(pending)
    return res
  }

  // Managed-agent client tools carry the ntv_ prefix; accept either spelling.
  const rawName = String(req.name)
  const name = (rawName.startsWith(CARTESIA_TOOL_PREFIX) ? fromCartesiaToolName(rawName) ?? rawName : rawName) as VoiceToolName
  const request: ToolRequest = name === req.name ? req : { ...req, name }
  const handler = Object.prototype.hasOwnProperty.call(HANDLERS, name) ? HANDLERS[name] : undefined
  if (!handler) {
    return finish(response({ ok: false, result: `The tool "${String(name).slice(0, 60)}" isn't available on this call. Continue without it.` }))
  }

  let loaded: ToolContext | ContextFailure | 'timeout'
  try {
    loaded = await raceDeadline(loadToolContext(request, { signal, defer, now: opts.now }), deadlineAt - Date.now())
  } catch (error) {
    console.error('[tools] loading the call failed', { tool: name, callId: request.call_id, error: error instanceof Error ? error.message : error })
    return finish(response({ ok: false, result: GENERIC_FAILURE }))
  }
  if (loaded === 'timeout') {
    // Nothing has run yet, so repeating it once is safe.
    console.warn('[tools] loading the call timed out', { tool: name, callId: request.call_id })
    return finish(response({ ok: false, result: 'The system is slow right now, so nothing was done. Apologise briefly, try once more, and if it fails again offer to take a message.' }))
  }
  if ('kind' in loaded) {
    if (loaded.kind !== 'ended') console.warn('[tools] call context unavailable', { tool: name, callId: request.call_id, kind: loaded.kind })
    return finish(response(contextFailureOutcome(loaded)))
  }
  const ctx = loaded

  const sideEffects = TOOL_DEFINITIONS[name].side_effects
  const cacheKey = `tool:result:${request.call_id}:${request.tool_call_id}`
  if (sideEffects) {
    const cached = await kvGet<ToolResponse>(cacheKey)
    if (cached) return finish(cached)
    const inflight = await kvIncr(`tool:inflight:${request.call_id}:${request.tool_call_id}`, INFLIGHT_SECONDS)
    if (inflight > 1) {
      const first = await awaitFirstResult(cacheKey, signal, deadlineAt)
      return finish(
        first ??
          response({
            ok: false,
            result: "This request is already being handled. Don't repeat it; wait for the caller's next words and continue.",
          })
      )
    }
  }

  const run = (async (): Promise<ToolOutcome> => {
    try {
      return await handler(ctx, request.arguments ?? {})
    } catch (error) {
      console.error('[tools] tool failed', { tool: name, callId: request.call_id, error: error instanceof Error ? error.message : error })
      return { ok: false, result: GENERIC_FAILURE }
    }
  })()

  const winner = await raceDeadline(run, deadlineAt - Date.now())

  if (winner === 'timeout') {
    console.warn('[tools] tool exceeded its time budget', { tool: name, callId: request.call_id })
    const res = response(timeoutOutcome(name))
    if (sideEffects) defer(() => kvSet(cacheKey, res, RESULT_CACHE_SECONDS))
    // The slow run keeps going (a calendar write finishes instead of freezing
    // halfway). The log records how it really ended, because post-call
    // analysis reads outcomes such as "booked" from tool_invocations.
    defer(async () => {
      const final = await raceDeadline(run, BACKGROUND_LIMIT_MS)
      // An action (transfer, hang-up) only happens when the gateway receives it: a late one never did.
      const happened = final !== 'timeout' && !final.action ? response(final) : res
      await logInvocation(ctx, request, happened, Date.now() - started)
    })
    return finish(res)
  }

  const res = response(winner)
  const latencyMs = Date.now() - started
  if (sideEffects) defer(() => kvSet(cacheKey, res, RESULT_CACHE_SECONDS))
  defer(() => logInvocation(ctx, request, res, latencyMs))
  return finish(res)
}

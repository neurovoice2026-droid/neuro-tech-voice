// Browser side of the test-call protocol: validating what the app and the
// voice gateway send, and the plain-language copy for each outcome. Pure and
// client-safe; TestCallPanel wires it to fetch, WebSocket and Web Audio.

import {
  VOICE_PIPELINE_MODES,
  type BrowserServerMessage,
  type CallEndReason,
  type VoicePipelineMode,
} from '@/lib/voice/contracts'

/** Hard cap for a browser test call, matching the gateway's 180 s test-call limit. */
export const TEST_CALL_MAX_SECONDS = 180
/** When the timer starts warning that the call is about to end. */
export const TEST_CALL_WARNING_SECONDS = 150

export const MODE_LABELS: Record<VoicePipelineMode, string> = {
  cartesia_self: 'Cartesia',
  cartesia_managed: 'Cartesia Agents',
  elevenlabs: 'Fallback voice',
}

export const MODE_DESCRIPTIONS: Record<VoicePipelineMode, string> = {
  cartesia_self: 'Cartesia speech with our own conversation engine',
  cartesia_managed: 'Cartesia hosted voice agent',
  elevenlabs: 'Backup voice provider, used while the main one is unavailable',
}

function isMode(value: unknown): value is VoicePipelineMode {
  return typeof value === 'string' && (VOICE_PIPELINE_MODES as readonly string[]).includes(value)
}

const END_REASONS: readonly CallEndReason[] = [
  'caller_hangup', 'agent_hangup', 'transferred', 'silence_timeout', 'max_duration', 'voicemail', 'error', 'test_ended',
]

function isEndReason(value: unknown): value is CallEndReason {
  return typeof value === 'string' && (END_REASONS as readonly string[]).includes(value)
}

/** Parses one text frame from the gateway; null for anything that isn't a known message. */
export function parseServerMessage(raw: string): BrowserServerMessage | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const msg = data as Record<string, unknown>
  switch (msg.type) {
    case 'ready':
      return isMode(msg.mode) ? { type: 'ready', mode: msg.mode } : null
    case 'mode_switched':
      return isMode(msg.mode) ? { type: 'mode_switched', mode: msg.mode } : null
    case 'user_transcript':
      return typeof msg.text === 'string' ? { type: 'user_transcript', text: msg.text, final: msg.final === true } : null
    case 'agent_text': {
      if (typeof msg.text !== 'string') return null
      const turn = typeof msg.turn === 'number' && Number.isSafeInteger(msg.turn) && msg.turn >= 0 ? msg.turn : undefined
      return {
        type: 'agent_text',
        text: msg.text,
        ...(turn !== undefined ? { turn } : {}),
        ...(msg.interrupted === true ? { interrupted: true } : {}),
      }
    }
    case 'clear':
      return { type: 'clear' }
    case 'ended':
      return { type: 'ended', reason: isEndReason(msg.reason) ? msg.reason : 'error' }
    case 'error':
      return { type: 'error', message: typeof msg.message === 'string' ? msg.message.slice(0, 300) : '' }
    default:
      return null
  }
}

export interface TestSession {
  ws_url: string
  call_id: string
  mode: VoicePipelineMode
}

export function parseTestSession(body: unknown): TestSession | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.ws_url !== 'string' || typeof b.call_id !== 'string' || !isMode(b.mode)) return null
  return { ws_url: b.ws_url, call_id: b.call_id, mode: b.mode }
}

/**
 * Only connect to a secure WebSocket, or plain ws:// when the page itself is
 * served over http (local development), so a bad response can't downgrade
 * the audio stream.
 */
export function isAllowedGatewayUrl(url: string, pageProtocol: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'wss:') return true
    return parsed.protocol === 'ws:' && pageProtocol === 'http:'
  } catch {
    return false
  }
}

export interface ApiErrorInfo {
  status: number
  code: string
  message: string | null
}

/** Reads `{ error: { code, message } }`, or the older `{ error: 'text' }`, from a failed response body. */
export function parseApiError(status: number, body: unknown): ApiErrorInfo {
  const error = body && typeof body === 'object' ? (body as Record<string, unknown>).error : undefined
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    return {
      status,
      code: typeof e.code === 'string' ? e.code : `http_${status}`,
      message: typeof e.message === 'string' && e.message.trim() ? e.message.trim().slice(0, 300) : null,
    }
  }
  if (typeof error === 'string' && error.trim()) return { status, code: `http_${status}`, message: error.trim().slice(0, 300) }
  return { status, code: `http_${status}`, message: null }
}

/** Where a failed test-session request should send the owner. */
export type SessionFailure =
  | { kind: 'use_phone' }
  | { kind: 'signed_out'; message: string }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'unavailable'; message: string }

export function classifySessionError(info: ApiErrorInfo): SessionFailure {
  if (info.status === 503 && info.code === 'gateway_not_configured') return { kind: 'use_phone' }
  if (info.status === 401) return { kind: 'signed_out', message: 'Your session has expired. Please sign in again to test your agent.' }
  if (info.status === 429) {
    return { kind: 'rate_limited', message: info.message ?? "You've used today's test calls. You can test again tomorrow." }
  }
  if (info.status >= 500) {
    return { kind: 'unavailable', message: info.message ?? "Test calls aren't available right now. Please try again in a few minutes." }
  }
  return { kind: 'unavailable', message: info.message ?? "We couldn't start a test call. Please try again." }
}

/** What to tell the owner when "Call my phone" fails. */
export function phoneTestErrorMessage(info: ApiErrorInfo): string {
  if (info.status === 401) return 'Your session has expired. Please sign in again to test your agent.'
  if (info.status === 429) return info.message ?? "You've used today's test calls. You can test again tomorrow."
  if (info.status >= 500) return info.message ?? "Calling your phone isn't available right now. Please try again in a few minutes."
  return info.message ?? "We couldn't place the call. Check the number and try again."
}

export type MicErrorKind = 'denied' | 'not_found' | 'busy' | 'unsupported' | 'unknown'

export interface MicError {
  kind: MicErrorKind
  message: string
}

/** Maps getUserMedia / AudioWorklet failures to what the owner can do about them. */
export function describeMicError(error: unknown): MicError {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        kind: 'denied',
        message: 'Microphone access is blocked. Allow it from the icon in your browser’s address bar, then try again.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return { kind: 'not_found', message: 'We couldn’t find a microphone. Plug one in or check your sound settings, then try again.' }
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        kind: 'busy',
        message: 'Your microphone is in use by another app or tab. Close it and try again.',
      }
    case 'UnsupportedError':
      return {
        kind: 'unsupported',
        message: 'This browser can’t run a test call. Please use a recent version of Chrome, Edge, Safari or Firefox.',
      }
    default:
      return { kind: 'unknown', message: 'We couldn’t start your microphone. Please try again.' }
  }
}

/** Why the call ended, in words for the owner. */
export function endReasonText(reason: CallEndReason, agentName: string): string {
  const agent = agentName.trim() || 'Your agent'
  switch (reason) {
    case 'caller_hangup':
    case 'test_ended':
      return 'You ended the test call.'
    case 'agent_hangup':
      return `${agent} ended the call.`
    case 'transferred':
      return `${agent} tried to transfer the call. Transfers happen on real phone calls, so the test ended here.`
    case 'silence_timeout':
      return 'The call ended because nobody spoke for a while.'
    case 'max_duration':
      return 'Test calls last up to 3 minutes. Start another one to keep going.'
    case 'voicemail':
      return 'The call ended.'
    case 'error':
      return 'Something went wrong on our side and the call ended. Please try again.'
  }
}

/** m:ss */
export function formatCallTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

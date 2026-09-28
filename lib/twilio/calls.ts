import 'server-only'
import { ApiError } from '@/lib/api/http'
import { env, isTwilioConfigured } from '@/lib/env'
import { destinationRefusal, parseCallingCodes, type DestinationRefusal } from '@/lib/phone/destinations'
import { isE164 } from '@/lib/phone/e164'
import {
  CALL_SID_REGEX,
  RECORDING_SID_REGEX,
  getTwilioClient,
  isTwilioNotFound,
  twilioErrorInfo,
} from '@/lib/twilio/client'
import { dial, twimlDocument } from '@/lib/twilio/twiml'
import { telephonyUrl } from '@/lib/twilio/webhooks'

// Live call control over Twilio REST: hang up, transfer, record, place
// outbound calls, and read or delete recordings. Callers get plain errors
// (logged here with [telephony]); nothing returns raw Twilio bodies.

function assertCallSid(callSid: string): void {
  if (!CALL_SID_REGEX.test(callSid)) throw new Error('Invalid Twilio call SID')
}

/**
 * Why the platform won't pay for a call leg to `to` placed from the org's
 * number `from` (lib/phone/destinations.ts), or null when it may.
 */
export function callDestinationRefusal(to: string, from: string | null): DestinationRefusal | null {
  return destinationRefusal(to, { fromNumber: from, extraCallingCodes: parseCallingCodes(env.CALL_DESTINATION_COUNTRY_CODES) })
}

export class DestinationNotAllowedError extends Error {
  constructor(readonly refusal: DestinationRefusal) {
    super(`Destination not allowed (${refusal})`)
    this.name = 'DestinationNotAllowedError'
  }
}

/**
 * A bridged transfer or on-call leg never runs longer than this. Twilio's
 * default is 4 hours, all of it billed to the platform account.
 */
export const TRANSFER_TIME_LIMIT_SECONDS = 60 * 60

// 21220: "Call is not in-progress. Cannot redirect." The call already ended,
// which is exactly what a hangup wanted.
const CALL_NOT_IN_PROGRESS = 21220

/** Ends a live call. A call that already ended counts as success. */
export async function hangupCall(callSid: string): Promise<void> {
  assertCallSid(callSid)
  try {
    await getTwilioClient().calls(callSid).update({ status: 'completed' })
  } catch (error) {
    const info = twilioErrorInfo(error)
    if (isTwilioNotFound(error) || info.code === CALL_NOT_IN_PROGRESS) return
    console.error('[telephony] hangup failed', info.status, info.code, info.message)
    throw error
  }
}

export interface TransferCallInput {
  callSid: string
  callId: string
  /** E.164 destination (an escalation contact). */
  to: string
  /** E.164 number the org owns, shown as caller id. */
  callerId: string
  contactId?: string | null
  timeoutSeconds?: number
  /** Cap for the bridged leg; defaults to TRANSFER_TIME_LIMIT_SECONDS. */
  timeLimitSeconds?: number
}

/** TwiML the live call is redirected to: ring the contact, then /transfer-status decides. */
export function transferTwiml(input: Omit<TransferCallInput, 'callSid'>): string {
  return twimlDocument(
    dial({
      number: input.to,
      callerId: input.callerId,
      timeoutSeconds: input.timeoutSeconds ?? 25,
      timeLimitSeconds: input.timeLimitSeconds ?? TRANSFER_TIME_LIMIT_SECONDS,
      action: telephonyUrl('transfer-status', { call_id: input.callId, contact_id: input.contactId ?? null }),
    })
  )
}

/**
 * Replaces the running TwiML (the gateway stream) with a <Dial>. Twilio stops
 * the stream immediately; the gateway sees the WebSocket close.
 */
export async function transferCall(input: TransferCallInput): Promise<void> {
  assertCallSid(input.callSid)
  if (!isE164(input.to) || !isE164(input.callerId)) throw new Error('Transfer numbers must be E.164')
  const refusal = callDestinationRefusal(input.to, input.callerId)
  if (refusal) throw new DestinationNotAllowedError(refusal)
  try {
    await getTwilioClient().calls(input.callSid).update({ twiml: transferTwiml(input) })
  } catch (error) {
    const info = twilioErrorInfo(error)
    console.error('[telephony] transfer failed', info.status, info.code, info.message)
    throw error
  }
}

/** Starts a dual-channel recording; /api/telephony/recording stores it when it completes. */
export async function startRecording(input: { callSid: string; callId: string }): Promise<{ sid: string }> {
  assertCallSid(input.callSid)
  try {
    const recording = await getTwilioClient()
      .calls(input.callSid)
      .recordings.create({
        recordingStatusCallback: telephonyUrl('recording', { call_id: input.callId }),
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['completed', 'absent'],
        recordingChannels: 'dual',
      })
    return { sid: recording.sid }
  } catch (error) {
    const info = twilioErrorInfo(error)
    console.error('[telephony] start recording failed', info.status, info.code, info.message)
    throw error
  }
}

export interface OutboundCallInput {
  /** E.164 number to call. */
  to: string
  /** E.164 number the org owns. */
  from: string
  /** calls.id of the pre-created row. */
  callId: string
  /** Twilio answering machine detection; adds a few seconds before the agent speaks. */
  voicemailDetection: boolean
  /** Hard cap for the whole call in seconds. */
  timeLimitSeconds?: number | null
}

/** Places a call whose TwiML comes from /api/telephony/outbound?call_id=… once it is answered. */
export async function createOutboundCall(input: OutboundCallInput): Promise<{ sid: string }> {
  if (!isE164(input.to) || !isE164(input.from)) throw new Error('Outbound call numbers must be E.164')
  // Routes check first to explain the refusal; this is the backstop for every caller.
  const refusal = callDestinationRefusal(input.to, input.from)
  if (refusal) throw new DestinationNotAllowedError(refusal)
  const query = { call_id: input.callId }
  try {
    const call = await getTwilioClient().calls.create({
      to: input.to,
      from: input.from,
      url: telephonyUrl('outbound', query),
      method: 'POST',
      fallbackUrl: telephonyUrl('fallback', query),
      fallbackMethod: 'POST',
      statusCallback: telephonyUrl('status', query),
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed'],
      // Ring for 30 s; voicemail usually picks up around 20–25 s.
      timeout: 30,
      ...(input.timeLimitSeconds ? { timeLimit: Math.max(60, Math.round(input.timeLimitSeconds)) } : {}),
      ...(input.voicemailDetection ? { machineDetection: 'Enable', machineDetectionTimeout: 8 } : {}),
    })
    return { sid: call.sid }
  } catch (error) {
    const info = twilioErrorInfo(error)
    console.error('[telephony] outbound call failed', info.status, info.code, info.message)
    throw error
  }
}

/** Twilio error codes for a destination we can't or may not call. */
export const UNCALLABLE_NUMBER_CODES = new Set([13223, 13224, 13225, 13226, 21210, 21211, 21214, 21215, 21216, 21217, 21218])

export async function deleteRecording(recordingSid: string): Promise<void> {
  if (!RECORDING_SID_REGEX.test(recordingSid)) throw new Error('Invalid Twilio recording SID')
  try {
    await getTwilioClient().recordings(recordingSid).remove()
  } catch (error) {
    if (isTwilioNotFound(error)) return
    const info = twilioErrorInfo(error)
    console.error('[telephony] delete recording failed', info.status, info.code, info.message)
    throw error
  }
}

/**
 * Streams a recording's audio from Twilio for the app's audio proxy
 * (/api/calls/[id]/audio). The Range header is forwarded so seeking works.
 * The caller streams the body and must never expose the Twilio URL.
 */
export async function fetchRecordingMedia(
  recordingSid: string,
  opts: { range?: string | null; format?: 'mp3' | 'wav'; signal?: AbortSignal } = {}
): Promise<Response> {
  if (!RECORDING_SID_REGEX.test(recordingSid)) throw new Error('Invalid Twilio recording SID')
  const accountSid = env.TWILIO_ACCOUNT_SID
  const authToken = env.TWILIO_AUTH_TOKEN
  if (!isTwilioConfigured() || !accountSid || !authToken) {
    throw new ApiError(503, 'not_configured', 'Phone service is not configured yet.')
  }
  const format = opts.format ?? 'mp3'
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.${format}`
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
  }
  if (opts.range && /^bytes=\d*-\d*(,\s*\d*-\d*)*$/.test(opts.range)) headers.Range = opts.range
  const timeout = AbortSignal.timeout(15_000)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  const res = await fetch(url, { headers, signal, redirect: 'follow', cache: 'no-store' })
  if (!res.ok && res.status !== 206) {
    console.error('[telephony] recording media fetch failed', res.status)
  }
  return res
}

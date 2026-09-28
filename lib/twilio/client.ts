import 'server-only'
import twilio from 'twilio'
import { ApiError } from '@/lib/api/http'
import { env, isTwilioConfigured } from '@/lib/env'

// One lazily created REST client per process. Twilio REST lives only in the
// app (the voice gateway never holds Twilio credentials).

export type TwilioClient = ReturnType<typeof twilio>

let client: TwilioClient | null = null
let clientKey: string | null = null

/** Throws ApiError 503 not_configured when the account credentials are missing. */
export function getTwilioClient(): TwilioClient {
  const accountSid = env.TWILIO_ACCOUNT_SID
  const authToken = env.TWILIO_AUTH_TOKEN
  if (!isTwilioConfigured() || !accountSid || !authToken) {
    throw new ApiError(503, 'not_configured', 'Phone service is not configured yet.')
  }
  // Rebuild when credentials rotate without a restart (tests stub env too).
  const key = `${accountSid}:${authToken}`
  if (!client || clientKey !== key) {
    client = twilio(accountSid, authToken, {
      // 429s are retried by the SDK with backoff; nothing else is.
      autoRetry: true,
      maxRetries: 2,
      timeout: 10_000,
    })
    clientKey = key
  }
  return client
}

export function twilioAccountSid(): string | null {
  return env.TWILIO_ACCOUNT_SID ?? null
}

/** Twilio RestException fields, read defensively (the SDK class isn't exported as a value). */
export function twilioErrorInfo(error: unknown): { status: number | null; code: number | null; message: string } {
  if (!error || typeof error !== 'object') return { status: null, code: null, message: String(error) }
  const e = error as { status?: unknown; code?: unknown; message?: unknown }
  return {
    status: typeof e.status === 'number' ? e.status : null,
    code: typeof e.code === 'number' ? e.code : null,
    message: typeof e.message === 'string' ? e.message : 'Unknown Twilio error',
  }
}

/** 404 / 20404: the resource is already gone. */
export function isTwilioNotFound(error: unknown): boolean {
  const { status, code } = twilioErrorInfo(error)
  return status === 404 || code === 20404
}

/**
 * Voice / SMS / MMS flags from a Twilio phone number resource. The SDK passes
 * the JSON through as is, and Twilio spells SMS and MMS in capitals on some
 * resources, so both spellings are read.
 */
export function numberCapabilities(capabilities: unknown): { voice: boolean; sms: boolean; mms: boolean } {
  const caps = (capabilities && typeof capabilities === 'object' ? capabilities : {}) as Record<string, unknown>
  return {
    voice: caps.voice === true,
    sms: caps.sms === true || caps.SMS === true,
    mms: caps.mms === true || caps.MMS === true,
  }
}

export const CALL_SID_REGEX = /^CA[0-9a-f]{32}$/i
export const RECORDING_SID_REGEX = /^RE[0-9a-f]{32}$/i
export const MESSAGE_SID_REGEX = /^(SM|MM)[0-9a-f]{32}$/i
export const PHONE_NUMBER_SID_REGEX = /^PN[0-9a-f]{32}$/i

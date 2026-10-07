import 'server-only'
// TwiML documents the router returns. Built with the official SDK builder so
// every value is XML-escaped; nothing here interpolates caller input into XML.

import twilio from 'twilio'
import { twilioSayLanguage, twilioSayVoice } from '@/lib/voice/languages'

type VoiceResponse = InstanceType<typeof twilio.twiml.VoiceResponse>

function say(r: VoiceResponse, text: string, language: string) {
  r.say({ voice: twilioSayVoice(language) as never, language: twilioSayLanguage(language) as never }, text)
}

export function sayAndHangup(text: string, language: string): string {
  const r = new twilio.twiml.VoiceResponse()
  say(r, text, language)
  r.hangup()
  return r.toString()
}

export function hangup(): string {
  const r = new twilio.twiml.VoiceResponse()
  r.hangup()
  return r.toString()
}

export function reject(): string {
  const r = new twilio.twiml.VoiceResponse()
  r.reject({ reason: 'rejected' })
  return r.toString()
}

/** Forward to a human (after-hours forward, final-failure handoff, transfers). */
export function forwardCall(opts: {
  sayText?: string | null
  language: string
  to: string
  callerId?: string | null
  actionUrl: string
  timeoutSeconds?: number
  /** Keys dialed once the destination answers (an extension): Twilio sendDigits (digits, *, #, w). */
  sendDigits?: string | null
  /** TwiML played to the destination only, before the caller is bridged (warm-transfer whisper). */
  whisperUrl?: string | null
}): string {
  const r = new twilio.twiml.VoiceResponse()
  if (opts.sayText) say(r, opts.sayText, opts.language)
  const dial = r.dial({
    action: opts.actionUrl,
    method: 'POST',
    timeout: opts.timeoutSeconds ?? 25,
    answerOnBridge: true,
    ...(opts.callerId ? { callerId: opts.callerId } : {}),
  })
  const sendDigits = opts.sendDigits && /^[0-9*#w]{1,48}$/.test(opts.sendDigits) ? opts.sendDigits : null
  if (sendDigits || opts.whisperUrl) {
    dial.number({ ...(sendDigits ? { sendDigits } : {}), ...(opts.whisperUrl ? { url: opts.whisperUrl, method: 'POST' as const } : {}) }, opts.to)
  } else {
    dial.number(opts.to)
  }
  return r.toString()
}

/**
 * The whisper document (<Number url>): spoken to the human who answered, then
 * Twilio bridges the caller. No <Hangup>: that would drop the human's leg.
 */
export function whisperResponse(text: string | null, language: string): string {
  const r = new twilio.twiml.VoiceResponse()
  if (text) say(r, text, language)
  return r.toString()
}

/**
 * Connects the caller to the Cartesia fallback agent over SIP. Cartesia routes
 * by the dialed number (imported under the platform SIP trunk provider and
 * assigned to the org's fallback agent). referUrl handles the agent's
 * transfer_to_number (SIP REFER); action tells us how the leg ended.
 */
export function dialCartesiaSip(opts: {
  sipUri: string
  username: string
  password: string
  actionUrl: string
  referUrl: string
  timeLimitSeconds: number
  /** Caller id presented on the SIP leg (any string for SIP targets). */
  callerId?: string | null
}): string {
  const r = new twilio.twiml.VoiceResponse()
  const dial = r.dial({
    action: opts.actionUrl,
    method: 'POST',
    answerOnBridge: true,
    timeLimit: opts.timeLimitSeconds,
    referUrl: opts.referUrl,
    referMethod: 'POST',
    ...(opts.callerId ? { callerId: opts.callerId } : {}),
  })
  dial.sip({ username: opts.username, password: opts.password }, opts.sipUri)
  return r.toString()
}

function escapeXmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * ElevenLabs register-call returns a complete TwiML document. We append a
 * <Redirect> after it so that, if the media stream ends while the caller is
 * still connected, Twilio asks us what to do next (early-failure fallback or
 * hang up) instead of silently dropping. Throws if the document is not TwiML.
 */
export function appendRedirect(twimlDoc: string, redirectUrl: string): string {
  const doc = twimlDoc.trim()
  const close = doc.lastIndexOf('</Response>')
  if (!/<Response[\s>]/.test(doc) || close === -1 || !/<Connect[\s>]/.test(doc)) {
    throw new Error('register-call did not return a TwiML <Response> with <Connect>')
  }
  const redirect = `<Redirect method="POST">${escapeXmlAttr(redirectUrl)}</Redirect>`
  return `${doc.slice(0, close)}${redirect}${doc.slice(close)}`
}

export function twimlResponse(xml: string, status = 200): Response {
  return new Response(xml, { status, headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' } })
}

// TwiML builders. Every attribute and text node goes through escapeXml, so
// caller-controlled or owner-controlled text (custom messages, names, numbers)
// can never break out of the document or inject verbs. Pure and dependency
// free apart from the language tables, so it is unit-tested directly.

import { twilioSayLanguage, twilioSayVoice } from '@/lib/voice/languages'

/** Twilio reads at most 4,096 characters of <Say> text. */
export const MAX_SAY_CHARACTERS = 4000
/** A <Parameter> name + value must stay under this many characters (Twilio: "under 500"). */
export const MAX_STREAM_PARAMETER_CHARACTERS = 500

// Characters that are illegal in XML 1.0 (C0 controls except tab/LF/CR, lone
// surrogates, U+FFFE/U+FFFF). Dropped instead of escaped: they can't be encoded.
// With the u flag a surrogate range only matches unpaired surrogates, so emoji survive.
// Written as escapes: raw control bytes would make git and editors treat the file as binary.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/gu

export function escapeXml(value: string): string {
  return String(value)
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type AttributeValue = string | number | boolean | null | undefined

function attributes(attrs: Record<string, AttributeValue>): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([name, value]) => ` ${name}="${escapeXml(String(value))}"`)
    .join('')
}

/** A complete TwiML document. Verbs are the strings returned by the helpers below. */
export function twimlDocument(...verbs: string[]): string {
  const body = verbs.filter(Boolean).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`
}

/** Collapses whitespace and trims to Twilio's limit at a word boundary. */
export function sayText(text: string): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= MAX_SAY_CHARACTERS) return clean
  const cut = clean.slice(0, MAX_SAY_CHARACTERS)
  const lastSpace = cut.lastIndexOf(' ')
  return lastSpace > MAX_SAY_CHARACTERS * 0.8 ? cut.slice(0, lastSpace) : cut
}

/**
 * <Say> in the agent language. The voice is always set together with the
 * language: without it Twilio uses the account default voice, which may not
 * speak the language at all.
 */
export function say(text: string, language: string): string {
  const content = sayText(text)
  if (!content) return ''
  return `<Say${attributes({ language: twilioSayLanguage(language), voice: twilioSayVoice(language) })}>${escapeXml(content)}</Say>`
}

export function pause(seconds: number): string {
  const length = Math.min(60, Math.max(1, Math.round(seconds)))
  return `<Pause${attributes({ length })}/>`
}

export function hangup(): string {
  return '<Hangup/>'
}

/** Refuses an inbound call before answering it (no charge to the caller, no call minutes). */
export function reject(reason: 'rejected' | 'busy' = 'rejected'): string {
  return `<Reject${attributes({ reason })}/>`
}

export interface ConnectStreamOptions {
  /** <Connect action>: requested when the stream ends (gateway closed or failed). */
  action: string
  /** wss:// URL of the gateway endpoint. */
  streamUrl: string
  /** <Stream statusCallback>: stream-started / stream-stopped / stream-error. */
  statusCallback?: string | null
  parameters?: Record<string, string>
}

export function connectStream(options: ConnectStreamOptions): string {
  if (!/^wss?:\/\//i.test(options.streamUrl)) {
    throw new Error('connectStream needs a ws:// or wss:// stream URL')
  }
  const params = Object.entries(options.parameters ?? {})
    .map(([name, value]) => {
      if (name.length + value.length >= MAX_STREAM_PARAMETER_CHARACTERS) {
        throw new Error(`Stream parameter "${name}" is longer than Twilio allows`)
      }
      return `<Parameter${attributes({ name, value })}/>`
    })
    .join('')
  const stream = `<Stream${attributes({
    url: options.streamUrl,
    statusCallback: options.statusCallback ?? null,
    statusCallbackMethod: options.statusCallback ? 'POST' : null,
  })}>${params}</Stream>`
  return `<Connect${attributes({ action: options.action, method: 'POST' })}>${stream}</Connect>`
}

export interface DialOptions {
  /** E.164 destination. */
  number: string
  /** E.164 caller id shown to the person answering (must be a number we own). */
  callerId: string
  /** Ring time in seconds before giving up. */
  timeoutSeconds?: number
  /** Requested when the dialled leg ends (DialCallStatus). */
  action?: string | null
  /** Hard cap for the bridged call. */
  timeLimitSeconds?: number | null
}

export function dial(options: DialOptions): string {
  const timeout = Math.min(60, Math.max(5, Math.round(options.timeoutSeconds ?? 25)))
  return `<Dial${attributes({
    callerId: options.callerId,
    timeout,
    timeLimit: options.timeLimitSeconds ? Math.max(60, Math.round(options.timeLimitSeconds)) : null,
    action: options.action ?? null,
    method: options.action ? 'POST' : null,
  })}><Number>${escapeXml(options.number)}</Number></Dial>`
}

/** Say one or more lines, then hang up. */
export function sayAndHangup(lines: string | string[], language: string): string {
  const list = Array.isArray(lines) ? lines : [lines]
  return twimlDocument(...list.map((line) => say(line, language)), hangup())
}

export const EMPTY_TWIML = twimlDocument()

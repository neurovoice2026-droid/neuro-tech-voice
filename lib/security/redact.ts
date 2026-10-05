// Redaction for anything that ends up in logs, diagnostics or "last error"
// columns. Pure and dependency-light so it is unit-testable.
//
// Rules:
// - Keys that look like credentials are replaced wholesale.
// - E.164-looking numbers anywhere in a string are masked (+40 7** *** 123).
// - Known secret shapes (Twilio SIDs/tokens, bearer tokens, sk_/xi keys) are
//   replaced even when they appear inside free text.
// - Transcript-like keys are dropped from general logs (PII), only counted.

import { maskPhone } from '@/lib/phone/e164'

// Call/conversation ids (CallSid, conversation_id) are not secrets and must stay
// readable for correlation, so `sid`/`id` keys are deliberately not matched;
// Twilio *account* SIDs are caught by the text pattern below instead.
const SECRET_KEY_RE = /(secret|token|password|passwd|api[-_]?key|^authorization$|^auth$|auth[-_]?token|signature|cookie|credential|private[-_]?key|service[-_]?role)/i

const PII_BULK_KEYS = new Set(['transcript', 'full_audio', 'audio', 'messages', 'system_prompt', 'prompt'])

const PHONE_IN_TEXT_RE = /\+[1-9]\d{6,14}\b/g

const SECRET_IN_TEXT_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b(sk|pk|rk|whsec|xi|sk_live|sk_test)_[A-Za-z0-9]{8,}\b/g,
  /\bAC[0-9a-fA-F]{32}\b/g, // Twilio Account SID
  /\bSK[0-9a-fA-F]{32}\b/g, // Twilio API key SID
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, // JWTs
]

export function maskPhonesInText(text: string): string {
  return text.replace(PHONE_IN_TEXT_RE, (m) => maskPhone(m))
}

export function redactText(text: string): string {
  let out = text
  for (const re of SECRET_IN_TEXT_PATTERNS) out = out.replace(re, '[redacted]')
  return maskPhonesInText(out)
}

/**
 * Deep-copies `value` with secrets removed, phone numbers masked and bulky PII
 * (transcripts, prompts, audio) replaced by a size marker. Cycles are cut.
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value !== 'object') return String(value)
  if (depth > 6) return '[depth]'
  if (seen.has(value as object)) return '[cycle]'
  seen.add(value as object)

  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) }
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1, seen))
  }
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_RE.test(key) && !/^(has_|is_)/.test(key) && typeof v !== 'boolean') {
      out[key] = '[redacted]'
    } else if (PII_BULK_KEYS.has(key)) {
      out[key] = Array.isArray(v) ? `[${v.length} items]` : typeof v === 'string' ? `[${v.length} chars]` : '[omitted]'
    } else {
      out[key] = redact(v, depth + 1, seen)
    }
  }
  return out
}

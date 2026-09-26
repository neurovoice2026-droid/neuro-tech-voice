// Structured JSON logs (one line per event) for Fly/Render log drains.
//
// Two guarantees, enforced here rather than at every call site:
// - no secrets: fields whose name looks like a credential are replaced, and
//   provider keys that slip into free text are scrubbed
// - no full phone numbers: anything that looks like an E.164 number is masked
//   to its country prefix and last three digits (+40******123)

import type { LogLevel } from './config'

type Fields = Record<string, unknown>

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const SECRET_FIELD = /(secret|token|api[-_]?key|authorization|password|signature|signed[-_]?url|cookie)/i
const E164_LIKE = /\+[1-9]\d{6,14}\b/g
const KEY_LIKE = /\b(sk_car_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,}|xi-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g

/** +40712345123 → +40******123: enough to tell calls apart in logs, not enough to dial. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 7) return '+***'
  return `+${digits.slice(0, 2)}${'*'.repeat(digits.length - 5)}${digits.slice(-3)}`
}

export function scrubText(text: string): string {
  return text.replace(KEY_LIKE, '<redacted>').replace(E164_LIKE, (m) => maskPhone(m))
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return scrubText(value.length > 2000 ? `${value.slice(0, 2000)}…` : value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Error) {
    return { name: value.name, message: scrubText(value.message) }
  }
  if (depth > 4) return '[depth]'
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_FIELD.test(k) ? '<redacted>' : sanitize(v, depth + 1)
    }
    return out
  }
  return String(value)
}

export interface Logger {
  debug(msg: string, fields?: Fields): void
  info(msg: string, fields?: Fields): void
  warn(msg: string, fields?: Fields): void
  error(msg: string, fields?: Fields): void
  child(fields: Fields): Logger
}

export type LogSink = (line: string) => void

export function createLogger(level: LogLevel, base: Fields = {}, sink: LogSink = (line) => process.stdout.write(`${line}\n`)): Logger {
  const min = LEVELS[level]
  const emit = (lvl: LogLevel, msg: string, fields?: Fields) => {
    if (LEVELS[lvl] < min) return
    try {
      const record = sanitize({ ts: new Date().toISOString(), level: lvl, msg, ...base, ...fields }) as Fields
      sink(JSON.stringify(record))
    } catch {
      // Logging must never take a call down.
    }
  }
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (fields) => createLogger(level, { ...base, ...fields }, sink),
  }
}

/** A logger that drops everything (tests that don't care about logs). */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
}

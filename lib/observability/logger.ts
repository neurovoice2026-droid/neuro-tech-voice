// Structured JSON logging for server code. One line per event so Vercel's log
// drain (or any collector) can index fields: requestId, orgId, agentId, callId,
// provider and external ids. Every payload goes through redact(): no secrets,
// masked phone numbers, no transcripts.
//
// Usage:
//   const log = createLogger({ requestId, orgId, route: 'agent.patch' })
//   log.info('agent.sync.ok', { provider: 'elevenlabs', externalId })
//   log.error('agent.sync.failed', err, { provider: 'elevenlabs' })

import { redact } from '@/lib/security/redact'
import { isProviderError } from '@/lib/voice-providers/errors'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  requestId?: string
  orgId?: string | null
  agentId?: string | null
  callId?: string | null
  provider?: string | null
  route?: string
  [key: string]: unknown
}

export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void
  info(event: string, fields?: Record<string, unknown>): void
  warn(event: string, fields?: Record<string, unknown>): void
  error(event: string, err?: unknown, fields?: Record<string, unknown>): void
  child(ctx: LogContext): Logger
  readonly context: LogContext
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function minLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? '').toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw
  return process.env.NODE_ENV === 'test' ? 'error' : 'info'
}

/** Serializes an error without its stack in production and without secrets. */
export function describeError(err: unknown): Record<string, unknown> {
  if (isProviderError(err)) {
    return {
      kind: 'provider',
      system: err.system,
      code: err.code,
      operation: err.operation,
      status: err.status,
      detail: err.detail,
    }
  }
  if (err instanceof Error) {
    return {
      kind: 'error',
      name: err.name,
      message: err.message,
      ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack.split('\n').slice(0, 6).join('\n') } : {}),
    }
  }
  if (err && typeof err === 'object' && 'message' in err) {
    // Supabase/PostgREST errors are plain objects: { message, code, details, hint }.
    const o = err as { message?: unknown; code?: unknown }
    return { kind: 'object', message: String(o.message ?? ''), code: o.code ?? null }
  }
  return { kind: typeof err, value: err === undefined ? null : String(err) }
}

function emit(level: LogLevel, ctx: LogContext, event: string, fields?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return
  const line = redact({
    level,
    event,
    ts: new Date().toISOString(),
    ...ctx,
    ...(fields ?? {}),
  })
  const text = JSON.stringify(line)
  if (level === 'error') console.error(text)
  else if (level === 'warn') console.warn(text)
  else console.log(text)
}

export function createLogger(ctx: LogContext = {}): Logger {
  return {
    context: ctx,
    debug: (event, fields) => emit('debug', ctx, event, fields),
    info: (event, fields) => emit('info', ctx, event, fields),
    warn: (event, fields) => emit('warn', ctx, event, fields),
    error: (event, err, fields) => emit('error', ctx, event, { ...(fields ?? {}), ...(err !== undefined ? { error: describeError(err) } : {}) }),
    child: (extra) => createLogger({ ...ctx, ...extra }),
  }
}

/** A request id: Vercel's own id when present (correlates with platform logs), else a UUID. */
export function requestIdFrom(request: Request | null | undefined): string {
  const fromHeader = request?.headers.get('x-request-id') ?? request?.headers.get('x-vercel-id')
  if (fromHeader && /^[A-Za-z0-9:._-]{6,128}$/.test(fromHeader)) return fromHeader
  return crypto.randomUUID()
}

import 'server-only'
// Bounded reads of streamed provider responses. A response requested with
// responseKind 'response' has no deadline once its headers arrived
// (lib/voice-providers/http.ts), so the caller must bound both the size and
// the time it spends on the body.

import { ProviderError, type ExternalSystem } from '@/lib/voice-providers/errors'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ component: 'provider_body' })

export interface TextPrefix {
  text: string
  /** True when the body was longer than maxBytes (the rest was not read). */
  truncated: boolean
}

/**
 * Reads at most maxBytes of a text body under its own deadline, then cancels
 * the rest of the stream. A deadline hit after some bytes arrived returns that
 * prefix (marked truncated); with nothing read it is a 'timeout' ProviderError.
 */
export async function readTextPrefix(
  res: Response,
  opts: { maxBytes: number; timeoutMs: number; system: ExternalSystem; operation: string },
): Promise<TextPrefix> {
  if (!res.body) return { text: '', truncated: false }
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let text = ''
  let total = 0
  let truncated = false
  let timedOut = false
  const cancel = (reason: string) =>
    reader.cancel().catch((err: unknown) => {
      // The stream is abandoned either way; a failed cancel only leaks the socket until GC.
      log.debug('provider_body.cancel_failed', { system: opts.system, operation: opts.operation, reason, error: err instanceof Error ? err.name : 'cancel failed' })
    })
  const timer = setTimeout(() => {
    timedOut = true
    void cancel('deadline')
  }, opts.timeoutMs)
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done || !value) break
      const room = opts.maxBytes - total
      const chunk = value.byteLength > room ? value.subarray(0, room) : value
      total += chunk.byteLength
      text += decoder.decode(chunk, { stream: true })
      if (value.byteLength > room || total >= opts.maxBytes) {
        truncated = value.byteLength > room || !(await isDrained(reader))
        if (truncated) await cancel('size')
        break
      }
    }
  } catch (err) {
    // A read aborted by our own deadline is reported below; anything else is a real failure.
    if (!timedOut) throw err
  } finally {
    clearTimeout(timer)
  }
  if (timedOut) {
    if (!text) throw new ProviderError({ system: opts.system, operation: opts.operation, code: 'timeout', detail: 'body deadline' })
    truncated = true
  }
  if (!truncated) text += decoder.decode()
  return { text, truncated }
}

/** After exactly maxBytes were read: true when the stream has nothing more. */
async function isDrained(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<boolean> {
  const next = await reader.read()
  return next.done || !next.value || next.value.byteLength === 0
}

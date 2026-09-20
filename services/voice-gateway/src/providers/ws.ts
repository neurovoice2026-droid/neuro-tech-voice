import WebSocket from 'ws'
import type { ProviderName } from '../breaker'
import { ProviderError, type ProviderComponent } from './errors'

// Opening provider WebSockets with a hard handshake deadline and a structured
// error when the server refuses the upgrade (Cartesia and ElevenLabs answer a
// refused handshake with an HTTP status and a JSON body that names the error).

const MAX_ERROR_BODY_BYTES = 8 * 1024

export interface ConnectOptions {
  provider: ProviderName
  component: ProviderComponent
  headers?: Record<string, string>
  timeoutMs: number
  /** Largest message we accept from the provider. */
  maxPayload?: number
}

function readErrorBody(res: import('node:http').IncomingMessage): Promise<{ code: string | null; message: string | null }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    const done = () => {
      const text = Buffer.concat(chunks).toString('utf8')
      try {
        const body = JSON.parse(text) as Record<string, unknown>
        const nested = (body.detail && typeof body.detail === 'object' ? body.detail : body.error && typeof body.error === 'object' ? body.error : body) as Record<string, unknown>
        const code = [nested.error_code, nested.code, nested.status, body.error_code].find((v) => typeof v === 'string') as string | undefined
        const message = [nested.message, nested.title, body.message].find((v) => typeof v === 'string') as string | undefined
        resolve({ code: code ?? null, message: message ?? null })
      } catch {
        resolve({ code: null, message: null })
      }
    }
    res.on('data', (chunk: Buffer) => {
      if (size < MAX_ERROR_BODY_BYTES) chunks.push(chunk)
      size += chunk.length
    })
    res.on('end', done)
    res.on('error', done)
    setTimeout(done, 1000).unref()
  })
}

export function connectWebSocket(url: string, options: ConnectOptions): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let settled = false
    const ws = new WebSocket(url, {
      headers: options.headers,
      handshakeTimeout: options.timeoutMs,
      maxPayload: options.maxPayload ?? 16 * 1024 * 1024,
      perMessageDeflate: false,
    })

    const fail = (error: ProviderError) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.removeAllListeners('open')
      // Keep an error listener: a late socket error must not become an uncaught exception.
      ws.on('error', () => {})
      try {
        ws.terminate()
      } catch {
        // already gone
      }
      reject(error)
    }

    const timer = setTimeout(() => {
      fail(
        new ProviderError({
          provider: options.provider,
          component: options.component,
          message: `${options.provider} ${options.component} connect timed out after ${options.timeoutMs} ms`,
          code: 'connect_timeout',
        })
      )
    }, options.timeoutMs)

    ws.once('open', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(ws)
    })

    ws.once('unexpected-response', (_req, res) => {
      const status = res.statusCode ?? 0
      void readErrorBody(res).then(({ code, message }) => {
        fail(
          new ProviderError({
            provider: options.provider,
            component: options.component,
            message: `${options.provider} ${options.component} refused the connection (${status}${code ? ` ${code}` : ''})${message ? `: ${message}` : ''}`,
            status,
            code,
          })
        )
      })
    })

    ws.on('error', (err) => {
      fail(
        new ProviderError({
          provider: options.provider,
          component: options.component,
          message: `${options.provider} ${options.component} connection failed: ${err.message}`,
          code: 'network_error',
          cause: err,
        })
      )
    })
  })
}

/** Sends if the socket is open; returns false otherwise (callers decide whether that matters). */
export function safeSend(ws: WebSocket | null, data: string | Buffer): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  try {
    ws.send(data)
    return true
  } catch {
    return false
  }
}

/** Closes gracefully, then terminates if the peer doesn't finish the close handshake. */
export function closeSocket(ws: WebSocket | null, code = 1000, reason = '', graceMs = 2000): void {
  if (!ws) return
  if (ws.readyState === WebSocket.CLOSED) return
  try {
    if (ws.readyState === WebSocket.OPEN) ws.close(code, reason)
    else if (ws.readyState === WebSocket.CONNECTING) {
      ws.terminate()
      return
    }
  } catch {
    // fall through to terminate
  }
  const timer = setTimeout(() => {
    try {
      ws.terminate()
    } catch {
      // already closed
    }
  }, graceMs)
  timer.unref()
  ws.once('close', () => clearTimeout(timer))
}

export function rawDataToString(data: WebSocket.RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
  return Buffer.from(data).toString('utf8')
}

export function rawDataToBuffer(data: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (Array.isArray(data)) return Buffer.concat(data)
  return Buffer.from(data)
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

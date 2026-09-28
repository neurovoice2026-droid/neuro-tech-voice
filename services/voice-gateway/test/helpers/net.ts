import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'

// Small building blocks for the offline mock servers.

export interface MockHttpServer {
  server: Server
  port: number
  baseUrl: string
  wsBaseUrl: string
  close(): Promise<void>
}

export type HttpHandler = (req: IncomingMessage, res: ServerResponse, body: string) => void | Promise<void>
export type WsHandler = (ws: WebSocket, req: IncomingMessage, url: URL) => void

export async function startMockServer(options: { http?: HttpHandler; ws?: (url: URL) => WsHandler | null }): Promise<MockHttpServer> {
  const wss = new WebSocketServer({ noServer: true })
  const sockets = new Set<Duplex>()
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      if (!options.http) {
        res.writeHead(404).end()
        return
      }
      Promise.resolve(options.http(req, res, body)).catch((error: unknown) => {
        if (!res.headersSent) res.writeHead(500)
        res.end(String(error))
      })
    })
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://mock.local')
    const handler = options.ws?.(url) ?? null
    if (!handler) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => handler(ws, req, url))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    server,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    wsBaseUrl: `ws://127.0.0.1:${port}`,
    async close() {
      for (const client of wss.clients) client.terminate()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

export function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Polls until `predicate` is truthy (returns its value) or fails after `timeoutMs`. */
export async function waitFor<T>(predicate: () => T | undefined | null | false, timeoutMs = 5_000, label = 'condition'): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = predicate()
    if (value) return value
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`)
    await sleep(10)
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function parseMessage(data: WebSocket.RawData): Record<string, unknown> | null {
  try {
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : Array.isArray(data) ? Buffer.concat(data).toString('utf8') : Buffer.from(data).toString('utf8')
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

/** μ-law tone (speech-like energy for the VAD) of `ms` milliseconds. */
export function mulawTone(ms: number, amplitude = 9000, frequency = 220): Buffer {
  const samples = Math.round((ms / 1000) * 8000)
  const out = Buffer.alloc(samples)
  for (let i = 0; i < samples; i++) {
    const s = Math.round(amplitude * Math.sin((2 * Math.PI * frequency * i) / 8000))
    out[i] = encodeMulaw(s)
  }
  return out
}

export function pcm16Tone(ms: number, amplitude = 9000, frequency = 220): Buffer {
  const samples = Math.round((ms / 1000) * 16000)
  const out = Buffer.alloc(samples * 2)
  for (let i = 0; i < samples; i++) out.writeInt16LE(Math.round(amplitude * Math.sin((2 * Math.PI * frequency * i) / 16000)), i * 2)
  return out
}

function encodeMulaw(sample: number): number {
  const BIAS = 0x84
  const CLIP = 32635
  let s = sample
  const sign = s < 0 ? 0x80 : 0
  if (sign) s = -s
  if (s > CLIP) s = CLIP
  s += BIAS
  let exponent = 7
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--
  const mantissa = (s >> (exponent + 3)) & 0x0f
  return ~(sign | (exponent << 4) | mantissa) & 0xff
}

import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import type { AppClient } from './app-client'
import { LocalBreakers } from './breaker'
import type { GatewayConfig } from './config'
import type { Logger } from './log'
import { CallSession, SessionRegistry } from './session'
import { verifySessionToken } from './signing'

// HTTP + WebSocket front door.
//   GET /health            → 200 {status} (503 while draining); active calls,
//                            providers and breakers only with the
//                            HEALTH_DETAILS_TOKEN bearer token
//   WS  /twilio            → Twilio Media Streams (auth: signed token in `start`)
//   WS  /browser?token=…   → dashboard test call (auth: signed token, checked before upgrade)
// Everything else is refused before a WebSocket is created. Capacity and
// draining are enforced at the upgrade, so a refused Twilio stream falls back
// through the app's <Connect action> instead of hanging.

const HEARTBEAT_MS = 20_000
/** Unauthenticated /twilio sockets one address may hold at once (Twilio sends `start` immediately). */
export const MAX_PENDING_PER_IP = 10
const TWILIO_MAX_PAYLOAD = 256 * 1024
const BROWSER_MAX_PAYLOAD = 128 * 1024

export interface GatewayServer {
  readonly http: Server
  readonly registry: SessionRegistry
  readonly breakers: LocalBreakers
  listen(port?: number, host?: string): Promise<number>
  shutdown(): Promise<void>
}

export interface GatewayServerOptions {
  config: GatewayConfig
  log: Logger
  /** Tests inject an app client with fast retries. */
  app?: AppClient
}

const startedAt = Date.now()

function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/** Health details (capacity, providers, breakers) are for operators only. */
function wantsHealthDetails(req: IncomingMessage, token: string | null): boolean {
  if (!token) return false
  const header = req.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return !!match && sameSecret(match[1].trim(), token)
}

/** Fly's proxy puts the caller's address in Fly-Client-IP; elsewhere the socket's peer is it. */
export function upgradeClientIp(req: IncomingMessage): string | null {
  const fly = req.headers['fly-client-ip']
  const value = Array.isArray(fly) ? fly[0] : fly
  if (value && /^[0-9a-f:.]{2,45}$/i.test(value.trim())) return value.trim()
  return req.socket.remoteAddress ?? null
}

function reject(socket: Duplex, status: number, message: string): void {
  const body = JSON.stringify({ error: { code: message.toLowerCase().replace(/\s+/g, '_'), message } })
  try {
    socket.write(
      `HTTP/1.1 ${status} ${message}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
    )
  } catch {
    // socket already gone
  }
  socket.destroy()
}

export function createGatewayServer(options: GatewayServerOptions): GatewayServer {
  const { config, log } = options
  const registry = new SessionRegistry()
  const breakers = new LocalBreakers()
  const twilioWss = new WebSocketServer({ noServer: true, maxPayload: TWILIO_MAX_PAYLOAD, perMessageDeflate: false })
  const browserWss = new WebSocketServer({ noServer: true, maxPayload: BROWSER_MAX_PAYLOAD, perMessageDeflate: false })
  const alive = new WeakMap<WebSocket, boolean>()

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0]
    if (req.method === 'GET' && (path === '/health' || path === '/')) {
      const status = registry.draining ? 503 : 200
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      const state = registry.draining ? 'draining' : 'ok'
      if (!wantsHealthDetails(req, config.healthDetailsToken)) {
        // Public: enough for load balancers, nothing that helps size an attack.
        res.end(JSON.stringify({ status: state }))
        return
      }
      res.end(
        JSON.stringify({
          status: state,
          active_calls: registry.activeCount,
          max_calls: config.maxConcurrentCalls,
          uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
          providers: {
            cartesia: !!config.cartesia.apiKey,
            openai: !!config.openai.apiKey,
            elevenlabs: !!config.elevenlabs.apiKey,
          },
          breakers: breakers.snapshot(),
        })
      )
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }))
  })
  http.keepAliveTimeout = 65_000
  http.headersTimeout = 70_000

  const heartbeat = setInterval(() => {
    for (const wss of [twilioWss, browserWss]) {
      for (const client of wss.clients) {
        if (alive.get(client) === false) {
          client.terminate()
          continue
        }
        alive.set(client, false)
        try {
          client.ping()
        } catch {
          client.terminate()
        }
      }
    }
  }, HEARTBEAT_MS)
  heartbeat.unref()

  const track = (ws: WebSocket) => {
    alive.set(ws, true)
    ws.on('pong', () => alive.set(ws, true))
    // Live calls send audio every 20–100 ms; count that as liveness too, so a
    // peer that doesn't answer ping frames is never cut off mid-call.
    ws.on('message', () => alive.set(ws, true))
  }

  const deps = () => ({ config, log, breakers, registry, ...(options.app ? { app: options.app } : {}) })

  http.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    socket.on('error', () => socket.destroy())
    let url: URL
    try {
      url = new URL(req.url ?? '/', 'http://gateway.local')
    } catch {
      reject(socket, 400, 'Bad Request')
      return
    }
    if (url.pathname !== '/twilio' && url.pathname !== '/browser') {
      reject(socket, 404, 'Not Found')
      return
    }
    if (registry.draining) {
      reject(socket, 503, 'Service Unavailable')
      return
    }
    if (registry.activeCount >= config.maxConcurrentCalls) {
      log.warn('refusing stream: gateway at capacity', { active_calls: registry.activeCount })
      reject(socket, 503, 'Service Unavailable')
      return
    }

    if (url.pathname === '/twilio') {
      // Twilio authenticates inside the stream (`start` carries the token): cap
      // sockets that haven't done so, so idle pre-auth connections can't fill capacity.
      const clientIp = upgradeClientIp(req)
      if (registry.pendingCount >= Math.max(20, Math.ceil(config.maxConcurrentCalls / 2))) {
        log.warn('refusing stream: too many unauthenticated connections')
        reject(socket, 503, 'Service Unavailable')
        return
      }
      // One address can't take the whole pre-auth allowance.
      if (clientIp && registry.pendingCountFor(clientIp) >= MAX_PENDING_PER_IP) {
        log.warn('refusing stream: too many unauthenticated connections from one address')
        reject(socket, 429, 'Too Many Requests')
        return
      }
      twilioWss.handleUpgrade(req, socket, head, (ws) => {
        track(ws)
        CallSession.runTwilio(ws, deps(), clientIp).catch((error: unknown) => {
          log.error('twilio session crashed', { error: error instanceof Error ? error.message : String(error) })
          ws.terminate()
        })
      })
      return
    }

    const token = url.searchParams.get('token') ?? ''
    const payload = verifySessionToken(token, config.gatewaySecret)
    if (!payload || payload.ch !== 'browser') {
      reject(socket, 401, 'Unauthorized')
      return
    }
    const origin = req.headers.origin
    if (config.browserAllowedOrigins.length > 0 && origin && !config.browserAllowedOrigins.includes(origin.replace(/\/+$/, ''))) {
      log.warn('refusing browser stream from an unexpected origin')
      reject(socket, 403, 'Forbidden')
      return
    }
    browserWss.handleUpgrade(req, socket, head, (ws) => {
      track(ws)
      CallSession.runBrowser(ws, token, deps()).catch((error: unknown) => {
        log.error('browser session crashed', { error: error instanceof Error ? error.message : String(error) })
        ws.terminate()
      })
    })
  })

  return {
    http,
    registry,
    breakers,
    listen(port = config.port, host = config.host) {
      return new Promise((resolve, rejectListen) => {
        http.once('error', rejectListen)
        http.listen(port, host, () => {
          http.off('error', rejectListen)
          const address = http.address()
          resolve(typeof address === 'object' && address ? address.port : port)
        })
      })
    },
    async shutdown() {
      if (registry.draining) return
      registry.draining = true
      log.info('draining: no new calls accepted', { active_calls: registry.activeCount })
      http.close()
      const drained = await registry.waitForIdle(config.timings.shutdownDrainMs)
      if (!drained) {
        const remaining = registry.sessions()
        log.warn('drain timeout: ending remaining calls', { active_calls: remaining.length })
        await Promise.race([
          Promise.allSettled(remaining.map((s) => s.forceEnd())),
          new Promise((resolve) => setTimeout(resolve, 20_000).unref()),
        ])
      }
      clearInterval(heartbeat)
      for (const wss of [twilioWss, browserWss]) {
        for (const client of wss.clients) client.terminate()
        wss.close()
      }
      http.closeAllConnections?.()
    },
  }
}

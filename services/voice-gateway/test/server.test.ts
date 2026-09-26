import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { TwilioClient } from './helpers/clients'
import { makeSessionConfig, startHarness, type Harness } from './helpers/harness'
import { sleep, waitFor } from './helpers/net'

// Front door: health, routing, capacity and graceful drain.

let h: Harness
const clients: TwilioClient[] = []

beforeEach(async () => {
  h = await startHarness()
})

afterEach(async () => {
  for (const c of clients.splice(0)) c.dispose()
  await h.close()
})

function get(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { headers }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown> }))
      })
      .on('error', reject)
  })
}

function upgradeStatus(url: string): Promise<number> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url)
    ws.once('open', () => {
      ws.terminate()
      resolve(101)
    })
    ws.once('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0))
    ws.once('error', () => resolve(0))
  })
}

describe('gateway server', () => {
  it('reports only the status publicly, and active calls and providers to the ops token, without secrets', async () => {
    const httpBase = h.url.replace('ws://', 'http://')
    // Public: nothing that helps time or size a connection flood (SEC-13).
    const anonymous = await get(`${httpBase}/health`)
    expect(anonymous.status).toBe(200)
    expect(anonymous.body).toEqual({ status: 'ok' })
    const token = 'health-details-token-0123456789'
    h.config.healthDetailsToken = token
    expect((await get(`${httpBase}/health`, { authorization: 'Bearer wrong-token-0123456789abcdef' })).body).toEqual({ status: 'ok' })

    const auth = { authorization: `Bearer ${token}` }
    const idle = await get(`${httpBase}/health`, auth)
    expect(idle.status).toBe(200)
    expect(idle.body).toMatchObject({ status: 'ok', active_calls: 0, max_calls: 20, providers: { cartesia: true, openai: true, elevenlabs: true } })
    expect(JSON.stringify(idle.body)).not.toContain('sk_car_test')

    h.app.sessionConfig = () => makeSessionConfig()
    const twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    clients.push(twilio)
    await waitFor(() => h.app.sessions.length === 1, 3_000, 'session')
    const busy = await get(`${httpBase}/health`, auth)
    expect(busy.body.active_calls).toBe(1)
    expect((await get(`${httpBase}/nope`)).status).toBe(404)
  })

  it('caps unauthenticated /twilio sockets per address so one client cannot fill the pre-auth allowance (SEC-04)', async () => {
    const idle: WebSocket[] = []
    try {
      for (let i = 0; i < 10; i++) {
        const ws = new WebSocket(`${h.url}/twilio`)
        idle.push(ws)
        await new Promise<void>((resolve, reject) => {
          ws.once('open', () => resolve())
          ws.once('error', reject)
        })
      }
      await waitFor(() => h.gateway.registry.pendingCount === 10, 2_000, 'pending sockets')
      expect(await upgradeStatus(`${h.url}/twilio`)).toBe(429)
    } finally {
      for (const ws of idle) ws.terminate()
    }
    // Sockets that never send `start` are dropped after the start timeout; the address may connect again.
    await waitFor(() => h.gateway.registry.pendingCount === 0, 4_000, 'pending sockets gone')
    expect(await upgradeStatus(`${h.url}/twilio`)).toBe(101)
  })

  it('refuses unknown WebSocket paths and streams beyond capacity', async () => {
    expect(await upgradeStatus(`${h.url}/elsewhere`)).toBe(404)
    await h.close()
    h = await startHarness()
    h.config.maxConcurrentCalls = 1
    h.app.sessionConfig = () => makeSessionConfig()
    const first = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    clients.push(first)
    await waitFor(() => h.app.sessions.length === 1, 3_000, 'first session')
    expect(await upgradeStatus(`${h.url}/twilio`)).toBe(503)
  })

  it('drains on shutdown: refuses new streams, then ends remaining calls without hanging up', async () => {
    h.app.sessionConfig = () => makeSessionConfig()
    const twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    clients.push(twilio)
    await waitFor(() => h.app.events.some((e) => e.type === 'stream_started'), 3_000, 'call started')

    const shutdown = h.gateway.shutdown()
    expect(h.gateway.registry.draining).toBe(true)
    // Drain timeout in the harness is 1 s; the call is still up, so it gets ended.
    await shutdown
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('error')
    expect(h.app.callControls).toHaveLength(0)
    await waitFor(() => twilio.closed, 3_000, 'twilio closed')
    expect(h.gateway.registry.activeCount).toBe(0)
  })

  it('closes a call that is still loading its session config when the drain times out, and never starts it', async () => {
    let releaseConfig: () => void = () => {}
    h.app.sessionConfig = () => new Promise((resolve) => (releaseConfig = () => resolve(makeSessionConfig())))
    const twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    clients.push(twilio)
    await waitFor(() => h.app.sessions.length === 1, 3_000, 'session requested')

    // Harness drain timeout is 1 s; the config is still pending when it expires.
    await h.gateway.shutdown()
    await waitFor(() => twilio.closed, 3_000, 'twilio closed')
    expect(h.gateway.registry.activeCount).toBe(0)
    // No hang-up: the app's <Connect action> fallback takes the caller.
    expect(h.app.callControls).toHaveLength(0)

    // The config arriving late must not start providers or report the stream.
    releaseConfig()
    await sleep(300)
    expect(h.cartesia.sttConnections).toHaveLength(0)
    // A TTS socket may have been opened ahead (it needs no call settings), but nothing was synthesised.
    expect(h.cartesia.ttsConnections).toBeLessThanOrEqual(1)
    expect(h.cartesia.ttsMessages).toHaveLength(0)
    expect(h.app.events.some((e) => e.type === 'stream_started')).toBe(false)
    expect(h.app.finalizes).toHaveLength(0)
  })
})

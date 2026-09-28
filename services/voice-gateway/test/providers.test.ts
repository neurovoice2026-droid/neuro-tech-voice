import { EventEmitter } from 'node:events'
import { createServer as createTcpServer, type Server as TcpServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import type WebSocket from 'ws'
import { BrowserChannel } from '../src/channels/browser'
import { STALLED_CONSUMER_BYTES, TwilioChannel } from '../src/channels/twilio'
import { keepAliveFetch } from '../src/http'
import { silentLogger } from '../src/log'
import { ElevenLabsTts } from '../src/providers/elevenlabs-tts'
import { parseMessage, sleep, startMockServer, waitFor, type MockHttpServer } from './helpers/net'

// Provider and channel edge cases that the end-to-end call simulations don't reach.

describe('ElevenLabs TTS context lifecycle', () => {
  let server: MockHttpServer | null = null

  afterEach(async () => {
    await server?.close()
    server = null
  })

  async function startTtsServer(options: { sendFinal: boolean; finalAfterEveryFlush?: boolean }) {
    const received: Record<string, unknown>[] = []
    server = await startMockServer({
      ws: (url) =>
        /\/multi-stream-input$/.test(url.pathname)
          ? (ws) => {
              ws.on('message', (data) => {
                const msg = parseMessage(data)
                if (!msg) return
                received.push(msg)
                const id = String(msg.context_id ?? '')
                if (typeof msg.text === 'string' && msg.text.trim()) {
                  ws.send(JSON.stringify({ audio: Buffer.alloc(400, 0x33).toString('base64'), contextId: id, isFinal: null }))
                  if (options.finalAfterEveryFlush) ws.send(JSON.stringify({ isFinal: true, contextId: id }))
                }
                if (msg.close_context === true && options.sendFinal) {
                  setTimeout(() => ws.send(JSON.stringify({ isFinal: true, contextId: id })), 20)
                }
              })
            }
          : null,
    })
    const tts = new ElevenLabsTts({
      apiKey: 'xi-test',
      wsBase: server.wsBaseUrl,
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      modelId: 'eleven_flash_v2_5',
      language: 'en',
      speed: null,
      callId: 'call',
      format: 'mulaw_8000',
      connectTimeoutMs: 1_500,
      log: silentLogger,
      finalQuietMs: 300,
    })
    await tts.connect()
    return { tts, received }
  }

  it('finishes a closed context even when isFinal never arrives', async () => {
    const { tts } = await startTtsServer({ sendFinal: false })
    const stream = tts.createStream()
    let audio = 0
    let done = false
    stream.on('audio', (chunk) => (audio += chunk.length))
    stream.on('done', () => (done = true))
    stream.push('Hello there. ')
    stream.end()
    await waitFor(() => done, 2_000, 'done without isFinal')
    expect(audio).toBe(400)
    tts.close()
  })

  it('ignores an isFinal that arrives before the context was closed', async () => {
    const { tts } = await startTtsServer({ sendFinal: true, finalAfterEveryFlush: true })
    const stream = tts.createStream()
    let audio = 0
    let done = false
    stream.on('audio', (chunk) => (audio += chunk.length))
    stream.on('done', () => (done = true))
    stream.push('First sentence. ')
    await sleep(100)
    expect(done).toBe(false)
    stream.push('Second sentence. ')
    await waitFor(() => audio === 800, 2_000, 'audio for both sentences')
    stream.end()
    await waitFor(() => done, 2_000, 'done after close_context')
    tts.close()
  })
})

class FakeSocket extends EventEmitter {
  readyState = 1
  readonly sent: (Buffer | string)[] = []
  send(data: Buffer | string): void {
    this.sent.push(typeof data === 'string' ? data : Buffer.from(data))
  }
  close(): void {
    this.readyState = 3
    this.emit('close', 1000)
  }
  terminate(): void {
    this.close()
  }
}

describe('browser channel output', () => {
  it('never sends half a PCM16 sample: an odd trailing byte waits for the next chunk', () => {
    const socket = new FakeSocket()
    const channel = new BrowserChannel(socket as unknown as WebSocket, silentLogger)
    channel.sendAudio(Buffer.from([1, 2, 3]))
    channel.sendAudio(Buffer.from([4, 5, 6, 7, 8]))
    const binary = socket.sent.filter((s): s is Buffer => Buffer.isBuffer(s))
    expect(binary.map((b) => [...b])).toEqual([
      [1, 2],
      [3, 4, 5, 6, 7, 8],
    ])
    // A clear drops the dangling byte instead of prefixing it to the next reply.
    channel.sendAudio(Buffer.from([9]))
    channel.clear()
    channel.sendAudio(Buffer.from([10, 11]))
    const after = socket.sent.filter((s): s is Buffer => Buffer.isBuffer(s))
    expect([...after.at(-1)!]).toEqual([10, 11])
    expect(after.every((b) => b.length % 2 === 0)).toBe(true)
  })
})

describe('outbound HTTP keep-alive (PERF-03)', () => {
  // A bare HTTP/1.1 server that, like many APIs, sends no Keep-Alive hint.
  async function countingServer(): Promise<{ server: TcpServer; url: string; connections: () => number }> {
    let connections = 0
    const server = createTcpServer((socket) => {
      connections += 1
      let buffered = ''
      socket.on('data', (chunk) => {
        buffered += chunk.toString('latin1')
        const END = '\r\n\r\n'
        while (buffered.includes(END)) {
          buffered = buffered.slice(buffered.indexOf(END) + 4)
          socket.write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}')
        }
      })
      socket.on('error', () => {})
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    return { server, url: `http://127.0.0.1:${port}/`, connections: () => connections }
  }

  it('reuses the connection across a gap longer than the built-in fetch keeps idle sockets', async () => {
    const [pooled, builtIn] = await Promise.all([countingServer(), countingServer()])
    try {
      await Promise.all([(await keepAliveFetch(pooled.url)).text(), (await fetch(builtIn.url)).text()])
      // Longer than undici's 4 s default idle timeout without a server hint.
      await sleep(4_600)
      await Promise.all([(await keepAliveFetch(pooled.url)).text(), (await fetch(builtIn.url)).text()])
      expect(builtIn.connections()).toBe(2)
      expect(pooled.connections()).toBe(1)
    } finally {
      for (const s of [pooled.server, builtIn.server]) s.close()
    }
  }, 15_000)
})

describe('Twilio channel backpressure (PERF-19)', () => {
  it('closes a stream whose peer stopped reading instead of buffering audio forever', async () => {
    const sent: string[] = []
    let closedWith: number | null = null
    const ws = Object.assign(new EventEmitter(), {
      readyState: 1,
      bufferedAmount: 0,
      send: (data: string) => sent.push(data),
      close: (code: number) => {
        closedWith = code
      },
      terminate: () => {},
    })
    const channel = new TwilioChannel(ws as unknown as WebSocket, silentLogger)
    ws.emit('message', Buffer.from(JSON.stringify({ event: 'start', start: { streamSid: 'MZ1', callSid: 'CA1', customParameters: {} } })), false)
    channel.sendAudio(Buffer.alloc(160, 0xff))
    expect(channel.failed).toBe(false)
    ws.bufferedAmount = STALLED_CONSUMER_BYTES + 1
    channel.sendAudio(Buffer.alloc(160, 0xff))
    expect(channel.failed).toBe(true)
    expect(closedWith).toBe(1011)
    const before = sent.length
    channel.sendAudio(Buffer.alloc(160, 0xff))
    expect(sent.length).toBe(before)
  })
})

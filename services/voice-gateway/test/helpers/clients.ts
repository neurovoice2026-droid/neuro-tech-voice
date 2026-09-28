import WebSocket from 'ws'
import { parseMessage, sleep } from './net'

// Twilio Media Streams and dashboard browser clients driving the gateway.
// The Twilio client simulates playback: agent audio "plays" at real time
// (times `playbackRate`), marks echo when playback reaches them, and a clear
// flushes the buffer and echoes pending marks, like Twilio does.

export class TwilioClient {
  readonly received: Record<string, unknown>[] = []
  mediaBytes = 0
  lastMediaAt = 0
  clears = 0
  closed = false
  closeCode: number | null = null
  private played = 0
  private pendingMarks: { name: string; at: number }[] = []
  private timer: NodeJS.Timeout
  private sequence = 1

  private constructor(
    readonly ws: WebSocket,
    readonly streamSid: string,
    private readonly playbackRate: number
  ) {
    ws.on('message', (data) => {
      const msg = parseMessage(data)
      if (!msg) return
      this.received.push({ ...msg, receivedAt: Date.now() })
      if (msg.event === 'media') {
        const payload = (msg.media as { payload: string }).payload
        this.mediaBytes += Buffer.from(payload, 'base64').length
        this.lastMediaAt = Date.now()
      } else if (msg.event === 'mark') {
        this.pendingMarks.push({ name: (msg.mark as { name: string }).name, at: this.mediaBytes })
      } else if (msg.event === 'clear') {
        this.clears += 1
        this.played = this.mediaBytes
        this.echoMarks(true)
      }
    })
    ws.on('close', (code) => {
      this.closed = true
      this.closeCode = code
    })
    this.timer = setInterval(() => {
      this.played = Math.min(this.mediaBytes, this.played + 160 * this.playbackRate)
      this.echoMarks(false)
    }, 20)
  }

  static async connect(gatewayUrl: string, token: string, options: { callSid?: string; playbackRate?: number } = {}): Promise<TwilioClient> {
    const ws = new WebSocket(`${gatewayUrl}/twilio`)
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })
    const streamSid = `MZ${Math.random().toString(16).slice(2).padEnd(32, '0')}`
    const client = new TwilioClient(ws, streamSid, options.playbackRate ?? 1)
    client.send({ event: 'connected', protocol: 'Call', version: '1.0.0' })
    client.send({
      event: 'start',
      sequenceNumber: '1',
      start: {
        accountSid: 'ACtest',
        streamSid,
        callSid: options.callSid ?? 'CAtest',
        tracks: ['inbound'],
        mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        customParameters: { session: token },
      },
      streamSid,
    })
    return client
  }

  get marksPending(): number {
    return this.pendingMarks.length
  }

  /** Agent audio arrived, stopped arriving `quietMs` ago, and every mark has played. */
  playedOut(quietMs = 150): boolean {
    return this.mediaBytes > 0 && this.pendingMarks.length === 0 && Date.now() - this.lastMediaAt > quietMs
  }

  send(message: Record<string, unknown>): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message))
  }

  /** Caller audio in 20 ms frames; paced in real time unless `burst`. */
  async sendAudio(mulaw: Buffer, options: { burst?: boolean } = {}): Promise<void> {
    for (let offset = 0; offset < mulaw.length; offset += 160) {
      this.sequence += 1
      this.send({
        event: 'media',
        sequenceNumber: String(this.sequence),
        media: { track: 'inbound', chunk: String(this.sequence), timestamp: String(this.sequence * 20), payload: mulaw.subarray(offset, offset + 160).toString('base64') },
        streamSid: this.streamSid,
      })
      if (!options.burst) await sleep(20)
    }
  }

  sendDtmf(digit: string): void {
    this.send({ event: 'dtmf', streamSid: this.streamSid, sequenceNumber: '9', dtmf: { track: 'inbound_track', digit } })
  }

  stop(): void {
    this.send({ event: 'stop', sequenceNumber: '99', streamSid: this.streamSid, stop: { accountSid: 'ACtest', callSid: 'CAtest' } })
    setTimeout(() => this.ws.close(1000), 30)
  }

  dispose(): void {
    clearInterval(this.timer)
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) this.ws.terminate()
  }

  private echoMarks(all: boolean): void {
    const ready = all ? this.pendingMarks : this.pendingMarks.filter((m) => m.at <= this.played)
    if (ready.length === 0) return
    this.pendingMarks = all ? [] : this.pendingMarks.filter((m) => m.at > this.played)
    for (const mark of ready) this.send({ event: 'mark', sequenceNumber: '5', streamSid: this.streamSid, mark: { name: mark.name } })
  }
}

export class BrowserClient {
  readonly messages: Record<string, unknown>[] = []
  audioBytes = 0
  closed = false

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        this.audioBytes += (data as Buffer).length
        return
      }
      const msg = parseMessage(data)
      if (msg) this.messages.push(msg)
    })
    ws.on('close', () => (this.closed = true))
  }

  static async connect(gatewayUrl: string, token: string): Promise<BrowserClient> {
    const ws = new WebSocket(`${gatewayUrl}/browser?token=${encodeURIComponent(token)}`)
    const client = new BrowserClient(ws)
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
      ws.once('unexpected-response', (_req, res) => reject(new Error(`upgrade refused: ${res.statusCode}`)))
    })
    return client
  }

  async sendPcm(pcm: Buffer, frameBytes = 640): Promise<void> {
    for (let offset = 0; offset < pcm.length; offset += frameBytes) {
      if (this.ws.readyState !== WebSocket.OPEN) return
      this.ws.send(pcm.subarray(offset, offset + frameBytes), { binary: true })
      await sleep(20)
    }
  }

  hangup(): void {
    this.ws.send(JSON.stringify({ type: 'hangup' }))
  }

  dispose(): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.terminate()
  }
}

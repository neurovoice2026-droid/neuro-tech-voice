// Real-time pacing for audio sent to STT providers. Cartesia asks for ~100 ms
// frames "paced in real time" (bursting produces server errors), which live
// channel audio already is; replayed audio (the 2 s ring buffer after an STT
// switch) is not. A token bucket lets live frames through immediately and
// spreads bursts out, and a bounded queue drops the oldest audio if the
// provider stalls, so a slow provider never grows memory or latency unbounded.
// A backlog (replay, or a network burst of channel frames) drains slightly
// faster than real time: at exactly 1x it would never shrink while live audio
// keeps arriving, and the provider would hear the caller late for the rest of the call.

export interface PacedSenderOptions {
  bytesPerSecond: number
  /** Bytes allowed in one burst (e.g. 200 ms of audio). */
  burstBytes: number
  /** Queue cap; older frames are dropped beyond it (e.g. 2 s of audio). */
  maxQueueBytes: number
  /** Sending rate as a multiple of real time while a backlog exists (default 1). */
  catchUpRate?: number
  /** Returns false when the frame could not be sent (socket not open). */
  send: (frame: Buffer) => boolean
  onDrop?: (bytes: number) => void
}

export class PacedSender {
  private tokens: number
  private lastRefill = Date.now()
  private queue: Buffer[] = []
  private queuedBytes = 0
  private timer: NodeJS.Timeout | null = null
  private stopped = false
  sentBytes = 0

  private readonly rate: number

  constructor(private readonly options: PacedSenderOptions) {
    this.tokens = options.burstBytes
    this.rate = options.bytesPerSecond * Math.max(1, options.catchUpRate ?? 1)
  }

  enqueue(frame: Buffer): void {
    if (this.stopped || frame.length === 0) return
    this.queue.push(frame)
    this.queuedBytes += frame.length
    while (this.queuedBytes > this.options.maxQueueBytes && this.queue.length > 1) {
      const dropped = this.queue.shift()!
      this.queuedBytes -= dropped.length
      this.options.onDrop?.(dropped.length)
    }
    this.drain()
  }

  get queued(): number {
    return this.queuedBytes
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.queue = []
    this.queuedBytes = 0
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    this.lastRefill = now
    this.tokens = Math.min(this.options.burstBytes, this.tokens + (elapsed * this.rate) / 1000)
  }

  private drain(): void {
    if (this.timer || this.stopped) return
    this.refill()
    while (this.queue.length > 0) {
      const frame = this.queue[0]
      // A frame bigger than the burst still goes out once the bucket is full.
      const needed = Math.min(frame.length, this.options.burstBytes)
      if (this.tokens < needed) break
      this.queue.shift()
      this.queuedBytes -= frame.length
      this.tokens -= frame.length
      if (this.options.send(frame)) this.sentBytes += frame.length
      else this.options.onDrop?.(frame.length)
    }
    if (this.queue.length > 0) {
      const needed = Math.min(this.queue[0].length, this.options.burstBytes) - this.tokens
      const waitMs = Math.max(5, Math.ceil((needed * 1000) / this.rate))
      this.timer = setTimeout(() => {
        this.timer = null
        this.drain()
      }, waitMs)
      this.timer.unref()
    }
  }
}

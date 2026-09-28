import { describe, expect, it } from 'vitest'
import {
  AudioConverter,
  Framer,
  MULAW_8000,
  PCM_16000,
  RingBuffer,
  StreamResampler,
  mulawDecodeSample,
  mulawEncodeSample,
  mulawToSamples,
  pcm16BytesToSamples,
  rms,
  samplesToMulaw,
  samplesToPcm16Bytes,
  silence,
} from '../src/audio/codec'
import { PacedSender } from '../src/audio/pacer'
import { PlaybackTracker } from '../src/audio/playback'
import { EnergyVad } from '../src/audio/vad'
import type { CallChannel, ChannelEvents } from '../src/channels/types'
import { TypedEmitter } from '../src/util/emitter'
import { sleep } from './helpers/net'

function sine(samples: number, rate: number, frequency = 440, amplitude = 10_000): Int16Array {
  const out = new Int16Array(samples)
  for (let i = 0; i < samples; i++) out[i] = Math.round(amplitude * Math.sin((2 * Math.PI * frequency * i) / rate))
  return out
}

describe('G.711 μ-law', () => {
  it('matches the reference points and round-trips within quantisation error', () => {
    expect(mulawEncodeSample(0)).toBe(0xff)
    expect(mulawDecodeSample(0xff)).toBe(0)
    expect(mulawDecodeSample(0x00)).toBe(-32124)
    expect(mulawDecodeSample(0x80)).toBe(32124)
    for (const value of [-32000, -8000, -1000, -100, 0, 100, 1000, 8000, 32000]) {
      const decoded = mulawDecodeSample(mulawEncodeSample(value))
      // μ-law steps grow with amplitude: allow ~3 % + a small floor.
      expect(Math.abs(decoded - value)).toBeLessThanOrEqual(Math.abs(value) * 0.04 + 40)
    }
  })

  it('converts buffers both ways', () => {
    const samples = sine(160, 8000)
    const mulaw = samplesToMulaw(samples)
    expect(mulaw.length).toBe(160)
    const back = mulawToSamples(mulaw)
    expect(rms(back)).toBeCloseTo(rms(samples), 2)
    expect(silence(MULAW_8000, 100)).toEqual(Buffer.alloc(800, 0xff))
    expect(silence(PCM_16000, 20)).toEqual(Buffer.alloc(640, 0))
  })

  it('reads PCM16 from odd byte offsets safely', () => {
    const pcm = samplesToPcm16Bytes(Int16Array.from([1, -2, 300]))
    const padded = Buffer.concat([Buffer.from([9]), pcm]).subarray(1)
    expect(Array.from(pcm16BytesToSamples(padded))).toEqual([1, -2, 300])
  })
})

describe('resampling', () => {
  it('doubles and halves sample counts across chunk boundaries', () => {
    const up = new StreamResampler(8000, 16000)
    let total = 0
    for (let i = 0; i < 50; i++) total += up.process(sine(160, 8000)).length
    expect(Math.abs(total - 16_000)).toBeLessThanOrEqual(2)

    const down = new StreamResampler(16000, 8000)
    total = 0
    for (let i = 0; i < 50; i++) total += down.process(sine(320, 16000)).length
    expect(Math.abs(total - 8_000)).toBeLessThanOrEqual(2)
  })

  it('keeps an in-band tone and attenuates one above the new Nyquist', () => {
    const down = new StreamResampler(16000, 8000)
    const inBand = down.process(sine(16000, 16000, 1000))
    const alias = new StreamResampler(16000, 8000).process(sine(16000, 16000, 6000))
    expect(rms(inBand.subarray(200))).toBeGreaterThan(0.2)
    expect(rms(alias.subarray(200))).toBeLessThan(0.02)
  })

  it('transcodes PCM16 16 kHz → μ-law 8 kHz and back with stable lengths', () => {
    const toMulaw = new AudioConverter(PCM_16000, MULAW_8000)
    const toPcm = new AudioConverter(MULAW_8000, PCM_16000)
    const pcm = samplesToPcm16Bytes(sine(1600, 16000, 440))
    const mulaw = toMulaw.convert(pcm)
    expect(Math.abs(mulaw.length - 800)).toBeLessThanOrEqual(1)
    const again = toPcm.convert(mulaw)
    expect(Math.abs(again.length - 3200)).toBeLessThanOrEqual(4)
    // An odd trailing byte is carried to the next chunk, not dropped.
    const odd = new AudioConverter(PCM_16000, MULAW_8000)
    const a = odd.convert(pcm.subarray(0, 321))
    const b = odd.convert(pcm.subarray(321, 642))
    expect(a.length + b.length).toBeGreaterThanOrEqual(159)
    expect(new AudioConverter(MULAW_8000, MULAW_8000).passthrough).toBe(true)
  })
})

describe('framing and buffering', () => {
  it('re-chunks into exact frames', () => {
    const framer = new Framer(800)
    expect(framer.push(Buffer.alloc(500))).toHaveLength(0)
    const frames = framer.push(Buffer.alloc(1200))
    expect(frames.map((f) => f.length)).toEqual([800, 800])
    expect(framer.buffered).toBe(100)
    expect(framer.drain()?.length).toBe(100)
  })

  it('keeps only the most recent audio in the ring buffer', () => {
    const ring = new RingBuffer(1000)
    for (let i = 0; i < 10; i++) ring.push(Buffer.alloc(300, i))
    const snap = ring.snapshot()
    expect(snap.length).toBe(1000)
    expect(snap.at(-1)).toBe(9)
  })

  it('paces bursts to real time and drops the oldest audio beyond the lag cap', async () => {
    const sent: number[] = []
    let dropped = 0
    const sender = new PacedSender({
      bytesPerSecond: 8000,
      burstBytes: 1600,
      maxQueueBytes: 4000,
      send: (frame) => {
        sent.push(Date.now())
        return frame.length > 0
      },
      onDrop: (bytes) => (dropped += bytes),
    })
    const start = Date.now()
    for (let i = 0; i < 8; i++) sender.enqueue(Buffer.alloc(800))
    // Two frames leave at once (burst), six queue up: 4800 bytes > 4000 cap → oldest 800 dropped.
    expect(dropped).toBe(800)
    await sleep(700)
    sender.stop()
    // Two burst frames immediately, the rest ~100 ms apart.
    expect(sent.length).toBeGreaterThanOrEqual(4)
    expect(sent[1] - start).toBeLessThan(50)
    expect(sent.at(-1)! - start).toBeGreaterThan(200)
  })

  it('drains a replay backlog while live audio keeps arriving (catch-up rate)', async () => {
    const feed = async (catchUpRate: number) => {
      const sender = new PacedSender({ bytesPerSecond: 8000, burstBytes: 1600, maxQueueBytes: 40_000, catchUpRate, send: () => true })
      // 1 s replayed at once, then live 100 ms frames in real time for 1.2 s.
      for (let i = 0; i < 10; i++) sender.enqueue(Buffer.alloc(800))
      for (let i = 0; i < 12; i++) {
        await sleep(100)
        sender.enqueue(Buffer.alloc(800))
      }
      const backlog = sender.queued
      sender.stop()
      return backlog
    }
    const [realTime, catchUp] = await Promise.all([feed(1), feed(2)])
    // At 1x the backlog never shrinks; at 2x it is gone (at most a frame or two in flight).
    expect(realTime).toBeGreaterThanOrEqual(4_800)
    expect(catchUp).toBeLessThanOrEqual(1_600)
  })
})

describe('energy VAD', () => {
  it('detects speech start and end with hangover', () => {
    const vad = new EnergyVad(8000, { hangoverMs: 700 })
    const events = [...vad.process(sine(8000 * 0.1, 8000, 200, 50)), ...vad.process(sine(8000 * 0.8, 8000, 220, 9000))]
    expect(events.map((e) => e.type)).toEqual(['speech_start'])
    expect(vad.isSpeaking).toBe(true)
    expect(vad.process(new Int16Array(8000 * 0.5))).toEqual([])
    const end = vad.process(new Int16Array(8000 * 0.3))
    expect(end.map((e) => e.type)).toEqual(['speech_end'])
    expect(end[0].type === 'speech_end' && end[0].speechMs).toBeGreaterThan(500)
  })

  it('ignores short clicks and steady line noise', () => {
    const vad = new EnergyVad(8000)
    expect(vad.process(sine(8000 * 0.06, 8000, 300, 9000))).toEqual([])
    expect(vad.process(new Int16Array(8000))).toEqual([])
    expect(vad.process(sine(8000 * 2, 8000, 50, 120))).toEqual([])
  })
})

class FakeChannel extends TypedEmitter<ChannelEvents> implements CallChannel {
  readonly kind = 'twilio' as const
  readonly format = 'mulaw_8000' as const
  readonly isOpen = true
  marks: string[] = []
  clears = 0
  bytes = 0
  sendAudio(chunk: Buffer): void {
    this.bytes += chunk.length
  }
  sendMark(name: string): void {
    this.marks.push(name)
  }
  clear(): void {
    this.clears += 1
  }
  notify(): void {}
  close(): void {}
  echo(name: string): void {
    this.emit('mark', name)
  }
}

describe('playback tracker', () => {
  it('resolves markEnd when the mark echoes and reports cleared marks after a clear', async () => {
    const channel = new FakeChannel()
    const tracker = new PlaybackTracker(channel)
    tracker.write(Buffer.alloc(1600))
    expect(channel.marks.length).toBe(1) // progress mark every 200 ms of audio
    const end = tracker.markEnd()
    channel.echo(channel.marks.at(-1)!)
    await expect(end).resolves.toBe('played')

    tracker.write(Buffer.alloc(4000))
    const pending = tracker.markEnd()
    const heard = tracker.clear()
    await expect(pending).resolves.toBe('cleared')
    expect(channel.clears).toBe(1)
    expect(heard).toBeGreaterThanOrEqual(1600)
    expect(heard).toBeLessThanOrEqual(5600)
    // Twilio echoes flushed marks after a clear: they must not move the playhead.
    for (const name of channel.marks) channel.echo(name)
    expect(tracker.playedBytes()).toBe(5600)
    tracker.dispose()
  })

  it('estimates the playhead in real time between marks', async () => {
    const channel = new FakeChannel()
    const tracker = new PlaybackTracker(channel)
    tracker.write(Buffer.alloc(8000))
    await sleep(250)
    const played = tracker.playedBytes()
    expect(played).toBeGreaterThan(1200)
    expect(played).toBeLessThan(4000)
    expect(tracker.isIdle()).toBe(false)
    tracker.dispose()
  })
})

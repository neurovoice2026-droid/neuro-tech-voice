import { describe, expect, it } from 'vitest'
import { int16ToLeBytes } from './pcm'
import { PcmPlayer, scheduleStartTime, type PlayerContext } from './playback'

class FakeSource {
  buffer: { duration: number; data: Float32Array } | null = null
  startedAt: number | null = null
  stopped = false
  disconnected = false
  onended: (() => void) | null = null
  connect() {}
  disconnect() {
    this.disconnected = true
  }
  start(when: number) {
    this.startedAt = when
  }
  stop() {
    if (this.startedAt === null) throw new Error('InvalidStateError')
    this.stopped = true
    this.onended?.()
  }
}

function fakeContext() {
  const sources: FakeSource[] = []
  const ctx = {
    currentTime: 0,
    createBuffer(_channels: number, length: number, sampleRate: number) {
      const data = new Float32Array(length)
      return { duration: length / sampleRate, data, getChannelData: () => data }
    },
    createBufferSource() {
      const source = new FakeSource()
      sources.push(source)
      return source
    },
  }
  return { ctx, sources, player: new PcmPlayer(ctx as unknown as PlayerContext, { output: {} as AudioNode, leadSeconds: 0.05 }) }
}

/** `ms` of 16 kHz PCM16 bytes. */
function pcm(ms: number, value = 1000): ArrayBuffer {
  return int16ToLeBytes(new Int16Array((16000 * ms) / 1000).fill(value))
}

describe('scheduleStartTime', () => {
  it('appends to audio that is still queued', () => {
    expect(scheduleStartTime(1, 1.2, 0.05)).toBe(1.2)
  })

  it('starts after a short lead when the queue ran dry', () => {
    expect(scheduleStartTime(2, 1.5, 0.05)).toBeCloseTo(2.05)
    expect(scheduleStartTime(2, 2, 0.05)).toBeCloseTo(2.05)
    expect(scheduleStartTime(0, 0, 0.05)).toBeCloseTo(0.05)
  })
})

describe('PcmPlayer', () => {
  it('schedules consecutive chunks back to back', () => {
    const { ctx, sources, player } = fakeContext()
    player.enqueue(pcm(20))
    player.enqueue(pcm(40))
    ctx.currentTime = 0.03
    player.enqueue(pcm(20))
    expect(sources.map((s) => s.startedAt)).toEqual([0.05, 0.07, expect.closeTo(0.11, 6)])
    expect(player.isPlaying()).toBe(true)
    expect(player.bufferedSeconds()).toBeCloseTo(0.1, 6)
  })

  it('decodes the samples into the buffer', () => {
    const { sources, player } = fakeContext()
    player.enqueue(int16ToLeBytes(new Int16Array([32767, -32768])))
    expect(Array.from(sources[0].buffer!.data)).toEqual([1, -1])
  })

  it('restarts with a lead after an underrun', () => {
    const { ctx, sources, player } = fakeContext()
    player.enqueue(pcm(20))
    ctx.currentTime = 5
    expect(player.isPlaying()).toBe(false)
    player.enqueue(pcm(20))
    expect(sources[1].startedAt).toBeCloseTo(5.05)
  })

  it('clear stops everything queued and schedules fresh audio from now', () => {
    const { ctx, sources, player } = fakeContext()
    player.enqueue(pcm(500))
    player.enqueue(pcm(500))
    ctx.currentTime = 0.2
    player.clear()
    expect(sources.every((s) => s.stopped && s.disconnected)).toBe(true)
    expect(player.isPlaying()).toBe(false)
    player.enqueue(pcm(20))
    expect(sources[2].startedAt).toBeCloseTo(0.25)
  })

  it('drops a pending odd byte on clear so the next stream stays aligned', () => {
    const { sources, player } = fakeContext()
    player.enqueue(new Uint8Array([0x10]))
    expect(sources).toHaveLength(0)
    player.clear()
    player.enqueue(int16ToLeBytes(new Int16Array([32767])))
    expect(Array.from(sources[0].buffer!.data)).toEqual([1])
  })

  it('ignores audio after close', () => {
    const { sources, player } = fakeContext()
    player.close()
    player.enqueue(pcm(20))
    expect(sources).toHaveLength(0)
  })
})

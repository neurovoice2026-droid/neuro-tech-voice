// AudioWorklet for the dashboard test call: microphone float samples at the
// context rate → 16 kHz PCM16 little-endian frames of 20 ms, posted to the
// main thread with their RMS level. Mirrors lib/audio/pcm.ts
// (createStreamingDownsampler, floatToInt16Sample, createPcm16Framer, rms);
// lib/audio/pcm.test.ts runs this file against those helpers.
//
// Main thread → worklet: { type: 'mute', muted: boolean }
// Worklet → main thread: { type: 'frame', pcm: ArrayBuffer, rms: number }

const TARGET_RATE = 16000
const FRAME_SAMPLES = 320

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const opts = (options && options.processorOptions) || {}
    this.targetRate = opts.targetSampleRate > 0 ? opts.targetSampleRate : TARGET_RATE
    this.frameSamples = opts.frameSamples > 0 ? opts.frameSamples : FRAME_SAMPLES
    // `sampleRate` is the AudioWorkletGlobalScope's context rate.
    this.ratio = sampleRate / this.targetRate
    this.sum = 0
    this.count = 0
    this.position = 0
    this.boundary = this.ratio
    this.frame = new Float32Array(this.frameSamples)
    this.filled = 0
    this.muted = false
    this.port.onmessage = (event) => {
      const data = event.data
      if (data && data.type === 'mute') this.muted = data.muted === true
    }
  }

  emit(value) {
    this.frame[this.filled++] = this.muted ? 0 : value
    if (this.filled < this.frameSamples) return
    const buffer = new ArrayBuffer(this.frameSamples * 2)
    const view = new DataView(buffer)
    let energy = 0
    for (let i = 0; i < this.frameSamples; i++) {
      const raw = this.frame[i]
      const s = raw !== raw ? 0 : Math.max(-1, Math.min(1, raw))
      energy += s * s
      view.setInt16(i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true)
    }
    this.filled = 0
    this.port.postMessage({ type: 'frame', pcm: buffer, rms: Math.sqrt(energy / this.frameSamples) }, [buffer])
  }

  process(inputs) {
    const input = inputs[0]
    const channel = input && input[0]
    if (!channel) return true
    for (let i = 0; i < channel.length; i++) {
      this.sum += channel[i]
      this.count += 1
      this.position += 1
      if (this.position >= this.boundary) {
        const value = this.sum / this.count
        while (this.position >= this.boundary) {
          this.emit(value)
          this.boundary += this.ratio
        }
        this.sum = 0
        this.count = 0
        this.boundary -= this.position
        this.position = 0
      }
    }
    return true
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor)

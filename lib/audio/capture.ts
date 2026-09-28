// Microphone capture for the in-browser test call: getUserMedia with the
// browser's voice processing on, then public/worklets/pcm-capture.js turns
// the context-rate float stream into 20 ms PCM16 16 kHz frames off the main
// thread. Browser-only (call from event handlers or effects).

import { BROWSER_SAMPLE_RATE } from '@/lib/voice/contracts'
import { FRAME_SAMPLES } from './pcm'

export const PCM_CAPTURE_WORKLET_URL = '/worklets/pcm-capture.js'
const PROCESSOR_NAME = 'pcm-capture'

export interface MicCapture {
  setMuted(muted: boolean): void
  stop(): void
}

/** True when this browser has everything a browser test call needs. */
export function isBrowserCallSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.AudioContext === 'function' &&
    typeof window.AudioWorkletNode === 'function' &&
    typeof window.WebSocket === 'function' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

/** Asks for the microphone. Rejects with the browser's DOMException (see describeMicError). */
export async function requestMicrophone(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    // Insecure origins and old browsers have no mediaDevices at all.
    throw new DOMException('Microphone capture is not available in this browser.', 'UnsupportedError')
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  })
}

/**
 * Streams the microphone into `onFrame` as little-endian PCM16 frames. The
 * returned handle mutes (silent frames keep the stream continuous, and the
 * track is disabled so nothing is captured) and stops everything it created,
 * including the microphone tracks.
 */
export async function startMicCapture(
  context: AudioContext,
  stream: MediaStream,
  onFrame: (pcm: ArrayBuffer, rms: number) => void
): Promise<MicCapture> {
  try {
    await context.audioWorklet.addModule(PCM_CAPTURE_WORKLET_URL)
  } catch (error) {
    console.warn('[test-call] audio worklet failed to load', error)
    throw new DOMException('The audio processor could not be loaded.', 'UnsupportedError')
  }

  const source = context.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    // Down-mix a stereo microphone to mono before resampling.
    channelCount: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
    processorOptions: { targetSampleRate: BROWSER_SAMPLE_RATE, frameSamples: FRAME_SAMPLES },
  })
  // Some engines only pull a worklet whose output reaches the destination;
  // a zero gain keeps the caller's own voice out of the speakers.
  const sink = context.createGain()
  sink.gain.value = 0

  node.port.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data as { type?: unknown; pcm?: unknown; rms?: unknown } | null
    if (data?.type === 'frame' && data.pcm instanceof ArrayBuffer) {
      onFrame(data.pcm, typeof data.rms === 'number' ? data.rms : 0)
    }
  }

  source.connect(node)
  node.connect(sink)
  sink.connect(context.destination)

  let stopped = false
  return {
    setMuted(muted) {
      if (stopped) return
      node.port.postMessage({ type: 'mute', muted })
      for (const track of stream.getAudioTracks()) track.enabled = !muted
    },
    stop() {
      if (stopped) return
      stopped = true
      node.port.onmessage = null
      source.disconnect()
      node.disconnect()
      sink.disconnect()
      for (const track of stream.getTracks()) track.stop()
    },
  }
}

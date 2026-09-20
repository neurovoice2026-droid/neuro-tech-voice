'use client'

// Microphone capture for voice cloning. MediaRecorder gives WebM/Opus in
// Chrome, Edge and Firefox, which Cartesia accepts as is. Safari only records
// MP4/AAC, which the clone API doesn't take, so those recordings are decoded
// and re-encoded as 24 kHz mono WAV in the browser (about 3 MB per minute).

const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']

export function isRecordingSupported(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

export function pickRecorderType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

export function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access is blocked. Allow it from the icon in your browser’s address bar, or upload a recording instead.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'We couldn’t find a microphone. Connect one, or upload a recording instead.'
  }
  if (name === 'NotReadableError') {
    return 'Your microphone is being used by another app. Close it and try again, or upload a recording instead.'
  }
  return 'We couldn’t start the microphone. Please try again, or upload a recording instead.'
}

/** Base container of a recorder MIME type: 'audio/webm;codecs=opus' → 'webm'. */
export function recordingFormat(type: string): 'webm' | 'ogg' | 'mp4' | null {
  const base = type.split(';')[0].trim().toLowerCase()
  if (base.endsWith('/webm')) return 'webm'
  if (base.endsWith('/ogg')) return 'ogg'
  if (base.endsWith('/mp4') || base.endsWith('/aac') || base.endsWith('/x-m4a')) return 'mp4'
  return null
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

/** Mono float samples → 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += bytesPerSample
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/** Decodes any browser-playable recording and returns 24 kHz mono WAV. */
export async function convertToWav(blob: Blob, sampleRate = 24_000): Promise<Blob> {
  const context = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void context.close()
  }
  const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate))
  const offline = new OfflineAudioContext(1, frames, sampleRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return encodeWav(rendered.getChannelData(0), sampleRate)
}

/** Live input level (0–1) from an analyser, for the meter. */
export function readLevel(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
  const rms = Math.sqrt(sum / buffer.length)
  // Speech RMS sits around 0.02–0.2; scale so normal speech fills most of the bar.
  return Math.min(1, rms * 6)
}

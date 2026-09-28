'use client'

import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { errorMessage, fetchBlob, isAbort } from './api'

// One audio element for every voice preview on the page, so starting a
// preview always stops the previous one. Audio is fetched as a Blob (the
// browser HTTP cache still applies) and played from an object URL: that gives
// readable API errors and avoids Safari's byte-range requirement for <audio src>.

export type PreviewStatus = 'idle' | 'loading' | 'playing'

export interface PreviewState {
  key: string | null
  status: PreviewStatus
}

const IDLE: PreviewState = { key: null, status: 'idle' }
const MAX_CACHED_URLS = 24

// 10 ms of silence (8 kHz, 8-bit mono WAV). Safari only lets an element play
// from script after it has played inside a click; the first preview has to
// fetch its audio before it can play, which is too late. Playing this in the
// click itself unlocks the shared element for every later preview.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='

let state: PreviewState = IDLE
let audio: HTMLAudioElement | null = null
let unlocked = false
let controller: AbortController | null = null
const listeners = new Set<() => void>()
const urls = new Map<string, string>()

function setState(next: PreviewState): void {
  state = next
  for (const listener of listeners) listener()
}

function playingSilence(el: HTMLAudioElement): boolean {
  return el.src === SILENT_WAV
}

function element(): HTMLAudioElement {
  if (audio) return audio
  const el = new Audio()
  el.preload = 'auto'
  el.addEventListener('ended', () => {
    if (!playingSilence(el)) setState(IDLE)
  })
  el.addEventListener('error', () => {
    if (playingSilence(el)) return
    if (state.status !== 'idle') {
      setState(IDLE)
      toast.error('This preview couldn’t be played in your browser.')
    }
  })
  audio = el
  return el
}

/** Must run synchronously inside the click, before anything is awaited. */
function unlockPlayback(): void {
  if (unlocked || typeof window === 'undefined') return
  unlocked = true
  const el = element()
  el.src = SILENT_WAV
  // Replaced by the real preview in a moment, which rejects this play() with AbortError.
  el.play().catch(() => undefined)
}

function remember(key: string, url: string): void {
  urls.delete(key)
  urls.set(key, url)
  while (urls.size > MAX_CACHED_URLS) {
    const [oldestKey, oldestUrl] = urls.entries().next().value as [string, string]
    if (oldestKey === state.key) break
    urls.delete(oldestKey)
    URL.revokeObjectURL(oldestUrl)
  }
}

export function stopPreview(): void {
  controller?.abort()
  controller = null
  if (audio) {
    audio.pause()
    audio.currentTime = 0
  }
  if (state.status !== 'idle') setState(IDLE)
}

/**
 * Plays the audio for `key`, loading it with `load` the first time. Calling it
 * again with the same key while it plays stops it (toggle).
 */
export async function playPreview(key: string, load: (signal: AbortSignal) => Promise<Blob>): Promise<void> {
  if (state.key === key && state.status !== 'idle') {
    stopPreview()
    return
  }
  stopPreview()
  unlockPlayback()
  const ctrl = new AbortController()
  controller = ctrl
  setState({ key, status: 'loading' })
  try {
    let url = urls.get(key)
    if (!url) {
      const blob = await load(ctrl.signal)
      if (ctrl.signal.aborted) return
      url = URL.createObjectURL(blob)
      remember(key, url)
    }
    const el = element()
    el.src = url
    await el.play()
    if (!ctrl.signal.aborted) setState({ key, status: 'playing' })
  } catch (error) {
    if (ctrl.signal.aborted || isAbort(error)) return
    setState(IDLE)
    // play() rejects with NotAllowedError when autoplay is blocked.
    const message = error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'Your browser blocked audio playback. Click the play button again.'
      : errorMessage(error, 'We couldn’t play this preview. Please try again.')
    toast.error(message)
  } finally {
    if (controller === ctrl) controller = null
  }
}

/** Drops cached audio for a key (for example after a voice is deleted). */
export function forgetPreview(key: string): void {
  const url = urls.get(key)
  if (!url) return
  if (state.key === key) stopPreview()
  urls.delete(key)
  URL.revokeObjectURL(url)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePreviewState(): PreviewState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE)
}

/** Loader for GET /api/voices/{id}/preview. */
export function voicePreviewLoader(url: string): (signal: AbortSignal) => Promise<Blob> {
  return async (signal) => (await fetchBlob(url, { signal })).blob
}

/** Loader for POST /api/agent/preview-voice. */
export function spokenPreviewLoader(body: {
  text: string
  voice_id?: string | null
  speed?: number | null
  tone?: string | null
  language?: string | null
}): (signal: AbortSignal) => Promise<Blob> {
  return async (signal) =>
    (
      await fetchBlob('/api/agent/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
    ).blob
}

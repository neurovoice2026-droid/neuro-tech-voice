'use client'

// One voice preview at a time. A preview is either a public audio URL (the
// provider's own sample) or one of our API routes that returns audio, which we
// fetch into a blob/object URL so server errors (429 rate limit, 503 provider
// down, eligibility) reach the user as readable messages. Every stop path —
// manual stop, another preview, end, error, unmount — pauses the element,
// aborts any in-flight fetch and revokes the object URL.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { VoiceOption } from '@/types'
import { ApiError, isAbortError, libraryRefBody, parseApiError } from '@/hooks/useVoiceCatalog'

export interface PreviewRequest {
  kind: 'request'
  url: string
  method: 'GET' | 'POST'
  /** JSON body for POST. */
  body?: Record<string, unknown>
}

export interface PreviewUrl {
  kind: 'url'
  url: string
  /** Tried when the public URL cannot be played (expired, blocked). */
  fallback?: PreviewRequest
}

export type PreviewSource = PreviewUrl | PreviewRequest

export type PreviewStatus = 'idle' | 'loading' | 'playing'

/** A provider sample when the catalog has one, else a generated sample (POST /api/voices/preview). */
export function voicePreviewSource(voice: VoiceOption, language?: string | null): PreviewSource {
  const library_ref = libraryRefBody(voice)
  const request: PreviewRequest = {
    kind: 'request',
    url: '/api/voices/preview',
    method: 'POST',
    body: {
      voice_id: voice.voiceId,
      ...(library_ref ? { library_ref } : {}),
      ...(language ? { language } : {}),
    },
  }
  return voice.previewUrl ? { kind: 'url', url: voice.previewUrl, fallback: request } : request
}

function notifyPreviewError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      toast.warning('You are previewing voices a little too quickly', {
        description: err.retryAfter
          ? `Please try again in about ${err.retryAfter} seconds.`
          : 'Please wait a moment and try again.',
      })
      return
    }
    toast.error('Could not play this preview', { description: err.message })
    return
  }
  if (err instanceof TypeError) {
    toast.error('Could not load this preview', { description: 'Check your connection and try again.' })
    return
  }
  toast.error('Could not play this preview')
}

/** Stops an element and drops its source so the browser releases the media. */
function detachAudio(audio: HTMLAudioElement) {
  audio.onended = null
  audio.onerror = null
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

interface PreviewState {
  id: string | null
  status: PreviewStatus
}

const IDLE: PreviewState = { id: null, status: 'idle' }

// Several components on one page each own a preview (picker, current voice,
// fallback voice); starting one stops whichever other one is playing.
let activePreview: { owner: object; stop: () => void } | null = null

export function useAudioPreview() {
  const [state, setState] = useState<PreviewState>(IDLE)
  const [owner] = useState<object>(() => ({}))
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  // Bumped on every release so late callbacks from an old preview are ignored.
  const generationRef = useRef(0)

  /** Tears down the current preview without touching React state. */
  const release = useCallback(() => {
    if (activePreview?.owner === owner) activePreview = null
    generationRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    if (audioRef.current) {
      detachAudio(audioRef.current)
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [owner])

  // Unmount: stop playback, abort fetches, revoke the object URL.
  useEffect(() => release, [release])

  const stop = useCallback(() => {
    release()
    setState(IDLE)
  }, [release])

  const play = useCallback(
    async (id: string, source: PreviewSource): Promise<void> => {
      release()
      if (activePreview && activePreview.owner !== owner) activePreview.stop()
      activePreview = { owner, stop }
      const generation = generationRef.current
      const isStale = () => generation !== generationRef.current
      setState({ id, status: 'loading' })

      const finishWithError = (notify: () => void) => {
        release()
        setState(IDLE)
        notify()
      }

      async function resolveSrc(current: PreviewSource): Promise<string | null> {
        if (current.kind === 'url') return current.url
        const controller = new AbortController()
        controllerRef.current = controller
        const res = await fetch(current.url, {
          method: current.method,
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            Accept: 'audio/*',
            ...(current.body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(current.body ? { body: JSON.stringify(current.body) } : {}),
        })
        if (!res.ok) throw await parseApiError(res, 'This preview is not available right now.')
        const blob = await res.blob()
        if (isStale()) return null
        controllerRef.current = null
        const objectUrl = URL.createObjectURL(blob)
        objectUrlRef.current = objectUrl
        return objectUrl
      }

      async function attempt(current: PreviewSource): Promise<void> {
        let src: string | null
        try {
          src = await resolveSrc(current)
        } catch (err) {
          if (isStale() || isAbortError(err)) return
          finishWithError(() => notifyPreviewError(err))
          return
        }
        if (!src || isStale()) return

        const audio = new Audio()
        audioRef.current = audio
        let failed = false
        const fail = () => {
          if (failed || isStale()) return
          failed = true
          if (current.kind === 'url' && current.fallback) {
            // The public sample is gone or blocked: generate one instead.
            detachAudio(audio)
            if (audioRef.current === audio) audioRef.current = null
            void attempt(current.fallback)
            return
          }
          finishWithError(() => toast.error('This preview could not be played.'))
        }
        audio.onended = () => {
          if (isStale()) return
          release()
          setState(IDLE)
        }
        audio.onerror = fail
        audio.src = src

        try {
          await audio.play()
          if (!isStale() && !failed) setState({ id, status: 'playing' })
        } catch (err) {
          // Stopped or replaced before playback started: nothing to report.
          if (isStale() || isAbortError(err)) return
          if (err instanceof DOMException && err.name === 'NotAllowedError') {
            finishWithError(() =>
              toast.error('Could not play this preview', {
                description: 'Your browser blocked audio playback. Press the preview button again.',
              }),
            )
            return
          }
          fail()
        }
      }

      await attempt(source)
    },
    [release, stop, owner],
  )

  const toggle = useCallback(
    (id: string, source: PreviewSource) => {
      if (state.id === id && state.status !== 'idle') stop()
      else void play(id, source)
    },
    [state.id, state.status, stop, play],
  )

  const statusFor = useCallback(
    (id: string): PreviewStatus => (state.id === id ? state.status : 'idle'),
    [state.id, state.status],
  )

  return { activeId: state.id, status: state.status, statusFor, play, toggle, stop }
}

export type AudioPreview = ReturnType<typeof useAudioPreview>

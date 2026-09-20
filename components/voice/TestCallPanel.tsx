'use client'

// In-browser test call with the owner's own agent. The app creates a test
// session (POST /api/voice/test-session), the browser streams the microphone
// to the voice gateway as 20 ms PCM16 16 kHz frames and plays the agent's
// audio back gaplessly, with a live transcript. When the gateway isn't
// deployed the panel offers "Call my phone" (POST /api/agent/test-call).

import Link from 'next/link'
import { useCallback, useEffect, useId, useReducer, useRef, useState, type FormEvent } from 'react'
import {
  AudioLines, CheckCircle2, Headphones, Loader2, Mic, MicOff, PhoneCall, PhoneOff,
  RotateCcw, Smartphone, TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { isBrowserCallSupported, requestMicrophone, startMicCapture, type MicCapture } from '@/lib/audio/capture'
import { meterLevel } from '@/lib/audio/pcm'
import { PcmPlayer } from '@/lib/audio/playback'
import { resumeFromTap, watchAudioInterruptions } from '@/lib/audio/resume'
import { EMPTY_TRANSCRIPT, transcriptReducer, type TranscriptBubble } from '@/lib/audio/transcript'
import {
  MODE_DESCRIPTIONS, MODE_LABELS, TEST_CALL_MAX_SECONDS, TEST_CALL_WARNING_SECONDS,
  classifySessionError, describeMicError, endReasonText, formatCallTime, isAllowedGatewayUrl,
  parseApiError, parseServerMessage, parseTestSession, phoneTestErrorMessage,
} from '@/lib/audio/call-protocol'
import type { BrowserClientMessage, CallEndReason, VoicePipelineMode } from '@/lib/voice/contracts'

// ─── Tuning ───────────────────────────────────────────────────────────────────

/** How long the gateway may take to answer with `ready`. */
const READY_TIMEOUT_MS = 15_000
/** After our hangup, how long to wait for the gateway's `ended` before closing anyway. */
const HANGUP_GRACE_MS = 2_500
/** ~2 s of 16 kHz PCM16 queued on a stalled socket: newer audio matters more than old. */
const MAX_BUFFERED_BYTES = 64_000
/** Agent text that stopped arriving this long ago, with nothing playing, is a finished turn. */
const AGENT_TURN_IDLE_MS = 1_500
/** The gateway ends test calls at 180 s; the browser only steps in if that never arrives. */
const CLIENT_CAP_GRACE_SECONDS = 5
const TICK_MS = 100
/** Longest goodbye we let finish playing after the call ended. */
const MAX_DRAIN_MS = 6_000
const START_FAILED = 'The test call couldn’t start'

// Known for the rest of the page view once the app says the gateway isn't
// deployed, so the next attempt goes straight to "Call my phone" without
// asking for the microphone again.
let gatewayKnownMissing = false

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TestCallResult {
  reason: CallEndReason
  seconds: number
}

export interface TestCallPanelProps {
  agentName: string
  /** false when the organisation has no active number yet ("Call my phone" needs one); undefined = unknown. */
  hasPhoneNumber?: boolean
  onCallEnded?: (result: TestCallResult) => void
  /** True while a call is starting, live or ending (e.g. to stop a dialog closing on an outside click). */
  onActiveChange?: (active: boolean) => void
  className?: string
}

type Phase =
  | { name: 'idle' }
  | { name: 'starting'; step: 'mic' | 'session' | 'connecting' }
  | { name: 'live'; mode: VoicePipelineMode }
  | { name: 'ending'; mode: VoicePipelineMode | null }
  | { name: 'ended'; reason: CallEndReason; seconds: number; mode: VoicePipelineMode | null }
  | { name: 'error'; title: string; message: string; offerPhone: boolean; signIn: boolean; retry: boolean }

interface CallResources {
  context: AudioContext
  stream: MediaStream | null
  capture: MicCapture | null
  socket: WebSocket | null
  player: PcmPlayer | null
  abort: AbortController
  timers: number[]
  ready: boolean
  finished: boolean
  mode: VoicePipelineMode | null
  startedAt: number | null
  micLevel: number
  lastAgentTextAt: number
  /** Why we hung up ourselves, used when the gateway's reason doesn't say more. */
  clientReason: CallEndReason | null
  /** Stops watching the audio context for device interruptions. */
  stopAudioWatch: (() => void) | null
  end: (reason: CallEndReason) => void
}

// ─── Resource cleanup ─────────────────────────────────────────────────────────

/** Stops everything that listens or sends: request, timers, socket, microphone. Idempotent. */
function releaseInput(res: CallResources): void {
  res.abort.abort()
  for (const timer of res.timers) window.clearTimeout(timer)
  res.timers = []
  const socket = res.socket
  if (socket) {
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.close(1000, 'client_closed')
    res.socket = null
  }
  if (res.capture) {
    res.capture.stop()
    res.capture = null
  }
  if (res.stream) {
    for (const track of res.stream.getTracks()) track.stop()
    res.stream = null
  }
}

/** Stops playback and releases the audio device. Idempotent. */
function releaseOutput(res: CallResources): void {
  res.stopAudioWatch?.()
  res.stopAudioWatch = null
  if (res.player) {
    res.player.close()
    res.player = null
  }
  if (res.context.state !== 'closed') {
    res.context.close().catch((error: unknown) => console.warn('[test-call] closing the audio context failed', error))
  }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function TestCallPanel({ agentName, hasPhoneNumber, onCallEnded, onActiveChange, className }: TestCallPanelProps) {
  const agent = agentName.trim() || 'Your agent'
  const titleId = useId()

  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [view, setView] = useState<'browser' | 'phone'>(() => (gatewayKnownMissing ? 'phone' : 'browser'))
  const [gatewayMissing, setGatewayMissing] = useState(gatewayKnownMissing)
  const [transcript, dispatch] = useReducer(transcriptReducer, EMPTY_TRANSCRIPT)
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [agentSpeaking, setAgentSpeaking] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  /** The device paused call audio (iOS: a phone call, Siri, a locked screen) and only a tap restarts it. */
  const [audioBlocked, setAudioBlocked] = useState(false)

  const callRef = useRef<CallResources | null>(null)
  const meterRef = useRef<HTMLSpanElement | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const onCallEndedRef = useRef(onCallEnded)
  const onActiveChangeRef = useRef(onActiveChange)

  useEffect(() => {
    onCallEndedRef.current = onCallEnded
    onActiveChangeRef.current = onActiveChange
  })

  const active = phase.name === 'starting' || phase.name === 'live' || phase.name === 'ending'
  useEffect(() => {
    onActiveChangeRef.current?.(active)
  }, [active])

  useEffect(() => {
    if (phase.name === 'ended') onCallEndedRef.current?.({ reason: phase.reason, seconds: phase.seconds })
  }, [phase])

  // Ending the call when the panel goes away (dialog closed, page left).
  useEffect(() => {
    return () => {
      const res = callRef.current
      if (!res) return
      if (!res.finished && res.ready && res.socket?.readyState === WebSocket.OPEN) {
        // Lets the gateway finalise the call now instead of waiting for a timeout.
        res.socket.send(JSON.stringify({ type: 'hangup' } satisfies BrowserClientMessage))
      }
      res.finished = true
      releaseInput(res)
      releaseOutput(res)
    }
  }, [])

  const hangUp = useCallback((reason: CallEndReason = 'test_ended') => {
    const res = callRef.current
    if (!res || res.finished) return
    res.clientReason = reason
    res.player?.clear()
    res.capture?.setMuted(true)
    const socket = res.socket
    if (res.ready && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'hangup' } satisfies BrowserClientMessage))
      setPhase({ name: 'ending', mode: res.mode })
      setAnnouncement('Ending the call…')
      res.timers.push(window.setTimeout(() => res.end(reason), HANGUP_GRACE_MS))
    } else {
      res.end(reason)
    }
  }, [])

  const cancelStart = useCallback(() => {
    const res = callRef.current
    if (!res || res.finished) return
    res.finished = true
    releaseInput(res)
    releaseOutput(res)
    setPhase({ name: 'idle' })
    setAnnouncement('Test call cancelled.')
  }, [])

  const startCall = useCallback(async () => {
    const previous = callRef.current
    if (previous && !previous.finished) return

    setView('browser')
    setMuted(false)
    setElapsed(0)
    setAgentSpeaking(false)
    setAudioBlocked(false)
    dispatch({ type: 'reset' })
    stickToBottomRef.current = true

    const unsupported = describeMicError({ name: 'UnsupportedError' }).message
    if (!isBrowserCallSupported()) {
      setPhase({ name: 'error', title: START_FAILED, message: unsupported, offerPhone: true, signIn: false, retry: false })
      return
    }

    // Created inside the click so browsers allow it to play sound.
    let context: AudioContext
    try {
      context = new AudioContext({ latencyHint: 'interactive' })
    } catch (error) {
      console.warn('[test-call] audio context unavailable', error)
      setPhase({ name: 'error', title: START_FAILED, message: unsupported, offerPhone: true, signIn: false, retry: false })
      return
    }
    const resumed = context.resume()

    const res: CallResources = {
      context,
      stream: null,
      capture: null,
      socket: null,
      player: null,
      abort: new AbortController(),
      timers: [],
      ready: false,
      finished: false,
      mode: null,
      startedAt: null,
      micLevel: 0,
      lastAgentTextAt: 0,
      clientReason: null,
      stopAudioWatch: null,
      end: () => {},
    }
    callRef.current = res
    // Device interruptions (iOS suspends Web Audio for a phone call or a locked
    // screen): resume on our own when allowed, otherwise ask for a tap.
    res.stopAudioWatch = watchAudioInterruptions(context, typeof document === 'undefined' ? null : document, {
      isActive: () => res.ready && !res.finished,
      onBlockedChange: (blocked) => {
        if (res.finished) return
        setAudioBlocked(blocked)
        if (blocked) setAnnouncement('Your device paused the call audio. Tap “Resume audio” to hear your agent again.')
      },
    })

    const fail = (message: string, opts: { offerPhone?: boolean; signIn?: boolean; retry?: boolean } = {}) => {
      if (res.finished) return
      res.finished = true
      releaseInput(res)
      releaseOutput(res)
      dispatch({ type: 'close' })
      setAgentSpeaking(false)
      setAudioBlocked(false)
      setPhase({
        name: 'error',
        title: res.ready ? 'The call couldn’t continue' : START_FAILED,
        message,
        offerPhone: opts.offerPhone ?? false,
        signIn: opts.signIn ?? false,
        retry: opts.retry ?? true,
      })
      setAnnouncement(message)
    }

    res.end = (reason: CallEndReason) => {
      if (res.finished) return
      res.finished = true
      const seconds = res.startedAt === null ? 0 : Math.round((performance.now() - res.startedAt) / 1000)
      releaseInput(res)
      dispatch({ type: 'close' })
      setAudioBlocked(false)
      setPhase({ name: 'ending', mode: res.mode })
      const finish = () => {
        releaseOutput(res)
        setAgentSpeaking(false)
        setPhase({ name: 'ended', reason, seconds, mode: res.mode })
        setAnnouncement(`Call ended. ${endReasonText(reason, agent)}`)
      }
      // The agent's goodbye is usually still buffered when the gateway says the
      // call ended: let it finish, unless the owner hung up themselves.
      const ownHangup = res.clientReason === 'test_ended' || reason === 'caller_hangup' || reason === 'test_ended'
      const drainMs = ownHangup ? 0 : Math.min(MAX_DRAIN_MS, Math.ceil((res.player?.bufferedSeconds() ?? 0) * 1000))
      if (drainMs > 0) res.timers.push(window.setTimeout(finish, drainMs + 150))
      else finish()
    }

    setPhase({ name: 'starting', step: 'mic' })
    setAnnouncement('Waiting for microphone permission…')

    // 1. Microphone first: a denied prompt must not use up a test session.
    try {
      res.stream = await requestMicrophone()
    } catch (error) {
      fail(describeMicError(error).message, { offerPhone: true })
      return
    }
    if (res.finished) {
      releaseInput(res)
      return
    }
    // The microphone can go away mid-call (headset unplugged, the system hands
    // it to another app); otherwise the call would carry on in silence. Our own
    // track.stop() never fires 'ended'.
    for (const track of res.stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        if (res.finished) return
        const socket = res.socket
        if (res.ready && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'hangup' } satisfies BrowserClientMessage))
        }
        fail('Your microphone disconnected, so the call ended. Check that it’s connected, then try again.')
      })
    }

    // 2. Test session.
    setPhase({ name: 'starting', step: 'session' })
    setAnnouncement('Starting your test call…')
    let response: Response
    try {
      response = await fetch('/api/voice/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        cache: 'no-store',
        signal: res.abort.signal,
      })
    } catch (error) {
      if (res.finished) return
      console.warn('[test-call] test-session request failed', error)
      fail('We couldn’t reach Neuro Tech Voice. Check your internet connection and try again.')
      return
    }
    // A non-JSON body is handled like any other failed response below.
    const body: unknown = await response.json().catch(() => null)
    if (res.finished) return

    if (!response.ok) {
      const failure = classifySessionError(parseApiError(response.status, body))
      if (failure.kind === 'use_phone') {
        res.finished = true
        releaseInput(res)
        releaseOutput(res)
        gatewayKnownMissing = true
        setGatewayMissing(true)
        setView('phone')
        setPhase({ name: 'idle' })
        setAnnouncement('In-browser calls aren’t available yet. You can ask your agent to call your phone instead.')
        return
      }
      // A daily limit won't lift on a retry, so only real failures offer one.
      fail(failure.message, {
        signIn: failure.kind === 'signed_out',
        offerPhone: failure.kind === 'unavailable',
        retry: failure.kind === 'unavailable',
      })
      return
    }

    const session = parseTestSession(body)
    if (!session || !isAllowedGatewayUrl(session.ws_url, window.location.protocol)) {
      console.warn('[test-call] unexpected test-session response')
      fail('We couldn’t start a test call. Please try again.', { offerPhone: true })
      return
    }
    res.mode = session.mode

    // 3. Audio graph and gateway connection.
    setPhase({ name: 'starting', step: 'connecting' })
    setAnnouncement(`Connecting to ${agent}…`)
    try {
      await resumed
      res.player = new PcmPlayer(context, { output: context.destination })
      res.capture = await startMicCapture(context, res.stream, (pcm, rms) => {
        res.micLevel = rms
        const socket = res.socket
        if (!res.ready || !socket || socket.readyState !== WebSocket.OPEN) return
        if (socket.bufferedAmount > MAX_BUFFERED_BYTES) return
        socket.send(pcm)
      })
    } catch (error) {
      if (res.finished) {
        releaseInput(res)
        releaseOutput(res)
        return
      }
      fail(describeMicError(error).message, { offerPhone: true })
      return
    }
    if (res.finished) {
      releaseInput(res)
      releaseOutput(res)
      return
    }

    let socket: WebSocket
    try {
      socket = new WebSocket(session.ws_url)
    } catch (error) {
      console.warn('[test-call] could not open the gateway connection', error)
      fail(`We couldn’t connect to ${agent}. Please try again in a moment.`, { offerPhone: true })
      return
    }
    socket.binaryType = 'arraybuffer'
    res.socket = socket
    res.timers.push(
      window.setTimeout(() => {
        if (!res.ready) fail(`${agent} didn’t pick up. Please try again in a moment.`, { offerPhone: true })
      }, READY_TIMEOUT_MS)
    )

    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (res.finished) return
      if (typeof event.data !== 'string') {
        if (event.data instanceof ArrayBuffer) res.player?.enqueue(event.data)
        return
      }
      const message = parseServerMessage(event.data)
      if (!message) return
      switch (message.type) {
        case 'ready':
          if (res.ready) return
          res.ready = true
          res.mode = message.mode
          res.startedAt = performance.now()
          setPhase({ name: 'live', mode: message.mode })
          setAnnouncement(`Connected. ${agent} is on the line, start talking.`)
          return
        case 'mode_switched':
          res.mode = message.mode
          setPhase((current) => (current.name === 'live' ? { name: 'live', mode: message.mode } : current))
          setAnnouncement(
            message.mode === 'elevenlabs'
              ? `${agent} moved to the backup voice to keep the call going.`
              : `Now using ${MODE_LABELS[message.mode]}.`
          )
          return
        case 'user_transcript':
          dispatch({ type: 'user', text: message.text, final: message.final })
          return
        case 'agent_text':
          // Sentences arrive as they start playing (with a turn id); after a barge-in the heard part replaces them.
          if (!message.interrupted) res.lastAgentTextAt = performance.now()
          dispatch({ type: 'agent', text: message.text, turn: message.turn, interrupted: message.interrupted })
          return
        case 'clear':
          res.player?.clear()
          dispatch({ type: 'interrupt' })
          return
        case 'ended':
          res.end(res.clientReason === 'max_duration' ? 'max_duration' : message.reason)
          return
        case 'error':
          // Gateway detail stays in the console; the owner gets plain words.
          console.warn('[test-call] gateway reported an error', message.message)
          fail('The call ran into a problem and ended. Please try again.', { offerPhone: true })
          return
      }
    }
    socket.onerror = () => {
      // The close event that always follows carries the outcome.
      console.warn('[test-call] gateway connection error')
    }
    socket.onclose = (event: CloseEvent) => {
      if (res.finished) return
      if (!res.ready) {
        console.warn('[test-call] gateway closed before the call started', event.code)
        fail(`We couldn’t connect to ${agent}. Please try again in a moment.`, { offerPhone: true })
        return
      }
      if (res.clientReason) {
        res.end(res.clientReason)
        return
      }
      console.warn('[test-call] gateway connection dropped', event.code)
      fail('The call dropped. Check your internet connection and try again.')
    }
  }, [agent])

  // Timer, 3-minute cap, "agent speaking" and the microphone meter.
  const live = phase.name === 'live'
  useEffect(() => {
    if (!live) return
    let lastSecond = -1
    const interval = window.setInterval(() => {
      const res = callRef.current
      if (!res || res.finished) return
      const now = performance.now()
      if (res.startedAt !== null) {
        const seconds = Math.floor((now - res.startedAt) / 1000)
        if (seconds !== lastSecond) {
          lastSecond = seconds
          setElapsed(seconds)
          if (seconds >= TEST_CALL_MAX_SECONDS + CLIENT_CAP_GRACE_SECONDS) hangUp('max_duration')
        }
      }
      const speaking = res.player?.isPlaying() ?? false
      setAgentSpeaking(speaking)
      if (!speaking && res.lastAgentTextAt > 0 && now - res.lastAgentTextAt > AGENT_TURN_IDLE_MS) {
        res.lastAgentTextAt = 0
        dispatch({ type: 'close', role: 'agent' })
      }
      if (meterRef.current) meterRef.current.style.transform = `scaleX(${muted ? 0 : meterLevel(res.micLevel)})`
    }, TICK_MS)
    return () => window.clearInterval(interval)
  }, [live, muted, hangUp])

  // Keep the newest line in view unless the owner scrolled up to read.
  useEffect(() => {
    const el = logRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [transcript])

  function resumeAudio() {
    const res = callRef.current
    if (!res || res.finished) return
    // Must run inside the tap: iOS only lets a user gesture restart audio.
    void resumeFromTap(res.context).then((running) => {
      if (res.finished) return
      setAudioBlocked(!running)
      setAnnouncement(running ? 'Audio resumed.' : 'Audio is still paused. Close other apps using sound, then tap again.')
    })
  }

  function toggleMute() {
    const res = callRef.current
    if (!res?.capture) return
    const next = !muted
    res.capture.setMuted(next)
    setMuted(next)
    setAnnouncement(next ? 'Microphone muted.' : 'Microphone on.')
  }

  function showPhoneForm() {
    setView('phone')
    setPhase({ name: 'idle' })
  }

  const mode = phase.name === 'live' ? phase.mode : phase.name === 'ending' || phase.name === 'ended' ? phase.mode : null
  const statusLine =
    view === 'phone'
      ? 'Test call to your phone'
      : phase.name === 'idle'
        ? 'Test call in your browser'
        : phase.name === 'starting'
          ? phase.step === 'mic'
            ? 'Waiting for your microphone…'
            : phase.step === 'session'
              ? 'Starting the call…'
              : 'Connecting…'
          : phase.name === 'live'
            ? agentSpeaking
              ? 'Speaking…'
              : muted
                ? 'Your microphone is muted'
                : 'Listening…'
            : phase.name === 'ending'
              ? 'Ending the call…'
              : phase.name === 'ended'
                ? 'Call ended'
                : // The alert below carries the title; repeating it here reads twice.
                  'Not connected'

  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5', className)}
    >
      <p className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </p>

      {/* Header */}
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 transition-shadow duration-200',
              phase.name === 'live' && agentSpeaking && 'ring-4 ring-purple-300/60 motion-safe:animate-pulse'
            )}
          >
            <AudioLines className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="truncate text-sm font-semibold text-foreground">
              {agent}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{statusLine}</p>
          </div>
        </div>
        {mode && view === 'browser' && <ModeBadge mode={mode} />}
      </div>

      {view === 'phone' ? (
        <CallMyPhoneForm
          agentName={agent}
          hasPhoneNumber={hasPhoneNumber}
          gatewayMissing={gatewayMissing}
          onUseBrowser={() => setView('browser')}
        />
      ) : (
        <>
          {phase.name === 'idle' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Talk to {agent} right here, the way a caller would. Your browser will ask to use your microphone.
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Headphones className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Headphones give the clearest result.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button onClick={() => void startCall()} className="purple-glow h-10 px-4">
                  <Mic aria-hidden="true" />
                  Start test call
                </Button>
                {hasPhoneNumber !== false && (
                  <Button variant="ghost" onClick={showPhoneForm} className="h-10 text-muted-foreground">
                    <Smartphone aria-hidden="true" />
                    Call my phone instead
                  </Button>
                )}
              </div>
            </div>
          )}

          {phase.name === 'starting' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="status">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
                {phase.step === 'mic'
                  ? 'Allow microphone access in the prompt from your browser.'
                  : phase.step === 'session'
                    ? 'Setting up your test call…'
                    : `Connecting to ${agent}…`}
              </p>
              <Button variant="outline" onClick={cancelStart} className="h-9">
                Cancel
              </Button>
            </div>
          )}

          {(phase.name === 'live' || phase.name === 'ending' || (phase.name === 'ended' && transcript.bubbles.length > 0)) && (
            <TranscriptLog
              logRef={logRef}
              bubbles={transcript.bubbles}
              agentName={agent}
              live={phase.name === 'live'}
              onScroll={(el) => {
                stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
              }}
            />
          )}

          {(phase.name === 'live' || phase.name === 'ending') && (
            <div className="space-y-3">
              {audioBlocked && phase.name === 'live' && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Your device paused the call audio.
                  </p>
                  <Button onClick={resumeAudio} className="h-10 shrink-0 gap-2">
                    <Headphones aria-hidden="true" />
                    Resume audio
                  </Button>
                </div>
              )}
              <CallTimer elapsed={elapsed} />
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  onClick={toggleMute}
                  aria-pressed={muted}
                  disabled={phase.name !== 'live'}
                  className="h-10 justify-center gap-2 sm:min-w-32"
                >
                  {muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
                  {muted ? 'Unmute' : 'Mute'}
                  <span aria-hidden="true" className="relative h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                    <span
                      ref={meterRef}
                      // Updated directly by the call timer (10 times a second) without re-rendering.
                      style={{ transform: 'scaleX(0)' }}
                      className="absolute inset-0 origin-left rounded-full bg-emerald-500 transition-transform duration-100"
                    />
                  </span>
                </Button>
                <Button
                  onClick={() => hangUp()}
                  disabled={phase.name !== 'live'}
                  className="h-10 justify-center gap-2 bg-red-600 text-white hover:bg-red-700 sm:min-w-32"
                >
                  {phase.name === 'ending' ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <PhoneOff aria-hidden="true" />
                  )}
                  {phase.name === 'ending' ? 'Ending…' : 'Hang up'}
                </Button>
              </div>
            </div>
          )}

          {phase.name === 'ended' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  Call ended · {formatCallTime(phase.seconds)}
                </p>
                <p className="mt-1 text-muted-foreground">{endReasonText(phase.reason, agent)}</p>
              </div>
              <Button onClick={() => void startCall()} variant="outline" className="h-10">
                <RotateCcw aria-hidden="true" />
                Start another test call
              </Button>
            </div>
          )}

          {phase.name === 'error' && (
            <div className="space-y-3">
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-red-700">
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {phase.title}
                </p>
                <p className="mt-1 text-red-700/90">{phase.message}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {phase.signIn ? (
                  <Link href="/login" className={cn(buttonVariants(), 'h-10')}>
                    Sign in again
                  </Link>
                ) : phase.retry ? (
                  <Button onClick={() => void startCall()} className="h-10">
                    <RotateCcw aria-hidden="true" />
                    Try again
                  </Button>
                ) : null}
                {phase.offerPhone && hasPhoneNumber !== false && (
                  <Button variant="ghost" onClick={showPhoneForm} className="h-10 text-muted-foreground">
                    <Smartphone aria-hidden="true" />
                    Call my phone instead
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">Test calls don’t use your plan minutes.</p>
    </section>
  )
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

const MODE_DOT: Record<VoicePipelineMode, string> = {
  cartesia_self: 'bg-emerald-500',
  cartesia_managed: 'bg-sky-500',
  elevenlabs: 'bg-amber-500',
}

function ModeBadge({ mode }: { mode: VoicePipelineMode }) {
  return (
    <span
      title={MODE_DESCRIPTIONS[mode]}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground"
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', MODE_DOT[mode])} />
      <span className="sr-only">Voice engine: </span>
      {MODE_LABELS[mode]}
    </span>
  )
}

function CallTimer({ elapsed }: { elapsed: number }) {
  const clamped = Math.min(elapsed, TEST_CALL_MAX_SECONDS)
  const remaining = TEST_CALL_MAX_SECONDS - clamped
  const warning = elapsed >= TEST_CALL_WARNING_SECONDS
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="tabular-nums text-foreground">
          <span className="sr-only">Call time </span>
          {formatCallTime(clamped)}
          <span className="text-muted-foreground"> / {formatCallTime(TEST_CALL_MAX_SECONDS)}</span>
        </span>
        {warning && <span className="font-medium text-amber-700">Ends in {formatCallTime(remaining)}</span>}
      </div>
      <div
        role="progressbar"
        aria-label="Test call length"
        aria-valuemin={0}
        aria-valuemax={TEST_CALL_MAX_SECONDS}
        aria-valuenow={clamped}
        aria-valuetext={`${formatCallTime(clamped)} of ${formatCallTime(TEST_CALL_MAX_SECONDS)}`}
        className="h-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', warning ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${(clamped / TEST_CALL_MAX_SECONDS) * 100}%` }}
        />
      </div>
    </div>
  )
}

function TranscriptLog({
  logRef, bubbles, agentName, live, onScroll,
}: {
  logRef: React.RefObject<HTMLDivElement | null>
  bubbles: TranscriptBubble[]
  agentName: string
  live: boolean
  onScroll: (el: HTMLDivElement) => void
}) {
  return (
    <div
      ref={logRef}
      role="log"
      aria-live="polite"
      aria-label="Live transcript"
      tabIndex={0}
      onScroll={(e) => onScroll(e.currentTarget)}
      className="h-52 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-64"
    >
      {bubbles.length === 0 ? (
        <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
          {live ? `Say hello. ${agentName} will answer.` : 'Nothing was said on this call.'}
        </p>
      ) : (
        bubbles.map((bubble) => (
          <div
            key={bubble.id}
            // Streaming text is read out once it settles, not on every update.
            aria-hidden={bubble.open || undefined}
            className={cn('flex', bubble.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words',
                bubble.role === 'user'
                  ? 'rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md bg-background text-foreground ring-1 ring-foreground/10',
                bubble.open && 'opacity-80'
              )}
            >
              <span className="sr-only">{bubble.role === 'user' ? 'You: ' : `${agentName}: `}</span>
              {bubble.text}
              {bubble.interrupted && <span className="ml-1 text-xs italic opacity-70">(interrupted)</span>}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

type PhoneStatus =
  | { name: 'idle' }
  | { name: 'submitting' }
  | { name: 'calling'; masked: string }
  | { name: 'error'; message: string }

function CallMyPhoneForm({
  agentName, hasPhoneNumber, gatewayMissing, onUseBrowser,
}: {
  agentName: string
  hasPhoneNumber: boolean | undefined
  gatewayMissing: boolean
  onUseBrowser: () => void
}) {
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState('+')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [status, setStatus] = useState<PhoneStatus>({ name: 'idle' })
  const noNumber = hasPhoneNumber === false

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status.name === 'submitting' || noNumber) return
    const normalized = normalizeE164(value)
    if (!normalized) {
      setFieldError('Enter your full number with the country code, like +40 712 345 678.')
      inputRef.current?.focus()
      return
    }
    setFieldError(null)
    setStatus({ name: 'submitting' })
    try {
      const response = await fetch('/api/agent/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_number: normalized }),
        cache: 'no-store',
      })
      if (response.ok) {
        const masked = maskPhone(normalized)
        setStatus({ name: 'calling', masked })
        toast.success(`Calling ${masked}`, { description: `Pick up to talk to ${agentName}.` })
        return
      }
      // A non-JSON body falls back to the generic message for its status.
      const body: unknown = await response.json().catch(() => null)
      const message = phoneTestErrorMessage(parseApiError(response.status, body))
      setStatus({ name: 'error', message })
      toast.error(message)
    } catch (error) {
      console.warn('[test-call] call-my-phone request failed', error)
      const message = 'We couldn’t reach Neuro Tech Voice. Check your internet connection and try again.'
      setStatus({ name: 'error', message })
      toast.error(message)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {gatewayMissing
          ? `In-browser test calls aren’t switched on for your workspace yet, so ${agentName} can ring your phone instead. You’ll hear it exactly as your callers will.`
          : `${agentName} will ring your phone, and you’ll hear it exactly as your callers will.`}
      </p>

      {noNumber && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          To ring your phone, {agentName} needs a business number to call from.{' '}
          <Link href="/phone" className="font-medium underline underline-offset-2">
            Get a number
          </Link>
          . It only takes a few seconds.
        </div>
      )}

      {status.name === 'calling' ? (
        <div className="space-y-3">
          <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <PhoneCall className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Calling {status.masked} now. Pick up to talk to {agentName}; it can take up to 20 seconds to ring.
            </span>
          </div>
          <Button variant="outline" className="h-10" onClick={() => setStatus({ name: 'idle' })}>
            <RotateCcw aria-hidden="true" />
            Call again or use another number
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>Your mobile number</Label>
            <Input
              ref={inputRef}
              id={inputId}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={value}
              disabled={noNumber || status.name === 'submitting'}
              onChange={(e) => {
                setValue(e.target.value)
                if (fieldError) setFieldError(null)
              }}
              placeholder="+40 712 345 678"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${hintId} ${errorId}` : hintId}
              className="h-10"
            />
            <p id={hintId} className="text-xs text-muted-foreground">
              Include your country code, for example +40 for Romania, +44 for the UK or +1 for the US.
            </p>
            {fieldError && (
              <p id={errorId} className="text-xs text-destructive">
                {fieldError}
              </p>
            )}
          </div>

          {status.name === 'error' && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {status.message}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={noNumber || status.name === 'submitting'} className="purple-glow h-10 px-4">
              {status.name === 'submitting' ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <PhoneCall aria-hidden="true" />
              )}
              {status.name === 'submitting' ? 'Placing the call…' : 'Call my phone'}
            </Button>
            {!gatewayMissing && (
              <Button type="button" variant="ghost" onClick={onUseBrowser} className="h-10 text-muted-foreground">
                <Mic aria-hidden="true" />
                Test in the browser instead
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

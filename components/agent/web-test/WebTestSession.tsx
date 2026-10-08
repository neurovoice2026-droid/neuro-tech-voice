'use client'

// The live part of the browser test (voice over WebRTC, or text only). Loaded
// on demand by TestAgentPanel (next/dynamic, ssr: false) so the ElevenLabs SDK
// and its WebRTC stack never weigh on the agent page until the owner starts a
// test. The session token comes from POST /api/agent/web-session (minted
// server-side for the org's own agent); this view never sends overrides, tool
// mocks or platform ids, only the dynamic variables the server returned.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationProvider, useConversation } from '@elevenlabs/react'
import { AlertCircle, MessageSquare, Mic, MicOff, PhoneOff, Send, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { OrbLoader, type OrbState } from '@/components/shared/OrbLoader'
import { errorMessage, parseApiError } from '@/hooks/useVoiceCatalog'
import { cn } from '@/lib/utils'
import type { WebTestMode, WebTestSessionGrant } from './types'

type Phase = 'idle' | 'mic' | 'requesting' | 'connecting' | 'connected' | 'ended' | 'error'

interface Line {
  id: number
  role: 'user' | 'agent'
  text: string
  /** Typed in this browser and not echoed back by the provider yet (text mode). */
  local?: boolean
}

export interface WebTestSessionProps {
  mode: WebTestMode
  agentName: string
  /** The owner started a test (the panel locks the mode switch until onFinished). */
  onStart: () => void
  /** The server granted a session (the panel updates the sessions left). */
  onGranted: (grant: WebTestSessionGrant) => void
  /** The session ended or failed (the panel refreshes its availability). */
  onFinished: () => void
  /** No test can be started any more (trial tests used up): keeps the last test on screen without "Start again". */
  startBlocked?: boolean
  /**
   * Surface of the stage shown while a test starts or runs: 'cover' (the dark live-call
   * stage, agent page) or 'light' (tinted, where the screen already has a cover surface).
   */
  stage?: 'cover' | 'light'
}

const MAX_LINES = 200
const MAX_MESSAGE_CHARS = 1000

type MicCheck = 'ok' | 'denied' | 'missing' | 'unsupported'

/** Asks for the microphone before a session is minted (a refusal must not spend a test). */
async function primeMicrophone(): Promise<MicCheck> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unsupported'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return 'ok'
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing'
    return 'unsupported'
  }
}

const MIC_MESSAGES: Record<Exclude<MicCheck, 'ok'>, string> = {
  denied: 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.',
  missing: 'No microphone was found. Connect one, or use the chat test instead.',
  unsupported: 'This browser cannot use the microphone here. Try a recent Chrome, Edge, Safari or Firefox, or use the chat test.',
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function SessionView({ mode, agentName, onStart, onGranted, onFinished, startBlocked = false, stage = 'cover' }: WebTestSessionProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [maxSeconds, setMaxSeconds] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [endedByLimit, setEndedByLimit] = useState(false)
  const startedAt = useRef<number | null>(null)
  const nextId = useRef(1)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const onFinishedRef = useRef(onFinished)
  useEffect(() => {
    onFinishedRef.current = onFinished
  }, [onFinished])

  const conversation = useConversation({
    onConnect: () => {
      startedAt.current = Date.now()
      setElapsed(0)
      setPhase('connected')
    },
    onDisconnect: (details) => {
      startedAt.current = null
      setPhase((p) => (p === 'error' ? p : 'ended'))
      if (details.reason === 'error') setError('The connection to your agent was lost.')
      onFinishedRef.current()
    },
    onMessage: ({ message, role }) => {
      const text = typeof message === 'string' ? message.trim() : ''
      if (!text) return
      setLines((prev) => {
        // Text mode: our own message comes back as a user transcript; confirm it instead of repeating it.
        if (role === 'user') {
          let idx = -1
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].local && prev[i].role === 'user' && prev[i].text === text) {
              idx = i
              break
            }
          }
          if (idx !== -1) return prev.map((l, i) => (i === idx ? { ...l, local: false } : l))
        }
        const line: Line = { id: nextId.current++, role: role === 'user' ? 'user' : 'agent', text }
        return [...prev, line].slice(-MAX_LINES)
      })
    },
    onError: (message) => {
      setError(message ? `The test session failed: ${String(message).slice(0, 200)}` : 'The test session failed.')
      setPhase((p) => (p === 'connected' ? p : 'error'))
      if (!startedAt.current) onFinishedRef.current()
    },
  })
  const { endSession, startSession, sendUserMessage, status, isSpeaking } = conversation

  // Leaving the page (or the panel) always ends the session.
  const endRef = useRef(endSession)
  useEffect(() => {
    endRef.current = endSession
  }, [endSession])
  useEffect(() => () => endRef.current(), [])

  // Length cap: the panel ends the session; the agent's own maximum call
  // duration is the hard limit on the provider side.
  useEffect(() => {
    if (phase !== 'connected') return
    const id = window.setInterval(() => {
      if (!startedAt.current) return
      const s = Math.floor((Date.now() - startedAt.current) / 1000)
      setElapsed(s)
      if (maxSeconds && s >= maxSeconds) {
        setEndedByLimit(true)
        endRef.current()
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, maxSeconds])

  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const start = useCallback(async () => {
    setError(null)
    setLines([])
    setEndedByLimit(false)
    onStart()
    if (mode === 'voice') {
      setPhase('mic')
      const mic = await primeMicrophone()
      if (mic !== 'ok') {
        setError(MIC_MESSAGES[mic])
        setPhase('idle')
        onFinishedRef.current()
        return
      }
    }
    setPhase('requesting')
    let grant: WebTestSessionGrant
    try {
      const res = await fetch('/api/agent/web-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mode }),
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await parseApiError(res, 'The test could not be started.')
        if (err.status === 429) {
          toast.warning(err.message, {
            description: err.retryAfter
              ? `You can try again in about ${err.retryAfter < 90 ? `${err.retryAfter} seconds` : `${Math.ceil(err.retryAfter / 60)} minutes`}.`
              : undefined,
          })
        }
        setError(err.message)
        setPhase('idle')
        onFinishedRef.current()
        return
      }
      grant = (await res.json()) as WebTestSessionGrant
    } catch (err) {
      setError(errorMessage(err, 'The test could not be started. Please try again.'))
      setPhase('idle')
      onFinishedRef.current()
      return
    }
    onGranted(grant)
    setMaxSeconds(grant.max_session_seconds)
    setPhase('connecting')
    startSession({
      conversationToken: grant.conversation_token,
      connectionType: 'webrtc',
      serverLocation: grant.server_location,
      textOnly: mode === 'text',
      dynamicVariables: grant.dynamic_variables,
    })
  }, [mode, onStart, onGranted, startSession])

  /** Ends a live session, or abandons one still connecting (no disconnect event then). */
  function end() {
    endRef.current()
    if (phase !== 'connected') {
      setPhase('ended')
      onFinishedRef.current()
    }
  }

  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!text || status !== 'connected') return
    sendUserMessage(text)
    setLines((prev) => [...prev, { id: nextId.current++, role: 'user' as const, text, local: true }].slice(-MAX_LINES))
    setDraft('')
  }

  const busy = phase === 'mic' || phase === 'requesting' || phase === 'connecting'
  const live = phase === 'connected'
  // While a test is starting or running, the controls become a stage around the orb.
  const onStage = busy || live
  const remaining = maxSeconds ? maxSeconds - elapsed : null
  const statusText =
    phase === 'mic' ? 'Waiting for microphone permission…'
    : phase === 'requesting' ? 'Preparing a secure test session…'
    : phase === 'connecting' ? `Connecting to ${agentName}…`
    : live ? (mode === 'voice' ? (isSpeaking ? `${agentName} is speaking` : 'Listening to you') : `Chatting with ${agentName}`)
    : phase === 'ended' ? (endedByLimit ? 'The test reached its time limit and ended.' : 'The test has ended.')
    : 'Not connected'
  const awaitingReply = lines.length > 0 && lines[lines.length - 1].role === 'user'
  const orbState: OrbState =
    phase === 'mic' ? 'breathing'
    : busy ? 'connecting'
    : mode === 'voice' ? (isSpeaking ? 'composing' : 'listening')
    : awaitingReply ? 'composing' : 'breathing'
  const dark = stage === 'cover'
  // The brand tint is reserved for a live voice orb on a light surface (accent policy #9).
  const orbTone = !dark && live && mode === 'voice' ? 'brand' : 'ink'

  return (
    <div className="space-y-3">
      {/* The stage: one element throughout (tinted when idle, the dark cover while a test starts
          or runs), so the status line inside it stays the same live region. */}
      <div
        className={cn(
          'flex flex-col items-center overflow-hidden rounded-2xl px-4 pt-4 pb-5 text-center transition-colors duration-300 sm:px-5',
          onStage && dark ? 'app-cover' : 'bg-secondary',
        )}
      >
        <div className="flex min-h-6 w-full items-center justify-between gap-3">
          {onStage && dark ? (
            <Eyebrow tone="cover">{mode === 'voice' ? 'Test call' : 'Test chat'}</Eyebrow>
          ) : (
            <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {mode === 'voice' ? 'Test call' : 'Test chat'}
            </p>
          )}
          {live && remaining !== null && (
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium tabular-nums',
                dark ? 'bg-white/10 text-[#dedce0]' : 'bg-white text-foreground shadow-hair',
              )}
              title="Time left in this test"
            >
              <Timer className="size-3" aria-hidden="true" />
              <span className="sr-only">Time left: </span>
              {formatClock(remaining)}
            </span>
          )}
        </div>
        {onStage ? (
          // Decorative: the status line below is the announced text.
          <div aria-hidden="true" className="mt-2">
            <OrbLoader state={orbState} size={64} surface={dark ? 'dark' : 'light'} tone={orbTone} hideLabel delayMs={0} />
          </div>
        ) : (
          <span aria-hidden="true" className="mt-2 grid size-16 place-items-center rounded-full bg-white text-foreground shadow-hair">
            {mode === 'voice' ? <Mic className="size-6" strokeWidth={1.5} /> : <MessageSquare className="size-6" strokeWidth={1.5} />}
          </span>
        )}
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'mt-3 text-sm leading-[21px]',
            onStage ? (dark ? 'font-medium text-[#dedce0]' : 'font-medium text-foreground') : 'text-muted-foreground',
          )}
        >
          {statusText}
        </p>
        {onStage ? (
          <Button
            variant="destructive"
            onClick={end}
            disabled={phase === 'mic' || phase === 'requesting'}
            className="mt-4"
          >
            <PhoneOff aria-hidden="true" /> End test
          </Button>
        ) : startBlocked ? null : (
          <Button onClick={() => void start()} className="mt-4">
            {mode === 'voice' ? <Mic aria-hidden="true" /> : <Send aria-hidden="true" />}
            {phase === 'ended' || phase === 'error' ? 'Start again' : mode === 'voice' ? 'Start talking' : 'Start chat'}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          {mode === 'voice' && phase === 'idle' ? <MicOff aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(lines.length > 0 || live) && (
        <div
          ref={transcriptRef}
          role="log"
          aria-live="polite"
          aria-label="Test conversation transcript"
          className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-2xl bg-secondary p-4"
        >
          {lines.length === 0 && (
            <p className="text-[13px] leading-[19px] text-muted-foreground">
              {mode === 'voice' ? 'Say hello to start the conversation.' : 'Type a message to start the conversation.'}
            </p>
          )}
          {lines.map((l) => (
            <div key={l.id} className={cn('flex flex-col gap-1', l.role === 'user' ? 'items-end' : 'items-start')}>
              <span className="px-1 text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {l.role === 'user' ? 'You' : agentName}
              </span>
              <p
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-[21px] break-words',
                  l.role === 'user'
                    ? 'rounded-br-md bg-primary text-white'
                    : 'rounded-bl-md bg-white text-foreground shadow-hair',
                  l.local && 'opacity-75',
                )}
              >
                {l.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {mode === 'text' && live && (
        <form onSubmit={send} className="flex gap-2">
          <label htmlFor="web-test-message" className="sr-only">Message to your agent</label>
          <Input
            id="web-test-message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder="Type what a caller would say…"
            autoComplete="off"
          />
          <Button type="submit" disabled={!draft.trim()} className="h-10">
            <Send aria-hidden="true" /> Send
          </Button>
        </form>
      )}
    </div>
  )
}

export default function WebTestSession(props: WebTestSessionProps) {
  return (
    <ConversationProvider>
      <SessionView {...props} />
    </ConversationProvider>
  )
}

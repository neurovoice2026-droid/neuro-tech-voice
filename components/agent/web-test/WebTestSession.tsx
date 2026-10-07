'use client'

// The live part of the browser test (voice over WebRTC, or text only). Loaded
// on demand by TestAgentPanel (next/dynamic, ssr: false) so the ElevenLabs SDK
// and its WebRTC stack never weigh on the agent page until the owner starts a
// test. The session token comes from POST /api/agent/web-session (minted
// server-side for the org's own agent); this view never sends overrides, tool
// mocks or platform ids, only the dynamic variables the server returned.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationProvider, useConversation } from '@elevenlabs/react'
import { Bot, Loader2, Mic, MicOff, PhoneOff, Send, Timer, User } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

function SessionView({ mode, agentName, onStart, onGranted, onFinished, startBlocked = false }: WebTestSessionProps) {
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
  const remaining = maxSeconds ? maxSeconds - elapsed : null
  const statusText =
    phase === 'mic' ? 'Waiting for microphone permission…'
    : phase === 'requesting' ? 'Preparing a secure test session…'
    : phase === 'connecting' ? `Connecting to ${agentName}…`
    : live ? (mode === 'voice' ? (isSpeaking ? `${agentName} is speaking` : 'Listening to you') : `Chatting with ${agentName}`)
    : phase === 'ended' ? (endedByLimit ? 'The test reached its time limit and ended.' : 'The test has ended.')
    : 'Not connected'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!live && !busy ? (
          startBlocked ? null : (
            <Button onClick={() => void start()} className="gap-2">
              {mode === 'voice' ? <Mic aria-hidden="true" /> : <Send aria-hidden="true" />}
              {phase === 'ended' || phase === 'error' ? 'Start again' : mode === 'voice' ? 'Start talking' : 'Start chat'}
            </Button>
          )
        ) : (
          <Button
            variant="destructive"
            onClick={end}
            disabled={phase === 'mic' || phase === 'requesting'}
            className="gap-2"
          >
            <PhoneOff aria-hidden="true" /> End test
          </Button>
        )}
        <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {live && mode === 'voice' && (isSpeaking ? <Bot className="size-3.5" aria-hidden="true" /> : <Mic className="size-3.5 text-green-600" aria-hidden="true" />)}
          {statusText}
        </span>
        {live && remaining !== null && (
          <Badge variant="outline" className="ml-auto gap-1 tabular-nums" title="Time left in this test">
            <Timer aria-hidden="true" />
            <span className="sr-only">Time left: </span>
            {formatClock(remaining)}
          </Badge>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          {mode === 'voice' && phase === 'idle' ? <MicOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
          {error}
        </p>
      )}

      {(lines.length > 0 || live) && (
        <div
          ref={transcriptRef}
          role="log"
          aria-live="polite"
          aria-label="Test conversation transcript"
          className="max-h-72 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3"
        >
          {lines.length === 0 && <p className="text-sm text-muted-foreground">{mode === 'voice' ? 'Say hello to start the conversation.' : 'Type a message to start the conversation.'}</p>}
          {lines.map((l) => (
            <div key={l.id} className={cn('flex gap-2 text-sm', l.role === 'user' && 'flex-row-reverse text-right')}>
              <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
                {l.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
              </span>
              <p className={cn('max-w-[85%] rounded-lg px-3 py-1.5', l.role === 'user' ? 'bg-primary/10' : 'bg-card ring-1 ring-foreground/10')}>
                <span className="sr-only">{l.role === 'user' ? 'You: ' : `${agentName}: `}</span>
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
          <Button type="submit" disabled={!draft.trim()} className="gap-1.5">
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

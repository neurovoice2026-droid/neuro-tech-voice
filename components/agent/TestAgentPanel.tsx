'use client'

// "Test your agent": talk to the agent from the browser (WebRTC) or chat with
// it (text only), on the agent page and at the end of onboarding. The server
// (GET/POST /api/agent/web-session) decides what is available and mints each
// session for the org's own agent; this panel never sends an agent id. The
// ElevenLabs SDK is loaded on the client only, in a separate chunk.

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { FlaskConical, Headphones, MessageSquare, Mic, RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage, parseApiError } from '@/hooks/useVoiceCatalog'
import { cn } from '@/lib/utils'
import type { WebTestAvailability, WebTestMode, WebTestPrivacy, WebTestSessionGrant } from './web-test/types'

const WebTestSession = dynamic(() => import('./web-test/WebTestSession'), {
  ssr: false,
  loading: () => <Skeleton className="h-9 w-40" />,
})

interface TestAgentPanelProps {
  agentName: string
  /** Changes when something that affects availability changed (agent switched on/off, synced). */
  refreshKey?: string
  /** 'onboarding': shown right after launch, without the card chrome. */
  variant?: 'card' | 'onboarding'
  className?: string
}

const UNAVAILABLE_COPY: Record<NonNullable<WebTestAvailability['reason']>, string> = {
  agent_missing: 'Set up your agent first, then you can test it here.',
  agent_inactive: 'Your agent is switched off. Switch it on to test it.',
  agent_not_ready: 'Your agent is still being set up. You can test it as soon as its status is Ready.',
  not_configured: 'Browser tests are not available right now.',
}

function retentionText(days: number): string {
  if (days < 0) return 'kept until you delete them'
  if (days === 0) return 'deleted right after the conversation'
  return `kept for ${days} day${days === 1 ? '' : 's'}`
}

function PrivacyNote({ privacy, mode }: { privacy: WebTestPrivacy | null; mode: WebTestMode }) {
  const recording = privacy
    ? `${mode === 'voice' && privacy.record_audio ? 'Your voice is recorded and the conversation is' : 'The transcript is'} ${retentionText(privacy.retention_days)}, as set in Call handling → Privacy.`
    : 'They follow your privacy settings in Call handling → Privacy.'
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Test conversations appear in Calls with a Test badge. {recording} They don&apos;t use your plan minutes and don&apos;t run your
      automations. Transfers, bookings and messages only work on real phone calls.
    </p>
  )
}

export function TestAgentPanel({ agentName, refreshKey, variant = 'card', className }: TestAgentPanelProps) {
  const [availability, setAvailability] = useState<WebTestAvailability | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<WebTestMode>('voice')
  const [inSession, setInSession] = useState(false)
  // A test was started from this panel: its view (transcript, "ended") stays
  // on screen even when it was the last free test.
  const [hadSession, setHadSession] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const res = await fetch('/api/agent/web-session', { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal })
        if (!res.ok) throw await parseApiError(res, 'Could not check whether your agent can be tested.')
        const data = (await res.json()) as WebTestAvailability
        setAvailability(data)
        setLoadError(null)
      } catch (err) {
        if (controller.signal.aborted) return
        setLoadError(errorMessage(err, 'Could not check whether your agent can be tested.'))
      }
    })()
    return () => controller.abort()
  }, [refreshKey, reloadCount])

  const onStart = useCallback(() => {
    setInSession(true)
    setHadSession(true)
  }, [])
  const onGranted = useCallback((grant: WebTestSessionGrant) => {
    setAvailability((prev) => (prev ? { ...prev, sessions_left: grant.sessions_left, privacy: grant.privacy } : prev))
  }, [])
  const onFinished = useCallback(() => {
    setInSession(false)
    setReloadCount((n) => n + 1)
  }, [])

  const textAvailable = !!availability?.text_available
  const activeMode: WebTestMode = mode === 'text' && !textAvailable ? 'voice' : mode
  const outOfTests = availability?.sessions_left === 0 && !inSession

  const body = (
    <div className="space-y-4">
      {!availability && !loadError && <Skeleton className="h-24 w-full" />}
      {loadError && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
          {loadError}
          <Button variant="outline" size="sm" onClick={() => setReloadCount((n) => n + 1)} className="gap-1.5">
            <RotateCw aria-hidden="true" /> Retry
          </Button>
        </div>
      )}
      {availability && !availability.available && availability.reason && (
        <p className="text-sm text-muted-foreground">{UNAVAILABLE_COPY[availability.reason]}</p>
      )}
      {availability?.available && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Test mode" className="inline-flex rounded-lg border p-0.5">
              {(['voice', 'text'] as const).map((m) => {
                // Out of tests: switching would replace the finished test's transcript with an empty view.
                const disabled = inSession || outOfTests || (m === 'text' && !textAvailable)
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={activeMode === m}
                    disabled={disabled}
                    onClick={() => setMode(m)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      activeMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m === 'voice' ? <Mic className="size-3.5" aria-hidden="true" /> : <MessageSquare className="size-3.5" aria-hidden="true" />}
                    {m === 'voice' ? 'Talk' : 'Chat'}
                  </button>
                )
              })}
            </div>
            {availability.sessions_left !== null && (
              <Badge variant="outline" className="text-xs">
                {availability.sessions_left} free test{availability.sessions_left === 1 ? '' : 's'} left
              </Badge>
            )}
          </div>
          {!textAvailable && (
            <p className="text-xs text-muted-foreground">Chat tests become available after your agent&apos;s next platform update.</p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {activeMode === 'voice' ? (
              <>
                <Headphones className="size-3.5 shrink-0" aria-hidden="true" />
                Uses your microphone and speakers (headphones avoid echo). Your browser asks for permission first. A test lasts at most{' '}
                {Math.round(availability.max_session_seconds / 60)} minutes.
              </>
            ) : (
              <>
                <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
                Type what a caller would say: your agent answers with the same instructions and knowledge, without audio.
              </>
            )}
          </p>
          {(!outOfTests || hadSession) && (
            <WebTestSession
              key={activeMode}
              mode={activeMode}
              agentName={agentName}
              startBlocked={outOfTests}
              onStart={onStart}
              onGranted={onGranted}
              onFinished={onFinished}
            />
          )}
          {outOfTests && (
            <p role="status" className="text-sm text-muted-foreground">
              {hadSession ? 'That was your last free browser test. ' : 'You have used all free browser tests of your trial. '}
              Choose a plan to keep testing.
            </p>
          )}
          <PrivacyNote privacy={availability.privacy} mode={activeMode} />
        </>
      )}
    </div>
  )

  if (variant === 'onboarding') {
    return (
      <section aria-labelledby="test-agent-title" className={cn('w-full space-y-3 rounded-xl border p-4 text-left', className)}>
        <h3 id="test-agent-title" className="flex items-center gap-2 text-base font-semibold">
          <FlaskConical className="size-4 text-primary" aria-hidden="true" /> Try your agent now
        </h3>
        <p className="text-sm text-muted-foreground">Talk to {agentName || 'your agent'} from your browser before you connect a phone number.</p>
        {body}
      </section>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" aria-hidden="true" /> Test your agent
        </CardTitle>
        <CardDescription>Talk to {agentName} from your browser, or chat with it, to check your latest changes.</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}

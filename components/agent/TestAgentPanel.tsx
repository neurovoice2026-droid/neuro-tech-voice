'use client'

// "Test your agent": talk to the agent from the browser (WebRTC) or chat with
// it (text only), on the agent page and at the end of onboarding. The server
// (GET/POST /api/agent/web-session) decides what is available and mints each
// session for the org's own agent; this panel never sends an agent id. The
// ElevenLabs SDK is loaded on the client only, in a separate chunk.

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertCircle, Headphones, Info, MessageSquare, Mic, RotateCw } from 'lucide-react'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { errorMessage, parseApiError } from '@/hooks/useVoiceCatalog'
import { cn } from '@/lib/utils'
import { MIN_SESSION_SECONDS, type WebTestAvailability, type WebTestMode, type WebTestPrivacy, type WebTestSessionGrant } from './web-test/types'

const WebTestSession = dynamic(() => import('./web-test/WebTestSession'), {
  ssr: false,
  // The session chunk (ElevenLabs SDK) is on its way: the idle stage's shell (same size, tint and
  // centre) holds its place with a small orb.
  loading: () => (
    <OrbLoader size={32} hideLabel label="Loading the test" className="min-h-[217px] rounded-2xl bg-secondary" />
  ),
})

interface TestAgentPanelProps {
  agentName: string
  /** Changes when something that affects availability changed (agent switched on/off, synced). */
  refreshKey?: string
  /** 'onboarding': shown right after launch, as a plain white panel without the tinted band. */
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
    <p className="border-t border-rule pt-4 text-xs leading-[18px] text-muted-foreground">
      Test conversations appear in Calls with a Test badge. {recording}{' '}They don&apos;t use your plan minutes and don&apos;t run your
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
    setAvailability((prev) => (prev ? { ...prev, sessions_left: grant.sessions_left, seconds_left: grant.seconds_left, privacy: grant.privacy } : prev))
  }, [])
  const onFinished = useCallback(() => {
    setInSession(false)
    setReloadCount((n) => n + 1)
  }, [])

  const textAvailable = !!availability?.text_available
  const activeMode: WebTestMode = mode === 'text' && !textAvailable ? 'voice' : mode
  // Mirrors the server's refusals (lib/voice-providers/web-test.ts): no sessions or
  // seconds left, or browser tests paused for the account.
  const blocked = !!availability?.blocked
  const unpaid = availability?.sessions_left !== null && availability?.sessions_left !== undefined
  const timeSpent = availability?.seconds_left !== null && availability?.seconds_left !== undefined && availability.seconds_left < MIN_SESSION_SECONDS
  const outOfTests = !inSession && (availability?.sessions_left === 0 || blocked || timeSpent)

  const body = (
    <div className="space-y-4">
      {!availability && !loadError && (
        // Sized to the controls, stage and privacy note it stands in for, so the page does not move when they arrive.
        <OrbLoader
          size={32}
          layout="row"
          label="Checking whether your agent can be tested…"
          className={cn('justify-center', variant === 'onboarding' ? 'min-h-[480px] sm:min-h-[426px]' : 'min-h-[520px] sm:min-h-[432px] xl:min-h-[450px] xl:max-[1439px]:min-h-[480px]')}
        />
      )}
      {loadError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{loadError}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => setReloadCount((n) => n + 1)}>
              <RotateCw aria-hidden="true" /> Retry
            </Button>
          </AlertAction>
        </Alert>
      )}
      {availability && !availability.available && availability.reason && (
        <Alert role="note">
          <Info aria-hidden="true" />
          <AlertDescription>{UNAVAILABLE_COPY[availability.reason]}</AlertDescription>
        </Alert>
      )}
      {availability?.available && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Segmented control (tinted track, white active segment), as on the site. */}
            <div role="group" aria-label="Test mode" className="inline-flex h-9 items-center gap-0.5 rounded-full bg-secondary p-1">
              {(['voice', 'text'] as const).map((m) => {
                // Out of tests: switching would replace the finished test's transcript with an empty view.
                const disabled = inSession || outOfTests || (m === 'text' && !textAvailable)
                const active = activeMode === m
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => setMode(m)}
                    className={cn(
                      'tap-44 relative inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-not-allowed',
                      active ? 'bg-white text-foreground shadow-pill' : 'text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground',
                    )}
                  >
                    {m === 'voice' ? <Mic className="size-3.5" aria-hidden="true" /> : <MessageSquare className="size-3.5" aria-hidden="true" />}
                    {m === 'voice' ? 'Talk' : 'Chat'}
                  </button>
                )
              })}
            </div>
            {availability.sessions_left !== null && (
              <Badge variant="outline" className="tabular-nums">
                {availability.sessions_left} free test{availability.sessions_left === 1 ? '' : 's'} left
              </Badge>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="flex items-start gap-2 text-xs leading-[18px] text-muted-foreground">
              {activeMode === 'voice' ? (
                <>
                  <Headphones className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Uses your microphone and speakers (headphones avoid echo). Your browser asks for permission first. A test lasts at most{' '}
                    {Math.round(availability.max_session_seconds / 60)} minutes.
                  </span>
                </>
              ) : (
                <>
                  <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>Type what a caller would say: your agent answers with the same instructions and knowledge, without audio.</span>
                </>
              )}
            </p>
            {!textAvailable && (
              <p className="pl-5.5 text-xs leading-[18px] text-muted-foreground">Chat tests become available after your agent&apos;s next platform update.</p>
            )}
          </div>
          {(!outOfTests || hadSession) && (
            <WebTestSession
              key={activeMode}
              mode={activeMode}
              agentName={agentName}
              startBlocked={outOfTests}
              // Onboarding's success screen already carries the dark "you're live" card: one cover per screen.
              stage={variant === 'onboarding' ? 'light' : 'cover'}
              onStart={onStart}
              onGranted={onGranted}
              onFinished={onFinished}
            />
          )}
          {outOfTests && (
            <Alert variant="warning" role="status">
              <Info aria-hidden="true" />
              <AlertDescription>
                {blocked
                  ? 'Browser tests are paused for your account. Please contact support to turn them back on.'
                  : unpaid
                    ? `${hadSession ? 'That was your last free browser test. ' : 'You have used all free browser tests of your trial. '}Choose a plan to keep testing.`
                    : 'You have used today’s browser test time. It resets at midnight UTC; phone test calls still work.'}
              </AlertDescription>
            </Alert>
          )}
          <PrivacyNote privacy={availability.privacy} mode={activeMode} />
        </>
      )}
    </div>
  )

  if (variant === 'onboarding') {
    return (
      <section
        aria-labelledby="test-agent-title"
        className={cn('w-full space-y-4 rounded-2xl bg-white p-5 text-left shadow-hair', className)}
      >
        <div className="space-y-1">
          <h3 id="test-agent-title" className="text-[15px] leading-[22px] font-medium">Try your agent now</h3>
          <p className="text-[13px] leading-[19px] text-muted-foreground">
            Talk to {agentName || 'your agent'} from your browser before you connect a phone number.
          </p>
        </div>
        {body}
      </section>
    )
  }

  // The agent page's only band: a tinted stage holding a white panel, like the site's product stages.
  return (
    <section aria-labelledby="test-agent-title" className={cn('flex flex-col rounded-[24px] bg-secondary p-2 sm:p-3', className)}>
      <div className="px-3 pt-3 pb-4 sm:px-4">
        {/* CardTitle scale, matching "Voice providers" beside it and every other panel title. */}
        <h2 id="test-agent-title" className="text-[15px] leading-[22px] font-medium">
          Test your agent
        </h2>
        <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
          Talk to {agentName} from your browser, or chat with it, to check your latest changes.
        </p>
      </div>
      {/* flex-1: beside the provider panel (xl) the white panel fills the band's height. */}
      <div className="flex-1 rounded-2xl bg-white p-4 shadow-panel sm:p-5">{body}</div>
    </section>
  )
}

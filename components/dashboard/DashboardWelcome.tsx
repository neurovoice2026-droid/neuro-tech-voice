'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useId, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Circle, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import type { createClient } from '@/lib/supabase/client'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { cn, formatPhoneNumber } from '@/lib/utils'
import { PLANS, type Plan } from '@/types'
import { ONBOARDING_STORAGE_KEY } from '@/app/onboarding/_lib/storage-key'

// The in-browser test call loads the first time the owner opens it.
const TestCallDialog = dynamic(() => import('./TestCallDialog').then((m) => m.TestCallDialog))

// "Get your agent answering calls": the setup steps that are still open,
// read from the real data (voice on the agent, an active number, a connected
// Google Calendar, a real inbound call). Shown after onboarding and until the
// required steps are done or the owner hides it.

interface DashboardWelcomeProps {
  /** Scopes the queries explicitly; without it row-level security limits them to the owner's organisation. */
  orgId?: string
  /** Read on the server with the rest of the page; the checklist then makes no browser queries. */
  initialSetup?: SetupSnapshot | null
}

export interface SetupSnapshot {
  orgId: string
  plan: Plan
  agentName: string
  voiceName: string | null
  hasVoice: boolean
  phoneNumber: string | null
  calendarConnected: boolean
  hasFirstCall: boolean
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; setup: SetupSnapshot }

type SupabaseBrowserClient = ReturnType<typeof createClient>

/** Postgres undefined_column: the database doesn't have migration 010 yet. */
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703'
}

async function loadSetupSnapshot(supabase: SupabaseBrowserClient, orgIdHint: string | undefined): Promise<SetupSnapshot | null> {
  const orgQuery = supabase.from('organizations').select('id, plan')
  const orgRes = await (orgIdHint ? orgQuery.eq('id', orgIdHint) : orgQuery).limit(1).maybeSingle()
  if (orgRes.error) throw new Error(`organization: ${orgRes.error.code ?? ''} ${orgRes.error.message}`)
  if (!orgRes.data) return null
  const orgId = orgRes.data.id as string
  const plan = (Object.prototype.hasOwnProperty.call(PLANS, orgRes.data.plan) ? orgRes.data.plan : 'trial') as Plan

  const agentColumns = 'name, voice_id, voice_name, cartesia_voice_id, cartesia_voice_name'
  const agentQuery = (columns: string) =>
    supabase.from('agents').select(columns).eq('org_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  // A caller the agent actually talked to: calls refused by the router (trial
  // over, agent paused) are stored as inbound 'no-answer' and don't count.
  const callsQuery = (withTestFilter: boolean) => {
    const query = supabase.from('calls').select('id').eq('org_id', orgId).eq('direction', 'inbound').eq('status', 'completed')
    return (withTestFilter ? query.eq('is_test', false) : query).limit(1)
  }

  const [agentFirst, phoneRes, calendarRes, callsFirst] = await Promise.all([
    agentQuery(agentColumns),
    supabase.from('phone_numbers').select('number').eq('org_id', orgId).eq('is_active', true).limit(1),
    supabase.from('integrations').select('id').eq('org_id', orgId).eq('type', 'google_calendar').eq('is_active', true).limit(1),
    callsQuery(true),
  ])

  // Before migration 010 the Cartesia and test-call columns don't exist yet.
  const agentRes = isMissingColumn(agentFirst.error) ? await agentQuery('name, voice_id, voice_name') : agentFirst
  const callsRes = isMissingColumn(callsFirst.error) ? await callsQuery(false) : callsFirst

  for (const [label, res] of [['agent', agentRes], ['phone numbers', phoneRes], ['integrations', calendarRes], ['calls', callsRes]] as const) {
    if (res.error) throw new Error(`${label}: ${res.error.code ?? ''} ${res.error.message}`)
  }

  const agent = (agentRes.data ?? null) as Record<string, unknown> | null
  const cartesiaVoice = typeof agent?.cartesia_voice_id === 'string' && agent.cartesia_voice_id ? agent.cartesia_voice_id : null
  const legacyVoice = typeof agent?.voice_id === 'string' && agent.voice_id ? agent.voice_id : null
  const voiceName =
    (typeof agent?.cartesia_voice_name === 'string' && agent.cartesia_voice_name) ||
    (typeof agent?.voice_name === 'string' && agent.voice_name) ||
    null

  return {
    orgId,
    plan,
    agentName: typeof agent?.name === 'string' && agent.name ? agent.name : 'Your agent',
    voiceName,
    hasVoice: Boolean(cartesiaVoice ?? legacyVoice),
    phoneNumber: (phoneRes.data?.[0]?.number as string | undefined) ?? null,
    calendarConnected: (calendarRes.data?.length ?? 0) > 0,
    hasFirstCall: (callsRes.data?.length ?? 0) > 0,
  }
}

// ─── Per-browser memory (dismissal, and whether to reserve space while loading) ─

const LAST_VISIBILITY_KEY = 'ntv-setup-checklist:last'
const dismissedKey = (orgId: string) => `ntv-setup-checklist:dismissed:${orgId}`

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Blocked storage: the checklist just can't remember this in the next visit.
  }
}

const noopSubscribe = () => () => {}

export function DashboardWelcome({ orgId, initialSetup }: DashboardWelcomeProps = {}) {
  const searchParams = useSearchParams()
  const welcome = searchParams.get('welcome') === 'true'
  const titleId = useId()
  const [load, setLoad] = useState<LoadState>(() => (initialSetup ? { status: 'ready', setup: initialSetup } : { status: 'loading' }))
  const [attempt, setAttempt] = useState(0)
  // Hidden with the button just now, or in an earlier visit (this browser's storage).
  const [dismissedNow, setDismissedNow] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  // Mounted from the first open on, so closing still animates.
  const [testUsed, setTestUsed] = useState(false)
  const [connectingCalendar, setConnectingCalendar] = useState(false)
  // Server render and hydration assume "unknown"; the browser's memory applies right after.
  const lastVisibility = useSyncExternalStore(noopSubscribe, () => readStorage(LAST_VISIBILITY_KEY), () => null)

  useEffect(() => {
    if (!welcome) return
    toast.success('Your agent is ready', {
      description: 'Follow the checklist to start taking calls.',
      duration: 6000,
    })
    // Setup is finished (this is also where Stripe Checkout lands), so the
    // tab's onboarding draft with the business details isn't needed any more.
    try {
      window.sessionStorage.removeItem(ONBOARDING_STORAGE_KEY)
    } catch {
      // Storage blocked: nothing was saved there either.
    }
    // Remove the query params without a full reload
    const url = new URL(window.location.href)
    url.searchParams.delete('welcome')
    url.searchParams.delete('session_id')
    window.history.replaceState({}, '', url.toString())
  }, [welcome])

  useEffect(() => {
    // The server already read it; a retry after an error reads it again here.
    if (initialSetup && attempt === 0) return
    let cancelled = false
    import('@/lib/supabase/client')
      .then(({ createClient }) => loadSetupSnapshot(createClient(), orgId))
      .then((setup) => {
        if (cancelled) return
        if (!setup) {
          setLoad({ status: 'error' })
          console.warn('[dashboard] setup checklist: no organization visible to this session')
          return
        }
        setLoad({ status: 'ready', setup })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('[dashboard] setup checklist failed to load', error)
        setLoad({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [orgId, attempt, initialSetup])

  const setup = load.status === 'ready' ? load.setup : null
  // The server can't see the dismissal, so it renders nothing and the browser decides right after hydration.
  const setupOrgId = setup?.orgId ?? null
  const storedDismissed = useSyncExternalStore(
    noopSubscribe,
    () => (setupOrgId ? readStorage(dismissedKey(setupOrgId)) === '1' : false),
    () => true
  )
  const dismissed = dismissedNow || storedDismissed
  const requiredDone = setup ? setup.hasVoice && setup.phoneNumber !== null && setup.hasFirstCall : false
  const visible = setup !== null && !dismissed && (welcome || !requiredDone)

  useEffect(() => {
    if (load.status === 'ready') writeStorage(LAST_VISIBILITY_KEY, visible ? 'shown' : 'hidden')
  }, [load.status, visible])

  const hide = useCallback(() => {
    if (!setup) return
    writeStorage(dismissedKey(setup.orgId), '1')
    setDismissedNow(true)
    toast('Checklist hidden', { description: 'You can still do these from Agent, Phone Numbers and Integrations.' })
  }, [setup])

  const expectVisible = welcome || lastVisibility === 'shown'

  if (load.status === 'loading') {
    if (!expectVisible) return null
    return (
      <Container>
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-busy="true" aria-label="Loading your setup checklist">
          <Skeleton className="h-5 w-56 max-w-full" />
          <Skeleton className="mt-2 h-1.5 w-full" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        </div>
      </Container>
    )
  }

  if (load.status === 'error') {
    if (!expectVisible) return null
    return (
      <Container>
        <div role="alert" className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">We couldn’t load your setup checklist.</p>
          <Button variant="outline" size="sm" className="h-8 self-start sm:self-auto" onClick={() => {
            setLoad({ status: 'loading' })
            setAttempt((n) => n + 1)
          }}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        </div>
      </Container>
    )
  }

  if (!visible || !setup) return null

  const steps = [setup.hasVoice, setup.phoneNumber !== null, setup.calendarConnected, setup.hasFirstCall]
  const doneCount = steps.filter(Boolean).length
  const canUseGoogle = entitlementsFor(setup.plan).googleIntegrations

  return (
    <Container>
      <section aria-labelledby={titleId} className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {requiredDone ? `${setup.agentName} is answering calls` : `Get ${setup.agentName} answering calls`}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{doneCount} of 4 done</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={hide} aria-label="Hide setup checklist" className="relative shrink-0 text-muted-foreground after:absolute after:-inset-1.5">
            <X aria-hidden="true" />
          </Button>
        </div>
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={doneCount}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${(doneCount / 4) * 100}%` }} />
        </div>

        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SetupItem
            done={setup.hasVoice}
            title="Choose a voice"
            description={setup.hasVoice ? (setup.voiceName ? `Voice: ${setup.voiceName}` : 'Your agent has a voice.') : 'Pick how your agent sounds on calls.'}
            action={<Link href="/agent" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8')}>Choose a voice</Link>}
          />
          <SetupItem
            done={setup.phoneNumber !== null}
            title="Get a phone number"
            description={
              setup.phoneNumber
                ? `Answering on ${formatPhoneNumber(setup.phoneNumber)}.`
                : 'Buy a local number in seconds. Your agent answers it straight away.'
            }
            action={<Link href="/phone" className={cn(buttonVariants({ size: 'sm' }), 'h-8')}>Get a number</Link>}
          />
          <SetupItem
            done={setup.calendarConnected}
            title="Connect Google Calendar"
            badges={['Optional', 'Beta']}
            description={
              setup.calendarConnected
                ? 'Connected. Your agent can book appointments into your calendar.'
                : 'Let your agent check your free times and book appointments.'
            }
            action={
              canUseGoogle ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={connectingCalendar}
                  onClick={() => {
                    // Full page navigation: the connect route redirects to Google's consent screen.
                    setConnectingCalendar(true)
                    window.location.assign('/api/integrations/google/connect?type=google_calendar')
                  }}
                >
                  {connectingCalendar ? 'Opening Google…' : 'Connect calendar'}
                </Button>
              ) : (
                <UpgradeNotice compact feature="Calendar booking" requiredPlan={requiredPlanFor('googleIntegrations')} />
              )
            }
          />
          <SetupItem
            done={setup.hasFirstCall}
            title="Receive your first call"
            description={
              setup.hasFirstCall
                ? 'Your agent has answered its first caller.'
                : setup.phoneNumber
                  ? `Call ${formatPhoneNumber(setup.phoneNumber)} to hear it answer, or test it in your browser.`
                  : 'Test calls don’t count here: this ticks once a real caller rings your number.'
            }
            action={
              <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  setTestUsed(true)
                  setTestOpen(true)
                }}>
                Test your agent
              </Button>
            }
          />
        </ol>
      </section>

      {testUsed && (
        <TestCallDialog open={testOpen} onOpenChange={setTestOpen} phoneNumber={setup.phoneNumber} agentName={setup.agentName} />
      )}
    </Container>
  )
}

// Matches the dashboard page padding, since this renders above the page content.
function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6 sm:pt-6">{children}</div>
}

function SetupItem({
  done, title, description, badges = [], action,
}: {
  done: boolean
  title: string
  description: string
  badges?: string[]
  action?: React.ReactNode
}) {
  return (
    <li className={cn('flex min-w-0 flex-col gap-3 rounded-lg border p-3', done ? 'border-emerald-200 bg-emerald-50/50' : 'bg-background')}>
      <div className="flex items-start gap-2.5">
        {done ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
            {title}
            <span className="sr-only">{done ? ' (done)' : ' (to do)'}</span>
            {badges.map((badge) => (
              <span
                key={badge}
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  badge === 'Beta' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                )}
              >
                {badge}
              </span>
            ))}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {!done && action && <div className="mt-auto">{action}</div>}
    </li>
  )
}

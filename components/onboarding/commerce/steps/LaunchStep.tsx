'use client'

// Step 6 — Launch: the server's checklist, the plan, a summary and the
// launch (POST /api/onboarding/complete, the same route and outcome handling
// as the service flow's Step5Launch: live / saved-but-not-live / checkout).
// The plans are the store family (plansForBusinessType('ecommerce')): the
// trial, the self-serve store tiers and Store Enterprise as a contact-sales
// card. The server refuses any other family for a store (409 plan_not_available).

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Bot, CheckCircle2, Circle, CreditCard, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { LiveDot } from '@/components/shared/LiveDot'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { TestAgentPanel } from '@/components/agent/TestAgentPanel'
import { BillingPeriod, PlanCard } from '@/components/onboarding/steps/Step5Launch'
import { useCommerceOnboardingStore, type CommerceChecklistItem } from '@/store/useCommerceOnboardingStore'
import { cn } from '@/lib/utils'
import { PLANS, plansForBusinessType, type Organization, type Plan } from '@/types'
import { StepBody } from '../../StepIndicator'
import { ContactSalesPlanCard } from '../ContactSalesPlanCard'
import { readCommerceError } from '../api'
import { checklistStepFor } from '../copy'
import { useCommerceNavigation } from '../navigation'
import { CommerceStepHeader } from '../shared'

/** The paid plans an online store may launch on, cheapest first; the trial comes before them. */
const STORE_PLAN_IDS = plansForBusinessType('ecommerce')
/** The tier most stores fit, marked "Our pick" (the billing page recommends the same one). */
const RECOMMENDED_PLAN: Plan = 'store_growth'
const SALES_EMAIL = 'sales@neuro-tech-voice.com'

interface LaunchStepProps {
  organization: Organization
}

interface CompleteResponse {
  checkout_url?: string | null
  error?: string
  /** True only when the agent is switched on and will answer calls. */
  activated?: boolean
  /** Sanitized message about the primary voice provider sync. */
  warning?: string | null
}

type LaunchOutcome = { kind: 'live' } | { kind: 'not_live'; detail: string | null; checkoutUrl: string | null }

/** The outcome replaces the form: bring its heading into view and give it focus. */
function useOutcomeHeading() {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}

/**
 * The server's checklist. An open item whose page is a step of this flow gets "Fix" (the
 * dashboard pages themselves redirect back here until the launch, so a link there would only
 * bounce); the others are marked as something for after the launch.
 */
function Checklist({ items, onGoTo }: { items: CommerceChecklistItem[]; onGoTo: (step: number) => void }) {
  if (!items.length) {
    return <p className="text-[13px] leading-[19px] text-muted-foreground">The checklist loads together with your store&apos;s status.</p>
  }
  return (
    <ul className="divide-y divide-rule rounded-2xl bg-white shadow-hair">
      {items.map((item) => {
        const step = item.ok ? null : checklistStepFor(item.href)
        return (
          <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className={cn('flex min-w-0 items-center gap-2.5 text-sm', item.ok ? 'text-foreground' : 'text-muted-foreground')}>
              {item.ok ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <Circle className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0">{item.label}</span>
              <span className="sr-only">{item.ok ? ' – done' : ' – to do'}</span>
            </span>
            {step !== null && (
              <Button type="button" variant="outline" size="xs" onClick={() => onGoTo(step)}>
                Fix
              </Button>
            )}
            {!item.ok && step === null && <span className="shrink-0 text-xs leading-4 text-muted-foreground">after launch</span>}
          </li>
        )
      })}
    </ul>
  )
}

function SuccessScreen({ agentName }: { agentName: string }) {
  const headingRef = useOutcomeHeading()
  return (
    <StepBody className="space-y-6">
      <section aria-labelledby="commerce-live-title" className="app-cover cover-grain overflow-hidden rounded-[28px] p-8 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow tone="cover">You&apos;re live</Eyebrow>
          <span className="inline-flex h-7 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-medium text-[#dedce0]">
            <LiveDot onDark />
            Live
          </span>
        </div>
        <h1
          ref={headingRef}
          id="commerce-live-title"
          tabIndex={-1}
          className="mt-10 outline-none font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-[#dedce0] md:mt-14 md:text-[36px] md:leading-[42px]"
        >
          {agentName ? `${agentName} is` : 'Your store agent is'} ready to take and make calls.
        </h1>
        <p className="mt-3 max-w-[48ch] text-[15px] leading-[22px] text-[#dedce0]/80">
          Your setup is saved and the agent is switched on. The automations you turned on call your customers within their windows.
        </p>
      </section>

      {/* The agent is synced and active now, so it can be tried in the browser. */}
      <TestAgentPanel variant="onboarding" agentName={agentName} />

      <div className="flex justify-end border-t border-rule pt-6">
        <a href="/dashboard" className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
          Go to your dashboard
          <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </StepBody>
  )
}

function NotLiveScreen({ agentName, detail, checkoutUrl }: { agentName: string; detail: string | null; checkoutUrl: string | null }) {
  const headingRef = useOutcomeHeading()
  return (
    <div>
      <CommerceStepHeader
        headingRef={headingRef}
        step={6}
        title="Saved — not live yet"
        description={`Your setup is saved, but ${agentName ? `${agentName} is` : 'the agent is'} not taking calls yet.`}
      />
      <StepBody>
        <Alert variant="warning">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>The voice provider setup did not complete</AlertTitle>
          <AlertDescription>
            {detail && <p>{detail}</p>}
            <p>
              {checkoutUrl
                ? 'Once checkout is complete, open the Agent page to retry the setup and switch the agent on.'
                : 'Open the Agent page to retry the setup and switch the agent on.'}
            </p>
          </AlertDescription>
        </Alert>

        <div className="mt-10 flex flex-col-reverse gap-2 border-t border-rule pt-6 sm:flex-row sm:justify-end">
          {checkoutUrl ? (
            <a href={checkoutUrl} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
              <CreditCard aria-hidden="true" />
              Continue to checkout
            </a>
          ) : (
            <>
              <a href="/dashboard" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto')}>
                Go to your dashboard
              </a>
              <a href="/agent" className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
                <Bot aria-hidden="true" />
                Switch the agent on
              </a>
            </>
          )}
        </div>
      </StepBody>
    </div>
  )
}

export function LaunchStep({ organization }: LaunchStepProps) {
  const profile = useCommerceOnboardingStore((s) => s.profile)
  const agent = useCommerceOnboardingStore((s) => s.agent)
  const checklist = useCommerceOnboardingStore((s) => s.checklist)
  const automations = useCommerceOnboardingStore((s) => s.automations)
  const plan = useCommerceOnboardingStore((s) => s.plan)
  const setPlan = useCommerceOnboardingStore((s) => s.setPlan)
  const { goTo, refetchState } = useCommerceNavigation()

  const [annual, setAnnual] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null)

  // The checklist reflects everything saved so far: read it fresh when the step opens.
  useEffect(() => {
    refetchState()
  }, [refetchState])

  const storeName = profile.display_name || organization.name || '—'
  const agentName = agent?.name ?? ''
  const agentLabel = agentName || 'the agent'
  const enabledAutomations = automations.filter((a) => a.enabled).length
  const lastPlan = STORE_PLAN_IDS[STORE_PLAN_IDS.length - 1]
  const salesLedPicked = PLANS[plan].contact_sales === true

  async function launch() {
    setIsLaunching(true)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          plan,
          annual,
          ...(profile.display_name ? { company: { name: profile.display_name } } : {}),
          ...(agent
            ? {
                agent: {
                  name: agent.name,
                  language: agent.language,
                  system_prompt: agent.system_prompt ?? '',
                  first_message: agent.first_message ?? '',
                },
              }
            : {}),
        }),
      })
      if (!res.ok) {
        // Nothing was launched: keep the user here with the server's message.
        const err = await readCommerceError(res, 'The agent could not be launched. Please try again.')
        toast.error(err.message)
        setIsLaunching(false)
        return
      }
      const data = (await res.json().catch(() => null)) as CompleteResponse | null
      if (!data) {
        toast.error('The server’s response could not be read. Please try again.')
        setIsLaunching(false)
        return
      }

      // The account is set up, but the agent only takes calls once the server activated it.
      if (data.activated !== true) {
        setIsLaunching(false)
        setOutcome({ kind: 'not_live', detail: data.warning ?? null, checkoutUrl: data.checkout_url ?? null })
        return
      }
      if (data.warning) {
        toast.warning('Your agent is live, but the latest changes did not reach the voice provider.', {
          description: `${data.warning} You can retry from the Agent page.`,
        })
      }
      if (data.checkout_url) {
        // Paid plan: Stripe checkout (the launch state stays visible briefly before leaving).
        const checkoutUrl = data.checkout_url
        setTimeout(() => {
          window.location.href = checkoutUrl
        }, 1500)
      } else {
        setTimeout(() => {
          setIsLaunching(false)
          setOutcome({ kind: 'live' })
        }, 1800)
      }
    } catch (err) {
      // Network failure: the launch did not happen, so do not pretend it did.
      console.error('Commerce onboarding launch failed', err)
      toast.error('Network error. Check your connection and try again.')
      setIsLaunching(false)
    }
  }

  if (outcome?.kind === 'live') return <SuccessScreen agentName={agentName} />
  if (outcome?.kind === 'not_live') return <NotLiveScreen agentName={agentName} detail={outcome.detail} checkoutUrl={outcome.checkoutUrl} />

  return (
    <div>
      <CommerceStepHeader step={6} title="You're almost ready" description="Check the list, choose a plan and launch your store agent." />

      <StepBody>
        <section aria-labelledby="commerce-checklist-title">
          <SectionHeading title={<span id="commerce-checklist-title">Checklist</span>} description="Whatever is missing can be completed after launch too." />
          <Checklist items={checklist} onGoTo={goTo} />
        </section>

        <section aria-labelledby="commerce-plan-title" className="mt-10">
          <SectionHeading
            title={<span id="commerce-plan-title">Choose a plan</span>}
            className="flex-wrap"
            action={
              <>
                <BillingPeriod annual={annual} onChange={setAnnual} disabled={isLaunching} />
                <Badge variant="brand">Two months free</Badge>
              </>
            }
          />
          {/* While launching, the plan sent with the request is locked: the other cards are disabled. */}
          <div role="radiogroup" aria-labelledby="commerce-plan-title" className="grid gap-x-3 sm:grid-cols-2">
            <PlanCard id="trial" selected={plan === 'trial'} onSelect={() => setPlan('trial')} annual={annual} badge={<Badge variant="secondary">No card required</Badge>} disabled={isLaunching && plan !== 'trial'} />
            {STORE_PLAN_IDS.map((id) =>
              PLANS[id].contact_sales ? (
                <ContactSalesPlanCard
                  key={id}
                  id={id}
                  selected={plan === id}
                  onSelect={() => setPlan(id)}
                  disabled={isLaunching && plan !== id}
                  className={cn('sm:col-span-2', id === lastPlan && 'mb-0')}
                />
              ) : (
                <PlanCard
                  key={id}
                  id={id}
                  selected={plan === id}
                  onSelect={() => setPlan(id)}
                  annual={annual}
                  badge={id === RECOMMENDED_PLAN ? <Badge>Our pick</Badge> : undefined}
                  disabled={isLaunching && plan !== id}
                  className={id === lastPlan ? 'mb-0' : undefined}
                />
              ),
            )}
          </div>
          {salesLedPicked && (
            <p className="mt-3 text-[13px] leading-[19px] text-muted-foreground" aria-live="polite">
              {PLANS[plan].name} is set up with our team: you launch on the free trial now and we get in touch to agree volume and terms. In a hurry? Email{' '}
              <a href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`${PLANS[plan].name} inquiry`)}`} className="font-medium text-foreground underline underline-offset-4">
                {SALES_EMAIL}
              </a>
              .
            </p>
          )}
        </section>

        <section aria-labelledby="commerce-summary-title" className="mt-10">
          <SectionHeading title={<span id="commerce-summary-title">Your setup summary</span>} />
          <Card>
            <CardContent>
              <dl className="divide-y divide-rule">
                {[
                  { label: 'Store', value: storeName },
                  { label: 'Agent', value: agentName ? `${agentName} · ${profile.tone === 'formal' ? 'formal' : 'friendly'}` : '—' },
                  { label: 'Voice', value: agent?.voice_name || '—' },
                  { label: 'Automations on', value: String(enabledAutomations) },
                  { label: 'Plan', value: PLANS[plan].name },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <dt className="text-[13px] leading-[19px] text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 truncate text-right text-sm font-medium text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>

        <div className="mt-10 border-t border-rule pt-6">
          <Button size="lg" className="w-full" onClick={launch} loading={isLaunching} loadingState="connecting" loadingText={`Setting up ${agentLabel}…`}>
            <Rocket aria-hidden="true" />
            Launch my store agent
          </Button>
          {/* One fixed-height slot for Back and, while launching, the status line that replaces it. */}
          <div className="mt-2 flex min-h-14 items-center justify-center">
            {isLaunching ? (
              <OrbLoader
                size={32}
                layout="row"
                state="connecting"
                delayMs={0}
                label="Setting everything up…"
                description="Creating your agent and connecting its voice. Please keep this page open."
                className="justify-center text-left"
              />
            ) : (
              <Button variant="ghost" size="sm" onClick={() => goTo(5)} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft aria-hidden="true" />
                Back
              </Button>
            )}
          </div>
        </div>
      </StepBody>
    </div>
  )
}

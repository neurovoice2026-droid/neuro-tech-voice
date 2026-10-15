'use client'
// Step 4 — Launch & Pricing
import { useEffect, useRef, useState } from 'react'
import {
  Rocket, Bot, CreditCard, ArrowLeft, ArrowRight, AlertTriangle, Globe,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { LiveDot } from '@/components/shared/LiveDot'
import { Chip } from '@/components/shared/OptionCard'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { TestAgentPanel } from '@/components/agent/TestAgentPanel'
import { AppPlanTierCard, PlanTierRadio, PlanTiers, appJumpChips } from '@/components/pricing/AppPlanTiers'
import { isPickPlan, TRIAL_TIER } from '@/components/pricing/plan-tier-view'
import { ContactSalesNote, ContactSalesPlanCard } from '@/components/onboarding/commerce/ContactSalesPlanCard'
import { startWebsiteImportInBackground, type WebsiteImportStart } from '@/hooks/useKnowledgeWebsite'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { includedMinutesFor } from '@/lib/billing/stripe-trial'
import { toast } from 'sonner'
import { PLANS, plansForBusinessType } from '@/types'
import type { Plan, Organization } from '@/types'
import { StepBody, StepHeader } from '../StepIndicator'

interface Step6LaunchProps {
  organization: Organization
}

// ─── Plan cards ───────────────────────────────────────────────────────────────

/** The service plans offered at launch, after the trial: Starter … Scale, then Enterprise. */
const SERVICE_PLAN_IDS = plansForBusinessType('services')

/**
 * The small line under a card's button at launch: what choosing it means. A paid plan starts with
 * 14 free days before Stripe bills it (POST /api/onboarding/complete), with a small allowance until
 * the first payment (lib/billing/stripe-trial.ts); the trial needs no card.
 */
export function launchMicro(id: Plan, annual: boolean): string | null {
  if (id === 'trial') return 'No card required'
  if (PLANS[id].contact_sales) return null
  const freeMinutes = includedMinutesFor(id, 'trialing').toLocaleString('en-US')
  return `14 days free with up to ${freeMinutes} minutes, then billed ${annual ? 'yearly' : 'monthly'}`
}

export interface PlanChoiceProps {
  id: Plan
  /** Its place among the cards (staggers the mesh's tempo). */
  index: number
  selected: boolean
  onSelect: () => void
  annual: boolean
  /** The owner has switched the billing period: changed lines roll in. */
  changed: boolean
  disabled?: boolean
}

/**
 * A plan at launch, as its homepage card (components/pricing): the trial, a listed plan, or the
 * family's sales-led plan (ContactSalesPlanCard). The card's button is the radio; a click anywhere
 * on the card chooses it too. Selected = ringed in ink with a "Selected" tab.
 */
export function PlanChoice({ id, index, selected, onSelect, annual, changed, disabled }: PlanChoiceProps) {
  if (PLANS[id].contact_sales) {
    return <ContactSalesPlanCard id={id} index={index} selected={selected} onSelect={onSelect} annual={annual} disabled={disabled} />
  }
  const name = id === 'trial' ? TRIAL_TIER.name : PLANS[id].name
  return (
    <AppPlanTierCard
      plan={id}
      annual={annual}
      changed={changed}
      index={index}
      idPrefix="launch-plan"
      state={selected ? 'selected' : undefined}
      stateLabel="Selected"
      disabled={disabled}
      onPick={selected ? undefined : onSelect}
      micro={launchMicro(id, annual)}
      action={
        <PlanTierRadio
          name={name}
          label={id === 'trial' ? 'Start on the free trial' : undefined}
          selected={selected}
          pick={id !== 'trial' && isPickPlan(id)}
          disabled={disabled}
          onSelect={onSelect}
        />
      }
    />
  )
}

/**
 * Monthly / yearly as the segmented pill (tinted track, white active segment). A radio group, not
 * tabs: it only changes the prices shown, there is no panel to switch to. Arrow keys select.
 */
export function BillingPeriod({ annual, onChange, disabled }: { annual: boolean; onChange: (annual: boolean) => void; disabled?: boolean }) {
  const options = [
    { label: 'Monthly', annual: false },
    { label: 'Yearly', annual: true },
  ]
  return (
    <div role="radiogroup" aria-label="Billing period" className="inline-flex h-9 items-center gap-0.5 rounded-full bg-secondary p-1">
      {options.map((o) => {
        const on = o.annual === annual
        return (
          <Chip
            key={o.label}
            role="radio"
            pressed={on}
            onClick={() => onChange(o.annual)}
            disabled={disabled}
            className={cn(
              'h-7 px-3 font-medium',
              on
                ? 'bg-white text-foreground shadow-pill hover:bg-white'
                : 'bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground'
            )}
          >
            {o.label}
          </Chip>
        )
      })}
    </div>
  )
}

/**
 * The launch outcome replaces the form in place: bring its heading into view and give it
 * focus (the Launch button that had focus is gone), so the result is seen and announced.
 */
function useOutcomeHeading() {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}

// ─── Website import problem (opt-in import at launch) ────────────────────────
function WebsiteImportNote({ message }: { message: string }) {
  return (
    <Alert variant="warning">
      <Globe aria-hidden="true" />
      <AlertTitle>Your website was not imported.</AlertTitle>
      <AlertDescription>
        {message} You can import it again from <a href="/agent?tab=knowledge">Agent → Knowledge</a>.
      </AlertDescription>
    </Alert>
  )
}

// ─── Paid plan not started (launched on the trial instead) ───────────────────

/**
 * Why POST /api/onboarding/complete launched on the trial although a paid plan
 * was chosen: its Stripe price could not be resolved, or the checkout could
 * not be opened.
 */
export type PlanNotice = 'price_unavailable' | 'checkout_unavailable'

/** The launch response's plan_notice, when it is one this client knows. */
export function readPlanNotice(value: unknown): PlanNotice | null {
  return value === 'price_unavailable' || value === 'checkout_unavailable' ? value : null
}

/** Tells the owner the paid plan they chose was not started, and where to start it. */
export function PlanNotStartedNote({ planName }: { planName: string }) {
  return (
    <Alert variant="warning">
      <CreditCard aria-hidden="true" />
      <AlertTitle>Your {planName} plan was not started.</AlertTitle>
      <AlertDescription>
        We could not start the paid plan just now, so you launched on the free trial and nothing was charged. Choose{' '}
        {planName} again from <a href="/billing">Billing</a> whenever you are ready.
      </AlertDescription>
    </Alert>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ agentName, websiteImportError, planNotice, planName }: {
  agentName: string; websiteImportError: string | null; planNotice: PlanNotice | null; planName: string
}) {
  const headingRef = useOutcomeHeading()
  return (
    <StepBody className="space-y-6">
      {/* The onboarding's one cover moment (spec §0). */}
      <section aria-labelledby="onboarding-live-title" className="app-cover cover-grain overflow-hidden rounded-[28px] p-8 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow tone="cover">You&apos;re live</Eyebrow>
          <span className="inline-flex h-7 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-medium text-[#dedce0]">
            <LiveDot onDark />
            Live
          </span>
        </div>
        <h1
          ref={headingRef}
          id="onboarding-live-title"
          tabIndex={-1}
          className="mt-10 outline-none font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-[#dedce0] md:mt-14 md:text-[36px] md:leading-[42px]"
        >
          {agentName ? `${agentName} is` : 'Your AI agent is'} ready to take calls.
        </h1>
        <p className="mt-3 max-w-[48ch] text-[15px] leading-[22px] text-[#dedce0]/80">
          Your setup is saved and your agent is switched on. Try it right here before you head to your dashboard.
        </p>
      </section>

      {planNotice && <PlanNotStartedNote planName={planName} />}
      {websiteImportError && <WebsiteImportNote message={websiteImportError} />}

      {/* Last onboarding step: the agent is synced and active, so it can be tried in the browser. */}
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

// ─── Saved, but not live yet ──────────────────────────────────────────────────
// The server only switches the agent on when the voice provider sync is ready.
// Nothing re-activates it later on its own, so point the user at /agent.
function NotLiveScreen({ agentName, detail, checkoutUrl, websiteImportError, planNotice, planName }: {
  agentName: string; detail: string | null; checkoutUrl: string | null; websiteImportError: string | null
  planNotice: PlanNotice | null; planName: string
}) {
  const headingRef = useOutcomeHeading()
  return (
    <div>
      <StepHeader
        headingRef={headingRef}
        step={4}
        title="Saved — not live yet"
        description={`Your setup is saved, but ${agentName ? `${agentName} is` : 'your AI agent is'} not taking calls yet.`}
      />

      <StepBody>
        <div className="space-y-4">
          <Alert variant="warning">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>The voice provider setup did not complete</AlertTitle>
            <AlertDescription>
              {detail && <p>{detail}</p>}
              <p>
                {checkoutUrl
                  ? 'Once checkout is complete, open the Agent page to retry the setup and activate your agent.'
                  : 'Open the Agent page to retry the setup and activate your agent.'}
              </p>
            </AlertDescription>
          </Alert>
          {planNotice && <PlanNotStartedNote planName={planName} />}
          {websiteImportError && <WebsiteImportNote message={websiteImportError} />}
        </div>

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
                Activate my agent
              </a>
            </>
          )}
        </div>
      </StepBody>
    </div>
  )
}

interface CompleteResponse {
  checkout_url?: string | null
  error?: string
  /** True only when the agent is switched on and will answer calls. */
  activated?: boolean
  /** Sanitized message about the primary voice provider sync. */
  warning?: string | null
  /** Set when the paid plan chosen was not started: the account launched on the trial. */
  plan_notice?: string | null
}

/** Longest wait for the website import's answer before redirecting to checkout. */
const WEBSITE_IMPORT_WAIT_MS = 4000

type LaunchOutcome =
  | { kind: 'live'; planNotice: PlanNotice | null }
  | { kind: 'not_live'; detail: string | null; checkoutUrl: string | null; planNotice: PlanNotice | null }

// ─── Component ────────────────────────────────────────────────────────────────
export function Step6Launch({ organization }: Step6LaunchProps) {
  const { plan, setPlan, setStep, agent, voice, company } = useOnboardingStore()
  const [annual, setAnnual]             = useState(false)
  // Lines roll in on a period switch only after the owner's first one (never on arrival).
  const [periodChanged, setPeriodChanged] = useState(false)
  const [isLaunching, setIsLaunching]   = useState(false)
  const [outcome, setOutcome]           = useState<LaunchOutcome | null>(null)
  const [importSite, setImportSite]     = useState(false)
  const [websiteImportError, setWebsiteImportError] = useState<string | null>(null)

  const displayCompanyName = company.name || organization.name || '—'

  async function completeOnboarding() {
    setIsLaunching(true)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          annual,
          company: {
            name: company.name,
            industry: company.industry,
            website: company.website,
            description: company.description,
          },
          agent: {
            name: agent.name,
            language: agent.language,
            system_prompt: agent.system_prompt,
            first_message: agent.first_message,
          },
        }),
      })
      const data = (await res.json().catch((err: unknown) => {
        console.error('Onboarding: unreadable response', err)
        return null
      })) as CompleteResponse | null

      if (!res.ok || !data) {
        // Nothing was launched: keep the user here with the server's message.
        toast.error(data?.error ?? 'We could not launch your agent. Please try again.')
        setIsLaunching(false)
        return
      }

      // Opt-in website import: started in the background (survives the
      // redirect to checkout), never fails the launch. A refusal (already
      // running, invalid address, limits, unavailable) is shown to the owner.
      let websiteImport: Promise<WebsiteImportStart> | null = null
      if (importSite && company.website) {
        websiteImport = startWebsiteImportInBackground(company.website)
        void websiteImport.then((result) => {
          if (result.ok) return
          setWebsiteImportError(result.message)
          toast.warning('Your website was not imported', {
            description: `${result.message} You can import it again from Agent → Knowledge.`,
            duration: 10_000,
          })
        })
      }

      // The account is set up, but the agent only takes calls once the server
      // activated it (primary voice provider ready). Never claim "live" otherwise.
      const planNotice = readPlanNotice(data.plan_notice)
      if (data.activated !== true) {
        setIsLaunching(false)
        setOutcome({ kind: 'not_live', detail: data.warning ?? null, checkoutUrl: data.checkout_url ?? null, planNotice })
        return
      }

      // Live, but the latest changes did not reach the voice provider.
      if (data.warning) {
        toast.warning('Your agent is live, but the latest changes did not reach the voice provider.', {
          description: `${data.warning} You can retry from the Agent page.`,
        })
      }

      if (data.checkout_url) {
        // Paid plan → Stripe checkout (the launch state stays visible briefly before redirect).
        // Wait (briefly) for the website import's answer: a refusal stays
        // readable for a few seconds before leaving the page.
        const checkoutUrl = data.checkout_url
        const importResult = websiteImport
          ? await Promise.race([websiteImport, new Promise<null>((resolve) => setTimeout(() => resolve(null), WEBSITE_IMPORT_WAIT_MS))])
          : null
        const importFailed = !!importResult && !importResult.ok
        setTimeout(() => { window.location.href = checkoutUrl }, importFailed ? 6000 : 1500)
      } else {
        // Free plan, Stripe not configured, or a paid plan that could not be started → success screen
        setTimeout(() => {
          setIsLaunching(false)
          setOutcome({ kind: 'live', planNotice })
        }, 1800)
      }
    } catch (err) {
      // Network failure: the launch did not happen, so do not pretend it did.
      console.error('Onboarding launch failed', err)
      toast.error('Network error. Check your connection and try again.')
      setIsLaunching(false)
    }
  }

  if (outcome?.kind === 'live') {
    return (
      <SuccessScreen
        agentName={agent.name}
        websiteImportError={websiteImportError}
        planNotice={outcome.planNotice}
        planName={PLANS[plan].name}
      />
    )
  }

  if (outcome?.kind === 'not_live') {
    return (
      <NotLiveScreen
        agentName={agent.name}
        detail={outcome.detail}
        checkoutUrl={outcome.checkoutUrl}
        websiteImportError={websiteImportError}
        planNotice={outcome.planNotice}
        planName={PLANS[plan].name}
      />
    )
  }

  const agentLabel = agent.name || 'your agent'

  return (
    <div>
      <StepHeader step={4} title="You're almost ready" description="Choose a plan and launch your AI agent" />

      <StepBody>
        {/* Plan */}
        <section aria-labelledby="onboarding-plan-title">
          <SectionHeading
            title={<span id="onboarding-plan-title">Choose a plan</span>}
            className="flex-wrap"
            action={
              <>
                <BillingPeriod
                  annual={annual}
                  onChange={(next) => {
                    setAnnual(next)
                    setPeriodChanged(true)
                  }}
                  disabled={isLaunching}
                />
                <Badge variant="brand">Two months free</Badge>
              </>
            }
          />

          {/* While launching, the plan sent with the request is locked: the other cards are disabled. */}
          <PlanTiers role="radiogroup" aria-labelledby="onboarding-plan-title" jump={appJumpChips(['trial', ...SERVICE_PLAN_IDS], annual)}>
            {(['trial', ...SERVICE_PLAN_IDS] as Plan[]).map((id, index) => (
              <PlanChoice
                key={id}
                id={id}
                index={index}
                selected={plan === id}
                onSelect={() => setPlan(id)}
                annual={annual}
                changed={periodChanged}
                disabled={isLaunching && plan !== id}
              />
            ))}
          </PlanTiers>
          {PLANS[plan].contact_sales && <ContactSalesNote plan={plan} />}
        </section>

        {/* Summary */}
        <section aria-labelledby="onboarding-summary-title" className="mt-10">
          <SectionHeading title={<span id="onboarding-summary-title">Your setup summary</span>} />
          <Card>
            <CardContent>
              <dl className="divide-y divide-rule">
                {[
                  { label: 'Company', value: displayCompanyName },
                  { label: 'Agent name', value: agent.name ? `${agent.name} · ${agent.personality}` : '—' },
                  { label: 'Voice', value: voice.voice_name || '—' },
                  { label: 'Plan', value: plan === 'trial' ? TRIAL_TIER.name : PLANS[plan].name },
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

        {/* Optional: teach the agent from the company website (non-blocking) */}
        {company.website && (
          <div className="mt-3 flex items-start gap-3 rounded-2xl bg-secondary p-4">
            <Checkbox
              id="onboarding-import-website"
              checked={importSite}
              onCheckedChange={(v) => setImportSite(v === true)}
              disabled={isLaunching}
              className="mt-0.5"
            />
            <label htmlFor="onboarding-import-website" className="grid min-w-0 gap-1 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Globe className="size-4" aria-hidden="true" /> Import my website
              </span>
              <span className="block text-[13px] leading-[19px] break-words text-muted-foreground">
                Your agent learns from the pages of {company.website} (same domain only), refreshed weekly. I confirm I own this website or am
                authorised to import it. You can remove it later in Agent → Knowledge.
              </span>
            </label>
          </div>
        )}

        {/* Launch */}
        <div className="mt-10 border-t border-rule pt-6">
          <Button
            size="lg"
            className="w-full"
            onClick={completeOnboarding}
            loading={isLaunching}
            loadingState="connecting"
            loadingText={`Setting up ${agentLabel}…`}
          >
            <Rocket aria-hidden="true" />
            Launch my AI agent
          </Button>
          {/* One fixed-height slot for Back and, while launching, the status line that replaces it:
              nothing moves when the launch starts. */}
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
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="text-muted-foreground hover:text-foreground">
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

'use client'
// Step 4 — Launch & Pricing
import { useEffect, useRef, useState } from 'react'
import {
  Rocket, Check, Bot, CreditCard, ArrowLeft, ArrowRight, AlertTriangle, Globe,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { LiveDot } from '@/components/shared/LiveDot'
import { Chip, OptionCard } from '@/components/shared/OptionCard'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { TestAgentPanel } from '@/components/agent/TestAgentPanel'
import { startWebsiteImportInBackground, type WebsiteImportStart } from '@/hooks/useKnowledgeWebsite'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PLANS } from '@/types'
import type { Plan, Organization } from '@/types'
import { StepBody, StepHeader } from '../StepIndicator'

interface Step6LaunchProps {
  organization: Organization
}

// ─── Plan cards ───────────────────────────────────────────────────────────────

// Annual billing = pay for 10 months (2 months free).
function priceFor(id: Plan, annual: boolean): number {
  const monthly = PLANS[id].price_monthly
  return annual ? Math.round((monthly * 10) / 12) : monthly
}

interface PlanCardProps {
  id: Plan
  selected: boolean
  onSelect: () => void
  annual: boolean
  /** Chip next to the name ("Our pick", "No card required"). */
  badge?: React.ReactNode
  disabled?: boolean
  className?: string
}

/**
 * A plan as a selectable white panel (radio): name, price, billing note and features.
 * Selected = ink 2 px ring + the brand corner dot (OptionCard).
 *
 * Every card has the same five rows (name, tagline, price + note, rule, features) on the parent
 * grid's rows (subgrid), so prices, rules and lists line up across a row whatever each card holds.
 * The grid has no row gap (a subgrid shares it, and an empty tagline row would keep it): cards are
 * spaced by their own bottom margin, and the last one passes `mb-0`.
 * The radio's accessible name stays short: name, price, billing note and the minutes allowance;
 * the tagline and the rest of the list are visual detail (OptionCard has no aria-describedby).
 */
function PlanCard({ id, selected, onSelect, annual, badge, disabled, className }: PlanCardProps) {
  const p = PLANS[id]
  const isTrial = id === 'trial'
  const isCustom = id === 'custom'
  const isPaid = !isTrial && !isCustom

  const name = isTrial ? 'Free Trial' : p.name
  const tagline = isTrial ? 'Set everything up, no payment' : isCustom ? 'For large teams & agencies' : null
  const price = isTrial ? '$0' : isCustom ? `$${p.price_monthly}+` : `$${priceFor(id, annual)}`
  const note = isTrial
    ? `${p.minutes_limit} minutes · 14 days`
    : isCustom
      ? 'Volume pricing · let\'s talk'
      : annual
        ? 'billed annually · 2 months free'
        : '14-day free trial'

  return (
    <OptionCard
      selected={selected}
      onSelect={onSelect}
      // leading-6 = the badge's height, so a badge never makes one title row taller than another.
      title={<span className="text-[15px] leading-6">{name}</span>}
      badge={badge}
      disabled={disabled}
      className={cn(
        'row-span-5 mb-3 grid grid-rows-subgrid gap-0 p-5',
        !selected && 'bg-white shadow-hair hover:bg-band',
        className
      )}
    >
      {/* Rendered (empty) without a tagline too: the rows must match from card to card. */}
      <span aria-hidden="true" className={cn('text-[13px] leading-[19px] text-muted-foreground', tagline && 'mt-0.5')}>
        {tagline}
      </span>
      <span className="mt-4 flex flex-col">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[28px] leading-8 font-semibold tracking-[-0.02em] tabular-nums">{price}</span>
          {!isTrial && <span className="text-[13px] leading-[19px] text-muted-foreground">/ month</span>}
          {isPaid && annual && (
            <>
              <s aria-hidden="true" className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">
                ${p.price_monthly}
              </s>
              <span className="sr-only">(normally ${p.price_monthly} a month)</span>
            </>
          )}
        </span>
        <span className="mt-1 text-xs leading-4 text-muted-foreground">{note}</span>
      </span>
      <span aria-hidden="true" className="my-4 block h-px w-full bg-rule" />
      <span className={cn('grid w-full content-start gap-x-6 gap-y-2', isCustom && 'sm:grid-cols-2')}>
        {p.features.map((f, i) => (
          <span
            key={f}
            // The first line is the minutes allowance (the trial's note already says it).
            aria-hidden={isTrial || i > 0 ? true : undefined}
            className="flex items-start gap-2 text-[13px] leading-[19px] text-foreground"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {f}
          </span>
        ))}
      </span>
    </OptionCard>
  )
}

/**
 * Monthly / yearly as the segmented pill (tinted track, white active segment). A radio group, not
 * tabs: it only changes the prices shown, there is no panel to switch to. Arrow keys select.
 */
function BillingPeriod({ annual, onChange, disabled }: { annual: boolean; onChange: (annual: boolean) => void; disabled?: boolean }) {
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

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ agentName, websiteImportError }: { agentName: string; websiteImportError: string | null }) {
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
function NotLiveScreen({ agentName, detail, checkoutUrl, websiteImportError }: {
  agentName: string; detail: string | null; checkoutUrl: string | null; websiteImportError: string | null
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
}

/** Longest wait for the website import's answer before redirecting to checkout. */
const WEBSITE_IMPORT_WAIT_MS = 4000

type LaunchOutcome =
  | { kind: 'live' }
  | { kind: 'not_live'; detail: string | null; checkoutUrl: string | null }

// ─── Component ────────────────────────────────────────────────────────────────
export function Step6Launch({ organization }: Step6LaunchProps) {
  const { plan, setPlan, setStep, agent, voice, company } = useOnboardingStore()
  const [annual, setAnnual]             = useState(false)
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
      if (data.activated !== true) {
        setIsLaunching(false)
        setOutcome({ kind: 'not_live', detail: data.warning ?? null, checkoutUrl: data.checkout_url ?? null })
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
        // Free plan or Stripe not configured → show success screen
        setTimeout(() => {
          setIsLaunching(false)
          setOutcome({ kind: 'live' })
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
    return <SuccessScreen agentName={agent.name} websiteImportError={websiteImportError} />
  }

  if (outcome?.kind === 'not_live') {
    return (
      <NotLiveScreen
        agentName={agent.name}
        detail={outcome.detail}
        checkoutUrl={outcome.checkoutUrl}
        websiteImportError={websiteImportError}
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
                <BillingPeriod annual={annual} onChange={setAnnual} disabled={isLaunching} />
                <Badge variant="brand">Two months free</Badge>
              </>
            }
          />

          {/* While launching, the plan sent with the request is locked: the other cards are disabled. */}
          <div role="radiogroup" aria-labelledby="onboarding-plan-title" className="grid gap-x-3 sm:grid-cols-2">
            <PlanCard
              id="trial"
              selected={plan === 'trial'}
              onSelect={() => setPlan('trial')}
              annual={annual}
              badge={<Badge variant="secondary">No card required</Badge>}
              disabled={isLaunching && plan !== 'trial'}
            />
            <PlanCard
              id="starter"
              selected={plan === 'starter'}
              onSelect={() => setPlan('starter')}
              annual={annual}
              disabled={isLaunching && plan !== 'starter'}
            />
            <PlanCard
              id="pro"
              selected={plan === 'pro'}
              onSelect={() => setPlan('pro')}
              annual={annual}
              badge={<Badge>Our pick</Badge>}
              disabled={isLaunching && plan !== 'pro'}
            />
            <PlanCard
              id="business"
              selected={plan === 'business'}
              onSelect={() => setPlan('business')}
              annual={annual}
              disabled={isLaunching && plan !== 'business'}
            />
            <PlanCard
              id="custom"
              selected={plan === 'custom'}
              onSelect={() => setPlan('custom')}
              annual={annual}
              disabled={isLaunching && plan !== 'custom'}
              className="mb-0 sm:col-span-2"
            />
          </div>
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

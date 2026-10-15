'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight, CreditCard, ExternalLink, Settings, Shield, TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MinutesSection } from '@/components/billing/MinutesSection'
import {
  PLAN_CHANGE_LABEL,
  formatMinutes,
  intervalSwitchLabel,
  isCurrentPlanCard,
  minutesReturnNotice,
  planChangePendingText,
  planChangeRelation,
  readCheckoutResult,
  withoutMinutesParam,
} from '@/components/billing/minutes-logic'
import {
  currentBillingInterval,
  expectedPlanSwitch,
  planSwitchDescription,
  planSwitchMicro,
  planSwitchToast,
  readPlanSwitchTiming,
} from '@/components/billing/plan-switch'
import { AppPlanTierCard, PlanTierStatus, PlanTiers, appJumpChips, tierButtonClass } from '@/components/pricing/AppPlanTiers'
import { BILLING_CYCLE_LABEL, billingPickerPlans, currentPlanName, planPriceText } from '@/components/pricing/plan-change'
import { TRIAL_TIER, isPickPlan } from '@/components/pricing/plan-tier-view'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { StatusChip } from '@/components/shared/StatusChip'
import { useMinutes } from '@/hooks/useMinutes'
import { CONTACT_SALES_HREF, CONTACT_SALES_PHONE } from '@/lib/billing/upgrade'
import { useOrganization } from '@/hooks/useOrganization'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { PLANS, isPlan, isSelfServePlan, plansForBusinessType } from '@/types'
import type { Plan, BillingInterval, Organization } from '@/types'


const OVERLINE = 'text-[11px] leading-4 font-medium tracking-[0.12em] uppercase text-muted-foreground'

/** Anchors other pages link to (/billing#minutes, /billing#plans). */
const ANCHORS = new Set(['minutes', 'plans'])

/** After an in-place plan switch the webhook syncs the plan: re-read it this many times, this far apart. */
const PLAN_SYNC_ATTEMPTS = 5
const PLAN_SYNC_INTERVAL_MS = 2000

function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

type PlanRequest = { plan: Plan; source: 'header' | 'card'; interval: BillingInterval }

export default function BillingPage() {
  const router = useRouter()
  const { organization: org, isLoading } = useOrganization()
  const setOrganization = useAppStore((s) => s.setOrganization)
  const minutes = useMinutes()
  // Which control started the request ("header:pro", "card:business", "portal:manage" …), so only
  // that button shows the orb; any value blocks the other billing actions.
  const [pending, setPending] = useState<string | null>(null)
  // The cycle toggle starts on the interval the organization pays (an annual
  // subscriber sees annual prices), until the owner flips it.
  const [cycleChoice, setCycleChoice] = useState<BillingInterval | null>(null)
  const currentInterval = currentBillingInterval(org?.billing_interval)
  const cycle: BillingInterval = cycleChoice ?? currentInterval
  // The cards' changed lines roll in on a cycle switch, only after the owner's first one.
  const [cycleChanged, setCycleChanged] = useState(false)
  // An in-place plan switch waits for the owner's confirmation (it changes the live subscription).
  const [confirm, setConfirm] = useState<PlanRequest | null>(null)
  // ?minutes=success|canceled: Stripe Checkout's return URLs for a minute pack (read once, on the client).
  const [returnNotice] = useState(() => (typeof window === 'undefined' ? null : minutesReturnNotice(window.location.search)))
  const refreshMinutes = minutes.refresh
  const mounted = useRef(true)
  const scrolledToAnchor = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Back from Stripe through the browser's page cache: the buttons work again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(null)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // One toast (a fixed id, so it never shows twice), then the flag is dropped from the address
  // (the #minutes anchor stays), so a reload does not repeat it.
  useEffect(() => {
    if (!returnNotice) return
    if (returnNotice.tone === 'success') toast.success(returnNotice.message, { id: 'minutes-return' })
    else toast.info(returnNotice.message, { id: 'minutes-return' })
    window.history.replaceState(null, '', `${window.location.pathname}${withoutMinutesParam(window.location.search)}${window.location.hash}`)
  }, [returnNotice])

  // After a paid Checkout the webhook credits the pack a moment later: re-read the minutes twice,
  // so the new balance shows without a reload, and re-render the layout with them (its minutes
  // banner and sidebar meter are computed on the server and do not re-render on navigation).
  useEffect(() => {
    if (returnNotice?.tone !== 'success') return
    const timers = [3000, 10000].map((ms) =>
      window.setTimeout(() => {
        refreshMinutes()
        router.refresh()
      }, ms),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [returnNotice, refreshMinutes, router])

  // /billing#minutes and /billing#plans: the sections exist only once the plan has loaded,
  // after the browser looked for the anchor, so bring the section into view here (once).
  useEffect(() => {
    if (scrolledToAnchor.current || isLoading || !org) return
    scrolledToAnchor.current = true
    const id = window.location.hash.slice(1)
    if (ANCHORS.has(id)) document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [isLoading, org])

  /** Re-reads the organization without the page's loading state (no flash after a plan switch). */
  async function reloadOrganization(): Promise<Organization | null> {
    try {
      const { data, error } = await createClient().from('organizations').select('*').single()
      if (error || !data) return null
      setOrganization(data as Organization)
      return data as Organization
    } catch (err) {
      console.warn('billing: organization reload failed', err instanceof Error ? err.message : err)
      return null
    }
  }

  /** The webhook moves the plan and its minutes a moment after Stripe confirms the switch. */
  async function syncAfterPlanChange(target: string | null) {
    for (let i = 0; i < PLAN_SYNC_ATTEMPTS && mounted.current; i++) {
      const fresh = await reloadOrganization()
      if (!target || fresh?.plan === target) break
      await new Promise((resolve) => setTimeout(resolve, PLAN_SYNC_INTERVAL_MS))
    }
    if (!mounted.current) return
    minutes.refresh()
    // The layout's minutes banner and sidebar meter.
    router.refresh()
  }

  async function changePlan({ plan, source, interval }: PlanRequest, inPlace: boolean) {
    const failure = inPlace ? 'Could not change your plan' : 'Could not start checkout'
    setPending(`${source}:${plan}`)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      })
      const data: unknown = await res.json().catch(() => null)
      const result = res.ok ? readCheckoutResult(data) : null
      if (result?.kind === 'redirect') {
        window.location.assign(result.url)
        return
      }
      if (result?.kind === 'updated') {
        // Now (the webhook applies it in a moment) or at the renewal (nothing changes until then).
        const timing = readPlanSwitchTiming(data)
        toast.success(planSwitchToast(PLANS[plan].name, timing))
        setConfirm(null)
        setPending(null)
        if (timing.effective === 'now') void syncAfterPlanChange(result.plan ?? plan)
        return
      }
      const message = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : failure
      toast.error(message)
    } catch {
      toast.error(failure)
    }
    setPending(null)
  }

  async function openPortal(source: 'manage' | 'invoices' | 'card') {
    setPending(`portal:${source}`)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.assign(data.url)
        return
      }
      toast.error(data.error ?? 'Could not open billing portal')
    } catch {
      toast.error('Could not open billing portal')
    }
    setPending(null)
  }

  const header = (
    <PageHeader
      eyebrow="Billing"
      title="Billing"
      description="Manage your subscription, minutes, payment method, and billing history."
    />
  )

  if (isLoading || !org) {
    return (
      <PageContainer>
        {header}
        <div className="max-w-[768px]">
          <OrbLoader label="Loading your plan…" className="min-h-[360px]" />
        </div>
      </PageContainer>
    )
  }

  // A plan the catalog does not know (a bad row) displays as the trial rather than breaking the page.
  const currentPlan: Plan = isPlan(org.plan) ? org.plan : 'trial'
  const planCfg = PLANS[currentPlan]
  const hasBilling = !!org.stripe_customer_id
  const busy = pending !== null
  const isTrial = currentPlan === 'trial'
  // A paid plan with a live subscription changes in place; anyone else goes through Stripe Checkout.
  const inPlace = !isTrial && !!org.stripe_subscription_id
  const pendingText = planChangePendingText(inPlace)

  function requestPlan(plan: Plan, source: 'header' | 'card') {
    // Only a self-serve plan has a price to switch to (a sales-led one is agreed with sales).
    if (!isSelfServePlan(plan)) return
    // The header's "Upgrade to …" keeps the interval the organization pays on, whatever tab is open.
    const request: PlanRequest = { plan, source, interval: source === 'header' ? currentInterval : cycle }
    if (inPlace) setConfirm(request)
    else void changePlan(request, false)
  }

  // An organization buys from its own family: an online store sees the store
  // plans, everyone else the service plans (the server enforces the same rule).
  const familyPlans = plansForBusinessType(org.business_type)
  const selfServe = familyPlans.filter((p) => !PLANS[p].contact_sales)
  /** Plans shown as cards (the trial only while on it); the family's sales-led tier is the wide tile after them. */
  const cardPlans: Plan[] = billingPickerPlans(currentPlan, selfServe)
  // Each family ends in one sales-led tier (Enterprise, Store Enterprise).
  const salesPlan: Plan = familyPlans.find((p) => PLANS[p].contact_sales) ?? familyPlans[familyPlans.length - 1]
  const sales = PLANS[salesPlan]
  const salesIsCurrent = currentPlan === salesPlan
  // Self-serve upgrade path: the next self-serve plan of the family. None from
  // the top tier, the sales-led tier, or a plan of the other family (billing-data drift).
  const currentIndex = selfServe.indexOf(currentPlan)
  const nextTier: Plan | null = isTrial ? selfServe[0] ?? null : currentIndex >= 0 ? selfServe[currentIndex + 1] ?? null : null

  // The confirmation dialog's facts.
  const confirmCfg = confirm ? PLANS[confirm.plan] : null
  const confirmRelation = confirm ? planChangeRelation(currentPlan, confirm.plan) : null
  const confirmEffective = confirm ? expectedPlanSwitch({ plan: currentPlan, interval: currentInterval }, confirm) : null
  const usedNow = org.minutes_used ?? 0
  // Only a change that applies now can leave this period's usage above the new allowance (a renewal resets it).
  const confirmOverLimit = !!confirmCfg && confirmEffective === 'now' && usedNow > confirmCfg.minutes_limit

  return (
    <PageContainer className="space-y-10">
      {header}

      {/* Default-width page with a left-aligned 768 px column (as the Agent tab panels), so the
          header and content start at the same x as on every other dashboard page. */}
      <div className="max-w-[768px] space-y-10">
        {/* Current plan */}
        <section
          aria-labelledby="billing-current-plan-label billing-current-plan"
          className="overflow-hidden rounded-2xl bg-card shadow-hair"
        >
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p id="billing-current-plan-label" className={OVERLINE}>Current plan</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2
                  id="billing-current-plan"
                  className="font-heading font-title text-[28px] leading-[34px] tracking-[-0.02em]"
                >
                  {currentPlanName(currentPlan)}
                </h2>
                {/* The trial's name already says what it is ("Free trial"); a paid plan says it is live. */}
                {!isTrial && (
                  <StatusChip tone="success" dot>
                    Active
                  </StatusChip>
                )}
              </div>
              <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground tabular-nums">
                {planPriceText(currentPlan, currentInterval)}
                {' · '}
                {formatMinutes(org.minutes_limit ?? planCfg.minutes_limit)} minutes included{isTrial ? '' : ' a month'}
              </p>
            </div>

            {(hasBilling || nextTier) && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {hasBilling && (
                  <Button
                    variant="outline"
                    onClick={() => void openPortal('manage')}
                    disabled={busy}
                    loading={pending === 'portal:manage'}
                    loadingText="Opening billing portal…"
                  >
                    <Settings aria-hidden="true" />
                    Manage subscription
                  </Button>
                )}
                {nextTier && (
                  <Button
                    onClick={() => requestPlan(nextTier, 'header')}
                    disabled={busy}
                    loading={pending === `header:${nextTier}`}
                    loadingText={pendingText}
                  >
                    <ArrowUpRight aria-hidden="true" />
                    Upgrade to {PLANS[nextTier].name}
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Minutes: included, extra, packs, auto top-up, purchases (id="minutes") */}
        <MinutesSection minutes={minutes} onOpenPortal={hasBilling ? () => void openPortal('card') : undefined} disabled={busy} />

        {/* Plan picker: the homepage's plan cards (components/pricing), with the current plan ringed */}
        <section id="plans" className="scroll-mt-6">
          <Tabs
            value={cycle}
            onValueChange={(v) => {
              setCycleChoice(v as BillingInterval)
              setCycleChanged(true)
            }}
            className="gap-0"
          >
            <SectionHeading
              title="Change plan"
              className="flex-wrap items-center"
              action={
                <>
                  {/* "Monthly | Yearly", then the yearly saving: as on the homepage and in onboarding. */}
                  <TabsList aria-label="Billing cycle">
                    <TabsTrigger value="month">{BILLING_CYCLE_LABEL.month}</TabsTrigger>
                    <TabsTrigger value="year">{BILLING_CYCLE_LABEL.year}</TabsTrigger>
                  </TabsList>
                  <Badge variant="brand">Two months free</Badge>
                </>
              }
            />

            {(['month', 'year'] as const).map((c) => (
              // The panel is a tab stop (its first content is not focusable), so it shows the ring.
              <TabsContent
                key={c}
                value={c}
                className="rounded-2xl focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <PlanTiers jump={appJumpChips([...cardPlans, salesPlan], c === 'year')}>
                  {cardPlans.map((planId, index) => {
                    // A subscribed plan is current on the tab of the interval it is paid on; on the
                    // other tab its card offers the interval switch.
                    const isCurrent = isCurrentPlanCard(
                      { plan: planId, interval: c },
                      { plan: currentPlan, interval: currentInterval, subscribed: inPlace },
                    )
                    const isPaid = planId !== 'trial'
                    const name = isPaid ? PLANS[planId].name : TRIAL_TIER.name
                    // Relative to the current plan's rung: Upgrade, Downgrade or Switch (from Enterprise, a downgrade);
                    // the current plan on the other tab switches its billing interval.
                    const changeLabel =
                      planId === currentPlan ? intervalSwitchLabel(c) : PLAN_CHANGE_LABEL[planChangeRelation(currentPlan, planId)]
                    let action: ReactNode = null
                    if (isCurrent) action = <PlanTierStatus>Your current plan</PlanTierStatus>
                    else if (isPaid) {
                      action = (
                        <Button
                          size="lg"
                          className={tierButtonClass({ pick: isPickPlan(planId) })}
                          onClick={() => requestPlan(planId, 'card')}
                          disabled={busy}
                          loading={pending === `card:${planId}`}
                          loadingText={pendingText}
                        >
                          {changeLabel}<span className="sr-only">{planId === currentPlan ? ` for ${name}` : ` to ${name}`}</span>
                        </Button>
                      )
                    }

                    return (
                      <AppPlanTierCard
                        key={planId}
                        plan={planId}
                        annual={c === 'year'}
                        changed={cycleChanged}
                        index={index}
                        idPrefix={`billing-${c}`}
                        state={planId === currentPlan ? 'current' : undefined}
                        stateLabel="Current plan"
                        action={action}
                        micro={
                          !isCurrent && isPaid && inPlace
                            ? planSwitchMicro(expectedPlanSwitch({ plan: currentPlan, interval: currentInterval }, { plan: planId, interval: c }))
                            : null
                        }
                      />
                    )
                  })}

                  {/* The family's sales-led tier (Enterprise / Store Enterprise): a band across both columns */}
                  <AppPlanTierCard
                    plan={salesPlan}
                    annual={c === 'year'}
                    index={cardPlans.length}
                    idPrefix={`billing-${c}`}
                    state={salesIsCurrent ? 'current' : undefined}
                    stateLabel="Current plan"
                    action={
                      salesIsCurrent ? (
                        <PlanTierStatus>Your current plan</PlanTierStatus>
                      ) : (
                        // The app's one sales channel (lib/billing/upgrade.ts), with the number printed:
                        // a tel: link does nothing in most desktop browsers.
                        <a href={CONTACT_SALES_HREF} className={cn(buttonVariants({ size: 'lg' }), tierButtonClass())}>
                          Talk to us<span className="sr-only"> about {sales.name}</span>
                          <span className="tabular-nums">{` · ${CONTACT_SALES_PHONE}`}</span>
                        </a>
                      )
                    }
                  />
                </PlanTiers>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        {/* Payment method & invoices → Stripe customer portal */}
        <section aria-labelledby="billing-payment" className="rounded-2xl bg-card shadow-hair">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
                <CreditCard className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="billing-payment" className="text-[15px] leading-[22px] font-medium">
                  Payment method &amp; invoices
                </h2>
                <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">
                  Update your card, download invoices, or cancel — securely via Stripe.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="shrink-0 self-start sm:self-center"
              onClick={() => void openPortal('invoices')}
              disabled={busy || !hasBilling}
              loading={pending === 'portal:invoices'}
              loadingText="Opening billing portal…"
            >
              <ExternalLink aria-hidden="true" />
              Open portal
            </Button>
          </div>
          {!hasBilling && (
            <p className="flex items-center gap-2 border-t border-rule px-5 py-3 text-xs leading-4 text-muted-foreground">
              <Shield className="size-3.5 shrink-0" aria-hidden="true" />
              No billing account yet — upgrade to a paid plan to manage payments here.
            </p>
          )}
        </section>
      </div>

      {/* In-place plan switch: the live subscription changes, so the owner confirms first. */}
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null)
        }}
      >
        <DialogContent>
          {confirm && confirmCfg && confirmRelation && confirmEffective && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirm.plan === currentPlan
                    ? `${intervalSwitchLabel(confirm.interval)}?`
                    : `${PLAN_CHANGE_LABEL[confirmRelation]} to ${confirmCfg.name}?`}
                </DialogTitle>
                <DialogDescription>
                  {planSwitchDescription({
                    currentName: planCfg.name,
                    targetName: confirmCfg.name,
                    targetPrice:
                      confirm.interval === 'year'
                        ? `${money(confirmCfg.price_annual)} a year`
                        : `${money(confirmCfg.price_monthly)} a month`,
                    targetMinutes: formatMinutes(confirmCfg.minutes_limit),
                    effective: confirmEffective,
                    fromInterval: currentInterval,
                    toInterval: confirm.interval,
                  })}
                </DialogDescription>
              </DialogHeader>
              {confirmOverLimit && (
                <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-[13px] leading-[19px]">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span>
                    You have used {formatMinutes(usedNow)} minutes this period, more than {confirmCfg.name} includes:
                    calls pause until you add extra minutes or your included minutes reset next month.
                  </span>
                </p>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void changePlan(confirm, true)}
                  disabled={busy}
                  loading={pending === `${confirm.source}:${confirm.plan}`}
                  loadingText="Changing plan…"
                >
                  {confirm.plan === currentPlan
                    ? intervalSwitchLabel(confirm.interval)
                    : `${PLAN_CHANGE_LABEL[confirmRelation]} to ${confirmCfg.name}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

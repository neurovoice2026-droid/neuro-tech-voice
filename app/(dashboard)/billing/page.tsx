'use client'

import { useState } from 'react'
import {
  AlertTriangle, ArrowUpRight, Check, CreditCard, ExternalLink, Settings, Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { StatusChip } from '@/components/shared/StatusChip'
import { useOrganization } from '@/hooks/useOrganization'
import { PLANS } from '@/types'
import type { Plan, BillingInterval } from '@/types'

// Self-serve upgrade path (custom is sales-led, trial is the entry tier).
const UPGRADE_NEXT: Partial<Record<Plan, Plan>> = {
  trial: 'starter',
  starter: 'pro',
  pro: 'business',
}

/** The plan the picker recommends ("Our pick"). */
const RECOMMENDED: Plan = 'pro'

/** Plans shown as cards; `custom` is the wide sales-led tile after them. */
const CARD_PLANS: Plan[] = ['trial', 'starter', 'pro', 'business']

const OVERLINE = 'text-[11px] leading-4 font-medium tracking-[0.12em] uppercase text-muted-foreground'

function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

export default function BillingPage() {
  const { organization: org, isLoading } = useOrganization()
  // Which control started the redirect ("header:pro", "card:business", "portal:manage" …), so only
  // that button shows the orb; any value blocks the other billing actions.
  const [pending, setPending] = useState<string | null>(null)
  const [cycle, setCycle] = useState<BillingInterval>('month')

  async function goToCheckout(plan: Plan, source: 'header' | 'card' = 'card') {
    setPending(`${source}:${plan}`)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval: cycle }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      toast.error(data.error ?? 'Could not start checkout')
    } catch {
      toast.error('Could not start checkout')
    }
    setPending(null)
  }

  async function openPortal(source: 'manage' | 'downgrade' | 'invoices') {
    setPending(`portal:${source}`)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
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
      description="Manage your subscription, payment method, and billing history."
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

  const currentPlan = (org.plan ?? 'trial') as Plan
  const planCfg = PLANS[currentPlan]
  const minutesUsed = org.minutes_used ?? 0
  const minutesLimit = org.minutes_limit ?? planCfg.minutes_limit
  const usagePct = minutesLimit > 0 ? Math.min(100, Math.round((minutesUsed / minutesLimit) * 100)) : 0
  const usageTone = usagePct >= 100 ? 'danger' : usagePct >= 80 ? 'warning' : 'default'
  const hasBilling = !!org.stripe_customer_id
  const nextTier: Plan | null = UPGRADE_NEXT[currentPlan] ?? null
  const busy = pending !== null
  const isTrial = currentPlan === 'trial'

  const custom = PLANS.custom
  const customIsCurrent = currentPlan === 'custom'

  return (
    <PageContainer className="space-y-10">
      {header}

      {/* Default-width page with a left-aligned 768 px column (as the Agent tab panels), so the
          header and content start at the same x as on every other dashboard page. */}
      <div className="max-w-[768px] space-y-10">
        {/* Current plan + usage */}
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
                  {planCfg.name}
                </h2>
                <StatusChip tone={isTrial ? 'warning' : 'success'} dot>
                  {isTrial ? 'Trial' : 'Active'}
                </StatusChip>
              </div>
              <p className="mt-1 text-[15px] leading-[22px] text-muted-foreground tabular-nums">
                {planCfg.price_monthly === 0 ? 'No subscription' : `${money(planCfg.price_monthly)} / month`}
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
                    onClick={() => void goToCheckout(nextTier, 'header')}
                    disabled={busy}
                    loading={pending === `header:${nextTier}`}
                    loadingText="Redirecting to checkout…"
                  >
                    <ArrowUpRight aria-hidden="true" />
                    Upgrade to {PLANS[nextTier].name}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-rule p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className={OVERLINE}>This month&apos;s usage</p>
              <p className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{usagePct}% used</p>
            </div>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-[48px] leading-[52px] font-semibold tracking-[-0.03em] tabular-nums">
                {minutesUsed.toLocaleString('en-US')}
              </span>
              <span className="text-[15px] leading-[22px] text-muted-foreground tabular-nums">
                of {minutesLimit.toLocaleString('en-US')} minutes this period
              </span>
            </p>
            <Progress value={usagePct} tone={usageTone} aria-label="Minutes used" className="mt-4" />
            {usagePct >= 80 && (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] leading-[19px] text-warning">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                {100 - usagePct}% of minutes remaining — consider upgrading
              </p>
            )}
          </div>
        </section>

        {/* Plan picker */}
        <section>
          <Tabs value={cycle} onValueChange={(v) => setCycle(v as BillingInterval)} className="gap-0">
            <SectionHeading
              title="Change plan"
              className="flex-wrap items-center"
              action={
                <>
                  <Badge variant="brand">Two months free</Badge>
                  <TabsList aria-label="Billing cycle">
                    <TabsTrigger value="month">Monthly</TabsTrigger>
                    <TabsTrigger value="year">Annual</TabsTrigger>
                  </TabsList>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  {CARD_PLANS.map((planId) => {
                    const cfg = PLANS[planId]
                    const isCurrent = planId === currentPlan
                    const isPaid = planId !== 'trial'
                    // Annual shows the monthly-equivalent (yearly total / 12).
                    const displayPrice = c === 'year' && isPaid ? Math.round(cfg.price_annual / 12) : cfg.price_monthly

                    return (
                      <div
                        key={planId}
                        data-current={isCurrent || undefined}
                        className="flex flex-col rounded-2xl bg-card p-5 shadow-hair"
                      >
                        {/* min-h-6 = badge height, so prices line up whether or not a card has a badge. */}
                        <div className="flex min-h-6 flex-wrap items-center gap-2">
                          <h3 className="text-[15px] leading-[22px] font-medium">{cfg.name}</h3>
                          {isCurrent ? (
                            <Badge variant="secondary">Current plan</Badge>
                          ) : planId === RECOMMENDED ? (
                            <Badge>Our pick</Badge>
                          ) : null}
                        </div>

                        <p className="mt-3 flex items-baseline gap-1">
                          <span className="text-[28px] leading-8 font-semibold tracking-[-0.02em] tabular-nums">
                            {money(displayPrice)}
                          </span>
                          <span className="text-[13px] text-muted-foreground">/mo</span>
                        </p>
                        <p className="mt-1 min-h-4 text-xs leading-4 text-muted-foreground tabular-nums">
                          {c === 'year' && isPaid ? `${money(cfg.price_annual)}/yr billed annually` : null}
                        </p>

                        <ul className="mt-3 space-y-2">
                          {cfg.features.slice(0, 3).map((f) => (
                            <li key={f} className="flex items-start gap-2 text-[13px] leading-[19px]">
                              <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                              {f}
                            </li>
                          ))}
                        </ul>

                        {!isCurrent && (isPaid || hasBilling) && (
                          <div className="mt-auto pt-5">
                            {isPaid ? (
                              // Outline on every card: the header holds the one ink upgrade and
                              // "Our pick" already marks the recommended plan.
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => void goToCheckout(planId)}
                                disabled={busy}
                                loading={pending === `card:${planId}`}
                                loadingText="Redirecting to checkout…"
                              >
                                Upgrade<span className="sr-only"> to {cfg.name}</span>
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                className="w-full"
                                onClick={() => void openPortal('downgrade')}
                                disabled={busy}
                                loading={pending === 'portal:downgrade'}
                                loadingText="Opening billing portal…"
                              >
                                Downgrade<span className="sr-only"> to {cfg.name}</span>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Custom: sales-led, full width */}
                  <div
                    data-current={customIsCurrent || undefined}
                    className="flex flex-col gap-4 rounded-2xl bg-secondary p-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex min-h-6 flex-wrap items-center gap-2">
                        <h3 className="text-[15px] leading-[22px] font-medium">{custom.name}</h3>
                        {customIsCurrent && <Badge variant="secondary">Current plan</Badge>}
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                        {custom.features.slice(0, 3).map((f) => (
                          <li key={f} className="flex items-center gap-1.5 text-[13px] leading-[19px] text-muted-foreground">
                            <Check className="size-3.5 shrink-0" aria-hidden="true" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                      <p className="flex items-baseline gap-1">
                        <span className="text-[22px] leading-7 font-semibold tracking-[-0.02em] tabular-nums">
                          {money(custom.price_monthly)}+
                        </span>
                        <span className="text-[13px] text-muted-foreground">/mo</span>
                      </p>
                      {!customIsCurrent && (
                        <a
                          href="mailto:sales@neuro-tech-voice.com?subject=Custom%20plan%20enquiry"
                          className={buttonVariants({ variant: 'outline' })}
                        >
                          Contact sales
                        </a>
                      )}
                    </div>
                  </div>
                </div>
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
    </PageContainer>
  )
}

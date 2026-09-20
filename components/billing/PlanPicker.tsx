'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { PLANS, type BillingInterval, type Plan } from '@/types'
import { formatNumber, formatRate, formatUsd } from './format'

export type SelfServePlanId = 'starter' | 'pro' | 'business'

const SELF_SERVE: readonly SelfServePlanId[] = ['starter', 'pro', 'business']
const RANK: Record<Plan, number> = { trial: 0, starter: 1, pro: 2, business: 3, custom: 4 }

interface PlanPickerProps {
  currentPlan: Plan
  currentInterval: BillingInterval | null
  /** The org pays for a plan today, so a change updates that subscription instead of opening checkout. */
  hasActiveSubscription: boolean
  stripeConfigured: boolean
  /** Which Stripe prices exist, per plan and cycle. */
  availability: Record<SelfServePlanId, Record<BillingInterval, boolean>>
  salesHref: string
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

function monthlyEquivalent(plan: SelfServePlanId | 'custom', interval: BillingInterval): number {
  const cfg = PLANS[plan]
  return interval === 'year' ? Math.round(cfg.price_annual / 12) : cfg.price_monthly
}

export function PlanPicker({
  currentPlan,
  currentInterval,
  hasActiveSubscription,
  stripeConfigured,
  availability,
  salesHref,
}: PlanPickerProps) {
  const router = useRouter()
  const [cycle, setCycle] = useState<BillingInterval>(currentInterval ?? 'month')
  const [pending, setPending] = useState<SelfServePlanId | null>(null)
  const [confirming, setConfirming] = useState<SelfServePlanId | null>(null)
  const monthlyRef = useRef<HTMLButtonElement>(null)
  const annualRef = useRef<HTMLButtonElement>(null)

  const effectiveCurrentInterval = currentInterval ?? 'month'

  function onToggleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const next: BillingInterval = cycle === 'month' ? 'year' : 'month'
    setCycle(next)
    ;(next === 'month' ? monthlyRef : annualRef).current?.focus()
  }

  async function submit(plan: SelfServePlanId, confirmChange: boolean) {
    setPending(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval: cycle, confirm_change: confirmChange }),
      })
      const data = (await res.json().catch(() => ({}))) as ApiErrorBody & { url?: string; updated?: boolean }
      if (res.status === 409 && data.error?.code === 'confirmation_required') {
        // A subscription exists that this page didn't know about yet: confirm the change first.
        setConfirming(plan)
        return
      }
      if (!res.ok) {
        toast.error(data.error?.message ?? 'We couldn’t start that plan change. Please try again.')
        return
      }
      if (data.url) {
        window.location.assign(data.url)
        return
      }
      if (data.updated) {
        setConfirming(null)
        toast.success(`You’re moving to ${PLANS[plan].name}. It can take a few seconds to show here.`)
        router.refresh()
        // Stripe confirms the change through a webhook; refresh again once it has landed.
        window.setTimeout(() => router.refresh(), 4000)
        return
      }
      toast.error('Something unexpected happened. Please refresh the page.')
    } catch {
      toast.error('We couldn’t reach the server. Check your connection and try again.')
    } finally {
      setPending(null)
    }
  }

  function choose(plan: SelfServePlanId) {
    if (hasActiveSubscription) setConfirming(plan)
    else void submit(plan, false)
  }

  const confirmPlan = confirming ? PLANS[confirming] : null
  const intervalChanges = hasActiveSubscription && cycle !== effectiveCurrentInterval

  return (
    <section id="plans" aria-labelledby="plans-heading" className="scroll-mt-6 rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="plans-heading" className="text-sm font-semibold text-foreground">
            {currentPlan === 'trial' ? 'Choose a plan' : 'Change plan'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">No seats, no per-agent fee. Cancel or change whenever you like.</p>
        </div>
        <div
          role="radiogroup"
          aria-label="Billing cycle"
          onKeyDown={onToggleKey}
          className="flex w-full items-center gap-1 rounded-lg border bg-muted/40 p-0.5 text-xs sm:w-auto"
        >
          <button
            ref={monthlyRef}
            type="button"
            role="radio"
            aria-checked={cycle === 'month'}
            tabIndex={cycle === 'month' ? 0 : -1}
            onClick={() => setCycle('month')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none',
              cycle === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Monthly
          </button>
          <button
            ref={annualRef}
            type="button"
            role="radio"
            aria-checked={cycle === 'year'}
            tabIndex={cycle === 'year' ? 0 : -1}
            onClick={() => setCycle('year')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none',
              cycle === 'year' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Annual
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">2 months free</span>
          </button>
        </div>
      </div>

      {!stripeConfigured && (
        <p role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Online payments aren’t switched on for this workspace yet, so plans can’t be bought here. Contact us and we’ll set up your plan.
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SELF_SERVE.map((plan) => {
          const cfg = PLANS[plan]
          const isCurrentTier = currentPlan === plan
          const isCurrent = isCurrentTier && effectiveCurrentInterval === cycle
          const available = availability[plan][cycle]
          const isPending = pending === plan

          let label: string
          if (isCurrent) label = 'Current plan'
          else if (isCurrentTier) label = cycle === 'year' ? 'Switch to annual' : 'Switch to monthly'
          else if (hasActiveSubscription && RANK[plan] < RANK[currentPlan]) label = `Switch to ${cfg.name}`
          else if (hasActiveSubscription) label = `Upgrade to ${cfg.name}`
          else label = `Choose ${cfg.name}`

          const blockedReason = isCurrent
            ? null
            : currentPlan === 'custom'
              ? 'Custom plans are changed with our team.'
              : !stripeConfigured
                ? null
                : !available
                  ? `Not available with ${cycle === 'year' ? 'annual' : 'monthly'} billing yet.`
                  : null
          const disabled = isCurrent || !stripeConfigured || !available || currentPlan === 'custom' || pending !== null

          return (
            <article
              key={plan}
              aria-label={`${cfg.name} plan`}
              className={cn(
                'relative flex flex-col rounded-xl border-2 p-4',
                isCurrent ? 'border-primary bg-primary/5' : plan === 'pro' ? 'border-primary/40' : 'border-border'
              )}
            >
              {plan === 'pro' && !isCurrent && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                  Your plan
                </span>
              )}
              <h3 className="text-sm font-semibold text-foreground">{cfg.name}</h3>
              <p className="mt-2">
                <span className="text-2xl font-bold tabular-nums text-foreground">{formatUsd(monthlyEquivalent(plan, cycle))}</span>
                <span className="text-xs text-muted-foreground">/mo</span>
              </p>
              <p className="min-h-4 text-[11px] text-muted-foreground">
                {cycle === 'year' ? `${formatUsd(cfg.price_annual)} billed yearly` : 'Billed monthly'}
              </p>
              <ul className="mt-3 flex-1 space-y-1.5">
                <li className="flex items-start gap-1.5 text-xs text-foreground">
                  <Check className="mt-px size-3.5 shrink-0 text-green-600" aria-hidden="true" />
                  {formatNumber(cfg.minutes_limit)} minutes a month
                </li>
                <li className="flex items-start gap-1.5 text-xs text-foreground">
                  <Check className="mt-px size-3.5 shrink-0 text-green-600" aria-hidden="true" />
                  Then {formatRate(cfg.overage_per_min)}, calls never stop
                </li>
                {cfg.features.slice(2).map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-xs text-foreground">
                    <Check className="mt-px size-3.5 shrink-0 text-green-600" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                variant={isCurrent ? 'outline' : 'default'}
                disabled={disabled}
                aria-describedby={blockedReason ? `${plan}-blocked` : undefined}
                onClick={() => choose(plan)}
              >
                {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {label}
              </Button>
              {blockedReason && (
                <p id={`${plan}-blocked`} className="mt-2 text-[11px] text-muted-foreground">
                  {blockedReason}
                </p>
              )}
            </article>
          )
        })}

        <article aria-label="Custom plan" className="flex flex-col rounded-xl border-2 border-gray-800 bg-gray-950 p-4">
          <h3 className="text-sm font-semibold text-white">Custom</h3>
          <p className="mt-2">
            <span className="text-xs text-gray-400">From </span>
            <span className="text-2xl font-bold tabular-nums text-white">{formatUsd(monthlyEquivalent('custom', cycle))}</span>
            <span className="text-xs text-gray-400">/mo</span>
          </p>
          <p className="min-h-4 text-[11px] text-gray-400">Tailored to your call volume</p>
          <ul className="mt-3 flex-1 space-y-1.5">
            {PLANS.custom.features.map((feature) => (
              <li key={feature} className="flex items-start gap-1.5 text-xs text-gray-200">
                <Check className="mt-px size-3.5 shrink-0 text-purple-400" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          {currentPlan === 'custom' ? (
            <p className="mt-4 rounded-lg border border-gray-700 py-2 text-center text-sm font-medium text-gray-200">Your plan</p>
          ) : (
            <a
              href={salesHref}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'mt-4 w-full gap-1.5 border-gray-600 bg-transparent text-gray-100 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Phone aria-hidden="true" />
              Talk to sales
            </a>
          )}
        </article>
      </div>

      <Dialog open={confirming !== null} onOpenChange={(open) => { if (!open && pending === null) setConfirming(null) }}>
        <DialogContent className="sm:max-w-md">
          {confirming && confirmPlan && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Switch to {confirmPlan.name} ({cycle === 'year' ? 'annual' : 'monthly'})?
                </DialogTitle>
                <DialogDescription>
                  {cycle === 'year'
                    ? `${formatUsd(confirmPlan.price_annual)} a year`
                    : `${formatUsd(confirmPlan.price_monthly)} a month`}{' '}
                  with {formatNumber(confirmPlan.minutes_limit)} minutes included each month, then {formatRate(confirmPlan.overage_per_min)}.
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                  The change applies right away, using the card already on file.
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                  {intervalChanges
                    ? 'Because the billing cycle changes, the new plan is charged today, minus a credit for the unused time on your current plan. A new usage period starts today.'
                    : 'You get a credit for the unused part of your current plan, and the difference is added to your next invoice.'}
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                  Your agent, numbers and settings don’t change.
                </li>
              </ul>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirming(null)} disabled={pending !== null}>
                  Keep current plan
                </Button>
                <Button onClick={() => void submit(confirming, true)} disabled={pending !== null}>
                  {pending === confirming && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Confirm change
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

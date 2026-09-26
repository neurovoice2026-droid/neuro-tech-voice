import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, CalendarClock, Clock, Info, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UsageSummary } from '@/lib/billing/usage'
import { PLANS } from '@/types'
import { formatDay, formatMinutes, formatNumber, formatRate, formatUsd } from './format'

interface UsageOverviewProps {
  summary: UsageSummary
  timeZone: string
}

function statusBadge(summary: UsageSummary): { label: string; className: string } {
  if (summary.blockReason === 'trial_expired') {
    return { label: 'Trial ended', className: 'border-red-200 bg-red-50 text-red-700' }
  }
  if (summary.blockReason === 'minutes_exhausted') {
    return { label: 'Paused', className: 'border-red-200 bg-red-50 text-red-700' }
  }
  if (summary.isTrial) return { label: 'Free trial', className: 'border-blue-200 bg-blue-50 text-blue-700' }
  return { label: 'Active', className: 'border-green-200 bg-green-50 text-green-700' }
}

function priceLine(summary: UsageSummary): string {
  if (summary.isTrial) return `Free · ${formatMinutes(summary.minutesLimit)} included, no card needed`
  const plan = PLANS[summary.plan]
  if (summary.billingInterval === 'year') return `${formatUsd(plan.price_annual)} a year · billed annually`
  return `${formatUsd(plan.price_monthly)} a month · billed monthly`
}

function meterTone(summary: UsageSummary): string {
  if (summary.percentUsed >= 100) return summary.overageAllowed ? 'bg-orange-500' : 'bg-red-500'
  if (summary.percentUsed >= 80) return 'bg-amber-500'
  return 'bg-primary'
}

function BlockedNotice({ summary }: { summary: UsageSummary }) {
  if (summary.blockReason !== 'trial_expired' && summary.blockReason !== 'minutes_exhausted') return null
  const message =
    summary.blockReason === 'trial_expired'
      ? 'Your free trial has ended, so your agent isn’t answering calls right now. Choose a plan to switch it back on — your agent, number and settings are all kept.'
      : `You’ve used all ${summary.minutesLimit} trial minutes, so your agent is paused. Choose a plan to keep answering calls — everything you set up stays as it is.`
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
      <AlertTriangle className="size-5 shrink-0 text-red-600" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-red-800">{message}</p>
      <Link href="#plans" className={cn(buttonVariants({ size: 'sm' }), 'w-full sm:w-auto')}>
        Choose a plan
      </Link>
    </div>
  )
}

function PeriodLine({ summary, timeZone }: UsageOverviewProps) {
  const start = formatDay(summary.periodStart, timeZone)
  const end = formatDay(summary.periodEnd, timeZone)

  if (summary.isTrial) {
    if (!end) return <span>Trial minutes don’t renew.</span>
    if (summary.trialDaysLeft === 0) return <span>Trial ended on {end}</span>
    const days = summary.trialDaysLeft ?? 0
    return (
      <span>
        Trial ends {end} · <strong className="font-semibold text-foreground">{days} {days === 1 ? 'day' : 'days'} left</strong>
      </span>
    )
  }
  if (summary.periodKind === 'billing' && start && end) {
    return (
      <span>
        {start} – {end} · minutes renew on <strong className="font-semibold text-foreground">{end}</strong>
      </span>
    )
  }
  return <span>Your usage period is set at the next daily billing run (within 24 hours).</span>
}

export function UsageOverview({ summary, timeZone }: UsageOverviewProps) {
  const badge = statusBadge(summary)
  const overLimit = summary.minutesUsed >= summary.minutesLimit && summary.minutesLimit > 0

  return (
    <section aria-labelledby="usage-heading" className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="usage-heading" className="text-lg font-semibold text-foreground">
              {summary.planName} plan
            </h2>
            <span className={cn('inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium', badge.className)}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{priceLine(summary)}</p>
        </div>
        {summary.isTrial && (
          <Link href="#plans" className={cn(buttonVariants({ size: 'sm' }), 'w-full gap-1.5 sm:w-auto')}>
            <Sparkles aria-hidden="true" />
            Upgrade
          </Link>
        )}
      </div>

      <div className="space-y-5 p-5">
        <BlockedNotice summary={summary} />

        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <PeriodLine summary={summary} timeZone={timeZone} />
        </p>

        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <span id="minutes-label" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
              {summary.isTrial ? 'Trial minutes used' : 'Included minutes used'}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              <strong className="text-base font-semibold text-foreground">{formatNumber(summary.minutesUsed)}</strong>
              {' / '}
              {formatNumber(summary.minutesLimit)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-labelledby="minutes-label"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.percentUsed}
            aria-valuetext={`${summary.minutesUsed} of ${summary.minutesLimit} minutes used`}
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className={cn('h-full rounded-full transition-[width]', meterTone(summary))} style={{ width: `${summary.percentUsed}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {overLimit
              ? summary.overageAllowed
                ? `All included minutes are used. Your agent keeps answering; extra minutes cost ${formatRate(summary.overageRate)}.`
                : 'All trial minutes are used.'
              : `${formatMinutes(summary.minutesRemaining)} left${summary.isTrial ? ' in your trial' : ' this period'}. Minutes are rounded up per call.`}
          </p>
        </div>

        {summary.overageAllowed && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Extra minutes</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatNumber(summary.overageMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Overage rate</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatRate(summary.overageRate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Estimated extra cost</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {formatUsd(summary.estimatedOverageUsd, { cents: true })}
                </dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {summary.overageInvoiced
                  ? 'Extra minutes appear as their own line on your next invoice.'
                  : `Extra minutes are charged at ${formatRate(summary.overageRate)}; minutes are rounded up per call.`}
                {summary.overageSource === 'estimate' ? ' This is an estimate from your minutes used.' : ''}
              </span>
            </p>
          </div>
        )}

        {summary.isTrial && summary.blockReason === null && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ArrowUpRight className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            When the trial minutes or days run out, your agent pauses until you choose a plan. On a paid plan it keeps answering past the included minutes, and extra minutes are billed at that plan’s rate.
          </p>
        )}
      </div>
    </section>
  )
}

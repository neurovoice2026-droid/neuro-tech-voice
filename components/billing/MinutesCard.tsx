import { CircleAlert } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { MinutePack } from '@/lib/billing/minute-packs'
import type { MinutesSummaryDto } from '@/lib/billing/minutes-summary'
import { CONTACT_SALES_HREF, CONTACT_SALES_PHONE, outOfMinutesActions, type OutOfMinutesChoice } from '@/lib/billing/upgrade'
import { cn } from '@/lib/utils'
import { MINUTES_ACTION_ROW, MINUTES_ACTION_WRAP } from './MinutesActionLinks'
import { formatMinutes, includedPeriodNote, includedUsagePct, minutesMeterTone, outOfMinutesDescription, outOfMinutesTitle } from './minutes-logic'

/** The billing page's plan picker (/billing#plans), on the same page as this card. */
const PLANS_ANCHOR = 'plans'

const OVERLINE = 'text-[11px] leading-4 font-medium tracking-[0.12em] uppercase text-muted-foreground'

function Figure({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-secondary p-3">
      <dt className="text-[13px] leading-[18px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[22px] leading-7 font-semibold tracking-[-0.02em] tabular-nums">{formatMinutes(value)}</dd>
      <dd className="text-xs leading-4 text-muted-foreground">{hint}</dd>
    </div>
  )
}

interface MinutesCardProps {
  summary: MinutesSummaryDto
  /**
   * The way out once nothing is left (lib/billing/upgrade.ts
   * outOfMinutesChoice): the next plan up and the 100-minute pack, shown as
   * the out-of-minutes callout's two buttons. Without it the callout has no
   * buttons.
   */
  choice?: OutOfMinutesChoice | null
  /** Starts Stripe Checkout for the pack (the page leaves on success). */
  onBuy?: (minutes: MinutePack) => void
  /** The pack whose checkout is starting; any value disables the pack button. */
  pending?: MinutePack | null
  /** Another billing action is running (a plan change, the portal). */
  disabled?: boolean
}

/**
 * The period's included minutes (used of the plan's allowance, with the
 * usual meter), the prepaid extra minutes and what is left in total: the
 * hard cap every call checks (lib/telephony/quota.ts). At zero, a callout
 * offers the choice: upgrade (the plan picker below, #plans; "Talk to us" for
 * a sales-led rung) or buy 100 minutes (straight to Stripe Checkout).
 */
export function MinutesCard({ summary, choice = null, onBuy, pending = null, disabled = false }: MinutesCardProps) {
  const { included } = summary
  const pct = includedUsagePct(included.used, included.limit)
  // Paused only where the cap applies (the server's callAllowance): with the minute-cap switch off,
  // or on a plan value the cap fails open on, calls go on at 0 left and no callout is shown.
  const out = summary.paused
  const actions = out && choice ? outOfMinutesActions(choice) : []
  const periodNote = includedPeriodNote(included.period_start, summary.can_buy)

  return (
    <div className="rounded-2xl bg-card p-5 shadow-hair sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <p className={OVERLINE}>Included this period</p>
        <p className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{pct}% used</p>
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-[40px] leading-[44px] font-semibold tracking-[-0.03em] tabular-nums">
          {formatMinutes(included.used)}
        </span>
        <span className="text-[15px] leading-[22px] text-muted-foreground tabular-nums">
          of {formatMinutes(included.limit)} included minutes
        </span>
      </p>
      <Progress value={pct} tone={minutesMeterTone(pct, summary.extra_balance)} aria-label="Included minutes used this period" className="mt-4" />
      <p className="mt-2 text-xs leading-4 text-muted-foreground">{periodNote}</p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <Figure label="Included left" value={included.left} hint="this period" />
        <Figure label="Extra minutes" value={summary.extra_balance} hint="prepaid, never expire" />
        <Figure label="Total left" value={summary.total_left} hint="before calls pause" />
      </dl>

      {out && (
        <Alert variant="destructive" className="mt-5">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{outOfMinutesTitle(summary.can_buy)}</AlertTitle>
          <AlertDescription>{outOfMinutesDescription(choice ?? { upgrade: null, buy: null }, summary.can_buy)}</AlertDescription>
          {actions.length > 0 && (
            <AlertAction className={cn(MINUTES_ACTION_ROW, 'sm:max-w-72 sm:flex-col sm:items-stretch')}>
              {actions.map((action) => {
                if (action.kind === 'buy' && choice?.buy) {
                  const pack = choice.buy.minutes
                  return (
                    <Button
                      key={action.kind}
                      size="sm"
                      variant={action.primary ? 'default' : 'outline'}
                      className={MINUTES_ACTION_WRAP}
                      onClick={() => onBuy?.(pack)}
                      disabled={!onBuy || disabled || pending !== null}
                      loading={pending === pack}
                      loadingText="Redirecting…"
                    >
                      {action.label}
                    </Button>
                  )
                }
                // The plan picker is on this page; "Talk to us" is the sales line.
                const href = action.kind === 'upgrade' ? `#${PLANS_ANCHOR}` : action.href
                return (
                  <a
                    key={action.kind}
                    href={href}
                    className={cn(buttonVariants({ size: 'sm', variant: action.primary ? 'default' : 'outline' }), MINUTES_ACTION_WRAP)}
                  >
                    {action.label}
                    {href === CONTACT_SALES_HREF && <span className="tabular-nums">{` · ${CONTACT_SALES_PHONE}`}</span>}
                  </a>
                )
              })}
            </AlertAction>
          )}
        </Alert>
      )}
    </div>
  )
}

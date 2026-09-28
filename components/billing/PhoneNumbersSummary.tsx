import Link from 'next/link'
import { AlertTriangle, Phone, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { cn, formatPhoneNumber } from '@/lib/utils'
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'
import { formatUsd } from './format'

export interface BillingPhoneNumber {
  id: string
  number: string
  country: string | null
  is_active: boolean
  monthly_cost: number | null
}

interface PhoneNumbersSummaryProps {
  numbers: BillingPhoneNumber[]
  /** True when the numbers couldn't be loaded. */
  failed: boolean
}

export function PhoneNumbersSummary({ numbers, failed }: PhoneNumbersSummaryProps) {
  const monthlyTotal = numbers.reduce((sum, n) => sum + Number(n.monthly_cost ?? PHONE_NUMBER_MONTHLY_PRICE_USD), 0)

  return (
    <section aria-labelledby="numbers-heading" className="flex h-full flex-col rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="numbers-heading" className="text-sm font-semibold text-foreground">
            Phone number subscriptions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Numbers aren’t part of a plan. Each one is billed {formatUsd(PHONE_NUMBER_MONTHLY_PRICE_USD, { cents: true })} a month on its own.
          </p>
        </div>
        {!failed && numbers.length > 0 && (
          <p className="shrink-0 text-right">
            <span className="block text-lg font-semibold tabular-nums text-foreground">{formatUsd(monthlyTotal, { cents: true })}</span>
            <span className="text-xs text-muted-foreground">a month</span>
          </p>
        )}
      </div>

      {failed ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          We couldn’t load your phone numbers. Refresh the page to try again.
        </div>
      ) : numbers.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No phone numbers yet"
          description="Get a number so callers can reach your agent."
          className="py-8"
          action={
            <Link href="/phone" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
              <Plus aria-hidden="true" />
              Get a number
            </Link>
          }
        />
      ) : (
        <>
          <ul className="mt-4 divide-y rounded-xl border">
            {numbers.map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-3 py-2.5">
                {n.country && <FlagIcon country={n.country} />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums text-foreground">
                  {formatPhoneNumber(n.number)}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    n.is_active ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {n.is_active ? 'Active' : 'Paused'}
                </span>
                <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
                  {formatUsd(Number(n.monthly_cost ?? PHONE_NUMBER_MONTHLY_PRICE_USD), { cents: true })}/mo
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/phone"
            className="mt-auto inline-flex items-center pt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Manage phone numbers
          </Link>
        </>
      )}
    </section>
  )
}

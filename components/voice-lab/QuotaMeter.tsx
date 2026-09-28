'use client'

import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ToolAllowance } from './use-voice-lab-usage'

interface QuotaMeterProps {
  label: string
  allowance: ToolAllowance | null
  unit: 'characters' | 'minutes'
  resetsAt: string | null
  /** The allowance couldn't be loaded (the page shows the error); don't show a skeleton that never resolves. */
  unavailable?: boolean
  className?: string
}

function formatAmount(value: number, unit: QuotaMeterProps['unit']): string {
  if (unit === 'minutes') {
    const minutes = value / 60
    return minutes < 10 && minutes % 1 !== 0 ? minutes.toFixed(1) : Math.floor(minutes).toLocaleString('en-US')
  }
  return Math.floor(value).toLocaleString('en-US')
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** This period's allowance for one Voice Lab tool. */
export function QuotaMeter({ label, allowance, unit, resetsAt, unavailable = false, className }: QuotaMeterProps) {
  if (!allowance && unavailable) {
    return (
      <div className={cn('rounded-xl border bg-card p-3 text-xs', className)}>
        <p className="font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-muted-foreground">Your allowance isn’t available right now.</p>
      </div>
    )
  }

  if (!allowance) {
    return (
      <div className={cn('space-y-2 rounded-xl border bg-card p-3', className)} aria-hidden="true">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-28" />
      </div>
    )
  }

  const ratio = allowance.limit > 0 ? Math.min(1, allowance.used / allowance.limit) : 1
  const percent = Math.round(ratio * 100)
  const low = ratio >= 0.8
  const reset = formatDate(resetsAt)

  return (
    <div className={cn('space-y-2 rounded-xl border bg-card p-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatAmount(allowance.used, unit)} of {formatAmount(allowance.limit, unit)} {unit} used
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% used, ${formatAmount(allowance.remaining, unit)} ${unit} left`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', ratio >= 1 ? 'bg-destructive' : low ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatAmount(allowance.remaining, unit)} {unit} left{reset ? ` · resets ${reset}` : ''}
        {low && (
          <>
            {' · '}
            <Link href="/billing" className="font-medium text-primary underline-offset-4 hover:underline">
              Get more
            </Link>
          </>
        )}
      </p>
    </div>
  )
}

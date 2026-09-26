import Link from 'next/link'
import { ArrowRight, Lock } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PLANS, type Plan } from '@/types'

interface UpgradeNoticeProps {
  /** What's locked, in plain words ("Call recordings"). */
  feature: string
  requiredPlan: Plan
  description?: string
  /** One-line inline version for tight spots (inside a card, next to a switch). */
  compact?: boolean
  className?: string
}

// Custom is the top tier, so "and above" would promise a plan that doesn't exist.
function planPhrase(plan: Plan): string {
  const name = PLANS[plan].name
  return plan === 'custom' ? `the ${name} plan` : `${name} and above`
}

/**
 * Tells the owner a feature is part of a higher plan instead of hiding it or
 * letting a control fail silently. Links to /billing; renders on the server
 * or the client.
 */
export function UpgradeNotice({ feature, requiredPlan, description, compact = false, className }: UpgradeNoticeProps): React.JSX.Element {
  const plan = PLANS[requiredPlan]
  const cta = plan.contact_sales ? 'Talk to sales' : `Upgrade to ${plan.name}`

  if (compact) {
    return (
      // One text flow next to the lock, so a narrow column wraps the sentence
      // instead of leaving the lock alone on its own line.
      <div role="note" className={cn('flex min-w-0 items-start gap-2 text-xs text-muted-foreground', className)}>
        <Lock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <p className="min-w-0">
          <span className="font-medium text-foreground">{feature}</span> is available on {planPhrase(requiredPlan)}.{' '}
          <Link
            href="/billing"
            className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {cta}
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </p>
      </div>
    )
  }

  return (
    <section
      aria-label={`${feature} requires ${plan.name}`}
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:gap-4',
        className
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">
          {feature} is available on {planPhrase(requiredPlan)}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {description ?? 'Upgrade your plan to turn it on. Everything you have set up keeps working as it is.'}
        </p>
      </div>
      <Link href="/billing" className={cn(buttonVariants({ size: 'sm' }), 'w-full sm:w-auto')}>
        {cta}
        <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  )
}

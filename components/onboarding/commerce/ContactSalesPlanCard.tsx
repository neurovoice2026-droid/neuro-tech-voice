'use client'

// The sales-led tier of a plan family (Store Enterprise) as a plan card. It
// keeps PlanCard's five subgrid rows (name, tagline, price + note, rule,
// features) so it lines up with the self-serve cards next to it, but shows a
// "from" price and no checkout note: picking it launches on the trial and the
// team sets the plan up (POST /api/onboarding/complete treats contact_sales
// plans that way).

import { Check } from 'lucide-react'
import { OptionCard } from '@/components/shared/OptionCard'
import { cn } from '@/lib/utils'
import { PLANS, type Plan } from '@/types'

interface ContactSalesPlanCardProps {
  id: Plan
  selected: boolean
  onSelect: () => void
  /** Chip next to the name. */
  badge?: React.ReactNode
  disabled?: boolean
  className?: string
}

export function ContactSalesPlanCard({ id, selected, onSelect, badge, disabled, className }: ContactSalesPlanCardProps) {
  const p = PLANS[id]
  return (
    <OptionCard
      selected={selected}
      onSelect={onSelect}
      // leading-6 = the badge's height, so a badge never makes one title row taller than another.
      title={<span className="text-[15px] leading-6">{p.name}</span>}
      badge={badge}
      disabled={disabled}
      className={cn('row-span-5 mb-3 grid grid-rows-subgrid gap-0 p-5', !selected && 'bg-white shadow-hair hover:bg-band', className)}
    >
      <span aria-hidden="true" className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">
        For high-volume stores
      </span>
      <span className="mt-4 flex flex-col">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[28px] leading-8 font-semibold tracking-[-0.02em] tabular-nums">${p.price_monthly.toLocaleString('en-US')}+</span>
          <span className="text-[13px] leading-[19px] text-muted-foreground">/ month</span>
        </span>
        <span className="mt-1 text-xs leading-4 text-muted-foreground">Volume pricing · contact sales</span>
      </span>
      <span aria-hidden="true" className="my-4 block h-px w-full bg-rule" />
      <span className="grid w-full content-start gap-x-6 gap-y-2 sm:grid-cols-2">
        {p.features.map((f, i) => (
          <span
            key={f}
            // The first line is the minutes allowance; the rest is visual detail of the radio.
            aria-hidden={i > 0 ? true : undefined}
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

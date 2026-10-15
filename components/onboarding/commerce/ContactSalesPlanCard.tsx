'use client'

// The sales-led plan of a family (Enterprise for services, Store Enterprise
// for stores) at launch, as its homepage card (components/pricing,
// EnterpriseTierCard): a name, the line where a fee would be ("Priced with
// you", "From $1,000 a month"), what it has, and the radio. Picking it
// launches on the trial and the team sets the plan up (POST
// /api/onboarding/complete treats contact_sales plans that way);
// ContactSalesNote says so under the cards.

import { AppPlanTierCard, PlanTierRadio } from '@/components/pricing/AppPlanTiers'
import { CONTACT_SALES_HREF, CONTACT_SALES_PHONE } from '@/lib/billing/upgrade'
import { PLANS, type Plan } from '@/types'

interface ContactSalesPlanCardProps {
  id: Plan
  /** Its place among the cards. */
  index: number
  selected: boolean
  onSelect: () => void
  annual: boolean
  disabled?: boolean
}

export function ContactSalesPlanCard({ id, index, selected, onSelect, annual, disabled }: ContactSalesPlanCardProps) {
  const name = PLANS[id].name
  return (
    <AppPlanTierCard
      plan={id}
      annual={annual}
      index={index}
      idPrefix="launch-plan"
      state={selected ? 'selected' : undefined}
      stateLabel="Selected"
      disabled={disabled}
      onPick={selected ? undefined : onSelect}
      action={<PlanTierRadio name={name} selected={selected} pick={false} disabled={disabled} onSelect={onSelect} />}
    />
  )
}

/** Under the cards once a sales-led plan is chosen: what happens at launch, and the sales line (the homepage's). */
export function ContactSalesNote({ plan }: { plan: Plan }) {
  const name = PLANS[plan].name
  return (
    <p className="mt-3 text-[13px] leading-[19px] text-muted-foreground" aria-live="polite">
      {name} is set up with our team: you launch on the free trial now and we get in touch to agree volume and terms. In a
      hurry? Call{' '}
      <a href={CONTACT_SALES_HREF} className="font-medium text-foreground underline underline-offset-4 tabular-nums">
        {CONTACT_SALES_PHONE}
      </a>
      .
    </p>
  )
}

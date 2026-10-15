'use client'

import { useEffect, useRef, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Chip } from '@/components/shared/OptionCard'
import { PlanJump, type JumpChip } from '@/components/site/home/pricing-cards'
import { usePrefersReducedMotion } from '@/components/site/product/timing'
import { wholeMoney } from '@/lib/pages/home/pricing-math'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types'
import {
  ENTERPRISE_CARD,
  EnterpriseTierCard,
  Fee,
  PerkList,
  PlanTierCard,
  TIER_CARD,
  TierAllowance,
  TierPrice,
  useLiveMeshes,
  type TierState,
} from './PlanTierCard'
import { planTierDisplay } from './fonts'
import { TRIAL_TIER, planTierView, type PlanTierView } from './plan-tier-view'

/* ------------------------------------------------------------------ *
 * The homepage's plan cards in the app (onboarding's launch step, the
 * billing page's plan picker): the same card (PlanTierCard.tsx) for the
 * same plan, read off PLANS (plan-tier-view.ts), plus only what choosing
 * needs: a selected or current state (ringed in ink, with a tab) and the
 * card's button in place of the homepage's "Start free".
 *
 * Layout: below sm a sideways rail of homepage-width cards that snap, run
 * to the screen's edges (the page's 16px gutter), under the homepage's
 * jump chips (a swatch, the name and the fee of each card); from sm two
 * columns, the sales-led plan a band across both.
 * ------------------------------------------------------------------ */

/** The container: the rail below sm, two columns from sm. */
const LAYOUT = cn(
  '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pt-6 pb-8 [scroll-padding-inline:16px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  'sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-8 sm:overflow-visible sm:px-0 sm:pt-4 sm:pb-2 sm:[scroll-snap-type:none]',
)
/** A card: the homepage rail's width below sm, a grid cell from sm. */
const CARD = 'shrink-0 basis-[min(calc(100vw-72px),336px)] snap-center sm:basis-auto'

/** The homepage card's button: the ink pill (the pick's magenta), drawn at the button's 44px. */
const BUTTON = 'h-11 w-full justify-center rounded-full px-5 text-base font-normal focus-visible:outline-pp-ink'
const BUTTON_PRIMARY = 'bg-pp-ink text-white hover:bg-[#2b2a28]'
/** A chosen plan's button: white, quiet. */
const BUTTON_QUIET = 'pp-shadow-btn bg-white text-pp-ink hover:bg-white'

/** Classes for a button or link in a card: the ink pill, the pick's magenta, or quiet for a chosen plan. */
export function tierButtonClass({ pick = false, quiet = false }: { pick?: boolean; quiet?: boolean } = {}): string {
  return cn(BUTTON, quiet ? BUTTON_QUIET : BUTTON_PRIMARY, !quiet && pick && 'home-plan-cta-pick')
}

/**
 * The jump chips for the app's cards, as the homepage's (components/site/home
 * PlanJump): each card's light as the swatch, its name, and its fee a month
 * on the billing shown. The trial and a sales-led plan carry no fee, as the
 * homepage's Enterprise chip does not.
 */
export function appJumpChips(plans: readonly Plan[], annual: boolean): JumpChip[] {
  return plans.map((plan) => {
    const view = planTierView(plan, annual)
    const chip: JumpChip = { id: plan, name: view.name, light: view.light }
    return view.figures ? { ...chip, price: wholeMoney(view.figures.fee) } : chip
  })
}

/**
 * The cards' wrapper: their scope (plan-tier.css `.plan-tiers`), the
 * display face, the layout, and the meshes that flow while on screen.
 * Pass `role="radiogroup"` and a label where the cards' buttons are radios.
 * On the rail, the chosen or current card is brought to the middle when
 * the cards appear, so the state is in view; the page itself never moves.
 * With `jump` (appJumpChips of the cards shown, in their order), the
 * homepage's jump chips sit above the rail below sm: a tap brings that card
 * to the middle, however far along the rail it is.
 */
export function PlanTiers({ className, children, jump, ...rest }: HTMLAttributes<HTMLDivElement> & { jump?: readonly JumpChip[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = usePrefersReducedMotion()
  useLiveMeshes(ref)
  useEffect(() => {
    const rail = ref.current
    if (!rail || rail.scrollWidth <= rail.clientWidth) return
    const card = rail.querySelector<HTMLElement>('.home-plan[data-state]')
    if (!card) return
    const r = rail.getBoundingClientRect()
    const c = card.getBoundingClientRect()
    rail.scrollLeft += c.left - r.left - (r.width - c.width) / 2
  }, [])
  const rail = (
    <div ref={ref} {...rest} className={cn('plan-tiers', planTierDisplay.variable, LAYOUT, className)}>
      {children}
    </div>
  )
  if (!jump || jump.length === 0) return rail
  return (
    <>
      {/* Its own `.plan-tiers` scope: the chips' swatches and ring read the cards' tokens (plan-tier.css). */}
      <div className="plan-tiers sm:hidden">
        <PlanJump chips={jump} railRef={ref} reduce={reduce} className="mt-3 sm:hidden" />
      </div>
      {rail}
    </>
  )
}

/** The trial's fee block: "$0 for 14 days", in the place and type of a paid card's. */
function TrialPrice({ changed }: { changed: boolean }) {
  return (
    <>
      <Fee fee={0} pick={false} annual={false} changed={changed} unit={TRIAL_TIER.unit} spoken={TRIAL_TIER.spoken} />
      <p className="mt-1 text-[15px] leading-[22px] font-medium text-(--plan-accent)">{TRIAL_TIER.line}</p>
      <p className="mt-0.5 text-[13px] leading-[18px] text-(--plan-dim)">{TRIAL_TIER.note}</p>
    </>
  )
}

export interface AppPlanTierCardProps {
  plan: Plan
  annual: boolean
  /** The reader has switched the billing period: changed lines roll in. */
  changed?: boolean
  /** Its place among the cards. */
  index: number
  /** Makes the card's ids unique on the page (`${idPrefix}-${plan}`). */
  idPrefix: string
  state?: TierState
  /** The state tab's words ("Selected", "Current plan"). */
  stateLabel?: string
  /** The choice is locked: the card steps back and does not select. */
  disabled?: boolean
  /** A click anywhere on the card (outside its links and buttons) chooses it. */
  onPick?: () => void
  /** The card's button (or status), where the homepage has "Start free". */
  action: ReactNode
  /** The small line under the button. */
  micro?: string | null
}

/** One plan's card, as the homepage draws it, with the app's state and button. */
export function AppPlanTierCard({
  plan,
  annual,
  changed = false,
  index,
  idPrefix,
  state,
  stateLabel,
  disabled,
  onPick,
  action,
  micro,
}: AppPlanTierCardProps) {
  const view: PlanTierView = planTierView(plan, annual)
  const id = `${idPrefix}-${plan}`
  const onClick = onPick
    ? (e: MouseEvent<HTMLElement>) => {
        // The card's own links and buttons do their own thing.
        if (e.target instanceof Element && e.target.closest('a, button')) return
        onPick()
      }
    : undefined
  const overlay = state ? (
    <span aria-hidden className="home-plan-tab">
      {stateLabel}
    </span>
  ) : null
  const card = {
    as: 'div' as const,
    id,
    cardId: plan,
    light: view.light,
    i: index,
    nameId: `${id}-name`,
    state,
    disabled,
    onClick,
    overlay,
    name: view.name,
  }

  if (view.kind === 'enterprise' && view.enterprise) {
    return (
      <EnterpriseTierCard
        {...card}
        className={cn(ENTERPRISE_CARD, CARD, 'sm:col-span-2')}
        tagline={view.enterprise.tagline}
        line={view.enterprise.line}
        perks={<PerkList head={view.perks.head} items={view.perks.items} wide columns="sm:grid-cols-2 sm:gap-x-8" />}
        action={action}
      />
    )
  }

  return (
    <PlanTierCard
      {...card}
      className={cn(TIER_CARD, CARD)}
      pick={view.pick}
      badge={view.badge}
      price={
        view.figures ? (
          <TierPrice {...view.figures} pick={view.pick} annual={annual} changed={changed} />
        ) : (
          <TrialPrice changed={changed} />
        )
      }
      allowance={<TierAllowance included={view.included} notes={view.notes} />}
      action={
        <>
          {action}
          {micro && <p className="mt-2 text-center text-[12px] leading-4 text-(--plan-dim)">{micro}</p>}
        </>
      }
      perks={<PerkList head={view.perks.head} items={view.perks.items} />}
    />
  )
}

/**
 * A card's button as a radio (onboarding): "Choose Pro", or "Selected"
 * once chosen; the plan's name is always in its accessible name. Inside a
 * `role="radiogroup"` the arrow keys move between the cards (Chip).
 */
export function PlanTierRadio({
  name,
  label,
  selected,
  pick,
  disabled,
  onSelect,
}: {
  name: string
  /** The unselected button's words (default "Choose <name>"). */
  label?: string
  selected: boolean
  pick: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <Chip
      role="radio"
      pressed={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(tierButtonClass({ pick, quiet: selected }), 'gap-1.5')}
    >
      {selected ? (
        <>
          <Check aria-hidden className="size-4" strokeWidth={2.25} />
          Selected<span className="sr-only">: {name}</span>
        </>
      ) : (
        (label ?? `Choose ${name}`)
      )}
    </Chip>
  )
}

/** In place of a button on the plan the organization is on: a quiet status, not a control. */
export function PlanTierStatus({ children }: { children: ReactNode }) {
  return (
    <p className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white/70 text-[15px] leading-5 font-medium text-(--plan-text) shadow-[inset_0_0_0_1px_rgb(20_10_36/0.12)]">
      <Check aria-hidden className="size-4 text-(--plan-tick)" strokeWidth={2.25} />
      {children}
    </p>
  )
}

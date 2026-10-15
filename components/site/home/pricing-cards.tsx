"use client";

import { memo, useEffect, useMemo, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { PillLink } from "@/components/site/product/primitives";
import {
  ENTERPRISE_CARD,
  EnterpriseTierCard,
  PerkList,
  PlanTierCard,
  RollIn,
  TIER_CARD,
  TierAllowance,
  TierPrice,
  useLiveMeshes,
} from "@/components/pricing/PlanTierCard";
import { HOME_PRICING, perkText } from "@/lib/pages/home/pricing";
import {
  HOME_ENTERPRISE,
  HOME_PLANS,
  perDay,
  perMinute,
  planFee,
  wholeMoney,
  yearlyOf,
  type HomePlan,
  type PlanId,
} from "@/lib/pages/home/pricing-math";
import { RING_LIGHT, centreInRail } from "./controls";

// The card pieces live in components/pricing (the app's plan pickers draw
// the same cards); the homepage's other modules import them from here.
export { ENTERPRISE_BLOBS, PLAN_BLOBS } from "@/components/pricing/lights";
export { Fee, Mesh, PerkList, RollIn, useLiveMeshes } from "@/components/pricing/PlanTierCard";

/* ------------------------------------------------------------------ *
 * #pricing's plan cards: five listed plans and Enterprise, each a pearl
 * mesh (components/pricing/plan-tier.css `.home-plan-light[data-plan]`,
 * the same recipes as palettes.ts PLAN_LIGHTS), climbing in colour with
 * the plan, under a fine grain that keeps the soft gradients from
 * banding. Pro, our pick, is the magenta pearl: centred, widest, ringed in
 * an iridescent edge, the only badge and the only magenta button.
 *
 * Every card reads, top to bottom: the name, the fee (and what it is a
 * day), the allowance and the price of prepaid extra minutes past it
 * (without them calls pause), the band of call volumes it is the cheapest
 * for, the way in, and what it has. Enterprise shows no fee, allowance or
 * rate anywhere, in any state.
 *
 * Once the reader has changed the estimate, the card with the lowest bill
 * for it is ringed in ink and carries a tab saying so. Before that nothing
 * is ringed: the only emphasis on arrival is Pro, which is our pick.
 *
 * The colour moves: over each card's ground sits the same mesh taken apart
 * into its pools (mesh-flow.ts), each its own element drifting on its own
 * path (plan-tier.css `.home-plan-mesh`, on the compositor), so the colours
 * travel across the card while the palette never changes. It runs only while the card is on screen (`data-live`,
 * set by an IntersectionObserver straight on the element, so no
 * render; off screen it rests, and its layers are dropped), and never on
 * weak hardware or with reduced motion, where the ground alone is the same
 * picture standing still.
 *
 * Below lg the cards are a sideways rail with a row of jump chips above it;
 * at lg a bento with Pro in the middle spanning two rows; from xl five
 * columns whose rows line up (subgrid), Enterprise as a band beneath.
 *
 * Every card carries two attributes: `data-card`, the card's own id, which
 * the jump chips and the estimator look cards up by; and `data-plan`, the
 * light it wears (plan-tier.css). On these cards the two are the same; the
 * store cards (pricing-store-cards.tsx) wear a service plan's light under
 * their own id.
 *
 * The card itself is components/pricing/PlanTierCard.tsx, the one the
 * app's onboarding and billing show too; this file gives it the
 * homepage's figures, its "lowest bill" tab and band, and its buttons.
 * ------------------------------------------------------------------ */

const P = HOME_PRICING;

type Band = { from: number; to: number; first: boolean; last: boolean };

const PlanCard = memo(function PlanCard({
  plan,
  i,
  annual,
  changed,
  fitCalls,
  band,
}: {
  plan: HomePlan;
  i: number;
  annual: boolean;
  changed: boolean;
  /** The reader's calls a day, only on the card with the lowest bill for them (after their first change). */
  fitCalls: number | null;
  band: Band | undefined;
}) {
  const pick = plan.featured;
  const fits = fitCalls !== null;
  // The tab keeps its last words while it fades on the card the fit has left.
  const [shownCalls, setShownCalls] = useState(fitCalls);
  if (fitCalls !== null && fitCalls !== shownCalls) setShownCalls(fitCalls);
  const perks = P.perks[plan.id];
  const year = yearlyOf(plan);
  return (
    <PlanTierCard
      id={`plan-${plan.id}`}
      cardId={plan.id}
      light={plan.id}
      pick={pick}
      i={i}
      nameId={`plan-${plan.id}-name`}
      current={fits}
      className={`${TIER_CARD} home-plan-rise scroll-mt-28`}
      overlay={
        <>
          <span aria-hidden className="home-plan-tab">
            {shownCalls !== null ? P.plan.fitTab(shownCalls) : ""}
          </span>
          {fits && <span className="sr-only">{P.plan.fits}</span>}
        </>
      }
      name={plan.name}
      badge={plan.featured ? P.plan.pick : null}
      price={
        <TierPrice
          fee={planFee(plan, annual)}
          perDay={perDay(plan, annual)}
          yearlyFee={planFee(plan, true)}
          yearTotal={year.total}
          yearOff={year.off}
          pick={pick}
          annual={annual}
          changed={changed}
        />
      }
      allowance={
        <TierAllowance included={P.plan.included(plan.minutes)} notes={[P.plan.then(perMinute(plan.overage))]}>
          {band && (
            <p className="mt-2 flex items-center gap-2 text-[13px] leading-[18px] font-medium text-(--plan-accent)">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--plan-tick)" />
              <RollIn key={annual ? "yearly" : "monthly"} animate={changed}>
                {P.plan.cheapest(band.from, band.to, band.first, band.last)}
              </RollIn>
            </p>
          )}
        </TierAllowance>
      }
      action={
        <>
          <PillLink
            href={plan.cta.href}
            variant="primary"
            className={cn("h-11 w-full justify-center", RING_LIGHT, pick && "home-plan-cta-pick")}
          >
            {plan.cta.label}
          </PillLink>
          <p className="mt-2 text-center text-[12px] leading-4 text-(--plan-dim)">{P.plan.trialMicro}</p>
        </>
      }
      perks={<PerkList head={perks.head} items={perks.items.map((perk) => perkText(perk, annual))} />}
    />
  );
});

const EnterpriseCard = memo(function EnterpriseCard({ annual }: { annual: boolean }) {
  const e = HOME_ENTERPRISE;
  const perks = P.perks[e.id];
  return (
    <EnterpriseTierCard
      id={`plan-${e.id}`}
      cardId={e.id}
      light={e.id}
      i={5}
      nameId={`plan-${e.id}-name`}
      className={`${ENTERPRISE_CARD} home-plan-rise scroll-mt-28`}
      name={e.name}
      tagline={P.enterprise.tagline}
      line={P.enterprise.line}
      perks={<PerkList head={perks.head} items={perks.items.map((perk) => perkText(perk, annual))} wide />}
      action={
        <PillLink href={e.cta.href} variant="primary" className={cn("h-11 w-full justify-center", RING_LIGHT)}>
          {e.cta.label}
        </PillLink>
      }
    />
  );
});

export function PlanCards({
  annual,
  changed,
  fitId,
  calls,
  bands,
  railRef,
}: {
  annual: boolean;
  changed: boolean;
  fitId: PlanId;
  calls: number;
  bands: { id: PlanId; from: number; to: number }[];
  railRef: RefObject<HTMLOListElement | null>;
}) {
  useLiveMeshes(railRef);

  // One object per band for as long as the bands hold, so memo(PlanCard) lets
  // a slider step re-render only the card whose tab changes.
  const bandById = useMemo(
    () =>
      new Map<PlanId, Band>(
        bands.map((b, at) => [b.id, { from: b.from, to: b.to, first: at === 0, last: at === bands.length - 1 }]),
      ),
    [bands],
  );
  return (
    <ol ref={railRef} aria-label="Plans" className="home-plans">
      {HOME_PLANS.map((plan, i) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          i={i}
          annual={annual}
          changed={changed}
          fitCalls={changed && plan.id === fitId ? calls : null}
          band={bandById.get(plan.id)}
        />
      ))}
      <EnterpriseCard annual={annual} />
    </ol>
  );
}

/** One chip of the jump row: a card's id, its name, its fee if it has one, and the light its swatch wears. */
export type JumpChip = { id: string; name: string; price?: string; light: string };

/** The service plans' chips: the listed plans with their fees, then Enterprise. */
export function serviceJumpChips(annual: boolean): JumpChip[] {
  return [
    ...HOME_PLANS.map((p) => ({ id: p.id, name: p.name, price: wholeMoney(planFee(p, annual)), light: p.id })),
    { id: HOME_ENTERPRISE.id, name: HOME_ENTERPRISE.name, light: HOME_ENTERPRISE.id },
  ];
}

/**
 * The jump chips above the rail, below lg: a swatch of each card's mesh,
 * its name and its fee. A tap brings the card to the middle of the rail
 * and moves focus to its name; the chip of the card nearest the middle of
 * the rail is ringed (at either end of the scroll, the end card). Worked
 * out when a card crosses 60% visible and once when a scroll ends, never
 * per scroll frame. Mounted afresh with each rail it serves (`key`), so
 * it observes the cards that are there. The app's plan rails (onboarding,
 * billing) use it too, below sm, through `className`.
 */
export function PlanJump({
  chips,
  railRef,
  reduce,
  className,
}: {
  chips: readonly JumpChip[];
  railRef: RefObject<HTMLElement | null>;
  reduce: boolean;
  /** Merged over the row's classes (the app shows it below sm, closer to its rail). */
  className?: string;
}) {
  const [inView, setInView] = useState(chips[0]?.id ?? "");

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const cards = [...rail.querySelectorAll<HTMLElement>(".home-plan")];
    if (cards.length === 0) return;
    const pick = () => {
      if (rail.scrollWidth <= rail.clientWidth) return;
      let best = cards[0];
      if (rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1) best = cards[cards.length - 1];
      else if (rail.scrollLeft > 1) {
        const r = rail.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        let gap = Infinity;
        for (const c of cards) {
          const b = c.getBoundingClientRect();
          const d = Math.abs(b.left + b.width / 2 - mid);
          if (d < gap) [gap, best] = [d, c];
        }
      }
      setInView(best.dataset.card ?? "");
    };
    const io = new IntersectionObserver(pick, { root: rail, threshold: 0.6 });
    cards.forEach((li) => io.observe(li));
    rail.addEventListener("scrollend", pick);
    return () => {
      io.disconnect();
      rail.removeEventListener("scrollend", pick);
    };
  }, [railRef]);

  const go = (id: string) => {
    const rail = railRef.current;
    const li = rail?.querySelector<HTMLElement>(`[data-card="${id}"]`);
    if (!rail || !li) return;
    setInView(id);
    centreInRail(rail, li, reduce);
    li.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
  };

  return (
    <div
      role="group"
      aria-label={P.jump.label}
      className={cn(
        "home-fade-x -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => go(chip.id)}
          aria-label={P.jump.name(chip.name, chip.price)}
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-full bg-white pr-3.5 pl-1.5 text-[14px] leading-5 font-medium text-pp-ink shadow-[0_0_0_1px_rgb(24_16_40/0.1)] transition-[box-shadow] duration-200",
            RING_LIGHT,
            inView === chip.id && "shadow-[0_0_0_1.5px_var(--home-ink)]",
          )}
        >
          <span aria-hidden data-plan={chip.light} className="home-plan-light home-plan-swatch size-8 rounded-full" />
          {chip.name}
          {chip.price && <span className="font-normal text-pp-muted tabular-nums">{chip.price}</span>}
        </button>
      ))}
    </div>
  );
}

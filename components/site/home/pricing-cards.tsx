"use client";

import { memo, useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes, type RefObject } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PillLink } from "@/components/site/product/primitives";
import { HOME_PRICING, perkText, type CardId, type Perk } from "@/lib/pages/home/pricing";
import {
  HOME_ENTERPRISE,
  HOME_PLANS,
  money,
  perDay,
  perMinute,
  planFee,
  wholeMoney,
  yearlyOf,
  type HomePlan,
  type PlanId,
} from "@/lib/pages/home/pricing-math";
import { RING_LIGHT, centreInRail } from "./controls";
import { meshBlobs } from "./mesh-flow";
import { ENTERPRISE_LIGHT, PLAN_LIGHTS } from "./palettes";
import { WEIGHT } from "./type";

/* ------------------------------------------------------------------ *
 * #pricing's plan cards: five listed plans and Enterprise, each a pearl
 * mesh (pricing.css `.home-plan-light[data-plan]`, the same recipes
 * as palettes.ts PLAN_LIGHTS), climbing in colour with the plan, under a
 * fine grain that keeps the soft gradients from banding. Pro, our pick, is
 * the magenta pearl: centred, widest, ringed in an iridescent edge, the
 * only badge and the only magenta button.
 *
 * Every card reads, top to bottom: the name, the fee (and what it is a
 * day), the allowance and the rate past it, the band of call volumes it
 * is the cheapest for, the way in, and what it has. Enterprise shows no
 * fee, allowance or rate anywhere, in any state.
 *
 * Once the reader has changed the estimate, the card with the lowest bill
 * for it is ringed in ink and carries a tab saying so. Before that nothing
 * is ringed: the only emphasis on arrival is Pro, which is our pick.
 *
 * The colour moves: over each card's ground sits the same mesh taken apart
 * into its pools (mesh-flow.ts), each its own element drifting on its own
 * path (pricing.css `.home-plan-mesh`, on the compositor), so the colours
 * travel across the card while the palette never changes. It runs only while the card is on screen (`data-live`,
 * set here by an IntersectionObserver straight on the element, so no
 * render; off screen it rests, and its layers are dropped), and never on
 * weak hardware or with reduced motion, where the ground alone is the same
 * picture standing still.
 *
 * Below lg the cards are a sideways rail with a row of jump chips above it;
 * at lg a bento with Pro in the middle spanning two rows; from xl five
 * columns whose rows line up (subgrid), Enterprise as a band beneath.
 * ------------------------------------------------------------------ */

const P = HOME_PRICING;

type Band = { from: number; to: number; first: boolean; last: boolean };

/**
 * A span that rolls in (`.home-pricing-in`) when it mounts after the
 * reader's first change — which is when a key change (Yearly, a new plan)
 * remounts it — and never merely because `changed` flipped under it.
 */
/** Each card's pools as elements, worked out once: the same recipes the card paints as its ground. */
const PLAN_BLOBS = Object.fromEntries(
  Object.entries(PLAN_LIGHTS).map(([id, light]) => [id, meshBlobs(light.ground)]),
) as Record<PlanId, CSSProperties[]>;
const ENTERPRISE_BLOBS = meshBlobs(ENTERPRISE_LIGHT.ground);

/** The flowing copy of a card's mesh (pricing.css "The mesh in motion"). */
function Mesh({ blobs }: { blobs: CSSProperties[] }) {
  return (
    <span aria-hidden className="home-plan-mesh">
      {blobs.map((style, n) => (
        <span key={n} style={style} />
      ))}
    </span>
  );
}

export function RollIn({ animate, className, ...rest }: { animate: boolean } & HTMLAttributes<HTMLSpanElement>) {
  const [on] = useState(animate);
  return <span className={cn(className, on && "home-pricing-in")} {...rest} />;
}

/** "$207.50" → ["$207", "50"]; whole-dollar fees print without cents. */
function splitMoney(n: number) {
  const [dollars, c = "00"] = money(n).split(".");
  return { dollars, cents: c === "00" ? null : c };
}

function Fee({ plan, annual, changed }: { plan: HomePlan; annual: boolean; changed: boolean }) {
  const fee = planFee(plan, annual);
  const { dollars, cents: c } = splitMoney(fee);
  return (
    <p className="flex items-baseline gap-1 whitespace-nowrap">
      <RollIn
        key={annual ? "yearly" : "monthly"}
        animate={changed}
        aria-hidden
        className={cn(
          "home-plan-fee pp-display tracking-[-0.025em] tabular-nums",
          plan.featured && "home-plan-fee-pick",
        )}
        style={{ fontWeight: WEIGHT.num }}
      >
        {dollars}
        {c && <span className="ml-px align-[0.72em] text-[0.5em] leading-none tracking-normal">.{c}</span>}
      </RollIn>
      <span aria-hidden className="text-[13px] leading-[18px] text-(--plan-dim)">
        {P.plan.perMonth}
      </span>
      <span className="sr-only">
        {money(fee)}
        {annual ? P.plan.aMonthYearly : P.plan.aMonth}
      </span>
    </p>
  );
}

function PerkList({
  head,
  items,
  annual,
  wide = false,
}: {
  head: string;
  items: Perk[];
  annual: boolean;
  wide?: boolean;
}) {
  return (
    <div className="home-plan-perks">
      <p className="text-[13px] leading-[18px] text-(--plan-dim)">{head}</p>
      <ul className={cn("mt-3 grid gap-2.5", wide && "xl:grid-cols-2 xl:gap-x-8")}>
        {items.map((perk, k) => (
          <li key={k} className="flex gap-2.5 text-[14px] leading-5 text-(--plan-text)">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-(--plan-tick)" strokeWidth={2.25} />
            <span>{perkText(perk, annual)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
    <li
      id={`plan-${plan.id}`}
      data-plan={plan.id}
      data-tone="light"
      data-pick={pick || undefined}
      data-i={i}
      aria-labelledby={`plan-${plan.id}-name`}
      aria-current={fits ? "true" : undefined}
      className="home-plan home-plan-light home-plan-rise scroll-mt-28"
    >
      <Mesh blobs={PLAN_BLOBS[plan.id]} />
      <span aria-hidden className="home-grain" />
      {pick && <span aria-hidden className="home-plan-ring" />}
      <span aria-hidden className="home-plan-tab">
        {shownCalls !== null ? P.plan.fitTab(shownCalls) : ""}
      </span>
      {fits && <span className="sr-only">{P.plan.fits}</span>}

      <div className="home-plan-head flex items-start justify-between gap-3">
        <h3
          id={`plan-${plan.id}-name`}
          // Focused from script by the jump chips, so a keyboard lands in the card it was shown.
          tabIndex={-1}
          className="pp-display text-[20px] leading-[26px] tracking-[-0.01em] text-(--plan-text) outline-none"
          style={{ fontWeight: WEIGHT.h3 }}
        >
          {plan.name}
        </h3>
        {plan.featured && (
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] leading-4 font-medium text-[#a21caf] shadow-[0_1px_2px_rgb(162_28_175/0.18)]">
            <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 fill-current">
              <path d="M5 0c.4 2.6 2.4 4.6 5 5-2.6.4-4.6 2.4-5 5-.4-2.6-2.4-4.6-5-5 2.6-.4 4.6-2.4 5-5Z" />
            </svg>
            {P.plan.pick}
          </span>
        )}
      </div>

      <div className="home-plan-price mt-4">
        <Fee plan={plan} annual={annual} changed={changed} />
        <p className="mt-1 text-[15px] leading-[22px] font-medium text-(--plan-accent)">
          <RollIn key={annual ? "yearly" : "monthly"} animate={changed} className="block">
            {P.plan.perDay(money(perDay(plan, annual)))}
          </RollIn>
        </p>
        <p className="mt-0.5 grid text-[13px] leading-[18px] text-(--plan-dim)">
          <span aria-hidden={annual} className={cn("[grid-area:1/1]", annual && "invisible")}>
            {P.plan.onYearly(wholeMoney(planFee(plan, true)))}
          </span>
          <span aria-hidden={!annual} className={cn("[grid-area:1/1]", !annual && "invisible")}>
            {P.plan.yearly(wholeMoney(year.total), wholeMoney(year.off))}
          </span>
        </p>
      </div>

      <div className="home-plan-allowance mt-5 border-t border-(--plan-rule) pt-4">
        <p className="text-[15px] leading-[22px] font-medium text-(--plan-text)">{P.plan.included(plan.minutes)}</p>
        <p className="text-[13px] leading-[18px] text-(--plan-dim)">{P.plan.then(perMinute(plan.overage))}</p>
        {band && (
          <p className="mt-2 flex items-center gap-2 text-[13px] leading-[18px] font-medium text-(--plan-accent)">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--plan-tick)" />
            <RollIn key={annual ? "yearly" : "monthly"} animate={changed}>
              {P.plan.cheapest(band.from, band.to, band.first, band.last)}
            </RollIn>
          </p>
        )}
      </div>

      <div className="home-plan-action mt-5">
        <PillLink
          href={plan.cta.href}
          variant="primary"
          className={cn("h-11 w-full justify-center", RING_LIGHT, pick && "home-plan-cta-pick")}
        >
          {plan.cta.label}
        </PillLink>
        <p className="mt-2 text-center text-[12px] leading-4 text-(--plan-dim)">{P.plan.trialMicro}</p>
      </div>

      <div className="mt-5 border-t border-(--plan-rule) pt-4">
        <PerkList head={perks.head} items={perks.items} annual={annual} />
      </div>
    </li>
  );
});

const EnterpriseCard = memo(function EnterpriseCard({ annual }: { annual: boolean }) {
  const e = HOME_ENTERPRISE;
  const perks = P.perks[e.id];
  return (
    <li
      id={`plan-${e.id}`}
      data-plan={e.id}
      data-tone="light"
      data-i={5}
      aria-labelledby={`plan-${e.id}-name`}
      className="home-plan home-plan-light home-plan-enterprise home-plan-rise scroll-mt-28"
    >
      <Mesh blobs={ENTERPRISE_BLOBS} />
      <span aria-hidden className="home-grain" />
      <div className="home-plan-enterprise-id">
        <h3
          id={`plan-${e.id}-name`}
          tabIndex={-1}
          className="pp-display text-[20px] leading-[26px] tracking-[-0.01em] text-(--plan-text) outline-none"
          style={{ fontWeight: WEIGHT.h3 }}
        >
          {e.name}
        </h3>
        <p
          className="pp-display mt-3 text-[28px] leading-[32px] tracking-[-0.02em] text-(--plan-text)"
          style={{ fontWeight: 500 }}
        >
          {P.enterprise.tagline}
        </p>
        <p className="mt-2 text-[14px] leading-5 text-(--plan-dim)">{P.enterprise.line}</p>
      </div>
      <div className="home-plan-enterprise-perks">
        <PerkList head={perks.head} items={perks.items} annual={annual} wide />
      </div>
      <div className="home-plan-enterprise-cta">
        <PillLink href={e.cta.href} variant="primary" className={cn("h-11 w-full justify-center", RING_LIGHT)}>
          {e.cta.label}
        </PillLink>
      </div>
    </li>
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
  // The meshes flow only on the cards that are on screen.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute("data-live", e.isIntersecting);
    });
    rail.querySelectorAll(".home-plan").forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, [railRef]);

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

/**
 * The jump chips above the rail, below lg: a swatch of each card's mesh,
 * its name and its fee. A tap brings the card to the middle of the rail
 * and moves focus to its name; the chip of the card nearest the middle of
 * the rail is ringed (at either end of the scroll, the end card). Worked
 * out when a card crosses 60% visible and once when a scroll ends, never
 * per scroll frame.
 */
export function PlanJump({
  annual,
  railRef,
  reduce,
}: {
  annual: boolean;
  railRef: RefObject<HTMLOListElement | null>;
  reduce: boolean;
}) {
  const [inView, setInView] = useState<CardId>("starter");

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const cards = [...rail.querySelectorAll<HTMLElement>(".home-plan")];
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
      setInView(best.dataset.plan as CardId);
    };
    const io = new IntersectionObserver(pick, { root: rail, threshold: 0.6 });
    cards.forEach((li) => io.observe(li));
    rail.addEventListener("scrollend", pick);
    return () => {
      io.disconnect();
      rail.removeEventListener("scrollend", pick);
    };
  }, [railRef]);

  const go = (id: CardId) => {
    const rail = railRef.current;
    const li = rail?.querySelector<HTMLElement>(`[data-plan="${id}"]`);
    if (!rail || !li) return;
    setInView(id);
    centreInRail(rail, li, reduce);
    li.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
  };

  const chips: { id: CardId; name: string; price?: string }[] = [
    ...HOME_PLANS.map((p) => ({ id: p.id, name: p.name, price: wholeMoney(planFee(p, annual)) })),
    { id: HOME_ENTERPRISE.id, name: HOME_ENTERPRISE.name },
  ];

  return (
    <div
      role="group"
      aria-label={P.jump.label}
      className="home-fade-x -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
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
          <span aria-hidden data-plan={chip.id} className="home-plan-light home-plan-swatch size-8 rounded-full" />
          {chip.name}
          {chip.price && <span className="font-normal text-pp-muted tabular-nums">{chip.price}</span>}
        </button>
      ))}
    </div>
  );
}

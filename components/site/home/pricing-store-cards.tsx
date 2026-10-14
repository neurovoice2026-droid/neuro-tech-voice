"use client";

import { memo, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { PillLink } from "@/components/site/product/primitives";
import { HOME_PRICING } from "@/lib/pages/home/pricing";
import { money, perMinute, wholeMoney, type PlanId } from "@/lib/pages/home/pricing-math";
import {
  STORE_ENTERPRISE,
  STORE_LISTED,
  STORE_PRICING,
  storeFee,
  storePerDay,
  storeYearly,
  type StorePlan,
} from "@/lib/pages/home/store-pricing";
import { RING_LIGHT } from "./controls";
import {
  ENTERPRISE_BLOBS,
  Fee,
  Mesh,
  PLAN_BLOBS,
  PerkList,
  RollIn,
  useLiveMeshes,
  type JumpChip,
} from "./pricing-cards";
import { TYPE, WEIGHT } from "./type";

/* ------------------------------------------------------------------ *
 * #pricing's cards for online stores: the listed store plans and Store
 * Enterprise, the same pearl cards as the service plans (pricing-cards.tsx
 * lends the mesh, the fee, the perk list) on a rail of their own. Each
 * wears a service rung's light under its own id: the pick is the magenta
 * pearl with the badge and the magenta button, the others climb aqua to
 * lilac, Enterprise the champagne band.
 *
 * Every figure is the backend's (lib/pages/home/store-pricing.ts): the
 * fee, what it is a day, the allowance in minutes and in order calls, the
 * rate past it, and the plan's own feature list as checkout shows it.
 * Below lg a sideways rail with jump chips above it; from lg three
 * columns, Enterprise a band beneath.
 * ------------------------------------------------------------------ */

const P = HOME_PRICING;
const S = STORE_PRICING;

/** The lights the listed rungs wear, cheapest first; the pick wears Pro's magenta whatever its rung. */
const RUNG_LIGHTS: readonly PlanId[] = ["starter", "growth", "business", "scale"];
const PICK_LIGHT: PlanId = "pro";

export function storeLight(plan: StorePlan, rung: number): PlanId {
  return plan.featured ? PICK_LIGHT : RUNG_LIGHTS[Math.min(rung, RUNG_LIGHTS.length - 1)];
}

/** The store plans' chips for the jump row: the listed plans with their fees, then Enterprise. */
export function storeJumpChips(annual: boolean): JumpChip[] {
  return [
    ...STORE_LISTED.map((p, i) => ({
      id: p.id,
      name: p.name,
      price: wholeMoney(storeFee(p, annual)),
      light: storeLight(p, i),
    })),
    { id: STORE_ENTERPRISE.id, name: STORE_ENTERPRISE.name, light: "custom" },
  ];
}

/** A card on the store rail: a fixed width that snaps below lg, a grid cell from lg. */
const CARD = "home-plan home-plan-light home-plan-rise shrink-0 basis-[min(calc(100vw-72px),336px)] snap-center scroll-mt-28 lg:basis-auto";

const StoreCard = memo(function StoreCard({
  plan,
  rung,
  annual,
  changed,
}: {
  plan: StorePlan;
  rung: number;
  annual: boolean;
  changed: boolean;
}) {
  const pick = plan.featured;
  const light = storeLight(plan, rung);
  const year = storeYearly(plan);
  return (
    <li
      id={`plan-${plan.id}`}
      data-card={plan.id}
      data-plan={light}
      data-tone="light"
      data-pick={pick || undefined}
      data-i={rung}
      aria-labelledby={`plan-${plan.id}-name`}
      className={cn(CARD, pick && "xl:z-[1] xl:scale-[1.03]")}
    >
      <Mesh blobs={PLAN_BLOBS[light]} />
      <span aria-hidden className="home-grain" />
      {pick && <span aria-hidden className="home-plan-ring" />}

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
        {pick && (
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] leading-4 font-medium text-[#a21caf] shadow-[0_1px_2px_rgb(162_28_175/0.18)]">
            <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 fill-current">
              <path d="M5 0c.4 2.6 2.4 4.6 5 5-2.6.4-4.6 2.4-5 5-.4-2.6-2.4-4.6-5-5 2.6-.4 4.6-2.4 5-5Z" />
            </svg>
            {S.plan.pick}
          </span>
        )}
      </div>

      <div className="home-plan-price mt-4">
        <Fee fee={storeFee(plan, annual)} pick={pick} annual={annual} changed={changed} />
        <p className="mt-1 text-[15px] leading-[22px] font-medium text-(--plan-accent)">
          <RollIn key={annual ? "yearly" : "monthly"} animate={changed} className="block">
            {P.plan.perDay(money(storePerDay(plan, annual)))}
          </RollIn>
        </p>
        <p className="mt-0.5 grid text-[13px] leading-[18px] text-(--plan-dim)">
          <span aria-hidden={annual} className={cn("[grid-area:1/1]", annual && "invisible")}>
            {P.plan.onYearly(wholeMoney(storeFee(plan, true)))}
          </span>
          <span aria-hidden={!annual} className={cn("[grid-area:1/1]", !annual && "invisible")}>
            {P.plan.yearly(wholeMoney(year.total), wholeMoney(year.off))}
          </span>
        </p>
      </div>

      <div className="home-plan-allowance mt-5 border-t border-(--plan-rule) pt-4">
        <p className="text-[15px] leading-[22px] font-medium text-(--plan-text)">{S.plan.included(plan.minutes)}</p>
        <p className="text-[13px] leading-[18px] text-(--plan-dim)">{S.plan.calls(plan.minutes)}</p>
        <p className="text-[13px] leading-[18px] text-(--plan-dim)">{S.plan.then(perMinute(plan.overage))}</p>
      </div>

      <div className="home-plan-action mt-5">
        <PillLink
          href={plan.cta.href}
          variant="primary"
          className={cn("h-11 w-full justify-center", RING_LIGHT, pick && "home-plan-cta-pick")}
        >
          {plan.cta.label}
        </PillLink>
        <p className="mt-2 text-center text-[12px] leading-4 text-(--plan-dim)">{S.plan.trialMicro}</p>
      </div>

      <div className="mt-5 border-t border-(--plan-rule) pt-4">
        <PerkList head={S.plan.head} items={plan.features} />
      </div>
    </li>
  );
});

const StoreEnterpriseCard = memo(function StoreEnterpriseCard() {
  const e = STORE_ENTERPRISE;
  return (
    <li
      id={`plan-${e.id}`}
      data-card={e.id}
      data-plan="custom"
      data-tone="light"
      data-i={5}
      aria-labelledby={`plan-${e.id}-name`}
      className={cn(CARD, "home-plan-enterprise lg:col-span-3")}
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
          {S.enterprise.tagline(wholeMoney(e.monthly))}
        </p>
        <p className="mt-2 text-[14px] leading-5 text-(--plan-dim)">{S.enterprise.line(e.minutes)}</p>
      </div>
      <div className="home-plan-enterprise-perks">
        <PerkList head={S.plan.head} items={e.features} wide />
      </div>
      <div className="home-plan-enterprise-cta">
        <PillLink href={e.cta.href} variant="primary" className={cn("h-11 w-full justify-center", RING_LIGHT)}>
          {e.cta.label}
        </PillLink>
      </div>
    </li>
  );
});

export function StorePlanCards({
  annual,
  changed,
  railRef,
}: {
  annual: boolean;
  /** The reader has changed something: wording changes may animate from now on. */
  changed: boolean;
  railRef: RefObject<HTMLOListElement | null>;
}) {
  useLiveMeshes(railRef);
  return (
    <ol
      ref={railRef}
      aria-label={S.listLabel}
      className={cn(
        // Below lg: the sideways rail, run to the screen's edges, with the badge's room above and the shadow's below.
        "-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pt-6 pb-10 [scroll-padding-inline:16px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:-mx-6 sm:px-6 sm:[scroll-padding-inline:24px]",
        // From lg: three columns, Enterprise a band beneath.
        "lg:mx-0 lg:mt-10 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pt-6 lg:pb-0 lg:[scroll-snap-type:none]",
      )}
    >
      {STORE_LISTED.map((plan, i) => (
        <StoreCard key={plan.id} plan={plan} rung={i} annual={annual} changed={changed} />
      ))}
      <StoreEnterpriseCard />
    </ol>
  );
}

/**
 * In place of the estimator while the store plans show: what the three
 * calls do, numbered, and the platforms they work from. The service
 * estimator prices service plans only, so it is not shown for stores.
 */
export function StoreCalls() {
  return (
    <div className="home-pricing-panel home-rise mt-14 rounded-[28px] p-5 sm:p-7 lg:mt-16 lg:p-8 xl:p-10">
      <h3 className={cn(TYPE.h3, "text-pp-ink")} style={{ fontWeight: WEIGHT.h3 }}>
        {S.calls.title}
      </h3>
      <p className={cn(TYPE.body, "mt-3 max-w-[640px] text-pretty text-pp-ink/80")}>{S.calls.sub}</p>
      <ol className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
        {S.calls.items.map((item, n) => (
          <li
            key={item.title}
            className="flex flex-col gap-2 rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_24px_48px_-32px_rgb(36_16_79/0.35)]"
          >
            <span
              aria-hidden
              className="pp-display text-[13px] leading-[18px] tracking-[0.08em] text-(--home-violet) tabular-nums"
              style={{ fontWeight: WEIGHT.h3 }}
            >
              {String(n + 1).padStart(2, "0")}
            </span>
            <p className="text-[15px] leading-[22px] font-medium text-pp-ink">{item.title}</p>
            <p className="text-[13px] leading-[18px] text-pp-muted">{item.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[13px] leading-[18px] text-pp-muted">{S.calls.platforms}</p>
    </div>
  );
}

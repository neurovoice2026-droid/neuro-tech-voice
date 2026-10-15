"use client";

import { memo, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { PillLink } from "@/components/site/product/primitives";
import { storeLight } from "@/components/pricing/lights";
import {
  EnterpriseTierCard,
  PerkList,
  PlanTierCard,
  TIER_CARD,
  TierAllowance,
  TierPrice,
  useLiveMeshes,
} from "@/components/pricing/PlanTierCard";
import { perMinute, wholeMoney } from "@/lib/pages/home/pricing-math";
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
import type { JumpChip } from "./pricing-cards";
import { TYPE, WEIGHT } from "./type";

// Which service rung's light a store rung wears (components/pricing/lights.ts).
export { storeLight };

/* ------------------------------------------------------------------ *
 * #pricing's cards for online stores: the listed store plans and Store
 * Enterprise, the same pearl cards as the service plans
 * (components/pricing/PlanTierCard.tsx, which the app's store onboarding
 * and billing show too) on a rail of their own. Each wears a service
 * rung's light under its own id (components/pricing/lights.ts
 * `storeLight`): the pick is the magenta pearl with the badge and the
 * magenta button, the others climb aqua to lilac, Enterprise the
 * champagne band.
 *
 * Every figure is the backend's (lib/pages/home/store-pricing.ts): the
 * fee, what it is a day, the allowance in minutes and in order calls, the
 * price of prepaid extra minutes past it (without them calls pause), and
 * the plan's own feature list as checkout shows it.
 * Below lg a sideways rail with jump chips above it; from lg three
 * columns, Enterprise a band beneath.
 * ------------------------------------------------------------------ */

const S = STORE_PRICING;

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
const CARD = `${TIER_CARD} home-plan-rise shrink-0 basis-[min(calc(100vw-72px),336px)] snap-center scroll-mt-28 lg:basis-auto`;

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
    <PlanTierCard
      id={`plan-${plan.id}`}
      cardId={plan.id}
      light={light}
      pick={pick}
      i={rung}
      nameId={`plan-${plan.id}-name`}
      className={cn(CARD, pick && "xl:z-[1] xl:scale-[1.03]")}
      name={plan.name}
      badge={pick ? S.plan.pick : null}
      price={
        <TierPrice
          fee={storeFee(plan, annual)}
          perDay={storePerDay(plan, annual)}
          yearlyFee={storeFee(plan, true)}
          yearTotal={year.total}
          yearOff={year.off}
          pick={pick}
          annual={annual}
          changed={changed}
        />
      }
      allowance={
        <TierAllowance
          included={S.plan.included(plan.minutes)}
          notes={[S.plan.calls(plan.minutes), S.plan.then(perMinute(plan.overage))]}
        />
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
          <p className="mt-2 text-center text-[12px] leading-4 text-(--plan-dim)">{S.plan.trialMicro}</p>
        </>
      }
      perks={<PerkList head={S.plan.head} items={plan.features} />}
    />
  );
});

const StoreEnterpriseCard = memo(function StoreEnterpriseCard() {
  const e = STORE_ENTERPRISE;
  return (
    <EnterpriseTierCard
      id={`plan-${e.id}`}
      cardId={e.id}
      light="custom"
      i={5}
      nameId={`plan-${e.id}-name`}
      className={cn(CARD, "home-plan-enterprise lg:col-span-3")}
      name={e.name}
      tagline={S.enterprise.tagline(wholeMoney(e.monthly))}
      line={S.enterprise.line(e.minutes)}
      perks={<PerkList head={S.plan.head} items={e.features} wide />}
      action={
        <PillLink href={e.cta.href} variant="primary" className={cn("h-11 w-full justify-center", RING_LIGHT)}>
          {e.cta.label}
        </PillLink>
      }
    />
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

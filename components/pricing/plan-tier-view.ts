import { PLANS, type Plan } from "@/types";
import { DAYS_PER_MONTH } from "@/lib/site";
import { HOME_PRICING, perkText, type CardId } from "@/lib/pages/home/pricing";
import { HOME_PLANS, perMinute, wholeMoney } from "@/lib/pages/home/pricing-math";
import { STORE_FEATURED_ID, STORE_LISTED, STORE_PRICING } from "@/lib/pages/home/store-pricing";
import { storeLight, type TierLight } from "./lights";

/* ------------------------------------------------------------------ *
 * What the app's plan card for a plan says, read off PLANS (types/index.ts,
 * the table checkout charges from) in the homepage's own words
 * (lib/pages/home/pricing.ts for the service plans, store-pricing.ts for
 * the store plans), so a card in onboarding or billing reads exactly like
 * the same plan's card on the homepage: the fee, what it is a day and a
 * year, the allowance, the extra-minute rate, the badge and every perk.
 *
 * The free trial has no homepage card; its card says what the trial is
 * (TRIAL_TIER) in the same layout.
 * ------------------------------------------------------------------ */

const P = HOME_PRICING;
const S = STORE_PRICING;

const toCents = (usd: number) => Math.round(usd * 100) / 100;

/** The free trial's card, in words (PLANS.trial carries its minutes and features). */
export const TRIAL_TIER = {
  name: "Free trial",
  /** Beside the "$0" where a paid card says "/mo". */
  unit: "for 14 days",
  spoken: "Free for 14 days",
  /** Where a paid card says what it is a day. */
  line: "No card needed",
  /** Where a paid card says what it is on the other billing period. */
  note: "Set everything up before you pay",
  /** After the allowance: the trial cannot buy extra minutes. */
  then: "then calls pause until you choose a plan",
} as const;

/** A priced card's figures, as TierPrice prints them. */
export interface PlanTierFigures {
  /** The fee a month on the billing shown: the list price, or the year over twelve. */
  fee: number;
  /** That fee over the days of a month. */
  perDay: number;
  /** The fee a month on yearly billing. */
  yearlyFee: number;
  /** The year up front (PLANS price_annual), and what it takes off twelve monthly fees. */
  yearTotal: number;
  yearOff: number;
}

export type PlanTierKind = "trial" | "listed" | "enterprise";

export interface PlanTierView {
  plan: Plan;
  kind: PlanTierKind;
  name: string;
  light: TierLight;
  /** The family's recommendation: the magenta pearl, its badge and button. */
  pick: boolean;
  badge: string | null;
  /** Listed plans only. */
  figures: PlanTierFigures | null;
  /** The allowance line and the lines under it. */
  included: string;
  notes: string[];
  perks: { head: string; items: string[] };
  /** Sales-led plans only: the line where a fee would be, and the one under it. */
  enterprise: { tagline: string; line: string } | null;
}

/** A plan's fee figures from PLANS: monthly, or yearly (price_annual, ten months) spread over twelve. */
export function planTierFigures(plan: Plan, annual: boolean): PlanTierFigures {
  const cfg = PLANS[plan];
  const yearlyFee = toCents(cfg.price_annual / 12);
  const fee = annual ? yearlyFee : cfg.price_monthly;
  return {
    fee,
    perDay: toCents(fee / DAYS_PER_MONTH),
    yearlyFee,
    yearTotal: cfg.price_annual,
    yearOff: toCents(cfg.price_monthly * 12 - cfg.price_annual),
  };
}

/** The light a plan's card wears: its own rung's for a service plan, a rung's by place for a store plan. */
export function planTierLight(plan: Plan): TierLight {
  if (plan === "trial") return "trial";
  const cfg = PLANS[plan];
  if (cfg.contact_sales) return "custom";
  if (cfg.family === "ecommerce") {
    const rung = STORE_LISTED.findIndex((p) => p.id === plan);
    return storeLight({ featured: plan === STORE_FEATURED_ID }, Math.max(rung, 0));
  }
  return plan as TierLight;
}

/** Whether a plan is its family's recommendation (the homepage's "Our pick" / "Most popular"). */
export function isPickPlan(plan: Plan): boolean {
  if (PLANS[plan].family === "ecommerce") return plan === STORE_FEATURED_ID;
  return HOME_PLANS.some((p) => p.id === plan && p.featured);
}

/** The homepage's perk list for a service plan, if it has a card there. */
function servicePerks(plan: Plan, annual: boolean): { head: string; items: string[] } | null {
  if (!Object.hasOwn(P.perks, plan)) return null;
  const perks = P.perks[plan as CardId];
  return { head: perks.head, items: perks.items.map((perk) => perkText(perk, annual)) };
}

/** Everything the app's card for `plan` says, on monthly or yearly billing. */
export function planTierView(plan: Plan, annual: boolean): PlanTierView {
  const cfg = PLANS[plan];
  const store = cfg.family === "ecommerce";
  const pick = plan !== "trial" && isPickPlan(plan);
  const light = planTierLight(plan);
  const base = {
    plan,
    name: cfg.name,
    light,
    pick,
    badge: pick ? (store ? S.plan.pick : P.plan.pick) : null,
  };

  if (plan === "trial") {
    return {
      ...base,
      kind: "trial",
      name: TRIAL_TIER.name,
      figures: null,
      included: P.plan.included(cfg.minutes_limit),
      notes: [TRIAL_TIER.then],
      perks: { head: S.plan.head, items: [...cfg.features] },
      enterprise: null,
    };
  }

  const perks = (!store && servicePerks(plan, annual)) || { head: S.plan.head, items: [...cfg.features] };

  if (cfg.contact_sales) {
    return {
      ...base,
      kind: "enterprise",
      figures: null,
      included: P.plan.included(cfg.minutes_limit),
      notes: [],
      perks,
      // Enterprise publishes no fee (price 0); Store Enterprise starts from one.
      enterprise:
        cfg.price_monthly > 0
          ? { tagline: S.enterprise.tagline(wholeMoney(cfg.price_monthly)), line: S.enterprise.line(cfg.minutes_limit) }
          : { tagline: P.enterprise.tagline, line: P.enterprise.line },
    };
  }

  return {
    ...base,
    kind: "listed",
    figures: planTierFigures(plan, annual),
    included: (store ? S.plan.included : P.plan.included)(cfg.minutes_limit),
    notes: store
      ? [S.plan.calls(cfg.minutes_limit), S.plan.then(perMinute(cfg.overage_per_min))]
      : [P.plan.then(perMinute(cfg.overage_per_min))],
    perks,
    enterprise: null,
  };
}

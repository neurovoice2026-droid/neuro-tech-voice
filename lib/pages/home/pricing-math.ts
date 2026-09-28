import {
  AVG_CALL_MIN,
  DAYS_PER_MONTH,
  ENTERPRISE,
  PRICING_MAX_CALLS_DAY,
  PRICING_PRESETS,
  TIERS,
  costFor,
  feeFor,
  type Tier,
} from "@/lib/site";

/* ------------------------------------------------------------------ *
 * The estimator's arithmetic: the price list, the bill for a number of
 * calls a day, and how money prints. Client-safe and copy-free: it reads
 * only the price list and the pricing constants, so the pricing islands
 * can import it without pulling any section's words into their chunk.
 * ------------------------------------------------------------------ */

export type PlanId = Tier["id"];

export type HomePlan = {
  id: PlanId;
  name: string;
  monthly: number;
  minutes: number;
  overage: number;
  /** Our recommendation ("Our pick"). */
  featured: boolean;
  cta: { label: string; href: string };
};

/** The listed rungs the section renders, ascending. Enterprise is not one (HOME_ENTERPRISE). */
export const HOME_PLANS: readonly HomePlan[] = TIERS.map((t) => ({
  id: t.id,
  name: t.name,
  monthly: t.monthly,
  minutes: t.minutes,
  overage: t.overage,
  featured: t.featured === true,
  cta: { label: t.cta, href: t.href },
}));

/** The rung above the list: a name and a way to talk to us, and no numbers at all. */
export const HOME_ENTERPRISE = {
  id: ENTERPRISE.id,
  name: ENTERPRISE.name,
  cta: { label: ENTERPRISE.cta, href: ENTERPRISE.href },
} as const;

export const CALLS_MIN = 1;
export const CALLS_MAX = PRICING_MAX_CALLS_DAY;
export const CALLS_DEFAULT = PRICING_PRESETS[0].callsDay;

export type Estimate = {
  callsDay: number;
  minutes: number;
  plan: HomePlan;
  /** Plan fee for the month, rounded to the cent. */
  fee: number;
  overMinutes: number;
  overCost: number;
  /** `fee + overCost`, so the receipt adds up to the figure it prints. */
  total: number;
};

const TIER_BY_ID = new Map<string, Tier>(TIERS.map((t) => [t.id, t]));

const toCents = (usd: number) => Math.round(usd * 100) / 100;

/**
 * A plan's fee for one month, rounded to the cent: the list price, or
 * the yearly price spread over twelve. The same `feeFor` the product
 * pages use, on the plan's own tier.
 */
export function planFee(plan: HomePlan, annual: boolean): number {
  const tier = TIER_BY_ID.get(plan.id);
  if (!tier) throw new Error(`pricing-math: no tier "${plan.id}" in the price list`);
  return toCents(feeFor(tier, annual));
}

/**
 * The bill for a number of calls a day: the listed plan that costs least
 * at that volume, by the same `costFor` the product pages use.
 */
export function estimate(callsDay: number, annual: boolean): Estimate {
  const calls = Number.isFinite(callsDay)
    ? Math.min(CALLS_MAX, Math.max(CALLS_MIN, Math.round(callsDay)))
    : CALLS_DEFAULT;
  const minutes = calls * AVG_CALL_MIN * DAYS_PER_MONTH;

  let tier = TIERS[0];
  let best = costFor(tier, minutes, annual);
  for (const t of TIERS.slice(1)) {
    const cost = costFor(t, minutes, annual);
    // Strictly cheaper by more than float noise; a tie keeps the smaller rung.
    if (cost < best - 1e-9) {
      tier = t;
      best = cost;
    }
  }

  const plan = HOME_PLANS.find((p) => p.id === tier.id)!;
  const fee = planFee(plan, annual);
  const overMinutes = Math.max(0, minutes - tier.minutes);
  const overCost = toCents(overMinutes * tier.overage);
  return { callsDay: calls, minutes, plan, fee, overMinutes, overCost, total: toCents(fee + overCost) };
}

/** Which plan fits at each volume, as contiguous runs of calls a day from CALLS_MIN to CALLS_MAX. */
export function planBands(annual: boolean): { id: PlanId; from: number; to: number }[] {
  const bands: { id: PlanId; from: number; to: number }[] = [];
  for (let c = CALLS_MIN; c <= CALLS_MAX; c++) {
    const id = estimate(c, annual).plan.id;
    const last = bands.at(-1);
    if (last && last.id === id) last.to = c;
    else bands.push({ id, from: c, to: c });
  }
  return bands;
}

/** A plan's fee spread over the days of a month: "$8.30 a day". */
export const perDay = (p: HomePlan, annual: boolean) => toCents(planFee(p, annual) / DAYS_PER_MONTH);

/** What a year costs up front on yearly billing, and what it takes off twelve monthly fees. */
export const yearlyOf = (p: HomePlan) => {
  // From the unrounded yearly fee, so Starter's year is $490 rather than 12 × $40.83.
  const total = toCents(feeFor(TIER_BY_ID.get(p.id)!, true) * 12);
  return { total, off: toCents(p.monthly * 12 - total) };
};

/** The estimate restated: per day of the month, and per call. */
export const perCallOf = (e: Estimate) => ({
  day: toCents(e.total / DAYS_PER_MONTH),
  call: e.total / (e.callsDay * DAYS_PER_MONTH),
});

/** How many calls a day Scale's allowance covers at the section's four minutes a call: 125. */
export const SCALE_COVERS = Math.floor(TIERS[TIERS.length - 1].minutes / (AVG_CALL_MIN * DAYS_PER_MONTH));

// en-US everywhere, so the server and the browser print the same string.
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const COUNT = new Intl.NumberFormat("en-US");

/** 108.75 → "$108.75" */
export const money = (n: number) => USD.format(n);
/** 2490 → "$2,490", 207.5 → "$207.50" */
export const wholeMoney = (n: number) => money(n).replace(/\.00$/, "");
/** A small sum to the cent, always in dollars: 0.42 → "$0.42", 1.63 → "$1.63". */
export const smallMoney = (usd: number) => money(toCents(usd));
/** A rate a minute, in dollars as the owner writes it: 0.2 → "$0.20". */
export const perMinute = (usd: number) => `$${usd.toFixed(2)}`;
/** The next whole cent above a rate, in dollars: 0.066 → "$0.07", so "under $0.07" is true. */
export const underCent = (usd: number) => perMinute((Math.floor(usd * 100 + 1e-9) + 1) / 100);
/** 1800 → "1,800" */
export const minutesFmt = (n: number) => COUNT.format(n);

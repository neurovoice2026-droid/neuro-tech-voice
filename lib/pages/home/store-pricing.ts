import { PLANS, STORE_PLANS, type Plan } from "@/types";
import { AUTH, DAYS_PER_MONTH } from "@/lib/site";
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from "@/lib/phone/pricing";
import { STORE_INTENT } from "@/lib/auth/business-intent";
import { minutesFmt, money, perMinute, wholeMoney } from "./pricing-math";

/* ------------------------------------------------------------------ *
 * #pricing for online stores: the store plans and their words.
 *
 * The numbers are read straight off the backend's plan table
 * (types/index.ts PLANS, the STORE_PLANS family), the same table checkout
 * charges from, so a fee, an allowance or a rate on a store card can
 * never drift from what the owner is billed. There is no second price
 * list for stores and no estimator: a store's calls are short outbound
 * confirmations, and the card says in orders what the allowance is.
 * ------------------------------------------------------------------ */

/** Where a store plan's "Start free" goes: the register page, told what the visitor came for. */
export const STORE_SIGNUP_HREF = `${AUTH.signup}?intent=${STORE_INTENT}`;

/**
 * Minutes an order call takes, on average: a confirmation reads the
 * order back, takes a yes or a change, and rings off. The plan table's
 * own "~230 order confirmations" for 350 minutes is this figure.
 */
export const STORE_AVG_CALL_MIN = 1.5;

/** The card that carries "Most popular": the middle rung, which most stores land on. */
export const STORE_FEATURED_ID: Plan = "store_growth";

export type StorePlan = {
  id: Plan;
  name: string;
  /** Plan fee per month, USD, billed monthly. */
  monthly: number;
  /** The year up front on yearly billing (the table's price_annual: ten months). */
  annual: number;
  /** Minutes included in the fee. */
  minutes: number;
  /** USD per minute once the allowance is gone. */
  overage: number;
  /** What the plan has, as the backend lists it. */
  features: readonly string[];
  /** Shown as "Most popular". */
  featured: boolean;
  /** Priced with sales: no checkout, a conversation. */
  contactSales: boolean;
  cta: { label: string; href: string };
};

const toCents = (usd: number) => Math.round(usd * 100) / 100;

function storePlanOf(id: Plan): StorePlan {
  const cfg = PLANS[id];
  const contactSales = cfg.contact_sales === true;
  return {
    id,
    name: cfg.name,
    monthly: cfg.price_monthly,
    annual: cfg.price_annual,
    minutes: cfg.minutes_limit,
    overage: cfg.overage_per_min,
    features: cfg.features,
    featured: id === STORE_FEATURED_ID,
    contactSales,
    cta: contactSales
      ? { label: "Talk to us", href: AUTH.contactSales }
      : { label: "Start free", href: STORE_SIGNUP_HREF },
  };
}

/** Every store plan, cheapest first, as the backend orders them. */
export const STORE_HOME_PLANS: readonly StorePlan[] = STORE_PLANS.map(storePlanOf);

/** The store plans with a fee on their card. */
export const STORE_LISTED: readonly StorePlan[] = STORE_HOME_PLANS.filter((p) => !p.contactSales);

const enterprise = STORE_HOME_PLANS.find((p) => p.contactSales);
if (STORE_LISTED.length === 0 || !enterprise) {
  throw new Error("lib/pages/home/store-pricing.ts: the store plans need a listed plan and one priced with sales");
}

/** The rung above the listed store plans: a starting fee and a conversation. */
export const STORE_ENTERPRISE: StorePlan = enterprise;

/** The cheapest store fee: what "plans from" means. */
export const STORE_FROM = Math.min(...STORE_LISTED.map((p) => p.monthly));

/** A store plan's fee for one month: the list price, or the year spread over twelve. */
export const storeFee = (p: StorePlan, annual: boolean) => (annual ? toCents(p.annual / 12) : p.monthly);

/** The fee spread over the days of a month: "$3.33 a day". */
export const storePerDay = (p: StorePlan, annual: boolean) => toCents(storeFee(p, annual) / DAYS_PER_MONTH);

/** What a year costs up front, and what it takes off twelve monthly fees. */
export const storeYearly = (p: StorePlan) => ({ total: p.annual, off: toCents(p.monthly * 12 - p.annual) });

/**
 * How many order calls an allowance covers, to two figures: 350 minutes
 * is "about 230", 2,000 "about 1,300", so the card and the plan table's
 * own bullet say the same number.
 */
export function approxCalls(minutes: number): number {
  const raw = minutes / STORE_AVG_CALL_MIN;
  if (raw < 10) return Math.round(raw);
  const unit = 10 ** (Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / unit) * unit;
}

const first = STORE_LISTED[0];
const last = STORE_LISTED[STORE_LISTED.length - 1];

export const STORE_PRICING = {
  /** The heading's sub while the store plans are showing. */
  sub: `Plans for online stores start at ${wholeMoney(STORE_FROM)} a month. You buy minutes, and the agent spends them confirming cash-on-delivery orders, recovering abandoned carts and following up on deliveries — with the live order in front of it, and one agent on every plan.`,
  audience: { label: "Plans for" },
  listLabel: "Store plans",
  plan: {
    pick: "Most popular",
    head: "What's included",
    included: (minutes: number) => `${minutesFmt(minutes)} min included`,
    calls: (minutes: number) => `about ${minutesFmt(approxCalls(minutes))} order calls a month`,
    then: (rate: string) => `then ${rate} a minute`,
    trialMicro: "5 free minutes, no card",
  },
  enterprise: {
    tagline: (fee: string) => `From ${fee} a month`,
    line: (minutes: number) => `${minutesFmt(minutes)} minutes and up, your own scripts and an SLA, priced with you.`,
  },
  calls: {
    title: "What the calls do",
    sub: "Three calls a store makes all day, made for you from the orders as they come in. Each one looks the order up first, so it never asks what the customer already told you, and every answer lands in your dashboard.",
    items: [
      // The three titles are the automations' names in the dashboard
      // (components/commerce/labels.ts AUTOMATION_TYPE_LABEL), so what a
      // visitor reads here is what the owner later turns on.
      {
        title: "COD confirmation",
        body: "A new COD order gets a call before it ships: the items, the address and the total read back, and whether the customer confirmed, wants a change or canceled recorded for you.",
      },
      {
        title: "Abandoned cart",
        body: "A cart left behind with a phone number gets one call, the items named and a way to finish. A customer who asks not to be called is never called again.",
      },
      {
        title: "Order follow-up",
        body: "Once an order reaches the status you choose, a short call checks the parcel arrived and how it went; a complaint or a call-back request is flagged for you.",
      },
    ],
    platforms: "Works with WooCommerce, Shopify, Magento and PrestaShop out of the box, or with your own API.",
  },
  facts: [
    {
      title: "It keeps calling past your minutes",
      body: `On a paid plan, at your plan's own rate: ${perMinute(first.overage)} a minute on ${first.name}, down to ${perMinute(last.overage)} on ${last.name}.`,
    },
    {
      title: "Change plan or cancel whenever",
      body: "From your billing settings; a canceled plan runs to the end of the period you paid for.",
    },
    { title: "No setup fee", body: "On any plan. A custom integration is quoted on its own." },
    {
      title: "Your number at carrier cost",
      body: `${money(PHONE_NUMBER_MONTHLY_PRICE_USD)} a month, with nothing on top.`,
    },
  ],
  /** After the VAT sentence, in place of the service plans' "cheapest for" footnote. */
  footnote: `An order call runs about a minute and a half, so a plan's "order calls" is its minutes over that; a day is the plan fee over thirty.`,
  trial: {
    body: "Set it up, connect your store and ring it yourself — test calls run on the real agent and never touch the five minutes. What the free fortnight cannot give you is a line: a number is bought separately, so until you buy one it answers you and nobody else.",
  },
  note: "Prices are in US dollars and exclude VAT. Minutes are rounded up on each call, so ninety seconds costs two. Everything else is the plan fee plus that plan's own rate for the minutes past its allowance, which is the arithmetic that lands on the invoice rather than a headline rate. Annual billing takes two months off the fee; the per-minute rate does not move.",
} as const;

import { entitlementsFor, type Entitlements } from "@/lib/billing/entitlements";
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from "@/lib/phone/pricing";
import {
  ENTERPRISE,
  FAQ,
  PRICING_INTRO,
  PRICING_MAX_CALLS_DAY,
  PRICING_NOTE,
  PRICING_PRESETS,
  PRICING_TRIAL,
  TIERS,
} from "@/lib/site";
import { SCALE_COVERS, minutesFmt, money, perMinute, underCent, type PlanId } from "./pricing-math";
import { sentences } from "./source";

/* ─── #pricing: the bill ─────────────────────────────────────────── *
 * The words only; the arithmetic is pricing-math.ts. Both are read only
 * from lib/site, which the header already ships to every page, plus the
 * backend's own plan entitlements, so a perk on a card is the gate the
 * product enforces.
 */

/** The listed plans and Enterprise, as the cards order them. */
export type CardId = PlanId | typeof ENTERPRISE.id;

/** Where a perk's promise comes from. home.test.ts holds each kind to its source. */
export type PerkSource =
  /** A backend entitlement that turns on at this card's plan and not before. */
  | { kind: "entitlement"; key: keyof Entitlements }
  /** Arithmetic on the price list. */
  | { kind: "arithmetic" }
  /** True on every plan, and said so elsewhere on the page. */
  | { kind: "every-plan"; where: string }
  /** What the plan is, by definition. */
  | { kind: "definition" }
  /** A service promise only the owner can keep. Listed in the owner's notes. */
  | { kind: "owner"; note: string };

export type Perk = { text: string | ((annual: boolean) => string); source: PerkSource };

export const perkText = (p: Perk, annual: boolean) => (typeof p.text === "function" ? p.text(annual) : p.text);

const byId = (id: PlanId) => TIERS.find((t) => t.id === id)!;
const ent = (key: keyof Entitlements): PerkSource => ({ kind: "entitlement", key });
const times = (a: number, b: number) => `${Number((a / b).toFixed(1))}×`;
const lab = (plan: "pro" | "business" | "custom") => entitlementsFor(plan).ttsCharactersPerMonth;
/** What a minute costs inside a plan when every included minute is used, as "under $0.07". */
const fullUse = (id: PlanId) => (annual: boolean) => {
  const t = byId(id);
  const fee = annual ? (t.monthly * 10) / 12 : t.monthly;
  return `Under ${underCent(fee / t.minutes)} a minute when all ${minutesFmt(t.minutes)} are used`;
};

/**
 * OWNER, 23 Sep 2026: Pro includes "24/7 priority support from a real
 * person". The phone today keeps Romanian business hours and there is no
 * support address (COMPANY.email is ""), so this holds only once somebody
 * answers after hours. Set false to print "Priority support from a real
 * person" instead.
 */
export const SUPPORT_247 = true;

const PERKS: Record<CardId, { head: string; items: Perk[] }> = {
  starter: {
    head: "What every paid plan has",
    items: [
      { text: "Answers from your own documents", source: { kind: "every-plan", where: "#knowledge" } },
      {
        text: "Transcripts of your calls, kept",
        source: { kind: "every-plan", where: "FAQ: transcripts are kept on every plan" },
      },
      { text: "Confirmation texts to your callers", source: ent("smsConfirmations") },
      { text: "Outbound calls you start from the dashboard", source: ent("outboundCalls") },
      { text: "Keeps answering past the included minutes", source: ent("overageAllowed") },
    ],
  },
  growth: {
    head: "Everything in Starter, plus",
    items: [
      {
        text: `${times(byId("growth").minutes, byId("starter").minutes)} Starter's minutes`,
        source: { kind: "arithmetic" },
      },
      { text: fullUse("growth"), source: { kind: "arithmetic" } },
    ],
  },
  pro: {
    head: "Everything in Growth, plus",
    items: [
      { text: "Call recordings", source: ent("recordings") },
      { text: "Google Workspace, in beta: Gmail, Sheets, Calendar and Docs", source: ent("googleIntegrations") },
      { text: "30-day call analytics", source: ent("advancedAnalytics") },
      { text: "Clone your own voice", source: ent("voiceCloning") },
      {
        text: "Custom integrations, set up by our team",
        source: {
          kind: "owner",
          note: "Given by the owner. Scope to confirm against the custom-build page's 'quoted separately'.",
        },
      },
      {
        text: SUPPORT_247 ? "24/7 priority support from a real person" : "Priority support from a real person",
        source: { kind: "owner", note: "Given by the owner. Needs an after-hours channel before launch." },
      },
    ],
  },
  business: {
    head: "Everything in Pro, plus",
    items: [
      { text: "90-day call analytics", source: ent("fullAnalytics") },
      { text: `${times(lab("business"), lab("pro"))} Pro's voice-lab allowance`, source: ent("ttsCharactersPerMonth") },
      {
        text: `${entitlementsFor("business").testCallsPerDay} test calls a day, up from ${entitlementsFor("pro").testCallsPerDay}`,
        source: ent("testCallsPerDay"),
      },
      {
        text: "A setup call with our team to get your agent live",
        source: {
          kind: "owner",
          note: "Chosen for the owner, who asked us to pick Business's extras. Owner to confirm.",
        },
      },
      {
        text: "A monthly review of your calls with our team",
        source: {
          kind: "owner",
          note: "Chosen for the owner, who asked us to pick Business's extras. Owner to confirm.",
        },
      },
    ],
  },
  scale: {
    head: "Everything in Business, plus",
    items: [
      {
        text: `${times(byId("scale").minutes, byId("business").minutes)} Business's minutes`,
        source: { kind: "arithmetic" },
      },
      { text: fullUse("scale"), source: { kind: "arithmetic" } },
      {
        text: "Priority onboarding",
        source: { kind: "owner", note: "Existing copy from the old price list. Owner to confirm." },
      },
    ],
  },
  custom: {
    head: `Everything in ${byId("scale").name}, plus`,
    items: [
      { text: "Minutes and a rate set with you", source: { kind: "definition" } },
      { text: "The largest voice-lab allowance", source: ent("ttsCharactersPerMonth") },
      { text: `${entitlementsFor("custom").testCallsPerDay} test calls a day`, source: ent("testCallsPerDay") },
      ...ENTERPRISE.unlocks.map((text): Perk => ({
        text,
        source: { kind: "owner", note: "Already on the product pages. Owner to confirm." },
      })),
    ],
  },
};

if (!TIERS.every((t) => t.overage === TIERS[0].overage)) {
  throw new Error(
    "lib/pages/home/pricing.ts: the facts row says one overage rate for every plan; the price list has several",
  );
}

const faqWhere = FAQ.find((f) => f.where?.href === "#your-bill")?.where?.label;
if (!faqWhere) throw new Error("lib/pages/home/pricing.ts: the FAQ no longer links to #your-bill");

export const HOME_PRICING = {
  eyebrow: PRICING_INTRO.eyebrow,
  title: PRICING_INTRO.title,
  key: "the bill does itself.",
  // NEW, from site.ts PRICING_INTRO.sub. "No per-agent fee" alone reads as
  // "run as many agents as you like"; a business gets exactly one, on every plan.
  sub: "You buy minutes. There is no seat to add, and one agent comes with every plan.",
  annualNote: PRICING_INTRO.annualNote,
  billing: { monthly: "Monthly", yearly: "Yearly", billedYearly: "billed yearly" }, // NEW
  // NEW, apart from the presets and the title
  estimator: {
    title: faqWhere, // "Work out the bill"
    label: "Calls on a normal day",
    fewer: "One fewer call a day",
    more: "One more call a day",
    presets: PRICING_PRESETS,
    perDayUnit: "a day",
    total: "Our estimate, a month",
    // Read by the credits too (credits.ts): do not reword without them.
    assumptions: "Assumes about four minutes a call, every day of the month.",
    numberNote: `Your number, ${money(PHONE_NUMBER_MONTHLY_PRICE_USD)} a month, is billed on its own.`,
    reframe: (day: string, call: string) => `That's ${day} a day, about ${call} a call.`,
    lowest: "Lowest bill:",
    see: "See the plan",
    band: (name: string, from: number, to: number, first: boolean, last: boolean) =>
      first
        ? `${name} is the cheapest up to ${to} calls a day.`
        : last
          ? `${name} is the cheapest from ${from} calls a day.`
          : `${name} is the cheapest from ${from} to ${to} calls a day.`,
    beyond: {
      pre: `More than ${PRICING_MAX_CALLS_DAY} calls a day? ${byId("scale").name}'s ${minutesFmt(byId("scale").minutes)} minutes cover about ${SCALE_COVERS} a day; past that, `,
      link: `talk to us about ${ENTERPRISE.name}`,
      post: ".",
    },
  },
  // NEW
  plan: {
    perMonth: "/mo",
    aMonth: " a month",
    aMonthYearly: " a month, billed yearly",
    included: (n: number) => `${minutesFmt(n)} min included`,
    then: (c: string) => `then ${c} a minute`,
    perDay: (d: string) => `${d} a day`,
    onYearly: (m: string) => `or ${m}/mo billed yearly`,
    yearly: (total: string, off: string) => `${total} a year, ${off} off`,
    cheapest: (from: number, to: number, first: boolean, last: boolean) =>
      first
        ? `Cheapest up to ${to} calls a day`
        : last
          ? `Cheapest from ${from} calls a day`
          : `Cheapest for ${from}–${to} calls a day`,
    fits: "Lowest bill for your estimate",
    fitTab: (n: number) => `Lowest bill at ${n} ${n === 1 ? "call" : "calls"} a day`,
    pick: "Our pick",
    trialMicro: "5 free minutes, no card",
  },
  perks: PERKS,
  enterprise: {
    tagline: "Priced with you",
    line: `For call volumes past ${byId("scale").name}, or terms of your own.`,
  },
  // NEW, after the VAT sentence
  footnote:
    "“Cheapest for” compares our plans at about four minutes a call, every day of the month; a day is the plan fee over thirty.",
  facts: [
    {
      title: "It keeps answering past your minutes",
      body: `On a paid plan, at ${perMinute(TIERS[0].overage)} a minute past the allowance.`,
    },
    {
      title: "Change plan or cancel whenever",
      body: "From your billing settings; a cancelled plan runs to the end of the period you paid for.",
    },
    { title: "No setup fee", body: "On any plan. A custom build is quoted on its own." },
    {
      title: "Your number at carrier cost",
      body: `${money(PHONE_NUMBER_MONTHLY_PRICE_USD)} a month, with nothing on top.`,
    },
  ],
  jump: {
    label: "Jump to a plan",
    name: (plan: string, price?: string) => (price ? `Show ${plan}, ${price} a month` : `Show ${plan}`),
  },
  vat: sentences(PRICING_NOTE, 0),
  trial: PRICING_TRIAL,
  note: { summary: "How the bill is worked out", body: PRICING_NOTE }, // summary NEW
} as const;

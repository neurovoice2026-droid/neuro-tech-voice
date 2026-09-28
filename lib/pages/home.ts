import { HOME_AFTER } from "@/lib/pages/home/after";
import { HOME_CALL } from "@/lib/pages/home/call";
import { HOME_FAQ } from "@/lib/pages/home/faq";
import { HOME_KB } from "@/lib/pages/home/kb";
import { HOME_PRICING } from "@/lib/pages/home/pricing";
import { HOME_START } from "@/lib/pages/home/start";
import { HOME_TRADES } from "@/lib/pages/home/trades";
import { HOME_TRUST } from "@/lib/pages/home/trust";
import { HOME_VOICE } from "@/lib/pages/home/voice";

/* ------------------------------------------------------------------ *
 * The homepage body — every word on it, and the arithmetic of the bill.
 *
 * The words live one module per section under lib/pages/home/, and the
 * arithmetic in lib/pages/home/pricing-math.ts. A client island imports
 * its own section's module (`HOME_CALL` from "@/lib/pages/home/call"),
 * never this file: `HOME` is one object literal over every section, so
 * importing it pulls every section's sources (the product, integrations
 * and knowledge-base pages' copy) into the island's chunk, and no bundler
 * can split an object literal. This file stays for server code and the
 * tests, which want the whole page at once.
 *
 * Strings are imported from the page that already says them wherever
 * that is possible, so the landing cannot drift from the product pages.
 * A literal appears only where the source is not importable, or is kept
 * out of a client chunk on purpose (`// src:`, held to its source by
 * home.test.ts), or the words are new to this page (`// NEW`).
 *
 * The pieces that need the voice library, the prompt templates or the
 * server-only custom build copy are built in `home.server.ts` and handed
 * down as props.
 * ------------------------------------------------------------------ */

export type { HomeTitle } from "@/lib/pages/home/source";
export type { HomeRegister } from "@/lib/pages/home/voice";
export { KB_THRESHOLD } from "@/lib/pages/home/kb";
export { HOME_CREDITS } from "@/lib/pages/home/credits";
export { GOOGLE_PLAN, SMS_PLAN } from "@/lib/pages/home/gates";
export {
  CALLS_DEFAULT,
  CALLS_MAX,
  CALLS_MIN,
  HOME_ENTERPRISE,
  HOME_PLANS,
  SCALE_COVERS,
  estimate,
  minutesFmt,
  money,
  perCallOf,
  perDay,
  perMinute,
  planBands,
  planFee,
  smallMoney,
  underCent,
  wholeMoney,
  yearlyOf,
  type Estimate,
  type HomePlan,
  type PlanId,
} from "@/lib/pages/home/pricing-math";
export { HOME_AFTER, HOME_CALL, HOME_FAQ, HOME_KB, HOME_PRICING, HOME_START, HOME_TRADES, HOME_TRUST, HOME_VOICE };

export const HOME = {
  call: HOME_CALL,
  trades: HOME_TRADES,
  voice: HOME_VOICE,
  kb: HOME_KB,
  after: HOME_AFTER,
  pricing: HOME_PRICING,
  trust: HOME_TRUST,
  faq: HOME_FAQ,
  start: HOME_START,
} as const;

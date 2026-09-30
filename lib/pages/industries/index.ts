/* ------------------------------------------------------------------ *
 * The trades that have a page.
 *
 * Deliberately not all sixteen at once. NAV_INDUSTRIES lists sixteen and
 * every one of them links here; a slug that is not in this registry is a
 * 404 rather than a thin page, because a thin page is worse than no page
 * and because `dynamicParams = false` keeps these routes prerendered,
 * which is what lets classifyPath() serve them under the static CSP.
 *
 * As a trade's data lands, it is added here and its menu link comes
 * alive. Nothing else has to change.
 * ------------------------------------------------------------------ */

import { NAV_INDUSTRIES } from "@/lib/site";
import type { Trade } from "./schema";
import { homeServices } from "./home-services";
import { realEstate } from "./real-estate";
import { restaurants } from "./restaurants";
import { lawFirms } from "./law-firms";
import { automotive } from "./automotive";
import { logistics } from "./logistics";
import { salonsSpas } from "./salons-spas";
import { veterinary } from "./veterinary";
import { insurance } from "./insurance";
import { propertyManagement } from "./property-management";
import { hospitality } from "./hospitality";
import { financialServices } from "./financial-services";
import { retail } from "./retail";
import { education } from "./education";
import { fitness } from "./fitness";
import { clinicsDental } from "./clinics-dental";

/** Menu order, so the index reads the way the mega menu does. */
const TRADES: Trade[] = [
  homeServices,
  realEstate,
  restaurants,
  lawFirms,
  automotive,
  logistics,
  salonsSpas,
  veterinary,
  insurance,
  propertyManagement,
  hospitality,
  financialServices,
  retail,
  education,
  fitness,
  clinicsDental,
];

export const INDUSTRY_PAGES: ReadonlyMap<string, Trade> = new Map(TRADES.map((t) => [t.slug, t]));

export const INDUSTRY_SLUGS: readonly string[] = TRADES.map((t) => t.slug);

export function tradeFor(slug: string): Trade | undefined {
  return INDUSTRY_PAGES.get(slug);
}

/** True when the menu links to a trade we have not written yet. */
export function hasPage(slug: string): boolean {
  return INDUSTRY_PAGES.has(slug);
}

/**
 * Throws at import time if a trade's slug or label drifts from the menu,
 * the way `fromUseCase` already does for NAV_INDUSTRIES itself, and if a
 * trade in the menu has no page at all. A page whose heading disagrees
 * with the link that reached it, or a menu entry that leads nowhere, is
 * a bug nobody notices in review.
 */
for (const trade of TRADES) {
  const entry = NAV_INDUSTRIES.find((i) => i.slug === trade.slug);
  if (!entry) {
    throw new Error(`Industry page "${trade.slug}" is not in NAV_INDUSTRIES`);
  }
  if (entry.label !== trade.label) {
    throw new Error(`Industry page "${trade.slug}" is labelled "${trade.label}" but the menu says "${entry.label}"`);
  }
}

for (const entry of NAV_INDUSTRIES) {
  if (!INDUSTRY_PAGES.has(entry.slug)) {
    throw new Error(`The menu links to /industries/${entry.slug} but no trade file is registered`);
  }
}

export type { Trade } from "./schema";

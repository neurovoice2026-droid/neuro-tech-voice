import { AGENTS_HERO } from "@/lib/pages/ai-agents";
import { COMPANY, FAQ, FAQ_INTRO } from "@/lib/site";

/* ─── #faq ───────────────────────────────────────────────────────── *
 * The only heading whose phrase stays quiet: five doubts are not a
 * payoff, so the phrase is set in muted rather than in colour.
 */

export const HOME_FAQ = {
  eyebrow: FAQ_INTRO.eyebrow,
  title: FAQ_INTRO.title,
  key: "in the order they arrive.",
  keyTone: "quiet",
  items: FAQ,
  talk: AGENTS_HERO.secondary,
  phone: COMPANY.phone,
} as const;

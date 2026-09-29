import { LANG_COUNT, TRUST as AGENTS_TRUST } from "@/lib/pages/ai-agents";
import { COMPANY, TRUST } from "@/lib/site";
import { sentences } from "./source";

/* ─── #trust ─────────────────────────────────────────────────────── */

/**
 * Which sentences of each note the landing shows, [from, to). The rest
 * of a note either repeats the FAQ or carries a claim nobody has checked
 * (the languages note's "rather than machine-translated"). The EU note
 * keeps its first two: the first says we never copy the recordings into
 * eu-west-1, the second is the card's hedge (the FAQ names who keeps
 * them, and where). Its third, on deleting, the FAQ already says.
 */
const TRUST_EXCERPT: Record<(typeof TRUST.items)[number]["id"], [number, number]> = {
  eu: [0, 2],
  handover: [0, 2],
  languages: [0, 1],
  company: [1, 3],
};

export const HOME_TRUST = {
  eyebrow: TRUST.kicker,
  title: "Four things you can check yourself.", // src: components/site/trust.tsx:130
  key: "check yourself.",
  items: TRUST.items.map((item) => ({
    id: item.id,
    label: item.label,
    note: sentences(item.note, ...TRUST_EXCERPT[item.id]),
  })),
  /** One per item, in the same order. */
  datums: [
    "eu-west-1", // src: lib/site.ts:2580
    "3 ways in", // NEW, from "Three ways in" (site.ts:2653)
    `${LANG_COUNT} languages`,
    COMPANY.cui,
  ],
  checklist: AGENTS_TRUST.items,
  cta: AGENTS_TRUST.cta,
} as const;

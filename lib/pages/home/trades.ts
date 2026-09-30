import { INDUSTRIES_GATEWAY } from "@/lib/site";

/* ─── #use-cases: your trade ─────────────────────────────────────── *
 * The rows themselves (sixteen trades and the custom build) are built on
 * the server from the industry pages and the prompt templates
 * (home.server.ts buildHomeTrades).
 */

export const HOME_TRADES = {
  eyebrow: INDUSTRIES_GATEWAY.kicker,
  title: INDUSTRIES_GATEWAY.title,
  key: "different in every one.",
  // NEW, trimmed from site.ts:2601
  sub: "What it asks first, how it asks it and what it does with the answer are not the same for a law firm as for a dental clinic.",
  all: { label: INDUSTRIES_GATEWAY.all, href: INDUSTRIES_GATEWAY.href },
  group: "Pick a trade", // NEW
  // NEW
  cells: {
    caller: "A caller, in this trade",
    does: "What it does",
    boundary: "From the instructions it starts with",
  },
  sample: "Sample", // NEW
  pageLink: (label: string) => `Read the ${label} page`, // NEW
} as const;

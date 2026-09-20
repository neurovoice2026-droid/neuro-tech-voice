"use client";

import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ *
 * What the reader actually operated, on /solutions/custom-ai-agents.
 *
 * The page closes on a receipt, as the trades do: five claims, each
 * inked if the reader worked the instrument that proves it and hollow if
 * they walked past. That needs one fact shared across sections that are
 * otherwise independent and rendered late inside `content-visibility`
 * blocks, so it is the same module-level store the industry pages use —
 * no provider to thread through a server page, one value per document,
 * and a section can report in whenever it is finally rendered.
 *
 * A SIBLING STORE, NOT A WIDER UNION. It would be one line to add five
 * names to the industry `Claim` type and import that store here. It
 * would also be wrong: each page's receipt is its own set of claims, and
 * a shared set would let the trades' receipt type-check a claim ("sheet")
 * that no trade page can ever prove, and this one accept "fork" or
 * "bench". Two thirty-line stores are cheaper than one union that lies
 * to both readers of it.
 *
 * `CaaClaim` is declared a second time in lib/pages/custom-ai-agents.ts,
 * on purpose: that module is server-only and this one is client, so
 * neither can import the other's value. Keep the two unions in step.
 * ------------------------------------------------------------------ */

/** Keep in step with `CaaClaim` in lib/pages/custom-ai-agents.ts. */
export type CaaClaim = "sheet" | "redline" | "names" | "wiring" | "rehearsal";

const proved = new Set<CaaClaim>();
const listeners = new Set<() => void>();

/** Identity-stable snapshot: React bails out unless the set really changed. */
let snapshot: readonly CaaClaim[] = [];

export function markProved(claim: CaaClaim): void {
  if (proved.has(claim)) return;
  proved.add(claim);
  snapshot = [...proved];
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const EMPTY: readonly CaaClaim[] = [];

export function useProved(): readonly CaaClaim[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    // Nothing is proved on the server, and the first client render has to
    // agree with it or the receipt hydrates with rows already inked.
    () => EMPTY,
  );
}

"use client";

import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ *
 * What the reader actually operated.
 *
 * The page closes on a receipt rather than on a row of tiles: each claim
 * it made, inked if the reader worked the instrument that proves it and
 * hollow if they walked past. That needs one fact shared across sections
 * that are otherwise independent and lazily rendered.
 *
 * A module-level store rather than context, for the same reason the
 * header's dock phase is one: there is no provider to thread through a
 * server-rendered page, the value is per-document anyway, and a section
 * inside a `content-visibility:auto` block can report in whenever it is
 * finally rendered without anything above it having to exist yet.
 * ------------------------------------------------------------------ */

export type Claim = "fork" | "bench" | "run" | "wall" | "relay" | "rules";

const proved = new Set<Claim>();
const listeners = new Set<() => void>();

/** Identity-stable snapshot: React bails out unless the set really changed. */
let snapshot: readonly Claim[] = [];

export function markProved(claim: Claim) {
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

const EMPTY: readonly Claim[] = [];

export function useProved(): readonly Claim[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    // Nothing is proved on the server, and the first client render has to
    // agree with it or the receipt hydrates with rows already inked.
    () => EMPTY,
  );
}

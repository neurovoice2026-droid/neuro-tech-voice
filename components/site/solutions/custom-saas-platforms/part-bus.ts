"use client";

import { useState, useSyncExternalStore } from "react";
import type { LensId, PartId } from "@/lib/pages/custom-saas-platforms";

/* ------------------------------------------------------------------ *
 * "See it on the map": a part asked for from anywhere on the page, and
 * shown by the explorer in #platform.
 *
 * The askers (a grant in #credentials, a part in #scope's inspector) and
 * the explorer are separate islands, each painted late inside its own
 * content-visibility box under a server page, so there is no parent to
 * lift state into and no provider worth threading through one. It is the
 * module-level store custom-ai-agents' proved.ts uses: one value per
 * document, which the explorer reads through `usePartRequest`.
 *
 * Every request carries a fresh `nonce`, so asking for the same part
 * twice (the reader scrolled away and pressed the link again) is a new
 * request, and the explorer scrolls back and focuses its inspector again.
 *
 * ONLY WHAT WAS ASKED WHILE IT WAS THERE. The store is per document, not
 * per visit: a client-side navigation away and back keeps this module,
 * and its last request, while the explorer mounts afresh. So a reader
 * who pressed "See it on the map" once, went to "/" and came back would
 * have been scrolled to #platform, with focus taken, on every return.
 * `usePartRequest` therefore only hands over requests made after the
 * component reading it first rendered. The explorer hydrates with the
 * page, in the same pass as every link that can ask (a content-visibility
 * box skips painting, not rendering), so nothing current is ever dropped.
 *
 * `PartId` is imported as a type only: the data module is server-only,
 * and a value import would pull it into this client chunk.
 * ------------------------------------------------------------------ */

export type PartRequest = { id: PartId; nonce: number };

let current: PartRequest | null = null;
let nonce = 0;
const listeners = new Set<() => void>();

/** Asks the explorer to show `id`: select it, scroll to it, focus its inspector. */
export function requestPart(id: PartId): void {
  current = { id, nonce: ++nonce };
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * The latest request made since the caller first rendered, or null.
 * Identity-stable between requests, so React bails out unless a new one
 * arrived. A request from before the caller mounted (an earlier visit to
 * the page in this tab) is never replayed.
 */
export function usePartRequest(): PartRequest | null {
  // The last nonce issued before this component first rendered: anything
  // at or under it was asked of an explorer that is gone.
  const [before] = useState(() => nonce);
  const request = useSyncExternalStore(
    subscribe,
    () => current,
    // Nothing has been asked for on the server, and the first client render
    // has to agree with it or the explorer hydrates with a part selected.
    () => null,
  );
  return request && request.nonce > before ? request : null;
}

/* A lens asked for from elsewhere on the page: #checks' "Take a part
   down", which names the explorer's fifth lens and so has to open it,
   not only scroll to the drawing. The same store and the same rule as a
   part: a fresh nonce per request (from the one counter), and nothing
   asked before the reader mounted is replayed. */

export type LensRequest = { id: LensId; nonce: number };

let lensAsked: LensRequest | null = null;

/** Asks the explorer to open lens `id`: pick it as a key would (nothing plays), bring the stage up, focus its chip. */
export function requestLens(id: LensId): void {
  lensAsked = { id, nonce: ++nonce };
  listeners.forEach((fn) => fn());
}

/** The latest lens request made since the caller first rendered, or null; see `usePartRequest`. */
export function useLensRequest(): LensRequest | null {
  const [before] = useState(() => nonce);
  const request = useSyncExternalStore(
    subscribe,
    () => lensAsked,
    () => null,
  );
  return request && request.nonce > before ? request : null;
}

/* ONCE PER HISTORY ENTRY, IN THE ADDRESS BAR TOO. The store above never
   replays; the address bar would. A map link writes `#part-<id>` there
   without a jump (map-link.tsx), and the explorer serves any `#part-…`
   it finds when it mounts: an arrival on a shared or typed link. Left at
   that, the fragment the page wrote itself was served again on every
   Back to its entry and every reload, and the reader, gone on to #terms
   or the FAQ, was carried thousands of pixels back up to #platform with
   focus taken, where the browser would have kept their place.

   So the entry says which part it has already shown: `markPartShown`
   notes it in `history.state` as the fragment is written (and once the
   explorer has served an arrival), and the explorer passes over a
   `#part-…` its entry has already shown (`partShown`). history.state
   lives with the entry, through a trip away and Back and through a
   reload; a real arrival on /…#part-<id> starts without it, and is served.

   Only our key goes in. Next's patched replaceState copies its own keys
   (`__NA` and the tree) into the object and has its router follow the
   new address; a state that already carried `__NA` (a spread of the
   current one) would skip both, and leave the router's URL behind the
   address bar's. Next keeps a custom key through its own later writes
   to the entry (`preserveCustomHistoryState`). */

const SHOWN = "saasPartShown";

/** Notes on this history entry that `id` has been shown; with `href`, also writes that fragment to the address bar, without a jump. */
export function markPartShown(id: PartId, href?: string): void {
  history.replaceState({ [SHOWN]: id }, "", href);
}

/** Whether this history entry has already shown `id`: a fragment the page wrote itself, or an arrival already served. */
export function partShown(id: string): boolean {
  return (history.state as Record<string, unknown> | null)?.[SHOWN] === id;
}

"use client";

import { useState, useSyncExternalStore } from "react";
import type { RunLensId } from "@/lib/pages/custom-automations";

/* ------------------------------------------------------------------ *
 * "Watch it run": a workbench lens asked for from anywhere on the page,
 * and opened by the workbench in #running.
 *
 * The askers (a block kind in #work's legend, through RunLink) and the
 * workbench are separate islands, each painted late inside its own
 * content-visibility box under a server page, so there is no parent to
 * lift state into and no provider worth threading through one. It is the
 * SaaS page's part-bus.ts, for one kind of request: a module-level store,
 * one value per document, which the workbench reads through
 * `useRunRequest`.
 *
 * Every request carries a fresh `nonce`, so asking for the same lens
 * twice (the reader scrolled away and pressed "Watch it run" again) is a
 * new request, and the workbench brings its stage up and focuses the
 * lens's chip again.
 *
 * ONLY WHAT WAS ASKED WHILE IT WAS THERE. The store is per document, not
 * per visit: a client-side navigation away and back keeps this module,
 * and its last request, while the workbench mounts afresh. So a reader
 * who pressed "Watch it run" once, went to "/" and came back would be
 * scrolled to #running, with focus taken, on every return.
 * `useRunRequest` therefore only hands over requests made after the
 * component reading it first rendered. The workbench hydrates with the
 * page, in the same pass as every link that can ask (a content-visibility
 * box skips painting, not rendering), so nothing current is ever dropped.
 *
 * WHAT THE WORKBENCH DOES WITH ONE (spec §5.2.7): it picks the lens as a
 * key would, on its finished frame with nothing playing, scrolls the
 * stage to 112px, focuses the lens's chip and takes one more look after
 * 400ms, as the SaaS explorer's `showLens` does. A request is the
 * reader's own hand, so it ends the first view's tour for good.
 *
 * `RunLensId` is imported as a type only: the data module is
 * server-only, and a value import would pull it into this client chunk.
 * ------------------------------------------------------------------ */

export type RunRequest = { id: RunLensId; nonce: number };

let current: RunRequest | null = null;
let nonce = 0;
const listeners = new Set<() => void>();

/** Asks the workbench to open `lens`: pick it as a key would (nothing plays), bring the stage up, focus its chip. */
export function requestRun(lens: RunLensId): void {
  current = { id: lens, nonce: ++nonce };
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
export function useRunRequest(): RunRequest | null {
  // The last nonce issued before this component first rendered: anything
  // at or under it was asked of a workbench that is gone.
  const [before] = useState(() => nonce);
  const request = useSyncExternalStore(
    subscribe,
    () => current,
    // Nothing has been asked for on the server, and the first client render
    // has to agree with it or the workbench hydrates on a lens nobody chose.
    () => null,
  );
  return request && request.nonce > before ? request : null;
}

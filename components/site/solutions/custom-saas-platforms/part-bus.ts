"use client";

import { useSyncExternalStore } from "react";
import type { PartId } from "@/lib/pages/custom-saas-platforms";

/* ------------------------------------------------------------------ *
 * "See it on the map": a part asked for from anywhere on the page, and
 * shown by the explorer in #platform.
 *
 * The askers (a grant in #credentials, a part in #scope's inspector) and
 * the explorer are separate islands, each rendered late inside its own
 * content-visibility box under a server page, so there is no parent to
 * lift state into and no provider worth threading through one. It is the
 * module-level store custom-ai-agents' proved.ts uses: one value per
 * document, and the explorer picks up a request whenever it is finally
 * rendered.
 *
 * Every request carries a fresh `nonce`, so asking for the same part
 * twice (the reader scrolled away and pressed the link again) is a new
 * request, and the explorer scrolls back and focuses its inspector again.
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
 * The latest request, or null before the first. Identity-stable between
 * requests, so React bails out unless a new one arrived.
 */
export function usePartRequest(): PartRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    // Nothing has been asked for on the server, and the first client render
    // has to agree with it or the explorer hydrates with a part selected.
    () => null,
  );
}

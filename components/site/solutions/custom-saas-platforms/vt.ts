"use client";

import { flushSync } from "react-dom";
import type { DeviceTier } from "@/components/site/product/device-tier";

/* ------------------------------------------------------------------ *
 * Same-document View Transitions, for the two places this page changes
 * one picture into another at the reader's hand: #prototype's screens
 * and #checks' filter.
 *
 * THE DOM API, NOT React's <ViewTransition>. React's component needs the
 * global experimental flag in next.config.ts, which would change every
 * route's navigation to fix two sections on one page. The browser's own
 * `document.startViewTransition` needs nothing: the state change is
 * flushed synchronously inside its callback (`flushSync`), so the new
 * DOM is in place when the browser captures the new state, and the CSS
 * animates the named parts between the two.
 *
 * SCOPED. While one of ours runs, <html data-saas-vt="proto|checks"> is
 * set, and every rule in saas.css (and the sections' own files) that
 * styles a view-transition pseudo-element is written under it: another
 * transition on the site, or one of ours of the other kind, never picks
 * up our timings, and our root never cross-fades (saas.css §11). The
 * attribute is cleared when the transition finishes — by the last one
 * started, so a transition that a quicker second press skips cannot pull
 * the attribute out from under the one that replaced it.
 *
 * TYPES WHERE THEY EXIST. `types: ["forward" | "back"]` lets the CSS
 * mirror the prototype's slide with `:active-view-transition-type()`. The
 * options form is passed only where `ViewTransition.prototype` carries
 * `types`; a browser that has the API but not types gets the callback
 * form, and its CSS the default direction (the `@supports selector(…)`
 * guard in the section's rules). A browser without the API, a reader who
 * asked for less motion, or a lite or still device gets `update()` at
 * once: an instant change, the section's own fallback.
 * ------------------------------------------------------------------ */

export type VtScope = "proto" | "checks";

const supported = () => typeof document !== "undefined" && typeof document.startViewTransition === "function";

/**
 * True when a same-document transition may run: supported, motion allowed,
 * not lite/still. Call it in the event handler, not while rendering: it
 * reads the document, which the server does not have.
 */
export function vtAllowed(reduce: boolean, tier: DeviceTier): boolean {
  return !reduce && tier !== "lite" && tier !== "still" && supported();
}

/** Whether this browser's transitions carry `types` (the options form of startViewTransition). */
const typesSupported = () => typeof ViewTransition !== "undefined" && "types" in ViewTransition.prototype;

/** The transition started last: only it may clear the scope attribute. */
let latest = 0;

/**
 * Runs `update` inside document.startViewTransition, React flushed synchronously inside it,
 * with <html data-saas-vt={scope}> set for the transition's life (the scoping hook for saas.css).
 * `types` are passed only where ViewTransition.prototype has "types"; elsewhere the
 * callback form runs and the CSS falls back to the default cross-fade.
 * Not allowed, or startViewTransition throws: `update()` runs directly.
 */
export function withViewTransition(
  scope: VtScope,
  update: () => void,
  o: { allowed: boolean; types?: readonly string[] },
): void {
  if (!o.allowed || !supported()) {
    update();
    return;
  }
  const root = document.documentElement;
  const id = ++latest;
  const clear = () => {
    if (id === latest) root.removeAttribute("data-saas-vt");
  };
  const run = () => flushSync(update);
  root.setAttribute("data-saas-vt", scope);
  let vt: ViewTransition;
  try {
    vt =
      o.types?.length && typesSupported()
        ? document.startViewTransition({ update: run, types: [...o.types] })
        : document.startViewTransition(run);
  } catch {
    clear();
    update();
    return;
  }
  // A transition skipped (a second press, a hidden tab) rejects `ready`;
  // the update still runs, so there is nothing to report.
  vt.ready.catch(() => {});
  vt.finished.then(clear, clear);
}

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
 * NEVER OVER THE HEADER. A named part is drawn in the transition's own
 * layer, above the whole page, and the fixed site header is part of the
 * page (the root), which does not move (saas.css §11). So a part under
 * the header would slide sharp across its wordmark for the transition's
 * 0.2–0.32s, then drop back under the frosted plate. Naming the header
 * too would keep it on top, but a named header samples an empty backdrop
 * and loses its frost for every transition. So a change whose parts are
 * under the header, before or after it, is made at once instead: before,
 * by not starting the transition; after (a row whose new place is under
 * the header), by skipping it once the new DOM is in, which keeps the
 * change and drops the animation.
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
 * The parts each scope names while it runs (saas-build.css §8, saas-closing.css
 * §10): the prototype's screen, and #checks' rows with the block under them.
 */
const NAMED: Record<VtScope, string> = {
  proto: ".pp .saas-proto-screen",
  checks: ".pp .saas-check",
};

/** True when any part `scope` names is on screen under the fixed site header. */
function underHeader(scope: VtScope): boolean {
  // The <header> itself: the menu and the phone sheet carry the attribute too.
  const bar = document.querySelector("header[data-site-header]")?.getBoundingClientRect();
  if (!bar || bar.bottom <= 0) return false;
  for (const part of document.querySelectorAll(NAMED[scope])) {
    const r = part.getBoundingClientRect();
    if (r.height > 0 && r.top < bar.bottom && r.bottom > bar.top) return true;
  }
  return false;
}

/**
 * Runs `update` inside document.startViewTransition, React flushed synchronously inside it,
 * with <html data-saas-vt={scope}> set for the transition's life (the scoping hook for saas.css).
 * `types` are passed only where ViewTransition.prototype has "types"; elsewhere the
 * callback form runs and the CSS falls back to the default cross-fade.
 * Not allowed, a named part under the header, or startViewTransition throws:
 * `update()` runs directly. A part under the header once the update is in:
 * the transition is skipped, the update kept.
 */
export function withViewTransition(
  scope: VtScope,
  update: () => void,
  o: { allowed: boolean; types?: readonly string[] },
): void {
  if (!o.allowed || !supported() || underHeader(scope)) {
    update();
    return;
  }
  const root = document.documentElement;
  const id = ++latest;
  const clear = () => {
    if (id === latest) root.removeAttribute("data-saas-vt");
  };
  let vt: ViewTransition;
  const run = () => {
    flushSync(update);
    // The new picture: a part whose new place is under the header would slide there over it.
    if (underHeader(scope)) vt.skipTransition();
  };
  root.setAttribute("data-saas-vt", scope);
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

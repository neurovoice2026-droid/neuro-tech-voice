"use client";

import { useEffect } from "react";

/* ------------------------------------------------------------------ *
 * Landing on a #section, and staying there.
 *
 * Everything below the cover on these pages is a `content-visibility:
 * auto` block with a guessed height, and the guesses are only replaced by
 * real heights as each block comes near the screen. So a link to #wall
 * lands on the right spot, and then the blocks around it render, grow or
 * shrink by hundreds of pixels, and the section slides away — up past the
 * header on one page, half a screen down on another.
 *
 * So for a moment after arrival the target is put back each time the page
 * changes size, the way the browser put it there the first time (its own
 * `scroll-mt-*` included). The reader taking over ends it at once: their
 * wheel, touch, key or click is theirs. A reload or a back/forward is left
 * to the browser, which restores where the reader actually was.
 * ------------------------------------------------------------------ */

/** How long after arrival the target is held in place. */
const HOLD_MS = 1500;
/** A page mounted this soon after a back/forward came from history, not a link. */
const POP_MS = 3000;

let arrived = false;
let popped = -Infinity;

function target() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  let id = hash;
  try {
    id = decodeURIComponent(hash);
  } catch {}
  const el = document.getElementById(id);
  const main = document.getElementById("content");
  return el && main && main !== el && main.contains(el) ? { el, main } : null;
}

export function HashLanding() {
  useEffect(() => {
    const first = !arrived;
    arrived = true;
    if (first) {
      window.addEventListener("popstate", () => (popped = performance.now()));
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if ((nav?.type ?? "navigate") !== "navigate") return;
    } else if (performance.now() - popped < POP_MS) return;

    const found = target();
    if (!found) return;
    const { el, main } = found;

    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    const opts = { capture: true, passive: true } as const;
    let done = false;
    const land = () => {
      if (!done) el.scrollIntoView({ block: "start", behavior: "instant" });
    };
    // Called once as it starts observing, which is the re-landing on mount.
    const ro = new ResizeObserver(land);
    const stop = () => {
      if (done) return;
      done = true;
      ro.disconnect();
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, stop, opts));
    };
    const timer = window.setTimeout(stop, HOLD_MS);
    events.forEach((e) => window.addEventListener(e, stop, opts));
    ro.observe(main);
    return stop;
  }, []);

  return null;
}

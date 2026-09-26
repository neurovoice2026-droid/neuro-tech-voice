"use client";

import { useEffect } from "react";

/* ------------------------------------------------------------------ *
 * Same-page jumps that land where they say: a section's top at the
 * page's scroll padding plus its own margin (80 + 32 = 112px, saas.css
 * §14), whatever the content-visibility boxes above it do on the way.
 *
 * WHY THEY MISSED. Every section below the hero sits in a SaasDeferred
 * box that holds a reserve until it first paints (deferred.tsx). A jump works
 * out its end point from the reserves, and every box it passes then
 * paints at its real height mid-flight. Scroll anchoring (back on for
 * this page, saas.css §14) keeps what is on screen in place when a box
 * above it changes, but a smooth scroll in flight goes on to the point
 * it set out for, and Chrome does not anchor a box that paints because
 * the scroll reached it. "How to check it" left #checks' heading and
 * filter 350–470px above where they belong on a 414–430px phone, and
 * "Explore the platform" put #platform 211px low at 320. Safari has no
 * scroll anchoring at all, so there any reserve off the truth is a miss.
 *
 * So each jump gets one more look once it has settled, as the explorer's
 * `showPart` and `showLens` take one: after `scrollend` (or, without it,
 * once the scroll events stop), two frames for the boxes to paint, then
 * the target is set right if it is more than 4px off — smoothly, as the
 * jump itself went, unless the reader asked for less motion. At most two
 * looks, and none once the reader takes over (a wheel, a touch, a key,
 * a press).
 *
 * WHICH JUMPS. A plain primary click on an `<a href="#…">` inside this
 * page's <main>, delegated from `window`, so every section's links are
 * covered without touching them. A click something already handled
 * (`defaultPrevented`: a map link, "Take a part down", which scroll and
 * re-check for themselves) is left alone, as are the skip link
 * (`#content`) and the explorer's index (`#part-…`). A Next Link to a
 * fragment would be one of those too, so every in-page link on the page
 * is a plain anchor (hero.tsx `PILL_HASH`, check-line.tsx).
 *
 * ARRIVING ON A FRAGMENT. html's `scroll-behavior: smooth` (globals.css)
 * made Chrome animate the load-time jump to a `#faq` or `#start` through
 * every box above it, some 15,000px on a phone, and land up to 880px off.
 * saas.css §14 holds scroll-behavior at `auto` until <html
 * data-saas-loaded>, set here two frames after `load`, so the browser's
 * own load-time jump is instant (and, with anchoring on, lands); the
 * same one more look then catches what is left. Only on the document's
 * first arrival: a reload or a Back keeps the reader's place, as the
 * browser does, and a later mount (a client-side trip away and back)
 * never looks at the address bar at all.
 * ------------------------------------------------------------------ */

/** How far off a landing may be before it is set right: rounding, never a line of text. */
const SLACK = 4;

/** At most this many corrections per jump: a correction can paint one more box. */
const LOOKS = 2;

/** Whether this document's arrival has been looked at: once, whatever mounts after. */
let arrived = false;

export function Jumps() {
  useEffect(() => {
    const html = document.documentElement;
    const main = document.querySelector("main.saas-page");
    const ctl = new AbortController();
    const { signal } = ctl;
    let stop: (() => void) | null = null;

    /** The element a same-page fragment names, or null for one the page handles itself. */
    const targetOf = (hash: string | null) => {
      if (!hash || hash.length < 2 || hash === "#content" || hash.startsWith("#part-")) return null;
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return null;
      }
      const el = document.getElementById(id);
      return el && main?.contains(el) ? el : null;
    };

    /** How far the page has to move to land `el` where a jump puts it, within what the page can scroll. */
    const miss = (el: Element) => {
      const at =
        (parseFloat(getComputedStyle(html).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
      const max = html.scrollHeight - window.innerHeight;
      const want = Math.min(Math.max(window.scrollY + el.getBoundingClientRect().top - at, 0), max);
      return want - window.scrollY;
    };

    /**
     * Once the scroll in flight has settled, sets `el`'s landing right.
     * `instant` for the arrival, where nobody is watching a scroll; a
     * jump the reader made is corrected the way it moved.
     */
    const keep = (el: Element, instant: boolean) => {
      stop?.();
      const mine = new AbortController();
      const off = { signal: mine.signal, passive: true };
      let left = LOOKS;
      let timer = 0;
      let raf = 0;
      const done = () => {
        mine.abort();
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
        if (stop === done) stop = null;
      };
      const look = () => {
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => {
            const by = miss(el);
            if (Math.abs(by) <= SLACK || left-- === 0) return done();
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollBy({ top: by, behavior: instant || reduce ? "instant" : "smooth" });
            wait(600);
          });
        });
      };
      const wait = (ms: number) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(look, ms);
      };
      // Settled is `scrollend`, or, where there is none, 150ms without a
      // scroll event. While the page moves, the fallback keeps moving
      // back; it also looks when nothing scrolls at all.
      const end = "onscrollend" in window;
      if (end) window.addEventListener("scrollend", look, off);
      window.addEventListener("scroll", () => wait(end ? 600 : 150), off);
      // The reader taking over ends it: their scroll is theirs.
      for (const type of ["wheel", "touchstart", "keydown", "pointerdown"] as const) {
        window.addEventListener(type, done, { ...off, capture: true });
      }
      stop = done;
      if (instant) look();
      else wait(600);
    };

    window.addEventListener(
      "click",
      (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = (e.target as Element | null)?.closest?.("a[href^='#']");
        const el = link && main?.contains(link) ? targetOf(link.getAttribute("href")) : null;
        if (el) keep(el, false);
      },
      { signal },
    );

    let raf = 0;
    const loaded = () => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          if (!arrived) {
            arrived = true;
            const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
            const el = (nav?.type ?? "navigate") === "navigate" ? targetOf(window.location.hash) : null;
            if (el) keep(el, true);
          }
          html.setAttribute("data-saas-loaded", "");
        });
      });
    };
    if (document.readyState === "complete") loaded();
    else window.addEventListener("load", loaded, { signal, once: true });

    return () => {
      ctl.abort();
      stop?.();
      cancelAnimationFrame(raf);
      html.removeAttribute("data-saas-loaded");
    };
  }, []);

  return null;
}

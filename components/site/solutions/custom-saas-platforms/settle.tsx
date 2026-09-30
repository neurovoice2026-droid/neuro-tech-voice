"use client";

import { useEffect } from "react";

/* ------------------------------------------------------------------ *
 * The boxes above the reader, painted while the reader is still.
 *
 * A page that opens part-way down — a reload, a Back, a /…#faq — has
 * every content-visibility box above the screen at its reserve
 * (deferred.tsx), which is close to its height but not it. Left alone,
 * each box paints at its real height the first time the reader scrolls
 * back up to it, and Chrome does not anchor a box that paints because
 * the reader scrolled to it: the page moved under a reader scrolling up
 * after a reload, once per box. So the page does it first: once it is
 * somewhere below the top, every box wholly above the screen renders at
 * once (`content-visibility: visible`) and, two frames later, goes back
 * to `auto`, holding the height it rendered at (`contain-intrinsic-size:
 * auto` keeps it). The reader is still, so scroll anchoring (on for this
 * page, saas.css §14) holds what is on screen while the page above it
 * settles, and nothing above moves when they scroll up to it.
 *
 * WHEN. The browser puts the page there at different moments: a reload's
 * and a Back's restore, and a fragment's jump, come while the document is
 * parsing, before this mounts; Next's client-side Back restores the place
 * just after the page commits, after it. So it looks on mount, on each
 * scroll, and at `load`, and acts the first time a box is wholly above
 * the screen. It stops there, or as soon as the reader takes over (a
 * wheel, a touch, a key, a press): a reader who scrolls down from the top
 * has painted every box they passed.
 *
 * ONLY WITH SCROLL ANCHORING. Without it (Safari), painting the boxes
 * above would move the page by all they are off at once, the moment it
 * arrived; the reserves alone keep that small, a few pixels a box.
 * ------------------------------------------------------------------ */

export function SettleAbove() {
  useEffect(() => {
    const main = document.querySelector("main.saas-page");
    if (!main || !CSS.supports("overflow-anchor", "auto")) return;
    const ctl = new AbortController();
    const { signal } = ctl;
    let raf = 0;
    let shown: HTMLElement[] = [];
    const release = () => {
      for (const box of shown) box.style.removeProperty("content-visibility");
      shown = [];
    };
    const settle = () => {
      const above = [...main.querySelectorAll<HTMLElement>(":scope > .home-deferred")].filter(
        (box) => box.getBoundingClientRect().bottom <= 0,
      );
      if (!above.length) return;
      ctl.abort();
      shown = above;
      for (const box of shown) box.style.contentVisibility = "visible";
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(release);
      });
    };
    window.addEventListener("scroll", settle, { signal, passive: true });
    if (document.readyState !== "complete") window.addEventListener("load", settle, { signal, once: true });
    for (const type of ["wheel", "touchstart", "keydown", "pointerdown"] as const) {
      window.addEventListener(type, () => ctl.abort(), { signal, passive: true, capture: true });
    }
    settle();
    return () => {
      ctl.abort();
      cancelAnimationFrame(raf);
      release();
    };
  }, []);

  return null;
}

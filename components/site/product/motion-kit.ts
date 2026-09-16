"use client";

import { useEffect, useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from "react";
import type { gsap as GsapCore } from "gsap";
import type { SplitText as SplitTextClass } from "gsap/SplitText";

/* ------------------------------------------------------------------ *
 * GSAP, fetched when a section that uses it comes near the screen.
 *
 * None of the page's first screen is drawn by GSAP, so it has no business
 * in the scripts a phone downloads before it can paint. `useMotionKit`
 * fetches it once, in the browser's first idle moment after a section
 * asks for it, and `useKitContext` then runs that section's animation
 * code the way `useGSAP` would: inside a context scoped to the section,
 * reverted on unmount, and on every update when `revertOnUpdate` is set.
 * ------------------------------------------------------------------ */

export type Kit = {
  gsap: typeof GsapCore;
  SplitText: typeof SplitTextClass;
};

let pending: Promise<Kit> | null = null;

function loadKit() {
  pending ??= Promise.all([
    import("gsap"),
    import("gsap/SplitText"),
    import("gsap/DrawSVGPlugin"),
    import("gsap/MotionPathPlugin"),
  ]).then(([{ gsap }, { SplitText }, { DrawSVGPlugin }, { MotionPathPlugin }]) => {
    gsap.registerPlugin(SplitText, DrawSVGPlugin, MotionPathPlugin);
    return { gsap, SplitText };
  });
  return pending;
}

/** Runs `run` once the main thread is idle; the returned function cancels it. */
export function whenIdle(run: () => void) {
  // Safari has no idle callback; a short timeout is the usual stand-in.
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(run, 120);
  return () => clearTimeout(id);
}

let intent: Promise<void> | null = null;

/**
 * Resolves on the visitor's first sign of life — a pointer moving, a touch,
 * a key, a scroll — or, for someone who only reads, a few seconds after the
 * page has loaded. Work that would stall the main thread and that the first
 * screen can do without (compiling a WebGL shader) waits for this, so it
 * never competes with the page becoming usable.
 */
export function whenIntent() {
  intent ??= new Promise<void>((resolve) => {
    const events = ["pointermove", "pointerdown", "touchstart", "keydown", "wheel", "scroll"] as const;
    let timer = 0;
    const go = () => {
      events.forEach((e) => window.removeEventListener(e, go, true));
      window.removeEventListener("load", arm);
      clearTimeout(timer);
      resolve();
    };
    const arm = () => {
      timer = window.setTimeout(go, 7000);
    };
    events.forEach((e) => window.addEventListener(e, go, { capture: true, passive: true }));
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });
  });
  return intent;
}

/** The kit, once `wanted` has been true. Null until it has arrived. */
export function useMotionKit(wanted: boolean) {
  const [kit, setKit] = useState<Kit | null>(null);

  useEffect(() => {
    if (!wanted || kit) return;
    let live = true;
    const cancel = whenIdle(() => {
      loadKit().then((k) => {
        if (live) setKit(k);
      });
    });
    return () => {
      live = false;
      cancel();
    };
  }, [wanted, kit]);

  return kit;
}

const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;
const none: DependencyList = [];

/**
 * `useGSAP`, for a GSAP that arrives late. The callback runs inside a
 * context scoped to `scope` as soon as the kit is there and again whenever
 * `dependencies` change. A function it returns runs when the context reverts.
 */
export function useKitContext(
  kit: Kit | null,
  callback: (kit: Kit) => void | (() => void),
  {
    scope,
    dependencies = none,
    revertOnUpdate = false,
  }: { scope?: RefObject<Element | null>; dependencies?: DependencyList; revertOnUpdate?: boolean } = {},
) {
  const context = useRef<ReturnType<Kit["gsap"]["context"]> | null>(null);

  // Whatever else happens, nothing the section animated outlives it.
  useIsoLayoutEffect(
    () => () => {
      context.current?.revert();
      context.current = null;
    },
    none,
  );

  useIsoLayoutEffect(() => {
    if (!kit) return;
    const ctx = (context.current ??= kit.gsap.context(() => {}, scope?.current ?? undefined));
    ctx.add(() => callback(kit), scope?.current ?? undefined);
    if (revertOnUpdate) return () => ctx.revert();
    // The callback is read fresh on every run; the dependencies decide when.
  }, [kit, ...dependencies]);
}

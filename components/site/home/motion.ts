"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { useDeviceTier, type DeviceTier } from "@/components/site/product/device-tier";
import { useFlipKit, useMotionKit, whenIntent, type FlipKit, type Kit } from "@/components/site/product/motion-kit";
import { useInView, usePrefersReducedMotion } from "@/components/site/product/timing";
import "./tier.css";

/* ------------------------------------------------------------------ *
 * The landing's motion contract.
 *
 * Several stages on the page play on their own. Two of them moving at
 * once is noise, so every autoplaying stage registers here, and only the
 * one that fills most of the screen is told to play. The rest wait,
 * showing whatever they last showed, until the reader scrolls to them.
 *
 * Every tier but `still` plays: the device tier (device-tier.ts) decides
 * how a stage's pictures are drawn, never whether it tours. A stage
 * fetches GSAP once it is near and the visitor has shown a first sign of
 * life (so GSAP stays out of the page's load); until then it shows what
 * it shows under reduced motion: the finished frame the server drew.
 * Never an empty stage.
 *
 * Importing this module brings in tier.css, the landing's tier rules.
 * ------------------------------------------------------------------ */

/** A stage takes focus only once at least this much of it (or of the screen) is its own. */
const FOCUS_MIN = 0.3;
const THRESHOLDS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];

const scores = new Map<string, number>();
const listeners = new Set<() => void>();
let focused: string | null = null;
/**
 * The stage whose own sound control the reader pressed: it keeps the
 * focus (and so the sound) while any of it is on screen, whatever else
 * covers more of it, as a pressed stage keeps the sound on the other
 * pages. Another stage's press, or the stage leaving the screen, hands
 * the focus back to the shares. (The shares are read at the observer's
 * thresholds, so a stage's may lag behind its scroll: on screen at all is
 * the one test that cannot.) Sound turned off with its control lets it
 * go too.
 */
let pinned: string | null = null;

function settle() {
  let best: string | null = null;
  let top = FOCUS_MIN;
  if (pinned !== null && !((scores.get(pinned) ?? 0) > 0)) pinned = null;
  if (pinned !== null) best = pinned;
  // Map order is registration order, so a tie goes to the stage higher up the page.
  else
    for (const [id, score] of scores) {
      if (score >= top && (best === null || score > top)) {
        best = id;
        top = score;
      }
    }
  if (best === focused) return;
  focused = best;
  listeners.forEach((l) => l());
}

/**
 * The reader pressed stage `id`'s own sound control: turned on (`on`), it
 * takes the focus now, so it plays (and is heard) rather than the stage
 * that covers more of the screen, which would speak with what it shows
 * perhaps scrolled away; turned off, the focus goes back to the shares.
 * Call it inside the press.
 */
export function pinStageFocus(id: string, on = true) {
  if (!on) {
    if (pinned !== null) {
      pinned = null;
      settle();
    }
    return;
  }
  if (!((scores.get(id) ?? 0) > 0)) return;
  pinned = id;
  settle();
}

/**
 * Stage `id` can no longer be heard where it is (the landing's greeting,
 * with its line scrolled away): if it holds the pin, it lets it go, and
 * the focus goes back to the shares. Any other stage's pin stays.
 */
export function unpinStageFocus(id: string) {
  if (pinned !== id) return;
  pinned = null;
  settle();
}

function subscribeFocus(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * True for the one registered stage with the most of itself on screen,
 * provided that is at least 30%. A stage taller than the screen can never
 * show 30% of itself on a short phone, so the share of the screen it
 * covers counts too. False on the server.
 */
export function useStageFocus(ref: RefObject<Element | null>, id: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    scores.set(id, 0);
    const io = new IntersectionObserver(
      (entries) => {
        // The last entry is the element as it is now: a busy main thread can hand one callback several.
        const e = entries[entries.length - 1];
        const screen = e.rootBounds?.height || window.innerHeight;
        const covers = screen > 0 ? e.intersectionRect.height / screen : 0;
        scores.set(id, e.isIntersecting ? Math.max(e.intersectionRatio, covers) : 0);
        settle();
      },
      { threshold: THRESHOLDS },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      scores.delete(id);
      if (pinned === id) pinned = null;
      settle();
    };
  }, [ref, id]);

  return useSyncExternalStore(
    subscribeFocus,
    () => focused === id,
    () => false,
  );
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** False while the tab is in the background. True on the server. */
export function useDocumentVisible() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => !document.hidden,
    () => true,
  );
}

/**
 * False until the visitor's first sign of life (motion-kit's whenIntent:
 * a pointer, a key, a scroll, or a few seconds after load). Until then no
 * stage fetches GSAP, so it never competes with the page becoming usable.
 * It does not wait for the device tier's probe: whatever the probe says,
 * a stage plays.
 */
function useIntent() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void whenIntent().then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

export type StageMotion<K extends Kit = Kit> = {
  /**
   * Null until the stage is near and GSAP has arrived. Never fetched with
   * reduced motion; but a kit that arrived before that changed stays, so
   * a callback that depends on `reduce` can put the stage at rest.
   */
  kit: K | null;
  /** Reduced motion: the reader's setting, or a forced "still" tier. */
  reduce: boolean;
  near: boolean;
  /** Focused, the tab visible, not paused by hand, never with reduced motion. */
  playing: boolean;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /** The reader has touched a control: autoplay hands over for good. */
  interacted: boolean;
  markInteracted: () => void;
  /** The reader pressed this stage's own sound control: on, it takes the landing's focus; off, lets it go (pinStageFocus). */
  pinFocus: (on: boolean) => void;
  /** This stage cannot be heard where it is: its pin, if it holds it, goes (unpinStageFocus). */
  unpinFocus: () => void;
  /** "full" on the server and while hydrating; see device-tier.ts. */
  tier: DeviceTier;
};

/**
 * Everything an autoplaying stage needs to know: its kit (fetched when it
 * comes near, never with reduced motion), whether it may play now, and
 * the reader's hand on it. `flip` asks for the kit with Flip in it.
 */
export function useStageMotion(ref: RefObject<Element | null>, o: { id: string; flip: true }): StageMotion<FlipKit>;
export function useStageMotion(ref: RefObject<Element | null>, o: { id: string; flip?: boolean }): StageMotion;
export function useStageMotion(
  ref: RefObject<Element | null>,
  { id, flip = false }: { id: string; flip?: boolean },
): StageMotion<Kit | FlipKit> {
  const tier = useDeviceTier();
  const reduce = usePrefersReducedMotion() || tier === "still";
  const near = useInView(ref, "25% 0px");
  const [paused, setPaused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const markInteracted = useCallback(() => setInteracted(true), []);

  // A control used before the first sign of life registered is one.
  const go = useIntent() || interacted;
  const wanted = near && !reduce && go;
  // Both hooks always run; only one is ever asked for anything.
  const base = useMotionKit(wanted && !flip);
  const withFlip = useFlipKit(wanted && flip);
  const kit = flip ? withFlip : base;
  const focus = useStageFocus(ref, id);
  const visible = useDocumentVisible();
  const pinFocus = useCallback((on: boolean) => pinStageFocus(id, on), [id]);
  const unpinFocus = useCallback(() => unpinStageFocus(id), [id]);

  return {
    kit,
    reduce,
    near,
    playing: focus && visible && !paused && !reduce && go,
    paused,
    setPaused,
    interacted,
    markInteracted,
    pinFocus,
    unpinFocus,
    tier,
  };
}

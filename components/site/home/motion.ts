"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { useDeviceTier, whenTierSettled, type DeviceTier } from "@/components/site/product/device-tier";
import { useFlipKit, useMotionKit, type FlipKit, type Kit } from "@/components/site/product/motion-kit";
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
 * On a lite device (device-tier.ts) no stage plays on its own: each one
 * waits for the reader's hand on it — a tap or a key anywhere inside it,
 * or a control — before it fetches GSAP or moves. Until then it has no
 * kit, so it shows exactly what it shows under reduced motion: the
 * finished frame the server drew. Never an empty stage.
 *
 * Importing this module brings in tier.css, the landing's tier rules.
 * ------------------------------------------------------------------ */

/** A stage takes focus only once at least this much of it (or of the screen) is its own. */
const FOCUS_MIN = 0.3;
const THRESHOLDS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];

const scores = new Map<string, number>();
const listeners = new Set<() => void>();
let focused: string | null = null;

function settle() {
  let best: string | null = null;
  let top = FOCUS_MIN;
  // Map order is registration order, so a tie goes to the stage higher up the page.
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
      ([e]) => {
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
 * False until the device tier's probe has had its say: at once when the
 * verdict is cached or forced, otherwise shortly after the visitor's first
 * sign of life. Until then no stage fetches GSAP or plays, so a device
 * about to be called lite never starts a stage it cannot carry.
 */
function useTierSettled() {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let live = true;
    void whenTierSettled().then(() => {
      if (live) setSettled(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return settled;
}

export type StageMotion<K extends Kit = Kit> = {
  /**
   * Null until the stage is near and GSAP has arrived. Never fetched with
   * reduced motion, nor on a lite device before the reader has woken the
   * stage; but a kit that arrived before either changed stays, so a
   * callback that depends on `reduce` can put the stage at rest.
   */
  kit: K | null;
  /** Reduced motion: the reader's setting, or a forced "still" tier. */
  reduce: boolean;
  near: boolean;
  /**
   * Focused, the tab visible, not paused by hand, never with reduced
   * motion, and on a lite device only once the reader has woken the stage.
   */
  playing: boolean;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /** The reader has touched a control: autoplay hands over for good. */
  interacted: boolean;
  markInteracted: () => void;
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
  // A tap or a key inside the stage: on a lite device, the go-ahead to play.
  // Unlike `interacted`, it takes nothing over, so a tour may still run.
  const [tapped, setTapped] = useState(false);

  const settled = useTierSettled();
  const go = settled && (tier !== "lite" || tapped || interacted);
  const wanted = near && !reduce && go;
  // Both hooks always run; only one is ever asked for anything.
  const base = useMotionKit(wanted && !flip);
  const withFlip = useFlipKit(wanted && flip);
  const kit = flip ? withFlip : base;
  // A kit is never dropped once it has arrived, so it also marks a stage
  // that was already under way when a demotion to lite came: it carries on.
  const awake = go || kit !== null;
  const focus = useStageFocus(ref, id);
  const visible = useDocumentVisible();

  useEffect(() => {
    const el = ref.current;
    if (awake || !el) return;
    const wake = () => setTapped(true);
    // A click, not a pointerdown: a finger that lands on the stage to scroll
    // past it sends pointerdown too, and must not fetch GSAP on a weak phone.
    el.addEventListener("click", wake);
    el.addEventListener("keydown", wake);
    return () => {
      el.removeEventListener("click", wake);
      el.removeEventListener("keydown", wake);
    };
  }, [ref, awake]);

  return {
    kit,
    reduce,
    near,
    playing: focus && visible && !paused && !reduce && awake,
    paused,
    setPaused,
    interacted,
    markInteracted,
    tier,
  };
}

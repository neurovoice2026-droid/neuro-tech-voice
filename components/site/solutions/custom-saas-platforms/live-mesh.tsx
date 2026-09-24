"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { RoundButton } from "@/components/site/home/controls";

/* ------------------------------------------------------------------ *
 * The flowing copy of a lit surface's light (saas.css §3, "The mesh in
 * motion"): the #pricing plan cards' flow, on any surface on this page.
 *
 * The surface paints its light once as its ground (`.saas-lit
 * .saas-light-<name>`, from the server's first byte). Over it sits this:
 * the same light taken apart into its pools, one element per pool, each
 * drifting on its own compositor-only path. The pools are worked out on
 * the server (home/mesh-flow.ts `meshBlobs` over palette.ts SAAS_LIGHTS)
 * and arrive as plain style objects, so neither the recipe parser nor the
 * recipes reach this chunk.
 *
 * WHERE IT GOES. The surface's first child, before its `.home-grain`:
 *
 *   <div class="saas-lit saas-light-room" style="--saas-radius:28px">
 *     <LiveMesh blobs={…} drift={1.12} />
 *     <span aria-hidden class="home-grain" />
 *     …content
 *   </div>
 *
 * ONLY WHILE ON SCREEN. An IntersectionObserver on the surface (this
 * element's parent) toggles `data-live` on it, straight on the DOM with no
 * React state, so a surface scrolling in and out never re-renders anything.
 * Off screen, saas.css drops the pools' animations, and their layers with
 * them; the surface rests on its still picture and flows off again from
 * rest when it comes back. The attribute is removed on unmount, so a
 * surface never keeps a flow nobody is watching.
 *
 * The gates are all CSS: reduced motion, the still tier and weak hardware
 * (<html data-weak>) never display this element at all, and see the
 * ground alone — the same picture, standing still. The observer still
 * runs there; with nothing displayed, the attribute it sets costs nothing.
 *
 * `drift` is the surface's own tempo (1 is #pricing's first card): a
 * higher number is slower. Pools drawn at a fixed px size (#pricing's
 * Enterprise band) cross a large surface in a smaller share of it, so
 * they take a slower drift to look the same; every light on this page is
 * drawn in %, so every surface here keeps the plan cards' band.
 *
 * THE READER'S PAUSE (WCAG 2.2.2). The flow loops for as long as a
 * surface is on screen, behind text, so the page carries a control that
 * stops it: `FlowToggle`, in the hero's room, the first surface that
 * moves. It freezes every pool where it stands (saas.css §3, <html
 * data-flow="paused">), so nothing jumps, and Play carries on from there.
 * The choice is the reader's, not the page's: it is kept in localStorage
 * ("ntv-flow") and set on <html>, so it holds on every later visit and on
 * any page whose flow honours the attribute. It is applied after mount
 * (`useSyncExternalStore`, false on the server and while hydrating), so
 * it never costs a hydration mismatch; before that nothing flows anyway,
 * because `data-live` is set by the same mount.
 * ------------------------------------------------------------------ */

/** The reader's choice, as localStorage keeps it. */
const KEY = "ntv-flow";

let paused: boolean | null = null;
const listeners = new Set<() => void>();

/** Whether the reader paused the flow, read from storage once per document. */
function isPaused(): boolean {
  if (paused === null) {
    try {
      paused = localStorage.getItem(KEY) === "paused";
    } catch {
      paused = false;
    }
  }
  return paused;
}

/**
 * Mirrors the choice on <html data-flow="on|paused">, where the CSS reads
 * it; the attribute being there at all says the toggle has mounted.
 */
function mirror() {
  document.documentElement.dataset.flow = isPaused() ? "paused" : "on";
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  mirror();
  return () => {
    listeners.delete(fn);
  };
}

function setPaused(next: boolean) {
  paused = next;
  try {
    if (next) localStorage.setItem(KEY, "paused");
    else localStorage.removeItem(KEY);
  } catch {}
  mirror();
  listeners.forEach((fn) => fn());
}

/**
 * Pause and Play for every flowing light on the page: the landing's round
 * transport button, its label and icon changing with what a press will
 * do, as the explorer's Pause does. Drawn only where something flows
 * (saas.css §3: the mesh's gate, once this has mounted), so reduced
 * motion, the still tier, weak hardware and a page without script never
 * see a control that would do nothing.
 */
export function FlowToggle({ pause, play }: { pause: string; play: string }) {
  const still = useSyncExternalStore(subscribe, isPaused, () => false);
  return (
    <RoundButton
      icon={still ? "play" : "pause"}
      label={still ? play : pause}
      onClick={() => setPaused(!still)}
      className="saas-flow-toggle"
    />
  );
}

export function LiveMesh({ blobs, drift = 1 }: { blobs: readonly CSSProperties[]; drift?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const surface = ref.current?.parentElement;
    if (!surface) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute("data-live", e.isIntersecting);
    });
    io.observe(surface);
    return () => {
      io.disconnect();
      surface.removeAttribute("data-live");
    };
  }, []);

  return (
    <span ref={ref} aria-hidden className="saas-mesh" style={{ "--drift": drift } as CSSProperties}>
      {blobs.map((style, n) => (
        <span key={n} style={style} />
      ))}
    </span>
  );
}

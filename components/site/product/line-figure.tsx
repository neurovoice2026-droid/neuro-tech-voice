"use client";

import { useEffect, useId, useRef } from "react";
import type { gsap } from "gsap";
import { useKitContext, type Kit } from "./motion-kit";

/* ------------------------------------------------------------------ *
 * The drawing kit for the product pages' line figures.
 *
 * Hairlines on page stock: dotted secondary strokes, lines that fade in
 * from nothing and stop short of the nodes they meet, a word or two in
 * grey and black. GSAP moves them (DrawSVG for strokes, MotionPath for
 * travellers); each figure plays only while on screen and rests complete
 * and still when reduced motion is on.
 * ------------------------------------------------------------------ */

export const INK = "#000000";
export const MUTED = "#6b6878";
export const VIOLET = "#551a89";
export const BG = "var(--pp-bg)";
export const LINE = 1.6;
export const DOTS = "0.01 4.6";
export const label = { fontSize: 14, letterSpacing: "0.01em" } as const;

export type Motion = { kit: Kit | null; play: boolean; still: boolean };

/** A usable SVG id from React's, which carries characters url(#…) dislikes. */
export function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * Builds a looping timeline over the figure and runs it while `play`.
 * With `still`, nothing is built and the markup's own resting state shows.
 */
export function useLoop(
  scope: React.RefObject<SVGSVGElement | null>,
  build: (tl: gsap.core.Timeline, q: (sel: string) => Element[], kit: Kit) => void,
  { kit, play, still }: Motion,
  dependencies: unknown[] = [],
) {
  const tl = useRef<gsap.core.Timeline | null>(null);

  useKitContext(
    kit,
    (k) => {
      if (still) return;
      const q = k.gsap.utils.selector(scope);
      const t = k.gsap.timeline({ paused: true, repeat: -1, defaults: { ease: "none" } });
      build(t, q, k);
      tl.current = t;
      return () => {
        tl.current = null;
      };
    },
    { scope, dependencies: [still, ...dependencies], revertOnUpdate: dependencies.length > 0 },
  );

  useEffect(() => {
    const t = tl.current;
    if (!t) return;
    if (play) t.play();
    else t.pause();
    // `dependencies` rebuild the timeline, which then needs telling again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, still, kit, ...dependencies]);
}

/** A stroke that fades in from nothing over `run` units, rightwards from `from`. */
export function Fade({ id, from, run, color = INK }: { id: string; from: number; run: number; color?: string }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={from} x2={from + run} y1="0" y2="0">
      <stop offset="0" stopColor={color} stopOpacity="0" />
      <stop offset="1" stopColor={color} stopOpacity="1" />
    </linearGradient>
  );
}

/**
 * A node, with a disc of page stock behind it so the lines it sits on stop
 * short of it instead of running underneath.
 */
export function Node({
  x = 0,
  y = 0,
  hollow = false,
  r = 4.4,
  color = INK,
  hidden = false,
  className,
  coreClassName,
}: {
  x?: number;
  y?: number;
  hollow?: boolean;
  r?: number;
  color?: string;
  /** Starts invisible — for travellers that sit at the origin until moved. */
  hidden?: boolean;
  className?: string;
  coreClassName?: string;
}) {
  return (
    <g className={className} opacity={hidden ? 0 : undefined}>
      <circle cx={x} cy={y} r={r + 4.5} fill={BG} />
      <circle
        className={coreClassName}
        cx={x}
        cy={y}
        r={r}
        fill={hollow ? BG : color}
        stroke={color}
        strokeWidth={LINE}
      />
    </g>
  );
}

/** The ring a node sends out when something arrives at it. */
export function Ping({ x, y, className, color = INK }: { x: number; y: number; className: string; color?: string }) {
  return <circle className={className} cx={x} cy={y} r="4.4" stroke={color} strokeWidth={LINE} opacity="0" />;
}

export function ping(tl: gsap.core.Timeline, target: Element[], at: number | string, reach = 22) {
  tl.fromTo(
    target,
    { attr: { r: 5 }, opacity: 0.5 },
    { attr: { r: reach }, opacity: 0, duration: 1, ease: "power2.out", immediateRender: false },
    at,
  );
}

export function svgProps(width: number, height: number) {
  return {
    viewBox: `0 0 ${width} ${height}`,
    className: "block h-full w-full",
    fill: "none",
    "aria-hidden": true,
  } as const;
}

export const dotted = {
  stroke: INK,
  strokeWidth: LINE,
  strokeDasharray: DOTS,
  strokeLinecap: "round",
} as const;

/** Samples y(x) into a polyline path. */
export function trace(x0: number, x1: number, y: (x: number) => number, step = 1.25) {
  let d = `M${x0} ${y(x0).toFixed(2)}`;
  for (let x = x0 + step; x < x1; x += step) d += ` L${x.toFixed(2)} ${y(x).toFixed(2)}`;
  return `${d} L${x1} ${y(x1).toFixed(2)}`;
}

/**
 * Motion vocabulary. Every curve here is either the website's own or a
 * studio-standard shape; nothing in the trailer animates linearly.
 */
import { Easing, interpolate, spring, type SpringConfig } from 'remotion';
import { FPS } from '../timing';

/* ── The site's curves ───────────────────────────────────────────── */
export const EASE = {
  /** House ease — cubic-bezier(0.16, 1, 0.3, 1). Every entrance. */
  house: Easing.bezier(0.16, 1, 0.3, 1),
  /** --nav-peel — cubic-bezier(0.7, 0, 0.2, 1). Transitions, whooshes. */
  peel: Easing.bezier(0.7, 0, 0.2, 1),
  /** #demo room crossfade — cubic-bezier(0.65, 0, 0.35, 1). */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Booked colour / reveals — cubic-bezier(0.22, 1, 0.36, 1). */
  soft: Easing.bezier(0.22, 1, 0.36, 1),
  /** power3.out (GSAP) as the site's timelines use it. */
  out3: Easing.bezier(0.215, 0.61, 0.355, 1),
  /** power2.in — exits. */
  in2: Easing.bezier(0.55, 0.085, 0.68, 0.53),
  /** power2.inOut — "the house ease for draws" (trust.css). */
  draw: Easing.bezier(0.455, 0.03, 0.515, 0.955),
  /** expo.out — the orb pickup. */
  expo: Easing.bezier(0.19, 1, 0.22, 1),
  /** Strong in — the frames before an impact. */
  in4: Easing.bezier(0.895, 0.03, 0.685, 0.22),
  /** power3.in — type leaving through its mask (accelerates away, no linger). */
  in3: Easing.bezier(0.55, 0.055, 0.675, 0.19),
} as const;

/* ── Springs ─────────────────────────────────────────────────────── */
export const SPRING = {
  /** --nav-spring: k=300 c=22 m=1 → one 7.5 % overshoot. The site's settle. */
  site: { stiffness: 300, damping: 22, mass: 1 },
  /** Snappier UI pop, still one small overshoot. */
  pop: { stiffness: 420, damping: 24, mass: 0.8 },
  /** The satisfying landing — ~18 % overshoot, two visible wobbles. */
  land: { stiffness: 210, damping: 13, mass: 1 },
  /** Heavy — logo impact, big type. */
  heavy: { stiffness: 160, damping: 18, mass: 1.4 },
  /** Critically-damped-ish glide (no overshoot) for camera moves. */
  glide: { stiffness: 90, damping: 26, mass: 1 },
  /** TYPE: a word / line rising out of its mask. ζ ≈ .8 — 90 % in ≈ .25 s, a 1.4 % overshoot, settled by ≈ .6 s. */
  text: { stiffness: 170, damping: 21, mass: 1 },
  /** TYPE: a caption word as it is spoken (quicker: ζ ≈ .87, 90 % in ≈ .18 s, no visible overshoot). */
  caption: { stiffness: 260, damping: 28, mass: 1 },
  /** TYPE: big display words — slower, heavier, one soft overshoot (ζ ≈ .72, ≈ 3 %). */
  display: { stiffness: 140, damping: 17, mass: 1 },
} satisfies Record<string, Partial<SpringConfig>>;

/**
 * A spring from 0 to 1, released from rest at dt = 0, in CLOSED FORM: exact and
 * continuous for any fractional dt (the 120 fps render samples between timeline
 * frames), no stepping, no cache. dt is in timeline (30 fps) frames; 0 for dt ≤ 0.
 * Same physics (and units) as remotion's spring(): springUnit(dt, c) ≡ spring({ frame: dt, fps: 30, config: c }).
 */
export function springUnit(dt: number, config: Partial<SpringConfig> = SPRING.text): number {
  if (dt <= 0) return 0;
  const k = config.stiffness ?? 100;
  const c = config.damping ?? 10;
  const m = config.mass ?? 1;
  const t = dt / FPS;
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  let x: number;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    x = 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  } else {
    // (remotion treats every ζ ≥ 1 as critically damped at ω0 — mirrored, so the two agree exactly)
    x = 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  return config.overshootClamping ? Math.min(1, x) : x;
}

/** Hermite smoothstep of x over [a, b] (0 → 1, C1-continuous). */
export function smooth(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Clamped interpolate with an easing — the workhorse. */
export function tween(
  frame: number,
  [start, end]: readonly [number, number],
  [from, to]: readonly [number, number],
  easing: (t: number) => number = EASE.house,
): number {
  if (end <= start) return frame < start ? from : to;
  return interpolate(frame, [start, end], [from, to], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** 0→1 progress of a spring that starts at `start`. Overshoots per config. */
export function springAt(
  frame: number,
  start: number,
  config: Partial<SpringConfig> = SPRING.site,
  durationInFrames?: number,
): number {
  return spring({ frame: frame - start, fps: FPS, config, durationInFrames });
}

/**
 * Anticipation → overshoot → settle, as ONE curve (0 → 1).
 *
 * For `anticip` frames before `start` the value dips below 0 (pulls back,
 * like a character loading a jump), then a spring carries it past 1 and
 * settles. Use for anything that should read as "alive".
 */
export function aos(
  frame: number,
  start: number,
  {
    anticip = 6,
    depth = 0.08,
    config = SPRING.site,
  }: { anticip?: number; depth?: number; config?: Partial<SpringConfig> } = {},
): number {
  if (frame < start - anticip) return 0;
  if (frame < start) {
    // ease into the dip, sine-shaped, bottoming out at `start`
    const t = (frame - (start - anticip)) / anticip;
    return -depth * Math.sin((t * Math.PI) / 2);
  }
  const s = spring({ frame: frame - start, fps: FPS, config });
  // blend out of the dip over the first frames of the spring
  const recover = Math.max(0, 1 - (frame - start) / 4);
  return s - depth * recover * (1 - s);
}

/** Linear map helper for already-eased 0..1 values. */
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 0..1 window: rises over [a, b], falls over [c, d]. */
export function windowed(
  frame: number,
  a: number,
  b: number,
  c: number,
  d: number,
  easeIn = EASE.house,
  easeOut = EASE.in2,
): number {
  if (frame < a || frame > d) return 0;
  if (frame < b) return tween(frame, [a, b], [0, 1], easeIn);
  if (frame <= c) return 1;
  return tween(frame, [c, d], [1, 0], easeOut);
}

/**
 * Velocity of any per-frame function (units per frame). NOT for simulated
 * motion blur any more (the film renders at 120 fps; fast moves read crisply):
 * use it for physics (lean, squash, follow-through).
 */
export function velocity(fn: (f: number) => number, frame: number): number {
  return (fn(frame + 0.5) - fn(frame - 0.5));
}

/** A slow, deterministic drift (breathing) — no linear motion even at rest. */
export function breathe(frame: number, period = 90, amp = 1, phase = 0): number {
  return Math.sin(((frame / period) * Math.PI * 2) + phase) * amp;
}

/** Mix two hex colours (t = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * Math.min(1, Math.max(0, t)));
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0')}`;
}

/**
 * REEL 6 · THE TOKENS (docs/ig/ig6/STYLE.md §9.3–§9.8): colours, the shadow, the parallax factors, the type specs and
 * the lockup positions of the "minimal faceless" look. Picture only (a subfolder: outside ig6Hash). The scene build
 * (Camera, Dial, Hand, Lockup, Transitions, End6) reads everything from here; the placeholders already do.
 */

/* ── colour (§9.3): white ground, near-black ink, grey tier, ONE accent — teal ── */
export const INK = {
  ground: '#FFFFFF',
  ink: '#0A0A0A',
  tier: '#6B6B6B',
  /** the set state of a frame-0 / tier word before its onset: its colour mixed this far toward full ink (72 %) */
  setInk: 0.72,
  tickMinor: '#D6D6D6',
  tickSec: '#9A9A9A',
  tickMajor: '#222222',
  pending: '#D6D6D6',
  teal: '#0A8AA8',
  tealDeep: '#0E7490',
  tealRim: '#052A33',
  tealHi: '#A5EAF5',
  graphite: '#3A3A3A',
  fieldBorder: '#E6E6E6',
} as const;
/** the dome gradients (§9.3: SVG radialGradient cx 30 % cy 30 %; a 1 px tealRim rim at 40 %) */
export const DOME = {
  teal: [
    [0, '#A5EAF5'],
    [0.45, '#0A8AA8'],
    [0.8, '#0E7490'],
    [1, '#052A33'],
  ],
  graphite: [
    [0, '#8A8A8A'],
    [0.45, '#3A3A3A'],
    [0.8, '#2A2A2A'],
    [1, '#151515'],
  ],
} as const;

/* ── the shadow (§9.4): on a NON-ROTATING wrapper; the dial casts none; never under text ── */
export const SHADOW = {
  long: { dx: 24, dy: 48, blur: 10, color: 'rgba(10,10,10,.07)' },
  dome: { dx: 6, dy: 10, blur: 4, color: 'rgba(10,10,10,.18)' },
} as const;
export const dropShadow = (s: { dx: number; dy: number; blur: number; color: string }, scale = 1) =>
  `drop-shadow(${(s.dx * scale).toFixed(2)}px ${(s.dy * scale).toFixed(2)}px ${(s.blur * scale).toFixed(2)}px ${s.color})`;

/* ── the camera's planes (§9.6) ── */
export const PARALLAX = { dial: 1, hand: 1.12, hub: 1.15, lockup: 0 } as const;
/** the dial at M1 (world = screen): centre, radius; the hand's pivot, length and angle; the reading point (§1.6, §9.5) */
export const DIAL = { cx: -9, cy: 1814, R: 1623 } as const;
export const HAND = { pivot: { x: 97, y: 1183 }, length: 1095, angle: 30, hubD: 96, domeD: 54 } as const;
export const READING_POINT = { x: 601, y: 310 } as const;

/* ── the finish (§9.12): flat white, no paper grain (the probe may ask for a static dither, §9.4) ── */
export const FINISH6 = { paper: 0, dark: 0, dither: 0 } as const;

/* ── type (§9.2, §9.8) ── */
export const FACE = {
  sans: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif',
  serif: '"Cormorant Garamond", serif',
} as const;
/** the three tiers: lead (sans 580, −0.03em), accent (serif italic 600, −0.01em, teal), sentence tier (sans 450, grey) */
export const TIER = {
  lead: { weight: 580, tracking: -0.03 },
  accent: { weight: 600, tracking: -0.01 },
  tier: { size: 32, weight: 450, tracking: 0 },
} as const;
/** the lockup positions (screen px, the lockup screen-locked; §9.8): lead size / x / baseline, accent size / x / baseline,
 *  the tier centred on `tierX` (null: under the accent's centre) at its baselines (one per tier row) */
export type LayoutSpec = {
  lead: { size: number; x: number; base: number };
  accent: { size: number; x: number; base: number };
  tier: { x: number | null; base: readonly number[] };
  /** centred on x 540 (the end card), else left-aligned at x */
  centred?: boolean;
};
export const LAYOUT: Record<'hook1a' | 'hook1b' | 'default' | 'underline' | 'wide' | 'cta', LayoutSpec> = {
  hook1a: { lead: { size: 69, x: 345, base: 1150 }, accent: { size: 126, x: 330, base: 1236 }, tier: { x: 580, base: [1296] } },
  hook1b: { lead: { size: 66, x: 360, base: 1150 }, accent: { size: 120, x: 345, base: 1230 }, tier: { x: 617, base: [1292] } },
  default: { lead: { size: 60, x: 411, base: 1160 }, accent: { size: 110, x: 396, base: 1235 }, tier: { x: null, base: [1290, 1328] } },
  underline: { lead: { size: 60, x: 411, base: 1150 }, accent: { size: 110, x: 396, base: 1225 }, tier: { x: null, base: [1282] } },
  wide: { lead: { size: 60, x: 311, base: 1160 }, accent: { size: 100, x: 296, base: 1235 }, tier: { x: 596, base: [1290] } },
  cta: { lead: { size: 60, x: 540, base: 760 }, accent: { size: 110, x: 540, base: 845 }, tier: { x: 540, base: [905] }, centred: true },
};

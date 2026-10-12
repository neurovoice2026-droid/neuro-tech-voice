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
/** a text svg painted through a transparency group: Skia then antialiases its glyphs in greyscale, never LCD (crit-r1 N3:
 *  colour fringes on the small grey type), and it is NOT a composited layer, so the compositor has nothing to drop or
 *  serve stale (crit-r2 D1: `will-change: transform` lost whole lockups on random single frames of a full render) */
export const GREY_AA = 0.999;
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
  hook1b: { lead: { size: 66, x: 360, base: 1140 }, accent: { size: 120, x: 345, base: 1230 }, tier: { x: 617, base: [1292] } },
  default: { lead: { size: 60, x: 411, base: 1150 }, accent: { size: 110, x: 396, base: 1235 }, tier: { x: null, base: [1302, 1340] } },
  underline: { lead: { size: 60, x: 411, base: 1140 }, accent: { size: 110, x: 396, base: 1225 }, tier: { x: null, base: [1282] } },
  wide: { lead: { size: 60, x: 311, base: 1156 }, accent: { size: 100, x: 296, base: 1235 }, tier: { x: 596, base: [1290] } },
  cta: { lead: { size: 60, x: 540, base: 760 }, accent: { size: 110, x: 540, base: 845 }, tier: { x: 540, base: [905] }, centred: true },
};

/* ── the scene build's geometry (SCRIPT §1–§3, §8; STYLE §9.5–§9.11) ── */
/** the dial's marks (M1 world px, radii from the dial centre; STYLE §9.5): rim 9 px at R; ticks inside it */
export const MARKS = {
  rim: 9,
  /** fine ticks every 0.75° (≈ 20 px along the band: 8 per 6° second, so seconds and majors still coincide) — the
   *  reference's fine instrument scale (STYLE §1.1 measured ≈ 0.85°; crit-r2 P6: 1.2° read coarse beside it). M5′ keeps
   *  1.2° (FULL), where 0.75° would turn to moiré */
  minor: { every: 0.75, r0: 1512, r1: 1554, w: 2, color: '#D6D6D6' },
  sec: { every: 6, r0: 1505, r1: 1556, w: 3, color: '#9A9A9A' },
  major: { every: 36, r0: 1497, r1: 1560, w: 4, color: '#222222' },
  /** a hollow ring node (your phone): r 9, stroke 6 → outer Ø 24, white centre Ø 12 */
  node: { r: 9, w: 6 },
  /** an answered call (the agent): a filled teal dome, Ø 26 */
  dome: { r: 13 },
  /** one ring = 2 s of tone = 12° of dial after its node (ANSI T1.401 "2 sec on, 4 sec off"); a node every 36° */
  stretch: 12,
  nodeEvery: 36,
  nodes: 10,
} as const;
/** the dial angle φ of node 1 sits at world angle φ + PHI0 + ρ at M1; the needle crosses the rim at the reading point */
export const PHI0 = 28.1;
/** M5′: the whole dial, drawn upright (φ 0 at the top) as its own picture (STYLE §9.6). crit-r2 P2: its macro drift
 *  (+1.5 %/s) grows it DOWNWARD about its top point, which stays at y 100 — clear of the frame's edge and of the apps'
 *  status band, so the 12 o'clock dome (the pickup's call, where the day starts and lands) is never cut (at R 460 about
 *  its centre the rim reached the edge mid-shot). R 420 at the shot's start, ≈ 440 at its end: the rim at x ≤ 860 and the
 *  needle inside x 880 below y 840 (TikTok's rail), the needle pointing down above y ≈ 1005 (the lockup box from 1080) */
export const FULL = {
  cx: 536,
  /** the dial's top point (the drift's fixed point) and its radius at drift 1; the centre is top + R */
  top: 100,
  R: 420,
  cy: 520,
  /** the hand redrawn at the true centre, scaled (0.441 × 420 / 460: 441 px long, hub Ø 39, dome Ø 22): HAND_FULL */
  hand: 0.4027,
  rim: 5,
  stretch: 5,
  /** ticks as fractions of R (the M1 radii / 1623); every class ≥ 2 px and ≥ 30 % ink on screen (crit-r1 N5: at
   *  M1's #E2E2E2 / 1.5 px the minor ticks antialiased away at phone size) */
  minor: { r0: 0.934, r1: 0.958, w: 2, color: '#B5B5B5' },
  sec: { r0: 0.927, r1: 0.959, w: 2.5, color: '#8A8A8A' },
  major: { r0: 0.918, r1: 0.962, w: 3.5, color: '#222222' },
  node: { r: 7.8, w: 4.5 },
  /** domes keep a constant screen Ø 28 */
  dome: { r: 14 },
} as const;
/** M3′ (the tip macro) and M2′ (the hub macro) (STYLE §9.6) */
export const CROPS = {
  m3: { zoom: 1.8, punch: 0.3, lift: 90 },
  m2: { anchor: { x: 260, y: 900 }, zoom: 2.2 },
  /** the macro drift: +1.5 % per second about the shot's focus (never frozen) */
  drift: 0.015,
} as const;
/** the end card (SCRIPT §8; the field kept left of TikTok's rail: x ≤ 880 below y 840) */
export const END6 = {
  field: { x0: 200, x1: 880, y0: 940, y1: 1060, r: 60, icon: { x: 236, size: 44 }, textX: 300, textSize: 50 },
  send: { cx: 820, cy: 1000, d: 72 },
  url: { base: 1006, size: 34, weight: 450 },
  /** the wordmark: 720 px wide, its cap line centred on y 830 (y 760–900); the full stop 12 px after the R */
  wordmark: { w: 720, capMid: 830, gap: 12 },
} as const;

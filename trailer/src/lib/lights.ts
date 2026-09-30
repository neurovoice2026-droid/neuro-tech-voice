/**
 * THE FOUR LIGHTS: pure, deterministic colour helpers for them (theme.ts LIGHTS).
 *
 *   mixColor / mixPalette   perceptual blends: OKLab for neighbouring hues
 *                           (lightness and chroma kept), round the cool side
 *                           of the wheel for far ones (rose ↔ emerald): never
 *                           a brown-grey middle, never through orange
 *   blendPalettes           a weighted mix of any number of palettes
 *   ALL_LIGHTS / ALL_GLOW   the four merged into one orb (the CTA)
 *   paletteAt / lightAt     eased sequences of light changes on a timeline
 *   GLOW                    each light's two glow colours (body, core)
 *   bloom / rimGlow / textGlow / ring / inkFor   CSS for light of a colour
 *   NIGHT_ROOMS             each light's own dark room (derived, see below)
 *
 * Every function here depends only on its arguments: no clocks, no randomness.
 * Palettes are five hex colours, darkest first, the order the FluidOrb
 * (<Orb>, <OrbGroup>) and <MeshOrb> read them in.
 */
import { LIGHTS, LIGHT_ORDER, type LightId, type Palette } from '../theme.ts';
import { BEAT } from '../timing.ts';

/* ── OKLab (Björn Ottosson, 2020) ─────────────────────────────── */

export type Lab = readonly [L: number, a: number, b: number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** '#rrggbb' (or '#rgb') → [r, g, b] in 0..1. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const byte = (c: number) => Math.round(clamp01(c) * 255);
const rgbToHex = (r: number, g: number, b: number) =>
  `#${((byte(r) << 16) | (byte(g) << 8) | byte(b)).toString(16).padStart(6, '0')}`;

export function toOklab(hex: string): Lab {
  const [R, G, B] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labToLinear([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (c: readonly number[]) => c.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLab → '#rrggbb'. Out-of-gamut colours lose chroma (never lightness or hue) until they fit. */
export function fromOklab(lab: Lab): string {
  let lin = labToLinear(lab);
  if (!inGamut(lin)) {
    const [L, a, b] = lab;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(labToLinear([L, a * mid, b * mid]))) lo = mid;
      else hi = mid;
    }
    lin = labToLinear([L, a * lo, b * lo]);
  }
  return rgbToHex(toGamma(clamp01(lin[0])), toGamma(clamp01(lin[1])), toGamma(clamp01(lin[2])));
}

/** OKLCH (hue in degrees) → hex, gamut-mapped. */
export const fromOklch = (L: number, C: number, hDeg: number) =>
  fromOklab([L, C * Math.cos((hDeg * Math.PI) / 180), C * Math.sin((hDeg * Math.PI) / 180)]);

/** hex → [L, C, hue°]. */
export function toOklch(hex: string): [number, number, number] {
  const [L, a, b] = toOklab(hex);
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

/**
 * The chroma a blend keeps. A straight line through OKLab loses chroma in
 * the middle when the two hues differ; between neighbouring hues (the
 * mean vector still long: violet↔rose, teal↔violet, emerald↔teal) that loss
 * is given back, so the middle stays as vivid as the ends and keeps the
 * straight line's hue. Between near-opposite hues (rose↔emerald) the mean
 * hue means nothing (restoring chroma there would invent a coral), so the
 * blend is left as it is, at its own lightness.
 */
function keepChroma(a: number, b: number, meanChroma: number): [number, number] {
  const c = Math.hypot(a, b);
  if (c < 1e-6 || meanChroma <= c) return [a, b];
  const f = smoothstep(0.35, 0.8, c / meanChroma);
  const s = 1 + (meanChroma / c - 1) * f;
  return [a * s, b * s];
}

/** The warm sector's middle (orange-yellow, OKLCH hue°): ember is spent only on "Booked", so no blend passes through it. */
const WARM = 70;
/** Hues further apart than this (and both clearly coloured) blend around the wheel instead of across it. */
const FAR_HUES = 120;

/**
 * Mix two colours (t: 0 → a, 1 → b), perceptually:
 *  - neighbouring hues (violet ↔ rose, teal ↔ violet, emerald ↔ teal) go the
 *    straight way through OKLab, keeping the ends' chroma in the middle;
 *  - far-apart hues (rose ↔ emerald), whose straight line runs through a
 *    dull brown-grey, go round the wheel in OKLCH — the cool way, through
 *    violet and blue (the night's and Sunday's own light), never through
 *    orange, which the brand keeps for "Booked".
 */
export function mixColor(a: string, b: string, t: number): string {
  const k = clamp01(t);
  if (k <= 0) return a;
  if (k >= 1) return b;
  const A = toOklab(a);
  const B = toOklab(b);
  const cA = Math.hypot(A[1], A[2]);
  const cB = Math.hypot(B[1], B[2]);
  const L = lerp(A[0], B[0], k);
  if (Math.min(cA, cB) > 0.03) {
    const hA = (Math.atan2(A[2], A[1]) * 180) / Math.PI;
    const hB = (Math.atan2(B[2], B[1]) * 180) / Math.PI;
    const up = (((hB - hA) % 360) + 360) % 360; // the arc with rising hue
    if (Math.min(up, 360 - up) > FAR_HUES) {
      const warmUp = ((((WARM - hA) % 360) + 360) % 360) < up;
      const d = warmUp ? up - 360 : up;
      // a little softer half-way round, so the pass reads as light going by, not as a fifth colour
      return fromOklch(L, lerp(cA, cB, k) * (1 - 0.22 * Math.sin(Math.PI * k)), hA + d * k);
    }
  }
  const [x, y] = keepChroma(lerp(A[1], B[1], k), lerp(A[2], B[2], k), lerp(cA, cB, k));
  return fromOklab([L, x, y]);
}

export type MixOptions = {
  /**
   * 0 (all stops together) … 0.2. The stops change one after another, so for
   * a while the orb holds both lights at once (fields of the old colour
   * folding into the new) instead of one averaged colour. Use it between
   * far-apart hues (rush ↔ closing), where any average is dull.
   */
  stagger?: number;
  /** Which end changes first with a stagger: 'light' (the highlights; the new light floods in) or 'dark'. */
  lead?: 'light' | 'dark';
};

/** Mix two 5-colour palettes in OKLab (t: 0 → a, 1 → b). Returns a palette Orb / OrbGroup / MeshOrb accept. */
export function mixPalette(a: Palette, b: Palette, t: number, { stagger = 0, lead = 'light' }: MixOptions = {}): string[] {
  const n = Math.min(a.length, b.length);
  const s = Math.max(0, Math.min(0.2, stagger));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const j = lead === 'light' ? n - 1 - i : i;
    const ti = s > 0 ? clamp01((t - j * s) / (1 - (n - 1) * s)) : t;
    out.push(mixColor(a[i], b[i], ti));
  }
  return out;
}

/** A weighted mix of any number of palettes (weights need not sum to 1), stop by stop in OKLab. */
export function blendPalettes(parts: readonly { palette: Palette; weight: number }[]): string[] {
  const live = parts.filter((p) => p.weight > 0);
  if (live.length === 0) return [...(parts[0]?.palette ?? LIGHTS.night.orb)];
  if (live.length === 1) return [...live[0].palette];
  const W = live.reduce((s, p) => s + p.weight, 0);
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    let L = 0;
    let x = 0;
    let y = 0;
    let c = 0;
    for (const p of live) {
      const [l, a, b] = toOklab(p.palette[i]);
      const w = p.weight / W;
      L += l * w;
      x += a * w;
      y += b * w;
      c += Math.hypot(a, b) * w;
    }
    const [ka, kb] = keepChroma(x, y, c);
    out.push(fromOklab([L, ka, kb]));
  }
  return out;
}

/**
 * The four lights as ONE orb, for the CTA merge. Not an average (the four
 * hues cancel to a dusty lavender, see blendPalettes): each light keeps a
 * slot of its own on the ramp, so the fluid folds a sea-green (Sunday's
 * teal into closing's emerald), the night's electric and the rush's rose
 * light through each other over the night's deep. The night leads (the
 * brand's violet holds the middle of the ramp); the others are the light
 * it throws.
 */
export const ALL_LIGHTS: Palette = [
  LIGHTS.night.orb[0], // #14062b — the night's deep
  mixColor(LIGHTS.sunday.orb[1], LIGHTS.closing.orb[2], 0.4), // #00908d — Sunday into closing
  LIGHTS.night.orb[2], // #7c3aed — electric
  LIGHTS.rush.orb[3], // #f9b4d6 — the rush's light
  LIGHTS.closing.orb[4], // #f0fdf8 — closing's paper
];

/** The merged orb's glow: electric leaning to rose, a rose-white core. */
export const ALL_GLOW = { body: mixColor(LIGHTS.night.orb[2], LIGHTS.rush.orb[2], 0.3), core: LIGHTS.rush.orb[3] } as const;

/* ── Sequences on the timeline ─────────────────────────────────── */

/**
 * The FluidOrb's own palette ease (fluid-orb.tsx eases every channel by
 * 1 − e^(−7·dt), ≈ 97 % in half a second), normalised to land exactly at 1:
 * it moves on the frame of the change and settles, never linear.
 */
export const EASE_LIGHT = (u: number) => {
  const k = 3.6;
  return (1 - Math.exp(-k * clamp01(u))) / (1 - Math.exp(-k));
};

type Keyed = { at: number; frames?: number; ease?: (t: number) => number };

/**
 * Where a key sequence is at `frame`: the index of the key whose change is
 * current and that change's eased progress (0..1). Keys must be sorted by
 * `at`. Key 0 is the state before and at the start.
 */
function progress<K extends Keyed>(frame: number, keys: readonly K[], easeFrames: number, ease: (t: number) => number) {
  let k = 0;
  for (let i = 1; i < keys.length; i++) if (frame >= keys[i].at) k = i;
  if (k === 0) return { k, e: 1 };
  const key = keys[k];
  const len = key.frames ?? easeFrames;
  const e = len <= 0 ? 1 : (key.ease ?? ease)(clamp01((frame - key.at) / len));
  return { k, e };
}

export type PaletteKey = Keyed & {
  /** The palette this key changes to (from wherever the previous keys had got). */
  palette: Palette;
  /** Stagger for this change (see MixOptions); defaults to the call's. */
  stagger?: number;
};

/**
 * A palette that changes over time: each key eases from wherever the
 * palette is at its `at` (so a change may start before the last one has
 * landed) to its own palette over `frames` (default `easeFrames`).
 *
 *   paletteAt(t, [
 *     { at: 0, palette: LIGHTS.rush.orb },
 *     { at: b(2), palette: LIGHTS.closing.orb, stagger: 0.14 },
 *     { at: b(4), palette: LIGHTS.sunday.orb },
 *   ])
 */
export function paletteAt(
  frame: number,
  keys: readonly PaletteKey[],
  easeFrames: number = BEAT,
  ease: (t: number) => number = EASE_LIGHT,
  opts: MixOptions = {},
): string[] {
  if (keys.length === 0) return [...LIGHTS.night.orb];
  const { k, e } = progress(frame, keys, easeFrames, ease);
  if (k === 0) return [...keys[0].palette];
  const from = paletteAt(keys[k].at, keys.slice(0, k), easeFrames, ease, opts);
  return mixPalette(from, keys[k].palette, e, { ...opts, stagger: keys[k].stagger ?? opts.stagger ?? 0 });
}

/* ── Light states: everything a moment's light paints ─────────── */

/** The two colours a light shines with: `body` (its bloom, halo) and `core` (its rim, hot centre). */
export type Glow = { body: string; core: string };

/** Each light's glow, from its orb: the saturated middle and the light slot. */
export const GLOW: Record<LightId, Glow> = {
  rush: { body: LIGHTS.rush.orb[2], core: LIGHTS.rush.orb[3] },
  closing: { body: LIGHTS.closing.orb[2], core: LIGHTS.closing.orb[3] },
  sunday: { body: LIGHTS.sunday.orb[2], core: LIGHTS.sunday.orb[3] },
  night: { body: LIGHTS.night.orb[2], core: LIGHTS.night.orb[3] },
};

export type LightState = {
  /** Each light's share (sum 1): opacity for its ground in <LightGround>. */
  weights: Record<LightId, number>;
  /** The light with the largest share. */
  lead: LightId;
  /** The orb's palette (and its caller-speaking twin, for Orb paletteB/mixB). */
  orb: string[];
  listen: string[];
  /** The light's glow colours, blended. */
  glow: Glow;
  /** Text in the light's colour on a dark ground (the core, like lilac on the night). */
  inkLit: string;
};

export type LightKey = Keyed & { light: LightId; stagger?: number };

const oneHot = (id: LightId): Record<LightId, number> => ({ rush: 0, closing: 0, sunday: 0, night: 0, [id]: 1 });

/**
 * The light at `frame` for a sequence of light changes (same key rules as
 * paletteAt). One call gives the orb palettes, the glow and the ground
 * weights, all on the same curve.
 *
 *   const L = lightAt(t, [{ at: 0, light: 'rush' }, { at: b(4), light: 'night', frames: b(1) }]);
 *   <Orb palette={L.orb} paletteB={L.listen} mixB={listen} … />
 *   <div style={{ background: bloom(L.glow, 0.8) }} />
 *   <LightGround weights={L.weights} />
 */
export function lightAt(
  frame: number,
  keys: readonly LightKey[],
  easeFrames: number = BEAT,
  ease: (t: number) => number = EASE_LIGHT,
  opts: MixOptions = {},
): LightState {
  const state = (id: LightId): LightState => ({
    weights: oneHot(id),
    lead: id,
    orb: [...LIGHTS[id].orb],
    listen: [...LIGHTS[id].listen],
    glow: GLOW[id],
    inkLit: GLOW[id].core,
  });
  if (keys.length === 0) return state('night');
  const { k, e } = progress(frame, keys, easeFrames, ease);
  if (k === 0) return state(keys[0].light);
  const from = lightAt(keys[k].at, keys.slice(0, k), easeFrames, ease, opts);
  const to = state(keys[k].light);
  const mo = { ...opts, stagger: keys[k].stagger ?? opts.stagger ?? 0 };
  const weights = { ...from.weights };
  for (const id of LIGHT_ORDER) weights[id] = lerp(from.weights[id], to.weights[id], e);
  const lead = LIGHT_ORDER.reduce((m, id) => (weights[id] > weights[m] ? id : m), LIGHT_ORDER[0]);
  const glow = { body: mixColor(from.glow.body, to.glow.body, e), core: mixColor(from.glow.core, to.glow.core, e) };
  return {
    weights,
    lead,
    orb: mixPalette(from.orb, to.orb, e, mo),
    listen: mixPalette(from.listen, to.listen, e, mo),
    glow,
    inkLit: glow.core,
  };
}

/* ── Rooms ─────────────────────────────────────────────────────── */

/**
 * Each light's night room. The site has one dark room (the night's indigo,
 * LIGHTS.night.ground) and three light ones; the trailer lives mostly in
 * the dark, so this is the night room re-lit in each hue: the same four
 * stops, the same OKLab lightness and chroma, at the light's own hue.
 * Derived, not on the site; the night's is its ground verbatim.
 */
export const NIGHT_ROOMS: Record<LightId, string> = (() => {
  const stops = ['#34288f', '#1f1860', '#110c38', '#08061c'].map(toOklch);
  const at = [0, 36, 68, 100];
  const room = (hue: number) =>
    `radial-gradient(120% 100% at 50% 40%, ${stops
      .map(([L, C], i) => `${fromOklch(L, C, hue)} ${at[i]}%`)
      .join(', ')})`;
  const hueOf = (id: LightId) => toOklch(LIGHTS[id].orb[1])[2];
  return {
    rush: room(hueOf('rush')),
    closing: room(hueOf('closing')),
    sunday: room(hueOf('sunday')),
    night: LIGHTS.night.ground,
  };
})();

/* ── CSS: light of a given colour ──────────────────────────────── */

export type LightLike = LightId | Glow | string;

const isLightId = (x: unknown): x is LightId => typeof x === 'string' && Object.prototype.hasOwnProperty.call(LIGHTS, x);

/** Resolve a light id, a Glow, or one hex colour (its core is derived: lighter, softer). */
export function glowOf(light: LightLike): Glow {
  if (typeof light !== 'string') return light;
  if (isLightId(light)) return GLOW[light];
  const [L, C, h] = toOklch(light);
  return { body: light, core: fromOklch(Math.max(L, 0.84), C * 0.55, h) };
}

/** '#rrggbb' + alpha → 'rgb(r g b / a)'. */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${byte(r)} ${byte(g)} ${byte(b)} / ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/**
 * The site's pool falloff (palettes.ts PLAN_LIGHTS: seven stops, a
 * gaussian, so no pool shows an edge), as fractions of the pool's alpha.
 */
const POOL = [
  [0, 1],
  [20, 0.835],
  [35, 0.576],
  [50, 0.325],
  [65, 0.149],
  [80, 0.056],
  [100, 0],
] as const;

const pool = (hex: string, a: number, shape: string) =>
  `radial-gradient(${shape}, ${POOL.map(([p, k]) => `${rgba(hex, a * k)} ${p}%`).join(', ')})`;

export type BloomOptions = {
  /** Centre of the pool within the element (CSS position). Default '50% 50%'. */
  at?: string;
  /** How much white-hot core sits in the middle, 0..1. Default 0.45. */
  core?: number;
  /** Core size relative to the pool. Default 0.42. */
  coreSize?: number;
};

/**
 * A pool of light (a CSS `background`): the light's body colour falling off
 * like a gaussian to nothing at the element's edge, with a smaller, hotter
 * core. Put it on an element BEHIND the subject and a good deal larger than
 * it (2–3× an orb's diameter). On dark grounds add `mixBlendMode: 'screen'`
 * for an additive glow; on the light rooms leave it normal. `strength` 1 is
 * a full glow, alpha 0.62 at the centre.
 */
export function bloom(light: LightLike, strength = 1, { at = '50% 50%', core = 0.45, coreSize = 0.42 }: BloomOptions = {}): string {
  const g = glowOf(light);
  const s = Math.max(0, strength);
  const layers: string[] = [];
  if (core > 0) {
    // the pool's radius is the element's closest side (50 %); the core is that × coreSize
    const k = (coreSize * 50).toFixed(1);
    layers.push(pool(g.core, 0.5 * core * s, `${k}% ${k}% at ${at}`));
  }
  layers.push(pool(g.body, 0.62 * s, `closest-side at ${at}`));
  return layers.join(', ');
}

/**
 * The rim light for a round element (a CSS `box-shadow`): a halo hugging the
 * edge in the light's core colour, a wider spill in its body colour, and a
 * soft contact shadow below, tinted with the light's deep. `strength` 0..1
 * (≈ ORB_RIM's alpha), `spread` scales the radii (1 = sized for a ~400 px orb).
 * `shadow` (0..1) is independent of `strength`: 1 on the dark, ~0.35 on the
 * light rooms, 0 while the orb is not there yet.
 * Put it on a div of the orb's size behind the canvas (never on the canvas).
 */
export function rimGlow(light: LightLike, strength = 0.4, spread = 1, { shadow = 1 }: { shadow?: number } = {}): string {
  const g = glowOf(light);
  const deep = isLightId(light) ? LIGHTS[light].orb[0] : '#08061c';
  const s = Math.max(0, strength);
  const parts = [
    `0 0 ${(26 * spread).toFixed(1)}px ${(2 * spread).toFixed(1)}px ${rgba(g.core, s)}`,
    `0 0 ${(90 * spread).toFixed(1)}px ${(8 * spread).toFixed(1)}px ${rgba(g.body, s * 0.42)}`,
  ];
  if (shadow > 0) parts.push(`0 ${(30 * spread).toFixed(1)}px ${(60 * spread).toFixed(1)}px ${(-20 * spread).toFixed(1)}px ${rgba(mixColor(deep, '#000000', 0.45), 0.7 * shadow)}`);
  return parts.join(', ');
}

/** A glow around type (a CSS `text-shadow`), in the light's body colour. Keep it subtle: 0.2–0.6. */
export function textGlow(light: LightLike, strength = 0.4): string {
  const g = glowOf(light);
  return `0 0 ${18}px ${rgba(g.body, strength)}, 0 0 ${46}px ${rgba(g.body, strength * 0.5)}`;
}

/** The light's ring colour (its `wave`) at alpha `a` — the rings that leave the orb when the phone rings. */
export function ring(light: LightId, a: number): string {
  const m = LIGHTS[light].wave.match(/rgb\((\d+)\s+(\d+)\s+(\d+)/);
  const [r, g, b] = m ? [m[1], m[2], m[3]] : ['185', '163', '255'];
  return `rgb(${r} ${g} ${b} / ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** Text in a light: its site ink on the light rooms / white, its core on a dark ground. */
export const inkFor = (light: LightId, on: 'light' | 'dark') => (on === 'light' ? LIGHTS[light].ink : GLOW[light].core);


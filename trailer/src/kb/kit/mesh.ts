/**
 * THE MESH, as pure math (no React, Node-safe): the site's gradient mesh (app/globals.css
 * .pp-mesh-flow / .pp-mesh-flow-b / .pp-mesh-shade, painted from a five-colour palette by
 * components/site/product/primitives.tsx <Orb mesh>) laid out over a whole frame, every pool on its
 * own slow clocks like components/site/home/mesh-flow.ts — a pure function of fractional time.
 *
 * THE RECIPE (globals.css :1422–1468), as the site writes it:
 *   .pp-mesh-flow    inset −20 %; five radial pools over the floor --m2:
 *                      42 % at 26/24 → m4 · 40 % at 80/26 → m2 · 46 % at 76/80 → m0 ·
 *                      40 % at 20/78 → m3 · 28 % at 50/52 → m1
 *                    filter: blur(3.5cqw) saturate(1.35); drifts over 14 s (alternate)
 *   .pp-mesh-flow-b  a second, looser field turning the other way over 21 s: 22 % at 62/40 → m4,
 *                    24 % at 34/56 → m1, opacity .75
 *   .pp-mesh-shade   lit from the top left (white .22 at 30/24, gone by 30 %) and the shadow side
 *                    falling to the palette's own m0 at 55 % (from 58 % to the corner), never grey
 *   .pp-noise        a fixed-size grain over it all (→ components/Grain, see MeshGround)
 *
 * HOW IT IS GENERALISED to a frame (both orientations, one design):
 *   · positions keep the −20 % inset: a pool at p % of the flow element sits at (−.2 + 1.4 p) of
 *     the frame; radii are p % of 1.4 × the frame's geometric size G = √(W·H), stretched halfway
 *     towards the frame's aspect (rx = R·√(W/G), ry = R·√(H/G)) — round-ish pools in 16:9 AND 9:16;
 *   · blur(3.5cqw) on a linear "colour → transparent" pool ≈ a soft cone: each pool here is a
 *     GAUSSIAN with the same mass (e^(−3 r²), tapered to exactly 0 at its rim, 26 stops), so it has no
 *     edge and no kink, and no blur filter is ever run;
 *   · saturate(1.35) is applied to the colours themselves (OKLCH chroma × 1.35, gamut-mapped);
 *   · the field's 14 s drift becomes each pool's own two clocks (sideways / up-down, 28 s cycles —
 *     the site's 14 s alternate — scaled per pool by 0.8–1.4) plus a slow breath of its radius
 *     (the site's scale 1 → 1.12); the b-field's two pools turn about the centre, the other way,
 *     one turn per 21 s × `turn`.
 *
 * VARIANTS. `lift` 0 = "deep": the orb's own material at full strength (violet floor, white upper
 * left, indigo lower right). `lift` 1 = "light": the same pools and hues raised to a pearl (the
 * pricing cards' idiom: pale floor, soft pools, a white sheen upper left) so white UI cards read on
 * it. Anything between is a designed hand-off.
 */
import { fromOklch, mixPalette, toOklch } from '../../lib/lights.ts';
import type { Palette } from '../palettes.ts';

/* ── colour ─────────────────────────────────────────────────────── */

/** the site's saturate(1.35) */
export const MESH_SATURATE = 1.35;

/** light-variant targets per slot m0…m4: OKLCH lightness, and the share of the slot's chroma it keeps */
const LIGHT_L = [0.82, 0.9, 0.93, 0.962, 0.993] as const;
const LIGHT_C = [0.78, 0.62, 0.55, 0.72, 0.9] as const;

export type Grade = {
  /** 0 deep … 1 light (see the header) */
  lift: number;
  /** × OKLCH lightness around .5 (1 = as is) — < 1 deepens, > 1 opens */
  brightness?: number;
  /** × chroma on top of the site's 1.35 (1 = the site) */
  saturation?: number;
};

/** One slot's colour, graded. */
export function gradeColor(hex: string, slot: number, g: Grade): string {
  const [L, C, h] = toOklch(hex);
  const k = Math.min(1, Math.max(0, g.lift));
  let l = L + (LIGHT_L[slot] - L) * k;
  let c = C + (C * LIGHT_C[slot] - C) * k;
  // brightness: > 1 opens every slot towards white by (b − 1) of its headroom, < 1 deepens it towards black
  const b = g.brightness ?? 1;
  if (b !== 1) l += (b - 1) * (b > 1 ? 1 - l : l);
  // the site's saturate(1.35) — with a soft ceiling: on a frame-filling ground an already vivid slot
  // (electric, indigo) would be pushed to the gamut's edge and read as neon, so the boost fades out
  // as a colour approaches it (a pale or grey slot gets the full 1.35)
  const boost = 1 + (MESH_SATURATE - 1) * Math.max(0, 1 - c / 0.2);
  c *= boost * (g.saturation ?? 1);
  return fromOklch(Math.min(0.999, Math.max(0, l)), Math.max(0, c), h);
}

/** A palette graded slot by slot (m0…m4). */
export const gradePalette = (p: Palette, g: Grade): string[] => p.slice(0, 5).map((c, i) => gradeColor(c, i, g));

/** Two palettes mixed (OKLab, lights.ts mixPalette) — the designed hand-off between acts. */
export const blendMesh = (a: Palette, b: Palette | undefined, mix: number): Palette => (b && mix > 0 ? (mix >= 1 ? b : mixPalette(a, b, mix)) : a);

/* ── pools ──────────────────────────────────────────────────────── */

/** A pool: where it rests (fractions of the flow element, the site's %), its size, its slot, its clocks. */
type PoolSpec = {
  x: number;
  y: number;
  r: number;
  slot: number;
  /** peak opacity (the b-field's .75) */
  a: number;
  /** drift periods (× 28 s) and phases */
  px: number;
  py: number;
  ph: readonly [number, number];
  /** drift reach (fractions of G) */
  dx: number;
  dy: number;
  /** turns about the centre with the b-field */
  turn?: boolean;
  /** the falloff's steepness (default MESH_K) */
  k?: number;
  /** × radius */
  grow?: number;
};

/** .pp-mesh-flow — bottom first (CSS lists the top pool first: m4 is painted last) */
const FLOW: readonly PoolSpec[] = [
  { x: 0.5, y: 0.52, r: 0.28, slot: 1, a: 1, px: 1.37, py: 0.83, ph: [0.9, 2.6], dx: 0.05, dy: 0.04 },
  { x: 0.2, y: 0.78, r: 0.4, slot: 3, a: 1, px: 0.81, py: 1.09, ph: [4.2, 0.3], dx: 0.05, dy: 0.04 },
  { x: 0.76, y: 0.8, r: 0.46, slot: 0, a: 1, px: 1.17, py: 0.93, ph: [2.1, 5.0], dx: 0.055, dy: 0.04 },
  { x: 0.8, y: 0.26, r: 0.4, slot: 2, a: 1, px: 0.89, py: 1.21, ph: [5.6, 1.7], dx: 0.05, dy: 0.045 },
  { x: 0.26, y: 0.24, r: 0.42, slot: 4, a: 1, px: 1.0, py: 1.31, ph: [0.0, 3.9], dx: 0.055, dy: 0.04 },
];
/** .pp-mesh-flow-b — the looser field turning the other way (opacity .75) */
const FLOW_B: readonly PoolSpec[] = [
  // the site blurs this field harder (4cqw on smaller pools): at frame scale that is a broader, softer
  // falloff and a wider pool — light passing through the field, never a disc sitting on it
  { x: 0.34, y: 0.56, r: 0.24, slot: 1, a: 0.75, px: 1.0, py: 1.0, ph: [0, 0], dx: 0, dy: 0, turn: true, k: 1.6, grow: 1.3 },
  { x: 0.62, y: 0.4, r: 0.22, slot: 4, a: 0.75, px: 1.0, py: 1.0, ph: [0, 0], dx: 0, dy: 0, turn: true, k: 1.6, grow: 1.3 },
];
/** the slot index of the recipe's brightest pool (the one a key light pulls by default) */
export const LIGHT_POOL = FLOW.length - 1;

/** One painted pool in frame px: an ellipse with a gaussian falloff, in its colour and peak alpha. */
export type MeshPool = { x: number; y: number; rx: number; ry: number; color: string; a: number; k?: number };

export type KeyLight = {
  /** the source, frame px */
  x: number;
  y: number;
  /** 0..1: how far the recipe's light pool is pulled onto it (and the tint's alpha) */
  strength: number;
  /** a tint pool AT the source (its light on the ground); omit for a pull only */
  color?: string;
  /** the tint's radius, px (default .42 G) */
  radius?: number;
  /** which pool follows the source: 'light' (m4, default), 'deep' (m0), or a FLOW index */
  pool?: 'light' | 'deep' | number;
};

export type MeshState = {
  /** 30 fps timeline frames (fractional at 120 fps) */
  t: number;
  W: number;
  H: number;
  palette: Palette;
  paletteB?: Palette;
  mix?: number;
  grade: Grade;
  key?: KeyLight | null;
  /** × the clocks (1 = the site's) */
  speed?: number;
  /** × the drift reach (1 = default) */
  drift?: number;
  /** × the b-field's turn rate (1 = one turn per 21 s) */
  turn?: number;
  /** a phase offset (frames) so two acts with the same palette never show the same field */
  seed?: number;
};

const SEC = 30;
const DRIFT_CYCLE = 28 * SEC; // the site's 14 s alternate = a 28 s cycle
const TURN = 21 * SEC;

/** Every pool's frame-px geometry and colour at time t, bottom first, plus the floor and the shade inks. */
export function meshAt(s: MeshState): { floor: string; pools: MeshPool[]; shadeInk: string; inks: string[] } {
  const { W, H } = s;
  const G = Math.sqrt(W * H);
  const sx = Math.sqrt(W / G);
  const sy = Math.sqrt(H / G);
  const inks = gradePalette(blendMesh(s.palette, s.paletteB, s.mix ?? 0), s.grade);
  const lift = Math.min(1, Math.max(0, s.grade.lift));
  const speed = s.speed ?? 1;
  const drift = s.drift ?? 1;
  const tt = (s.t + (s.seed ?? 0)) * speed;
  const at = (p: number) => -0.2 + 1.4 * p;
  const pools: MeshPool[] = [];
  const keyIdx = s.key ? (s.key.pool === 'deep' ? 2 : typeof s.key.pool === 'number' ? s.key.pool : LIGHT_POOL) : -1;
  FLOW.forEach((p, i) => {
    const w = (2 * Math.PI * tt) / DRIFT_CYCLE;
    let x = at(p.x) * W + p.dx * drift * G * Math.sin(w / p.px + p.ph[0]);
    let y = at(p.y) * H + p.dy * drift * G * Math.sin(w / p.py + p.ph[1]);
    // the site's scale 1 → 1.12 breath, per pool
    const breathe = 1 + 0.06 * Math.sin(w / (p.px * 0.77) + p.ph[1]);
    const R = p.r * 1.4 * G * breathe;
    if (i === keyIdx && s.key) {
      const k = Math.min(1, Math.max(0, s.key.strength));
      x += (s.key.x - x) * k;
      y += (s.key.y - y) * k;
    }
    // the light pool (m4) is the ground's sun: on the deep ground a touch held back (.88), so the upper
    // left reads as light on the material, not a blown-out corner
    pools.push({ x, y, rx: R * sx, ry: R * sy, color: inks[p.slot], a: p.slot === 4 ? p.a * (0.88 + 0.12 * lift) : p.a });
  });
  const th = (-2 * Math.PI * tt * (s.turn ?? 1)) / TURN;
  const ct = Math.cos(th);
  const st = Math.sin(th);
  for (const p of FLOW_B) {
    // turn the pool's offset from the centre (in the frame's own geometry, so it orbits round, not squashed)
    const ox = (at(p.x) - 0.5) * W;
    const oy = (at(p.y) - 0.5) * H;
    const x = W / 2 + ox * ct - oy * st;
    const y = H / 2 + ox * st + oy * ct;
    const R = p.r * 1.4 * G * (p.grow ?? 1);
    // on the deep ground the passing white is held to a lilac sheen (at full white it reads as a spot)
    const a = p.slot === 4 ? p.a * (0.55 + 0.45 * lift) : p.a * (0.7 + 0.3 * lift);
    pools.push({ x, y, rx: R * sx, ry: R * sy, color: inks[p.slot], a, k: p.k });
  }
  if (s.key?.color && s.key.strength > 0) {
    const R = s.key.radius ?? 0.42 * G;
    pools.push({ x: s.key.x, y: s.key.y, rx: R, ry: R, color: s.key.color, a: Math.min(1, s.key.strength) });
  }
  return { floor: inks[2], pools, shadeInk: inks[0], inks };
}

/* ── the falloff ────────────────────────────────────────────────── */

/** gaussian of the same mass as the site's blurred linear pool: e^(−K r²), tapered to 0 at r = 1 */
export const MESH_K = 3;
/** the falloff at r (0..1), steepness k */
export const falloff = (u: number, k: number = MESH_K) => {
  const rim = Math.exp(-k);
  return Math.max(0, (Math.exp(-k * u * u) - rim) / (1 - rim));
};
/** stop positions (denser where the curve bends) */
export const FALLOFF_STOPS: readonly number[] = Array.from({ length: 27 }, (_, i) => {
  const v = i / 26;
  return v * (0.55 + 0.45 * v);
}).map((u, i, a) => (i === a.length - 1 ? 1 : u));

/* ── shadows that take the mesh colour ─────────────────────────────── */

/**
 * The ink a card's shadow takes on this mesh: the palette's deepest slot (graded like the ground),
 * so a white card on the knowledge-base mesh casts an indigo shadow, never a grey one.
 */
export const meshShadowInk = (palette: Palette, lift = 1) => gradeColor(palette[0], 0, { lift: Math.min(lift, 0.35) });

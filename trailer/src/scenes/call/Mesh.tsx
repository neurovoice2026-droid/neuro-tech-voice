/**
 * THE CALL'S ROOM — a deep emerald gradient mesh, built the way the site
 * builds its pearl meshes (palettes.ts PLAN_LIGHTS, mesh-flow.ts,
 * globals.css .pp-mesh-flow): a stack of soft elliptical pools over a dark
 * floor, each pool a gaussian (the site's own falloff, k = 4.5, sampled
 * finely so no stop ever shows as a kink), each drifting slowly on its own
 * two clocks (sideways on one, up and down on the other), so the colour
 * travels and the pools pass one another while the picture never changes
 * character. Its colours are the site's "just after closing" light
 * (MOMENT_LIGHTS.closing: #03281a #065f46 #10b981 #a7f3d0) taken down to a
 * night key: a near-black emerald floor, deep pools of #065f46 / #0b7a5a,
 * and only near the orb — the room's one source — a pool of #10b981 with a
 * restrained #a7f3d0 heart. The orb pools follow the orb (light goes where
 * its source goes) and breathe a little with Ava's voice; while the caller
 * speaks they cool towards the closing light's own listen blue.
 *
 * No blur filters, no discs, no specks: every layer is a CSS gradient that
 * falls to nothing at its rim; the film grain + dither on top keep the dark
 * gradients from banding. Everything is a pure, smooth function of the
 * fractional call time — at 120 fps the drift is sampled four times finer.
 *
 * `reveal` (0 → 1) opens the mesh FROM THE ORB after the pickup: a soft
 * radial mask grows out of the orb until it is past the frame's corners, so
 * the room lights up green from its source (the pickup frame itself is still
 * the twist's midnight, under it).
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Vignette2 } from '../../components/Atmosphere';
import { hexToRgb, mixColor } from '../../lib/lights';
import type { Layout } from '../../lib/layout';
import { LIGHTS, type Palette } from '../../theme';

/* ── the light ─────────────────────────────────────────────────── */

const CLOSING = LIGHTS.closing;

/** The call's accent ink on the emerald (key words, Ava's label): the closing light, lit for the dark. */
export const ACCENT = '#7ee8bd';
/** The caller's ink on the emerald: the closing light's own listen blue, lit (its label + its line). */
export const CALLER_INK = '#a9d8f2';
/** Ava's text: the site's paper. */
export const AVA_INK = '#edecf1';

/** The orb while Ava speaks: the closing orb, its paper-white top rolled off so the hot zone keeps gradation. */
export const EMERALD_LIT: Palette = ['#022c1d', '#065f46', '#10b981', '#86ebc4', '#bdf1da'];
/** …and while the caller speaks: the closing light's listen palette, rolled off the same way. */
export const EMERALD_LISTEN_LIT: Palette = ['#03281a', '#145068', '#2a86a6', '#88c8e4', '#c2e2f0'];
/** The two lights the orb gives off (rim, room pool), by speaker. */
export const EMERALD_GLOW = { body: CLOSING.orb[2], core: CLOSING.orb[3] } as const;
export const LISTEN_GLOW = { body: CLOSING.listen[2], core: CLOSING.listen[3] } as const;

/* ── pools ─────────────────────────────────────────────────────── */

/** a pool: centre (fractions of the frame), radii (fractions of W, H), its colour and alpha, its drift */
type Pool = {
  c: string;
  a: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** drift reach (fractions of its own radii) and periods (frames), phases (rad) */
  dx: number;
  dy: number;
  px: number;
  py: number;
  ph: readonly [number, number];
};

const FLOOR = '#020e09';
const DEEP = '#021a11';
const BODY = '#066a4e'; // the closing light's #065f46, a touch more lit
const MID = '#0c8060';

/** The ambient pools (bottom first). Two layouts, one design: quiet bodies of colour in the corners
 *  and edges — always DIMMER than the light round the orb (the room is lit by its source, not from
 *  off-frame) — the frame's middle is left to the orb's own light. */
const AMBIENT: Record<'h' | 'v', readonly Pool[]> = {
  h: [
    { c: BODY, a: 0.36, x: 0.1, y: 0.9, rx: 0.6, ry: 0.82, dx: 0.08, dy: 0.1, px: 430, py: 350, ph: [0.4, 1.9] },
    { c: MID, a: 0.26, x: 0.92, y: 0.06, rx: 0.48, ry: 0.72, dx: 0.09, dy: 0.12, px: 390, py: 470, ph: [2.2, 0.6] },
    { c: BODY, a: 0.3, x: 0.96, y: 0.96, rx: 0.42, ry: 0.6, dx: 0.1, dy: 0.08, px: 510, py: 330, ph: [4.1, 3.0] },
    { c: DEEP, a: 0.6, x: 0.0, y: 0.06, rx: 0.42, ry: 0.6, dx: 0.06, dy: 0.1, px: 560, py: 410, ph: [1.1, 5.2] },
    { c: MID, a: 0.2, x: 0.28, y: 0.34, rx: 0.32, ry: 0.5, dx: 0.12, dy: 0.12, px: 300, py: 420, ph: [5.6, 2.4] },
    { c: MID, a: 0.16, x: 0.74, y: 0.62, rx: 0.3, ry: 0.46, dx: 0.12, dy: 0.12, px: 360, py: 290, ph: [3.3, 4.4] },
  ],
  v: [
    { c: BODY, a: 0.36, x: 0.08, y: 0.92, rx: 0.9, ry: 0.42, dx: 0.08, dy: 0.1, px: 430, py: 350, ph: [0.4, 1.9] },
    { c: MID, a: 0.28, x: 0.94, y: 0.06, rx: 0.8, ry: 0.36, dx: 0.09, dy: 0.12, px: 390, py: 470, ph: [2.2, 0.6] },
    { c: BODY, a: 0.3, x: 1.0, y: 0.64, rx: 0.62, ry: 0.3, dx: 0.1, dy: 0.08, px: 510, py: 330, ph: [4.1, 3.0] },
    { c: DEEP, a: 0.55, x: 0.0, y: 0.32, rx: 0.62, ry: 0.3, dx: 0.06, dy: 0.1, px: 560, py: 410, ph: [1.1, 5.2] },
    { c: MID, a: 0.2, x: 0.3, y: 0.2, rx: 0.55, ry: 0.24, dx: 0.12, dy: 0.12, px: 300, py: 420, ph: [5.6, 2.4] },
    { c: MID, a: 0.16, x: 0.72, y: 0.8, rx: 0.55, ry: 0.24, dx: 0.12, dy: 0.12, px: 360, py: 290, ph: [3.3, 4.4] },
  ],
};

/** The site's pool falloff is a gaussian, alpha ∝ e^(−4.5 r²) (its seven stops sample exactly that):
 *  sampled at 18 stops here and tapered to exactly 0 at the rim, so a pool has no edge and no kinks. */
const K = 4.5;
const N_STOPS = 18;
const E_RIM = Math.exp(-K);
function gaussStops(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255));
  const out: string[] = [];
  for (let i = 0; i <= N_STOPS; i++) {
    const u = i / N_STOPS;
    const k = (Math.exp(-K * u * u) - E_RIM) / (1 - E_RIM);
    out.push(`rgba(${r},${g},${b},${Math.max(0, a * k).toFixed(4)}) ${(u * 100).toFixed(2)}%`);
  }
  return out.join(', ');
}

const PoolDiv: React.FC<{ x: number; y: number; rx: number; ry: number; c: string; a: number }> = ({ x, y, rx, ry, c, a }) =>
  a <= 0.002 ? null : (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 2 * rx,
        height: 2 * ry,
        // moved by transform only (sub-pixel, compositor): the gradient itself never re-rasterises its shape
        transform: `translate(${(x - rx).toFixed(3)}px, ${(y - ry).toFixed(3)}px)`,
        background: `radial-gradient(closest-side, ${gaussStops(c, a)})`,
      }}
    />
  );

/** The soft mask the mesh opens through (the room lighting up from the orb). */
function revealMask(x: number, y: number, R: number): string {
  const stops: string[] = [];
  // fully open inside .42 R, a long smoothstep shoulder to nothing at R (a light front, not a wipe)
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const r = 0.42 + 0.58 * u;
    const s = 1 - u * u * (3 - 2 * u);
    stops.push(`rgba(0,0,0,${s.toFixed(4)}) ${(r * 100).toFixed(2)}%`);
  }
  return `radial-gradient(circle ${R.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 0%, ${stops.join(', ')})`;
}

export type MeshProps = {
  /** call-local time (fractional) */
  t: number;
  L: Layout;
  /** the orb on screen (its light's source) */
  orb: { x: number; y: number; d: number };
  /** 0..1+ Ava's level (the orb's light breathes with it) */
  level: number;
  /** 0..1 the caller is speaking (the orb's light cools to the listen blue) */
  listen: number;
  /** 0..1 the mesh opens out of the orb (1 = the whole room, no mask) */
  reveal?: number;
  /** extra light from the orb on a hit (the pickup, the gulp): 0..1 */
  flash?: number;
  /** 0..1 the source is there (the orb is absorbed into the mark at the end: its light goes with it) */
  source?: number;
};

export const EmeraldMesh: React.FC<MeshProps> = ({ t, L, orb, level, listen, reveal = 1, flash = 0, source = 1 }) => {
  if (reveal <= 0.001) return null;
  const W = L.width;
  const H = L.height;
  const pools = AMBIENT[L.vertical ? 'v' : 'h'];
  const lv = Math.max(0, Math.min(1.2, level));
  // the orb's three pools — the room's KEY: a wide body of the closing light's deep green round it (the
  // room's brightest ambient, so the light has its source), its light on the room, and a restrained
  // mint heart around it
  const keyCol = mixColor(EMERALD_GLOW.body, LISTEN_GLOW.body, 0.65 * listen);
  const heartCol = mixColor(EMERALD_GLOW.core, LISTEN_GLOW.core, 0.65 * listen);
  const bodyA = 0.5 * (1 - 0.15 * listen) * source;
  const keyA = (0.4 + 0.05 * lv + 0.12 * flash) * (1 - 0.22 * listen) * source;
  const heartA = (0.085 + 0.035 * lv + 0.08 * flash) * (1 - 0.3 * listen) * source;
  const body = { rx: L.pick(0.5 * W, 0.95 * W), ry: L.pick(0.8 * H, 0.42 * H) };
  const key = { rx: L.pick(0.34 * W, 0.68 * W), ry: L.pick(0.58 * H, 0.33 * H) };
  const heart = { rx: Math.max(orb.d * 0.95, L.pick(0.16 * W, 0.4 * W)), ry: Math.max(orb.d * 0.95, L.pick(0.28 * H, 0.2 * H)) };
  const R = Math.hypot(Math.max(orb.x, W - orb.x), Math.max(orb.y, H - orb.y));
  const mask = reveal < 0.999 ? revealMask(orb.x, orb.y, Math.max(1, (R / 0.42) * Math.pow(reveal, 0.9) * 1.04)) : undefined;
  return (
    <AbsoluteFill style={{ background: FLOOR, overflow: 'hidden', maskImage: mask, WebkitMaskImage: mask }}>
      {pools.map((p, i) => {
        const rx = p.rx * W;
        const ry = p.ry * H;
        const x = p.x * W + p.dx * rx * Math.sin((2 * Math.PI * t) / p.px + p.ph[0]);
        const y = p.y * H + p.dy * ry * Math.sin((2 * Math.PI * t) / p.py + p.ph[1]);
        return <PoolDiv key={i} x={x} y={y} rx={rx} ry={ry} c={p.c} a={p.a} />;
      })}
      <PoolDiv x={orb.x} y={orb.y + 0.1 * orb.d} rx={body.rx} ry={body.ry} c={BODY} a={bodyA} />
      <PoolDiv x={orb.x} y={orb.y + 0.04 * orb.d} rx={key.rx} ry={key.ry} c={keyCol} a={keyA} />
      <PoolDiv x={orb.x} y={orb.y} rx={heart.rx} ry={heart.ry} c={heartCol} a={heartA} />
      {/* the room falls off to a deep green-black at the edges (never grey) */}
      <Vignette2 strength={0.62} rgb={[1, 9, 6]} at={`50% ${L.pick(42, 44)}%`} />
    </AbsoluteFill>
  );
};

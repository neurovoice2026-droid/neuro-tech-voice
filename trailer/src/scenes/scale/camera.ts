/**
 * The SCALE camera, as a 2D affine on the depth-1 layer: screen = A + s·p.
 *
 *   steps   card 01 alone (≈ 3.9×) → 2 × 2 → 3 × 3 → the full wall (1×),
 *           3-frame moves framing the block being filled (the first peels;
 *           the two landing on quarters snap into the beat)
 *   kicks   quarter notes ±1.8 % (e^−u/3) with a 3 px jolt, alternating (a
 *           quarter that lands a step overshoots it: −1.8 %, then settles);
 *           every other 16th a ≤ 0.5 % micro-kick (e^−u/2); the hero
 *           "16 industries." +2.5 % (e^−u/4); each language flip 0.5 %
 *   push    a slow 2.2 % push over the language grid, released for the flow
 *   nudges  1 % toward each flow node on its cue (zoom ABOUT the node, gone
 *           in 7 f; the last one is about FLOW_END, so the CRM node never moves)
 *
 * From the flow on the camera is otherwise at rest (s 1, A 0).
 */
import type { Layout } from '../../lib/layout';
import { EASE, tween, windowed } from '../../lib/motion';
import { SCALE, SCALE_LOCAL } from '../../timing';
import { centre, type Geo, type Pt } from './geometry';

const K = SCALE_LOCAL;

export type Affine = { s: number; ax: number; ay: number; rot: number };

/**
 * 0…3: how far along the three camera steps (fraction = progress of the
 * current step). The first step (off card 01) peels; the two that land ON a
 * quarter note accelerate into it (power2.in), so the snap hits the beat and
 * the quarter kick carries it past the framing (the overshoot) to settle.
 */
const lands = (st: readonly [number, number]) => (K.kicks as readonly number[]).includes(st[1]);
const level = (t: number) => K.camSteps.reduce((a, st) => a + tween(t, st, [0, 1], lands(st) ? EASE.in2 : EASE.peel), 0);

/** the stepped framing: world point F at the screen centre, zoom Z */
export function baseCam(t: number, G: Geo): { F: Pt; Z: number } {
  const lv = level(t);
  const i = Math.min(2, Math.floor(lv));
  const f = lv - i;
  const Z = Math.exp(Math.log(G.zooms[i]) + (Math.log(G.zooms[i + 1]) - Math.log(G.zooms[i])) * f);
  // the focus moves so the screen path is straight in log-zoom space
  const w = (1 / G.zooms[i] - 1 / Z) / (1 / G.zooms[i] - 1 / G.zooms[i + 1] || 1);
  const F = {
    x: G.focus[i].x + (G.focus[i + 1].x - G.focus[i].x) * w,
    y: G.focus[i].y + (G.focus[i + 1].y - G.focus[i].y) * w,
  };
  return { F, Z };
}

/** screen speed (px / frame) of the frame corners under the stepped camera — drives the step blur */
export function stepSpeed(t: number, G: Geo, L: Layout): number {
  const a = baseCam(t - 0.5, G);
  const b = baseCam(t + 0.5, G);
  let m = 0;
  for (const q of [
    { x: 0, y: 0 },
    { x: L.width, y: 0 },
    { x: 0, y: L.height },
    { x: L.width, y: L.height },
  ]) {
    const wx = a.F.x + (q.x - L.cx) / a.Z;
    const wy = a.F.y + (q.y - L.cy) / a.Z;
    const sx = L.cx + (wx - b.F.x) * b.Z;
    const sy = L.cy + (wy - b.F.y) * b.Z;
    m = Math.max(m, Math.hypot(sx - q.x, sy - q.y));
  }
  return m;
}

/** zoom kick (fraction), x-jolt (px) and roll (deg) at t */
export function kicks(t: number): { z: number; jx: number; rot: number } {
  let z = 0;
  let jx = 0;
  let rot = 0;
  K.kicks.forEach((q, i) => {
    if (t < q) return;
    const e = Math.exp(-(t - q) / 3);
    const side = i % 2 === 0 ? 1 : -1;
    // a quarter that lands a camera step is the step's OVERSHOOT (it carries
    // the pull-back past the framing and settles); the others punch in
    const lands = K.camSteps.some((st) => st[1] === q);
    z += (lands ? -1 : 1) * 0.018 * e;
    jx += 3 * side * e;
    // the jolt tips the frame a hair the same way (a hand-held hit)
    rot += 0.4 * side * e;
  });
  // the other 16ths: a micro-kick (0.3 %, well under the quarters)
  const quarter = (f: number) => (K.kicks as readonly number[]).includes(f);
  for (const p of K.pops) if (!quarter(p) && t >= p) z += 0.003 * Math.exp(-(t - p) / 2);
  const H = SCALE.industriesTitle;
  if (t >= H) z += 0.025 * Math.exp(-(t - H) / 4);
  for (const l of K.langs) if (t >= l) z += 0.005 * Math.exp(-(t - l) / 2);
  // "14 languages." lands (its letters settle ~4 f after the rise starts): a 2 px jolt
  const ti = K.titleIn + 4;
  if (t >= ti) jx += -2 * Math.exp(-(t - ti) / 2.5);
  return { z, jx, rot };
}

/** 1 % toward node i on its station frame: up in 2 f, exactly gone by +7 (the last one stays about FLOW_END) */
export function nudge(t: number, at: number, last: boolean): number {
  const u = t - at;
  if (u < 0) return 0;
  if (u < 2) return 0.01 * Math.sin((u / 2) * (Math.PI / 2));
  if (last) return 0.01 * (0.35 + 0.65 * Math.exp(-(u - 2) / 5));
  if (u < 7) return 0.01 * (0.5 + 0.5 * Math.cos(((u - 2) / 5) * Math.PI));
  return 0;
}

/** the whole camera at t, as an affine of the depth-1 layer */
export function camAt(t: number, G: Geo, L: Layout): Affine {
  const C = { x: L.cx, y: L.cy };
  const { F, Z } = baseCam(t, G);
  let s = Z;
  let ax = C.x - F.x * Z;
  let ay = C.y - F.y * Z;
  // kicks (about the screen centre) + jolt
  const k = kicks(t);
  const kz = 1 + k.z;
  ax = C.x + (ax - C.x) * kz + k.jx;
  ay = C.y + (ay - C.y) * kz;
  s *= kz;
  // zoom by q about world point P (P stays where it is on screen)
  const about = (P: Pt, q: number) => {
    if (Math.abs(q - 1) < 1e-7) return;
    const sx = ax + s * P.x;
    const sy = ay + s * P.y;
    ax = sx + (ax - sx) * q;
    ay = sy + (ay - sy) * q;
    s *= q;
  };
  // the slow push over the language grid, released for the flow
  const P = K.push;
  const c0 = G.cells[0];
  const c1 = G.cells[G.cells.length - 1];
  about(centre({ x: c0.x, y: c0.y, w: c1.x + c1.w - c0.x, h: c1.y + c1.h - c0.y }),
    1 + 0.022 * windowed(t, P[0], P[1], P[1], P[2], EASE.inOut, EASE.inOut));
  // nudges toward each flow node
  K.stations.forEach((st, i) => about(G.nodes[i], 1 + nudge(t, st, i === 2)));
  return { s, ax, ay, rot: k.rot };
}

/** Camera component props for an affine (Camera.tsx: screen = C + (p − C)·zoom − cam) */
export const cameraProps = (a: Affine, L: Layout) => ({
  x: L.cx * (1 - a.s) - a.ax,
  y: L.cy * (1 - a.s) - a.ay,
  zoom: a.s,
  /** the quarter kicks' roll (deg), applied about the screen centre by the scene; ~0 long before the flow */
  rot: Math.abs(a.rot) > 1e-4 ? a.rot : 0,
});

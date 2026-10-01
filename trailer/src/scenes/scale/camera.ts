/**
 * The SCALE camera, as a 2D affine on the depth-1 layer: screen = A + s·p.
 *
 *   wall     a CONTINUOUS pull-back (monotone cubic in log-zoom through
 *            SCALE_LOCAL.pull): card 01 fills the frame out of the whip
 *            (≈ 3.9×) → the 2 × 2 framed as card 2 pops → a slow drift → the
 *            3 × 3 as card 5 pops → drift → the whole wall as the 16ths start
 *            → a last breath out (0.985) into the slam. The focus moves on a
 *            straight screen path (the wall's top-left stays anchored), so
 *            each card pops inside the opening frame. It breathes (±0.35 %,
 *            2 beats) and kicks: every pop 0.25 %, every turn of the hour
 *            0.9 % with a 2 px jolt and a hair of roll
 *   hero     +2.5 % on the slam (e^−u/4), then back to 1 as the cards leave
 *   langs    a slow 2.5 % push on the language card, a 0.5 % kick as each
 *            card lands, released for the flow
 *   flow     at rest (s 1, A 0) — so FLOW_END is the screen point — except
 *            1 % nudges toward each node (about the node; the last one about
 *            FLOW_END, so the CRM node never moves)
 */
import type { Layout } from '../../lib/layout';
import { EASE, tween, windowed } from '../../lib/motion';
import { noise2D } from '@remotion/noise';
import { SCALE, SCALE_LOCAL } from '../../timing';
import { centre, type Geo, type Pt } from './geometry';

const K = SCALE_LOCAL;
const HERO = SCALE.industriesTitle;

export type Affine = { s: number; ax: number; ay: number; rot: number };

/** monotone cubic (Fritsch–Carlson) through (xs, ys), clamped at the ends */
function pchip(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  const h = xs.slice(1).map((v, i) => v - xs[i]);
  const d = h.map((hi, i) => (ys[i + 1] - ys[i]) / hi);
  const m = xs.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    if (d[i - 1] * d[i] <= 0) return 0;
    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  });
  // the first key leaves with its momentum (the whip): an eased start would stall the cut
  let k = 0;
  while (x > xs[k + 1]) k++;
  const u = (x - xs[k]) / h[k];
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  const h01 = -2 * u ** 3 + 3 * u ** 2;
  const h11 = u ** 3 - u ** 2;
  return h00 * ys[k] + h10 * h[k] * m[k] + h01 * ys[k + 1] + h11 * h[k] * m[k + 1];
}

/** the wall's pulled-back framing at t: world point F at the screen centre, zoom Z */
export function baseCam(t: number, G: Geo, L: Layout): { F: Pt; Z: number } {
  const [z0, z1, z2] = G.zooms;
  const zs = [z0, z1, z1 * 0.93, z2, z2 * 0.94, 1, 0.985];
  let Z = Math.exp(pchip(K.pull, zs.map(Math.log), t));
  // after the slam: back to 1 as the cards leave and the keeper glides
  if (t > HERO) Z += (1 - 0.985) * tween(t, [K.glide, K.switchIn[0] + 10], [0, 1], EASE.inOut);
  // the focus runs on a straight screen path: linear in the view's size
  const u = Math.min(1, Math.max(0, (1 / Z - 1 / z0) / (1 - 1 / z0)));
  const c0 = G.focus[0];
  const F = { x: c0.x + (L.cx - c0.x) * u, y: c0.y + (L.cy - c0.y) * u };
  return { F, Z };
}

/** zoom kick (fraction), x-jolt (px) and roll (deg) at t */
export function kicks(t: number): { z: number; jx: number; rot: number } {
  let z = 0;
  let jx = 0;
  let rot = 0;
  // every pop: a micro-kick
  for (const p of K.pops) if (t >= p && !K.groups.includes(p)) z += 0.0025 * Math.exp(-(t - p) / 2.5);
  // the hour turns: a kick, a 2 px jolt and a hair of roll, alternating
  K.groups.forEach((g, j) => {
    if (j === 0 || t < g) return;
    const e = Math.exp(-(t - g) / 3);
    const side = j % 2 === 0 ? 1 : -1;
    z += 0.009 * e;
    jx += 2 * side * e;
    rot += 0.22 * side * e;
  });
  if (t >= HERO) {
    const e = Math.exp(-(t - HERO) / 4);
    z += 0.025 * e;
    rot += -0.18 * e;
  }
  // each language card lands: 0.5 %
  const lands = [K.enFlip + 6, ...SCALE.langAt.slice(1).map((a) => a - 1)];
  for (const l of lands) if (t >= l) z += 0.005 * Math.exp(-(t - l) / 3);
  // "14 languages." lands: a 2 px jolt
  const ti = SCALE.langTitle;
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
  const { F, Z } = baseCam(t, G, L);
  // the wall breathes (2 beats), and the hand holding the camera drifts a hair until the flow
  const breath = 0.0035 * Math.sin(((t + 3) / 30) * Math.PI) * tween(t, [4, 14], [0, 1], EASE.inOut) * (1 - tween(t, [80, HERO], [0, 1], EASE.inOut));
  const hand = 1 - tween(t, [K.collapse, K.stations[0] - 4], [0, 1], EASE.inOut);
  const hx = 2.5 * noise2D('scale-hand-x', t * 0.02, 0.1) * hand;
  const hy = 2 * noise2D('scale-hand-y', 0.4, t * 0.02) * hand;
  let s = Z * (1 + breath);
  let ax = C.x - F.x * s + hx;
  let ay = C.y - F.y * s + hy;
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
  // the slow push on the language card, released for the flow
  const P = K.langPush;
  about(centre(G.lang), 1 + 0.025 * windowed(t, P[0], P[1], P[1], P[2], EASE.inOut, EASE.inOut));
  // nudges toward each flow node
  K.stations.forEach((st, i) => about(G.nodes[i], 1 + nudge(t, st, i === 2)));
  return { s, ax, ay, rot: k.rot };
}

/** the screen velocity (px / frame) of world point p under the camera at t */
export function screenVel(t: number, p: Pt, G: Geo, L: Layout): { vx: number; vy: number } {
  const a = camAt(t - 0.5, G, L);
  const b = camAt(t + 0.5, G, L);
  return { vx: b.ax + b.s * p.x - (a.ax + a.s * p.x), vy: b.ay + b.s * p.y - (a.ay + a.s * p.y) };
}

/** Camera component props for an affine (Camera.tsx: screen = C + (p − C)·zoom − cam) */
export const cameraProps = (a: Affine, L: Layout) => ({
  x: L.cx * (1 - a.s) - a.ax,
  y: L.cy * (1 - a.s) - a.ay,
  zoom: a.s,
  /** the kicks' roll (deg), applied about the screen centre by the scene */
  rot: Math.abs(a.rot) > 1e-4 ? a.rot : 0,
});

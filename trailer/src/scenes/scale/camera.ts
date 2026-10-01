/**
 * The SCALE camera, as a 2D affine on the depth-1 layer: screen = A + s·p.
 *
 *   wall     a CONTINUOUS pull-back that always FRAMES THE CLUSTER: the cards
 *            popped so far, plus the next slot a few frames before its card
 *            pops (lead room), inside the framing box (geometry.ts: ≥ 64 px
 *            from the 16:9 edges, ≥ 60 px from the 9:16 sides, inside the
 *            9:16 safe zone) — card 01 fills the box out of the whip → each
 *            new column / row opens the frame → the whole wall, composed with
 *            air around it → a last breath out (0.975) into the slam. Zoom
 *            (in log) and focus are monotone cubics through those framings,
 *            and the focus is clamped so no popped card ever leaves the box.
 *            It breathes (±0.35 %, a bar) and kicks: every pop 0.25 %, every
 *            turn of the hour 0.9 % with a 2 px jolt and a hair of roll
 *   hero     +2.5 % on the slam, decaying slowly over the hold (τ ≈ 0.5 s)
 *            while a slow push carries the wall from 0.975 back to 1 — the
 *            hold breathes and drifts, never freezes
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
import { centre, type Geo, type Pt, type Rect } from './geometry';

const K = SCALE_LOCAL;
const HERO = SCALE.industriesTitle;
/** the frame has opened for a card this many frames before it pops (its slot's inhale starts at −2) */
const LEAD = 3;
/** the wall's last breath out before the slam (the push of the hold brings it back to 1) */
const REST = 0.975;

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

/** the zoom at which rect r fills the framing box (its tighter side) */
const fitZ = (G: Geo, r: Rect) => Math.min(G.frame.w / r.w, G.frame.h / r.h);

/** the wall's framing keys: one per new column / row of the cluster (LEAD f before its card pops) */
type Keys = { ts: number[]; lz: number[]; fx: number[]; fy: number[] };
const KEYS = new Map<string, Keys>();
function wallKeys(G: Geo): Keys {
  const id = `${G.W}x${G.H}`;
  const hit = KEYS.get(id);
  if (hit) return hit;
  const c0 = G.cluster[0];
  const keys: Keys = { ts: [-K.preroll], lz: [Math.log(fitZ(G, c0))], fx: [centre(c0).x], fy: [centre(c0).y] };
  for (let i = 1; i < 16; i++) {
    const a = G.cluster[i - 1];
    const b = G.cluster[i];
    if (Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5) continue;
    const lz = Math.min(keys.lz[keys.lz.length - 1], Math.log(fitZ(G, b)));
    keys.ts.push(K.pops[i] - LEAD);
    keys.lz.push(lz);
    keys.fx.push(centre(b).x);
    keys.fy.push(centre(b).y);
  }
  // the whole wall, then a last breath out into the slam (about the wall's centre = the anchor)
  keys.ts.push(HERO - 2);
  keys.lz.push(Math.min(keys.lz[keys.lz.length - 1], Math.log(REST)));
  keys.fx.push(centre(G.wall).x);
  keys.fy.push(centre(G.wall).y);
  KEYS.set(id, keys);
  return keys;
}

/** the cluster on screen at t: the bounds of every card whose slot has started to inhale */
function clusterAt(t: number, G: Geo): Rect {
  let n = 0;
  for (let i = 0; i < 16; i++) if (t >= (i === 0 ? -K.preroll : K.pops[i] - 2)) n = i;
  return G.cluster[n];
}

/** the wall's pulled-back framing at t: world point F at the screen anchor, zoom Z */
export function baseCam(t: number, G: Geo): { F: Pt; Z: number } {
  const k = wallKeys(G);
  let Z = Math.exp(pchip(k.ts, k.lz, t));
  let F: Pt = { x: pchip(k.ts, k.fx, t), y: pchip(k.ts, k.fy, t) };
  if (t < HERO) {
    // no popped card ever leaves the framing box (the focus is clamped into what keeps the cluster in it)
    const B = clusterAt(t, G);
    const hw = G.frame.w / 2 / Z;
    const hh = G.frame.h / 2 / Z;
    const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    F = { x: clamp(F.x, B.x + B.w - hw, B.x + hw), y: clamp(F.y, B.y + B.h - hh, B.y + hh) };
  } else {
    // the hold: a slow push from the breath-out back to 1 as the cards leave and the keeper glides
    Z = REST + (1 - REST) * tween(t, [HERO, K.switchIn[0] + 10], [0, 1], EASE.inOut);
    F = centre(G.wall);
  }
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
    // the slam: the kick lands at once and lets go slowly over the hold (the roll settles fast)
    z += 0.025 * Math.exp(-(t - HERO) / 14);
    rot += -0.18 * Math.exp(-(t - HERO) / 4);
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
  void L;
  // the screen anchor: the framing box's centre (9:16: the safe zone's), = the wall's centre at rest
  const C = G.anchor;
  const { F, Z } = baseCam(t, G);
  // the wall breathes (a bar) through the build AND the hero's hold, and lets go as the cards peel off;
  // the hand holding the camera drifts a hair until the flow
  const breath =
    0.0035 * Math.sin(((t + 3) / 30) * Math.PI) * tween(t, [4, 14], [0, 1], EASE.inOut) * (1 - tween(t, [K.flyOut - 8, K.flyOut], [0, 1], EASE.inOut));
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

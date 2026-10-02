/**
 * The SCALE camera, as a 2D affine on the depth-1 layer: screen = A + s·p.
 *
 *   index    a CONTINUOUS pull-back that always FRAMES THE CLUSTER: the names
 *            landed so far, plus the next one a few frames before it lands
 *            (lead room), inside the framing box (geometry.ts: the whole
 *            index ≥ 176 px from the 16:9 sides, inside the 9:16 safe zone) —
 *            "Home services" fills the frame out of the whip (16:9 at ≤ 4.2×)
 *            → each new column / row opens the frame → the whole index,
 *            composed with air around it → a last breath out (0.975) into the
 *            slam. Zoom (in log) and focus are monotone cubics through those
 *            framings, and the focus is clamped so no landed name ever leaves
 *            the box.
 *            Locked off otherwise: no per-pop pumps, no jolts, no roll, no
 *            hand-held noise (at 120 fps any step reads as a jitter).
 *   hero     a soft +1.6 % push on the slam (a 3 f C1 attack), letting go
 *            over the hold (τ ≈ 0.5 s) while a slow push carries the wall
 *            from 0.975 back to 1; a 0.2 % breath — never frozen
 *   langs    a slow 2.5 % push on the language card, released for the flow
 *   flow     at rest (s 1, A 0) — so FLOW_END is the screen point — except
 *            1 % nudges toward each node (about the node; the last one about
 *            FLOW_END, so the CRM node never moves)
 */
import type { Layout } from '../../lib/layout';
import { EASE, smooth, tween, windowed } from '../../lib/motion';
import { SCALE, SCALE_LOCAL } from '../../timing';
import { centre, type Geo, type Pt, type Rect } from './geometry';

const K = SCALE_LOCAL;
const HERO = SCALE.industriesTitle;
/** the frame has opened for a name this many frames before it lands (its reveal starts at −2) */
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

/** the zoom at which rect r fills the framing box (its tighter side); a single name never fills it past
 *  ZMAX (16:9 "Home services" would be 5× — 4.2× keeps air around it) */
const ZMAX = 4.2;
const fitZ = (G: Geo, r: Rect) => Math.min(ZMAX, G.frame.w / r.w, G.frame.h / r.h);

/** the index's framing keys: one per new column / row of the cluster (LEAD f before its name lands) */
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

/** the cluster on screen at t: the bounds of every name whose reveal has started */
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
    // no landed name ever leaves the framing box (the focus is clamped into what keeps the cluster in it)
    const B = clusterAt(t, G);
    const hw = G.frame.w / 2 / Z;
    const hh = G.frame.h / 2 / Z;
    const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    F = { x: clamp(F.x, B.x + B.w - hw, B.x + hw), y: clamp(F.y, B.y + B.h - hh, B.y + hh) };
  } else {
    // the hold: a slow push from the breath-out back to 1 as the index clears and the English card rises
    Z = REST + (1 - REST) * tween(t, [HERO, K.switchIn[0] + 10], [0, 1], EASE.inOut);
    F = centre(G.wall);
  }
  return { F, Z };
}

/**
 * The camera's accents at t — continuous, never a step (at 120 fps an instant 0.25 % zoom is a
 * visible 2–3 px jump at the frame edge): only the slam's soft push, arriving over ≈ 3 f (C1) and
 * letting go slowly over the hold. No per-pop pumps, no jolts, no roll.
 */
export function kicks(t: number): { z: number; jx: number; rot: number } {
  let z = 0;
  if (t > HERO - 1) {
    const a = smooth(HERO - 1, HERO + 2.5, t);
    z += 0.016 * a * Math.exp(-Math.max(0, t - (HERO + 2.5)) / 16);
  }
  return { z, jx: 0, rot: 0 };
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
  // the hero's hold breathes (a slow 0.2 %, a bar long) and lets go as the index clears — a locked-off
  // camera otherwise: no hand-held drift, no noise
  const breath =
    0.002 * Math.sin(((t - SCALE.industriesTitle) / 60) * Math.PI) *
    tween(t, [SCALE.industriesTitle + 4, SCALE.industriesTitle + 16], [0, 1], EASE.inOut) *
    (1 - tween(t, [K.flyOut - 8, K.flyOut], [0, 1], EASE.inOut));
  let s = Z * (1 + breath);
  let ax = C.x - F.x * s;
  let ay = C.y - F.y * s;
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

/** Camera component props for an affine (Camera.tsx: screen = C + (p − C)·zoom − cam) */
export const cameraProps = (a: Affine, L: Layout) => ({
  x: L.cx * (1 - a.s) - a.ax,
  y: L.cy * (1 - a.s) - a.ay,
  zoom: a.s,
  /** the kicks' roll (deg), applied about the screen centre by the scene */
  rot: Math.abs(a.rot) > 1e-4 ? a.rot : 0,
});

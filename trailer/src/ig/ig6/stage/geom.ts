/**
 * REEL 6 · THE GEOMETRY (docs/ig/ig6/STYLE.md §9.5–§9.6): the 2.5D camera's planes and the dial's coordinates, as pure
 * functions (no React). Picture only (a subfolder: outside ig6Hash).
 *
 *   a plane    world → screen = anchor + S · R(rot) · (world − focus), with S = 1 + (zoom − 1) · k per plane (dial k 1,
 *              hand + hub k 1.12, the lockup k 0: screen-locked). The camera never overshoots; objects may.
 *   the dial   centre (−9, 1814), R 1623 in M1 world px (SCRIPT §1.1). A dial angle φ (clockwise from the dial's own
 *              12 o'clock) sits at world angle φ + 28.1° + ρ (ρ the dial's rotation, −6° per step); the needle crosses
 *              the rim at the reading point (601, 310), world angle 22.07°, so it reads φ = −6.03° − ρ.
 *
 * Every primitive is projected into SCREEN space by these functions (the dial's marks are generated for the visible
 * angular window only, STYLE §9.5), so a ×194 push-through is just bigger numbers, never a huge SVG transform.
 */
import { DIAL, HAND, PHI0, READING_POINT } from './style';

export const DEG = Math.PI / 180;
export type Pt = { x: number; y: number };
/** a camera plane: world → screen = (ax, ay) + S · R(rot°) · (world − (fx, fy)) */
export type Plane = { ax: number; ay: number; fx: number; fy: number; S: number; rot: number };
/** a camera: the plane before the parallax factor (zoom, not S) */
export type Cam = { ax: number; ay: number; fx: number; fy: number; zoom: number; rot: number };

/** the frame (1080 × 1920): centre and half-diagonal */
export const FRAME = { w: 1080, h: 1920, cx: 540, cy: 960, half: Math.hypot(540, 960) } as const;
/** the parallax factors (STYLE §9.6: dial 1.00, hand + hub 1.12 — one plane, so the hub stays on the hand's pivot) */
export const K = { dial: 1, hand: 1.12 } as const;

export const planeOf = (c: Cam, k: number): Plane => ({ ax: c.ax, ay: c.ay, fx: c.fx, fy: c.fy, S: 1 + (c.zoom - 1) * k, rot: c.rot });

export function project(p: Plane, x: number, y: number): Pt {
  const dx = x - p.fx;
  const dy = y - p.fy;
  const c = Math.cos(p.rot * DEG);
  const s = Math.sin(p.rot * DEG);
  return { x: p.ax + p.S * (c * dx - s * dy), y: p.ay + p.S * (s * dx + c * dy) };
}
export function unproject(p: Plane, x: number, y: number): Pt {
  const dx = (x - p.ax) / p.S;
  const dy = (y - p.ay) / p.S;
  const c = Math.cos(-p.rot * DEG);
  const s = Math.sin(-p.rot * DEG);
  return { x: p.fx + c * dx - s * dy, y: p.fy + s * dx + c * dy };
}
/** the plane as an SVG matrix (for the one group the hand is drawn in) */
export function matrix(p: Plane): string {
  const a = Math.cos(p.rot * DEG) * p.S;
  const b = Math.sin(p.rot * DEG) * p.S;
  const e = p.ax - (a * p.fx - b * p.fy);
  const f = p.ay - (b * p.fx + a * p.fy);
  return `matrix(${a.toFixed(6)} ${b.toFixed(6)} ${(-b).toFixed(6)} ${a.toFixed(6)} ${e.toFixed(4)} ${f.toFixed(4)})`;
}

/** a point at world angle a (deg, clockwise from 12) and radius r about (cx, cy) */
export const polar = (a: number, r: number, cx: number = DIAL.cx, cy: number = DIAL.cy): Pt => ({ x: cx + r * Math.sin(a * DEG), y: cy - r * Math.cos(a * DEG) });
/** the world angle of a point about (cx, cy) */
export const angleOf = (x: number, y: number, cx: number = DIAL.cx, cy: number = DIAL.cy) => Math.atan2(x - cx, cy - y) / DEG;

export const RP = READING_POINT;
export const HUB = HAND.pivot;
/** the needle's world angle (the reading point's, about the dial centre) */
export const NEEDLE_A = angleOf(RP.x, RP.y);
/** the world angle of dial angle φ under rotation ρ */
export const worldA = (phi: number, rho: number) => phi + PHI0 + rho;
/** the dial angle the needle reads under rotation ρ (−6.03° − ρ) */
export const needlePhi = (rho: number) => NEEDLE_A - PHI0 - rho;

/** the dial's visible angular window on screen, as [a0, a1] world degrees (a0 < a1), for marks between radii r0..r1;
 *  null when nothing of that band can be on screen. The full circle when the dial's centre is near the frame. */
export function visibleWindow(p: Plane, r0: number, r1: number, margin = 40): [number, number] | null {
  const c = project(p, DIAL.cx, DIAL.cy);
  const D = Math.hypot(c.x - FRAME.cx, c.y - FRAME.cy);
  const reach = FRAME.half + margin;
  const ac = angleOf(FRAME.cx, FRAME.cy, c.x, c.y) - p.rot;
  let half = 0;
  for (const r of [r0, r1]) {
    const rho = r * p.S;
    if (D < 1e-6 || rho + D <= reach) return [ac - 180, ac + 180];
    const cosd = (rho * rho + D * D - reach * reach) / (2 * rho * D);
    if (cosd <= -1) return [ac - 180, ac + 180];
    if (cosd >= 1) continue;
    half = Math.max(half, Math.acos(cosd) / DEG);
  }
  if (half <= 0) {
    // neither circle crosses the frame's disc, yet the frame may lie INSIDE the band (deep in the T2 push the rim passes
    // through node 2 at the frame's middle while both band edges are thousands of px away): the frame's disc then spans
    // asin(reach / D) either side of its direction (crit-r2 P3: the push draws the dial, not only node 2, to the white)
    const inBand = D > reach && D >= r0 * p.S - reach && D <= r1 * p.S + reach;
    if (!inBand) return null;
    half = Math.asin(Math.min(1, reach / D)) / DEG;
  }
  return [ac - half - 1, ac + half + 1];
}
/** bring angle a into [lo, lo + 360) */
export const wrapFrom = (a: number, lo: number) => a - 360 * Math.floor((a - lo) / 360);
/** is a screen point inside the frame (with a margin)? */
export const onScreen = (q: Pt, m = 0) => q.x >= -m && q.x <= FRAME.w + m && q.y >= -m && q.y <= FRAME.h + m;

/** the monotone cubic (Fritsch–Carlson) through (x, y) points, evaluated at u: smooth, never overshooting */
export function pchip(pts: readonly (readonly [number, number])[]): (u: number) => number {
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = xs.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    if (d[i - 1] * d[i] <= 0) return 0;
    const h0 = xs[i] - xs[i - 1];
    const h1 = xs[i + 1] - xs[i];
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  });
  return (u: number) => {
    if (u <= xs[0]) return ys[0];
    if (u >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (u > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const s = (u - xs[i]) / h;
    const h00 = 2 * s * s * s - 3 * s * s + 1;
    const h10 = s * s * s - 2 * s * s + s;
    const h01 = -2 * s * s * s + 3 * s * s;
    const h11 = s * s * s - s * s;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

/** the identity plane (M1 at rest: screen = world) */
export const IDENT_PLANE: Plane = { ax: 0, ay: 0, fx: 0, fy: 0, S: 1, rot: 0 };

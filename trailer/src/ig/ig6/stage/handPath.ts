/**
 * REEL 6 · THE HAND, OUR PROPORTIONS (docs/ig/ig6/STYLE.md §9.5, judge-style fix 6: ≈ 10–15 % off the reference's
 * measured profile, so frame 0 is never a trace of it). One outline in hand-local px — pivot (0, 0), pointing up −y —
 * with the lozenge's hole as a second sub-path (fill-rule evenodd), built from the width profile:
 *
 *   s −310 … −90   tail (counterweight), 50 wide, a round end r 25 — long enough to run off the page in M1 and in the
 *                  M2′ hub macro (crit-r1 N8; STYLE's −230 left its cap inside the frame there)
 *   s −90 → −46    the tail necks into the hub: 50 → 26 wide, leaving the hub disc inside its chord (crit-r2 P7)
 *   s 48 → 220–320 → 400 → 460 → 520 → 570 → 610 → 640    32 → 44 → 40 → 32 → 26 → 22 → 18 → 15 (concave taper)
 *   s 618–632      the collar, a 46 × 14 deep-teal band (drawn on top, not part of the outline)
 *   s 640–668      the neck, 15
 *   s 668 → 772 → 880   the hollow lozenge, 0 → 92 → 0 outer (concave sides: width ∝ u^1.4 from each end)
 *   the hole       the lozenge's outline offset INWARD by a constant 11 px along its normal (STYLE §9.5 "outline ≈ 10–12
 *                  px normal to the edge"), so the walls are even all round — a bold paper-cut lozenge, not a ribbon
 *                  that thins to a hairline at the needle (crit-r1 N1); it closes where the offset meets the axis
 *   s 880–1095     the needle, 12, square end; it crosses the rim at s ≈ 1008 (the reading point)
 *
 * Two drawings share the profile: HAND (the world hand, M1 / M3′ / M2′ / the cover) and HAND_FULL (M5′, redrawn at the
 * dial's true centre ×0.40: its needle widened so it stays ≥ 6 px on screen, the counterweight kept short — crit-r1 N5).
 * Pure data: the path strings and the outlines' sample points (the zone and overlap checks project them).
 */
import { pchip } from './geom';

export const HAND_LEN = 1095;
const BODY = pchip([
  [-30, 32],
  [48, 32],
  [220, 44],
  [320, 44],
  [400, 40],
  [460, 32],
  [520, 26],
  [570, 22],
  [610, 18],
  [640, 15],
  [668, 15],
]);
/** the tail (counterweight): it NECKS into the hub — half-width 13 where it leaves the hub disc (s −46, inside the disc's
 *  chord there, so no corner pokes out: crit-r2 P7, the full-width paddle left two stepped shoulders) — and flares to
 *  the 50 px paddle by s −90, as the reference's does */
const TAIL = pchip([
  [-130, 25],
  [-90, 25],
  [-68, 19],
  [-46, 13],
  [-30, 16],
]);
const LOZ = { s0: 668, waist: 772, s1: 880, half: 46 } as const;
/** the lozenge's wall, normal to its outline (hand-local px) */
const WALL = 11;
const TAIL_HALF = 25;
const P = 1.4;

type Spec = { tailEnd: number; needleHalf: number };

const lozHalf = (s: number) => {
  if (s <= LOZ.s0 || s >= LOZ.s1) return 0;
  const u = s < LOZ.waist ? (s - LOZ.s0) / (LOZ.waist - LOZ.s0) : (LOZ.s1 - s) / (LOZ.s1 - LOZ.waist);
  return LOZ.half * Math.pow(u, P);
};
/** the outline's half-width at s */
function halfWidth(s: number, sp: Spec): number {
  if (s < -130) return TAIL_HALF;
  if (s < -30) return TAIL(s);
  if (s <= 668) return BODY(s) / 2;
  const base = s < LOZ.s1 ? 7.5 + ((s - 668) / (LOZ.s1 - 668)) * (sp.needleHalf - 7.5) : sp.needleHalf;
  return Math.max(base, lozHalf(s));
}
/** the hole's half-width at s: the largest w whose disc of radius WALL stays inside the outline (the inward normal
 *  offset of the outline), 0 where it closes */
function holeHalf(s: number, sp: Spec): number {
  let w = Infinity;
  for (let k = -WALL; k <= WALL; k += 0.5) {
    w = Math.min(w, halfWidth(s + k, sp) - Math.sqrt(Math.max(0, WALL * WALL - k * k)));
  }
  return Math.max(0, w);
}

const samples = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let s = a; s < b; s += step) out.push(s);
  out.push(b);
  return out;
};
const f = (v: number) => (Math.round(v * 100) / 100).toString();

export type HandDrawing = {
  /** the hand as one SVG path (evenodd: the hole is a second sub-path) */
  d: string;
  /** the outline's sample points (right side up, the needle's square end, left side down, the tail's round end) */
  outline: readonly (readonly [number, number])[];
};
function build(sp: Spec): HandDrawing {
  const sOut = [...samples(sp.tailEnd, 660, 6).slice(0, -1), ...samples(660, LOZ.s1 + 4, 1.5).slice(0, -1), ...samples(LOZ.s1 + 4, HAND_LEN, 30)];
  const hw = sOut.map((s) => halfWidth(s, sp));
  // the hole: where the offset is open, sampled finely, with its two ends closed on the axis
  const hs = samples(LOZ.s0, LOZ.s1, 1).map((s) => [s, holeHalf(s, sp)] as const);
  const first = hs.findIndex(([, w]) => w > 0.05);
  let last = hs.length - 1;
  while (last > 0 && hs[last][1] <= 0.05) last--;
  const open = first < 0 ? [] : hs.slice(Math.max(0, first - 1), Math.min(hs.length, last + 2));
  const holePts: (readonly [number, number])[] = [...open.map(([s, w]) => [w, -s] as const), ...[...open].reverse().map(([s, w]) => [-w, -s] as const)];
  const right = sOut.map((s, i) => [hw[i], -s] as const);
  const left = [...sOut].reverse().map((s, i) => [-hw[sOut.length - 1 - i], -s] as const);
  const arc = Array.from({ length: 9 }, (_, i) => {
    const th = Math.PI + (i / 8) * Math.PI;
    return [TAIL_HALF * Math.cos(th), -sp.tailEnd - TAIL_HALF * Math.sin(th)] as const;
  });
  const outer = `M ${right.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')} L ${left.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')} A ${TAIL_HALF} ${TAIL_HALF} 0 0 0 ${f(TAIL_HALF)} ${f(-sp.tailEnd)} Z`;
  const hole = holePts.length ? ` M ${holePts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')} Z` : '';
  return { d: outer + hole, outline: [...right, ...left, ...arc.slice(1, -1)] };
}

/** the world hand (M1, M3′, M2′, the T2 push, the seam, the cover) */
export const HAND_WORLD: HandDrawing = build({ tailEnd: -310, needleHalf: 6 });
/** M5′'s hand (drawn ×0.40 at the dial's centre, stage/style.ts FULL.hand): the needle ≥ 6 px on screen, the
 *  counterweight STYLE's length */
export const HAND_FULL: HandDrawing = build({ tailEnd: -205, needleHalf: 7.5 });

/** the collar band (hand-local rect) */
export const COLLAR = { x: -23, y: -632, w: 46, h: 14 } as const;
/** the hub (hand-local, unrotated): disc r 48, dome r 27 */
export const HUB_R = { disc: 48, dome: 27 } as const;

/**
 * REEL 6 · THE HAND, OUR PROPORTIONS (docs/ig/ig6/STYLE.md §9.5, judge-style fix 6: ≈ 10–15 % off the reference's
 * measured profile, so frame 0 is never a trace of it). One outline in hand-local px — pivot (0, 0), pointing up −y —
 * with the lozenge's hole as a second sub-path (fill-rule evenodd), built from the width profile:
 *
 *   s −230 … −50   tail (counterweight), 50 wide, a round end r 25
 *   s 48 → 220–320 → 400 → 460 → 520 → 570 → 610 → 640    32 → 44 → 40 → 32 → 26 → 22 → 18 → 15 (concave taper)
 *   s 618–632      the collar, a 46 × 14 deep-teal band (drawn on top, not part of the outline)
 *   s 640–668      the neck, 15
 *   s 668 → 772 → 880   the hollow lozenge, 0 → 92 → 0 outer (concave sides: width ∝ u^1.75 from each end)
 *   s 694 → 772 → 866   its hole, 0 → 58 → 0 (the ground shows through; outline ≈ 10–12 px normal to the edge)
 *   s 880–1095     the needle, 12, square end; it crosses the rim at s ≈ 1008 (the reading point)
 *
 * Pure data: the path string and the outline's sample points (the zone and overlap checks project them).
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
const LOZ = { s0: 668, waist: 772, s1: 880, half: 46 } as const;
const HOLE = { s0: 694, waist: 772, s1: 866, half: 29 } as const;
const NEEDLE_HALF = 6;
const TAIL = { half: 25, end: -205 } as const;
const P = 1.75;

const lozHalf = (s: number, L: { s0: number; waist: number; s1: number; half: number }) => {
  if (s <= L.s0 || s >= L.s1) return 0;
  const u = s < L.waist ? (s - L.s0) / (L.waist - L.s0) : (L.s1 - s) / (L.s1 - L.waist);
  return L.half * Math.pow(u, P);
};
/** the outline's half-width at s */
export function halfWidth(s: number): number {
  if (s < -50) return TAIL.half;
  if (s < -30) return TAIL.half + ((s + 50) / 20) * (BODY(-30) / 2 - TAIL.half);
  if (s <= 668) return BODY(s) / 2;
  const base = s < LOZ.s1 ? 7.5 + ((s - 668) / (LOZ.s1 - 668)) * (NEEDLE_HALF - 7.5) : NEEDLE_HALF;
  return Math.max(base, lozHalf(s, LOZ));
}

const samples = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let s = a; s < b; s += step) out.push(s);
  out.push(b);
  return out;
};
/** the s values the outline is sampled at (finer through the lozenge's curves) */
const S_OUT = [...samples(TAIL.end, 660, 6).slice(0, -1), ...samples(660, LOZ.s1 + 4, 1.5).slice(0, -1), ...samples(LOZ.s1 + 4, HAND_LEN, 30)];
const S_HOLE = samples(HOLE.s0, HOLE.s1, 1.5);
const f = (v: number) => (Math.round(v * 100) / 100).toString();

/** the outline (right side up, the needle's square end, left side down, the tail's round end) */
export const OUTLINE: readonly (readonly [number, number])[] = (() => {
  const right = S_OUT.map((s) => [halfWidth(s), -s] as const);
  const left = [...S_OUT].reverse().map((s) => [-halfWidth(s), -s] as const);
  // the tail's round end: a semicircle below s = TAIL.end, sampled for the checks (the path draws it as an arc)
  const arc = Array.from({ length: 9 }, (_, i) => {
    const th = Math.PI + (i / 8) * Math.PI;
    return [TAIL.half * Math.cos(th), -TAIL.end - TAIL.half * Math.sin(th)] as const;
  });
  return [...right, ...left, ...arc.slice(1, -1)];
})();
const HOLE_PTS: readonly (readonly [number, number])[] = [...S_HOLE.map((s) => [lozHalf(s, HOLE), -s] as const), ...[...S_HOLE].reverse().map((s) => [-lozHalf(s, HOLE), -s] as const)];

/** the hand as one SVG path (evenodd: the hole is a second sub-path) */
export const HAND_D: string = (() => {
  const right = S_OUT.map((s) => `${f(halfWidth(s))} ${f(-s)}`);
  const left = [...S_OUT].reverse().map((s) => `${f(-halfWidth(s))} ${f(-s)}`);
  const outer = `M ${right.join(' L ')} L ${left.join(' L ')} A ${TAIL.half} ${TAIL.half} 0 0 0 ${f(TAIL.half)} ${f(-TAIL.end)} Z`;
  const hole = `M ${HOLE_PTS.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')} Z`;
  return `${outer} ${hole}`;
})();

/** the collar band (hand-local rect) */
export const COLLAR = { x: -23, y: -632, w: 46, h: 14 } as const;
/** the hub (hand-local, unrotated): disc r 48, dome r 27 */
export const HUB_R = { disc: 48, dome: 27 } as const;

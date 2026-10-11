/**
 * REEL 6 · THE CLOCK'S STATE (docs/ig/ig6/SCRIPT.md §1–§4, §7; STYLE.md §9.5 "Motion of the object"): every value a pure
 * function of the absolute timeline frame t (fractional at 120 fps), hung on the moments of ../timing.ts (M), so the
 * picture re-anchors with the takes and with the cast (A / B) by itself. Picture only.
 *
 *   your phone   the dial STEPS −6° once a second with a kick (3 f expo to a 0.8° overshoot, SPRING.land settle), the
 *                hand recoils +0.8°; ring 1 on f0 (node 1 arrives under the needle), ring 2 on f180 (node 2, six real
 *                seconds later); each ring's 2 s stretch inks as the needle passes it
 *   the time-lapse (M5′, b3)  the hand jumps node to node on 8ths (f255 → φ 72, then +36° every 7.5 f to φ 324, then
 *                +12° to φ 336): ten black stretches on the teal rim, a minute of ringing, never said
 *   the agent    a fresh clock: from the pull-back's end it GLIDES −6°/s, linear (never eased); answered calls are
 *                filled teal domes that pop at the reading point — a handful, at irregular times, never a full ring
 *   the day      (M5′, b5) one full turn of the hand in 75 f, linear, five domes popping as it passes φ 36, 108, 144,
 *                252, 324; it lands at 12 on SPRING.land, then glides
 */
import { EASE, SPRING, springUnit } from '../../../lib/motion';
import * as T from '../timing';
import { VOICE } from '../voice.generated';
import { needlePhi } from './geom';
import { MARKS } from './style';

const M = T.M;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/* ── the kick: a step of 1 unit in 3 f (expo) to 1 + os, settled on SPRING.land ── */
export function kick(u: number, os: number): number {
  if (u <= 0) return 0;
  if (u < 3) return (1 + os) * EASE.expo(u / 3);
  return 1 + os * (1 - springUnit(u - 3, SPRING.land));
}
/** the kick without its overshoot (what has been "rung": the ink never runs back) */
const kickInk = (u: number) => (u <= 0 ? 0 : EASE.expo(Math.min(1, u / 3)));

/* ── your phone (M1 / M3′ world dial, shots A–D, and the seam) ── */
export const STEP = 30;
const STEP_DEG = 6;
const STEP_OS = 0.8 / STEP_DEG;
/** the dial's rotation ρ (deg): a step on every second from frame 0 (f0, 30, 60, …) */
export function phoneRho(t: number): number {
  if (t < 0) return 0;
  const k = Math.floor(t / STEP);
  return -STEP_DEG * k - STEP_DEG * kick(t - k * STEP, STEP_OS);
}
/** the dial angle up to which the ring stretches are ink (the needle's reading, without the overshoot) */
export function phoneInkTo(t: number): number {
  if (t < 0) return needlePhi(0);
  const k = Math.floor(t / STEP);
  return needlePhi(-STEP_DEG * k - STEP_DEG * kickInk(t - k * STEP));
}
/** the hand's recoil (deg, clockwise) on each step: +0.8° in 2 f, SPRING.land back */
export function recoil(t: number): number {
  if (t < 0) return 0;
  const u = t - Math.floor(t / STEP) * STEP;
  return u < 2 ? 0.8 * EASE.out3(u / 2) : 0.8 * (1 - springUnit(u - 2, SPRING.land));
}

/* ── a ring: the node pulses (1 → 1.15 → 1), shivers (±2 px along the rim, 12 Hz, e^(−t/4 f)) and sends one ping ── */
/** a quick bump 0 → 1 → 0, peaking at `peak` frames */
export const bump = (u: number, peak = 2.5) => (u <= 0 ? 0 : (u / peak) * Math.exp(1 - u / peak));
export const pulse = (t: number, at: number, k = 0.15) => 1 + k * bump(t - at);
export const shiver = (t: number, at: number, amp = 2) => {
  const u = t - at;
  if (u <= 0 || u > 12) return 0;
  return amp * Math.sin((2 * Math.PI * u) / 2.5) * Math.exp(-u / 4);
};
/** a ping: radius r0 → r1 (expo) and opacity .6 → 0 over 14 f; null when not alive */
export function ping(t: number, at: number, r0: number, r1: number): { r: number; o: number } | null {
  const u = (t - at) / 14;
  if (u < 0 || u >= 1) return null;
  // the radius on expo, the ink fading over the whole 14 f (an expo fade is gone in 2 f: the muted read needs it)
  return { r: r0 + (r1 - r0) * EASE.expo(u), o: 0.6 * Math.pow(1 - u, 1.4) };
}
/** the rings of your phone: node n rings at frame f (ring 1 on f0, ring 2 on f180) */
export const RINGS = [
  { n: 1, at: M.ring1 },
  { n: 2, at: M.ring2 },
] as const;
/** the hub's ring (b4: a fresh call rings at the hub of a clean clock) and the pickup */
export const HUB_RING = M.ring;
export const PICKUP = M.pickup;

/* ── the time-lapse (M5′, shot E): the hand's dial angle θ ── */
type Jump = { at: number; to: number };
const LAPSE_FROM = needlePhi(-48);
const LAPSE: readonly Jump[] = [
  { at: 240, to: 48 },
  { at: 255, to: 72 },
  ...Array.from({ length: 7 }, (_, i) => ({ at: 262.5 + 7.5 * i, to: 108 + 36 * i })),
  { at: 315, to: 336 },
];
/** the hand's dial angle in the time-lapse; `ink`: without the overshoot */
export function lapseTheta(t: number, ink = false): number {
  let from = LAPSE_FROM;
  let v = from;
  for (const j of LAPSE) {
    if (t < j.at) break;
    const d = j.to - from;
    v = from + d * (ink ? kickInk(t - j.at) : kick(t - j.at, 0.8 / d));
    from = j.to;
  }
  return v;
}
/** the node a jump lands on pulses as it lands (3 f after the jump starts) */
export const LAPSE_LANDS: readonly { n: number; at: number }[] = LAPSE.filter((j) => j.to % MARKS.nodeEvery === 0).map((j) => ({ n: j.to / MARKS.nodeEvery + 1, at: j.at + 3 }));

/* ── the agent (shots H, J, K: the world dial) ── */
/** the glide starts as the pull-back ends (f384 at plan) */
export const GLIDE_FROM = M.rebuild[1];
/** shot J's orbit of the dial plane: −8° over 40 f (inOut) from the words cut */
export const ORBIT = { deg: -8, dur: 40 } as const;
export function agentRho(t: number): number {
  const glide = t < GLIDE_FROM ? 0 : (-STEP_DEG * (t - GLIDE_FROM)) / STEP;
  return glide + ORBIT.deg * EASE.inOut(clamp01((t - M.words) / ORBIT.dur));
}
/** "Ring it yourself.": her onset of "yourself." (the dome pops at the reading point on it); without ig6-06 (trim T1)
 *  the beat a second into shot K */
const yourself = (() => {
  const at = T.LINE.ring;
  const id = T.TAKES.ring;
  if (at === null || id === null) return M.ringShot + 30;
  const k = Math.max(0, VOICE.lines[id].say.split(' ').findIndex((w) => /^yourself/i.test(w)));
  return at + T.vWord(id, k);
})();
/** the agent's answered calls on the world dial, each a dome that pops at the reading point at `pop` and then rides the
 *  dial: this call (the rebuild), another on the words cut, one on "yourself" */
export const AGENT_DOMES: readonly { pop: number; phi: number }[] = [M.rebuild[0] + 2, M.words, yourself].map((pop) => ({ pop, phi: needlePhi(agentRho(pop)) }));
/** a dome's pop-in scale (SPRING.pop from 0) */
export const popIn = (t: number, at: number) => (t < at ? 0 : springUnit(t - at, SPRING.pop));

/* ── the day (M5′ agent, shot I) ── */
export const DAY = { from: M.sweep[0], to: M.sweep[1], domes: [36, 108, 144, 252, 324] } as const;
/** the hand's dial angle through the day: one full turn, linear; lands at 12 with a 0.8° bump; then glides 6°/s */
export function dayTheta(t: number): number {
  if (t <= DAY.from) return 0;
  if (t <= DAY.to) return (360 * (t - DAY.from)) / (DAY.to - DAY.from);
  const u = t - DAY.to;
  return 360 + 0.8 * bump(u, 1.5) + (STEP_DEG * u) / STEP;
}
/** the domes of the day pop as the needle passes them (and the pickup's own dome at φ 0, there from the cut) */
export const DAY_DOMES: readonly { phi: number; pop: number }[] = [{ phi: 0, pop: -Infinity }, ...DAY.domes.map((phi) => ({ phi, pop: DAY.from + (phi / 360) * (DAY.to - DAY.from) }))];

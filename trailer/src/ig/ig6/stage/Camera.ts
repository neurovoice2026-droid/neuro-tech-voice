/**
 * REEL 6 · THE CAMERA AND THE SHOTS (docs/ig/ig6/SCRIPT.md §3, STYLE.md §9.6, §9.9): one camera on 2.5D layers, as a pure
 * function of the absolute frame. Picture only.
 *
 *   A  f0–90       M1 the reference frame (screen = world), your phone ticking
 *   B  f90–210     M3′ tip macro ×1.8 about the reading point (T1 tick cut: the reading point keeps its screen spot);
 *                  the snap punch-in ×1.0 → ×1.3 on ring 2 (8 f expo, no overshoot), lifting 90 px (TikTok rail)
 *   C  f210–222    M1 (T1)
 *   D  f222–232    T2 the fall-through: world ×1 → ×12 → ×240 about node 2 (an accelerating exponential push) while
 *                  node 2 pans to the frame's centre line (540, 800; inOut, 6 f); the rim and ticks thin away ×3 → ×6,
 *                  then only node 2 is drawn; f232–234 pure white (its white centre)
 *   E  f234–cut    M5′ the whole dial (its own upright drawing; it opens out of the white ×3 → ×1); the T3 whip
 *                  (+75° in 7 f, peel) cut on its fastest frame
 *   G  cut–364     M2′ the hub macro of a fresh clock (no dial in frame), its rotation continuing −35° → 0 (12 f expo)
 *   H  364–384     the pull-back M2′ → M1 (20 f inOut), the hub travelling (260, 900) → (97, 1183); then M1, the agent
 *   I  day–words   M5′ the agent's day
 *   J  words–ring  M3′ (the dial plane orbits −8°: clock.ts agentRho)
 *   K  ring–exit   M1; the exit: dial and hand lift up and leave (8 f in3, the hand plane 2 f ahead)
 *   L  end         End6 (white); the seam re-forms frame 0 in M1
 *
 * The macro drift never stops: +1.5 %/s about each shot's focus. The camera never overshoots.
 */
import { EASE, mix } from '../../../lib/motion';
import * as T from '../timing';
import { phoneRho } from './clock';
import { project, planeOf, polar, worldA, type Cam, K, HUB, RP } from './geom';
import { CROPS, DIAL } from './style';

const M = T.M;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const drift = (t: number, t0: number) => 1 + (CROPS.drift * (t - t0)) / 30;

/** M1 about the reading point (identity at zoom 1) */
const m1 = (t: number, t0: number): Cam => ({ ax: RP.x, ay: RP.y, fx: RP.x, fy: RP.y, zoom: drift(t, t0), rot: 0 });
/** M3′ ×1.8 about the reading point (+ the punch-in) */
const m3 = (t: number, t0: number, punchAt?: number): Cam => {
  const p = punchAt === undefined ? 0 : EASE.expo(clamp01((t - punchAt) / 8));
  // the punch-in lifts the frame 90 px as it lands, so the ticks at the right edge stay above TikTok's rail (y 840)
  return { ax: RP.x, ay: RP.y - CROPS.m3.lift * p, fx: RP.x, fy: RP.y, zoom: CROPS.m3.zoom * drift(t, t0) * (1 + CROPS.m3.punch * p), rot: 0 };
};
/** M2′: the hub at (260, 900), ×2.2, its rotation continuing the whip (−35° → 0, 12 f expo from the cut) */
const m2 = (t: number): Cam => ({
  ax: CROPS.m2.anchor.x,
  ay: CROPS.m2.anchor.y,
  fx: HUB.x,
  fy: HUB.y,
  zoom: CROPS.m2.zoom * drift(t, M.cut),
  rot: -35 * (1 - EASE.expo(clamp01((t - M.cut) / 12))),
});
const PULL = M.rebuild;
const pull = (t: number): Cam => {
  const u = EASE.inOut(clamp01((t - PULL[0]) / (PULL[1] - PULL[0])));
  return { ax: mix(CROPS.m2.anchor.x, HUB.x, u), ay: mix(CROPS.m2.anchor.y, HUB.y, u), fx: HUB.x, fy: HUB.y, zoom: mix(CROPS.m2.zoom * drift(PULL[0], M.cut), 1, u), rot: 0 };
};

/* ── T2: the fall-through into node 2 ── */
/** node 2 pans to (540, 800) — the frame's centre line, a little high so the growing ring stays off the leaving lockup —
 *  and the zoom reaches ×240 by the white frame (its white centre then covers the farthest corner, 1280 px away) */
export const FALL = { from: M.fall[0], white: M.fall[0] + 10, open: M.fall[1], zEnd: 240, pan: 6, to: { x: 540, y: 800 } } as const;
/** node 2's world position during the push (the dial stands still between the f210 step and E) */
const n2World = () => polar(worldA(36, phoneRho(FALL.from)), DIAL.R);
/** the push's zoom factor: 1 → ×12 by f228 → ×240 by f232 (log-space u^p with p chosen so ×12 lands on the plan's f228) */
const FALL_P = Math.log(Math.log(12) / Math.log(240)) / Math.log(0.6);
export const fallZoom = (t: number) => Math.pow(FALL.zEnd, Math.pow(clamp01((t - FALL.from) / (FALL.white - FALL.from)), FALL_P));
const fall = (t: number): Cam => {
  const c0 = m1(FALL.from, M.shotC);
  const n2 = n2World();
  const s0 = project(planeOf(c0, K.dial), n2.x, n2.y);
  const u = EASE.inOut(clamp01((t - FALL.from) / FALL.pan));
  return { ax: mix(s0.x, FALL.to.x, u), ay: mix(s0.y, FALL.to.y, u), fx: n2.x, fy: n2.y, zoom: c0.zoom * fallZoom(t), rot: 0 };
};

/* ── the exit into End6: dial + hand lift straight up and leave (8 f in3, the hand plane 2 f ahead). Straight up because
 *    the dial is a circle of R 1623 seen through a corner: any zoom-out or sideways move brings its unseen rim into the
 *    frame (scratch check: a pure lift of ≥ 900 px clears every mark and reveals nothing new); the hand, nearer, lifts
 *    further (1450 px clears its tail). ── */
export const EXIT = { from: M.exit[0], dur: 8, lead: 2, dial: 920, hand: 1450 } as const;
const recede = (t: number, lift: number): Cam => {
  const c = m1(t, M.ringShot);
  const u = EASE.in3(clamp01((t - EXIT.from - EXIT.lead) / EXIT.dur));
  return { ...c, ay: c.ay - lift * u };
};

/* ── the seam (f826–840): frame 0's M1, its drift continuing into f0 ── */
const seam = (t: number): Cam => m1(t, T.DURATION);

export type Mode = 'phone' | 'agent';
export type Shot =
  | { kind: 'world'; name: string; cam: Cam; handCam: Cam; mode: Mode; dial: boolean; fall?: number }
  | { kind: 'full'; name: string; mode: Mode }
  | { kind: 'white'; name: string }
  | { kind: 'end'; name: string };

const world = (name: string, cam: Cam, mode: Mode, o: { handCam?: Cam; dial?: boolean; fall?: number } = {}): Shot => ({ kind: 'world', name, cam, handCam: o.handCam ?? cam, mode, dial: o.dial ?? true, fall: o.fall });

/** the shot at absolute frame t */
export function shotAt(t: number): Shot {
  if (t < M.shotB) return world('A', m1(t, 0), 'phone');
  if (t < M.shotC) return world('B', m3(t, M.shotB, M.ring2), 'phone');
  if (t < FALL.from) return world('C', m1(t, M.shotC), 'phone');
  if (t < FALL.white) return world('D', fall(t), 'phone', { fall: fallZoom(t) });
  if (t < FALL.open) return { kind: 'white', name: 'D-white' };
  if (t < M.cut) return { kind: 'full', name: 'E', mode: 'phone' };
  if (t < PULL[0]) return world('G', m2(t), 'phone', { dial: false });
  if (t < PULL[1]) return world('H-pull', pull(t), 'agent');
  if (t < M.day) return world('H', m1(t, PULL[1]), 'agent');
  if (t < M.words) return { kind: 'full', name: 'I', mode: 'agent' };
  if (t < M.ringShot) return world('J', m3(t, M.words), 'agent');
  if (t < EXIT.from) return world('K', m1(t, M.ringShot), 'agent');
  if (t < T.SCENES.end.from) return world('K-exit', recede(t, EXIT.dial), 'agent', { handCam: recede(t + EXIT.lead, EXIT.hand) });
  if (t < T.END_CARD.seam) return { kind: 'end', name: 'L' };
  return world('seam', seam(t), 'phone');
}

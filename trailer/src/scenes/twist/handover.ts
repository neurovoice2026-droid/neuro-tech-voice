/**
 * THE HAND-OVER — the avatar orb from the end of the dive into the call.
 *
 * From global PICKUP − 4 (the call's roomIn) the call draws its own orb over
 * ours; until the twist's last post frame (PICKUP + 12) both scenes draw it.
 * So from there on the twist draws it EXACTLY as the call does: the call's
 * framing + camera (call/shots), its voice tables (call/voice) and the two
 * inline curves of Call.tsx's orbAt / flow (talkSwell, flowBoost — mirrored
 * here), the shared pickup (lib/pickup) and the same canvas: orbBase() at
 * resolution 1.25, framed by transform only. Same pixels, no seam.
 */
import { CALL_ORB_START } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { aos, breathe, EASE, SPRING, tween } from '../../lib/motion';
import { PICKUP, pickupGlow, pickupScale, twistOrbVolume } from '../../lib/pickup';
import { CALL_LOCAL, SCENES } from '../../timing';
import { camAt as callCamAt, framingAt, orbToScreen } from '../call/shots';
import { lightAt, listenAt, ORB_FRAME0, orbVolumeByIndex, volumeAt } from '../call/voice';
import { avatarOnPhone, buzz, camAt, layerXf, project, TW, type Geo } from './geometry';

/** twist-local frame of the pickup (= call t 0) */
export const TP = PICKUP - SCENES.twist.from;

/** Call.tsx `gulpKick` (0 until the call's swallow, long after our last frame) */
const gulpKick = (c: number) => {
  const u = c - CALL_LOCAL.swallow;
  if (u < 0) return 0;
  return Math.exp(-u / 5) * Math.sin((Math.PI * u) / 5);
};

/** Call.tsx `talkSwell` — 1 until the pickup, eased in over its first 6 frames */
const talkSwell = (c: number) =>
  1 +
  (0.022 * Math.max(0, (volumeAt(c) - 0.12) / 0.7) * (0.7 + 0.3 * Math.sin((c / 48) * Math.PI * 2)) + 0.045 * lightAt(c)) *
    tween(c, [0, 6], [0, 1], EASE.house);

/** The call's orb on screen at call-local frame c (≥ roomIn[0]). */
export function callOrbAt(c: number, L: Layout) {
  const s = orbToScreen(callCamAt(c, L), framingAt(c, L));
  return { x: s.x, y: s.y, d: s.d * pickupScale(c + PICKUP) * (1 + 0.05 * gulpKick(c)) * talkSwell(c) };
}

/** Call.tsx `flowBoost` (0 before the pickup) */
const flowBoost = (c: number) => tween(c, [0, 30], [0, 1], EASE.inOut) * (0.3 + 0.7 * lightAt(c));

/**
 * Flow-time integrator input by frame index (index = twist t + 8 = call t +
 * ORB_FRAME0): before the pickup it is twistOrbVolume, after it the call's.
 */
export const orbFlowVolume = (fr: number) => orbVolumeByIndex(fr) + flowBoost(fr - ORB_FRAME0);

/** The shader volume at twist-local t (the call's table after the pickup; the
 *  call's table IS twistOrbVolume before it, on whole frames). */
export const orbShaderVolume = (t: number) => (t < TP ? twistOrbVolume(t) : volumeAt(t - TP));

/** The listen mix (0 through the twist; the call's after the pickup). */
export const orbListen = (t: number) => listenAt(t - TP);

/** Call.tsx `rim` — pickupGlow + her level and light, eased in after the pickup. */
export function callRimAt(c: number): number {
  const lvl = Math.max(0, (volumeAt(c) - 0.12) / 0.7);
  return pickupGlow(c + PICKUP) + (0.2 * lvl + 0.3 * lightAt(c)) * tween(c, [0, 12], [0, 1], EASE.house);
}

/** One breath before the pickup squash: +2 % on a 2-beat sine, windowed (sin²)
 *  so it leaves and returns to rest with zero speed — the squash takes over from rest. */
export function breath(tt: number): number {
  const [a, b] = TW.breath;
  if (tt <= a || tt >= b) return 0;
  const w = Math.sin((Math.PI * (tt - a)) / (b - a)) ** 2;
  return breathe(tt, 30, 0.02, Math.PI) * w;
}

/**
 * The avatar orb on screen (twist-local tt, fractional ok). On the phone it
 * rides the phone plane (0.6); over orbLock it settles onto CALL_ORB_START;
 * it breathes, squashes into the pickup (lib/pickup), and from the call's
 * roomIn it IS the call's orb.
 */
export function avatarAt(tt: number, g: Geo, L: Layout) {
  if (tt >= TP + CALL_LOCAL.roomIn[0]) return callOrbAt(tt - TP, L);
  const O = CALL_ORB_START(L);
  const x = layerXf(camAt(tt, g), 0.6);
  const p = project(x, L, g.phone.cx, g.phone.cy);
  const bz = buzz(tt, x.f);
  const pop = Math.max(0, aos(tt, TW.avatarPop, { anticip: 0, depth: 0, config: SPRING.pop }));
  const lock = tween(tt, TW.orbLock, [0, 1], EASE.inOut);
  const px = p.x + bz.x;
  const py = p.y + bz.y;
  const d0 = avatarOnPhone(tt, g) * x.f * pop;
  return {
    x: px + (O.x - px) * lock,
    y: py + (O.y - py) * lock,
    d: (d0 + (O.d - d0) * lock) * (1 + breath(tt)) * pickupScale(tt + SCENES.twist.from),
  };
}

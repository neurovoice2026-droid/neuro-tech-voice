/**
 * THE PICKUP — shared by the TWIST (its last frames) and the CALL (its first),
 * so the orb's squash / pop / glow and its flow-time input are one curve
 * across the cut. All functions take GLOBAL timeline frames unless noted.
 *
 *   P − 20 …     rim glow at rest .35
 *   P − 6 … P    the orb gathers: squash 1 → .92 (power4.in), glow .35 → .46 (power2.in)
 *   P            PICKUP on the downbeat: glow flashes .75
 *   P … P + 3    pop to 1.12 (power3.out)
 *   P + 3 …      settles to 1 on the site spring (one small undershoot, |x − 1| < .002
 *                by P + 16); glow decays e^(−u/6)
 *
 * Both scenes draw the orb in the same place from global PICKUP − 4 (the
 * call's roomIn) to PICKUP + 12 (the twist's post): size = CALL_ORB_START.d ·
 * pickupScale, rim = ORB_RIM(pickupGlow, pickupRimSpread(volume)), flow time
 * integrated from twistOrbVolume.
 */
import { EASE, SPRING, springAt, tween } from './motion';
import { SCENES, TWIST } from '../timing';

/** The pickup frame (global) = the call's first frame. */
export const PICKUP = SCENES.call.from;

/** The orb's scale around the pickup (global frame, fractional ok). */
export function pickupScale(g: number): number {
  const P = PICKUP;
  if (g < P - 6) return 1;
  if (g < P) return 1 - 0.08 * EASE.in4((g - (P - 6)) / 6);
  if (g < P + 3) return 0.92 + 0.2 * EASE.out3((g - P) / 3);
  return 1.12 - 0.12 * springAt(g, P + 3, SPRING.site);
}

/** The orb's rim-glow strength around the pickup (global frame): .35 at rest (from P − 20). */
export function pickupGlow(g: number): number {
  const P = PICKUP;
  if (g < P - 6) return 0.35;
  if (g < P) return 0.35 + 0.11 * EASE.in2((g - (P - 6)) / 6);
  return 0.35 + 0.4 * Math.exp(-(g - P) / 6);
}

/** twist-local frame of the pickup */
const TWIST_PICKUP = PICKUP - SCENES.twist.from;

/**
 * The twist's own orb volume (twist-local frame), so the orb's flow time
 * carries across the cut: the ring-2 shiver, the lift of the dive and the
 * inhale into the pickup (the fluid quickens over the last 10 frames — the
 * call's pickup spike starts from where this ends).
 * The call integrates it through call/voice.ts (orbVolumeByIndex, ORB_FRAME0).
 */
export function twistOrbVolume(tt: number): number {
  const shiver =
    tween(tt, [TWIST.ring2, TWIST.ring2 + 4], [0, 1], EASE.out3) *
    tween(tt, [TWIST.ring2 + 8, TWIST.ring2 + 20], [1, 0], EASE.inOut);
  const inhale = tween(tt, [TWIST_PICKUP - 10, TWIST_PICKUP], [0, 1], EASE.in2);
  return 0.12 + 0.12 * shiver + 0.1 * tween(tt, TWIST.pushToPhone, [0, 1], EASE.inOut) + 0.1 * inhale;
}

/**
 * The orb's rim light (a lilac halo hugging the sphere + its contact shadow),
 * at strength `a` (pickupGlow + speech). Drawn on a round div BEHIND the
 * canvas, the same size as the orb, in screen space. (The brief's constant
 * `inset 0 0 0 1.5px` line would sit under the opaque canvas there, so the
 * call's halo form is the shared rim; the brief's outer glow is PICKUP_GLOW.)
 */
export const ORB_RIM = (a: number, spread = 1) =>
  `0 0 ${(26 * spread).toFixed(1)}px ${(2 * spread).toFixed(1)}px rgba(185,163,255,${a.toFixed(3)}), 0 30px 60px -20px rgba(8,6,28,0.7)`;

/** The rim's spread for an orb volume: the call's `1 + 1.2 · lvl`. */
export const pickupRimSpread = (volume: number) => 1 + 1.2 * Math.max(0, (volume - 0.12) / 0.7);

/**
 * The outer glow (the brief's spec): a sibling disc behind the canvas (radius 50 %),
 * box-shadow 0 0 80px 16px electric at pickupGlow. `k` scales it with the orb (d / 300).
 */
export const PICKUP_GLOW = (g: number, k = 1, alpha = 1) =>
  `0 0 ${(80 * k).toFixed(1)}px ${(16 * k).toFixed(1)}px rgba(124,58,237,${(pickupGlow(g) * alpha).toFixed(3)})`;

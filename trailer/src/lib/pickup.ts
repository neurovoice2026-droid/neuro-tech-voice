/**
 * THE PICKUP — shared by the TWIST (its last frames) and the CALL (its first),
 * so the orb's squash / pop / glow and its flow-time input are one curve
 * across the cut. All functions take GLOBAL timeline frames unless noted.
 *
 *   P − 6 … P    the orb gathers: squash 1 → .92 (power4.in), rim glow .35 → .46
 *   P            PICKUP on the downbeat: glow flashes .75
 *   P … P + 3    pop to 1.12 (power3.out)
 *   P + 3 …      settles to 1 on the site spring (≈ P + 16); glow decays e^(−u/6)
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

/** The orb's rim-glow strength around the pickup (global frame). */
export function pickupGlow(g: number): number {
  const P = PICKUP;
  if (g < P - 6) return 0.35;
  if (g < P) return 0.35 + 0.11 * EASE.inOut((g - (P - 6)) / 6);
  return 0.35 + 0.4 * Math.exp(-(g - P) / 6);
}

/**
 * The twist's own orb volume (twist-local frame), so the orb's flow time
 * carries across the cut: the ring-2 shiver and the lift of the dive.
 */
export function twistOrbVolume(tt: number): number {
  const shiver =
    tween(tt, [TWIST.ring2, TWIST.ring2 + 4], [0, 1], EASE.out3) *
    tween(tt, [TWIST.ring2 + 8, TWIST.ring2 + 20], [1, 0], EASE.inOut);
  return 0.12 + 0.12 * shiver + 0.1 * tween(tt, TWIST.pushToPhone, [0, 1], EASE.inOut);
}

/** The orb's rim light (a lilac halo hugging the sphere + its contact shadow), at strength `a`. */
export const ORB_RIM = (a: number, spread = 1) =>
  `0 0 ${(26 * spread).toFixed(1)}px ${(2 * spread).toFixed(1)}px rgba(185,163,255,${a.toFixed(3)}), 0 30px 60px -20px rgba(8,6,28,0.7)`;

/**
 * REEL 5 · WHEN A SPRING HAS SETTLED (crit-r3 LOOK3-B1). A carrier rides its sub-pixel glide layer while it moves
 * (lib/glide `subpixel`) and drops back to plain, pixel-crisp raster at rest. Testing "moving" as |1 − u| > ε on an
 * UNDERDAMPED spring (SPRING.site ζ ≈ .64, SPRING.land ζ ≈ .45, SPRING.pop ζ ≈ .66) is not monotone: every time the
 * overshoot crosses rest, |1 − u| dips under ε for 1–5 render frames, the paper leaves its layer, snaps crisp, and goes
 * soft again when it returns — a ±18 % sharpness twinkle on a card that reads as still. Here "moving" is the spring's
 * ENVELOPE instead: true from release (dt > 0) until the bound on |1 − u| has decayed under ε for good, so each carrier
 * takes exactly one soft → crisp step, after its spring has settled.
 *
 *   underdamped  |1 − u(t)| ≤ A·e^(−ζω0·t), A = √(1 + (ζω0/ωd)²)   (cos + a·sin has amplitude √(1 + a²))
 *   critical     |1 − u(t)| = (1 + ω0·t)·e^(−ω0·t)                (monotone; springUnit treats every ζ ≥ 1 so)
 *
 * SPRING.site settles to 2e-4 in ≈ 24 f, SPRING.land in ≈ 40 f, SPRING.pop in ≈ 15 f (30 fps timeline frames).
 * Picture only (stage/): outside ig5's sound hash.
 */
import type { SpringConfig } from 'remotion';
import { FPS } from '../../../timing';

/** the guard's default: |1 − u| ≤ 2e-4 of a move (≤ .14 px of a 700 px travel) reads as rest */
export const SETTLE_EPS = 2e-4;

const cache = new Map<string, number>();
/** timeline frames after release until the spring's envelope stays within `eps` of rest */
export function settleFrames(config: Partial<SpringConfig>, eps = SETTLE_EPS): number {
  const k = config.stiffness ?? 100;
  const c = config.damping ?? 10;
  const m = config.mass ?? 1;
  const key = `${k}/${c}/${m}/${eps}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  let secs: number;
  if (z < 1) {
    const zw = z * w0;
    const wd = w0 * Math.sqrt(1 - z * z);
    const A = Math.sqrt(1 + (zw / wd) ** 2);
    secs = Math.max(0, Math.log(A / eps) / zw);
  } else {
    // (1 + w0 t) e^(−w0 t) is monotone: bisect for its crossing of eps
    let lo = 0;
    let hi = 1;
    while ((1 + w0 * hi) * Math.exp(-w0 * hi) > eps) hi *= 2;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if ((1 + w0 * mid) * Math.exp(-w0 * mid) > eps) lo = mid;
      else hi = mid;
    }
    secs = hi;
  }
  const frames = secs * FPS;
  cache.set(key, frames);
  return frames;
}

/** a spring released `dt` frames ago is still moving (monotone: once false after release, false for good) */
export const springMoving = (dt: number, config: Partial<SpringConfig>, eps = SETTLE_EPS): boolean => dt > 0 && dt < settleFrames(config, eps);

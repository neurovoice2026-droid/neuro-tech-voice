/**
 * REEL 1 · THE FRONT DESK (docs/ig/SCRIPT.md ig1 b1): a 1.5 px graphite hairline at y 760 drawing x 86 → 906 (EASE.draw
 * 0.6 s from f −6: moving at frame 0), the desk phone at its right end — the rose line light, Ø 18 — ringing at f0 and
 * f30 (a pair of rings per burst). The week grid unfolds out of this line (WeekGrid) and folds back into it in the seam.
 */
export const DESK = { y: 760, x0: 86, x1: 906, dot: 18, draw: [-6, 12] as const, rings: [-2, 2, 28, 32] as const } as const;
/**
 * THE RINGS (Hook.tsx DeskRings): a pair of hairlines per trill burst (its two chirps: the bursts at f0 and f30), the
 * first already leaving the phone at frame 0 (so the still reads as ringing, and the seam's re-formed frame 0 is caught
 * mid-ring); each travels out across the empty desk and the frame below it over RING_LIFE frames.
 */
export const RING_LIFE = 54;
/** a ring's swell on the phone's light and on the ground's rose: up over 2 f, back over ≈ 12 f */
export const ringSwell = (t: number) =>
  DESK.rings.reduce((m, r) => (t < r ? m : Math.max(m, Math.min(1, (t - r) / 2) * Math.exp(-Math.max(0, t - r - 2) / 12))), 0);

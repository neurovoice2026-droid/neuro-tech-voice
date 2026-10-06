/**
 * REEL 1 · THE FRONT DESK (docs/ig/SCRIPT.md ig1 b1): a 1.5 px graphite hairline at y 760 drawing x 86 → 906 (EASE.draw
 * 0.6 s from f −6: moving at frame 0), the desk phone at its right end — the rose line light, Ø 18 — ringing at f0 and
 * f30. The week grid unfolds out of this line (WeekGrid) and folds back into it in the seam.
 */
export const DESK = { y: 760, x0: 86, x1: 906, dot: 18, draw: [-6, 12] as const, rings: [0, 30] as const } as const;

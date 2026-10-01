/**
 * Travel curves for SCALE whose overshoot is a FIXED number of pixels,
 * whatever the distance: a spring's natural overshoot is a fraction of the
 * travel, so a 1300 px flight on the site spring lands ~100 px past its
 * target. Here the shape is an analytic under-damped spring (closed form:
 * continuous at the fractional times the 120 fps master samples) whose
 * excursion past 1 is rescaled to `over` px. Anticipation (a small pull-back
 * before the start) is optional and also in pixels.
 */
export type SlideOpts = {
  /** natural frequency, rad per FRAME (1 ≈ a 3-frame move) */
  w?: number;
  /** damping ratio (< 1) */
  z?: number;
  /** px the move carries past its target */
  over?: number;
  /** frames of anticipation before the start */
  anticip?: number;
  /** px of pull-back during the anticipation */
  back?: number;
};

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** 0 → 1 progress (dips < 0 before `tau = 0`, peaks at 1 + over/dist). */
export function slide(tau: number, dist: number, { w = 1, z = 0.7, over = 8, anticip = 0, back = 0 }: SlideOpts = {}): number {
  const d = Math.max(1, dist);
  if (tau <= -anticip) return 0;
  if (tau < 0) return -(back / d) * Math.sin(((tau + anticip) / anticip) * (Math.PI / 2));
  const wd = w * Math.sqrt(1 - z * z);
  const x = 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + ((z * w) / wd) * Math.sin(wd * tau));
  // first crossing of 1, and the natural overshoot fraction
  const tc = (Math.PI - Math.atan(wd / (z * w))) / wd;
  const peak = Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z));
  const k = Math.min(1, over / (peak * d));
  // blend the excursion scale in around the crossing (no velocity kink)
  const m = 1 + (k - 1) * smooth((tau - (tc - 1.2)) / 1.8);
  let p = 1 + (x - 1) * m;
  // climb out of the anticipation dip over the first frames
  if (back > 0 && anticip > 0) p -= (back / d) * Math.max(0, 1 - tau / 2.5) * (1 - Math.min(1, p));
  return p;
}

/**
 * Small timing shapes for the scene's accents (no blur anywhere: the film
 * renders at 120 fps, so motion itself reads crisply — nothing is smeared).
 */

/** a short, fast accent pulse: 1 on frame `at`, decaying e^(−u/τ) (0 before) */
export const flashAt = (t: number, at: number, tau = 4) => (t < at ? 0 : Math.exp(-(t - at) / tau));

/** 0 → 1 → 0 over [a, b] (sine): a ring's life, a glint's pass */
export const lifeAt = (t: number, a: number, b: number) =>
  t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a));

/** a soft camera / scale "kick": eased in over `attack` frames (smoothstep), then e^(−u/τ). 0 before. */
export function kickAt(t: number, at: number, attack = 2, tau = 5): number {
  const u = t - at;
  if (u <= 0) return 0;
  if (u < attack) {
    const x = u / attack;
    return x * x * (3 - 2 * x);
  }
  return Math.exp(-(u - attack) / tau);
}

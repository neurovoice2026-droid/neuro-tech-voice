/**
 * The hook's vignette, dithered.
 *
 * On the hook's black the shared vignette (rgba(6,4,10) over a black that
 * renders at ≈ (7,5,11)) changes the picture by ONE level over half
 * the frame, so the 8-bit output steps in a ring wherever its alpha crosses
 * 0.5 — and where the field or a mote lifts the base, in more rings, each
 * channel at its own radius (so they even shift hue). Noise laid on top after
 * the fact cannot fix that: the step is already in the 8-bit picture.
 *
 * So the dither goes INTO the vignette's own blend: its alpha is masked per
 * pixel by a fine noise (feTurbulence, ≈ 1 px grain, re-seeded every frame),
 * scaled so the mean is the shared vignette's. The blend is computed before
 * the single rounding of the output, so where it sits half-way between two
 * levels each pixel lands on one or the other at random — the ring becomes a
 * wide stochastic ramp. On lit content under the vignette (motes near the
 * edge) the same ±40 % of its alpha is a few levels of grain, like the film
 * grain that is already there; at the centre the vignette is 0 and so is this.
 */
import React from 'react';
import { AbsoluteFill, random } from 'remotion';

/** Mask alpha = SLOPE·n + OFFSET for noise n (mean 0.5, σ ≈ 0.118): mean 0.6, σ ≈ 0.25, ≈ 0.1–1.
 *  (Tuned on the H.264 output, not the PNG: σ 0.1 left the rings legible after the encoder
 *  smoothed the dither; ≈ 1 px grain survives CRF 16 better than a coarser 2 px one.) */
const SLOPE = 2.12;
const MEAN = 0.6;
const OFFSET = MEAN - SLOPE * 0.5; // −0.46
const FREQ = 0.92;

const tile = (seed: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='d' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='${FREQ}' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${SLOPE} 0 0 0 ${OFFSET}'/></filter><rect width='256' height='256' filter='url(#d)'/></svg>`,
  )}")`;

/** Same stops as components/Grain <Vignette> (strength 1), alpha divided by the mask's mean.
 *  (Past 76 % that clamps at 1 — off screen: the frame's corners sit at ≈ 71 % of this ellipse.) */
export const DitheredVignette: React.FC<{ frame: number; strength?: number; color?: string }> = ({
  frame,
  strength = 1,
  color = '6,4,10',
}) => {
  const seed = 100 + (frame % 12);
  const x = Math.floor(random(`hook-dither-x-${frame}`) * 256);
  const y = Math.floor(random(`hook-dither-y-${frame}`) * 256);
  const a = (v: number) => Math.min(1, (v * strength) / MEAN).toFixed(3);
  const mask = tile(seed);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(105% 88% at 50% 46%, transparent 34%, rgba(${color},${a(0.55)}) 76%, rgba(${color},${a(0.92)}) 100%)`,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: '256px 256px',
        WebkitMaskSize: '256px 256px',
        maskPosition: `${x}px ${y}px`,
        WebkitMaskPosition: `${x}px ${y}px`,
        maskRepeat: 'repeat',
        WebkitMaskRepeat: 'repeat',
      }}
    />
  );
};

/* ── Dithered radial glows ──────────────────────────────────────────────
 * A faint radial glow (the line's lilac light) has the same problem at its
 * tail: where it adds less than a level or two, its edge rounds to a ring.
 * Here the noise depth is set per radius from the glow's own contribution:
 * none in the core (where grain would show), full in the tail, so every
 * pixel gets ≈ ±0.6 level of dither before the one rounding of the blend.
 *   mask = (1 − s) + s·u      u: noise in [0, 1] (mean 0.5, σ ≈ 0.25)
 *   s(p) = min(1, 2.4 / levels(p))  →  ≈ 0.6 level σ wherever it matters
 * and the glow's alpha at each stop is divided by the mask's mean (1 − s/2).
 */
const U_SLOPE = 2.12;
const U_OFFSET = -0.56;
const uTile = (seed: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='u' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${U_SLOPE} 0 0 0 ${U_OFFSET}'/></filter><rect width='256' height='256' filter='url(#u)'/></svg>`,
  )}")`;

/**
 * Style for a dithered radial glow: `alphaAt(p)` (p 0..1 along the radius) is the glow's
 * alpha profile, `rgb` its "r,g,b", `levels` how many output levels one unit of alpha adds
 * on the black (≈ the glow colour's brightest channel).
 */
export function ditheredRadial({
  shape,
  rgb,
  alphaAt,
  levels,
  frame,
  key,
  samples = 13,
}: {
  shape: string;
  rgb: string;
  alphaAt: (p: number) => number;
  levels: number;
  frame: number;
  key: string;
  samples?: number;
}): React.CSSProperties {
  const ps = Array.from({ length: samples }, (_, i) => i / (samples - 1));
  const glow: string[] = [];
  const solid: string[] = [];
  for (const p of ps) {
    const a = Math.max(0, alphaAt(p));
    const s = a <= 0 ? 1 : Math.min(1, 2.4 / (a * levels));
    glow.push(`rgba(${rgb},${Math.min(1, a / (1 - s / 2)).toFixed(4)}) ${(p * 100).toFixed(1)}%`);
    solid.push(`rgba(0,0,0,${(1 - s).toFixed(3)}) ${(p * 100).toFixed(1)}%`);
  }
  const seed = 200 + (frame % 12);
  const x = Math.floor(random(`${key}-dx-${frame}`) * 256);
  const y = Math.floor(random(`${key}-dy-${frame}`) * 256);
  const mask = `radial-gradient(${shape}, ${solid.join(', ')}), ${uTile(seed)}`;
  return {
    background: `radial-gradient(${shape}, ${glow.join(', ')})`,
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: '100% 100%, 256px 256px',
    WebkitMaskSize: '100% 100%, 256px 256px',
    maskRepeat: 'no-repeat, repeat',
    WebkitMaskRepeat: 'no-repeat, repeat',
    maskPosition: `0 0, ${x}px ${y}px`,
    WebkitMaskPosition: `0 0, ${x}px ${y}px`,
  };
}

/**
 * The hook's vignette, dithered.
 *
 * On the hook's black the shared vignette (rgba(6,4,10) over a base that the
 * film grain leaves at ≈ (7,5,11)) changes the picture by ONE level over half
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
 * ≈ 300 px stochastic ramp. On lit content under the vignette (motes near the
 * edge) the same ±13 % of its alpha is a few levels of grain, under the film
 * grain that is already there; at the centre the vignette is 0 and so is this.
 */
import React from 'react';
import { AbsoluteFill, random } from 'remotion';

/** Mask alpha = SLOPE·n + OFFSET for noise n (mean 0.5, σ ≈ 0.118): mean 0.8, σ ≈ 0.10, ≈ 0.57–1. */
const SLOPE = 0.87;
const OFFSET = 0.365;
const MEAN = SLOPE * 0.5 + OFFSET; // 0.8

const tile = (seed: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='d' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${SLOPE} 0 0 0 ${OFFSET}'/></filter><rect width='256' height='256' filter='url(#d)'/></svg>`,
  )}")`;

/** Same stops as components/Grain <Vignette> (strength 1), alpha divided by the mask's mean. */
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

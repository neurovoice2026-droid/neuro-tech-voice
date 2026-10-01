/**
 * Directional (shutter) motion blur for DOM layers: an SVG Gaussian with
 * separate x / y deviations, referenced from CSS as `filter: url(#id)`.
 * A move of `dx` px in one frame is a box of width dx; the Gaussian of the
 * same variance has sigma = dx / √12. Edges along the motion stay sharp,
 * edges across it smear — what a shutter does. (Never on a WebGL canvas.)
 */
import React from 'react';

/** sigma for a smear of `px` pixels (box → Gaussian of equal variance) */
export const sigmaFor = (px: number) => Math.abs(px) / 3.46;

/** (the filter region grows only along the smear: a full-frame layer filtered over 2.2 × 2.2 its
 *  area is ~5× the pixels of one grown along one axis) */
export const DirBlur: React.FC<{ id: string; sx: number; sy: number }> = ({ id, sx, sy }) => (
  <svg width={0} height={0} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
    <defs>
      <filter
        id={id}
        x={sx > 0.35 ? '-60%' : '-4%'}
        y={sy > 0.35 ? '-60%' : '-4%'}
        width={sx > 0.35 ? '220%' : '108%'}
        height={sy > 0.35 ? '220%' : '108%'}
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur stdDeviation={`${Math.max(0, sx).toFixed(2)} ${Math.max(0, sy).toFixed(2)}`} />
      </filter>
    </defs>
  </svg>
);

/** the CSS filter value for a DirBlur, or undefined when it would be invisible */
export const dirBlurRef = (id: string, sx: number, sy: number) => (sx > 0.35 || sy > 0.35 ? `url(#${id})` : undefined);

/** a short, fast accent pulse: 1 on frame `at`, decaying e^(−u/τ) (0 before) */
export const flashAt = (t: number, at: number, tau = 4) => (t < at ? 0 : Math.exp(-(t - at) / tau));

/** 0 → 1 → 0 over [a, b] (sine): a ring's life, a glint's pass */
export const lifeAt = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)));

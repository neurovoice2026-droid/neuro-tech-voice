/**
 * Directional (anisotropic) motion blur for small DOM subtrees: an SVG
 * Gaussian with separate x / y deviations, referenced from CSS as
 * `filter: url(#id)`. A 1-frame move of `dx` px is a box of width dx; the
 * matching Gaussian has sigma = dx / √12. Unlike CSS blur(), edges parallel
 * to the motion stay sharp and edges across it smear, which is what a
 * shutter does.
 */
import React from 'react';

/** sigma for a smear of `px` pixels (box → Gaussian of equal variance). */
export const sigmaFor = (px: number) => Math.abs(px) / 3.46;

export const DirBlur: React.FC<{ id: string; sx: number; sy: number }> = ({ id, sx, sy }) => (
  <svg width={0} height={0} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
    <defs>
      <filter id={id} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={`${Math.max(0, sx).toFixed(2)} ${Math.max(0, sy).toFixed(2)}`} />
      </filter>
    </defs>
  </svg>
);

/** The CSS filter value for a DirBlur, or undefined when it would be invisible. */
export const dirBlurRef = (id: string, sx: number, sy: number) => (sx > 0.35 || sy > 0.35 ? `url(#${id})` : undefined);

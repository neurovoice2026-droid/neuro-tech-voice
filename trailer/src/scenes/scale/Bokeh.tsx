/**
 * The near plane (depth 1.6): 3–4 out-of-focus discs in the LEADING light
 * (one light at a time, crossing with the room's bloom), 160–300 px, a
 * 10 % core with a soft ~30 px edge — drawn as radial gradients (a flat core
 * and a smooth falloff, the look of a defocused disc) instead of a CSS blur,
 * so they cost nothing at any zoom. Placed in the plane's own world so that
 * they sweep through the frame on the camera's pull-backs (strong parallax)
 * and rest near the frame edges once the wall is whole; none sits in front
 * of card 01 at the opener.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';
import type { Layout } from '../../lib/layout';
import { hexToRgb } from '../../lib/lights';

type Disc = { x: number; y: number; d: number; a: number };

const DISCS = (L: Layout): Disc[] =>
  L.pick(
    [
      { x: 1790, y: 150, d: 300, a: 0.1 },
      { x: 130, y: 980, d: 240, a: 0.09 },
      { x: 1210, y: 640, d: 200, a: 0.07 },
      { x: 820, y: -40, d: 260, a: 0.1 },
    ],
    [
      { x: 1010, y: 300, d: 280, a: 0.1 },
      { x: 60, y: 1560, d: 300, a: 0.1 },
      { x: 700, y: 1150, d: 190, a: 0.07 },
      { x: 520, y: 150, d: 220, a: 0.09 },
    ],
  );

export const NearDiscs: React.FC<{ t: number; L: Layout; fade: number; color: string }> = ({ t, L, fade, color }) => {
  const [r0, g0, b0] = hexToRgb(color).map((c) => Math.round(c * 255));
  return (
  <>
    {DISCS(L).map((c, i) => {
      const dx = 26 * noise2D(`scale-disc-x-${i}`, t * 0.012, 0.5);
      const dy = 20 * noise2D(`scale-disc-y-${i}`, 0.5, t * 0.012) - t * 0.25;
      const r = c.d / 2;
      // the defocus edge: ~30 px either side of the rim
      const e = 30 / r;
      const col = (k: number) => `rgba(${r0},${g0},${b0},${(c.a * k * fade).toFixed(4)})`;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: c.x + dx - r - 30,
            top: c.y + dy - r - 30,
            width: c.d + 60,
            height: c.d + 60,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${col(0.85)} 0%, ${col(1)} ${((1 - e) * r / (r + 30) * 100).toFixed(1)}%, ${col(0.45)} ${(r / (r + 30) * 100).toFixed(1)}%, ${col(0)} 100%)`,
          }}
        />
      );
    })}
  </>
);
};

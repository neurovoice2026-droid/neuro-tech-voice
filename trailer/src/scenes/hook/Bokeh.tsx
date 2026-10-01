/**
 * Out-of-focus light in front of the lens — the nearest parallax plane.
 * Soft discs drawn as gradients (no filters), placed by random(seed),
 * drifting on world time so they freeze with everything else.
 */
import React from 'react';
import { random } from 'remotion';
import { C } from '../../theme';
import { rgbOf } from './color';

export const Bokeh: React.FC<{
  t: number;
  /** real time (frames): the discs' light keeps glimmering after the world has frozen */
  frame: number;
  width: number;
  count: number;
  seed: string;
  opacity: number;
  /** vertical band the discs live in, as [top, bottom] px (the lit part of the frame) */
  band: [number, number];
}> = ({ t, frame, width, count, seed, opacity, band }) => (
  <>
    {Array.from({ length: count }, (_, i) => {
      const r = (k: string) => random(`${seed}-${i}-${k}`);
      const d = 90 + r('d') * 200;
      const y = band[0] + r('y') * (band[1] - band[0]);
      // out to the sides of the frame, never over the centre column
      const side = r('side') < 0.5 ? -1 : 1;
      const x = width / 2 + side * (0.24 + r('x') * 0.24) * width + Math.sin(t / (70 + r('p') * 50) + r('ph') * 6.28) * 18;
      const yy = y - t * (0.15 + r('s') * 0.2);
      const lilac = r('c') < 0.6;
      const col = rgbOf(lilac ? C.lilac : C.callerLit);
      const a = opacity * (0.5 + 0.5 * r('a')) * (0.7 + 0.3 * Math.sin(frame / (17 + r('tp') * 9) + r('tw') * 6.28));
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x - d / 2,
            top: yy - d / 2,
            width: d,
            height: d,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgba(${col},${a.toFixed(3)}) 0%, rgba(${col},${(a * 0.85).toFixed(3)}) 40%, rgba(${col},${(a * 0.3).toFixed(3)}) 75%, rgba(${col},0) 100%)`,
          }}
        />
      );
    })}
  </>
);

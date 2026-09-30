/**
 * Out-of-focus light in front of the lens — the nearest parallax plane.
 * Soft discs drawn as gradients (no filters), placed by random(seed),
 * drifting on world time so they freeze with everything else.
 */
import React from 'react';
import { random } from 'remotion';

export const Bokeh: React.FC<{
  t: number;
  width: number;
  height: number;
  count: number;
  seed: string;
  opacity: number;
  /** keep discs out of this horizontal band (the type), as [top, bottom] */
  avoid?: [number, number];
}> = ({ t, width, height, count, seed, opacity, avoid }) => (
  <>
    {Array.from({ length: count }, (_, i) => {
      const r = (k: string) => random(`${seed}-${i}-${k}`);
      const d = 90 + r('d') * 200;
      let y = r('y') * height;
      if (avoid && y > avoid[0] - d / 2 && y < avoid[1] + d / 2) {
        y = r('side') < 0.5 ? avoid[0] - d * 0.7 - r('o') * 120 : avoid[1] + d * 0.7 + r('o') * 160;
      }
      const x = (0.08 + r('x') * 0.84) * width + Math.sin(t / (70 + r('p') * 50) + r('ph') * 6.28) * 18;
      const yy = y - t * (0.15 + r('s') * 0.2);
      const lilac = r('c') < 0.6;
      const col = lilac ? '185,163,255' : '169,188,255';
      const a = opacity * (0.5 + 0.5 * r('a')) * (0.75 + 0.25 * Math.sin(t / 23 + r('tw') * 6.28));
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

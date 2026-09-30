/**
 * Foreground motes (the nearest parallax plane) that survive the camera's
 * big moves: each mote is panned at `depth` and wrapped around the frame
 * first, then zoomed about the frame centre — so a push-in blows them past
 * the lens (bigger, softer) instead of sliding the whole field off-frame.
 * Deterministic: positions, sizes and drift come from random(seed).
 */
import React from 'react';
import { random } from 'remotion';
import type { Cam } from './geometry';

const wrap = (v: number, lo: number, span: number) => ((((v - lo) % span) + span) % span) + lo;

export const Motes: React.FC<{
  t: number;
  cam: Cam;
  depth: number;
  width: number;
  height: number;
  count?: number;
  seed?: string;
  color?: string;
  opacity?: number;
}> = ({ t, cam, depth, width, height, count = 18, seed = 'result-motes', color = '185,163,255', opacity = 0.4 }) => {
  const z = 1 + (cam.z - 1) * depth;
  const cx = width / 2;
  const cy = height / 2;
  const m = 40;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const d = 2 + r('s') * 4.5;
        const near = r('d');
        const drift = 0.3 * (0.4 + near);
        const x0 = r('x') * width + Math.sin(t / (40 + r('p') * 60) + r('ph') * 6.28) * (6 + near * 14);
        const y0 = r('y') * height - t * drift;
        const px = wrap(x0 - cam.x * depth, -m, width + 2 * m);
        const py = wrap(y0 - cam.y * depth, -m, height + 2 * m);
        const sx = cx + (px - cx) * z;
        const sy = cy + (py - cy) * z;
        const size = d * Math.sqrt(z);
        if (sx < -120 || sx > width + 120 || sy < -120 || sy > height + 120) return null;
        const tw = 0.55 + 0.45 * Math.sin(t / (18 + r('t') * 30) + r('tp') * 6.28);
        const blur = 0.4 + near * 2.6 + (z - 1) * 2.2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: sx - size / 2,
              top: sy - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: `rgba(${color},1)`,
              opacity: opacity * tw * (0.35 + near * 0.65) / Math.sqrt(z),
              filter: `blur(${blur.toFixed(2)}px)`,
            }}
          />
        );
      })}
    </>
  );
};

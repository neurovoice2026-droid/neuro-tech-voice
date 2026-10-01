/**
 * Atmosphere planes, all tied to the camera:
 *   · Motes — tiny points that survive the camera's big moves: each mote is
 *     panned at `depth` and wrapped round the frame first, then zoomed about
 *     the frame centre (a push-in blows them past the lens, bigger and softer).
 *     `vy` < 0 rises (the Booked half's warm motes), > 0 sinks (cool dust).
 *     `keep(x, y)` fades a mote by where it is on screen (the halves).
 *   · Discs — out-of-focus light discs at a depth (0.5× far and dim, 1.6×
 *     near and soft): radial gradients, no filters.
 * Deterministic: positions, sizes and drift come from random(seed).
 */
import React from 'react';
import { random } from 'remotion';
import { planeToScreen, type Cam } from './geometry';

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
  /** px per frame (− rises) */
  vy?: number;
  keep?: (x: number, y: number) => number;
}> = ({
  t,
  cam,
  depth,
  width,
  height,
  count = 18,
  seed = 'result-motes',
  color = '185,163,255',
  opacity = 0.4,
  vy = -0.3,
  keep,
}) => {
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
        const drift = vy * (0.4 + near);
        const x0 = r('x') * width + Math.sin(t / (40 + r('p') * 60) + r('ph') * 6.28) * (6 + near * 14);
        const y0 = r('y') * height + t * drift;
        const px = wrap(x0 - cam.x * depth, -m, width + 2 * m);
        const py = wrap(y0 - cam.y * depth, -m, height + 2 * m);
        const sx = cx + (px - cx) * z;
        const sy = cy + (py - cy) * z;
        const size = d * Math.sqrt(z);
        if (sx < -120 || sx > width + 120 || sy < -120 || sy > height + 120) return null;
        const k = keep ? keep(sx, sy) : 1;
        if (k <= 0.01) return null;
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
              opacity: (k * opacity * tw * (0.35 + near * 0.65)) / Math.sqrt(z),
              filter: `blur(${blur.toFixed(2)}px)`,
            }}
          />
        );
      })}
    </>
  );
};

export type Disc = { side: number; x: number; y: number; d: number; a: number };

/** Out-of-focus discs at `depth`, drawn through the camera of their half. */
export const Discs: React.FC<{
  discs: readonly Disc[];
  /** camera per side (0 night, 1 booked) */
  cams: readonly [Cam, Cam];
  L: { cx: number; cy: number };
  depth: number;
  /** rgb per side, e.g. ['185,163,255', '238,84,35'] */
  colors: readonly [string, string];
  opacity: number;
  /** a slow drift of their own (px), per disc */
  t: number;
  /** soft edge: 0 = crisp bokeh rim, 1 = a gaussian pool */
  soft?: number;
}> = ({ discs, cams, L, depth, colors, opacity, t, soft = 0.6 }) => {
  if (opacity <= 0.005) return null;
  return (
    <>
      {discs.map((c, i) => {
        const cam = cams[c.side];
        const wob = { x: 8 * Math.sin(t / 47 + i * 1.7), y: 6 * Math.cos(t / 59 + i * 2.3) };
        const p = planeToScreen(cam, L, { x: c.x + wob.x, y: c.y + wob.y }, depth);
        const z = 1 + (cam.z - 1) * depth;
        const d = c.d * z;
        const col = colors[c.side];
        const a = c.a * opacity;
        const rim = 1 - soft;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x - d / 2,
              top: p.y - d / 2,
              width: d,
              height: d,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, rgba(${col},${(a * (0.75 + 0.1 * rim)).toFixed(3)}) 0%, rgba(${col},${(a * (0.85 + 0.3 * rim)).toFixed(3)}) ${(62 + 20 * rim).toFixed(0)}%, rgba(${col},${(a * 0.4 * rim).toFixed(3)}) ${(86 + 8 * rim).toFixed(0)}%, rgba(${col},0) 100%)`,
            }}
          />
        );
      })}
    </>
  );
};

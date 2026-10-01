/**
 * A handful of big, soft, near-lens motes, hand-placed in the empty parts of
 * each frame (the lower corners of 16:9, the top and bottom quarters of
 * 9:16). They drift on WORLD time, so at the freeze they hang while the
 * camera keeps pushing through them: the parallax sells the stopped clock.
 * Soft discs are gradients (no filters).
 */
import React from 'react';
import { random } from 'remotion';
import { C } from '../../theme';
import { rgbOf } from './color';

export type Mote = {
  /** position in frame px (layer space, before the camera) */
  x: number;
  y: number;
  /** core diameter, px */
  d: number;
  /** peak alpha */
  a: number;
  /** which camera plane it sits in */
  plane: 'near' | 'lens';
};

/** Hand placement per orientation, in the frame's empty zones. */
export const MOTES: { landscape: Mote[]; vertical: Mote[] } = {
  landscape: [
    { x: 262, y: 900, d: 20, a: 0.4, plane: 'lens' },
    { x: 452, y: 1004, d: 8, a: 0.55, plane: 'near' },
    { x: 1640, y: 950, d: 24, a: 0.36, plane: 'lens' },
    { x: 1812, y: 806, d: 7, a: 0.55, plane: 'near' },
    { x: 318, y: 176, d: 9, a: 0.5, plane: 'near' },
    { x: 1560, y: 150, d: 16, a: 0.4, plane: 'lens' },
  ],
  vertical: [
    { x: 190, y: 330, d: 22, a: 0.4, plane: 'lens' },
    { x: 874, y: 196, d: 9, a: 0.55, plane: 'near' },
    { x: 968, y: 468, d: 7, a: 0.5, plane: 'near' },
    { x: 150, y: 1622, d: 10, a: 0.55, plane: 'near' },
    { x: 830, y: 1730, d: 24, a: 0.38, plane: 'lens' },
    { x: 560, y: 1534, d: 7, a: 0.5, plane: 'near' },
  ],
};

export const Motes: React.FC<{
  motes: Mote[];
  plane: Mote['plane'];
  /** world time (frames) — stops at the freeze */
  t: number;
  /** real time (frames): their light keeps twinkling after the world has frozen */
  frame: number;
  opacity: number;
}> = ({ motes, plane, t, frame, opacity }) => (
  <>
    {motes.map((m, i) => {
      if (m.plane !== plane) return null;
      const r = (k: string) => random(`hook-mote-${i}-${k}`);
      // slow rise + a lazy sway, all on world time
      const x = m.x + Math.sin(t / (46 + r('p') * 30) + r('ph') * 6.28) * (5 + r('sx') * 7);
      const y = m.y - t * (0.12 + r('s') * 0.14);
      const tw = 0.76 + 0.24 * Math.sin(frame / (13 + r('t') * 9) + r('tp') * 6.28);
      const col = rgbOf(r('c') < 0.55 ? C.paper : C.lilac);
      const a = m.a * tw * opacity;
      if (a < 0.004) return null;
      // the core plus a soft defocus skirt ≈ 2.6× the core
      const D = m.d * 2.6;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x - D / 2,
            top: y - D / 2,
            width: D,
            height: D,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgba(${col},${a.toFixed(3)}) 0%, rgba(${col},${(a * 0.92).toFixed(3)}) 24%, rgba(${col},${(a * 0.4).toFixed(3)}) 46%, rgba(${col},${(a * 0.1).toFixed(3)}) 72%, rgba(${col},0) 100%)`,
          }}
        />
      );
    })}
  </>
);

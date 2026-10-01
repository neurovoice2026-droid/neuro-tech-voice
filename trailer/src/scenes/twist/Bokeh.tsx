/**
 * Two bokeh planes over the phone's screen, as the camera dives into it:
 *   far  — 3 large, dim lilac discs, at 0.5× the dive's zoom (they lag: far away)
 *   near — 3 smaller out-of-focus discs, at 1.5× (they rush past: near the lens)
 * Both zoom about the avatar. At rest (dive done) they are exactly the call's
 * own discs (same place, size, seed and drift phase), which the call fades in
 * after the pickup — the room keeps its light across the cut.
 * Drawn with the call's <Bokeh> (defocus by gradient, no blur filter), clipped
 * to the screen while the screen is still smaller than the frame.
 */
import React from 'react';
import type { Layout } from '../../lib/layout';
import { Bokeh, type Disc } from '../call/Bokeh';

export const bokehPlanes = (L: Layout): { far: Disc[]; near: Disc[] } =>
  L.pick(
    {
      far: [
        { x: 300, y: 830, r: 440, a: 0.06, soft: 60, seed: 'f1' },
        { x: 1690, y: 230, r: 380, a: 0.06, soft: 60, seed: 'f2' },
        { x: 1480, y: 1040, r: 340, a: 0.05, soft: 60, seed: 'f3' },
      ],
      near: [
        { x: 110, y: 190, r: 110, a: 0.09, soft: 34, seed: 'n1' },
        { x: 1840, y: 610, r: 150, a: 0.08, soft: 46, seed: 'n2' },
        { x: 220, y: 1020, r: 130, a: 0.08, soft: 40, seed: 'n4' },
      ],
    },
    {
      far: [
        { x: 110, y: 1480, r: 440, a: 0.06, soft: 60, seed: 'f1' },
        { x: 990, y: 360, r: 380, a: 0.06, soft: 60, seed: 'f2' },
        { x: 900, y: 1880, r: 340, a: 0.05, soft: 60, seed: 'f3' },
      ],
      near: [
        { x: 30, y: 250, r: 120, a: 0.09, soft: 34, seed: 'n1' },
        { x: 1070, y: 900, r: 150, a: 0.08, soft: 46, seed: 'n2' },
        { x: 50, y: 1710, r: 140, a: 0.08, soft: 40, seed: 'n3' },
      ],
    },
  );

type Pt = { x: number; y: number };

/** One plane: its rest layout zoomed by Z^k about the avatar (c now, O at rest). */
export const BokehPlane: React.FC<{
  t: number;
  discs: Disc[];
  /** the dive's zoom relative to its end (0…1) */
  Z: number;
  /** parallax factor (0.5 far, 1.5 near) */
  k: number;
  c: Pt;
  O: Pt;
  opacity: number;
  drift?: number;
}> = ({ t, discs, Z, k, c, O, opacity, drift = 1 }) => {
  if (opacity < 0.005) return null;
  const s = Math.pow(Math.max(0.001, Z), k);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        transformOrigin: `${O.x}px ${O.y}px`,
        transform: `translate(${(c.x - O.x).toFixed(2)}px, ${(c.y - O.y).toFixed(2)}px) scale(${s.toFixed(5)})`,
      }}
    >
      <Bokeh t={t} discs={discs} drift={drift} />
    </div>
  );
};

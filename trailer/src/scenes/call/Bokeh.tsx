/**
 * Nearest plane: a few large, out-of-focus discs of lilac light drifting
 * past the lens at the frame edges (never over the type). Pure gradients —
 * no blur filters — so they cost nothing.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';

export type Disc = { x: number; y: number; r: number; a: number; seed: string };

export const Bokeh: React.FC<{ t: number; discs: Disc[]; opacity: number }> = ({ t, discs, opacity }) => (
  <>
    {discs.map((d) => {
      const dx = 26 * noise2D(`${d.seed}-x`, t * 0.006, 0.4);
      // a slow float — noise plus a long, eased sway (no linear term)
      const dy = 18 * noise2D(`${d.seed}-y`, 0.9, t * 0.006) + 14 * Math.sin((t / 160) * Math.PI * 2 + d.r * 0.01);
      const tw = 0.8 + 0.2 * Math.sin(t / 37 + d.r);
      return (
        <div
          key={d.seed}
          style={{
            position: 'absolute',
            left: d.x + dx - d.r,
            top: d.y + dy - d.r,
            width: d.r * 2,
            height: d.r * 2,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgba(196,168,255,${d.a.toFixed(3)}) 0%, rgba(185,163,255,${(d.a * 0.85).toFixed(3)}) 55%, rgba(185,163,255,${(d.a * 0.35).toFixed(3)}) 82%, rgba(185,163,255,0) 100%)`,
            opacity: opacity * tw,
          }}
        />
      );
    })}
  </>
);

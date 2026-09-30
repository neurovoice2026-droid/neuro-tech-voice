/**
 * Out-of-focus discs of lilac light, for two parallax planes:
 *   0.5 — a few LARGE, dim discs far behind the orb (r 320–480, ~5 %, soft 60)
 *   1.6 — out-of-focus #b9a3ff discs passing the lens at the frame edges
 *         (r 70–160, 8–12 %, soft 24–40), never over the type.
 * The defocus is drawn with the gradient itself (a plateau with a soft edge
 * of ±soft px) — no blur filters, so they cost nothing.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';

export type Disc = { x: number; y: number; r: number; a: number; soft: number; seed: string };

export const Bokeh: React.FC<{ t: number; discs: readonly Disc[]; color?: string; drift?: number }> = ({
  t,
  discs,
  color = '185,163,255',
  drift = 1,
}) => (
  <>
    {discs.map((d) => {
      const dx = drift * 26 * noise2D(`${d.seed}-x`, t * 0.006, 0.4);
      // a slow float — noise plus a long, eased sway (no linear term)
      const dy = drift * (18 * noise2D(`${d.seed}-y`, 0.9, t * 0.006) + 12 * Math.sin((t / 170) * Math.PI * 2 + d.r * 0.01));
      const tw = 0.85 + 0.15 * Math.sin(t / 41 + d.r);
      const R = d.r + d.soft;
      const inner = Math.max(0, ((d.r - d.soft) / R) * 100);
      return (
        <div
          key={d.seed}
          style={{
            position: 'absolute',
            left: d.x + dx - R,
            top: d.y + dy - R,
            width: R * 2,
            height: R * 2,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgba(${color},${(d.a * 1.06).toFixed(3)}) 0%, rgba(${color},${d.a.toFixed(3)}) ${inner.toFixed(1)}%, rgba(${color},${(d.a * 0.5).toFixed(3)}) ${((inner + 100) / 2).toFixed(1)}%, rgba(${color},0) 100%)`,
            opacity: tw,
          }}
        />
      );
    })}
  </>
);

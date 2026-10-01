/**
 * Out-of-focus discs of light, for two parallax planes:
 *   0.5 — a few LARGE, dim discs far behind the orb (r 340–440)
 *   1.6 — out-of-focus discs passing the lens at the frame edges (r 110–150),
 *         never over the type.
 * The defocus is drawn with the gradient itself (a plateau with a soft edge
 * of ±soft px) — no blur filters, so they cost nothing.
 *
 * With `rim` (the call), a disc reads as a real out-of-focus highlight, not a
 * smudge on the lens: a saturated body of the light (`color`) and a thin,
 * brighter rim (`rim`, ≈ 2 px, the lens's onion ring) with a tight falloff —
 * drawn by the caller in a screen-blended plane, so it only ADDS light.
 * Without it (the twist's screen), the plain plateau.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';

export type Disc = { x: number; y: number; r: number; a: number; soft: number; seed: string };

export const Bokeh: React.FC<{
  t: number;
  discs: readonly Disc[];
  color?: string;
  drift?: number;
  /** 'r,g,b' — a brighter rim at the disc's edge (its alpha ≈ 1.6× the body's, 2 px) */
  rim?: string;
}> = ({ t, discs, color = '185,163,255', drift = 1, rim }) => (
  <>
    {discs.map((d) => {
      const dx = drift * 26 * noise2D(`${d.seed}-x`, t * 0.006, 0.4);
      // a slow float — noise plus a long, eased sway (no linear term)
      const dy = drift * (18 * noise2D(`${d.seed}-y`, 0.9, t * 0.006) + 12 * Math.sin((t / 170) * Math.PI * 2 + d.r * 0.01));
      const tw = 0.85 + 0.15 * Math.sin(t / 41 + d.r);
      if (rim) {
        // body: a near-flat plateau, a touch denser toward the edge; rim: ≈ 2 px at R − 3, a 2 px falloff
        const R = d.r + 2;
        const at = (px: number) => `${(100 * (1 - px / R)).toFixed(2)}%`;
        const a = (k: number) => (d.a * k).toFixed(4);
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
              background: `radial-gradient(closest-side, rgba(${color},${a(0.62)}) 0%, rgba(${color},${a(0.78)}) 70%, rgba(${color},${a(0.95)}) ${at(7)}, rgba(${rim},${a(1.6)}) ${at(3.5)}, rgba(${rim},${a(1.6)}) ${at(2.5)}, rgba(${rim},0) 100%)`,
              opacity: tw,
            }}
          />
        );
      }
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

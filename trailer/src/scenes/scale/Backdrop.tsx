/**
 * The far plane of the white act: white stock with slow wash blooms
 * (#f6f3ff / #efe9ff / a breath of lilac) drifting on noise. Pure gradients —
 * no filters — so the full-frame layer costs nothing.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { C } from '../../theme';
import { EASE, tween } from '../../lib/motion';
import type { Layout } from '../../lib/layout';

type Bloom = { x: number; y: number; r: number; rgb: string; a: number; seed: string };

export const Backdrop: React.FC<{ t: number; L: Layout }> = ({ t, L }) => {
  const W = L.width;
  const H = L.height;
  const blooms: Bloom[] = L.pick(
    [
      { x: W * 0.12, y: H * 0.06, r: 820, rgb: '239,233,255', a: 0.7, seed: 'a' },
      { x: W * 0.9, y: H * 0.9, r: 900, rgb: '239,233,255', a: 0.6, seed: 'b' },
      { x: W * 0.66, y: H * 0.3, r: 640, rgb: '185,163,255', a: 0.07, seed: 'c' },
      { x: W * 0.28, y: H * 0.98, r: 600, rgb: '246,243,255', a: 1, seed: 'd' },
    ],
    [
      { x: W * 0.06, y: H * 0.06, r: 760, rgb: '239,233,255', a: 0.7, seed: 'a' },
      { x: W * 0.98, y: H * 0.74, r: 820, rgb: '239,233,255', a: 0.6, seed: 'b' },
      { x: W * 0.72, y: H * 0.28, r: 560, rgb: '185,163,255', a: 0.07, seed: 'c' },
      { x: W * 0.2, y: H * 0.96, r: 640, rgb: '246,243,255', a: 1, seed: 'd' },
    ],
  );
  // the blooms open on the downbeat (the white act "breathes in")
  const open = tween(t, [0, 24], [0.82, 1], EASE.house);
  // …from nothing: the white itself is continuous across the cut, the
  // accent on t 0 is the tray and card 01, not a hue jump
  const fadeIn = tween(t, [0, 8], [0, 1], EASE.out3);
  return (
    <AbsoluteFill style={{ background: C.white }}>
      {blooms.map((b) => {
        const dx = 70 * noise2D(`scale-bloom-x-${b.seed}`, t * 0.008, 0.3);
        const dy = 50 * noise2D(`scale-bloom-y-${b.seed}`, 0.7, t * 0.008);
        const r = b.r * open;
        return (
          <div
            key={b.seed}
            style={{
              position: 'absolute',
              left: b.x + dx - r,
              top: b.y + dy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, rgba(${b.rgb},${b.a}) 0%, rgba(${b.rgb},${(b.a * 0.55).toFixed(3)}) 45%, rgba(${b.rgb},0) 100%)`,
              opacity: fadeIn,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * The far plane of the white act (depth 0.4): the lilac wash — white stock
 * with slow light blooms drifting on noise — re-lit per phase:
 *
 *   wall       the four lights, one per quadrant behind their cards (rush
 *              top-left round card 01: the rush leads the opener); they
 *              swell on every quarter note with the wall's pulse
 *   languages  the lilac wash alone
 *   flow       the closing light (emerald = confirmed) round the rail
 *
 * No card shapes: ghost cards would read as empty cells. Pure gradients —
 * no filters — so the full-frame layer costs nothing.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { C, LIGHTS, type LightId } from '../../theme';
import { EASE, tween } from '../../lib/motion';
import type { Layout } from '../../lib/layout';
import { SCALE_LOCAL } from '../../timing';
import { rgba } from './lights';

const K = SCALE_LOCAL;

type Bloom = { x: number; y: number; r: number; col: string; a: number; seed: string };

const pool = (col: string, a: number) =>
  `radial-gradient(closest-side, ${rgba(col, a)} 0%, ${rgba(col, a * 0.55)} 45%, ${rgba(col, a * 0.16)} 75%, ${rgba(col, 0)} 100%)`;

export const Backdrop: React.FC<{ t: number; L: Layout }> = ({ t, L }) => {
  const W = L.width;
  const H = L.height;
  const lilac: Bloom[] = L.pick(
    [
      { x: W * 0.12, y: H * 0.06, r: 820, col: '#efe9ff', a: 0.7, seed: 'a' },
      { x: W * 0.9, y: H * 0.9, r: 900, col: '#efe9ff', a: 0.6, seed: 'b' },
      { x: W * 0.66, y: H * 0.3, r: 640, col: '#b9a3ff', a: 0.07, seed: 'c' },
    ],
    [
      { x: W * 0.06, y: H * 0.06, r: 760, col: '#efe9ff', a: 0.7, seed: 'a' },
      { x: W * 0.98, y: H * 0.74, r: 820, col: '#efe9ff', a: 0.6, seed: 'b' },
      { x: W * 0.72, y: H * 0.28, r: 560, col: '#b9a3ff', a: 0.07, seed: 'c' },
    ],
  );
  const quad = (id: LightId, x: number, y: number, r: number, seed: string): Bloom => ({ x, y, r, col: LIGHTS[id].orb[3], a: 0.5, seed });
  const four: Bloom[] = L.pick(
    [
      quad('rush', W * 0.16, H * 0.14, 760, 'q0'),
      quad('closing', W * 0.86, H * 0.12, 760, 'q1'),
      quad('sunday', W * 0.14, H * 0.9, 760, 'q2'),
      quad('night', W * 0.86, H * 0.9, 760, 'q3'),
    ],
    [
      quad('rush', W * 0.18, 130, 620, 'q0'),
      quad('closing', W * 0.84, 150, 620, 'q1'),
      quad('sunday', W * 0.16, 1640, 640, 'q2'),
      quad('night', W * 0.84, 1620, 640, 'q3'),
    ],
  );
  const closing: Bloom[] = L.pick(
    [
      { x: W * 0.28, y: H * 0.78, r: 760, col: LIGHTS.closing.orb[3], a: 0.34, seed: 'f0' },
      { x: W * 0.82, y: H * 0.42, r: 700, col: LIGHTS.closing.orb[3], a: 0.3, seed: 'f1' },
    ],
    [
      { x: W * 0.1, y: H * 0.5, r: 640, col: LIGHTS.closing.orb[3], a: 0.34, seed: 'f0' },
      { x: W * 0.9, y: H * 0.72, r: 620, col: LIGHTS.closing.orb[3], a: 0.3, seed: 'f1' },
    ],
  );
  // the blooms open on the downbeat (the white act "breathes in")
  const open = tween(t, [0, 24], [0.82, 1], EASE.house);
  // …from nothing: the white itself is continuous across the cut; the
  // accent on t 0 is card 01, not a hue jump
  const fadeIn = tween(t, [0, 8], [0, 1], EASE.out3);
  const wallW = fadeIn * (1 - tween(t, [K.flyOut, K.glide + 16], [0, 1], EASE.inOut));
  // the room breathes on the quarters: the four lights swell with the wall's pulse
  let beat = 0;
  for (const q of K.beats) if (t >= q) beat = Math.max(beat, 1 - tween(t, [q, q + 7], [0, 1], EASE.out3));
  const flowW = tween(t, [K.collapse, K.stations[0] + 6], [0, 1], EASE.inOut);
  const draw = (b: Bloom, w: number, swell = 0) => {
    if (w <= 0.004) return null;
    const dx = 70 * noise2D(`scale-bloom-x-${b.seed}`, t * 0.008, 0.3);
    const dy = 50 * noise2D(`scale-bloom-y-${b.seed}`, 0.7, t * 0.008);
    const r = b.r * open * (1 + 0.1 * swell);
    return (
      <div
        key={b.seed}
        style={{
          position: 'absolute',
          left: b.x + dx - r,
          top: b.y + dy - r,
          width: r * 2,
          height: r * 2,
          background: pool(b.col, Math.min(0.95, b.a * (1 + 0.8 * swell))),
          opacity: w < 0.999 ? w : undefined,
        }}
      />
    );
  };
  return (
    <AbsoluteFill style={{ background: C.white }}>
      {lilac.map((b) => draw(b, fadeIn * (1 - 0.7 * flowW)))}
      {four.map((b) => draw(b, wallW, beat))}
      {closing.map((b) => draw(b, flowW))}
    </AbsoluteFill>
  );
};

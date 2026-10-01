/**
 * The far plane of the white act (depth 0.4): NEUTRAL white stock with at
 * most ONE soft light at a time (never a four-colour wash):
 *
 *   wall       one bloom that sweeps with the fill — it sits behind the
 *              block being filled and turns to the next hour's light on each
 *              quarter note (rush → closing → Sunday → the night), swelling
 *              on the beat; the hero holds the night
 *   languages  the closing light (crossing in with the glide)
 *   flow       the closing light round the rail
 *
 * Plus a whisper of neutral room shading at the edges (depth, not colour).
 * Pure gradients — no filters — so the full-frame layer costs nothing.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { C, LIGHTS } from '../../theme';
import { EASE, tween } from '../../lib/motion';
import type { Layout } from '../../lib/layout';
import { SCALE, SCALE_LOCAL } from '../../timing';
import { LANG_LIGHT, LEAD, leadAt, rgba } from './lights';

const K = SCALE_LOCAL;

const pool = (col: string, a: number) =>
  `radial-gradient(closest-side, ${rgba(col, a)} 0%, ${rgba(col, a * 0.55)} 45%, ${rgba(col, a * 0.16)} 75%, ${rgba(col, 0)} 100%)`;

export const Backdrop: React.FC<{ t: number; L: Layout }> = ({ t, L }) => {
  const W = L.width;
  const H = L.height;
  const HERO = SCALE.industriesTitle;
  // the bloom's centre per LEAD key (fractions of the frame): it follows the block being filled
  // (card 01 → 2 × 2 → 3 × 3 → the bottom row), centres on the hero, then sits under the cells
  const at: readonly (readonly [number, number])[] = L.pick(
    [[0.3, 0.3], [0.5, 0.45], [0.72, 0.5], [0.55, 0.78], [0.5, 0.5], [0.62, 0.6]],
    [[0.32, 0.3], [0.5, 0.4], [0.7, 0.5], [0.5, 0.68], [0.5, 0.5], [0.6, 0.62]],
  );
  const { i, prev, m } = leadAt(t);
  // the hour turns as a crossfade of two pools of light (never a hue sweep through other colours)
  const colPrev = LIGHTS[LEAD[prev].light].orb[3];
  const colCur = LIGHTS[LEAD[i].light].orb[3];
  const bx = (at[prev][0] + (at[i][0] - at[prev][0]) * m) * W;
  const by = (at[prev][1] + (at[i][1] - at[prev][1]) * m) * H;
  // the light swells on the hour (the quarter note) and settles
  let swell = 0;
  for (const q of [...K.beats, HERO]) if (t >= q) swell = Math.max(swell, 1 - tween(t, [q, q + 8], [0, 1], EASE.out3));
  // the white act "breathes in" from the cut: the white is continuous, the light arrives
  const fadeIn = tween(t, [0, 8], [0, 1], EASE.out3);
  const open = tween(t, [0, 24], [0.82, 1], EASE.house);
  // the flow: the light moves under the rail (and a second, quieter pool by the CRM)
  const flowW = tween(t, [K.collapse, K.stations[0] + 6], [0, 1], EASE.inOut);
  const wallR = L.pick(760, 640) * open * (1 + 0.12 * swell);
  const wallA = 0.5 * (1 + 0.6 * swell) * fadeIn * (1 - flowW);
  const flow = L.pick(
    [
      { x: W * 0.3, y: H * 0.8, r: 780, a: 0.34, seed: 'f0' },
      { x: W * 0.82, y: H * 0.5, r: 680, a: 0.28, seed: 'f1' },
    ],
    [
      { x: W * 0.1, y: H * 0.55, r: 660, a: 0.34, seed: 'f0' },
      { x: W * 0.9, y: H * 0.74, r: 600, a: 0.28, seed: 'f1' },
    ],
  );
  const drift = (seed: string) => ({
    dx: 70 * noise2D(`scale-bloom-x-${seed}`, t * 0.008, 0.3),
    dy: 50 * noise2D(`scale-bloom-y-${seed}`, 0.7, t * 0.008),
  });
  const blob = (key: string, x: number, y: number, r: number, c: string, a: number) =>
    a <= 0.004 ? null : (
      <div key={key} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, background: pool(c, Math.min(0.95, a)) }} />
    );
  const d0 = drift('w');
  const fc = LIGHTS[LANG_LIGHT].orb[3];
  return (
    <AbsoluteFill style={{ background: C.white }}>
      {/* neutral room shading: the corners fall off a hair (depth, no hue) */}
      <AbsoluteFill style={{ background: 'radial-gradient(130% 110% at 50% 45%, rgba(24,16,40,0) 55%, rgba(24,16,40,0.035) 100%)' }} />
      {prev !== i && m < 1 ? blob('wall-prev', bx + d0.dx, by + d0.dy, wallR, colPrev, wallA * (1 - m)) : null}
      {blob('wall', bx + d0.dx, by + d0.dy, wallR, colCur, wallA * (prev !== i ? m : 1))}
      {flow.map((b) => {
        const d = drift(b.seed);
        return blob(b.seed, b.x + d.dx, b.y + d.dy, b.r, fc, b.a * flowW);
      })}
    </AbsoluteFill>
  );
};

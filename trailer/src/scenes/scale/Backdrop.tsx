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
import { C, LIGHTS, type LightId } from '../../theme';
import { mixColor } from '../../lib/lights';
import { EASE, tween } from '../../lib/motion';
import type { Layout } from '../../lib/layout';
import { SCALE, SCALE_LOCAL } from '../../timing';
import { HERO_LIGHT, LANG_LIGHT, rgba } from './lights';

const K = SCALE_LOCAL;

const pool = (col: string, a: number) =>
  `radial-gradient(closest-side, ${rgba(col, a)} 0%, ${rgba(col, a * 0.55)} 45%, ${rgba(col, a * 0.16)} 75%, ${rgba(col, 0)} 100%)`;

/** the wall's light keys: [frame, light, bloom centre (fraction of the frame)] */
type Key = { at: number; light: LightId; x: number; y: number };

export const Backdrop: React.FC<{ t: number; L: Layout }> = ({ t, L }) => {
  const W = L.width;
  const H = L.height;
  const HERO = SCALE.industriesTitle;
  // the bloom follows the block being filled (card 01 → 2 × 2 → 3 × 3 → the bottom row), one light per quarter
  const keys: Key[] = L.pick(
    [
      { at: K.kicks[0], light: K.wallLights[0], x: 0.3, y: 0.3 },
      { at: K.kicks[1], light: K.wallLights[1], x: 0.5, y: 0.45 },
      { at: K.kicks[2], light: K.wallLights[2], x: 0.72, y: 0.5 },
      { at: K.kicks[3], light: K.wallLights[3], x: 0.55, y: 0.78 },
      { at: HERO, light: HERO_LIGHT, x: 0.5, y: 0.5 },
      { at: K.glide, light: LANG_LIGHT, x: 0.62, y: 0.6 },
    ],
    [
      { at: K.kicks[0], light: K.wallLights[0], x: 0.32, y: 0.3 },
      { at: K.kicks[1], light: K.wallLights[1], x: 0.5, y: 0.4 },
      { at: K.kicks[2], light: K.wallLights[2], x: 0.7, y: 0.5 },
      { at: K.kicks[3], light: K.wallLights[3], x: 0.5, y: 0.68 },
      { at: HERO, light: HERO_LIGHT, x: 0.5, y: 0.5 },
      { at: K.glide, light: LANG_LIGHT, x: 0.6, y: 0.62 },
    ],
  );
  // the current key and how far the move into it has gone (6 f, EASE.house: the light turns WITH the beat)
  let i = 0;
  for (let j = 0; j < keys.length; j++) if (t >= keys[j].at) i = j;
  const prev = keys[Math.max(0, i - 1)];
  const cur = keys[i];
  const dur = i === keys.length - 1 ? 14 : 6;
  const m = i === 0 ? 1 : tween(t, [cur.at, cur.at + dur], [0, 1], EASE.house);
  const col = mixColor(LIGHTS[prev.light].orb[3], LIGHTS[cur.light].orb[3], m);
  const bx = (prev.x + (cur.x - prev.x) * m) * W;
  const by = (prev.y + (cur.y - prev.y) * m) * H;
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
      {blob('wall', bx + d0.dx, by + d0.dy, wallR, col, wallA)}
      {flow.map((b) => {
        const d = drift(b.seed);
        return blob(b.seed, b.x + d.dx, b.y + d.dy, b.r, fc, b.a * flowW);
      })}
    </AbsoluteFill>
  );
};

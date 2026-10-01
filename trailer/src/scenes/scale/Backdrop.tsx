/**
 * The far planes of the white act:
 *
 *   Ground (screen space, behind the camera)  the ROOM's stage light
 *              (scale/lights.ts ROOM / groundOf: a radial light from the
 *              centre, never a flat slab), arriving out of the knowledge
 *              whip's white and crossfading through white stock between two
 *              lights: the wall's hours, then the hero's night HELD through
 *              the whole language cascade (quieter there — each card brings
 *              its own light), then the closing light for the flow.
 *   Backdrop (depth 0.4)  ONE soft bloom of the leading light: it pools behind
 *              the block being filled (each light's four cards), centres on
 *              the hero, then — smaller and quieter, a spill of the card's own
 *              light — sits behind the active language card and swells a hair
 *              as each one arrives; in the flow the light pools under the rail.
 *              Plus a whisper of neutral room shading at the edges.
 *
 * Pure gradients — no filters — so the full-frame layers cost nothing.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { LIGHTS } from '../../theme';
import { EASE, tween } from '../../lib/motion';
import type { Layout } from '../../lib/layout';
import { SCALE, SCALE_LOCAL } from '../../timing';
import { FLOW_LIGHT, groundOf, LEAD, leadWeights, rgba, ROOM, roomWeights, type Where } from './lights';

const K = SCALE_LOCAL;

const pool = (col: string, a: number) =>
  `radial-gradient(closest-side, ${rgba(col, a)} 0%, ${rgba(col, a * 0.55)} 45%, ${rgba(col, a * 0.16)} 75%, ${rgba(col, 0)} 100%)`;

/** how much of the leading light's ground lights the room at t */
function groundAmount(t: number) {
  const inA = tween(t, [0, 14], [0, 1], EASE.house);
  const langs = tween(t, [K.enFlip, K.enFlip + 14], [0, 1], EASE.inOut);
  const flow = tween(t, [K.collapse, K.stations[0]], [0, 1], EASE.inOut);
  return inA * (0.72 - 0.24 * langs + 0.12 * flow);
}

export const Backdrop: React.FC<{ t: number; L: Layout }> = ({ t, L }) => {
  const W = L.width;
  const H = L.height;
  const HERO = SCALE.industriesTitle;
  // the bloom's centre per lead key (fractions of the frame)
  const P: Record<Where, readonly [number, number]> = L.pick(
    { g0: [0.3, 0.32], g1: [0.55, 0.45], g2: [0.42, 0.66], g3: [0.66, 0.72], hero: [0.5, 0.5], lang: [0.5, 0.46] },
    { g0: [0.3, 0.34], g1: [0.55, 0.42], g2: [0.42, 0.58], g3: [0.64, 0.66], hero: [0.5, 0.46], lang: [0.5, 0.4] },
  );
  const { i, prev, m, wPrev, wCur } = leadWeights(t);
  const colPrev = LIGHTS[LEAD[prev].light].orb[3];
  const colCur = LIGHTS[LEAD[i].light].orb[3];
  const a0 = P[LEAD[prev].where];
  const a1 = P[LEAD[i].where];
  const bx = (a0[0] + (a1[0] - a0[0]) * m) * W;
  const by = (a0[1] + (a1[1] - a0[1]) * m) * H;
  // the light swells as the hour turns, on the hero, and as each language arrives — then settles
  let swell = 0;
  for (const q of [...K.groups, HERO, ...SCALE.langAt]) if (t >= q) swell = Math.max(swell, 1 - tween(t, [q, q + 10], [0, 1], EASE.out3));
  const fadeIn = tween(t, [0, 8], [0, 1], EASE.out3);
  const open = tween(t, [0, 30], [0.8, 1], EASE.house);
  // the flow: the light moves under the rail (and a second, quieter pool by the CRM)
  const flowW = tween(t, [K.collapse, K.stations[0] + 6], [0, 1], EASE.inOut);
  const langW = tween(t, [K.enFlip, K.enFlip + 10], [0, 1], EASE.inOut);
  // under the languages the bloom is only the active card's spill (the room holds one light)
  const wallR = L.pick(760, 660) * open * (1 + 0.1 * swell) * (1 - 0.18 * langW);
  // the hero's hold: the night light behind the title breathes (a bar), so the held frame is alive
  const holdW = tween(t, [HERO + 6, HERO + 16], [0, 1], EASE.inOut) * (1 - tween(t, [K.flyOut - 6, K.flyOut + 4], [0, 1], EASE.inOut));
  const holdBreath = 1 + 0.16 * holdW * Math.sin(((t - HERO - 6) / 30) * Math.PI);
  const wallA = (0.5 - 0.3 * langW) * (1 + (0.5 - 0.25 * langW) * swell) * fadeIn * (1 - flowW) * holdBreath;
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
  const fc = LIGHTS[FLOW_LIGHT].orb[3];
  const turning = prev !== i && m < 1;
  return (
    <AbsoluteFill>
      {/* neutral room shading: the corners fall off a hair (depth, no hue) */}
      <AbsoluteFill style={{ background: 'radial-gradient(130% 110% at 50% 45%, rgba(24,16,40,0) 55%, rgba(24,16,40,0.035) 100%)' }} />
      {turning ? blob('wall-prev', bx + d0.dx, by + d0.dy, wallR, colPrev, wallA * (LEAD[prev].light === LEAD[i].light ? 1 - m : wPrev)) : null}
      {blob('wall', bx + d0.dx, by + d0.dy, wallR, colCur, wallA * (turning ? (LEAD[prev].light === LEAD[i].light ? m : wCur) : 1))}
      {flow.map((b) => {
        const d = drift(b.seed);
        return blob(b.seed, b.x + d.dx, b.y + d.dy, b.r, fc, b.a * flowW);
      })}
    </AbsoluteFill>
  );
};

/**
 * The act's GROUND — the farthest plane, in screen space behind the camera
 * (no zoom or kick can bare an edge): the leading light's stage light.
 */
export const Ground: React.FC<{ t: number }> = ({ t }) => {
  const { i, prev, wPrev, wCur } = roomWeights(t);
  const gPrev = groundOf(ROOM[prev].light);
  const gCur = groundOf(ROOM[i].light);
  const a = groundAmount(t);
  if (a <= 0.004) return null;
  const turning = gPrev !== gCur;
  return (
    <AbsoluteFill style={{ opacity: a }}>
      {/* on a turn the old room drains to white stock before the new light floods in */}
      {turning && wPrev > 0.004 ? <AbsoluteFill style={{ background: gPrev, opacity: wPrev }} /> : null}
      {!turning || wCur > 0.004 ? <AbsoluteFill style={{ background: gCur, opacity: turning ? wCur : 1 }} /> : null}
    </AbsoluteFill>
  );
};

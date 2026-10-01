/**
 * The site's "wave" (as the hook draws it): a thin ring, rgb(185 163 255 /
 * .45), leaving the orb — 0.95 s, power2.out, opacity → 0. One clean hairline
 * each, concentric with the orb (its growth on screen also comes from the
 * dive's zoom). No glow, no sub-frame copies: the 120 fps master carries it.
 * Drawn in screen space around the avatar, whatever size the dive has made it.
 */
import React from 'react';
import { EASE, tween } from '../../lib/motion';

const WAVE = '185,163,255';
const LIFE = 28.5;

type OrbAt = (t: number) => { x: number; y: number; d: number };

const Ring: React.FC<{ x: number; y: number; d: number; op: number; w: number; a: number }> = ({ x, y, d, op, w, a }) =>
  op <= 0.003 ? null : (
    <div
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        borderRadius: '50%',
        boxShadow: `inset 0 0 0 ${w}px rgba(${WAVE},${a})`,
        opacity: Math.min(1, op),
      }}
    />
  );

export const Rings: React.FC<{
  t: number;
  starts: number[];
  /** orb position + diameter at a (sub)frame */
  orbAt: OrbAt;
  /** how far the wave travels (screen px diameter) at a (sub)frame */
  reach: (t: number) => number;
  /** 0..1 global fade (the hand-over frames stay still) */
  fade?: number;
}> = ({ t, starts, orbAt, reach, fade = 1 }) => (
  <>
    {starts.map((start, i) => {
      if (t < start || t > start + LIFE) return null;
      const u = Math.min(1, Math.max(0, (t - start) / LIFE));
      const e = 1 - (1 - u) * (1 - u);
      const o = orbAt(t);
      const d0 = o.d * 1.25;
      const d = d0 + (Math.max(d0, reach(t)) - d0) * e;
      const born = tween(t, [start, start + 1.5], [0, 1], EASE.out3);
      return <Ring key={i} x={o.x} y={o.y} d={d} op={born * (1 - e) * fade} w={1.75} a={0.5} />;
    })}
  </>
);

/**
 * A single tight ring off the avatar over [a, b]: `w` px lilac, `op` → 0,
 * 1× → `to`× the orb's diameter, power3.out. Used for
 *   ring3     (TWIST_LOCAL.ring3)    a faint echo of the resumed ring
 *   avatarPop (TWIST_LOCAL.avatarPop) the orb's pop onto the lit screen
 */
export const Burst: React.FC<{
  t: number;
  span: readonly [number, number];
  orbAt: OrbAt;
  to: number;
  op: number;
  w?: number;
}> = ({ t, span: [a, b], orbAt, to, op: op0, w = 1.5 }) => {
  if (t < a || t > b) return null;
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  const e = EASE.out3(u);
  const o = orbAt(t);
  return <Ring x={o.x} y={o.y} d={o.d * (1 + (to - 1) * e)} op={op0 * (1 - e) * tween(t, [a, a + 1], [0, 1], EASE.out3)} w={w} a={1} />;
};

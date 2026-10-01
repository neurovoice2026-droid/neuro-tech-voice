/**
 * The site's "wave": thin rings (rgb(185 163 255 / .45)) that leave the orb
 * when the phone rings (power2.out, opacity falling). Here they are drawn
 * large, and at the freeze they stop and HANG, catching a little light.
 *
 * Hairlines only: no glow, no smear copies, no shock band — at 120 fps the
 * expansion reads crisply on its own.
 */
import React from 'react';
import { EASE, tween } from '../../lib/motion';
import { C } from '../../theme';
import { rgbOf } from './color';
import { clamp01 } from './warp';

const WAVE = rgbOf(C.lilac); // rgb(185 163 255), the site's wave (= the night light's `wave`)
const LIFE = 28.5; // 0.95 s, as on the site

/** How far (0..1, power2.out) a ring has travelled from d0 to d1 at `age` frames of world time. */
export const ringTravel = (age: number) => {
  const u = clamp01(age / LIFE);
  return 1 - Math.pow(1 - u, 2);
};

export type RingSpec = {
  start: number; // world-time frame it leaves the orb
  hang: number; // opacity it hangs at once time stops
};

export const Rings: React.FC<{
  frame: number; // real frame
  tau: (f: number) => number; // world time of a (sub)frame
  rings: RingSpec[];
  cx: number;
  cy: number;
  d0: number;
  d1: number;
  freeze: number;
  /** frame the hanging rings have faded to 70 % by */
  decayEnd: number;
  /** 0..1 end: inhale + fade. */
  out: number;
  inhale: number;
  /** 0..1 a beat breath in the hold: the hanging rings swell 2 % and catch more light */
  breath?: number;
  /** the drawing surface (the frame) */
  width0: number;
  height0: number;
}> = ({ frame, tau, rings, cx, cy, d0, d1, freeze, decayEnd, out, inhale, breath = 0, width0, height0 }) => {
  const frozen = tween(frame, [freeze, freeze + 6], [0, 1], EASE.house);
  // the moment time stops the rings catch a little light (a soft swell, not a flash)
  const freezeLift = frame >= freeze - 1 ? tween(frame, [freeze - 1, freeze + 1], [0, 1], EASE.inOut) * Math.exp(-Math.max(0, frame - freeze - 1) / 4) : 0;
  const hangDecay = 1 - 0.3 * tween(frame, [freeze, decayEnd], [0, 1], EASE.inOut);

  // one SVG: circle geometry is never pixel-snapped, so a creeping ring moves by sub-pixels
  const drawn = rings.flatMap((r, i) => {
    const t = tau(frame);
    if (t < r.start) return [];
    const e = ringTravel(t - r.start); // power2.out
    const born = tween(t, [r.start, r.start + 1.5], [0, 1], EASE.out3);
    const live = born * (1 - e);
    // the breath: .35 → .55 → .35 of the ring's light (×1.57 at its peak) on the hanging rings
    const lift = 1 + 0.57 * breath * frozen + 0.5 * freezeLift;
    const opacity = (live * (1 - frozen) + r.hang * hangDecay * frozen) * (1 - out);
    if (opacity < 0.004) return [];
    const grow = (1 - 0.07 * inhale) * (1 + 0.02 * breath * frozen);
    const d = (d0 + (d1 - d0) * e) * grow;
    // fresh rings are a touch heavier; they thin as they travel
    const young = Math.max(0, 1 - (t - r.start) / 10) * (1 - frozen);
    const width = 1.6 + 1.0 * young;
    const alpha = Math.min(1, (0.45 + 0.25 * young) * lift) * opacity;
    return [
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={Math.max(0, d / 2 - width / 2)}
        fill="none"
        stroke={`rgb(${WAVE})`}
        strokeOpacity={alpha}
        strokeWidth={width}
      />,
    ];
  });
  if (drawn.length === 0) return null;
  return (
    <svg width={width0} height={height0} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      {drawn}
    </svg>
  );
};

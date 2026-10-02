/**
 * The site's "wave": a thin ring (rgb(185 163 255 / .45)) that leaves the orb
 * when the phone rings (power2.out, opacity falling). ONE ring, and it only
 * exists as the ringing pulse: it leaves the orb on the first ring's attack,
 * opens out and is gone. When time freezes it is caught for a moment and
 * dissolves in the still air — nothing hangs, no ornamental rings stay on
 * screen.
 *
 * A hairline only: no glow, no smear copies, no shock band — at 120 fps the
 * expansion reads crisply on its own.
 */
import React from 'react';
import { EASE, tween } from '../../lib/motion';
import { C } from '../../theme';
import { rgbOf } from './color';
import { clamp01 } from './warp';

const WAVE = rgbOf(C.lilac); // rgb(185 163 255), the site's wave (= the night light's `wave`)
const LIFE = 28.5; // 0.95 s, as on the site

/** How far (0..1, power2.out) the ring has travelled from d0 to d1 at `age` frames of world time. */
export const ringTravel = (age: number) => {
  const u = clamp01(age / LIFE);
  return 1 - Math.pow(1 - u, 2);
};

export const RingPulse: React.FC<{
  frame: number; // real frame
  t: number; // world time of `frame`
  /** world-time frame it leaves the orb */
  start: number;
  cx: number;
  cy: number;
  d0: number;
  d1: number;
  /** real frame time stops: the ring dissolves over `dissolve` frames from here */
  freeze: number;
  dissolve: number;
  /** 0..1 the scene's end */
  out: number;
  /** the drawing surface (the frame) */
  width0: number;
  height0: number;
}> = ({ frame, t, start, cx, cy, d0, d1, freeze, dissolve, out, width0, height0 }) => {
  if (t < start) return null;
  const age = t - start;
  const e = ringTravel(age); // power2.out
  const born = tween(t, [start, start + 1.5], [0, 1], EASE.out3);
  const caught = 1 - tween(frame, [freeze - 1, freeze + dissolve], [0, 1], EASE.inOut);
  const opacity = born * (1 - e) * caught * (1 - out);
  if (opacity < 0.004) return null;
  const d = d0 + (d1 - d0) * e;
  // fresh, the ring is a touch heavier; it thins as it travels
  const young = Math.max(0, 1 - age / 10);
  const width = 1.6 + 1.0 * young;
  const alpha = Math.min(1, 0.45 + 0.25 * young) * opacity;
  // one SVG: circle geometry is never pixel-snapped, so the ring opens by sub-pixels
  return (
    <svg width={width0} height={height0} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      <circle
        cx={cx}
        cy={cy}
        r={Math.max(0, d / 2 - width / 2)}
        fill="none"
        stroke={`rgb(${WAVE})`}
        strokeOpacity={alpha}
        strokeWidth={width}
      />
    </svg>
  );
};

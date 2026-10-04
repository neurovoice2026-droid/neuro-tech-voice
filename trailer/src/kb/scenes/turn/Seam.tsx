/**
 * The SEAM — b07's hairline (SCRIPT.md b07: "a hairline Seam draws top to bottom on EASE.draw over one beat";
 * 9:16 horizontal, left to right). Film 1's Seam (scenes/result/Split.tsx) is a paper line for the night;
 * this one is drawn ON THE GROUND of a light mesh: ink at a low alpha, 1.5 px, its two ends feathered (a
 * gradient along the stroke — no blur), and its drawing head a touch denser while it travels (the pen),
 * settling to the resting line a few frames after it lands.
 *
 * SVG: the line's end moves by fractional px every render frame (a CSS box would grow by whole px).
 * It lies UNDER the cards and the type (they pass over it, never through it).
 */
import React from 'react';
import { useLayout } from '../../../lib/layout';
import { EASE, tween } from '../../../lib/motion';
import { HOME } from '../../palettes';
import type { XY } from './stage';

/** the resting line's ink alpha on the pearl meshes */
export const SEAM_ALPHA = 0.16;

export const Seam: React.FC<{ t: number; start: number; dur: number; a: XY; b: XY }> = ({ t, start, dur, a, b }) => {
  const L = useLayout();
  const e = tween(t, [start, start + dur], [0, 1], EASE.draw);
  if (e <= 0) return null;
  const x = a.x + (b.x - a.x) * e;
  const y = a.y + (b.y - a.y) * e;
  // the pen: a little denser while it draws, easing to rest over 10 frames after it lands
  const pen = 1 - tween(t, [start + dur - 3, start + dur + 10], [0, 1], EASE.inOut);
  const alpha = SEAM_ALPHA + 0.07 * pen;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  // the feathers: 7 % of the full line at each end (fixed to the line, so the head is crisp as it travels)
  const f = 0.07;
  const id = 'kb-turn-seam';
  return (
    <svg width={L.width} height={L.height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
          <stop offset={0} stopColor={HOME.ink} stopOpacity={0} />
          <stop offset={f} stopColor={HOME.ink} stopOpacity={alpha} />
          <stop offset={1 - f} stopColor={HOME.ink} stopOpacity={alpha} />
          <stop offset={1} stopColor={HOME.ink} stopOpacity={0} />
        </linearGradient>
      </defs>
      {len > 0 ? <line x1={a.x} y1={a.y} x2={x} y2={y} stroke={`url(#${id})`} strokeWidth={1.5} strokeLinecap="butt" /> : null}
    </svg>
  );
};

/**
 * The call's level, in the site's #trust idiom rather than a generic
 * visualizer: one row of thin round-capped bars (4 px, 8 px gap) that open
 * from the midline both ways, gaussian-weighted to the centre, with dotted
 * tails fading out on both sides. In silence every column is a dot, so the
 * row IS a flat dotted baseline, and the bars grow out of the dots.
 *
 * The voice radiates: the centre column shows the level now, columns
 * further out show it a little earlier — each word travels outwards.
 * Level + speaker come from the same voice model as the orb (voice.ts).
 */
import React from 'react';
import { noise2D } from '@remotion/noise';
import { C } from '../../theme';
import { aos, mixHex, SPRING } from '../../lib/motion';
import { speakerAt, talkFastAt } from './voice';

const smooth01 = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

export const Waveform: React.FC<{
  t: number;
  cx: number;
  cy: number;
  bars: number;
  tail: number;
  maxH: number; // max half-height of a centre bar
  drawIn: number; // frame the dotted row starts drawing out from the centre
  opacity: number;
  blur: number;
}> = ({ t, cx, cy, bars, tail, maxH, drawIn, opacity, blur }) => {
  const pitch = 12;
  const barW = 4;
  const total = bars + 2 * tail;
  const W = total * pitch + 8;
  const H = 2 * maxH + barW + 16;
  const mid = (total - 1) / 2;
  const sigma = bars * 0.25;
  let loud = 0;

  const cols: React.ReactNode[] = [];
  for (let j = 0; j < total; j++) {
    const d = Math.abs(j - mid);
    const inBars = d <= (bars - 1) / 2 + 0.01;
    const appear = aos(t, drawIn + d * 0.34, { anticip: 2, depth: 0.25, config: SPRING.pop });
    if (appear <= 0.001) continue;
    const tau = t - d * 0.3;
    const lv = Math.max(0, (talkFastAt(tau) - 0.12) / 0.7);
    // gate: below a whisper the column is just its dot (silence = a flat dotted baseline)
    const gate = smooth01((lv - 0.03) / 0.06);
    const a = Math.pow(Math.min(1, lv), 0.62) * gate;
    const g = Math.exp(-0.5 * Math.pow(d / sigma, 2));
    const tex =
      0.3 +
      0.7 *
        (0.5 + 0.5 * noise2D('call-wave', j * 0.33, t * 0.17)) *
        (0.78 + 0.22 * Math.sin(j * 1.3 - t * 0.9));
    const half = inBars ? maxH * a * g * tex : 0;
    const speaking = Math.min(1, lv * 5) * gate;
    loud = Math.max(loud, a * g);
    const voiceCol = mixHex(C.lilac, C.callerLit, speakerAt(tau));
    const col = mixHex(C.paperDim, voiceCol, speaking);
    const tailFade = inBars ? 1 : Math.pow(1 - (d - (bars - 1) / 2) / (tail + 1), 1.4);
    const s = Math.max(0, appear);
    const h = barW + 2 * half * Math.min(1, s);
    const x = 4 + j * pitch;
    const dotSize = barW * Math.min(1.25, s);
    cols.push(
      <rect
        key={j}
        x={x + (barW - dotSize) / 2}
        y={H / 2 - Math.max(dotSize, h) / 2}
        width={dotSize}
        height={Math.max(dotSize, h)}
        rx={dotSize / 2}
        fill={col}
        opacity={Math.min(1, s) * tailFade * (0.42 + 0.58 * speaking)}
      />,
    );
  }

  const glow = Math.min(1, loud * 1.3);
  const filters = [
    glow > 0.05 ? `drop-shadow(0 0 ${(4 + 8 * glow).toFixed(1)}px rgba(185,163,255,${(0.45 * glow).toFixed(3)}))` : '',
    blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      width={W}
      height={H}
      style={{
        position: 'absolute',
        left: cx - W / 2,
        top: cy - H / 2,
        overflow: 'visible',
        opacity,
        filter: filters || undefined,
      }}
    >
      {cols}
    </svg>
  );
};

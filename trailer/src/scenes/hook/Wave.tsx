/**
 * The ring, as a level: a row of thin round-capped bars in the site's
 * #trust idiom (bars open from the midline both ways, a dotted tail trails
 * off), gaussian-weighted to the centre, with dotted tails fading out on
 * both sides. Every column is the same element — at rest a 4 px dot, while
 * it rings a bar — so the bars grow out of the dots.
 *
 * Heights: a deterministic 25 Hz warble (aliased to the frame rate, as a
 * camera would see it) under the burst envelope, textured per bar with
 * noise2D. Colour runs callerLit → lilac across the row.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';
import { C } from '../../theme';
import { aos, EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { FPS } from '../../timing';

const BARS = 15; // columns each side of centre that carry signal
const TAIL = 17; // dotted columns each side beyond them

export const Wave: React.FC<{
  frame: number; // real
  t: number; // world time
  cx: number;
  cy: number;
  pitch: number;
  barW: number;
  maxH: number; // max half-height of the centre bar
  drawIn: number; // frame the dotted row starts drawing out from the centre
  ring: number;
  burst: number;
  freeze: number;
  decayEnd: number;
  out: number;
}> = ({ frame, t, cx, cy, pitch, barW, maxH, drawIn, ring, burst, freeze, decayEnd, out }) => {
  // burst envelope (world time): fast attack, sustain, exponential release
  // the envelope is sampled no later than the freeze: the row HOLDS that shape
  const te = Math.min(t, freeze);
  const attack = tween(te, [ring, ring + 2], [0, 1], EASE.out3);
  const release = te > ring + burst ? Math.exp(-(te - (ring + burst)) / 7) : 1;
  const env = te < ring ? 0 : attack * release;
  // 25 Hz warble sampled at 30 fps
  const warble = 0.7 + 0.3 * Math.sin((2 * Math.PI * 25 * te) / FPS);
  // after the freeze: the row dims to ~40 % and slowly sinks
  const dim = 1 - 0.6 * tween(frame, [freeze, freeze + 10], [0, 1], EASE.house);
  const sink = 1 - 0.22 * tween(frame, [freeze, decayEnd], [0, 1], EASE.inOut);
  const glow = env * (1 - tween(frame, [freeze, freeze + 8], [0, 1], EASE.house));

  const cols = [];
  const J = BARS + TAIL;
  for (let j = -J; j <= J; j++) {
    const a = Math.abs(j);
    const appear = aos(frame, drawIn + a * 0.32, { anticip: 2, depth: 0.2, config: SPRING.pop });
    if (appear <= 0.001) continue;
    const g = Math.exp(-0.5 * Math.pow(j / 6.2, 2));
    const tex =
      0.42 +
      0.58 * (0.5 + 0.5 * noise2D('hook-wave', j * 0.29, t * 0.2)) *
        (0.75 + 0.25 * Math.sin(j * 0.9 - t * 1.1));
    const h = a <= BARS ? maxH * g * env * warble * tex * sink : 0;
    const tailFade = a <= BARS ? 1 : Math.pow(1 - (a - BARS) / (TAIL + 1), 1.5) * 0.75;
    const col = mixHex(C.callerLit, C.lilac, (j + J) / (2 * J));
    const H = barW + 2 * h;
    const s = Math.max(0, appear);
    cols.push(
      <div
        key={j}
        style={{
          position: 'absolute',
          left: cx + j * pitch - barW / 2,
          top: cy - H / 2,
          width: barW,
          height: H,
          borderRadius: barW / 2,
          background: col,
          opacity: Math.min(1, s) * tailFade * dim * (1 - out),
          transform: `scale(${s.toFixed(3)})`,
          boxShadow: glow > 0.05 && h > 6 ? `0 0 ${(8 * glow).toFixed(1)}px ${col}88` : undefined,
        }}
      />,
    );
  }
  return <>{cols}</>;
};

/**
 * The ring, as a level: a row of thin round-capped bars in the site's
 * #trust idiom (bars open from the midline both ways, a dotted tail trails
 * off), gaussian-weighted to the centre, with dotted tails fading out on
 * both sides. Every column is the same element — at rest a 4 px dot, while
 * it rings a bar — so the bars grow out of the dots.
 *
 * Heights: a smooth 5 Hz warble (what the old 25 Hz motor read as at 30 fps,
 * now written at its apparent rate so it is identical at 30 and 120 fps)
 * under the burst envelope, textured per bar with noise2D. Colour runs
 * callerLit → lilac across the row. Drawn as SVG (geometry is never
 * pixel-snapped, so the frozen bars creep by sub-pixels); no glow.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';
import { C } from '../../theme';
import { aos, EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { FPS } from '../../timing';

const BARS = 15; // columns each side of centre that carry signal
const TAIL = 17; // dotted columns each side beyond them
/** the warble's apparent frequency (Hz) */
const WARBLE_HZ = 5;

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
  /** 0..1 a soft light lift (the text beat) */
  tick?: number;
  /** a beat breath in the hold (signed, ≈ −0.3..1): the frozen bars swell ±20 % and catch light */
  breath?: number;
  /** the drawing surface (the frame) */
  width0: number;
  height0: number;
}> = ({ frame, t, cx, cy, pitch, barW, maxH, drawIn, ring, burst, freeze, decayEnd, out, tick = 0, breath = 0, width0, height0 }) => {
  // burst envelope (world time): fast attack, sustain, exponential release
  // the envelope is sampled no later than the freeze: the row HOLDS that shape
  const te = Math.min(t, freeze);
  const attack = tween(te, [ring, ring + 2], [0, 1], EASE.out3);
  const release = te > ring + burst ? Math.exp(-(te - (ring + burst)) / 7) : 1;
  const env = te < ring ? 0 : attack * release;
  const warble = 0.7 + 0.3 * Math.sin((2 * Math.PI * WARBLE_HZ * te) / FPS);
  // after the freeze: the row dims to ~40 % and slowly sinks
  const frozen = tween(frame, [freeze, freeze + 10], [0, 1], EASE.house);
  const dim = Math.min(1, 1 - 0.6 * frozen + 0.3 * tick + 0.22 * Math.max(0, breath) * frozen);
  const swell = 1 + 0.2 * breath * frozen;
  const sink = 1 - 0.22 * tween(frame, [freeze, decayEnd], [0, 1], EASE.inOut);

  const bars: React.ReactNode[] = [];
  const J = BARS + TAIL;
  for (let j = -J; j <= J; j++) {
    const a = Math.abs(j);
    const appear = aos(frame, drawIn + a * 0.32, { anticip: 2, depth: 0.2, config: SPRING.pop });
    if (appear <= 0.001) continue;
    const g = Math.exp(-0.5 * Math.pow(j / 6.2, 2));
    // texture: on the envelope's clock until the freeze, then on world time,
    // which crawls — the frozen silhouette creeps, it never quite stops
    const tex =
      0.42 +
      0.58 * (0.5 + 0.5 * noise2D('hook-wave', j * 0.29, t * 0.2)) * (0.75 + 0.25 * Math.sin(j * 0.9 - t * 1.1));
    const h = a <= BARS ? maxH * g * env * warble * tex * sink * swell : 0;
    const tailFade = a <= BARS ? 1 : Math.pow(1 - (a - BARS) / (TAIL + 1), 1.5) * 0.75;
    const col = mixHex(C.callerLit, C.lilac, (j + J) / (2 * J));
    const s = Math.max(0, appear);
    const w = barW * s;
    const H = (barW + 2 * h) * s;
    const o = Math.min(1, s) * tailFade * dim * (1 - out);
    if (o < 0.003) continue;
    bars.push(
      <rect key={j} x={cx + j * pitch - w / 2} y={cy - H / 2} width={w} height={H} rx={w / 2} fill={col} fillOpacity={o} />,
    );
  }
  if (bars.length === 0) return null;
  return (
    <svg width={width0} height={height0} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
      {bars}
    </svg>
  );
};

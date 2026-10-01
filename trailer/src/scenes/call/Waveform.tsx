/**
 * The caller's side of the line: a phone-line waveform in callerLit that
 * fills the reverse shot. It is driven by the caller's REAL envelope
 * (VOICE.lines[voice].env), so every syllable the viewer hears moves it.
 *
 *   bar i  = env(t − line.at − |i − mid|·0.25) × (0.35 + 0.65·noise)
 *            (the voice radiates from the centre out: outer bars lag)
 *   telephone character: heights quantised to 6 levels and hard-clipped at
 *   85 % (a band-limited, compressed line), a 1.5 px baseline at 25 %, and a
 *   ±4 px deterministic hiss when the line is silent.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';
import { rgba } from '../../lib/lights';
import { C } from '../../theme';
import type { VoiceId } from '../../voice.generated';
import { env } from './voice';

const LEVELS = 6;
const CLIP = 0.85;

export const Waveform: React.FC<{
  t: number;
  /** frame the caller's line starts */
  at: number;
  voice: VoiceId;
  x0: number;
  x1: number;
  cy: number;
  bars: number;
  barW: number;
  /** max half-height (px) */
  maxH: number;
  opacity: number;
  /** the line opening on the cut: 0 → 1 (overshoots); the baseline and the bars spread out from the centre */
  open?: number;
  /** the line's colour (hex) */
  color?: string;
}> = ({ t, at, voice, x0, x1, cy, bars, barW, maxH, opacity, open = 1, color = C.callerLit }) => {
  if (opacity <= 0.002) return null;
  const W = x1 - x0;
  const pitch = (W - barW) / (bars - 1);
  const mid = (bars - 1) / 2;
  const H = 2 * maxH + 20;
  let loud = 0;
  const rects: React.ReactNode[] = [];
  const reach = Math.max(0, open);
  for (let i = 0; i < bars; i++) {
    const d = Math.abs(i - mid);
    // the opening: a bar comes up as the line's edge passes it; the spring's overshoot lifts them all a touch
    const gate = Math.min(1, Math.max(0, (reach * (mid + 1.5) - d) / 3)) * (1 + 2 * Math.max(0, open - 1));
    if (gate <= 0) continue;
    const e = env(voice, t - at - d * 0.25);
    const tex = 0.35 + 0.65 * (0.5 + 0.5 * noise2D('call-line', i * 0.37, t * 0.18));
    // the edges of the band roll off a little (a phone line has no wide stereo image)
    const edge = 1 - 0.35 * Math.pow(d / mid, 2);
    const raw = Math.pow(e, 0.75) * tex * edge;
    const q = Math.min(CLIP, Math.ceil(raw * LEVELS - 0.15) / LEVELS);
    let half = Math.max(0, q) * maxH * gate;
    // hiss: the line is open even when nobody speaks
    const hiss = 1.5 + 2.5 * (0.5 + 0.5 * noise2D('call-hiss', i * 0.9, t * 0.55));
    half = Math.max(half, hiss * Math.min(1, gate));
    loud = Math.max(loud, q);
    const x = i * pitch;
    rects.push(
      <rect
        key={i}
        x={x}
        y={H / 2 - half}
        width={barW}
        height={2 * half}
        rx={Math.min(barW / 2, 2.5)}
        fill={color}
        opacity={(q > 0 ? 0.55 + 0.45 * Math.min(1, q / 0.5) : 0.4) * Math.min(1, gate)}
      />,
    );
  }
  const glow = Math.min(1, loud * 1.2);
  return (
    <svg
      width={W}
      height={H}
      style={{
        position: 'absolute',
        left: x0,
        top: cy - H / 2,
        overflow: 'visible',
        opacity,
        filter: glow > 0.05 ? `drop-shadow(0 0 ${(6 + 10 * glow).toFixed(1)}px ${rgba(color, 0.4 * glow)})` : undefined,
      }}
    >
      {/* the line itself: a 1.5 px baseline at 25 % */}
      <rect x={(W * (1 - Math.min(1.04, reach))) / 2} y={H / 2 - 0.75} width={W * Math.min(1.04, reach)} height={1.5} fill={color} opacity={0.25 + 0.35 * Math.max(0, 1 - reach)} />
      {rects}
    </svg>
  );
};

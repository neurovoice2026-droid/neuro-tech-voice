/**
 * The caller's voice: a fine, centred line of bars under the orb, driven by
 * the caller's REAL envelope (VOICE.lines[voice].env), so every syllable
 * the viewer hears moves it.
 *
 *   bar at distance u from the centre (0 … 1):
 *     height = env(t − line.at − u·lag) · texture · (1 − .45 u²)
 *   the voice radiates from the centre out (the outer bars lag a little);
 *   texture is slow, smooth noise (never per-frame random); silent bars sit
 *   as round dots, so the line reads as a fine dotted rule when nobody speaks.
 *
 * It draws OUT from the centre (`open` 0 → 1, a soft spring) as the caller's
 * turn begins and is drawn back IN (`close` 0 → 1) as Ava answers. Its ends
 * fade out (no hard edge). Heights are continuous in t: smooth at 120 fps.
 */
import React from 'react';
import { noise2D } from '@remotion/noise';
import type { VoiceId } from '../../voice.generated';
import { env } from './voice';

export const Waveform: React.FC<{
  t: number;
  /** frame the caller's line starts */
  at: number;
  voice: VoiceId;
  cx: number;
  cy: number;
  /** half-width of the line (px) */
  half: number;
  /** bar width and pitch (px) */
  barW: number;
  pitch: number;
  /** max half-height (px) */
  maxH: number;
  color: string;
  /** 0 → 1 the line draws out from the centre */
  open: number;
  /** 0 → 1 it is drawn back into the centre */
  close: number;
}> = ({ t, at, voice, cx, cy, half, barW, pitch, maxH, color, open, close }) => {
  const reach = Math.max(0, Math.min(1.02, open)) * (1 - Math.max(0, Math.min(1, close)));
  if (reach <= 0.002) return null;
  const n = Math.floor(half / pitch);
  const rects: React.ReactNode[] = [];
  const H = 2 * maxH + 8;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = side < 0 ? 1 : 0; i <= n; i++) {
      const u = (i * pitch) / half; // 0 at the centre … 1 at the end
      // the bar exists once the line's front has passed it (a soft front, 6 % wide)
      const gate = Math.min(1, Math.max(0, (reach * 1.06 - u) / 0.06));
      if (gate <= 0) continue;
      const e = env(voice, t - at - u * 5);
      const tex = 0.55 + 0.45 * (0.5 + 0.5 * noise2D('call-line', i * 0.31 * side, t * 0.06));
      const shape = 1 - 0.45 * u * u;
      const h = Math.max(barW, 2 * maxH * Math.pow(Math.max(0, e), 0.8) * tex * shape * gate);
      // the line's ends fade out; silent dots are quieter than speaking bars
      const fade = 1 - Math.pow(u, 3);
      const op = (0.38 + 0.62 * Math.min(1, e * 1.6)) * fade * Math.min(1, gate * 1.4);
      const x = cx + side * i * pitch;
      rects.push(
        <rect
          key={`${side}-${i}`}
          x={(x - cx + half - barW / 2).toFixed(3)}
          y={(H / 2 - h / 2).toFixed(3)}
          width={barW}
          height={h.toFixed(3)}
          rx={barW / 2}
          fill={color}
          opacity={op.toFixed(4)}
        />,
      );
    }
  }
  return (
    <svg width={2 * half} height={H} style={{ position: 'absolute', left: cx - half, top: cy - H / 2, overflow: 'visible' }}>
      {rects}
    </svg>
  );
};

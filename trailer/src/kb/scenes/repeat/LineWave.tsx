/**
 * FORK of src/scenes/call/Waveform.tsx @ 8b9cd21 (docs/kb/PIPELINE.md §8: it reads film 1's voice
 * envelopes through scenes/call/voice.ts), bound to FILM 2's VOICE (src/kb/voice.generated.ts). The
 * drawing is the original's: a fine, centred line of bars driven by the caller's REAL envelope, the outer
 * bars lagging a little, slow smooth texture (never per-frame random); silent bars sit as round dots, so
 * an open line nobody speaks on reads as a fine dotted rule (b04's dead line). It draws OUT from the
 * centre (`open`) and back IN (`close`); its ends fade. One SVG: heights are continuous in t (120 fps).
 * It sits in its own clipping box (its mask), so it can also LEAVE UP with the caption it belongs to (`lift`:
 * the caption words' reveal exit — the same offset and fade, through the same kind of mask).
 * Fold back after delivery (one Waveform taking its envelope as a prop).
 */
import React from 'react';
import { noise2D } from '@remotion/noise';
import { subpixel } from '../../../components/Type';
import { VOICE, type VoiceId } from '../../voice.generated';

/** A line's loudness `f` frames after it starts (fractional ok; 0 outside the line). */
export function env(id: VoiceId, f: number): number {
  const e = VOICE.lines[id].env as readonly number[];
  if (f < 0 || f > e.length - 1) return 0;
  const i = Math.floor(f);
  const a = e[i] ?? 0;
  const b = e[i + 1] ?? 0;
  return a + (b - a) * (f - i);
}

export const LineWave: React.FC<{
  t: number;
  /** frame the caller's line starts */
  at: number;
  voice: VoiceId;
  cx: number;
  cy: number;
  half: number;
  barW: number;
  pitch: number;
  maxH: number;
  color: string;
  open: number;
  close: number;
  /** a seed for the texture, so two callers' lines never move alike */
  seed?: string;
  /** leaving up out of its mask: a reveal() state's `y` (% of its height, < 0 = up) and `opacity` */
  lift?: { y: number; opacity: number };
}> = ({ t, at, voice, cx, cy, half, barW, pitch, maxH, color, open, close, seed = 'kb-line', lift }) => {
  if (lift && lift.opacity <= 0.001) return null;
  const reach = Math.max(0, Math.min(1.02, open)) * (1 - Math.max(0, Math.min(1, close)));
  if (reach <= 0.002) return null;
  const n = Math.floor(half / pitch);
  const rects: React.ReactNode[] = [];
  const H = 2 * maxH + 8;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = side < 0 ? 1 : 0; i <= n; i++) {
      const u = (i * pitch) / half;
      const gate = Math.min(1, Math.max(0, (reach * 1.06 - u) / 0.06));
      if (gate <= 0) continue;
      const e = env(voice, t - at - u * 5);
      const tex = 0.55 + 0.45 * (0.5 + 0.5 * noise2D(seed, i * 0.31 * side, t * 0.06));
      const shape = 1 - 0.45 * u * u;
      const h = Math.max(barW, 2 * maxH * Math.pow(Math.max(0, e), 0.8) * tex * shape * gate);
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
  // the mask: the line's own box (every bar fits in H; a bar's width of room at either end)
  const pad = pitch + barW;
  const lifting = !!lift && (Math.abs(lift.y) > 0.01 || lift.opacity < 0.999);
  return (
    <div style={{ position: 'absolute', left: cx - half - pad, top: cy - H / 2, width: 2 * half + 2 * pad, height: H, overflow: 'hidden' }}>
      <svg
        width={2 * half}
        height={H}
        style={{
          position: 'absolute',
          left: pad,
          top: 0,
          overflow: 'visible',
          ...(lifting ? subpixel(`translateY(${lift!.y.toFixed(3)}%)`, true) : null),
          opacity: lifting ? Math.max(0, lift!.opacity) : undefined,
        }}
      >
        {rects}
      </svg>
    </div>
  );
};

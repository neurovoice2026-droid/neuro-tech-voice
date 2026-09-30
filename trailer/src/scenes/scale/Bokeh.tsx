/**
 * The nearest plane: soft lilac bokeh drifting past the lens. A copy of
 * components/Dust.tsx (same deterministic drift: random(seed) positions,
 * upward float, sway, twinkle) drawn with radial gradients instead of a CSS
 * blur, so large discs stay clean on the white stock and cost nothing.
 * The discs live mostly in the side margins (the content band stays clean)
 * and are very soft — a 30 % core, a long falloff — so where one does cross a
 * card it reads as depth haze, not a lilac smudge.
 */
import React from 'react';
import { AbsoluteFill, random } from 'remotion';

export const Bokeh: React.FC<{
  frame: number;
  width: number;
  height: number;
  count?: number;
  seed?: string;
  color?: string;
  opacity?: number;
  speed?: number;
  size?: [number, number];
  /** 0..1 master fade (the discs fade in after the cut) */
  fade?: number;
}> = ({ frame, width, height, count = 8, seed = 'bokeh', color = '124,58,237', opacity = 0.05, speed = 0.5, size = [180, 380], fade = 1 }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', opacity: fade }}>
    {Array.from({ length: count }, (_, i) => {
      const r = (k: string) => random(`${seed}-${i}-${k}`);
      const d = size[0] + r('s') * (size[1] - size[0]);
      const depth = r('d');
      // alternate sides; each disc sits in a band ±18 % around its frame edge
      const side = i % 2 === 0 ? -1 : 1;
      const edge = side < 0 ? 0 : width;
      const x0 = edge + side * (r('x') - 0.35) * width * 0.36;
      const y0 = r('y') * height;
      const drift = speed * (0.4 + depth);
      const span = height + d * 2;
      const y = (((y0 - frame * drift) % span) + span) % span - d;
      const x = x0 + Math.sin(frame / (40 + r('p') * 60) + r('ph') * 6.28) * (8 + depth * 18);
      const tw = 0.6 + 0.4 * Math.sin(frame / (18 + r('t') * 30) + r('tp') * 6.28);
      const a = opacity * tw * (0.45 + depth * 0.55);
      const c = (k: number) => `rgba(${color},${(a * k).toFixed(4)})`;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x - d / 2,
            top: y - d / 2,
            width: d,
            height: d,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${c(1)} 0%, ${c(0.9)} 30%, ${c(0.5)} 58%, ${c(0.18)} 80%, ${c(0)} 100%)`,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

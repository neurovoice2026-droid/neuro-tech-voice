/**
 * Foreground dust / bokeh — the nearest parallax layer. Deterministic:
 * every mote's position, size and drift come from `random(seed)`.
 */
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { useSub } from '../lib/scene';

export const Dust: React.FC<{
  count?: number;
  seed?: string;
  color?: string;
  opacity?: number;
  /** px of drift per frame (upward). */
  speed?: number;
  /** min/max mote diameter. */
  size?: [number, number];
  blur?: [number, number];
  frame?: number;
}> = ({
  count = 40,
  seed = 'dust',
  color = '237,236,241',
  opacity = 0.5,
  speed = 0.35,
  size = [2, 9],
  blur = [0, 6],
  frame: fOverride,
}) => {
  const current = useCurrentFrame() / useSub();
  const frame = fOverride ?? current;
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const d = size[0] + r('s') * (size[1] - size[0]);
        const depth = r('d');
        const x0 = r('x') * width;
        const y0 = r('y') * height;
        const drift = speed * (0.4 + depth);
        const y = ((y0 - frame * drift) % (height + 40) + height + 40) % (height + 40) - 20;
        const x = x0 + Math.sin(frame / (40 + r('p') * 60) + r('ph') * 6.28) * (6 + depth * 14);
        const tw = 0.55 + 0.45 * Math.sin(frame / (18 + r('t') * 30) + r('tp') * 6.28);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: d,
              height: d,
              borderRadius: '50%',
              background: `rgba(${color},1)`,
              opacity: opacity * tw * (0.35 + depth * 0.65),
              filter: `blur(${blur[0] + depth * (blur[1] - blur[0])}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

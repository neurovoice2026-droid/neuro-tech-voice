/**
 * Letter-staggered mask rise for the site's uppercase labels: each letter
 * sits in its own clipped box and rides aos() (anticipation, overshoot,
 * settle) up from 110 %, with blur proportional to its speed.
 */
import React from 'react';
import { aos, SPRING } from '../../lib/motion';

export const StaggerText: React.FC<{
  text: string;
  frame: number;
  start: number;
  stagger?: number;
  style?: React.CSSProperties;
  letterStyle?: (i: number) => React.CSSProperties | undefined;
}> = ({ text, frame, start, stagger = 1, style, letterStyle }) => {
  const chars = Array.from(text);
  return (
    <div style={{ display: 'inline-flex', whiteSpace: 'pre', ...style }}>
      {chars.map((ch, i) => {
        const s = start + i * stagger;
        const cfg = { anticip: 3, depth: 0.12, config: SPRING.site };
        const p = aos(frame, s, cfg);
        const pp = aos(frame - 1, s, cfg);
        const y = (1 - p) * 110;
        const v = Math.abs(p - pp) * 110;
        const blur = Math.min(5, v * 0.05);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              overflow: 'hidden',
              verticalAlign: 'top',
              paddingTop: '0.18em',
              marginTop: '-0.18em',
              paddingBottom: '0.08em',
              marginBottom: '-0.08em',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${y.toFixed(2)}%)`,
                filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
                ...letterStyle?.(i),
              }}
            >
              {ch === ' ' ? ' ' : ch}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * A short uppercase label revealed letter by letter: each letter sits in its
 * own clipping box and rises out of it on the caption spring (Type.tsx
 * reveal), staggered — motion only, never blur. Leaves the same way (`exit`).
 */
import React from 'react';
import { reveal, revealStyle, type RevealExit } from '../../components/Type';
import { SPRING } from '../../lib/motion';
import { maskBox } from '../../lib/type';

export const StaggerText: React.FC<{
  text: string;
  /** timeline time (fractional) */
  t: number;
  start: number;
  /** frames between letters */
  stagger?: number;
  /** the exit (each letter `exitStagger` frames after the last) */
  exit?: RevealExit & { stagger?: number };
  style?: React.CSSProperties;
}> = ({ text, t, start, stagger = 0.8, exit, style }) => {
  const chars = Array.from(text);
  return (
    <div style={{ display: 'inline-flex', whiteSpace: 'pre', ...style }}>
      {chars.map((ch, i) => {
        const r = reveal(t, start + i * stagger, {
          config: SPRING.caption,
          rise: 100,
          fade: 0.5,
          exit: exit ? { at: exit.at + i * (exit.stagger ?? 0.5), dur: exit.dur ?? 6, to: exit.to } : undefined,
        });
        return (
          // the letter keeps its own tracking (the label's letter-spacing sits inside the box)
          <span key={i} style={{ ...maskBox(0), letterSpacing: 'inherit' }}>
            <span style={revealStyle(r)}>{ch === ' ' ? ' ' : ch}</span>
          </span>
        );
      })}
    </div>
  );
};

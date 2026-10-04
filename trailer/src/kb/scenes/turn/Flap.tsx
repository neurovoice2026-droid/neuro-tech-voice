/**
 * The FLIP WINDOW of "repeats." (SCRIPT.md b07: "a flip window that turns over on every beat and only ever
 * flips to the same word … in slate, with a flap tick"). A fork of the kit's FlipWord (kit/paper.tsx) for
 * this act's headline: the window is a flap of the same white paper as the day's slips (a hairline ring
 * and a short shadow, never a grey chip behind the word, which read as a text selection), its two halves
 * told apart by tone — the lower card a hair deeper in its own shadow — and a split so faint it never reads
 * as a strike through the word. On each flip the upper flap falls forward to the split (accelerating, its
 * face darkening as it turns edge-on, the lower half catching its shadow), then the lower flap lands from
 * the split and settles: light, never blur. A long perspective keeps the falling flap from bulging past
 * the window.
 *
 * Inline-block, set inside a line of type (it takes the line's font); `lh` = the line's line-height.
 */
import React from 'react';
import { mixColor } from '../../../lib/lights';
import { EASE } from '../../../lib/motion';

const PAPER = '#ffffff';
/** the lower card: the same paper a touch deeper (in the upper card's shadow) */
const PAPER_LOW = '#f6f5f9';
/** a card turned edge-on, in shade */
const EDGE = '#c9c5d3';

export const Flap: React.FC<{ t: number; word: string; flips: readonly number[]; color: string; lh: number; dur?: number }> = ({ t, word, flips, color, lh, dur = 6 }) => {
  let at = -Infinity;
  for (const f of flips) if (f <= t) at = f;
  const u = (t - at) / dur;
  const flipping = u >= 0 && u < 1;
  // the window: the line box, a little taller (the descenders sit inside it); the split at its middle
  const top = -0.05;
  const h = lh + 0.17;
  const pad = 0.13;
  const half = (part: 'top' | 'bottom', o: { rot?: number; shade?: number } = {}) => {
    const base = part === 'top' ? PAPER : PAPER_LOW;
    const s = o.shade ?? 0;
    return (
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${top}em`,
          height: `${h}em`,
          borderRadius: '0.09em',
          background: s > 0 ? mixColor(base, EDGE, s) : base,
          color: s > 0 ? mixColor(color, '#0b0716', s * 0.5) : color,
          clipPath: part === 'top' ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)',
          transformOrigin: '50% 50%',
          transform: o.rot ? `perspective(16em) rotateX(${o.rot.toFixed(3)}deg)` : undefined,
          backfaceVisibility: 'hidden',
        }}
      >
        <span style={{ position: 'absolute', left: `${pad}em`, top: `${-top}em`, lineHeight: lh, whiteSpace: 'nowrap' }}>{word}</span>
      </span>
    );
  };
  // upper flap 0 → −90° over the first half (accelerating), lower flap 90° → 0 over the second (landing)
  const u1 = Math.min(1, Math.max(0, u * 2));
  const u2 = Math.min(1, Math.max(0, u * 2 - 1));
  const a1 = -90 * EASE.in3(u1);
  const a2 = 90 * (1 - EASE.out3(u2));
  return (
    <span style={{ position: 'relative', display: 'inline-block', padding: `0 ${pad}em`, lineHeight: lh }}>
      <span style={{ visibility: 'hidden' }}>{word}</span>
      {/* the window: paper on the mesh — a hairline ring and a short shadow */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${top}em`,
          height: `${h}em`,
          borderRadius: '0.09em',
          boxShadow: '0 0 0 1px rgba(20, 10, 36, 0.07), 0 1px 1.5px rgba(20, 10, 36, 0.06), 0 2px 5px -1px rgba(20, 10, 36, 0.08)',
        }}
      />
      {half('top')}
      {half('bottom', { shade: flipping && u < 0.5 ? 0.22 * u1 : flipping ? 0.22 * (1 - u2) : 0 })}
      {flipping && u < 0.5 ? half('top', { rot: a1, shade: 0.55 * u1 }) : null}
      {flipping && u >= 0.5 ? half('bottom', { rot: a2, shade: 0.5 * (1 - u2) }) : null}
      {/* the split: barely there (the halves' tones carry it) */}
      <span style={{ position: 'absolute', left: 0, right: 0, top: `calc(${top + h / 2}em - 0.5px)`, height: 1, background: 'rgba(20, 10, 36, 0.035)' }} />
    </span>
  );
};

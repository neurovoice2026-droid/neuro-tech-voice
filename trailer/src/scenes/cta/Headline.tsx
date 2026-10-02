/**
 * "AI voice agents that book your customers 24/7." — the CTA's statement,
 * set like the knowledge heading the client chose as THE look: Instrument
 * Sans display (TYPE.display, 440 on the night, −0.03em, line-height 1.04),
 * sentence case, the key phrase ("24/7.") in the scene's accent ink — the
 * night's lilac — the rest in paper. Two-tone from the start.
 *
 * Ava SAYS this line: each ROW rises as a unit ON its first spoken word
 * (spec.wordAt, from the real voice timing) — its words out of their own
 * masks UNIT_STAGGER (½ f) apart, so the centred row never hangs half-filled
 * off-centre while the voice catches up — the film's one text gesture
 * (components/Type.tsx reveal: SPRING.text, opacity
 * over the first half of the travel, sub-pixel while it moves, pixel-crisp at
 * rest). At the converge the words leave the same way — up through their
 * masks, staggered, accelerating (power3.in) — and the stage is the four
 * lights'. No blur, no ghost copies, no flight into the core.
 */
import React from 'react';
import { maskBox, typeStyle, UNIT_STAGGER } from '../../lib/type';
import { reveal, revealStyle, useGlide } from '../../components/Type';
import { SPRING } from '../../lib/motion';
import { C } from '../../theme';

export type HeadlineSpec = {
  /** the rows, each kept on one line */
  lines: readonly string[];
  /** centre y of the block (frame px) */
  cy: number;
  /** TYPE.display at this size (px) */
  size: number;
  /** frame each word's mask rise starts (from its spoken word, Cta.tsx) */
  wordAt: readonly number[];
  /** the exit: first word leaves at `from`, then one every `step` frames, each over `dur` */
  exit: { from: number; step: number; dur: number };
  /** words set in the accent ink (exact words of `lines`) */
  keys: readonly string[];
  accent: string;
  vertical: boolean;
};

export const Headline: React.FC<{ t: number; spec: HeadlineSpec }> = ({ t, spec }) => {
  const { lines, cy, size, wordAt, exit, keys, accent, vertical } = spec;
  // on the moving camera plane each word holds its own sub-pixel layer (no 1 px ticks during the push)
  const glide = useGlide();
  if (t < wordAt[0] - 2) return null;
  if (t > exit.from + (wordAt.length - 1) * exit.step + exit.dur + 1) return null;
  let i = 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: cy,
        transform: 'translateY(-50%)',
        ...typeStyle('display', vertical, { tone: 'night', size }),
        color: C.paper,
        textAlign: 'center',
      }}
    >
      {lines.map((row, li) => {
        const ws = row.split(' ');
        // the row rises as a unit on its first spoken word
        const rowAt = wordAt[Math.min(i, wordAt.length - 1)];
        return (
          <div key={li} style={{ whiteSpace: 'nowrap' }}>
            {ws.map((w, j) => {
              const k = i++;
              const r = reveal(t, rowAt + j * UNIT_STAGGER, {
                config: SPRING.text,
                exit: { at: exit.from + k * exit.step, dur: exit.dur, to: 'up' },
              });
              return (
                <span key={j} style={maskBox(j < ws.length - 1 ? 0.24 : 0)}>
                  <span style={{ ...revealStyle(r, undefined, glide), color: keys.includes(w) ? accent : undefined }}>{w}</span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

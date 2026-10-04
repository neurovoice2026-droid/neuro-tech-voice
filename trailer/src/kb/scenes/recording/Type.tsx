/**
 * b06's type — the house system only (src/theme.ts TYPE, Instrument Sans), blur-free:
 *
 *   <LeftTitle>   the house Title (scenes/knowledge/Title.tsx) set LEFT on the column's axis: each line
 *                 rises out of its word masks on the text spring (a 2-frame ripple) on the onset of its
 *                 first spoken word; the key phrase eases into the part's accent and a glint (a brighter
 *                 rose) runs through it word by word — colour moving through the type, nothing smeared;
 *                 it leaves up through the same masks
 *   <SaidLines>   the narrator's question in the caption role (no tag: narration), line by line
 *   <Waiting>     "Waiting." in the display role, the whole word rising out of its mask on
 *                 SPRING.display and LOCKING (first reaching its line) ON the bar — film 1's DisplayWord
 *                 timing (scenes/result/Split.tsx wordReveal), set on paper, anchored at its left edge
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { mixColor } from '../../../lib/lights';
import { EASE, mixHex, SPRING, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { wordReveal } from '../../../scenes/result/Split';
import { subpixel } from '../../../lib/glide';
import type { TypeRole } from '../../../theme';

/** a line of words and when it rises: one time (the line ripples from it) or one per word */
export type TitleLine = { words: readonly string[]; at: number | readonly number[] };
const startOf = (ln: TitleLine, k: number, stagger: number) => (typeof ln.at === 'number' ? ln.at + k * stagger : ln.at[k]);
const firstAt = (ln: TitleLine) => (typeof ln.at === 'number' ? ln.at : ln.at[0]);

export const LeftTitle: React.FC<{
  t: number;
  lines: readonly TitleLine[];
  x: number;
  /** the first line box's top */
  y: number;
  role?: TypeRole;
  vertical: boolean;
  color: string;
  stagger?: number;
  keyPhrase?: { text: string; at: number; color: string; glint: string };
  exit?: { at: number; stagger: number; dur: number };
}> = ({ t, lines, x, y, role = 'headline', vertical, color, stagger = 2, keyPhrase, exit }) => {
  const all = lines.flatMap((l) => l.words);
  const keyIdx = new Set<number>();
  if (keyPhrase) {
    const kw = keyPhrase.text.split(' ');
    for (let i = all.length - kw.length; i >= 0; i--) {
      if (kw.every((w, j) => all[i + j] === w)) {
        kw.forEach((_, j) => keyIdx.add(i + j));
        break;
      }
    }
  }
  const keyList = [...keyIdx].sort((a, b) => a - b);
  const keyMix = keyPhrase ? tween(t, [keyPhrase.at, keyPhrase.at + 18], [0, 1], EASE.house) : 0;
  const glintPos = keyPhrase ? tween(t, [keyPhrase.at, keyPhrase.at + 16], [-1, keyList.length], EASE.inOut) : -9;
  const glintOn = !!keyPhrase && t >= keyPhrase.at && t <= keyPhrase.at + 16;
  // gone: nothing to draw
  if (exit && t > exit.at + exit.stagger * all.length + exit.dur + 1) return null;
  if (t < firstAt(lines[0]) - 1) return null;
  let n = 0;
  return (
    <div style={{ position: 'absolute', left: x, top: y, ...typeStyle(role, vertical, { tone: 'paper' }), color, whiteSpace: 'nowrap' }}>
      {lines.map((ln, li) => (
        <div key={li}>
          {ln.words.map((w, k) => {
            const i = n++;
            const r = reveal(t, startOf(ln, k, stagger), {
              config: SPRING.text,
              rise: 100,
              fade: 0.55,
              exit: exit ? { at: exit.at + i * exit.stagger, dur: exit.dur } : undefined,
            });
            let col = keyIdx.has(i) && keyPhrase ? mixHex(color, keyPhrase.color, keyMix) : color;
            if (keyIdx.has(i) && keyPhrase && glintOn) {
              const g = Math.exp(-(((keyList.indexOf(i) - glintPos) / 0.7) ** 2));
              if (g > 0.02) col = mixColor(col, keyPhrase.glint, 0.6 * g);
            }
            return (
              <span key={k} style={maskBox(k === ln.words.length - 1 ? 0 : 0.24)}>
                <span style={{ ...revealStyle(r), color: col }}>{w}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Narration in the caption role, left-aligned, a line at a time (each line's words a 1.5-frame ripple). */
export const SaidLines: React.FC<{ t: number; lines: readonly TitleLine[]; x: number; y: number; vertical: boolean; color: string }> = ({ t, lines, x, y, vertical, color }) => {
  if (t < firstAt(lines[0]) - 1) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, ...typeStyle('caption', vertical, { tone: 'paper' }), color, whiteSpace: 'nowrap' }}>
      {lines.map((ln, li) => (
        <div key={li}>
          {ln.words.map((w, k) => {
            const r = reveal(t, startOf(ln, k, 1.5), { config: SPRING.caption, rise: 100, fade: 0.5 });
            return (
              <span key={k} style={maskBox(k === ln.words.length - 1 ? 0 : 0.24)}>
                <span style={revealStyle(r)}>{w}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** "Waiting." — the display role on paper, locking ON `land`; (x, baseline) = its left edge on the baseline. */
export const Waiting: React.FC<{ t: number; land: number; x: number; baseline: number; vertical: boolean; color: string; text?: string }> = ({
  t,
  land,
  x,
  baseline,
  vertical,
  color,
  text = 'Waiting.',
}) => {
  const st = typeStyle('display', vertical, { tone: 'paper' });
  const size = st.fontSize as number;
  const lh = 1.04;
  const base = ((lh - 1.22) / 2 + 0.97) * size;
  const r = wordReveal(t, land);
  if (r.opacity <= 0.001 && t < land) return null;
  const moving = Math.abs(r.y) > 0.03;
  return (
    <div style={{ position: 'absolute', left: x, top: baseline - base, ...st, lineHeight: lh, color, whiteSpace: 'nowrap' }}>
      <span style={maskBox(0)}>
        <span
          style={{
            display: 'inline-block',
            ...subpixel(moving ? `translateY(${r.y.toFixed(3)}%)` : undefined, moving),
            opacity: r.opacity >= 0.999 ? undefined : Math.max(0, r.opacity),
          }}
        >
          {text}
        </span>
      </span>
    </div>
  );
};

/**
 * THE WORD RE-SET — a fork of the kit's <WordReset> (kit/paper.tsx) for b11, same layout and the same reveals, with
 * one change: a kept word's flight is a TIMED glide on the house ease (cubic-bezier(.16, 1, .3, 1) over GLIDE frames)
 * instead of a spring, so it lands exactly on its pen position GLIDE frames after its onset. Her last kept word
 * ("closed.", on the last word of the line) has under 20 frames before the strip folds into the record; a spring
 * still has a few px to travel then, which reads as a tight word space ("we'reclosed"). Everything else is the kit's:
 *
 *   source tokens sit where the page set them (lines `lineH` apart, title role with tabular figures); every token
 *   no target word takes leaves up through its mask at `leaveAt`, a frame apart
 *   KEPT words glide (sub-pixel) to their pen positions in the target sentence, from the source size to the
 *   target size by transform (the glyphs are set once, at the target size); extra letters they gain ("Sunday" →
 *   "Sundays,") rise in once they land
 *   NEW words rise into their masks on their onsets; a key phrase eases into its ink
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { EASE, mix, mixHex, SPRING, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, layoutWords, measureText, spaceWidth, useKitFaces, type ResetWord } from '../../kit';

/** frames a kept word takes from its onset to its pen position */
export const GLIDE = 16;

export const Reset: React.FC<{
  t: number;
  source: { x: number; y: number; lines: readonly string[]; size: number; lineH?: number; color?: string };
  target: { text: string; x: number; y: number; size: number; maxWidth: number; align?: 'center' | 'left'; color?: string; keys?: readonly { text: string; color: string; at: number }[] };
  words: readonly ResetWord[];
  leaveAt?: number;
  /** each kept word's flight (by target word index), so it never crosses a word already set or still on the strip:
   *  'yx'  to its line's height first, then along the line (it arrives from the open side of its slot)
   *  'xy'  across first, then into its line
   *  'hop' up out of the strip first (a line's height), across above it, then into its slot */
  path?: (i: number) => 'yx' | 'xy' | 'hop';
}> = ({ t, source, target, words, leaveAt, path = () => 'yx' }) => {
  useKitFaces();
  const sSpec = { size: source.size, weight: TYPE.title.weight, tracking: -0.02 };
  const tSpec = { size: target.size, weight: TYPE.caption.weight, tracking: -0.02 };
  const sLineH = source.lineH ?? source.size * 1.62;
  const srcTokens = source.lines.map((ln, li) => layoutWords(ln, sSpec, source.x).words.map((w) => ({ ...w, y: source.y + li * sLineH })));
  // the target layout: greedy wrap at maxWidth, each line centred (or left)
  const tWords = target.text.split(' ');
  const space = spaceWidth(tSpec);
  const widths = tWords.map((w) => measureText(w, tSpec));
  const lines: number[][] = [];
  let cur: number[] = [];
  let lw = 0;
  tWords.forEach((_, i) => {
    if (cur.length && lw + space + widths[i] > target.maxWidth) {
      lines.push(cur);
      cur = [];
      lw = 0;
    }
    lw += (cur.length ? space : 0) + widths[i];
    cur.push(i);
  });
  if (cur.length) lines.push(cur);
  const tLineH = target.size * TYPE.caption.lineHeight;
  const top = target.y - (lines.length * tLineH) / 2;
  const pos: { x: number; y: number }[] = [];
  lines.forEach((ln, li) => {
    const wSum = ln.reduce((s, i) => s + widths[i], 0) + space * (ln.length - 1);
    let x = target.align === 'left' ? target.x : target.x - wSum / 2;
    for (const i of ln) {
      pos[i] = { x, y: top + li * tLineH };
      x += widths[i] + space;
    }
  });
  const used = new Set(words.filter((w) => w.from).map((w) => `${w.from![0]}:${w.from![1]}`));
  const leave = leaveAt ?? Math.min(...words.map((w) => w.at));
  const tColor = target.color ?? APP.foreground;
  const sColor = source.color ?? APP.foreground;
  const keyOf = (i: number) => {
    for (const k of target.keys ?? []) {
      const kw = k.text.split(' ');
      for (let s = 0; s + kw.length <= tWords.length; s++) {
        if (kw.every((w, j) => tWords[s + j].replace(/[.,!?]$/, '') === w.replace(/[.,!?]$/, '')) && i >= s && i < s + kw.length) return k;
      }
    }
    return null;
  };
  const scaleK = source.size / target.size;
  return (
    <>
      {srcTokens.flatMap((line, li) =>
        line.map((tok, ti) => {
          if (used.has(`${li}:${ti}`)) return null;
          const rv = reveal(t, -1e6, { exit: { at: leave + (li * line.length + ti) * 1, dur: 9 } });
          if (rv.opacity <= 0.001) return null;
          return (
            <span key={`s${li}-${ti}`} style={{ position: 'absolute', left: tok.x, top: tok.y, ...maskBox(0), ...typeStyle('title', false, { size: source.size, tabular: true }), letterSpacing: '-0.02em', color: sColor }}>
              <span style={revealStyle(rv, undefined, true)}>{tok.text}</span>
            </span>
          );
        }),
      )}
      {tWords.map((word, i) => {
        const spec = words[i] ?? { at: Infinity };
        const k = keyOf(i);
        const ink = k ? mixHex(tColor, k.color, tween(t, [k.at, k.at + 18], [0, 1], EASE.house)) : tColor;
        const P = pos[i];
        if (spec.from) {
          const tok = srcTokens[spec.from[0]][spec.from[1]];
          const g = tween(t, [spec.at, spec.at + GLIDE], [0, 1], EASE.house);
          // the leading axis gets there early (out3 over 60 %), the trailing one follows (inOut from 20 %): a curved path
          const lead = tween(t, [spec.at, spec.at + GLIDE * 0.6], [0, 1], EASE.out3);
          const trail = tween(t, [spec.at + GLIDE * 0.2, spec.at + GLIDE], [0, 1], EASE.inOut);
          const kind = path(i);
          let gx: number;
          let gy: number;
          // it grows to the sentence's size as it travels along / across (not as it leaves the strip: a word growing
          // in place would spread over its neighbours on the strip)
          let sc: number;
          if (kind === 'hop') {
            // up out of the strip (a line), across, then into the slot — three overlapping eased legs
            const up = tween(t, [spec.at, spec.at + GLIDE * 0.35], [0, 1], EASE.out3);
            const across = tween(t, [spec.at + GLIDE * 0.12, spec.at + GLIDE * 0.82], [0, 1], EASE.inOut);
            const settle = tween(t, [spec.at + GLIDE * 0.5, spec.at + GLIDE], [0, 1], EASE.inOut);
            const band = tok.y - source.size * 1.3;
            gx = mix(tok.x, P.x, across);
            gy = mix(mix(tok.y, band, up), P.y, settle);
            sc = mix(scaleK, 1, across);
          } else {
            gx = mix(tok.x, P.x, kind === 'xy' ? lead : trail);
            gy = mix(tok.y, P.y, kind === 'xy' ? trail : lead);
            sc = mix(scaleK, 1, kind === 'xy' ? lead : trail);
          }
          const keep = tok.text;
          const prefix = word.startsWith(keep) ? keep : word;
          const suffix = word.startsWith(keep) ? word.slice(keep.length) : '';
          // the letters it gains rise in once it has landed in its slot
          const suf = suffix ? reveal(t, spec.at + GLIDE - 6, { config: SPRING.caption, rise: 90 }) : null;
          const flying = g > 0 && t < spec.at + GLIDE + 0.5;
          return (
            <span
              key={`t${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transformOrigin: '0 0',
                ...typeStyle('caption', false, { size: target.size }),
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                color: t < spec.at ? sColor : mixHex(sColor, ink, g),
                // on its own layer from the onset until it has landed; at rest it drops back to pixel-crisp
                ...subpixel(`translate(${gx.toFixed(3)}px, ${gy.toFixed(3)}px) scale(${sc.toFixed(5)})`, flying || t < spec.at),
              }}
            >
              {prefix}
              {suffix ? (
                <span style={maskBox(0)}>
                  <span style={revealStyle(suf!, undefined, true)}>{suffix}</span>
                </span>
              ) : null}
            </span>
          );
        }
        if (t < spec.at - 0.5) return null;
        const rv = reveal(t, spec.at, { config: SPRING.caption, rise: 100 });
        return (
          <span key={`t${i}`} style={{ position: 'absolute', left: P.x, top: P.y, ...maskBox(0), ...typeStyle('caption', false, { size: target.size }), letterSpacing: '-0.02em', color: ink }}>
            <span style={revealStyle(rv, undefined, t - spec.at < 20)}>{word}</span>
          </span>
        );
      })}
    </>
  );
};

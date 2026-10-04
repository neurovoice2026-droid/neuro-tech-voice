/**
 * THE WORD RE-SET (SCRIPT.md b11, the graft from "demo") — ONE choreographed move, rebuilt after build B's critics
 * ("orphan words floating, an empty highlighted box, 'we're        closed' with a wide gap, the sentence held 6 frames")
 * and after the 4K viewer review ("the kept words wait at 40 % grey in their final slots: mid-sentence the caption reads
 * 'We are! Saturday from / nine till    Sunday / closed' — a wrong sentence"):
 *
 *   page     the swept lines stay on the page (call/Page.tsx): from CALL_LOCAL.drop the tokens she doesn't say
 *            (· 9:00–14:00 ·) leave up through their own masks and the sweep bands up out of theirs — no strip, no box
 *            outlives its words
 *   fly      on "We" (CALL_LOCAL.fly) every KEPT word (Saturday · Sunday · closed) takes off from its place on the page
 *            TOGETHER and glides — one eased path each, soft start, never two words on the same pixels (stage.ts
 *            `flights`) — to its slot in her sentence, growing from the page's size to the caption's by transform (the
 *            glyphs are set once, at the caption size; the weight eases 480 → 460 on the variable face), and DIVES into
 *            the slot: without stopping it sinks through the slot's own mask edge (the very mask the slot's word will
 *            rise out of) and is gone — the words are filed into her sentence, nothing waits on screen. Nothing parks,
 *            nothing is ever alone in transit, no word sits in her line before she says it
 *   onsets   on each word's moment (CALL_LOCAL.reset: its onset − 2, captions' lead) its word rises into its slot out of
 *            that mask — her own words and the kept ones alike, a kept word whole ("Sundays," / "closed.") — so every
 *            state of the line reads as what she has said so far; "nine till two." takes the sunday key with "nine". The
 *            rise is gated (REVEAL_OPACITY): a word shows only once its x-height is in the mask, so an i's dot or an
 *            apostrophe never shows alone on the rise's first frame (the review's stray "·" at 56.0 s was "nine"'s dot)
 *
 * The result IS her caption: "We are! Saturday from nine till two. Sundays, we're closed." (caption role, ink).
 */
import React from 'react';
import { Easing } from 'remotion';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { EASE, mix, mixHex, smooth, SPRING, tween } from '../../../lib/motion';
import { MASK_PAD, maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, measureText, spaceWidth, useKitFaces, type ResetWord } from '../../kit';

/** a flight: soft start (it is lifted off the page, not kicked), decisive, a long settle with no overshoot */
const FLY = Easing.bezier(0.36, 0, 0.12, 1);
/** the dive into the slot (fractions of the flight's duration from take-off): it starts as the flight decelerates into
 *  its slot (≈ 80 % there) and accelerates down through the slot's mask edge (EASE.in2) — one continuous path: the word
 *  drops through its slot without coming to rest on screen, and is under the edge ≈ 2 f before the landing */
const DIVE = [0.44, 0.86] as const;
/** how far below its line the word dives (em of the caption size): its cap height clears the mask's bottom edge */
const DIVE_DEPTH = 1.32;
/** a rising word's opacity from its rise progress: nothing until its x-height has entered the mask (≈ p .25) — so an
 *  i's dot or an apostrophe, the glyph tops that enter first, never shows alone — then quickly to full ink */
const REVEAL_OPACITY = (p: number) => smooth(0.25, 0.8, p);

export type Flight = 'g' | 'yx' | 'xy';
export type PageToken = { text: string; x: number; y: number };

/** her sentence laid out (greedy wrap at maxWidth, each line left / centred): every word's pen position (frame px) */
export function resetLayout(target: { text: string; x: number; y: number; size: number; maxWidth: number; align?: 'center' | 'left' }) {
  const tSpec = { size: target.size, weight: TYPE.caption.weight, tracking: -0.02 };
  const words = target.text.split(' ');
  const space = spaceWidth(tSpec);
  const widths = words.map((w) => measureText(w, tSpec));
  const lines: number[][] = [];
  let cur: number[] = [];
  let lw = 0;
  words.forEach((_, i) => {
    if (cur.length && lw + space + widths[i] > target.maxWidth) {
      lines.push(cur);
      cur = [];
      lw = 0;
    }
    lw += (cur.length ? space : 0) + widths[i];
    cur.push(i);
  });
  if (cur.length) lines.push(cur);
  const lineH = target.size * TYPE.caption.lineHeight;
  const top = target.y - (lines.length * lineH) / 2;
  const pos: { x: number; y: number; w: number }[] = [];
  lines.forEach((ln, li) => {
    const wSum = ln.reduce((a, i) => a + widths[i], 0) + space * (ln.length - 1);
    let x = target.align === 'left' ? target.x : target.x - wSum / 2;
    for (const i of ln) {
      pos[i] = { x, y: top + li * lineH, w: widths[i] };
      x += widths[i] + space;
    }
  });
  return { words, pos, lineH, top, lines: lines.length };
}

export const Reset: React.FC<{
  t: number;
  /** the swept lines' tokens where the page sets them (call/Page.tsx sweptTokens), and the page's line size */
  tokens: readonly (readonly PageToken[])[];
  sourceSize: number;
  target: { text: string; x: number; y: number; size: number; maxWidth: number; align?: 'center' | 'left'; color: string; keys?: readonly { text: string; color: string; at: number }[] };
  /** per target word: its moment (onset − lead) and, for a kept word, the page token it comes from [line, token] */
  words: readonly ResetWord[];
  /** the one move: [take-off, landing] */
  fly: readonly [number, number];
  /** each kept word's path, in sentence order */
  flights: readonly Flight[];
}> = ({ t, tokens, sourceSize, target, words, fly, flights }) => {
  useKitFaces();
  const L = resetLayout(target);
  const tColor = target.color;
  const keyOf = (i: number) => {
    for (const k of target.keys ?? []) {
      const kw = k.text.split(' ');
      for (let s = 0; s + kw.length <= L.words.length; s++) {
        if (kw.every((w, j) => L.words[s + j].replace(/[.,!?]$/, '') === w.replace(/[.,!?]$/, '')) && i >= s && i < s + kw.length) return k;
      }
    }
    return null;
  };
  const scaleK = sourceSize / target.size;
  // the flyer is set with the TITLE role's line height (the page's) so its baseline is the page's at take-off; it lands
  // that much lower in the caption's taller line box (the caption words' baseline)
  const lhTitle = TYPE.title.lineHeight;
  const dyLand = (target.size * (TYPE.caption.lineHeight - lhTitle)) / 2;
  const D = fly[1] - fly[0];
  let keptIndex = 0;
  return (
    <>
      {L.words.map((word, i) => {
        const spec = words[i] ?? { at: Infinity };
        const k = keyOf(i);
        const ink = k ? mixHex(tColor, k.color, tween(t, [k.at, k.at + 18], [0, 1], EASE.house)) : tColor;
        const P = L.pos[i];
        const kept = spec.from ? keptIndex++ : -1;
        if (spec.from && t < spec.at - 0.5) {
          const kind = flights[kept] ?? 'g';
          const tok = tokens[spec.from[0]][spec.from[1]];
          const diveEnd = fly[0] + DIVE[1] * D;
          if (t < fly[0] || t >= diveEnd) return null;
          const g = FLY(Math.min(1, Math.max(0, (t - fly[0]) / D)));
          const lead = FLY(Math.min(1, Math.max(0, (t - fly[0]) / (0.65 * D))));
          const trail = FLY(Math.min(1, Math.max(0, (t - fly[0] - 0.2 * D) / (0.8 * D))));
          const ux = kind === 'g' ? g : kind === 'xy' ? lead : trail;
          const uy = kind === 'g' ? g : kind === 'yx' ? lead : trail;
          // the dive: down through the slot's mask edge as it settles into its slot
          const q = tween(t, [fly[0] + DIVE[0] * D, diveEnd], [0, 1], EASE.in2);
          const gx = mix(tok.x, P.x, ux);
          const gy = mix(tok.y, P.y + dyLand, uy) + q * DIVE_DEPTH * target.size;
          const sc = mix(scaleK, 1, g);
          const weight = mix(TYPE.title.weight, TYPE.caption.weight, g);
          // the slot's mask: its bottom edge is the bottom of the box the slot's word rises out of (maskBox at P)
          const maskBottom = P.y + (TYPE.caption.lineHeight + MASK_PAD.bottom) * target.size;
          // ink: the page's foreground → her ink as it flies; its last slivers fade as it goes under the edge
          const opacity = 1 - smooth(0.45, 0.85, q);
          return (
            <div key={`t${i}`} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: maskBottom, overflow: 'hidden' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transformOrigin: '0 0',
                  ...typeStyle('caption', false, { size: target.size, weight }),
                  lineHeight: lhTitle,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  color: mixHex(APP.foreground, ink, g),
                  opacity: opacity < 0.999 ? opacity : undefined,
                  // on its own layer the whole way: it is always moving
                  ...subpixel(`translate(${gx.toFixed(3)}px, ${gy.toFixed(3)}px) scale(${sc.toFixed(5)})`, true),
                }}
              >
                {tok.text}
              </span>
            </div>
          );
        }
        if (t < spec.at - 0.5) return null;
        // every word of her sentence — a kept one whole — rises out of its slot's mask on its moment
        const rv = reveal(t, spec.at, { config: SPRING.caption, rise: 100 });
        return (
          <span key={`t${i}`} style={{ position: 'absolute', left: P.x, top: P.y, ...maskBox(0), ...typeStyle('caption', false, { size: target.size }), letterSpacing: '-0.02em', color: ink }}>
            <span style={revealStyle({ ...rv, opacity: REVEAL_OPACITY(rv.p) }, undefined, t - spec.at < 20)}>{word}</span>
          </span>
        );
      })}
    </>
  );
};

/**
 * THE WORD RE-SET (SCRIPT.md b11, the graft from "demo") — ONE choreographed move, rebuilt after build B's critics
 * ("orphan words floating, an empty highlighted box, 'we're        closed' with a wide gap, the sentence held 6 frames")
 * and after the 4K viewer review ("the kept words wait at 40 % grey in their final slots: mid-sentence the caption reads
 * 'We are! Saturday from / nine till    Sunday / closed' — a wrong sentence"):
 *
 *   page     the swept lines stay on the page (call/Page.tsx): from CALL_LOCAL.drop the tokens she doesn't say
 *            (· 9:00–14:00 ·) leave up through their own masks and the sweep bands up out of theirs — no strip, no box
 *            outlives its words
 *   lift     on "We" (CALL_LOCAL.fly[0]) the page's PAPER recedes and fades out from under the kept words (stage.ts
 *            LIFT, call/Page.tsx): they stay where it set them, lifting a hair, drawn here from that frame on — polish
 *            round 2: flown straight off the page they crossed the white card's edge half on paper, half on the mesh,
 *            a staircase "We … Saturday / Sunday / closed"
 *   fly      once the paper has gone (LIFT.travel) every KEPT word (Saturday · Sunday · closed) glides TOGETHER over
 *            the bare ground — one eased path each, soft start, never two words on the same pixels (stage.ts
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
import { useLayout } from '../../../lib/layout';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, measureText, spaceWidth, useKitFaces, type ResetWord } from '../../kit';

/** the drift: soft start (it is lifted off the paper, not kicked), a long settle with no overshoot */
const FLY = Easing.bezier(0.36, 0, 0.12, 1);
/** a rising word's opacity from its rise progress: nothing until its x-height has entered the mask (≈ p .25) — so an
 *  i's dot or an apostrophe, the glyph tops that enter first, never shows alone — then quickly to full ink */
const REVEAL_OPACITY = (p: number) => smooth(0.25, 0.8, p);

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
  /** the frame the kept words are taken from the page (the paper starts to recede from under them) */
  lift: number;
  /** the page card's origin at rest (the kept words are set inside its translate, as the page sets them) */
  card: { x: number; y: number };
  /** the drift over the bare ground: [start, gone] */
  fly: readonly [number, number];
  /** how far the cluster goes toward her line (stage.ts `drift`): these fractions of the way from "Saturday" on the
   *  page to its slot in her sentence, per axis (x also sets how far it grows toward her size) — never far enough for
   *  the words to sit beside or over hers as a "We … Saturday / Sunday / closed" staircase: they dissolve on the way */
  reach: { x: number; y: number };
}> = ({ t, tokens, sourceSize, target, words, lift, card, fly, reach }) => {
  useKitFaces();
  const vertical = useLayout().vertical;
  // the page's line style (call/Page.tsx `title`)
  const pageType = typeStyle('title', vertical, { size: sourceSize, tabular: true });
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
  // the kept words' cluster: its centre (the page tokens' origins) and its drift — `reach` of the way from the first
  // kept word ("Saturday") on the page to its slot in her sentence
  const keptAt = L.words.map((_, i) => words[i]?.from).flatMap((f, i) => (f ? [{ tok: tokens[f[0]][f[1]], P: L.pos[i] }] : []));
  const cluster = {
    cx: keptAt.reduce((a, k) => a + k.tok.x, 0) / Math.max(1, keptAt.length),
    cy: keptAt.reduce((a, k) => a + k.tok.y, 0) / Math.max(1, keptAt.length),
    dx: keptAt.length ? reach.x * (keptAt[0].P.x - keptAt[0].tok.x) : 0,
    dy: keptAt.length ? reach.y * (keptAt[0].P.y + dyLand - keptAt[0].tok.y) : 0,
  };
  return (
    <>
      {L.words.map((word, i) => {
        const spec = words[i] ?? { at: Infinity };
        const k = keyOf(i);
        const ink = k ? mixHex(tColor, k.color, tween(t, [k.at, k.at + 18], [0, 1], EASE.house)) : tColor;
        const P = L.pos[i];
        if (spec.from && t < spec.at - 0.5) {
          const tok = tokens[spec.from[0]][spec.from[1]];
          if (t < lift || t >= fly[1]) return null;
          // set EXACTLY as the page sets it (call/Page.tsx: inside the card's translate, the token's mask box, the
          // title role at the page's size, on its sub-pixel layer) — the page stops drawing it on `lift` and nothing
          // moves by a pixel; the drift then carries that same layer (an equal matrix at its start: no re-raster tick)
          const g = FLY(Math.min(1, Math.max(0, (t - fly[0]) / D)));
          const lin = Math.min(1, Math.max(0, (t - fly[0]) / D));
          const drifting = t >= fly[0];
          // the cluster: one rigid group (about its centre), drifting toward her line and growing toward her size
          const s = mix(1, 1 / scaleK, reach.x * g);
          const ox = cluster.cx + (tok.x - cluster.cx) * s + cluster.dx * g - tok.x;
          const oy = cluster.cy + (tok.y - cluster.cy) * s + cluster.dy * g - tok.y;
          // ink: the page's foreground → her ink as it drifts; it dissolves on the way (gone by the drift's end)
          const opacity = 1 - smooth(0.22, 0.96, lin);
          return (
            <div key={`t${i}`} style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${card.x.toFixed(3)}px, ${card.y.toFixed(3)}px)` }}>
              <div style={{ position: 'absolute', left: tok.x - card.x, top: tok.y - card.y, ...maskBox(0), overflow: 'visible', opacity: opacity < 0.999 ? opacity : undefined }}>
                <span
                  style={{
                    display: 'inline-block',
                    transformOrigin: drifting ? '0 0' : '50% 85%',
                    ...subpixel(drifting ? `translate(${ox.toFixed(3)}px, ${oy.toFixed(3)}px) scale(${s.toFixed(5)})` : 'translateY(0.000%)', true),
                    ...pageType,
                    letterSpacing: '-0.02em',
                    color: drifting ? mixHex(APP.foreground, ink, g) : APP.foreground,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tok.text}
                </span>
              </div>
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

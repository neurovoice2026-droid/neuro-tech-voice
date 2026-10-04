/**
 * THE WORD RE-SET (SCRIPT.md b11, the graft from "demo") — ONE choreographed move, rebuilt after build B's critics
 * ("orphan words floating, an empty highlighted box, 'we're        closed' with a wide gap, the sentence held 6 frames"):
 *
 *   page     the swept lines stay on the page (call/Page.tsx): from CALL_LOCAL.drop the tokens she doesn't say
 *            (· 9:00–14:00 ·) leave up through their own masks and the sweep bands up out of theirs — no strip, no box
 *            outlives its words
 *   fly      on "We" (CALL_LOCAL.fly) every KEPT word (Saturday · Sunday · closed) takes off from its place on the page
 *            TOGETHER and glides — one eased path each, soft start, long settle, never two words on the same pixels
 *            (stage.ts `flights`) — straight into its pen position in her sentence, growing from the page's size to
 *            the caption's by transform (the glyphs are set once, at the caption size; the weight eases 480 → 460 on
 *            the variable face). Nothing parks, nothing is ever alone in transit; all three have landed long before
 *            "Saturday" is said, and wait there at 40 % ink
 *   onsets   on each word's moment (CALL_LOCAL.reset: its onset − 2, captions' lead) her own words rise into their
 *            slots, a kept word takes full ink ("Sunday" its "s," and "closed" its "." rising in) — the sentence never
 *            shows a hole where she has already spoken, and every word lands before it is heard; "nine till two." takes
 *            the sunday key with "nine"
 *
 * The result IS her caption: "We are! Saturday from nine till two. Sundays, we're closed." (caption role, ink).
 */
import React from 'react';
import { Easing } from 'remotion';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { EASE, mix, mixHex, SPRING, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, measureText, spaceWidth, useKitFaces, type ResetWord } from '../../kit';

/** a flight: soft start (it is lifted off the page, not kicked), decisive, a long settle with no overshoot */
const FLY = Easing.bezier(0.36, 0, 0.12, 1);
/** a kept word's ink while it waits for its onset in her sentence */
const WAIT = 0.4;

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
        if (spec.from) {
          const kind = flights[keptIndex++] ?? 'g';
          const tok = tokens[spec.from[0]][spec.from[1]];
          if (t < fly[0]) return null;
          const g = FLY(Math.min(1, Math.max(0, (t - fly[0]) / D)));
          const lead = FLY(Math.min(1, Math.max(0, (t - fly[0]) / (0.65 * D))));
          const trail = FLY(Math.min(1, Math.max(0, (t - fly[0] - 0.2 * D) / (0.8 * D))));
          const ux = kind === 'g' ? g : kind === 'xy' ? lead : trail;
          const uy = kind === 'g' ? g : kind === 'yx' ? lead : trail;
          const gx = mix(tok.x, P.x, ux);
          const gy = mix(tok.y, P.y + dyLand, uy);
          const sc = mix(scaleK, 1, g);
          const weight = mix(TYPE.title.weight, TYPE.caption.weight, g);
          const keep = tok.text;
          const prefix = word.startsWith(keep) ? keep : word;
          const suffix = word.startsWith(keep) ? word.slice(keep.length) : '';
          // the letters it gains rise in on its own moment (it has long landed by then)
          const suf = suffix ? reveal(t, spec.at, { config: SPRING.caption, rise: 90 }) : null;
          // ink: the page's foreground → her ink as it flies; it waits at 40 % and takes full ink on its moment
          const onAt = tween(t, [spec.at, spec.at + 4], [0, 1], EASE.out3);
          const opacity = mix(mix(1, WAIT, g), 1, onAt);
          const flying = t < fly[1] + 0.5;
          return (
            <span
              key={`t${i}`}
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
                // on its own layer while it flies; at rest it drops back to pixel-crisp
                ...subpixel(`translate(${gx.toFixed(3)}px, ${gy.toFixed(3)}px) scale(${sc.toFixed(5)})`, flying),
              }}
            >
              {prefix}
              {suffix ? (
                <span style={maskBox(0)}>
                  <span style={revealStyle(suf!, undefined, t - spec.at < 20)}>{suffix}</span>
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

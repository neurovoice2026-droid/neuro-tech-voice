/**
 * THE FIELD — TabConversation.tsx's Textarea for "When the answer isn't in your documents" (rows 2, resize-none): the
 * product's default line as grey placeholder (lib/voice/prompt.ts:39), then the owner's own line typed over it.
 * The kit's FieldCard field (kit/ui.tsx), set into the agent page instead of a card of its own:
 *
 *   focus     on the press (mousedown): border → ring colour, the app's ring-3 ring-ring/50; the caret appears
 *   typing    ONE WORD PER 16th (LINE_LOCAL.keys), each rising into its own mask on the caption spring (no blur); the
 *             placeholder clears on the first word, as a real field does; the caret glides to the end of each new word,
 *             solid while typing, blinking on the beat when idle
 *   blur      on the press of Save changes (focus moves to the button): the ring and the caret go
 *   accent    "in the words you chose": a sunday ring closes in round the field from 10 px out on a soft spring and
 *             settles (SCRIPT.md b12's focus ring) — Ava's mark, drawn as a box-shadow ring, crisp
 *
 * Every word sits at its measured pen position (kit/type.ts layoutWords): nothing reflows as the line grows.
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { subpixel } from '../../../lib/glide';
import { mixColor } from '../../../lib/lights';
import { EASE, smooth, SPRING, springUnit } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { TYPE } from '../../../theme';
import { APP, CURSOR, fold, layoutWords } from '../../kit';

export const PLACEHOLDER_INK = '#a29bb4';

export type FieldGeo = {
  /** the field's box (frame px) */
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  lineH: number;
  padX: number;
  padY: number;
  radius: number;
  /** the owner's words by row, and the placeholder's rows */
  lines: string[][];
  placeholderLines: string[][];
};

export const fieldSpec = (size: number) => ({ size, weight: TYPE.title.weight, tracking: -0.02 });

const hexRgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
};

export const Field: React.FC<{
  g: FieldGeo;
  t: number;
  keys: readonly number[];
  focusAt: number;
  blurAt: number;
  accent: { at: number; color: string };
  vertical: boolean;
}> = ({ g, t, keys, focusAt, blurAt, accent, vertical }) => {
  const words = g.lines.flat();
  const typeAt = keys[0];
  const lastAt = keys[keys.length - 1];
  const step = keys.length > 1 ? keys[1] - keys[0] : 3.75;
  let typed = 0;
  for (const k of keys) if (k <= t + 1e-6) typed++;
  typed = Math.min(typed, words.length);
  const spec = fieldSpec(g.size);
  // word boxes (relative to the text origin)
  let wi = 0;
  const flat = g.lines.flatMap((line, li) => layoutWords(line.join(' '), spec).words.map((w) => ({ ...w, line: li, i: wi++ })));
  // the caret: after the last typed word (gliding there as the word rises), or at the start
  const caretPos = (n: number) => (n <= 0 ? { x: 0, line: 0 } : { x: flat[n - 1].x + flat[n - 1].w + 0.07 * g.size, line: flat[n - 1].line });
  let caret = caretPos(typed);
  if (typed > 0 && t < lastAt + step) {
    const since = t - keys[typed - 1];
    const prev = caretPos(typed - 1);
    const u = EASE.out3(Math.min(1, since / 2.2));
    if (prev.line === caret.line) caret = { x: prev.x + (caret.x - prev.x) * u, line: caret.line };
  }
  const focus = fold(
    [
      { at: focusAt, to: 1, dur: CURSOR.hoverDur },
      { at: blurAt, to: 0, dur: 6 },
    ],
    0,
    t,
  );
  const caretOn = t >= focusAt && t < blurAt;
  const typing = t >= typeAt - 0.5 && t < lastAt + 8;
  const idleFrom = t < typeAt ? focusAt : lastAt + 8;
  const blink = typing
    ? 1
    : (() => {
        const ph = (((t - idleFrom) % 30) + 30) % 30;
        return ph < 15 ? smooth(0, 1.5, ph) : 1 - smooth(15, 16.5, ph);
      })();
  const caretFade = caretOn ? 1 : 0;
  const placeholderO = 1 - smooth(typeAt - 0.5, typeAt + 1.5, t);
  const a = t >= accent.at ? springUnit(t - accent.at, { stiffness: 140, damping: 18, mass: 1 }) : 0;
  const ringW = 3.4;
  const textTop = (li: number) => g.padY + li * g.lineH + (g.lineH - g.size * 1.12) / 2;
  const base = typeStyle('title', vertical, { size: g.size });
  return (
    <div
      style={{
        position: 'absolute',
        left: g.x,
        top: g.y,
        width: g.w,
        height: g.h,
        borderRadius: g.radius,
        background: APP.background,
        boxShadow: [
          `inset 0 0 0 1.4px ${mixColor(APP.border, APP.primary, focus)}`,
          focus > 0.001 ? `0 0 0 4px rgba(124, 58, 237, ${(0.2 * focus).toFixed(3)})` : '',
          a > 0.001 ? `0 0 0 ${(ringW + (1 - Math.min(1, a)) * 10).toFixed(3)}px rgb(${hexRgb(accent.color)} / ${(0.92 * Math.min(1, a * 1.5)).toFixed(3)})` : '',
        ]
          .filter(Boolean)
          .join(', '),
      }}
    >
      {placeholderO > 0.001 ? (
        <div style={{ position: 'absolute', left: g.padX, top: 0, opacity: placeholderO >= 0.999 ? undefined : placeholderO }}>
          {g.placeholderLines.map((ln, li) => (
            <div key={li} style={{ position: 'absolute', left: 0, top: textTop(li), ...base, letterSpacing: '-0.02em', lineHeight: 1.12, color: PLACEHOLDER_INK, whiteSpace: 'nowrap' }}>
              {ln.join(' ')}
            </div>
          ))}
        </div>
      ) : null}
      {flat.map((w) => {
        const at = keys[w.i];
        if (at === undefined || t < at - 0.5) return null;
        const rv = reveal(t, at, { config: SPRING.caption, rise: 70, fade: 0.5 });
        return (
          <span key={w.i} style={{ position: 'absolute', left: g.padX + w.x, top: textTop(w.line), ...maskBox(0), ...base, letterSpacing: '-0.02em', lineHeight: 1.12, color: APP.foreground }}>
            <span style={revealStyle(rv, undefined, t - at < 14)}>{w.text}</span>
          </span>
        );
      })}
      {caretFade > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: Math.max(2.5, 0.055 * g.size),
            height: g.size * 1.1,
            borderRadius: 1,
            background: APP.foreground,
            opacity: blink,
            ...subpixel(`translate(${(g.padX + caret.x).toFixed(3)}px, ${(g.padY + caret.line * g.lineH + (g.lineH - g.size * 1.1) / 2).toFixed(3)}px)`, typing),
          }}
        />
      ) : null}
    </div>
  );
};

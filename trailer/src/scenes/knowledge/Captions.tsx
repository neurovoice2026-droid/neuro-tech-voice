/**
 * Live captions, word-synced to a REAL voice line (voice.generated.ts).
 *
 * Caption c starts on its first spoken word; word j is revealed on spoken
 * word `map[j]` (else `word + j`), 2 f early (word times are estimates),
 * with the site's word entrance — opacity 0, yPercent 16, blur 3 → 0 —
 * on the site spring. The word being spoken is at 100 %, the words already
 * spoken settle to 86 %, and a finished caption comes back to 100 %.
 *
 * Echo row (optional): when the next caption starts, the previous one
 * glides up into the echo row (smaller, dimmer) and stays ≥ 20 f, so every
 * caption is on screen while it is spoken and a beat after, even when the
 * voice leaves only 6–12 f between phrases.
 */
import React from 'react';
import { aos, EASE, mix, springAt, SPRING, tween } from '../../lib/motion';
import { vWord, type Caption } from '../../timing';
import type { VoiceId } from '../../voice.generated';
import { textWidth } from './measure';
import { wordEnd } from './voice';

const EARLY = 2;
const ECHO_HOLD = 20;
const ECHO_FADE = 8;
const ECHO = { scale: 0.8, opacity: 0.42 };
const SPOKEN = 0.86;

export type CaptionFont = { family: string; size: number; weight: number; italic?: boolean; lh: number; color: string };

export const Captions: React.FC<{
  t: number;
  /** scene-local frame the voice line starts */
  lineAt: number;
  voice: VoiceId;
  captions: readonly Caption[];
  font: CaptionFont;
  box: { x: number; w: number; align: 'left' | 'right' | 'center' };
  /** centre of the live row's first line */
  rowY: number;
  /** centre of the echo row (its last line); omit for no echo */
  echoY?: number;
  /** everything leaves over this window (rise out + blur) */
  out?: readonly [number, number];
}> = ({ t, lineAt, voice, captions, font, box, rowY, echoY, out }) => {
  const lhPx = font.size * font.lh;
  const css = `${font.italic ? 'italic ' : ''}${font.weight} ${font.size}px ${font.family}`;
  const startOf = (c: Caption) => lineAt + vWord(voice, c.word) - EARLY;
  const outQ = out ? tween(t, out, [0, 1], EASE.in2) : 0;
  if (outQ >= 1) return null;

  return (
    <>
      {captions.map((c, ci) => {
        const s = startOf(c);
        if (t < s - 1) return null;
        const next = ci + 1 < captions.length ? startOf(captions[ci + 1]) : Infinity;
        const next2 = ci + 2 < captions.length ? startOf(captions[ci + 2]) : Infinity;

        // live → echo (or → gone, without an echo row)
        let dy = 0;
        let sc = 1;
        let op = 1;
        let blurC = 0;
        const n = Math.max(1, Math.ceil(textWidth(c.text, css, font.size) / (box.w * 0.985)));
        if (t >= next) {
          if (echoY === undefined) {
            const q = tween(t, [next, next + 4], [0, 1], EASE.in2);
            if (q >= 1) return null;
            op = 1 - q;
          } else {
            const e = aos(t, next, { anticip: 2, depth: 0.04, config: SPRING.site });
            const lastLineY = rowY + (n - 1) * lhPx;
            dy = (echoY - lastLineY) * Math.max(-0.1, e);
            sc = mix(1, ECHO.scale, Math.max(0, e));
            op = mix(1, ECHO.opacity, Math.min(1, Math.max(0, e)));
            const gone = Math.min(next + ECHO_HOLD, next2);
            const f = tween(t, [gone, gone + ECHO_FADE], [0, 1], EASE.in2);
            if (f >= 1) return null;
            op *= 1 - f;
            dy -= 14 * f;
            blurC = 3 * f;
          }
        }

        const words = c.text.split(' ');
        const lastK = c.map ? c.map[c.map.length - 1] : c.word + words.length - 1;
        const doneAt = lineAt + wordEnd(voice, lastK);
        const settle = tween(t, [doneAt + 4, doneAt + 14], [0, 1], EASE.inOut);

        const originX = box.align === 'center' ? '50%' : box.align === 'right' ? '100%' : '0%';
        return (
          <div
            key={ci}
            style={{
              position: 'absolute',
              left: box.x,
              top: rowY - lhPx / 2,
              width: box.w,
              fontFamily: font.family,
              fontWeight: font.weight,
              fontStyle: font.italic ? 'italic' : 'normal',
              fontSize: font.size,
              lineHeight: `${lhPx}px`,
              color: font.color,
              textAlign: box.align,
              textWrap: 'balance',
              transformOrigin: `${originX} ${((n - 0.5) * lhPx).toFixed(1)}px`,
              transform: `translateY(${(dy - outQ * 40).toFixed(2)}px) scale(${sc.toFixed(4)})`,
              opacity: op * (1 - outQ),
              filter: blurC + outQ * 5 > 0.05 ? `blur(${(blurC + outQ * 5).toFixed(2)}px)` : undefined,
            }}
          >
            {words.map((w, j) => {
              const k = c.map ? c.map[j] : c.word + j;
              const r = lineAt + vWord(voice, k) - EARLY;
              const e = lineAt + wordEnd(voice, k);
              const u = t - r;
              const sp = u < 0 ? 0 : springAt(t, r, SPRING.site);
              const o = tween(t, [r, r + 7], [0, 1], EASE.out3);
              const bl = u < 0 ? 3 : tween(t, [r, r + 9], [3, 0], EASE.out3);
              const past = tween(t, [e + 1, e + 6], [0, 1], EASE.out3);
              const bright = mix(1, SPOKEN, past * (1 - settle));
              return (
                <React.Fragment key={j}>
                  <span
                    style={{
                      display: 'inline-block',
                      transform: `translateY(${(16 * (1 - sp)).toFixed(2)}%)`,
                      opacity: o * bright,
                      filter: bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : undefined,
                    }}
                  >
                    {w}
                  </span>
                  {j < words.length - 1 ? ' ' : null}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

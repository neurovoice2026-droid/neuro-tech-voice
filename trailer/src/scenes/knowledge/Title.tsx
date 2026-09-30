/**
 * Section display type (Instrument Sans 460, −0.03em — the homepage's
 * .pp-display) with the hero's word-mask rise: each word rises 115 % → 0
 * out of its own mask on the site spring (anticipation dip, one small
 * overshoot), blurs in 3 px → 0 and smears with its own speed; the key
 * phrase eases ink → violet afterwards (home.css key-phrase idiom). An
 * optional exit flicks the words up out of their masks (EASE.in2 + blur).
 */
import React from 'react';
import { aos, EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';

export type TitleProps = {
  t: number;
  /** explicit lines, or null to wrap `text` (balanced) inside `width` */
  lines: string[] | null;
  text: string;
  size: number;
  width: number;
  cx: number;
  cy: number;
  start: number;
  stagger: number;
  keyPhrase?: { text: string; at: number; color?: string };
  exit?: { at: number; stagger: number; dur: number };
  color?: string;
};

const LH = 1.04;

export const Title: React.FC<TitleProps> = ({
  t,
  lines,
  text,
  size,
  width,
  cx,
  cy,
  start,
  stagger,
  keyPhrase,
  exit,
  color = C.ink,
}) => {
  const rows = lines ?? [text];
  const all = rows.flatMap((r) => r.split(' '));
  // which words belong to the key phrase (last occurrence)
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
  const keyMix = keyPhrase ? tween(t, [keyPhrase.at, keyPhrase.at + 18], [0, 1], EASE.house) : 0;

  let n = 0;
  const word = (w: string, last: boolean) => {
    const i = n++;
    const s = start + i * stagger;
    const p = aos(t, s, { anticip: 3, depth: 0.05, config: SPRING.site });
    const pp = aos(t - 1, s, { anticip: 3, depth: 0.05, config: SPRING.site });
    let y = (1 - p) * 115;
    let speed = Math.abs(p - pp) * 115;
    let blur = tween(t, [s, s + 12], [3, 0], EASE.house);
    if (exit) {
      const e = exit.at + i * exit.stagger;
      const q = tween(t, [e, e + exit.dur], [0, 1], EASE.in2);
      const qp = tween(t - 1, [e, e + exit.dur], [0, 1], EASE.in2);
      y -= 110 * q;
      speed += Math.abs(q - qp) * 110;
      blur += 4 * q;
    }
    blur += Math.min(10, speed * (size / 100) * 0.09);
    const col = keyIdx.has(i) ? mixHex(color, keyPhrase?.color ?? C.violet, keyMix) : color;
    return (
      <span
        key={i}
        style={{
          display: 'inline-block',
          overflow: 'hidden',
          verticalAlign: 'top',
          paddingBottom: '0.16em',
          marginBottom: '-0.16em',
          paddingRight: last ? 0 : '0.24em',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transform: `translateY(${y.toFixed(2)}%)`,
            color: col,
            filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
          }}
        >
          {w}
        </span>
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - width / 2,
        top: cy,
        width,
        transform: 'translateY(-50%)',
        fontFamily: FONT.ui,
        fontWeight: 460,
        fontSize: size,
        letterSpacing: TRACK.section,
        lineHeight: LH,
        textAlign: 'center',
        color,
        textWrap: 'balance',
      }}
    >
      {rows.map((r, li) => {
        const ws = r.split(' ');
        return (
          <div key={li} style={{ whiteSpace: lines ? 'nowrap' : undefined }}>
            {ws.map((w, k) => word(w, k === ws.length - 1))}
          </div>
        );
      })}
    </div>
  );
};

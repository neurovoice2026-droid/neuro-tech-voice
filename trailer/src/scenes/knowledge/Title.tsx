/**
 * Section display type — set exactly like the knowledge heading the client
 * chose as THE look (theme.ts TYPE: Instrument Sans 460, −0.03em, sentence
 * case, the key phrase in the scene's accent ink), and revealed by MOTION:
 * each word rises out of its own clipping box on the text spring (opacity up
 * over the first half of the travel), never by blur. The key phrase eases
 * ink → sunday ink, and on that frame a glint of light (a brighter teal) runs
 * through it word by word — colour moving through the type, nothing smeared.
 * An optional exit lifts the words up out of their masks (power3.in, a small
 * stagger).
 */
import React from 'react';
import { reveal, revealStyle } from '../../components/Type';
import { mixColor } from '../../lib/lights';
import { EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { C, type TypeRole } from '../../theme';

export type TitleProps = {
  t: number;
  /** explicit lines (each kept on one row), or null to wrap `text` (balanced) inside `width` */
  lines: string[] | null;
  text: string;
  /** the TYPE role (headline: the heading; display: the closing) */
  role: TypeRole;
  vertical: boolean;
  /** px (overrides the role's size) */
  size: number;
  width: number;
  cx: number;
  cy: number;
  start: number;
  stagger: number;
  /** the key phrase: its colour, and the glint's (brighter) colour running through it on the hit */
  keyPhrase?: { text: string; at: number; color: string; glint?: string };
  exit?: { at: number; stagger: number; dur: number };
  color?: string;
};

export const Title: React.FC<TitleProps> = ({
  t,
  lines,
  text,
  role,
  vertical,
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
  const rows = (lines ?? [text]).map((r) => r.split(' '));
  const all = rows.flat();
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
  const keyList = [...keyIdx].sort((a, b) => a - b);
  // the glint runs through the key words (in word units) right after the hit
  const glintPos = keyPhrase ? tween(t, [keyPhrase.at, keyPhrase.at + 14], [-1, keyList.length], EASE.inOut) : -9;
  const glintOn = keyPhrase?.glint !== undefined && t >= keyPhrase.at && t <= keyPhrase.at + 14;

  let n = 0;
  const word = (w: string, last: boolean) => {
    const i = n++;
    const s = start + i * stagger;
    const r = reveal(t, s, {
      config: SPRING.text,
      rise: 100,
      fade: 0.55,
      exit: exit ? { at: exit.at + i * exit.stagger, dur: exit.dur } : undefined,
    });
    const isKey = keyIdx.has(i);
    let col = isKey && keyPhrase ? mixHex(color, keyPhrase.color, keyMix) : color;
    if (isKey && keyPhrase?.glint && glintOn) {
      const j = keyList.indexOf(i);
      const k = Math.exp(-(((j - glintPos) / 0.7) ** 2));
      if (k > 0.02) col = mixColor(col, keyPhrase.glint, 0.6 * k);
    }
    return (
      <span key={i} style={maskBox(last ? 0 : 0.24)}>
        <span style={{ ...revealStyle(r), color: col }}>{w}</span>
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
        ...typeStyle(role, vertical, { tone: 'paper', size }),
        textAlign: 'center',
        color,
        textWrap: 'balance',
      }}
    >
      {rows.map((ws, li) => (
        <div key={li} style={{ whiteSpace: lines ? 'nowrap' : undefined }}>
          {ws.map((w, k) => word(w, k === ws.length - 1))}
        </div>
      ))}
    </div>
  );
};

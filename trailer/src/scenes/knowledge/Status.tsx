/**
 * The status pill (knowledge-stage.tsx top row): white, fully rounded,
 * the 7 % ring, a live dot and one of three words. It pops in "Listening",
 * then tracks the reader — "Looking through 5 documents" (the plum dot
 * pulses 1.6× three times), "Not in the documents" (dot goes grey). Each
 * change is the site's: the box tweens to the new words' width while the
 * old words slide out and the new ones slide in (never two at once).
 */
import React from 'react';
import { aos, EASE, SPRING, tween } from '../../lib/motion';
import { C, FONT } from '../../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { DOT, STATUS_TEXT, type Geo, type StatusKey } from './geometry';
import { textWidth } from './measure';
import { readPulse } from './voice';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

const STEPS: { at: number; key: StatusKey }[] = [
  { at: -Infinity, key: 'listening' },
  { at: K.scan[0], key: 'reading' },
  { at: K.miss, key: 'missing' },
];

/** rgba()/hex → [r,g,b,a] */
function rgba(c: string): [number, number, number, number] {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/[\d.]+/g)!.map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
}
const mixRgba = (a: string, b: string, k: number) => {
  const A = rgba(a);
  const B = rgba(b);
  const m = A.map((v, i) => v + (B[i] - v) * k);
  return `rgba(${m[0].toFixed(0)},${m[1].toFixed(0)},${m[2].toFixed(0)},${m[3].toFixed(3)})`;
};

export const Status: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const T = G.top;
  const font = `500 ${T.pillText}px ${FONT.body}`;
  // (+6: canvas metrics run a hair short of the DOM's; the last glyph must never clip)
  const w = (k: StatusKey) => Math.ceil(textWidth(STATUS_TEXT[k], font, T.pillText, -0.005)) + 6;

  // which change is in flight
  let idx = 0;
  for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i].at) idx = i;
  const cur = STEPS[idx];
  const prev = idx > 0 ? STEPS[idx - 1] : null;

  const boxW = prev ? tween(t, [cur.at, cur.at + 9], [w(prev.key), w(cur.key)], EASE.inOut) : w(cur.key);
  // the dot changes colour with the words
  const dotCol = prev ? mixRgba(DOT[prev.key], DOT[cur.key], tween(t, [cur.at + 1, cur.at + 7], [0, 1], EASE.out3)) : DOT[cur.key];
  const pulse = readPulse(t);
  const dotS = 1 + 0.6 * pulse;

  // pop in (SPRING.pop, from its right edge)
  const pop = aos(t, KL.statusIn, { anticip: 2, depth: 0.1, config: SPRING.pop });
  if (pop <= 0 && t < KL.statusIn) return null;

  const pad = 24;
  const dot = 12;
  const gap = 12;
  const width = pad + dot + gap + boxW + pad;

  // out, then in, in the same place (the site: two labels crossing at once read as neither)
  const outQ = prev ? tween(t, [cur.at, cur.at + 4], [0, 1], EASE.in2) : 1;
  const inQ = prev ? tween(t, [cur.at + 3, cur.at + 9], [0, 1], EASE.out3) : 1;
  const words = (k: StatusKey, y: number, o: number, blur: number) => (
    <span
      key={k}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        whiteSpace: 'nowrap',
        transform: `translateY(${y.toFixed(2)}%)`,
        opacity: o,
        filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      {STATUS_TEXT[k]}
    </span>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: T.pillRight - width,
        top: T.y - T.pillH / 2,
        width,
        height: T.pillH,
        borderRadius: 9999,
        background: C.white,
        boxShadow: `0 0 0 1px rgba(24,16,40,0.07), 0 10px 24px -18px rgba(24,16,40,${(0.35 * Math.min(1, pop)).toFixed(3)})`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: pad,
        gap,
        transformOrigin: '100% 50%',
        transform: `scale(${(0.6 + 0.4 * pop).toFixed(4)})`,
        opacity: Math.min(1, Math.max(0, pop * 1.6)),
        fontFamily: FONT.body,
        fontWeight: 500,
        fontSize: T.pillText,
        letterSpacing: '-0.005em',
        color: C.ink,
      }}
    >
      <span style={{ position: 'relative', width: dot, height: dot, flex: 'none' }}>
        {/* a ripple off each reading pulse */}
        {pulse > 0.01 ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              boxShadow: `0 0 0 ${(2 + 7 * pulse).toFixed(2)}px rgba(85,26,137,${(0.16 * pulse).toFixed(3)})`,
            }}
          />
        ) : null}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: dotCol,
            transform: `scale(${dotS.toFixed(4)})`,
          }}
        />
      </span>
      <span
        style={{
          position: 'relative',
          width: boxW,
          height: T.pillText * 1.3,
          lineHeight: `${T.pillText * 1.3}px`,
          overflow: 'hidden',
        }}
      >
        {prev && outQ < 1 ? words(prev.key, -80 * outQ, 1 - outQ, 3 * Math.sin(Math.PI * outQ)) : null}
        {words(cur.key, prev ? 80 * (1 - inQ) : 0, prev ? Math.min(1, inQ * 1.4) : 1, prev ? 2.5 * (1 - inQ) : 0)}
      </span>
    </div>
  );
};


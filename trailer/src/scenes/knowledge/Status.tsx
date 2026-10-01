/**
 * The status pill (knowledge-stage.tsx top row): white, fully rounded, a
 * layered shadow, a live dot and one of three phrases in the scene's type
 * (Instrument Sans 480). It tracks the reader — "Listening", "Looking
 * through 5 documents" (the sunday-ink dot pulses three times), "Not in the
 * documents" (the dot goes grey and the pill shakes "no"). Each change is
 * the site's: the box tweens to the new words' width while the old words
 * leave up through the pill's mask and the new ones rise into it (never two
 * at once, never blurred) — plus a small bump ON the change.
 *
 * Entrance (statusIn): the capsule opens out of its dot on a soft spring.
 */
import React from 'react';
import { subpixel } from '../../components/Type';
import { rgba } from '../../lib/lights';
import { EASE, springUnit, tween } from '../../lib/motion';
import { C, elevation, FONT } from '../../theme';
import { KNOWLEDGE_LOCAL } from '../../timing';
import { DOT, INK, STATUS_TEXT, type Geo, type StatusKey } from './geometry';
import { textWidth } from './measure';
import { readPulse } from './voice';

const KL = KNOWLEDGE_LOCAL;

const STEPS: { at: number; key: StatusKey }[] = [
  { at: -Infinity, key: 'listening' },
  { at: KL.scanFlip, key: 'reading' },
  { at: KL.missFlip, key: 'missing' },
];

/** ζ ≈ .71: one soft ~4 % overshoot — a chip opens, it does not bounce */
export const CHIP_POP = { stiffness: 320, damping: 24, mass: 0.9 };
/** the pill's phrase: Instrument Sans 480, a hair tight */
const PILL_WEIGHT = 480;
const PILL_TRACK = -0.01;

const PAD = 24;
const DOTD = 12;
const GAP = 12;

/** rgba()/hex → [r,g,b,a] */
function parse(c: string): [number, number, number, number] {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/[\d.]+/g)!.map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
}
const mixRgba = (a: string, b: string, k: number) => {
  const A = parse(a);
  const B = parse(b);
  const m = A.map((v, i) => v + (B[i] - v) * k);
  return `rgba(${m[0].toFixed(0)},${m[1].toFixed(0)},${m[2].toFixed(0)},${m[3].toFixed(3)})`;
};

/** which change is in flight at t */
function stepAt(t: number) {
  let idx = 0;
  for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i].at) idx = i;
  return { cur: STEPS[idx], prev: idx > 0 ? STEPS[idx - 1] : null };
}

/** the words' box width for a status (canvas metrics; +6 so the last glyph never clips) */
function wordsW(G: Geo, k: StatusKey) {
  const T = G.top;
  return Math.ceil(textWidth(STATUS_TEXT[k], `${PILL_WEIGHT} ${T.pillText}px ${FONT.ui}`, T.pillText, PILL_TRACK)) + 6;
}

/** the pill's words box at t (tweens 9 f on each change) */
function boxWAt(t: number, G: Geo) {
  const { cur, prev } = stepAt(t);
  return prev ? tween(t, [cur.at, cur.at + 9], [wordsW(G, prev.key), wordsW(G, cur.key)], EASE.inOut) : wordsW(G, cur.key);
}

/** the pill's full width at t */
export const pillWidthAt = (t: number, G: Geo) => PAD + DOTD + GAP + boxWAt(t, G) + PAD;

/** the pill's entrance: 0 → ~1.04 → 1 (spring, released a frame before statusIn so it is opening ON it) */
export const pillPopAt = (t: number) => springUnit(t - (KL.statusIn - 1), CHIP_POP);

/** the "no": a damped horizontal shake after the miss flip (px) */
export function shakeAt(t: number) {
  const [a, b] = KL.shake;
  if (t <= a || t >= b) return 0;
  const u = (t - a) / (b - a);
  return 5 * Math.sin(u * Math.PI * 3) * Math.exp(-2.4 * u);
}

/** a small bump on each change: 1 → 1.025 → 1 (a sine over 10 f, eased in) */
function bumpAt(t: number) {
  let s = 1;
  for (const at of [KL.scanFlip, KL.missFlip]) {
    if (t >= at && t < at + 10) s *= 1 + 0.025 * Math.sin(((t - at) / 10) * Math.PI) * Math.min(1, (t - at) / 2);
  }
  return s;
}

export const Status: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const T = G.top;
  if (t < KL.statusIn - 1) return null;
  const { cur, prev } = stepAt(t);
  const boxW = boxWAt(t, G);
  const width = pillWidthAt(t, G);

  // the dot changes colour with the words
  const dotCol = prev ? mixRgba(DOT[prev.key], DOT[cur.key], tween(t, [cur.at + 1, cur.at + 7], [0, 1], EASE.out3)) : DOT[cur.key];
  const pulse = readPulse(t);

  // entrance: the capsule opens out of its dot (.82 → 1 about the dot, on a soft spring)
  const pop = pillPopAt(t);
  const capS = 0.82 + 0.18 * pop;
  const capO = Math.min(1, Math.max(0, pop * 1.8));
  const dotS = 1 + 0.45 * pulse;

  // out, then in, in the same place (the site: two labels crossing at once read as neither)
  const outQ = prev ? tween(t, [cur.at, cur.at + 4], [0, 1], EASE.in3) : 1;
  const inQ = prev ? tween(t, [cur.at + 3, cur.at + 10], [0, 1], EASE.out3) : 1;
  const words = (k: StatusKey, y: number, o: number) => (
    <span
      key={k}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        whiteSpace: 'nowrap',
        opacity: o,
        ...subpixel(Math.abs(y) > 0.01 ? `translateY(${y.toFixed(3)}%)` : undefined, Math.abs(y) > 0.01),
      }}
    >
      {STATUS_TEXT[k]}
    </span>
  );

  const shake = shakeAt(t);
  const bump = bumpAt(t);
  const left = T.pillRight - width;
  const moving = Math.abs(1 - pop) > 2e-4 || Math.abs(shake) > 0.01 || bump !== 1;
  const tf = `translateX(${shake.toFixed(3)}px) scale(${(capS * bump).toFixed(5)})`;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: T.y - T.pillH / 2,
        width,
        height: T.pillH,
        borderRadius: 9999,
        background: C.white,
        boxShadow: elevation(0.6, 0.9),
        display: 'flex',
        alignItems: 'center',
        paddingLeft: PAD,
        gap: GAP,
        transformOrigin: `${PAD + DOTD / 2}px 50%`,
        ...subpixel(tf, moving),
        opacity: capO,
        fontFamily: FONT.ui,
        fontWeight: PILL_WEIGHT,
        fontSize: T.pillText,
        letterSpacing: `${PILL_TRACK}em`,
        color: C.ink,
      }}
    >
      <span style={{ position: 'relative', width: DOTD, height: DOTD, flex: 'none' }}>
        {/* a soft ripple off each reading pulse */}
        {pulse > 0.01 ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              boxShadow: `0 0 0 ${(2 + 6 * pulse).toFixed(2)}px ${rgba(INK, 0.14 * pulse)}`,
            }}
          />
        ) : null}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: dotCol,
            transform: dotS !== 1 ? `scale(${dotS.toFixed(4)})` : undefined,
          }}
        />
      </span>
      <span
        style={{
          position: 'relative',
          width: boxW,
          height: T.pillText * 1.4,
          lineHeight: `${T.pillText * 1.4}px`,
          overflow: 'hidden',
        }}
      >
        {prev && outQ < 1 ? words(prev.key, -100 * outQ, 1 - outQ) : null}
        {words(cur.key, prev ? 100 * (1 - inQ) : 0, prev ? Math.min(1, inQ * 1.6) : 1)}
      </span>
    </div>
  );
};

/** where the status pill's left edge is at t (for the moment tag that rides it) */
export const pillLeftAt = (t: number, G: Geo) => G.top.pillRight - pillWidthAt(t, G);

/**
 * The status pill (knowledge-stage.tsx top row): white, fully rounded,
 * the 7 % ring, a live dot and one of three words. It tracks the reader —
 * "Listening", "Looking through 5 documents" (the sunday-ink dot pulses
 * 1.6× three times), "Not in the documents" (the dot goes grey and the pill
 * shakes "no"). Each change is the site's: the box tweens to the new
 * words' width while the old words slide out and the new ones slide in
 * (never two at once) — plus a bump (a 2 f dip, then 1.05 → 1) and a ring
 * off the dot ON the change.
 *
 * Entrance (statusIn): a 2 f inhale of the dot alone, then the capsule
 * springs out of it (.5 → 1.12 → 1, about the dot), a ring leaves the
 * capsule and the dot flashes.
 */
import React from 'react';
import { spring } from 'remotion';
import { mixColor, rgba } from '../../lib/lights';
import { EASE, tween } from '../../lib/motion';
import { C, FONT } from '../../theme';
import { FPS, KNOWLEDGE_LOCAL } from '../../timing';
import { flashAt } from './blur';
import { DOT, INK, STATUS_TEXT, SUN, type Geo, type StatusKey } from './geometry';
import { textWidth } from './measure';
import { readPulse } from './voice';

const KL = KNOWLEDGE_LOCAL;

const STEPS: { at: number; key: StatusKey }[] = [
  { at: -Infinity, key: 'listening' },
  { at: KL.scanFlip, key: 'reading' },
  { at: KL.missFlip, key: 'missing' },
];

/** ζ ≈ .42: one ~23 % overshoot, so .5 → 1.12 → 1 */
export const CHIP_POP = { stiffness: 400, damping: 15, mass: 0.8 };

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
  return Math.ceil(textWidth(STATUS_TEXT[k], `500 ${T.pillText}px ${FONT.body}`, T.pillText, -0.005)) + 6;
}

/** the pill's words box at t (tweens 9 f on each change) */
function boxWAt(t: number, G: Geo) {
  const { cur, prev } = stepAt(t);
  return prev ? tween(t, [cur.at, cur.at + 9], [wordsW(G, prev.key), wordsW(G, cur.key)], EASE.inOut) : wordsW(G, cur.key);
}

/** the pill's full width at t */
export const pillWidthAt = (t: number, G: Geo) => PAD + DOTD + GAP + boxWAt(t, G) + PAD;

/** the pill's entrance: 0 → ~1.23 → 1 (spring), 0 before statusIn */
export const pillPopAt = (t: number) => (t < KL.statusIn ? 0 : spring({ frame: t - KL.statusIn, fps: FPS, config: CHIP_POP }));

/** the "no": a damped horizontal shake after the miss flip (px) */
export function shakeAt(t: number) {
  const [a, b] = KL.shake;
  if (t <= a || t >= b) return 0;
  const u = (t - a) / (b - a);
  return 7 * Math.sin(u * Math.PI * 3) * Math.exp(-2.4 * u);
}

/** a bump on each change: a 2 f dip (anticipation), then 1.05 → 1 */
function bumpAt(t: number) {
  let s = 1;
  for (const at of [KL.scanFlip, KL.missFlip]) {
    if (t >= at - 2 && t < at) s *= 1 - 0.03 * Math.sin(((t - (at - 2)) / 2) * (Math.PI / 2));
    else if (t >= at) {
      const p = spring({ frame: t - at, fps: FPS, config: CHIP_POP });
      s *= 1 + 0.05 * Math.max(0, Math.sin(Math.min(1, (t - at) / 10) * Math.PI)) * Math.min(1, p);
    }
  }
  return s;
}

export const Status: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const T = G.top;
  if (t < KL.statusIn - 2) return null;
  const { cur, prev } = stepAt(t);
  const boxW = boxWAt(t, G);
  const width = pillWidthAt(t, G);

  // the dot changes colour with the words
  const dotCol = prev ? mixRgba(DOT[prev.key], DOT[cur.key], tween(t, [cur.at + 1, cur.at + 7], [0, 1], EASE.out3)) : DOT[cur.key];
  const pulse = readPulse(t);

  // entrance: the dot inhales alone for 2 f, then the capsule springs out of it
  const inhale = t < KL.statusIn ? (t - (KL.statusIn - 2)) / 2 : 0;
  const pop = pillPopAt(t);
  const capS = t < KL.statusIn ? 0 : 0.5 + 0.5 * pop;
  const capO = t < KL.statusIn ? 0 : Math.min(1, pop * 2.2);
  const dotHit = flashAt(t, KL.statusIn, 4);
  const dotS =
    (t < KL.statusIn ? 1.3 - 0.15 * Math.sin((Math.PI / 2) * inhale) : 1 + 0.35 * dotHit) *
    (1 + 0.6 * pulse) *
    (1 + 0.3 * (flashAt(t, KL.scanFlip + 1, 3) + flashAt(t, KL.missFlip + 1, 3)));

  // rings: off the capsule on the entrance; off the dot on each change
  const capRingQ = tween(t, [KL.statusIn + 1, KL.statusIn + 12], [0, 1], EASE.out3);
  const capRingO = t > KL.statusIn && capRingQ < 1 ? 0.5 * (1 - capRingQ) : 0;
  const dotRing = (at: number, col: string) => {
    const q = tween(t, [at, at + 12], [0, 1], EASE.out3);
    return t > at && q < 1 ? { q, col: rgba(col, 0.55 * (1 - q)) } : null;
  };
  const rings = [dotRing(KL.scanFlip + 1, SUN.orb[2]), dotRing(KL.missFlip + 1, '#8a8794')].filter(Boolean) as { q: number; col: string }[];

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

  const shake = shakeAt(t);
  const bump = bumpAt(t);
  const left = T.pillRight - width;
  const dotCx = left + PAD + DOTD / 2;

  return (
    <>
      {/* the 2 f inhale: the live dot alone, where the capsule will open */}
      {t < KL.statusIn + 2 ? (
        <div
          style={{
            position: 'absolute',
            left: dotCx - DOTD / 2,
            top: T.y - DOTD / 2,
            width: DOTD,
            height: DOTD,
            borderRadius: '50%',
            background: DOT.listening,
            transform: `scale(${(dotS * (t < KL.statusIn ? 1 : 1 - (t - KL.statusIn) / 2)).toFixed(4)})`,
            opacity: t < KL.statusIn ? 0.4 + 0.6 * inhale : 1 - (t - KL.statusIn) / 2,
          }}
        />
      ) : null}
      {capRingO > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: left - 4 - 16 * capRingQ,
            top: T.y - T.pillH / 2 - 4 - 16 * capRingQ,
            width: width + 8 + 32 * capRingQ,
            height: T.pillH + 8 + 32 * capRingQ,
            borderRadius: 9999,
            boxShadow: `inset 0 0 0 1.5px ${rgba(SUN.orb[2], capRingO)}`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left,
          top: T.y - T.pillH / 2,
          width,
          height: T.pillH,
          borderRadius: 9999,
          background: C.white,
          boxShadow: `0 0 0 1px rgba(24,16,40,0.07), 0 0 ${(20 * dotHit).toFixed(1)}px ${rgba(SUN.orb[2], 0.35 * dotHit)}, 0 10px 24px -18px ${rgba(SUN.orb[0], 0.4 * Math.min(1, pop))}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: PAD,
          gap: GAP,
          transformOrigin: `${PAD + DOTD / 2}px 50%`,
          transform: `translateX(${shake.toFixed(2)}px) scale(${(capS * bump).toFixed(4)})`,
          opacity: capO,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: T.pillText,
          letterSpacing: '-0.005em',
          color: C.ink,
        }}
      >
        <span style={{ position: 'relative', width: DOTD, height: DOTD, flex: 'none' }}>
          {/* a ripple off each reading pulse */}
          {pulse > 0.01 ? (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                boxShadow: `0 0 0 ${(2 + 7 * pulse).toFixed(2)}px ${rgba(INK, 0.18 * pulse)}`,
              }}
            />
          ) : null}
          {rings.map((r, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: DOTD / 2 - (DOTD * (1 + 2.6 * r.q)) / 2,
                top: DOTD / 2 - (DOTD * (1 + 2.6 * r.q)) / 2,
                width: DOTD * (1 + 2.6 * r.q),
                height: DOTD * (1 + 2.6 * r.q),
                borderRadius: '50%',
                boxShadow: `inset 0 0 0 1.5px ${r.col}`,
              }}
            />
          ))}
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: dotHit > 0.05 ? mixColor('#9ab0b6', SUN.orb[2], dotHit) : dotCol,
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
    </>
  );
};

/** where the status pill's left edge is at t (for the moment tag that rides it) */
export const pillLeftAt = (t: number, G: Geo) => G.top.pillRight - pillWidthAt(t, G);

/**
 * The #demo stage's owner / outcome row (demo.tsx:527-585) at film scale —
 * the stage's floor:
 *
 *   ─────────────────────────────────────────────── 1 px rule, white/.12
 *   THE OWNER  Asleep.          IN THE OWNER'S CALL LOG  ( ◦ · · · · )
 *
 * The rule draws on the house draw ease with a small lilac head; the owner
 * label letters rise, "Asleep." rises letter by letter out of a mask
 * (Instrument Sans 520, lilac) and then breathes, slowly, like a sleeper;
 * the call-log label resolves right → left (it is right-aligned) and the
 * log's slot — an empty dashed pill, the site's pill before the call ends —
 * pops in and waits. The result scene lands "Asleep." / "Booked." later.
 *
 * 16:9: one row along the bottom, pinned to the safe margins.
 * 9:16: two stacked rows (label over value) in the lower third.
 */
import React from 'react';
import { aos, breathe, EASE, SPRING, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';

const LABEL: React.CSSProperties = {
  fontFamily: FONT.body,
  fontWeight: 500,
  fontSize: 22,
  lineHeight: 1,
  letterSpacing: TRACK.label,
  color: C.paperDim,
  whiteSpace: 'pre',
};

/** Label letters rising in one by one (optionally from the right end). */
const RiseLetters: React.FC<{ text: string; t: number; start: number; step?: number; fromEnd?: boolean }> = ({
  text,
  t,
  start,
  step = 0.7,
  fromEnd = false,
}) => (
  <div style={{ display: 'flex', ...LABEL }}>
    {text.split('').map((ch, i) => {
      const k = fromEnd ? text.length - 1 - i : i;
      const at = start + k * step;
      const p = aos(t, at, { anticip: 2, depth: 0.12, config: SPRING.pop });
      const o = Math.min(1, Math.max(0, p * 1.3));
      const blur = tween(t, [at, at + 7], [3, 0], EASE.house);
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: o,
            transform: `translateY(${((1 - p) * 0.45).toFixed(3)}em)`,
            filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
          }}
        >
          {ch}
        </span>
      );
    })}
  </div>
);

/** "Asleep." — letters rise out of a mask (the hero's word-mask, per letter), then breathe. */
const Asleep: React.FC<{ t: number; start: number; size: number }> = ({ t, start, size }) => {
  const text = 'Asleep.';
  const breath = 0.86 + 0.14 * (0.5 + 0.5 * breathe(t - start, 96, 1, -Math.PI / 2));
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: FONT.ui,
        fontWeight: 520,
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: TRACK.h3,
        color: C.lilac,
        opacity: t > start + 20 ? breath : 1,
        textShadow: `0 0 ${(18 + 8 * breath).toFixed(1)}px rgba(185,163,255,0.28)`,
      }}
    >
      {text.split('').map((ch, i) => {
        const at = start + i * 1.5;
        const p = aos(t, at, { anticip: 3, depth: 0.06, config: SPRING.site });
        const pPrev = aos(t - 1, at, { anticip: 3, depth: 0.06, config: SPRING.site });
        const speed = Math.abs(p - pPrev) * 110;
        const blur = tween(t, [at, at + 10], [3, 0], EASE.house) + Math.min(6, speed * 0.1);
        return (
          <span
            key={i}
            style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.18em', marginBottom: '-0.18em' }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${((1 - p) * 110).toFixed(2)}%)`,
                filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
              }}
            >
              {ch}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** The log's empty slot: a dashed pill with the site's hollow status dot, waiting. */
const Slot: React.FC<{ t: number; start: number; w: number; h: number }> = ({ t, start, w, h }) => {
  const p = aos(t, start, { anticip: 3, depth: 0.1, config: SPRING.pop });
  if (t < start - 3) return <div style={{ width: w, height: h }} />;
  const wait = 0.5 + 0.5 * breathe(t - start, 72, 1, -Math.PI / 2);
  const o = Math.min(1, Math.max(0, 0.3 + p * 1.2)) * tween(t, [start - 3, start], [0, 1], EASE.out3);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        display: 'block',
        overflow: 'visible',
        opacity: o,
        transform: `scale(${(0.7 + 0.3 * p).toFixed(4)})`,
        transformOrigin: '100% 50%',
      }}
    >
      <rect
        x={0.75}
        y={0.75}
        width={w - 1.5}
        height={h - 1.5}
        rx={(h - 1.5) / 2}
        fill="rgba(255,255,255,0.03)"
        stroke={`rgba(237,236,241,${(0.22 + 0.12 * wait).toFixed(3)})`}
        strokeWidth={1.5}
        strokeDasharray="7 7"
      />
      <circle cx={h / 2 + 2} cy={h / 2} r={5} fill="none" stroke={C.paperDim} strokeWidth={1.5} opacity={0.55 + 0.35 * wait} />
    </svg>
  );
};

export const OwnerRow: React.FC<{
  t: number;
  vertical: boolean;
  /** left / right safe edges */
  x0: number;
  x1: number;
  /** the rule */
  ruleY: number;
  /** 16:9: the row's centre; 9:16: the label row (values sit a row below) */
  rowY: number;
  /** 9:16: the value row's centre */
  valueY: number;
  start: number;
  recede: { opacity: number; blur: number };
}> = ({ t, vertical, x0, x1, ruleY, rowY, valueY, start, recede }) => {
  if (t < start - 3) return null;
  const drawAt = (tt: number) => tween(tt, [start, start + 22], [0, 1], EASE.draw);
  const draw = drawAt(t);
  const len = (x1 - x0) * draw;
  const headHeat = Math.min(1, Math.abs(drawAt(t + 0.5) - drawAt(t - 0.5)) * 18);
  const at = {
    ownerLabel: start + 4,
    asleep: start + 8,
    logLabel: start + 9,
    slot: start + 16,
  };
  const exitFilter = recede.blur > 0.1 ? `blur(${recede.blur.toFixed(2)}px)` : undefined;
  const asleepSize = vertical ? 72 : 58;
  const slot = vertical ? { w: 250, h: 56 } : { w: 214, h: 46 };

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: recede.opacity, filter: exitFilter }}>
      {/* the rule, white/.12, with a lilac head while it draws */}
      <div style={{ position: 'absolute', left: x0, top: ruleY - 0.5, width: len, height: 1, background: 'rgba(255,255,255,0.12)' }} />
      {headHeat > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: x0 + len - 180,
            top: ruleY - 1,
            width: 180,
            height: 2,
            background: `linear-gradient(90deg, rgba(185,163,255,0), rgba(185,163,255,${(0.8 * headHeat).toFixed(3)}))`,
            boxShadow: `0 0 12px rgba(185,163,255,${(0.5 * headHeat).toFixed(3)})`,
          }}
        />
      ) : null}

      {vertical ? (
        <>
          <div style={{ position: 'absolute', left: x0, top: rowY, transform: 'translateY(-50%)' }}>
            <RiseLetters text="THE OWNER" t={t} start={at.ownerLabel} />
          </div>
          <div style={{ position: 'absolute', left: x0 - 3, top: valueY, transform: 'translateY(-50%)' }}>
            <Asleep t={t} start={at.asleep} size={asleepSize} />
          </div>
          <div style={{ position: 'absolute', left: x1, top: rowY, transform: 'translate(-100%, -50%)' }}>
            <RiseLetters text="IN THE OWNER'S CALL LOG" t={t} start={at.logLabel} step={0.5} fromEnd />
          </div>
          <div style={{ position: 'absolute', left: x1 - slot.w, top: valueY - slot.h / 2 }}>
            <Slot t={t} start={at.slot} w={slot.w} h={slot.h} />
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              left: x0,
              top: rowY,
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 26,
            }}
          >
            <RiseLetters text="THE OWNER" t={t} start={at.ownerLabel} />
            <Asleep t={t} start={at.asleep} size={asleepSize} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: x1,
              // the owner side is baseline-set: drop this side so both labels share a line
              top: rowY + 11,
              transform: 'translate(-100%, -50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 26,
            }}
          >
            <RiseLetters text="IN THE OWNER'S CALL LOG" t={t} start={at.logLabel} step={0.5} fromEnd />
            <Slot t={t} start={at.slot} w={slot.w} h={slot.h} />
          </div>
        </>
      )}
    </div>
  );
};

/**
 * The transcript's furniture (the captions themselves are <CallCaptions>):
 *
 *   <TurnLabel>  ● AVA / ● CALLER (TYPE.label) centred over the caption: on
 *                every turn the old name leaves up through its mask as the new
 *                one rises out of its own — a counter rolling over, no pop.
 *   <Chips>      the slot chips "3:00 PM" · "4:30 PM" (TYPE.title figures on
 *                dark glass): they rise in ON the spoken times; the caller's
 *                pick fills 3:00 PM with the accent light from its centre;
 *                4:30 PM settles away; 3:00 PM is taken into the orb.
 *   <MarkRow>    row B of the last line — "Wednesday at 3 PM" rises word by
 *                word ON the voice (MARK_TYPE, as <BookedMark>), then "3 PM"
 *                ignites: the ember (the film's colour for Booked) sweeps the
 *                mark left → right — it is then the single <BookedMark> the
 *                result picks up.
 */
import React from 'react';
import { BOOKING, BookedMark } from '../../components/Shared';
import { Reveal, reveal, revealStyle, subpixel } from '../../components/Type';
import { MARK_TYPE } from '../../lib/handoff';
import { rgba } from '../../lib/lights';
import { EASE, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox, typeStyle } from '../../lib/type';
import { C } from '../../theme';
import { ACCENT, CALLER_INK } from './Mesh';

/* ── the speaker label ─────────────────────────────────────────── */

export type Turn = { who: 'agent' | 'caller'; at: number; out: number };

/** One label per turn, all in the same place: each rises at its turn and leaves up at the next. */
export const TurnLabel: React.FC<{ t: number; turns: readonly Turn[]; x: number; y: number; vertical: boolean }> = ({
  t,
  turns,
  x,
  y,
  vertical,
}) => {
  const st = typeStyle('label', vertical, { tone: 'night' });
  const fs = st.fontSize as number;
  const dot = Math.round(fs * 0.3);
  return (
    <>
      {turns.map((tu, i) => {
        if (t < tu.at - 2 || t > tu.out + 8) return null;
        const ink = tu.who === 'agent' ? ACCENT : CALLER_INK;
        return (
          <div
            key={i}
            style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', ...st, color: ink, whiteSpace: 'nowrap' }}
          >
            <Reveal t={t} start={tu.at - 1} config={SPRING.caption} rise={90} exit={{ at: tu.out, dur: 5 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em', marginRight: '-0.14em' }}>
                <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: ink, transform: 'translateY(-0.04em)' }} />
                {tu.who === 'agent' ? 'AVA' : 'CALLER'}
              </span>
            </Reveal>
          </div>
        );
      })}
    </>
  );
};

/* ── slot chips: "3:00 PM" · "4:30 PM" (as Ava says them) ─────────── */

/** the chips' entrance: a soft spring (ζ ≈ .73, ≈ 3 % overshoot) */
const CHIP_IN = { stiffness: 320, damping: 26, mass: 1 };
/** the pick's press-and-release */
const PRESS = { stiffness: 420, damping: 26, mass: 0.8 };
/** the selected chip's ink: the deep end of the closing light, on the accent fill */
const ON_ACCENT = '#032b1c';

export type ChipSlot = { x: number; y: number };

export const Chips: React.FC<{
  t: number;
  /** the two chips' centres */
  slots: readonly [ChipSlot, ChipSlot];
  w: number;
  h: number;
  fontSize: number;
  /** the spoken times: the chips are (nearly) in ON them */
  pops: readonly [number, number];
  /** 3:00 PM is picked (a 2 f press, the fill floods ON it) */
  pick: number;
  /** 4:30 PM settles away from here */
  drop: number;
  /** 3:00 PM is taken into the orb from here */
  leave: number;
  /** where it is taken to (the orb), screen px, and how big the orb is there */
  leaveTo: { x: number; y: number; d: number };
  /** (9:16) once 4:30 PM has gone, the picked chip glides to this x (the frame's axis) */
  recentre?: number;
}> = ({ t, slots, w, h, fontSize, pops, pick, drop, leave, leaveTo, recentre }) => {
  if (t < pops[0] - 4 || t > leave + 14) return null;
  const labels = ['3:00 PM', '4:30 PM'];
  const nodes: React.ReactNode[] = [];
  labels.forEach((lab, i) => {
    const hit = pops[i];
    if (t < hit - 4) return;
    const selected = i === 0;
    const s0 = slots[i];
    // the entrance: released 3 f before the spoken time, rising 28 px and settling from .94
    const e = springUnit(t - (hit - 3), CHIP_IN);
    const op0 = smooth(0, 0.6, e);
    let dx = 0;
    let dy = 28 * (1 - e);
    let sc = 0.94 + 0.06 * e;
    let op = op0;
    // the pick: a 2 f press to .965, then a quick release (one small overshoot)
    if (selected && t >= pick - 2) {
      sc *= t < pick ? 1 - 0.035 * EASE.in2((t - (pick - 2)) / 2) : 0.965 + 0.035 * springUnit(t - pick, PRESS);
    }
    const fill = selected ? tween(t, [pick, pick + 7], [0, 1], EASE.house) : 0;
    // 4:30 PM: a 2 f lift, then it settles away (down 26 px, .96, fading) on power2.in
    if (!selected && t >= drop) {
      const lift = tween(t, [drop, drop + 2], [0, 1], EASE.inOut);
      const q = tween(t, [drop + 2, drop + 11], [0, 1], EASE.in2);
      dy += -4 * lift * (1 - q) + 26 * q;
      sc *= 1 - 0.04 * q;
      op *= 1 - smooth(0.1, 1, q);
    }
    // 3:00 PM: taken into the orb (power2.in), shrinking to the orb's heart, gone as it reaches its rim
    if (selected && t >= leave) {
      const q = tween(t, [leave + 2, leave + 10], [0, 1], EASE.in2);
      const pre = tween(t, [leave, leave + 2], [0, 1], EASE.inOut) * (1 - q);
      dx = (leaveTo.x - s0.x) * q;
      dy += (leaveTo.y - s0.y) * q + 3 * pre;
      sc *= (1 - 0.02 * pre) * (1 - 0.62 * q);
      // gone as it crosses the orb's rim (absorbed, never pasted over it)
      const dist = Math.hypot(leaveTo.x - s0.x, leaveTo.y - s0.y);
      const rimAt = dist > 1 ? Math.max(0.2, 1 - (leaveTo.d * 0.5) / dist) : 0.5;
      op *= 1 - smooth(rimAt * 0.55, rimAt, q);
    }
    if (op <= 0.002) return;
    // (9:16) the picked slot takes the axis once it is alone (a soft glide, before it is taken in)
    if (selected && recentre !== undefined) {
      const g = springUnit(t - (drop + 6), CHIP_IN);
      const shift = (recentre - s0.x) * g;
      // the travel into the orb starts from wherever the glide has got to
      const q = t >= leave ? tween(t, [leave + 2, leave + 10], [0, 1], EASE.in2) : 0;
      dx += shift * (1 - q);
    }
    const moving = Math.abs(dy) > 0.02 || Math.abs(dx) > 0.02 || Math.abs(sc - 1) > 1e-4;
    nodes.push(
      <div
        key={lab}
        style={{
          position: 'absolute',
          left: s0.x - w / 2,
          top: s0.y - h / 2,
          width: w,
          height: h,
          opacity: op < 0.999 ? op : undefined,
          ...subpixel(`translate(${dx.toFixed(3)}px, ${dy.toFixed(3)}px) scale(${sc.toFixed(5)})`, moving),
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: h / 2,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // dark glass on the emerald: a whisper of light in it, a hairline edge lit from above, a soft shadow
            background: 'linear-gradient(180deg, rgba(236,250,244,0.085) 0%, rgba(236,250,244,0.045) 100%)',
            boxShadow: [
              `inset 0 0 0 1.5px rgba(236,250,244,${(0.16 * (1 - fill)).toFixed(3)})`,
              'inset 0 1px 0 rgba(255,255,255,0.12)',
              '0 22px 44px -22px rgba(0,10,6,0.85)',
              fill > 0.01 ? `0 0 ${(30 * fill).toFixed(1)}px ${rgba(ACCENT, 0.22 * fill)}` : '',
            ]
              .filter(Boolean)
              .join(', '),
            ...typeStyle('title', false, { tone: 'night', size: fontSize, tabular: true }),
            letterSpacing: '-0.01em',
            color: mixHex(C.paper, ON_ACCENT, fill),
          }}
        >
          {fill > 0.001 ? (
            /* the pick floods the chip with the accent light, from its centre */
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(180deg, ${mixHex(ACCENT, '#ffffff', 0.18)} 0%, ${ACCENT} 100%)`,
                clipPath: `circle(${(4 + (Math.hypot(w, h) / 2) * EASE.out3(fill)).toFixed(2)}px at 50% 50%)`,
              }}
            />
          ) : null}
          <span style={{ position: 'relative' }}>{lab}</span>
        </div>
      </div>,
    );
  });
  return <>{nodes}</>;
};

/* ── the last line's row B: the booked mark ─────────────────────── */

/** "Wednesday" · "at" · "3 PM" — the time arrives as one */
const MARK_WORDS = [BOOKING.day, BOOKING.at, BOOKING.time];

/** The mark's box, exactly as <BookedMark> sets it (Shared.tsx, MARK_TYPE), so the swap is invisible. */
const markBox = (x: number, y: number, fontSize: number): React.CSSProperties => ({
  position: 'absolute',
  left: x,
  top: y,
  transform: 'translate(-50%, -50%)',
  whiteSpace: 'nowrap',
  fontFamily: MARK_TYPE.family,
  fontWeight: MARK_TYPE.weight,
  fontSize,
  lineHeight: MARK_TYPE.lineHeight,
  letterSpacing: MARK_TYPE.tracking,
  fontKerning: 'normal',
});

/** the ember sweep's ink at progress p (0..1, left → right): paper ahead of the front, ember behind it */
function sweepFill(from: string, to: string, p: number): React.CSSProperties {
  // the front is a soft 18 % band, travelling from −20 % to 120 % of the mark's width
  const f = -20 + 140 * p;
  return {
    backgroundImage: `linear-gradient(90deg, ${to} 0%, ${to} ${(f - 9).toFixed(2)}%, ${from} ${(f + 9).toFixed(2)}%, ${from} 100%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  };
}

export const MarkRow: React.FC<{
  t: number;
  /** appear frames of "Wednesday", "at", "3 PM" and the period */
  appear: readonly [number, number, number, number];
  /** the ink the words arrive in */
  ink: string;
  /** 0..1 the ember sweeps the mark (left → right) */
  ember: number;
  /** the payoff beat: the mark's scale (exactly 1 before the hand-over) */
  pulse: number;
  /** the period leaves with its row (frame its exit starts), or Infinity */
  periodOut: number;
  /** 0..1 the mark takes the orb: it flares (hotter ember) */
  flare?: number;
  x: number;
  y: number;
  fontSize: number;
}> = ({ t, appear, ink, ember, pulse, periodOut, flare = 0, x, y, fontSize }) => {
  if (t < appear[0] - 1.5) return null;
  const done = mixHex(C.emberLit, C.emberSoft, 0.55 * flare);
  const scale = Math.abs(pulse - 1) > 1e-5 ? ` scale(${pulse.toFixed(5)})` : '';
  const sweeping = ember > 0.001 && ember < 0.999;
  const color = ember >= 0.999 ? done : ink;
  // the words have all risen and settled: the mark is the single <BookedMark> from here on
  const settled = t >= appear[2] + 14;
  const words = MARK_WORDS.map((w, i) => {
    const r = reveal(t, appear[i] - 1, { config: SPRING.caption, rise: 80, fade: 0.5 });
    return { w, r };
  });
  const rPeriod = reveal(t, appear[3] - 1, { config: SPRING.caption, rise: 80, fade: 0.5, exit: { at: periodOut, dur: 5 } });
  return (
    <>
      {settled ? (
        <BookedMark
          color={color}
          x={x}
          y={y}
          fontSize={fontSize}
          style={{ ...subpixel(`translate(-50%, -50%)${scale}`, scale !== ''), ...(sweeping ? sweepFill(ink, done, ember) : null) }}
        />
      ) : (
        /* arriving: the mark's own box, one masked span per word, each rising on its spoken word */
        <div style={{ ...markBox(x, y, fontSize), transform: `translate(-50%, -50%)${scale}`, color }}>
          {words.map(({ w, r }, i) => (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : null}
              <span style={maskBox(0)}>
                <span style={revealStyle(r)}>{w}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      {/* the period rides a twin of the mark's box (same face / size), in the row's ink — it leaves with row A */}
      {rPeriod.opacity > 0.002 ? (
        <div style={{ ...markBox(x, y, fontSize), color: ink }}>
          <span style={{ visibility: 'hidden' }}>{BOOKING.mark}</span>
          <span style={{ position: 'absolute', left: '100%', top: 0, ...maskBox(0), marginLeft: '-0.08em' }}>
            <span style={revealStyle(rPeriod)}>.</span>
          </span>
        </div>
      ) : null}
    </>
  );
};

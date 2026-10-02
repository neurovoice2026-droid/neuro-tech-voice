/**
 * The transcript's furniture (the captions themselves are <CallCaptions>):
 *
 *   <TurnLabel>  ● AVA / ● CALLER (TYPE.label) centred over the caption: on
 *                every turn the old name leaves up through its mask as the new
 *                one rises out of its own — a counter rolling over, no pop.
 *   <MarkRow>    row B of the last line — "Wednesday at" rises as a unit ON
 *                the spoken "Wednesday", centred on itself; "3 PM" lands ON the
 *                spoken "three" (the payoff's beat) and the row glides left on
 *                the same spring into its final centre — never a half-filled
 *                row hanging off-centre (MARK_TYPE, as <BookedMark>), in the call's
 *                one accent ink (the knowledge heading's two-tone: the key
 *                phrase in the accent, the rest of the line in paper). It holds
 *                mint until the orb dives into it: on the contact the ember
 *                (the film's colour for Booked, the result's accent) IGNITES
 *                out of the point the orb went in, and the glow comes up with
 *                it — the hand-over the result picks up at its t 0.
 *
 * (v8: the slot chips are gone — the two-tone caption carries the times.)
 */
import React from 'react';
import { BOOKING, BookedMark } from '../../components/Shared';
import { reveal, revealStyle, subpixel } from '../../components/Type';
import { MARK_TYPE } from '../../lib/handoff';
import { useFaceReady } from '../../lib/fonts';
import { mixHex, SPRING, springUnit } from '../../lib/motion';
import { maskBox, textWidth, typeStyle, UNIT_STAGGER } from '../../lib/type';
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
            {/* on its sub-pixel layer from entrance to exit (revealStyle `hold`): it never re-rasterises once landed */}
            <span style={maskBox(0)}>
              <span style={revealStyle(reveal(t, tu.at - 1, { config: SPRING.caption, rise: 90, exit: { at: tu.out, dur: 5 } }), undefined, true)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em', marginRight: '-0.14em' }}>
                  <span style={{ display: 'inline-block', width: dot, height: dot, borderRadius: '50%', background: ink, transform: 'translateY(-0.04em)' }} />
                  {tu.who === 'agent' ? 'AVA' : 'CALLER'}
                </span>
              </span>
            </span>
          </div>
        );
      })}
    </>
  );
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

/**
 * The ember igniting out of the point the orb went in (p 0..1): a soft front (±10 % of the box's
 * half-diagonal) grows from (ox %, oy %) of the mark's box, ember behind it, the accent ahead of it.
 */
function igniteFill(from: string, to: string, p: number, ox: number, oy: number): React.CSSProperties {
  const f = -12 + 124 * p;
  return {
    backgroundImage: `radial-gradient(circle at ${ox.toFixed(2)}% ${oy.toFixed(2)}%, ${to} 0%, ${to} ${Math.max(0, f - 10).toFixed(2)}%, ${from} ${Math.max(0.01, f + 10).toFixed(2)}%, ${from} 100%)`,
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
  /** the key phrase's ink (the call's one accent) — the words arrive in it and hold it */
  ink: string;
  /** 0..1 the ember ignites (out of the point the orb went in) — only as the orb is taken */
  ignite: number;
  /** where the orb went in, in % of the mark's box (default: its middle, a little above centre) */
  igniteAt?: readonly [number, number];
  /** the payoff beat: the mark's scale (exactly 1 before the hand-over) */
  pulse: number;
  /** the period leaves with its row (frame its exit starts), or Infinity */
  periodOut: number;
  /** 0..1 the mark takes the orb: it flares (hotter ember) */
  flare?: number;
  x: number;
  y: number;
  fontSize: number;
}> = ({ t, appear, ink, ignite, igniteAt = [50, 44], pulse, periodOut, flare = 0, x, y, fontSize }) => {
  // the row is centred on what is visible: "Wednesday at" alone sits centred (shifted right by half the
  // width of " 3 PM"), and glides into the mark's centre as "3 PM" lands (measured in the mark's face)
  const ready = useFaceReady(`${MARK_TYPE.weight} ${Math.round(fontSize)}px ${MARK_TYPE.family}`, BOOKING.mark);
  if (t < appear[0] - 1.5) return null;
  const trackEm = parseFloat(String(MARK_TYPE.tracking)) || 0;
  const wide = (s: string) => textWidth(s, MARK_TYPE.family, MARK_TYPE.weight, fontSize, trackEm);
  const half = ready ? (wide(BOOKING.mark) - wide(`${BOOKING.day} ${BOOKING.at}`)) / 2 : 0;
  const land = t < appear[2] - 1 ? 0 : springUnit(t - (appear[2] - 1), SPRING.caption);
  const dx = half * (1 - land);
  const shift = Math.abs(dx) > 0.0005 ? ` translateX(${dx.toFixed(3)}px)` : '';
  const done = mixHex(C.emberLit, C.emberSoft, 0.55 * flare);
  const scale = Math.abs(pulse - 1) > 1e-5 ? ` scale(${pulse.toFixed(5)})` : '';
  const igniting = ignite > 0.001 && ignite < 0.999;
  const color = ignite >= 0.999 ? done : ink;
  // the mark stays the three masked words (each on its own sub-pixel layer, never re-rasterised) while
  // it holds; it becomes the single <BookedMark> the result picks up only as the ember ignites — the
  // swap of raster happens under the ignition's front and the orb's impact, never on a still mark
  const settled = ignite > 0.001;
  // "Wednesday at" as a unit on "Wednesday" (a ½ f ripple); "3 PM" on "three"
  const starts = [appear[0] - 1, appear[0] - 1 + UNIT_STAGGER, appear[2] - 1];
  const words = MARK_WORDS.map((w, i) => {
    const r = reveal(t, starts[i], { config: SPRING.caption, rise: 80, fade: 0.5 });
    return { w, r };
  });
  const rPeriod = reveal(t, appear[3] - 1, { config: SPRING.caption, rise: 80, fade: 0.5, exit: { at: periodOut, dur: 5 } });
  return (
    <>
      {settled ? (
        /* igniting: one text, on its sub-pixel layer, to the hand-over */
        <BookedMark
          color={color}
          x={x}
          y={y}
          fontSize={fontSize}
          style={{ ...subpixel(`translate(-50%, -50%)${scale}`, true), ...(igniting ? igniteFill(ink, done, ignite, igniteAt[0], igniteAt[1]) : null) }}
        />
      ) : (
        /* arriving: the mark's own box, one masked span per word, each rising on its spoken word */
        <div style={{ ...markBox(x, y, fontSize), transform: `translate(-50%, -50%)${shift}${scale}`, color }}>
          {words.map(({ w, r }, i) => (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : null}
              <span style={maskBox(0)}>
                <span style={revealStyle(r, undefined, true)}>{w}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      {/* the period rides a twin of the mark's box (same face / size), in the phrase's ink — it leaves with row A */}
      {rPeriod.opacity > 0.002 ? (
        <div style={{ ...markBox(x, y, fontSize), transform: `translate(-50%, -50%)${shift}`, color: ink }}>
          <span style={{ visibility: 'hidden' }}>{BOOKING.mark}</span>
          <span style={{ position: 'absolute', left: '100%', top: 0, ...maskBox(0), marginLeft: '-0.08em' }}>
            <span style={revealStyle(rPeriod, undefined, true)}>.</span>
          </span>
        </div>
      ) : null}
    </>
  );
};

/**
 * Pieces drawn by TWO scenes across a cut. Both sides render the same
 * component with the same props, so the handover is pixel-identical.
 */
import React from 'react';
import { C, TYPE } from '../theme';
import { useLayout } from '../lib/layout';
import { HOOK_LINE, MARK, MARK_TYPE } from '../lib/handoff';
import { typeStyle } from '../lib/type';
import { Words } from './Type';

/**
 * "Your business is closed." — the hook reveals it with `start` (word-mask
 * rise); the twist draws <HookLineStatic> (the same line, settled) for its
 * pre-frames and swaps to per-letter shards on the downbeat.
 */
export const HookLine: React.FC<{ start: number; style?: React.CSSProperties; stagger?: number }> = ({
  start,
  style,
  stagger = 3,
}) => {
  const L = useLayout();
  const H = HOOK_LINE(L);
  return (
    <div
      style={{
        position: 'absolute',
        left: H.left,
        width: H.width,
        top: H.cy,
        transform: 'translateY(-50%)',
        ...style,
      }}
    >
      <Words
        text={H.text}
        start={start}
        stagger={stagger}
        style={{ fontSize: H.fontSize }}
        color={C.paper}
        keys={[{ text: H.key.text, color: H.key.color, at: start + H.key.delay }]}
      />
    </div>
  );
};

export const HookLineStatic: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <HookLine start={-10_000} style={style} />
);

const DAY = 'Wednesday';
const AT = 'at';
const SEP = '·';
const TIME = '3 PM';
/**
 * The booking, as Ava says it ("…booked for Wednesday at 3 PM."): the day, the
 * joiner and the time — the mark's three words (the time ignites on "three"),
 * and the copy everything after the call follows (the spoken 12-hour form).
 */
export const BOOKING = {
  day: DAY,
  at: AT,
  /** the card row's separator (the site's call-log idiom) */
  sep: SEP,
  time: TIME,
  /** the mark: "Wednesday at 3 PM" */
  mark: `${DAY} ${AT} ${TIME}`,
  /** the Booked card's date row the mark becomes (" at" folds out, a "·" folds in): "Wednesday · 3 PM" */
  date: `${DAY} ${SEP} ${TIME}`,
  /** the calendar event's face — the call's picked chip, "3:00 PM" */
  event: '3:00 PM',
} as const;

/** "Wednesday at 3 PM" — the ember booked mark, centred on (x, y). */
export const BookedMark: React.FC<{
  color?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  style?: React.CSSProperties;
}> = ({ color = C.emberLit, x, y, fontSize, style }) => {
  const L = useLayout();
  const M = MARK(L);
  return (
    <div
      style={{
        position: 'absolute',
        left: x ?? M.x,
        top: y ?? M.y,
        transform: 'translate(-50%, -50%)',
        whiteSpace: 'nowrap',
        fontFamily: MARK_TYPE.family,
        fontWeight: MARK_TYPE.weight,
        fontSize: fontSize ?? M.fontSize,
        lineHeight: MARK_TYPE.lineHeight,
        letterSpacing: MARK_TYPE.tracking,
        color,
        ...style,
      }}
    >
      {BOOKING.mark}
    </div>
  );
};

/**
 * The ember glow under the booked mark (a soft radial, fontSize·11.2 ×
 * fontSize·2.2, centred on the mark). The call holds it at MARK_GLOW_HANDOFF
 * through its last frame; the result draws it at the same strength at its t 0
 * and fades it into its plate — so the glow never pops at the cut.
 */
export const MarkGlow: React.FC<{ x?: number; y?: number; fontSize?: number; k: number }> = ({
  x,
  y,
  fontSize,
  k,
}) => {
  const L = useLayout();
  const M = MARK(L);
  const fs = fontSize ?? M.fontSize;
  const cx = x ?? M.x;
  const cy = y ?? M.y;
  if (k <= 0.005) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - fs * 5.6,
        top: cy - fs * 1.1,
        width: fs * 11.2,
        height: fs * 2.2,
        background: `radial-gradient(closest-side, rgba(238,84,35,${(0.42 * k).toFixed(3)}), rgba(238,84,35,${(0.14 * k).toFixed(3)}) 55%, rgba(238,84,35,0))`,
        pointerEvents: 'none',
      }}
    />
  );
};

/**
 * The Booked card: the site's call-log pill (BOOKED + "Wednesday · 3 PM" —
 * rgb(238 84 35 / .16) wash, #ffb877 text, #ee5423 dot) grown into a card on
 * the cover's plate (#24212c, radius 20). Sized w×h, drawn at its own origin
 * (position it with a wrapper). `p` 0..1 reveals its inner rows.
 */
export const BookedCard: React.FC<{
  w?: number;
  h?: number;
  /** 0..1 inner reveal (rows rise in). */
  p?: number;
  /** 0..1 extra ember glow (landing flash). */
  glow?: number;
  /** ping ring scale 1→2.4, opacity .6→0 — pass 0..1 progress, or -1 for none. */
  ping?: number;
  /** the date row's size (px, default 52 — TYPE.title's setting at the card's scale) */
  dateSize?: number;
  /** the BOOKED label's size (px, default TYPE.label for the orientation) */
  labelSize?: number;
  style?: React.CSSProperties;
}> = ({ w = 560, h = 168, p = 1, glow = 0, ping = -1, dateSize = 52, labelSize, style }) => {
  const L = useLayout();
  const row = (k: number) => {
    const q = Math.min(1, Math.max(0, p * 1.6 - k * 0.3));
    const e = 1 - Math.pow(1 - q, 3);
    return { opacity: e, transform: `translateY(${(1 - e) * 14}px)` };
  };
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        borderRadius: 20,
        background: `linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0) 60%), ${C.panel}`,
        boxShadow: `0 0 0 1px rgba(238,84,35,${0.28 + glow * 0.4}), inset 0 1px 0 rgba(255,255,255,0.07), 0 30px 60px -24px rgba(0,0,0,0.85), 0 0 ${40 + glow * 80}px ${-10 + glow * 10}px rgba(238,84,35,${0.22 + glow * 0.45})`,
        padding: '26px 30px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 10,
        overflow: 'visible',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...row(0) }}>
        <div style={{ position: 'relative', width: 12, height: 12 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C.ember }} />
          {ping >= 0 && ping <= 1 ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C.ember,
                transform: `scale(${1 + ping * 1.4})`,
                opacity: 0.6 * (1 - ping),
              }}
            />
          ) : null}
        </div>
        <div style={{ ...typeStyle('label', L.vertical, { tone: 'night', size: labelSize }), lineHeight: 1, color: C.emberLit }}>
          Booked
        </div>
      </div>
      <div
        style={{
          fontFamily: TYPE.title.family,
          fontWeight: TYPE.title.weightOnDark,
          fontSize: dateSize,
          lineHeight: 1.05,
          letterSpacing: TYPE.title.tracking,
          color: C.paper,
          whiteSpace: 'nowrap',
          ...row(1),
        }}
      >
        {BOOKING.date}
      </div>
    </div>
  );
};

/**
 * The booked event — what the card becomes in the calendar: a solid #ee5423
 * block, full cell width, "3:00 PM" (the call's picked chip, set as the call
 * sets it: Instrument Sans, TYPE.title's family, tabular figures) in white
 * with a white dot — the booked pill's dot, inverted onto the ember. The dot
 * keeps the pill's ping (scale 1 → 2.4, .6 → 0), and when "Booked." lands it
 * turns into a check: the dot draws itself into a tick (one stroke, white —
 * the scene has one accent, the ember; the confirmation is drawn, not tinted).
 *
 * Sizes are passed in px of whatever layer draws it (the flyer's card units,
 * the calendar's world px), so the face keeps its own type size while the
 * calendar crops and re-proportions around it. `fitFace` sizes it to the
 * event's width from the measured copy.
 */
import React from 'react';
import { BOOKING } from '../../components/Shared';
import { mixHex } from '../../lib/motion';
import { C, TYPE } from '../../theme';
import { measure, type FontSpec } from './measure';

/** the face's time: Instrument Sans (the call's chip), 500 on the ember, −0.01em, tabular figures */
export const EVENT_FONT = (size: number): FontSpec => ({
  family: TYPE.title.family,
  weight: 500,
  size,
  track: -0.01,
  lh: 1,
});
/** the dot and the gap after it, in em of the time's size */
const DOT_EM = 0.2;
const GAP_EM = 0.3;
/** "3:00 PM": the figures carry the face; the meridiem is set smaller on their baseline (display
 *  time, as on a clock face), MER of their size, MER_GAP em after them */
const [CLOCK, MERIDIEM] = BOOKING.event.split(' ');
const MER = 0.62;
const MER_GAP = 0.14;
/** the face ("• 3:00 PM") never spans more than this share of the event's width */
const FACE_FILL = 0.78;

/** The face's width in em of its size (measured: dot + gap + figures + meridiem). */
const faceEm = () =>
  DOT_EM + GAP_EM + measure(CLOCK, EVENT_FONT(100)).w / 100 + MER_GAP + measure(MERIDIEM, EVENT_FONT(100 * MER)).w / 100;

/** The face's size in a `boxW`-wide event: its design size, or less if "• 3:00 PM" (measured) would
 *  span more than FACE_FILL of the box. Same units in, same units out. */
export function fitFace(design: number, boxW: number): number {
  return Math.min(design, (FACE_FILL * boxW) / faceEm());
}

export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, a)).toFixed(3)})`;
};

/** The scene's plates (the calendar, the flying card): the site's cover panel (#24212c) taken a step
 *  towards the room's near-black — a neutral dark material; the light gives it its edge, not a tint. */
export const PLATE = '#1b1a1f';
/** the plate's top edge catching the key light */
export const PLATE_RIM = 'rgba(255,255,255,0.045)';

/** The flying card's plate warming into the event (plate → solid ember); the landing flash runs it hot. */
export const eventFill = (warm: number, flash = 0) =>
  mixHex(mixHex(PLATE, C.ember, warm), mixHex(C.ember, C.emberLit, 0.6), 0.7 * flash);

/** Dot + "3:00 PM", centred in its box. `size` = the time's font size (px of the drawing layer). */
export const EventFace: React.FC<{
  size: number;
  op: number;
  ping?: number;
  color?: string;
  dotColor?: string;
  /** 0..1 the dot draws itself into a check (the confirmation) */
  check?: number;
}> = ({ size, op, ping = -1, color = C.white, dotColor = C.white, check = 0 }) => {
  if (op <= 0.001) return null;
  const dot = size * DOT_EM;
  const f = EVENT_FONT(size);
  const k = Math.min(1, Math.max(0, check));
  // the check needs a little more room than the dot: it grows into the gap as it draws
  const box = dot * (1 + 1.8 * k);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: size * GAP_EM - (box - dot) * 0.5,
        opacity: op < 0.999 ? op : undefined,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: box,
          height: box,
          flex: 'none',
          transform: `translateY(${(-0.04 * size).toFixed(2)}px)`,
        }}
      >
        {/* the dot shrinks into the check's start as the stroke draws out of it */}
        {k < 0.999 ? (
          <div
            style={{
              position: 'absolute',
              left: (box - dot) / 2,
              top: (box - dot) / 2,
              width: dot,
              height: dot,
              borderRadius: '50%',
              background: dotColor,
              transform: `scale(${(1 - k).toFixed(4)})`,
            }}
          />
        ) : null}
        {ping >= 0 && ping < 1 && k < 0.001 ? (
          <div
            style={{
              position: 'absolute',
              left: (box - dot) / 2,
              top: (box - dot) / 2,
              width: dot,
              height: dot,
              borderRadius: '50%',
              background: dotColor,
              transform: `scale(${(1 + ping * 1.4).toFixed(3)})`,
              opacity: 0.6 * (1 - ping),
            }}
          />
        ) : null}
        {k > 0.001 ? (
          <svg
            viewBox="0 0 24 24"
            width={box}
            height={box}
            style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
            aria-hidden
          >
            <path
              d="M4.5 12.6l4.6 4.6L19.5 6.8"
              fill="none"
              stroke={dotColor}
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={(1 - k).toFixed(4)}
            />
          </svg>
        ) : null}
      </div>
      <div
        style={{
          fontFamily: f.family,
          fontWeight: f.weight,
          fontSize: size,
          lineHeight: f.lh,
          color,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: `${f.track}em`,
          whiteSpace: 'nowrap',
        }}
      >
        {CLOCK}
        <span
          style={{
            fontSize: size * MER,
            marginLeft: size * MER_GAP,
            letterSpacing: '0.02em',
          }}
        >
          {MERIDIEM}
        </span>
      </div>
    </div>
  );
};

/**
 * The booked event — what the card becomes in the calendar (P0-2): a solid
 * #ee5423 block, full cell width, "3:00 PM" (the call's picked chip) in white
 * Geist Mono 500 with a white dot (the booked pill's dot, inverted onto the
 * ember; it keeps the pill's ping: scale 1 → 2.4, .6 → 0), and an ember glow
 * round it.
 *
 * Sizes are passed in px of whatever layer draws it (the flyer's card units,
 * the calendar's world px), so the face keeps its own type size while the
 * calendar crops and re-proportions around it. `fitFace` sizes it to the
 * event's width from the measured copy.
 */
import React from 'react';
import { BOOKING } from '../../components/Shared';
import { C, FONT } from '../../theme';
import { mixHex } from '../../lib/motion';
import { measure, type FontSpec } from './measure';

/** the face's time: Geist Mono 500, −0.02em */
export const EVENT_FONT = (size: number): FontSpec => ({ family: FONT.mono, weight: 500, size, track: -0.02, lh: 1 });
/** the dot and the gap after it, in em of the time's size */
const DOT_EM = 0.2;
const GAP_EM = 0.26;
/** the face ("• 3:00 PM") never spans more than this share of the event's width */
const FACE_FILL = 0.8;

/** The face's size in a `boxW`-wide event: its design size, or less if "• 3:00 PM" (measured) would
 *  span more than FACE_FILL of the box. Same units in, same units out. */
export function fitFace(design: number, boxW: number): number {
  const em = DOT_EM + GAP_EM + measure(BOOKING.event, EVENT_FONT(100)).w / 100;
  return Math.min(design, (FACE_FILL * boxW) / em);
}

export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, a)).toFixed(3)})`;
};

/** The flying card's plate warming into the event (panel → solid ember); the landing flash runs it hot. */
export const eventFill = (warm: number, flash = 0) =>
  mixHex(mixHex(C.panel, C.ember, warm), mixHex(C.ember, C.emberLit, 0.8), 0.7 * flash);

/** Dot + "3:00 PM", centred in its box. `size` = the time's font size (px of the drawing layer). */
export const EventFace: React.FC<{
  size: number;
  op: number;
  ping?: number;
  color?: string;
  dotColor?: string;
}> = ({ size, op, ping = -1, color = C.white, dotColor = C.white }) => {
  if (op <= 0.001) return null;
  const dot = size * DOT_EM;
  const f = EVENT_FONT(size);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: size * GAP_EM,
        opacity: op,
      }}
    >
      <div style={{ position: 'relative', width: dot, height: dot, flex: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: dotColor }} />
        {ping >= 0 && ping < 1 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: dotColor,
              transform: `scale(${(1 + ping * 1.4).toFixed(3)})`,
              opacity: 0.6 * (1 - ping),
            }}
          />
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
        {BOOKING.event}
      </div>
    </div>
  );
};

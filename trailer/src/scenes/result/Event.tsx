/**
 * The booked event — what the card becomes in the calendar (P0-2): a solid
 * #ee5423 block, full cell width, "15:00" in white Geist Mono 500 with a white
 * dot (the booked pill's dot, inverted onto the ember; it keeps the pill's
 * ping: scale 1 → 2.4, .6 → 0), and an ember glow round it.
 *
 * Sizes are passed in px of whatever layer draws it (the flyer's card units,
 * the calendar's world px), so the face keeps its own type size while the
 * calendar crops and re-proportions around it.
 */
import React from 'react';
import { C, FONT } from '../../theme';
import { mixHex } from '../../lib/motion';

export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, a)).toFixed(3)})`;
};

/** The flying card's plate warming into the event (panel → solid ember); the landing flash runs it hot. */
export const eventFill = (warm: number, flash = 0) =>
  mixHex(mixHex(C.panel, C.ember, warm), mixHex(C.ember, C.emberLit, 0.8), 0.7 * flash);

/** Dot + "15:00", centred in its box. `size` = the time's font size (px of the drawing layer). */
export const EventFace: React.FC<{
  size: number;
  op: number;
  ping?: number;
  color?: string;
  dotColor?: string;
}> = ({ size, op, ping = -1, color = C.white, dotColor = C.white }) => {
  if (op <= 0.001) return null;
  const dot = size * 0.2;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: size * 0.26,
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
          fontFamily: FONT.mono,
          fontWeight: 500,
          fontSize: size,
          lineHeight: 1,
          color,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        15:00
      </div>
    </div>
  );
};

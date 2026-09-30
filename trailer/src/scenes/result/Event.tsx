/**
 * The booked event — what the card becomes in the calendar. It reads as the
 * site's booked pill turned into a calendar block: the cover plate under the
 * pill's 16 % ember wash, a 1px ember hairline, the #ee5423 dot (with the
 * pill's ping: scale 1 → 2.4, .6 → 0) and the time in Geist Mono, #ffb877.
 *
 * Every size here is in "units": the flyer draws it in card units, the
 * calendar in its natural units, so `u` converts (world px per unit).
 */
import React from 'react';
import { C, FONT } from '../../theme';
import { mixHex } from '../../lib/motion';

export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, a)).toFixed(3)})`;
};

/** The event's resting fill: the panel under the booked pill's 16 % ember wash. */
export const eventFill = (warm: number, flash = 0) => mixHex(C.panel, C.ember, 0.16 * warm + 0.34 * flash);

/**
 * Dot + "15:00", centred in its box. `u` scales every size (1 = calendar
 * natural units), `size` is the time's size in those units. `ping` 0..1
 * draws the pill's dot ping.
 */
export const EventFace: React.FC<{ u: number; op: number; size: number; ping?: number; color?: string }> = ({
  u,
  op,
  size,
  ping = -1,
  color = C.emberLit,
}) => {
  if (op <= 0.001) return null;
  const dot = 8 * u;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6 * u,
        opacity: op,
      }}
    >
      <div style={{ position: 'relative', width: dot, height: dot, flex: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C.ember }} />
        {ping >= 0 && ping < 1 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: C.ember,
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
          fontSize: size * u,
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

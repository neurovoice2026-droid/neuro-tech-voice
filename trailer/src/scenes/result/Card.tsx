/**
 * Local copy of <BookedCard> (components/Shared.tsx) for the morph:
 *   · rows are placed absolutely from CARD (not by flex), so the morph can
 *     register the call's mark onto the date row to the pixel;
 *   · BOOKED is set at 22 px (the label minimum), line-height fixed;
 *   · the date row has its own opacity (it cross-fades with the mark).
 * Same plate, same type, same pill idiom as the shared card.
 */
import React from 'react';
import { C, FONT, TRACK } from '../../theme';
import type { FontSpec } from './measure';

/** Card-row geometry, relative to the card's centre (card units). */
export const CARD = {
  padX: 30,
  /** BOOKED row centre */
  row0: -32.3,
  /** date row centre ("Wednesday 15:00") */
  row1: 18.2,
  label: 22,
  dot: 12,
  gap: 12,
} as const;

/** The card's date row type (Instrument Sans 520, 52 px, -0.01em, lh 1.05). */
export const DATE_FONT: FontSpec = { family: FONT.ui, weight: 520, size: 52, track: -0.01, lh: 1.05 };

export const CardFace: React.FC<{
  w: number;
  h: number;
  /** 0..1 BOOKED row (dot + label) rises in */
  p: number;
  /** 0..1 date row opacity */
  row: number;
  /** pill ping 0..1 (-1 none) */
  ping?: number;
}> = ({ w, h, p, row, ping = -1 }) => {
  const q = Math.min(1, Math.max(0, p));
  const e = 1 - Math.pow(1 - q, 3);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
      {e > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: CARD.padX,
            top: h / 2 + CARD.row0,
            transform: `translateY(calc(-50% + ${((1 - e) * 14).toFixed(2)}px))`,
            display: 'flex',
            alignItems: 'center',
            gap: CARD.gap,
            opacity: e,
          }}
        >
          <div style={{ position: 'relative', width: CARD.dot, height: CARD.dot, flex: 'none' }}>
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
              fontFamily: FONT.body,
              fontWeight: 600,
              fontSize: CARD.label,
              lineHeight: 1.2,
              letterSpacing: TRACK.tag,
              textTransform: 'uppercase',
              color: C.emberLit,
              whiteSpace: 'nowrap',
            }}
          >
            Booked
          </div>
        </div>
      ) : null}
      {row > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: CARD.padX,
            top: h / 2 + CARD.row1,
            transform: 'translateY(-50%)',
            fontFamily: DATE_FONT.family,
            fontWeight: DATE_FONT.weight,
            fontSize: DATE_FONT.size,
            lineHeight: DATE_FONT.lh,
            letterSpacing: `${DATE_FONT.track}em`,
            color: C.paper,
            whiteSpace: 'nowrap',
            opacity: row,
          }}
        >
          Wednesday 15:00
        </div>
      ) : null}
    </div>
  );
};

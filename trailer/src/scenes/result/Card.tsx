/**
 * Local copy of <BookedCard> (components/Shared.tsx) for the morph:
 *   · rows are placed absolutely from the card type (not by flex), so the
 *     morph can register the call's mark onto the date row to the pixel;
 *   · sized for the 76/68 px mark: a 760/720 × 200 card, BOOKED in TYPE.label
 *     (30 / 28 px, uppercase, tracked), the date row in the mark's own setting
 *     (MARK_TYPE) at 68/64 px — the mark's words only scale down onto it;
 *   · the date row has its own opacity (it takes over from the mark's words).
 * Same idiom as the shared card: the site's booked pill grown into a card.
 */
import React from 'react';
import { BOOKING } from '../../components/Shared';
import { typeStyle } from '../../lib/type';
import { C } from '../../theme';
import type { CardType } from './geometry';

export const CardFace: React.FC<{
  w: number;
  h: number;
  ct: CardType;
  vertical: boolean;
  /** 0..1 BOOKED row (dot + label) rises in */
  p: number;
  /** 0..1 date row opacity */
  row: number;
}> = ({ w, h, ct, vertical, p, row }) => {
  const q = Math.min(1, Math.max(0, p));
  const e = 1 - Math.pow(1 - q, 3);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
      {e > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: ct.padX,
            top: h / 2 + ct.row0,
            // the row rises out of its own band (a mask: it never floats over the date)
            transform: 'translateY(-50%)',
            overflow: 'hidden',
            padding: '0.2em 0.2em 0.2em 0',
            margin: '-0.2em -0.2em -0.2em 0',
            fontSize: ct.label,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: ct.gap,
              transform: `translateY(${((1 - e) * 110).toFixed(3)}%)`,
              opacity: Math.min(1, e * 1.6),
            }}
          >
            <div
              style={{
                width: ct.dot,
                height: ct.dot,
                flex: 'none',
                borderRadius: '50%',
                background: C.ember,
              }}
            />
            <div
              style={{
                ...typeStyle('label', vertical, {
                  tone: 'night',
                  size: ct.label,
                }),
                lineHeight: 1,
                color: C.emberLit,
                whiteSpace: 'nowrap',
              }}
            >
              Booked
            </div>
          </div>
        </div>
      ) : null}
      {row > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: ct.padX,
            top: h / 2 + ct.row1,
            transform: 'translateY(-50%)',
            fontFamily: ct.date.family,
            fontWeight: ct.date.weight,
            fontSize: ct.date.size,
            lineHeight: ct.date.lh,
            letterSpacing: `${ct.date.track}em`,
            fontKerning: 'normal',
            color: C.paper,
            whiteSpace: 'nowrap',
            opacity: row < 0.999 ? row : undefined,
          }}
        >
          {BOOKING.day} <span style={{ margin: `0 ${ct.sepAir}em` }}>{BOOKING.sep}</span> {BOOKING.time}
        </div>
      ) : null}
    </div>
  );
};

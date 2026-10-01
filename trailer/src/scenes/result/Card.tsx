/**
 * Local copy of <BookedCard> (components/Shared.tsx) for the morph:
 *   · rows are placed absolutely from the card type (not by flex), so the
 *     morph can register the call's mark onto the date row to the pixel;
 *   · sized for the 76/68 px mark (P2-5): a 760/720 × 200 card, BOOKED at
 *     32 px, the date row at 68/64 px — the mark's words shrink < 15 %;
 *   · the date row has its own opacity (it cross-fades with the mark).
 * Same plate, same type, same pill idiom as the shared card.
 */
import React from 'react';
import { BOOKING } from '../../components/Shared';
import { C, FONT, TRACK } from '../../theme';
import type { CardType } from './geometry';

export const CardFace: React.FC<{
  w: number;
  h: number;
  ct: CardType;
  /** 0..1 BOOKED row (dot + label) rises in */
  p: number;
  /** 0..1 date row opacity */
  row: number;
  /** pill ping 0..1 (-1 none) */
  ping?: number;
}> = ({ w, h, ct, p, row, ping = -1 }) => {
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
            transform: `translateY(calc(-50% + ${((1 - e) * 16).toFixed(2)}px))`,
            display: 'flex',
            alignItems: 'center',
            gap: ct.gap,
            opacity: e,
          }}
        >
          <div style={{ position: 'relative', width: ct.dot, height: ct.dot, flex: 'none' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C.ember,
                boxShadow: '0 0 12px rgba(238,84,35,0.8)',
              }}
            />
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
              fontSize: ct.label,
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
            left: ct.padX,
            top: h / 2 + ct.row1,
            transform: 'translateY(-50%)',
            fontFamily: ct.date.family,
            fontWeight: ct.date.weight,
            fontSize: ct.date.size,
            lineHeight: ct.date.lh,
            letterSpacing: `${ct.date.track}em`,
            color: C.paper,
            whiteSpace: 'nowrap',
            opacity: row,
          }}
        >
          {BOOKING.date}
        </div>
      ) : null}
    </div>
  );
};

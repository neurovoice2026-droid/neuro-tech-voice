/**
 * The mark → card → event object. `cardAt` designs it in screen space; it
 * is drawn here inside the world layer, converted with the camera of the
 * frame being drawn.
 *
 *   lift   the ember "Wednesday at 3 PM" gets the site's booked-pill wash
 *          around it, dips, and springs up (towards the lens, a little to
 *          the side) while the pill grows into the Booked card. Its two
 *          words travel — each scaled to its measured width — onto their
 *          measured places in the card's "Wednesday · 3 PM" row (" at" folds
 *          out between them as the row's "·" folds in). The mark and the row
 *          are the same setting (MARK_TYPE), so once registered the words
 *          simply take the row's paper ink. BOOKED + the ember dot rise in.
 *   throw  the card winds up, lobs into the close-up, tilts, shrinks to the
 *          slot and warms to the event's solid ember (its face turns white).
 *
 * No motion blur, no ghosts: the 120 fps render samples the flight four times
 * per timeline frame; the card is one crisp object on every frame.
 */
import React from 'react';
import { BOOKING, BookedMark } from '../../components/Shared';
import { MARK_TYPE } from '../../lib/handoff';
import { mix, mixHex, smooth } from '../../lib/motion';
import { C } from '../../theme';
import { RESULT } from '../../timing';
import type { ResultTiming } from '../Result';
import { CardFace } from './Card';
import { EventFace, eventFill, hexA } from './Event';
import { screenToWorld, type Cam, type Geo } from './geometry';
import { cardAt, type CardState, type MarkMetrics, type Word } from './motion';

type LL = { cx: number; cy: number };

const plateStyle = (S: CardState): React.CSSProperties => {
  const fill = eventFill(S.warm);
  // lengths below are screen px, converted to card units (÷ s)
  const u = 1 / S.s;
  const ringW = mix(1.25, 1, S.warm) * u;
  const ringA = mix(0.28 + 0.12 * S.pill, 0.5, S.warm);
  const lift = S.air;
  // a real drop shadow under a floating card: a near contact core + a wide soft key shadow, both
  // growing with its height above the sheet
  const nearY = (2 + 10 * lift) * u;
  const nearB = (6 + 18 * lift) * u;
  const farY = (12 + 46 * lift) * u;
  const farB = (30 + 90 * lift) * u;
  return {
    position: 'absolute',
    inset: 0,
    borderRadius: S.r,
    // the site's booked pill (ember 16 % wash) → the card's top light over the (warming) plate
    background: [
      `linear-gradient(${hexA(C.ember, 0.16 * S.pill)}, ${hexA(C.ember, 0.16 * S.pill)})`,
      `linear-gradient(180deg, rgba(255,255,255,${(0.05 * (1 - S.pill)).toFixed(3)}), rgba(255,255,255,0) 58%)`,
      fill,
    ].join(', '),
    boxShadow: [
      `0 0 0 ${ringW.toFixed(3)}px ${hexA(C.ember, ringA)}`,
      `inset 0 ${u.toFixed(3)}px 0 rgba(255,255,255,${(0.08 * (1 - S.pill)).toFixed(3)})`,
      `0 ${nearY.toFixed(2)}px ${nearB.toFixed(2)}px ${(-4 * u).toFixed(2)}px rgba(0,0,0,${(0.42 + 0.1 * lift).toFixed(3)})`,
      `0 ${farY.toFixed(2)}px ${farB.toFixed(2)}px ${(-14 * u).toFixed(2)}px rgba(0,0,0,${(0.4 + 0.2 * Math.min(1, lift)).toFixed(3)})`,
      // the card's own light: ember, close to its edge (its glow on the room is the room's key light)
      `0 0 ${(26 * u).toFixed(2)}px ${(-6 * u).toFixed(2)}px ${hexA(C.ember, 0.16 + 0.26 * S.warm)}`,
    ].join(', '),
    opacity: S.plateOp < 0.999 ? S.plateOp : undefined,
  };
};

/** One of the mark's words, in the mark's own setting (MARK_TYPE, as <BookedMark>). */
const MarkWord: React.FC<{
  text: string;
  w: Word;
  S: CardState;
  fontSize: number;
  op: number;
  color: string;
}> = ({ text, w, S, fontSize, op, color }) => (
  <div
    style={{
      position: 'absolute',
      left: S.w / 2 + w.x,
      top: S.h / 2 + w.y,
      transform: `translate(-50%, -50%) scale(${w.s.toFixed(5)})`,
      whiteSpace: 'nowrap',
      fontFamily: MARK_TYPE.family,
      fontWeight: MARK_TYPE.weight,
      fontSize,
      lineHeight: MARK_TYPE.lineHeight,
      letterSpacing: MARK_TYPE.tracking,
      fontKerning: 'normal',
      color,
      opacity: op < 0.999 ? op : undefined,
    }}
  >
    {text}
  </div>
);

const Card: React.FC<{
  S: CardState;
  G: Geo;
  L: LL;
  cam: Cam;
  vertical: boolean;
}> = ({ S, G, L, cam, vertical }) => {
  const P = screenToWorld(cam, L, S);
  const sw = S.s / cam.z;
  const m = S.morph;
  // registered on the row, the mark's words take the row's paper ink (same glyphs: no double image)
  const ink = m ? mixHex(C.emberLit, C.paper, m.ink) : C.paper;
  return (
    <div
      style={{
        position: 'absolute',
        left: P.x - S.w / 2,
        top: P.y - S.h / 2,
        width: S.w,
        height: S.h,
        transform: `rotate(${S.rot.toFixed(4)}deg) scale(${sw.toFixed(5)})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div style={plateStyle(S)} />
      {/* the card's face lives inside the card: nothing spills past its edge as it narrows to the slot */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: S.r,
          overflow: m ? 'visible' : 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: S.roll > 0 ? `translateY(${(-0.62 * S.h * S.roll).toFixed(3)}px)` : undefined }}>
          <CardFace w={S.w} h={S.h} ct={G.cardType} vertical={vertical} p={S.p} row={m ? 0 : 1 - smooth(0.45, 1, S.roll)} />
        </div>
        {S.ev > 0.001 ? (
          <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(0.62 * S.h * (1 - S.roll)).toFixed(3)}px)` }}>
            <EventFace size={G.face * S.u} op={smooth(0, 0.55, S.ev)} color={C.white} dotColor={C.white} />
          </div>
        ) : null}
      </div>
      {m ? (
        <>
          <MarkWord text={BOOKING.day} w={m.wed} S={S} fontSize={G.mark.fontSize} op={1} color={ink} />
          {m.at.op > 0.001 ? (
            <MarkWord text={BOOKING.at} w={m.at} S={S} fontSize={G.mark.fontSize} op={m.at.op} color={ink} />
          ) : null}
          {m.sep.op > 0.001 ? (
            <MarkWord text={BOOKING.sep} w={m.sep} S={S} fontSize={G.mark.fontSize} op={m.sep.op} color={ink} />
          ) : null}
          <MarkWord text={BOOKING.time} w={m.num} S={S} fontSize={G.mark.fontSize} op={1} color={ink} />
        </>
      ) : null}
    </div>
  );
};

export const Flyer: React.FC<{
  t: number;
  G: Geo;
  T: ResultTiming;
  L: LL;
  cam: Cam;
  MM: MarkMetrics;
  vertical: boolean;
}> = ({ t, G, T, L, cam, MM, vertical }) => {
  if (t < 0 || t >= RESULT.land) return null;
  // t = 0: the call's own mark, untouched (pixel-identical hand-over)
  if (t === 0) return <BookedMark color={C.emberLit} />;
  return <Card S={cardAt(t, G, L, T, MM)} G={G} L={L} cam={cam} vertical={vertical} />;
};

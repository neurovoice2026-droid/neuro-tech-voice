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
 *          out between them as the row's "·" folds in); only once registered
 *          do they cross-fade into the card's face. BOOKED + the ember dot
 *          rise in meanwhile.
 *   throw  the card winds up, lobs into the close-up, tilts, shrinks to the
 *          slot and warms to the event's solid ember (its face turns white).
 *
 * Motion blur: a sub-frame ghost train sampled in SCREEN space (so its
 * length and direction are what the eye sees while the camera follows) +
 * a blur scaled by the screen speed.
 */
import React from 'react';
import { BOOKING, BookedMark } from '../../components/Shared';
import { C, FONT } from '../../theme';
import { mix } from '../../lib/motion';
import { RESULT } from '../../timing';
import type { ResultTiming } from '../Result';
import { CardFace } from './Card';
import { EventFace, eventFill, hexA } from './Event';
import { screenToWorld, type Cam, type Geo } from './geometry';
import { cardAt, cardSpeed, type CardState, type MarkMetrics, type Word } from './motion';

type LL = { cx: number; cy: number };

const plateStyle = (S: CardState): React.CSSProperties => {
  const fill = eventFill(S.warm);
  // lengths below are screen px, converted to card units (÷ s)
  const u = 1 / S.s;
  const ringW = mix(1.25, 1, S.warm) * u;
  const ringA = mix(0.3 + 0.15 * S.pill, 0.55, S.warm);
  const lift = S.air;
  const dropY = (3 + 46 * lift) * u;
  const dropB = (8 + 84 * lift) * u;
  const dropS = (-3 - 18 * lift) * u;
  const dropA = 0.5 + 0.3 * Math.min(1, lift);
  const glow = (30 + 40 * lift) * u;
  return {
    position: 'absolute',
    inset: 0,
    borderRadius: S.r,
    // the site's booked pill (ember 16 % wash) → the card's sheen over the (warming) plate
    background: [
      `linear-gradient(${hexA(C.ember, 0.16 * S.pill)}, ${hexA(C.ember, 0.16 * S.pill)})`,
      `linear-gradient(180deg, rgba(255,255,255,${(0.05 * (1 - S.pill)).toFixed(3)}), rgba(255,255,255,0) 62%)`,
      fill,
    ].join(', '),
    boxShadow: [
      `0 0 0 ${ringW.toFixed(3)}px ${hexA(C.ember, ringA)}`,
      `inset 0 ${u.toFixed(3)}px 0 rgba(255,255,255,${(0.07 * (1 - S.pill)).toFixed(3)})`,
      `0 ${dropY.toFixed(2)}px ${dropB.toFixed(2)}px ${dropS.toFixed(2)}px rgba(0,0,0,${dropA.toFixed(3)})`,
      `0 0 ${glow.toFixed(2)}px ${(-8 * u).toFixed(2)}px ${hexA(C.ember, 0.24 + 0.3 * S.warm)}`,
    ].join(', '),
    opacity: S.plateOp,
  };
};

/** One of the mark's words, in the mark's own setting (Inter 500, as <BookedMark>). */
const MarkWord: React.FC<{
  text: string;
  w: Word;
  S: CardState;
  fontSize: number;
  op: number;
  blur?: number;
}> = ({ text, w, S, fontSize, op, blur = 0 }) => (
  <div
    style={{
      position: 'absolute',
      left: S.w / 2 + w.x,
      top: S.h / 2 + w.y,
      transform: `translate(-50%, -50%) scale(${w.s.toFixed(5)})`,
      whiteSpace: 'nowrap',
      fontFamily: FONT.body,
      fontWeight: 500,
      fontSize,
      lineHeight: 1.22,
      letterSpacing: '-0.01em',
      color: C.emberLit,
      opacity: op,
      filter: blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : undefined,
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
  op: number;
  /** screen px */
  blur: number;
}> = ({ S, G, L, cam, op, blur }) => {
  const P = screenToWorld(cam, L, S);
  const sw = S.s / cam.z;
  const local = blur / S.s;
  const m = S.morph;
  // the outgoing face softens as it hands over, so the two cuts never read as a double
  const fadeBlur = m && m.op < 1 ? 2.2 * (1 - m.op) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: P.x - S.w / 2,
        top: P.y - S.h / 2,
        width: S.w,
        height: S.h,
        transform: `rotate(${S.rot.toFixed(3)}deg) scale(${sw.toFixed(5)})`,
        transformOrigin: '50% 50%',
        opacity: op,
        filter: local > 0.25 ? `blur(${local.toFixed(2)}px)` : undefined,
      }}
    >
      <div style={plateStyle(S)} />
      <CardFace w={S.w} h={S.h} ct={G.cardType} p={S.p} row={S.row} />
      <EventFace size={G.face * S.u} op={S.ev} color={C.white} dotColor={C.white} />
      {m ? (
        <>
          <MarkWord text={BOOKING.day} w={m.wed} S={S} fontSize={G.mark.fontSize} op={m.op} blur={fadeBlur} />
          {m.at.op > 0.001 ? (
            <MarkWord text={BOOKING.at} w={m.at} S={S} fontSize={G.mark.fontSize} op={m.op * m.at.op} blur={m.at.blur} />
          ) : null}
          {m.sep.op > 0.001 ? (
            <MarkWord text={BOOKING.sep} w={m.sep} S={S} fontSize={G.mark.fontSize} op={m.op * m.sep.op} blur={Math.max(m.sep.blur, fadeBlur)} />
          ) : null}
          <MarkWord text={BOOKING.time} w={m.num} S={S} fontSize={G.mark.fontSize} op={m.op} blur={fadeBlur} />
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
}> = ({ t, G, T, L, cam, MM }) => {
  if (t < 0 || t >= RESULT.land) return null;
  // t = 0: the call's own mark, untouched (pixel-identical hand-over)
  if (t === 0) return <BookedMark color={C.emberLit} />;
  const S = cardAt(t, G, L, T, MM);
  const speed = cardSpeed(t, G, L, T, MM);
  // shutter: up to ~1 frame behind the card at full speed
  const shutter = Math.min(1, speed / 40);
  const n = speed > 6 ? 6 : 0;
  const ghosts = Array.from({ length: n }, (_, i) => {
    const k = (i + 1) / n;
    return { tt: t - shutter * k, op: 0.3 * (1 - k) ** 1.3 };
  });
  const blur = Math.min(5, speed * 0.05);
  return (
    <>
      {ghosts
        .slice()
        .reverse()
        .map((g, i) => (
          <Card key={`g${i}`} S={cardAt(g.tt, G, L, T, MM)} G={G} L={L} cam={cam} op={g.op} blur={blur * 1.4} />
        ))}
      <Card S={S} G={G} L={L} cam={cam} op={n ? 0.92 : 1} blur={blur} />
    </>
  );
};

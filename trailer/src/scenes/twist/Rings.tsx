/**
 * The site's "wave" (as the hook draws it): two thin rings,
 * rgb(185 163 255 / .45), leaving the orb 0.3 s apart — scale 0.54 → 1 of
 * 1.85 × the orb, opacity .5 → 0, 0.95 s power2.out. One clean ring each,
 * concentric with the orb (their growth on screen comes from the dive's
 * zoom, so sub-frame copies would only read as a radar). Drawn in screen
 * space around the avatar, whatever size the dive has made it.
 */
import React from 'react';
import { EASE, tween } from '../../lib/motion';

const WAVE = '185,163,255';
const LIFE = 28.5;

export const Rings: React.FC<{
  t: number;
  starts: number[];
  /** orb position + diameter at a (sub)frame */
  orbAt: (t: number) => { x: number; y: number; d: number };
  /** how far the wave travels (screen px diameter) at a (sub)frame — the
   *  hook draws its rings huge; here they leave the phone into the room */
  reach: (t: number) => number;
  /** 0..1 global fade (the hand-over frames stay still) */
  fade?: number;
}> = ({ t, starts, orbAt, reach, fade = 1 }) => {
  const ringAt = (tt: number, start: number) => {
    const u = Math.min(1, Math.max(0, (tt - start) / LIFE));
    const e = 1 - (1 - u) * (1 - u);
    const o = orbAt(tt);
    const d0 = o.d * 1.25;
    const d = d0 + (Math.max(d0, reach(tt)) - d0) * e;
    const born = tween(tt, [start, start + 1.5], [0, 1], EASE.out3);
    return { x: o.x, y: o.y, d, op: born * (1 - e) * fade };
  };
  return (
    <>
      {starts.map((start, i) => {
        if (t < start || t > start + LIFE) return null;
        const r = ringAt(t, start);
        const ring = (x: number, y: number, d: number, o: number, key: string) => (
          <div
            key={key}
            style={{
              position: 'absolute',
              left: x - d / 2,
              top: y - d / 2,
              width: d,
              height: d,
              borderRadius: '50%',
              border: `1.75px solid rgba(${WAVE},0.45)`,
              boxShadow: `0 0 18px rgba(${WAVE},0.14), inset 0 0 18px rgba(${WAVE},0.10)`,
              opacity: Math.min(1, o),
              boxSizing: 'border-box',
            }}
          />
        );
        return (
          <React.Fragment key={i}>{ring(r.x, r.y, r.d, r.op, 'main')}</React.Fragment>
        );
      })}
    </>
  );
};

/**
 * A single tight ring burst off the avatar over [a, b]: `w` px lilac,
 * `op` → 0, 1× → `to`× the orb's diameter, power3.out. Two sub-frame copies
 * while it is fast: a smear, not a comb. Used for
 *   ring3     (TWIST_LOCAL.ring3)    1.5 px, 40 %, → 2.6× — the screen is never
 *             empty before the pickup (whose ring, ON the cut, is the call's)
 *   avatarPop (TWIST_LOCAL.avatarPop) the orb's pop onto the lit screen
 */
export const Burst: React.FC<{
  t: number;
  span: readonly [number, number];
  orbAt: (t: number) => { x: number; y: number; d: number };
  to: number;
  op: number;
  w?: number;
}> = ({ t, span: [a, b], orbAt, to, op: op0, w = 1.5 }) => {
  if (t < a || t > b) return null;
  const at = (tt: number) => {
    const u = Math.min(1, Math.max(0, (tt - a) / (b - a)));
    const e = EASE.out3(u);
    const o = orbAt(tt);
    return { x: o.x, y: o.y, d: o.d * (1 + (to - 1) * e), op: op0 * (1 - e) * tween(tt, [a, a + 1], [0, 1], EASE.out3) };
  };
  const r = at(t);
  const speed = Math.abs(r.d - at(t - 0.5).d) * 2;
  const copies = speed > 12 ? [0.25, 0.5] : [];
  const ring = (c: ReturnType<typeof at>, o: number, key: string) => (
    <div
      key={key}
      style={{
        position: 'absolute',
        left: c.x - c.d / 2,
        top: c.y - c.d / 2,
        width: c.d,
        height: c.d,
        borderRadius: '50%',
        border: `${w}px solid rgb(${WAVE})`,
        boxShadow: `0 0 16px rgba(${WAVE},0.22), inset 0 0 16px rgba(${WAVE},0.12)`,
        boxSizing: 'border-box',
        opacity: Math.min(1, o),
      }}
    />
  );
  return (
    <>
      {copies.map((k, i) => ring(at(t - k), r.op * (0.4 - i * 0.14), `c${i}`))}
      {ring(r, r.op, 'main')}
    </>
  );
};

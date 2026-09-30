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

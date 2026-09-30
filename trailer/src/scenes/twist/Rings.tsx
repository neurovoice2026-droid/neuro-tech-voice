/**
 * The site's "wave" (as the hook draws it): two thin rings,
 * rgb(185 163 255 / .45), leaving the orb 0.3 s apart — scale 0.54 → 1 of
 * 1.85 × the orb, opacity .5 → 0, 0.95 s power2.out. Fast expansion gets a
 * radial smear (trailing copies at sub-frame positions). Drawn in screen
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
}> = ({ t, starts, orbAt }) => {
  const ringAt = (tt: number, start: number) => {
    const u = Math.min(1, Math.max(0, (tt - start) / LIFE));
    const e = 1 - (1 - u) * (1 - u);
    const o = orbAt(tt);
    const d = o.d * 1.85 * (0.54 + 0.46 * e);
    const born = tween(tt, [start, start + 1.5], [0, 1], EASE.out3);
    return { x: o.x, y: o.y, d, op: 0.5 * born * (1 - e) * 2 };
  };
  return (
    <>
      {starts.map((start, i) => {
        if (t < start || t > start + LIFE) return null;
        const r = ringAt(t, start);
        const prev = ringAt(t - 0.5, start);
        const speed = Math.abs(r.d - prev.d) * 2;
        const copies = speed > 8 ? [0.25, 0.5, 0.75] : [];
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
          <React.Fragment key={i}>
            {copies.map((k, j) => {
              const c = ringAt(t - k, start);
              return ring(c.x, c.y, c.d, r.op * (0.5 - j * 0.14), `c${j}`);
            })}
            {ring(r.x, r.y, r.d, r.op, 'main')}
          </React.Fragment>
        );
      })}
    </>
  );
};

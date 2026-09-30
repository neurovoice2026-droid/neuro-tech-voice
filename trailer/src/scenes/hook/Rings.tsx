/**
 * The site's "wave": thin rings (1.5–2 px, rgb(185 163 255 / .45)) that
 * leave the orb when the phone rings (power2.out, opacity falling). Here
 * they are drawn huge, and at the freeze they stop and HANG, catching a
 * little light. Fast expansion gets a radial smear: trailing copies at
 * sub-frame positions (a 0.75-frame shutter).
 */
import React from 'react';
import { EASE, tween } from '../../lib/motion';
import { clamp01 } from './warp';

const WAVE = '185,163,255';
const LIFE = 28.5; // 0.95 s, as on the site

export type RingSpec = {
  start: number; // world-time frame it leaves the orb
  hang: number; // opacity it hangs at once time stops
};

export const Rings: React.FC<{
  frame: number; // real frame
  tau: (f: number) => number; // world time of a (sub)frame
  rings: RingSpec[];
  cx: number;
  cy: number;
  d0: number;
  d1: number;
  freeze: number;
  /** frame the hanging rings have faded to 70 % by */
  decayEnd: number;
  /** 0..1 end: inhale + fade. */
  out: number;
  inhale: number;
  /** diameter the light shock reaches (fast, short-lived). */
  shockD: number;
}> = ({ frame, tau, rings, cx, cy, d0, d1, freeze, decayEnd, out, inhale, shockD }) => {
  const frozen = tween(frame, [freeze, freeze + 6], [0, 1], EASE.house);
  const freezeFlash = frame >= freeze ? Math.exp(-(frame - freeze) / 2.2) * tween(frame, [freeze - 1, freeze], [0, 1]) : 0;
  const hangDecay = 1 - 0.3 * tween(frame, [freeze, decayEnd], [0, 1], EASE.inOut);

  const state = (t: number, start: number) => {
    const u = clamp01((t - start) / LIFE);
    const e = 1 - Math.pow(1 - u, 2); // power2.out
    const d = d0 + (d1 - d0) * e;
    const born = tween(t, [start, start + 1.5], [0, 1], EASE.out3);
    return { d, live: born * (1 - e), started: t >= start };
  };

  return (
    <>
      {rings.map((r, i) => {
        const t = tau(frame);
        const s = state(t, r.start);
        if (!s.started) return null;
        const opacity =
          (s.live * (1 - frozen) + r.hang * hangDecay * frozen + freezeFlash * 0.55 * frozen) * (1 - out);
        if (opacity < 0.004) return null;
        const d = s.d * (1 - 0.07 * inhale);
        // radial motion blur: a smear band from where the ring was 0.75 frame ago
        const dPrev = state(tau(frame - 0.75), r.start).d * (1 - 0.07 * inhale);
        // fresh rings are a touch heavier and brighter; they thin as they travel
        const young = Math.max(0, 1 - (t - r.start) / 10) * (1 - frozen);
        const width = 1.75 + 1.1 * young + 0.5 * freezeFlash;
        const alpha = 0.45 + 0.25 * young;
        const ring = (dd: number, o: number, key: string) => (
          <div
            key={key}
            style={{
              position: 'absolute',
              left: cx - dd / 2,
              top: cy - dd / 2,
              width: dd,
              height: dd,
              borderRadius: '50%',
              border: `${width.toFixed(2)}px solid rgba(${WAVE},${alpha.toFixed(3)})`,
              boxShadow: `0 0 18px rgba(${WAVE},0.14), inset 0 0 18px rgba(${WAVE},0.10)`,
              opacity: o,
              boxSizing: 'border-box',
            }}
          />
        );
        const x = t - r.start;
        const shockP = x >= 0 && x < 9 ? EASE.expo(x / 9) : -1;
        const shock =
          shockP >= 0 ? (
            <div
              key="shock"
              style={{
                position: 'absolute',
                left: cx - (d0 + (shockD - d0) * shockP) / 2,
                top: cy - (d0 + (shockD - d0) * shockP) / 2,
                width: d0 + (shockD - d0) * shockP,
                height: d0 + (shockD - d0) * shockP,
                borderRadius: '50%',
                background: `radial-gradient(closest-side, rgba(${WAVE},0) 55%, rgba(${WAVE},${(0.5 * (1 - shockP) * (i === 0 ? 1 : 0.7)).toFixed(3)}) 84%, rgba(${WAVE},0) 100%)`,
                opacity: 1 - out,
              }}
            />
          ) : null;
        return (
          <React.Fragment key={i}>
            {shock}
            {d - dPrev > 4 ? (
              <div
                key="smear"
                style={{
                  position: 'absolute',
                  left: cx - d / 2,
                  top: cy - d / 2,
                  width: d,
                  height: d,
                  borderRadius: '50%',
                  background: `radial-gradient(closest-side, rgba(${WAVE},0) ${((dPrev / d) * 100).toFixed(2)}%, rgba(${WAVE},${(0.3 * alpha).toFixed(3)}) 98.5%, rgba(${WAVE},0) 100%)`,
                  opacity,
                }}
              />
            ) : null}
            {ring(d, opacity, 'main')}
          </React.Fragment>
        );
      })}
    </>
  );
};

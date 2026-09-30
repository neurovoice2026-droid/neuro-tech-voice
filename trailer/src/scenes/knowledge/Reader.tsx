/**
 * The reader: ONE WebGL FluidOrb (the site's shader), its glow and its
 * contact shadow. It rises out of the heading's place (scale 0 → 1.06 → 1,
 * a ring ripples off the arrival), listens to the caller's real envelope,
 * reads (small pulses), cools to the grey 'miss' palette, and breathes with
 * Ava's real envelope as she answers.
 */
import React from 'react';
import { spring } from 'remotion';
import { flowTime, Orb } from '../../components/Orb';
import { breathe, EASE, tween } from '../../lib/motion';
import { ORB } from '../../theme';
import { FPS, KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { ORB_MISS, VOL, type Geo } from './geometry';
import { volumeAt } from './voice';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;
/** ζ ≈ .67: one ~6 % overshoot */
const RISE = { stiffness: 210, damping: 19.5, mass: 1 };

export const greyAt = (t: number) => tween(t, KL.toGrey, [0, 1], EASE.inOut);

export const Reader: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  if (t < KL.orbIn - 1) return null;
  const O = G.orb;
  const p = t < KL.orbIn ? 0 : spring({ frame: t - KL.orbIn, fps: FPS, config: RISE });
  const grey = greyAt(t);
  const vol = volumeAt(t);
  const speak = t >= K.answer ? Math.max(0, (vol - VOL.miss) / 0.65) : 0;
  const bob = breathe(t, 84, 3.2) * Math.min(1, Math.max(0, p));
  const sc = Math.max(0, p) * (1 + 0.035 * speak);
  const lift = (1 - Math.min(1, Math.max(0, p))) * 22;
  const glowA = 0.18 * (0.85 + 0.9 * Math.max(0, vol - VOL.miss)) * Math.min(1, Math.max(0, p));
  const gr = Math.round(124 + (107 - 124) * grey);
  const gg = Math.round(58 + (104 - 58) * grey);
  const gb = Math.round(237 + (120 - 237) * grey);

  // the contact shadow sits under the orb's CURRENT size, and tightens as it bobs down
  const sk = Math.min(1.06, Math.max(0, sc));
  const bottom = O.y + (O.d / 2) * sk + lift;
  const shW = O.d * 0.82 * sk * (1 - 0.015 * bob);
  const shH = O.d * 0.15 * sk;

  // the arrival ring: off the orb's rim as it lands (from its overshoot)
  const ringQ = tween(t, [KL.orbIn + 4, KL.orbIn + 20], [0, 1], EASE.out3);
  const ringO = t > KL.orbIn + 4 && ringQ < 1 ? 0.38 * (1 - ringQ) : 0;
  const ringD = O.d * (1.02 + 0.6 * ringQ);
  // the miss: a grey ring closes in on the reader as it goes quiet
  const missQ = tween(t, [K.miss, K.miss + 12], [0, 1], EASE.inOut);
  const missO = t > K.miss && missQ < 1 ? 0.34 * Math.sin(Math.PI * missQ) : 0;
  const missD = O.d * (1.5 - 0.46 * missQ);

  // the shader mixes found → miss; its CSS stand-in (under the canvas, seen
  // only at the anti-aliased rim) takes whichever palette leads
  const pal = grey < 0.5 ? ORB.found : ORB_MISS;
  const palB = grey < 0.5 ? ORB_MISS : ORB.found;
  const mixB = grey < 0.5 ? grey : 1 - grey;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: O.x - shW / 2,
          top: bottom + bob * 0.4 - shH * 0.45,
          width: shW,
          height: shH,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(24,16,40,0.18), rgba(24,16,40,0.08) 55%, rgba(24,16,40,0))',
          opacity: Math.min(1, sk),
        }}
      />
      {ringO > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: O.x - ringD / 2,
            top: O.y - ringD / 2,
            width: ringD,
            height: ringD,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 2px rgba(124,58,237,${ringO.toFixed(3)})`,
          }}
        />
      ) : null}
      {missO > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: O.x - missD / 2,
            top: O.y - missD / 2 + bob,
            width: missD,
            height: missD,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 2px rgba(107,104,120,${missO.toFixed(3)})`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: O.x - O.d / 2,
          top: O.y - O.d / 2,
          width: O.d,
          height: O.d,
          transform: `translateY(${(lift + bob).toFixed(2)}px) scale(${sc.toFixed(4)})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            boxShadow: `0 0 80px rgba(${gr},${gg},${gb},${glowA.toFixed(3)})`,
          }}
        />
        <Orb
          size={O.d}
          palette={pal}
          paletteB={palB}
          mixB={mixB}
          volume={vol}
          time={flowTime(Math.max(0, Math.round(t)), volumeAt)}
        />
      </div>
    </div>
  );
};

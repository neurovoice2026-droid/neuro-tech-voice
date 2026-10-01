/**
 * The reader: ONE WebGL FluidOrb (the site's shader) in the SUNDAY light —
 * the room's key light (its colour is the aqua pool on the wall, Stage.tsx
 * Room). Here: the orb, its rim of light, and two quiet rings.
 *
 *   orbIn − 3   a seed of Sunday light gathers where the orb will be…
 *   orbIn       …and the orb springs out of it (0 → 1.06 → 1) and a fine
 *               ring leaves its rim as it lands
 *   caller      the `listen` twin; the orb follows the caller's REAL envelope
 *   scan        small reading pulses
 *   miss        the drained Sunday mesh (a teal undertone survives): the light
 *               drains, the fluid (which churned through the search) settles
 *   answer      grey through her hum (it still breathes with it); on her
 *               first word the Sunday light floods back (one ring leaves the
 *               rim) and the orb breathes with HER real envelope, swelling
 *               slightly as she speaks, pushing in 1 → 1.05
 *
 * The canvas is drawn at CSS size × 1.5 × devicePixelRatio, so the orb is
 * sharp in the 4K master (--scale 2).
 */
import React from 'react';
import { flowTime, Orb } from '../../components/Orb';
import { bloom, rgba, rimGlow } from '../../lib/lights';
import { breathe, EASE, springUnit, tween } from '../../lib/motion';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { flashAt } from './pulse';
import { SUN, VOL, type Geo } from './geometry';
import { glowAt, greyAt, missPhase, orbPalette, relitAt } from './light';
import { volumeAt } from './voice';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;
/** ζ ≈ .67: one ~6 % overshoot */
const RISE = { stiffness: 210, damping: 19.5, mass: 1 };

/** the orb's rise (0 → ~1.06 → 1); 0 before orbIn */
export const riseAt = (t: number) => springUnit(t - KL.orbIn, RISE);

/** the canvas's device-pixel ratio (the 4K masters render at --scale 2) */
const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

const Ring: React.FC<{ x: number; y: number; d: number; color: string; w?: number }> = ({ x, y, d, color, w = 1.5 }) => (
  <div
    style={{
      position: 'absolute',
      left: x - d / 2,
      top: y - d / 2,
      width: d,
      height: d,
      borderRadius: '50%',
      boxShadow: `inset 0 0 0 ${w}px ${color}`,
    }}
  />
);

export const Reader: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  if (t < KL.orbIn - 3) return null;
  const O = G.orb;
  const p = riseAt(t);
  const pc = Math.min(1, Math.max(0, p));
  const grey = greyAt(t);
  const relit = relitAt(t);
  const glow = glowAt(t);
  const vol = volumeAt(t);
  const speak = t >= K.answer ? Math.max(0, (vol - VOL.rest) / 0.6) : 0;
  const bob = breathe(t, 84, 3.2) * pc;
  // through her answer the reader slowly comes closer (1 → 1.05)
  const push = 1 + 0.05 * tween(t, KL.orbPush, [0, 1], EASE.inOut);
  const sc = Math.max(0, p) * (1 + 0.05 * speak) * push;
  const lift = (1 - pc) * 22;

  // the seed: 3 f of Sunday light gathering before the orb springs out of it
  const seedQ = t < KL.orbIn ? (t - (KL.orbIn - 3)) / 3 : 0;
  const seedO = t < KL.orbIn ? Math.sin((Math.PI / 2) * seedQ) : Math.max(0, 1 - (t - KL.orbIn) / 3);
  const seedD = 30 * (1 - 0.25 * seedQ);

  // the arrival ring: off the orb's rim as it lands (from its overshoot)
  const ringQ = tween(t, [KL.orbIn + 4, KL.orbIn + 22], [0, 1], EASE.out3);
  const ringO = t > KL.orbIn + 4 && ringQ < 1 ? 0.4 * (1 - ringQ) : 0;
  // the relight: her light leaves the rim in one ring
  const rlA = KL.relight[0] + 2;
  const rlQ = tween(t, [rlA, rlA + 20], [0, 1], EASE.out3);
  const rlO = t > rlA && rlQ < 1 ? 0.4 * (1 - rlQ) * relit : 0;

  const flashIn = flashAt(t, KL.orbIn + 3, 6);
  const flashRelight = flashAt(t, KL.relight[0] + 2, 8) * relit;
  const rim = (0.2 + 0.18 * flashIn + 0.16 * flashRelight + 0.22 * Math.max(0, vol - VOL.rest)) * (1 - 0.45 * grey);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* the seed of light the orb springs out of */}
      {seedO > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: O.x - seedD * 2,
            top: O.y - seedD * 2,
            width: seedD * 4,
            height: seedD * 4,
            background: bloom(glow, 1.1 * seedO, { core: 1, coreSize: 0.3 }),
          }}
        />
      ) : null}
      {ringO > 0.002 ? <Ring x={O.x} y={O.y + bob} d={O.d * (1.03 + 0.5 * ringQ)} color={rgba(SUN.orb[2], ringO)} /> : null}
      {rlO > 0.002 ? <Ring x={O.x} y={O.y + bob} d={O.d * push * (1.03 + 0.55 * rlQ)} color={rgba(SUN.orb[2], rlO)} /> : null}
      <div
        style={{
          position: 'absolute',
          left: O.x - O.d / 2,
          top: O.y - O.d / 2,
          width: O.d,
          height: O.d,
          transform: `translateY(${(lift + bob).toFixed(3)}px) scale(${sc.toFixed(5)})`,
        }}
      >
        {/* the rim: a halo in the light's core + its body spill (never on the canvas; no drop shadow — it is a light) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            boxShadow: rimGlow(glow, rim, O.d / 400, { shadow: 0 }),
          }}
        />
        <Orb
          size={O.d}
          palette={orbPalette(t)}
          volume={vol}
          time={flowTime(Math.max(0, t), volumeAt) + missPhase(t)}
          resolution={1.5 * dpr()}
        />
      </div>
    </div>
  );
};

/**
 * The reader: ONE WebGL FluidOrb (the site's shader) in the SUNDAY light,
 * with its bloom, its rim and its contact shadow.
 *
 *   orbIn − 2   a seed of Sunday light inhales where the orb will be…
 *   orbIn       …and the orb springs out of it (0 → 1.06 → 1): a bloom
 *               flash, a ring off its rim, a camera kick (in Knowledge.tsx)
 *   caller      the `listen` twin; the orb follows the caller's REAL envelope
 *   scan        small reading pulses; a spark where each beam lands
 *   miss        the drained Sunday mesh (a teal undertone survives): the light
 *               drains, the fluid (which churned through the search) settles,
 *               a grey ring closes in
 *   answer      grey through her hum (it still breathes with it); on her
 *               first word the Sunday light floods back (rings leave, the
 *               bloom swells) and the orb breathes with HER real envelope,
 *               swelling slightly as she speaks, pushing in 1 → 1.05
 */
import React from 'react';
import { spring } from 'remotion';
import { flowTime, Orb } from '../../components/Orb';
import { bloom, rgba, rimGlow } from '../../lib/lights';
import { breathe, EASE, tween } from '../../lib/motion';
import { FPS, KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { flashAt, lifeAt } from './blur';
import { SUN, VOL, type Geo } from './geometry';
import { glowAt, greyAt, missPhase, orbPalette, relitAt } from './light';
import { volumeAt } from './voice';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;
/** ζ ≈ .67: one ~6 % overshoot */
const RISE = { stiffness: 210, damping: 19.5, mass: 1 };

/** the orb's rise (0 → ~1.06 → 1); 0 before orbIn */
export const riseAt = (t: number) => (t < KL.orbIn ? 0 : spring({ frame: t - KL.orbIn, fps: FPS, config: RISE }));

const Ring: React.FC<{ x: number; y: number; d: number; color: string; w?: number }> = ({ x, y, d, color, w = 2 }) => (
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

/** `part`: 'light' = the pool of light behind it (drawn under the type), 'orb' = everything else */
export const Reader: React.FC<{ t: number; G: Geo; part: 'light' | 'orb' }> = ({ t, G, part }) => {
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

  // the seed: 2 f of Sunday light gathering (inhale) before the orb springs out of it
  const seedQ = t < KL.orbIn ? (t - (KL.orbIn - 3)) / 3 : 0;
  const seedO = t < KL.orbIn ? Math.sin((Math.PI / 2) * seedQ) : Math.max(0, 1 - (t - KL.orbIn) / 3);
  const seedD = 34 * (1 - 0.25 * seedQ);

  // the light pool behind the orb (the pale room: normal blend)
  const flashIn = flashAt(t, KL.orbIn + 3, 6);
  const flashRelight = flashAt(t, KL.relight[0] + 2, 8) * relit;
  const flashMiss = flashAt(t, KL.missFlip, 5);
  const pool =
    (0.42 * pc + 0.75 * flashIn + 0.5 * flashRelight + 0.5 * Math.max(0, vol - VOL.rest) + 0.15 * flashMiss) * (1 - 0.55 * grey);
  const BD = O.d * 3.1 * push;

  // the contact shadow sits under the orb's CURRENT size, and tightens as it bobs down
  const sk = Math.min(1.06, Math.max(0, sc));
  const bottom = O.y + (O.d / 2) * sk + lift;
  const shW = O.d * 0.82 * sk * (1 - 0.015 * bob);
  const shH = O.d * 0.15 * sk;
  const deep = SUN.orb[0];

  // the arrival ring: off the orb's rim as it lands (from its overshoot)
  const ringQ = tween(t, [KL.orbIn + 4, KL.orbIn + 20], [0, 1], EASE.out3);
  const ringO = t > KL.orbIn + 4 && ringQ < 1 ? 0.5 * (1 - ringQ) : 0;
  // the miss: a grey ring closes in on the reader as it goes quiet
  const missQ = tween(t, [K.miss, K.miss + 12], [0, 1], EASE.inOut);
  const missO = t > K.miss && missQ < 1 ? 0.34 * Math.sin(Math.PI * missQ) : 0;
  const missD = O.d * (1.5 - 0.46 * missQ);
  // the relight: her light leaves the rim in two rings
  const rl = (k: number) => {
    const a = KL.relight[0] + 2 + k * 4;
    const q = tween(t, [a, a + 16], [0, 1], EASE.out3);
    return { o: t > a && q < 1 ? (0.5 - 0.18 * k) * (1 - q) : 0, d: O.d * (1.02 + (0.55 + 0.2 * k) * q) };
  };

  if (part === 'light') {
    return pool > 0.004 ? (
      <div
        style={{
          position: 'absolute',
          left: O.x - BD / 2,
          top: O.y - BD / 2 + bob * 0.5,
          width: BD,
          height: BD,
          background: bloom(glow, pool, { core: 0.5, coreSize: 0.36 }),
        }}
      />
    ) : null;
  }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* the contact shadow (tinted with the light's deep) */}
      <div
        style={{
          position: 'absolute',
          left: O.x - shW / 2,
          top: bottom + bob * 0.4 - shH * 0.45,
          width: shW,
          height: shH,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${rgba(deep, 0.2)}, ${rgba(deep, 0.08)} 55%, ${rgba(deep, 0)})`,
          opacity: Math.min(1, sk),
        }}
      />
      {/* the seed of light the orb springs out of */}
      {seedO > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: O.x - seedD * 2,
            top: O.y - seedD * 2,
            width: seedD * 4,
            height: seedD * 4,
            background: bloom(glow, 1.2 * seedO, { core: 1, coreSize: 0.3 }),
          }}
        />
      ) : null}
      {ringO > 0 ? <Ring x={O.x} y={O.y + bob} d={O.d * (1.02 + 0.6 * ringQ)} color={rgba(SUN.orb[2], ringO)} /> : null}
      {missO > 0 ? <Ring x={O.x} y={O.y + bob} d={missD} color={`rgba(107,104,120,${missO.toFixed(3)})`} /> : null}
      {[0, 1].map((k) => {
        const r = rl(k);
        return r.o > 0 ? <Ring key={k} x={O.x} y={O.y + bob} d={r.d} color={rgba(SUN.orb[2], r.o)} w={2.5 - k} /> : null;
      })}
      {/* beam landings: a spark of light where each head reaches the rim */}
      {KL.beamLand.map((f, i) => {
        const life = lifeAt(t, f - 1, f + 7);
        if (life <= 0) return null;
        const e = G.beams[i].p3;
        const d = 18 + 26 * life;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: e.x - d,
              top: e.y - d + bob,
              width: d * 2,
              height: d * 2,
              background: bloom(glow, 1.1 * life * (1 - grey), { core: 1, coreSize: 0.34 }),
            }}
          />
        );
      })}
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
        {/* the rim: a halo in the light's core + its body spill (never on the canvas) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            boxShadow: rimGlow(glow, (0.26 + 0.3 * flashIn + 0.25 * flashRelight + 0.3 * Math.max(0, vol - VOL.rest)) * (1 - 0.5 * grey), O.d / 400, {
              shadow: 0.35 * pc,
            }),
          }}
        />
        <Orb size={O.d} palette={orbPalette(t)} volume={vol} time={flowTime(Math.max(0, t), volumeAt) + missPhase(t)} />
      </div>
    </div>
  );
};

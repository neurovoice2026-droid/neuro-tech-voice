/**
 * b09–b11's GROUND — b08's ground carried on (scenes/written/Ground.tsx after its wipe: KB_MESH, HER_GROUND's lift
 * and seed, b06's ground plane, her key light on the orb): frame 0 is b08's last frame.
 *
 * STOP-TIME (b10): the mesh's own clock decelerates to a standstill on the freeze and picks up again on the resume
 * (its pools stop drifting — time has stopped for the call; only Ava, explaining, still moves), and its colour eases
 * down a touch (× .9 chroma) while it is held. The clock is the integral of a speed that eases 1 → 0 → 1 (smoothstep
 * ramps, closed form): no jump in position, ever.
 *
 * The key light follows her orb wherever it goes (pulled pool + sunday wash at its source); it shrinks with her into
 * the label's dot and comes back with her.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MeshGround } from '../../kit';
import { MOMENT_LIGHTS } from '../../palettes';
import { CALL_LOCAL as C, SCENES } from '../../timing';
import { HER_GROUND } from '../turn/Ground';
import { groundPlane, KEY } from '../written/Ground';
import { ease, type CallStage } from './stage';

const SUNDAY_BODY = MOMENT_LIGHTS.sunday.orb[2];
/** frames the clock takes to stop / to get going again */
const RAMP = 10;

/** ∫₀ᵘ (1 − smoothstep) — the distance covered while slowing down over a unit ramp */
const slowArea = (u: number) => u - (u * u * u - (u * u * u * u) / 2);
/** the mesh's act-local clock: real time until the freeze, held through the stop-time, real time again after */
export function groundClock(t: number): number {
  const a = C.freeze;
  const b = C.resume;
  if (t <= a) return t;
  const stopped = a + RAMP * slowArea(1); // where it comes to rest (a + RAMP/2)
  if (t < a + RAMP) return a + RAMP * slowArea((t - a) / RAMP);
  if (t <= b) return stopped;
  // speeding up again: ∫ smoothstep = u³ − u⁴/2
  if (t < b + RAMP) {
    const u = (t - b) / RAMP;
    return stopped + RAMP * (u * u * u - (u * u * u * u) / 2);
  }
  return stopped + RAMP * 0.5 + (t - b - RAMP);
}

export const CallGround: React.FC<{ t: number; S: CallStage; orb: { x: number; y: number; d: number } }> = ({ t, S, orb }) => {
  const v = S.vertical;
  const plane = groundPlane(v, S.W, S.H);
  const clock = SCENES.call.from + groundClock(t);
  const key = plane.toPlane(orb.x, orb.y);
  // her light scales with her: full at b08's size and above, smaller in the dot
  const k = Math.min(1, Math.max(0.35, orb.d / S.from.orb.d));
  const held = ease(t, C.freeze, C.freeze + 14) * (1 - ease(t, C.resume, C.resume + 14));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: plane.css, transformOrigin: '50% 50%' }}>
        <MeshGround
          t={clock}
          palette={HER_GROUND.palette}
          lift={HER_GROUND.lift}
          seed={HER_GROUND.seed}
          saturation={1 - 0.1 * held}
          keyLight={{ x: key.x, y: key.y, strength: KEY * k, color: SUNDAY_BODY, radius: (v ? 620 : 680) * (0.7 + 0.3 * k) }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

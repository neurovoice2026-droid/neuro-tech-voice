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
import { groundPlane } from '../written/Ground';
import { callKey, ease, groundClock, type CallStage } from './stage';

export { groundClock };

const SUNDAY_BODY = MOMENT_LIGHTS.sunday.orb[2];
export const CallGround: React.FC<{ t: number; S: CallStage; orb: { x: number; y: number; d: number } }> = ({ t, S, orb }) => {
  const v = S.vertical;
  const plane = groundPlane(v, S.W, S.H);
  const clock = SCENES.call.from + groundClock(t);
  const key = plane.toPlane(orb.x, orb.y);
  const ck = callKey(S, orb.d);
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
          keyLight={{ x: key.x, y: key.y, strength: ck.strength, color: SUNDAY_BODY, radius: ck.radius }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

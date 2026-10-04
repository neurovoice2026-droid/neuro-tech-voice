/**
 * b12's GROUND — b11's ground carried on (scenes/call/Ground.tsx: KB_MESH with HER_GROUND's lift and seed, b06's ground
 * plane, her key light on the orb), frame 0 exactly its last frame: the same mesh clock (call/stage.ts callEnd().ground
 * .meshClock — it trails the timeline by b10's stop-time), the same plane, the same key (callKey).
 *
 * The key light follows her orb to its corner and takes its light from it: it scales with her (as in b11) and dims with
 * her while the owner types (the owner's moment — the light is hers), relighting on her first word.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MeshGround } from '../../kit';
import { MOMENT_LIGHTS } from '../../palettes';
import { callKey } from '../call/stage';
import { HER_GROUND } from '../turn/Ground';
import { groundPlane } from '../written/Ground';
import { callStageOf, lerp, orbLit, type LineStage } from './stage';

const SUNDAY_BODY = MOMENT_LIGHTS.sunday.orb[2];

export const LineGround: React.FC<{ t: number; S: LineStage; orb: { x: number; y: number; d: number } }> = ({ t, S, orb }) => {
  const v = S.vertical;
  const plane = groundPlane(v, S.W, S.H);
  // b11's mesh clock trails the timeline by its stop-time: continue it from callEnd().ground.meshClock
  const clock = S.from.ground.meshClock + t;
  const key = plane.toPlane(orb.x, orb.y);
  // b11's key for an orb of this size (call/stage.ts callKey: full at b08's size, smaller with her)
  const ck = callKey(callStageOf(S), orb.d);
  const lit = orbLit(t);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: plane.css, transformOrigin: '50% 50%' }}>
        <MeshGround
          t={clock}
          palette={HER_GROUND.palette}
          lift={HER_GROUND.lift}
          seed={HER_GROUND.seed}
          keyLight={{ x: key.x, y: key.y, strength: ck.strength * lerp(0.72, 1, lit), color: SUNDAY_BODY, radius: ck.radius }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * b13–b14's GROUND — b12's ground carried on (scenes/line/Ground.tsx: KB_MESH with HER_GROUND's lift and seed, b06's
 * ground plane, her key light on the orb), frame 0 exactly its last frame: the same mesh clock (the call's, its
 * stop-time included — call/stage.ts groundClock run on through b12 and on through here), the same plane, the same key
 * (lit: she has just spoken). The key follows her orb wherever it glides and takes its size from her.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MeshGround } from '../../kit';
import { MOMENT_LIGHTS } from '../../palettes';
import { CALL_LOCAL, SCENES } from '../../timing';
import { callKey, callStage, groundClock } from '../call/stage';
import { HER_GROUND } from '../turn/Ground';
import { groundPlane } from '../written/Ground';
import { lineClockT, type ChangeStage } from './stage';

const SUNDAY_BODY = MOMENT_LIGHTS.sunday.orb[2];

/** the mesh's absolute clock at this act's frame t (continuous from b11 → b12 → here) */
export const changeMeshClock = (t: number) => SCENES.call.from + groundClock(CALL_LOCAL.end + lineClockT(t));

export const ChangeGround: React.FC<{ t: number; S: ChangeStage; orb: { x: number; y: number; d: number } }> = ({ t, S, orb }) => {
  const v = S.vertical;
  const plane = groundPlane(v, S.W, S.H);
  const key = plane.toPlane(orb.x, orb.y);
  // as line/Ground.tsx: b11's key for an orb of this size (call/stage.ts callKey: full at b08's size and above, smaller
  // with her). fix:change: the SAME function as b12's — 9:16's full-key size is KEY_FULL_D_9x16 since fix:written, not
  // b08's new header orb, so a formula of its own here lit her ground 1.58× brighter than b12's from the cut on
  const ck = callKey(callStage(v), orb.d);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: plane.css, transformOrigin: '50% 50%' }}>
        <MeshGround
          t={changeMeshClock(t)}
          palette={HER_GROUND.palette}
          lift={HER_GROUND.lift}
          seed={HER_GROUND.seed}
          keyLight={{ x: key.x, y: key.y, strength: ck.strength, color: SUNDAY_BODY, radius: ck.radius }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

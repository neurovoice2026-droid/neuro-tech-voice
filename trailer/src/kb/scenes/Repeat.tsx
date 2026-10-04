/**
 * PART I · THE REPEAT (b01–b05, 0–18 s on the plan; every moment from src/kb/timing.ts REPEAT_LOCAL).
 *
 * The desk on the site's "no answer" grey mesh (MUTED_MESH — the grind), lit by ONE source: the clock's
 * rose colon, the line light (LINE 1), the only colour in the act. A person stands at the desk — type on
 * a white card, her sentence stopping on a hanging em dash — and the phone rings three times: three
 * callers, three phrasings, and the same answer each time (kb2-desk-1, the identical file), written on a
 * slip that drops onto a pile. The card steps back a depth on every ring. Then the rest of the day: six
 * rolls of the clock on 8ths, a slip on each, the pile a column. 18.0 (bar): everything stops — the act
 * ends on the hard stop; b06 opens on the same frame, the rose drained (scenes/repeat/desk.ts REPEAT_END).
 *
 * THREE PLANES under one slow push (desk.ts deskCam: zoom 1 → 1.06, leaning toward the pad): the ground
 * (0.2), the desk (0.6: the card, the pad and its pile), the near plane (1.0: the clock, the caller's
 * turn). The camera moves the planes; every text block rides its own small sub-pixel layer while it does.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Camera, Layer } from '../../components/Camera';
import { useLayout } from '../../lib/layout';
import { MeshGround, meshShadowInk } from '../kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../palettes';
import { useKbSceneFrame } from '../scene';
import { REPEAT_LOCAL as R } from '../timing';
import { CallerTurn } from './repeat/CallerTurn';
import { DeskClock } from './repeat/Clock';
import { cardDepth, deskCam, deskLayout, PLANE, roomTint } from './repeat/desk';
import { InPersonCard } from './repeat/InPersonCard';
import { Slips } from './repeat/Slips';

/** the muted mesh, raised for white paper on it (the light variant, a touch of the material kept) */
export const REPEAT_GROUND = { palette: MUTED_MESH, lift: 0.88, seed: 0 } as const;
/** the line light's colour on the ground (the rush orb's body) */
const ROSE = MOMENT_LIGHTS.rush.orb[2];
/** tint → the key's strength (the light variant lays a tint at .6 of it) */
const TINT_K = 4;

/**
 * THE DESK, at any moment (the act's whole picture as a function of `t`, repeat-local = absolute frames).
 * Exported for the neighbour: b06 can mount it on its first frames with `t = REPEAT_LOCAL.hardStop`,
 * `tint = 0` (the rose drained on the stop) and drive `cam` itself from deskCam(hardStop) — the cut is then
 * invisible by construction (desk.ts repeatEndScreen gives the same picture in screen px).
 */
export const RepeatDesk: React.FC<{ t: number; cam?: { x: number; y: number; zoom: number }; tint?: number; moving?: boolean }> = ({ t, cam: camIn, tint: tintIn, moving = true }) => {
  const L = useLayout();
  const v = L.vertical;
  const g = deskLayout(v);
  const cam = camIn ?? deskCam(t, v);
  const depth = cardDepth(t);
  const ink = meshShadowInk(MUTED_MESH);
  const tint = tintIn ?? roomTint(t);
  return (
    <AbsoluteFill>
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom} moving={moving} zooming={moving}>
        <Layer depth={PLANE.ground}>
          <MeshGround
            t={t}
            palette={REPEAT_GROUND.palette}
            lift={REPEAT_GROUND.lift}
            seed={REPEAT_GROUND.seed}
            keyLight={tint > 0 ? { x: g.clock.dotX, y: g.clock.dotY, strength: tint * TINT_K, color: ROSE, radius: L.pick(620, 600) } : null}
          />
        </Layer>
        <Layer depth={PLANE.desk}>
          <InPersonCard t={t} g={g} scale={depth.scale} shade={depth.shade} ink={ink} />
          <Slips t={t} g={g} ink={ink} />
        </Layer>
        <Layer depth={PLANE.near}>
          <DeskClock t={t} g={g} />
          {[0, 1, 2].map((k) => (
            <CallerTurn key={k} t={t} k={k} slot={g.callers[k]} hangup={R.hangups[k]} />
          ))}
        </Layer>
      </Camera>
    </AbsoluteFill>
  );
};

export const Repeat: React.FC = () => {
  // repeat-local = absolute (the act starts at 0); held on the hard stop (the act's last frame)
  const t = Math.min(useKbSceneFrame('repeat'), R.hardStop);
  return <RepeatDesk t={t} />;
};

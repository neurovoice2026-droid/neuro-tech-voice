/**
 * b08's GROUND — the site's gradient mesh (CLIENT DIRECTION v2 §1: "a pool hand-off on the beat, never a
 * dissolve to grey").
 *
 *   0          b07's last ground exactly (scenes/turn/Ground.tsx TurnGround at its last frame): her half on
 *              KB_MESH keyed on her orb, the other half on Part I's muted mesh, the seam the only edge
 *   0 → 2 b    as the seam draws back, HER ground floods the other half: one KB_MESH field (the same clock,
 *              seed, plane and key as her half, so where it lies over her half nothing changes) behind a
 *              gradient mask whose front travels from the seam to past the far edge, its feather widening as
 *              it goes (a many-stop smoothstep — no blur, no visible ring)
 *   after      KB_MESH alone (one canvas), keyed on the orb wherever it is (a sunday wash at its source)
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MeshGround } from '../../kit';
import { MOMENT_LIGHTS } from '../../palettes';
import { SCENES, TURN_LOCAL } from '../../timing';
import { HER_GROUND, TurnGround } from '../turn/Ground';
import { turnStage } from '../turn/stage';
import { stageFor } from '../recording/stage';
import { PLANE } from '../repeat/desk';
import { wipeAt, type WrittenStage } from './stage';

const SUNDAY_BODY = MOMENT_LIGHTS.sunday.orb[2];
/** her key light's strength on her ground (turn/Ground.tsx KEY) */
export const KEY = 0.3;

/** a many-stop smoothstep along one axis: opaque until `a`, clear from `a + f` (px of the frame) */
function wipeMask(vertical: boolean, a: number, f: number) {
  const N = 14;
  const dir = vertical ? 'to bottom' : 'to right';
  if (f < 0.5) return `linear-gradient(${dir}, #000 ${a.toFixed(2)}px, transparent ${a.toFixed(2)}px)`;
  const stops: string[] = [`#000 ${a.toFixed(2)}px`];
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    const al = 1 - u * u * (3 - 2 * u);
    stops.push(`rgba(0,0,0,${al.toFixed(4)}) ${(a + f * u).toFixed(2)}px`);
  }
  return `linear-gradient(${dir}, ${stops.join(', ')})`;
}

/** b07's (and b06's) ground plane: −P0 × .2, zoomed about the centre (turn/Ground.tsx) */
export function groundPlane(vertical: boolean, W: number, H: number) {
  const G = stageFor(vertical);
  const P0 = G.P0;
  const zg = 1 + (P0.zoom - 1) * PLANE.ground;
  const tx = -P0.x * PLANE.ground;
  const ty = -P0.y * PLANE.ground;
  return {
    css: `translate(${tx.toFixed(4)}px, ${ty.toFixed(4)}px) scale(${zg.toFixed(6)})`,
    /** a frame point → the plane's own px (where the canvas paints it) */
    toPlane: (x: number, y: number) => ({ x: W / 2 + (x - W / 2 - tx) / zg, y: H / 2 + (y - H / 2 - ty) / zg }),
  };
}

export const WrittenGround: React.FC<{ t: number; S: WrittenStage; orb: { x: number; y: number } }> = ({ t, S, orb }) => {
  const v = S.vertical;
  const plane = groundPlane(v, S.W, S.H);
  const clock = SCENES.written.from + t;
  const u = wipeAt(t);
  const key = plane.toPlane(orb.x, orb.y);
  const seam = v ? 900 : 960;
  const far = v ? S.H : S.W;
  const F = (v ? 520 : 620) * Math.min(1, u * 2.2);
  const a = seam + (far + 40 - seam) * u;
  const covering = u < 0.999;
  return (
    <AbsoluteFill>
      {covering ? <TurnGround t={TURN_LOCAL.end + t} S={turnStage(v)} /> : null}
      <AbsoluteFill style={covering ? { WebkitMaskImage: wipeMask(v, a, F), maskImage: wipeMask(v, a, F) } : undefined}>
        <AbsoluteFill style={{ transform: plane.css, transformOrigin: '50% 50%' }}>
          <MeshGround
            t={clock}
            palette={HER_GROUND.palette}
            lift={HER_GROUND.lift}
            seed={HER_GROUND.seed}
            keyLight={{ x: key.x, y: key.y, strength: KEY, color: SUNDAY_BODY, radius: v ? 620 : 680 }}
          />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

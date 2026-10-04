/**
 * b07's GROUND — the site's gradient mesh, split by the seam (CLIENT DIRECTION v2 §1: "a pool hand-off on
 * the beat, never a dissolve to grey").
 *
 *   base     Part I's muted mesh exactly as b06 holds it (Repeat's REPEAT_GROUND on the absolute clock, the
 *            ground plane where the slow push left it, the line light's pull at the clock's colon): frame 0
 *            is b06's last frame. The matters half stays on it, neutral, all act.
 *   hers     from "Ava": KB_MESH (the site's knowledge-base indigo → violet → lilac), keyed on her orb (its
 *            light pool pulled onto her, a sunday wash at its source), spreading out FROM the orb over two
 *            beats — a gradient mask, no blur — and held to her half by the seam (a clip on its line).
 *
 * The two canvases share the field's clock, seed and plane transform, so their pools sit in the same places:
 * the seam is the only edge between them.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MeshGround } from '../../kit';
import { KB_MESH, MOMENT_LIGHTS } from '../../palettes';
import { REPEAT_LOCAL, SCENES, TURN_LOCAL as T } from '../../timing';
import { REPEAT_GROUND } from '../Repeat';
import { stageFor } from '../recording/stage';
import { deskLayout, PLANE, roomTint } from '../repeat/desk';
import { groundAt, type TurnStage } from './stage';

/** her ground: the KB mesh raised for white paper on it (a touch more colour than Part I's .88) */
export const HER_GROUND = { palette: KB_MESH, lift: 0.84, seed: 0 } as const;
/** the orb's light on her ground: the sunday body, as a wash and a pull of the light pool */
const SUNDAY_BODY = MOMENT_LIGHTS.sunday.orb[2];
const KEY = 0.3;

/** a smoothstep mask from the orb outwards: opaque to r0, clear by r1 (many stops: no visible ring) */
function spreadMask(x: number, y: number, r0: number, r1: number) {
  const N = 14;
  const stops: string[] = [`#000 ${Math.max(0, r0).toFixed(1)}px`];
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    const a = 1 - u * u * (3 - 2 * u);
    stops.push(`rgba(0,0,0,${a.toFixed(4)}) ${(r0 + (r1 - r0) * u).toFixed(1)}px`);
  }
  return `radial-gradient(circle at ${x.toFixed(1)}px ${y.toFixed(1)}px, ${stops.join(', ')})`;
}

export const TurnGround: React.FC<{ t: number; S: TurnStage }> = ({ t, S }) => {
  const v = S.vertical;
  const g = deskLayout(v);
  const G = stageFor(v);
  // b06's ground plane, held (recording's Recording.tsx: −P0 × 0.2, zoom about the centre)
  const P0 = G.P0;
  const zg = 1 + (P0.zoom - 1) * PLANE.ground;
  const tx = -P0.x * PLANE.ground;
  const ty = -P0.y * PLANE.ground;
  const plane = `translate(${tx.toFixed(4)}px, ${ty.toFixed(4)}px) scale(${zg.toFixed(6)})`;
  // a screen point → the plane's own px (where the canvas paints it)
  const toPlane = (x: number, y: number) => ({ x: S.W / 2 + (x - S.W / 2 - tx) / zg, y: S.H / 2 + (y - S.H / 2 - ty) / zg });
  const clock = SCENES.turn.from + t;
  const u = groundAt(t);
  const o = S.orb;
  const ok = toPlane(o.x, o.y);
  // the spread: from the orb to past her half's farthest corner (S.half = the half as insets from the frame)
  const h = S.half;
  const x0 = h.left;
  const x1 = S.W - h.right;
  const y0 = h.top;
  const y1 = S.H - h.bottom;
  const far = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => Math.hypot(x - o.x, y - o.y)));
  const F = v ? 460 : 560;
  const r1 = (far + F) * u;
  const r0 = r1 - F;
  const clip = `inset(${h.top}px ${h.right}px ${h.bottom}px ${h.left}px)`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: plane, transformOrigin: '50% 50%' }}>
        <MeshGround
          t={clock}
          palette={REPEAT_GROUND.palette}
          lift={REPEAT_GROUND.lift}
          seed={REPEAT_GROUND.seed}
          keyLight={{ x: g.clock.dotX, y: g.clock.dotY, strength: roomTint(REPEAT_LOCAL.hardStop) * 4 }}
        />
      </AbsoluteFill>
      {t >= T.ground[0] - 0.01 ? (
        <AbsoluteFill style={{ clipPath: clip }}>
          <AbsoluteFill
            style={{
              ...(u < 0.999 ? { WebkitMaskImage: spreadMask(o.x, o.y, r0, r1), maskImage: spreadMask(o.x, o.y, r0, r1) } : null),
            }}
          >
            <AbsoluteFill style={{ transform: plane, transformOrigin: '50% 50%' }}>
              <MeshGround
                t={clock}
                palette={HER_GROUND.palette}
                lift={HER_GROUND.lift}
                seed={HER_GROUND.seed}
                keyLight={{ x: ok.x, y: ok.y, strength: KEY, color: SUNDAY_BODY, radius: v ? 620 : 680 }}
              />
            </AbsoluteFill>
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

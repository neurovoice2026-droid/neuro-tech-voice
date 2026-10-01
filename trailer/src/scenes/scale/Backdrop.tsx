/**
 * The white act's room: a paper cyclorama (components/Atmosphere.tsx
 * PaperRoom) lit by ONE big soft light above the frame centre — the wall in
 * shade falls to a warm grey at the edges, nothing else. No tint, no pools
 * of colour, no discs: the cards and the type carry the colour.
 *
 * The light glides very slowly with the act (screen space, behind the
 * camera, so no move can bare an edge): over the wall it sits high and
 * wide; on the languages it settles over the focus card; on the flow it
 * leans towards the rail. Pure gradients — banding is handled by the film
 * grain on top.
 */
import React from 'react';
import { PaperRoom } from '../../components/Atmosphere';
import type { Layout } from '../../lib/layout';
import { EASE, tween } from '../../lib/motion';
import { SCALE_LOCAL } from '../../timing';

const K = SCALE_LOCAL;

export const Room: React.FC<{ t: number; L: Layout }> = ({ t, L }) => {
  const W = L.width;
  const H = L.height;
  // where the softbox points: wall → languages → flow (fractions of the frame)
  const keys = L.pick(
    { wall: [0.5, 0.34], langs: [0.5, 0.4], flow: [0.56, 0.5] },
    { wall: [0.5, 0.4], langs: [0.5, 0.44], flow: [0.5, 0.5] },
  );
  const a = tween(t, [K.flyOut - 6, K.switchIn[0] + 24], [0, 1], EASE.inOut);
  const b = tween(t, [K.collapse, K.stations[1]], [0, 1], EASE.inOut);
  const lerp = (p: readonly number[], q: readonly number[], m: number) => [p[0] + (q[0] - p[0]) * m, p[1] + (q[1] - p[1]) * m];
  const [fx, fy] = lerp(lerp(keys.wall, keys.langs, a), keys.flow, b);
  return (
    <PaperRoom
      light={{ x: fx * W, y: fy * H, radius: L.pick(0.6, 0.95) * W, aspect: L.pick(1.3, 0.85), strength: 1 }}
      vignette={0.4}
    />
  );
};

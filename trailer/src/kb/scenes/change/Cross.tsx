/**
 * THE L-CUT (SCRIPT.md b14, 72.75 on the plan): under her last word the frame CROSSES BACK TO THE DESK — one camera push
 * against the reading direction (change/stage.ts crossPush; 16:9 the call slides out left, 9:16 up): this act's whole
 * picture (its ground, the orb, the transcript, the page with its sweep — the page last, so "four." still reads) is carried
 * out while b15's own first picture (scenes/Matters.tsx MattersDesk at t ≤ 0: its MUTED_MESH ground on the timeline's
 * clock keyed teal at the colon, the desk, the clock with Ava's teal dot — the dot arrives first) is carried in behind its
 * leading edge, which is soft (a short many-stop feather, narrowing to nothing as it lands) so the two grounds hand over
 * rather than butt. The push lands at rest on the act's last frame: the cut into b15 is the same picture. No two pictures
 * ever overlap type.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { subpixel } from '../../../lib/glide';
import { CHANGE_LOCAL as K } from '../../timing';
import { MattersDesk } from '../Matters';
import { crossPush, type ChangeStage } from './stage';

/** the incoming picture's soft leading edge (its own px along the axis): clear at 0, opaque from `f` */
function edgeMask(axis: 'x' | 'y', f: number) {
  const N = 10;
  const dir = axis === 'x' ? 'to right' : 'to bottom';
  const stops: string[] = ['rgba(0,0,0,0) 0px'];
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    stops.push(`rgba(0,0,0,${(u * u * (3 - 2 * u)).toFixed(4)}) ${(f * u).toFixed(2)}px`);
  }
  return `linear-gradient(${dir}, ${stops.join(', ')})`;
}

/** the outgoing picture: this act's frame, carried out by the push */
export const PushOut: React.FC<{ t: number; S: ChangeStage; children: React.ReactNode }> = ({ t, S, children }) => {
  const cp = crossPush(t, S);
  const tf = cp.p > 0 ? (S.cross.axis === 'x' ? `translate(${cp.out.toFixed(3)}px, 0px)` : `translate(0px, ${cp.out.toFixed(3)}px)`) : undefined;
  return <AbsoluteFill style={subpixel(tf, cp.moving)}>{children}</AbsoluteFill>;
};

export const Cross: React.FC<{ t: number; S: ChangeStage }> = ({ t, S }) => {
  const cp = crossPush(t, S);
  if (!cp.on || cp.p <= 0) return null;
  const f = S.cross.feather * Math.min(1, (1 - cp.p) * 4);
  const mask = f > 0.5 ? edgeMask(S.cross.axis, f) : undefined;
  // the soft edge lies OVER the outgoing picture (offset back by its width), never over the bare frame
  const d = cp.in - f;
  const tf = S.cross.axis === 'x' ? `translate(${d.toFixed(3)}px, 0px)` : `translate(0px, ${d.toFixed(3)}px)`;
  return (
    <AbsoluteFill style={{ ...subpixel(cp.p < 1 ? tf : undefined, cp.moving), ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : {}) }}>
      <MattersDesk t={Math.min(0, t - K.end)} />
    </AbsoluteFill>
  );
};

/**
 * THE L-CUT (SCRIPT.md b14, 72.75 on the plan): under her last words the frame CROSSES BACK TO THE DESK — one camera
 * move against the reading direction (change/stage.ts crossPush; 16:9 the call slides out left, 9:16 up).
 *
 * Critic fix, build B: the old push carried both pictures a whole frame in 12 frames (peaks of 114 px per 120 fps frame,
 * strobing into copies at share rates). Now ONE curve (24 frames, a sine in-out) drives it all: this act's picture is
 * carried out 40 % of the frame, b15's first picture (scenes/Matters.tsx MattersDesk at t ≤ 0: its MUTED_MESH ground on
 * the timeline's clock, the desk, the clock with Ava's teal dot) is carried in by the same 40 %, and a soft edge of
 * CONSTANT width crosses the frame on the same curve, handing the grounds over under it (the mask is in screen space, on
 * a still element; the desk moves inside it on its own layer). Its width never changes, so nothing reshapes the leading
 * edge's motion. The push lands at rest on the act's last frame: the cut into b15 is the same picture.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { subpixel } from '../../../lib/glide';
import { CHANGE_LOCAL as K } from '../../timing';
import { MattersDesk } from '../Matters';
import { crossPush, type ChangeStage } from './stage';

/** the incoming picture's soft edge, in SCREEN px along the axis: clear before `edge − f`, opaque from `edge` */
function edgeMask(axis: 'x' | 'y', edge: number, f: number) {
  const N = 10;
  const dir = axis === 'x' ? 'to right' : 'to bottom';
  const a = edge - f;
  const stops: string[] = [`rgba(0,0,0,0) ${a.toFixed(2)}px`];
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    stops.push(`rgba(0,0,0,${(u * u * (3 - 2 * u)).toFixed(4)}) ${(a + f * u).toFixed(2)}px`);
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
  const mask = cp.p < 1 ? edgeMask(S.cross.axis, cp.edge, cp.feather) : undefined;
  const tf = cp.p < 1 ? (S.cross.axis === 'x' ? `translate(${cp.in.toFixed(3)}px, 0px)` : `translate(0px, ${cp.in.toFixed(3)}px)`) : undefined;
  return (
    <AbsoluteFill style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}>
      <AbsoluteFill style={subpixel(tf, cp.moving)}>
        <MattersDesk t={Math.min(0, t - K.end)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

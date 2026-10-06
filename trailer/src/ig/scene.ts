/**
 * The reels' act clock (fork of src/kb/scene.ts: that one is bound to film 2's SCENES; here the act table is passed in).
 * useSub / useTimelineFrame read only FPS (the house 30 fps unit) and are re-exported.
 */
import { useCurrentFrame } from 'remotion';
import { useSub, useTimelineFrame } from '../lib/scene';

export { useSub, useTimelineFrame };

/** An act window on the absolute timeline (a reel's SCENES entry). */
export type Act = { readonly from: number; readonly to: number; readonly pre: number; readonly post: number };
export type Acts = { readonly [key: string]: Act };

/**
 * Local act time inside the act's <Sequence> (Reel.tsx). 0 = the act's own start (SCENES[key].from); negative during
 * its `pre` frames, beyond its length during its `post` frames. Fractional at the 120 fps render rate.
 */
export function useActFrame(scenes: Acts, key: string): number {
  return useCurrentFrame() / useSub() - scenes[key].pre;
}

/** Length of an act's own window in frames (without pre/post). */
export const actLength = (scenes: Acts, key: string) => scenes[key].to - scenes[key].from;

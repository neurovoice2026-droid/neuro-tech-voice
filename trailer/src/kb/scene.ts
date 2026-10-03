/**
 * Film 2's scene clock (docs/kb/PIPELINE.md §8: lib/scene.useSceneFrame is bound to film 1's SCENES, so
 * it is forked here). useSub / useTimelineFrame read only FPS (the house 30 fps unit) and are re-exported.
 */
import { useCurrentFrame } from 'remotion';
import { useSub, useTimelineFrame } from '../lib/scene';
import { SCENES, type KbSceneKey } from './timing';

export { useSub, useTimelineFrame };

/**
 * Local act time. 0 = the act's own start on the timeline (SCENES[key].from); negative during its `pre`
 * frames, beyond its length during its `post` frames. Fractional at the 120 fps render rate.
 */
export function useKbSceneFrame(key: KbSceneKey): number {
  return useCurrentFrame() / useSub() - SCENES[key].pre;
}

/** Length of an act's own window in frames (without pre/post). */
export const kbSceneLength = (key: KbSceneKey) => SCENES[key].to - SCENES[key].from;

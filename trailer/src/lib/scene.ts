import { useCurrentFrame } from 'remotion';
import { SCENES, type SceneKey } from '../timing';

/**
 * Local scene time. 0 = the scene's own start on the timeline (SCENES[key].from);
 * negative during the scene's `pre` frames (match-cut overlap), and beyond
 * the scene length during its `post` frames.
 */
export function useSceneFrame(key: SceneKey): number {
  return useCurrentFrame() - SCENES[key].pre;
}

/** Length of a scene's own window in frames (without pre/post). */
export const sceneLength = (key: SceneKey) => SCENES[key].to - SCENES[key].from;

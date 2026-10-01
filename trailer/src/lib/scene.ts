import { useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS, SCENES, type SceneKey } from '../timing';

/** Render frames per 30 fps timeline frame for the current composition (4 at 120 fps, 1 at 30). */
export function useSub(): number {
  return useVideoConfig().fps / FPS;
}

/**
 * Local scene time. 0 = the scene's own start on the timeline (SCENES[key].from);
 * negative during the scene's `pre` frames (match-cut overlap), and beyond
 * the scene length during its `post` frames.
 */
export function useSceneFrame(key: SceneKey): number {
  return useCurrentFrame() / useSub() - SCENES[key].pre;
}

/** Global timeline time in 30 fps frames (fractional at the 120 fps render rate). */
export function useTimelineFrame(): number {
  return useCurrentFrame() / useSub();
}

/** Length of a scene's own window in frames (without pre/post). */
export const sceneLength = (key: SceneKey) => SCENES[key].to - SCENES[key].from;

import { loadScene } from "@/components/site/industry/scenes";
import type { SceneLoader } from "./trade-stage";

/**
 * The trade window's loader: the sixteen industry scenes from their own
 * named map, and the music box for the seventeenth row, which lives with
 * the Custom AI Agents page rather than in the trades' LOADERS. Module
 * level, so it is the same function on every render.
 */
export const loadHomeScene: SceneLoader = (key) =>
  key === "custom-ai-agents"
    ? import("@/components/site/solutions/custom-ai-agents/scene").then((m) => m.scene)
    : loadScene(key);

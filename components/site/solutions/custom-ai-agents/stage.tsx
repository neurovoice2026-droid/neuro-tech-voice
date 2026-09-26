"use client";

import type { Scene } from "@/components/site/industry/shader-stage";
import { ShaderStage } from "@/components/site/industry/shader-stage";

/* ------------------------------------------------------------------ *
 * The music box's stage.
 *
 * The signature band reuses the trades' ShaderStage whole — the lazy
 * fetch at 40% rootMargin, the compile on intent + idle, the tier caps,
 * the one-frame reduced motion, the floor guard, the poster fallback —
 * rather than copying any of it. The one thing this page cannot share is
 * the scene registry: scenes/index.ts names the sixteen trades' loaders
 * one by one on purpose (a stray file once took all sixteen down), and a
 * solutions page has no business in that list.
 *
 * So ShaderStage takes an optional `load`, and this module supplies it.
 * A function cannot cross the server→client boundary as a prop, so the
 * loader lives here, in a client module, and at module level: it is an
 * effect dependency inside ShaderStage, and a loader re-created on every
 * render would re-arm the observer each time.
 *
 * The dynamic import keeps the GLSL out of this route's first load: the
 * scene's few kilobytes arrive only when the band gets near.
 * ------------------------------------------------------------------ */

const loadCaaScene = (): Promise<Scene | null> => import("./scene").then((m) => m.scene);

export function CaaStage({ className }: { className?: string }) {
  return <ShaderStage slug="custom-ai-agents" load={loadCaaScene} className={className} />;
}

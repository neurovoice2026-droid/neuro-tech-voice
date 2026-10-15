import type { CSSProperties } from "react";
import { meshBlobs } from "@/components/site/home/mesh-flow";
import { ENTERPRISE_LIGHT, PLAN_LIGHTS } from "@/components/site/home/palettes";
import type { PlanId } from "@/lib/pages/home/pricing-math";

/* ------------------------------------------------------------------ *
 * The lights a plan card can wear (plan-tier.css
 * `.home-plan-light[data-plan]`): the homepage's five rungs and
 * Enterprise (components/site/home/palettes.ts), and the free trial, which
 * only the app shows.
 *
 * Store plans have no lights of their own: each wears a service rung's,
 * by its place on the store ladder (`storeLight`), so a store card and a
 * service card at the same height look alike.
 * ------------------------------------------------------------------ */

/** A light's name: what a card puts in `data-plan`. */
export type TierLight = PlanId | "custom" | "trial";

/**
 * The free trial: a quiet lilac-grey pearl in the estimator panel's
 * family. plan-tier.css declares the same recipe and tokens; its text
 * holds 7:1 or better on its darkest pool (dim #454058 7.5:1, accent
 * #4c3d80 7:1).
 */
export const TRIAL_LIGHT = {
  ground:
    "radial-gradient(62% 26% at 20% 0%, rgb(255 255 255 / 0.85) 0%, rgb(255 255 255 / 0.71) 20%, rgb(255 255 255 / 0.49) 35%, rgb(255 255 255 / 0.276) 50%, rgb(255 255 255 / 0.127) 65%, rgb(255 255 255 / 0.048) 80%, rgb(255 255 255 / 0) 100%), radial-gradient(95% 42% at 0% 8%, rgb(222 219 247 / 0.9) 0%, rgb(222 219 247 / 0.752) 20%, rgb(222 219 247 / 0.519) 35%, rgb(222 219 247 / 0.292) 50%, rgb(222 219 247 / 0.134) 65%, rgb(222 219 247 / 0.051) 80%, rgb(222 219 247 / 0) 100%), radial-gradient(85% 38% at 100% 22%, rgb(238 228 248 / 0.8) 0%, rgb(238 228 248 / 0.668) 20%, rgb(238 228 248 / 0.461) 35%, rgb(238 228 248 / 0.26) 50%, rgb(238 228 248 / 0.12) 65%, rgb(238 228 248 / 0.045) 80%, rgb(238 228 248 / 0) 100%), radial-gradient(55% 26% at 68% 54%, rgb(233 239 252 / 0.45) 0%, rgb(233 239 252 / 0.376) 20%, rgb(233 239 252 / 0.259) 35%, rgb(233 239 252 / 0.146) 50%, rgb(233 239 252 / 0.067) 65%, rgb(233 239 252 / 0.025) 80%, rgb(233 239 252 / 0) 100%), radial-gradient(105% 44% at 26% 80%, rgb(226 224 244 / 0.78) 0%, rgb(226 224 244 / 0.652) 20%, rgb(226 224 244 / 0.45) 35%, rgb(226 224 244 / 0.253) 50%, rgb(226 224 244 / 0.117) 65%, rgb(226 224 244 / 0.044) 80%, rgb(226 224 244 / 0) 100%), radial-gradient(85% 38% at 100% 100%, rgb(230 226 248 / 0.75) 0%, rgb(230 226 248 / 0.626) 20%, rgb(230 226 248 / 0.432) 35%, rgb(230 226 248 / 0.244) 50%, rgb(230 226 248 / 0.112) 65%, rgb(230 226 248 / 0.042) 80%, rgb(230 226 248 / 0) 100%), #f8f7fc",
  tone: "light",
  text: "#140a24",
  dim: "#454058",
  accent: "#4c3d80",
  tick: "#4c3d80",
  ink: "#4c3d80",
  signal: "#8b84a8",
} as const;

/** Each listed rung's pools as elements, worked out once: the same recipes the card paints as its ground. */
export const PLAN_BLOBS = Object.fromEntries(
  Object.entries(PLAN_LIGHTS).map(([id, light]) => [id, meshBlobs(light.ground)]),
) as Record<PlanId, CSSProperties[]>;
export const ENTERPRISE_BLOBS = meshBlobs(ENTERPRISE_LIGHT.ground);
export const TRIAL_BLOBS = meshBlobs(TRIAL_LIGHT.ground);

/** The flowing pools of every light, by the name a card wears. */
export const TIER_BLOBS: Record<TierLight, CSSProperties[]> = {
  ...PLAN_BLOBS,
  custom: ENTERPRISE_BLOBS,
  trial: TRIAL_BLOBS,
};

/** The lights the listed store rungs wear, cheapest first; the pick wears Pro's magenta whatever its rung. */
const STORE_RUNG_LIGHTS: readonly PlanId[] = ["starter", "growth", "business", "scale"];
const STORE_PICK_LIGHT: PlanId = "pro";

/** The light a listed store plan wears: Pro's magenta for the pick, else the service rung at its place. */
export function storeLight(plan: { featured: boolean }, rung: number): PlanId {
  return plan.featured ? STORE_PICK_LIGHT : STORE_RUNG_LIGHTS[Math.min(rung, STORE_RUNG_LIGHTS.length - 1)];
}

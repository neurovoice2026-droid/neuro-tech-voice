/**
 * SUB-PIXEL MOTION — how anything that carries text moves without stepping.
 *
 * Chrome snaps glyphs to whole device pixels (vertically, and in practice
 * horizontally too), so text inside a plain, slowly moving transform holds
 * still and then jumps a full device pixel while the box around it glides
 * (measured at 4K / 120 fps: dy 0, 0, 0, +1.0 every ~10 frames on a 3 % push).
 * The cure is to put the moving element on its own compositor layer with a
 * non-axis-aligned matrix (a tiny rotate): the layer is rastered once and the
 * compositor resamples it at the exact sub-pixel offset every frame — a
 * monotonic glide (measured: −.05, −.10, −.15 … no steps). At rest the element
 * is plain, pixel-crisp text again.
 *
 * Measured rules (out of 4K probes rendered with Remotion at concurrency 1–3):
 *   · rotate(.002deg) is enough to leave the axis-aligned path — as smooth as
 *     .02deg, with a 10× smaller static offset (≤ .04 px across a full-frame
 *     plane, so the layer → plain switch at rest is invisible).
 *   · `will-change` alone (no rotate) is NOT enough: the raster keeps the
 *     fractional translation and the text still steps (1/16 – 1 px).
 *   · translateZ(0) / perspective layers re-raster at every scale change and
 *     step again — never use them for text.
 *   · a layer keeps the raster scale it was created at: do not keep a layer
 *     through a large zoom (≥ 10 %), it softens; small pushes (≤ 4 %) are fine.
 *   · small layers (a card, a line, a word) are exact in every render tab; a
 *     FULL-FRAME layer whose scale changes can be re-rastered differently by
 *     different tabs (±.1–.5 px between frames at concurrency > 1). So under a
 *     zooming camera, the text itself should also ride its own small layer
 *     (`useGlide()`): Type.tsx's reveals, captions and labels do it on their own.
 *
 *   <span style={{ ...subpixel(`translateY(${y}px)`, moving) }}>
 */
import { createContext, useContext, type CSSProperties } from 'react';

/** the non-axis-aligned marker: invisible (≤ .04 px over 1920 px), enough for the compositor path */
export const SUBPIXEL_TILT = 'rotate(0.002deg)';

/** A transform that composites while `moving` (sub-pixel exact), plain at rest (pixel-crisp). No transform: nothing. */
export function subpixel(transform: string | undefined, moving: boolean): CSSProperties {
  if (!transform) return {};
  return moving ? { transform: `${transform} ${SUBPIXEL_TILT}`, willChange: 'transform' } : { transform };
}

/**
 * `subpixel`, but the element rides its own layer while `on` even with no transform of its own
 * (an identity one) — for a static line / card / row carried by a moving camera plane.
 */
export function glideStyle(transform: string | undefined, on: boolean): CSSProperties {
  return on ? subpixel(transform ?? 'translate(0px, 0px)', true) : transform ? { transform } : {};
}

/**
 * Is anything carrying this element moving on screen? True inside a <Layer> (depth > 0) whose
 * <Camera moving> moves — text inside it composites itself while it does (see `subpixel`).
 */
export const GlideContext = createContext(false);
export const useGlide = () => useContext(GlideContext);

type Pose = { x?: number; y?: number; zoom?: number; rot?: number };

/**
 * How a camera pose function moves around t (fractional timeline frames): it is sampled a quarter
 * frame either side — one render frame at 120 fps. `moving`: anything changes (zoom counts 1000×:
 * 0.01 % of zoom ≈ .1 px at the frame edge; rot 100×); `zooming`: the zoom or the roll changes.
 *   <Camera {...pose} {...camMotion(poseAt, t)}>
 */
export function camMotion(pose: (t: number) => Pose, t: number, eps = 2e-3): { moving: boolean; zooming: boolean } {
  const a = pose(t - 0.25);
  const b = pose(t + 0.25);
  const z = 1000 * Math.abs((a.zoom ?? 1) - (b.zoom ?? 1)) + 100 * Math.abs((a.rot ?? 0) - (b.rot ?? 0));
  const d = Math.abs((a.x ?? 0) - (b.x ?? 0)) + Math.abs((a.y ?? 0) - (b.y ?? 0)) + z;
  return { moving: d > eps, zooming: z > eps };
}

/** camMotion(…).moving */
export const camMoving = (pose: (t: number) => Pose, t: number, eps = 2e-3) => camMotion(pose, t, eps).moving;

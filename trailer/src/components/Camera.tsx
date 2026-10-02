/**
 * A 2.5D camera for parallax. Wrap a scene in <Camera x y zoom rot> and put
 * its content in <Layer depth>: depth 0 = infinitely far (never moves),
 * 1 = the focal plane (moves exactly with the camera), >1 = foreground
 * (moves faster). Every scene uses ≥3 layers.
 *
 * MOVING CAMERA (`moving`, `zooming`): Chrome snaps glyphs in plain transforms,
 * so text on a slowly moving plane holds still and then jumps a whole device
 * pixel (at 4K a slow push read as a 12 Hz tick). The scene says when the
 * camera moves — usually `{...camMotion(poseAt, t)}` (lib/glide.ts: the pose
 * sampled ± ¼ frame) — and inside a moving plane `useGlide()` is true: the
 * type on it (Type.tsx reveals / captions / labels, and the scenes' own text
 * blocks) then rides its own SMALL sub-pixel layer, which glides at its exact
 * position in every render tab. A panning-only camera (no zoom) also puts the
 * whole plane on a layer. A ZOOMING plane stays plain: a frame-wide layer
 * whose scale changes is re-rastered differently by different render tabs
 * (measured at 4K, concurrency 2: ±.85 px alternating frame to frame — worse
 * than the tick). At rest everything is plain, pixel-crisp again.
 *
 * `dof` is an OPTICAL treatment of a background plane — a constant (or very
 * slowly changing) depth-of-field softness. Never animate it as a transition
 * and never put type on a dof layer: text appears by motion, not by blur.
 */
import React, { createContext, useContext } from 'react';
import { AbsoluteFill } from 'remotion';
import { GlideContext, subpixel } from '../lib/glide';

export { camMotion, camMoving, useGlide } from '../lib/glide';

type Cam = { x: number; y: number; zoom: number; rot: number; moving: boolean; zooming: boolean };
const CameraCtx = createContext<Cam>({ x: 0, y: 0, zoom: 1, rot: 0, moving: false, zooming: false });

export const Camera: React.FC<Partial<Cam> & { children: React.ReactNode }> = ({
  x = 0,
  y = 0,
  zoom = 1,
  rot = 0,
  moving = false,
  // unknown → assume the zoom changes too (the plane then stays plain; its type still glides)
  zooming = moving,
  children,
}) => <CameraCtx.Provider value={{ x, y, zoom, rot, moving, zooming }}>{children}</CameraCtx.Provider>;

export const useCamera = () => useContext(CameraCtx);

export const Layer: React.FC<{
  depth: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Static depth-of-field softness for a BACKGROUND plane, px (never animated as a transition, never on type). */
  dof?: number;
}> = ({ depth, children, style, dof = 0 }) => {
  const c = useCamera();
  const z = 1 + (c.zoom - 1) * depth;
  const moving = c.moving && depth > 0;
  // the whole plane on a layer only while it pans (see above); its type glides either way
  const planeLayer = moving && !c.zooming;
  const tf = `translate(${(-c.x * depth).toFixed(4)}px, ${(-c.y * depth).toFixed(4)}px) scale(${z.toFixed(6)}) rotate(${(c.rot * depth).toFixed(4)}deg)`;
  // (the provider is always there — toggling it would remount the plane's subtree, canvases and all)
  return (
    <GlideContext.Provider value={moving}>
      <AbsoluteFill
        style={{
          ...subpixel(tf, planeLayer),
          transformOrigin: '50% 50%',
          filter: dof > 0.05 ? `blur(${dof}px)` : undefined,
          ...style,
        }}
      >
        {children}
      </AbsoluteFill>
    </GlideContext.Provider>
  );
};

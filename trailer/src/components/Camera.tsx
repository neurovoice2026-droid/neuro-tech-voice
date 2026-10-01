/**
 * A 2.5D camera for parallax. Wrap a scene in <Camera x y zoom rot> and put
 * its content in <Layer depth>: depth 0 = infinitely far (never moves),
 * 1 = the focal plane (moves exactly with the camera), >1 = foreground
 * (moves faster). Every scene uses ≥3 layers.
 *
 * `dof` is an OPTICAL treatment of a background plane — a constant (or very
 * slowly changing) depth-of-field softness. Never animate it as a transition
 * and never put type on a dof layer: text appears by motion, not by blur.
 * Moving text inside a moving layer: see components/Type.tsx subpixel().
 */
import React, { createContext, useContext } from 'react';
import { AbsoluteFill } from 'remotion';

type Cam = { x: number; y: number; zoom: number; rot: number };
const CameraCtx = createContext<Cam>({ x: 0, y: 0, zoom: 1, rot: 0 });

export const Camera: React.FC<Partial<Cam> & { children: React.ReactNode }> = ({
  x = 0,
  y = 0,
  zoom = 1,
  rot = 0,
  children,
}) => <CameraCtx.Provider value={{ x, y, zoom, rot }}>{children}</CameraCtx.Provider>;

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
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${-c.x * depth}px, ${-c.y * depth}px) scale(${z}) rotate(${c.rot * depth}deg)`,
        transformOrigin: '50% 50%',
        filter: dof > 0.05 ? `blur(${dof}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

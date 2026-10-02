/**
 * The white act's cards — paper stock, set like a product page (the language
 * cards and the after-call stations; the industries are a typeset index,
 * scale/Index.tsx, not cards):
 *
 *   <Card>          white, a crisp hairline and a real, layered shadow
 *                   (theme.ts elevation: contact + key + ambient). `lift`
 *                   raises it (the shadow softens and drops). No rims, no
 *                   glows.
 *   <DrawIcon>      a lucide icon as a monoline drawing (the stations): its
 *                   strokes draw on (pathLength 1, dash offset) in a given ink.
 */
import React, { useLayoutEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { C, elevation } from '../../theme';
import type { Rect } from './geometry';

export const Card: React.FC<{
  r: Rect;
  transform?: string;
  opacity?: number;
  /** 0 = resting on the wall … 1 = a card's float (default) … 2+ = held up */
  lift?: number;
  /** shadow darkness multiplier */
  shadow?: number;
  /** 0..1: the face turned from the light (a flip) */
  shade?: number;
  radius?: number;
  z?: number;
  origin?: string;
  /** a live transform (sub-pixel compositing while it moves) */
  moving?: boolean;
  children?: React.ReactNode;
}> = ({ r, transform, opacity = 1, lift = 1, shadow = 1, shade = 0, radius = 26, z, origin, moving = false, children }) =>
  opacity <= 0.004 ? null : (
    <div
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: radius,
        background: C.white,
        boxShadow: elevation(lift, shadow),
        transform,
        transformOrigin: origin,
        willChange: moving ? 'transform' : undefined,
        opacity: opacity < 0.999 ? opacity : undefined,
        overflow: 'hidden',
        zIndex: z,
      }}
    >
      {children}
      {shade > 0.002 ? (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(20,16,28,${(0.16 * shade).toFixed(4)})`, pointerEvents: 'none' }} />
      ) : null}
    </div>
  );

/**
 * A lucide icon drawn as a monoline: every stroke gets pathLength 1 (set on the DOM before the
 * frame paints), and the inherited dash offset draws them on together (`draw` 0 → 1).
 */
export const DrawIcon: React.FC<{ Icon: LucideIcon; size: number; color: string; draw?: number; stroke?: number }> = ({
  Icon,
  size,
  color,
  draw = 1,
  stroke = 1.5,
}) => {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    ref.current?.querySelectorAll('path, circle, rect, line, polyline, polygon, ellipse').forEach((el) => el.setAttribute('pathLength', '1'));
  });
  const d = Math.min(1, Math.max(0, draw));
  if (d <= 0.001) return <div style={{ width: size, height: size }} />;
  const partial = d < 0.999;
  return (
    <Icon
      ref={ref}
      size={size}
      strokeWidth={stroke}
      color={color}
      style={{
        display: 'block',
        overflow: 'visible',
        // (a gap of 2 path lengths: at d = 0 no round cap shows at either end)
        strokeDasharray: partial ? '1 2' : undefined,
        strokeDashoffset: partial ? (1 - d).toFixed(4) : undefined,
      }}
    />
  );
};

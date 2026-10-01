/**
 * The white act's cards — paper stock, set like a product page:
 *
 *   <Card>          white, a crisp hairline and a real, layered shadow
 *                   (theme.ts elevation: contact + key + ambient), radius
 *                   26 / 22. `lift` raises it (the shadow softens and
 *                   drops), `shade` darkens its face as it turns from the
 *                   light (the language flip). No rims, no glows.
 *   <DrawIcon>      a lucide icon as a monoline drawing: its strokes draw on
 *                   (pathLength 1, dash offset) in a given ink.
 *   <IndustryFace>  the industry card's face: the icon top-left, drawn on in
 *                   the hour's ink as the card lands, settling to ink; the
 *                   name bottom-left in Instrument Sans (the title role,
 *                   sized to the card), rising out of its mask line by line.
 */
import React, { useLayoutEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { C, elevation, FONT, type LightId } from '../../theme';
import { EASE, SPRING, smooth, tween } from '../../lib/motion';
import { maskBox } from '../../lib/type';
import { reveal, revealStyle } from '../../components/Type';
import type { Industry } from './data';
import type { Rect } from './geometry';
import { inkOf, tintInk } from './lights';

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

/** the industry pop: ζ ≈ .73, a 3–4 % overshoot in scale, settled in ≈ 10 f */
export const POP = { stiffness: 380, damping: 22, mass: 0.6 };

/** card metrics per orientation (the wall's cells: 16:9 ≈ 425 × 225 · 9:16 228 × 288) */
export const IND = (v: boolean) => (v ? { pad: 20, icon: 46, label: 30, radius: 22 } : { pad: 30, icon: 54, label: 52, radius: 26 });

/**
 * An industry card's face. `at` = the pop's start (content motion), `tick` = its hit (the hour's
 * ink peaks there and settles to ink). `still`: everything settled (gliding / flying copies).
 */
export const IndustryFace: React.FC<{ d: Industry; t: number; at: number; tick: number; light: LightId; vertical: boolean; still?: boolean }> = ({
  d,
  t,
  at,
  tick,
  light,
  vertical: v,
  still = false,
}) => {
  const m = IND(v);
  const lines = d.lines[v ? 1 : 0];
  // the icon draws on as the card lands, in the hour's ink, then settles to ink
  // (content starts with the card: it is never a blank card, even for a frame)
  const draw = still ? 1 : tween(t, [at - 0.5, at + 10], [0, 1], EASE.out3);
  const hour = still ? 0 : 1 - smooth(tick + 4, tick + 20, t);
  return (
    <>
      <div style={{ position: 'absolute', left: m.pad - 2, top: m.pad - 2 }}>
        <DrawIcon Icon={d.Icon} size={m.icon} color={tintInk(inkOf(light), hour)} draw={draw} stroke={1.4} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: m.pad,
          right: m.pad - 8,
          bottom: m.pad - m.label * 0.18,
          fontFamily: FONT.ui,
          fontWeight: 480,
          fontSize: m.label,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: C.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {lines.map((ln, j) => {
          const r = still ? null : reveal(t, at + 0.6 + 1.1 * j, { config: SPRING.caption, rise: 100, fade: 0.5 });
          return (
            <div key={j}>
              <span style={maskBox(0)}>
                <span style={r ? revealStyle(r) : { display: 'inline-block' }}>{ln}</span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
};

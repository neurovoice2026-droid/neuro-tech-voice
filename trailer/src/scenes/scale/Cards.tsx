/**
 * The white cards of the white act (site: white, radius 21.6, SHADOW.card
 * plus a long soft drop), and the industry face (lucide icon on a pearl disc
 * + label). The language faces are in scale/Langs.tsx.
 */
import React from 'react';
import { random } from 'remotion';
import { C, FONT, LIGHTS, R, type LightId } from '../../theme';
import { bloom, mixColor } from '../../lib/lights';
import { EASE, tween } from '../../lib/motion';
import { discHot, discRest, litFill, rgba } from './lights';
import type { Industry } from './data';
import type { Rect } from './geometry';
import { dspring } from './curves';

/** SHADOW.card + a long soft drop; `lift` 0..1 deepens it, `alpha` fades it */
export function cardShadow(lift = 0, alpha = 1): string {
  const l = Math.max(0, lift);
  const a = (x: number) => (x * alpha).toFixed(3);
  return (
    `0 0 0 1px rgb(24 16 40 / ${a(0.06)}), ` +
    `0 ${(14 + 10 * l).toFixed(1)}px ${(30 + 14 * l).toFixed(1)}px -20px rgb(24 16 40 / ${a(0.35 + 0.08 * l)}), ` +
    `0 ${(24 + 16 * l).toFixed(1)}px ${(48 + 24 * l).toFixed(1)}px -28px rgba(24,16,40,${a(0.25)})`
  );
}

export const Box: React.FC<{
  r: Rect;
  transform?: string;
  opacity?: number;
  lift?: number;
  shadowAlpha?: number;
  children?: React.ReactNode;
  radius?: number;
  bg?: string;
  z?: number;
  /** CSS filter (blur / a DirBlur url) */
  filter?: string;
  /** a 2 px ring inside the card (the active language card) */
  ring?: string;
  /** extra box-shadow: the card's small glow in its light */
  glow?: string;
  origin?: string;
}> = ({ r, transform, opacity = 1, lift = 0, shadowAlpha = 1, children, radius = R.x2, bg = C.white, z, filter, ring, glow, origin }) =>
  opacity <= 0.004 ? null : (
    <div
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: radius,
        background: bg,
        boxShadow: cardShadow(lift, shadowAlpha) + (ring ? `, inset 0 0 0 2px ${ring}` : '') + (glow ? `, ${glow}` : ''),
        transform,
        transformOrigin: origin,
        opacity: opacity < 0.999 ? opacity : undefined,
        filter,
        overflow: 'hidden',
        zIndex: z,
      }}
    >
      {children}
    </div>
  );

/** the card fill on a pop: the card's light (its pale tint) on the tick, back to white over 4 f */
export const popFill = (t: number, tick: number, light: LightId = 'night', amount = 1) => {
  if (t < tick) return C.white;
  return litFill(light, amount * (1 - tween(t, [tick, tick + 4], [0, 1], EASE.out3)));
};

/** 1 on frame `a`, back to 0 by a + dur (EASE.out3); 0 before */
export const flashAt = (t: number, a: number | undefined, dur = 6) =>
  a === undefined || t < a ? 0 : 1 - tween(t, [a, a + dur], [0, 1], EASE.out3);

/**
 * The hit's accents around a point, in a light: a ripple ring that leaves
 * the disc and a burst of short radial sparks (9 f, EASE.out3). Clipped by
 * the card, so it reads as a ripple across the card's surface.
 */
export const HitBurst: React.FC<{ t: number; at: number; cx: number; cy: number; r: number; light: LightId; seed: string; n?: number }> = ({
  t,
  at,
  cx,
  cy,
  r,
  light,
  seed,
  n = 7,
}) => {
  if (t < at || t > at + 11) return null;
  const o = LIGHTS[light].orb;
  const p = tween(t, [at, at + 11], [0, 1], EASE.out3);
  const q = tween(t, [at, at + 9], [0, 1], EASE.out3);
  const R = r * (1 + 1.6 * p);
  const rot0 = random(`scale-spark-${seed}`) * 360;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: cx - R,
          top: cy - R,
          width: 2 * R,
          height: 2 * R,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 ${(1 + 3.5 * (1 - p)).toFixed(2)}px ${rgba(o[2], 0.75 * (1 - p) * (1 - p))}, 0 0 ${(18 * (1 - p)).toFixed(1)}px ${rgba(o[3], 0.6 * (1 - p))}`,
        }}
      />
      {q < 1
        ? Array.from({ length: n }, (_, j) => {
            const a = rot0 + (j * 360) / n + (random(`scale-spark-${seed}-${j}`) - 0.5) * 22;
            const d0 = r * 1.08;
            const d = d0 + r * (0.5 + 0.35 * random(`scale-spark-d-${seed}-${j}`)) * q;
            const len = Math.max(3, r * 0.26 * (1 - q) + 3);
            const w = Math.max(2, r * 0.07);
            return (
              <div
                key={j}
                style={{
                  position: 'absolute',
                  left: cx - w / 2,
                  top: cy - d - len,
                  width: w,
                  height: len,
                  borderRadius: w,
                  background: `linear-gradient(to top, ${rgba(o[2], 0)}, ${o[2]} 55%, ${o[3]})`,
                  opacity: (1 - q) ** 1.4,
                  transform: `rotate(${a.toFixed(2)}deg)`,
                  transformOrigin: `50% ${(d + len).toFixed(2)}px`,
                }}
              />
            );
          })
        : null}
    </>
  );
};

/**
 * An industry card's face: the lucide icon on its light's disc (top-left)
 * and its label (bottom-left, ink). On the tick the disc lights (the
 * light's key-dot gradient, the icon white, a bloom), a ripple and sparks
 * leave it, and it settles back to the pale disc + ink icon by +6.
 */
export const IndustryFace: React.FC<{
  d: Industry;
  t: number;
  /** the pop's start frame (content motion) */
  at: number;
  /** the tick frame (the hit) */
  tick: number;
  pad: number;
  iconSize: number;
  labelSize: number;
  light: LightId;
  /** the hero's unison flash: every disc lights on this frame (the wall "locks") */
  lockAt?: number;
  /** …in this light (one light for the whole wall), strummed: this card lights `lockDelay` f after the slam */
  lockLight?: LightId;
  lockDelay?: number;
  /** static: no inner motion (flyers, glides) */
  still?: boolean;
  /** the tick's ripple + sparks (off for ghost copies) */
  accents?: boolean;
}> = ({ d, t, at, tick, pad, iconSize, labelSize, light: own, lockAt, lockLight, lockDelay = 0, still = false, accents = true }) => {
  const { Icon } = d;
  // ONE light at a time on a disc: its own hit or the hero's lock — whichever is strongest
  let k = flashAt(t, tick, 8);
  let light: LightId = own;
  const kl = flashAt(t, lockAt === undefined ? undefined : lockAt + lockDelay, 7);
  if (kl > k) {
    k = kl;
    light = lockLight ?? own;
  }
  const D = Math.round(iconSize * 1.35);
  const x0 = pad - Math.round(D * 0.09);
  // follow-through: the disc settles a frame after the card (rotate + scale)
  const ip = still ? 1 : dspring(t - at + 1, { stiffness: 520, damping: 18, mass: 0.6 });
  const rest = discRest();
  const o = LIGHTS[light].orb;
  const words = d.label.split(' ');
  // the icon: white while the disc is lit, back to ink THROUGH the light's ink (never grey)
  const li = LIGHTS[light].ink;
  const iconCol = k <= 0.002 ? C.ink : k >= 0.55 ? mixColor(li, '#ffffff', Math.min(1, (k - 0.55) / 0.3)) : mixColor(C.ink, li, k / 0.55);
  const cx = x0 + D / 2;
  return (
    <>
      {k > 0.01 ? (
        // the hit is LIGHT: a pool of the card's light falling from the disc across the card
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at ${cx}px ${cx}px, ${rgba(o[3], 0.62 * k)} 0%, ${rgba(o[3], 0.3 * k)} 28%, ${rgba(o[3], 0.08 * k)} 58%, ${rgba(o[3], 0)} 85%)`,
          }}
        />
      ) : null}
      {accents ? <HitBurst t={t} at={tick} cx={x0 + D / 2} cy={x0 + D / 2} r={D / 2} light={own} seed={d.label} /> : null}
      <div
        style={{
          position: 'absolute',
          left: x0,
          top: x0,
          width: D,
          height: D,
          transform: still || ip > 0.9995 ? undefined : `rotate(${((1 - ip) * -12).toFixed(2)}deg) scale(${(0.78 + 0.22 * ip).toFixed(4)})`,
          transformOrigin: '50% 50%',
        }}
      >
        {k > 0.01 ? (
          <div style={{ position: 'absolute', left: -D * 0.9, top: -D * 0.9, width: D * 2.8, height: D * 2.8, background: bloom(light, 0.85 * k) }} />
        ) : null}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', ...rest }} />
        {k > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: discHot(light),
              opacity: Math.min(1, k * 1.15),
              boxShadow: `0 0 ${(D * 0.3).toFixed(1)}px ${rgba(o[2], 0.55 * k)}, 0 0 0 ${(2 * k).toFixed(2)}px ${rgba(o[3], 0.8 * k)}`,
            }}
          />
        ) : null}
        <div style={{ position: 'absolute', left: (D - iconSize) / 2, top: (D - iconSize) / 2, width: iconSize, height: iconSize }}>
          <Icon size={iconSize} strokeWidth={2.25} color={iconCol} absoluteStrokeWidth={false} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad - labelSize * 0.12,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: labelSize,
          lineHeight: 1.12,
          letterSpacing: '-0.012em',
          color: C.ink,
          textWrap: 'balance',
        }}
      >
        {words.map((w, j) => {
          // each word settles 0.8 f after the last (visible from the first frame: never an empty card)
          const p = still ? 1 : dspring(t - at + 1.2 - 0.8 * j, { stiffness: 600, damping: 20, mass: 0.6 });
          return (
            <React.Fragment key={j}>
              <span style={{ display: 'inline-block', transform: p < 0.999 ? `translateY(${((1 - p) * labelSize * 0.45).toFixed(2)}px)` : undefined }}>
                {w}
              </span>
              {j < words.length - 1 ? ' ' : null}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
};


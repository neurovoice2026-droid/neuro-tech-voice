/**
 * The stage itself: the site's #knowledge panel (#f3f1f8, the reader's
 * light, a soft drop shadow), the very soft lilac discs on the nearest
 * plane, and the eyebrow ("KNOWLEDGE BASE", the site's CornerDot eyebrow).
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { CornerDot } from '../../components/Type';
import { aos, EASE, mix, SPRING, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import type { Geo } from './geometry';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** 0 → 1 as the white flash becomes the stage (t 0 is pure white) */
export const stageIn = (t: number) => tween(t, KL.stageIn, [0, 1], EASE.house);

/** Plane 0.3: the panel and its light. */
export const Panel: React.FC<{ t: number; G: Geo; grey: number }> = ({ t, G, grey }) => {
  const p = stageIn(t);
  const P = G.panel;
  // the light blooms past its rest level as the white gives way, then settles
  const bloom = t < 6 ? tween(t, [0, 6], [0, 1.9], EASE.out3) : tween(t, [6, 22], [1.9, 1], EASE.inOut);
  // …and cools a touch once the reader has gone quiet
  const light = 0.08 * bloom * (1 - 0.3 * grey);
  const sc = mix(1.035, 1, p);
  return (
    <AbsoluteFill style={{ opacity: p }}>
      <div
        style={{
          position: 'absolute',
          left: P.x,
          top: P.y,
          width: P.w,
          height: P.h,
          borderRadius: P.r,
          background: C.chip,
          overflow: 'hidden',
          transform: `scale(${sc.toFixed(5)})`,
          boxShadow: `0 30px 60px -40px rgba(24,16,40,${(0.25 * p).toFixed(3)})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(40% 50% at 50% 55%, rgba(85,26,137,${light.toFixed(4)}), rgba(85,26,137,0))`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Plane 1.4: two or three very soft lilac discs at the frame edges. */
export const Discs: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const fade = tween(t, [2, 20], [0, 1], EASE.inOut);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: fade }}>
      {G.discs.map((d) => {
        const dx = 26 * noise2D(`kb-disc-x-${d.seed}`, t * 0.01, 0.2);
        const dy = 20 * noise2D(`kb-disc-y-${d.seed}`, 0.6, t * 0.01);
        const r = d.r * (1 + 0.04 * noise2D(`kb-disc-r-${d.seed}`, t * 0.012, 1.3));
        // a blur-40 disc, drawn as its own falloff (no full-frame filter)
        const c = (a: number) => `rgba(185,163,255,${(0.1 * a).toFixed(4)})`;
        return (
          <div
            key={d.seed}
            style={{
              position: 'absolute',
              left: d.x + dx - r - 40,
              top: d.y + dy - r - 40,
              width: (r + 40) * 2,
              height: (r + 40) * 2,
              borderRadius: '50%',
              background: `radial-gradient(closest-side, ${c(1)} 0%, ${c(0.96)} 52%, ${c(0.55)} 70%, ${c(0.18)} 86%, ${c(0)} 100%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** The eyebrow: CornerDot + "KNOWLEDGE BASE", letters rising 0.8 f apart. */
export const Eyebrow: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const T = G.top;
  const text = 'Knowledge Base'.toUpperCase();
  const s0 = K.heading;
  const dp = aos(t, s0 - 1, { anticip: 2, depth: 0.12, config: SPRING.pop });
  return (
    <div
      style={{
        position: 'absolute',
        left: T.eyebrowX,
        top: T.y,
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        color: C.violet,
      }}
    >
      <div
        style={{
          transform: `scale(${Math.max(0, dp).toFixed(4)}) rotate(${((1 - dp) * -90).toFixed(2)}deg)`,
          opacity: Math.min(1, Math.max(0, dp * 2)),
        }}
      >
        <CornerDot size={T.dot} color={C.violet} />
      </div>
      <div
        style={{
          overflow: 'hidden',
          paddingTop: '0.1em',
          paddingBottom: '0.06em',
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: T.label,
          lineHeight: 1.12,
          letterSpacing: TRACK.label,
          whiteSpace: 'pre',
        }}
      >
        {text.split('').map((ch, i) => {
          const s = s0 + 1 + i * 0.8;
          const p = aos(t, s, { anticip: 2, depth: 0.08, config: SPRING.site });
          const pp = aos(t - 1, s, { anticip: 2, depth: 0.08, config: SPRING.site });
          const blur = Math.min(3, Math.abs(p - pp) * 4);
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                transform: `translateY(${((1 - p) * 110).toFixed(2)}%)`,
                filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
};

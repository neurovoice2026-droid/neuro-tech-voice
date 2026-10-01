/**
 * The stage itself: the site's #knowledge panel lit as #demo's SUNDAY room
 * (its aqua ground, the reader's light pooled where the orb sits, a soft
 * teal-deep drop shadow; the light drains to a grey room on the miss and
 * comes back with Ava's answer), very soft aqua light discs on the nearest
 * plane, and the eyebrow ("KNOWLEDGE BASE", the site's CornerDot eyebrow,
 * in sunday ink).
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { noise2D } from '@remotion/noise';
import { CornerDot } from '../../components/Type';
import { aos, EASE, mix, SPRING, tween } from '../../lib/motion';
import { rgba } from '../../lib/lights';
import { FONT, TRACK } from '../../theme';
import { KNOWLEDGE, KNOWLEDGE_LOCAL } from '../../timing';
import { flashAt } from './blur';
import { INK, MISS_GROUND, SUN, SUN_GLOW, type Geo } from './geometry';
import { greyAt, relitAt } from './light';

const K = KNOWLEDGE;
const KL = KNOWLEDGE_LOCAL;

/** 0 → 1 as the white flash becomes the stage (t 0 is pure white) */
export const stageIn = (t: number) => tween(t, KL.stageIn, [0, 1], EASE.house);

/** Plane 0.3: the panel and its light. */
export const Panel: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const p = stageIn(t);
  const P = G.panel;
  const grey = greyAt(t);
  // the light blooms past its rest level as the white gives way, then settles…
  const bloom = t < 6 ? tween(t, [0, 6], [0, 1.9], EASE.out3) : tween(t, [6, 22], [1.9, 1], EASE.inOut);
  // …swells as the orb lands and as Ava's light comes back, and drains on the miss
  const swell = 0.5 * flashAt(t, KL.orbIn + 3, 7) + 0.6 * flashAt(t, KL.relight[0] + 2, 9) * relitAt(t);
  const light = 0.14 * (bloom + swell) * (1 - 0.75 * grey);
  const sc = mix(1.035, 1, p);
  // the panel's light pool sits where the orb is (in panel coordinates)
  const ox = ((G.orb.x - P.x) / P.w) * 100;
  const oy = ((G.orb.y - P.y) / P.h) * 100;
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
          background: SUN.ground,
          overflow: 'hidden',
          transform: `scale(${sc.toFixed(5)})`,
          boxShadow: `0 0 0 1px ${rgba(SUN.orb[1], 0.06 * p)}, 0 30px 60px -40px ${rgba(SUN.orb[0], 0.3 * p)}`,
        }}
      >
        {grey > 0.002 ? <div style={{ position: 'absolute', inset: 0, background: MISS_GROUND, opacity: 0.88 * grey }} /> : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(${G.v ? '62% 30%' : '34% 46%'} at ${ox.toFixed(1)}% ${oy.toFixed(1)}%, ${rgba(SUN_GLOW.body, light)}, ${rgba(SUN_GLOW.body, light * 0.45)} 45%, ${rgba(SUN_GLOW.body, 0)})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Plane 1.4: two or three very soft discs of Sunday light at the frame edges. */
export const Discs: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const fade = tween(t, [2, 20], [0, 1], EASE.inOut) * (1 - 0.6 * greyAt(t));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: fade }}>
      {G.discs.map((d) => {
        const dx = 26 * noise2D(`kb-disc-x-${d.seed}`, t * 0.01, 0.2);
        const dy = 20 * noise2D(`kb-disc-y-${d.seed}`, 0.6, t * 0.01);
        const r = d.r * (1 + 0.04 * noise2D(`kb-disc-r-${d.seed}`, t * 0.012, 1.3));
        // a blur-40 disc, drawn as its own falloff (no full-frame filter)
        const c = (a: number) => rgba(SUN_GLOW.core, 0.22 * a);
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

/** The eyebrow: CornerDot (spins in, a ring off it) + "KNOWLEDGE BASE", letters rising 0.8 f apart. */
export const Eyebrow: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const T = G.top;
  const text = 'Knowledge Base'.toUpperCase();
  const s0 = K.heading;
  const dp = aos(t, KL.eyebrowDot, { anticip: 2, depth: 0.12, config: { stiffness: 420, damping: 16, mass: 0.8 } });
  const ringQ = tween(t, [KL.eyebrowDot + 1, KL.eyebrowDot + 11], [0, 1], EASE.out3);
  const ringO = t > KL.eyebrowDot && ringQ < 1 ? 0.5 * (1 - ringQ) : 0;
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
        color: INK,
      }}
    >
      <div
        style={{
          position: 'relative',
          transform: `scale(${Math.max(0, dp).toFixed(4)}) rotate(${((1 - dp) * -90).toFixed(2)}deg)`,
          opacity: Math.min(1, Math.max(0, dp * 2)),
        }}
      >
        {ringO > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: T.dot / 2 - (T.dot * (1 + 1.6 * ringQ)) / 2,
              top: T.dot / 2 - (T.dot * (1 + 1.6 * ringQ)) / 2,
              width: T.dot * (1 + 1.6 * ringQ),
              height: T.dot * (1 + 1.6 * ringQ),
              borderRadius: '50%',
              boxShadow: `inset 0 0 0 1.5px ${rgba(SUN.orb[2], ringO)}`,
            }}
          />
        ) : null}
        <CornerDot size={T.dot} color={INK} />
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

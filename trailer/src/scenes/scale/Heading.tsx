/**
 * The act's titles, in one slot that travels:
 *
 *   hero     "16 industries." SLAMS centred on the wall on the downbeat the
 *            16-pop run resolves to (hit.wav): letters 1.75 → 1 on a 12 %-
 *            overshoot spring, 0.6 f apart, "16" in violet, velocity blur
 *   swap     at titleSwap the slot springs to the top band (anticipation,
 *            small overshoot) while an 8 f vertical mask wipe replaces the
 *            WHOLE phrase with "14 languages." (never the digits alone), a
 *            vertical directional blur on the wipe, a shutter blur on the move
 *   out      "14 languages." wipes out upwards; "After the call." rises
 *            letter by letter (the site's heading reveal) top-left
 */
import React from 'react';
import { C, FONT, TRACK } from '../../theme';
import { aos, EASE, tween } from '../../lib/motion';
import { DirBlur, dirBlurRef, sigmaFor } from './MotionBlur';
import { Rise } from './Rise';
import { dspring } from './curves';

export type TitleTiming = { hero: number; swap: number; out: number; after: number };
type Pose = { x: number; y: number; size: number };

/** 12 % overshoot, settled by +7 */
const SLAM = { stiffness: 560, damping: 20.5, mass: 0.6 };
/** the slot's travel to the band */
const MOVE = { stiffness: 380, damping: 25, mass: 0.8 };
/** cap centre below the top of a line-height-1 box, in em (Instrument Sans) */
const CAP_MID = 0.56;
const HERO = '16 industries.';

const face: React.CSSProperties = {
  fontFamily: FONT.ui,
  fontWeight: 500,
  letterSpacing: '-0.04em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  fontKerning: 'none',
  color: C.ink,
};

/** the slot's pose at f: anchor x (centred → left-aligned), cap-centre y, scale vs the hero size */
function poseAt(f: number, T: TitleTiming, hero: Pose, band: Pose) {
  const m = aos(f, T.swap, { anticip: 2, depth: 0.035, config: MOVE });
  return {
    m,
    x: hero.x + (band.x - hero.x) * m,
    y: hero.y + (band.y - hero.y) * m,
    s: 1 + (band.size / hero.size - 1) * m,
  };
}

export const Titles: React.FC<{
  t: number;
  T: TitleTiming;
  hero: Pose;
  band: Pose;
  after: Pose;
}> = ({ t, T, hero, band, after }) => {
  if (t < T.hero - 1) return null;
  const P = poseAt(t, T, hero, band);
  // the mask wipe (bottom → top): A above the line, B below it
  const w = tween(t, [T.swap, T.swap + 8], [0, 1], EASE.inOut);
  // B leaves (upwards) at T.out
  const q = tween(t, [T.out, T.out + 5], [0, 1], EASE.in2);
  // shutter blur: the slot's own speed + the wipe's vertical smear
  const P0 = poseAt(t - 0.5, T, hero, band);
  const P1 = poseAt(t + 0.5, T, hero, band);
  const sx = Math.min(16, sigmaFor(P1.x - P0.x));
  const wipeS = 3 * Math.sin(Math.PI * w) + 4 * Math.sin(Math.PI * q);
  const sy = Math.min(16, Math.hypot(sigmaFor(P1.y - P0.y), wipeS));
  const blur = dirBlurRef('scale-title', sx / P.s, sy / P.s);
  // a soft white bloom behind the hero title (legibility over the dimmed wall), gone on the move
  const halo = tween(t, [T.hero, T.hero + 4], [0, 1], EASE.out3) * (1 - tween(t, [T.swap, T.swap + 6], [0, 1], EASE.out3));

  const slot = (children: React.ReactNode, clip: string | undefined, dy: number, key: string) => (
    <div
      key={key}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        fontSize: hero.size,
        ...face,
        padding: '0.14em 0 0.24em',
        transform: `translate(${(-50 * (1 - P.m)).toFixed(3)}%, ${(-(CAP_MID + 0.14) * hero.size + dy).toFixed(2)}px)`,
        clipPath: clip,
      }}
    >
      {children}
    </div>
  );

  let k = 0;
  const heroText = Array.from(HERO).map((ch, i) => {
    if (ch === ' ') return <span key={i}> </span>;
    const s0 = T.hero + 0.6 * k++;
    const p = dspring(t - s0 + 1, SLAM);
    const pv = dspring(t - s0 + 0.5, SLAM) - dspring(t - s0 + 1.5, SLAM);
    const sc = 1 + 0.75 * (1 - p);
    const o = t < s0 ? 0 : tween(t, [s0 - 0.01, s0 + 1.2], [0.55, 1], EASE.out3);
    const bl = Math.min(8, Math.abs(pv) * 0.75 * hero.size * 0.06);
    return (
      <span
        key={i}
        style={{
          display: 'inline-block',
          transform: p < 0.9999 || p > 1.0001 ? `scale(${sc.toFixed(4)})` : undefined,
          transformOrigin: '50% 62%',
          opacity: o < 0.999 ? o : undefined,
          filter: bl > 0.15 ? `blur(${bl.toFixed(2)}px)` : undefined,
          color: i < 2 ? C.violet : undefined,
        }}
      >
        {ch}
      </span>
    );
  });
  const bandText = (
    <>
      <span style={{ color: C.violet }}>14</span> languages.
    </>
  );

  const showA = w < 1;
  const showB = w > 0 && q < 1;
  return (
    <>
      {halo > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: hero.x - hero.size * 3.6,
            top: hero.y - hero.size * 1.6,
            width: hero.size * 7.2,
            height: hero.size * 3.2,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(255,255,255,0.92), rgba(255,255,255,0.6) 55%, rgba(255,255,255,0))',
            opacity: halo,
          }}
        />
      ) : null}
      {blur ? <DirBlur id="scale-title" sx={sx / P.s} sy={sy / P.s} /> : null}
      {showA || showB ? (
        <div
          style={{
            position: 'absolute',
            left: P.x,
            top: P.y,
            transform: `scale(${P.s.toFixed(5)})`,
            transformOrigin: '0 0',
            filter: blur,
          }}
        >
          {showA ? slot(heroText, w > 0 ? `inset(0 0 ${(w * 100).toFixed(2)}% 0)` : undefined, -0.2 * hero.size * w, 'a') : null}
          {showB
            ? slot(
                bandText,
                q > 0 ? `inset(0 0 ${(q * 100).toFixed(2)}% 0)` : w < 1 ? `inset(${((1 - w) * 100).toFixed(2)}% 0 0 0)` : undefined,
                0.2 * hero.size * (1 - w) - 0.3 * hero.size * q,
                'b',
              )
            : null}
        </div>
      ) : null}
      {t >= T.after - 3 ? (
        <div
          style={{
            position: 'absolute',
            left: after.x - after.size * 0.04,
            top: after.y,
            fontFamily: FONT.ui,
            fontWeight: 500,
            fontSize: after.size,
            lineHeight: 1.04,
            letterSpacing: TRACK.section,
            color: C.ink,
            whiteSpace: 'nowrap',
          }}
        >
          <Rise text="After the call." t={t} at={T.after} stagger={0.35} />
        </div>
      ) : null}
    </>
  );
};

/** a small spring pop (0 → 1 with overshoot) for inline accents */
export const popAt = (t: number, at: number) => dspring(t - at, { stiffness: 420, damping: 18, mass: 0.7 });

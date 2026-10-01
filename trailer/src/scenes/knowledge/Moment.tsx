/**
 * The moment tag — "☀ SUNDAY · 10:24" — says why the room is teal: this
 * call comes in on a Sunday (#demo's Sunday light; the sun is #demo's own
 * Sunday key icon, lucide Sun). Geist Mono label, sunday ink.
 *
 * 16:9: it sits just left of the status pill and rides its edge (when the
 * pill's words change width the tag is pushed along on the site spring,
 * smeared by its own speed, never touching the pill). 9:16: right-aligned
 * under the pill.
 *
 * Entrance (momentTag, an 8th after the pill; the springs lead it by 1 f so
 * the tag is visibly popping ON it): the sun inhales for 2 f and springs out
 * spinning its rays in; the letters rise out of their masks 0.7 f apart
 * while the tag pops .6 → ~1.09 → 1 about its right edge; ON the hit a pool
 * of Sunday light blooms behind it, then a glint crosses the letters.
 */
import React from 'react';
import { spring } from 'remotion';
import { bloom, mixColor, rgba } from '../../lib/lights';
import { aos, EASE, SPRING, tween } from '../../lib/motion';
import { FONT } from '../../theme';
import { FPS, KNOWLEDGE_LOCAL } from '../../timing';
import { DirBlur, dirBlurRef, flashAt, sigmaFor } from './blur';
import { INK, MOMENT, SUN, SUN_GLOW, type Geo } from './geometry';
import { CHIP_POP, pillLeftAt } from './Status';

const KL = KNOWLEDGE_LOCAL;
/** the two words; a small round separator sits between them (a mono "·" + spaces gapes) */
const DAY = MOMENT.day.toUpperCase();
const TIME = MOMENT.time;
const TEXT = `${DAY}${TIME}`;

/** 16:9: the tag's right edge — pushed along by the pill on the site spring, never into it */
function rightAt(t: number, G: Geo) {
  const gap = G.top.tag.gap;
  const steady = (f: number) => pillLeftAt(f, G) - gap;
  let x = steady(KL.momentTag);
  for (const at of [KL.scanFlip, KL.missFlip]) {
    if (t < at + 1) break;
    const from = steady(at - 1);
    const to = steady(at + 12);
    x += (to - from) * spring({ frame: t - at - 1, fps: FPS, config: SPRING.site });
  }
  return Math.min(x, steady(t));
}

const Sun: React.FC<{ size: number; p: number; inhale: number; color: string }> = ({ size, p, inhale, color }) => {
  const rays = ['M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'];
  const disc = inhale > 0 ? 0.55 - 0.1 * inhale : Math.max(0, p);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', overflow: 'visible' }}>
      <g style={{ transformOrigin: '12px 12px', transform: `scale(${disc.toFixed(4)})` }}>
        <circle cx={12} cy={12} r={4} />
      </g>
      <g
        style={{
          transformOrigin: '12px 12px',
          transform: `rotate(${(-140 * (1 - p)).toFixed(2)}deg) scale(${Math.max(0, p).toFixed(4)})`,
          opacity: Math.min(1, Math.max(0, p * 1.5)),
        }}
      >
        {rays.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
};

export const Moment: React.FC<{ t: number; G: Geo }> = ({ t, G }) => {
  const s = KL.momentTag;
  // the springs start a frame before the hit, so the tag is visibly popping ON it (overshoot at s + 2)
  const a = s - 1;
  if (t < a - 2) return null;
  const T = G.top;
  const M = T.tag;
  const W = G.v ? 1080 : 1920;
  const right = M.mode === 'below' ? T.pillRight : rightAt(t, G);
  const y = M.mode === 'below' ? M.y : T.y;
  // speed of the ride (16:9) → a horizontal shutter smear
  const vx = M.mode === 'below' ? 0 : rightAt(t + 0.5, G) - rightAt(t - 0.5, G);
  const sx = Math.min(12, sigmaFor(vx));
  const blurId = 'kb-moment-blur';
  const f = dirBlurRef(blurId, sx, 0);

  const inhale = t < a ? (t - (a - 2)) / 2 : 0;
  const pop = t < a ? 0 : spring({ frame: t - a, fps: FPS, config: CHIP_POP });
  const sunP = t < a ? 0 : spring({ frame: t - a, fps: FPS, config: { stiffness: 520, damping: 17, mass: 0.7 } });
  const sc = t < a ? 0.6 : 0.6 + 0.4 * pop;
  // the light peaks as the tag reaches its overshoot (2 f in), then decays
  const hit = t < a ? 0 : t < s + 1 ? (t - a) / 2 : flashAt(t, s + 1, 6);
  // the glint crosses the letters (in letter units) from s + 3
  const glint = tween(t, [s + 3, s + 13], [-3, TEXT.length + 3], EASE.inOut);
  const glintOn = t >= s + 3 && t <= s + 13;
  const approxW = M.icon + 14 + TEXT.length * M.size * 0.66 + 40;
  const sepAt = s + DAY.length * 0.7;
  const sepP = aos(t, sepAt, { anticip: 2, depth: 0.2, config: CHIP_POP });
  const letter = (ch: string, i: number) => {
    const p = aos(t, s + i * 0.7, { anticip: 2, depth: 0.08, config: SPRING.site });
    const pp = aos(t - 1, s + i * 0.7, { anticip: 2, depth: 0.08, config: SPRING.site });
    const blur = Math.min(3, Math.abs(p - pp) * 4);
    const k = glintOn ? Math.exp(-(((i - glint) / 1.6) ** 2)) : 0;
    return (
      <span
        key={i}
        style={{
          display: 'inline-block',
          transform: `translateY(${((1 - p) * 110).toFixed(2)}%)`,
          color: k > 0.02 ? mixColor(INK, SUN.orb[2], 0.85 * k) : INK,
          textShadow: k > 0.02 ? `0 0 12px ${rgba(SUN.orb[2], 0.7 * k)}, 0 0 4px ${rgba(SUN.orb[3], 0.9 * k)}` : undefined,
          filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        {ch}
      </span>
    );
  };
  const mask: React.CSSProperties = {
    display: 'flex',
    overflow: 'hidden',
    paddingTop: '0.12em',
    paddingBottom: '0.08em',
    fontFamily: FONT.mono,
    fontWeight: 500,
    fontSize: M.size,
    lineHeight: 1.1,
    letterSpacing: '0.06em',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'pre',
  };

  return (
    <>
      {f ? <DirBlur id={blurId} sx={sx} sy={0} pad={0.15} /> : null}
      {/* the hit: a pool of Sunday light blooms behind the tag */}
      {hit > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: right - approxW / 2 - (approxW + 200) / 2,
            top: y - 130,
            width: approxW + 200,
            height: 260,
            background: bloom(SUN_GLOW, 0.5 * hit, { core: 0.5, coreSize: 0.5 }),
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          right: W - right,
          top: y,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          transform: `translateY(-50%) scale(${sc.toFixed(4)})`,
          transformOrigin: '100% 50%',
          filter: f,
          color: INK,
        }}
      >
        <div style={{ opacity: t < a ? 0.5 + 0.5 * inhale : 1 }}>
          <Sun size={M.icon} p={sunP} inhale={inhale} color={INK} />
        </div>
        <div style={mask}>{DAY.split('').map((ch, i) => letter(ch, i))}</div>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: rgba(INK, 0.55),
            transform: `scale(${Math.max(0, sepP).toFixed(4)})`,
            flex: 'none',
          }}
        />
        <div style={mask}>{TIME.split('').map((ch, i) => letter(ch, DAY.length + i))}</div>
      </div>
    </>
  );
};

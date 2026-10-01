/**
 * The diptych's pieces:
 *   · LetterRise — "Asleep." / "Booked." (Instrument Sans 520, −0.03em), each
 *     letter rising out of its own mask on SPRING.land, 0.6 f apart, the LAST
 *     letter locking ON the given frame; velocity blur + stretch; a glow
 *     flash (and, for "Booked.", a sheen) on the lock
 *   · Divider — the seam: 3 px, lilac → ember, a soft 10–24 px glow, drawn
 *     from one edge of the frame to the other on EASE.house with a hot head and
 *     a travelling bead that fades as it leaves
 *   · Moon / Stars — the night half: a 200 px crescent (#c0ace0 at 80 %, the
 *     ashen disc behind it, a 120 px glow), breathing on the bar; 3–4 stars
 *     that twinkle in on 16ths and shimmer on 8th-note phases
 *   · NightGrade — the half's own sky: #0a0d26 → #171a44 and a faint window light
 */
import React from 'react';
import { aos, EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { hexA } from './Event';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** First frame an underdamped spring (from 0, at rest) crosses 1. */
export function lockFrames(cfg: { stiffness: number; damping: number; mass: number }, fps = 30): number {
  const w0 = Math.sqrt(cfg.stiffness / cfg.mass);
  const z = cfg.damping / (2 * Math.sqrt(cfg.stiffness * cfg.mass));
  const wd = w0 * Math.sqrt(1 - z * z);
  const a = Math.PI - Math.atan(Math.sqrt(1 - z * z) / z);
  return (a / wd) * fps;
}
const LAND_LOCK = lockFrames(SPRING.land);
const SITE_LOCK = lockFrames(SPRING.site);
/** a star's pop: ~22 % overshoot (a small chip), first crossing ≈ 3.8 f */
const STAR = { stiffness: 380, damping: 14, mass: 0.8 };
const STAR_LOCK = lockFrames(STAR);

/**
 * A display word whose letters rise out of masks. The last letter locks
 * (first reaches its rest line) ON `land`; the others lock `stagger` frames
 * apart before it. SPRING.land overshoots ~20 %, so the masks are open well
 * above the cap line (and shut just under the descenders: a waiting letter sits
 * 1.3 em down, wholly out of sight).
 */
export const LetterRise: React.FC<{
  text: string;
  t: number;
  land: number;
  size: number;
  color: string;
  stagger?: number;
  /** text-shadow colour of the glow (flashes on the lock, then rests at `glowRest`) */
  glow?: string;
  glowRest?: number;
  /** a sheen runs across the letters after the lock (hex of the sheen) */
  sheen?: string;
  /** 0..1 scales the glow (the dive fades it: at 8× its blur would cost more than it shows) */
  glowScale?: number;
  style?: React.CSSProperties;
}> = ({ text, t, land, size, color, stagger = 0.6, glow, glowRest = 0.25, sheen, glowScale = 1, style }) => {
  const chars = text.split('');
  const n = chars.length;
  const flash = t >= land ? Math.exp(-(t - land) / 6) : 0;
  const glowK = glow ? (glowRest * tween(t, [land - 6, land], [0, 1], EASE.inOut) + 0.55 * flash) * glowScale : 0;
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: FONT.ui,
        fontWeight: 520,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: TRACK.section,
        color,
        whiteSpace: 'pre',
        ...style,
      }}
    >
      {chars.map((ch, i) => {
        const s = land - LAND_LOCK - (n - 1 - i) * stagger;
        const cfg = SPRING.land;
        const p = aos(t, s, { anticip: 3, depth: 0.07, config: cfg });
        const pp = aos(t - 1, s, { anticip: 3, depth: 0.07, config: cfg });
        const y = (1 - p) * 130;
        const speed = Math.abs(p - pp) * size * 1.08;
        const blur = tween(t, [s, s + 8], [4, 0], EASE.house) + Math.min(9, speed * 0.07);
        // the sheen: a bright band crossing the word left → right after the lock
        const sh = sheen ? Math.max(0, 1 - Math.abs(t - (land + 1 + i * 0.9)) / 2.6) : 0;
        const c = sh > 0 ? mixHex(color, sheen!, EASE.inOut(sh)) : color;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              overflow: 'hidden',
              padding: '0.42em 0.06em 0.14em',
              margin: '-0.42em -0.06em -0.14em',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${y.toFixed(2)}%) scaleY(${(1 + Math.min(0.08, speed * 0.0009)).toFixed(4)})`,
                transformOrigin: '50% 100%',
                color: c,
                filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
                textShadow:
                  glow && glowK > 0.005
                    ? `0 0 ${(0.12 * size).toFixed(1)}px ${hexA(glow, 0.9 * glowK)}, 0 0 ${(0.34 * size).toFixed(1)}px ${hexA(glow, 0.45 * glowK)}`
                    : undefined,
              }}
            >
              {ch}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** The seam: 3 px, lilac → ember along its length, glow, hot head, travelling bead. */
export const Divider: React.FC<{
  t: number;
  start: number;
  dur: number;
  vertical: boolean;
  /** the seam's cross position and extent (px of its layer) */
  at: number;
  from: number;
  to: number;
}> = ({ t, start, dur, vertical, at, from, to }) => {
  if (t < start - 3) return null;
  const drawAt = (tt: number) => tween(tt, [start, start + dur], [0, 1], EASE.house);
  const e = drawAt(t);
  const span = to - from;
  const len = span * e;
  const speed = Math.abs(drawAt(t + 0.5) - drawAt(t - 0.5)) * span; // px / frame
  // the bead gathers at the edge (anticipation), rides the tip, fades as it leaves
  const beadIn = aos(t, start, { anticip: 3, depth: 0, config: SPRING.pop });
  const beadOut = 1 - tween(t, [start + dur - 4, start + dur + 1], [0, 1], EASE.inOut);
  const gather = t < start ? tween(t, [start - 3, start], [0, 1], EASE.inOut) : 1;
  const bead = Math.max(0, Math.min(1.2, beadIn)) * beadOut;
  const heat = Math.min(1, speed / 60 + 0.25) * (1 - tween(t, [start + dur - 2, start + dur + 10], [0, 1], EASE.inOut) * 0.85);
  const stretch = 1 + Math.min(2.5, speed / 70);
  const dir = vertical ? '180deg' : '90deg';
  const grad = `linear-gradient(${dir}, ${C.lilac} 0%, ${mixHex(C.lilac, C.ember, 0.5)} 55%, ${C.ember} 100%)`;
  // the full-length gradient, revealed up to the tip (so the tip's colour changes as it travels)
  const reveal = (w: number, extra: React.CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        overflow: 'hidden',
        ...(vertical
          ? { left: at - w / 2, top: from, width: w, height: len }
          : { left: from, top: at - w / 2, width: len, height: w }),
        ...extra,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          ...(vertical ? { width: w, height: span } : { width: span, height: w }),
          background: grad,
        }}
      />
    </div>
  );
  const tip = from + len;
  const headLen = Math.min(len, 60 + speed * 1.4);
  const soft = vertical
    ? 'linear-gradient(90deg, transparent 0%, #000 50%, transparent 100%)'
    : 'linear-gradient(180deg, transparent 0%, #000 50%, transparent 100%)';
  return (
    <>
      {len > 0.5 ? (
        <>
          {/* the glow: 24 px soft, then 10 px */}
          {reveal(48, { opacity: 0.22, WebkitMaskImage: soft, maskImage: soft })}
          {reveal(20, { opacity: 0.45, WebkitMaskImage: soft, maskImage: soft })}
          {/* the line */}
          {reveal(3, { opacity: 0.95 })}
          {/* the hot head, cooling behind the bead */}
          <div
            style={{
              position: 'absolute',
              ...(vertical
                ? { left: at - 2, top: tip - headLen, width: 4, height: headLen }
                : { left: tip - headLen, top: at - 2, width: headLen, height: 4 }),
              background: `linear-gradient(${dir}, rgba(255,246,238,0), rgba(255,246,238,${(0.85 * heat).toFixed(3)}))`,
              borderRadius: 2,
            }}
          />
        </>
      ) : null}
      {/* the bead: a hot point riding the tip, stretched along the stroke by its speed */}
      {bead > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: vertical ? at : tip,
            top: vertical ? tip : at,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#fff6ee',
            boxShadow: `0 0 10px 2px ${hexA(C.lilac, 0.8 * gather)}, 0 0 26px 6px ${hexA(e > 0.5 ? C.ember : C.lilac, 0.5)}`,
            transform: `translate(-50%, -50%) ${vertical ? `scaleY(${stretch.toFixed(3)})` : `scaleX(${stretch.toFixed(3)})`} scale(${bead.toFixed(3)})`,
            opacity: clamp01(bead * 1.2),
          }}
        />
      ) : null}
    </>
  );
};

/** The crescent: the lit limb, the ashen disc behind it, a 120 px glow. Breathes on the bar. */
export const Moon: React.FC<{
  t: number;
  x: number;
  y: number;
  d: number;
  /** lock frame (the moon rises into place on SPRING.site and locks here) */
  lock: number;
  /** downbeat to breathe to (frame of a bar's first beat) */
  bar: number;
}> = ({ t, x, y, d, lock, bar }) => {
  const start = lock - SITE_LOCK;
  if (t < start - 3) return null;
  const p = aos(t, start, { anticip: 3, depth: 0.06, config: SPRING.site });
  const k = t - lock;
  const flash = k >= 0 ? Math.exp(-k / 6) : 0;
  const settled = tween(t, [lock, lock + 12], [0, 1], EASE.inOut);
  const breath = Math.cos((2 * Math.PI * (t - bar)) / 60) * settled;
  const sc = (0.9 + 0.1 * p) * (1 + 0.02 * breath);
  const glowK = (1 + 0.15 * breath) * (1 + 0.9 * flash) * clamp01(p);
  const ring = tween(t, [lock, lock + 36], [0, 1], EASE.out3);
  const G = d + 240;
  return (
    <>
      {/* the glow: a 120 px halo round the disc */}
      <div
        style={{
          position: 'absolute',
          left: x - G / 2,
          top: y - G / 2,
          width: G,
          height: G,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(192,172,224,${(0.25 * glowK).toFixed(3)}) ${((d / G) * 100 * 0.62).toFixed(1)}%, rgba(192,172,224,${(0.1 * glowK).toFixed(3)}) ${((d / G) * 100 * 0.9).toFixed(1)}%, rgba(192,172,224,0) 100%)`,
          transform: `translateY(${((1 - p) * 40).toFixed(2)}px) scale(${sc.toFixed(4)})`,
        }}
      />
      {ring > 0 && ring < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: x - d / 2,
            top: y - d / 2,
            width: d,
            height: d,
            borderRadius: '50%',
            boxShadow: `0 0 0 ${(1.5 * (1 - ring) + 0.5).toFixed(2)}px rgba(192,172,224,${(0.45 * (1 - ring) ** 1.4).toFixed(3)})`,
            transform: `scale(${(1.02 + 0.85 * ring).toFixed(4)})`,
          }}
        />
      ) : null}
      <svg
        viewBox="0 0 200 200"
        width={d}
        height={d}
        style={{
          position: 'absolute',
          left: x - d / 2,
          top: y - d / 2,
          transform: `translateY(${((1 - p) * 40).toFixed(2)}px) rotate(${((1 - p) * -12 - 18).toFixed(2)}deg) scale(${sc.toFixed(4)})`,
          opacity: clamp01(p * 1.6),
          overflow: 'visible',
        }}
        aria-hidden
      >
        <defs>
          <radialGradient id="result-moon-lit" cx="30%" cy="70%" r="85%">
            <stop offset="0%" stopColor="#efe6ff" />
            <stop offset="45%" stopColor="#d6c8ef" />
            <stop offset="100%" stopColor="#a893cf" />
          </radialGradient>
          <mask id="result-moon-cut">
            <rect x="0" y="0" width="200" height="200" fill="#fff" />
            <circle cx="138" cy="74" r="80" fill="#000" />
          </mask>
        </defs>
        {/* the ashen disc: the dark of the moon, just visible */}
        <circle cx="100" cy="100" r="92" fill="rgba(192,172,224,0.07)" />
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="url(#result-moon-lit)"
          opacity={0.8 * (1 + 0.25 * flash)}
          mask="url(#result-moon-cut)"
        />
      </svg>
    </>
  );
};

/** 3–4 stars: they twinkle in (pop, a 4-point glint on the lock) and shimmer on 8th-note phases. */
export const Stars: React.FC<{
  t: number;
  stars: ReadonlyArray<{ x: number; y: number; d: number }>;
  locks: readonly number[];
}> = ({ t, stars, locks }) => (
  <>
    {stars.map((s, i) => {
      const lock = locks[i];
      const start = lock - STAR_LOCK;
      if (t < start - 2) return null;
      const p = aos(t, start, { anticip: 2, depth: 0, config: STAR });
      const k = t - lock;
      const glint = k >= 0 ? Math.exp(-k / 4) : 0;
      // 8th-note phases: each star peaks on its own 8th (7.5 f), period one or two beats
      const period = i % 2 ? 15 : 30;
      const phase = lock + 7.5 * (i + 1);
      const tw = 0.78 + 0.22 * Math.cos((2 * Math.PI * (t - phase)) / period);
      const a = (0.6 + (0.3 * (s.d - 3)) / 2) * tw;
      const sz = s.d * Math.max(0, p);
      const G = s.d * 5 * (0.3 + glint);
      return (
        <React.Fragment key={i}>
          <div
            style={{
              position: 'absolute',
              left: s.x - sz / 2,
              top: s.y - sz / 2,
              width: sz,
              height: sz,
              borderRadius: '50%',
              background: `rgba(237,236,241,${a.toFixed(3)})`,
              boxShadow: `0 0 ${(s.d * 2).toFixed(1)}px rgba(214,200,255,${(0.5 * a).toFixed(3)})`,
            }}
          />
          {glint > 0.02 ? (
            <div style={{ position: 'absolute', left: s.x, top: s.y, transform: 'rotate(8deg)', opacity: glint }}>
              <div
                style={{
                  position: 'absolute',
                  left: -G,
                  top: -0.75,
                  width: 2 * G,
                  height: 1.5,
                  background: 'linear-gradient(90deg, rgba(237,236,241,0), rgba(237,236,241,0.9), rgba(237,236,241,0))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: -0.75,
                  top: -G,
                  width: 1.5,
                  height: 2 * G,
                  background: 'linear-gradient(180deg, rgba(237,236,241,0), rgba(237,236,241,0.9), rgba(237,236,241,0))',
                }}
              />
            </div>
          ) : null}
        </React.Fragment>
      );
    })}
  </>
);

/** The night half's sky: cooler and darker than the room, a faint window light at 30 % / 25 %. */
export const NightGrade: React.FC<{ x: number; y: number; w: number; h: number; vertical: boolean }> = ({
  x,
  y,
  w,
  h,
  vertical,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      background: [
        `radial-gradient(${vertical ? '70% 60%' : '60% 55%'} at 30% 25%, rgba(59,47,74,0.35), rgba(59,47,74,0.12) 45%, rgba(59,47,74,0) 100%)`,
        'linear-gradient(180deg, #0a0d26 0%, #111434 55%, #171a44 100%)',
      ].join(', '),
    }}
  />
);

/**
 * The Booked half's ground: the #demo night stage's mid range (#1f1860 → #110c38), lit from
 * behind the card — the night light (#7c3aed) as a soft bloom that breathes with the event and
 * swells as "Booked." locks. Cool on purpose: the ember is the event and the word, never the room.
 */
export const BookedGround: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  /** the light's centre (layer px) */
  cx: number;
  cy: number;
  vertical: boolean;
  /** 0..~1.4: the light's level (breath × lock swell) */
  light: number;
}> = ({ x, y, w, h, cx, cy, vertical, light }) => {
  const lx = cx - x;
  const ly = cy - y;
  const r = vertical ? '62% 48%' : '58% 62%';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        background: [
          `radial-gradient(${r} at ${lx.toFixed(1)}px ${ly.toFixed(1)}px, rgba(124,58,237,${(0.2 * light).toFixed(3)}) 0%, rgba(124,58,237,${(0.07 * light).toFixed(3)}) 45%, rgba(124,58,237,0) 100%)`,
          `radial-gradient(${vertical ? '95% 80%' : '85% 95%'} at ${lx.toFixed(1)}px ${ly.toFixed(1)}px, #1f1860 0%, #19134f 40%, #110c38 100%)`,
        ].join(', '),
      }}
    />
  );
};

/**
 * The act's titles, in one slot that travels — and never two titles in it at
 * once:
 *
 *   hero     "16 industries." SLAMS centred on the wall on the downbeat the
 *            16-pop run resolves to (hit.wav): letters 1.75 → 1 on a 12 %-
 *            overshoot spring, 0.6 f apart, "16" in the night's ink (the
 *            hour the wall ends on) with a glint across it, velocity blur
 *   swap     WITH the fly-out the slot lifts to the top band (2 f dip,
 *            small overshoot, shutter blur) — out of the cell band before any
 *            cell turns
 *   exit     "16 industries." leaves UP out of its mask: 2 f anticipation (a
 *            dip), a 4 f power2.in exit with a vertical ghost blur (a DirBlur
 *            + two trailing ghosts) — gone the frame before…
 *   in       …"14 languages." rises into the same mask letter by letter (a
 *            4 %-overshoot spring, 0.3 f apart, velocity blur); its "14" in
 *            the closing ink catches a glint and a soft bloom as it lands
 *   out      "14 languages." leaves the same way; "After the call." rises
 *            letter by letter (the site's heading reveal) 1 f after it is gone
 */
import React from 'react';
import { C, FONT, LIGHTS, TRACK, type LightId } from '../../theme';
import { aos, EASE, tween } from '../../lib/motion';
import { DirBlur, dirBlurRef, sigmaFor } from './MotionBlur';
import { Rise } from './Rise';
import { figureInk, HERO_LIGHT, LANG_LIGHT, rgba } from './lights';
import { dspring } from './curves';

export type TitleTiming = { hero: number; swap: number; exit: number; in: number; out: number; after: number };
type Pose = { x: number; y: number; size: number };

/** 12 % overshoot, settled by +7 */
const SLAM = { stiffness: 560, damping: 20.5, mass: 0.6 };
/** the slot's travel to the band */
const MOVE = { stiffness: 380, damping: 25, mass: 0.8 };
/** the band title's letters: ≈ 4 % overshoot, settled in ~8 f */
const RISE = { stiffness: 420, damping: 30, mass: 1 };
/** cap centre below the top of a line-height-1 box, in em (Instrument Sans) */
const CAP_MID = 0.56;
const HERO = '16 industries.';
/** the hero line's advance, in em (Instrument Sans 500, −0.04em) — for its motion blur */
const HERO_W = 5.55;
/** the exit: 2 f dip, then 4 f up and out of the mask */
const EXIT_A = 2;
const EXIT_D = 4;
/** how far the exit travels (em): clear of the mask's top edge (0.14 em of padding) */
const EXIT_EM = 1.3;

const face: React.CSSProperties = {
  fontFamily: FONT.ui,
  fontWeight: 500,
  letterSpacing: '-0.04em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  fontKerning: 'none',
  color: C.ink,
};

/**
 * A figure in a light's ink, one gradient across both digits (each digit
 * shows its half of it), with a white glint band that sweeps the pair once
 * (`glint` 0 → 1) — background-clip: text, so the light is IN the type.
 */
const figure = (light: LightId, half: 0 | 1, glint: number): React.CSSProperties => {
  const g = glint > 0 && glint < 1;
  const gx = (130 - 160 * glint).toFixed(1);
  return {
    backgroundImage: g
      ? `linear-gradient(105deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 60%), ${figureInk(light)}`
      : figureInk(light),
    backgroundSize: g ? '400% 100%, 200% 100%' : '200% 100%',
    backgroundPosition: g ? `${half === 0 ? gx : (Number(gx) + 33).toFixed(1)}% 0%, ${half === 0 ? '0%' : '100%'} 0%` : `${half === 0 ? '0%' : '100%'} 0%`,
    backgroundRepeat: 'no-repeat',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };
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

/** a designed exit (em, + is down): a 2 f dip, then a power2.in rise out of the mask; null once gone */
function exitAt(f: number, at: number): number | null {
  if (f < at) return 0;
  if (f < at + EXIT_A) return 0.06 * Math.sin(((f - at) / EXIT_A) * (Math.PI / 2));
  const u = (f - at - EXIT_A) / EXIT_D;
  if (u >= 1) return null;
  return 0.06 * (1 - u) - EXIT_EM * EASE.in2(Math.max(0, u));
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
  // shutter blur on the travel: the GLYPHS' own speed (the anchor travels
  // further than the text: the −50 % centring unwinds as it goes)
  const P0 = poseAt(t - 0.5, T, hero, band);
  const P1 = poseAt(t + 0.5, T, hero, band);
  const mid = (Q: ReturnType<typeof poseAt>) => Q.x + (0.5 - 0.5 * (1 - Q.m)) * HERO_W * hero.size * Q.s;
  const sx = Math.min(12, sigmaFor(mid(P1) - mid(P0)));
  const sy0 = Math.min(12, sigmaFor(P1.y - P0.y));

  // which title is in the slot: A until it is gone, B from T.in until it is gone
  const eA = exitAt(t, T.exit);
  const eB = t < T.in - 3 ? null : exitAt(t, T.out);
  const showA = eA !== null;
  const showB = eB !== null && !showA;
  // an exit's own vertical speed (screen px / frame) → its ghost blur
  const exitSpeed = (at: number) => {
    const a = exitAt(t - 0.5, at) ?? -EXIT_EM;
    const b = exitAt(t + 0.5, at) ?? -EXIT_EM;
    return (b - a) * hero.size * P.s;
  };
  const vA = showA ? exitSpeed(T.exit) : 0;
  const vB = showB ? exitSpeed(T.out) : 0;
  const sy = Math.min(14, Math.hypot(sy0, sigmaFor(vA + vB)));
  const blur = dirBlurRef('scale-title', sx / P.s, sy / P.s);
  // a soft white bloom behind the hero title (legibility over the dimmed wall), gone on the move
  const halo = tween(t, [T.hero, T.hero + 4], [0, 1], EASE.out3) * (1 - tween(t, [T.swap, T.swap + 6], [0, 1], EASE.out3));

  /** the slot (its own line box); `clip` masks it once a title starts leaving / arriving */
  const slot = (children: React.ReactNode, dyEm: number, clip: boolean, key: string, op = 1) => (
    <div
      key={key}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        fontSize: hero.size,
        ...face,
        padding: '0.14em 0 0.24em',
        transform: `translate(${(-50 * (1 - P.m)).toFixed(3)}%, ${(-(CAP_MID + 0.14) * hero.size).toFixed(2)}px)`,
        clipPath: clip ? 'inset(0 -0.2em 0 -0.2em)' : undefined,
        opacity: op < 0.999 ? op : undefined,
      }}
    >
      <div style={{ transform: Math.abs(dyEm) > 1e-4 ? `translateY(${dyEm.toFixed(4)}em)` : undefined }}>{children}</div>
    </div>
  );

  // A: the slam (letters), "16" in the night's ink with a glint as the slam settles
  let k = 0;
  const glintA = tween(t, [T.hero + 3, T.hero + 13], [0, 1], EASE.inOut);
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
          ...(i < 2 ? figure(HERO_LIGHT, i as 0 | 1, glintA) : null),
        }}
      >
        {ch}
      </span>
    );
  });

  // B: "14 languages." rises letter by letter into the mask (from below it)
  const BAND = '14 languages.';
  const glintB = tween(t, [T.in + 3, T.in + 13], [0, 1], EASE.inOut);
  let kb = 0;
  const bandText = Array.from(BAND).map((ch, i) => {
    if (ch === ' ') return <span key={i}> </span>;
    const s0 = T.in + 0.3 * kb++;
    const p = aos(t, s0, { anticip: 2, depth: 0.08, config: RISE });
    const pv = aos(t + 0.5, s0, { anticip: 2, depth: 0.08, config: RISE }) - aos(t - 0.5, s0, { anticip: 2, depth: 0.08, config: RISE });
    const bl = Math.min(6, Math.abs(pv) * 1.12 * hero.size * P.s * 0.09);
    return (
      <span
        key={i}
        style={{
          display: 'inline-block',
          transform: p < 0.9999 || p > 1.0001 ? `translateY(${((1 - p) * 1.12).toFixed(4)}em)` : undefined,
          filter: bl > 0.15 ? `blur(${bl.toFixed(2)}px)` : undefined,
          ...(i < 2 ? figure(LANG_LIGHT, i as 0 | 1, glintB) : null),
        }}
      >
        {ch}
      </span>
    );
  });
  // the "14"'s landing bloom (the closing light), under the figure
  const bloomB = showB ? (t < T.in + 2 ? 0 : 1 - tween(t, [T.in + 2, T.in + 16], [0, 1], EASE.out3)) : 0;
  const ghost = (v: number, children: React.ReactNode, dyEm: number, key: string) =>
    Math.abs(v) > 6
      ? [0.35, 0.7].map((d, gi) => slot(children, dyEm + (d * Math.abs(v)) / (hero.size * P.s), true, `${key}-g${gi}`, [0.28, 0.12][gi]))
      : null;

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
      {bloomB > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: band.x - band.size * 0.6,
            top: band.y - band.size * 1.1,
            width: band.size * 2.6,
            height: band.size * 2.2,
            background: `radial-gradient(closest-side, ${rgba(LIGHTS[LANG_LIGHT].orb[3], 0.7 * bloomB)}, ${rgba(LIGHTS[LANG_LIGHT].orb[3], 0)})`,
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
          {showA ? ghost(vA, heroText, eA ?? 0, 'ga') : null}
          {showA ? slot(heroText, eA ?? 0, t >= T.exit, 'a') : null}
          {showB ? ghost(vB, bandText, eB ?? 0, 'gb') : null}
          {showB ? slot(bandText, eB ?? 0, true, 'b') : null}
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

/**
 * The act's titles, in ONE centred slot that travels — never two titles in
 * it at once:
 *
 *   hero     "16 industries." SLAMS centred on the wall on the downbeat the
 *            16th-note run resolves to: letters 1.75 → 1 on a 12 %-overshoot
 *            spring, 0.6 f apart, velocity blur, "16" in the hero light's ink
 *            (a glint crosses it as the slam settles), a soft white bloom
 *            behind it over the dimmed wall. It HOLDS, still.
 *   swap     as the cards leave, the slot lifts to the band (2 f dip, a small
 *            overshoot, shutter blur) …
 *   exit     … and "16 industries." leaves UP out of its mask: 2 f dip, a 4 f
 *            power2.in exit with a vertical ghost blur (a DirBlur + two
 *            trailing ghosts) — as …
 *   in       … "14 languages." rises into the mask letter by letter (a 4 %-
 *            overshoot spring, 0.3 f apart, velocity blur); its "14" wears
 *            the LEADING light's ink (English's rush as it lands, a glint and
 *            a soft bloom; then each language's light as the card turns over)
 *   out      "14 languages." leaves the same way; "After the call." rises
 *            into the same slot on the flow beat.
 */
import React from 'react';
import { C, FONT, LIGHTS, type LightId } from '../../theme';
import { aos, EASE, tween } from '../../lib/motion';
import { DirBlur, dirBlurRef, sigmaFor } from './MotionBlur';
import { figureInk, HERO_LIGHT, LEAD, leadAt, rgba } from './lights';
import { dspring } from './curves';

export type TitleTiming = { hero: number; glint: number; swap: number; exit: number; in: number; out: number; after: number };
type Pose = { x: number; y: number; size: number };

/** 12 % overshoot, settled by +7 */
const SLAM = { stiffness: 560, damping: 20.5, mass: 0.6 };
/** the slot's travel to the band */
const MOVE = { stiffness: 380, damping: 25, mass: 0.8 };
/** the band titles' letters: ≈ 4 % overshoot, settled in ~8 f */
const RISE = { stiffness: 420, damping: 30, mass: 1 };
/** cap centre below the top of a line-height-1 box, in em (Instrument Sans) */
const CAP_MID = 0.56;
const HERO = '16 industries.';
const BAND = '14 languages.';
const AFTER = 'After the call.';
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

/** the slot's pose at f: centre x, cap-centre y, scale vs the hero size */
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

/** the figure's light at t: the leading light (scale/lights.ts), crossfading on a turn */
function figureLights(t: number): { a: LightId; b: LightId; m: number } {
  const { i, prev, m } = leadAt(t);
  return { a: LEAD[prev].light, b: LEAD[i].light, m: prev === i ? 1 : m };
}

/** a band title rising letter by letter into the mask (figure: the first two letters in the LEADING light's ink) */
function riseText(text: string, t: number, at: number, size: number, figure0 = false) {
  const glint = tween(t, [at + 3, at + 13], [0, 1], EASE.inOut);
  const fl = figureLights(t);
  let k = 0;
  return Array.from(text).map((ch, i) => {
    if (ch === ' ') return <span key={i}> </span>;
    const s0 = at + 0.3 * k++;
    const P = (f: number) => aos(f, s0, { anticip: 2, depth: 0.08, config: RISE });
    const p = P(t);
    const pv = P(t + 0.5) - P(t - 0.5);
    const bl = Math.min(6, Math.abs(pv) * 1.12 * size * 0.09);
    const style: React.CSSProperties = {
      display: 'inline-block',
      position: 'relative',
      transform: p < 0.9999 || p > 1.0001 ? `translateY(${((1 - p) * 1.12).toFixed(4)}em)` : undefined,
      filter: bl > 0.15 ? `blur(${bl.toFixed(2)}px)` : undefined,
    };
    if (!figure0 || i >= 2) return <span key={i} style={style}>{ch}</span>;
    const half = i as 0 | 1;
    const turning = fl.a !== fl.b && fl.m < 1;
    return (
      <span key={i} style={style}>
        <span style={figure(turning ? fl.a : fl.b, half, glint)}>{ch}</span>
        {turning ? <span style={{ ...figure(fl.b, half, glint), position: 'absolute', left: 0, top: 0, opacity: fl.m }}>{ch}</span> : null}
      </span>
    );
  });
}

export const Titles: React.FC<{ t: number; T: TitleTiming; hero: Pose; band: Pose; after: Pose }> = ({ t, T, hero, band, after }) => {
  if (t < T.hero - 2) return null;
  const P = poseAt(t, T, hero, band);
  // shutter blur on the slot's travel
  const P0 = poseAt(t - 0.5, T, hero, band);
  const P1 = poseAt(t + 0.5, T, hero, band);
  const sy0 = Math.min(12, sigmaFor(P1.y - P0.y));

  // the slot is never empty: B rises in from below as A leaves up out of the mask (a slot-machine swap,
  // both clipped by it), and C rises as B leaves
  const eA = exitAt(t, T.exit);
  const eB = t < T.in - 3 ? null : exitAt(t, T.out);
  const showA = eA !== null;
  const showB = eB !== null;
  const showC = t >= T.after - 3;
  // an exit's own vertical speed (screen px / frame) → its ghost blur
  const exitSpeed = (at: number) => {
    const a = exitAt(t - 0.5, at) ?? -EXIT_EM;
    const b = exitAt(t + 0.5, at) ?? -EXIT_EM;
    return (b - a) * hero.size * P.s;
  };
  // the last 65 % of an exit also fades, so no sliced stems hang at the mask's edge
  const exitFade = (at: number) => {
    const u = (t - at - EXIT_A) / EXIT_D;
    return u <= 0.35 ? 1 : 1 - EASE.inOut(Math.min(1, (u - 0.35) / 0.65));
  };
  const vA = showA ? exitSpeed(T.exit) : 0;
  const vB = showB ? exitSpeed(T.out) : 0;
  const sy = Math.min(14, Math.hypot(sy0, sigmaFor(vA + vB)));
  const blur = dirBlurRef('scale-title', 0, sy / P.s);
  // a soft white bloom behind the hero title (legibility over the dimmed wall), gone on the move
  // (it lifts 2 f BEFORE the slam with the wall's rack-back, so the first glyph never lands on a sharp label)
  const halo = tween(t, [T.hero - 2, T.hero + 3], [0, 1], EASE.out3) * (1 - tween(t, [T.swap, T.swap + 6], [0, 1], EASE.out3));

  /** the slot (its own line box, centred); `clip` masks it once a title starts leaving / arriving */
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
        transform: `translate(-50%, ${(-(CAP_MID + 0.14) * hero.size).toFixed(2)}px)`,
        clipPath: clip ? 'inset(0 -0.2em 0 -0.2em)' : undefined,
        opacity: op < 0.999 ? op : undefined,
      }}
    >
      <div style={{ transform: Math.abs(dyEm) > 1e-4 ? `translateY(${dyEm.toFixed(4)}em)` : undefined }}>{children}</div>
    </div>
  );

  // A: the slam (letters), "16" in the hero light's ink with a glint as the slam settles — and a second,
  // slower one two beats later, mid-hold (the held title stays alive)
  let k = 0;
  const g1 = tween(t, [T.hero + 3, T.hero + 13], [0, 1], EASE.inOut);
  const g2 = tween(t, [T.glint, T.glint + 14], [0, 1], EASE.inOut);
  const glintA = g1 > 0 && g1 < 1 ? g1 : g2;
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
  const bandText = riseText(BAND, t, T.in, hero.size * P.s, true);
  const afterText = riseText(AFTER, t, T.after, after.size);
  // the "14"'s landing bloom (English's light), under the figure
  const bloomB = showB ? (t < T.in + 2 ? 0 : 1 - tween(t, [T.in + 2, T.in + 16], [0, 1], EASE.out3)) : 0;
  const ghost = (v: number, children: React.ReactNode, dyEm: number, key: string, op: number) =>
    Math.abs(v) > 6
      ? [0.35, 0.7].map((d, gi) => slot(children, dyEm + (d * Math.abs(v)) / (hero.size * P.s), true, `${key}-g${gi}`, op * [0.28, 0.12][gi]))
      : null;
  const pale = LIGHTS[LEAD[leadAt(t).i].light].orb[3];

  return (
    <>
      {halo > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: hero.x - hero.size * 4.3,
            top: hero.y - hero.size * 1.7,
            width: hero.size * 8.6,
            height: hero.size * 3.4,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(255,255,255,0.93), rgba(255,255,255,0.74) 58%, rgba(255,255,255,0.3) 82%, rgba(255,255,255,0))',
            opacity: halo,
          }}
        />
      ) : null}
      {bloomB > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: band.x - band.size * 3.2,
            top: band.y - band.size * 1.1,
            width: band.size * 2.6,
            height: band.size * 2.2,
            background: `radial-gradient(closest-side, ${rgba(pale, 0.7 * bloomB)}, ${rgba(pale, 0)})`,
          }}
        />
      ) : null}
      {blur ? <DirBlur id="scale-title" sx={0} sy={sy / P.s} /> : null}
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
          {showA ? ghost(vA, heroText, eA ?? 0, 'ga', exitFade(T.exit)) : null}
          {showA ? slot(heroText, eA ?? 0, t >= T.exit, 'a', exitFade(T.exit)) : null}
          {showB ? ghost(vB, bandText, eB ?? 0, 'gb', exitFade(T.out)) : null}
          {showB ? slot(bandText, eB ?? 0, true, 'b', exitFade(T.out)) : null}
        </div>
      ) : null}
      {showC ? (
        <div style={{ position: 'absolute', left: after.x, top: after.y, transform: `scale(${(after.size / hero.size).toFixed(5)})`, transformOrigin: '0 0' }}>
          {slot(afterText, 0, t < T.after + 14, 'c')}
        </div>
      ) : null}
    </>
  );
};

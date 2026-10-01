/**
 * The establishing shot's type:
 *   · the night door sign — a transparent pill with an inset paper/.4 ring,
 *     "CLOSED" (Inter 600, .16em) — swinging in from its top edge (the site's
 *     elastic.out(1, .45) as a spring): the door callback from the twist;
 *   · "Picked up on the first ring." — the big kinetic line, which Ava then
 *     takes: it gathers (3 f), shrinks and dives into the orb, which gulps it.
 */
import React from 'react';
import { Easing } from 'remotion';
import { Words } from '../../components/Type';
import { inkFor, rgba, textGlow } from '../../lib/lights';
import { aos, EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { glintBg } from './Accents';

/** Per-letter rise + blur-in for small uppercase labels. */
export const Letters: React.FC<{
  text: string;
  t: number;
  start: number;
  step?: number;
  style?: React.CSSProperties;
}> = ({ text, t, start, step = 0.8, style }) => (
  <div style={{ display: 'flex', whiteSpace: 'pre', ...style }}>
    {text.split('').map((ch, i) => {
      const at = start + i * step;
      const p = aos(t, at, { anticip: 2, depth: 0.12, config: SPRING.pop });
      const o = Math.min(1, Math.max(0, p * 1.3));
      const blur = tween(t, [at, at + 7], [3, 0], EASE.house);
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: o,
            transform: `translateY(${((1 - p) * 0.45).toFixed(3)}em)`,
            filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined,
          }}
        >
          {ch}
        </span>
      );
    })}
  </div>
);

/** The CLOSED door sign (establishing shot only). `peel` 0..1 sends it off sideways. */
export const ClosedSign: React.FC<{
  t: number;
  cx: number;
  cy: number;
  start: number;
  fontSize: number;
  /** 0..1 the peel-out (x +700, blur → 14, fade) */
  peel: number;
  /** peel speed (0..1 per frame) for a horizontal smear */
  peelSpeed: number;
}> = ({ t, cx, cy, start, fontSize, peel, peelSpeed }) => {
  if (t < start - 5 || peel >= 1) return null;
  /* the swing, keyed: it drops in hanging (−16°), lifts a little further back (−19°, the
   * anticipation), swings down and SEATS on `start` (0°, the hit), overshoots +5° and
   * settles in two dying swings (≈ 12 f) */
  const u = t - start;
  const rot =
    u < -2
      ? -16 - 3 * EASE.inOut((u + 5) / 3)
      : u < 0
        ? -19 * (1 - EASE.in2((u + 2) / 2))
        : 8 * Math.exp(-u / 3.5) * Math.sin((Math.PI * u) / 4);
  const drop = u < -2 ? -26 + 8 * EASE.out3((u + 5) / 3) : u < 0 ? -18 * (1 - EASE.in2((u + 2) / 2)) : 0;
  const signOp = tween(t, [start - 5, start - 2], [0, 1], EASE.out3);
  // ON the seat: the outline flashes and settles, a ring leaves the pill, a glint crosses it
  const flash = u < 0 ? 0 : Math.exp(-u / 4);
  const ringE = u < 0 || u > 12 ? -1 : EASE.out3(u / 12);
  const glint = glintBg(tween(t, [start, start + 10], [0, 1], EASE.inOut), 0.28);
  const smear = Math.min(24, Math.abs(peelSpeed) * 700 * 0.12);
  const away = Math.max(0, peel);
  const H = Math.round(fontSize * 2.1);
  return (
    <div
      style={{
        position: 'absolute',
        left: cx + 700 * peel,
        top: cy,
        transform: 'translate(-50%, -50%)',
        opacity: 1 - away,
        filter: away > 0.005 ? `blur(${(14 * away).toFixed(2)}px)` : undefined,
      }}
    >
      {smear > 0.5 ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <defs>
            <filter id="call-closed-smear" x="-40%" y="-10%" width="180%" height="120%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${smear.toFixed(2)} 0`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      {/* the door sign, night: transparent, inset ring rgb(237 236 241 / .4) */}
      <div
        style={{
          position: 'relative',
          height: H,
          padding: `0 ${Math.round(fontSize * 0.86)}px 0 ${Math.round(fontSize)}px`,
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          background: `rgba(237,236,241,${(0.03 + 0.07 * flash).toFixed(3)})`,
          boxShadow:
            `inset 0 0 0 1.5px rgba(237,236,241,${(0.4 + 0.45 * flash).toFixed(3)}), 0 14px 30px -14px rgba(2,3,14,0.9)` +
            (flash > 0.02 ? `, 0 0 ${(24 * flash).toFixed(1)}px rgba(196,168,255,${(0.35 * flash).toFixed(3)})` : ''),
          transformOrigin: '50% 0%',
          transform: `translateY(${drop.toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`,
          opacity: signOp,
          filter: smear > 0.5 ? 'url(#call-closed-smear)' : undefined,
        }}
      >
        {glint ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 9999,
              backgroundImage: glint.layer,
              backgroundSize: glint.size,
              backgroundPosition: glint.pos,
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : null}
        {ringE >= 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: -(0.32 * H) * ringE,
              borderRadius: 9999,
              boxShadow: `inset 0 0 0 ${(1.5 * (1 - 0.4 * ringE)).toFixed(2)}px rgba(196,168,255,${(0.75 * (1 - ringE)).toFixed(3)})`,
            }}
          />
        ) : null}
        <Letters
          text="CLOSED"
          t={t}
          start={start - 4}
          step={0.8}
          style={{
            fontFamily: FONT.body,
            fontWeight: 600,
            fontSize,
            lineHeight: 1,
            letterSpacing: TRACK.tag,
            marginRight: `-${TRACK.tag}`,
            color: C.paper,
          }}
        />
      </div>
    </div>
  );
};

/**
 * "Picked up on the first ring." — Ava takes it: the line gathers (swells,
 * sinks a hair, 3 f), shrinks and dives UP into the orb, which swallows it.
 * It flies BEHIND the lockup and fades as it enters the lockup band, so it
 * never peeks through the gaps between the figures and the orb.
 */
export type Flight = { x: number; y: number; s: number; v: number; q: number; op: number };

/** the dive accelerates into the orb (power2.in, a touch steeper at the end) */
const DIVE = Easing.bezier(0.5, 0.05, 0.72, 0.5);
const GATHER = 3;

export type FlightOpts = {
  x0: number;
  y0: number;
  /** lockup centre (the orb) */
  y1: number;
  /** lockup band half-height: the line is gone by the time it is inside it */
  band: number;
  s1: number;
  /** the dive starts; the gather (anticipation) is the 3 frames before */
  lift: number;
  /** frames of the dive (it reaches the orb at lift + dive) */
  dive: number;
};

export function flightAt(t: number, o: FlightOpts): Flight {
  const gather =
    tween(t, [o.lift - GATHER, o.lift], [0, 1], EASE.inOut) * (1 - tween(t, [o.lift, o.lift + 3], [0, 1], EASE.in2));
  const qAt = (tt: number) => tween(tt, [o.lift, o.lift + o.dive], [0, 1], DIVE);
  const q = qAt(t);
  const y = o.y0 + (o.y1 - o.y0) * q + 10 * gather;
  // the shrink LEADS the travel (out2 in time), so the line is small before it reaches the figures
  const u = Math.min(1, Math.max(0, (t - o.lift) / o.dive));
  const sh = 1 - (1 - u) * (1 - u);
  const s = (1 + 0.03 * gather) * (1 + (o.s1 - 1) * sh);
  const v = (o.y1 - o.y0) * (qAt(t + 0.5) - qAt(t - 0.5));
  // honest occlusion: fade out across the lockup band's lower edge
  const into = Math.min(1, Math.max(0, (o.y1 + o.band - y) / (0.55 * o.band)));
  const op = 1 - EASE.inOut(into);
  return { x: o.x0, y, s, v, q, op };
}

/** the line's key phrase, in the night's lit ink (lilac on the dark) */
const KEY = 'first ring.';
const KEY_INK = inkFor('night', 'dark');

export const PickupLine: React.FC<{
  t: number;
  text: string;
  fontSize: number;
  boxW: number;
  flight: (t: number) => Flight;
  /** the key phrase ("first ring.") eases to the night's lit ink from here */
  keyAt: number;
  /** a light sweep crosses the line, word by word, from here (on the beat) */
  glintAt: number;
}> = ({ t, text, fontSize, boxW, flight, keyAt, glintAt }) => {
  const f = flight(t);
  if (f.op <= 0.003) return null;
  const words = text.split(' ');
  const keyFrom = words.length - KEY.split(' ').length;
  const speed = Math.abs(f.v);
  // one vertical-only gaussian, capped (screen σ ≤ 7 px), set in the line's own
  // (scaled) space; plus a slight stretch along the path — no ghost copies
  const sigmaScreen = Math.min(7, speed * 0.08);
  const sigma = Math.min(56, sigmaScreen / Math.max(0.08, f.s));
  const stretch = 1 + Math.min(0.3, speed / 240);
  return (
    <>
      {sigmaScreen > 0.4 ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <defs>
            <filter id="call-vblur" x="-5%" y="-150%" width="110%" height="400%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`0 ${sigma.toFixed(2)}`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: f.x - boxW / 2,
          top: f.y,
          width: boxW,
          transform: `translateY(-50%) scale(${f.s.toFixed(4)}, ${(f.s * stretch).toFixed(4)})`,
          transformOrigin: '50% 50%',
          opacity: f.op,
          filter: sigmaScreen > 0.4 ? 'url(#call-vblur)' : undefined,
        }}
      >
        <Words
          text={text}
          start={0}
          stagger={1.5}
          frame={t}
          config={SPRING.pop}
          style={{ fontSize, textShadow: textGlow('night', 0.22) }}
          color={C.paper}
          keys={[{ text: KEY, color: KEY_INK, at: keyAt }]}
          wordStyle={(i) => {
            // the glint: one bright band crossing each word in turn (≈ 2.5 f apart), over its own ink
            const n = words.length;
            const p = tween(t, [glintAt, glintAt + 14], [0, 1], EASE.inOut) * (n + 1.6) - i;
            const pp = Math.min(1, Math.max(0, p / 1.6));
            const g = glintBg(pp, 0.95, 100);
            if (!g) return undefined;
            const key = tween(t, [keyAt, keyAt + 18], [0, 1], EASE.house);
            // the band passes over a slightly lowered ink, and the word's own glow flares with it
            const ink = mixHex(i >= keyFrom ? mixHex(C.paper, KEY_INK, key) : C.paper, i >= keyFrom ? '#8d74d6' : '#a49dc4', 0.35 * Math.sin(Math.PI * pp));
            const flare = Math.sin(Math.PI * pp);
            return {
              textShadow: `0 0 ${(14 + 16 * flare).toFixed(1)}px ${rgba(KEY_INK, 0.2 + 0.55 * flare)}`,
              backgroundImage: `${g.layer}, linear-gradient(${ink}, ${ink})`,
              backgroundSize: `${g.size}, 100% 100%`,
              backgroundPosition: `${g.pos}, 0 0`,
              backgroundRepeat: 'no-repeat',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            };
          }}
        />
      </div>
    </>
  );
};

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
import { aos, EASE, SPRING, springAt, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';

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
  if (t < start - 3 || peel >= 1) return null;
  const swing = springAt(t, start, SPRING.land);
  const signOp = tween(t, [start - 1, start + 4], [0, 1], EASE.out3);
  const ring = tween(t, [start, start + 8], [0, 1], EASE.house);
  const smear = Math.min(24, peelSpeed * 700 * 0.12);
  return (
    <div
      style={{
        position: 'absolute',
        left: cx + 700 * peel,
        top: cy,
        transform: 'translate(-50%, -50%)',
        opacity: 1 - peel,
        filter: peel > 0.005 ? `blur(${(14 * peel).toFixed(2)}px)` : undefined,
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
          height: Math.round(fontSize * 2.1),
          padding: `0 ${Math.round(fontSize * 0.86)}px 0 ${Math.round(fontSize)}px`,
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          boxShadow: `inset 0 0 0 1.5px rgba(237,236,241,${(0.4 * ring).toFixed(3)}), 0 12px 30px -14px rgba(8,6,28,0.8)`,
          transformOrigin: '50% 0%',
          transform: `rotate(${(8 * (1 - swing)).toFixed(3)}deg) translateY(${((1 - Math.min(1, swing)) * -6).toFixed(2)}px)`,
          opacity: signOp,
          filter: smear > 0.5 ? 'url(#call-closed-smear)' : undefined,
        }}
      >
        <Letters
          text="CLOSED"
          t={t}
          start={start + 1}
          step={1}
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

export const PickupLine: React.FC<{
  t: number;
  text: string;
  fontSize: number;
  boxW: number;
  flight: (t: number) => Flight;
}> = ({ t, text, fontSize, boxW, flight }) => {
  const f = flight(t);
  if (f.op <= 0.003) return null;
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
        <Words text={text} start={0} stagger={1.5} frame={t} config={SPRING.pop} style={{ fontSize }} color={C.paper} />
      </div>
    </>
  );
};

/**
 * The stage's header rows (demo.tsx status row + phase line), scaled:
 *   · the night door sign — transparent pill, inset ring paper/.4, "CLOSED"
 *     (Inter 600, .16em) — swinging in from its top edge (the site's
 *     elastic.out(1, .45) as a spring), and the day label "TUESDAY 03:12"
 *     cross-sliding up letter by letter;
 *   · the phase line: a lilac dot + "PICKED UP ON THE FIRST RING", which
 *     the big kinetic line flies into and resolves as.
 */
import React from 'react';
import { Words } from '../../components/Type';
import { Easing } from 'remotion';
import { aos, EASE, SPRING, springAt, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';

/** Per-letter rise + blur-in for small uppercase labels. */
export const Letters: React.FC<{
  text: string;
  t: number;
  start: number;
  step?: number;
  /** letters come in from the centre outwards instead of left → right */
  fromCentre?: boolean;
  style?: React.CSSProperties;
  mono?: RegExp;
}> = ({ text, t, start, step = 0.8, fromCentre = false, style }) => {
  const mid = (text.length - 1) / 2;
  return (
    <div style={{ display: 'flex', whiteSpace: 'pre', ...style }}>
      {text.split('').map((ch, i) => {
        const at = start + (fromCentre ? Math.abs(i - mid) : i) * step;
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
};

export const StatusRow: React.FC<{
  t: number;
  cx: number;
  cy: number;
  start: number;
  recede: { opacity: number; blur: number };
  /** 1 → ~.58 once the transcript owns the frame (one read at a time) */
  dim?: number;
}> = ({ t, cx, cy, start, recede, dim = 1 }) => {
  if (t < start - 3) return null;
  const swing = springAt(t, start, SPRING.land);
  const signOp = tween(t, [start - 1, start + 4], [0, 1], EASE.out3);
  const ring = tween(t, [start, start + 8], [0, 1], EASE.house);
  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        opacity: recede.opacity * dim,
        filter: recede.blur > 0.1 ? `blur(${recede.blur.toFixed(2)}px)` : undefined,
      }}
    >
      {/* the door sign, night: transparent, inset 1px ring rgb(237 236 241 / .4) */}
      <div
        style={{
          height: 50,
          padding: '0 22px 0 24px',
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          boxShadow: `inset 0 0 0 1.5px rgba(237,236,241,${(0.4 * ring).toFixed(3)})`,
          transformOrigin: '50% 0%',
          transform: `rotate(${(8 * (1 - swing)).toFixed(3)}deg) translateY(${((1 - Math.min(1, swing)) * -6).toFixed(2)}px)`,
          opacity: signOp,
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
            fontSize: 22,
            lineHeight: 1,
            letterSpacing: TRACK.tag,
            color: C.paper,
          }}
        />
      </div>
      <Letters
        text="TUESDAY 03:12"
        t={t}
        start={start + 4}
        step={0.7}
        style={{
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1,
          letterSpacing: TRACK.label,
          color: C.paper,
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </div>
  );
};

/**
 * "Picked up on the first ring." — the big kinetic line (word-mask rise,
 * stagger 2). Then Ava takes it: the line gathers (swells, sinks a hair),
 * shrinks and dives UP into the orb, which swallows it (gulp + ping); the
 * orb then emits the phase dot from its crown, and the phase label unfolds
 * out of the dot (letter-spacing springs open from a point).
 *
 * The line flies BEHIND the lockup and fades as it enters the lockup band,
 * so it never peeks through the gaps between the figures and the orb.
 */
export type Flight = { x: number; y: number; s: number; v: number; q: number; op: number };

/** the dive accelerates into the orb (power2.in, a touch steeper at the end) */
const DIVE = Easing.bezier(0.5, 0.05, 0.72, 0.5);

export type FlightOpts = {
  x0: number;
  y0: number;
  /** lockup centre (the orb) */
  y1: number;
  /** lockup band half-height: the line is gone by the time it is inside it */
  band: number;
  s1: number;
  /** the dive starts; the gather (anticipation) is the 4 frames before */
  lift: number;
  /** frames of the dive (it reaches the orb at lift + dive) */
  dive: number;
};

export function flightAt(t: number, o: FlightOpts): Flight {
  const gather = tween(t, [o.lift - 4, o.lift], [0, 1], EASE.inOut) * (1 - tween(t, [o.lift, o.lift + 3], [0, 1], EASE.in2));
  const qAt = (tt: number) => tween(tt, [o.lift, o.lift + o.dive], [0, 1], DIVE);
  const q = qAt(t);
  const y = o.y0 + (o.y1 - o.y0) * q + 10 * gather;
  // the shrink LEADS the travel (out3 in time), so the line is small before it reaches the figures
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
  // one vertical-only gaussian, capped (screen σ ≤ 6 px), set in the line's own
  // (scaled) space; plus a slight stretch along the path — no ghost copies
  const sigmaScreen = Math.min(6, speed * 0.09);
  const sigma = Math.min(48, sigmaScreen / Math.max(0.08, f.s));
  const stretch = 1 + Math.min(0.28, speed / 260);
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
        <Words text={text} start={0} stagger={2} frame={t} config={SPRING.pop} style={{ fontSize }} color={C.paper} />
      </div>
    </>
  );
};

const PHASE_TEXT = 'PICKED UP ON THE FIRST RING';

/**
 * The phase line, emitted by the orb: the 12 px lilac dot leaves the orb's
 * crown (a comet-stretched spring) and rises to the phase line; the label
 * unfolds out of it, letter-spacing springing open from a point to .14em,
 * letters resolving centre-out; the dot slides left as the label opens and
 * lands in its place with a ping.
 */
export const PhaseLine: React.FC<{
  t: number;
  cx: number;
  cy: number;
  /** the orb's crown (y) the dot is born at */
  fromY: number;
  /** frame the orb emits the dot */
  emit: number;
  recede: { opacity: number; blur: number };
  /** label dimming (the dot stays lit) */
  dim?: number;
}> = ({ t, cx, cy, fromY, emit, recede, dim = 1 }) => {
  if (t < emit) return null;
  const riseAt = (tt: number) => Math.max(0, aos(tt, emit, { anticip: 0, depth: 0, config: SPRING.site }));
  const rise = riseAt(t);
  const dy = (fromY - cy) * (1 - rise);
  const vy = Math.abs((fromY - cy) * (riseAt(t + 0.5) - riseAt(t - 0.5)));
  const dotOp = tween(t, [emit, emit + 2], [0, 1], EASE.out3);
  const dotS = 0.45 + 0.55 * tween(t, [emit, emit + 6], [0, 1], EASE.house);
  const comet = Math.min(2.4, vy / 7);

  // the label unfolds out of the dot as it arrives
  const U = emit + 4;
  const sp = t < U ? 0 : springAt(t, U, SPRING.site);
  const track = -0.62 + (0.14 + 0.62) * sp; // em
  // the dot docks to the label's left edge while it rises (a slight arc), so the
  // opening label pushes it outwards and never runs over it
  const slide = tween(t, [emit + 1, U + 1], [0, 1], EASE.inOut);
  const mid = (PHASE_TEXT.length - 1) / 2;
  const ping = tween(t, [U + 7, U + 25], [0, 1], EASE.out3);

  // the label box is centred at cx + 14 so the whole row (dot 12 + gap 16 + label) centres on cx
  return (
    <div
      style={{
        position: 'absolute',
        left: cx + 14,
        top: cy,
        transform: 'translate(-50%, -50%)',
        opacity: recede.opacity,
        filter: recede.blur > 0.1 ? `blur(${recede.blur.toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          whiteSpace: 'pre',
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: 22,
          lineHeight: 1,
          letterSpacing: `${track.toFixed(4)}em`,
          // the trailing tracking of the last letter would push the box off-centre
          marginRight: `${(-track).toFixed(4)}em`,
          color: C.paperDim,
        }}
      >
        {PHASE_TEXT.split('').map((ch, i) => {
          const d = Math.abs(i - mid) / mid;
          const o = Math.min(1, Math.max(0, (sp * 1.35 - d) / 0.32));
          const eo = EASE.out3(o);
          // while the tracking is still closed the letters are light, not glyphs
          const squeeze = Math.min(1, Math.max(0, (0.1 - track) / 0.72));
          const bl = (1 - eo) * 4 + squeeze * 5;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: eo * dim * (1 - 0.45 * squeeze),
                filter: bl > 0.1 ? `blur(${bl.toFixed(2)}px)` : undefined,
                transform: `scale(${(0.7 + 0.3 * eo).toFixed(3)})`,
              }}
            >
              {ch}
            </span>
          );
        })}
        {/* the dot: born at the orb's crown, rides the label's left edge once it opens */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${(50 * (1 - slide)).toFixed(3)}% - ${((20 + (track * 22) / 2) * (1 - slide) + 28 * slide).toFixed(2)}px)`,
            top: `calc(50% - 6px + ${dy.toFixed(2)}px)`,
            width: 12,
            height: 12,
          }}
        >
          {comet > 0.15 ? (
            <div
              style={{
                position: 'absolute',
                left: 3,
                top: 6,
                width: 6,
                height: 6 + vy * 2.2,
                borderRadius: 3,
                background: `linear-gradient(180deg, rgba(185,163,255,0.55), rgba(185,163,255,0))`,
                opacity: dotOp * Math.min(1, comet),
              }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: C.lilac,
              opacity: dotOp,
              transform: `scale(${(dotS / Math.sqrt(1 + comet * 0.35)).toFixed(3)}, ${(dotS * (1 + comet * 0.35)).toFixed(3)})`,
              boxShadow: `0 0 12px ${C.lilac}aa`,
            }}
          />
          {ping > 0 && ping < 1 ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                boxShadow: `inset 0 0 0 1.5px ${C.lilac}`,
                transform: `scale(${(1 + ping * 1.8).toFixed(3)})`,
                opacity: 0.8 * (1 - ping),
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

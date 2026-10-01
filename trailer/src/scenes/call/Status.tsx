/**
 * The establishing shot's type, set like the knowledge heading:
 *   · CLOSED — the door callback from the twist, now an eyebrow (TYPE.label:
 *     Instrument Sans, uppercase, tracked) with a small open dot: it rises out
 *     of its mask as the room opens and leaves the same way at the push;
 *   · "Picked up on the first ring." — TYPE.headline (exactly the knowledge
 *     heading), its key phrase in the call's accent ink, the ink crossing the
 *     two words left → right on the beat. Ava then takes the line: it gathers
 *     (3 f), shrinks and dives up into the orb, which swallows it. No blur,
 *     no stretch, no ghosts — the 120 fps render carries the dive.
 */
import React from 'react';
import { Easing } from 'remotion';
import { Reveal, Words } from '../../components/Type';
import { EASE, SPRING, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { C } from '../../theme';
import { ACCENT } from './Mesh';

/** The CLOSED eyebrow (establishing shot only). */
export const ClosedSign: React.FC<{
  t: number;
  cx: number;
  cy: number;
  vertical: boolean;
  /** frame it is in (its rise lands here) */
  start: number;
  /** frame it leaves (up through its mask) */
  exit: number;
}> = ({ t, cx, cy, vertical, start, exit }) => {
  if (t < start - 8 || t > exit + 10) return null;
  const st = typeStyle('label', vertical, { tone: 'night' });
  const fs = st.fontSize as number;
  const dot = Math.round(fs * 0.36);
  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        transform: 'translate(-50%, -50%)',
        ...st,
        color: 'rgba(237,236,241,0.72)',
        whiteSpace: 'nowrap',
      }}
    >
      <Reveal t={t} start={start - 6} config={SPRING.text} exit={{ at: exit, dur: 7 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55em', marginRight: '-0.14em' }}>
          <span
            style={{
              display: 'inline-block',
              width: dot,
              height: dot,
              borderRadius: '50%',
              boxShadow: `inset 0 0 0 ${Math.max(1.5, fs * 0.06).toFixed(2)}px rgba(237,236,241,0.72)`,
              transform: 'translateY(-0.04em)',
            }}
          />
          CLOSED
        </span>
      </Reveal>
    </div>
  );
};

/**
 * "Picked up on the first ring." — Ava takes it: the line gathers (swells,
 * sinks a hair, 3 f), shrinks and dives UP into the orb, which swallows it.
 * It flies BEHIND the lockup and fades as it enters the lockup band, so it
 * never peeks through the gaps between the figures and the orb.
 */
export type Flight = { x: number; y: number; s: number; q: number; op: number };

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
  const q = tween(t, [o.lift, o.lift + o.dive], [0, 1], DIVE);
  const y = o.y0 + (o.y1 - o.y0) * q + 8 * gather;
  // the shrink LEADS the travel (out2 in time), so the line is small before it reaches the figures
  const u = Math.min(1, Math.max(0, (t - o.lift) / o.dive));
  const sh = 1 - (1 - u) * (1 - u);
  const s = (1 + 0.025 * gather) * (1 + (o.s1 - 1) * sh);
  // honest occlusion: fade out across the lockup band's lower edge
  const into = Math.min(1, Math.max(0, (o.y1 + o.band - y) / (0.55 * o.band)));
  return { x: o.x0, y, s, q, op: 1 - EASE.inOut(into) };
}

/** the line's key phrase, in the call's accent ink */
const KEY = ['first', 'ring.'];

export const PickupLine: React.FC<{
  t: number;
  text: string;
  vertical: boolean;
  boxW: number;
  flight: (t: number) => Flight;
  /** the accent ink crosses the key phrase from here, word by word (on the beat) */
  keyAt: number;
}> = ({ t, text, vertical, boxW, flight, keyAt }) => {
  const f = flight(t);
  if (f.op <= 0.003) return null;
  const moving = Math.abs(f.s - 1) > 1e-4;
  return (
    <div
      style={{
        position: 'absolute',
        left: f.x - boxW / 2,
        top: 0,
        width: boxW,
        transform: `translateY(${f.y.toFixed(3)}px) translateY(-50%)${moving ? ` scale(${f.s.toFixed(5)}) rotate(0.02deg)` : ''}`,
        willChange: moving ? 'transform' : undefined,
        transformOrigin: '50% 50%',
        opacity: f.op < 0.999 ? f.op : undefined,
      }}
    >
      <Words
        text={text}
        start={0}
        stagger={1.6}
        frame={t}
        role="headline"
        tone="night"
        config={SPRING.text}
        color={C.paper}
        keys={KEY.map((w, i) => ({ text: w, color: ACCENT, at: keyAt + 3 * i }))}
        style={typeStyle('headline', vertical, { tone: 'night' })}
      />
    </div>
  );
};

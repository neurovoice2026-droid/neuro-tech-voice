/**
 * b07's CLOCK — Part I's desk clock (scenes/repeat/Clock.tsx DeskClock) at the end of its day: `TUE`,
 * `17:58` in its four figure windows, `LINE 1` — WITHOUT its colon: the rose line light is drawn by
 * turn/Orb.tsx, because in this act it leaves the clock and becomes Ava's orb. Everything else is the
 * DeskClock's own setting, so in 9:16 frame 0 is b06's last frame pixel for pixel.
 *
 *   9:16   the figures roll up out of their windows (the hour tens first, a frame apart: the clock's
 *          last flick) and the labels leave up through their masks — the line light stays, alone
 *   16:9   the lockup rides in from above to the top of the left half AT ITS OWN SIZE (figures 112, labels
 *          30: the proportions of b01–b05 and b15's lockup — a scaled-down copy beside the fixed-size labels
 *          read as another face), and after the light has gone rides up and out with an empty colon
 */
import React from 'react';
import { reveal, revealStyle } from '../../../components/Type';
import { glideStyle, subpixel } from '../../../lib/glide';
import { useLayout } from '../../../lib/layout';
import { EASE, tween } from '../../../lib/motion';
import { maskBox, typeStyle } from '../../../lib/type';
import { C, FONT } from '../../../theme';
import { APP } from '../../kit';
import { TURN_LOCAL as T } from '../../timing';
import { CLOCK_TIMES } from '../repeat/desk';
import { clockRide, type ClockGeo, type TurnStage } from './stage';

/** The window's edges (DeskClock's WINDOW_MASK): the figures pass under a short feather. */
const WINDOW_MASK = 'linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%)';
const TIME = CLOCK_TIMES[CLOCK_TIMES.length - 1];
const DIGITS = [TIME[0], TIME[1], TIME[3], TIME[4]];

/** 9:16: the figures' roll-away — window i leaves `i` frames after the sort, over 7 frames (EASE.in3) */
const rollOut = (t: number, i: number) => tween(t, [T.sort + 1 + i, T.sort + 8 + i], [0, 1], EASE.in3);

export const TurnClock: React.FC<{ t: number; S: TurnStage }> = ({ t, S }) => {
  const L = useLayout();
  const c: ClockGeo | null = S.vertical ? S.clock.from : S.clock.to;
  if (!c) return null;
  const ride = clockRide(t, S);
  if (!ride.on) return null;
  const v = S.vertical;
  if (v && rollOut(t, 3) >= 1 && t > T.sort + 12) return null;
  const label = typeStyle('label', L.vertical, { tone: 'paper' });
  // the labels: at rest exactly the DeskClock's (a glide layer each); 9:16 they leave up through their masks
  const lab = (k: number) => reveal(t, -1e6, v ? { exit: { at: T.sort + k, dur: 7 } } : {});
  const dy = ride.dy;
  const moving = Math.abs(dy) > 0.01;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, ...(moving ? subpixel(`translateY(${dy.toFixed(3)}px)`, true) : null) }}>
      {/* TUE */}
      <div style={{ position: 'absolute', left: c.x + c.cellW * 0.06, top: c.dayY, ...label, color: C.muted, whiteSpace: 'nowrap', ...glideStyle(undefined, true) }}>
        {v && t > T.sort ? (
          <span style={maskBox(0)}>
            <span style={revealStyle(lab(0), undefined, true)}>TUE</span>
          </span>
        ) : (
          'TUE'
        )}
      </div>
      {/* the figures, each in its window */}
      {DIGITS.map((d, i) => {
        const yy = v ? -rollOut(t, i) * c.cellH : 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x + i * c.cellW + (i >= 2 ? 2 * c.gap + c.dot : 0),
              top: c.y,
              width: c.cellW,
              height: c.cellH,
              overflow: 'hidden',
              WebkitMaskImage: WINDOW_MASK,
              maskImage: WINDOW_MASK,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: c.cellW,
                height: c.cellH,
                lineHeight: `${c.cellH}px`,
                fontFamily: FONT.ui,
                fontWeight: 440,
                fontSize: c.size,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0,
                textAlign: 'center',
                color: APP.foreground,
                ...subpixel(`translateY(${yy.toFixed(3)}px)`, true),
              }}
            >
              {d}
            </span>
          </div>
        );
      })}
      {/* LINE 1, under the (now empty) colon */}
      <div style={{ position: 'absolute', left: c.dotX, top: c.lineY, ...label, color: C.muted, whiteSpace: 'nowrap', paddingLeft: '0.14em', ...glideStyle('translateX(-50%)', true) }}>
        {v && t > T.sort + 2 ? (
          <span style={maskBox(0)}>
            <span style={revealStyle(lab(2), undefined, true)}>LINE 1</span>
          </span>
        ) : (
          'LINE 1'
        )}
      </div>
    </div>
  );
};

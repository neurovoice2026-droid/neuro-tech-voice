/**
 * The owner's calendar — a dark plate in the room (the site's cover panel,
 * a neutral near-black material with a hairline edge and its top lit by the
 * key light), set in the film's one family: uppercase tracked day labels
 * (TYPE.label, WED in paper), hours in Instrument Sans with tabular figures,
 * hairlines for the hours only (the columns are told apart by space, the WED
 * band and the bookings — no cage of lines), three muted plain bookings, and
 * the site's dashed empty slot at WED 3 PM — until the card lands in it and
 * becomes the event: solid ember, white "• 3:00 PM".
 *
 * Drawn through a CalMap (cal units → world px, per axis): the whole sheet
 * while the card flies and lands (a uniform pose), then cropped into the
 * card window TUE–THU × 12–6 PM (16:9) / 1–5 PM (9:16) during the recompose —
 * the plate IS the rounded clip window, the cells take the card's wider
 * proportions, and the type keeps its own sizes (day labels and hours at the
 * 30 / 28 px label floor, the event's "3:00 PM" fitted to its cell).
 *
 * The landing: the event squashes and settles on one soft spring, its fill
 * runs hot and cools (its light), the dot pings (the booked pill's live dot).
 * The hold: the event's light breathes, one light sweep crosses it on the
 * downbeat, and as "Booked." lands its dot draws itself into a check.
 * No rings, no shockwave, no motion blur.
 */
import React from 'react';
import { EASE, mix, SPRING, springUnit, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { C, FONT } from '../../theme';
import { RESULT } from '../../timing';
import type { ResultTiming } from '../Result';
import { eventFill, EventFace, hexA, PLATE, PLATE_RIM } from './Event';
import { BOOKINGS, CAL, DAYS, HOURS, SLOT, mapX, mapY, type CalMap, type Geo, type Rect } from './geometry';

const LINE = 'rgba(255,255,255,0.065)';
/** an hour label, 12-hour as Ava speaks it: 9 → "9 AM", 15 → "3 PM" */
const hourLabel = (hr: number) => `${((hr + 11) % 12) + 1} ${hr < 12 ? 'AM' : 'PM'}`;
/** the event's light on the sheet: its reach on screen (px beyond the chip's edge) */
const BLOOM_REACH = 96;
/** the landing squash: one soft settle (ζ ≈ .6, ≈ 9 % overshoot of the squash itself) */
const SQUASH = { stiffness: 260, damping: 19, mass: 1 };
/** columns sliding into place: stiff, ζ ≈ .66 */
const COLUMN = { stiffness: 320, damping: 24, mass: 1 };

/** Event block state, shared with the white opening. */
export function eventLookAt(t: number, T: ResultTiming) {
  const k = t - RESULT.land;
  const flash = k < 0 ? 0 : Math.exp(-k / 5.5);
  // the impact squashes it (wider, lower) and one soft spring settles it
  const d = k < 0 ? 0 : 1 - springUnit(k, SQUASH);
  const sx = 1 + 0.05 * d;
  const sy = 1 - 0.05 * d;
  // the anticipation before it opens up: swell (1.1) from rest (in-out), then gather (0.97)
  const pulseUp = tween(t, T.pulseIn, [0, 1], EASE.inOut);
  const pulseDown = tween(t, [T.pulse, RESULT.toWhite[0]], [0, 1], EASE.inOut);
  const pulse = 1 + 0.1 * pulseUp - 0.13 * pulseDown;
  // while the split holds, the ember's light breathes ±6 % on half notes, peaking on the beats
  const idle = tween(t, [RESULT.land + 20, RESULT.bookedWord], [0, 1], EASE.inOut) * (1 - pulseUp);
  const breath = 1 + 0.06 * idle * Math.cos((2 * Math.PI * (t - RESULT.bookedWord)) / 30);
  // the sweep lifts the light as it passes
  const sw = tween(t, T.sweep, [0, 1], EASE.inOut);
  const sweepGlow = Math.sin(Math.PI * sw);
  const glowPulse = pulseUp * (1 - pulseDown * 0.6);
  const ping = tween(t, T.ping, [0, 1], EASE.out3);
  const fill = eventFill(1, flash);
  return {
    flash,
    sx: sx * pulse,
    sy: sy * pulse,
    ping,
    glowPulse,
    breath,
    sweep: sw,
    sweepGlow,
    fill,
  };
}
export type EventLook = ReturnType<typeof eventLookAt>;

/** The event's box-shadow: a hairline in its lit tone, a top highlight, a contact shadow, its light. */
export const eventShadow = (look: EventLook, px = 1) =>
  [
    `0 0 0 ${(1 * px).toFixed(2)}px ${hexA(C.emberLit, 0.3 + 0.4 * look.flash)}`,
    `inset 0 ${(1 * px).toFixed(2)}px 0 rgba(255,255,255,0.2)`,
    `0 ${(3 * px).toFixed(2)}px ${(8 * px).toFixed(2)}px ${(-2 * px).toFixed(2)}px rgba(0,0,0,0.5)`,
    `0 0 ${((34 + 40 * look.flash + 20 * look.glowPulse + 10 * look.sweepGlow) * px).toFixed(1)}px ${((-4 + 6 * look.flash) * px).toFixed(1)}px ${hexA(
      C.ember,
      Math.min(1, (0.42 + 0.3 * look.flash + 0.26 * look.glowPulse + 0.12 * look.sweepGlow) * look.breath),
    )}`,
  ].join(', ');

const inset = (r: Rect, d: number): Rect => ({
  x: r.x + d,
  y: r.y + d,
  w: r.w - 2 * d,
  h: r.h - 2 * d,
});

export const Calendar: React.FC<{
  t: number;
  G: Geo;
  T: ResultTiming;
  map: CalMap;
  /** the camera zoom (screen px per world px) */
  camZ: number;
  /** hide the in-calendar event (the white opening has taken it over) */
  eventOut: boolean;
  vertical: boolean;
  /** deep in the dive: drop the big soft shadows that are off-frame anyway */
  lite?: boolean;
}> = ({ t, G, T, map, camZ, eventOut, vertical, lite = false }) => {
  if (t < T.sheetIn - 3) return null;
  const { clip, r, s, pose } = map;
  const B = G.crop;
  const [b0] = T.build;
  const rr = Math.min(1, Math.max(0, r));

  // local (plate) coordinates
  const X = (xu: number) => mapX(map, xu) - clip.x;
  const Y = (yu: number) => mapY(map, yu) - clip.y;
  const R = (u: Rect): Rect => ({
    x: X(u.x),
    y: Y(u.y),
    w: u.w * map.bx,
    h: u.h * map.by,
  });
  const sAvg = (map.bx + map.by) / 2;

  // type sizes (world px): the whole sheet's natural sizes → the card's own — never under the phone
  // label floor ON SCREEN (30 / 28 px) while the whole week shows at rest; in the close-up the camera
  // carries them past it, so they keep their natural size (the event leads)
  const daySize = mix(Math.max(22 * s, (vertical ? 28 : 30) / camZ), B.day, rr);
  const hourSize = mix(Math.max(19 * s, (vertical ? 28 : 30) / camZ), B.hour, rr);
  const faceSize = mix(G.face * s, B.face, rr);

  // columns slide in behind the plate (a second plane), fast, one small overshoot
  const colIn = (j: number) => springUnit(t - (T.sheetIn + j * 0.5), COLUMN);
  const lag = (j: number) => {
    const e = (1 - colIn(j)) * 85 * s;
    return vertical ? `translateY(${e.toFixed(3)}px)` : `translateX(${e.toFixed(3)}px)`;
  };
  // small rises for labels / hours (no anticipation: they simply arrive)
  const rise = (at: number) => springUnit(t - at, SPRING.text);

  const landed = t >= RESULT.land;
  const look = eventLookAt(t, T);

  // the slot: comes in once the sheet is built, its dashes breathe while the card is wound up, firm
  // as it nears — and it is simply covered by the card that lands in it
  const slotIn = springUnit(t - T.slotIn[0], SPRING.text);
  const slotOp = tween(t, T.slotIn, [0, 1], EASE.house) * (1 - tween(t, [RESULT.land - 1, RESULT.land + 2], [0, 1], EASE.inOut));
  const beck = tween(t, T.beckon, [0, 1], EASE.inOut);
  const near = tween(t, [RESULT.fly + 6, RESULT.land], [0, 1], EASE.in2);
  const wave = 0.5 - 0.5 * Math.cos(((t - T.beckon[0]) / 7.5) * Math.PI);
  const slotA = 0.22 + 0.16 * beck + 0.1 * wave * beck * (1 - near) + 0.22 * near;

  // the event: full cell width in the card, its own corner radius
  const ev = inset(R(G.block(SLOT.day, SLOT.from, SLOT.to)), mix(CAL.inset * s, 4, rr));
  const evRadius = mix(CAL.slotRadius * s, 14, rr);
  const slotR = R(G.slot);

  const warmGlow = landed ? tween(t, [RESULT.land, RESULT.land + 10], [0, 1], EASE.out3) * (0.75 + 0.4 * look.flash) : 0;

  // hour hairlines (drawn in during the build, left → right)
  const lineH = (i: number) => tween(t, [b0 + i * 0.25, b0 + i * 0.25 + 5], [0, 1], EASE.draw);

  // the confirmation: as "Booked." lands, the event's dot draws itself into a check
  // … and the check leaves before the dive takes the event (it shrinks back to the dot's place)
  const chkIn = tween(t, [T.check - 1, T.check + 6], [0, 1], EASE.out3);
  const chkOut = tween(t, [T.pulse, RESULT.toWhite[0] + 2], [0, 1], EASE.inOut);
  const check = chkIn * (1 - chkOut);

  // the sweep band across the event
  const sweepOn = look.sweep > 0 && look.sweep < 1;
  const labelStyle = typeStyle('label', vertical, {
    tone: 'night',
    size: daySize,
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: clip.x,
        top: clip.y,
        width: clip.w,
        height: clip.h,
      }}
    >
      {/* the plate: a neutral dark material — its edge a hairline, its top catching the light, a real shadow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: map.radius,
          background: `linear-gradient(180deg, ${PLATE_RIM}, rgba(255,255,255,0) 26%), ${PLATE}`,
          boxShadow: [
            '0 0 0 1px rgba(255,255,255,0.07)',
            'inset 0 1px 0 rgba(255,255,255,0.09)',
            ...(lite
              ? []
              : [
                  `0 ${(30 * sAvg).toFixed(1)}px ${(70 * sAvg).toFixed(1)}px ${(-24 * sAvg).toFixed(1)}px rgba(0,0,0,0.75)`,
                  `0 ${(8 * sAvg).toFixed(1)}px ${(18 * sAvg).toFixed(1)}px ${(-8 * sAvg).toFixed(1)}px rgba(0,0,0,0.5)`,
                ]),
          ].join(', '),
        }}
      />
      {/* everything else lives inside the rounded window */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: map.radius,
          overflow: 'hidden',
        }}
      >
        {/* WED: its column lifted a hair */}
        <div
          style={{
            position: 'absolute',
            left: X(G.gridLeft + SLOT.day * G.colW) + 2,
            top: mix(pose.top + (CAL.dayY - 26) * s - clip.y, B.card.y + 8 - clip.y, rr),
            width: G.colW * map.bx - 4,
            height:
              mix(pose.top + (G.bodyBottom + 4) * s - clip.y, B.card.y + B.card.h + 30 - clip.y, rr) -
              mix(pose.top + (CAL.dayY - 26) * s - clip.y, B.card.y + 8 - clip.y, rr),
            borderRadius: mix(12 * s, 14, rr),
            background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))',
            opacity: tween(t, T.wedIn, [0, 1], EASE.house),
            transform: `${lag(SLOT.day)} scaleY(${(0.96 + 0.04 * rise(T.wedIn[0])).toFixed(4)})`,
            transformOrigin: '50% 0',
          }}
        />

        {/* day labels (TYPE.label): rise in; WED in paper; the days outside the card fold away */}
        {DAYS.map((d, j) => {
          const p = rise(b0 + j * 0.4);
          const cx = X(G.gridLeft + (j + 0.5) * G.colW);
          const cy = mix(pose.top + CAL.dayY * s - clip.y, B.card.y + B.header / 2 - clip.y, rr);
          const lit = j === SLOT.day;
          return (
            <div
              key={d}
              style={{
                position: 'absolute',
                left: cx,
                top: cy,
                transform: `translate(-50%, calc(-50% + ${((1 - p) * 14 * s).toFixed(3)}px)) ${lag(j)}`,
                opacity: Math.min(1, Math.max(0, p * 1.4)) * (j >= B.cols[0] && j < B.cols[1] ? 1 : 1 - rr),
                ...labelStyle,
                lineHeight: 1,
                marginRight: '-0.14em',
                color: lit ? C.paper : C.paperDim,
                whiteSpace: 'nowrap',
              }}
            >
              {d}
            </div>
          );
        })}

        {/* hours, on their rows (Instrument Sans, tabular figures) */}
        {HOURS.slice(0, -1).map((hr, i) => {
          const p = rise(b0 + 0.5 + i * 0.3);
          const right = mix(pose.left + (CAL.pad + CAL.gutter - 18) * s - clip.x, B.card.x + B.gutter - 22 - clip.x, rr);
          const cy = Y(CAL.bodyTop + (i + 0.5) * G.rowH);
          const lit = hr === SLOT.from;
          return (
            <div
              key={hr}
              style={{
                position: 'absolute',
                left: right,
                top: cy,
                transform: `translate(-100%, calc(-50% + ${((1 - p) * 10 * s).toFixed(3)}px))`,
                fontFamily: FONT.ui,
                fontWeight: lit ? 520 : 460,
                fontSize: hourSize,
                lineHeight: 1,
                letterSpacing: '0.01em',
                color: lit ? C.paper : C.paperDim,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                opacity: Math.min(1, Math.max(0, p * 1.4)) * (lit ? 1 : 0.78) * (hr >= B.rows[0] && hr < B.rows[1] ? 1 : 1 - rr),
              }}
            >
              {hourLabel(hr)}
            </div>
          );
        })}

        {/* the grid: in the card, clipped under the header band and right of the hours gutter */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: rr > 0 ? `inset(${((B.header - 1) * rr).toFixed(2)}px 0px 0px ${(B.gutter * rr).toFixed(2)}px)` : undefined,
          }}
        >
          {/* the hour hairlines — the only lines on the sheet */}
          {HOURS.map((_, i) => {
            const y = Y(CAL.bodyTop + i * G.rowH);
            const x0 = X(G.gridLeft) - 10 * s * (1 - rr);
            return (
              <div
                key={`h${i}`}
                style={{
                  position: 'absolute',
                  left: x0,
                  top: y - 0.5,
                  width: X(G.gridRight) - x0,
                  height: 1,
                  background: LINE,
                  transform: `scaleX(${lineH(i).toFixed(4)})`,
                  transformOrigin: '0 50%',
                }}
              />
            );
          })}

          {/* existing bookings: plain, 6 % paper, no borders */}
          {BOOKINGS.map(([day, from, to], i) => {
            const b = inset(R(G.block(day, from, to)), mix(CAL.inset * s, 5, rr));
            const pop = springUnit(t - (b0 + day * 0.3 + (i % 2) * 0.5), SPRING.text);
            return (
              <div key={i} style={{ position: 'absolute', inset: 0, transform: lag(day) }}>
                <div
                  style={{
                    position: 'absolute',
                    left: b.x,
                    top: b.y,
                    width: b.w,
                    height: b.h,
                    borderRadius: mix(9 * s, 12, rr),
                    background: 'rgba(237,236,241,0.06)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    opacity: Math.min(1, Math.max(0, pop * 1.4)),
                    transform: `translateY(${((1 - pop) * 8 * s).toFixed(3)}px) scale(${(0.92 + 0.08 * Math.min(1, pop)).toFixed(4)})`,
                  }}
                />
              </div>
            );
          })}

          {/* the event's light on the sheet: added round the chip (screen), ≤ BLOOM_REACH screen px
              beyond its edge whatever the zoom — light, not a wash */}
          {warmGlow > 0.01 ? (
            <div
              style={{
                position: 'absolute',
                left: ev.x,
                top: ev.y,
                width: ev.w,
                height: ev.h,
                borderRadius: evRadius,
                transform: `scale(${look.sx.toFixed(4)}, ${look.sy.toFixed(4)})`,
                transformOrigin: '50% 60%',
                mixBlendMode: 'screen',
                boxShadow: [
                  `0 0 ${(22 / camZ).toFixed(2)}px ${(2 / camZ).toFixed(2)}px ${hexA(C.emberLit, 0.22 * warmGlow * look.breath)}`,
                  `0 0 ${((BLOOM_REACH - 12) / camZ).toFixed(2)}px ${(12 / camZ).toFixed(2)}px ${hexA(C.ember, 0.26 * warmGlow * look.breath)}`,
                ].join(', '),
              }}
            />
          ) : null}

          {/* the dashed empty slot (the site's: dashed, 1.5 px white) — breathing while it waits */}
          {slotOp > 0.001 ? (
            <div
              style={{
                position: 'absolute',
                left: slotR.x,
                top: slotR.y,
                width: slotR.w,
                height: slotR.h,
                transform: `${lag(SLOT.day)} scale(${(0.9 + 0.1 * slotIn).toFixed(4)})`,
                opacity: slotOp < 0.999 ? slotOp : undefined,
                borderRadius: CAL.slotRadius * s,
                border: `${Math.max(1.5, 1.5 / camZ).toFixed(2)}px dashed rgba(255,255,255,${Math.min(0.9, slotA).toFixed(3)})`,
                background: `rgba(255,255,255,${(0.02 + 0.03 * near).toFixed(3)})`,
                boxSizing: 'border-box',
              }}
            />
          ) : null}

          {/* the booked event */}
          {landed && !eventOut ? (
            <div
              style={{
                position: 'absolute',
                left: ev.x,
                top: ev.y,
                width: ev.w,
                height: ev.h,
                transform: `scale(${look.sx.toFixed(4)}, ${look.sy.toFixed(4)})`,
                transformOrigin: '50% 60%',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: evRadius,
                  overflow: 'hidden',
                  background: `linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 55%), ${look.fill}`,
                  boxShadow: eventShadow(look, sAvg / 2.2),
                }}
              >
                {sweepOn ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${(-45 + 170 * look.sweep).toFixed(3)}%`,
                      width: '36%',
                      background:
                        'linear-gradient(100deg, rgba(255,240,228,0) 0%, rgba(255,240,228,0.16) 35%, rgba(255,246,238,0.5) 50%, rgba(255,240,228,0.16) 65%, rgba(255,240,228,0) 100%)',
                      transform: 'skewX(-14deg)',
                    }}
                  />
                ) : null}
              </div>
              <EventFace size={faceSize} op={1} ping={look.ping} color={C.white} dotColor={C.white} check={check} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

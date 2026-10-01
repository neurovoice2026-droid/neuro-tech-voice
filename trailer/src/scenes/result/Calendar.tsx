/**
 * The owner's calendar, as a site-style stage on the night room: radius 28,
 * the cover panel (opaque), white/.08 hairlines, uppercase tracked day labels
 * (WED lit), Geist Mono hours, three muted plain bookings (6 % paper, no
 * borders), and the site's dashed empty slot at WED 15:00 — until the card
 * lands in it and becomes the event: solid ember, white "15:00".
 *
 * Drawn through a CalMap (cal units → world px, per axis): the whole sheet
 * while the card flies and lands (a uniform pose), then cropped into the
 * card window TUE–THU × 12–18 (16:9) / 13–17 (9:16) during the recompose —
 * the plate IS the rounded clip window, the cells take the card's wider
 * proportions, and the type keeps its own sizes (day labels 30 px, hours
 * 26 px, the event's "15:00" 48 / 44 px).
 *
 * The landing: squash/stretch on the event, the pill's ping, an ember flash,
 * two outline rings, the dashed outline knocked outwards, a soft ember ring
 * running through the sheet and lighting the hairlines it crosses.
 * The hold: the event's glow breathes on half notes; one light sweep across
 * it on the downbeat; the confirmation check (the closing light's green)
 * pops on its corner.
 */
import React from 'react';
import { aos, EASE, mix, mixHex, SPRING, springAt, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { RESULT } from '../../timing';
import type { ResultTiming } from '../Result';
import { eventFill, EventFace, hexA } from './Event';
import { BOOKINGS, CAL, DAYS, HOURS, SLOT, mapX, mapY, type CalMap, type Geo, type Rect } from './geometry';

const LINE = 'rgba(255,255,255,0.08)';
/** the night light (#demo's 3 a.m. orb mid-tone) for the card's rim */
const NIGHT_RIM = '#7c3aed';
/** the event's bloom reach on screen (px beyond the chip's edge) — ember stays a mark + its light */
const BLOOM_REACH = 118;
/** the closing light's green, on the dark (the confirmation accent) */
const SETTLED = '#7ee2a8';
/** the check's spring: a small chip, ~12 % overshoot, first crossing ≈ 3.6 f */
const CHECK = { stiffness: 380, damping: 19.5, mass: 0.8 };

/** Event block state, shared with the white opening. */
export function eventLookAt(t: number, T: ResultTiming) {
  const k = t - RESULT.land;
  const flash = k < 0 ? 0 : Math.exp(-k / 5.5);
  // squash on the impact frame (vertical hit), SPRING.land rings it out
  const d = k < 0 ? 0 : 1 - springAt(t, RESULT.land, SPRING.land);
  const sx = 1 + 0.065 * d;
  const sy = 1 - 0.065 * d;
  // the anticipation pulse before it opens up: swell (1.12) from rest (in-out), then gather (0.97)
  const pulseUp = tween(t, T.pulseIn, [0, 1], EASE.inOut);
  const pulseDown = tween(t, [T.pulse, RESULT.toWhite[0]], [0, 1], EASE.inOut);
  const pulse = 1 + 0.12 * pulseUp - 0.15 * pulseDown;
  // while the split holds, the ember glow breathes .9 ↔ 1.1 on half notes, peaking on the beats
  const idle = tween(t, [RESULT.land + 20, RESULT.bookedWord], [0, 1], EASE.inOut) * (1 - pulseUp);
  const breath = 1 + 0.1 * idle * Math.cos((2 * Math.PI * (t - RESULT.bookedWord)) / 30);
  // the sweep lifts the glow as it passes
  const sw = tween(t, T.sweep, [0, 1], EASE.inOut);
  const sweepGlow = Math.sin(Math.PI * sw);
  const glowPulse = pulseUp * (1 - pulseDown * 0.6);
  const ping = tween(t, T.ping, [0, 1], EASE.out3);
  const ring = tween(t, [RESULT.land, T.ping[1]], [0, 1], EASE.out3);
  const ring2 = tween(t, [T.ping[0], T.ping[1] + 3], [0, 1], EASE.out3);
  const fill = eventFill(1, flash);
  return { flash, sx: sx * pulse, sy: sy * pulse, ping, ring, ring2, glowPulse, breath, sweep: sw, sweepGlow, fill };
}
export type EventLook = ReturnType<typeof eventLookAt>;

/** The event's box-shadow: the ember glow (0 0 40px rgba(238,84,35,.55) at rest), breathing. */
export const eventShadow = (look: EventLook, px = 1) =>
  [
    `0 0 0 ${(1 * px).toFixed(2)}px ${hexA(C.emberLit, 0.35 + 0.5 * look.flash)}`,
    `inset 0 ${(1 * px).toFixed(2)}px 0 rgba(255,255,255,0.18)`,
    `0 ${(4 * px).toFixed(2)}px ${(10 * px).toFixed(2)}px ${(-3 * px).toFixed(2)}px rgba(0,0,0,0.45)`,
    `0 0 ${((40 + 50 * look.flash + 24 * look.glowPulse + 14 * look.sweepGlow) * px).toFixed(1)}px ${((-2 + 8 * look.flash) * px).toFixed(1)}px ${hexA(
      C.ember,
      Math.min(1, (0.55 + 0.35 * look.flash + 0.3 * look.glowPulse + 0.15 * look.sweepGlow) * look.breath),
    )}`,
  ].join(', ');

const inset = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

export const Calendar: React.FC<{
  t: number;
  G: Geo;
  T: ResultTiming;
  map: CalMap;
  /** screen-px velocity of the sheet (motion blur) */
  vel: { x: number; y: number };
  /** the camera zoom (screen px per world px) */
  camZ: number;
  /** hide the in-calendar event (the white opening has taken it over) */
  eventOut: boolean;
  vertical: boolean;
  /** deep in the dive: drop the costly blurred shadows that are off-frame anyway */
  lite?: boolean;
}> = ({ t, G, T, map, vel, camZ, eventOut, vertical, lite = false }) => {
  if (t < T.sheetIn - 3) return null;
  const { clip, r, s, pose } = map;
  const B = G.crop;
  const [b0] = T.build;
  const rr = Math.min(1, Math.max(0, r));

  // local (plate) coordinates
  const X = (xu: number) => mapX(map, xu) - clip.x;
  const Y = (yu: number) => mapY(map, yu) - clip.y;
  const R = (u: Rect): Rect => ({ x: X(u.x), y: Y(u.y), w: u.w * map.bx, h: u.h * map.by });
  const sAvg = (map.bx + map.by) / 2;

  // type sizes (world px): the whole sheet's natural sizes → the card's own
  const daySize = mix(22 * s, B.day, rr);
  const hourSize = mix(18 * s, B.hour, rr);
  const faceSize = mix(G.face * s, B.face, rr);

  // columns cascade in behind the plate (a second plane), fast, one small overshoot
  const colIn = (j: number) => springAt(t, T.sheetIn + j * 0.5, { stiffness: 320, damping: 22, mass: 1 });
  const lag = (j: number) => {
    const e = (1 - colIn(j)) * 85 * s;
    return vertical ? `translateY(${e.toFixed(2)}px)` : `translateX(${e.toFixed(2)}px)`;
  };
  // small rises with an overshoot, for labels / hours
  const rise = (at: number) => aos(t, at, { anticip: 2, depth: 0.12, config: SPRING.pop });

  const landed = t >= RESULT.land;
  const look = eventLookAt(t, T);

  // slot: beckons once built (alpha up, breathes, lilac wash), locks on as the card nears
  const slotIn = aos(t, T.slotIn[0], { anticip: 2, depth: 0.1, config: SPRING.pop });
  const slotOp = tween(t, T.slotIn, [0, 1], EASE.house);
  const beck = tween(t, T.beckon, [0, 1], EASE.inOut);
  const near = tween(t, [RESULT.fly + 6, RESULT.land], [0, 1], EASE.in2);
  const wave = 0.5 + 0.5 * Math.sin((t - T.beckon[0]) / 2.4);
  const slotA = 0.25 + 0.35 * beck + 0.08 * wave * beck + 0.25 * near;
  const slotScale = Math.max(0, slotIn) * (1 + 0.04 * wave * beck * (1 - near));
  const knock = tween(t, [RESULT.land, RESULT.land + 16], [0, 1], EASE.out3);

  // the event: full cell width in the card, its own corner radius
  const ev = inset(R(G.block(SLOT.day, SLOT.from, SLOT.to)), mix(CAL.inset * s, 4, rr));
  const evC = { x: ev.x + ev.w / 2, y: ev.y + ev.h / 2 };
  const evRadius = mix(CAL.slotRadius * s, 14, rr);
  const slotR = R(G.slot);

  // the landing's shockwave: a soft ember ring through the sheet (world px)
  const sk = tween(t, T.shock, [0, 1], EASE.out3);
  const Rw = (20 + sk * Math.max(G.W, G.H) * 1.1) * sAvg;
  const shockOn = t >= T.shock[0] && sk < 0.999;
  const shockA = (1 - sk) * (1 - sk);

  // motion blur of the whole sheet (screen px → world px)
  const bx = Math.min(9, Math.abs(vel.x) * 0.09) / camZ;
  const by = Math.min(9, Math.abs(vel.y) * 0.09) / camZ;
  const blurOn = bx > 0.35 || by > 0.35;

  const warmGlow = landed ? tween(t, [RESULT.land, RESULT.land + 10], [0, 1], EASE.out3) * (0.75 + 0.5 * look.flash) : 0;

  // grid hairlines (drawn in during the build)
  const lineH = (i: number) => tween(t, [b0 + i * 0.25, b0 + i * 0.25 + 4], [0, 1], EASE.draw);
  const lineV = (j: number) => tween(t, [b0 + 0.5 + j * 0.25, Math.min(T.build[1], b0 + 4.5 + j * 0.25)], [0, 1], EASE.draw);
  const grid = (color: string, draw: boolean) => (
    <>
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
              background: color,
              transform: draw ? `scaleX(${lineH(i).toFixed(4)})` : undefined,
              transformOrigin: '0 50%',
            }}
          />
        );
      })}
      {Array.from({ length: 8 }, (_, j) => {
        const y0 = mix(Y(CAL.bodyTop), B.card.y + 10 - clip.y, rr);
        return (
          <div
            key={`v${j}`}
            style={{
              position: 'absolute',
              left: X(G.gridLeft + j * G.colW) - 0.5,
              top: y0,
              width: 1,
              height: Y(G.bodyBottom) - y0,
              background: color,
              transform: draw ? `scaleY(${lineV(j).toFixed(4)})` : undefined,
              transformOrigin: '50% 0',
            }}
          />
        );
      })}
    </>
  );

  // the check pops on the event's corner (lock ≈ T.check), with a green ring burst on the hit
  // … and leaves before the dive takes the event: a small swell (anticipation), then a fast shrink
  const chkExit = tween(t, [T.pulse, RESULT.toWhite[0]], [0, 1], (u) => u);
  const chkOut = chkExit < 0.3 ? 1 + 0.12 * EASE.inOut(chkExit / 0.3) : 1.12 * (1 - EASE.in2((chkExit - 0.3) / 0.7));
  const chk = aos(t, T.check - 4, { anticip: 2, depth: 0.08, config: CHECK }) * chkOut;
  const chkRing = tween(t, [T.check, T.check + 14], [0, 1], EASE.out3);
  const chkD = mix(26 * s, 38, rr);

  // the sweep band across the event
  const sweepOn = look.sweep > 0 && look.sweep < 1;

  return (
    <>
      {blurOn ? (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
          <defs>
            <filter id="result-cal-mb" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={`${bx.toFixed(2)} ${by.toFixed(2)}`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: clip.x,
          top: clip.y,
          width: clip.w,
          height: clip.h,
          filter: blurOn ? 'url(#result-cal-mb)' : undefined,
        }}
      >
        {/* the plate (a soft contact shadow + the deep drop, under the clip) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: map.radius,
            // opaque cover panel: nothing of the room transmits through the card (no mud under it)
            background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 30%), ${C.panel}`,
            boxShadow: [
              '0 0 0 1px rgba(255,255,255,0.07)',
              'inset 0 1px 0 rgba(255,255,255,0.07)',
              // deep in the dive the plate's edges are far off-frame: skip its big blurred shadows
              ...(lite
                ? []
                : [
                    `0 ${(40 * sAvg).toFixed(1)}px ${(80 * sAvg).toFixed(1)}px ${(-30 * sAvg).toFixed(1)}px rgba(0,0,0,0.8)`,
                    `0 ${(12 * sAvg).toFixed(1)}px ${(24 * sAvg).toFixed(1)}px ${(-12 * sAvg).toFixed(1)}px rgba(0,0,0,0.6)`,
                    // the night light rims the card once it is in its half (cool: ember stays on the event)
                    `0 0 ${(90 * rr).toFixed(1)}px ${(-10 * rr).toFixed(1)}px ${hexA(NIGHT_RIM, 0.2 * rr)}`,
                  ]),
            ].join(', '),
          }}
        />
        {/* everything else lives inside the rounded window */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: map.radius, overflow: 'hidden' }}>
          {/* WED, lifted a hair */}
          <div
            style={{
              position: 'absolute',
              left: X(G.gridLeft + SLOT.day * G.colW) + 2,
              top: mix(pose.top + (CAL.dayY - 26) * s - clip.y, B.card.y + 8 - clip.y, rr),
              width: G.colW * map.bx - 4,
              height:
                mix(pose.top + (G.bodyBottom + 4) * s - clip.y, B.card.y + B.card.h + 30 - clip.y, rr) -
                mix(pose.top + (CAL.dayY - 26) * s - clip.y, B.card.y + 8 - clip.y, rr),
              borderRadius: mix(14 * s, 16, rr),
              background: `linear-gradient(180deg, rgba(185,163,255,${(0.085 + 0.03 * beck * (landed ? 0 : 1)).toFixed(3)}), rgba(185,163,255,0.025))`,
              boxShadow: 'inset 0 0 0 1px rgba(185,163,255,0.08)',
              opacity: tween(t, T.wedIn, [0, 1], EASE.house),
              transform: `${lag(SLOT.day)} scaleY(${(0.94 + 0.06 * Math.max(0, rise(T.wedIn[0]))).toFixed(4)})`,
              transformOrigin: '50% 0',
            }}
          />

          {/* day labels: rise with an overshoot; WED lit; the days outside the card fold away */}
          {DAYS.map((d, j) => {
            const p = rise(b0 + j * 0.4);
            const cx = X(G.gridLeft + (j + 0.5) * G.colW);
            const cy = mix(pose.top + CAL.dayY * s - clip.y, B.card.y + B.header / 2 - clip.y, rr);
            return (
              <div
                key={d}
                style={{
                  position: 'absolute',
                  left: cx,
                  top: cy,
                  transform: `translate(-50%, calc(-50% + ${((1 - p) * 16 * s).toFixed(2)}px)) ${lag(j)}`,
                  opacity: Math.min(1, Math.max(0, p * 1.4)) * (j >= B.cols[0] && j < B.cols[1] ? 1 : 1 - rr),
                  fontFamily: FONT.body,
                  fontWeight: j === SLOT.day ? 600 : 500,
                  fontSize: daySize,
                  lineHeight: 1,
                  letterSpacing: TRACK.label,
                  marginRight: '-0.14em',
                  textTransform: 'uppercase',
                  color: j === SLOT.day ? C.paper : C.paperDim,
                  whiteSpace: 'nowrap',
                }}
              >
                {d}
              </div>
            );
          })}

          {/* hours, on their rows */}
          {HOURS.slice(0, -1).map((hr, i) => {
            const p = rise(b0 + 0.5 + i * 0.3);
            const right = mix(pose.left + (CAL.pad + CAL.gutter - 18) * s - clip.x, B.card.x + B.gutter - 20 - clip.x, rr);
            const cy = Y(CAL.bodyTop + (i + 0.5) * G.rowH);
            const lit = hr === 15;
            return (
              <div
                key={hr}
                style={{
                  position: 'absolute',
                  left: right,
                  top: cy,
                  transform: `translate(-100%, calc(-50% + ${((1 - p) * 10 * s).toFixed(2)}px))`,
                  fontFamily: FONT.mono,
                  fontSize: hourSize,
                  lineHeight: 1,
                  color: lit ? C.paper : C.paperDim,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  opacity: Math.min(1, Math.max(0, p * 1.4)) * (lit ? 1 : 0.8) * (hr >= B.rows[0] && hr < B.rows[1] ? 1 : 1 - rr),
                }}
              >
                {String(hr).padStart(2, '0')}:00
              </div>
            );
          })}

          {/* the grid: in the card, clipped under the header band and right of the hours gutter */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath:
                rr > 0 ? `inset(${((B.header - 1) * rr).toFixed(2)}px 0px 0px ${(B.gutter * rr).toFixed(2)}px)` : undefined,
            }}
          >
            {/* hairlines */}
            {grid(LINE, true)}

            {/* existing bookings: plain, 6 % paper, no borders */}
            {BOOKINGS.map(([day, from, to], i) => {
              const b = inset(R(G.block(day, from, to)), mix(CAL.inset * s, 5, rr));
              const pop = aos(t, b0 + day * 0.3 + (i % 2) * 0.5, { anticip: 2, depth: 0.1, config: SPRING.pop });
              return (
                <div key={i} style={{ position: 'absolute', inset: 0, transform: lag(day) }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: b.x,
                      top: b.y,
                      width: b.w,
                      height: b.h,
                      borderRadius: mix(10 * s, 12, rr),
                      background: 'rgba(237,236,241,0.06)',
                      opacity: Math.min(1, Math.max(0, pop * 1.4)),
                      transform: `translateY(${((1 - pop) * 8 * s).toFixed(2)}px) scale(${(0.86 + 0.14 * Math.max(0, pop)).toFixed(4)})`,
                    }}
                  />
                </div>
              );
            })}

            {/* the event's bloom: light ADDED round the chip (screen blend), ≤ BLOOM_REACH screen px
                beyond its edge whatever the zoom — a hot inner rim + a soft falloff, no wash on the sheet */}
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
                    `0 0 ${(26 / camZ).toFixed(2)}px ${(3 / camZ).toFixed(2)}px ${hexA(C.emberLit, 0.3 * warmGlow * look.breath)}`,
                    `0 0 ${((BLOOM_REACH - 14) / camZ).toFixed(2)}px ${(14 / camZ).toFixed(2)}px ${hexA(C.ember, 0.34 * warmGlow * look.breath)}`,
                  ].join(', '),
                }}
              />
            ) : null}

            {/* the shockwave: a soft ember ring through the sheet, lighting the lines it crosses */}
            {shockOn ? (
              <>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: shockA,
                    background: `radial-gradient(circle at ${evC.x.toFixed(1)}px ${evC.y.toFixed(1)}px, ${hexA(C.ember, 0)} ${(Rw - 64 * sAvg).toFixed(1)}px, ${hexA(C.ember, 0.1)} ${(Rw - 22 * sAvg).toFixed(1)}px, ${hexA(C.emberLit, 0.16)} ${(Rw - 4 * sAvg).toFixed(1)}px, ${hexA(C.ember, 0)} ${(Rw + 14 * sAvg).toFixed(1)}px)`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.8 * shockA,
                    WebkitMaskImage: `radial-gradient(circle at ${evC.x.toFixed(1)}px ${evC.y.toFixed(1)}px, transparent ${(Rw - 60 * sAvg).toFixed(1)}px, #000 ${(Rw - 6 * sAvg).toFixed(1)}px, transparent ${(Rw + 16 * sAvg).toFixed(1)}px)`,
                    maskImage: `radial-gradient(circle at ${evC.x.toFixed(1)}px ${evC.y.toFixed(1)}px, transparent ${(Rw - 60 * sAvg).toFixed(1)}px, #000 ${(Rw - 6 * sAvg).toFixed(1)}px, transparent ${(Rw + 16 * sAvg).toFixed(1)}px)`,
                  }}
                >
                  {grid(hexA(C.emberLit, 0.55), false)}
                </div>
              </>
            ) : null}

            {/* the dashed empty slot (site: dashed, 1.5px white/.25) — beckoning */}
            {t < RESULT.land + 16 && slotOp > 0.001 ? (
              <div
                style={{
                  position: 'absolute',
                  left: slotR.x,
                  top: slotR.y,
                  width: slotR.w,
                  height: slotR.h,
                  transform: landed
                    ? `scale(${(1 + 0.32 * knock).toFixed(4)}, ${(1 + 0.6 * knock).toFixed(4)})`
                    : `${lag(SLOT.day)} scale(${slotScale.toFixed(4)})`,
                  opacity: slotOp,
                }}
              >
                {!landed ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: -10 * s,
                      borderRadius: (CAL.slotRadius + 10) * s,
                      background: `radial-gradient(closest-side, rgba(185,163,255,${(0.22 * beck + 0.18 * near).toFixed(3)}), rgba(185,163,255,0))`,
                    }}
                  />
                ) : null}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: CAL.slotRadius * s,
                    border: `1.5px dashed ${landed ? hexA(C.emberLit, 0.9 * (1 - knock)) : `rgba(255,255,255,${Math.min(0.95, slotA).toFixed(3)})`}`,
                    background: landed ? 'transparent' : `rgba(185,163,255,${(0.04 + 0.08 * beck + 0.08 * near).toFixed(3)})`,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
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
                {[
                  { k: look.ring, c: C.ember, a: 0.85, grow: 30, w: 2.5 },
                  { k: look.ring2, c: C.emberLit, a: 0.5, grow: 44, w: 1.5 },
                ].map((g, i) =>
                  g.k > 0 && g.k < 1 ? (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        inset: -g.grow * g.k * sAvg,
                        borderRadius: evRadius + g.grow * g.k * sAvg,
                        boxShadow: `0 0 0 ${(g.w * (1 - 0.6 * g.k) * sAvg).toFixed(2)}px ${hexA(g.c, g.a * (1 - g.k) * (1 - g.k * 0.4))}`,
                      }}
                    />
                  ) : null,
                )}
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
                        left: `${(-45 + 170 * look.sweep).toFixed(2)}%`,
                        width: '38%',
                        background:
                          'linear-gradient(100deg, rgba(255,240,228,0) 0%, rgba(255,240,228,0.2) 35%, rgba(255,246,238,0.62) 50%, rgba(255,240,228,0.2) 65%, rgba(255,240,228,0) 100%)',
                        transform: 'skewX(-14deg)',
                      }}
                    />
                  ) : null}
                </div>
                <EventFace size={faceSize} op={1} ping={look.ping} color={C.white} dotColor={C.white} />
                {/* the confirmation check — the closing light's green, on the event's corner */}
                {chk > 0.001 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: ev.w - chkD * 0.3,
                      top: -chkD * 0.7,
                      width: chkD,
                      height: chkD,
                      transform: `translate(-50%, 0) scale(${Math.max(0, chk).toFixed(4)})`,
                      transformOrigin: '50% 50%',
                    }}
                  >
                    {chkRing > 0 && chkRing < 1 ? (
                      <div
                        style={{
                          position: 'absolute',
                          inset: -chkD * 0.9 * chkRing,
                          borderRadius: '50%',
                          boxShadow: `0 0 0 ${(2 * (1 - chkRing)).toFixed(2)}px ${hexA(SETTLED, 0.7 * (1 - chkRing))}`,
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: mixHex('#16241d', '#2c5a42', Math.max(0, 1 - chkRing) * 0.6),
                        boxShadow: `0 0 0 2px ${SETTLED}, 0 0 ${(16 + 20 * Math.max(0, 1 - chkRing)).toFixed(1)}px ${hexA(SETTLED, 0.45)}, 0 4px 10px -2px rgba(0,0,0,0.5)`,
                      }}
                    />
                    <svg viewBox="0 0 24 24" width={chkD} height={chkD} style={{ position: 'absolute', inset: 0 }} aria-hidden>
                      <path
                        d="M7 12.5l3.2 3.2L17.2 8.6"
                        fill="none"
                        stroke={SETTLED}
                        strokeWidth={2.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={16}
                        strokeDashoffset={16 * (1 - tween(t, [T.check - 1, T.check + 4], [0, 1], EASE.out3))}
                      />
                    </svg>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};

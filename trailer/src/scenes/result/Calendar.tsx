/**
 * The owner's calendar, as a site-style stage on the night room: radius 28,
 * the cover panel at 92 %, white/.08 hairlines, uppercase tracked day
 * labels, Geist Mono hours, muted plain bookings, WED lifted a hair, and the
 * site's dashed empty slot at WED 15:00 — until the card lands in it.
 *
 * Drawn in natural units (W×H) and placed by a Pose. The whole build is done
 * by t≈13 (T.build), so the slot is established — and beckoning — before
 * the throw. On the landing: squash/stretch on the event, the pill's ping,
 * an ember flash, two outline rings, the dashed outline knocked outwards,
 * and a soft ember ring that runs through the sheet, lighting the hairlines
 * it crosses.
 */
import React from 'react';
import { CornerDot, Label } from '../../components/Type';
import { aos, EASE, mixHex, SPRING, springAt, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { RESULT } from '../../timing';
import type { ResultTiming } from '../Result';
import { EventFace, eventFill, hexA } from './Event';
import { BOOKINGS, CAL, DAYS, HOURS, SLOT, type Geo, type Pose } from './geometry';
import { Letters } from './Split';

const LINE = 'rgba(255,255,255,0.08)';

const GridLines: React.FC<{ G: Geo; color: string; t: number; T: ResultTiming; draw: boolean }> = ({
  G,
  color,
  t,
  T,
  draw,
}) => {
  const [a, b] = T.build;
  const dur = 4;
  const h = (i: number) => (draw ? tween(t, [a + i * 0.25, a + i * 0.25 + dur], [0, 1], EASE.draw) : 1);
  const v = (j: number) =>
    draw ? tween(t, [a + 0.5 + j * 0.25, Math.min(b, a + 0.5 + j * 0.25 + dur)], [0, 1], EASE.draw) : 1;
  return (
    <>
      {HOURS.map((_, i) => (
        <div
          key={`h${i}`}
          style={{
            position: 'absolute',
            left: G.gridLeft - 10,
            top: CAL.bodyTop + i * G.rowH - 0.5,
            width: G.gridRight - G.gridLeft + 10,
            height: 1,
            background: color,
            transform: `scaleX(${h(i).toFixed(4)})`,
            transformOrigin: '0 50%',
          }}
        />
      ))}
      {Array.from({ length: 8 }, (_, j) => (
        <div
          key={`v${j}`}
          style={{
            position: 'absolute',
            left: G.gridLeft + j * G.colW - 0.5,
            top: CAL.bodyTop,
            width: 1,
            height: G.bodyBottom - CAL.bodyTop,
            background: color,
            transform: `scaleY(${v(j).toFixed(4)})`,
            transformOrigin: '50% 0',
          }}
        />
      ))}
    </>
  );
};

/** Event block state (natural units), shared with the white opening. */
export function eventLookAt(t: number, T: ResultTiming) {
  const k = t - RESULT.land;
  const flash = k < 0 ? 0 : Math.exp(-k / 5.5);
  // squash on the impact frame (vertical hit), SPRING.land rings it out
  const d = k < 0 ? 0 : 1 - springAt(t, RESULT.land, SPRING.land);
  const sx = 1 + 0.065 * d;
  const sy = 1 - 0.065 * d;
  // the anticipation pulse before it opens up: swell (1.12), then gather (0.97)
  const pulseUp = tween(t, [T.pulse - 6, T.pulse], [0, 1], EASE.out3);
  const pulseDown = tween(t, [T.pulse, RESULT.toWhite[0]], [0, 1], EASE.inOut);
  const pulse = 1 + 0.12 * pulseUp - 0.15 * pulseDown;
  // while the split holds, the event breathes a little light
  const idle = tween(t, [RESULT.land + 24, RESULT.land + 40], [0, 1], EASE.inOut) * (1 - pulseUp);
  const glowPulse = pulseUp * (1 - pulseDown * 0.6) + idle * 0.3 * (0.5 + 0.5 * Math.sin((t - RESULT.land) / 8));
  const ping = tween(t, T.ping, [0, 1], EASE.out3);
  const ring = tween(t, [RESULT.land, T.ping[1]], [0, 1], EASE.out3);
  const ring2 = tween(t, [T.ping[0], T.ping[1] + 3], [0, 1], EASE.out3);
  // the event heats up to the pill's ember as it gathers itself to open
  const heat = tween(t, [T.pulse - 4, RESULT.toWhite[0]], [0, 1], EASE.in2);
  const fill = mixHex(eventFill(1, flash), C.ember, 0.85 * heat);
  return { flash, sx: sx * pulse, sy: sy * pulse, ping, ring, ring2, glowPulse, heat, fill };
}

export const eventShadow = (flash: number, glowPulse: number, heat = 0) =>
  [
    `0 0 0 1px ${hexA(C.ember, 0.55 + 0.4 * flash + 0.2 * glowPulse)}`,
    `inset 0 1px 0 rgba(255,255,255,${(0.07 * (1 - heat)).toFixed(3)})`,
    '0 3px 8px -3px rgba(0,0,0,0.5)',
    `0 0 ${(22 + 50 * flash + 20 * glowPulse).toFixed(1)}px ${(-4 + 6 * flash).toFixed(1)}px ${hexA(
      C.ember,
      0.3 + 0.45 * flash + 0.25 * glowPulse,
    )}`,
  ].join(', ');

export const Calendar: React.FC<{
  t: number;
  G: Geo;
  T: ResultTiming;
  pose: Pose;
  /** screen-px velocity of the sheet (motion blur) */
  vel: { x: number; y: number };
  /** calendar units → screen px (pose × camera) */
  screenS: number;
  /** hide the in-calendar event (the white opening has taken it over) */
  eventOut: boolean;
  vertical: boolean;
}> = ({ t, G, T, pose, vel, screenS, eventOut, vertical }) => {
  if (t < T.sheetIn - 3) return null;
  const { W, H } = G;
  const [b0] = T.build;

  // columns cascade in behind the plate (a second plane), fast, one small overshoot
  const colIn = (j: number) => springAt(t, T.sheetIn + j * 0.5, { stiffness: 320, damping: 22, mass: 1 });
  const lag = (j: number) => {
    const e = colIn(j);
    return vertical
      ? `translateY(${((1 - e) * 80).toFixed(2)}px)`
      : `translateX(${((1 - e) * 90).toFixed(2)}px)`;
  };
  // small rises with an overshoot, for labels / hours
  const rise = (at: number) => aos(t, at, { anticip: 2, depth: 0.12, config: SPRING.pop });

  const landed = t >= RESULT.land;
  const look = eventLookAt(t, T);
  const slot = G.slot;

  // slot: beckons once built (alpha up, breathes, lilac wash), locks on as the card nears
  const slotIn = aos(t, T.slotIn[0], { anticip: 2, depth: 0.1, config: SPRING.pop });
  const slotOp = tween(t, T.slotIn, [0, 1], EASE.house);
  const beck = tween(t, T.beckon, [0, 1], EASE.inOut);
  const near = tween(t, [RESULT.fly + 6, RESULT.land], [0, 1], EASE.in2);
  const wave = 0.5 + 0.5 * Math.sin((t - T.beckon[0]) / 2.4);
  const slotA = 0.25 + 0.35 * beck + 0.08 * wave * beck + 0.25 * near;
  const slotScale = Math.max(0, slotIn) * (1 + 0.04 * wave * beck * (1 - near));
  const knock = tween(t, [RESULT.land, RESULT.land + 16], [0, 1], EASE.out3);

  // the landing's shockwave: a soft ember ring through the sheet
  const sk = tween(t, T.shock, [0, 1], EASE.out3);
  const R = 20 + sk * Math.max(W, H) * 1.1;
  const shockOn = t >= T.shock[0] && sk < 0.999;
  const shockA = (1 - sk) * (1 - sk);

  // motion blur of the whole sheet (screen px → local units)
  const bx = Math.min(8, Math.abs(vel.x) * 0.09) / screenS;
  const by = Math.min(8, Math.abs(vel.y) * 0.09) / screenS;
  const blurOn = bx > 0.35 || by > 0.35;

  const warmGlow = landed ? tween(t, [RESULT.land, RESULT.land + 10], [0, 1], EASE.out3) * (0.75 + 0.5 * look.flash) : 0;

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
          left: 0,
          top: 0,
          width: W,
          height: H,
          transform: `translate(${pose.left.toFixed(2)}px, ${pose.top.toFixed(2)}px) scale(${pose.s.toFixed(5)})`,
          transformOrigin: '0 0',
          filter: blurOn ? 'url(#result-cal-mb)' : undefined,
        }}
      >
        {/* the stage plate */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: CAL.radius,
            background: `linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0) 30%), rgba(36,33,44,0.92)`,
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 80px -30px rgba(0,0,0,0.8), 0 12px 24px -12px rgba(0,0,0,0.6)',
          }}
        />

        {/* header: eyebrow */}
        <div
          style={{
            position: 'absolute',
            left: CAL.pad + 2,
            top: CAL.titleY,
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: C.lilac,
          }}
        >
          <div style={{ transform: `scale(${Math.max(0, rise(b0)).toFixed(3)})` }}>
            <CornerDot size={14} color={C.lilac} />
          </div>
          <Letters
            text="THE OWNER'S CALENDAR"
            t={t}
            start={b0}
            step={0.2}
            style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 22, letterSpacing: TRACK.label, color: C.paperDim, lineHeight: 1 }}
          />
        </div>

        {/* WED, lifted a hair */}
        <div
          style={{
            position: 'absolute',
            left: G.gridLeft + SLOT.day * G.colW + 2,
            top: CAL.dayY - 26,
            width: G.colW - 4,
            height: G.bodyBottom - CAL.dayY + 30,
            borderRadius: 14,
            background: `linear-gradient(180deg, rgba(185,163,255,${(0.085 + 0.03 * beck * (1 - (landed ? 1 : 0))).toFixed(3)}), rgba(185,163,255,0.03))`,
            boxShadow: 'inset 0 0 0 1px rgba(185,163,255,0.08)',
            opacity: tween(t, T.wedIn, [0, 1], EASE.house),
            transform: `${lag(SLOT.day)} scaleY(${(0.94 + 0.06 * Math.max(0, rise(T.wedIn[0]))).toFixed(4)})`,
            transformOrigin: '50% 0',
          }}
        />

        {/* hairlines */}
        <GridLines G={G} color={LINE} t={t} T={T} draw />

        {/* day labels: rise with an overshoot */}
        {DAYS.map((d, j) => {
          const p = rise(b0 + j * 0.4);
          return (
            <div
              key={d}
              style={{
                position: 'absolute',
                left: G.gridLeft + j * G.colW,
                width: G.colW,
                top: CAL.dayY,
                display: 'flex',
                justifyContent: 'center',
                transform: `translateY(calc(-50% + ${((1 - p) * 16).toFixed(2)}px)) ${lag(j)}`,
                opacity: Math.min(1, Math.max(0, p * 1.4)),
              }}
            >
              <Label size={22} color={j === SLOT.day ? C.paper : C.paperDim} style={{ lineHeight: 1, marginRight: '-0.14em' }}>
                {d}
              </Label>
            </div>
          );
        })}

        {/* hours */}
        {HOURS.map((hr, i) => {
          const p = rise(b0 + 0.5 + i * 0.3);
          return (
            <div
              key={hr}
              style={{
                position: 'absolute',
                left: CAL.pad,
                width: CAL.gutter - 18,
                top: CAL.bodyTop + i * G.rowH,
                transform: `translateY(calc(-50% + ${((1 - p) * 10).toFixed(2)}px))`,
                textAlign: 'right',
                fontFamily: FONT.mono,
                fontSize: 18,
                lineHeight: 1,
                color: hr === 15 ? C.paper : C.paperDim,
                fontVariantNumeric: 'tabular-nums',
                opacity: Math.min(1, Math.max(0, p * 1.4)) * (hr === 15 ? 1 : 0.82),
              }}
            >
              {String(hr).padStart(2, '0')}:00
            </div>
          );
        })}

        {/* existing bookings: plain, muted; all in by t≈12 */}
        {BOOKINGS.map(([day, from, to], i) => {
          const r = G.cell(day, from, to);
          const pop = aos(t, b0 + day * 0.3 + (i % 2) * 0.5, { anticip: 2, depth: 0.1, config: SPRING.pop });
          return (
            <div key={i} style={{ position: 'absolute', inset: 0, transform: lag(day) }}>
              <div
                style={{
                  position: 'absolute',
                  left: r.x,
                  top: r.y,
                  width: r.w,
                  height: r.h,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.055)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                  opacity: Math.min(1, Math.max(0, pop * 1.4)),
                  transform: `translateY(${((1 - pop) * 8).toFixed(2)}px) scale(${(0.86 + 0.14 * Math.max(0, pop)).toFixed(4)})`,
                }}
              />
            </div>
          );
        })}

        {/* the warm light the event throws on the sheet */}
        {warmGlow > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              left: G.slotC.x - 260,
              top: G.slotC.y - 190,
              width: 520,
              height: 380,
              background: `radial-gradient(closest-side, ${hexA(C.ember, 0.2 * warmGlow)}, ${hexA(C.ember, 0)})`,
            }}
          />
        ) : null}

        {/* the shockwave: a soft ember ring through the sheet, lighting the lines it crosses */}
        {shockOn ? (
          <div style={{ position: 'absolute', inset: 0, borderRadius: CAL.radius, overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: shockA,
                background: `radial-gradient(circle at ${G.slotC.x}px ${G.slotC.y}px, ${hexA(C.ember, 0)} ${(R - 64).toFixed(1)}px, ${hexA(C.ember, 0.1)} ${(R - 22).toFixed(1)}px, ${hexA(C.emberLit, 0.16)} ${(R - 4).toFixed(1)}px, ${hexA(C.ember, 0)} ${(R + 14).toFixed(1)}px)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.8 * shockA,
                WebkitMaskImage: `radial-gradient(circle at ${G.slotC.x}px ${G.slotC.y}px, transparent ${(R - 60).toFixed(1)}px, #000 ${(R - 6).toFixed(1)}px, transparent ${(R + 16).toFixed(1)}px)`,
                maskImage: `radial-gradient(circle at ${G.slotC.x}px ${G.slotC.y}px, transparent ${(R - 60).toFixed(1)}px, #000 ${(R - 6).toFixed(1)}px, transparent ${(R + 16).toFixed(1)}px)`,
              }}
            >
              <GridLines G={G} color={hexA(C.emberLit, 0.55)} t={t} T={T} draw={false} />
            </div>
          </div>
        ) : null}

        {/* the dashed empty slot (site: dashed, 1.5px white/.25) — beckoning */}
        {t < RESULT.land + 16 && slotOp > 0.001 ? (
          <div
            style={{
              position: 'absolute',
              left: slot.x,
              top: slot.y,
              width: slot.w,
              height: slot.h,
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
                  inset: -10,
                  borderRadius: CAL.slotRadius + 10,
                  background: `radial-gradient(closest-side, rgba(185,163,255,${(0.22 * beck + 0.18 * near).toFixed(3)}), rgba(185,163,255,0))`,
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: CAL.slotRadius,
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
              left: slot.x,
              top: slot.y,
              width: slot.w,
              height: slot.h,
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
                    inset: -g.grow * g.k,
                    borderRadius: CAL.slotRadius + g.grow * g.k,
                    boxShadow: `0 0 0 ${(g.w * (1 - 0.6 * g.k)).toFixed(2)}px ${hexA(g.c, g.a * (1 - g.k) * (1 - g.k * 0.4))}`,
                  }}
                />
              ) : null,
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: CAL.slotRadius,
                background: `linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 62%), ${look.fill}`,
                boxShadow: eventShadow(look.flash, look.glowPulse, look.heat),
              }}
            />
            <EventFace u={1} op={1} size={G.face} ping={look.ping} color={mixHex(C.emberLit, C.white, look.heat * 0.6)} />
          </div>
        ) : null}
      </div>
    </>
  );
};

/**
 * REEL 2 · THE SLOT STRIP (docs/ig/SCRIPT.md ig2 b5–b9; §5 "SlotStrip"): Saturday's slots inside the call panel, the
 * agent's availability check made visible —
 *   · on "Saturday morning?" the chrome label SAT rises, then five time chips land on 32nds (objects: a short rise on the
 *     app's pop spring). 9:00, 10:30 and 12:00 are TAKEN (35 % ink, a hairline strike, the muted fill);
 *   · as the "Checked your availability" tick lands, the two FREE chips (10:00, 11:30) take her teal outline;
 *   · "ten," / "eleven-thirty.": each free chip pulses once (1 → 1.04 → 1);
 *   · "Ten it is.": the 10:00 chip FILLS teal, its label turns paper-white;
 *   · "Maya": a small name chip clips onto its top-right corner (a spoken word);
 *   · "booked,": the chip WIDENS IN PLACE into the event block "Maya · Sat 10:00" across the strip — the other chips
 *     step aside and go, the name chip melts into the block.
 * App chrome (SCRIPT.md §0.3): every label ≤ 32 px and on, or after, the word it belongs to. A pure function of `t`.
 */
import React from 'react';
import { subpixel } from '../../lib/glide';
import { EASE, mix, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { APP, measureText, ui, useKitFaces, W } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { IgIcon } from '../components/icons';
import { ZoneRect } from '../components/ZoneGuard';

const SUNDAY = MOMENT_LIGHTS.sunday;
export const SLOTS = ['9:00', '10:00', '10:30', '11:30', '12:00'] as const;
const TAKEN = [true, false, true, false, true];
const PICK = 1;

export type StripMoments = {
  sat: number;
  chips: number;
  check: number;
  pulse: readonly [number, number];
  fill: number;
  name: number;
  booked: number;
};

/** the strip's box (frame px): the SAT label at y, the chips below it */
export const STRIP = { x: 134, y: 990, w: 724, chipY: 1032, chipH: 80, gap: 11, r: 20, label: 30 } as const;
const chipW = (STRIP.w - 4 * STRIP.gap) / 5;
const chipX = (i: number) => STRIP.x + i * (chipW + STRIP.gap);
const TEAL = SUNDAY.ink; // #0e7490: white type on it reads (5.4 : 1)
const TEAL_LINE = SUNDAY.orb[2];

/** a one-shot pulse 1 → 1 + a → 1 (two pop springs a few frames apart) */
const pulse = (t: number, at: number, a = 0.04) => 1 + a * (springUnit(t - at, SPRING.pop) - springUnit(t - at - 4, SPRING.pop));

export const SlotStrip: React.FC<{ t: number; m: StripMoments; moving?: boolean }> = ({ t, m, moving = false }) => {
  const ready = useKitFaces();
  if (!ready || t < m.sat - 1) return null;
  const labelSt = typeStyle('label', true, { tone: 'paper', size: 28 });
  // the SAT label: rises out of its mask
  const satR = springUnit(t - m.sat, SPRING.caption);
  // the free chips' outline (as the check lands), the pick's fill, the widening
  const outline = tween(t, [m.check - 1, m.check + 3], [0, 1], EASE.out3);
  const fill = tween(t, [m.fill - 1, m.fill + 3], [0, 1], EASE.out3);
  const wide = t < m.booked ? 0 : springUnit(t - m.booked, { stiffness: 240, damping: 26, mass: 1 });
  const wideU = Math.min(1, Math.max(0, wide));
  const nameIn = t < m.name - 1 ? 0 : springUnit(t - m.name, SPRING.pop);
  const L = STRIP.label;
  return (
    <>
      {/* SAT */}
      <div style={{ position: 'absolute', left: STRIP.x, top: STRIP.y, overflow: 'hidden', paddingTop: 4, marginTop: -4 }}>
        <div style={{ ...labelSt, color: APP.mutedFg, opacity: smooth(0, 0.5, satR), ...subpixel(`translateY(${((1 - satR) * 90).toFixed(3)}%)`, moving || satR < 0.999) }}>Sat</div>
      </div>
      <ZoneRect what="slot strip label SAT" rect={{ x: STRIP.x, y: STRIP.y, w: measureText('SAT', { size: 28, weight: 540, tracking: 0.14 }), h: 34 }} />
      {/* the picked chip is drawn last: it widens OVER its neighbours as they step aside */}
      {[0, 2, 3, 4, PICK].map((i) => {
        const label = SLOTS[i];
        const at = m.chips + i * 1.875;
        if (t < at - 0.5) return null;
        const s = springUnit(t - at, SPRING.pop);
        let dy = (1 - s) * 26;
        let o = smooth(0, 0.45, s);
        let x = chipX(i);
        let w = chipW;
        let sc = 1;
        const free = !TAKEN[i];
        const pick = i === PICK;
        if (free) sc *= pulse(t, i === 1 ? m.pulse[0] : m.pulse[1]);
        if (pick) {
          sc *= pulse(t, m.fill, 0.03);
          // widening in place into the event block (left edge to the strip's, right edge to the strip's)
          x = mix(chipX(i), STRIP.x, wide);
          w = mix(chipW, STRIP.w, wide);
        } else if (wide > 0) {
          // the others step aside and go
          const q = smooth(0, 0.7, wideU);
          o *= 1 - q;
          dy += 0;
          x += (i < PICK ? -1 : 1) * 30 * q;
          sc *= 1 - 0.06 * q;
        }
        if (o <= 0.002) return null;
        const bg = pick ? mixHex(TAKEN[i] ? APP.muted : '#ffffff', TEAL, fill) : TAKEN[i] ? APP.muted : '#ffffff';
        const ring = free ? mixHex(APP.border, TEAL_LINE, outline) : APP.border;
        const ringW = free ? mix(1.5, 2.5, outline) : 1.5;
        const ink = TAKEN[i] ? APP.foreground : pick ? mixHex(mixHex(APP.foreground, TEAL, outline), '#ffffff', fill) : mixHex(APP.foreground, TEAL, outline);
        const labelW = measureText(label, { size: L, weight: W.medium });
        const move = moving || Math.abs(dy) > 0.02 || Math.abs(sc - 1) > 1e-4 || (pick && wide > 0 && wide < 0.999);
        // the event's own words (after the widening has carried it most of the way)
        const evIn = pick ? smooth(0.35, 0.85, wideU) : 0;
        const timeOut = pick ? 1 - smooth(0.05, 0.4, wideU) : 1;
        return (
          <React.Fragment key={label}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: w,
                height: STRIP.chipH,
                borderRadius: STRIP.r,
                overflow: 'hidden',
                background: bg,
                boxShadow: `inset 0 0 0 ${ringW.toFixed(2)}px ${pick && fill > 0 ? mixHex(ring, TEAL, fill) : ring}`,
                opacity: o >= 0.999 ? undefined : o,
                transformOrigin: '50% 50%',
                ...subpixel(`translate(${x.toFixed(3)}px, ${(STRIP.chipY + dy).toFixed(3)}px)${Math.abs(sc - 1) > 1e-5 ? ` scale(${sc.toFixed(5)})` : ''}`, move),
              }}
            >
              {timeOut > 0.002 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: (w - labelW) / 2,
                    top: (STRIP.chipH - L * 1.2) / 2,
                    ...ui(L, W.medium, { tabular: true }),
                    color: ink,
                    opacity: (TAKEN[i] ? 0.35 : 1) * timeOut,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </div>
              ) : null}
              {TAKEN[i] ? <div style={{ position: 'absolute', left: (w - labelW) / 2 - 6, top: STRIP.chipH / 2 - 0.75, width: labelW + 12, height: 1.5, background: APP.mutedFg, opacity: 0.55 }} /> : null}
              {evIn > 0.002 ? (
                <div style={{ position: 'absolute', left: 28, top: 0, height: STRIP.chipH, display: 'flex', alignItems: 'center', gap: 16, opacity: evIn, whiteSpace: 'nowrap' }}>
                  <IgIcon name="calendar" size={32} color="#ffffff" stroke={2.1} />
                  <span style={{ ...ui(L + 2, W.active), color: '#ffffff' }}>Maya · Sat 10:00</span>
                </div>
              ) : null}
            </div>
            {pick && wideU > 0.5 ? (
              <ZoneRect what="event block “Maya · Sat 10:00”" rect={{ x: STRIP.x + 28, y: STRIP.chipY + (STRIP.chipH - 38) / 2, w: 48 + measureText('Maya · Sat 10:00', { size: L + 2, weight: W.active }), h: 38 }} />
            ) : (
              <ZoneRect what={`slot chip ${label}`} rect={{ x: x + (w - labelW) / 2, y: STRIP.chipY + (STRIP.chipH - L * 1.2) / 2, w: labelW, h: L * 1.2 }} />
            )}
          </React.Fragment>
        );
      })}
      {/* "Maya": the name chip clips onto the 10:00 chip's corner; it melts into the event block as the chip widens */}
      {nameIn > 0 && wideU < 0.6 ? <NameChip t={t} s={nameIn} fade={1 - smooth(0, 0.5, wideU)} x={chipX(PICK) + chipW - 18} y={STRIP.chipY - 20} /> : null}
    </>
  );
};

const NameChip: React.FC<{ t: number; s: number; fade: number; x: number; y: number }> = ({ s, fade, x, y }) => {
  const size = 26;
  const w = measureText('Maya', { size, weight: W.active }) + size * 1.1;
  const h = size * 1.55;
  const dy = (1 - s) * -18;
  const sc = 0.9 + 0.1 * Math.min(1.05, s);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          borderRadius: h / 2,
          background: '#ffffff',
          boxShadow: `inset 0 0 0 1.5px ${TEAL_LINE}, 0 6px 14px -6px rgba(14, 116, 144, 0.45)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...ui(size, W.active),
          color: TEAL,
          opacity: Math.min(1, smooth(0, 0.4, s)) * fade,
          transformOrigin: '50% 100%',
          ...subpixel(`translate(${(x - w / 2).toFixed(3)}px, ${(y + dy).toFixed(3)}px) scale(${sc.toFixed(5)})`, Math.abs(dy) > 0.02 || Math.abs(sc - 1) > 1e-4),
        }}
      >
        Maya
      </div>
      <ZoneRect what="name chip “Maya”" rect={{ x: x - w / 2, y, w, h }} />
    </>
  );
};

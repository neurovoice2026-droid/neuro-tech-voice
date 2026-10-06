/**
 * REEL 2 · THE "9:47 pm." LOCKUP (docs/ig/SCRIPT.md ig2 b1 "S1a"): the time as a clock face whose COLON IS THE PHONE —
 * the rose line light (drawn by the act, at `lockColon()`), ringing. It is the caption of "Nine forty-seven" (the display
 * map's "9:47 pm."), so it follows the frame-0 caption rules of the Captions fork:
 *   · SET AT FRAME 0 at 72 % ink; "9" lifts to full ink on "Nine", "47 pm." on "forty-seven", each with a one-frame
 *     accent glint (the phone's rose light);
 *   · at the pickup it LEAVES UP THROUGH ITS MASKS (a ½-frame ripple, power3.in) — the colon stays: it is the light that
 *     springs open into her orb;
 *   · in the end card's seam (t < 0) it RISES BACK INTO PLACE out of the same masks (the caption spring from SEAM_RISE),
 *     arriving at frame 0's still exactly.
 *
 * Set in the house sans as a device's clock — Instrument Sans 600, tabular figures in fixed cells (film 1 hook/Clock's
 * windows: a figure never changes width), paper ink at 90 % on the night; "pm." small on the figures' baseline.
 * A pure function of the timeline frame `t`.
 */
import React from 'react';
import { reveal, revealStyle } from '../../components/Type';
import { EASE, mixHex, SPRING, tween } from '../../lib/motion';
import { maskBox, UNIT_STAGGER } from '../../lib/type';
import { C, FONT } from '../../theme';
import { measureText, useKitFaces } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { SEAM_RISE, SET_INK } from '../components/Captions';
import { ZoneRect } from '../components/ZoneGuard';

/** the lockup: centred on (cx, cy) — cy is the figures' optical centre, where the colon light sits */
export const LOCK = { cx: 540, cy: 392, size: 214, weight: 600, cell: 0.6, colon: 0.5, pmSize: 0.4, pmGap: 0.12, ink: 0.9 } as const;
const PM = 'pm.';
const pmSpec = (size: number = LOCK.size) => ({ size: Math.round(size * LOCK.pmSize), weight: 560, tracking: -0.01 });

/** where each part sits (frame px); `at` re-places it (the cover) */
export type LockAt = { cx: number; cy: number; size: number };
export function lockLayout(at: LockAt = LOCK) {
  const F = at.size;
  const cw = LOCK.cell * F;
  const slot = LOCK.colon * F;
  const pmSize = pmSpec(F).size;
  const pmW = measureText(PM, pmSpec(F));
  const gap = LOCK.pmGap * F;
  const W = 3 * cw + slot + gap + pmW;
  const x0 = at.cx - W / 2;
  // Instrument Sans at line-height 1: the baseline .86 em below the box top; the figures' centre .35 em above it
  const top = at.cy - 0.51 * F;
  const base = top + 0.86 * F;
  return {
    F,
    cw,
    nine: { x: x0, y: top },
    colon: { x: x0 + cw + slot / 2, y: at.cy },
    fortySeven: { x: x0 + cw + slot, y: top },
    pm: { x: x0 + 3 * cw + slot + gap, y: base - 0.86 * pmSize, size: pmSize },
    rect: { x: x0, y: at.cy - 0.36 * F, w: W, h: 0.72 * F },
  };
}
/** the colon: the rose line light's centre */
export const lockColon = (at?: LockAt) => lockLayout(at).colon;

const RUSH_GLINT = MOMENT_LIGHTS.rush.orb[3];
/** a glint's weight at t for an onset `on`: up over the frame before it, then gone over ≈ 3 frames (the Captions fork's) */
const glintAt = (t: number, on: number) => (t < on - 1 ? 0 : t < on ? EASE.out3(t - (on - 1)) : Math.exp(-(t - on) / 1.2));

export const ClockLockup: React.FC<{
  t: number;
  /** "Nine" / "forty-seven" onsets (absolute frames) */
  onsets: readonly [number, number];
  /** the lockup leaves up through its masks from here (the pickup) */
  exitAt: number;
  /** the zone guard's label */
  what?: string;
  /** re-placed (the cover) */
  at?: LockAt;
}> = ({ t, onsets, exitAt, what = 'clock lockup "9:47 pm."', at }) => {
  // the layout measures "pm." in the real face: hold the frame until the kit's faces are in
  const ready = useKitFaces();
  if (!ready) return null;
  const L = lockLayout(at);
  const parts = [
    { key: '9', text: '9', x: L.nine.x, y: L.nine.y, size: L.F, cells: 1, on: onsets[0], weight: LOCK.weight },
    { key: '47', text: '47', x: L.fortySeven.x, y: L.fortySeven.y, size: L.F, cells: 2, on: onsets[1], weight: LOCK.weight },
    { key: 'pm', text: PM, x: L.pm.x, y: L.pm.y, size: L.pm.size, cells: 0, on: onsets[1], weight: 560 },
  ];
  if (t > exitAt + 8) return null;
  return (
    <>
      {parts.map((p, j) => {
        // the set rise (seam) / at rest from frame 0 / the exit ripple through the masks
        const ex = { at: exitAt + j * 0.5, dur: 5 };
        let r = reveal(t, SEAM_RISE + j * UNIT_STAGGER, { config: SPRING.caption, rise: 80, fade: 0.5, exit: ex });
        if (t >= 0 && t < ex.at) r = { p: 1, y: 0, opacity: 1, scale: 1 };
        const lift = SET_INK + (1 - SET_INK) * tween(t, [p.on - 1, p.on + 1], [0, 1], EASE.out3);
        const g = glintAt(t, p.on);
        const col = g > 0.004 ? mixHex(C.paper, RUSH_GLINT, 0.6 * g) : C.paper;
        const st = revealStyle({ ...r, opacity: r.opacity * lift * LOCK.ink }, undefined, t < 0 || t > ex.at - 0.5);
        return (
          <span
            key={p.key}
            style={{
              ...maskBox(0),
              position: 'absolute',
              left: p.x,
              top: p.y,
              fontFamily: FONT.ui,
              fontWeight: p.weight,
              fontSize: p.size,
              lineHeight: 1,
              letterSpacing: p.cells ? 0 : '-0.01em',
              fontVariantNumeric: 'tabular-nums',
              fontKerning: 'normal',
            }}
          >
            <span style={{ ...st, color: col }}>
              {p.cells ? (
                p.text.split('').map((ch, i) => (
                  <span key={i} style={{ display: 'inline-block', width: LOCK.cell * p.size, textAlign: 'center' }}>
                    {ch}
                  </span>
                ))
              ) : (
                p.text
              )}
            </span>
          </span>
        );
      })}
      {t < exitAt + 2 ? <ZoneRect what={what} rect={L.rect} /> : null}
    </>
  );
};

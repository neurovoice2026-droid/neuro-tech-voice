/**
 * THE DAY'S SLIPS → ONE (SCRIPT.md b08, the graft from "empathy": "the slip column stacks upward into one:
 * each slip slides under the one above on 16ths, contact shadows thickening").
 *
 *   16:9   b07's column (scenes/turn/Column.tsx, its last frame exactly: the strips of "Yes, Saturdays, nine
 *          till two." in slate at the half's width, inside a window with many-stop paper fades) glides into the
 *          corner under the orb, smaller (one transform about the window's corner: the strips raster once). On
 *          its way the scroll eases so a whole strip sits just under the top fade and the strip above it leaves
 *          up through the fade. On "once" the seven strips below it slide up under it, one per 16th — the ones
 *          below the window rising through the bottom fade — critically damped, so none ever peeks past it;
 *          each arrival thickens the pile's edge a hair and deepens its contact shadow.
 *   9:16   (b07's 9:16 had no column) the slips are dealt in from the left edge, one per 16th, each sliding in
 *          under the one before, into one pile beside the orb.
 *
 * At WRITTEN_LOCAL.born the pile is handed to written/Row.tsx (`slipHandoff` gives it the top slip's exact box),
 * which draws its edges into the TXT · Opening hours row.
 */
import React from 'react';
import { springUnit } from '../../../lib/motion';
import { subpixel } from '../../../lib/glide';
import { typeStyle } from '../../../lib/type';
import { useLayout } from '../../../lib/layout';
import { meshElevation, meshShadowInk } from '../../kit';
import { KB_MESH } from '../../palettes';
import { WRITTEN_LOCAL as W } from '../../timing';
import { STRIP_INK } from '../recording/Stack';
import { turnEnd } from '../turn/stage';
import { ease, GLIDE, TUCK, type WrittenStage } from './stage';

/** b06's strip in its own px (turn/Column.tsx STRIP), the pad's ruling */
export const STRIP = { w: 940, h: 130, pitch: 114, pad: 27, padX: 50, size: 64, radius: 12 } as const;
const RULE = 'rgba(20, 10, 36, 0.075)';
export const SLIP_TEXT = 'Yes, Saturdays, nine till two.';
export const SLIP_INK = STRIP_INK;
const INK_B = meshShadowInk(KB_MESH);
/** the window's paper fades (window px): 64 in at the top, 70 at the bottom (turn/Column.tsx — keep in step) */
const FADE = { top: 64, bottom: 70 } as const;
/** each slip under the pile shows this much of its edge (strip px) */
const EDGE = 1.2;
const COUNT = 7;

function fadeMask(a: number, b: number, c: number, d: number) {
  const stops: string[] = [];
  const N2 = 12;
  for (let j = 0; j <= N2; j++) {
    const u = j / N2;
    stops.push(`rgba(0,0,0,${(u * u * (3 - 2 * u)).toFixed(4)}) ${(a + (b - a) * u).toFixed(2)}px`);
  }
  for (let j = 0; j <= N2; j++) {
    const u = j / N2;
    stops.push(`rgba(0,0,0,${(1 - u * u * (3 - 2 * u)).toFixed(4)}) ${(c + (d - c) * u).toFixed(2)}px`);
  }
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

/** 16:9: b07's column at its last frame, and where it goes (all in screen px; strip px inside the window × k0) */
export function columnPlan(S: WrittenStage) {
  const E = turnEnd(false).column!;
  const k0 = E.k;
  const wx0 = E.x - 40;
  // turnEnd's column is at rest, risen: its window and its top have both ridden up by `rise`
  const wy0 = E.window[0];
  const wh = E.window[1] - E.window[0] + FADE.bottom;
  const ww = STRIP.w * k0 + 80;
  // the strips' frame (turn/Column.tsx: origin at the window's top-left; row r's top at y0 + r·pitch − scroll)
  const y0 = (E.top - E.window[0]) / k0;
  const s0 = E.scroll;
  let j0 = 0;
  while ((y0 + j0 * STRIP.pitch - s0) * k0 < FADE.top - 0.5) j0++;
  const sEnd = y0 + j0 * STRIP.pitch - FADE.top / k0;
  const k1 = S.slips.w / STRIP.w;
  const s1 = k1 / k0;
  const tx1 = S.slips.x - wx0 - 40 * s1;
  const ty1 = S.slips.y - wy0 - FADE.top * s1;
  return { k0, k1, wx0, wy0, wh, ww, y0, s0, j0, sEnd, s1, tx1, ty1 };
}

/** the top slip's screen box at the hand-off (16:9: the corner; 9:16: the pile) and its strip scale */
export function slipHandoff(S: WrittenStage) {
  const k = S.slips.w / STRIP.w;
  return { x: S.slips.x, y: S.slips.y, w: S.slips.w, h: STRIP.h * k, k, radius: STRIP.radius * k };
}

/** the pile's lift (its contact shadow deepening with every slip under it): b07's .6 → ~1.4 */
export const pileLift = (t: number) => {
  let n = 0;
  for (let m = 0; m < COUNT; m++) n += springUnit(t - W.collapse[m], TUCK);
  return { lift: 0.6 + 0.12 * n, k: 0.95 + 0.012 * n, n };
};

const Strip: React.FC<{ y: number; z: number; ink: string; lift: number; k?: number; opacity?: number; moving: boolean; x?: number }> = ({ y, z, ink, lift, k = 0.95, opacity = 1, moving, x = 0 }) => {
  const L = useLayout();
  const rowH = STRIP.size * 1.18;
  const title = typeStyle('title', L.vertical, { tone: 'paper', size: STRIP.size });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: STRIP.w,
        height: STRIP.h,
        zIndex: z,
        borderRadius: STRIP.radius,
        background: '#ffffff',
        boxShadow: meshElevation(lift, ink, k),
        opacity: opacity >= 0.999 ? undefined : opacity,
        ...subpixel(`translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)`, moving),
      }}
    >
      <div style={{ position: 'absolute', left: STRIP.padX, right: STRIP.padX, top: STRIP.pad + rowH - STRIP.size * 0.12, height: 1.25, background: RULE }} />
      <div style={{ position: 'absolute', left: STRIP.padX, top: STRIP.pad, ...title, lineHeight: `${rowH}px`, color: STRIP_INK, whiteSpace: 'nowrap' }}>{SLIP_TEXT}</div>
    </div>
  );
};

export const Slips: React.FC<{ t: number; S: WrittenStage }> = ({ t, S }) => {
  if (t >= W.born) return null;
  return S.vertical ? <Deal t={t} S={S} /> : <Column t={t} S={S} />;
};

/* ── 16:9: b07's column into one ── */
const Column: React.FC<{ t: number; S: WrittenStage }> = ({ t, S }) => {
  const P = columnPlan(S);
  const g = springUnit(t - W.glide[0], GLIDE);
  const sc = 1 + (P.s1 - 1) * g;
  const tx = P.tx1 * g;
  const ty = P.ty1 * g;
  const scroll = P.s0 + (P.sEnd - P.s0) * ease(t, W.glide[0], W.glide[1]);
  const pile = pileLift(t);
  const moving = g < 0.9999 || (t > W.collapse[0] - 1 && t < W.born);
  const base = (r: number) => P.y0 + r * STRIP.pitch - scroll;
  const strips: React.ReactNode[] = [];
  // the strip above the top one leaves up through the fade on the way into the corner
  const above = ease(t, 0, 12);
  for (let r = Math.max(0, P.j0 - 2); r <= P.j0 + COUNT; r++) {
    let y = base(r);
    let o = 1;
    if (r < P.j0) {
      if (above >= 1) continue;
      y -= 40 * above;
      o = 1 - above;
    } else if (r > P.j0) {
      const m = r - P.j0;
      const p = springUnit(t - W.collapse[m - 1], TUCK);
      y = y - (y - (base(P.j0) + m * EDGE)) * p;
    }
    // cull outside the window (window px = strip px × k0)
    if ((y + STRIP.h) * P.k0 < -4 || y * P.k0 > P.wh + 4) continue;
    const top = r === P.j0;
    strips.push(<Strip key={r} y={y} z={40 - r} ink={INK_B} lift={top ? pile.lift : 0.6} k={top ? pile.k : 0.95} opacity={o} moving={moving} />);
  }
  const mask = fadeMask(0, FADE.top, P.wh - FADE.bottom, P.wh);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        ...subpixel(`translate(${(P.wx0 + tx).toFixed(3)}px, ${(P.wy0 + ty).toFixed(3)}px) scale(${sc.toFixed(6)})`, g < 0.9999),
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: P.ww, height: P.wh, WebkitMaskImage: mask, maskImage: mask }}>
        <div style={{ position: 'absolute', left: 40, top: 0, transformOrigin: '0 0', transform: `scale(${P.k0.toFixed(6)})` }}>{strips}</div>
      </div>
    </div>
  );
};

/* ── 9:16: dealt in from the left edge into one pile ── */
const Deal: React.FC<{ t: number; S: WrittenStage }> = ({ t, S }) => {
  const H = slipHandoff(S);
  const k = H.k;
  if (t < W.once - 0.5) return null;
  const pile = pileLift(t);
  const strips: React.ReactNode[] = [];
  const from = -(S.slips.x + S.slips.w + 40) / k; // strip px: fully off the left edge
  for (let m = 0; m <= COUNT; m++) {
    const at = W.once + (m === 0 ? -3.75 : W.collapse[m - 1] - W.once);
    if (t < at - 0.25) continue;
    const p = springUnit(t - at, TUCK);
    const x = from * (1 - p);
    const y = m * EDGE * p;
    strips.push(<Strip key={m} x={x} y={y} z={40 - m} ink={INK_B} lift={m === 0 ? pile.lift : 0.6} k={m === 0 ? pile.k : 0.95} moving={p < 0.9999} />);
  }
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${H.x}px, ${H.y}px) scale(${k.toFixed(6)})` }}>
      {strips}
    </div>
  );
};

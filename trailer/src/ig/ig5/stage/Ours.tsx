/**
 * REEL 5 · OURS (docs/ig/ig5/SCRIPT.md b4–b6): the payoff card, the set-up track and the parked price chip.
 *
 *   ours    just after "Ours?" — once the pickup has had its beat on the open desk (her seed and pop read on the bare
 *           desk, crit-r1 P1) — it rises under the pile (white paper, a 2 px teal edge, lifted higher than the quotes)
 *           AS A UNIT at 72 % ink — "Ours?" (title 52) + "From" (44) / "$49" (200, her teal, STILL: it never rolls) + "a month" (56),
 *           her orb its full stop — and each word lifts to full ink on her onset, so "$49" is SEEN on "Ours?" and heard
 *           on "forty-nine"; on "forty-nine" its hairline draws on the pile's scale (1.76 px per dollar: 86 px under the
 *           pile's 174 and 528, all from x 160); "No setup fee." (44, teal) prints at its upper right on her words, in the
 *           setup stub's column above it. b5: on "You" it glides up into the cleared stage (SPRING.site) and its
 *           hairline undraws with the pile. b6: on "It" it FOLDS into the parked chip (one card: its rect, corner and
 *           lift interpolated, its words SCALING DOWN WITH IT and crossfading into the chip's "From $49 a month", so a
 *           price is readable on every frame of the fold — crit-r1 P2)
 *   track   b5: on "set" a 2 px graphite track draws under ours with four EMPTY dots (no labels: the site's four setup
 *           screens, shown, not named); from "yourself" they fill teal one per 16th; the fourth becomes a drawn check;
 *           on "It" the track folds away
 *   chip    b6–b8: "From $49 a month" (40, teal) on a white pill right-aligned to x 900, y 280–360 (its "$49" inside the
 *           price band); it leaves up through its mask with the comment field, just before the impact
 */
import React from 'react';
import { subpixel } from '../../../lib/glide';
import { EASE, mix, smooth, SPRING, springUnit, tween } from '../../../lib/motion';
import { CheckMark, measureText, meshElevation, meshShadowInk, spaceWidth, useKitFaces } from '../../../kb/kit';
import { MOMENT_LIGHTS, MUTED_MESH } from '../../../kb/palettes';
import { GRAPHITE } from '../../../kb/theme';
import { CAP_OUT } from '../../components/Captions';
import { ZoneRect } from '../../components/ZoneGuard';
import * as T from '../timing';
import { baseline, CHIP, OURS, SCALE, TRACK, type Box } from './layout';
import { IG5_ZONES } from '../zones';
import { pileExitAt } from './Papers';
import { Figure, figWidth, money, objSpec, Print, ScaleBar } from './type';

const M = T.M;
const SUNDAY = MOMENT_LIGHTS.sunday;
const SHADOW = meshShadowInk(MUTED_MESH);
const EPS = 2e-4;

/* ── ours' clock ── */
/** b4: ours rises 5 f after the pickup (the orb's 3-frame seed and SPRING.pop play on the bare desk first; the card
 *  comes up on "Ours?" + 3) — crit-r1 P1 */
export const OURS_RISE = M.pickup + 5;
/** its rise: from 40 px under its place (the $49 never drops into the price band's bottom: crit-r1 ZONE-1) */
const RISE_FROM = 40;
/** b5: ours glides up just behind the pile's exit, clear of the caption band before "You" rises there */
export const OURS_UP = M.you - 5;
/** b4 rise, b5 glide; null before its rise. `rise`: how far it still is under its b4 place (px) */
export function oursY(t: number): { y: number; opacity: number; moving: boolean; rise: number } | null {
  if (t < OURS_RISE - 0.5) return null;
  const e = springUnit(t - OURS_RISE, SPRING.site);
  const g = springUnit(t - OURS_UP, SPRING.site);
  const rise = (1 - e) * RISE_FROM;
  const y = mix(OURS.y4 + rise, OURS.y5, g);
  return { y, opacity: smooth(0, 0.35, e), moving: Math.abs(1 - e) > EPS || (g > 0 && Math.abs(1 - g) > EPS), rise };
}
/** the fold into the chip (0 → 1 from "It") */
export const FOLD = [M.it, M.it + 16] as const;
export const foldAt = (t: number) => tween(t, FOLD, [0, 1], EASE.inOut);
/** the chip's exit: with the comment field, up through its mask, so the stage is clear a frame before the bar */
const CHIP_OUT = T.IMPACT - (CAP_OUT + 1);

/* ── ours' layout (local px; needs the faces) ── */
const ROW1 = OURS.row1;
const titleSpec = objSpec(ROW1.title);
const smallSpec = objSpec(ROW1.small);
const monthSpec = objSpec(OURS.month);
export function oursLayout() {
  const figBase = baseline(OURS.fig.y, OURS.fig.size);
  const row1Base = ROW1.top + 0.96 * ROW1.title;
  const oursW = measureText('Ours?', titleSpec);
  const fromX = OURS.fig.x + oursW + spaceWidth(titleSpec) * 1.1;
  const figW = figWidth(money(49), OURS.fig.size);
  const monthX = OURS.fig.x + figW + 22;
  const monthW = measureText('a month', monthSpec);
  const noSetupW = measureText('No setup fee.', smallSpec);
  return {
    figBase,
    row1Base,
    oursW,
    fromX,
    fromW: measureText('From', smallSpec),
    figW,
    monthX,
    monthW,
    noSetupW,
    /** her orb: the full stop after "a month" (sitting on its baseline) */
    stop: { x: monthX + monthW + 8 + OURS.orbD / 2, y: figBase - OURS.orbD / 2 + 2 },
  };
}
/** the full stop in frame px at t (her orb's place in b4–b5) */
export function fullStopAt(t: number): { x: number; y: number } {
  const L = oursLayout();
  const y = oursY(t)?.y ?? OURS.y4;
  return { x: OURS.x + L.stop.x, y: y + L.stop.y };
}

/* ── ours ── */
export const Ours: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  const o = oursY(t);
  if (!ready || !o) return null;
  const f = foldAt(t);
  if (f >= 1) return null;
  const L = oursLayout();
  // the chip it folds into
  const chip = chipBox();
  const r = { x: mix(OURS.x, chip.x, f), y: mix(o.y, chip.y, f), w: mix(OURS.w, chip.w, f), h: mix(OURS.h, chip.h, f), rad: mix(OURS.r, chip.h / 2, f) };
  // the fold (crit-r1 P2): ours' words scale down with the card and hand over to the chip's words mid-fold — never an
  // empty box in flight
  const content = 1 - tween(t, [FOLD[0] + 4, FOLD[0] + 11], [0, 1], EASE.in2);
  const chipText = tween(t, [FOLD[0] + 8, FOLD[0] + 13], [0, 1], EASE.out3);
  const cs = f > 0 ? Math.min(1, r.w / OURS.w, r.h / OURS.h) : 1;
  const moving = o.moving || (f > 0 && f < 1);
  // the $49 rises out of a mask on the price band's line (y 1260): while the card is still under its place, the
  // figure's ink below that line is cut, so a price numeral never shows under the band (crit-r1 ZONE-1)
  const figCut = Math.max(0, OURS.h - (IG5_ZONES.price.y1 - o.y));
  const figH = Math.min(OURS.fig.size, IG5_ZONES.price.y1 - (o.y + OURS.fig.y));
  // the words' ink: the card rises at 72 %, each word up on her onset
  const lift = (on: number) => 0.72 + 0.28 * tween(t, [on - 1, on + 1], [0, 1], EASE.out3);
  // its hairline: drawn on "forty-nine", undrawn with the pile on "You"
  const bar = tween(t, [M.fortyNine, M.fortyNine + 12], [0, 1], EASE.draw) * (1 - pileExitAt(t));
  const lifted = 4 + 2.5 * Math.max(0, 1 - springUnit(t - OURS_RISE, SPRING.site));
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: r.w,
          height: r.h,
          borderRadius: r.rad,
          background: '#ffffff',
          boxShadow: `inset 0 0 0 2px ${SUNDAY.orb[2]}, ${meshElevation(mix(lifted, 2, f), SHADOW, 1)}`,
          overflow: 'hidden',
          opacity: o.opacity >= 0.999 ? undefined : o.opacity,
          ...subpixel(`translate(${r.x.toFixed(3)}px, ${r.y.toFixed(3)}px)`, moving),
        }}
      >
        {content > 0.002 ? (
          <div style={{ position: 'absolute', left: 0, top: 0, width: OURS.w, height: OURS.h, opacity: content >= 0.999 ? undefined : content, transformOrigin: '0 0', transform: cs < 0.9999 ? `scale(${cs.toFixed(5)})` : undefined }}>
            <Print t={t} at={M.ours} text="Ours?" x={OURS.fig.x} y={ROW1.top} size={ROW1.title} color={GRAPHITE.text} set lift={0.72} moving={moving} />
            <Print t={t} at={M.fromOurs} text="From" x={L.fromX} y={L.row1Base - 0.96 * ROW1.small} size={ROW1.small} color={GRAPHITE.text} set lift={0.72} moving={moving} />
            <div style={{ position: 'absolute', left: 0, top: 0, width: OURS.w, height: OURS.h, clipPath: figCut > 0.01 ? `inset(0px 0px ${figCut.toFixed(3)}px 0px)` : undefined }}>
              <Figure t={t} value={49} x={OURS.fig.x} y={OURS.fig.y} size={OURS.fig.size} color={SUNDAY.ink} ink={lift(M.fortyNine)} moving={moving} />
            </div>
            <Print t={t} at={M.monthOurs} text="a month" x={L.monthX} y={L.figBase - 0.96 * OURS.month} size={OURS.month} color={GRAPHITE.text} set lift={0.72} moving={moving} />
            {M.noSetup.map((at, i) => {
              const words = ['No', 'setup', 'fee.'];
              const sp = spaceWidth(smallSpec);
              const x0 = OURS.w - 40 - L.noSetupW;
              const x = x0 + words.slice(0, i).reduce((s, w) => s + measureText(w, smallSpec) + sp, 0);
              return <Print key={i} t={t} at={at - 1} text={words[i]} x={x} y={L.row1Base - 0.96 * ROW1.small} size={ROW1.small} color={SUNDAY.ink} moving={moving} />;
            })}
            {bar > 0.001 ? <ScaleBar x0={SCALE.x0} y={OURS.bar.y} len={49 * OURS.pxPerDollar * bar} color={SUNDAY.ink} stroke={SCALE.stroke} /> : null}
          </div>
        ) : null}
        {chipText > 0.002 ? <ChipFace w={r.w} h={r.h} opacity={chipText} /> : null}
      </div>
      {content > 0.5 && o.opacity > 0.5 ? (
        <>
          <ZoneRect what="ours row 1" rect={{ x: OURS.x + OURS.fig.x, y: o.y + ROW1.top, w: OURS.w - 80, h: ROW1.title * 1.2 }} />
          {figH > 1 ? <ZoneRect what="price $49 (ours)" rect={{ x: OURS.x + OURS.fig.x, y: o.y + OURS.fig.y, w: L.figW, h: figH }} /> : null}
          <ZoneRect what="ours a month" rect={{ x: OURS.x + L.monthX, y: o.y + L.figBase - 0.96 * OURS.month, w: L.monthW, h: OURS.month * 1.2 }} />
        </>
      ) : null}
      {o.opacity > 0.5 && f < 0.5 ? <ZoneRect what="object ours" rect={{ x: r.x, y: r.y, w: r.w, h: r.h }} /> : null}
    </>
  );
};

/* ── the chip ── */
const CHIP_TEXT = 'From $49 a month';
const chipSpec = () => ({ size: CHIP.size, weight: 520, tracking: -0.01 });
export function chipBox(): Box {
  const w = measureText(CHIP_TEXT, chipSpec()) + 2 * CHIP.padX;
  return { x: CHIP.right - w, y: CHIP.y, w, h: CHIP.h };
}
const ChipFace: React.FC<{ w: number; h: number; opacity: number }> = ({ w, h, opacity }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: w,
      height: h,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif',
      fontSize: CHIP.size,
      fontWeight: chipSpec().weight,
      letterSpacing: `${chipSpec().tracking}em`,
      fontVariantNumeric: 'tabular-nums',
      color: SUNDAY.ink,
      whiteSpace: 'nowrap',
      opacity: opacity >= 0.999 ? undefined : opacity,
    }}
  >
    <span style={{ display: 'block', transform: 'translateY(-0.02em)' }}>{CHIP_TEXT}</span>
  </div>
);
/** the parked chip after the fold (b6 → the impact) */
export const Chip: React.FC<{ t: number }> = ({ t }) => {
  const ready = useKitFaces();
  if (!ready || t < FOLD[1] || t > CHIP_OUT + 6) return null;
  const c = chipBox();
  const q = tween(t, [CHIP_OUT, CHIP_OUT + 4], [0, 1], EASE.in3);
  const dy = -q * (c.h + 24);
  const o = 1 - smooth(0.4, 1, q);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: `inset(${c.y - 2}px 0px 0px 0px)`, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: c.w,
            height: c.h,
            borderRadius: c.h / 2,
            background: '#ffffff',
            boxShadow: `inset 0 0 0 2px ${SUNDAY.orb[2]}, ${meshElevation(2, SHADOW, 1)}`,
            opacity: o >= 0.999 ? undefined : o,
            ...subpixel(`translate(${c.x}px, ${(c.y + dy).toFixed(3)}px)`, q > 0),
          }}
        >
          <ChipFace w={c.w} h={c.h} opacity={1} />
        </div>
      </div>
      {q < 0.5 ? <ZoneRect what="price $49 (chip)" rect={{ x: c.x + CHIP.padX, y: c.y + (c.h - CHIP.size * 1.2) / 2, w: c.w - 2 * CHIP.padX, h: CHIP.size * 1.2 }} /> : null}
    </>
  );
};

/* ── the set-up track ── */
export const Track: React.FC<{ t: number }> = ({ t }) => {
  if (t < M.set - 1 || t > M.it + 8) return null;
  const draw = tween(t, [M.set, M.set + 8], [0, 1], EASE.draw);
  const fold = tween(t, [M.it - 2, M.it + 6], [0, 1], EASE.in3);
  const len = (TRACK.x1 - TRACK.x0) * draw * (1 - fold);
  const xs = [0, 1, 2, 3].map((i) => TRACK.x0 + ((TRACK.x1 - TRACK.x0) * i) / 3);
  const D = TRACK.dot;
  const checkAt = M.dots[3] + 2;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, pointerEvents: 'none' }}>
      {len > 0.3 ? <div style={{ position: 'absolute', left: TRACK.x0, top: TRACK.y - 1, width: len, height: 2, borderRadius: 1, background: GRAPHITE.tag, opacity: 0.4 }} /> : null}
      {xs.map((x, i) => {
        // each empty dot pops in as the pen passes it; it fills teal on its 16th; all fold away on "It"
        const passAt = M.set + 8 * (i / 3) * 0.85;
        const pop = springUnit(t - passAt, SPRING.pop) * (1 - smooth(0, 1, tween(t, [M.it - 2 + i * 0.6, M.it + 4 + i * 0.6], [0, 1], EASE.in3)));
        if (pop <= 0.002) return null;
        const fill = springUnit(t - M.dots[i], SPRING.pop);
        const last = i === 3;
        const grow = last ? 1 + 0.55 * springUnit(t - (checkAt - 1), SPRING.pop) : 1;
        const d = D * grow;
        return (
          <div key={i} style={{ position: 'absolute', left: x - d / 2, top: TRACK.y - d / 2, width: d, height: d, transform: `scale(${pop.toFixed(4)})` }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#ffffff', boxShadow: `inset 0 0 0 2px rgba(85, 83, 90, 0.45), 0 1px 3px rgba(30, 20, 66, 0.12)` }} />
            {fill > 0.002 ? <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: SUNDAY.ink, transform: `scale(${Math.min(1.08, fill).toFixed(4)})` }} /> : null}
            {last && t >= checkAt - 0.5 ? (
              <div style={{ position: 'absolute', left: d * 0.2, top: d * 0.2, width: d * 0.6, height: d * 0.6 }}>
                <CheckMark size={d * 0.6} t={t} at={checkAt} color="#ffffff" stroke={3.2} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

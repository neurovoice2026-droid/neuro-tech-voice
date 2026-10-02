/**
 * The #demo clock lockup, "03 ◉ 12": four figure windows (0.6em × 1.1em,
 * clipped) with the orb as the colon.
 *
 * Each window holds a short strip of STATES (blank → 17:05's figure → … →
 * blank). A figure that changes ROLLS one cell: the old figure leaves
 * through the top of its window in its own light while the new one rises in
 * from below in the new light (a short wind-back, power3.inOut travel, a
 * small damped overshoot on the landing). A figure that stays does not move —
 * it re-lights. Flicks are additive (chainPos), so a new one can leave while
 * the last one is still settling.
 *
 * The figures are FLAT, OPAQUE INK — the light's own ink on the dark at ≈ 90 %
 * (moments.ts FIGURE_INK), set like the reference type (no gradient fill, no
 * specular gloss). The colon
 * orb's light does the colour; a light hit lifts the ink (a flat colour
 * change), never a highlight band.
 *
 * No motion blur, no smear: the film renders at 120 fps and every position
 * here is a continuous function of fractional time, so a roll reads as a
 * crisp mechanical move. While a strip moves its figures sit on a compositor
 * layer (Type.tsx subpixel) so the settle never stair-steps; at rest they are
 * plain, pixel-crisp text.
 */
import React from 'react';
import { MeshOrb } from '../../components/MeshOrb';
import { subpixel } from '../../components/Type';
import { mixColor } from '../../lib/lights';
import { C, FONT } from '../../theme';
import { rgba } from './color';

/* ── Flick curve ────────────────────────────────────────────────────── */

const inOut3 = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/** One forward flick of a strip: `delta` cells, leaving at `start`, landing ON `land`. */
export type Flick = {
  start: number;
  land: number;
  delta: number;
  /** wind-back before it leaves, in cells (default 7 %; 0 = none) */
  wind?: number;
};

/** Arrival speed in cells / frame → the size of the landing overshoot (≈ 5 % of a cell). */
const V_LAND = 0.07;
const OMEGA = (2 * Math.PI) / 9; // overshoot period ≈ 9 frames
const DECAY = 0.3;
const WIND = 0.07; // anticipation: the strip winds back 7 % of a cell
const WIND_FRAMES = 2;

/** Displacement (cells) one flick has added by frame f: wind-back, travel, overshoot + settle. */
export function flickDisp(f: number, { start, land, delta, wind = WIND }: Flick): number {
  const wf = wind > 0 ? WIND_FRAMES : 0;
  if (f <= start - wf) return 0;
  if (f < start) {
    const t = (f - (start - wf)) / wf;
    return -wind * Math.sin((t * Math.PI) / 2);
  }
  const D = delta + wind;
  const dur = land - start;
  if (f < land) {
    const u = (f - start) / dur;
    // power3.inOut with a little linear mixed in, so the strip arrives with
    // speed V_LAND and the spring carries it a touch past the figure
    const m = Math.min(0.4, (V_LAND * dur) / D);
    return -wind + D * ((1 - m) * inOut3(u) + m * u);
  }
  const tau = f - land;
  const v = (D * Math.min(0.4, (V_LAND * dur) / D)) / dur; // the actual arrival speed
  return delta + (v / OMEGA) * Math.exp(-DECAY * tau) * Math.sin(OMEGA * tau);
}

/** Strip position (cells, fractional) at frame f: `from` plus every flick so far. */
export const chainPos = (f: number, from: number, flicks: readonly Flick[]) =>
  flicks.reduce((p, k) => p + flickDisp(f, k), from);

/* ── Figure window ──────────────────────────────────────────────────── */

/** One state of a window: its figure (null = blank) and the flat ink of the light it is lit by. */
export type Cell = { digit: number | null; ink: string };

/** How far a full ink lift (lift = 1) carries the figure's ink towards paper. */
const LIFT_TO_PAPER = 0.34;

/** The window's edges: the figures pass under a short feather, never a hard cut line. */
const WINDOW_MASK = 'linear-gradient(180deg, transparent 0%, #000 11%, #000 89%, transparent 100%)';

const Window: React.FC<{
  cells: readonly Cell[];
  /** strip position, cells (fractional) */
  pos: number;
  /** cells / frame (≈ 0 at rest) */
  speed: number;
  fontSize: number;
  /** 0..1 the light lifts this figure's ink towards paper (a flat colour change, no band) */
  lift: number;
}> = ({ cells, pos, speed, fontSize, lift }) => {
  const cellW = 0.6 * fontSize;
  const cellH = 1.1 * fontSize;
  const base = Math.floor(pos);
  const moving = Math.abs(speed) > 4e-4;
  const shown = [base - 1, base, base + 1, base + 2].filter((k) => k >= 0 && k < cells.length && cells[k].digit !== null);
  return (
    <div
      style={{
        position: 'relative',
        width: cellW,
        height: cellH,
        overflow: 'hidden',
        WebkitMaskImage: WINDOW_MASK,
        maskImage: WINDOW_MASK,
      }}
    >
      {shown.map((k) => {
        const cell = cells[k];
        const ink = lift > 1e-4 ? mixColor(cell.ink, C.paper, LIFT_TO_PAPER * Math.min(1, lift)) : cell.ink;
        const y = (k - pos) * cellH;
        return (
          <span
            key={k}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: cellW,
              height: cellH,
              lineHeight: `${cellH}px`,
              fontFamily: FONT.ui,
              fontWeight: 440,
              fontSize,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 0,
              textAlign: 'center',
              color: ink,
              ...subpixel(Math.abs(y) > 0.004 ? `translateY(${y.toFixed(3)}px)` : undefined, moving),
            }}
          >
            {cell.digit}
          </span>
        );
      })}
    </div>
  );
};

/* ── Lockup ─────────────────────────────────────────────────────────── */

export type Strip = { cells: readonly Cell[]; pos: number; speed: number };

export const ClockLockup: React.FC<{
  /** the four windows, left → right */
  strips: readonly Strip[];
  /** ink lift per figure, 0..1 (see Window) */
  lifts: readonly number[];
  fontSize: number;
  orbSize: number;
  gap: number;
  orbScale: number;
  orbTime: number;
  /** the colon orb's palette (the moment's light) */
  orbPalette: readonly string[];
  /** the light's body colour (the orb's halo) */
  glowBody: string;
  /** 0..1 extra light in the orb halo (the hits). */
  orbFlash: number;
  /** vertical nudge of the orb so it sits on the figures' optical centre */
  orbDy: number;
  figuresOpacity: number;
  orbOpacity: number;
  /** a light hit on the figures (1 = none): brightness, never blur */
  figuresLift?: number;
}> = ({
  strips,
  lifts,
  fontSize,
  orbSize,
  gap,
  orbScale,
  orbTime,
  orbPalette,
  glowBody,
  orbFlash,
  orbDy,
  figuresOpacity,
  orbOpacity,
  figuresLift = 1,
}) => {
  const win = (i: number) => (
    <Window key={i} cells={strips[i].cells} pos={strips[i].pos} speed={strips[i].speed} fontSize={fontSize} lift={lifts[i]} />
  );
  const pair: React.CSSProperties = {
    display: 'flex',
    position: 'relative',
    zIndex: 1,
    opacity: figuresOpacity,
    // always on (even at 1), so the figures never switch render paths between frames
    filter: `brightness(${figuresLift.toFixed(4)})`,
  };
  const halo = orbSize * 3.4;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div style={{ ...pair, marginRight: gap }}>
        {win(0)}
        {win(1)}
      </div>
      <div style={{ position: 'relative', zIndex: 2, width: orbSize, height: orbSize, transform: `translateY(${orbDy}px)` }}>
        {/* the source's own bloom — a gradient, not a filter */}
        <div
          style={{
            position: 'absolute',
            left: (orbSize - halo) / 2,
            top: (orbSize - halo) / 2,
            width: halo,
            height: halo,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${rgba(glowBody, (0.34 + orbFlash * 0.4) * orbOpacity)} 0%, ${rgba(glowBody, (0.1 + orbFlash * 0.16) * orbOpacity)} 42%, ${rgba(glowBody, 0.025 * orbOpacity)} 78%, ${rgba(glowBody, 0)} 100%)`,
            transform: `scale(${(0.85 + 0.35 * orbScale).toFixed(4)})`,
          }}
        />
        <MeshOrb
          size={orbSize}
          palette={orbPalette}
          time={orbTime}
          style={{ transform: `scale(${orbScale.toFixed(4)})`, opacity: orbOpacity }}
        />
      </div>
      <div style={{ ...pair, marginLeft: gap }}>
        {win(2)}
        {win(3)}
      </div>
    </div>
  );
};

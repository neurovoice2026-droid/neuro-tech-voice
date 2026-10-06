/**
 * REEL 1 · THE WEEK GRID (docs/ig/SCRIPT.md ig1 b2–b5, §5 "WeekGrid"): 7 days × 24 hours of rounded SVG cells — the
 * reel's proof. Every fill, outline and move is a pure function of the absolute timeline frame `t` (grid.ts geometry,
 * timing.ts M moments), drawn in the stage's camera plane (Stage.tsx zooms it about the grid's centre).
 *
 *   UNFOLD   (M.unfold) the desk's hairline opens into the week: its 24 rows spread out of the line (centre rows first,
 *            on a near-critical spring), each row's segment splitting into seven cells as it thickens
 *   STAFFED  ("Nine") 9 to 6 × Monday–Friday fills graphite, one column per 16th, each column wiping down its hours;
 *            "09" / "18" tick into the hour gutter on "Nine" / "six", MON–FRI over columns 1–5 on "weekdays" (chrome,
 *            each on its spoken word)
 *   45       ("forty-five") the block's outline lifts once (SPRING.pop) and the block bobs 4 px
 *   168      ("a hundred and sixty-eight") every empty cell draws its hairline outline in one diagonal wave
 *   123      ("other") the 123 empty cells pop teal in a ripple from Friday 18:00 — a glint at the front settling into
 *            her ink — through the nights and the weekend
 *   PEOPLE   ("receptionist", b5) the graphite block lifts off the week (5 px: inside the row gap), its contact shadow under it
 *   END      (End.tsx) `fx.dim` steps the whole week back behind the CTA; `fx.collapse` folds it back into the desk line
 *            in the seam (rows converging on y 760, the teal draining first), so frame 0's hairline can draw again
 */
import React from 'react';
import { reveal, revealStyle } from '../../components/Type';
import { ContactShadow } from '../../components/Atmosphere';
import { EASE, mix, mixHex, smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { maskBox } from '../../lib/type';
import { GRAPHITE } from '../../kb/theme';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { labelWidth, measureText, useKitFaces } from '../../kb/kit';
import { ZoneRect } from '../components/ZoneGuard';
import { BLOCK, CELLS, GRID, TICKS, cascadeAt, cellY, waveAt, type Cell } from './grid';
import { DESK } from './desk';
import { onScreen } from './stage';
import * as T from './timing';

const M = T.M;
const SUNDAY = MOMENT_LIGHTS.sunday;
/** the pearl the inks are mixed on (opaque tiles: a crisp two-colour graphic, never a translucent wash) */
const PEARL = '#f1f0f4';
export const INK = {
  /** the front desk's hours: graphite (people) */
  staffed: mixHex(PEARL, GRAPHITE.text, 0.86),
  /** the agent's: sunday ink at 70 % (SCRIPT ig1 b3) */
  teal: mixHex(PEARL, SUNDAY.ink, 0.7),
  /** the cascade's front: her light */
  glint: SUNDAY.orb[2],
  /** an empty hour: pale graphite */
  empty: GRAPHITE.text,
  emptyA: 0.085,
  outline: GRAPHITE.tag,
} as const;

export type GridFx = {
  /** the whole week's opacity × (1 − dim) */
  dim?: number;
  /** the seam: 0 → 1, the week folding back into the desk line */
  collapse?: number;
  /** hide the chrome (ticks, MON–FRI): the cover */
  chrome?: boolean;
};

/* ── the moments, per cell ── */
const ROW_STAGGER = 4;
const rowDelay = (r: number) => (Math.abs(cellY(r) + GRID.ch / 2 - DESK.y) / 400) * ROW_STAGGER;
/** a row's unfold 0 → 1 (a hair of overshoot) */
const unfoldOf = (t: number, r: number) => springUnit(t - M.unfold - rowDelay(r), { stiffness: 380, damping: 32, mass: 1 });
/** the desk segment a cell starts from (the hairline x 86–906 in seven) */
const segW = (DESK.x1 - DESK.x0) / GRID.cols;
const tealAt = (k: Cell) => M.cascade + cascadeAt(k) * (T.CASCADE_LEN - 8);
const waveStart = (k: Cell) => M.week168 + waveAt(k) * 16;

/** the cell's rect at t (unfold, collapse) */
function cellRect(k: Cell, t: number, collapse: number) {
  const p = unfoldOf(t, k.r);
  // the seam: outer rows first, all in by collapse 1
  const cq = collapse > 0 ? smooth(0, 1, Math.min(1, collapse * 1.35 - (1 - Math.abs(cellY(k.r) + 13 - DESK.y) / 400) * 0.35)) : 0;
  const u = Math.min(p, 1 + (p - 1)) * (1 - cq);
  const x = mix(DESK.x0 + k.c * segW, k.x, u);
  const w = mix(segW, GRID.cw, u);
  const cy = mix(DESK.y, k.y + GRID.ch / 2, u);
  const h = mix(1.5, GRID.ch, smooth(0.22, 1, u));
  return { x, y: cy - h / 2, w, h, u, p, cq };
}

export const WeekGrid: React.FC<{ t: number; fx?: GridFx; zoom?: number }> = ({ t, fx = {}, zoom = 1 }) => {
  const ready = useKitFaces();
  if (t < M.unfold - 1) return null;
  const { dim = 0, collapse = 0, chrome = true } = fx;
  const opacity = 1 - dim;
  if (opacity <= 0.002) return null;
  const f45 = M.fortyFive;
  // "forty-five": the block bobs once (up 4 px and back), its outline lifting with it
  const bob = -4 * (springUnit(t - f45, SPRING.pop) - springUnit(t - f45 - 7, SPRING.pop));
  const ringPop = springUnit(t - (f45 - 1), SPRING.pop);
  const ringA = 0.5 * smooth(f45 - 1, f45 + 1, t) * (1 - tween(t, [M.week168 - 6, M.week168 + 8], [0, 1], EASE.inOut)) * (1 - collapse);
  // "receptionist": the people's block lifts off the week
  const lift = springUnit(t - M.receptionist, SPRING.land);
  // (5 px: under the 6 px row gap, so the lifted block never touches the hours around it; its shadow carries the lift)
  const liftY = -5 * lift * (1 - smooth(0, 0.5, collapse));
  const tealDrain = (k: Cell) => (collapse > 0 ? smooth(0, 0.55, collapse * 1.1 - (1 - cascadeAt(k)) * 0.25) : 0);
  const base: React.ReactNode[] = [];
  const lines: React.ReactNode[] = [];
  const fills: React.ReactNode[] = [];
  const people: React.ReactNode[] = [];
  for (const k of CELLS) {
    const R = cellRect(k, t, collapse);
    if (R.p <= 0.001 && collapse <= 0) continue;
    const rx = Math.min(GRID.radius, R.h / 2);
    // the pale hour: a line while it travels, a tile once it is open; gone in the collapse
    const lineA = 0.14 * smooth(0, 0.1, R.u) * (1 - smooth(0.3, 0.85, R.u));
    const tileA = INK.emptyA * smooth(0.3, 0.85, R.u);
    // (a filled hour of the front desk covers its pale tile: none under it, so its lift shows the ground, not a ghost)
    const covered = k.open && t >= T.STAFFED_FILLS[k.c] + 8 && R.cq <= 0;
    const a = covered ? 0 : (lineA + tileA) * (1 - smooth(0.2, 0.7, R.cq));
    if (a > 0.002) base.push(<rect key={`b${k.c}-${k.r}`} x={R.x} y={R.y} width={R.w} height={R.h} rx={rx} fill={INK.empty} fillOpacity={a.toFixed(4)} />);
    if (R.u < 0.5) continue;
    if (k.open) {
      // the staffed block: its column wipes down its hours from "Nine" (one column per 16th)
      const q = tween(t, [T.STAFFED_FILLS[k.c], T.STAFFED_FILLS[k.c] + 7], [0, 1], EASE.out3);
      const fy = Math.min(1, Math.max(0, (q * BLOCK.h - (k.y - BLOCK.y)) / GRID.ch));
      const fa = 1 - smooth(0.1, 0.55, R.cq);
      if (fy > 0.001 && fa > 0.002) {
        const h = R.h * fy;
        people.push(<rect key={`s${k.c}-${k.r}`} x={R.x} y={R.y + bob + liftY} width={R.w} height={h} rx={Math.min(rx, h / 2)} fill={INK.staffed} fillOpacity={fa < 0.999 ? fa.toFixed(4) : undefined} />);
      }
    } else {
      // "a hundred and sixty-eight": its hairline outline draws, in one diagonal wave
      const w = tween(t, [waveStart(k), waveStart(k) + 8], [0, 1], EASE.draw);
      const s0 = tealAt(k);
      const pop = springUnit(t - s0, SPRING.pop);
      const drain = tealDrain(k);
      const tealA = smooth(0, 0.3, pop) * (1 - drain);
      const la = 0.42 * (1 - smooth(0.2, 0.9, tealA)) * (1 - smooth(0, 0.4, R.cq));
      if (w > 0.001 && la > 0.002)
        lines.push(
          <rect key={`o${k.c}-${k.r}`} x={R.x + 0.625} y={R.y + 0.625} width={R.w - 1.25} height={R.h - 1.25} rx={Math.max(0, rx - 0.6)} fill="none" stroke={INK.outline} strokeOpacity={la.toFixed(4)} strokeWidth={1.25} pathLength={1} strokeDasharray={`${w.toFixed(4)} 1`} />,
        );
      // "other": the agent's hours pop teal, a glint at the front settling into her ink
      if (tealA > 0.002) {
        const sc = 0.55 + 0.45 * pop;
        const settle = tween(t, [s0 + 1, s0 + 12], [0, 1], EASE.inOut);
        const col = mixHex(INK.glint, INK.teal, settle);
        const cx = R.x + R.w / 2;
        const cy = R.y + R.h / 2;
        fills.push(
          <rect key={`t${k.c}-${k.r}`} x={cx - (R.w * sc) / 2} y={cy - (R.h * sc) / 2} width={R.w * sc} height={R.h * sc} rx={Math.min(rx, (R.h * sc) / 2)} fill={col} fillOpacity={tealA < 0.999 ? tealA.toFixed(4) : undefined} />,
        );
      }
    }
  }
  // the block's outline (45)
  const inflate = 3 + 5 * ringPop;
  const blockRing =
    ringA > 0.003 ? (
      <rect x={BLOCK.x - inflate} y={BLOCK.y - inflate + bob} width={BLOCK.w + 2 * inflate} height={BLOCK.h + 2 * inflate} rx={GRID.radius + inflate} fill="none" stroke={GRAPHITE.text} strokeOpacity={ringA.toFixed(4)} strokeWidth={2} />
    ) : null;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: opacity < 0.999 ? opacity : undefined }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <g>{base}</g>
        <g>{lines}</g>
        <g>{fills}</g>
      </svg>
      {/* the people's block over the week: its shadow falls on the hours around it */}
      {lift > 0.001 && collapse < 1 ? <ContactShadow x={BLOCK.x + BLOCK.w / 2} y={BLOCK.y + BLOCK.h + 2} w={BLOCK.w} lift={0.2 + 0.4 * lift} k={1.25 * Math.min(1, lift) * (1 - smooth(0, 0.4, collapse))} /> : null}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden>
        <g>{people}</g>
        {blockRing}
      </svg>
      {chrome && ready ? <GridChrome t={t} collapse={collapse} zoom={zoom} /> : null}
    </div>
  );
};

/* ── the chrome: the hour gutter's ticks and MON–FRI (each on its spoken word; ≤ 32 px) ── */
const TICK_FONT = { size: 28, weight: 460, mono: true } as const;
const MONO = '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace';
const LABEL_SIZE = 28;
const MONFRI = 'Mon–Fri';
/** the label's place: over columns 1–5, a hairline bracket under it */
const LBL = { x: BLOCK.x, y: GRID.y0 - 62, rule: GRID.y0 - 18 } as const;

const GridChrome: React.FC<{ t: number; collapse: number; zoom: number }> = ({ t, collapse, zoom }) => {
  const fade = 1 - smooth(0, 0.35, collapse);
  if (fade <= 0.002) return null;
  // "09" as the first column fills (once her caption has risen: one moving text at a time), "18" on "six"
  const at = [T.STAFFED_FILLS[0], M.six];
  const items = TICKS.map((tk, i) => {
    const s = at[i] - 1;
    if (t < s - 0.5) return null;
    const r = reveal(t, s, { config: SPRING.caption, rise: 90, fade: 0.5 });
    const w = measureText(tk.text, TICK_FONT);
    const y = cellY(tk.row) + GRID.ch / 2 - TICK_FONT.size * 0.62;
    const x = GRID.x0 - 12 - w;
    return (
      <React.Fragment key={tk.text}>
        <div style={{ position: 'absolute', left: x, top: y, fontFamily: MONO, fontSize: TICK_FONT.size, fontWeight: TICK_FONT.weight, lineHeight: 1.24, color: GRAPHITE.tag, opacity: fade < 0.999 ? fade : undefined, whiteSpace: 'nowrap' }}>
          <span style={{ ...maskBox(0), display: 'block' }}>
            <span style={revealStyle(r, undefined, true)}>{tk.text}</span>
          </span>
        </div>
        <TickZone what={`grid tick ${tk.text}`} x={x} y={y} w={w} h={TICK_FONT.size * 1.24} z={zoom} />
      </React.Fragment>
    );
  });
  // MON–FRI on "weekdays": the label rises out of its mask, its bracket draws out under it
  const sl = M.weekdays - 1;
  let label: React.ReactNode = null;
  if (t >= sl - 0.5) {
    const r = reveal(t, sl, { config: SPRING.caption, rise: 90, fade: 0.5 });
    const draw = tween(t, [sl + 1, sl + 13], [0, 1], EASE.draw);
    const lw = labelWidth(MONFRI.toUpperCase(), LABEL_SIZE);
    label = (
      <>
        <div style={{ position: 'absolute', left: LBL.x, top: LBL.y, fontFamily: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif', fontSize: LABEL_SIZE, fontWeight: 540, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1.2, color: GRAPHITE.tag, opacity: fade < 0.999 ? fade : undefined, whiteSpace: 'nowrap' }}>
          <span style={{ ...maskBox(0), display: 'block' }}>
            <span style={revealStyle(r, undefined, true)}>{MONFRI}</span>
          </span>
        </div>
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: fade < 0.999 ? fade : undefined }} aria-hidden>
          {draw > 0.001 ? (
            <path
              d={`M ${LBL.x + 1} ${LBL.rule + 7} V ${LBL.rule} H ${BLOCK.x + BLOCK.w - 1} V ${LBL.rule + 7}`}
              fill="none"
              stroke={GRAPHITE.tag}
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={`${draw.toFixed(4)} 1`}
            />
          ) : null}
        </svg>
        <TickZone what="grid label MON–FRI" x={LBL.x} y={LBL.y} w={lw} h={LABEL_SIZE * 1.2} z={zoom} />
      </>
    );
  }
  return (
    <>
      {items}
      {label}
    </>
  );
};

/** a chrome rect in the camera plane, reported where it is on screen (the plane's zoom z) */
const TickZone: React.FC<{ what: string; x: number; y: number; w: number; h: number; z: number }> = ({ what, x, y, w, h, z }) => {
  const a = onScreen({ x, y }, z);
  return <ZoneRect what={what} rect={{ x: a.x, y: a.y, w: w * z, h: h * z }} />;
};

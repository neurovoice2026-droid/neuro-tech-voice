/**
 * REEL 6 · THE DIAL (docs/ig/ig6/SCRIPT.md §2, STYLE.md §9.5): our ring clock, printed on the ground (it casts no shadow).
 *
 *   <WorldDial>  the dial at its true M1 geometry (centre (−9, 1814), R 1623), projected into screen space through the
 *                camera's dial plane, its marks generated for the visible angular window only: the teal rim (9 px), your
 *                phone's ring stretches (12° after each node: pending grey ahead of the needle, ink once rung), the ticks
 *                (fine every 0.75°, seconds every 6°, majors at each node), the hollow nodes (your phone) or the filled
 *                teal domes of answered calls (the agent), and the hairline pings
 *   <FullDial>   M5′: the whole dial as its own upright drawing (stage/style.ts FULL: top y 100, R 420 growing downward),
 *                fine ticks every 1.2°, with its hand redrawn at the true centre (Hand.tsx HandShape, FULL.hand)
 *
 * Both build their primitives in a pure function first (so the stage can hand the same points to the zone and
 * lockup-overlap checks), then draw them. Strokes ≥ 2 px on screen; geometricPrecision.
 */
import React from 'react';
import { mixHex } from '../../../lib/motion';
import { angleOf, DEG, needlePhi, onScreen, polar, project, visibleWindow, worldA, wrapFrom, NEEDLE_A, type Plane, type Pt } from './geom';
import { DOME, FULL, INK, MARKS, DIAL } from './style';

export type Prim = {
  /** stroked paths (the rim and the stretches), in draw order */
  paths: { d: string; w: number; color: string }[];
  ticks: { x1: number; y1: number; x2: number; y2: number; w: number; color: string }[];
  nodes: { cx: number; cy: number; r: number; w: number }[];
  domes: { cx: number; cy: number; r: number; flat?: number }[];
  pings: { cx: number; cy: number; r: number; o: number }[];
  /** screen points of every printed stroke (for the zone and overlap checks) */
  pts: Pt[];
};
const empty = (): Prim => ({ paths: [], ticks: [], nodes: [], domes: [], pings: [], pts: [] });

/** a screen-space polyline along the circle (cx, cy, r) from world angle a0 to a1, through plane p */
function arcPts(p: Plane, a0: number, a1: number, r: number, cx: number, cy: number): Pt[] {
  if (a1 <= a0) return [];
  const rs = r * p.S;
  let step = Math.min(0.5, 5 / rs / DEG);
  if ((a1 - a0) / step > 700) step = (a1 - a0) / 700;
  const n = Math.max(1, Math.ceil((a1 - a0) / step));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const w = polar(a, r, cx, cy);
    out.push(project(p, w.x, w.y));
  }
  return out;
}
const toD = (pts: Pt[]) => (pts.length < 2 ? '' : `M ${pts.map((q) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' L ')}`);
/** [a0, a1] ∩ [b0, b1] (or null) */
const cut = (a0: number, a1: number, b0: number, b1: number): [number, number] | null => {
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  return hi > lo ? [lo, hi] : null;
};

export type Ring = { n: number; scale: number; shiver: number };
export type DialState = {
  mode: 'phone' | 'agent';
  /** the dial's rotation (deg) */
  rho: number;
  /** your phone: the dial angle up to which the stretches are ink */
  inkTo: number;
  /** the rim's trim: visible within ± this many degrees of the needle (null: all) — the rebuild and the seam */
  rimSpan?: number | null;
  /** a tick's reveal (0..1) by its world angle (the sweep-in); default all shown */
  tickOn?: (a: number) => number;
  /** your phone's nodes: each one's pulse and shiver (the ringing / landing one); default at rest */
  ring?: (n: number) => Ring;
  /** only this node (the T2 push past ×6) */
  only?: number;
  /** no ticks / no rim and stretches (the T2 push past ×6) */
  noTicks?: boolean;
  noRim?: boolean;
  /** the agent's answered calls: dial angle, pop scale */
  domes?: readonly { phi: number; scale: number }[];
  /** pings on nodes (dial angle, world radius, opacity) */
  pings?: readonly { phi: number; r: number; o: number }[];
  /** heavier strokes (the cover: rim 12 px, ticks × 1.33) */
  bold?: { rim: number; tick: number };
  /** the T2 push: the rim, stretches and ticks thin away by this factor (1 → 0 over ×2.4 → ×5) */
  thin?: number;
  /** the T2 push: the nodes' band thins inward 0 → 1 (inner radius 6 → 9 node units, outer 12 kept) */
  nodeThin?: number;
};

/** the world dial's primitives on screen (M1 / M3′ / the T2 push) */
export function worldPrims(p: Plane, s: DialState): Prim {
  const out = empty();
  const C = DIAL;
  // the marks' visible window (the T2 push draws node 2 alone, whose own ring can cover the frame when the rim band
  // itself is off it — so it never waits on the window)
  const win = visibleWindow(p, MARKS.major.r0, C.R + MARKS.rim);
  if (!win && s.only === undefined) return out;
  const [w0, w1] = win ?? [0, 0];
  const span = s.rimSpan ?? null;
  const [r0, r1] = s.noRim ? [0, 0] : span === null ? [w0, w1] : (cut(w0, w1, NEEDLE_A - span, NEEDLE_A + span) ?? [0, 0]);
  const thin = s.thin ?? 1;
  const rimWidth = (s.bold?.rim ?? MARKS.rim) * p.S * thin;
  // the rim
  if (r1 > r0) {
    const pts = arcPts(p, r0, r1, C.R, C.cx, C.cy);
    out.paths.push({ d: toD(pts), w: rimWidth, color: INK.teal });
    out.pts.push(...pts.filter((q) => onScreen(q, 20)));
  }
  // your phone's ring stretches: [φn, φn + 12], ink behind the needle, pending ahead
  if (s.mode === 'phone' && r1 > r0) {
    // nodes 1–9: behind the needle at frame 0 the rim is clean teal (there is no ring before ring 1; node 10's stretch
    // would sit there — it rings only in M5′'s time-lapse, which draws all ten)
    for (let n = 1; n < MARKS.nodes; n++) {
      const phi = MARKS.nodeEvery * (n - 1);
      const ink = Math.min(Math.max(s.inkTo, phi), phi + MARKS.stretch);
      const parts: [number, number, string][] = [
        [phi, ink, INK.ink],
        [ink, phi + MARKS.stretch, INK.pending],
      ];
      for (const [a, b, color] of parts) {
        if (b - a < 1e-4) continue;
        const wa = wrapFrom(worldA(a, s.rho), w0 - MARKS.stretch);
        const c = cut(wa, wa + (b - a), r0, r1);
        if (!c) continue;
        const pts = arcPts(p, c[0], c[1], C.R, C.cx, C.cy);
        out.paths.push({ d: toD(pts), w: rimWidth, color });
      }
    }
  }
  // the ticks (the visible window only; the highest class wins at shared angles)
  if (!s.noTicks) {
    const step = MARKS.minor.every;
    // fine ticks every 0.75°: a second (6°) every 8th, a major (36°, at each node) every 48th
    const perSec = Math.round(MARKS.sec.every / step);
    const perMajor = Math.round(MARKS.major.every / step);
    const i0 = Math.ceil((w0 - worldA(0, s.rho)) / step);
    const i1 = Math.floor((w1 - worldA(0, s.rho)) / step);
    for (let i = i0; i <= i1; i++) {
      const a = worldA(i * step, s.rho);
      const k = ((i % perMajor) + perMajor) % perMajor;
      const spec = k === 0 ? MARKS.major : k % perSec === 0 ? MARKS.sec : MARKS.minor;
      const on = s.tickOn ? s.tickOn(a) : 1;
      if (on <= 0.001) continue;
      const rIn = spec.r1 - (spec.r1 - spec.r0) * Math.min(1, on);
      const pa = polar(a, spec.r1, C.cx, C.cy);
      const pb = polar(a, rIn, C.cx, C.cy);
      const qa = project(p, pa.x, pa.y);
      const qb = project(p, pb.x, pb.y);
      if (!onScreen(qa, 30) && !onScreen(qb, 30)) continue;
      out.ticks.push({ x1: qa.x, y1: qa.y, x2: qb.x, y2: qb.y, w: spec.w * p.S * (s.bold?.tick ?? 1) * thin, color: spec.color });
      out.pts.push(qa, qb, { x: (qa.x + qb.x) / 2, y: (qa.y + qb.y) / 2 });
    }
  }
  // your phone's hollow nodes
  if (s.mode === 'phone') {
    for (let n = 1; n <= MARKS.nodes; n++) {
      if (s.only !== undefined && n !== s.only) continue;
      const phi = MARKS.nodeEvery * (n - 1);
      const a = worldA(phi, s.rho);
      const ring = s.ring ? s.ring(n) : { n, scale: 1, shiver: 0 };
      if (ring.scale <= 0.001) continue;
      const w = polar(a, C.R, C.cx, C.cy);
      const tan = { x: Math.cos(a * DEG), y: Math.sin(a * DEG) };
      const q = project(p, w.x + tan.x * ring.shiver, w.y + tan.y * ring.shiver);
      const k = p.S * ring.scale;
      const rOut = (MARKS.node.r + MARKS.node.w / 2) * k;
      const rIn = (MARKS.node.r - MARKS.node.w / 2 + (MARKS.node.w / 2) * (s.nodeThin ?? 0)) * k;
      const r = (rOut + rIn) / 2;
      if (!onScreen(q, rOut + 20) && s.only === undefined) continue;
      out.nodes.push({ cx: q.x, cy: q.y, r, w: rOut - rIn });
      out.pts.push(q, { x: q.x + rOut, y: q.y }, { x: q.x - rOut, y: q.y }, { x: q.x, y: q.y + rOut }, { x: q.x, y: q.y - rOut });
    }
  }
  // the agent's answered calls
  for (const d of s.domes ?? []) {
    if (d.scale <= 0.001) continue;
    const w = polar(worldA(d.phi, s.rho), C.R, C.cx, C.cy);
    const q = project(p, w.x, w.y);
    const r = MARKS.dome.r * p.S * d.scale;
    if (!onScreen(q, r + 10)) continue;
    out.domes.push({ cx: q.x, cy: q.y, r });
    out.pts.push(q, { x: q.x + r, y: q.y }, { x: q.x, y: q.y + r });
  }
  for (const g of s.pings ?? []) {
    const w = polar(worldA(g.phi, s.rho), C.R, C.cx, C.cy);
    const q = project(p, w.x, w.y);
    out.pings.push({ cx: q.x, cy: q.y, r: g.r * p.S, o: g.o });
  }
  return out;
}

export type FullState = {
  mode: 'phone' | 'agent';
  /** your phone: the dial angle up to which the stretches are ink */
  inkTo: number;
  /** tick reveal by dial angle (the open's clockwise sweep) */
  tickOn?: (phi: number) => number;
  ring?: (n: number) => Ring;
  domes?: readonly { phi: number; scale: number }[];
};
/** M5′'s primitives: the upright dial in its own plane (screen = C5 + g·R(rot)·(local − C5)) */
export function fullPrims(p: Plane, s: FullState): Prim {
  const out = empty();
  const F = FULL;
  const g = p.S;
  const rim = arcPts(p, 0, 360, F.R, F.cx, F.cy);
  out.paths.push({ d: `${toD(rim)} Z`, w: F.rim * g, color: INK.teal });
  out.pts.push(...rim.filter((q) => onScreen(q, 20)));
  if (s.mode === 'phone') {
    for (let n = 1; n <= MARKS.nodes; n++) {
      const phi = MARKS.nodeEvery * (n - 1);
      const ink = Math.min(Math.max(s.inkTo, phi), phi + MARKS.stretch);
      if (ink > phi + 1e-4) out.paths.push({ d: toD(arcPts(p, phi, ink, F.R, F.cx, F.cy)), w: F.stretch * g, color: INK.ink });
      if (phi + MARKS.stretch > ink + 1e-4) out.paths.push({ d: toD(arcPts(p, ink, phi + MARKS.stretch, F.R, F.cx, F.cy)), w: F.stretch * g, color: INK.pending });
    }
  }
  for (let i = 0; i < 300; i++) {
    const phi = i * 1.2;
    const k = i % 30;
    const spec = k === 0 ? F.major : k % 5 === 0 ? F.sec : F.minor;
    const on = s.tickOn ? s.tickOn(phi) : 1;
    if (on <= 0.001) continue;
    const rOut = spec.r1 * F.R;
    const rIn = rOut - (spec.r1 - spec.r0) * F.R * Math.min(1, on);
    const pa = polar(phi, rOut, F.cx, F.cy);
    const pb = polar(phi, rIn, F.cx, F.cy);
    const qa = project(p, pa.x, pa.y);
    const qb = project(p, pb.x, pb.y);
    out.ticks.push({ x1: qa.x, y1: qa.y, x2: qb.x, y2: qb.y, w: spec.w * g, color: spec.color });
  }
  if (s.mode === 'phone') {
    for (let n = 1; n <= MARKS.nodes; n++) {
      const phi = MARKS.nodeEvery * (n - 1);
      const ring = s.ring ? s.ring(n) : { n, scale: 1, shiver: 0 };
      const w = polar(phi, F.R, F.cx, F.cy);
      const q = project(p, w.x, w.y);
      out.nodes.push({ cx: q.x, cy: q.y, r: F.node.r * g * ring.scale, w: F.node.w * g * ring.scale });
    }
  }
  for (const d of s.domes ?? []) {
    if (d.scale <= 0.001) continue;
    const w = polar(d.phi, F.R, F.cx, F.cy);
    const q = project(p, w.x, w.y);
    out.domes.push({ cx: q.x, cy: q.y, r: F.dome.r * d.scale });
  }
  return out;
}

/** the dome gradients (STYLE §9.3: highlight at 30 %/30 %, the rim dark), as SVG defs under a unique prefix */
export const DomeDefs: React.FC<{ id: string }> = ({ id }) => (
  <defs>
    {(['teal', 'graphite'] as const).map((k) => (
      <radialGradient key={k} id={`${id}-${k}`} cx="50%" cy="50%" r="50%" fx="32%" fy="30%">
        {DOME[k].map(([o, c]) => (
          <stop key={o} offset={o} stopColor={c} />
        ))}
      </radialGradient>
    ))}
  </defs>
);
/** a dome: the gradient (`flat` 0..1 flattens it toward the plain teal), a 1 px tealRim rim at 40 % */
export const Dome: React.FC<{ id: string; cx: number; cy: number; r: number; kind?: 'teal' | 'graphite'; flat?: number }> = ({ id, cx, cy, r, kind = 'teal', flat = 0 }) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-${kind})`} />
    {flat > 0.001 ? <circle cx={cx} cy={cy} r={r} fill={kind === 'teal' ? INK.teal : INK.graphite} opacity={Math.min(1, flat)} /> : null}
    <circle cx={cx} cy={cy} r={Math.max(0, r - 0.5)} fill="none" stroke={kind === 'teal' ? INK.tealRim : '#151515'} strokeOpacity={0.4 * (1 - Math.min(1, flat))} strokeWidth={1} />
  </>
);

/** draw a dial's primitives (one full-frame SVG) */
export const DialSvg: React.FC<{ prim: Prim; id: string }> = ({ prim, id }) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden' }} shapeRendering="geometricPrecision" aria-hidden>
    <DomeDefs id={id} />
    {prim.paths.map((q, i) => (q.d ? <path key={`p${i}`} d={q.d} fill="none" stroke={q.color} strokeWidth={q.w} strokeLinecap="round" strokeLinejoin="round" /> : null))}
    {prim.ticks.map((q, i) => (
      <line key={`t${i}`} x1={q.x1} y1={q.y1} x2={q.x2} y2={q.y2} stroke={q.color} strokeWidth={q.w} strokeLinecap="butt" />
    ))}
    {prim.nodes.map((q, i) => (
      <circle key={`n${i}`} cx={q.cx} cy={q.cy} r={q.r} fill="#FFFFFF" stroke={INK.ink} strokeWidth={q.w} />
    ))}
    {prim.domes.map((q, i) => (
      <Dome key={`d${i}`} id={id} cx={q.cx} cy={q.cy} r={q.r} />
    ))}
    {prim.pings.map((q, i) => (
      <circle key={`g${i}`} cx={q.cx} cy={q.cy} r={q.r} fill="none" stroke={INK.ink} strokeWidth={2} strokeOpacity={q.o} />
    ))}
  </svg>
);

/** the screen rect of a prim's points below y (for the TikTok-rail rule: objects below y 840 keep x ≤ 880) */
export function belowRect(pts: readonly Pt[], y: number) {
  const low = pts.filter((q) => q.y > y && q.x > -40 && q.x < 1120 && q.y < 1960);
  if (!low.length) return null;
  const xs = low.map((q) => q.x);
  const ys = low.map((q) => q.y);
  const x0 = Math.max(0, Math.min(...xs));
  const x1 = Math.min(1080, Math.max(...xs));
  return { x: x0, y, w: Math.max(1, x1 - x0), h: Math.max(1, Math.min(1920, Math.max(...ys)) - y) };
}

export { mixHex, angleOf, needlePhi };

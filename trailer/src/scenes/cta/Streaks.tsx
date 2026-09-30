/**
 * CONVERGE: light streaks and motes pour in from the frame edges to the logo
 * centre P along slow spirals, accelerating (in2) — echoes of the film:
 * lilac (Ava), violet / electric (the rail, the rings), the caller blue, one
 * ember (Booked). The hook's ring waves come back REVERSED: thin lilac rings
 * contract from beyond the frame into P.
 *
 * Every streak starts just outside the frame edge on its own bearing, so the
 * first heads cross into the picture on the converge downbeat itself.
 *
 * One SVG. A streak's tail is the curve its head travelled over the last
 * few frames, sampled finely along the spiral and stroked with a gradient
 * that fades to nothing — tail length IS speed (motion blur by
 * construction). Glows are radial-gradient discs, not filters.
 */
import React from 'react';
import { Easing, random } from 'remotion';
import { EASE, tween } from '../../lib/motion';
import { C } from '../../theme';

type Streak = {
  a0: number;
  r0: number;
  swirl: number;
  t0: number;
  t1: number;
  color: string;
  width: number;
  head: number;
  kind: 'streak' | 'mote';
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
};

/** distance from P to the frame edge along bearing a */
function edgeDist(P: { x: number; y: number }, w: number, h: number, a: number) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const tx = dx > 1e-6 ? (w - P.x) / dx : dx < -1e-6 ? -P.x / dx : Infinity;
  const ty = dy > 1e-6 ? (h - P.y) / dy : dy < -1e-6 ? -P.y / dy : Infinity;
  return Math.min(tx, ty);
}

export function buildStreaks(from: number, to: number, P: { x: number; y: number }, w: number, h: number): Streak[] {
  const out: Streak[] = [];
  const reach = Math.hypot(w, h) * 0.62;
  const palette = [C.lilac, C.violet, C.electric, C.brandLit, C.lilac, C.callerLit, C.violet, C.lilac];
  const NS = 14;
  for (let i = 0; i < NS; i++) {
    const r = (k: string) => random(`cta-streak-${i}-${k}`);
    const ember = i === 5;
    const a0 = (i / NS) * Math.PI * 2 + (r('a') - 0.5) * 0.35;
    // the first four leave on the downbeat, just outside the edge (visible
    // within 1–3 frames); the rest trail in over the next 10 frames
    const early = i % 4 === 0;
    out.push({
      a0,
      r0: edgeDist(P, w, h, a0) * (early ? 0.97 + r('r') * 0.04 : 1.08 + r('r') * 0.3) + (early ? 0 : 24),
      swirl: 0.55 + r('s') * 0.35,
      t0: from + (early ? 0 : 2 + r('t0') * 10),
      t1: to - 6 + Math.round(r('t1') * 5),
      color: ember ? C.ember : palette[i % palette.length],
      width: ember ? 3 : 1.6 + r('w') * 1.8,
      head: ember ? 4.5 : 2.2 + r('h') * 2,
      kind: 'streak',
    });
  }
  const NM = 24;
  for (let i = 0; i < NM; i++) {
    const r = (k: string) => random(`cta-mote-${i}-${k}`);
    out.push({
      a0: r('a') * Math.PI * 2,
      r0: reach * (0.55 + r('r') * 0.6),
      swirl: 0.4 + r('s') * 0.4,
      t0: from + 4 + r('t0') * 12,
      t1: to - 8 + Math.round(r('t1') * 7),
      color: [C.lilac, C.brandLit, C.paper, C.lilac][i % 4],
      width: 1.2,
      head: 1.2 + r('h') * 1.6,
      kind: 'mote',
    });
  }
  return out;
}

/** progress along the path: moving from the first frame, the pull growing near P (end slope 2.75) */
const PULL = Easing.bezier(0.4, 0.1, 0.8, 0.45);
const uAt = (s: Streak, t: number) => tween(t, [s.t0, s.t1], [0, 1], PULL);
function pos(s: Streak, u: number, P: { x: number; y: number }) {
  const r = s.r0 * (1 - u);
  const a = s.a0 + s.swirl * u * u;
  return { x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r };
}

export const Streaks: React.FC<{
  t: number;
  P: { x: number; y: number };
  streaks: Streak[];
  width: number;
  height: number;
  /** contracting rings: [start, end] frames and the start radius */
  rings: { t0: number; t1: number; r0: number }[];
}> = ({ t, P, streaks, width, height, rings }) => {
  const items: React.ReactNode[] = [];
  const defs: React.ReactNode[] = [];
  const glowIds = new Map<string, string>();
  const glow = (color: string) => {
    if (!glowIds.has(color)) {
      const id = `cta-glow-${glowIds.size}`;
      glowIds.set(color, id);
      defs.push(
        <radialGradient key={id} id={id}>
          <stop offset="0" stopColor={`rgb(${rgb(color)})`} stopOpacity={0.55} />
          <stop offset="0.35" stopColor={`rgb(${rgb(color)})`} stopOpacity={0.22} />
          <stop offset="1" stopColor={`rgb(${rgb(color)})`} stopOpacity={0} />
        </radialGradient>,
      );
    }
    return glowIds.get(color)!;
  };

  /* the ring waves, reversed: they contract into P */
  rings.forEach((g, i) => {
    if (t < g.t0 || t > g.t1) return;
    const u = tween(t, [g.t0, g.t1], [0, 1], EASE.in4);
    const r = g.r0 * (1 - u);
    const o = tween(u, [0, 0.25], [0, 1], EASE.out3) * (1 - tween(u, [0.85, 1], [0, 1], EASE.in2));
    if (r < 2 || o < 0.01) return;
    // motion blur: two trailing copies where the ring was a fraction of a frame ago
    [0.66, 0.33].forEach((back, k) => {
      const rb = g.r0 * (1 - tween(t - back, [g.t0, g.t1], [0, 1], EASE.in4));
      if (rb - r > 1.5) {
        items.push(<circle key={`rg${i}-${k}`} cx={P.x} cy={P.y} r={rb} fill="none" stroke={`rgba(185,163,255,${(0.18 * (k + 1) * o).toFixed(3)})`} strokeWidth={1.5} />);
      }
    });
    items.push(
      <circle key={`rw${i}`} cx={P.x} cy={P.y} r={r} fill="none" stroke={`rgba(124,58,237,${(0.14 * o).toFixed(3)})`} strokeWidth={6} />,
      <circle key={`rl${i}`} cx={P.x} cy={P.y} r={r} fill="none" stroke={`rgba(192,172,224,${(0.8 * o).toFixed(3)})`} strokeWidth={1.5} />,
    );
  });

  streaks.forEach((s, i) => {
    if (t < s.t0 || t > s.t1 + 0.5) return;
    const u = uAt(s, t);
    const head = pos(s, u, P);
    const o = tween(t, [s.t0, s.t0 + 5], [0, 1], EASE.out3) * (1 - tween(u, [0.9, 1], [0, 1], EASE.in2));
    if (o <= 0.01) return;
    // tail = where the head was over the last `trail` frames, sampled smoothly
    const trail = s.kind === 'streak' ? 5 : 3;
    const u0 = uAt(s, t - trail);
    const N = 14;
    const pts: string[] = [];
    for (let k = 0; k <= N; k++) {
      const p = pos(s, u0 + ((u - u0) * k) / N, P);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    const tail = pos(s, u0, P);
    const gid = `cta-g-${i}`;
    defs.push(
      <linearGradient key={gid} id={gid} gradientUnits="userSpaceOnUse" x1={tail.x} y1={tail.y} x2={head.x} y2={head.y}>
        <stop offset="0" stopColor={s.color} stopOpacity={0} />
        <stop offset="0.7" stopColor={s.color} stopOpacity={0.55 * o} />
        <stop offset="1" stopColor={s.color} stopOpacity={o} />
      </linearGradient>,
    );
    const poly = pts.join(' ');
    if (s.kind === 'streak') {
      items.push(
        <polyline key={`gl${i}`} points={poly} fill="none" stroke={`url(#${gid})`} strokeWidth={s.width * 4} strokeOpacity={0.16} strokeLinecap="round" strokeLinejoin="round" />,
        <circle key={`hg${i}`} cx={head.x} cy={head.y} r={s.head * 7} fill={`url(#${glow(s.color)})`} opacity={o} />,
      );
    }
    items.push(
      <polyline key={`st${i}`} points={poly} fill="none" stroke={`url(#${gid})`} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />,
      <circle key={`h${i}`} cx={head.x} cy={head.y} r={s.head} fill={`rgba(${rgb(s.color === C.ember ? C.emberLit : C.paper)},${o.toFixed(3)})`} />,
    );
  });
  if (!items.length) return null;
  return (
    <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <defs>{defs}</defs>
      {items}
    </svg>
  );
};

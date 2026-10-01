/**
 * The type breaks and rebuilds.
 *
 * t < 0   <HookLineStatic> (identical to the hook's line), gathering itself:
 *         scale 1 → 0.975 about its centre, a micro-tremble.
 * t = 0   per-letter shards. "Your business is" and "." blow outward
 *         (velocity-scaled smear), keep drifting and spinning, slower and
 *         slower, and come to rest exactly when they turn round. "closed"
 *         holds, trembles, then slides into the start of the new line — the
 *         c becoming a C mid-move.
 * t ≥ 8   the shards fly back as "Closed is for the door," (glyph swapped
 *         mid-flight while blurred), word by word, letters left to right.
 *         Row-1 letters wait ABOVE the tagline and drop in from above; row-2
 *         letters wait BELOW it and rise in — so nothing ever parks on, or
 *         flies across, a word that has already landed. "door," locks in
 *         left to right with its comma ON the slam. "not the phone." rises
 *         and turns lilac.
 *
 * Where each shard rests is solved once (buildShards): the seeded blast
 * point, moved the least distance that clears the tagline's box, the path
 * "closed" slides along, the frame edge, the phone and its neighbours.
 */
import React from 'react';
import { Easing, random } from 'remotion';
import { noise2D } from '@remotion/noise';
import { HookLineStatic } from '../../components/Shared';
import { Words } from '../../components/Type';
import { HOOK_LINE } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { EASE, mixHex, tween } from '../../lib/motion';
import { C, FONT, TRACK } from '../../theme';
import { TWIST } from '../../timing';
import { TW, twistGeo } from './geometry';
import { LINE_H, type Glyph, type TextLayout } from './measure';

const A0 = 0.975; // the line's scale when it breaks
/** Flight: pulled in hard, then braked into the slot. */
const FLY = Easing.bezier(0.62, 0, 0.14, 1);
const SLIDE = Easing.bezier(0.5, 0, 0.12, 1);
/** A flight reaches its slot at LAND (0.8) of its duration — braked, not
 *  creeping — and the landing recoil takes over from there. */
const LAND = 0.8;
/** Across-the-row part of a flight finishes first, so every letter ends on
 *  a vertical drop into its slot and never sweeps over a neighbour… */
const X_LEAD = 0.5;
/** …and it is upright and at type size even earlier, before it enters its
 *  lane (a tilted, oversized glyph would clip the letters beside it). */
const RS_LEAD = 0.45;
/** Glyph swap (source → target letter), mid-flight, while fastest. */
const SWAP = 0.25;
/** Share of the blast travelled by t = shatterOut; the rest is the drift. */
const BLAST = 0.8;

type Kind = 'closed' | 'fly' | 'extra';
export type Shard = {
  src: Glyph;
  dst: Glyph | null;
  kind: Kind;
  /** flight start (= the moment it stops drifting and turns round) */
  start: number;
  dur: number;
  swap: number;
  /** break position → resting point */
  vx: number;
  vy: number;
  rot: number;
  /** extra slow spin while it drifts (deg, reached at `start`) */
  spin: number;
  sOut: number;
  seed: string;
};

/** The whole-line gather before the break (t in [-8, 0]). */
export function gather(t: number) {
  const u = Math.min(1, Math.max(0, (t - TW.gather) / -TW.gather));
  const a = 1 - (1 - A0) * EASE.in2(u);
  const amp = 1.8 * u * u;
  return {
    a,
    x: amp * noise2D('gather-x', t * 0.9, 0.1),
    y: amp * noise2D('gather-y', 0.4, t * 0.9),
  };
}

/** Landing recoil: 0 at impact, a forward lobe, back, settled in ~12 f. */
const recoil = (tau: number) => (tau <= 0 ? 0 : Math.sin((Math.PI * tau) / 5.5) * Math.exp(-tau / 4.2));

/** Where a hook glyph is at the break (gathered, t = 0). */
function breakPos(g: Glyph, L: Layout) {
  const H = HOOK_LINE(L);
  const hcx = H.left + H.width / 2;
  const g0 = gather(0);
  return { x: hcx + (g.cx - hcx) * g0.a + g0.x, y: H.cy + (g.cy - H.cy) * g0.a + g0.y };
}

type Rect = { x0: number; y0: number; x1: number; y1: number };
/** How far (px) a point sits inside a rect grown by `m` (0 = outside). */
const inside = (r: Rect, x: number, y: number, m: number) =>
  Math.max(0, Math.min(x - (r.x0 - m), r.x1 + m - x, y - (r.y0 - m), r.y1 + m - y));

export function buildShards(hook: TextLayout, tag: TextLayout, L: Layout): Shard[] {
  const H = HOOK_LINE(L);
  const G = twistGeo(L);
  const byWord = (lay: TextLayout, w: number) => lay.glyphs.filter((g) => g.word === w);
  const hw = [0, 1, 2, 3].map((w) => byWord(hook, w)); // Your | business | is | closed.
  const tw = [0, 1, 2, 3, 4].map((w) => byWord(tag, w)); // Closed | is | for | the | door,
  const closedG = hw[3];
  const E = { x: H.left + H.width / 2, y: H.cy + H.fontSize * 0.3 }; // the blast
  const size0 = hook.fontSize * gather(0).a;

  /* ── keep-outs ─────────────────────────────────────────────────── */
  const rowG = tag.glyphs.filter((g) => g.line < 2);
  const tagBox: Rect = {
    x0: Math.min(...rowG.map((g) => g.x)),
    x1: Math.max(...rowG.map((g) => g.x + g.adv)),
    y0: tag.lines[0].top,
    y1: tag.lines[1].top + tag.lineH,
  };
  // the swept path of "closed" → "Closed" (its box at six points of the slide)
  const cSrc = closedG.slice(0, 6).map((g) => breakPos(g, L));
  const cBox0: Rect = {
    x0: cSrc[0].x - size0 * 0.3,
    x1: cSrc[5].x + size0 * 0.3,
    y0: cSrc[0].y - size0 * 0.42,
    y1: cSrc[0].y + size0 * 0.42,
  };
  const cBox1: Rect = {
    x0: tw[0][0].x,
    x1: tw[0][5].x + tw[0][5].adv,
    y0: tw[0][0].cy - tag.fontSize * 0.42,
    y1: tw[0][0].cy + tag.fontSize * 0.42,
  };
  const sweep: Rect[] = [0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => ({
    x0: cBox0.x0 + (cBox1.x0 - cBox0.x0) * p,
    x1: cBox0.x1 + (cBox1.x1 - cBox0.x1) * p,
    y0: cBox0.y0 + (cBox1.y0 - cBox0.y0) * p,
    y1: cBox0.y1 + (cBox1.y1 - cBox0.y1) * p,
  }));
  // the lanes the letters drop / rise through into each row: nothing rests there
  const lane = (li: number, dir: -1 | 1, hgt: number): Rect => {
    const gl = tag.glyphs.filter((g) => g.line === li);
    const top = tag.lines[li].top;
    return {
      x0: Math.min(...gl.map((g) => g.x)),
      x1: Math.max(...gl.map((g) => g.x + g.adv)),
      y0: dir < 0 ? top - hgt : top + tag.lineH,
      y1: dir < 0 ? top : top + tag.lineH + hgt,
    };
  };
  const lanes = [lane(0, -1, L.pick(170, 190)), lane(1, 1, L.pick(200, 220))];
  const phoneBox: Rect = {
    x0: G.phone.cx - G.phone.w / 2,
    x1: G.phone.cx + G.phone.w / 2,
    y0: G.phone.cy - G.phone.h / 2,
    y1: G.phone.cy + G.phone.h / 2,
  };
  const edge = L.pick({ x: 60, y: 44 }, { x: 44, y: 120 });

  /* ── pieces + their seeded blast ───────────────────────────────── */
  type Piece = {
    src: Glyph;
    kind: Kind;
    /** 0 = the tagline's first row (rests above it), 1 = second (below), -1 free */
    row: -1 | 0 | 1;
    word: number;
    x0: number;
    y0: number;
    raw: { x: number; y: number };
    ax: number;
    ay: number;
    size: number;
    rot: number;
    spin: number;
    sOut: number;
    seed: string;
  };
  const pieces: Piece[] = [];
  const add = (src: Glyph, kind: Kind, word: number) => {
    const n = pieces.length;
    const seed = `tw-shard-${n}`;
    const r = (k: string) => random(`${seed}-${k}`);
    const p0 = breakPos(src, L);
    // radial from the blast, mixed with a golden-angle spread so the
    // pieces fill the frame instead of all leaving one way
    let dx = src.cx - E.x;
    let dy = src.cy - E.y;
    const len = Math.hypot(dx, dy) || 1;
    const ga = n * 2.39996 + r('a') * 0.9;
    dx = (dx / len) * 0.75 + Math.cos(ga);
    dy = (dy / len) * 0.75 + Math.sin(ga) - 0.25;
    const l2 = Math.hypot(dx, dy) || 1;
    const dist = (L.pick(430, 330) + r('d') * L.pick(520, 360) + (kind === 'extra' ? 260 : 0)) * 1.1;
    const sOut = 0.55 + r('s') * 1.45;
    let rot = (r('r') - 0.5) * 2 * (90 + r('rr') * 200);
    const spin = (r('sp') < 0.5 ? -1 : 1) * (25 + r('sp2') * 45);
    // an "i" resting upside down reads as "!" — tip it past the flip
    if (src.ch === 'i') {
      const rest = ((((rot + spin) % 360) + 540) % 360) - 180;
      if (Math.abs(rest) > 125) rot -= Math.sign(rest) * 80;
    }
    pieces.push({
      src,
      kind,
      row: -1,
      word,
      x0: p0.x,
      y0: p0.y,
      // 16:9 throws wide, 9:16 throws tall — both keep the pieces in frame
      raw: { x: p0.x + (dx / l2) * dist * L.pick(1, 0.62), y: p0.y + (dy / l2) * dist * L.pick(0.7, 1.45) },
      ax: 0,
      ay: 0,
      size: size0 * sOut,
      rot,
      spin,
      sOut,
      seed,
    });
  };
  closedG.slice(0, 6).forEach((g) => add(g, 'closed', 0));
  hw[2].forEach((g) => add(g, 'fly', 1));
  const pool = [...hw[0], ...hw[1]];
  const extras = new Set([0, 4]); // Y, b — they burn out as dust
  pool.forEach((g, i) => add(g, extras.has(i) ? 'extra' : 'fly', -1));
  add(closedG[6], 'fly', 4); // "." → "," (the sentence goes on)

  // rows: "is" + the three pool pieces thrown highest go to row 1 ("for"),
  // the other seven + "." go to row 2 ("the door,")
  const free = pieces.filter((p) => p.kind === 'fly' && p.word === -1);
  const byHeight = [...free].sort((a, b) => a.raw.y - b.raw.y);
  byHeight.forEach((p, i) => (p.word = i < 3 ? 2 : 3));
  for (const p of pieces) if (p.kind === 'fly') p.row = p.word <= 2 ? 0 : 1;

  /* ── rest points: the least move that clears every keep-out ─────── */
  const placed: Piece[] = [];
  const STEP = 18;
  for (const p of pieces) {
    if (p.kind === 'closed') continue;
    const half = p.size * 0.4;
    let best = { x: p.raw.x, y: p.raw.y, c: Infinity };
    for (let y = 0; y <= L.height; y += STEP) {
      for (let x = 0; x <= L.width; x += STEP) {
        let c = Math.hypot(x - p.raw.x, y - p.raw.y);
        // hard: the tagline (+40), the "closed" slide (+90), the landing
        // lanes above row 1 / below row 2, the frame edge
        let hard = inside(tagBox, x, y, 40 + half);
        for (const r of sweep) hard += inside(r, x, y, 90 + half);
        for (const r of lanes) hard += inside(r, x, y, 16 + half);
        hard += Math.max(0, edge.x + half - x) + Math.max(0, x - (L.width - edge.x - half));
        hard += Math.max(0, edge.y + half - y) + Math.max(0, y - (L.height - edge.y - half));
        if (p.row === 0) hard += Math.max(0, y - (tagBox.y0 - 40 - half));
        if (p.row === 1) hard += Math.max(0, tagBox.y1 + 40 + half - y);
        c += hard * 1e4;
        // soft: not on the phone, not on a neighbour
        c += Math.min(1, inside(phoneBox, x, y, 44 + half) / 20) * 900;
        for (const q of placed) {
          const d = Math.hypot(x - q.ax, y - q.ay);
          const need = (half + q.size * 0.4) * 1.3 + 60;
          if (d < need) c += (need - d) * 9;
        }
        if (c < best.c) best = { x, y, c };
      }
    }
    p.ax = best.x;
    p.ay = best.y;
    placed.push(p);
  }

  /* ── targets: left to right within each word, by where they rest ── */
  const flyers = pieces.filter((p) => p.kind === 'fly');
  const row2 = flyers.filter((p) => p.word >= 3).sort((a, b) => a.ax - b.ax);
  row2.forEach((p, i) => (p.word = i < 3 ? 3 : 4));
  const dstOf = new Map<Piece, { g: Glyph; land: number }>();
  for (const w of [1, 2, 3, 4]) {
    const grp = flyers.filter((p) => p.word === w).sort((a, b) => a.ax - b.ax);
    grp.forEach((p, j) => {
      const land = w === 4 ? TWIST.doorSlam - (grp.length - 1 - j) * TW.doorGap : TW.wordLand[w - 1] + j * TW.letterGap;
      dstOf.set(p, { g: tw[w][j], land });
    });
  }

  return pieces.map((p, j) => {
    const base = { src: p.src, vx: p.ax - p.x0, vy: p.ay - p.y0, rot: p.rot, spin: p.spin, sOut: p.sOut, seed: p.seed };
    if (p.kind === 'closed') {
      const start = TW.closedSlide + j * 0.35;
      return { ...base, dst: tw[0][j], kind: p.kind, start, dur: 11, swap: start + 11 * 0.35, vx: 0, vy: 0 };
    }
    if (p.kind === 'extra') return { ...base, dst: null, kind: p.kind, start: 1e9, dur: 10, swap: 1e9 };
    const d = dstOf.get(p)!;
    const dist = Math.hypot(d.g.cx - p.ax, d.g.cy - p.ay);
    let dur = Math.min(12, 9 + dist / 300);
    if (d.land - 0.8 * dur < TW.turnMin) dur = Math.max(7, (d.land - TW.turnMin) / 0.8);
    const start = d.land - 0.8 * dur;
    return { ...base, dst: d.g, kind: p.kind, start, dur, swap: start + dur * SWAP };
  });
}

type State = { x: number; y: number; rot: number; size: number; useDst: boolean; op: number; dof: number };

function shardState(sh: Shard, t: number, hook: TextLayout, tag: TextLayout, L: Layout): State {
  const p0 = breakPos(sh.src, L);
  const x0 = p0.x;
  const y0 = p0.y;
  const size0 = hook.fontSize * gather(0).a;
  const dst = sh.dst;
  const tx = dst ? dst.cx : x0;
  const ty = dst ? dst.cy : y0;
  const fly = Math.min(1, Math.max(0, (t - sh.start) / sh.dur));
  const tau = t - (sh.start + sh.dur * 0.8);

  if (sh.kind === 'closed') {
    // hold + tremble, a small recoil toward camera as the rest is blown away
    const amp = 2.2 * (1 - tween(t, [sh.start, sh.start + 4], [0, 1], EASE.out3));
    const trx = amp * noise2D(`${sh.seed}-tx`, t * 0.8, 0);
    const tr = amp * noise2D(`${sh.seed}-ty`, 0, t * 0.8);
    const rec = t > 0 ? 0.045 * (t / 2) * Math.exp(1 - t / 2) : 0;
    const p = SLIDE(fly);
    const dl = Math.hypot(tx - x0, ty - y0) || 1;
    const over = 9 * recoil(tau);
    const sx = x0 + trx;
    const sy = y0 + tr;
    // lean into the move (follow-through), straighten on landing
    const lean = Math.sin(Math.PI * Math.min(1, fly * 1.15)) * -7 * Math.sign(tx - x0);
    return {
      x: sx + (tx - sx) * p + ((tx - x0) / dl) * over,
      y: sy + (ty - sy) * p + ((ty - y0) / dl) * over,
      rot: 0.9 * amp * noise2D(`${sh.seed}-tr`, t * 0.7, 3) + lean + 2.5 * recoil(tau - 1),
      size: (size0 * (1 + rec) + (tag.fontSize - size0 * (1 + rec)) * p) * (1 + 0.05 * recoil(tau)),
      useDst: t >= sh.swap,
      op: 1,
      dof: 0,
    };
  }

  // out: the blast (first frame already ~30 % out — the impact) …
  const u = Math.min(1, Math.max(0, (t + 1) / (TWIST.shatterOut + 1)));
  const q = 1 - Math.pow(1 - u, 3.2);

  if (sh.kind === 'extra') {
    // keeps going, shrinks, burns out into a mote
    const drift = 0.1 * tween(t, [TWIST.shatterOut, TWIST.shatterOut + 22], [0, 1], EASE.out3);
    const burn = tween(t, [4, 26], [0, 1], EASE.in2);
    const k = BLAST * q + drift;
    return {
      x: x0 + sh.vx * (k + 0.55 * burn),
      y: y0 + sh.vy * (k + 0.55 * burn) - 40 * burn,
      rot: sh.rot * (q + drift * 0.8 + 0.4 * burn),
      size: size0 * (1 + (sh.sOut - 1) * q) * (1 - 0.8 * burn),
      useDst: false,
      op: 1 - tween(t, [8, 26], [0, 1], EASE.inOut),
      dof: 2 + 6 * burn + Math.abs(sh.sOut - 1) * 3,
    };
  }

  // … then a drift that keeps going, slower and slower, and stops dead
  // exactly when the shard turns round (sine-out: no velocity at `start`)
  const D = Math.sin((Math.PI / 2) * Math.min(1, Math.max(0, t / sh.start)));
  const k = BLAST * q + (1 - BLAST) * D;
  const ox = x0 + sh.vx * k;
  const oy = y0 + sh.vy * k;
  const rotOut = sh.rot * (0.85 * q + 0.15 * D) + sh.spin * D;
  const size = size0 * (1 + (sh.sOut - 1) * q);

  const ex = FLY(Math.min(1, fly / X_LEAD));
  const ey = FLY(Math.min(1, fly / LAND));
  const rs = FLY(Math.min(1, fly / RS_LEAD));
  const dx = tx - ox;
  const dy = ty - oy;
  const over = Math.min(12, 4 + Math.abs(dy) * 0.012) * recoil(tau);
  const depth = size / size0; // ≠1: off the text plane, softer (resolves with the size)
  // resting shards sit a touch out of focus (they are not type yet)
  const rest = 1.4 * tween(t, [3, 9], [0, 1], EASE.inOut) * (1 - ey);
  return {
    x: ox + dx * ex,
    y: oy + dy * ey + Math.sign(dy || 1) * over,
    // upright and at type size by the time it drops into the row
    rot: rotOut * (1 - rs) + 3 * recoil(tau - 0.5) * Math.sign(dx || 1),
    size: (size + (tag.fontSize - size) * rs) * (1 + 0.06 * recoil(tau)),
    useDst: t >= sh.swap,
    op: 1,
    dof: Math.abs(depth - 1) * 3.2 * (1 - rs) + rest,
  };
}

/** a soft, slanted band of light at p (0 → 1 crosses the line) */
const glintMask = (p: number) => {
  const c = -25 + p * 150; // % across the box
  return `linear-gradient(105deg, rgba(0,0,0,0) ${(c - 16).toFixed(1)}%, rgba(0,0,0,1) ${c.toFixed(1)}%, rgba(0,0,0,0) ${(c + 16).toFixed(1)}%)`;
};

const glyphStyle = (fontSize: number): React.CSSProperties => ({
  position: 'absolute',
  fontFamily: FONT.display,
  fontWeight: 500,
  fontSize,
  lineHeight: `${LINE_H * fontSize}px`,
  letterSpacing: TRACK.display,
  whiteSpace: 'pre',
  color: C.paper,
  transformOrigin: '50% 50%',
});

const SHUTTER = 0.6;

/** The focus beat of the hold (TWIST_LOCAL.keyFocus / keyGlint). */
export type Focus = {
  /** opacity of the landed "Closed is for the door," (1 → .45) */
  dim: number;
  /** 0..1 "not the phone." brightens: lilac → mix(lilac, paper, .2) */
  key: number;
  /** its scale about its centre (1 → 1.03, anticipation + spring) */
  swell: number;
  /** 0..1 a glint crossing it left → right (−1: none) */
  glint: number;
};
const NO_FOCUS: Focus = { dim: 1, key: 0, swell: 1, glint: -1 };
const KEY_LIT = mixHex(C.lilac, C.paper, 0.2);

export const Shards: React.FC<{
  t: number;
  L: Layout;
  hook: TextLayout;
  tag: TextLayout;
  shards: Shard[];
  /** when true, draw a light single-sample version (ghost copies) */
  ghost?: boolean;
  /** extra blur on every glyph (the dive) */
  extraBlur?: number;
  /** one blur over the whole layer (ghost copies: one filter pass instead of
   *  one per glyph, which is what keeps the dive affordable) */
  layerBlur?: number;
  focus?: Focus;
}> = ({ t, L, hook, tag, shards, ghost = false, extraBlur = 0, layerBlur = 0, focus = NO_FOCUS }) => {
  if (t < 0) {
    const g = gather(t);
    return (
      <HookLineStatic
        style={{
          transform: `translate(${g.x.toFixed(3)}px, ${g.y.toFixed(3)}px) translateY(-50%) scale(${g.a.toFixed(5)})`,
        }}
      />
    );
  }

  const line3 = tag.lines[2];
  return (
    <div style={{ position: 'absolute', inset: 0, filter: layerBlur > 0.15 ? `blur(${layerBlur.toFixed(2)}px)` : undefined }}>
      {shards.map((sh, i) => {
        const st = shardState(sh, t, hook, tag, L);
        if (st.op < 0.01) return null;
        const pv = shardState(sh, t - 0.5, hook, tag, L);
        const vx = (st.x - pv.x) * 2;
        const vy = (st.y - pv.y) * 2;
        const speed = Math.hypot(vx, vy); // px / frame
        // enough sub-frame samples that neighbours overlap into one smear
        // (≈ one per 14 px of trail), each softer and fainter down the trail
        const trail = speed * SHUTTER;
        const n = ghost || speed < 4 ? 1 : Math.min(7, Math.max(2, Math.ceil(trail / 11) + 1));
        const phi = (Math.atan2(vy, vx) * 180) / Math.PI;
        const samples = Array.from({ length: n }, (_, k) =>
          k === 0 ? st : shardState(sh, t - (k * SHUTTER) / (n - 1), hook, tag, L),
        );
        return (
          <React.Fragment key={i}>
            {samples
              .map((s, k) => {
                const g = s.useDst && sh.dst ? sh.dst : sh.src;
                const fs = s.useDst && sh.dst ? tag.fontSize : hook.fontSize;
                const lh = LINE_H * fs;
                const sc = s.size / fs;
                // directional smear: stretch along the velocity, blur ∝ speed
                const stretch = 1 + Math.min(1.6, speed / 150);
                const kk = n > 1 ? k / (n - 1) : 0;
                // trailing samples blur by about their own spacing, so they
                // melt into one streak instead of reading as echoes
                const blur = s.dof + extraBlur + Math.min(7, speed * 0.035) + kk * Math.min(10, trail * 0.5);
                const op =
                  s.op *
                  (sh.dst ? focus.dim : 1) *
                  (n === 1 ? 1 : k === 0 ? 0.92 : (0.9 * (1 - k / n)) / (1 + 0.35 * (n - 1)));
                const xf =
                  speed > 4
                    ? `rotate(${phi.toFixed(2)}deg) scaleX(${stretch.toFixed(3)}) rotate(${(-phi).toFixed(2)}deg) rotate(${s.rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`
                    : `rotate(${s.rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
                return (
                  <span
                    key={k}
                    style={{
                      ...glyphStyle(fs),
                      left: s.x - g.adv / 2,
                      top: s.y - lh / 2,
                      width: g.adv,
                      opacity: op,
                      transform: xf,
                      filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
                    }}
                  >
                    {g.ch}
                  </span>
                );
              })
              .reverse()}
          </React.Fragment>
        );
      })}
      {t >= TWIST.line2 - 6 ? (
        <div
          style={{
            position: 'absolute',
            left: line3.left,
            top: line3.top,
            width: line3.width + 40,
            filter: extraBlur > 0.15 ? `blur(${extraBlur.toFixed(2)}px)` : undefined,
            transform: focus.swell !== 1 ? `scale(${focus.swell.toFixed(5)})` : undefined,
            transformOrigin: `${(line3.width / 2).toFixed(1)}px ${(tag.lineH / 2).toFixed(1)}px`,
          }}
        >
          {/* its light: a soft lilac bloom of the words behind them as they take focus */}
          {focus.key > 0.01 && !ghost ? (
            <div style={{ position: 'absolute', inset: 0, filter: `blur(${(0.16 * tag.fontSize).toFixed(1)}px)`, opacity: 0.55 * focus.key }}>
              <Words text="not the phone." start={TWIST.line2} stagger={3} frame={t} align="left" color={C.lilac} style={{ fontSize: tag.fontSize, whiteSpace: 'nowrap' }} />
            </div>
          ) : null}
          <Words
            text="not the phone."
            start={TWIST.line2}
            stagger={3}
            frame={t}
            align="left"
            keys={[{ text: 'not the phone.', color: C.lilac, at: TWIST.keyColor }]}
            style={{ fontSize: tag.fontSize, whiteSpace: 'nowrap' }}
            wordStyle={
              focus.key > 0.001
                ? () => ({ color: mixHex(C.lilac, KEY_LIT, focus.key) })
                : undefined
            }
          />
          {/* the glint: the same words in white light, seen through a moving band */}
          {focus.glint >= 0 && focus.glint <= 1 && !ghost ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                mixBlendMode: 'screen',
                WebkitMaskImage: glintMask(focus.glint),
                maskImage: glintMask(focus.glint),
                opacity: 0.9 * Math.sin(Math.PI * Math.min(1, focus.glint * 1.15)),
              }}
            >
              <Words
                text="not the phone."
                start={TWIST.line2}
                stagger={3}
                frame={t}
                align="left"
                color="#ffffff"
                style={{ fontSize: tag.fontSize, whiteSpace: 'nowrap' }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

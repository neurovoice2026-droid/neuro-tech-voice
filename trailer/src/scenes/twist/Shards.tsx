/**
 * The type breaks and rebuilds — crisp, every frame (no blur, no smear, no
 * ghost samples: the master renders at 120 fps and every curve is continuous).
 *
 * t < 0   <HookLineStatic> (identical to the hook's line) inhales: scale
 *         1 → 0.975 about its centre (a smooth gather, no tremble).
 * t = 0   per-letter shards (TYPE.display, Instrument Sans 440 −0.03em).
 *         "Your business is" and "." blow outward — continuous from rest, but
 *         explosive (12 % of the blast in the first 120 fps frame) — drift,
 *         slower and slower, and come to rest exactly when they turn round.
 *         Each piece is thrown to its own DEPTH (0.6–1.3×; the far ones dim
 *         as they leave the doorway's light, and paint behind the near ones),
 *         with a calm tilt (≤ ±38°): where two throws cross they pass one in
 *         front of the other. No piece comes to rest on the lit doorway or
 *         its leaf, on the phone, or touching a neighbour. The two letters
 *         the new line does not need recede into the dark (gone by t 15).
 *         "closed" holds, then slides into the start of the new line; the
 *         hook's lilac leaves it on the way (the accent moves to "not the
 *         phone.").
 * t ≥ 8   the shards fly back as "Closed is for the door," word by word,
 *         letters left to right. Each letter turns over in flight like a
 *         card (rotateY): it shows its old glyph until it is edge-on, its new
 *         one after — the swap is never seen. Row-1 letters wait ABOVE the
 *         tagline and drop in; row-2 letters wait BELOW it and rise in.
 *         "door," locks left to right with its comma ON the slam. "not the
 *         phone." rises out of its masks and takes the night's lilac — the
 *         two-tone of the knowledge heading (one accent; no sheen drawn
 *         across the type: on the focus beat its ink itself lifts).
 *
 * While a letter moves it sits on its own compositor layer (subpixel()), so
 * its settle is a smooth exponential, not 1 px stairs; at rest it is plain,
 * pixel-crisp text.
 */
import React from 'react';
import { Easing, random } from 'remotion';
import { HookLineStatic } from '../../components/Shared';
import { subpixel, Words } from '../../components/Type';
import { HOOK_LINE } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { EASE, mixHex, tween } from '../../lib/motion';
import { C, TYPE } from '../../theme';
import { TWIST } from '../../timing';
import { TW, twistGeo } from './geometry';
import { DISPLAY_WEIGHT, LINE_H, type Glyph, type TextLayout } from './measure';

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
/** The card turn (source → target glyph): over this share of the flight, edge-on at its middle. */
const TURN: readonly [number, number] = [0.04, 0.42];
/** Share of the blast travelled by t = shatterOut; the rest is the drift. */
const BLAST = 0.8;
/** the turn's perspective (px): a letter is a thin card in the room */
const CARD_P = 900;

type Kind = 'closed' | 'fly' | 'extra';
export type Shard = {
  src: Glyph;
  dst: Glyph | null;
  kind: Kind;
  /** flight start (= the moment it stops drifting and turns round) */
  start: number;
  dur: number;
  /** the glyph change (the card is edge-on) */
  swap: number;
  /** break position → resting point */
  vx: number;
  vy: number;
  rot: number;
  /** extra slow spin while it drifts (deg, reached at `start`) */
  spin: number;
  sOut: number;
  seed: string;
  /** turns over (card flip) to change glyph */
  turns: boolean;
  /** starts in the hook's key ink ("closed.") */
  keyed: boolean;
};

/** The whole-line gather before the break (t in [-8, 0]): an inhale, no tremble. */
export function gather(t: number) {
  const u = Math.min(1, Math.max(0, (t - TW.gather) / -TW.gather));
  return { a: 1 - (1 - A0) * EASE.in2(u), x: 0, y: 0 };
}

/** How much of the light a piece keeps at its depth (sOut 0.6 far … 1.3 near): the far ones dim to 62 %. */
const depthInk = (sOut: number) => 0.62 + 0.38 * Math.min(1, Math.max(0, (sOut - 0.6) / 0.5));

/** Paint order: the far pieces first, so a nearer one passes IN FRONT ("closed" sits at the line's own depth). */
const orderCache = new WeakMap<Shard[], number[]>();
function depthOrder(shards: Shard[]): number[] {
  let o = orderCache.get(shards);
  if (!o) {
    const z = (sh: Shard) => (sh.kind === 'closed' ? 1 : sh.sOut);
    o = shards.map((_, i) => i).sort((a, b) => z(shards[a]) - z(shards[b]) || a - b);
    orderCache.set(shards, o);
  }
  return o;
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
  // the lit doorway AND the leaf standing open toward the camera (its free edge projects ≈ 0.48 w left of
  // the hinge in 16:9, ≈ 0.1 w in 9:16): paper on the near-white opening would vanish, on the leaf it clutters
  const doorBox: Rect = {
    x0: G.door.cx - G.door.w / 2 - G.door.w * L.pick(0.5, 0.12),
    x1: G.door.cx + G.door.w / 2,
    y0: G.door.top,
    y1: G.door.top + G.door.h,
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
    // a measured break, not confetti: moderate throws, a calm tilt (≤ ±38°) and a slow spin while it
    // drifts — objects in the dark, not tumbling debris. DEPTH: each piece is thrown nearer or further
    // (0.6–1.3× its size; the far ones also leave the light, see depthInk) — so where two throws
    // cross they pass one in front of the other, as things do in a room, never through each other
    const dist = L.pick(330, 260) + r('d') * L.pick(420, 300) + (kind === 'extra' ? 220 : 0);
    const sOut = 0.6 + r('s') * 0.7;
    let rot = (r('r') - 0.5) * 2 * (8 + r('rr') * 30);
    const spin = (r('sp') < 0.5 ? -1 : 1) * (3 + r('sp2') * 7);
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
  const extras = new Set([0, 4]); // two letters too many: they recede into the dark (the untangle may deal the role on)
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
        // never ON the phone: it is found in the dark right where they rest (phoneReveal);
        // never on the doorway or its open leaf; never touching a neighbour
        hard += inside(phoneBox, x, y, half);
        hard += inside(doorBox, x, y, 44 + half);
        for (const q of placed) {
          const d = Math.hypot(x - q.ax, y - q.ay);
          const touch = (half + q.size * 0.4) * 1.25 + 22;
          if (d < touch) hard += touch - d;
        }
        c += hard * 1e4;
        // soft: clear of the phone's rim and the doorway's surround, with air between neighbours
        c += Math.min(1, inside(phoneBox, x, y, 44 + half) / 20) * 900;
        c += Math.min(1, inside(doorBox, x, y, 80 + half) / 26) * 500;
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

  const hookKey = hook.glyphs.filter((g) => g.word === 3); // "closed." — the hook's key word, in its ink
  return pieces.map((p, j) => {
    const base = {
      src: p.src,
      vx: p.ax - p.x0,
      vy: p.ay - p.y0,
      rot: p.rot,
      spin: p.spin,
      sOut: p.sOut,
      seed: p.seed,
      keyed: hookKey.includes(p.src),
    };
    if (p.kind === 'closed') {
      const start = TW.closedSlide + j * 0.35;
      const dst = tw[0][j];
      // only "c" → "C" has to change: it turns over as it slides
      return { ...base, dst, kind: p.kind, start, dur: 11, swap: start + 11 * 0.35, vx: 0, vy: 0, turns: dst.ch !== p.src.ch };
    }
    if (p.kind === 'extra') return { ...base, dst: null, kind: p.kind, start: 1e9, dur: 10, swap: 1e9, turns: false };
    const d = dstOf.get(p)!;
    const dist = Math.hypot(d.g.cx - p.ax, d.g.cy - p.ay);
    let dur = Math.min(12, 9 + dist / 300);
    if (d.land - 0.8 * dur < TW.turnMin) dur = Math.max(7, (d.land - TW.turnMin) / 0.8);
    const start = d.land - 0.8 * dur;
    const turns = d.g.ch !== p.src.ch;
    return { ...base, dst: d.g, kind: p.kind, start, dur, swap: start + dur * (TURN[0] + TURN[1]) / 2, turns };
  });
}

type State = {
  x: number;
  y: number;
  /** in-plane rotation (deg) */
  rot: number;
  /** the card turn (deg, rotateY): 0 → 180 over TURN; the glyph changes edge-on */
  turn: number;
  size: number;
  useDst: boolean;
  op: number;
  /** 0 = the hook's key ink, 1 = paper */
  ink: number;
  /** still moving (on a compositor layer, sub-pixel) */
  moving: boolean;
};

/** the card turn at flight progress `fly` (deg) */
const turnAt = (fly: number) => 180 * EASE.inOut(Math.min(1, Math.max(0, (fly - TURN[0]) / (TURN[1] - TURN[0]))));

function shardState(sh: Shard, t: number, hook: TextLayout, tag: TextLayout, L: Layout): State {
  const p0 = breakPos(sh.src, L);
  const x0 = p0.x;
  const y0 = p0.y;
  const size0 = hook.fontSize * gather(0).a;
  const dst = sh.dst;
  const tx = dst ? dst.cx : x0;
  const ty = dst ? dst.cy : y0;
  const fly = Math.min(1, Math.max(0, (t - sh.start) / sh.dur));
  const tau = t - (sh.start + sh.dur * LAND);
  const ink = sh.keyed ? tween(fly, [0.12, 0.75], [0, 1], EASE.inOut) : 1;

  if (sh.kind === 'closed') {
    // holds while the rest is blown away (a small recoil toward the camera), then slides
    const rec = t > 0 ? 0.03 * (t / 2) * Math.exp(1 - t / 2) : 0;
    const p = SLIDE(fly);
    const dl = Math.hypot(tx - x0, ty - y0) || 1;
    const over = 9 * recoil(tau);
    // lean into the move (follow-through), straighten on landing
    const lean = Math.sin(Math.PI * Math.min(1, fly * 1.15)) * -6 * Math.sign(tx - x0);
    const turn = sh.turns ? turnAt(fly) : 0;
    return {
      x: x0 + (tx - x0) * p + ((tx - x0) / dl) * over,
      y: y0 + (ty - y0) * p + ((ty - y0) / dl) * over,
      rot: lean + 2.5 * recoil(tau - 1),
      turn,
      size: (size0 * (1 + rec) + (tag.fontSize - size0 * (1 + rec)) * p) * (1 + 0.04 * recoil(tau)),
      useDst: sh.turns ? turn >= 90 : t >= sh.swap,
      op: 1,
      ink,
      moving: tau < 16,
    };
  }

  // out: the blast — continuous from rest, explosive (12 % in the first 120 fps frame) …
  const u = Math.min(1, Math.max(0, t / TWIST.shatterOut));
  const q = 1 - Math.pow(1 - u, 4.5);

  if (sh.kind === 'extra') {
    // it has no place in the new line: it travels to its rest point like the others (the same blast
    // and drift), recedes into the dark on the way (to 70 % of its size) and is gone by t 15 —
    // before the first word of the tagline lands
    const D = Math.sin((Math.PI / 2) * Math.min(1, Math.max(0, t / 14)));
    const k = BLAST * q + (1 - BLAST) * D;
    const away = tween(t, [3, 15], [0, 1], EASE.inOut);
    return {
      x: x0 + sh.vx * k,
      y: y0 + sh.vy * k,
      rot: sh.rot * (0.85 * q + 0.15 * D) + sh.spin * D,
      turn: 0,
      size: size0 * (1 + (sh.sOut - 1) * q) * (1 - 0.3 * away),
      useDst: false,
      op: (1 + (depthInk(sh.sOut) - 1) * q) * (1 - away),
      ink,
      moving: true,
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
  // further away = further from the doorway's light (eased in with the throw, out with the return)
  const depthOp = 1 + (depthInk(sh.sOut) - 1) * q * (1 - FLY(Math.min(1, fly / RS_LEAD)));

  const ex = FLY(Math.min(1, fly / X_LEAD));
  const ey = FLY(Math.min(1, fly / LAND));
  const rs = FLY(Math.min(1, fly / RS_LEAD));
  const dx = tx - ox;
  const dy = ty - oy;
  const over = Math.min(10, 4 + Math.abs(dy) * 0.01) * recoil(tau);
  const turn = sh.turns ? turnAt(fly) : 0;
  return {
    x: ox + dx * ex,
    y: oy + dy * ey + Math.sign(dy || 1) * over,
    // upright and at type size by the time it drops into the row
    rot: rotOut * (1 - rs) + 2.5 * recoil(tau - 0.5) * Math.sign(dx || 1),
    turn,
    size: (size + (tag.fontSize - size) * rs) * (1 + 0.05 * recoil(tau)),
    useDst: sh.turns ? turn >= 90 : t >= sh.swap,
    op: depthOp,
    ink,
    moving: tau < 16,
  };
}

/** The glyph setting: TYPE.display on the night (exactly what <Words> sets, so the rows read as one line). */
const glyphStyle = (fontSize: number): React.CSSProperties => ({
  position: 'absolute',
  left: 0,
  top: 0,
  fontFamily: TYPE.display.family,
  fontWeight: DISPLAY_WEIGHT,
  fontSize,
  lineHeight: `${LINE_H * fontSize}px`,
  letterSpacing: TYPE.display.tracking,
  fontKerning: 'normal',
  whiteSpace: 'pre',
  transformOrigin: '50% 50%',
  backfaceVisibility: 'hidden',
});

/** The focus beat of the hold (TWIST_LOCAL.keyFocus / keyGlint). */
export type Focus = {
  /** opacity of the landed "Closed is for the door," (1 → .5) */
  dim: number;
  /** 0..1 "not the phone." takes the light: lilac → a lighter lilac */
  key: number;
  /** its scale about its centre (1 → 1.02, anticipation + spring) */
  swell: number;
};
const NO_FOCUS: Focus = { dim: 1, key: 0, swell: 1 };
const KEY_LIT = mixHex(C.lilac, C.paper, 0.18);

export const Shards: React.FC<{
  t: number;
  L: Layout;
  hook: TextLayout;
  tag: TextLayout;
  shards: Shard[];
  focus?: Focus;
}> = ({ t, L, hook, tag, shards, focus = NO_FOCUS }) => {
  if (t < 0) {
    const g = gather(t);
    return (
      <HookLineStatic
        style={{
          transform: `translateY(-50%) scale(${g.a.toFixed(5)})`,
        }}
      />
    );
  }

  const keyInk = HOOK_LINE(L).key.color;
  const line3 = tag.lines[2];
  const swelling = Math.abs(focus.swell - 1) > 1e-4 && t < TW.keyFocus[1] + 14;
  // "not the phone." — paper → lilac on keyColor (as <Words> eases it), lighter on the focus beat
  const phraseInk = mixHex(mixHex(C.paper, C.lilac, tween(t, [TWIST.keyColor, TWIST.keyColor + 18], [0, 1], EASE.house)), KEY_LIT, focus.key);
  const lineW = line3.width;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {depthOrder(shards).map((i) => {
        const sh = shards[i];
        const s = shardState(sh, t, hook, tag, L);
        if (s.op < 0.01) return null;
        const g = s.useDst && sh.dst ? sh.dst : sh.src;
        const fs = s.useDst && sh.dst ? tag.fontSize : hook.fontSize;
        const lh = LINE_H * fs;
        const sc = s.size / fs;
        // past edge-on the card shows its new face: the turn continues from −90 to 0
        const ry = s.turn >= 90 ? s.turn - 180 : s.turn;
        const tf =
          `translate(${(s.x - g.adv / 2).toFixed(3)}px, ${(s.y - lh / 2).toFixed(3)}px)` +
          (Math.abs(ry) > 0.01 ? ` perspective(${CARD_P}px) rotateY(${ry.toFixed(3)}deg)` : '') +
          (Math.abs(s.rot) > 0.001 ? ` rotate(${s.rot.toFixed(3)}deg)` : '') +
          (Math.abs(sc - 1) > 1e-5 ? ` scale(${sc.toFixed(5)})` : '');
        const op = s.op * (sh.dst ? focus.dim : 1);
        return (
          <span
            key={i}
            style={{
              ...glyphStyle(fs),
              width: g.adv,
              color: s.ink >= 1 ? C.paper : mixHex(keyInk, C.paper, s.ink),
              opacity: op < 0.999 ? op : undefined,
              ...subpixel(tf, s.moving),
            }}
          >
            {g.ch}
          </span>
        );
      })}
      {t >= TWIST.line2 - 6 ? (
        <div
          style={{
            position: 'absolute',
            left: line3.left,
            top: line3.top,
            width: lineW + 40,
            transformOrigin: `${(lineW / 2).toFixed(1)}px ${(tag.lineH / 2).toFixed(1)}px`,
            ...subpixel(focus.swell !== 1 ? `scale(${focus.swell.toFixed(5)})` : undefined, swelling),
          }}
        >
          <Words
            text="not the phone."
            start={TWIST.line2}
            stagger={3}
            frame={t}
            align="left"
            role="display"
            tone="night"
            config={SPRING_LINE}
            keys={[{ text: 'not the phone.', color: C.lilac, at: TWIST.keyColor }]}
            style={{ fontSize: tag.fontSize, whiteSpace: 'nowrap' }}
            wordStyle={focus.key > 0.001 ? () => ({ color: phraseInk }) : undefined}
          />
        </div>
      ) : null}
    </div>
  );
};

/** "not the phone." rises on the display spring (heavier, one soft overshoot) */
const SPRING_LINE = { stiffness: 140, damping: 17, mass: 1 };

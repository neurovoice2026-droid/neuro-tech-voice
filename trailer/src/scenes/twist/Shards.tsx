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
 *         A measured break: every piece rests with its ink inside the central
 *         70 % of the frame (the throws are fitted to it proportionally, never
 *         clamped to its edge), tilted by at most ±12°, at a narrow depth
 *         (0.88–1.1×; the far ones a touch dimmer, painted behind the near
 *         ones). They part into two loose groups — the letters of the first
 *         row above it (or level with it, past its end), the second row's
 *         below — opening the gap the new line forms in; no piece rests on the
 *         lit doorway or its leaf, on the phone, in a landing lane or touching
 *         a neighbour, and neighbours never line up into a row of type. The
 *         two letters the new line does not need recede into the dark (gone
 *         by t 15).
 *         "closed" holds, then slides into the start of the new line; the
 *         hook's lilac leaves it on the way (the accent moves to "not the
 *         phone.").
 * t ≥ 8   the shards fly back as "Closed is for the door," word by word,
 *         letters left to right. Each letter turns over in flight like a
 *         card (rotateY): it shows its old glyph until it is edge-on, its new
 *         one after — the swap is never seen. Row-1 letters wait ABOVE the
 *         tagline and drop in; row-2 letters wait BELOW it and rise in; a
 *         letter waiting past a row's right end slides in over slots that
 *         fill after it.
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
  /** the throw's bend (px): it arcs round "closed" — position = p0 + v·k + 2k(1−k)·b (a quadratic
   *  Bézier through the same ends; no bend at rest, k = 1) */
  bx: number;
  by: number;
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

/** How much of the light a piece keeps at its depth (sOut 0.88 far … 1.1 near): the far ones dim to 80 %. */
const depthInk = (sOut: number) => 0.8 + 0.2 * Math.min(1, Math.max(0, (sOut - 0.88) / 0.22));

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
/** half the height a piece's ink takes (×size): a letter ≈ .4, the full stop a dot on the baseline */
const inkHalf = (ch: string) => (ch === '.' || ch === ',' ? 0.18 : 0.4);

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
  // the scatter field: the central 70 % of the frame (15 % margins). A measured break: no glyph is
  // flung toward the frame's edges — every piece rests with its ink inside this box
  const field: Rect = { x0: 0.15 * L.width, x1: 0.85 * L.width, y0: 0.15 * L.height, y1: 0.85 * L.height };
  // the tagline's first two rows (where the letters land), each its own box
  const rowBox = [0, 1].map((li): Rect => {
    const gl = tag.glyphs.filter((g) => g.line === li);
    return {
      x0: Math.min(...gl.map((g) => g.x)),
      x1: Math.max(...gl.map((g) => g.x + g.adv)),
      y0: tag.lines[li].top,
      y1: tag.lines[li].top + tag.lineH,
    };
  });
  // the swept path of "closed" → "Closed" (its box at thirteen points of the slide: no gaps between them)
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
  const sweep: Rect[] = Array.from({ length: 13 }, (_, i) => i / 12).map((p) => ({
    x0: cBox0.x0 + (cBox1.x0 - cBox0.x0) * p,
    x1: cBox0.x1 + (cBox1.x1 - cBox0.x1) * p,
    y0: cBox0.y0 + (cBox1.y0 - cBox0.y0) * p,
    y1: cBox0.y1 + (cBox1.y1 - cBox0.y1) * p,
  }));
  // the lanes the letters drop / rise through into their slots: nothing rests there. Row 1's lane
  // is only over the words that DROP in ("is for" — "Closed" slides in from below); row 2's is
  // under the whole row ("the door," rises in)
  const lane = (gl: Glyph[], li: number, dir: -1 | 1, hgt: number): Rect => {
    const top = tag.lines[li].top;
    return {
      x0: Math.min(...gl.map((g) => g.x)),
      x1: Math.max(...gl.map((g) => g.x + g.adv)),
      y0: dir < 0 ? top - hgt : top + tag.lineH,
      y1: dir < 0 ? top : top + tag.lineH + hgt,
    };
  };
  // per word over row 1 ("is", "for": a piece ignores its own word's lane — it drops into it, in
  // x order), the whole of row 2 under it
  const lanes: { r: Rect; word: number }[] = [
    { r: lane(tw[1], 0, -1, L.pick(120, 170)), word: 1 },
    { r: lane(tw[2], 0, -1, L.pick(120, 170)), word: 2 },
    { r: lane([...tw[3], ...tw[4]], 1, 1, L.pick(84, 150)), word: -1 },
  ];
  /** where the row-1 words' letters wait: "is" right over its slots (it lands first, straight down,
   *  crossing nothing); "for" over its own slots or past them (never left of them: it would cross "is") */
  const colIs = { x0: lane(tw[1], 0, -1, 0).x0 - L.pick(70, 56), x1: lane(tw[1], 0, -1, 0).x1 + L.pick(70, 56) };
  const colFor = lane(tw[2], 0, -1, 0).x0;
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
  /** air (px) between a resting piece and the tagline rows / the "closed" slide / the doorway */
  const air = { tag: L.pick(14, 36), sweep: L.pick(0, 18), door: L.pick(40, 44), phone: 24 };

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
    bx: number;
    by: number;
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
    // a measured break, not confetti: short throws that stay in the field, one calm tilt per piece
    // (its rest angle within ±12°, reached as it drifts: 70 % in the blast, the last 30 % a slow turn
    // the same way — never past it) and a narrow depth (0.88–1.1× its size; the far ones a touch
    // dimmer, painted behind the near ones) — objects in the dark, not tumbling debris
    const dist = L.pick(200, 210) + r('d') * L.pick(250, 230) + (kind === 'extra' ? 90 : 0);
    const sOut = 0.88 + r('s') * 0.22;
    const tilt = (r('r') - 0.5) * 2 * 12;
    const rot = tilt * 0.7;
    const spin = tilt * 0.3;
    pieces.push({
      src,
      kind,
      row: -1,
      word,
      x0: p0.x,
      y0: p0.y,
      // 16:9 throws wide, 9:16 throws tall
      raw: { x: p0.x + (dx / l2) * dist * L.pick(1.15, 0.7), y: p0.y + (dy / l2) * dist * L.pick(0.75, 1.35) },
      ax: 0,
      ay: 0,
      size: size0 * sOut,
      rot,
      spin,
      sOut,
      seed,
      bx: 0,
      by: 0,
    });
  };
  closedG.slice(0, 6).forEach((g) => add(g, 'closed', 0));
  hw[2].forEach((g) => add(g, 'fly', 1));
  const pool = [...hw[0], ...hw[1]];
  const extras = new Set([0, 4]); // two letters too many: they recede into the dark (the untangle may deal the role on)
  pool.forEach((g, i) => add(g, extras.has(i) ? 'extra' : 'fly', -1));
  add(closedG[6], 'fly', 4); // "." → "," (the sentence goes on)

  // the throws, fitted into the field PROPORTIONALLY (per direction, the farthest throw just reaches
  // the field's edge, the others in proportion) — never clamped, so the pieces keep the spread of
  // the blast instead of lining up along the field's edge
  {
    const moving = pieces.filter((p) => p.kind !== 'closed');
    const off = moving.map((p) => ({ x: p.raw.x - p.x0, y: p.raw.y - p.y0 }));
    const most = (sel: (o: { x: number; y: number }) => number) => Math.max(1, ...off.map(sel));
    const M = { r: most((o) => o.x), l: most((o) => -o.x), d: most((o) => o.y), u: most((o) => -o.y) };
    moving.forEach((p, i) => {
      const o = off[i];
      const half = p.size * inkHalf(p.src.ch);
      const room = {
        r: field.x1 - half - p.x0,
        l: p.x0 - (field.x0 + half),
        d: field.y1 - half - p.y0,
        u: p.y0 - (field.y0 + half),
      };
      const kx = o.x >= 0 ? Math.min(1, (0.96 * Math.max(0, room.r)) / M.r) : Math.min(1, (0.96 * Math.max(0, room.l)) / M.l);
      const ky = o.y >= 0 ? Math.min(1, (0.96 * Math.max(0, room.d)) / M.d) : Math.min(1, (0.96 * Math.max(0, room.u)) / M.u);
      p.raw = { x: p.x0 + o.x * kx, y: p.y0 + o.y * ky };
    });
  }

  // rows: "is" + the three pool pieces thrown highest go to row 1 ("for"),
  // the other seven + "." go to row 2 ("the door,")
  const free = pieces.filter((p) => p.kind === 'fly' && p.word === -1);
  const byHeight = [...free].sort((a, b) => a.raw.y - b.raw.y);
  byHeight.forEach((p, i) => (p.word = i < 3 ? 2 : 3));
  for (const p of pieces) if (p.kind === 'fly') p.row = p.word <= 2 ? 0 : 1;

  /* ── rest points: the least move that clears every keep-out ─────── */
  // a piece's footprint: its own advance (an "i" is narrow, an "m" wide) plus the reach of its tilt
  // (≤ 12°), by the height of a letter with its ascender
  const foot = (p: Piece) => {
    const h = 1.8 * inkHalf(p.src.ch) * p.size;
    return { w: p.src.adv * (p.size / hook.fontSize) + 0.21 * h, h };
  };
  /** how far two footprints overlap once grown by `gap` (0 = clear) */
  const overlap = (ax: number, ay: number, fa: { w: number; h: number }, q: Piece, gap: number) => {
    const fq = foot(q);
    const ox = (fa.w + fq.w) / 2 + gap - Math.abs(ax - q.ax);
    const oy = (fa.h + fq.h) / 2 + gap - Math.abs(ay - q.ay);
    return ox > 0 && oy > 0 ? Math.min(ox, oy) : 0;
  };
  const placed: Piece[] = [];
  const STEP = 12;
  // the letters the new line needs take their places first; the two extras (gone by t 15) the room left
  for (const p of [...pieces.filter((q) => q.kind === 'fly'), ...pieces.filter((q) => q.kind === 'extra')]) {
    const half = p.size * inkHalf(p.src.ch);
    const fp = foot(p);
    let best = { x: p.raw.x, y: p.raw.y, c: Infinity };
    for (let y = 0; y <= L.height; y += STEP) {
      for (let x = 0; x <= L.width; x += STEP) {
        let c = Math.hypot(x - p.raw.x, y - p.raw.y);
        // hard: the field (ink inside the central 70 %), the tagline, the "closed" slide, the
        // landing lanes over row 1 / under row 2
        let hard =
          Math.max(0, field.x0 + fp.w / 2 - x) + Math.max(0, x - (field.x1 - fp.w / 2)) +
          Math.max(0, field.y0 + half - y) + Math.max(0, y - (field.y1 - half));
        for (const r of rowBox) hard += inside(r, x, y, air.tag + half);
        for (const r of sweep) hard += inside(r, x, y, air.sweep + half);
        for (const l of lanes) if (l.word !== p.word) hard += inside(l.r, x, y, 12 + half);
        if (p.word === 1) hard += Math.max(0, colIs.x0 - x) + Math.max(0, x - colIs.x1);
        if (p.word === 2) hard += Math.max(0, colFor - x);
        // a row-1 letter waits ABOVE its row (and drops in) or level with it, past its right end
        // (and slides in over slots that fill after it); a row-2 letter BELOW its row (rises in) or
        // past its right end
        const past = (li: number) => Math.max(0, rowBox[li].x1 + air.tag + fp.w / 2 - x);
        if (p.word === 1) hard += Math.max(0, y - (rowBox[0].y0 - air.tag - half));
        if (p.word === 2)
          hard += Math.min(Math.max(0, y - (rowBox[0].y0 - air.tag - half)), past(0) + Math.max(0, y - rowBox[0].y1));
        if (p.row === 1)
          hard += Math.min(Math.max(0, rowBox[1].y1 + air.tag + half - y), past(1) + Math.max(0, rowBox[1].y0 - y));
        // never ON the phone: it is found in the dark right where they rest (phoneReveal);
        // never on the doorway or its open leaf; never touching a neighbour
        hard += inside(phoneBox, x, y, air.phone + half);
        hard += inside(doorBox, x, y, air.door + half);
        for (const q of placed) hard += overlap(x, y, fp, q, 44);
        c += hard * 1e4;
        // the blast carries no piece across "closed" (it holds there until the slide) — strongly
        // preferred, but never at the price of a piece touching a neighbour (where "closed" sits under
        // "business", 9:16, a far piece may pass behind it)
        for (let k = 0.12; k < 0.95; k += 0.12) c += 60 * inside(cBox0, p.x0 + (x - p.x0) * k, p.y0 + (y - p.y0) * k, 0.22 * p.size);
        // soft: clear of the phone's rim and the doorway's surround, with air between neighbours —
        // and never in a row with them: a neighbour close across sits higher or lower (a scatter,
        // not a line of type)
        c += Math.min(1, inside(phoneBox, x, y, 44 + half) / 20) * 900;
        c += Math.min(1, inside(doorBox, x, y, 80 + half) / 26) * 500;
        for (const q of placed) {
          c += overlap(x, y, fp, q, 84) * 9;
          if (Math.abs(x - q.ax) < 2.4 * p.size) c += Math.max(0, 0.34 * p.size - Math.abs(y - q.ay)) * 5;
          // …nor in a column with them (no grid)
          if (Math.abs(y - q.ay) < 2 * p.size) c += Math.max(0, 0.3 * p.size - Math.abs(x - q.ax)) * 4;
        }
        if (c < best.c) best = { x, y, c };
      }
    }
    p.ax = best.x;
    p.ay = best.y;
    placed.push(p);
  }
  // a throw that would still pass across "closed" (9:16: it sits right under "business") ARCS round
  // it — the least bend that clears the word (a quadratic Bézier through the same two ends); if no
  // bend clears it, the piece is thrown FAR and passes behind the word (painted before it, dimmer)
  for (const p of placed) {
    const vx = p.ax - p.x0;
    const vy = p.ay - p.y0;
    const len = Math.hypot(vx, vy) || 1;
    const nx = -vy / len;
    const ny = vx / len;
    // (a piece that starts AT the word — the full stop — simply leaves it: no bend)
    if (inside(cBox0, p.x0, p.y0, 0.24 * p.size) > 0) continue;
    const hit = (b: number) => {
      let sum = 0;
      for (let k = 0.04; k < 1; k += 0.04) {
        const w = 2 * k * (1 - k) * b;
        const x = p.x0 + vx * k + nx * w;
        const y = p.y0 + vy * k + ny * w;
        sum += inside(cBox0, x, y, 0.24 * p.size);
        // …and the arc stays in the field too
        if (b !== 0) sum += Math.max(0, field.x0 - x, x - field.x1, field.y0 - y, y - field.y1);
      }
      return sum;
    };
    if (hit(0) === 0) continue;
    let best = { b: 0, h: hit(0) };
    for (let m = 40; m <= 520 && best.h > 0; m += 40)
      for (const b of [m, -m]) {
        const h = hit(b);
        if (h < best.h) best = { b, h };
      }
    p.bx = nx * best.b;
    p.by = ny * best.b;
    if (best.h > 0 && p.sOut > 0.92) {
      p.sOut = 0.88 + (p.sOut - 0.88) * 0.15;
      p.size = size0 * p.sOut;
    }
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
      bx: p.bx,
      by: p.by,
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
      x: x0 + sh.vx * k + 2 * k * (1 - k) * sh.bx,
      y: y0 + sh.vy * k + 2 * k * (1 - k) * sh.by,
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
  const ox = x0 + sh.vx * k + 2 * k * (1 - k) * sh.bx;
  const oy = y0 + sh.vy * k + 2 * k * (1 - k) * sh.by;
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

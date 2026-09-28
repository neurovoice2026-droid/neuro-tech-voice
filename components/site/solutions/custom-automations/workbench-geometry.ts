import type { RunEdge, RunLens, RunNode } from "@/lib/pages/custom-automations";

/* ------------------------------------------------------------------ *
 * #running — the xl map's geometry: where each block of a lens sits, and
 * the path every line takes between two of them.
 *
 * ONE COORDINATE SYSTEM. The map is a box 1000 user units (u) wide and
 * as tall as its lens's rows (`viewH`): 344u for a lens that uses all
 * three, the most any does (`VIEW`), 220u for one that uses two. FlowMap
 * lays an <svg viewBox="0 0 1000 h"> and the HTML cards over the same
 * aspect-ratio box, a card's left/top/width/height being its box here as
 * percentages of that box (`placed`), so the SVG's lines and the HTML's
 * cards meet exactly, and no lens leaves an empty row under its flow.
 * The map is drawn from xl only, where the stage's inner width is 1120px
 * (the Frame's 1176 less the stage's 28px padding each side): 1u is
 * 1.12px, a card 132×74px, an end card 132×49px.
 *
 * THE GRID is seven columns by three rows, and every block's place is a
 * cell of it in the data (`at: { c, r }`): x(c) = 147c, y(r) = 14 + 124r,
 * so card centres sit at x = 147c + 59 and y = 47, 171, 295. A flow runs
 * left to right along the middle row; a branch that ends leaves it up or
 * down its own column to a short dashed card (END, centred on its row as
 * a full card is); the morning lens's two frames ("In order", "Side by
 * side") are the union of their members' boxes, grown by GROUP_PAD.
 *
 * THE LINES are orthogonal polylines, worked out from the two ends, so
 * the data never carries a coordinate:
 *   · same column — straight up or down, at the column's centre, from
 *     the facing edges (a branch that ends);
 *   · level — a block whose centre lies within the other end's height
 *     (the same row, or a block and a frame beside it) — straight
 *     across, from the right edge to the left edge;
 *   · otherwise a Z through the gutter halfway between the two: out of
 *     the right edge at the source's centre, along the gutter, and into
 *     the left edge at the target's (the morning lens's `cron-reconcile`
 *     up the gutter at x 132.5, and `overage-summary` down the gutter at
 *     x 720.5, between the empty c4 and c5, where it meets
 *     `side-summary` and shares its last run into the summary: both are
 *     lit on the same step). The summary stands in c6, so the morning's
 *     flow ends at the sheet's right edge, as every other lens's does.
 * Every line runs rightwards or straight up and down; one that would
 * run backwards throws, so a block placed out of order fails the page's
 * test rather than drawing a line through the cards. The test also
 * samples every segment at each 1% and holds it 4u clear of every card
 * and frame that isn't its own end.
 *
 * `edgePath` turns a polyline into an SVG `d` with 8u rounded corners (a
 * `Q` at every bend), each corner clamped so it never eats more than
 * half of a segment it shares with another corner. DrawSVG and
 * MotionPath measure the path in these same units, which is why the
 * paths carry no `vector-effect`.
 *
 * PURE: no React, no DOM, types only from the data module. The page's
 * test imports it under vitest; the map, the timeline and the test all
 * read the same numbers.
 * ------------------------------------------------------------------ */

export type Point = readonly [x: number, y: number];
export type Box = { x: number; y: number; w: number; h: number };

/** The map's widest and tallest box, in user units: three rows, the most a lens uses (`viewH` is each lens's own). */
export const VIEW = { w: 1000, h: 344 } as const;
/** A block's card. */
export const CARD = { w: 118, h: 66 } as const;
/** A branch that ends: a shorter card, centred on its row. */
export const END = { w: 118, h: 44 } as const;
/** How far a group's frame stands off its members' boxes. */
export const GROUP_PAD = 8;
/** The corner radius of every bend in a line. */
export const RADIUS = 8;
/** From a card's left edge to the next column's, and from a row's top to the next row's. */
const PITCH = { c: 147, r: 124 } as const;

/** A column's left edge. */
export const x = (c: number) => c * PITCH.c;
/** A row's top edge (a full card's). */
export const y = (r: number) => 14 + r * PITCH.r;

/** The room under a lens's lowest cards: the 14u above its first row, and 2u more for the Running pill hanging off a card's foot. */
const FOOT = 16;

/**
 * A lens's box height: from the top down to its lowest row's cards, and
 * the room under them. 344u (VIEW.h) for a lens that uses the third row,
 * so the section's first paint ("A customer pays", which the reserve in
 * deferred.tsx measures) keeps its height.
 */
export function viewH(lens: Pick<RunLens, "nodes">): number {
  return y(Math.max(0, ...lens.nodes.map((n) => n.at.r))) + CARD.h + FOOT;
}

/** A block's box: a full card in its cell, or an end card centred on its row. */
export function boxOf(node: Pick<RunNode, "at" | "end">): Box {
  const { c, r } = node.at;
  return node.end
    ? { x: x(c), y: y(r) + (CARD.h - END.h) / 2, w: END.w, h: END.h }
    : { x: x(c), y: y(r), w: CARD.w, h: CARD.h };
}

/** A group's frame: the union of its members' boxes, grown by GROUP_PAD. Throws for a group with no members. */
export function groupBox(lens: RunLens, id: string): Box {
  const boxes = lens.nodes.filter((n) => n.group === id).map(boxOf);
  if (!boxes.length) throw new Error(`workbench: the "${lens.id}" lens's group "${id}" has no blocks`);
  const left = Math.min(...boxes.map((b) => b.x)) - GROUP_PAD;
  const top = Math.min(...boxes.map((b) => b.y)) - GROUP_PAD;
  const right = Math.max(...boxes.map((b) => b.x + b.w)) + GROUP_PAD;
  const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + GROUP_PAD;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Whether an id names a group of the lens (a line may start or end on one). */
export const isGroup = (lens: RunLens, id: string) => (lens.groups ?? []).some((g) => g.id === id);

/** The box a line starts or ends on: a block's card, or a group's frame. */
export function endBox(lens: RunLens, id: string): Box {
  if (isGroup(lens, id)) return groupBox(lens, id);
  const node = lens.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`workbench: the "${lens.id}" lens has no block "${id}"`);
  return boxOf(node);
}

const midY = (b: Box) => b.y + b.h / 2;
const midX = (b: Box) => b.x + b.w / 2;
const within = (v: number, b: Box) => v > b.y && v < b.y + b.h;

/** A line's polyline, from its first-named end's edge to its second's. */
export function edgePoints(lens: RunLens, edge: Pick<RunEdge, "id" | "from" | "to">): Point[] {
  const a = endBox(lens, edge.from);
  const b = endBox(lens, edge.to);
  // Same column: up or down between the facing edges.
  if (Math.abs(midX(a) - midX(b)) < 0.5) {
    const cx = midX(a);
    return midY(b) > midY(a)
      ? [
          [cx, a.y + a.h],
          [cx, b.y],
        ]
      : [
          [cx, a.y],
          [cx, b.y + b.h],
        ];
  }
  const x0 = a.x + a.w;
  const x1 = b.x;
  if (x1 <= x0) throw new Error(`workbench: the "${lens.id}" lens's line "${edge.id}" would run backwards`);
  const fromGroup = isGroup(lens, edge.from);
  const toGroup = isGroup(lens, edge.to);
  // Level: straight across at the block's own centre.
  if (!fromGroup && within(midY(a), b)) {
    return [
      [x0, midY(a)],
      [x1, midY(a)],
    ];
  }
  if (!toGroup && within(midY(b), a)) {
    return [
      [x0, midY(b)],
      [x1, midY(b)],
    ];
  }
  // A Z through the gutter halfway between the two.
  const gx = (x0 + x1) / 2;
  return [
    [x0, midY(a)],
    [gx, midY(a)],
    [gx, midY(b)],
    [x1, midY(b)],
  ];
}

const num = (n: number) => String(Number(n.toFixed(2)));

/**
 * An SVG `d` for a polyline, its bends rounded to RADIUS with a `Q` whose
 * control point is the corner itself. A corner may take the whole of an
 * end segment but only half of a segment it shares with another corner,
 * so two bends close together never overlap. (The SaaS explorer's
 * generator, map-geometry.ts, which is typed to that page's edges.)
 */
export function roundedPath(points: readonly Point[]): string {
  const n = points.length - 1;
  if (n < 1) return "";
  const len = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const toward = (from: Point, to: Point, d: number): Point => {
    const l = len(from, to) || 1;
    return [from[0] + ((to[0] - from[0]) * d) / l, from[1] + ((to[1] - from[1]) * d) / l];
  };
  let d = `M${num(points[0][0])} ${num(points[0][1])}`;
  for (let i = 1; i < n; i++) {
    const [prev, at, next] = [points[i - 1], points[i], points[i + 1]];
    const before = i - 1 === 0 ? len(prev, at) : len(prev, at) / 2;
    const after = i + 1 === n ? len(at, next) : len(at, next) / 2;
    const r = Math.min(RADIUS, before, after);
    const p = toward(at, prev, r);
    const q = toward(at, next, r);
    d += ` L${num(p[0])} ${num(p[1])} Q${num(at[0])} ${num(at[1])} ${num(q[0])} ${num(q[1])}`;
  }
  d += ` L${num(points[n][0])} ${num(points[n][1])}`;
  return d;
}

/** A line's `d`. */
export function edgePath(lens: RunLens, edge: Pick<RunEdge, "id" | "from" | "to">): string {
  return roundedPath(edgePoints(lens, edge));
}

/**
 * Where a branch's word ("yes", "no") sits: 6u off the middle of the
 * line's longest segment — to the right of an upright one, above a level
 * one. Null for a line with no word.
 */
export function labelAt(
  lens: RunLens,
  edge: RunEdge,
): { x: number; y: number; side: "right" | "above" } | null {
  if (!edge.label) return null;
  const pts = edgePoints(lens, edge);
  let best = 0;
  let longest = -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (l > longest) {
      longest = l;
      best = i;
    }
  }
  const [a, b] = [pts[best], pts[best + 1]];
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  return a[0] === b[0] ? { x: mx + 6, y: my, side: "right" } : { x: mx, y: my - 6, side: "above" };
}

const pct = (n: number) => `${Number(n.toFixed(4))}%`;

/** A box as percentages of a map `h` units tall (the lens's `viewH`): how FlowMap places the HTML over the SVG. */
export function placed(b: Box, h: number = VIEW.h) {
  return {
    left: pct((b.x / VIEW.w) * 100),
    top: pct((b.y / h) * 100),
    width: pct((b.w / VIEW.w) * 100),
    height: pct((b.h / h) * 100),
  };
}

/** A point as percentages of a map `h` units tall: where a branch's word or a group's tab is pinned. */
export function pinned(px: number, py: number, h: number = VIEW.h) {
  return { left: pct((px / VIEW.w) * 100), top: pct((py / h) * 100) };
}

import type { EdgeId, PartId } from "@/lib/pages/custom-mobile-applications";

/* ------------------------------------------------------------------ *
 * #hold — the drawing's geometry (lg and up): where each part this
 * platform runs sits, and the path every line takes between two of
 * them, or between one and the phone.
 *
 * ONE COORDINATE SYSTEM. The drawing is a box 600 × 416 user units (u).
 * PartsMap lays an <svg viewBox="0 0 600 416"> for the lines, the dots,
 * the phone's port and the rings, and the HTML cards over the same
 * aspect-ratio box, each card's left/top/width/height being its box here
 * as percentages of that box (`placed`), so the lines and the cards meet
 * exactly. The box is as wide as its column or as the height the phone
 * beside it leaves allows (mob-hold.css §1), 505px at least (1u =
 * 0.84px) and 754 at most (1u = 1.26px). A card is 148 × 64u, 125–186px
 * wide: its glyph, its label in 13px and its figure in 11px mono.
 *
 * THE GRID is three columns by three rows of cards:
 *
 *                A  x 34–182        B  x 222–370       C  x 410–558
 *   row 1 y 24–88   Sign-in            Live connection    Daily jobs
 *   row 2 y 168–232 API                Database           Push
 *   row 3 y 312–376 Payments           Files              Emails and texts
 *
 * The phone is off the drawing's left edge: its port is at (0, 200), a
 * nub into the bus that runs down x = 10 from y 8 to 404 — the one line
 * everything the phone sends or receives travels. Between the cards run
 * the channels the lines keep to: a top lane (y 8), the gutters (x 202
 * and x 390), a right lane (x 580) and two bottom lanes (y 390, y 404).
 * The API sits level with the port, so the phone's most common hop is
 * one straight line; the database is the middle of everything; the three
 * parts the phone hears from without asking (a live connection, push,
 * the texts) come back to it round the outside.
 *
 * THE LINES, fourteen, each an orthogonal polyline given here in full
 * (EDGES): every one starts and ends on its own two cards' borders (or
 * the port), no segment passes within 4u of any other card, no two
 * cross, and the only segments two lines share are the bus (x = 10) and
 * the port's nub. lib/pages/custom-mobile-applications.test.ts samples
 * each at every 1% and holds all four rules. `data-files` is drawn and
 * never travelled (the daily job clears the files it no longer needs;
 * the journey never uploads one). The two lines to and from push are
 * dashed (DASHED): push is the one part this platform doesn't run, so
 * its lines are "built for yours" too.
 *
 * `edgePath` turns a polyline into an SVG `d` with 8u rounded corners (a
 * `Q` at every bend, the Automations workbench's rule, re-implemented
 * because its generator is typed to its own lenses), each corner clamped
 * so it never eats more than half of a segment it shares with another
 * corner. DrawSVG and MotionPath measure the paths in these same units,
 * which is why the paths carry no `vector-effect`.
 *
 * PURE: no React, no DOM, types only from the data module. The drawing,
 * the timeline and the page's test all read the same numbers.
 * ------------------------------------------------------------------ */

export type Point = readonly [x: number, y: number];
export type Box = { x: number; y: number; w: number; h: number };

/** The drawing's box, in user units. */
export const VIEW = { w: 600, h: 416 } as const;
/** A part's card. */
export const CARD = { w: 148, h: 64 } as const;
/** The corner radius of every bend in a line. */
export const RADIUS = 8;
/** The phone's port on the drawing's left edge, where the nub meets the bus, and the port ring's radius. */
export const PORT = { x: 0, y: 200, r: 3 } as const;
/** The bus down the drawing's left side. */
export const BUS = { x: 10, top: 8, bottom: 404 } as const;
/** A dot riding a hop: 7u across. */
export const DOT_R = 3.5;

/** Each column's left edge and each row's top. */
const COL = [34, 222, 410] as const;
const ROW = [24, 168, 312] as const;

/** Each part's cell, column and row, in the data module's PARTS order. */
const CELL: Record<PartId, readonly [c: 0 | 1 | 2, r: 0 | 1 | 2]> = {
  signin: [0, 0],
  api: [0, 1],
  data: [1, 1],
  payments: [0, 2],
  files: [1, 2],
  live: [1, 0],
  jobs: [2, 0],
  messages: [2, 2],
  push: [2, 1],
};

/** A part's card, in user units. */
export function boxOf(id: PartId): Box {
  const [c, r] = CELL[id];
  return { x: COL[c], y: ROW[r], w: CARD.w, h: CARD.h };
}

/** Every card, in the data module's PARTS order. */
export const BOXES: Record<PartId, Box> = Object.fromEntries(
  (Object.keys(CELL) as PartId[]).map((id) => [id, boxOf(id)]),
) as Record<PartId, Box>;

/** Every line, from its id's first end to its second, through the channels. */
export const EDGES: Record<EdgeId, readonly Point[]> = {
  "phone-signin": [[0, 200], [10, 200], [10, 56], [34, 56]],
  "phone-api": [[0, 200], [34, 200]],
  "phone-payments": [[0, 200], [10, 200], [10, 344], [34, 344]],
  "live-phone": [[296, 24], [296, 8], [10, 8], [10, 200], [0, 200]],
  "push-phone": [[410, 216], [390, 216], [390, 390], [10, 390], [10, 200], [0, 200]],
  "messages-phone": [[500, 376], [500, 404], [10, 404], [10, 200], [0, 200]],
  "signin-data": [[182, 56], [202, 56], [202, 184], [222, 184]],
  "api-data": [[182, 216], [222, 216]],
  "payments-api": [[108, 312], [108, 232]],
  "data-live": [[296, 168], [296, 88]],
  "jobs-data": [[410, 72], [390, 72], [390, 184], [370, 184]],
  "jobs-push": [[484, 88], [484, 168]],
  "jobs-messages": [[558, 56], [580, 56], [580, 344], [558, 344]],
  "data-files": [[296, 232], [296, 312]],
};

/** The lines drawn dashed: to and from push, the one part built for your app alone. */
export const DASHED: ReadonlySet<EdgeId> = new Set<EdgeId>(["jobs-push", "push-phone"]);

/** The dash of a dashed line, in user units. */
export const DASH = "3 4";

const num = (n: number) => String(Number(n.toFixed(2)));

/**
 * An SVG `d` for a polyline, its bends rounded to RADIUS with a `Q` whose
 * control point is the corner itself. A corner may take the whole of an
 * end segment but only half of a segment it shares with another corner,
 * so two bends close together never overlap.
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
export function edgePath(id: EdgeId): string {
  return roundedPath(EDGES[id]);
}

/** A line's length in user units, corners taken square: what a hop's timing reads. */
export function edgeLength(id: EdgeId): number {
  const pts = EDGES[id];
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

const pct = (n: number) => `${Number(n.toFixed(4))}%`;

/** A box as percentages of the drawing: how PartsMap places a card over the SVG. */
export function placed(b: Box) {
  return {
    left: pct((b.x / VIEW.w) * 100),
    top: pct((b.y / VIEW.h) * 100),
    width: pct((b.w / VIEW.w) * 100),
    height: pct((b.h / VIEW.h) * 100),
  };
}

/** A point as percentages of the drawing: where the port's label is pinned. */
export function pinned(px: number, py: number) {
  return { left: pct((px / VIEW.w) * 100), top: pct((py / VIEW.h) * 100) };
}

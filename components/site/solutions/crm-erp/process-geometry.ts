/* ------------------------------------------------------------------ *
 * #process — the drawing's geometry: where every sheet stands in each
 * view, the connectors between the steps in one system, and the hand-offs
 * between the papers today, in both compositions (process-lanes.tsx from
 * lg, process-list.tsx below it).
 *
 * THE LANES: ONE COORDINATE SYSTEM. A box 1000 × 272 user units (u),
 * fixed in its aspect (erp-drawing.css §1). ProcessLanes lays an
 * <svg viewBox="0 0 1000 272"> for the connectors, the dot and the
 * hand-offs, and the HTML sheets over the same box, each sheet's place in
 * each view being its box here in the same units (the box is a container:
 * 1u = 0.1cqw across and down), so the lines and the sheets meet exactly
 * at every width, with nothing measured. The drawing is the stage's full
 * width from lg: 880px at the 1024 frame (1u = 0.88px: a card 84 × 46px,
 * a paper 185 × 84px) and 1112px from xl (1u = 1.112px), where it stands
 * 302px tall: flat enough that the rail, the lanes and the record
 * window's hotspot share one 900px screen.
 *
 *   x 0–112      the lane labels' column (LABEL_W = X0: the rail's first
 *                cell, 11.2% of the box, stands over it)
 *   x 112–1000   eight columns of 111u (11.1% each), step i in column i,
 *                its card centred on the column and on its lane
 *   y 0–272      four lanes of 68u: Sales, Operations, Accounts, and
 *                what runs by itself
 *
 * A CONNECTOR joins card i to card i + 1 and only those: out of card
 * i's right edge on its centre line, to the gutter's middle between the
 * two columns (X0 + COL × (i + 1)), up or down to the next lane's centre
 * line, and into card i + 1's left edge, its two bends rounded to
 * CORNER. Every point of it lies between those two edges, and no other
 * card stands in that gutter, so no connector can cross a card (the
 * page's test samples every one). The dip to "By itself" at the
 * follow-up and the climb back to Sales at the order are two of them.
 *
 * TODAY'S SCATTER (SCATTER): the same eight sheets as papers, 210 × 96u,
 * each turned a little about its own centre, in two rows of four across
 * the whole box (the lane labels are hidden in Today). The top row runs
 * the enquiry, the quote, the order and the invoice; the row under it the
 * follow-up, the delivery, the stock and the figures: so each hand-off's
 * two papers are neighbours (enquiry → quote → order along the top, the
 * order down to its stock and across to its invoice). Every paper, turned,
 * stays inside the box; no two overlap by more than 6% of a paper; the
 * test holds those rules, not the numbers.
 *
 * A HAND-OFF (`handoff`) is a quadratic Bézier from one paper's centre to
 * the other's (the papers hide its ends), drawn under them: the three
 * between neighbours along the top swing down into the band between the
 * rows, and the order's hand-off to its stock drops through it. Each is
 * set by the point its mark stands on (MARK_AT), the curve's own middle:
 * all four in the band between the rows (y 111–163), where there is room
 * for a pill of words, clear of each other. `tip` is where the curve
 * meets the edge of the paper it hands to: its arrowhead.
 *
 * THE LIST (below lg): the same eight sheets, in a box 512px tall at
 * every width. In one system, eight rows of 64px (LIST): a 24px rail down
 * the left with a node per row, then the lane's chip, then the card. In
 * Today, a loose pile (PILE): two columns of four 128px cells, each
 * paper turned 2° one way or the other. Its places are in pixels and
 * shares of the list's width, so the list, too, is never measured.
 *
 * EVERY PLACE IS A TRANSFORM. A sheet's layout box sits at its drawing's
 * top left in both views (erp-drawing.css §2), and each view's place is
 * a `translate()` (and the paper's turn a `rotate()`) of it, so a view
 * change moves no layout box (no layout shift), and the stage's timeline
 * flies the sheets between the two places these functions give
 * (`sheetPlace`), in pixels for the drawing's width, with no measure of a
 * sheet (process-timeline.ts).
 *
 * PURE: no React, no DOM, types only. The drawing (process-lanes.tsx,
 * process-list.tsx), its sheet (erp-drawing.css) and the page's test all
 * read the same numbers; the stage's timeline (process-timeline.ts)
 * rides the connectors these draw and flies the sheets between the
 * places they give.
 * ------------------------------------------------------------------ */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** The lanes' box, in user units: aspect-ratio 1000 / 272. */
export const LANES_BOX = { w: 1000, h: 272 } as const;
/** Four lanes, top to bottom: sales 0, ops 1, accounts 2, auto 3. */
export const LANE_H = 68;
/** The lane labels' column, on the left: the rail's first cell stands over it. */
export const LABEL_W = 112;
/** The first column's left edge (the labels' column's right), and each column's width. */
export const X0 = LABEL_W;
export const COL = 111;
/** A step's card in one system, centred on its column and its lane. */
export const CARD = { w: 96, h: 52, r: 10 } as const;
/** A step's paper today: wide enough that its words keep a line each at the 1024 frame. */
export const PAPER = { w: 210, h: 96, r: 8 } as const;
/** A connector's corner radius. */
export const CORNER = 6;
/** The travelling dot: 7u across, with a 2u white ring. */
export const DOT = { r: 3.5, ring: 2 } as const;

/**
 * Today's scatter: each paper's top-left and its turn in degrees, in step
 * order. Checked in scratchpad/crmv/geom.mjs when the spec was written,
 * and by the page's test on every run: inside the box, turned; no two
 * overlapping by more than 6%; every hand-off clear of a third paper.
 */
export const SCATTER = [
  [10, 8, -3], //     01 enquiry
  [262, 6, 2], //     02 quote
  [26, 168, 2.5], //  03 follow-up
  [516, 12, -1.5], // 04 order
  [540, 172, 1.5], // 05 stock
  [282, 170, -2], //  06 delivery
  [772, 6, 3], //     07 invoice
  [778, 168, -2.5], //08 report
] as const satisfies readonly (readonly [x: number, y: number, turn: number])[];

/** Below lg, one system: eight rows of 64px, and the rail's 24px down their left. */
export const LIST = { row: 64, rows: 8, h: 512, rail: 24 } as const;
/** Below lg, Today: the papers piled two across and four down, in 128px cells, each turned 2°. */
export const PILE = { cols: 2, rows: 4, cell: 128, turn: 2 } as const;

/**
 * A list row's card (px): from `left` (the rail and the lane's chip before
 * it; `narrowLeft` in a list under `narrowUnder` wide, whose chips are
 * narrower) to the row's end, `top` down its row and `h` tall.
 * erp-drawing.css §5 writes the same numbers.
 */
export const LIST_CARD = { left: 116, narrowLeft: 104, narrowUnder: 300, top: 4, h: 56 } as const;
/** A pile's paper (px): half the list less half the `gap` between the columns, `top` down its cell and `h` tall. */
export const PILE_PAPER = { gap: 8, top: 6, h: 116 } as const;

/** A value as a percentage of a length: how the HTML over the box is placed. */
export const pct = (v: number, of: number) => `${Number(((v / of) * 100).toFixed(4))}%`;

const num = (n: number) => String(Number(n.toFixed(2)));

/** Column `step`'s centre, and lane `lane`'s. */
const colX = (step: number) => X0 + COL * (step + 0.5);
const laneY = (lane: number) => lane * LANE_H + LANE_H / 2;

/** Step `step`'s card, on lane `lane`. */
export function cardRect(step: number, lane: number): Rect {
  return { x: colX(step) - CARD.w / 2, y: laneY(lane) - CARD.h / 2, w: CARD.w, h: CARD.h };
}

/** Step `step`'s paper today, with its turn. */
export function paperRect(step: number): Rect & { turn: number } {
  const [x, y, turn] = SCATTER[step];
  return { x, y, w: PAPER.w, h: PAPER.h, turn };
}

const centreOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * An SVG `d` for a polyline, its bends rounded to CORNER with a `Q` whose
 * control point is the corner itself (the Mobile drawing's rule). A
 * corner never takes more than half of a segment it shares with another
 * bend, so two bends close together never overlap.
 */
function roundedPath(points: readonly Point[]): string {
  const n = points.length - 1;
  const len = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
  const toward = (from: Point, to: Point, d: number): Point => {
    const l = len(from, to) || 1;
    return { x: from.x + ((to.x - from.x) * d) / l, y: from.y + ((to.y - from.y) * d) / l };
  };
  let d = `M${num(points[0].x)} ${num(points[0].y)}`;
  for (let i = 1; i < n; i++) {
    const [prev, at, next] = [points[i - 1], points[i], points[i + 1]];
    const before = i - 1 === 0 ? len(prev, at) : len(prev, at) / 2;
    const after = i + 1 === n ? len(at, next) : len(at, next) / 2;
    const r = Math.min(CORNER, before, after);
    const p = toward(at, prev, r);
    const q = toward(at, next, r);
    d += ` L${num(p.x)} ${num(p.y)} Q${num(at.x)} ${num(at.y)} ${num(q.x)} ${num(q.y)}`;
  }
  return `${d} L${num(points[n].x)} ${num(points[n].y)}`;
}

/**
 * The connector from card `step` to card `step + 1`, each on its lane
 * (`lanes`, by step): out of the one's right edge, down or up the gutter
 * between them, into the other's left edge. Straight when the two share a
 * lane.
 */
export function connector(step: number, lanes: readonly number[]): string {
  const a = cardRect(step, lanes[step]);
  const b = cardRect(step + 1, lanes[step + 1]);
  const from = { x: a.x + a.w, y: a.y + a.h / 2 };
  const to = { x: b.x, y: b.y + b.h / 2 };
  if (from.y === to.y) return roundedPath([from, to]);
  const gutter = X0 + COL * (step + 1);
  return roundedPath([from, { x: gutter, y: from.y }, { x: gutter, y: to.y }, to]);
}

/**
 * Where each hand-off's mark stands: the middle of its curve, keyed
 * "from→to" by step index. The three along the top swing down into the
 * band between the rows (y 111–163), each in the gap between its two
 * papers; the order's drop to its stock stands a pill's height lower
 * than theirs (a pill is 24px: 27u at the 1024 frame), between them, so
 * its longer words ("Counted by hand") never meet theirs.
 */
const MARK_AT: Readonly<Record<string, Point>> = {
  "0→1": { x: 241, y: 130 },
  "1→3": { x: 494, y: 130 },
  "3→4": { x: 622, y: 158 },
  "3→6": { x: 749, y: 130 },
};

/** A point on the quadratic a → c → b at t. */
const onQuad = (a: Point, c: Point, b: Point, t: number): Point => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
});

/** Whether a point lies inside a turned paper. */
function inPaper(p: Point, r: Rect & { turn: number }): boolean {
  const c = centreOf(r);
  const t = (-r.turn * Math.PI) / 180;
  const x = c.x + (p.x - c.x) * Math.cos(t) - (p.y - c.y) * Math.sin(t);
  const y = c.y + (p.x - c.x) * Math.sin(t) + (p.y - c.y) * Math.cos(t);
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}

/**
 * The hand-off from paper `from` to paper `to` today: a quadratic from
 * centre to centre whose middle is its mark's place (`mid`), and its
 * arrowhead (`tip`: where the curve meets the target paper's edge, and
 * the angle it arrives at, in degrees).
 */
export function handoff(from: number, to: number): { d: string; mid: Point; tip: Point & { angle: number } } {
  const mid = MARK_AT[`${from}→${to}`];
  if (!mid) throw new Error(`process: no hand-off drawn from step ${from + 1} to ${to + 1}`);
  const a = centreOf(paperRect(from));
  const b = centreOf(paperRect(to));
  // The control point that puts the curve's middle (t = 0.5) on the mark.
  const c = { x: 2 * mid.x - (a.x + b.x) / 2, y: 2 * mid.y - (a.y + b.y) / 2 };
  // Walk back from the target's centre until the curve leaves its paper: the arrowhead's point.
  const target = paperRect(to);
  let t = 1;
  while (t > 0.5 && inPaper(onQuad(a, c, b, t), target)) t -= 0.0025;
  const tip = onQuad(a, c, b, t);
  // The tangent there: 2(1 − t)(c − a) + 2t(b − c).
  const dx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x);
  const dy = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
  return {
    d: `M${num(a.x)} ${num(a.y)} Q${num(c.x)} ${num(c.y)} ${num(b.x)} ${num(b.y)}`,
    mid,
    tip: { x: Number(tip.x.toFixed(2)), y: Number(tip.y.toFixed(2)), angle: Number(((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(2)) },
  };
}

/** Below lg, one system: step `step`'s row, 64px tall, from the list's top (px). */
export function listRow(step: number): Rect {
  return { x: 0, y: step * LIST.row, w: 0, h: LIST.row };
}

/**
 * Below lg, Today: step `step`'s cell in the pile, two across (column
 * step % 2, row ⌊step / 2⌋), turned 2° one way on the left and the other
 * way on the right, flipping each row. `x` is the column (0 or 1): the
 * width is half the list's, which only the sheet knows.
 */
export function pileRect(step: number): Rect & { turn: number } {
  const col = step % PILE.cols;
  const row = Math.floor(step / PILE.cols);
  const sign = (col + row) % 2 === 0 ? -1 : 1;
  return { x: col, y: row * PILE.cell, w: 0, h: PILE.cell, turn: sign * PILE.turn };
}

/** Which composition, and which view. */
export type SheetComp = "lanes" | "list";
export type SheetView = "today" | "one";

/**
 * Step `step`'s sheet in `view` on `comp`, in pixels, for a drawing
 * `width` px wide (the lanes' box, or the list): its box before the turn,
 * and the turn about its centre. What erp-drawing.css places each sheet
 * at, worked out here so the stage's timeline can fly a sheet from one
 * place to the other without measuring it. `lanes` is each step's lane
 * (the lanes only).
 */
export function sheetPlace(
  comp: SheetComp,
  view: SheetView,
  step: number,
  width: number,
  lanes: readonly number[],
): Rect & { turn: number } {
  if (comp === "lanes") {
    const u = width / LANES_BOX.w;
    const r = view === "one" ? { ...cardRect(step, lanes[step]), turn: 0 } : paperRect(step);
    return { x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u, turn: r.turn };
  }
  if (view === "one") {
    const left = width < LIST_CARD.narrowUnder ? LIST_CARD.narrowLeft : LIST_CARD.left;
    return { x: left, y: listRow(step).y + LIST_CARD.top, w: width - left, h: LIST_CARD.h, turn: 0 };
  }
  const p = pileRect(step);
  const w = width / 2 - PILE_PAPER.gap / 2;
  return { x: p.x === 0 ? 0 : width / 2 + PILE_PAPER.gap / 2, y: p.y + PILE_PAPER.top, w, h: PILE_PAPER.h, turn: p.turn };
}

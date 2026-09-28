import type { RowId } from "@/lib/pages/crm-erp";

/* ------------------------------------------------------------------ *
 * #move — the rehearsal's geometry: where the spreadsheet, its six rows,
 * their tags, the five records and the leaders between them sit, in both
 * of the figure's compositions, and how far each row's copy travels.
 *
 * ONE COORDINATE SYSTEM PER COMPOSITION. rehearsal-figure.tsx lays an
 * <svg> with this box as its viewBox for every stroke and bar, and the
 * words over the same aspect-ratio box in HTML, each placed in shares of
 * it (`pct`), so a word keeps its 11–13px while the drawing scales and
 * the two always meet.
 *
 *   · WIDE (from md): 960 × 400. The sheet at the left (x 0–384), its
 *     title over it, four columns and six rows of 52u; each row's tag in
 *     the middle (x 470); the five records at the right (x 576–960),
 *     "In the new system" over them, 60u tall and 15u apart. The box is
 *     656px wide at 768 (1u = 0.68px) and 1112 at most (1u = 1.16px).
 *     A dotted leader runs from each row's end, straight past its tag,
 *     then bends to its record's left edge.
 *   · NARROW (below md): 360 × 720. The sheet on top (x 0–324, rows of
 *     42u), each row's tag at its right end; the five records below it,
 *     as wide as the sheet. The box is 248px wide at 320 (1u = 0.69px)
 *     and 400 at most: too narrow for six leaders side by side (a lane
 *     each came to 3.4px at 320, one grey hatch), so none is drawn here.
 *     The gutter on the right (x 324–360) numbers each row instead, 1 to
 *     6, and says beside each record which rows it came from ("3+5" for
 *     the twins: `GUTTER`, `sourcesOf`). `leader` still gives the narrow
 *     path its geometry would take, which the page's test keeps inside
 *     the box.
 *
 * THE COLUMNS are as wide as their names need at the smallest width
 * each composition is drawn at ("Customer" in 11px mono is 53px: 77u at
 * 320, 78u at 768), each with its longest bar a few units short of the
 * next column's rule.
 *
 * EACH ROW'S COPY (rehearsal-figure.tsx `.erp-copy`) is its four bars,
 * drawn once, at rest in its record (`copyRest`): the first line of the
 * record, beside its avatar, over the record's own two short bars. The
 * copy of a row slides from its row to its record as the figure comes
 * up the screen (erp-move.css §1), from `translate: var(--dx) var(--dy)`
 * to none: `copyOffset` is the row's place less the record's, in user
 * units, which an SVG element's CSS `translate` reads as px (an SVG
 * element's transform is in its own user space). The twin's copy (a
 * merged row whose record is its twin's) rests at opacity 0 in that
 * record: merged.
 *
 * A ROW'S BARS are the sample's (LENGTHS): shares of each column's
 * longest bar, the same in both compositions. The twins (rows three and
 * five) share their name and phone, and not their email or last order;
 * row four has no email, where its record carries the "?" (`askAt`).
 *
 * PURE: no React, no DOM, types only from the data module. The figure
 * and lib/pages/crm-erp.test.ts read the same numbers.
 * ------------------------------------------------------------------ */

export type Point = readonly [x: number, y: number];
export type Rect = { x: number; y: number; w: number; h: number };
export type Fig = "wide" | "narrow";

/**
 * Each row's record, by its place in the new system: the twins (rows
 * three and five, the data module's merged pair) share one; every other
 * row has its own. Five records from six rows.
 */
export const CARD_OF: Record<RowId, number> = { r1: 0, r2: 1, r3: 2, r4: 3, r5: 2, r6: 4 };

/** The rows in the sheet's order, top to bottom (the data module's order, which the test holds). */
export const ROWS = Object.keys(CARD_OF) as readonly RowId[];
/** How many records the rows become. */
export const RECORDS = new Set(Object.values(CARD_OF)).size;

/**
 * Each row's bars, as shares of its column's longest (Customer, Email,
 * Phone, Last order); `null` is an empty cell. SAMPLE: no one's data.
 */
// prettier-ignore
const LENGTHS: Record<RowId, readonly [number, number | null, number, number]> = {
  r1: [0.84, 0.9, 0.8, 0.74],
  r2: [0.64, 1, 0.86, 0.9],
  r3: [0.96, 0.72, 0.92, 0.68], // the twins: the same name and phone,
  r4: [0.7, null, 0.8, 0.86], //   no email on file
  r5: [0.96, 0.58, 0.92, 1], //    typed a second time
  r6: [0.76, 0.84, 0.74, 0.6],
};

type Layout = {
  /** The figure's box. */
  view: { w: number; h: number };
  /** The sheet's frame (its column names' band, then its rows), and where its title sits (top left). */
  sheet: Rect;
  sheetTitle: Point;
  /** The column names' band, and each row's height. */
  head: number;
  row: number;
  /** Each column's left edge, from the sheet's, its longest bar, and how far before a column its rule stands. */
  cols: readonly [number, number, number, number];
  colMax: readonly [number, number, number, number];
  rule: number;
  /** A bar's thickness. */
  bar: number;
  /** The records: the first one's box, and the step to the next; where "In the new system" sits. */
  card: Rect & { step: number; r: number };
  cardsTitle: Point;
  /** Inside a record: the avatar, the copy's origin (its first bar's left end, on its centre line), the record's own two bars. */
  disc: { cx: number; cy: number; r: number };
  copyAt: Point;
  own: { y: number; h: number; bars: readonly (readonly [x: number, w: number])[] };
  /** Where a row's tag sits: centred on x, or ending at x. */
  tag: { x: number; align: "center" | "end" };
  /** The tick at a row's end (wide only: the narrow sheet's row ends at its tag). */
  tick: number | null;
};

export const LAYOUTS: Record<Fig, Layout> = {
  wide: {
    view: { w: 960, h: 400 },
    sheet: { x: 0, y: 36, w: 384, h: 32 + 6 * 52 },
    sheetTitle: [0, 0],
    head: 32,
    row: 52,
    cols: [12, 100, 188, 276],
    colMax: [72, 76, 60, 52],
    rule: 6,
    bar: 8,
    card: { x: 576, y: 36, w: 384, h: 60, step: 75, r: 10 },
    cardsTitle: [576, 0],
    disc: { cx: 26, cy: 30, r: 12 },
    copyAt: [50, 22],
    own: { y: 42, h: 6, bars: [[50, 88], [148, 52]] },
    tag: { x: 470, align: "center" },
    tick: 366,
  },
  narrow: {
    view: { w: 360, h: 720 },
    sheet: { x: 0, y: 32, w: 324, h: 28 + 6 * 42 },
    sheetTitle: [0, 0],
    head: 28,
    row: 42,
    cols: [4, 89, 145, 201],
    colMax: [64, 44, 44, 33],
    rule: 5,
    bar: 8,
    card: { x: 0, y: 360, w: 324, h: 60, step: 72, r: 10 },
    cardsTitle: [0, 326],
    disc: { cx: 24, cy: 30, r: 11 },
    copyAt: [46, 22],
    own: { y: 42, h: 6, bars: [[46, 64], [118, 40]] },
    tag: { x: 320, align: "end" },
    tick: null,
  },
};

/** A leader's corner in the narrow gutter, and its lanes: row one's outermost, then 5u in for each row after it. */
const CORNER = 3;
const LANE = { outer: 356, step: 5 } as const;
/** Below md, the gutter's centre line, where each row's number and each record's sources stand. */
export const GUTTER = 342;
/** Where a wide leader starts (just past the sheet), where it bends, and where it meets a record. */
const WIDE_LEAD = { from: 390, bend: 524, to: 572 } as const;

/** A share of the box, for an HTML word placed over the drawing. */
export const pct = (v: number, of: number) => `${(v / of) * 100}%`;

const indexOf = (id: RowId) => {
  const k = ROWS.indexOf(id);
  if (k < 0) throw new Error(`rehearsal-geometry: no row "${id}"`);
  return k;
};

/** A row's band in the sheet, under the column names. */
export function rowBand(fig: Fig, id: RowId): Rect {
  const L = LAYOUTS[fig];
  return { x: L.sheet.x, y: L.sheet.y + L.head + indexOf(id) * L.row, w: L.sheet.w, h: L.row };
}

/** A row's centre line. */
export const rowY = (fig: Fig, id: RowId) => {
  const band = rowBand(fig, id);
  return band.y + band.h / 2;
};

/**
 * A row's bars, each from the copy's origin (its first bar's left end,
 * on the row's centre line): the same shapes in the sheet and in the
 * copy. An empty cell has no bar.
 */
export function barsOf(fig: Fig, id: RowId): Rect[] {
  const L = LAYOUTS[fig];
  return LENGTHS[id].flatMap((share, c) =>
    share === null ? [] : [{ x: L.cols[c] - L.cols[0], y: -L.bar / 2, w: Math.round(share * L.colMax[c]), h: L.bar }],
  );
}

/** Where a row's bars start in the sheet: its first column's left end, on its centre line. */
export function rowOrigin(fig: Fig, id: RowId): Point {
  const L = LAYOUTS[fig];
  return [L.sheet.x + L.cols[0], rowY(fig, id)];
}

/** Record `i`'s box. */
export function cardRect(fig: Fig, i: number): Rect {
  const { card } = LAYOUTS[fig];
  return { x: card.x, y: card.y + i * card.step, w: card.w, h: card.h };
}

/** Where a row's copy rests: in its record, beside the avatar. */
export function copyRest(fig: Fig, id: RowId): Point {
  const L = LAYOUTS[fig];
  const c = cardRect(fig, CARD_OF[id]);
  return [c.x + L.copyAt[0], c.y + L.copyAt[1]];
}

/** How far a copy is from its row, at rest: `--dx`, `--dy`, which the slide starts from. */
export function copyOffset(fig: Fig, id: RowId): { dx: number; dy: number } {
  const [rx, ry] = rowOrigin(fig, id);
  const [cx, cy] = copyRest(fig, id);
  return { dx: rx - cx, dy: ry - cy };
}

/** A row's tag: its anchor point, centred on it or ending at it (LAYOUTS' `tag.align`). */
export function tagAt(fig: Fig, id: RowId): Point {
  return [LAYOUTS[fig].tag.x, rowY(fig, id)];
}

/** The "?" in the record of a row with an empty cell: the middle of where that cell's bar would be. */
export function askAt(fig: Fig, id: RowId): Point | null {
  const L = LAYOUTS[fig];
  const c = LENGTHS[id].indexOf(null);
  if (c < 0) return null;
  const [x, y] = copyRest(fig, id);
  return [x + L.cols[c] - L.cols[0] + L.colMax[c] / 2, y];
}

/** A record's centre line. */
const cardY = (fig: Fig, i: number) => {
  const c = cardRect(fig, i);
  return c.y + c.h / 2;
};

/**
 * A row's leader, as an SVG `d`. Wide: straight from the sheet's edge
 * past the tag, then an S-bend to the record's left edge. Narrow (its
 * geometry only: the figure draws no leader below md, and numbers the
 * gutter instead): right into the row's own lane in the gutter, down it,
 * and left into the record's right edge.
 */
export function leader(fig: Fig, id: RowId): string {
  const y = rowY(fig, id);
  const cy = cardY(fig, CARD_OF[id]);
  if (fig === "wide") {
    const { from, bend, to } = WIDE_LEAD;
    const mid = (bend + to) / 2;
    return `M${from} ${y} H${bend} C${mid} ${y} ${mid} ${cy} ${to} ${cy}`;
  }
  const L = LAYOUTS.narrow;
  const x0 = L.sheet.x + L.sheet.w + 2;
  const lane = LANE.outer - indexOf(id) * LANE.step;
  return `M${x0} ${y} H${lane - CORNER} Q${lane} ${y} ${lane} ${y + CORNER} V${cy - CORNER} Q${lane} ${cy} ${lane - CORNER} ${cy} H${x0}`;
}

/** Below md, a row's number in the gutter: 1 to 6, on its centre line. */
export function rowNumberAt(id: RowId): Point {
  return [GUTTER, rowY("narrow", id)];
}

/** Below md, record `i`'s sources in the gutter, on its centre line: the rows it came from, by number ("3+5" for the twins). */
export function sourcesOf(i: number): { at: Point; rows: string } {
  const rows = ROWS.flatMap((id, k) => (CARD_OF[id] === i ? [String(k + 1)] : []));
  return { at: [GUTTER, cardY("narrow", i)], rows: rows.join("+") };
}

/**
 * When each piece of a row moves, as shares of the figure's one window
 * (erp-move.css §1): the leaders draw one after another first, then each
 * copy slides into its record in turn, and its tag (with its tick, and
 * the record's "?") pops as the copy lands.
 */
export function slices(id: RowId) {
  const k = indexOf(id);
  const slide = 0.3 + 0.08 * k;
  return {
    leader: [0.04 * k, 0.12] as const,
    copy: [slide, 0.2] as const,
    tag: [slide + 0.2, 0.06] as const,
  };
}

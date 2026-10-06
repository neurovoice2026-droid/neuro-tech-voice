/**
 * REEL 1 · THE WEEK GRID's geometry (docs/ig/SCRIPT.md ig1 b2–b5): 7 day columns × 24 hour rows of rounded cells in the
 * stage band, x 130–890, y 360–1122 (the caption column x 86–906 with the hour gutter at its left), and the orders the
 * picture runs through it — the staffed block, the teal cascade from Friday 18:00, the outline wave.
 *
 * Pure data and functions (the WeekGrid, the cover and the cue sheet's counts read it). Frame px at camera scale 1.
 */

export const GRID = {
  cols: 7,
  rows: 24,
  x0: 130,
  y0: 360,
  /** a cell, and the gaps between cells */
  cw: 94,
  ch: 26,
  gx: 17,
  gy: 6,
  radius: 6,
} as const;
export const PITCH = { x: GRID.cw + GRID.gx, y: GRID.ch + GRID.gy } as const;
export const GRID_W = GRID.cols * GRID.cw + (GRID.cols - 1) * GRID.gx;
export const GRID_H = GRID.rows * GRID.ch + (GRID.rows - 1) * GRID.gy;
export const GRID_X1 = GRID.x0 + GRID_W;
export const GRID_Y1 = GRID.y0 + GRID_H;
/** the camera plane's origin: the grid's centre (every zoom keeps the grid in its column) */
export const GRID_C = { x: GRID.x0 + GRID_W / 2, y: GRID.y0 + GRID_H / 2 } as const;

/** the front desk's hours: 9 to 6 (rows 9–17), Monday to Friday (columns 0–4) — 45 of the week's 168 */
export const OPEN = { c0: 0, c1: 4, r0: 9, r1: 17 } as const;
export const staffed = (c: number, r: number) => c >= OPEN.c0 && c <= OPEN.c1 && r >= OPEN.r0 && r <= OPEN.r1;

export const cellX = (c: number) => GRID.x0 + c * PITCH.x;
export const cellY = (r: number) => GRID.y0 + r * PITCH.y;

/** the staffed block's box */
export const BLOCK = {
  x: cellX(OPEN.c0),
  y: cellY(OPEN.r0),
  w: cellX(OPEN.c1) + GRID.cw - cellX(OPEN.c0),
  h: cellY(OPEN.r1) + GRID.ch - cellY(OPEN.r0),
} as const;

export type Cell = { c: number; r: number; x: number; y: number; open: boolean };
export const CELLS: readonly Cell[] = Array.from({ length: GRID.cols * GRID.rows }, (_, i) => {
  const c = i % GRID.cols;
  const r = Math.floor(i / GRID.cols);
  return { c, r, x: cellX(c), y: cellY(r), open: staffed(c, r) };
});
/** 168 − 45 = 123 */
export const EMPTY_COUNT = CELLS.filter((k) => !k.open).length;

/**
 * THE TEAL CASCADE's order (b3): it starts where the desk closes — Friday 18:00 — and runs through the nights and the
 * weekend as a front travelling outward in hours-of-the-week: a cell's delay is its distance from Friday 18:00 in
 * frame px (a ripple through the grid), normalised to 0..1 over the 123 cells.
 */
const ORIGIN = { x: cellX(OPEN.c1) + GRID.cw / 2, y: cellY(OPEN.r1 + 1) + GRID.ch / 2 };
const dist = (k: Cell) => Math.hypot(k.x + GRID.cw / 2 - ORIGIN.x, (k.y + GRID.ch / 2 - ORIGIN.y) * 1.35);
const MAX_D = Math.max(...CELLS.filter((k) => !k.open).map(dist));
/** 0..1: when the cascade reaches a cell (0 = Friday 18:00) */
export const cascadeAt = (k: Cell) => dist(k) / MAX_D;

/** THE OUTLINE WAVE (b2, "a hundred and sixty-eight"): one diagonal wave from the top-left corner, 0..1 */
export const waveAt = (k: Cell) => (k.c / (GRID.cols - 1)) * 0.42 + (k.r / (GRID.rows - 1)) * 0.58;

/** the hour gutter's ticks (Geist Mono 28, right-aligned at x 118, on their rows' centres) */
export const TICKS = [
  { text: '09', row: OPEN.r0 },
  { text: '18', row: OPEN.r1 + 1 },
] as const;

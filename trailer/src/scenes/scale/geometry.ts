/**
 * SCALE geometry — every position and size in the scene, per orientation.
 * All rects are in screen pixels of the depth-1 layer (the camera is at
 * rest from the flow onwards, so the rail's last node is exactly FLOW_END).
 */
import { FLOW_END } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const centre = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const mixRect = (a: Rect, b: Rect, p: number): Rect => ({
  x: a.x + (b.x - a.x) * p,
  y: a.y + (b.y - a.y) * p,
  w: a.w + (b.w - a.w) * p,
  h: a.h + (b.h - a.h) * p,
});

/** The tray's padding and the gaps between its cards (site: 8 px padding). */
const PAD = 8;
const GAP = 10;
const LGAP = 12;

function grid(tray: Rect, cols: number, rows: number, gap: number, n: number): Rect[] {
  const w = (tray.w - 2 * PAD - (cols - 1) * gap) / cols;
  const h = (tray.h - 2 * PAD - (rows - 1) * gap) / rows;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return { x: tray.x + PAD + c * (w + gap), y: tray.y + PAD + r * (h + gap), w, h };
  });
}

export function geo(L: Layout) {
  const v = L.vertical;

  /* ── heading block (top-left, inside the safe margins) ─────────── */
  const head = {
    x: L.safe.x,
    eyebrowY: L.pick(84, 170), // top of the eyebrow row
    titleY: L.pick(122, 208), // top of the title line box
    titleSize: L.pick(96, 88),
  };

  /* ── the #use-cases tray and its 16 cards ──────────────────────── */
  const tray: Rect = L.pick(
    { x: 120, y: 262, w: 1680, h: 738 },
    { x: 86, y: 350, w: 908, h: 1410 },
  );
  const cards = grid(tray, v ? 2 : 4, v ? 8 : 4, GAP, 16);

  /* ── the six language cells (same tray) ────────────────────────── */
  const cells = grid(tray, v ? 2 : 3, v ? 3 : 2, LGAP, 6);
  /**
   * Which industry card becomes which language cell (by language order).
   * Each is the card nearest its cell; the last (Clinics & dental, the
   * selected card at the end of the montage) becomes Japanese in both.
   */
  const stay = v ? [0, 3, 6, 9, 12, 15] : [0, 5, 3, 12, 10, 15];

  /* ── the after-call rail ───────────────────────────────────────
   * The last node is FLOW_END. 16:9: three 500 px cards centred on their
   * nodes, 36 px apart (198…1770), so the stage's 4 % push-in about FLOW_END
   * still keeps the left card inside the safe margin. 9:16: 820 × 210 cards
   * under their nodes, 480 px spacing. */
  const end = FLOW_END(L);
  const S = L.pick(536, 480);
  const nodes: Pt[] = [0, 1, 2].map((i) =>
    v ? { x: end.x, y: end.y - (2 - i) * S } : { x: end.x - (2 - i) * S, y: end.y },
  );
  const stW = L.pick(500, 820);
  const stH = L.pick(200, 210);
  const stations: Rect[] = nodes.map((n) => ({ x: n.x - stW / 2, y: n.y + L.pick(40, 44), w: stW, h: stH }));
  /** station label anchors (vertical centre of the label line): beside their node,
   *  sitting on the rail in 16:9, to the right of the node in 9:16 */
  const labels: Pt[] = nodes.map((n) => (v ? { x: n.x + 26, y: n.y } : { x: n.x + 22, y: n.y - 23 }));
  /** the after-call stage the tray becomes (#f3f1f8, like the site's) */
  const stage: Rect = L.pick(
    { x: 172, y: 476, w: 1624, h: 364 },
    { x: 86, y: 440, w: 908, h: 1330 },
  );

  return { head, tray, cards, cells, stay, nodes, stations, labels, stage, end };
}
export type Geo = ReturnType<typeof geo>;

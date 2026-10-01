/**
 * SCALE geometry — every position and size in the scene, per orientation.
 * All rects are in the depth-1 layer's world pixels; with the camera at rest
 * (zoom 1, no offset — the flow) world = screen, so the rail's last node is
 * exactly FLOW_END.
 *
 *   wall        a 4 × 4 wall of white cards, a composed grid with air around
 *               it (16:9 1760 × 960 · 9:16 960 × 1200 inside the safe box
 *               y 250…1500), centred on the framing anchor. The cards pop in
 *               the block order (POP_CELL): card 01 alone → 2 × 2 → 3 × 3 →
 *               the wall, while the camera pulls back continuously, always
 *               framing the cards popped so far (plus the next slot: lead
 *               room) with ≥ 64 px / 60 px margins (scale/camera.ts).
 *   languages   ONE card in focus (the active language, large, under the
 *               title band; English, the first, larger still) and a gallery
 *               of the ones already said (16:9 a row of five under it · 9:16
 *               3 + 2 under it), so by Japanese all six are visible together.
 *   flow        call → Slack → CRM: three big stations on a closing-light
 *               rail; the CRM node is FLOW_END. Sized so that with the slow
 *               push about FLOW_END nothing comes nearer than ~110 px (16:9)
 *               / 70 px (9:16) to a frame edge at the iris.
 *   titles      one slot, centred: "16 industries." slams centred on the
 *               wall, then lifts to the band, where "14 languages." and
 *               "After the call." follow it (9:16 cap tops ≥ 290, under the
 *               Reels/TikTok top UI).
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
const bounds = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const x2 = Math.max(...rs.map((r) => r.x + r.w));
  const y2 = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
};

/** [row, col] of industry i: the camera's blocks, filled in order (2 × 2 | 3 × 3 | 4 × 4). */
export const POP_CELL: readonly (readonly [number, number])[] = [
  [0, 0], [0, 1], [1, 0], [1, 1],
  [0, 2], [1, 2], [2, 0], [2, 1], [2, 2],
  [0, 3], [1, 3], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3],
];

/** a cols × rows grid inside `box`, `gap` between cells */
function cellsOf(box: Rect, cols: number, rows: number, gap: number): Rect[][] {
  const w = (box.w - (cols - 1) * gap) / cols;
  const h = (box.h - (rows - 1) * gap) / rows;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ x: box.x + c * (w + gap), y: box.y + r * (h + gap), w, h })),
  );
}

export function geo(L: Layout) {
  const v = L.vertical;
  const W = L.width;
  const H = L.height;

  /* ── the industry wall (4 × 4) ──────────────────────────────────── */
  /** the framing box (screen): every framing of the wall keeps its cards inside it — ≥ 64 px from the
   *  16:9 frame edges, ≥ 60 px from the 9:16 sides and inside its safe zone (y 250…1500) */
  const frame: Rect = L.pick({ x: 64, y: 64, w: 1792, h: 952 }, { x: 60, y: 262, w: 960, h: 1226 });
  /** the camera's screen anchor: the framing box's centre (the wall's centre at rest, zoom 1) */
  const anchor: Pt = centre(frame);
  const wall: Rect = L.pick({ x: 80, y: 60, w: 1760, h: 960 }, { x: 60, y: 275, w: 960, h: 1200 });
  const wallCells = cellsOf(wall, 4, 4, 12); // 431 × 231 · 231 × 291
  /** card rect of industry i */
  const cards: Rect[] = POP_CELL.map(([r, c]) => wallCells[r][c]);
  /** the cluster on screen once card i has popped: the bounds of cards 0 … i */
  const cluster: Rect[] = cards.map((_, i) => bounds(cards.slice(0, i + 1)));

  /* ── the languages ──────────────────────────────────────────────── */
  /** the active language's card (from Romanian on); English, alone on the stage, is larger */
  // (the quick four show one heard line, Japanese two: the card is sized for that, not for a paragraph)
  const lang: Rect = L.pick({ x: 330, y: 236, w: 1260, h: 500 }, { x: 60, y: 446, w: 960, h: 480 });
  const langEn: Rect = L.pick({ x: 290, y: 226, w: 1340, h: 640 }, { x: 60, y: 456, w: 960, h: 680 });
  /** the gallery: the five cards already said, in order (9:16 ≥ 60 px from the sides) */
  const gallery: Rect[] = v
    ? [
        ...[0, 1, 2].map((i) => ({ x: 60 + i * (304 + 24), y: 1010, w: 304, h: 204 })),
        ...[0, 1].map((i) => ({ x: 224 + i * (304 + 24), y: 1238, w: 304, h: 204 })),
      ]
    : [0, 1, 2, 3, 4].map((i) => ({ x: 62 + i * (340 + 24), y: 822, w: 340, h: 184 }));

  /**
   * The keeper: the wall card that becomes English — the one nearest the
   * English card's centre (a centre card, so its glide is short).
   */
  let keeper = 0;
  {
    const c = centre(langEn);
    let bd = Infinity;
    cards.forEach((r, i) => {
      const p = centre(r);
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < bd - 0.5) {
        bd = d;
        keeper = i;
      }
    });
  }

  /* ── titles: one centred slot ───────────────────────────────────── */
  const title = {
    /** "16 industries." — centred on the wall (cap centre), size in px */
    hero: L.pick({ x: L.cx, y: L.cy, size: 160 }, { x: L.cx, y: centre(wall).y, size: 140 }),
    /** the band: "14 languages." / "After the call." (cap centre; 9:16 cap top ≈ 293) */
    band: L.pick({ x: L.cx, y: 118, size: 108 }, { x: L.cx, y: 332, size: 104 }),
    /** "After the call." — over the rail in 16:9 (the flow hangs off FLOW_END's row) */
    after: L.pick({ x: L.cx, y: 262, size: 112 }, { x: L.cx, y: 332, size: 104 }),
  };

  /* ── the after-call rail ─────────────────────────────────────────
   * The last node is FLOW_END (fixed: the CTA irises open from it). 16:9:
   * nodes on a horizontal rail 550 apart, the names (64 px) above, 520 × 350
   * cards hanging under them (x 160 … 1780, y 604 … 954): after the push
   * about FLOW_END the block sits ≥ 110 px inside every edge. 9:16: a
   * vertical rail at x 150, nodes 345 apart, 770 × 316 cards to its right
   * (x 210 … 980, y 452 … 1458, inside the safe box, clear of the band title
   * and of the right-hand action rail). */
  const end = FLOW_END(L);
  const nodes: Pt[] = [0, 1, 2].map((i) =>
    v ? { x: end.x, y: end.y - (2 - i) * 345 } : { x: end.x - (2 - i) * 550, y: end.y },
  );
  const stations: Rect[] = nodes.map((n) =>
    v ? { x: 210, y: n.y - 158, w: 770, h: 316 } : { x: n.x - 260, y: 604, w: 520, h: 350 },
  );
  /** 16:9: station name centres, above the nodes */
  const names: Pt[] = nodes.map((n) => ({ x: n.x, y: 474 }));

  return { W, H, frame, anchor, wall, cards, cluster, lang, langEn, gallery, keeper, title, nodes, stations, names, end };
}
export type Geo = ReturnType<typeof geo>;

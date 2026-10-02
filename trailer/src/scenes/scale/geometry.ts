/**
 * SCALE geometry — every position and size in the scene, per orientation.
 * All rects are in the depth-1 layer's world pixels; with the camera at rest
 * (zoom 1, no offset — the flow) world = screen, so the rail's last node is
 * exactly FLOW_END.
 *
 *   index       the sixteen industries as a TYPESET INDEX (scale/Index.tsx):
 *               16:9 four columns × four rows at 54 px, 9:16 two columns ×
 *               eight rows at 52 px, on a fixed row pitch, ≥ 150 px from every
 *               side. The rows are set in two halves with a SPINE between them
 *               — the band where "16 industries." will land — so no name ever
 *               sits behind the hero. The names land in INDEX_CELL order (the
 *               top half on the 8th notes, the bottom half on the 16ths) while
 *               the camera pulls back, always framing the names landed so far
 *               (scale/camera.ts) inside `frame`.
 *   languages   ONE card in focus (the active language, large, under the
 *               title band; English, the first, larger still) and a gallery
 *               of the ones already said (16:9 a row of five under it, ≥ 160 px
 *               from the sides · 9:16 3 + 2 under it), so by Japanese all six
 *               are visible together.
 *   flow        call → Slack → CRM: three big stations on a closing-light
 *               rail; the CRM node is FLOW_END. 9:16: the rail + cards block is
 *               centred on the frame (its title's axis).
 *   titles      one slot, centred: "16 industries." (152 / 124 px) lands in
 *               the index's spine, then lifts to the band, where "14
 *               languages." and "After the call." (100 / 92 px) follow it
 *               (9:16 cap tops ≥ 290, under the Reels/TikTok top UI).
 */
import { FLOW_END } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { INDUSTRIES, LINE_EM } from './data';

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

/**
 * [row, col] of industry i in the index, per orientation. 16:9: the top half fills in column pairs
 * (the frame opens one column per two names), the bottom half row by row (a running light on the
 * 16ths). 9:16: reading order, two columns.
 */
export const INDEX_CELL: readonly [readonly (readonly [number, number])[], readonly (readonly [number, number])[]] = [
  [
    [0, 0], [0, 1], [1, 0], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3],
    [2, 0], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3],
  ],
  Array.from({ length: 16 }, (_, i) => [i >> 1, i & 1] as const),
];

/** the index's setting per orientation: size (px), line height, column x's, row tops (fixed pitch, two halves) */
export const INDEX_SET = {
  h: { size: 54, lh: 1.06, cols: [180, 590, 1000, 1410], rows: [158, 294, 668, 804] },
  v: { size: 52, lh: 1.06, cols: [150, 570], rows: [286, 422, 558, 694, 989, 1125, 1261, 1397] },
} as const;

export function geo(L: Layout) {
  const v = L.vertical;
  const W = L.width;
  const H = L.height;

  /* ── the industry index ───────────────────────────────────────── */
  /** the framing box (screen): every framing of the index keeps the names landed so far inside it — the
   *  whole index at ≈ 1 sits ≥ 176 px from the 16:9 sides (≥ 80 px in 9:16, inside its safe zone) */
  const frame: Rect = L.pick({ x: 176, y: 150, w: 1568, h: 780 }, { x: 80, y: 280, w: 920, h: 1190 });
  /** the camera's screen anchor: the framing box's centre (= the index's centre at rest, zoom 1) */
  const anchor: Pt = centre(frame);
  const S = v ? INDEX_SET.v : INDEX_SET.h;
  const lineH = S.size * S.lh;
  /** industry i: where it is set and its lines; `box` = its ink extents (the camera frames those) */
  const entries = INDUSTRIES.map((d, i) => {
    const [r, c] = INDEX_CELL[v ? 1 : 0][i];
    const lines = d.lines[v ? 1 : 0];
    const w = Math.max(...lines.map((ln) => (LINE_EM[ln] ?? 0.55 * ln.length) * S.size));
    const box: Rect = { x: S.cols[c], y: S.rows[r], w, h: lines.length * lineH };
    return { r, c, lines, box };
  });
  /** the index's bounds, centred EXACTLY on the anchor (so the camera at rest is world = screen) */
  const wall: Rect = L.pick({ x: 180, y: 158, w: 1560, h: 764 }, { x: 150, y: 286, w: 780, h: 1178 });
  /** entry rect of industry i (the camera's "cards") */
  const cards: Rect[] = entries.map((e) => e.box);
  /** the cluster on screen once name i has landed: the bounds of names 0 … i */
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
    : // (≥ 160 px from the sides, its bottom ≤ 978 — ≤ 990 under the 2.5 % language push)
      [0, 1, 2, 3, 4].map((i) => ({ x: 162 + i * (300 + 24), y: 810, w: 300, h: 168 }));

  /* ── titles: one centred slot ───────────────────────────────────── */
  const title = {
    /** "16 industries." — in the index's spine (cap centre), size in px */
    hero: L.pick({ x: L.cx, y: L.cy, size: 152 }, { x: L.cx, y: centre(wall).y, size: 124 }),
    /** the band: "14 languages." / "After the call." (cap centre; 9:16 cap top ≈ 293) */
    band: L.pick({ x: L.cx, y: 120, size: 100 }, { x: L.cx, y: 334, size: 92 }),
    /** "After the call." — over the rail in 16:9 (the flow hangs off FLOW_END's row) */
    after: L.pick({ x: L.cx, y: 262, size: 100 }, { x: L.cx, y: 334, size: 92 }),
  };

  /* ── the after-call rail ─────────────────────────────────────────
   * The last node is FLOW_END (fixed: the CTA irises open from it). 16:9:
   * nodes on a horizontal rail 550 apart, the names (64 px) above, 520 × 350
   * cards hanging under them (x 160 … 1780, y 604 … 954): after the push
   * about FLOW_END the block sits ≥ 110 px inside every edge. 9:16: a
   * vertical rail at x 150, nodes 345 apart, 720 × 316 cards to its right
   * (x 210 … 930, y 452 … 1458): the rail + cards block (x 135 … 930, and
   * 135 … 952 under the slow push about FLOW_END) is centred on x ≈ 540, the
   * axis of the centred band title. */
  const end = FLOW_END(L);
  const nodes: Pt[] = [0, 1, 2].map((i) =>
    v ? { x: end.x, y: end.y - (2 - i) * 345 } : { x: end.x - (2 - i) * 550, y: end.y },
  );
  const stations: Rect[] = nodes.map((n) =>
    v ? { x: 210, y: n.y - 158, w: 720, h: 316 } : { x: n.x - 260, y: 604, w: 520, h: 350 },
  );
  /** 16:9: station name centres, above the nodes */
  const names: Pt[] = nodes.map((n) => ({ x: n.x, y: 474 }));

  return { W, H, frame, anchor, wall, entries, size: S.size, lineH, cards, cluster, lang, langEn, gallery, title, nodes, stations, names, end };
}
export type Geo = ReturnType<typeof geo>;

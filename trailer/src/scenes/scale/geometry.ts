/**
 * SCALE geometry — every position and size in the scene, per orientation.
 * All rects are in the depth-1 layer's world pixels; with the camera at rest
 * (zoom 1, no offset — the flow) world = screen, so the rail's last node is
 * exactly FLOW_END.
 *
 *   wall        a 4 × 4 wall of white cards, edge to edge (9:16: inside the
 *               safe box y 262…1490). The cards pop in the camera's block
 *               order (POP_CELL): card 01 alone → 2 × 2 → 3 × 3 → the wall,
 *               while the camera pulls back continuously.
 *   languages   ONE card in focus (the active language, large, under the
 *               title band; English, the first, larger still) and a gallery
 *               of the ones already said (16:9 a row of five under it · 9:16
 *               3 + 2 under it), so by Japanese all six are visible together.
 *   flow        call → Slack → CRM: three big stations on a closing-light
 *               rail; the CRM node is FLOW_END.
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
  const wall: Rect = L.pick({ x: 16, y: 16, w: 1888, h: 1048 }, { x: 16, y: 262, w: 1048, h: 1228 });
  const wallCells = cellsOf(wall, 4, 4, 12); // 463 × 253 · 253 × 298
  /** card rect of industry i */
  const cards: Rect[] = POP_CELL.map(([r, c]) => wallCells[r][c]);

  /** the camera's framings: card 01 → 2 × 2 → 3 × 3 → the whole frame */
  const blocks: Rect[] = [1, 2, 3].map((n) => bounds(wallCells.slice(0, n).flatMap((row) => row.slice(0, n))));
  /** zoom that frames each block (0.94 of the tighter side); the last is the frame itself */
  const zooms = [...blocks.map((b) => 0.94 * Math.min(W / b.w, H / b.h)), 1];
  const focus: Pt[] = [...blocks.map(centre), { x: L.cx, y: L.cy }];

  /* ── the languages ──────────────────────────────────────────────── */
  /** the active language's card (from Romanian on); English, alone on the stage, is larger */
  const lang: Rect = L.pick({ x: 360, y: 236, w: 1200, h: 540 }, { x: 40, y: 440, w: 1000, h: 560 });
  const langEn: Rect = L.pick({ x: 300, y: 250, w: 1320, h: 620 }, { x: 40, y: 470, w: 1000, h: 660 });
  /** the gallery: the five cards already said, in order */
  const gallery: Rect[] = v
    ? [
        ...[0, 1, 2].map((i) => ({ x: 40 + i * (316 + 26), y: 1036, w: 316, h: 204 })),
        ...[0, 1].map((i) => ({ x: 211 + i * (316 + 26), y: 1262, w: 316, h: 204 })),
      ]
    : [0, 1, 2, 3, 4].map((i) => ({ x: 62 + i * (340 + 24), y: 816, w: 340, h: 210 }));

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
    band: L.pick({ x: L.cx, y: 126, size: 112 }, { x: L.cx, y: 332, size: 104 }),
  };

  /* ── the after-call rail ─────────────────────────────────────────
   * The last node is FLOW_END. 16:9: nodes on a horizontal rail 590 apart,
   * the names (64 px) above, 560 × 428 cards hanging under them. 9:16: a
   * vertical rail at x 150, nodes 356 apart, 818 × 330 cards to its right
   * (y 423 … 1465, inside the safe box, clear of the band title). */
  const end = FLOW_END(L);
  const nodes: Pt[] = [0, 1, 2].map((i) =>
    v ? { x: end.x, y: end.y - (2 - i) * 356 } : { x: end.x - (2 - i) * 590, y: end.y },
  );
  const stations: Rect[] = nodes.map((n) =>
    v ? { x: 222, y: n.y - 165, w: 818, h: 330 } : { x: n.x - 280, y: 612, w: 560, h: 428 },
  );
  /** 16:9: station name centres, above the nodes */
  const names: Pt[] = nodes.map((n) => ({ x: n.x, y: 470 }));

  return { W, H, wall, cards, blocks, zooms, focus, lang, langEn, gallery, keeper, title, nodes, stations, names, end };
}
export type Geo = ReturnType<typeof geo>;

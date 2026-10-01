/**
 * SCALE geometry — every position and size in the scene, per orientation.
 * All rects are in the depth-1 layer's world pixels; with the camera at rest
 * (zoom 1, no offset — the flow) world = screen, so the rail's last node is
 * exactly FLOW_END.
 *
 *   industries  a 4 × 4 wall of white cards, edge to edge (9:16: inside the
 *               safe box, the wash above and below). The cards pop in the
 *               camera's block order (POP_CELL): card 01 alone → 2 × 2 →
 *               3 × 3 → the full wall.
 *   languages   THREE keepers glide into three big cells under the title band
 *               (16:9 three tall columns · 9:16 three full-width rows); each
 *               cell shows two languages, one page after the other.
 *   flow        call → Slack → CRM, three big stations on a closing-light rail
 *               that fill the frame.
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
/** the last card of each camera block (the block is complete when it lands) */
export const BLOCK_END = [0, 3, 8, 15] as const;

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
  const wall: Rect = L.pick({ x: 16, y: 16, w: 1888, h: 1048 }, { x: 12, y: 220, w: 1056, h: 1260 });
  const wallCells = cellsOf(wall, 4, 4, 12); // 463 × 253 · 255 × 306
  /** card rect of industry i */
  const cards: Rect[] = POP_CELL.map(([r, c]) => wallCells[r][c]);

  /** the camera's blocks: card 01 → 2 × 2 → 3 × 3 → the whole frame */
  const blocks: Rect[] = [1, 2, 3].map((n) => bounds(wallCells.slice(0, n).flatMap((row) => row.slice(0, n))));
  /** zoom that frames each block (0.94 of the tighter side); the last is the frame itself */
  const zooms = [...blocks.map((b) => 0.94 * Math.min(W / b.w, H / b.h)), 1];
  const focus: Pt[] = [...blocks.map(centre), { x: L.cx, y: L.cy }];

  /* ── the three language cells (two pages of three languages) ─────── */
  const langBox: Rect = L.pick({ x: 16, y: 236, w: 1888, h: 828 }, { x: 12, y: 390, w: 1056, h: 1080 });
  const cells: Rect[] = cellsOf(langBox, v ? 1 : 3, v ? 3 : 1, 12).flat(); // 621 × 828 · 1056 × 352
  /**
   * Which industry card becomes which language cell: each cell takes the
   * nearest unused card; the last cell (Spanish, then Japanese) always takes
   * the last card (POP_CELL[15]), because it becomes the call.
   */
  const stay: number[] = [];
  {
    const used = new Set<number>([15]);
    for (let k = 0; k < cells.length - 1; k++) {
      const c = centre(cells[k]);
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < 16; i++) {
        if (used.has(i)) continue;
        const p = centre(cards[i]);
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < bd - 0.5) {
          bd = d;
          best = i;
        }
      }
      used.add(best);
      stay.push(best);
    }
    stay.push(15);
  }

  /* ── titles ─────────────────────────────────────────────────────── */
  const title = {
    /** "16 industries." — centred on the wall, size in px */
    hero: L.pick({ x: L.cx, y: L.cy, size: 160 }, { x: L.cx, y: centre(wall).y, size: 140 }),
    /** "14 languages." — the top band: left edge x (on the cells' text column), cap-centre y */
    band: L.pick({ x: 46, y: 116, size: 120 }, { x: 34, y: 290, size: 110 }),
    /** "After the call." — top-left of its line box (on the station cards' left edge) */
    after: L.pick({ x: 60, y: 130, size: 96 }, { x: 60, y: 232, size: 88 }),
  };

  /* ── the after-call rail ─────────────────────────────────────────
   * The last node is FLOW_END. 16:9: nodes on a horizontal rail 590 apart,
   * the names (64 px) above, 560 × 428 cards hanging under them — the frame
   * filled from 60 to 1800, 612 to 1040. 9:16: a vertical rail at x 150,
   * nodes 390 apart, 834 × 350 cards to its right. */
  const end = FLOW_END(L);
  const nodes: Pt[] = [0, 1, 2].map((i) =>
    v ? { x: end.x, y: end.y - (2 - i) * 390 } : { x: end.x - (2 - i) * 590, y: end.y },
  );
  const stations: Rect[] = nodes.map((n) =>
    v ? { x: 226, y: n.y - 165, w: 834, h: 350 } : { x: n.x - 280, y: 612, w: 560, h: 428 },
  );
  /** 16:9: station name centres, above the nodes */
  const names: Pt[] = nodes.map((n) => ({ x: n.x, y: 470 }));

  return { wall, cards, blocks, zooms, focus, cells, stay, title, nodes, stations, names, end };
}
export type Geo = ReturnType<typeof geo>;

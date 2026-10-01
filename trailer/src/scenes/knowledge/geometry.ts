/**
 * KNOWLEDGE — the site's #knowledge reading room (knowledge-stage.tsx,
 * knowledge-timeline.ts, knowledge.css) at film scale, in both frames.
 * Space only; every moment lives in timing.ts (KNOWLEDGE / KNOWLEDGE_LOCAL).
 */
import type { Layout } from '../../lib/layout';
import { GLOW, rgba } from '../../lib/lights';
import { LIGHTS, MUTED_MESH } from '../../theme';

export type Rect = { x: number; y: number; w: number; h: number };

/* ── THE SUNDAY LIGHT ───────────────────────────────────────────
 * This second call comes in on a Sunday, so the room wears #demo's Sunday
 * (palettes.ts MOMENT_LIGHTS.sunday): the aqua ground, the teal orb (its
 * `listen` twin while the caller asks), the site's sunday ink wherever the
 * #knowledge stage sets violet. Lights are light: grounds, blooms, rims. */
export const SUN = LIGHTS.sunday;
/** sunday ink (#0e7490): key phrases, the eyebrow, live dots, beam heads */
export const INK = SUN.ink;
/** the light's two glow colours: body #22b8cf, core #a5eaf5 */
export const SUN_GLOW = GLOW.sunday;
/** the caller's light (the `listen` orb's middle) */
export const LISTEN_GLOW = { body: SUN.listen[2], core: SUN.listen[3] } as const;
/** a quiet, de-lit glow for the miss (MUTED_MESH's middle) */
export const MISS_GLOW = { body: MUTED_MESH[2], core: MUTED_MESH[3] } as const;
/** a pale grey room the Sunday ground drains towards on the miss */
export const MISS_GROUND =
  'radial-gradient(120% 100% at 50% 40%, #e6e6ec 0%, #eeeef2 38%, #f5f5f7 72%, #f9f9fa 100%)';
/** the moment tag */
export const MOMENT = { day: 'Sunday', time: '10:24' } as const;

/* ── the site's constants (knowledge-timeline.ts, kb.ts, parts.tsx) ── */
export const ACCENT = INK;
/** a bar still reading */
export const FILL_REST = rgba(INK, 0.32);
export const TRACK_FILL = 'rgba(20,10,36,0.08)';
export const TILE_RING = 'rgba(24,16,40,0.07)';
export const DOT = {
  listening: 'rgba(24,16,40,0.3)',
  reading: INK,
  missing: '#6b6878',
} as const;
export type StatusKey = keyof typeof DOT;
export const STATUS_TEXT: Record<StatusKey, string> = {
  listening: 'Listening',
  reading: 'Looking through 5 documents',
  missing: 'Not in the documents',
};
export const BEAM_INK = rgba(SUN.orb[1], 0.42);
export const BEAM_MISS = 0.15;
export const THRESHOLD = 0.6;
/** the documents that did not answer step back */
export const DIM = 0.55;
/** the orb's volume through a question */
export const VOL = { rest: 0.12, listen: 0.15, speak: 0.7, miss: 0.05 } as const;
/** FluidOrb 'muted' palette on a miss (palettes.ts MUTED_MESH), darkest first */
export const ORB_MISS = MUTED_MESH;

export type DocKind = 'PDF' | 'DOCX' | 'MD' | 'TXT' | 'WEB';
export const DOCS: readonly { name: string; kind: DocKind }[] = [
  { name: 'Price list', kind: 'PDF' },
  { name: 'Cancellation policy', kind: 'DOCX' },
  { name: 'Aftercare', kind: 'MD' },
  { name: 'Opening hours', kind: 'TXT' },
  { name: 'FAQ page', kind: 'WEB' },
];
/** "Do you do home visits?" — none reaches the 60 % tick (knowledge-base.ts) */
export const MATCH = [0.22, 0.14, 0.1, 0.3, 0.26] as const;
/** DocBadge colours (components/site/product/knowledge-base/parts.tsx) */
export const BADGE: Record<DocKind, { bg: string; fg: string }> = {
  PDF: { bg: '#fbe9e4', fg: '#a2391c' },
  DOCX: { bg: '#e6ecfb', fg: '#2d4f9e' },
  MD: { bg: '#ecebf1', fg: '#3b3a45' },
  TXT: { bg: '#eef3e6', fg: '#3f6a24' },
  WEB: { bg: '#efe7f8', fg: '#551a89' },
};

export const HEADING = 'Answers from your own documents.';
export const HEADING_KEY = 'your own documents.';
export const CLOSING_KEY = 'it says so.';

/* ── layout ──────────────────────────────────────────────────────── */
export function geo(L: Layout) {
  const v = L.vertical;
  const panel = v ? { x: 32, y: 150, w: 1016, h: 1620 } : { x: 48, y: 48, w: 1824, h: 984 };
  const orb = v ? { x: 540, y: 1110, d: 240 } : { x: 960, y: 624, d: 240 };

  // (9:16: the list sits a row lower and a touch tighter, so the moment tag fits under the pill)
  const tiles: Rect[] = DOCS.map((_, i) =>
    v ? { x: 68, y: 374 + i * 106, w: 944, h: 94 } : { x: 112 + i * 344, y: 176, w: 320, h: 212 },
  );

  /* beams: dotted cubics from under each tile (16:9) / the list's foot
   * (9:16) into the orb's crown, arriving along its radius at the site's
   * 15° spread about −90° */
  const R = orb.d / 2 + 16;
  const beams = tiles.map((r, i) => {
    const a = ((-120 + i * 15) * Math.PI) / 180;
    const ex = orb.x + R * Math.cos(a);
    const ey = orb.y + R * Math.sin(a);
    const sx = v ? 220 + i * 160 : r.x + r.w / 2;
    const sy = v ? 906 : r.y + r.h + 12;
    const c1 = { x: sx, y: v ? sy + 42 : 470 };
    const pull = v ? 44 : 60;
    const c2 = { x: ex + Math.cos(a) * pull, y: ey + Math.sin(a) * pull };
    return {
      p0: { x: sx, y: sy },
      p1: c1,
      p2: c2,
      p3: { x: ex, y: ey },
      d: `M${sx.toFixed(1)} ${sy.toFixed(1)} C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
    };
  });

  return {
    v,
    panel: { ...panel, r: 28 },
    /** eyebrow + status pill share this centre line */
    top: {
      y: v ? 262 : 112,
      eyebrowX: v ? 68 : 112,
      pillRight: v ? 1012 : 1808,
      pillH: v ? 56 : 64,
      pillText: v ? 28 : 32,
      label: v ? 28 : 30,
      dot: 20,
      /** "☀ SUNDAY · 10:24": left of the pill (16:9, it rides the pill's edge) / under it (9:16) */
      tag: v
        ? { mode: 'below' as const, y: 330, size: 28, icon: 30, gap: 0 }
        : { mode: 'left' as const, y: 112, size: 30, icon: 32, gap: 30 },
    },
    tiles,
    tile: v
      ? { kind: 'row' as const, pad: 20, badgeH: 48, badgeText: 28, badgeMinW: 112, name: 34, nameX: 156, barW: 260, barPadR: 28 }
      : { kind: 'tile' as const, pad: 24, badgeH: 52, badgeText: 30, badgeMinW: 90, name: 36, nameX: 24, barW: 272, barPadR: 24 },
    orb,
    beams,
    caller: v
      ? { labelY: 1294, align: 'center' as const, boxX: 250, boxW: 580, rowY: 1356, size: 76, lh: 1.05 }
      : { labelY: 522, align: 'right' as const, boxX: 160, boxW: 640, rowY: 596, size: 88, lh: 1.02 },
    peek: v ? null : { x: 1120, y: 504, w: 480, h: 240 },
    answer: v
      ? { boxX: 68, boxW: 944, rowY: 1346, echoY: 1268, metaY: 1446, size: 68, lh: 1.1, meta: 28 }
      : { boxX: 140, boxW: 1640, rowY: 870, echoY: 792, metaY: 962, size: 76, lh: 1.1, meta: 32 },
    /** the heading rises where the orb will be, then steps down into the answer slot (step) to make way */
    heading: v
      ? { cy: 1110, size: 92, lines: ['Answers from', 'your own documents.'] as string[] | null, width: 944, step: { cy: 1372, scale: 0.82 } }
      : { cy: 624, size: 104, lines: ['Answers from', 'your own documents.'] as string[] | null, width: 1640, step: { cy: 878, scale: 0.8 } },
    closing: v
      ? { cy: 960, size: 104, lines: ['Where your', 'documents stop,', 'it says so.'] }
      : { cy: 540, size: 112, lines: ['Where your documents stop,', 'it says so.'] },
    /** the camera pushes about this point; 9:16 keeps every read inside x 60–1020 / y 220–1480 */
    cam: v
      ? { ox: 540, oy: 850, push: 0.016, kickPop: 0.002, kickMiss: 0.004 }
      : { ox: 960, oy: 560, push: 0.04, kickPop: 0.005, kickMiss: 0.008 },
    /** very soft lilac discs on the nearest plane, at the edges */
    discs: v
      ? [
          { x: 24, y: 1640, r: 210, seed: 'a' },
          { x: 1056, y: 300, r: 170, seed: 'b' },
          { x: 990, y: 1860, r: 130, seed: 'c' },
        ]
      : [
          { x: 30, y: 930, r: 220, seed: 'a' },
          { x: 1890, y: 150, r: 170, seed: 'b' },
          { x: 1720, y: 1070, r: 130, seed: 'c' },
        ],
    /** the whip leaves along this axis */
    whip: v ? { axis: 'y' as const, dist: -2600, counter: 24 } : { axis: 'x' as const, dist: -2400, counter: 24 },
  };
}
export type Geo = ReturnType<typeof geo>;

/* ── a cubic, walked by arc length (for the beam heads) ─────────── */
type P = { x: number; y: number };
const bez = (a: P, b: P, c: P, d: P, u: number): P => {
  const m = 1 - u;
  const k0 = m * m * m;
  const k1 = 3 * m * m * u;
  const k2 = 3 * m * u * u;
  const k3 = u * u * u;
  return { x: k0 * a.x + k1 * b.x + k2 * c.x + k3 * d.x, y: k0 * a.y + k1 * b.y + k2 * c.y + k3 * d.y };
};
/** point at arc-length fraction s (0..1) of the cubic */
export function cubicAt(bm: { p0: P; p1: P; p2: P; p3: P }, s: number): P {
  const N = 48;
  const pts: P[] = [];
  const len: number[] = [0];
  for (let i = 0; i <= N; i++) pts.push(bez(bm.p0, bm.p1, bm.p2, bm.p3, i / N));
  for (let i = 1; i <= N; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const target = Math.max(0, Math.min(1, s)) * len[N];
  let i = 1;
  while (i < N && len[i] < target) i++;
  const seg = len[i] - len[i - 1] || 1;
  const f = (target - len[i - 1]) / seg;
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f };
}

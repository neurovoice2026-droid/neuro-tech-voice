/**
 * KNOWLEDGE — the site's #knowledge reading room (knowledge-stage.tsx,
 * knowledge-timeline.ts, knowledge.css) at film scale, in both frames.
 * Space only; every moment lives in timing.ts (KNOWLEDGE / KNOWLEDGE_LOCAL).
 */
import type { Layout } from '../../lib/layout';
import { GLOW, rgba } from '../../lib/lights';
import { LIGHTS } from '../../theme';

export type Rect = { x: number; y: number; w: number; h: number };

/* ── THE SUNDAY LIGHT ───────────────────────────────────────────
 * This second call comes in on a Sunday, so the reader wears #demo's Sunday
 * (palettes.ts MOMENT_LIGHTS.sunday): the teal orb (its `listen` twin while
 * the caller asks) is the room's ONE light — a soft aqua pool on the paper
 * wall around it, falling off like light (never a wash, never a blob) — and
 * sunday ink is the scene's ONE accent: the key phrases, the eyebrow, the
 * live dots. Everything else is paper and ink. */
export const SUN = LIGHTS.sunday;
/** sunday ink (#0e7490): key phrases, the eyebrow, live dots, beam heads */
export const INK = SUN.ink;
/** the light's two glow colours: body #22b8cf, core #a5eaf5 */
export const SUN_GLOW = GLOW.sunday;
/** the caller's light (the `listen` orb's middle) */
export const LISTEN_GLOW = { body: SUN.listen[2], core: SUN.listen[3] } as const;
/** The miss: the Sunday mesh with its light drained — ~60 % less chroma (OKLab) at 0.8 exposure,
 *  so a cool teal undertone survives (an honest, quiet light, never a colourless chrome ball). */
export const SUN_MISS = ['#2b3c41', '#57717a', '#86a7ad', '#c1d6d9', '#f3f8f9'] as const;
/** a quiet, de-lit glow for the miss (SUN_MISS's middle) */
export const MISS_GLOW = { body: SUN_MISS[2], core: SUN_MISS[3] } as const;
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
/** the documents that did not answer step back (fade + a touch smaller — never out of focus) so the answer leads */
export const DIM = 0.25;
/** the orb's volume through a question */
export const VOL = { rest: 0.12, listen: 0.15, speak: 0.7, miss: 0.05 } as const;
/** the orb's palette on a miss, darkest first (the drained Sunday mesh, not palettes.ts MUTED_MESH's neutral grey) */
export const ORB_MISS: string[] = [...SUN_MISS];

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
export const HEADING = 'Answers from your own documents.';
/** the card the unanswered question becomes (the site's "flagged" hand-over: a hollow dot) */
export const TICKET = { label: 'For the team', question: 'Home visits?', number: '+1 555 0142', chip: 'Call back today' } as const;
export const FLAGGED = '#8c86a0';
/** the after-closing green (MOMENT_LIGHTS.closing): the callback is confirmed */
export const CLOSING_INK = LIGHTS.closing.ink;
export const CLOSING_GLOW = GLOW.closing;
export const HEADING_KEY = 'your own documents.';
export const CLOSING_KEY = 'it says so.';

/* ── layout ──────────────────────────────────────────────────────
 * The site's funnel (knowledge-stage.tsx): five documents across the top,
 * beams falling from each into the reader — the HERO, ~2× the site's
 * proportion — the caller's question on its left, the page it reads (the
 * slot) on its right, the answer underneath. The Sunday ground bleeds to the
 * frame edges (a lit room, not a card on a page).
 *
 * 9:16 stacks it, and EVERY glyph sits inside the Reels/TikTok safe band
 * (y 260–1490): the header row, the list, the orb, the dialogue under it.
 * There is no room for a fourth band, so the slot shares the documents'
 * place: on the miss the five documents step back out of focus and
 * "0 matches" pops forward where they were — the failed documents become
 * the miss — and that card becomes the one for the team. */
export function geo(L: Layout) {
  const v = L.vertical;
  const W = v ? 1080 : 1920;
  const H = v ? 1920 : 1080;
  /** the stage bleeds past the frame (no edge is ever seen, even under the camera's drift and kicks) */
  const panel = { x: -64, y: -64, w: W + 128, h: H + 128 };
  const orb = v ? { x: 540, y: 1040, d: 380 } : { x: 960, y: 640, d: 440 };

  const tiles: Rect[] = DOCS.map((_, i) =>
    v ? { x: 68, y: 398 + i * 72, w: 944, h: 62 } : { x: 104 + i * 348, y: 150, w: 320, h: 180 },
  );
  const listFoot = tiles[tiles.length - 1].y + tiles[tiles.length - 1].h;

  /* beams: dotted cubics from under each tile (16:9) / the list's foot
   * (9:16) into the orb's crown, arriving along its radius at the site's
   * 15° spread about −90° */
  const R = orb.d / 2 + 16;
  const beams = tiles.map((r, i) => {
    const a = ((-120 + i * 15) * Math.PI) / 180;
    const ex = orb.x + R * Math.cos(a);
    const ey = orb.y + R * Math.sin(a);
    const sx = v ? 220 + i * 160 : r.x + r.w / 2;
    const sy = v ? listFoot + 12 : r.y + r.h + 12;
    const c1 = { x: sx, y: sy + (v ? 28 : 52) };
    const pull = v ? 26 : 44;
    const c2 = { x: ex + Math.cos(a) * pull, y: ey + Math.sin(a) * pull };
    return {
      p0: { x: sx, y: sy },
      p1: c1,
      p2: c2,
      p3: { x: ex, y: ey },
      d: `M${sx.toFixed(1)} ${sy.toFixed(1)} C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
    };
  });
  /* 9:16: the slot sits centred on the list (it takes the documents' place on the miss) */
  const listMid = (tiles[0].y + listFoot) / 2;
  const slotV = { x: 68, y: Math.round(listMid - 92), w: 944, h: 184 };

  return {
    v,
    panel: { ...panel, r: 0 },
    /** eyebrow + status pill share this centre line */
    top: {
      y: v ? 300 : 98,
      eyebrowX: v ? 68 : 104,
      pillRight: v ? 1012 : 1816,
      pillH: v ? 56 : 64,
      pillText: v ? 28 : 30,
      /** TYPE.label */
      label: v ? 28 : 30,
      dot: 20,
      /** "☀ SUNDAY · 10:24": left of the pill (16:9, it rides the pill's edge) / under it (9:16) */
      tag: v
        ? { mode: 'below' as const, y: 356, size: 28, icon: 28, gap: 0 }
        : { mode: 'left' as const, y: 98, size: 30, icon: 30, gap: 30 },
    },
    tiles,
    /** 16:9 cards: the kind (TYPE.label, muted) and the match bar share the top row; the name (the title
     *  family, ≤ 2 lines) sits on the card's foot. 9:16 rows: kind · name · bar on one line. */
    tile: v
      ? { kind: 'row' as const, pad: 22, kindText: 28, kindW: 112, name: 40, nameX: 140, barW: 220, barPadR: 26 }
      : { kind: 'tile' as const, pad: 24, kindText: 30, kindW: 0, name: 42, nameX: 24, barW: 132, barPadR: 24 },
    /** when the documents that did not answer step back (a fade and a touch smaller — never a blur): on
     *  Ava's answer (16:9, they stay legible beside the card) / on the miss, deeper, behind the card that
     *  takes their place (9:16) */
    docsBack: v ? { at: 'miss' as const, dim: 0.12, scale: 0.965 } : { at: 'answer' as const, dim: DIM, scale: 0.985 },
    orb,
    beams,
    /** the caller's question (TYPE.caption — the same setting as Ava's, told apart by the caller's ink and
     *  the ● CALLER tag) — left of the orb, right-aligned to it (16:9) / under it (9:16) */
    caller: v
      ? { labelY: 1270, align: 'center' as const, boxX: 140, boxW: 800, rowY: 1340, size: 68, lh: 1.18 }
      : { labelY: 512, align: 'right' as const, boxX: 120, boxW: 580, rowY: 596, size: 76, lh: 1.18 },
    /** Ava's answer (TYPE.caption): one row under the orb (16:9) / two rows under it, in the caller's place
     *  (9:16) — under her ● AVA tag (`labelY`, centred) */
    answer: v
      ? { boxX: 68, boxW: 944, rowY: 1340, rowB: 1340 + Math.round(68 * 1.18) as number | null, size: 68, lh: 1.18, labelY: 1270 }
      : { boxX: 80, boxW: 1760, rowY: 970, rowB: null as number | null, size: 76, lh: 1.18, labelY: 900 },
    /** the slot: the page the reader reads → "0 matches" → the card for the team.
     *  'peek' (16:9): it opens as the page being read before the scan; 'miss' (9:16): it opens on the
     *  miss, over the documents stepping back */
    slot: v ? slotV : { x: 1232, y: 506, w: 584, h: 268 },
    slotMode: v ? ('miss' as const) : ('peek' as const),
    /** the heading (TYPE.headline — THE look) rises where the orb will be; 16:9: it steps down to the
     *  answer row to make way and holds there beside the caller (who speaks on the left) until
     *  "question,"; 9:16 (one column — a stepped-down heading would sit under the caller's words and
     *  read as theirs): it holds full size and leaves up through its masks just before the orb springs
     *  from its place */
    heading: v
      ? { cy: orb.y, size: 92, lines: ['Answers from', 'your own documents.'] as string[] | null, width: 944, step: null }
      : {
          cy: 640,
          size: 100,
          lines: ['Answers from your own documents.'] as string[] | null,
          width: 1760,
          step: { cy: 958, scale: 0.72 } as { cy: number; scale: number } | null,
        },
    /** the closing title (TYPE.display) */
    closing: v
      ? { cy: 960, size: 112, lines: ['Where your', 'documents stop,', 'it says so.'] }
      : { cy: 540, size: 128, lines: ['Where your documents stop,', 'it says so.'] },
    /** the camera pushes about this point (a slow push — no hand-held drift, no kicks) */
    cam: v ? { ox: 540, oy: 990, push: 0.016 } : { ox: 960, oy: 600, push: 0.035 },
    /** the stage-in: the light of the result's white flash (its ember centre, measured at the cut)
     *  resolves into the Sunday light at the reader's place */
    dawn: v ? { x0: 547, y0: 1031 } : { x0: 1030, y0: 566 },
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

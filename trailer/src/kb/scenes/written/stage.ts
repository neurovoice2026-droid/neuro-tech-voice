/**
 * b08 · WRITTEN ONCE — the act's LAYOUT and every POSE as a pure function of act-local time (no React).
 *
 * FRAME 0 IS b07's LAST PICTURE (scenes/turn/stage.ts turnEnd): Ava's orb at rest, the seam still drawn, the
 * split ground (her half on KB_MESH, the other on Part I's muted mesh) and, 16:9 only, the day's column of the
 * same answer at rest under the orb. From there (SCRIPT.md b08 + CLIENT DIRECTION v2):
 *
 *   16:9   LEFT  the orb glides to the top-left corner; under it the column glides into the corner too, smaller
 *                (on "once" it stacks up into one slip, which draws its edges into the TXT · Opening hours row)
 *          RIGHT the app: the agent page as a white panel — the real tab bar (General · Conversation · Voice ·
 *                Knowledge · Skills, icons, line variant) over two columns: "Add knowledge" (drop zone, the web
 *                page field, Add page) and "Your documents" (the empty state, then the rows, newest on top)
 *   9:16   TOP   the orb top-left (centred over the panel once the row has flown); beside it the slips drop in
 *                from above the frame on "once", each under
 *                the one before, into one slip (no column in b07's 9:16) — then the same row is born there
 *          BELOW the eyebrow, then the app AT AD SIZE (the global 9:16 pass): full width, its type ≈ 1.56× the app's
 *                proportions, the tab bar labels only (as on a phone), "Add knowledge" (a compact drop zone, the field and
 *                Add page in a row), "Your documents" in the app's two-line rows — its content scrolling under the
 *                fixed tab bar like a phone's page (one scroll, on "knowledge": scrollAt)
 *
 * THE NEIGHBOURS: b07 → here is the same picture at frame 0. Here → b09: writtenEnd() (bottom) is this act's
 * last picture — the orb, the panel (its tab bar on Knowledge with the badge at 4), the four rows (Ready), the
 * eyebrow, the ground (KB_MESH keyed on the orb). The cursor and the caption have left by the cut.
 */
import { Easing } from 'remotion';
import { EASE, springUnit } from '../../../lib/motion';
import { WRITTEN_LOCAL as W } from '../../timing';
import { turnEnd } from '../turn/stage';

export type XY = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const ease = (t: number, a: number, b: number, f: (u: number) => number = EASE.inOut) => f(clamp01((t - a) / (b - a)));

/** a decisive glide that settles without a bounce (ζ ≈ .92) */
export const GLIDE = { stiffness: 170, damping: 24, mass: 1 } as const;
/** a calm drift (critically damped, ≈ 1.3 s) */
export const DRIFT = { stiffness: 60, damping: 15.5, mass: 1 } as const;
/** critically damped: a slip sliding up under the one above never peeks past it */
export const TUCK = { stiffness: 300, damping: 34.6, mass: 1 } as const;

export type WrittenStage = {
  W: number;
  H: number;
  vertical: boolean;
  /** Ava's orb: b07's last place → the corner over the slips → (once the Opening hours row has flown) where
   *  it settles for the rest of the act (centre, diameter) */
  orb: { from: { x: number; y: number; d: number }; to: { x: number; y: number; d: number }; settle: { x: number; y: number; d: number } };
  /** the app panel (frame px) and how it comes in (offset at its start) */
  panel: Box & { radius: number; from: XY };
  /** the tab bar: label size, icons, the strip's side padding (× r) */
  tabs: { size: number; icons: boolean; padR: number };
  /** the content area under the tab bar: its inner padding */
  pad: number;
  /** "Add knowledge": the block's box (frame px) */
  add: Box;
  /** the drop zone, the web page field and the Add page button (frame px) */
  drop: Box & { compact: boolean };
  divider: { y: number } | null;
  fieldLabel: { y: number } | null;
  field: Box;
  button: Box;
  /** "Your documents": the heading's top and the list (frame px), the rows' layout */
  docs: { x: number; y: number; w: number };
  list: { x: number; y: number; w: number; bottom: number };
  row: { size: number; h: number; gap: number; layout: 'stack' | 'inline'; pill?: number };
  /** UI type sizes (url: the web page field's mono text) */
  type: { title: number; body: number; small: number; label: number; url: number };
  /** 9:16: the panel's content SCROLLS (the app on a phone, its tab bar fixed): by `by` px over `at` (null: no scroll) */
  scroll: { at: readonly [number, number]; by: number } | null;
  /** the slips: 16:9 the column's corner (strip left / top of the top strip / width), 9:16 the pile */
  slips: { x: number; y: number; w: number };
  /** the eyebrow ● KNOWLEDGE BASE: its anchor x (left edge, or centre) and the label's top */
  eyebrow: XY & { align: 'left' | 'center' };
  /** the narrator's caption: centre x, row A's centre, max width */
  caption: { x: number; y: number; maxWidth: number };
  /** where the cursor comes in from (off frame) */
  enter: XY;
};

/** the row height for a layout / name size / pill size (kept in step with written/Row.tsx rowFace) */
export const rowHeight = (layout: 'stack' | 'inline', size: number, pill?: number) =>
  layout === 'stack' ? Math.round(size * 0.36 * 2 + size * 1.05 + size * 0.22 + (pill ?? Math.max(26, Math.round(size * 0.6))) * 1.72) : Math.round(size * 2.35);

const STAGES: Record<'land' | 'vert', WrittenStage> = (() => {
  const make = (vertical: boolean): WrittenStage => {
    const E = turnEnd(vertical);
    if (!vertical) {
      // the panel's bottom edge sits ≥ 70 px above the caption's cap height (caption row centre 962, caps from ≈ 932)
      const panel = { x: 612, y: 116, w: 1212, h: 744, radius: 30, from: { x: 1320, y: 0 } };
      const tabs = { size: 28, icons: true, padR: 14 };
      const barH = (44 * tabs.size) / 14;
      const pad = 46;
      const y0 = panel.y + barH + 40;
      const type = { title: 36, body: 28, small: 23, label: 26, url: 26 };
      const addW = 510;
      const add = { x: panel.x + pad, y: y0, w: addW, h: 0 };
      const drop = { x: add.x, y: y0 + 66, w: addW, h: 200, compact: false };
      const dividerY = drop.y + drop.h + 30;
      const fieldLabelY = dividerY + 44;
      const field = { x: add.x, y: fieldLabelY + 40, w: addW, h: 66 };
      const button = { x: add.x, y: field.y + field.h + 12, w: addW, h: 62 };
      add.h = button.y + button.h - y0;
      const docsX = add.x + addW + 52;
      const docsW = panel.x + panel.w - pad - docsX;
      const rowSize = 34;
      return {
        W: 1920,
        H: 1080,
        vertical,
        orb: { from: { x: E.orb.x, y: E.orb.y, d: E.orb.d }, to: { x: 326, y: 292, d: 220 }, settle: { x: 326, y: panel.y + panel.h / 2, d: 236 } },
        panel,
        tabs,
        pad,
        add,
        drop,
        divider: { y: dividerY },
        fieldLabel: { y: fieldLabelY },
        field,
        button,
        docs: { x: docsX, y: y0, w: docsW },
        list: { x: docsX, y: y0 + 66, w: docsW, bottom: panel.y + panel.h - 34 },
        row: { size: rowSize, h: rowHeight('stack', rowSize), gap: 14, layout: 'stack' },
        type,
        scroll: null,
        slips: { x: 96, y: 446, w: 460 },
        eyebrow: { x: panel.x + 4, y: panel.y - 58, align: 'left' },
        caption: { x: 960, y: 962, maxWidth: 1560 },
        enter: { x: 2010, y: 520 },
      };
    }
    // THE APP AT AD SIZE (global 9:16 fix: the desktop panel shrunk to fit read at 20–27 px on a phone). The panel is the
    // app as a phone shows it — full width, its type at the app's own proportions scaled up ≈ 1.56× (row names 50, the
    // status pills 42, text-xs : text-sm = 12 : 14), the app's real two-line document row (TabKnowledge.tsx DocumentRow:
    // the name over the pill and its type word) — and its content SCROLLS under the fixed tab bar like the page on a
    // phone: every truth beat happens in the top slot of the list, right under "Add page" (newest first), so the first
    // screen (Add knowledge · the drop zone · the field + Add page · Your documents · the newest row) holds them all; on
    // "knowledge" the page scrolls to the four rows, Ready (the act's last picture, b09's first).
    //   band   the card 426 → 1264: under the eyebrow (358–384), ≥ 40 px over the caption's caps (row A centre 1336)
    const panel = { x: 28, y: 426, w: 1024, h: 838, radius: 34, from: { x: 0, y: 1560 } };
    const tabs = { size: 32, icons: false, padR: 8 };
    const barH = (44 * tabs.size) / 14;
    const pad = 40;
    const y0 = panel.y + barH + 28;
    const type = { title: 46, body: 42, small: 34, label: 38, url: 34 };
    const cw = panel.w - 2 * pad;
    const add = { x: panel.x + pad, y: y0, w: cw, h: 0 };
    const drop = { x: add.x, y: y0 + 72, w: cw, h: 150, compact: true };
    const bw = 280;
    const field = { x: add.x, y: drop.y + drop.h + 20, w: cw - bw - 14, h: 96 };
    const button = { x: field.x + field.w + 14, y: field.y, w: bw, h: 96 };
    add.h = field.y + field.h - y0;
    const docsY = field.y + field.h + 36;
    const rowSize = 50;
    const pill = 42;
    const row = { size: rowSize, pill, h: rowHeight('stack', rowSize, pill), gap: 10, layout: 'stack' as const };
    const listY = docsY + 72;
    // the end scroll: the four rows fill the view (the newest 12 px under the tab bar, the oldest clear of the bottom)
    const viewTop = panel.y + barH;
    const by = Math.round(listY - (viewTop + 12));
    return {
      W: 1080,
      H: 1920,
      vertical,
      orb: { from: { x: E.orb.x, y: E.orb.y, d: E.orb.d }, to: { x: 150, y: 318, d: 150 }, settle: { x: 540, y: 222, d: 196 } },
      panel,
      tabs,
      pad,
      add,
      drop,
      divider: null,
      fieldLabel: null,
      field,
      button,
      docs: { x: add.x, y: docsY, w: cw },
      list: { x: add.x, y: listY, w: cw, bottom: panel.y + panel.h - 24 },
      row,
      type,
      scroll: { at: [W.knowledge - 4, W.knowledge + 22] as const, by },
      // the pile rests in the band between the top platform zone (the top 250 px, the Reels/TikTok UI) and the panel
      slips: { x: 286, y: 286, w: 680 },
      eyebrow: { x: 540, y: 358, align: 'center' },
      caption: { x: 540, y: 1336, maxWidth: 940 },
      enter: { x: 1130, y: 760 },
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const writtenStage = (vertical: boolean): WrittenStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the hand-off from b07 ──────────────────────────────────────── */

/** the seam draws back the way it came (its far end returns to its start): 1 → 0 */
export const seamLeft = (t: number) => 1 - ease(t, W.seam[0], W.seam[1], EASE.draw);

/** her ground floods the other half: the wipe's front (0 = on the seam … 1 = past the far edge) and its feather */
export const wipeAt = (t: number) => ease(t, W.ground[0], W.ground[1], EASE.inOut);

/** the orb's settle starts once the Opening hours row has left the corner */
export const ORB_SETTLE = W.fly[0] + 6;

/** Ava's orb: b07's place → the corner (the glide, no bounce) → its settle (a calm drift) */
export function orbPose(t: number, S: WrittenStage) {
  const p = springUnit(t - W.glide[0], GLIDE);
  const q = springUnit(t - ORB_SETTLE, DRIFT);
  const a = S.orb.from;
  const b = S.orb.to;
  const c = S.orb.settle;
  const at = (k: 'x' | 'y' | 'd') => lerp(lerp(a[k], b[k], p), c[k], q);
  return { x: at('x'), y: at('y'), d: at('d'), moving: Math.abs(1 - p) > 1e-4 || (q > 0 && Math.abs(1 - q) > 1e-4) };
}

/** the panel's offset from its place (it comes in eased, landing exactly at panel[1] so the cursor aims true) */
export function panelPose(t: number, S: WrittenStage) {
  const u = ease(t, W.panel[0], W.panel[1], EASE.out3);
  return { dx: S.panel.from.x * (1 - u), dy: S.panel.from.y * (1 - u), lift: 2 + 2.5 * (1 - u), on: t >= W.panel[0] - 0.01, moving: u > 0 && u < 1 };
}

/* ── the list (newest on top) ───────────────────────────────────── */

/** the rows in landing order: Price list, Opening hours (flies in), Cancellation policy, the FAQ page */
export const ROWS = [
  { kind: 'pdf', name: 'Price list', n: 2 },
  { kind: 'txt', name: 'Opening hours', n: 1 },
  { kind: 'docx', name: 'Cancellation policy', n: 2 },
  { kind: 'url', name: 'FAQ page', n: 3 },
] as const;
export type RowKind = (typeof ROWS)[number]['kind'];

/** frames before a newcomer lands that the rows below start making room (the flight's slot opens earlier) */
const ROOM = { land: 6, fly: 8 } as const;

/** row i's top in the list at t (it slides down a pitch for every row that lands after it) */
export function rowTop(i: number, t: number, S: WrittenStage) {
  const pitch = S.row.h + S.row.gap;
  let slots = 0;
  for (let j = i + 1; j < W.rows.length; j++) {
    const lead = j === 1 ? ROOM.fly : ROOM.land;
    slots += springUnit(t - (W.rows[j] - lead), GLIDE);
  }
  return { y: S.list.y + slots * pitch, moving: W.rows.some((a, j) => j > i && t > a - 10 && t < a + 26) };
}

/**
 * 9:16: how far the panel's content has scrolled at t (px; 0 in 16:9). One scroll, on "knowledge": the page glides up
 * under the fixed tab bar until the four rows fill the view — a phone's scroll (a soft start, a long decelerating
 * settle, no bounce), the newest row coming to rest just under the bar. The content and the rows inside it ride it.
 */
const SCROLL_EASE = Easing.bezier(0.32, 0, 0.12, 1);
export function scrollAt(t: number, S: WrittenStage) {
  if (!S.scroll) return 0;
  const [a, b] = S.scroll.at;
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return S.scroll.by * SCROLL_EASE(u);
}
/** the scroll is moving at t */
export const scrolling = (t: number, S: WrittenStage) => !!S.scroll && t > S.scroll.at[0] && t < S.scroll.at[1];

/** the badge's count over time (the app counts every document, Reading ones too) */
export const BADGE = W.rows.map((at, i) => ({ at, n: i + 1 }));

/* ── the act's last picture, for b09 ─────────────────────────────── */

/**
 * writtenEnd(vertical): what the cut into b09 hands over (frame px). The tab bar is on Knowledge, its badge at
 * 4; the rows are newest-first (FAQ page, Cancellation policy, Opening hours, Price list), all Ready; the eyebrow
 * holds; the cursor and the caption have left.
 *   orb      centre + diameter (the FluidOrb drawn at 300 px, scaled), her volume back near rest
 *   panel    its box + corner radius; tabs: label size / icons / strip padding (r = size / 14, bar 44r tall)
 *   rows     each row's box at the end, by name (the Opening hours row is the one b10 lifts into the page)
 *   ground   KB_MESH, lift .84 (turn/Ground.tsx HER_GROUND), keyed on the orb (sunday, .3) — Written's Ground
 */
export function writtenEnd(vertical: boolean) {
  const S = writtenStage(vertical);
  const t = W.end;
  // (9:16: the rows where the end scroll left them)
  const sc = scrollAt(t, S);
  const rows = ROWS.map((r, i) => ({ name: r.name, kind: r.kind, x: S.list.x, y: rowTop(i, t, S).y - sc, w: S.list.w, h: S.row.h }));
  return { orb: S.orb.settle, panel: { x: S.panel.x, y: S.panel.y, w: S.panel.w, h: S.panel.h, radius: S.panel.radius }, tabs: S.tabs, rows, eyebrow: S.eyebrow, scroll: sc, at: t };
}
export const WRITTEN_END = writtenEnd;

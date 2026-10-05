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
 *   9:16   TOP   the header row: the orb at its left (where it stays); beside it the slips drop in from just under the
 *                top platform zone on "once", each under the one before, into one slip (no column in b07's 9:16) — then
 *                the same row is born there; on "knowledge" the eyebrow rises in the same place, beside the orb
 *          BELOW the app as the WHOLE TAB (fix:written, the 9:16 FULL-TAB SPEC below): full width, ONE column, nothing
 *                scrolls — General (Name and language, Agent name | Language, Tone and its four cards 2 × 2), then
 *                Knowledge ("Add knowledge": the drop zone, "or add a web page", the field and Add page in a row; "Your
 *                documents": the empty state, then the rows in the app's one-line form, every one whole); the caption
 *                under the panel
 *
 * THE NEIGHBOURS: b07 → here is the same picture at frame 0. Here → b09: writtenEnd() (bottom) is this act's
 * last picture — the orb, the panel (its tab bar on Knowledge with the badge at 4), the whole Knowledge tab with the
 * four rows (Ready), the eyebrow, the ground (KB_MESH keyed on the orb). The cursor and the caption have left by the cut.
 */
import { EASE, smooth, springUnit } from '../../../lib/motion';
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
  /** General's text inputs (TabGeneral.tsx: Agent name, Language): their height — the web page field's in 16:9; 9:16
   *  keeps the 96 px its General tab always had while the Knowledge tab's field is compact (fix:knowledge-9x16) */
  inputH: number;
  button: Box;
  /** "Your documents": the heading's top and the list (frame px), the rows' layout */
  docs: { x: number; y: number; w: number };
  list: { x: number; y: number; w: number; bottom: number };
  row: { size: number; h: number; gap: number; layout: 'stack' | 'inline'; pill?: number };
  /** UI type sizes (url: the web page field's mono text) */
  type: { title: number; body: number; small: number; label: number; url: number };
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

/* ── 9:16 FULL-TAB SPEC ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * fix:written (the client's note: "In 9:16 the tab is not shown complete like in 16:9 while navigating — make it the
 * same quality as 16:9"). The agent page in 9:16 is the SAME app as 16:9's panel — the same content, states and beats —
 * re-laid out for the portrait frame in ONE column, so the WHOLE current tab is inside the panel at every moment it is on
 * screen: the full tab bar, every block of the tab, every document row whole. No scroll, no row parked under an edge, no
 * soft-fade crop, no panel edge off frame, no UI camera. (It replaces "the app at ad size", whose content scrolled under a
 * fixed tab bar like a phone's page: the General tab was cut under Tone's description, the Knowledge list under the
 * card's edge.) Layout px are the 1080 × 1920 frame's (× 2 in the 2160 × 3840 master). portraitPanel(top, slots) below
 * computes every box from these numbers; the line and change acts take it from here (writtenStage(true) /
 * portraitPanel), so the app is one design in all four acts.
 *
 *   FRAME BANDS  0–250 the top platform zone (no text) · 250–384 the HEADER ROW (Ava's orb; beside it the slips pile,
 *                later the eyebrow) · 396–1347 the PANEL · 1368–1534 the CAPTION (row A centre 1412, ≤ two lines: row
 *                A's caps from ≈ 1387, row B's descenders to ≈ 1534) · from 1536 the bottom platform zone (no text)
 *   PANEL        x 28, w 1024, radius 34; content x 68, w 944 (pad 40). Written: top 396, h 951 (bottom 1347: 40 px
 *                over the caption's caps). Comes in from the right (from.x 1300) as before
 *   TAB BAR      the kit's TabBar, labels only (the app's phone bar: the five labels + the badge fit 1024 at 32, not
 *                with icons), size 32 → r = 32/14, side pad 8r, bar 44r = 100.57 tall
 *   TYPE         title 42 (card titles) · body 32 (input values, the drop line, Add page) · small 28 (descriptions, the
 *                divider) · label 30 (field labels, tone names) · url 30 (mono) · tone blurbs 26 · drop hint 27 — every
 *                UI text ≥ 26 (16:9: 36 / 28 / 23 / 26 / 26)
 *   GENERAL      (written/Panel.tsx GeneralPortrait) content top 520.6: "Name and language" + its description (one
 *                line) · Agent name | Language SIDE BY SIDE at 641.7 (two columns 460 wide, gap 24, fields 76 tall) ·
 *                "Tone" at 812.7 + its description (two lines) · the four tone cards in a 2 × 2 grid from 970.2 (464 ×
 *                154, gap 16; the icon beside the tone's name, the blurb under them; Professional chosen) — it ends at
 *                1294.2, 53 px inside the written panel's bottom edge (the blocks are laid out from measured wraps)
 *   KNOWLEDGE    content top 520.6 (= panel top + 124.6): "Add knowledge" · the drop zone 944 × 118 at +60 (the upload
 *                icon beside "Drop files here or choose them", the hint "PDF, Word, TXT or Markdown · up to 10 MB each"
 *                under it) · "or add a web page" (the divider) at +198 · the web page field 650 × 76 + Add page 280 × 76
 *                (gap 14) in one row at +248 · "Your documents" at +356 · the list at +416
 *   ROWS         the app's ONE-LINE document row (written/Row.tsx layout 'inline', as 16:9's b12 / b13 lists): name 36,
 *                pill 28 (its type word 28), h 85 = rowHeight('inline', 36), gap 12 → pitch 97; x 68, w 944
 *   LIST SLOTS   4 rows (written, line): tops 936.6 · 1033.6 · 1130.6 · 1227.6 (the 4th ends 1312.6, 34 px over the
 *                panel's bottom edge). 5 rows (the change act's replace, both versions listed): portraitPanel(299, 5) —
 *                the same panel one pitch taller (h 1048), its top 97 higher and its bottom still 1347 (the caption's
 *                band untouched), slots 839.6 · 936.6 · 1033.6 · 1130.6 · 1227.6 — the header row is then the panel's:
 *                the orb must sit elsewhere (it is free in that act). Newest on top, as the app lists them
 *   HEADER       (written) the orb at (130, 317), d 124 (68 … 192 — its left edge on the panel's content edge; it may
 *                reach into the top zone, it is not text); the slips pile at x 236, top 266, w 740 (h 102: its text from
 *                ≈ 287); the eyebrow ● KNOWLEDGE BASE left-aligned at x 236, top 300 (centred on the orb)
 *   CAPTION      centre x 540, row A centre 1412, max width 940 (the call act's 1408 band)
 *   CURSOR       enters from (1130, 700); its rests are written/Written.tsx cursorKeys' (right of "Add knowledge";
 *                off the panel's right edge after Add page)
 */
export const PORTRAIT_SPEC = {
  panelTop: 396,
  /** the panel's bottom edge (every act keeps it: the caption's band starts 40 px under it) */
  panelBottom: 1347,
  panel: { x: 28, w: 1024, radius: 34, from: { x: 1300, y: 0 } },
  tabs: { size: 32, icons: false, padR: 8 },
  pad: 40,
  type: { title: 42, body: 32, small: 28, label: 30, url: 30 },
  row: { size: 36, pill: 28, gap: 12, layout: 'inline' as const },
  header: {
    orb: { x: 130, y: 317, d: 124 },
    slips: { x: 236, y: 266, w: 740 },
    eyebrow: { x: 236, y: 300, align: 'left' as const },
  },
  caption: { x: 540, y: 1412, maxWidth: 940 },
} as const;

/**
 * The 9:16 agent page (PORTRAIT_SPEC) for a panel whose top edge is at `top`, sized to hold `slots` document rows whole
 * under "Your documents" (4: the written act's panel, h 951; 5: one pitch taller). Every box in frame px.
 */
export function portraitPanel(top: number, slots: number) {
  const P = PORTRAIT_SPEC;
  const tabs = { ...P.tabs };
  const barH = (44 * tabs.size) / 14;
  const pad = P.pad;
  const x = P.panel.x + pad;
  const cw = P.panel.w - 2 * pad;
  const y0 = top + barH + 24;
  const add = { x, y: y0, w: cw, h: 0 };
  const drop = { x, y: y0 + 60, w: cw, h: 118, compact: true };
  const divider = { y: drop.y + drop.h + 20 };
  const bw = 280;
  const field = { x, y: divider.y + 50, w: cw - bw - 14, h: 76 };
  const button = { x: field.x + field.w + 14, y: field.y, w: bw, h: field.h };
  add.h = field.y + field.h - y0;
  const docsY = field.y + field.h + 32;
  const listY = docsY + 60;
  const row = { ...P.row, h: rowHeight('inline', P.row.size) };
  const listEnd = listY + slots * row.h + (slots - 1) * row.gap;
  const h = Math.round(listEnd + 34 - top);
  const panel = { x: P.panel.x, y: top, w: P.panel.w, h, radius: P.panel.radius, from: { ...P.panel.from } };
  return {
    panel,
    tabs,
    pad,
    add,
    drop,
    divider,
    fieldLabel: null,
    field,
    inputH: field.h,
    button,
    docs: { x, y: docsY, w: cw },
    list: { x, y: listY, w: cw, bottom: top + h - 24 },
    row,
    type: { ...P.type },
  };
}

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
        inputH: field.h,
        button,
        docs: { x: docsX, y: y0, w: docsW },
        list: { x: docsX, y: y0 + 66, w: docsW, bottom: panel.y + panel.h - 34 },
        row: { size: rowSize, h: rowHeight('stack', rowSize), gap: 14, layout: 'stack' },
        type,
        slips: { x: 96, y: 446, w: 460 },
        eyebrow: { x: panel.x + 4, y: panel.y - 58, align: 'left' },
        caption: { x: 960, y: 962, maxWidth: 1560 },
        enter: { x: 2010, y: 520 },
      };
    }
    // 9:16: THE FULL TAB (fix:written — see PORTRAIT_SPEC / portraitPanel above): the panel holds the WHOLE current tab
    // at every moment, nothing scrolls; the header row above it holds the orb (left) and, in turn, the slips pile and the
    // eyebrow beside it; the caption sits under it
    const G = portraitPanel(PORTRAIT_SPEC.panelTop, 4);
    const H = PORTRAIT_SPEC.header;
    return {
      W: 1080,
      H: 1920,
      vertical,
      // the orb glides to the header (left), and stays there (settle = to: the pile, then the eyebrow, beside it)
      orb: { from: { x: E.orb.x, y: E.orb.y, d: E.orb.d }, to: H.orb, settle: H.orb },
      ...G,
      // the pile beside the orb, in the band between the top platform zone and the panel (its drop starts at 236)
      slips: H.slips,
      eyebrow: H.eyebrow,
      caption: PORTRAIT_SPEC.caption,
      enter: { x: 1130, y: 700 },
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

/**
 * Her key light on the ground scales with the orb's size (call/stage.ts callKey: full at b08's orb, down to .35 with a
 * smaller one). 9:16 (fix:written): the full-key size stays b08's former orb, 196 — the header orb (124) lights the
 * ground a touch less, in written/Ground.tsx as in the call act, so the cut between them is continuous and the line and
 * change acts (callKey) light exactly as before. 16:9 keys on b08's own end orb (236), as before.
 */
export const KEY_FULL_D_9x16 = 196;
export const keyScale = (d: number, full: number) => Math.min(1, Math.max(0.35, d / full));

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

/* (fix:written: the written act no longer uses edgeFade / softK — in the full-tab layout nothing scrolls and no row ever
 *  goes under the panel's edge. They stay for change/App.tsx until the change act takes the 9:16 FULL-TAB SPEC.) */

/**
 * 9:16 (fix:knowledge-9x16): a row whose top (screen px) is in a card's last few px — the tail of its slide out under the
 * bottom edge (a newer row has landed above it), or the start of its rise from under it (the end scroll) — fades with that
 * sliver, where only its hairline border shows: the spring's slow tail never leaves a 1–3 px line along the edge. 1 for
 * any row whose top is 8 px or more above the edge (every row at rest), so the resting pictures are untouched.
 */
export const edgeFade = (y: number, edge: number) => 1 - smooth(edge - 8, edge - 2, y);

/**
 * 9:16 (polish round 2): THE SOFT BOTTOM EDGE. A row pushed out under the card's fixed bottom edge (a newer row has landed
 * above it), or rising back from under it, was sliced mid-glyph by that edge for several frames. While a row is below
 * the list's last resting slot it is drawn through a soft edge instead (written/Row.tsx SoftBottom): its content fades
 * out over the last SOFT_EDGE px above the card's edge. The edge's strength `softK` follows the row's displacement below
 * its resting slot — 0 at rest (no mask at all: every resting picture is untouched, each row whole as before), 1 once it
 * has moved SOFT_RAMP px down (before its pill's bottom, 29 px above the edge at rest, can reach the edge). The rows
 * above, settling INTO that slot, never take it; nor does a row wholly under the edge (edgeFade has it at 0 opacity
 * there: no mask layer for a row nothing of which is drawn).
 */
export const SOFT_EDGE = 56;
export const SOFT_RAMP = 24;
export const softK = (y: number, rest: number, edge: number) => (y >= edge - 2 ? 0 : smooth(rest, rest + SOFT_RAMP, y));

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
  const rows = ROWS.map((r, i) => ({ name: r.name, kind: r.kind, x: S.list.x, y: rowTop(i, t, S).y, w: S.list.w, h: S.row.h }));
  return { orb: S.orb.settle, panel: { x: S.panel.x, y: S.panel.y, w: S.panel.w, h: S.panel.h, radius: S.panel.radius }, tabs: S.tabs, rows, eyebrow: S.eyebrow, at: t };
}
export const WRITTEN_END = writtenEnd;

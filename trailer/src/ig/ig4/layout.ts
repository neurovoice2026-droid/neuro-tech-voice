/**
 * REEL 4 · THE STAGE'S GEOMETRY (docs/ig/SCRIPT.md ig4 §4–5; frame px, 1080×1920). Pure numbers and poses, no React.
 *
 *   ORB      her teal orb, Ø 110 in the label band's left (SCRIPT: (150, 290), set 6 px lower so its rim clears the
 *            header band at y 240), the whole reel
 *   PAGE     the price list (PriceList.tsx): 760 wide at frame 0, centred under her orb; on the hook's end it glides
 *            UP AND RIGHT to × .85 (x 260–906), so the left margin holds the three hairlines' arcs (SCRIPT b2–b4: they
 *            land on the line from the slot below, and the right of the frame is Instagram's like / comment rail)
 *   SLOT     the SingleSlot (SingleSlot.tsx): a slate hairline frame at x 86–906, y 1180–1420, its eyebrow above it
 *   ROWS     b6's five documents (KbRows.tsx), x 86–906 from y 352
 *   THRESH   the ThresholdRule (Threshold.tsx): a dashed line across at y 976, "Close enough to answer" over its right
 *            end; the five hairlines rise from the slot's top toward it in the site's own figure proportions
 *            (lib/pages/knowledge-base.ts ROOM.questions "home": match .22 .14 .10 .30 .26 against KB_THRESHOLD .6 —
 *            components/site/product/knowledge-base/limits.tsx draws the same bars short of the same dotted line)
 *   FIELD    b8's owner's field (OwnerField.tsx), x 86–906 from y 420, ● AVA over it
 */

/** her orb (centre, diameter) */
export const ORB = { x: 150, y: 296, d: 110 } as const;

/** the price list's own layout (page px, at scale 1) */
export const PAGE = {
  w: 760,
  pad: 56,
  /** the kind token's top (label role, 28) */
  kindY: 54,
  /** the heading ("Northside Studio · Price list", 32 px) */
  headY: 98,
  headSize: 32,
  /** the rule under the heading */
  ruleY: 158,
  /** the lines: 44 px objects, tabular figures */
  size: 44,
  rowY0: 186,
  pitch: 88,
  rows: 3,
} as const;
/** the page's height (page px) */
export const PAGE_H = PAGE.rowY0 + (PAGE.rows - 1) * PAGE.pitch + PAGE.size * 1.18 + PAGE.pad;
/** the line every phrasing lands on: Sports massage · 60 min · $85 */
export const TARGET_ROW = 1;

/** a page pose: its top-left (frame px) and its scale about that corner */
export type PagePose = { x: number; y: number; s: number };
/** frame 0: centred, under her orb; the hook text below it */
export const PAGE_0: PagePose = { x: 160, y: 420, s: 1 };
/** b2–b5: up and right, × .85 (its right edge on the rail line, x 906) */
export const PAGE_1: PagePose = { x: 906 - PAGE.w * 0.85, y: 360, s: 0.85 };

/** a point of the page (page px) in frame px at a pose */
export const pageAt = (p: PagePose, x: number, y: number) => ({ x: p.x + x * p.s, y: p.y + y * p.s });
/** a line's box (page px): its text top and centre */
export const rowTop = (i: number) => PAGE.rowY0 + i * PAGE.pitch;
export const rowMid = (i: number) => rowTop(i) + PAGE.size * 0.6;

/** the SingleSlot: its eyebrow sits INSIDE the frame, top left (the hairlines leave from the frame's top edge) */
export const SLOT = { x: 86, y: 1170, w: 820, h: 270, r: 30, pad: 40, eyebrowY: 1170 + 28, textSize: 60, textTop: 1170 + 28 + 34 + 12, textBottom: 1440 - 28 } as const;

/** b6: the five documents (TabKnowledge.tsx TYPE_LABELS for the type word) */
export const ROWS = {
  x: 86,
  y: 352,
  w: 820,
  h: 96,
  gap: 16,
  size: 32,
  docs: [
    { name: 'Price list', kind: 'pdf', type: 'PDF' },
    { name: 'Cancellation policy', kind: 'docx', type: 'Word' },
    { name: 'Aftercare', kind: 'md', type: 'Markdown' },
    { name: 'Opening hours', kind: 'txt', type: 'Text' },
    { name: 'FAQ page', kind: 'url', type: 'Web page' },
  ],
} as const;
export const rowY = (k: number) => ROWS.y + k * (ROWS.h + ROWS.gap);

/** the threshold and the five short hairlines (the site's figure: limits.tsx BARS / THRESHOLD) */
export const THRESH = {
  y: 976,
  x0: 86,
  x1: 906,
  value: 0.6,
  match: [0.22, 0.14, 0.1, 0.3, 0.26],
  /** the hairlines' feet: the slot's top edge, at five evenly spaced points */
  xs: [0.1, 0.3, 0.5, 0.7, 0.9].map((u) => 86 + 820 * u),
} as const;
/** a hairline's top for a match m (the slot's top is 0, the threshold is THRESH.value) */
export const stubTop = (m: number) => SLOT.y - ((SLOT.y - THRESH.y) * m) / THRESH.value;

/** b8: the owner's field */
export const FIELD = { x: 86, y: 470, w: 820, size: 56, labelSize: 28, tagY: 420 } as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export { clamp01 };

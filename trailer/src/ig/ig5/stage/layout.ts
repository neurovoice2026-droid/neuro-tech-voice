/**
 * REEL 5 · THE STAGE'S GEOMETRY (docs/ig/ig5/SCRIPT.md §2–3, HOOKS.md §1.2; frame px, 1080×1920). Pure numbers and
 * poses, no React. In stage/ (not the reel's top level) so a picture-only change never restales ig5's sound hash
 * (scripts/ig5/hash.mjs hashes the top-level .ts files of src/ig/ig5/).
 *
 *   PHONE / DESK  the rose line light Ø 18 at (740, 1130) on a 1.5 px graphite hairline y 1130, x 86 → 758 (HOOKS §1.2:
 *                 moved from x 862 so the rings clear TikTok's rail)
 *   TRIO          frame 0's three rings, Ø 72 / 156 / 240 about the light at f0, launched f −40 / −20 / 0, 60 f life,
 *                 a linear fade (TrioRings)
 *   S1            the hook card, headline 104 at x 86, rows y 400 · 528 · 656
 *   SLIP1 / STUB / SLIP2   b2–b3's quotes: paper at scale 1 with a small tilt; the stub hangs off slip 1's lower right
 *                 edge (pivot at its staple, top left) and covers only slip 1's blank bottom margin
 *   PILE          b4's square-up: the three papers × .88 about x 160 (every $0 point stays on x 160), tilt 0
 *   OURS          the $49 card: y 980 in b4 (under the pile), y 430 in b5; its $49 on the same scale (1.76 px per dollar)
 *   CHIP          b6–b8: ours parked as a pill in the label band, right-aligned to x 900
 *   RECORD        b6: the sample call's record
 *
 * Every monthly figure gets a to-scale hairline from one $0 point (x 160): 2 px per dollar at 1.0, × .88 in the pile.
 */

/** the phone: the rose line light on the desk */
export const PHONE = { x: 740, y: 1130, d: 18 } as const;
export const DESK = { y: 1130, x0: 86, x1: 758 } as const;

/** frame 0's ring trio (HOOKS §1.2): d(age) = 72 + 4.2·age (Ø 72 / 156 / 240 at ages 0 / 20 / 40), strokes and ink
 *  thinning linearly; born out of the light (Ø 18 at age −12.9), gone at age 60 */
export const TRIO = { d0: 72, grow: 4.2, life: 60, stroke0: 3, strokeK: 0.0375, ink0: 0.85, inkLife: 68, tail: 8 } as const;
/** a single ring of the phone (the desk law, RingPulse Ø 18 → 240) */
export const RING = { d0: 18, d1: 240 } as const;

/** the hook card (HOOKS §1.2): headline 104, rows 128 apart */
export const S1 = { x: 86, y: 400, size: 104, pitch: 128, maxWidth: 814 } as const;

/** the caption band (SCRIPT §1.2: narration cards at x 86, max width 814 → x 900; y 1170–1400) */
export const CAP = { x: 86, y: 1180, maxWidth: 814 } as const;

/** the to-scale bars: 2 px per dollar at scale 1, from local x 40 (frame x 160), 5 px with round ends (crit-r1 P8: a
 *  3 px line under figures of different widths read as an underline, not a scale; no $0 tick — the shared left edge
 *  on x 160 says "from zero") */
export const SCALE = { pxPerDollar: 2, x0: 40, stroke: 5 } as const;

/** a paper's pose: frame position of its local origin (top left), rotation (deg) about that origin, scale */
export type Pose = { x: number; y: number; r: number; s: number };
export type Box = { x: number; y: number; w: number; h: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
/** a local point of a paper in frame px */
export function at(p: Pose, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(rad(p.r));
  const s = Math.sin(rad(p.r));
  return { x: p.x + p.s * (lx * c - ly * s), y: p.y + p.s * (lx * s + ly * c) };
}
/** the frame-space bounding box of a local rect */
export function bbox(p: Pose, b: Box): Box {
  const pts = [at(p, b.x, b.y), at(p, b.x + b.w, b.y), at(p, b.x, b.y + b.h), at(p, b.x + b.w, b.y + b.h)];
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
/** the pose that puts local point (px, py) at frame (fx, fy), rotated r about it */
export function pivotPose(fx: number, fy: number, px: number, py: number, r: number, s = 1): Pose {
  const c = Math.cos(rad(r));
  const n = Math.sin(rad(r));
  return { x: fx - s * (px * c - py * n), y: fy - s * (px * n + py * c), r, s };
}
export const mixPose = (a: Pose, b: Pose, u: number): Pose => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, r: a.r + (b.r - a.r) * u, s: a.s + (b.s - a.s) * u });
/** a pose seen through the stage camera (scale k about c) */
export const camPose = (p: Pose, k: number, c: { x: number; y: number }): Pose => ({ x: c.x + k * (p.x - c.x), y: c.y + k * (p.y - c.y), r: p.r, s: p.s * k });
export const poseTransform = (p: Pose) =>
  `translate(${p.x.toFixed(3)}px, ${p.y.toFixed(3)}px)${Math.abs(p.r) > 1e-4 ? ` rotate(${p.r.toFixed(4)}deg)` : ''}${Math.abs(p.s - 1) > 1e-6 ? ` scale(${p.s.toFixed(6)})` : ''}`;

/* ── the papers (local px; scale 1) ── */
/** slip 1, the agency quote: x 120–876 (its tilted corners stay inside x 880), from y 340, −1° about its centre */
export const SLIP1 = {
  w: 756,
  h: 270,
  rest: { x: 120, y: 340 },
  tilt: -1,
  /** the tag: 36 px (crit-r1 P4: the slips carry their words alone now, the band is empty in b2–b3; × .88 in the pile
   *  it is still ≈ 32 px — L1) */
  tag: { x: 40, y: 34, size: 36 },
  /** the empty amount slot (a 1.5 px hairline rounded rect, 30 % graphite) until "$300" lands in it: sized to the
   *  figure (its cells ± `pad`), so the hedge printed before it ("commonly") sits right of the slot, never inside it */
  slot: { pad: 14, y: 84, h: 142, r: 18 },
  /** "$300": 140 px, its box top (line-height 1: the baseline .86 em below) */
  fig: { x: 40, y: 92, size: 140 },
  /** the column right of the figure (its x: the figure's measured end + gap): "a month" (44) over the hedge (36), the
   *  hedge's baseline on the figure's */
  col: { gap: 26, top: 44, hedge: 36 },
  bar: { y: 244 },
} as const;
/** the setup stub: x 310–874 (its "$1,500" at 140 px is ≈ 485 px; its tilted corner ends inside x 880), hung off slip 1's lower right edge (its staple top
 *  left), +3° about the staple */
export const STUB = {
  w: 564,
  h: 214,
  /** frame position of its top-left corner at rest (it covers slip 1's bottom from local y 258: under its hairline) */
  rest: { x: 310, y: 598 },
  tilt: 3,
  staple: { x: 46, y: 16 },
  tag: { x: 40, y: 26, size: 36 },
  fig: { x: 40, y: 70, size: 140 },
} as const;
/** slip 2, the live answering service: x 120–876 (tilted, inside x 880: TikTok's rail), from y 854, +0.8° about its
 *  centre; a 6 px graphite people stripe */
export const SLIP2 = {
  w: 756,
  h: 254,
  rest: { x: 120, y: 854 },
  tilt: 0.8,
  stripe: 6,
  tag: { x: 40, y: 34, size: 36 },
  /** "from" (44) then "$99" (140) on one baseline */
  fig: { x: 40, y: 82, size: 140, from: 44 },
  /** the column right of the figure: "a month," over "for 50 minutes" (44 both), the lower baseline on the figure's */
  col: { size: 44, pitch: 46 },
  bar: { y: 228 },
} as const;

/** the to-scale hairline's local y in a figure's box: its baseline (line-height 1) */
export const baseline = (top: number, size: number) => top + 0.86 * size;

/** the papers at rest (b2–b3), each about its own pivot */
export const SLIP1_REST: Pose = pivotPose(SLIP1.rest.x + SLIP1.w / 2, SLIP1.rest.y + SLIP1.h / 2, SLIP1.w / 2, SLIP1.h / 2, SLIP1.tilt);
export const STUB_REST: Pose = pivotPose(STUB.rest.x + STUB.staple.x, STUB.rest.y + STUB.staple.y, STUB.staple.x, STUB.staple.y, STUB.tilt);
export const SLIP2_REST: Pose = pivotPose(SLIP2.rest.x + SLIP2.w / 2, SLIP2.rest.y + SLIP2.h / 2, SLIP2.w / 2, SLIP2.h / 2, SLIP2.tilt);

/** b3's camera: 1.00 → .97 about (540, 740) */
export const CAMERA = { c: { x: 540, y: 740 }, to: 0.97 } as const;

/** b4's pile: × .88 about x 160 (local x 40 of every paper lands on x 160), tilt 0, from y 300; the stub over slip 1's
 *  bottom margin, slip 2 a breath under the stub */
export const PILE_S = 0.88;
const PILE_X = 160 - SCALE.x0 * PILE_S;
const PILE_TOP = 300;
export const PILE = {
  slip1: { x: PILE_X, y: PILE_TOP, r: 0, s: PILE_S } as Pose,
  stub: { x: 160 + (STUB.rest.x - 160) * PILE_S, y: PILE_TOP + 258 * PILE_S, r: 0, s: PILE_S } as Pose,
  slip2: { x: PILE_X, y: PILE_TOP + 258 * PILE_S + STUB.h * PILE_S + 10, r: 0, s: PILE_S } as Pose,
  /** the FIGURES' and bars' ink in the pile: the comparison steps back (rose at 60 % ≈ 3:1 on white, large type) */
  ink: 0.6,
  /** the WORDS' ink in the pile — tags, hedges, "a month", "from", "for 50 minutes" (crit-r1 L1: at the figures' 55 %
   *  the tags measured 2.7:1 on white; GRAPHITE.tag at .88 is ≈ 5.2:1, GRAPHITE.text at .88 ≈ 9:1) */
  labelInk: 0.88,
} as const;

/** ours: x 120–880; "Ours? From" (52 / 44) and "No setup fee." (44 teal, right to x 860) on row 1; "$49" (200 teal)
 *  "a month" (56) and her orb as the full stop on row 2; its hairline on the pile's scale */
export const OURS = {
  x: 120,
  w: 760,
  h: 306,
  r: 22,
  /** b4: under the pile; b5: up into the cleared stage */
  y4: 972,
  y5: 430,
  row1: { top: 28, title: 52, small: 44 },
  fig: { x: 40, y: 84, size: 200 },
  month: 56,
  bar: { y: 284 },
  /** px per dollar at the pile's scale (SCRIPT: $49 = 86 px under $99 = 174 and $300 = 528) */
  pxPerDollar: SCALE.pxPerDollar * PILE_S,
  orbD: 44,
} as const;

/** b5: the set-up track and its four dots (unlabelled: the site's four setup screens) */
export const TRACK = { x0: 220, x1: 780, y: 830, dot: 26 } as const;

/** b6–b8: the parked price chip (white pill; "From $49 a month" 40 px teal), right-aligned to x 900, y 286–366 (its
 *  "$49" stays inside the price band, y ≥ 300) */
export const CHIP = { right: 900, y: 286, h: 80, size: 40, padX: 30 } as const;

/** b6: the sample call's record */
export const RECORD = {
  x: 120,
  y: 620,
  w: 760,
  h: 290,
  r: 30,
  pad: 40,
  /** the header row: the ringing rose dot (her dock), SAMPLE CALL, the outcome pill */
  head: { y: 34, h: 56, dot: { x: 58, d: 16 }, labelX: 104, pill: 28 },
  ruleY: 120,
  tools: [150, 216] as const,
  toolSize: 30,
  orbD: 52,
} as const;
/** b7: the record pulled back and up over the CTA (dimmed), × .62 about (540, 330) */
export const RECORD_BACK = { s: 0.62, c: { x: 540, y: 330 }, opacity: 0.5 } as const;

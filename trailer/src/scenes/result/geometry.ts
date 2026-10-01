/**
 * RESULT geometry — one place for every position/size in the scene, per
 * orientation. Coordinates:
 *   · "screen" = the frame;
 *   · "world"  = the depth-1 camera layer (identical to screen while the
 *                camera is at rest, i.e. t 0…fly, so MARK/CARD0 hold);
 *   · "cal"    = the calendar's own natural units (W×H). While it is a whole
 *                sheet it is placed in the world by a uniform Pose (top-left
 *                + scale); in the split it is CROPPED into a card window
 *                (TUE–THU × a few hours) whose cells take their own, wider
 *                proportions — so the calendar is drawn through a per-axis
 *                affine map (CalMap), never a CSS scale, and its type keeps
 *                its own sizes.
 */
import { CARD0, MARK } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { FONT } from '../../theme';
import type { FontSpec } from './measure';

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Pose = { left: number; top: number; s: number };
export type Cam = { x: number; y: number; z: number };

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;
/** The target: Wednesday (index 2), 3–4 PM (hours are 24-h numbers here; the labels say "3 PM"). */
export const SLOT = { day: 2, from: 15, to: 16 } as const;

/**
 * Muted existing bookings — plain blocks, no names. [day, from, to]
 * Exactly three of them fall inside the card window (TUE–THU × 12–6 PM / 1–5 PM):
 * TUE 3:30–5 PM, THU 2–3 PM, THU 4–5 PM.
 */
export const BOOKINGS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 9.5, 10.5],
  [0, 13, 14.5],
  [1, 10, 11],
  [1, 15.5, 17],
  [2, 9, 10],
  [2, 10.5, 12],
  [3, 10.5, 12],
  [3, 14, 15],
  [3, 16, 17],
  [4, 9, 10.5],
  [4, 13.5, 14.5],
  [5, 10, 12],
];

export const CAL = {
  pad: 28,
  gutter: 92,
  radius: 28,
  dayY: 62, // centre of the day labels (the old "THE OWNER'S CALENDAR" band is gone)
  bodyTop: 96,
  inset: 4,
  slotRadius: 11,
} as const;

/** The card's type (the lifted mark becomes this card; its date row is registered onto the mark's words). */
export type CardType = {
  padX: number;
  /** BOOKED row centre, from the card centre */
  row0: number;
  /** date row ("Wednesday · 3 PM") centre, from the card centre */
  row1: number;
  label: number;
  dot: number;
  gap: number;
  date: FontSpec;
};

export function geo(L: Layout) {
  const W = L.pick(720, 908);
  const H = 548;
  const gridLeft = CAL.pad + CAL.gutter;
  const gridRight = W - CAL.pad;
  const colW = (gridRight - gridLeft) / 7;
  const bodyBottom = H - CAL.pad - 8;
  const rowH = (bodyBottom - CAL.bodyTop) / (HOURS.length - 1);

  const cell = (day: number, from: number, to: number): Rect => ({
    x: gridLeft + day * colW + CAL.inset,
    y: CAL.bodyTop + (from - 9) * rowH + CAL.inset,
    w: colW - 2 * CAL.inset,
    h: (to - from) * rowH - 2 * CAL.inset,
  });
  /** the raw (un-inset) bounds of a day × hours block, in calendar units */
  const block = (day: number, from: number, to: number): Rect => ({
    x: gridLeft + day * colW,
    y: CAL.bodyTop + (from - 9) * rowH,
    w: colW,
    h: (to - from) * rowH,
  });
  const slot = cell(SLOT.day, SLOT.from, SLOT.to);
  const slotC = { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 };

  /*
   * ESTABLISH — where the sheet settles after entering (world = screen, the
   * camera is at rest): 16:9 to the right of the card, bleeding off the right
   * edge (still arriving); 9:16 under the card.
   */
  const est: Pose = L.pick({ left: 1330, top: 277, s: 0.96 }, { left: 86, top: 1250, s: 1 });
  /* it enters from off-frame right (16:9) / bottom (9:16) */
  const enter = L.pick({ x: 680, y: 0 }, { x: 0, y: 690 });

  /*
   * CLOSE-UP — the camera pushes in with the throw so the card lands in a
   * real close-up: the slot's centre sits at `at` on screen, the sheet at
   * `s` on screen.
   */
  const close = L.pick({ at: { x: 1100, y: 610 }, s: 2.6 }, { at: { x: 635, y: 1150 }, s: 1.7 });
  const focus = { x: est.left + slotC.x * est.s, y: est.top + slotC.y * est.s };

  /*
   * THE CARD WINDOW (P0-2): the split crops the sheet to TUE–WED–THU ×
   * 12–6 PM (16:9, 3 × 6 cells of 240 × 72) / 1–5 PM (9:16, 3 × 4
   * cells of 263 × 54), with an hours gutter on the left and the day labels in
   * a header band. World px (= screen at rest).
   */
  const crop = (() => {
    const c = L.pick(
      {
        card: { x: 1030, y: 140, w: 820, h: 500 },
        gutter: 112,
        header: 68,
        rows: [12, 18] as const,
        day: 30,
        hour: 26,
        face: 48,
      },
      { card: { x: 90, y: 1204, w: 900, h: 276 }, gutter: 118, header: 60, rows: [13, 17] as const, day: 30, hour: 26, face: 44 },
    );
    const cols = [1, 4] as const; // TUE … THU
    const colPx = (c.card.w - c.gutter) / (cols[1] - cols[0]);
    const rowPx = (c.card.h - c.header) / (c.rows[1] - c.rows[0]);
    const sx = colPx / colW;
    const sy = rowPx / rowH;
    // cal-unit origin of the window's first cell, and its world position
    const x0u = gridLeft + cols[0] * colW;
    const y0u = CAL.bodyTop + (c.rows[0] - 9) * rowH;
    return {
      ...c,
      cols,
      colPx,
      rowPx,
      sx,
      sy,
      /** X_B(xu) = ox + xu·sx, Y_B(yu) = oy + yu·sy */
      ox: c.card.x + c.gutter - x0u * sx,
      oy: c.card.y + c.header - y0u * sy,
      radius: 28,
    };
  })();

  /** The card as it is lifted from the mark (the result's own override of handoff CARD0 — P2-5:
   *  the 76/68 px mark would otherwise shrink ~32 % into a card 29 % of the frame wide). */
  const card0 = {
    ...CARD0(L),
    ...L.pick({ x: 880, y: 560, w: 760, h: 200 }, { x: 540, y: 1080, w: 720, h: 200 }),
  };
  const dateSize = L.pick(68, 64);
  const cardType: CardType = {
    padX: 36,
    row0: -44,
    row1: 26,
    label: 32,
    dot: 14,
    gap: 14,
    date: { family: FONT.ui, weight: 520, size: dateSize, track: -0.01, lh: 1.05 },
  };

  return {
    W,
    H,
    gridLeft,
    gridRight,
    colW,
    bodyBottom,
    rowH,
    cell,
    block,
    slot,
    slotC,
    est,
    enter,
    close,
    focus,
    /** camera zoom at the close-up */
    closeZ: close.s / est.s,
    crop,
    mark: MARK(L),
    card0,
    cardType,
    /** the lift's forward/side arc (px) */
    liftArc: L.pick(46, 30),
    /** the throw, in screen px: rise out of the wind-up, drop into the slot */
    arc: L.pick({ rise: 300, drop: 250 }, { rise: 230, drop: 230 }),
    /** event face ("3:00 PM") DESIGN size in calendar units while the sheet is whole; the scene fits it
     *  to the slot's width from the measured copy (Event.tsx fitFace) */
    face: L.pick(18.5, 20),

    /* ── the diptych ────────────────────────────────────────────── */
    /** true: split left | right at x = L.cx (16:9); false: top / bottom at y = L.cy (9:16) */
    sideBySide: !L.vertical,
    /** the seam (world/screen px along the split axis) */
    seam: L.vertical ? L.cy : L.cx,
    /** centres of the two halves (the push / kick origins) */
    night: L.pick({ x: 480, y: 540 }, { x: 540, y: 480 }),
    booked: L.pick({ x: 1440, y: 540 }, { x: 540, y: 1440 }),
    word: L.pick(190, 150),
    /** word anchors: horizontal centre + baseline */
    asleep: L.pick({ cx: 480, base: 820 }, { cx: 540, base: 800 }),
    bookedWord: L.pick({ cx: 1440, base: 820 }, { cx: 540, base: 1166 }),
    moon: L.pick({ x: 480, y: 350, d: 200 }, { x: 540, y: 360, d: 180 }),
    /** 3–4 stars, 3–5 px: x, y, d */
    stars: L.pick(
      [
        { x: 172, y: 206, d: 5 },
        { x: 752, y: 148, d: 3.5 },
        { x: 846, y: 458, d: 4.5 },
        { x: 262, y: 528, d: 3 },
      ],
      [
        { x: 170, y: 246, d: 5 },
        { x: 884, y: 186, d: 3.5 },
        { x: 868, y: 566, d: 4.5 },
        { x: 226, y: 594, d: 3 },
      ],
    ),
    /** the seam line: full length, and past the frame's edges (the pulse leans the camera back 3.5 %) */
    divider: L.pick(
      { vertical: true, at: L.cx, from: -60, to: L.height + 60 },
      { vertical: false, at: L.cy, from: -60, to: L.width + 60 },
    ),
    /** parallax discs: far (0.5×, 2–3 large, dim) and near (1.6×, out of focus); side 0 = night, 1 = booked */
    discsFar: L.pick(
      [
        { side: 0, x: 250, y: 860, d: 560, a: 0.05 },
        { side: 1, x: 1640, y: 800, d: 640, a: 0.07 },
        { side: 1, x: 1160, y: 160, d: 400, a: 0.045 },
      ],
      [
        { side: 0, x: 860, y: 700, d: 560, a: 0.05 },
        { side: 1, x: 240, y: 1720, d: 640, a: 0.07 },
        { side: 1, x: 900, y: 1580, d: 440, a: 0.05 },
      ],
    ),
    discsNear: L.pick(
      [
        { side: 0, x: 84, y: 300, d: 170, a: 0.1 },
        { side: 0, x: 880, y: 990, d: 120, a: 0.085 },
        { side: 1, x: 1870, y: 330, d: 190, a: 0.1 },
        { side: 1, x: 1070, y: 980, d: 130, a: 0.09 },
        { side: 1, x: 1790, y: 1020, d: 100, a: 0.12 },
      ],
      [
        { side: 0, x: 60, y: 420, d: 170, a: 0.1 },
        { side: 0, x: 1020, y: 840, d: 120, a: 0.085 },
        { side: 1, x: 1040, y: 1110, d: 160, a: 0.1 },
        { side: 1, x: 70, y: 1560, d: 130, a: 0.09 },
        { side: 1, x: 900, y: 1850, d: 110, a: 0.12 },
      ],
    ),
  };
}
export type Geo = ReturnType<typeof geo>;

/* ── the calendar's map (cal units → world px), per axis ──────────── */
export type CalMap = {
  /** X = ax + xu·bx, Y = ay + yu·by */
  ax: number;
  bx: number;
  ay: number;
  by: number;
  /** 0 = the whole sheet (pose), 1 = the card window */
  r: number;
  /** the sheet's own uniform scale while whole (type sizes in state A) */
  s: number;
  /** state A: the whole sheet's pose */
  pose: Pose;
  /** the visible window (the plate), world px, and its corner radius */
  clip: Rect;
  radius: number;
};

export const mapX = (m: CalMap, xu: number) => m.ax + xu * m.bx;
export const mapY = (m: CalMap, yu: number) => m.ay + yu * m.by;
export const mapPt = (m: CalMap, x: number, y: number): Pt => ({ x: mapX(m, x), y: mapY(m, y) });
export const mapRect = (m: CalMap, r: Rect): Rect => ({
  x: mapX(m, r.x),
  y: mapY(m, r.y),
  w: r.w * m.bx,
  h: r.h * m.by,
});
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  w: lerp(a.w, b.w, k),
  h: lerp(a.h, b.h, k),
});

/** Whole sheet at `pose` → the card window, by r (may overshoot a little past 1). */
export function calMap(G: Geo, pose: Pose, r: number): CalMap {
  const B = G.crop;
  const clipA: Rect = { x: pose.left, y: pose.top, w: G.W * pose.s, h: G.H * pose.s };
  return {
    ax: lerp(pose.left, B.ox, r),
    bx: lerp(pose.s, B.sx, r),
    ay: lerp(pose.top, B.oy, r),
    by: lerp(pose.s, B.sy, r),
    r,
    s: pose.s,
    pose,
    clip: lerpRect(clipA, B.card, r),
    radius: lerp(CAL.radius * pose.s, B.radius, r),
  };
}

/** Layer transform for a camera at `depth` (origin = frame centre). */
export function layerCss(cam: Cam, depth: number): string {
  const z = 1 + (cam.z - 1) * depth;
  return `translate(${(-cam.x * depth).toFixed(2)}px, ${(-cam.y * depth).toFixed(2)}px) scale(${z.toFixed(5)})`;
}
/** World (depth-1) point → screen. */
export function worldToScreen(cam: Cam, L: { cx: number; cy: number }, p: Pt): Pt {
  return { x: L.cx + (p.x - L.cx) * cam.z - cam.x, y: L.cy + (p.y - L.cy) * cam.z - cam.y };
}
/** World point → screen for a plane at `depth` (what layerCss(cam, depth) does to it). */
export function planeToScreen(cam: Cam, L: { cx: number; cy: number }, p: Pt, depth: number): Pt {
  const z = 1 + (cam.z - 1) * depth;
  return { x: L.cx + (p.x - L.cx) * z - cam.x * depth, y: L.cy + (p.y - L.cy) * z - cam.y * depth };
}
/** Screen point → world (depth-1). */
export function screenToWorld(cam: Cam, L: { cx: number; cy: number }, p: Pt): Pt {
  return { x: L.cx + (p.x - L.cx + cam.x) / cam.z, y: L.cy + (p.y - L.cy + cam.y) / cam.z };
}
/**
 * Compose an extra zoom `f` about the screen point `q` (which then moves to
 * `q2`) onto a camera: s' = q2 + (s − q)·f.
 */
export function zoomScreen(cam: Cam, L: { cx: number; cy: number }, q: Pt, f: number, q2: Pt = q): Cam {
  return {
    z: cam.z * f,
    x: L.cx - q2.x - (L.cx - cam.x - q.x) * f,
    y: L.cy - q2.y - (L.cy - cam.y - q.y) * f,
  };
}
/** Compose a screen-space shift onto a camera. */
export const shiftScreen = (cam: Cam, dx: number, dy: number): Cam => ({ ...cam, x: cam.x - dx, y: cam.y - dy });

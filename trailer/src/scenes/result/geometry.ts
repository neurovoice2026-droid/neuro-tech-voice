/**
 * RESULT geometry — one place for every position/size in the scene, per
 * orientation. Coordinates:
 *   · "screen" = the frame;
 *   · "world"  = the depth-1 camera layer (identical to screen while the
 *                camera is at rest, i.e. t 0…fly, so MARK/CARD0 hold);
 *   · "cal"    = the calendar's own natural units (W×H), placed in the
 *                world by a Pose (top-left + uniform scale).
 */
import { CARD0, MARK } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Pose = { left: number; top: number; s: number };
export type Cam = { x: number; y: number; z: number };

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;
/** The target: Wednesday (index 2), 15:00–16:00. */
export const SLOT = { day: 2, from: 15, to: 16 } as const;

/** Muted existing bookings — plain blocks, no names. [day, from, to] */
export const BOOKINGS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 9.5, 10.5],
  [0, 13, 14.5],
  [1, 10, 11],
  [1, 15.5, 17],
  [2, 9, 10],
  [2, 11.5, 12.5],
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
  titleY: 44, // centre of the header label row
  dayY: 96, // centre of the day labels
  bodyTop: 128,
  inset: 4,
  slotRadius: 11,
} as const;

export function geo(L: Layout) {
  const W = L.pick(720, 908);
  const H = 580;
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
  const slot = cell(SLOT.day, SLOT.from, SLOT.to);
  const slotC = { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 };

  /*
   * ESTABLISH — where the sheet settles after entering (world = screen, the
   * camera is at rest): 16:9 to the right of the card, bleeding a touch off
   * the right edge (still arriving); 9:16 under the card, header clear of it.
   */
  const est: Pose = L.pick({ left: 1262, top: 262, s: 0.96 }, { left: 86, top: 1250, s: 1 });
  /* it enters from off-frame right (16:9) / bottom (9:16) */
  const enter = L.pick({ x: 680, y: 0 }, { x: 0, y: 690 });

  /*
   * CLOSE-UP — the camera pushes in with the throw so the card lands in a
   * real close-up: the slot's centre sits at `at` on screen, the sheet at
   * `s` on screen. 16:9: the grid bleeds off the top and right, hours still
   * readable at the left. 9:16: the sheet fills the width (bleeds right),
   * the hours column and the header stay whole.
   */
  const close = L.pick({ at: { x: 1100, y: 610 }, s: 2.6 }, { at: { x: 635, y: 1150 }, s: 1.7 });
  const focus = { x: est.left + slotC.x * est.s, y: est.top + slotC.y * est.s };

  /* the calendar in its half of the split */
  const split: Pose = L.pick({ left: 1044, top: 104, s: 1.1 }, { left: 86, top: 1180, s: 1 });

  return {
    W,
    H,
    gridLeft,
    gridRight,
    colW,
    bodyBottom,
    rowH,
    cell,
    slot,
    slotC,
    est,
    enter,
    close,
    focus,
    /** camera zoom at the close-up */
    closeZ: close.s / est.s,
    split,
    mark: MARK(L),
    card0: CARD0(L),
    /** the lift's forward/side arc (px) */
    liftArc: L.pick(46, 30),
    /** the throw, in screen px: rise out of the wind-up, drop into the slot */
    arc: L.pick({ rise: 300, drop: 250 }, { rise: 230, drop: 230 }),
    /** event face ("15:00") size in calendar units: >= 20 px on screen in the split */
    face: L.pick(18.5, 20),
    /*
     * The split. Both words share one cap line; the owner row sits right
     * above "Asleep." as one lockup (tile + label + word).
     *   16:9  words' cap-centre y, left edges at the safe margin / the sheet
     *   9:16  "Asleep." above the divider, "Booked." below it, optically
     *         centred on it (baseline ↔ cap top, 64 px each side)
     */
    word: L.pick(140, 130),
    // left edges sit inside L.safe.x by the titles plane's worst-case drift + breath (TITLE_SLACK ≈ 5–8 px)
    asleep: L.pick({ x: 128, capY: 861 }, { x: 92, capY: 960 - 64 - 45.5 }),
    booked: L.pick({ x: 1044, capY: 861 }, { x: 92, capY: 960 + 64 + 45.5 }),
    owner: L.pick({ x: 128, rowY: 704 }, { x: 92, rowY: 700 }),
    /** the owner's night light: a wide, faint lilac window light over their (empty) half — centre, size */
    night: L.pick({ x: 470, y: 380, w: 1300, h: 1000 }, { x: 560, y: 430, w: 1400, h: 1100 }),
    divider: L.pick(
      { vertical: true, at: L.cx, from: 56, to: L.height - 56 },
      { vertical: false, at: L.cy, from: L.safe.x, to: L.width - L.safe.x },
    ),
  };
}
export type Geo = ReturnType<typeof geo>;

/* ── transforms ─────────────────────────────────────────────────────── */
export const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  left: a.left + (b.left - a.left) * k,
  top: a.top + (b.top - a.top) * k,
  s: a.s + (b.s - a.s) * k,
});
export const calToWorld = (p: Pose, x: number, y: number): Pt => ({ x: p.left + x * p.s, y: p.top + y * p.s });
export const rectToWorld = (p: Pose, r: Rect): Rect => ({
  x: p.left + r.x * p.s,
  y: p.top + r.y * p.s,
  w: r.w * p.s,
  h: r.h * p.s,
});

/** Layer transform for a camera at `depth` (origin = frame centre). */
export function layerCss(cam: Cam, depth: number): string {
  const z = 1 + (cam.z - 1) * depth;
  return `translate(${(-cam.x * depth).toFixed(2)}px, ${(-cam.y * depth).toFixed(2)}px) scale(${z.toFixed(5)})`;
}
/** World (depth-1) point → screen. */
export function worldToScreen(cam: Cam, L: { cx: number; cy: number }, p: Pt): Pt {
  return { x: L.cx + (p.x - L.cx) * cam.z - cam.x, y: L.cy + (p.y - L.cy) * cam.z - cam.y };
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

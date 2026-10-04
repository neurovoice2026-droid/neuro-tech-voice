/**
 * b07 · TWO KINDS — the act's LAYOUT and every POSE as a pure function of act-local time (no React).
 *
 * FRAME 0 IS b06's LAST FRAME (scenes/recording/stage.ts recEnd): the camera at P2 (the in-person card at full
 * depth, the question and "Waiting." beside / under it; in 9:16 the clock over the card, its rose colon the
 * only colour), on Part I's muted mesh held where the slow push left it. Nothing here moves a camera: the
 * desk SORTS ITSELF on the seam (SCRIPT.md b07, CLIENT DIRECTION v2):
 *
 *   16:9   a vertical hairline at x 960 divides the frame. LEFT — the work that repeats: the clock rides in to
 *          the top of the half, "Some work repeats." (its last word in a flip window), the day's column of
 *          the same answer flowing under it; Ava's orb is born above it from the clock's rose colon and her
 *          ground (KB_MESH) spreads from her over the half. RIGHT — the work that matters: "Some work
 *          matters." over the in-person card, still and in full ink, on the neutral muted mesh.
 *   9:16   five elements (the judges' fix): the orb (born where the colon was), "Some work repeats.", the
 *          seam (horizontal, y 900), "Some work matters.", the caption. The card leaves under the seam; the
 *          clock's figures roll away and leave the line light alone, breathing, until it becomes her.
 *
 * Both halves keep one margin: content 130 px in from the frame edge and from the seam (16:9), so the
 * diptych is symmetric about its hairline.
 *
 * THE NEIGHBOURS: b06 → here is the same picture at frame 0 (`recEnd`, the desk plane / near plane offsets
 * below). Here → b08: TURN_END (bottom) is this act's last picture — the orb, the seam, the split ground and
 * (16:9) the column at rest under the orb; everything else has left by the cut.
 */
import { EASE, springUnit } from '../../../lib/motion';
import { TURN_LOCAL as T } from '../../timing';
import { deskLayout, PLANE, type DeskLayout } from '../repeat/desk';
import { recEnd } from '../recording/stage';

export type XY = { x: number; y: number };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const ease = (t: number, a: number, b: number, f: (u: number) => number = EASE.inOut) => f(clamp01((t - a) / (b - a)));

/** the house springs used here (ζ ≈ .9: a decisive glide that settles without a bounce) */
export const GLIDE = { stiffness: 170, damping: 24, mass: 1 } as const;
/** SPRING.pop (lib/motion): 0 → ~1.06 → 1 */
export const POP = { stiffness: 420, damping: 24, mass: 0.8 } as const;

/** The clock's lockup geometry (scenes/repeat/desk.ts DeskLayout['clock'] shape) at figure size `size`, its figures' top-left at (x, y). */
export function clockGeo(x: number, y: number, size: number, ref: DeskLayout['clock']) {
  const k = size / ref.size;
  const cellW = 0.6 * size;
  const cellH = 1.1 * size;
  const gap = ref.gap * k;
  const dot = ref.dot * k;
  // the labels (the label role, a fixed 30 / 28 px) keep the lockup's optical gaps to the figures' caps
  // (≈ .29 / .31 of the figure size); at the reference size exactly the desk's own offsets
  const capInset = (cellH - 0.72 * size) / 2;
  const same = Math.abs(k - 1) < 1e-6;
  const dayY = same ? y - (ref.y - ref.dayY) : y + capInset - 0.29 * size - 28.8;
  const lineY = same ? ref.lineY - ref.y + y : y + cellH - capInset + 0.31 * size - 7.2;
  return { x, y, size, cellW, cellH, gap, dot, dotX: x + 2 * cellW + gap + dot / 2, dotY: y + cellH * 0.53, dayY, lineY, w: 4 * cellW + 2 * gap + dot };
}
export type ClockGeo = ReturnType<typeof clockGeo>;

export type TurnStage = {
  W: number;
  H: number;
  vertical: boolean;
  /** the seam: drawn from `a` to `b` (16:9 top → bottom, 9:16 left → right) */
  seam: { a: XY; b: XY };
  /** her half (the KB ground spreads inside it; clip-path inset, px from each edge) */
  half: { top: number; right: number; bottom: number; left: number };
  /** the in-person card: b06's last pose (screen translate of its desk-plane box) and its pose in this act */
  card: { from: { dx: number; dy: number; scale: number }; to: { dx: number; dy: number; scale: number } | 'out' };
  /** the clock: b06's last geometry on screen (9:16; 16:9 it is out of frame) and where it rides to */
  clock: { from: ClockGeo | null; to: ClockGeo | null };
  /** "Some work repeats." / "Some work matters." — left edge (or centre) and baseline, headline size */
  titleL: { x: number; baseline: number; align: 'left' | 'center'; size: number };
  titleR: { x: number; baseline: number; align: 'left' | 'center'; size: number };
  /** the orb: centre and diameter */
  orb: { x: number; y: number; d: number };
  /** 16:9: the day's column (b06's strips, carried at scale `k`: their own px × k on screen) */
  column: { x: number; top: number; k: number; window: [number, number]; rise: number } | null;
  /** the narrator's caption: centre x, row A's centre, max width */
  caption: { x: number; y: number; maxWidth: number };
  /** b06's type, to lead out (screen px, as recording/stage.ts places it) */
  question: { x: number; y: number };
  waiting: { x: number; baseline: number };
};

const STAGES: Record<'land' | 'vert', TurnStage> = (() => {
  const make = (vertical: boolean): TurnStage => {
    const g = deskLayout(vertical);
    const R = recEnd(vertical);
    const P2 = R.cam;
    // b06's card and clock on screen at P2 (zoom 1): the desk plane shifts by −P2·0.6, the near plane by −P2·1
    const cardFrom = { dx: -P2.x * PLANE.desk, dy: -P2.y * PLANE.desk, scale: 1 };
    const nearDx = -P2.x * PLANE.near;
    const nearDy = -P2.y * PLANE.near;
    if (!vertical) {
      const M = 130;
      const cardW = 1920 / 2 - 2 * M; // 700: the half's content width
      const k = cardW / g.card.w;
      const top = 556;
      return {
        W: 1920,
        H: 1080,
        vertical,
        seam: { a: { x: 960, y: 92 }, b: { x: 960, y: 872 } },
        half: { top: 0, right: 960, bottom: 0, left: 0 },
        card: {
          from: cardFrom,
          // the box's top-left at (960 + M, top), scaled about its centre (InPersonCard's origin)
          to: { dx: 960 + M + (cardW - g.card.w) / 2 - g.card.x, dy: top + (g.card.h * k - g.card.h) / 2 - g.card.y, scale: k },
        },
        clock: { from: null, to: clockGeo(M, 92, 64, g.clock) },
        titleL: { x: M, baseline: 512, align: 'left', size: 84 },
        titleR: { x: 960 + M, baseline: 512, align: 'left', size: 84 },
        orb: { x: 540, y: 268, d: 300 },
        column: { x: M, top: top + 10, k, window: [top - 8, top + 264], rise: 96 },
        caption: { x: 960, y: 962, maxWidth: 1560 },
        question: R.question,
        waiting: R.waiting,
      };
    }
    const c = g.clock;
    const from = clockGeo(c.x + nearDx, c.y + nearDy, c.size, c);
    return {
      W: 1080,
      H: 1920,
      vertical,
      seam: { a: { x: 92, y: 900 }, b: { x: 988, y: 900 } },
      half: { top: 0, right: 0, bottom: 1920 - 900, left: 0 },
      card: { from: cardFrom, to: 'out' },
      clock: { from, to: null },
      titleL: { x: 540, baseline: 790, align: 'center', size: 92 },
      titleR: { x: 540, baseline: 1062, align: 'center', size: 92 },
      // born where the colon was, a breath higher (it rises as it lifts off)
      orb: { x: from.dotX, y: from.dotY - 26, d: 260 },
      column: null,
      caption: { x: 540, y: 1292, maxWidth: 940 },
      question: R.question,
      waiting: R.waiting,
    };
  };
  return { land: make(false), vert: make(true) };
})();

export const turnStage = (vertical: boolean): TurnStage => (vertical ? STAGES.vert : STAGES.land);

/* ── the sort (frame 0 on, with the seam) ───────────────────────── */

/** The in-person card's screen offset of its desk-plane box (and scale about its centre) at t. 9:16: it
 *  drops out under the seam (ease-in, gone by ~16 f). 16:9: it glides into the right half; on "kind." it
 *  glides out to the right (the matters side yields to the next act). */
export function cardPose(t: number, S: TurnStage): { dx: number; dy: number; scale: number; on: boolean } {
  const f = S.card.from;
  if (S.card.to === 'out') {
    // 9:16 (no card in the diptych): it glides out to the right — the matters side, as in 16:9 — over the
    // seam, never across b06's type (which leaves up through its masks at the same time)
    const u = ease(t, T.sort, T.sort + 15, EASE.in3);
    return { dx: f.dx + u * 1180, dy: f.dy, scale: 1 - 0.03 * u, on: u < 1 };
  }
  const to = S.card.to;
  const p = springUnit(t - T.sort, GLIDE);
  const out = ease(t, T.yieldAt, T.yieldAt + 15, EASE.in3);
  return { dx: lerp(f.dx, to.dx, p) + out * 1100, dy: lerp(f.dy, to.dy, p), scale: lerp(f.scale, to.scale, p), on: out < 1 };
}

/** 16:9: the clock rides in from above the frame to the top of the left half on the beat after the seam (it
 *  was left out of frame by b06's pull-back), and rides up and out again once its light has gone
 *  (`clockOut`). Offset px. */
export function clockRide(t: number, S: TurnStage): { dy: number; on: boolean } {
  if (S.vertical || !S.clock.to) return { dy: 0, on: true };
  // a beat after the seam: b06's type has left by then (it never rides in over the outgoing words)
  const p = springUnit(t - (T.sort + T.seam[1]), GLIDE);
  const out = ease(t, T.clockOut, T.clockOut + 12, EASE.in3);
  const above = -(S.clock.to.lineY + 60);
  return { dy: above * (1 - p) + above * out, on: p > 0 && out < 1 };
}

/* ── the line light → Ava's orb ─────────────────────────────────── */

/** where the colon sits at t (screen px, its diameter) */
export function colonAt(t: number, S: TurnStage): { x: number; y: number; d: number } {
  const c = S.vertical ? S.clock.from! : S.clock.to!;
  const r = clockRide(t, S);
  return { x: c.dotX, y: c.dotY + r.dy, d: c.dot };
}

/**
 * The light's flight from the colon to the orb's centre: it lifts off (up, towards the viewer) and glides on
 * a gentle arc, landing ON "Ava" where it springs open. Returns the centre, a 0..1 lift (its contact shadow)
 * and the flight's progress.
 */
export function lightPath(t: number, S: TurnStage): { x: number; y: number; lift: number; u: number } {
  const c = colonAt(Math.min(t, T.lift), S);
  const o = S.orb;
  const u = ease(t, T.lift, T.ava, EASE.inOut);
  // a quadratic arc bowed up: off the colon upwards first, then down and across onto the orb's place
  const mx = lerp(c.x, o.x, 0.35);
  const my = Math.min(c.y, o.y) - (S.vertical ? 46 : 110);
  const x = (1 - u) * (1 - u) * c.x + 2 * (1 - u) * u * mx + u * u * o.x;
  const y = (1 - u) * (1 - u) * c.y + 2 * (1 - u) * u * my + u * u * o.y;
  const lift = Math.sin(Math.PI * u);
  return { x, y, lift, u };
}

/** the orb's open: 0 before "Ava", SPRING.pop after (0 → ~1.06 → 1) */
export const openAt = (t: number) => (t < T.ava ? 0 : springUnit(t - T.ava, POP));

/* ── her ground ─────────────────────────────────────────────────── */

/** 0..1: how far her ground (KB_MESH, keyed on the orb) has spread over her half */
export const groundAt = (t: number) => ease(t, T.ground[0], T.ground[1], EASE.out3);

/* ── the column (16:9) ──────────────────────────────────────────── */

/** b06's teleprompter pace: a row per 36 frames (recording/Stack.tsx ROW_FRAMES), in the strips' own px */
export const ROW_FRAMES = 36;

/**
 * The column's scroll (strips' own px, upward) at t: it flows up into the window from below on `column`
 * (EASE.out3, 22 f, then b06's pace), and on "the first kind" decelerates to rest as the column glides up
 * `rise` px toward her light (screen px, returned as `lift`).
 */
export function columnAt(t: number, S: TurnStage, pitch: number) {
  const C = S.column!;
  const v = pitch / ROW_FRAMES;
  const t0 = T.column;
  const flowIn = 380; // px below: the first strip starts under the window's lower fade
  const inU = ease(t, t0, t0 + 22, EASE.out3);
  // constant pace from t0, braking smoothly over 20 f from "the first kind" (∫ of a velocity ramp)
  const run = (x: number) => {
    const a = Math.max(0, x - t0);
    const b0 = T.firstKind - t0;
    const B = 20;
    if (a <= b0) return v * a;
    const d = Math.min(a - b0, B);
    return v * b0 + v * (d - (d * d) / (2 * B));
  };
  const scroll = run(t) - flowIn * (1 - inU);
  const lift = C.rise * ease(t, T.firstKind, T.firstKind + 20, EASE.inOut);
  return { scroll, lift, shown: t >= t0 - 1 };
}

/* ── the act's last picture, for b08 ────────────────────────────── */

/**
 * TURN_END(vertical): what the cut into b08 hands over (screen px). Everything not listed has left by then.
 *   orb      Ava's orb at rest (sunday), centre + diameter; her volume back at rest (VOL.rest .12)
 *   seam     the hairline, still drawn (b08 retracts it): from `a` to `b`, 1.5 px, ink at 13 %
 *   ground   her half on KB_MESH (lift .86, keyed on the orb, sunday tint .3), the other half on Part I's
 *            muted mesh (Repeat's REPEAT_GROUND, held where b06 left it) — scenes/turn/Ground.tsx
 *   column   16:9 only: the day's strips at rest under the orb (their top-left, scale, pitch, scroll px)
 */
export function turnEnd(vertical: boolean) {
  const S = turnStage(vertical);
  const t = T.end;
  // the column at rest, risen: row r's strip top on screen = top + k·(r·pitch − scroll); its window (with its
  // paper fades: 64 px in at the top, 70 px at the bottom) risen with it. Strips are b06's (own px w 940, h 130,
  // pitch 114, the slate line at title 64 — turn/Column.tsx), carried at scale k.
  const col = S.column
    ? {
        ...S.column,
        top: S.column.top - S.column.rise,
        window: [S.column.window[0] - S.column.rise, S.column.window[1] - S.column.rise] as [number, number],
        strip: { w: 940, h: 130, pitch: 114 },
        scroll: columnAt(t, S, 114).scroll,
      }
    : null;
  return { orb: S.orb, seam: S.seam, half: S.half, column: col, at: t };
}
export const TURN_END = turnEnd;

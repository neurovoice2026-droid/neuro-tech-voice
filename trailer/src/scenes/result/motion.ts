/**
 * RESULT motion — every moving value in the scene as a pure, continuous
 * function of the (fractional) local time: the 120 fps render samples the
 * same curves four times per timeline frame. Nothing here exists to fake
 * motion blur.
 *
 * Cameras, composed outermost-last:
 *   base   the world camera: the push into the close-up with the throw, the
 *          landing's one soft dip, the lean + 6-frame peel back out as the
 *          sheet crops into its card; locked off over the split (no handheld)
 *   half   each half of the diptych on top of it: a slow drift apart, ±10 px
 *          (a pure translation — type is never slowly re-scaled, which would
 *          make its glyphs shimmer)
 *   dive   both halves (and the seam) zoom into the event together
 *
 * The card is designed in SCREEN space (its path, size, tilt), because the
 * camera pushes into a close-up while it flies; Flyer converts it into the
 * world layer with the camera of the frame being drawn.
 */
import { Easing } from 'remotion';
import { aos, EASE, mix, tween } from '../../lib/motion';
import { RESULT } from '../../timing';
import type { ResultTiming } from '../Result';
import {
  CAL,
  calMap,
  mapPt,
  mapRect,
  shiftScreen,
  worldToScreen,
  zoomScreen,
  type Cam,
  type CalMap,
  type Geo,
  type Pose,
  type Pt,
} from './geometry';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
type LL = { cx: number; cy: number };

/* ── the calendar ───────────────────────────────────────────────────── */
/** Entry: stiff, one small overshoot (≈2.5 %) peaking ≈ t14.5 — nearly still (sharp) from t13. */
const ENTER = { stiffness: 500, damping: 34, mass: 1 };

export const enterAt = (t: number, T: ResultTiming) => aos(t, T.sheetIn, { anticip: 3, depth: 0.03, config: ENTER });

/**
 * The crop (P0-2 / P1-4): 0 → 1 over recomposeDur frames on EASE.peel (slow
 * out of the close-up, fastest ≈ recompose + 3, soft into the card), past it
 * by 2.5 %, settled over recomposeSettle frames. Its anticipation is the
 * camera's lean (leanAt), so the value itself never runs backwards.
 */
export function recomposeAt(t: number, T: ResultTiming): number {
  const a = T.recompose;
  const e = a + T.recomposeDur;
  if (t <= a) return 0;
  if (t <= e) return 1.025 * EASE.peel((t - a) / (e - a));
  return 1 + 0.025 * (1 - tween(t, [e, e + T.recomposeSettle], [0, 1], EASE.inOut));
}
/** 0..1..0: the camera leans into the close-up before the peel releases it. */
export function leanAt(t: number, T: ResultTiming): number {
  const a = T.recompose;
  const up = tween(t, [a - T.recomposeAnticip, a], [0, 1], EASE.inOut);
  const down = tween(t, [a, a + T.recomposeDur / 2], [0, 1], EASE.inOut);
  return up * (1 - down);
}

/** Impact bump: the calendar gives a little under the card, then rings out. */
export function impactAt(t: number): number {
  if (t < RESULT.land) return 0;
  const k = t - RESULT.land;
  return Math.exp(-k / 4.5) * Math.sin(k * 0.62 + 0.35);
}

/** The whole sheet's pose (entry, impact) — state A of the map. */
export function calPoseAt(t: number, G: Geo, T: ResultTiming): Pose {
  const e = enterAt(t, T);
  const pose = {
    left: G.est.left + G.enter.x * (1 - e),
    top: G.est.top + G.enter.y * (1 - e),
    s: G.est.s,
  };
  // the hit pushes the sheet back a hair (scale about the slot)
  const d = -0.012 * impactAt(t);
  return {
    left: pose.left - G.slotC.x * pose.s * d,
    top: pose.top - G.slotC.y * pose.s * d,
    s: pose.s * (1 + d),
  };
}

/** Cal units → world at time t: the whole sheet, cropping into the card window. */
export const calMapAt = (t: number, G: Geo, T: ResultTiming): CalMap => calMap(G, calPoseAt(t, G, T), recomposeAt(t, T));

/** The event's world centre / rect at time t. */
export const eventWorldAt = (t: number, G: Geo, T: ResultTiming): Pt => mapPt(calMapAt(t, G, T), G.slotC.x, G.slotC.y);

/* ── the cameras ────────────────────────────────────────────────────── */
/** Leaves gently with the throw, arrives firmly with the card. */
const CAM_IN = Easing.bezier(0.42, 0, 0.22, 1);

/** How far the camera dives into the event (8× — the event itself does the rest). */
export const DIVE_Z = 8;

/** Screen-space dive into the event: zoom, and the event drawn towards the frame centre. */
export function diveAt(t: number, T: ResultTiming) {
  // anticipation: everything has settled; the camera leans back a hair while the event swells —
  // an in-out curve, so it never starts at full speed (the v1 jolt)
  const tick = tween(t, T.pulseIn, [0, 1], EASE.inOut) * (1 - tween(t, [T.pulse, T.pulse + 5], [0, 1], EASE.inOut));
  // accelerating in log space (u^1.7: no jolt out of the pulse, felt from ~t104, ≈ 1.2× a frame into the cut)
  const u = Math.min(1, Math.max(0, (t - T.dive[0]) / (T.dive[1] - T.dive[0])));
  const k = Math.pow(u, 1.7);
  return {
    /** camera zoom factor of the dive */
    f: (1 - 0.035 * tick) * Math.exp(Math.log(DIVE_Z) * k),
    /** 0..1 the event travels to the frame centre — only as fast as the zoom, so it never reads as a pan */
    centre: k,
    k,
  };
}

/**
 * The world camera (before the halves and the dive). At rest until the
 * throw (MARK and CARD0 are screen contracts), then: push into the close-up
 * with the card, the landing's soft dip, the lean, the peel back out as the
 * sheet crops into its card (a 2.5 % overshoot, settled).
 */
export function baseCamAt(t: number, G: Geo, L: LL, T: ResultTiming): Cam {
  if (t <= RESULT.fly) return { x: 0, y: 0, z: 1 };
  const r = recomposeAt(t, T);
  const k = tween(t, T.camIn, [0, 1], CAM_IN) * (1 - r);
  const z1 = Math.exp(Math.log(G.closeZ) * k);
  const S = {
    x: mix(G.focus.x, G.close.at.x, k),
    y: mix(G.focus.y, G.close.at.y, k),
  };
  let cam: Cam = {
    x: L.cx + (G.focus.x - L.cx) * z1 - S.x,
    y: L.cy + (G.focus.y - L.cy) * z1 - S.y,
    z: z1,
  };
  // the lean: 3.5 % further into the close-up, about the event, before the peel
  const lean = leanAt(t, T);
  if (lean > 0) cam = zoomScreen(cam, L, G.close.at, 1 + 0.035 * lean);
  // the landing: the frame takes the weight — one soft dip (≈ 5 px) that settles, never a shake
  if (t >= RESULT.land) {
    // a single smooth pulse, (k/τ)·e^(1 − k/τ): 0 on the impact, 5 px at τ = 2.5 f, back to rest — no rebound
    const u = (t - RESULT.land) / 2.5;
    cam = { ...cam, y: cam.y - 5 * u * Math.exp(1 - u) };
  }
  return cam;
}

/** The diptych's own base: locked to the frame (the words, the night, the seam never ride the close-up). */
export function frameCamAt(): Cam {
  return { x: 0, y: 0, z: 1 };
}

export type Side = 'night' | 'booked';

/** The drift's offset at t (screen px, signed per half) — 0 → ±DRIFT over T.drift. */
export const DRIFT = 10;
export const driftAt = (t: number, side: Side, T: ResultTiming) =>
  t < RESULT.split ? 0 : DRIFT * (side === 'night' ? -1 : 1) * tween(t, T.drift, [0, 1], EASE.inOut);

/** A half of the diptych on top of the base camera: the slow drift apart (a pure translation). */
export function halfCamAt(t: number, side: Side, base: Cam, G: Geo, T: ResultTiming): Cam {
  const d = driftAt(t, side, T);
  if (d === 0) return base;
  return G.sideBySide ? shiftScreen(base, d, 0) : shiftScreen(base, 0, d);
}

/**
 * Every camera of a frame, all sharing the dive:
 *   world   the calendar + card (the close-up, the recompose) — the Booked half's motion on top
 *   night   the night half (sky, moon, stars, "Asleep.") — frame-locked + its half's motion
 *   booked  the Booked half's word ("Booked.") — frame-locked + its half's drift
 *   seam    the divider — frame-locked
 *   base    the raw world camera (before the halves and the dive)
 */
export type Cams = {
  base: Cam;
  world: Cam;
  night: Cam;
  booked: Cam;
  seam: Cam;
  dive: ReturnType<typeof diveAt>;
  q: Pt;
};

export function camsAt(t: number, G: Geo, L: LL, T: ResultTiming): Cams {
  const base = baseCamAt(t, G, L, T);
  const frame = frameCamAt();
  const world0 = halfCamAt(t, 'booked', base, G, T);
  const night0 = halfCamAt(t, 'night', frame, G, T);
  const booked0 = halfCamAt(t, 'booked', frame, G, T);
  const d = diveAt(t, T);
  if (t < T.pulseIn[0])
    return {
      base,
      world: world0,
      night: night0,
      booked: booked0,
      seam: frame,
      dive: d,
      q: { x: L.cx, y: L.cy },
    };
  // the dive: all planes zoom about the event's screen point, which travels to the frame centre
  const q = worldToScreen(world0, L, eventWorldAt(t, G, T));
  const q2 = { x: mix(q.x, L.cx, d.centre), y: mix(q.y, L.cy, d.centre) };
  const z = (c: Cam) => zoomScreen(c, L, q, d.f, q2);
  return {
    base: z(base),
    world: z(world0),
    night: z(night0),
    booked: z(booked0),
    seam: z(frame),
    dive: d,
    q,
  };
}

/** The calendar's (world) camera alone (the flight reads the slot through it). */
export const camAt = (t: number, G: Geo, L: LL, T: ResultTiming): Cam => camsAt(t, G, L, T).world;

/* ── the card: lift (mark → card) and flight (card → slot) ─────────── */
export type Word = {
  /** box centre, card units relative to the card centre */
  x: number;
  y: number;
  s: number;
};
export type Morph = {
  wed: Word;
  /** " at" folds out between the two words… */
  at: Word & { op: number };
  /** …and the row's "·" folds in in its place */
  sep: Word & { op: number };
  num: Word;
  /** 0 → 1: registered on the row, the words take the row's ink (ember → paper) */
  ink: number;
};

export type CardState = {
  /** SCREEN centre */
  x: number;
  y: number;
  /** plate size in card units (before `s`) */
  w: number;
  h: number;
  /** SCREEN scale of card units */
  s: number;
  rot: number;
  /** radius in card units */
  r: number;
  /** 1 = the site's booked pill (ember wash), 0 = the card plate */
  pill: number;
  plateOp: number;
  /** BOOKED row reveal */
  p: number;
  /** date row opacity */
  row: number;
  morph: Morph | null;
  /** event face (dot + "3:00 PM") opacity */
  ev: number;
  /** 0..1 in flight: the date row rolls up out of the card as the event face rolls in */
  roll: number;
  /** 0..1 the plate warms to the event's solid ember */
  warm: number;
  /** 0..1 height above the page (shadow) */
  air: number;
  /** calendar units → card units (event face sizing) */
  u: number;
  /** calendar units → screen px, at this time */
  calS: number;
  /** flight progress 0..1 (0 during the lift) */
  q: number;
};

/** Mark / card-row word metrics (from measure.ts). */
export type MarkMetrics = {
  /** mark ("Wednesday at 3 PM", MARK_TYPE): full width, words' widths + left offsets, cap-centre offset; and
   *  `row`: the card's row ("Wednesday · 3 PM") set in the mark's own face — what the mark closes up into */
  m: {
    W: number;
    wed: number;
    num: number;
    numX: number;
    row: { W: number; sep: number; sepX: number; numX: number };
    capOff: number;
    box: number;
  };
  /** card row ("Wednesday · 3 PM", MARK_TYPE at the card's size): words' widths + left offsets, cap-centre offset */
  c: {
    wed: number;
    sep: number;
    sepX: number;
    num: number;
    numX: number;
    capOff: number;
  };
};

/** ~4 % overshoot, peaking ≈ 9 frames after it starts */
const LIFT = { stiffness: 200, damping: 20, mass: 1 };
/** leaves out of the wind-up, keeps its speed into the impact */
const FLY_EASE = Easing.bezier(0.38, 0.05, 0.7, 0.72);
/** the card shrinks early and evenly, landing exactly at slot size */
const SHRINK_EASE = Easing.bezier(0.3, 0, 0.45, 1);

const cubic = (a: number, b: number, c: number, d: number, u: number) => {
  const v = 1 - u;
  return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
};

/** The slot's rect on screen at time t. */
export function slotScreenAt(t: number, G: Geo, L: LL, T: ResultTiming) {
  const m = calMapAt(t, G, T);
  const cam = camAt(t, G, L, T);
  const r = mapRect(m, G.slot);
  const a = worldToScreen(cam, L, { x: r.x, y: r.y });
  return { x: a.x, y: a.y, w: r.w * cam.z, h: r.h * cam.z, calS: m.s * cam.z };
}

export function cardAt(tIn: number, G: Geo, L: LL, T: ResultTiming, MM: MarkMetrics): CardState {
  const t = Math.max(0, tIn);
  const M = G.mark;
  const C0 = G.card0;
  const CT = G.cardType;

  /* LIFT — a 2-frame anticipation dip, then a soft spring up into CARD0 */
  const lp = aos(t, T.liftGo, { anticip: T.liftGo, depth: 0.03, config: LIFT });
  const k = clamp01(lp);
  const mo = tween(t, T.morph, [0, 1], EASE.inOut);
  const w0 = MM.m.W + M.fontSize * 0.95;
  const h0 = M.fontSize * 1.45;

  // a slight forward + side arc: it comes towards the lens as it rises
  const arcK = Math.sin(Math.PI * k);
  let x = mix(M.x, C0.x, lp) + G.liftArc * arcK;
  let y = mix(M.y, C0.y, lp);
  let s = 1 + 0.07 * arcK;
  let w = mix(w0, C0.w, mo);
  let h = mix(h0, C0.h, mo);
  let rot = 1.6 * arcK;
  let r = mix(h0 / 2, 24, mo);

  /* the words: from their places in the mark onto their places in the card row */
  // " at" folds out and a "·" folds in: the mark closes up, on its centre, into the card's row
  // ("Wednesday · 3 PM") set in its own face — all measured, so any copy registers
  const col = tween(t, T.markCollapse, [0, 1], EASE.inOut);
  const R = MM.m.row;
  const mWed = {
    x: mix(-MM.m.W / 2 + MM.m.wed / 2, -R.W / 2 + MM.m.wed / 2, col),
    y: MM.m.capOff,
  };
  const mNum = {
    x: mix(-MM.m.W / 2 + MM.m.numX + MM.m.num / 2, -R.W / 2 + R.numX + MM.m.num / 2, col),
    y: MM.m.capOff,
  };
  const mSep = { x: -R.W / 2 + R.sepX + R.sep / 2, y: MM.m.capOff };
  const cWed = {
    x: -C0.w / 2 + CT.padX + MM.c.wed / 2,
    y: CT.row1 + MM.c.capOff,
  };
  const cNum = {
    x: -C0.w / 2 + CT.padX + MM.c.numX + MM.c.num / 2,
    y: CT.row1 + MM.c.capOff,
  };
  const cSep = {
    x: -C0.w / 2 + CT.padX + MM.c.sepX + MM.c.sep / 2,
    y: CT.row1 + MM.c.capOff,
  };
  const sWed = mix(1, MM.c.wed / MM.m.wed, mo);
  const sNum = mix(1, MM.c.num / MM.m.num, mo);
  // (the "·" is too small to take a width ratio from: it scales with the type, mark size → row size)
  const sSep = mix(1, CT.date.size / M.fontSize, mo);
  // position = cap centre − the word's own cap offset (scaled)
  const word = (a: Pt, b: Pt, sc: number): Word => ({
    x: mix(a.x, b.x, mo),
    y: mix(a.y, b.y, mo) - MM.m.capOff * sc,
    s: sc,
  });
  const wed = word(mWed, cWed, sWed);
  const num = word(mNum, cNum, sNum);
  const atGap = {
    x: (wed.x + (MM.m.wed / 2) * sWed + (num.x - (MM.m.num / 2) * sNum)) / 2,
    y: mix(0, CT.row1 + MM.c.capOff - MM.m.capOff, mo),
  };
  // " at" folds away on its centre (it shrinks as it fades); the "·" grows in on its own place in the row
  const sepIn = EASE.out3(clamp01((col - 0.3) / 0.7));
  const sep = word(mSep, cSep, sSep);
  const atOut = EASE.inOut(clamp01(col * 1.4));
  const ink = tween(t, T.markOut, [0, 1], EASE.inOut);
  const morph: Morph = {
    wed,
    num,
    at: { x: atGap.x, y: atGap.y, s: 1 - 0.55 * atOut, op: 1 - atOut },
    sep: { ...sep, s: sep.s * (0.4 + 0.6 * sepIn), op: sepIn },
    ink,
  };

  /* wind-up before the throw: pull back, down and away from the target; swell */
  const wu = tween(t, T.windUp, [0, 1], EASE.inOut);
  const dir = { x: G.close.at.x - C0.x, y: G.close.at.y - G.arc.rise - C0.y };
  const dl = Math.hypot(dir.x, dir.y) || 1;
  const wind = { x: (-dir.x / dl) * 16 * wu, y: (-dir.y / dl) * 16 * wu };
  x += wind.x;
  y += wind.y;
  s *= 1 + 0.03 * wu;
  rot -= 2.4 * wu;

  let q = 0;
  let p = tween(t, T.cardReveal, [0, 1], EASE.out3);
  let row = tween(t, T.markOut, [0, 1], EASE.inOut);
  let ev = 0;
  let roll = 0;
  let warm = 0;
  let air = 0.35 * wu + 0.5 * arcK;
  let calS = G.est.s;

  if (t > RESULT.fly) {
    q = FLY_EASE(clamp01((t - RESULT.fly) / (RESULT.land - RESULT.fly)));
    const sl = slotScreenAt(t, G, L, T);
    calS = sl.calS;
    const P0 = { x: C0.x + wind.x, y: C0.y + wind.y };
    const P1 = { x: sl.x + sl.w / 2, y: sl.y + sl.h / 2 };
    // handles from the (known) landing point, so the lob doesn't chase the camera
    const c1 = { x: P0.x + (G.close.at.x - P0.x) * 0.3, y: P0.y - G.arc.rise };
    const c2 = { x: P1.x, y: P1.y - G.arc.drop };
    x = cubic(P0.x, c1.x, c2.x, P1.x, q);
    y = cubic(P0.y, c1.y, c2.y, P1.y, q);

    const sF = sl.h / C0.h;
    const wF = sl.w / sF;
    const ks = SHRINK_EASE(q);
    s = mix(1.03, sF, ks);
    w = mix(C0.w, wF, ks);
    h = C0.h;
    r = mix(24, (CAL.slotRadius * sl.calS) / sF, ks);
    rot = mix(-2.4, 0, clamp01(q * 3)) + 6 * Math.sin(Math.PI * Math.min(1, q * 1.05));
    // the card's face changes while it is still card-shaped: BOOKED sinks back into its band, then the
    // date row rolls up and out through the card's top edge as "• 3:00 PM" rolls up into it (a flip
    // board, clipped by the card) — never two settings on top of each other, never an empty plate
    p = 1 - tween(q, [0.04, 0.24], [0, 1], EASE.in2);
    roll = tween(q, [0.2, 0.56], [0, 1], EASE.inOut);
    row = 1 - roll;
    ev = roll;
    // it warms as its face turns, so the white face arrives on the ember
    warm = tween(q, [0.12, 0.8], [0, 1], EASE.inOut);
    air = mix(0.35, 0, q) + Math.sin(Math.PI * q) * 0.9;
  }

  return {
    x,
    y,
    w,
    h,
    s,
    rot,
    r,
    pill: 1 - mo,
    plateOp: tween(t, T.plateIn, [0, 1], EASE.out3),
    p,
    row,
    morph: t < T.markOut[1] ? morph : null,
    ev,
    roll,
    warm,
    air: Math.max(0, air),
    u: calS / s,
    calS,
    q,
  };
}

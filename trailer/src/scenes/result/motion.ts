/**
 * RESULT motion — every moving value in the scene as a pure function of
 * (fractional) local time, so sub-frame ghosts for motion blur can sample
 * the same curves.
 *
 * The card is designed in SCREEN space (its path, size, tilt), because the
 * camera pushes into a close-up while it flies; Flyer converts it into the
 * world layer with the camera of the frame being drawn.
 */
import { noise2D } from '@remotion/noise';
import { Easing } from 'remotion';
import { aos, EASE, mix, tween } from '../../lib/motion';
import { RESULT } from '../../timing';
import type { ResultTiming } from '../Result';
import { CARD } from './Card';
import {
  CAL,
  calToWorld,
  mixPose,
  rectToWorld,
  worldToScreen,
  zoomScreen,
  type Cam,
  type Geo,
  type Pose,
  type Pt,
} from './geometry';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
type LL = { cx: number; cy: number };

/* ── the calendar ───────────────────────────────────────────────────── */
/** Entry: stiff, one small overshoot (≈2.5 %) peaking ≈ t14.5 — nearly still (sharp) from t13. */
const ENTER = { stiffness: 500, damping: 34, mass: 1 };
/** Recompose into its half of the split: stiff, ≈3 % overshoot, settled for "Asleep." */
const RECOMPOSE = { stiffness: 260, damping: 24, mass: 1 };

export const enterAt = (t: number, T: ResultTiming) =>
  aos(t, T.sheetIn, { anticip: 3, depth: 0.03, config: ENTER });
export const recomposeAt = (t: number, T: ResultTiming) =>
  aos(t, T.recompose, { anticip: T.recomposeAnticip, depth: 0.05, config: RECOMPOSE });

/** Impact bump: the calendar gives a little under the card, then rings out. */
export function impactAt(t: number): number {
  if (t < RESULT.land) return 0;
  const k = t - RESULT.land;
  return Math.exp(-k / 4.5) * Math.sin(k * 0.62 + 0.35);
}

export function calPoseAt(t: number, G: Geo, T: ResultTiming): Pose {
  const e = enterAt(t, T);
  const base = mixPose(G.est, G.split, recomposeAt(t, T));
  const pose = {
    left: base.left + G.enter.x * (1 - e),
    top: base.top + G.enter.y * (1 - e),
    s: base.s,
  };
  // the hit pushes the sheet back a hair (scale about the slot)
  const d = -0.012 * impactAt(t);
  return {
    left: pose.left - G.slotC.x * pose.s * d,
    top: pose.top - G.slotC.y * pose.s * d,
    s: pose.s * (1 + d),
  };
}

/* ── the camera ─────────────────────────────────────────────────────── */
/** Leaves gently with the throw, arrives firmly with the card. */
const CAM_IN = Easing.bezier(0.42, 0, 0.22, 1);

/** 0..1 how far the camera is into the close-up (>1 in the recompose's anticipation). */
export const closeKAt = (t: number, T: ResultTiming) =>
  tween(t, T.camIn, [0, 1], CAM_IN) * (1 - recomposeAt(t, T));

/** The event's world centre in its split pose (the dive's target). */
const eventWorld = (G: Geo): Pt => calToWorld(G.split, G.slotC.x, G.slotC.y);

/** How far the camera dives into the event (8× — the event itself does the rest). */
export const DIVE_Z = 8;

/** Screen-space dive into the event: zoom, and the event drawn towards the frame centre. */
export function diveAt(t: number, T: ResultTiming) {
  // anticipation: the camera ticks back a hair while the event swells
  const tick = tween(t, [T.pulse - 6, T.pulse], [0, 1], EASE.out3) * (1 - tween(t, [T.pulse, T.pulse + 5], [0, 1], EASE.inOut));
  // accelerating in log space: felt from ~t104, violent at the end
  const k = tween(t, T.dive, [0, 1], EASE.in2);
  return {
    /** camera zoom factor of the dive */
    f: (1 - 0.035 * tick) * Math.exp(Math.log(DIVE_Z) * k),
    /** 0..1 the event travels to the frame centre — only as fast as the zoom, so it never reads as a pan */
    centre: k,
    k,
  };
}

/**
 * The world camera. At rest until the throw (MARK and CARD0 are screen
 * contracts), then: push into the close-up with the card, the impact jolt,
 * back out on the recompose (its anticipation pushes in a touch more), a
 * handheld drift + slow breath over the split, and the dive.
 */
export function camAt(t: number, G: Geo, L: LL, T: ResultTiming): Cam {
  if (t <= RESULT.fly) return { x: 0, y: 0, z: 1 };
  const k = closeKAt(t, T);
  const z1 = Math.exp(Math.log(G.closeZ) * k);
  const S = { x: mix(G.focus.x, G.close.at.x, k), y: mix(G.focus.y, G.close.at.y, k) };
  const cam: Cam = { x: L.cx + (G.focus.x - L.cx) * z1 - S.x, y: L.cy + (G.focus.y - L.cy) * z1 - S.y, z: z1 };
  return finish(cam, t, G, L, T, 1);
}

/**
 * The titles plane (owner, divider, words) is locked to the frame: it only
 * takes the handheld drift (softer), half the breath, and the dive — never
 * the close-up or the recompose.
 */
export function camTypeAt(t: number, G: Geo, L: LL, T: ResultTiming): Cam {
  return finish({ x: 0, y: 0, z: 1 }, t, G, L, T, 0.5, 0.25);
}

/** worst-case drift of the titles plane off its layout position (px): keeps words inside L.safe */
export const TITLE_SLACK = 0.5 * 6 + 0.25 * 0.02 * 960;

function finish(base: Cam, t: number, G: Geo, L: LL, T: ResultTiming, k: number, kz = k): Cam {
  let cam = base;
  // impact: the frame takes the hit (down), rings out — world only
  if (k === 1 && t >= RESULT.land) {
    const jolt = 9 * Math.exp(-(t - RESULT.land) / 5) * Math.sin((t - RESULT.land) * 0.8);
    cam = { ...cam, y: cam.y - jolt };
  }
  // handheld drift while the split holds
  const env =
    tween(t, [RESULT.split, RESULT.split + 20], [0, 1], EASE.inOut) *
    (1 - tween(t, [T.pulse - 8, T.pulse], [0, 1], EASE.inOut));
  cam = {
    ...cam,
    x: cam.x + 6 * k * noise2D('result-cam-x', t * 0.011, 0.37) * env,
    y: cam.y + 4 * k * noise2D('result-cam-y', 0.83, t * 0.011) * env,
  };
  // a slow breath in over the split
  const z2 = 0.02 * kz * tween(t, [RESULT.split, T.pulse], [0, 1], EASE.inOut);
  if (z2 > 0) cam = zoomScreen(cam, L, { x: L.cx, y: L.cy }, 1 + z2);
  // the dive into the event (both planes, same point, so everything streams out of it)
  if (t >= T.pulse - 6) {
    const d = diveAt(t, T);
    const q = worldToScreen(camAt0(t, G, L, T), L, eventWorld(G));
    cam = zoomScreen(cam, L, q, d.f, { x: mix(q.x, L.cx, d.centre), y: mix(q.y, L.cy, d.centre) });
  }
  return cam;
}

/** The world camera before the dive (used to find the event on screen). */
function camAt0(t: number, G: Geo, L: LL, T: ResultTiming): Cam {
  const z2 = 0.02 * tween(t, [RESULT.split, T.pulse], [0, 1], EASE.inOut);
  return zoomScreen({ x: 0, y: 0, z: 1 }, L, { x: L.cx, y: L.cy }, 1 + z2);
}

/* ── the card: lift (mark → card) and flight (card → slot) ─────────── */
export type Word = {
  /** box centre, card units relative to the card centre */
  x: number;
  y: number;
  s: number;
};
export type Morph = {
  wed: Word;
  at: Word & { op: number; blur: number };
  num: Word;
  /** the mark words' opacity (they cross-fade into the card row) */
  op: number;
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
  /** event face (dot + 15:00) opacity */
  ev: number;
  /** 0..1 the plate warms to the event's pill fill */
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
  /** mark: full width, words' widths + left offsets, cap-centre offset */
  m: { W: number; wed: number; at: number; atX: number; num: number; numX: number; capOff: number; box: number };
  /** card row: words' widths + left offsets, cap-centre offset */
  c: { wed: number; num: number; numX: number; capOff: number };
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
  const pose = calPoseAt(t, G, T);
  const cam = camAt(t, G, L, T);
  const r = rectToWorld(pose, G.slot);
  const a = worldToScreen(cam, L, { x: r.x, y: r.y });
  const s = pose.s * cam.z;
  return { x: a.x, y: a.y, w: G.slot.w * s, h: G.slot.h * s, calS: s };
}

export function cardAt(tIn: number, G: Geo, L: LL, T: ResultTiming, MM: MarkMetrics): CardState {
  const t = Math.max(0, tIn);
  const M = G.mark;
  const C0 = G.card0;

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
  let r = mix(h0 / 2, 20, mo);

  /* the words: from their places in the mark onto their places in the card row */
  // " at" folds out: the two words close up on the mark's centre as it goes
  const col = tween(t, T.markCollapse, [0, 1], EASE.inOut);
  const Wc = MM.m.wed + (MM.m.atX - MM.m.wed) + MM.m.num;
  const mWed = { x: mix(-MM.m.W / 2 + MM.m.wed / 2, -Wc / 2 + MM.m.wed / 2, col), y: MM.m.capOff };
  const mNum = { x: mix(-MM.m.W / 2 + MM.m.numX + MM.m.num / 2, Wc / 2 - MM.m.num / 2, col), y: MM.m.capOff };
  const cWed = { x: -C0.w / 2 + CARD.padX + MM.c.wed / 2, y: CARD.row1 + MM.c.capOff };
  const cNum = { x: -C0.w / 2 + CARD.padX + MM.c.numX + MM.c.num / 2, y: CARD.row1 + MM.c.capOff };
  const sWed = mix(1, MM.c.wed / MM.m.wed, mo);
  const sNum = mix(1, MM.c.num / MM.m.num, mo);
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
    y: mix(0, CARD.row1 + MM.c.capOff - MM.m.capOff, mo),
  };
  const morph: Morph = {
    wed,
    num,
    at: { x: atGap.x, y: atGap.y, s: 1 - 0.6 * col, op: 1 - clamp01(col * 1.5), blur: col * 6 },
    op: 1 - tween(t, T.markOut, [0, 1], EASE.inOut),
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
    r = mix(20, (CAL.slotRadius * sl.calS) / sF, ks);
    rot = mix(-2.4, 0, clamp01(q * 3)) + 6 * Math.sin(Math.PI * Math.min(1, q * 1.05));
    p = 1 - tween(q, [0.4, 0.8], [0, 1], EASE.inOut);
    row = p;
    ev = tween(q, [0.58, 0.92], [0, 1], EASE.inOut);
    warm = tween(q, [0.45, 1], [0, 1], EASE.inOut);
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
    morph: morph.op > 0.001 ? morph : null,
    ev,
    warm,
    air: Math.max(0, air),
    u: calS / s,
    calS,
    q,
  };
}

/** Screen-space speed of the card (px/frame) — drives blur + ghosts. */
export function cardSpeed(t: number, G: Geo, L: LL, T: ResultTiming, MM: MarkMetrics): number {
  if (t <= 0.5) return 0;
  const a = cardAt(t - 0.5, G, L, T, MM);
  const b = cardAt(t + 0.5, G, L, T, MM);
  return Math.hypot(b.x - a.x, b.y - a.y) + Math.abs(b.w * b.s - a.w * a.s) * 0.5;
}


/**
 * PART IV · b15–b16 · WORK THAT MATTERS — the stage: every position and every pose as a PURE FUNCTION of the
 * act's time (matters-local: 0 = the act's first frame, "nervous."). No React (Node-safe), so a neighbour can
 * import the act's first and last pictures (MATTERS_START / MATTERS_END) and cut to / from them exactly.
 *
 *   mattersLayout(vertical)   the frame (b01's desk, reset for another morning): the clock lockup with Ava's teal
 *                             colon, the in-person card (its sentence now two lines long: "nervous." lands where
 *                             the em dash hung), the staff reply under it, the old slip stack at the desk's edge,
 *                             the empty pad, b16's title over the desk's upper band
 *   mattersCam(t, vertical)   b15 holds dead still (the missing motion is the payoff); b16 a slow push toward the
 *                             card (zoom 1 → 1.05 on the near plane), anchored on the card's text axis (16:9: the
 *                             card grows, the clock and the paper slide out right); 9:16 also reframes the desk
 *                             down under the title
 *   toScreen(...)             a plane point → the screen (Camera/Layer maths)
 *   dotAt(t, vertical)        the teal dot on screen (the clock's colon; 9:16: it rises above the title in b16)
 *   stackSlip(i, t, vertical) slip i of the old stack (0 = the top one): its rest in the pile, then the cascade
 *   darkness(t)               0 → 1 across the last three beats (EASE.inOut), and the ground's grade from it
 *
 * PLANES (b01's): ground (the mesh — here screen-fixed: it has no detail to parallax), desk 0.6 (the card, its
 * reply, the pad, the old stack), near 1.0 (the clock lockup). The title is a screen graphic (it never zooms).
 */
import { MATTERS_LOCAL as M } from '../../timing.ts';

export type Box = { x: number; y: number; w: number; h: number };

export type MattersLayout = {
  vertical: boolean;
  W: number;
  H: number;
  /** the clock lockup (near plane): figures' top-left, figure size and cells; the colon's centre; label rows */
  clock: { x: number; y: number; size: number; cellW: number; cellH: number; gap: number; dot: number; dotX: number; dotY: number; dayY: number; lineY: number; avaY: number };
  /** the in-person card (desk plane); `w` is the minimum — the card is sized to its sentence at render */
  card: Box & { padX: number; padTop: number; size: number };
  /** the staff reply under the card: the label's top-left; the first row's top; the row height */
  reply: { x: number; labelY: number; rowY: number; rowH: number };
  /** the old slip stack's top slip (desk plane) at rest on the pad, and its rotation */
  stack: Box & { rot: number; padX: number; padTop: number; size: number };
  /** the pad's top sheet (desk plane): under the old slips, empty once they have gone */
  pad: Box;
  /** b16's title: its left edge (on the card's text axis) and the first line box's top */
  title: { x: number; y: number };
  /** 9:16: where the teal dot rises to in b16 (screen px) */
  dotTop: { x: number; y: number } | null;
};

/** The sentence on the in-person card, completed: "nervous." lands where b01's em dash hung. */
export const CARD_LINES = [
  ['First', 'session', 'since', 'my'],
  ['injury,', 'and', "I'm", 'a', 'bit'],
] as const;
export const NERVOUS = 'nervous.';
/** The staff reply (kb2-desk-2), a sentence per line: spoken words 0–2 and 3–6. */
export const REPLY_LINES = [
  ["That's", 'completely', 'normal.'],
  ["We'll", 'take', 'it', 'slow.'],
] as const;
/** The old slips still say the old hours. */
export const OLD_ANSWER = [
  ['Yes,', 'Saturdays,'],
  ['nine', 'till', 'two.'],
] as const;

const clockGeo = (size: number, gap: number, dot: number, x0: (w: number) => number, y: number, labelRow: number) => {
  const cellW = 0.6 * size;
  const cellH = 1.1 * size;
  const w = 4 * cellW + 2 * gap + dot;
  const x = x0(w);
  const lineY = y + cellH + 6;
  return { x, y, size, cellW, cellH, gap, dot, dotX: x + 2 * cellW + gap + dot / 2, dotY: y + cellH * 0.53, dayY: y - 40, lineY, avaY: lineY + labelRow };
};

const LAND: MattersLayout = (() => {
  const card = { x: 136, y: 366, w: 1061, h: 360, padX: 72, padTop: 56, size: 76 };
  const clock = clockGeo(112, 18, 20, (w) => 1770 - w, 170, 30 * 1.2 + 10);
  const rowH = 76 * 1.18;
  const labelY = card.y + card.h + 32;
  // the pad: b01's (nudged right and down, clear of the longer card); the old slips squared on it, askew
  const pad = { x: 1290, y: 716, w: 540, h: 288 };
  return {
    vertical: false,
    W: 1920,
    H: 1080,
    clock,
    card,
    reply: { x: card.x + card.padX, labelY, rowY: labelY + 30 * 1.2 + 10, rowH },
    stack: { x: pad.x + 18, y: pad.y - 16, w: 540, h: 288, padX: 50, padTop: 40, size: 64, rot: -2.2 },
    pad,
    title: { x: card.x + card.padX, y: 92 },
    dotTop: null,
  };
})();

const VERT: MattersLayout = (() => {
  const card = { x: 64, y: 528, w: 952, h: 344, padX: 60, padTop: 56, size: 68 };
  const clock = clockGeo(104, 17, 19, (w) => 540 - w / 2, 296, 28 * 1.2 + 8);
  const rowH = 68 * 1.18;
  const labelY = card.y + card.h + 34;
  // b01's pad, the old slips squared on it, askew (they leave to the right)
  const pad = { x: 300, y: 1214, w: 480, h: 262 };
  return {
    vertical: true,
    W: 1080,
    H: 1920,
    clock,
    card,
    reply: { x: card.x + card.padX, labelY, rowY: labelY + 28 * 1.2 + 10, rowH },
    stack: { x: pad.x + 14, y: pad.y - 14, w: 480, h: 262, padX: 44, padTop: 36, size: 56, rot: -2 },
    pad,
    title: { x: card.x + card.padX, y: 300 },
    dotTop: { x: 540, y: 214 },
  };
})();

export const mattersLayout = (vertical: boolean): MattersLayout => (vertical ? VERT : LAND);

/** the plane depths (b01's) */
export const PLANE = { desk: 0.6, near: 1.0 } as const;

/* ── curves ─────────────────────────────────────────────────────── */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** EASE.inOut (cubic-bezier .65,0,.35,1 ≈ an in-out cubic) */
const inOut = (u: number) => {
  const x = clamp01(u);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const out3 = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);

/** the push's progress: eased in over its first third, then constant — still moving on the cut into the dark */
const pushProgress = (t: number) => {
  const u = clamp01((t - M.push[0]) / (M.push[1] - M.push[0]));
  const a = 0.34;
  return u < a ? (u * u) / (2 * a) / (1 - a / 2) : (u - a / 2) / (1 - a / 2);
};

export type Pose = { x: number; y: number; zoom: number };

/** The act's camera (Camera x/y/zoom: how far the camera has moved, in near-plane px; zoom of the near plane). */
export const mattersCam = (t: number, vertical: boolean): Pose => {
  const e = pushProgress(t);
  if (!vertical) {
    // anchored on the card's text axis (x 208 on the desk plane stays put; the card grows right and down)
    const zoom = 1 + 0.05 * e;
    const zd = 1 + (zoom - 1) * PLANE.desk;
    const ax = LAND.card.x + LAND.card.padX;
    const x = (960 + zd * (ax - 960) - ax) / PLANE.desk;
    // the card's top edge stays put too (the title above it keeps its air)
    const ay = LAND.card.y;
    const y = (540 + zd * (ay - 540) - ay) / PLANE.desk;
    return { x, y, zoom };
  }
  // 9:16: a gentler push, and the desk reframes 60 px down under the title (desk plane)
  const r = inOut((t - M.reframe[0]) / (M.reframe[1] - M.reframe[0]));
  return { x: 0, y: (-60 * r) / PLANE.desk, zoom: 1 + 0.04 * e };
};

/** A plane point → the screen (Camera/Layer: zoom about the frame centre, then the camera's shift × depth). */
export const toScreen = (cam: Pose, vertical: boolean, depth: number, x: number, y: number) => {
  const W = vertical ? 1080 : 1920;
  const H = vertical ? 1920 : 1080;
  const z = 1 + (cam.zoom - 1) * depth;
  return { x: W / 2 + z * (x - W / 2) - cam.x * depth, y: H / 2 + z * (y - H / 2) - cam.y * depth, z };
};

/* ── the teal dot ─────────────────────────────────────────────────── */

/** 9:16: how far the dot has risen off the clock (0 … 1) */
export const dotRise = (t: number) => inOut((t - M.dotRise[0]) / (M.dotRise[1] - M.dotRise[0]));

/** The teal dot on screen and its scale (16:9: the clock's colon all act; 9:16: it rises above the title in b16). */
export const dotAt = (t: number, vertical: boolean) => {
  const g = mattersLayout(vertical);
  const cam = mattersCam(t, vertical);
  const colon = toScreen(cam, vertical, PLANE.near, g.clock.dotX, g.clock.dotY);
  if (!g.dotTop) return { x: colon.x, y: colon.y, z: colon.z };
  const r = dotRise(t);
  // a gentle arc (it leaves the clock straight up, easing in), and it grows a touch into the key light
  return { x: colon.x + (g.dotTop.x - colon.x) * r, y: colon.y + (g.dotTop.y - colon.y) * r, z: colon.z * (1 + 0.18 * r) };
};

/* ── the old slip stack ───────────────────────────────────────────── */

/** slip i's rest in the pile (0 = the top slip): offset px from the top slip's place, rotation deg */
const PILE = [
  { dx: 0, dy: 0, rot: 0 },
  { dx: -3, dy: 6, rot: 0.9 },
  { dx: 4, dy: 11, rot: -0.7 },
  { dx: -2, dy: 16, rot: 1.4 },
  { dx: 2, dy: 21, rot: -0.3 },
] as const;

export type StackPose = { dx: number; dy: number; rot: number; lift: number; scale: number };

/**
 * Slip i of the old stack at t (offsets from the layout's stack place, desk-plane px). At rest a squared pile,
 * its edges showing. On "do." it lifts (a 3-frame rise off the desk: scale 1.015, the shadow opening) and the
 * slips glide off one after another (`stagger`), EASE.inOut — off the right edge, rising toward the teal dot's side
 * of the frame (16:9 under the clock, never through its type), uncovering the empty pad.
 */
export function stackSlip(i: number, t: number, vertical: boolean): StackPose {
  const g = mattersLayout(vertical);
  const p = PILE[i] ?? PILE[PILE.length - 1];
  const s = M.stack;
  const lift = out3((t - s.lift - i * s.stagger * 0.5) / 4);
  const a = s.glide[0] + i * s.stagger;
  const u = inOut((t - a) / (s.glide[1] - s.glide[0]));
  // the travel: off the right edge with a margin, rising toward the clock's side of the frame (in desk-plane px;
  // the push only grows it on screen) — under the clock, never through its type
  const travel = vertical ? { x: g.W - g.stack.x + 140, y: -170 } : { x: g.W - g.stack.x + 160, y: -120 };
  return {
    dx: p.dx * (1 - 0.6 * u) + travel.x * u,
    dy: p.dy * (1 - 0.6 * u) + travel.y * u,
    rot: g.stack.rot + p.rot - 2.2 * u,
    lift: 0.4 + 1.4 * lift,
    scale: 1 + 0.015 * lift,
  };
}

/* ── the dark ─────────────────────────────────────────────────────── */

/** 0 → 1 across the darkening (the last three beats; EASE.inOut) */
export const darkness = (t: number) => inOut((t - M.dark[0]) / (M.dark[1] - M.dark[0]));
/** the desk's type and the clock fade with the light (they are gone a few frames before the cut) */
export const typeFade = (t: number) => 1 - smoothstep(M.fade[0], M.fade[1], t);
/** the paper sinks into the night (its shade), then is gone into it before the cut (its opacity) */
export const paperShade = (t: number) => 0.86 * darkness(t);
export const paperFade = (t: number) => 1 - smoothstep(M.dark[0] + 0.45 * (M.dark[1] - M.dark[0]), M.dark[1] - 2, t);

/* ── the neighbours ─────────────────────────────────────────────── */

/** The act's FIRST picture (t = 0, before "nervous." has risen; the em dash still hangs): the camera at rest. */
export const MATTERS_START = {
  t: 0,
  layout: mattersLayout,
  cam: (vertical: boolean) => mattersCam(0, vertical),
  /** the ground: MUTED_MESH (Part I's, lift .88, seed 0) on the timeline's clock, keyed teal at the colon */
  dot: (vertical: boolean) => dotAt(0, vertical),
};

/** The act's LAST picture (the dark): only the teal dot and its light on the deep ground are left. */
export const MATTERS_END = {
  t: M.end,
  dot: (vertical: boolean) => dotAt(M.end, vertical),
  cam: (vertical: boolean) => mattersCam(M.end, vertical),
};

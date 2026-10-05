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
 *   deskStep(t, vertical)     b16 "That's": the desk steps back (SPRING.site, Part I's step back) about the layout's
 *                             recede anchor — the thesis takes the frame, the person's card and its reply under it
 *   deskToScreen(...)         a desk-local point → the screen (the step back, then the camera)
 *   toScreen(...)             a plane point → the screen (Camera/Layer maths)
 *   dotAt(t, vertical)        the teal dot on screen (the clock's colon; 9:16: it rises above the title in b16)
 *   stackSlip(i, t, vertical) slip i of the old stack (0 = the top one): its rest in the pile, then the glide off (as one)
 *   darkness(t)               0 → 1 across the last three beats (a sine in-out), and the ground's grade from it
 *   closingAt(t, vertical)    the dark as a CLOSING KEY: the room's light pulled in from the frame's far edges onto
 *                             the teal dot (a soft radial edge: lit inside `ri`, night beyond `ro`, `mid` its half)
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
  /** b16's thesis: its left edge (the stepped-back card's edge), the first line box's top, its size (the display role,
   *  set a step up for the film's one thesis: ×1.125 16:9 / ×1.07 9:16) and the words of each line (vo-8's 7 words) */
  title: { x: number; y: number; size: number; lines: readonly (readonly number[])[] };
  /** b16's step back (desk plane): the scale the desk steps back to, the point it steps back about, its shade, and how
   *  far the paper (the pad and the old slips) rises on the desk as it does (desk px: it keeps a bottom margin) */
  recede: { s: number; ax: number; ay: number; shade: number; padDy: number };
  /** the old slips' way out (screen px): the arc's control point and the exit beyond the frame edge */
  slipOut: { cx: number; cy: number; ex: number; ey: number; shrink: number };
  /** 9:16: where the teal dot rises to in b16 (screen px) */
  dotTop: { x: number; y: number } | null;
};

/** The sentence on the in-person card, completed: "nervous." lands where b01's em dash hung. */
export const CARD_LINES = [
  ['First', 'session', 'since', 'my'],
  ['injury,', 'and', 'I’m', 'a', 'bit'],
] as const;
export const NERVOUS = 'nervous.';
/** The staff reply (kb2-desk-2), a sentence per line: spoken words 0–2 and 3–6. */
export const REPLY_LINES = [
  ['That’s', 'completely', 'normal.'],
  ['We’ll', 'take', 'it', 'slow.'],
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
    // the thesis: a clean left block on the stepped-back card's edge, its caps 120 px under the frame's top
    title: { x: 160, y: 104, size: 144, lines: [[0, 1, 2], [3, 4, 5, 6]] },
    // the card's edge lands on x 160 under the title's caps, its top 80 px under the title's descenders
    recede: { s: 0.84, ax: 288, ay: 1091, shade: 0.06, padDy: -50 },
    // up and to the right, past her dot (clear of the thesis' last word) and out over the top edge — the exit point far
    // past it, so the stack crosses the edge at speed, mid-glide (never easing out across it, its words cut by the edge)
    slipOut: { cx: 1760, cy: 700, ex: 1840, ey: -900, shrink: 0.8 },
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
    // three lines (the 9:16 measure), on the stepped-back card's edge, under the risen dot
    title: { x: 140, y: 256, size: 120, lines: [[0, 1, 2], [3, 4], [5, 6]] },
    recede: { s: 0.84, ax: 540, ay: 1172, shade: 0.06, padDy: -30 },
    // out through the right edge, rising (the script's 9:16: "slips leave to the right") — under the reply's last word;
    // the exit point far past the edge, so the stack crosses it at speed, mid-glide
    slipOut: { cx: 1010, cy: 1400, ex: 2000, ey: 1000, shrink: 0.82 },
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

/* ── b16's step back ──────────────────────────────────────────────── */

/** SPRING.site in closed form (k 300, c 22, m 1: one 7.5 % overshoot — Part I's step back), at 30 fps */
const site = (dt: number) => {
  if (dt <= 0) return 0;
  const tt = dt / 30;
  const w0 = Math.sqrt(300);
  const z = 22 / (2 * Math.sqrt(300));
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * tt) * (Math.cos(wd * tt) + ((z * w0) / wd) * Math.sin(wd * tt));
};

export type DeskStep = { s: number; ax: number; ay: number; shade: number; k: number; padDy: number };

/** The desk's step back at t (desk plane: scale `s` about (ax, ay)), its shade, the paper's rise (desk px) and the
 *  spring's progress `k`. */
export const deskStep = (t: number, vertical: boolean): DeskStep => {
  const r = mattersLayout(vertical).recede;
  const k = site(t - M.recede);
  return { s: 1 - (1 - r.s) * k, ax: r.ax, ay: r.ay, shade: r.shade * Math.min(1, Math.max(0, k)), k, padDy: r.padDy * k };
};

/** A desk-local point → the screen: the step back (desk plane), then the camera (the desk Layer). */
export const deskToScreen = (t: number, vertical: boolean, x: number, y: number) => {
  const st = deskStep(t, vertical);
  const p = toScreen(mattersCam(t, vertical), vertical, PLANE.desk, st.ax + st.s * (x - st.ax), st.ay + st.s * (y - st.ay));
  return { x: p.x, y: p.y, z: p.z * st.s };
};

/** The screen → a desk-local point (the inverse of deskToScreen). */
export const screenToDesk = (t: number, vertical: boolean, x: number, y: number) => {
  const st = deskStep(t, vertical);
  const cam = mattersCam(t, vertical);
  const W = vertical ? 1080 : 1920;
  const H = vertical ? 1920 : 1080;
  const z = 1 + (cam.zoom - 1) * PLANE.desk;
  const px = W / 2 + (x + cam.x * PLANE.desk - W / 2) / z;
  const py = H / 2 + (y + cam.y * PLANE.desk - H / 2) / z;
  return { x: st.ax + (px - st.ax) / st.s, y: st.ay + (py - st.ay) / st.s };
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

/** a quadratic Bézier, one coordinate */
const bez = (a: number, b: number, c: number, u: number) => (1 - u) * (1 - u) * a + 2 * u * (1 - u) * b + u * u * c;

/**
 * Slip i of the old stack at t (offsets from the layout's stack place, desk-plane px, before the step back's scale is
 * undone — they are desk-local). At rest a squared pile, its edges showing. A beat's fifth after "do." it lifts (a 4-frame
 * rise off the pad: scale 1.015, the shadow opening) and the stack glides off AS ONE — over the cascade's whole window
 * (MATTERS_LOCAL.stack: the first glide's start to the last one's end, so the one glide sound still covers it and peaks at
 * its fastest frame), EASE.inOut — on an ARC up toward the teal dot (16:9: up and right, past the dot, out over the top
 * edge, clear of the thesis; 9:16: out through the right edge, rising), shrinking a little as it goes. Every slip rides
 * the same progress from its own place in the pile (the pile closing up as it goes), so no slip ever slides across
 * another's words. The path is laid in SCREEN px (where the dot and the frame edge are) and brought back into the desk
 * plane, so it holds under the step back and the push.
 */
export function stackSlip(i: number, t: number, vertical: boolean): StackPose {
  const g = mattersLayout(vertical);
  const p = PILE[i] ?? PILE[PILE.length - 1];
  const s = M.stack;
  const lift = out3((t - s.lift) / 4);
  const u = inOut((t - s.glide[0]) / (s.glide[1] - s.glide[0] + (s.n - 1) * s.stagger));
  const rest = { dx: p.dx, dy: p.dy + deskStep(t, vertical).padDy, rot: g.stack.rot + p.rot, lift: 0.4 + 1.4 * lift, scale: 1 + 0.015 * lift };
  if (u <= 0) return rest;
  // the slip's centre at rest, on screen (this frame's step back and camera), then along the arc
  const c0 = { x: g.stack.x + rest.dx + g.stack.w / 2, y: g.stack.y + rest.dy + g.stack.h / 2 };
  const S = deskToScreen(t, vertical, c0.x, c0.y);
  const o = g.slipOut;
  const q = screenToDesk(t, vertical, bez(S.x, o.cx, o.ex, u), bez(S.y, o.cy, o.ey, u));
  return {
    dx: q.x - g.stack.w / 2 - g.stack.x,
    dy: q.y - g.stack.h / 2 - g.stack.y,
    rot: rest.rot - 5 * u,
    lift: rest.lift,
    scale: rest.scale * (1 - (1 - o.shrink) * u),
  };
}

/* ── the dark ─────────────────────────────────────────────────────── */

/** 0 → 1 across the darkening (the last three beats): a sine in-out — the light dims evenly across all three beats */
export const darkness = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01((t - M.dark[0]) / (M.dark[1] - M.dark[0])));
/** the clock's last guard (it has left up through its masks long before the dark) */
export const typeFade = (t: number) => 1 - smoothstep(M.fade[0], M.fade[1], t);
/** the ground's hand-off into the night: the light dims as one (brightness ∝ the darkness), the lit shade goes out
 *  first, the lift with the light; the night's violet comes in late and only into the dark — never a lavender wash over
 *  the light room */
export const groundGrade = (t: number) => {
  const d = darkness(t);
  const mix = smoothstep(0.5, 1, d);
  // (the night's violet at half chroma: an indigo bias in the dark, not a purple glow)
  return { lift: 1 - d, brightness: 1 - 0.93 * Math.pow(d, 0.85), mix, shade: 1 - smoothstep(0, 0.6, d), saturation: 1 - 0.55 * mix };
};

/**
 * THE CLOSING KEY (the dark's shape): the room's light is pulled in from the frame's far edges onto her dot — lit inside
 * `ri`, night beyond `ro` (a smoothstep between: a deep soft falloff, a vignette, never an iris's edge), `mid` its half. It starts with `ri` past the farthest corner (nothing has changed) and lands with `ro` at 0 (only the night
 * and the dot's own key pool are left: b17's first picture). Progress is darkness(t) — even across the three beats.
 * null before the dark.
 */
export type Closing = {
  x: number;
  y: number;
  ri: number;
  ro: number;
  mid: number;
  c: number;
  /** how much of the lit room is left at the core (1 → 0 over the dark's last third: the core gives way to the night's
   *  own teal key pool on the dot, never a lit disc) */
  a: number;
  /** the radius where the room's light falls to half — where type turns from ink to the night's (-1: nowhere, all night) */
  edge: number;
};
/** the inverse of smoothstep on [0, 1] */
const invSmooth = (y: number) => 0.5 - Math.sin(Math.asin(1 - 2 * Math.min(1, Math.max(0, y))) / 3);
export const closingAt = (t: number, vertical: boolean): Closing | null => {
  if (t <= M.dark[0]) return null;
  const c = darkness(t);
  const d = dotAt(t, vertical);
  const W = vertical ? 1080 : 1920;
  const H = vertical ? 1920 : 1080;
  const far = Math.max(Math.hypot(d.x, d.y), Math.hypot(W - d.x, d.y), Math.hypot(d.x, H - d.y), Math.hypot(W - d.x, H - d.y));
  // a vignette, not an iris: the dark rises out of the corners over a falloff ~2.4× as deep as the lit core, and the
  // whole of it contracts onto the dot (faster at first: the frame's far reaches go while the thesis still reads)
  const k = Math.pow(1 - c, 1.4);
  const ri = far * k;
  const ro = (2.4 * far + 40) * k;
  const a = 1 - smoothstep(0.6, 0.9, c);
  const edge = a <= 0.5 ? -1 : ri + (ro - ri) * invSmooth(1 - 0.5 / a);
  return { x: d.x, y: d.y, ri, ro, mid: (ri + ro) / 2, c, a, edge };
};
/** how lit a screen point is under the closing key (1 = the room's light, 0 = night) */
export const litAt = (cl: Closing | null, x: number, y: number) => (cl ? cl.a * (1 - smoothstep(cl.ri, cl.ro, Math.hypot(x - cl.x, y - cl.y))) : 1);

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

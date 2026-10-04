/**
 * PART I · THE REPEAT (b01–b05) — the desk: every position and every pose as a PURE FUNCTION of the act's
 * time (repeat-local = absolute timeline frames: the act starts at 0). No React (Node-safe), so the
 * neighbouring acts can import the end state and continue from it without a jump:
 *
 *   deskLayout(vertical)       the frame's geometry (card, clock, slip pile, caller slots), frame px
 *   deskCam(t)                 the slow push (zoom 1 → 1.06 over the act, drifting toward the pad, tightening
 *                              through b05's rolls), cut dead on the hard stop — the camera of the act's three planes
 *   cardDepth(t)               the in-person card stepping back a depth on each ring (scale, shade)
 *   slipPose(k, t, vertical)   slip k of the pile: where it is, how high it is held, its rotation
 *   SLIP_LAND / SLIP_COUNT     the moments each slip lands (3 answers + the six rolls)
 *   REPEAT_END                 everything above at the hard stop (what b06 starts from)
 *
 * PLANES (SCRIPT.md b01): ground 0.2 (the muted mesh), desk 0.6 (the in-person card, the message pad
 * and its pile), near 1.0 (the clock lockup with its rose line light, the caller's turn). Positions are
 * in each plane's own (unzoomed) frame px; the camera moves the planes, never the parts.
 *
 * NEIGHBOURS build on this file and on the parts (b06 opens on this desk): keep these names and shapes
 * stable — deskLayout, deskCam, PLANE, cardDepth, slipRest / slipPose / slipZ / SLIP_LAND / SLIP_COUNT,
 * pileJolt, CLOCK_TIMES, toScreen, repeatEndScreen, REPEAT_END; the parts InPersonCard, Slips, DeskClock,
 * CallerTurn (props t + g); scenes/Repeat.tsx RepeatDesk and REPEAT_GROUND.
 */
import { REPEAT_LOCAL as R, vWord, type VoiceId } from '../../timing.ts';

/* ── the frame ─────────────────────────────────────────────────── */

export type Box = { x: number; y: number; w: number; h: number };

export type CallerSlot = {
  /** label top-left (16:9: left-aligned; 9:16: centred on x) */
  x: number;
  labelY: number;
  /** centre of the caption's first row */
  rowY: number;
  maxWidth: number;
  align: 'left' | 'center';
  /** the line's waveform: centre, half-width */
  waveX: number;
  waveY: number;
  waveHalf: number;
};

export type DeskLayout = {
  vertical: boolean;
  /** the in-person card (desk plane) */
  card: Box & { padX: number; padTop: number; size: number; lines: readonly (readonly string[])[] };
  /** the clock lockup (near plane): figures' top-left, figure size; the colon dot's centre */
  clock: { x: number; y: number; size: number; cellW: number; cellH: number; gap: number; dot: number; dotX: number; dotY: number; dayY: number; lineY: number };
  /** the message pad's first sheet (desk plane): the pile builds up from here */
  slip: Box & { padX: number; padTop: number; size: number; label: number };
  /** how far each slip of the pile sits above the one before: the answers (on top of each other), the rolls
   *  (slipped in BEHIND the pile, each showing a strip of paper more above it: the column grows up) */
  step: { answer: number; roll: number };
  /** where each caller's turn sits: they move in on the card, call after call (b04: the caption overlaps it) */
  callers: readonly [CallerSlot, CallerSlot, CallerSlot];
};

/** The sentence on the in-person card, in its two lines (balanced at the caption role; the dash hangs at the end). */
export const CARD_LINES = [
  ['First', 'session', 'since', 'my'],
  ['injury,', 'and', 'I’m', 'a', 'bit'],
] as const;
/** The desk's answer, on the slip, in two lines (the comma breaks it). Spoken words 0..4 of kb2-desk-1. */
export const ANSWER_LINES = [
  ['Yes,', 'Saturdays,'],
  ['nine', 'till', 'two.'],
] as const;
/** The day's clock: 09:13 at the start, then one time per ring and per roll (SCRIPT.md b02–b05). */
export const CLOCK_TIMES = ['09:13', '09:14', '11:02', '14:30', '15:05', '15:41', '16:20', '16:58', '17:26', '17:58'] as const;

const LAND: DeskLayout = {
  vertical: false,
  card: { x: 150, y: 384, w: 940, h: 384, padX: 74, padTop: 62, size: 76, lines: CARD_LINES },
  clock: (() => {
    const size = 112;
    const cellW = 0.6 * size;
    const cellH = 1.1 * size;
    const gap = 18;
    const dot = 20;
    const right = 1770;
    const w = 4 * cellW + 2 * gap + dot;
    const x = right - w;
    const y = 170;
    return { x, y, size, cellW, cellH, gap, dot, dotX: x + 2 * cellW + gap + dot / 2, dotY: y + cellH * 0.53, dayY: y - 40, lineY: y + cellH + 6 };
  })(),
  slip: { x: 1230, y: 690, w: 540, h: 288, padX: 50, padTop: 40, size: 64, label: 30 },
  step: { answer: 9, roll: 30 },
  callers: [
    { x: 1230, labelY: 382, rowY: 462, maxWidth: 580, align: 'left', waveX: 1480, waveY: 628, waveHalf: 250 },
    { x: 1112, labelY: 382, rowY: 462, maxWidth: 690, align: 'left', waveX: 1362, waveY: 628, waveHalf: 250 },
    // b04: higher, in over the card's top-right corner (above its sentence, never level with it); its line
    // starts clear of the card's edge (a dotted line beside "my" would read as a leader)
    { x: 962, labelY: 296, rowY: 374, maxWidth: 600, align: 'left', waveX: 1266, waveY: 544, waveHalf: 210 },
  ],
};

const VERT: DeskLayout = {
  vertical: true,
  card: { x: 64, y: 530, w: 952, h: 358, padX: 66, padTop: 60, size: 68, lines: CARD_LINES },
  clock: (() => {
    const size = 104;
    const cellW = 0.6 * size;
    const cellH = 1.1 * size;
    const gap = 17;
    const dot = 19;
    const w = 4 * cellW + 2 * gap + dot;
    const x = 540 - w / 2;
    const y = 352;
    return { x, y, size, cellW, cellH, gap, dot, dotX: x + 2 * cellW + gap + dot / 2, dotY: y + cellH * 0.53, dayY: y - 38, lineY: y + cellH + 6 };
  })(),
  slip: { x: 300, y: 1210, w: 480, h: 262, padX: 44, padTop: 36, size: 56, label: 28 },
  step: { answer: 11, roll: 34 },
  callers: [
    { x: 540, labelY: 930, rowY: 1012, maxWidth: 900, align: 'center', waveX: 540, waveY: 1160, waveHalf: 300 },
    { x: 540, labelY: 930, rowY: 1012, maxWidth: 900, align: 'center', waveX: 540, waveY: 1160, waveHalf: 300 },
    // b04 (9:16): the caption crowds up tight under the card's lower edge (a tag straddling the edge read as an
    // accident; the 16:9 frame has the room for the real overlap)
    { x: 540, labelY: 898, rowY: 980, maxWidth: 900, align: 'center', waveX: 540, waveY: 1130, waveHalf: 300 },
  ],
};

export const deskLayout = (vertical: boolean): DeskLayout => (vertical ? VERT : LAND);

/* ── the camera: one slow push across Part I, held on the hard stop ── */

export type Pose = { x: number; y: number; zoom: number };

/** ease-in over the first quarter, then a constant slow push — still moving on the hard stop, where it simply stops */
const pushProgress = (t: number) => {
  const u = Math.min(1, Math.max(0, t / R.hardStop));
  const a = 0.25;
  return u < a ? (u * u) / (2 * a) / (1 - a / 2) : (u - a / 2) / (1 - a / 2);
};

/** b05: through the rest of the day the push tightens (ease-in, quadratic), so the hard stop cuts it at its fastest */
const squeeze = (t: number) => {
  const u = Math.min(1, Math.max(0, (t - R.dead[1]) / (R.hardStop - R.dead[1])));
  return u * u;
};

/** The act's camera (Camera x/y/zoom: x/y = how far the camera has moved, in near-plane px). */
export const deskCam = (t: number, vertical: boolean): Pose => {
  const e = pushProgress(t);
  const q = squeeze(t);
  // the push leans toward the pad (bottom right in 16:9, the bottom in 9:16)
  return vertical ? { x: 0, y: 14 * e + 8 * q, zoom: 1 + 0.05 * e + 0.016 * q } : { x: 20 * e + 10 * q, y: 10 * e + 6 * q, zoom: 1 + 0.06 * e + 0.018 * q };
};

/** the plane depths (SCRIPT.md b01) */
export const PLANE = { ground: 0.2, desk: 0.6, near: 1.0 } as const;

/* ── springs, in closed form (the same physics as lib/motion springUnit, at 30 fps; Node-safe copy) ── */
const spring = (dt: number, k: number, c: number, m = 1) => {
  if (dt <= 0) return 0;
  const tt = dt / 30;
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * tt) * (Math.cos(wd * tt) + ((z * w0) / wd) * Math.sin(wd * tt));
  }
  return 1 - Math.exp(-w0 * tt) * (1 + w0 * tt);
};
/** SPRING.site (one 7.5 % overshoot) */
const site = (dt: number) => spring(dt, 300, 22);
/** SPRING.land (≈ 18 % overshoot) */
const landSpring = (dt: number) => spring(dt, 210, 13);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const easeIn3 = (u: number) => u * u * u;

/* ── the in-person card: attention leaves the person, ring by ring ── */

/**
 * The card's depth (SCRIPT.md b02–b05): 1 → .96 on ring one; it drifts forward while the desk answers
 * but stops at .97 (it never quite comes back); .95 on ring two; a hair forward again; .93 on ring three
 * (shade .08); and a step further back on every roll of the rest of the day, to .90.
 */
export const cardDepth = (t: number): { scale: number; shade: number } => {
  const [r1, r2, r3] = R.rings;
  let s = 1;
  let shade = 0;
  s -= 0.04 * site(t - r1);
  shade += 0.05 * site(t - r1);
  s += 0.01 * smoothstep(R.desk[0], r2 - 2, t);
  shade -= 0.012 * smoothstep(R.desk[0], r2 - 2, t);
  s -= 0.02 * site(t - r2);
  shade += 0.027 * site(t - r2);
  s += 0.005 * smoothstep(R.desk[1], r3 - 2, t);
  s -= 0.025 * site(t - r3);
  shade += 0.015 * site(t - r3);
  for (const f of R.rolls) {
    s -= (0.03 / R.rolls.length) * site(t - f);
    shade += (0.04 / R.rolls.length) * site(t - f);
  }
  return { scale: s, shade: Math.max(0, shade) };
};

/* ── the slips: the message pad, the three answers, the rest of the day ── */

const DESK1: VoiceId = 'kb2-desk-1';
/** the answer's words land on Leo's real word onsets (frames from the line's start) */
export const answerWordAt = (k: number) => vWord(DESK1, k);

/** slips in the pile: the three answers, then one per roll */
export const SLIP_COUNT = 3 + R.rolls.length;
/** each slip lands: the answers on the 16th of "two." (REPEAT_LOCAL.slips), the rolls a 16th after their roll */
export const SLIP_LAND: readonly number[] = [...R.slips, ...R.rollSlips];

/** slip k's rest pose in the pile: offset from the pad's first sheet (px), rotation (deg) */
export const slipRest = (k: number, vertical: boolean): { dx: number; dy: number; rot: number } => {
  const g = deskLayout(vertical);
  if (k === 0) return { dx: 0, dy: 0, rot: -0.3 };
  // the second answer: the fixed 3 px offset and +.4°; the third alone lands crooked (+1.2°)
  if (k === 1) return { dx: 3, dy: -g.step.answer, rot: 0.4 };
  if (k === 2) return { dx: -2, dy: -2 * g.step.answer, rot: 1.2 };
  // the rolls: slipped in behind the pile, each a step higher — a neat column of paper edges rising above it
  const j = k - 2;
  const jx = [1.5, -2.5, 2, -1, 2.5, -2][(j - 1) % 6];
  const jr = [-0.35, 0.3, -0.2, 0.45, -0.3, 0.2][(j - 1) % 6];
  return { dx: jx, dy: -2 * g.step.answer - j * g.step.roll, rot: jr };
};

export type SlipPose = {
  /** exists (drawn) */
  on: boolean;
  /** offset from the pad's first sheet, px; rotation, deg; elevation lift (meshElevation) */
  dx: number;
  dy: number;
  rot: number;
  lift: number;
  opacity: number;
  /** a squash on the landing (scaleY), 1 at rest */
  squash: number;
};

/** a fresh answer slip is brought in from the desk's front edge (below the frame) over this many frames,
 *  arriving a frame before the desk's first word */
const PLACE_DUR = R.placeDur;
const PLACE_LEAD = R.placeLead;
/** a slip being written is held this far above its place in the pile (px) */
const HOVER = 16;
const out3 = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);

/** the stacking order of slip k: the answers on top (newest first), the pad's blank sheets under them,
 *  the rolls' slips behind everything (each new one behind the last) */
export const slipZ = (k: number) => (k < 3 ? 20 + k : 10 - (k - 2));

/**
 * Slip k at time t. THE ANSWERS: the first is the pad's own top sheet (it peels up as the line ends); the
 * next two are fresh slips, brought up from the desk's front edge over the pile just before the desk speaks
 * and held a hand's breadth up while the words arrive. Each drops on "two." (a 3-frame fall) and lands on
 * the pile, its shadow tightening. THE ROLLS: a written slip is slipped in BEHIND the pile on each 8th and
 * rises to sit a strip higher than the last (the land spring: up on the 16th, a touch past, settling) —
 * the column of paper edges grows; its height is the count. Nothing fades in: every slip enters from out of
 * frame or from behind paper, so no text ever shows through another.
 */
export function slipPose(k: number, t: number, vertical: boolean): SlipPose {
  const g = deskLayout(vertical);
  const rest = slipRest(k, vertical);
  const landAt = SLIP_LAND[k];
  const restLift = 0.35;
  const off = { on: false, dx: rest.dx, dy: rest.dy, rot: rest.rot, lift: restLift, opacity: 0, squash: 1 };
  // after the contact the paper settles: a small damped turn about its pile pose
  const wobble = (amp: number) => (t >= landAt ? amp * Math.sin((t - landAt) * 0.85) * Math.exp(-(t - landAt) / 3.2) : 0);
  let dx: number;
  let dy: number;
  let rot: number;
  let lift: number;
  if (k < 3) {
    const placeAt = k === 0 ? -Infinity : R.desk[k] - PLACE_LEAD;
    if (t < placeAt) return off;
    const fall = easeIn3(clamp01((t - (landAt - 3)) / 3));
    // held up while written: the pad's own sheet peels up as the line nears its end; a fresh slip arrives held
    const peel = k === 0 ? smoothstep(R.desk[0] + answerWordAt(3) - 6, R.desk[0] + answerWordAt(4), t) : 1;
    const held = peel * (1 - fall);
    const place = k === 0 ? 1 : out3((t - placeAt) / PLACE_DUR);
    // in from below the frame's bottom edge (the desk's front), turning straight as it settles into the hand
    const below = (vertical ? 1920 : 1080) + 30 - (g.slip.y + rest.dy - HOVER);
    dx = rest.dx * (k === 0 ? 1 : fall) + (1 - place) * (vertical ? 18 : 34);
    dy = rest.dy - HOVER * held + (1 - place) * below;
    rot = (k === 0 ? rest.rot * (1 - held) : rest.rot * fall - 1.6 * (1 - place)) + wobble(0.5 * Math.sign(rest.rot || 1));
    lift = restLift + 1.5 * held + 1.4 * (1 - place);
  } else {
    // a roll's slip: from hidden right behind the last one, up one strip of the column, on the land spring
    const riseAt = landAt - 4.7;
    if (t < riseAt) return off;
    const u = landSpring(t - riseAt);
    const prev = slipRest(k - 1, vertical);
    dx = prev.dx + (rest.dx - prev.dx) * Math.min(1, u);
    dy = prev.dy + (rest.dy - prev.dy) * u;
    rot = prev.rot + (rest.rot - prev.rot) * Math.min(1, u) + wobble(0.2 * Math.sign(rest.rot));
    lift = 0.3;
  }
  // the contact: a 2 % squash that springs out (an answer landing on the pile)
  const contact = k < 3 && t >= landAt ? Math.exp(-(t - landAt) / 2.2) : 0;
  const squash = 1 - 0.02 * contact;
  // once the next answer lands on it, it lies flat under it
  if (k < 2 && t >= SLIP_LAND[k + 1]) lift = Math.max(0.15, lift - 0.2 * clamp01((t - SLIP_LAND[k + 1]) / 4));
  return { on: true, dx, dy, rot, lift, opacity: 1, squash };
}

/** The pile's jolt when an answer lands on it (px, down): the paper under it takes the weight and springs back. */
export const pileJolt = (t: number, below: number): number => {
  let j = 0;
  for (let k = below + 1; k < 3; k++) {
    const dt = t - SLIP_LAND[k];
    if (dt >= 0 && dt < 20) j += 1.4 * Math.exp(-dt / 3) * Math.cos(dt * 0.9);
  }
  return j;
};

/* ── the moments the line light answers (rings and rolls), and the room's rose tint ── */

/** Rose tint of the room (the line light on the ground): .03 at rest, .06 on each ring / roll, relaxing. */
export const roomTint = (t: number): number => {
  let p = 0;
  for (const f of [...R.rings, ...R.rolls]) {
    const dt = t - f;
    if (dt >= 0) p = Math.max(p, Math.exp(-dt / 9) * (1 - Math.exp(-dt / 0.8)));
  }
  return 0.03 + 0.03 * p;
};

/* ── the end state (the hard stop): where b06 picks up ── */

/** A plane point → the screen at time t (the act's Camera/Layer maths: zoom about the frame centre, then
 *  the camera's shift × the plane's depth). */
export const toScreen = (t: number, vertical: boolean, depth: number, x: number, y: number) => {
  const c = deskCam(t, vertical);
  const W = vertical ? 1080 : 1920;
  const H = vertical ? 1920 : 1080;
  const z = 1 + (c.zoom - 1) * depth;
  return { x: W / 2 + z * (x - W / 2) - c.x * depth, y: H / 2 + z * (y - H / 2) - c.y * depth, z };
};

/**
 * THE PICTURE ON THE HARD STOP, in SCREEN px — what b06's first frame must show for the cut to be
 * invisible (every object = its plane geometry through the camera, desk.ts toScreen):
 *   card    the in-person card: its screen centre and total scale (plane zoom × its depth), its shade
 *   clock   the figures' top-left and size on screen; the colon's centre (the rose light, drained at the stop)
 *   pile    the pad's first sheet's top-left on screen and the desk plane's zoom; every slip's rest offset
 *           (px in the plane, before that zoom) and rotation, from the bottom of the pile up — answers 1–3
 *           on top of each other (3 is crooked), the six rolls' slips behind them, a strip higher each
 */
export const repeatEndScreen = (vertical: boolean) => {
  const g = deskLayout(vertical);
  const t = R.hardStop;
  const d = cardDepth(t);
  const cc = toScreen(t, vertical, PLANE.desk, g.card.x + g.card.w / 2, g.card.y + g.card.h / 2);
  const ck = toScreen(t, vertical, PLANE.near, g.clock.x, g.clock.y);
  const dot = toScreen(t, vertical, PLANE.near, g.clock.dotX, g.clock.dotY);
  const pad = toScreen(t, vertical, PLANE.desk, g.slip.x, g.slip.y);
  return {
    card: { cx: cc.x, cy: cc.y, w: g.card.w, h: g.card.h, scale: cc.z * d.scale, shade: d.shade },
    clock: { x: ck.x, y: ck.y, size: g.clock.size * ck.z, text: CLOCK_TIMES[CLOCK_TIMES.length - 1], dot: { x: dot.x, y: dot.y, d: g.clock.dot * dot.z } },
    pile: { x: pad.x, y: pad.y, zoom: pad.z, w: g.slip.w, h: g.slip.h, size: g.slip.size, slips: Array.from({ length: SLIP_COUNT }, (_, k) => ({ ...slipRest(k, vertical), z: slipZ(k) })) },
  };
};

export const REPEAT_END = {
  /** the act's last moment: the hard stop */
  at: R.hardStop,
  cam: (vertical: boolean) => deskCam(R.hardStop, vertical),
  card: cardDepth(R.hardStop),
  /** the clock reads the last roll's time */
  clock: CLOCK_TIMES[CLOCK_TIMES.length - 1],
  /** every slip of the pile at rest (offsets from deskLayout(v).slip) */
  slips: (vertical: boolean) => Array.from({ length: SLIP_COUNT }, (_, k) => slipRest(k, vertical)),
  /** at the stop the rose tint drains to neutral in one frame (b05): b06 opens on 0 */
  tint: 0,
  /** the mesh: MUTED_MESH, lift .88, seed 0, its clock = the absolute timeline (scenes/Repeat.tsx REPEAT_GROUND) */
  ground: { lift: 0.88, seed: 0 },
  screen: repeatEndScreen,
};

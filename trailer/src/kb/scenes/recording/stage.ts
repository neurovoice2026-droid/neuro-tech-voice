/**
 * b06 · A RECORDING — the act's CAMERA and LAYOUT (pure numbers; no React).
 *
 * The act opens on Part I's last picture exactly: the same desk parts (scenes/repeat/*), the same three
 * planes (ground 0.2 · desk 0.6 · near 1.0, components/Camera) and the same camera — repeat/desk.ts
 * deskCam at the hard stop (REPEAT_END). From there THIS act moves the camera (Camera x/y in near-plane
 * px, zoom about the frame centre; plane d sees zoom 1 + (zoom − 1)·d and shift −(x, y)·d):
 *
 *   P0  the hard stop (Repeat's pose)
 *   P1  "up and right onto the slip stack": the desk leaves the frame — in 16:9 the camera dips (the
 *       clock rides up to the top edge, the card stays below the title) and travels right (the card and
 *       the clock leave by the left); in 9:16, where the clock stands in the title's place and the card
 *       fills the width, it travels the other way (the clock leaves by the right, clear of the left-set
 *       title, before its words arrive). The slips are carried by hand meanwhile (Stack.tsx, screen px).
 *   P2  "back and left to the in-person card": the card at full depth on the caption size — in 16:9
 *       centre-right with the question beside it on its own baselines; in 9:16 under the clock (b07's
 *       orb is born from its colon there) with the question below it.
 *
 * The neighbours: Repeat's last frame = P0's picture (nothing of this act differs at frame 0 but the
 * drained rose tint and the cut ring/pulse); the turn (b07) starts from P2's picture (`recEnd`).
 */
import { EASE } from '../../../lib/motion';
import { RECORDING_LOCAL as RL, REPEAT_LOCAL } from '../../timing';
import { deskCam, PLANE } from '../repeat/desk';

export type Pose = { x: number; y: number; zoom: number };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const ease = (t: number, a: number, b: number) => EASE.inOut(clamp01((t - a) / (b - a)));

export type Stage = {
  W: number;
  H: number;
  vertical: boolean;
  P0: Pose;
  P1: Pose;
  P2: Pose;
  /** the column (screen px at P1): the strips' left edge, row 0's top, the strip width / height and the
   *  row pitch (the strip above tucked over the top of the one below), its paper fades (screen y) */
  column: { x: number; top: number; w: number; h: number; pitch: number; pad: number; fade: { a: number; b: number; c: number; d: number } };
  /** the titles over the column (screen px): left edge, first line box top */
  title: { x: number; y: number };
  /** beside / under the card at P2 (screen px): the question's first line box top, "Waiting."'s baseline */
  question: { x: number; y: number };
  waiting: { x: number; baseline: number };
};

export function stageFor(vertical: boolean): Stage {
  const P0 = deskCam(REPEAT_LOCAL.hardStop, vertical);
  if (!vertical) {
    return {
      W: 1920,
      H: 1080,
      vertical,
      P0,
      P1: { x: 2050, y: 175, zoom: 1.16 },
      P2: { x: -1150, y: 60, zoom: 1 },
      column: { x: 110, top: 520, w: 940, h: 130, pitch: 114, pad: 27, fade: { a: 440, b: 520, c: 950, d: 1078 } },
      title: { x: 160, y: 150 },
      question: { x: 160, y: 476 },
      waiting: { x: 160, baseline: 796 },
    };
  }
  return {
    W: 1080,
    H: 1920,
    vertical,
    P0,
    P1: { x: -1950, y: P0.y, zoom: P0.zoom },
    P2: { x: 0, y: -50, zoom: 1 },
    // the strip: b06's 16:9 strip at the 9:16 title size (940 × 56/64 — the strip written/Slips.tsx scales), so the
    // folded row stays ≥ 40 px inside the frame's right edge while it is still being carried
    column: { x: 42, top: 770, w: 822, h: 113, pitch: 100, pad: 23.5, fade: { a: 660, b: 770, c: 1450, d: 1630 } },
    title: { x: 86, y: 290 },
    question: { x: 130, y: 1030 },
    waiting: { x: 130, baseline: 1330 },
  };
}

/** the pull-back's curve: a soft start, the travel early, a long settle (the card has passed the type by "customer") */
const pullEase = (u: number) => {
  const x = clamp01(u);
  const a = x * x * (3 - 2 * x);
  const b = 1 - Math.pow(1 - x, 3.4);
  return a * (1 - x) + b * x;
};

/** the pull-back: 36 frames centred on "And" (timing.ts RECORDING_LOCAL.pull) — off the column as the title leaves, onto
 *  the card on "customer" */
export const PULL = RL.pull;

/** The camera at act-local t (Camera props; x/y in near-plane px). */
export function camPose(t: number, G: Stage): Pose {
  const { P0, P1, P2 } = G;
  if (t >= PULL[0]) {
    const e = pullEase((t - PULL[0]) / (PULL[1] - PULL[0]));
    return { x: P1.x + (P2.x - P1.x) * e, y: P1.y + (P2.y - P1.y) * e, zoom: P1.zoom + (P2.zoom - P1.zoom) * e };
  }
  const [g0, g1] = RL.glide;
  // 16:9: the dip leads (the clock rises clear of the title before the travel brings it over); 9:16: one travel
  const ex = ease(t, g0 + (G.vertical ? 0 : 2), g1);
  const ey = G.vertical ? ex : ease(t, g0, g0 + 22);
  const ez = ease(t, g0, g1);
  return { x: P0.x + (P1.x - P0.x) * ex, y: P0.y + (P1.y - P0.y) * ey, zoom: P0.zoom + (P1.zoom - P0.zoom) * ez };
}

/** a plane point → screen (components/Camera Layer maths) */
export function toScreen(p: Pose, G: Stage, depth: number, x: number, y: number) {
  const z = 1 + (p.zoom - 1) * depth;
  return { x: G.W / 2 + z * (x - G.W / 2) - p.x * depth, y: G.H / 2 + z * (y - G.H / 2) - p.y * depth, z };
}

/**
 * The carried stack's frame: a translate + a scale about the frame centre (the Layer form) that is
 * Repeat's desk plane at the stop (so the pile is exactly where Part I left it), eases to the screen
 * (identity) while the stack is lifted and carried, and — once the camera pulls back — becomes the desk
 * plane again, relative to P1 (the column is left behind in the world the camera moves through).
 */
export function stackFrame(t: number, G: Stage): { tx: number; ty: number; s: number } {
  const d = PLANE.desk;
  const z0 = 1 + (G.P0.zoom - 1) * d;
  if (t < PULL[0]) {
    const u = ease(t, RL.slide[0], RL.slide[1]);
    return { tx: -G.P0.x * d * (1 - u), ty: -G.P0.y * d * (1 - u), s: z0 + (1 - z0) * u };
  }
  const p = camPose(t, G);
  const z1 = 1 + (G.P1.zoom - 1) * d;
  const z = 1 + (p.zoom - 1) * d;
  const k = z / z1;
  return { tx: k * G.P1.x * d - p.x * d, ty: k * G.P1.y * d - p.y * d, s: k };
}

/** a point of the stack's own space → screen */
export const stackToScreen = (f: { tx: number; ty: number; s: number }, G: Stage, x: number, y: number) => ({
  x: G.W / 2 + f.s * (x - G.W / 2) + f.tx,
  y: G.H / 2 + f.s * (y - G.H / 2) + f.ty,
});

/** The act's last picture (screen px at P2), for the turn (b07) to start from. */
export function recEnd(vertical: boolean) {
  const G = stageFor(vertical);
  return { cam: G.P2, question: G.question, waiting: G.waiting };
}

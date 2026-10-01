/**
 * THE CALL'S FRAMING — one centred orb, never a shot / reverse shot.
 *
 *   E   establishing  t 0 → pushIn      the orb glides from CALL_ORB_START (the
 *                                       twist's phone avatar) up into the
 *                                       "03 ◉ 12" lockup
 *   P   push          pushIn            it grows into Ava's framing as she says
 *                                       "This is Ava"
 *   A   the call      the rest          CENTRED, directly above the speaker label
 *                                       and the caption. It lives — it breathes
 *                                       with her voice (Call.tsx talkSwell) and
 *                                       SWAYS gently left ↔ right around the
 *                                       centre (a slow sine, a few tens of px,
 *                                       with a hair of pendulum arc) — but it
 *                                       never leaves the middle of the frame.
 *                                       When the caller speaks it CALMS in place:
 *                                       it eases ~14 % smaller on a soft, nearly
 *                                       critical spring (no whip, no overshoot
 *                                       you can see) and back when Ava answers.
 *
 * There is no camera any more (no handheld, no kicks, no punch-ins): the
 * frame is still, the orb and the room's light move. `camAt` / `orbToScreen`
 * / `planeCss` are kept as the identity so the twist's hand-over (twist/
 * handover.ts reads framingAt + camAt for call t −4…12) stays exact.
 *
 * Every value is a pure, smooth function of the fractional call time t.
 */
import { CALL_ORB_START } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { EASE, smooth, springUnit, tween } from '../../lib/motion';
import { CALL, CALL_LOCAL } from '../../timing';

export type Pt = { x: number; y: number };
export type Framing = Pt & { d: number };
export type ShotKind = 'E' | 'P' | 'A';
export type Shot = { kind: ShotKind; line: number; from: number; to: number };

export const framings = (L: Layout) => ({
  start: CALL_ORB_START(L),
  lock: { x: L.cx, y: L.pick(360, 680), d: L.pick(250, 220) },
  /** Ava's framing: centred over the label + caption (TRANSCRIPT.y 800 / 1180) */
  A: { x: L.cx, y: L.pick(372, 716), d: L.pick(420, 500) },
});

/** the canvas size of the one orb: the largest it ever gets on screen (never upscaled) */
export const orbBase = (L: Layout) => L.pick(540, 660);

const lines = CALL.lines;
const END = CALL_LOCAL.markHide;

export function shotAt(t: number): Shot {
  const [p0, p1] = CALL_LOCAL.pushIn;
  if (t < p0) return { kind: 'E', line: -1, from: -Infinity, to: p0 };
  if (t < p1) return { kind: 'P', line: 0, from: p0, to: p1 };
  let k = 0;
  for (let i = 1; i < lines.length; i++) if (t >= lines[i].at) k = i;
  return { kind: 'A', line: k, from: k === 0 ? p1 : lines[k].at, to: k + 1 < lines.length ? lines[k + 1].at : END };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpF = (a: Framing, b: Framing, k: number): Framing => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), d: lerp(a.d, b.d, k) });

/** the orb's glide from the phone avatar into the lockup (no overshoot: it is carried, not thrown) */
const GLIDE = { stiffness: 110, damping: 17, mass: 1 };
export const glideAt = (t: number) => (t < CALL_LOCAL.glide ? 0 : springUnit(t - CALL_LOCAL.glide, GLIDE));

/** the push into Ava's framing ("This is Ava") */
export const pushAt = (t: number) => tween(t, [CALL_LOCAL.pushIn[0] + 2, CALL_LOCAL.pushIn[1]], [0, 1], EASE.inOut);

/* ── the caller's calm ─────────────────────────────────────────── */

/** a soft, nearly critical spring (ζ ≈ .95): ≈ 90 % in 12 f, no overshoot you can see */
const CALM = { stiffness: 120, damping: 21, mass: 1 };
/** the calm starts this many frames before the turn (it is the cut, felt a beat early) */
const CALM_LEAD = 2;
/** the orb is this much smaller while the caller speaks */
export const CALM_SIZE = 0.14;

/** 0 = Ava speaking … 1 = the caller: a sum of soft springs, one per turn (continuous everywhere). */
export function calmAt(t: number): number {
  let v = 0;
  let prev = 0;
  for (let k = 1; k < lines.length; k++) {
    const target = lines[k].who === 'caller' ? 1 : 0;
    if (target !== prev) v += (target - prev) * springUnit(t - (lines[k].at - CALM_LEAD), CALM);
    prev = target;
  }
  return v;
}

/** (kept for the scene's existing call sites: the caller's share of the framing) */
export const callerK = calmAt;

/* ── the sway ──────────────────────────────────────────────────── */

/** one slow sine left ↔ right: 6 s a cycle */
const SWAY_PERIOD = 180;
/** it eases in from rest after the pickup (the hand-over to the twist is exact: 0 until t 16)… */
const SWAY_IN: readonly [number, number] = [16, 96];
/** …and back to rest before the orb dives into the mark */
const SWAY_OUT: readonly [number, number] = [END - 30, END - 12];

export const swayAmp = (L: Layout) => L.pick(30, 22);

/** −1 … 1: where the sway is now (its envelope included). */
export function swayAt(t: number): number {
  const env = smooth(SWAY_IN[0], SWAY_IN[1], t) * (1 - smooth(SWAY_OUT[0], SWAY_OUT[1], t));
  return env * Math.sin((2 * Math.PI * (t - SWAY_IN[0])) / SWAY_PERIOD);
}

/**
 * The orb's framing (on-screen centre + diameter, before the talk swell and the pickup squash):
 * the glide, the push, the sway and the caller's calm.
 */
export function framingAt(t: number, L: Layout): Framing {
  const F = framings(L);
  const [p0] = CALL_LOCAL.pushIn;
  let f: Framing;
  if (t < p0) f = lerpF(F.start, F.lock, glideAt(t));
  else f = lerpF(F.lock, F.A, pushAt(t));
  const s = swayAt(t);
  const amp = swayAmp(L);
  return {
    // the sway, with a hair of pendulum arc (it rises 4 px at its ends)
    x: f.x + amp * s,
    y: f.y - 4 * s * s,
    d: f.d * (1 - CALM_SIZE * calmAt(t)),
  };
}

/* ── the (still) camera ─────────────────────────────────────────── */

export type Cam = {
  dx: number;
  dy: number;
  base: Pt;
  S: number;
  z: number;
  focus: Pt;
};

/** The camera is still: the identity (kept so twist/handover.ts's maths stays exact). */
export function camAt(_t: number, L: Layout): Cam {
  const F = framings(L);
  return { dx: 0, dy: 0, base: { x: 0, y: 0 }, S: 1, z: 1, focus: { x: F.lock.x, y: F.lock.y } };
}

/** CSS transform for a parallax plane (the identity for the still camera). */
export function planeCss(c: Cam, depth: number): { transform: string; transformOrigin: string } {
  const Z = 1 + (c.S * c.z - 1) * depth;
  const tx = -c.dx * depth - c.base.x * (depth - 1);
  const ty = -c.dy * depth - c.base.y * (depth - 1);
  return {
    transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${Z.toFixed(5)})`,
    transformOrigin: `${c.focus.x.toFixed(1)}px ${c.focus.y.toFixed(1)}px`,
  };
}

/** Map a point on the orb's plane to the screen (the identity for the still camera). */
export function orbToScreen(c: Cam, p: Framing): Framing {
  return {
    x: c.focus.x + (p.x - c.focus.x) * c.z - c.dx,
    y: c.focus.y + (p.y - c.focus.y) * c.z - c.dy,
    d: p.d * c.z,
  };
}

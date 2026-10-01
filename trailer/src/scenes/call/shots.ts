/**
 * Shot / reverse-shot: the call's camera and Ava's orb framing, per shot.
 *
 *   E   establishing  t 0 → pushIn      the orb glides from CALL_ORB_START into
 *                                       the "03 ◉ 12" lockup
 *   P   push E → A    pushIn            1.5 % pull-back, then the orb grows into
 *                                       Ava's close-up as she says "This is Ava"
 *   A   Ava           lines 0 (after P), 2, 4 — the orb big, alive, lilac
 *   C   caller        lines 1, 3 — the orb small at left / top in the listen
 *                                       palette (DOF), the phone line fills the rest
 *
 * Hard cuts ON CALL.lines[i].at (i = 1…4). Each cut lands (zoom 1.03 → 1 on
 * the site spring); inside a shot the camera pushes 1.00 → 1.035 and travels
 * a little, alternating direction shot to shot, over a handheld drift.
 *
 * Every value is a pure function of the call-local frame t and the layout.
 * Screen direction is fixed: Ava left / top, the caller right / bottom.
 */
import { noise2D } from '@remotion/noise';
import { CALL_ORB_START } from '../../lib/handoff';
import type { Layout } from '../../lib/layout';
import { EASE, SPRING, springAt, tween } from '../../lib/motion';
import { CALL, CALL_LOCAL, vWord } from '../../timing';

export type Pt = { x: number; y: number };
export type Framing = Pt & { d: number };
export type ShotKind = 'E' | 'P' | 'A' | 'C';
export type Shot = { kind: ShotKind; line: number; from: number; to: number };

export const framings = (L: Layout) => ({
  start: CALL_ORB_START(L),
  lock: { x: L.cx, y: L.pick(360, 620), d: L.pick(250, 220) },
  A: { x: L.pick(960, 540), y: L.pick(330, 600), d: L.pick(460, 560) },
  C: { x: L.pick(380, 540), y: L.pick(360, 400), d: L.pick(300, 320) },
});

/** the canvas size of the one orb: the largest it ever gets on screen (never upscaled) */
export const orbBase = (L: Layout) => L.pick(540, 660);

const lines = CALL.lines;
const END = CALL_LOCAL.markHide;
/** frames each of Ava's phrases (captions after a line's first) starts */
const PHRASES = lines.flatMap((l) => (l.who === 'agent' ? l.captions.slice(1).map((c) => l.at + vWord(l.voice, c.word)) : []));

export function shotAt(t: number): Shot {
  const [p0, p1] = CALL_LOCAL.pushIn;
  if (t < p0) return { kind: 'E', line: -1, from: -Infinity, to: p0 };
  if (t < p1) return { kind: 'P', line: 0, from: p0, to: p1 };
  let k = 0;
  for (let i = 1; i < lines.length; i++) if (t >= lines[i].at) k = i;
  const from = k === 0 ? p1 : lines[k].at;
  const to = k + 1 < lines.length ? lines[k + 1].at : END;
  return { kind: lines[k].who === 'agent' ? 'A' : 'C', line: k, from, to };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpF = (a: Framing, b: Framing, k: number): Framing => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), d: lerp(a.d, b.d, k) });

/** the orb's glide from the phone avatar into the lockup (no overshoot: it is carried, not thrown) */
const GLIDE = { stiffness: 110, damping: 17, mass: 1 };
export const glideAt = (t: number) => (t < CALL_LOCAL.glide ? 0 : springAt(t, CALL_LOCAL.glide, GLIDE));

/** the push's orb travel: it starts after the 3-frame pull-back */
export const pushAt = (t: number) => tween(t, [CALL_LOCAL.pushIn[0] + 3, CALL_LOCAL.pushIn[1]], [0, 1], EASE.inOut);

/**
 * The orb's framing (on-screen centre + diameter, before the camera's
 * in-shot zoom, the talk swell and the pickup squash).
 */
export function framingAt(t: number, L: Layout): Framing {
  const F = framings(L);
  const s = shotAt(t);
  if (s.kind === 'E') return lerpF(F.start, F.lock, glideAt(t));
  if (s.kind === 'P') return lerpF(F.lock, F.A, pushAt(t));
  if (s.kind === 'C') return F.C;
  if (s.line === 2) {
    // a wider variant: 10 % bigger, 60 px left, drifting right over the shot
    const k = tween(t, [s.from, s.to], [0, 1], EASE.inOut);
    // (lifted a touch in 16:9 so the slot chips below it have air)
    return { x: F.A.x - 60 + 44 * k, y: F.A.y - L.pick(50, 0), d: F.A.d * 1.1 };
  }
  return F.A;
}

export type Cam = {
  /** handheld drift + in-shot travel (px, on the focal plane) */
  dx: number;
  dy: number;
  /** per-shot set-up offset: the planes shift by base·(depth − 1) — a new angle on a cut */
  base: Pt;
  /** set-up zoom (not applied to the orb, whose framing is explicit) */
  S: number;
  /** in-shot zoom: landing × push × kick */
  z: number;
  /** zoom centre */
  focus: Pt;
};

export function camAt(t: number, L: Layout): Cam {
  const F = framings(L);
  const s = shotAt(t);
  const [c0, c1] = CALL_LOCAL.camSettle;
  // the handheld is zero at the pickup (t 0 is the twist's exact frame) and at the hand-over
  const env = tween(t, [0, 40], [0, 1], EASE.inOut) * (1 - tween(t, [c0, c1], [0, 1], EASE.inOut));
  let dx = 12 * noise2D('call-cam-x', t * 0.03, 0.31) * env;
  let dy = 8 * noise2D('call-cam-y', 0.77, t * 0.03) * env;

  let S = 1;
  let z = 1;
  let base: Pt = { x: 0, y: 0 };
  let focus: Pt = { x: F.lock.x, y: F.lock.y };

  if (s.kind === 'E') {
    z = 1 + 0.04 * tween(t, [8, CALL_LOCAL.pushIn[0]], [0, 1], EASE.inOut);
  } else if (s.kind === 'P') {
    const [p0, p1] = CALL_LOCAL.pushIn;
    // anticipation: a 1.5 % pull-back over the first 3 f, released as the push takes over
    const dip = tween(t, [p0, p0 + 3], [0, 1], EASE.inOut) * (1 - tween(t, [p0 + 3, p0 + 9], [0, 1], EASE.inOut));
    z = (1.04 - 0.04 * tween(t, [p0, p1], [0, 1], EASE.inOut)) * (1 - 0.015 * dip);
    S = 1 + 0.06 * pushAt(t);
    const k = pushAt(t);
    focus = { x: lerp(F.lock.x, F.A.x, k), y: lerp(F.lock.y, F.A.y, k) };
  } else {
    const k = s.line;
    const prog = tween(t, [s.from, s.to], [0, 1], EASE.inOut);
    const land = k >= 1 ? 1 + 0.03 * (1 - springAt(t, s.from, SPRING.site)) : 1;
    // alternate the in-shot travel direction shot to shot
    const dir = k % 2 === 0 ? 1 : -1;
    dx += dir * L.pick(30, 18) * (2 * prog - 1) * env;
    dy += dir * L.pick(-10, 16) * (2 * prog - 1) * env;
    if (k === 4) {
      // the last shot: a slow pull 1.04 → 1.00, exactly at rest by camSettle[1]
      z = land * (1 + 0.04 * (1 - tween(t, [s.from, c1], [0, 1], EASE.inOut)));
    } else {
      z = land * (1 + 0.035 * prog);
      // Ava's shots re-frame on each new phrase: a small punch-in on the site spring
      if (s.kind === 'A') {
        for (const at of PHRASES) {
          if (at > s.from && at < s.to && t >= at - 2) z *= 1 + 0.028 * springAt(t, at - 2, SPRING.site);
        }
      }
    }
    if (k === 0) S = 1.06; // the push's set-up holds for the rest of Ava's first line
    if (s.kind === 'C') {
      base = { x: L.pick(70, 24), y: L.pick(-12, 46) };
      focus = { x: L.pick(L.cx, 540), y: L.pick(F.C.y, 600) };
    } else {
      const f = framingAt(t, L);
      base = k === 2 ? { x: L.pick(-46, -20), y: L.pick(8, -24) } : { x: 0, y: 0 };
      focus = { x: f.x, y: f.y };
    }
  }
  // the pick lands with a 1 % kick
  if (t >= CALL.slotPick) z *= 1 + 0.01 * Math.exp(-(t - CALL.slotPick) / 4);
  // the big hits jolt the camera (1–3 px, ON the hit frame, settled in ≈ 8 f)
  dy += kickAt(t);
  return { dx, dy, base, S, z, focus };
}

/** px per kick (CALL_LOCAL.kicks: pickup, gulp, pick, booked mark) */
const KICK_PX = [2, 2.2, 1.6, 3] as const;
/** The camera's jolt on the big hits: full on the hit frame, then a damped settle (one small rebound). */
export function kickAt(t: number): number {
  let y = 0;
  CALL_LOCAL.kicks.forEach((at, i) => {
    const u = t - at;
    if (u < 0 || u > 16) return;
    y += KICK_PX[i] * Math.exp(-u / 2.6) * Math.cos((Math.PI * u) / 3.2);
  });
  return y;
}

/** CSS transform for a parallax plane at `depth` (1 = the orb's plane). */
export function planeCss(c: Cam, depth: number): { transform: string; transformOrigin: string } {
  const Z = 1 + (c.S * c.z - 1) * depth;
  const tx = -c.dx * depth - c.base.x * (depth - 1);
  const ty = -c.dy * depth - c.base.y * (depth - 1);
  return {
    transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${Z.toFixed(5)})`,
    transformOrigin: `${c.focus.x.toFixed(1)}px ${c.focus.y.toFixed(1)}px`,
  };
}

/** Map a point on the orb's plane (depth 1) to the screen, without the set-up zoom S (the orb's framing is explicit). */
export function orbToScreen(c: Cam, p: Framing): Framing {
  return {
    x: c.focus.x + (p.x - c.focus.x) * c.z - c.dx,
    y: c.focus.y + (p.y - c.focus.y) * c.z - c.dy,
    d: p.d * c.z,
  };
}

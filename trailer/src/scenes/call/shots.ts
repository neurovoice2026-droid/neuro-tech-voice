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
 * SWINGS, not cuts, on CALL.lines[i].at (i = 1…4) — CALL_LOCAL.swing:
 *   at − 2 … at   anticipation: the orb squashes to .95 and counter-moves
 *                 12 px away from where it is going
 *   at … at + 8   it travels A ↔ C on SPRING.pop (fastest at + 1…3, when the
 *                 scene ghosts / smears what moves), its size overshoots ≈ 4 %
 *                 (peak at + 5) and settles; the camera's set-up (zoom, focus,
 *                 base offset) blends with the same spring, so every parallax
 *                 plane swings with the orb.
 * Inside a shot the camera pushes 1.00 → 1.035 and travels a little,
 * alternating direction shot to shot (so the travel is continuous across a
 * swing), over a handheld drift.
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
  lock: { x: L.cx, y: L.pick(360, 680), d: L.pick(250, 220) },
  A: { x: L.pick(960, 540), y: L.pick(330, 690), d: L.pick(460, 560) },
  C: { x: L.pick(380, 540), y: L.pick(360, 470), d: L.pick(300, 320) },
});

/** the canvas size of the one orb: the largest it ever gets on screen (never upscaled) */
export const orbBase = (L: Layout) => L.pick(540, 660);

const lines = CALL.lines;
const END = CALL_LOCAL.markHide;
/** frames each of Ava's phrases (captions after a line's first) starts */
const PHRASES = lines.flatMap((l) => (l.who === 'agent' ? l.captions.slice(1).map((c) => l.at + vWord(l.voice, c.word)) : []));

/** The shot of line k (line 0's starts when the push has landed). */
export function shotOfLine(k: number): Shot {
  const from = k === 0 ? CALL_LOCAL.pushIn[1] : lines[k].at;
  const to = k + 1 < lines.length ? lines[k + 1].at : END;
  return { kind: lines[k].who === 'agent' ? 'A' : 'C', line: k, from, to };
}

export function shotAt(t: number): Shot {
  const [p0, p1] = CALL_LOCAL.pushIn;
  if (t < p0) return { kind: 'E', line: -1, from: -Infinity, to: p0 };
  if (t < p1) return { kind: 'P', line: 0, from: p0, to: p1 };
  let k = 0;
  for (let i = 1; i < lines.length; i++) if (t >= lines[i].at) k = i;
  return shotOfLine(k);
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpF = (a: Framing, b: Framing, k: number): Framing => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), d: lerp(a.d, b.d, k) });
const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const unit = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const n = Math.hypot(dx, dy);
  return n < 1e-6 ? { x: 0, y: 0 } : { x: dx / n, y: dy / n };
};

/** the orb's glide from the phone avatar into the lockup (no overshoot: it is carried, not thrown) */
const GLIDE = { stiffness: 110, damping: 17, mass: 1 };
export const glideAt = (t: number) => (t < CALL_LOCAL.glide ? 0 : springAt(t, CALL_LOCAL.glide, GLIDE));

/** the push's orb travel: it starts after the 3-frame pull-back */
export const pushAt = (t: number) => tween(t, [CALL_LOCAL.pushIn[0] + 3, CALL_LOCAL.pushIn[1]], [0, 1], EASE.inOut);

/* ── the swing ─────────────────────────────────────────────────────── */
/** frames of anticipation before a turn */
export const SWING_PRE = CALL_LOCAL.swing[0][1] - CALL_LOCAL.swing[0][0] - 8;
/** frames after a turn the travel spring is still evaluated (settled by + 8; the rest is < 0.5 %) */
const SWING_TAIL = 14;
/** the squash and the counter-move of the anticipation */
const SQUASH = 0.05;
const COUNTER = 12;
/** the travel's position overshoot is softened to this share of the spring's; its size overshoot is ≈ 4 % */
const POS_OVER = 0.6;
const SIZE_OVER = 0.04;
/** the travel: SPRING.pop from the turn (0 before; overshoots, → 1) */
export const travel = (t: number, at: number) => (t <= at ? 0 : springAt(t, at, SPRING.pop));
/** SPRING.pop's own overshoot (measured once) */
const POP_OVER = (() => {
  let m = 1;
  for (let f = 0; f <= 20; f += 0.25) m = Math.max(m, springAt(f, 0, SPRING.pop));
  return m - 1;
})();

export type SwingState = {
  /** the line the orb is swinging INTO */
  line: number;
  /** its turn frame */
  at: number;
  /** the travel spring (0 → overshoot → 1) */
  r: number;
  /** 0..1 the anticipation (before `at`) */
  pre: number;
  /** |dr/dt| per frame (0.36 at the fastest frame) */
  speed: number;
};

/** The swing in progress at t (its anticipation or its travel), or null between swings. */
export function swingAt(t: number): SwingState | null {
  for (let k = 1; k < lines.length; k++) {
    const at = lines[k].at;
    if (t >= at - SWING_PRE && t < at + SWING_TAIL) {
      const r = travel(t, at);
      const pre = EASE.inOut(clamp01((t - (at - SWING_PRE)) / SWING_PRE));
      return { line: k, at, r, pre, speed: Math.abs(travel(t + 0.5, at) - travel(t - 0.5, at)) };
    }
  }
  return null;
}

/** 0 = Ava's framing, 1 = the caller's — carried across each swing by its (clamped) travel. */
export function callerK(t: number): number {
  const s = shotAt(t);
  const cur = s.kind === 'C' ? 1 : 0;
  if (s.line < 1 || t >= s.from + SWING_TAIL) return cur;
  const prev = lines[s.line - 1].who === 'caller' ? 1 : 0;
  return lerp(prev, cur, clamp01(travel(t, s.from)));
}

/** A shot's own framing at t (no swing). */
function restFraming(s: Shot, t: number, L: Layout): Framing {
  const F = framings(L);
  if (s.kind === 'E') return lerpF(F.start, F.lock, glideAt(t));
  if (s.kind === 'P') return lerpF(F.lock, F.A, pushAt(t));
  if (s.kind === 'C') return F.C;
  if (s.line === 2) {
    // a variant: 60 px left, drifting right over the shot, lifted so the slot chips below it have air
    // (16:9: a touch smaller, so with the in-shot push, the phrase punch-ins and her talk swell its top
    // stays ≥ 60 px under the frame's edge and its bottom clears the chips)
    const k = tween(t, [s.from, s.to], [0, 1], EASE.inOut);
    return { x: F.A.x - 60 + 44 * k, y: F.A.y - L.pick(20, 70), d: F.A.d * L.pick(0.93, 1) };
  }
  return F.A;
}

/**
 * The orb's framing (on-screen centre + diameter, before the camera's
 * in-shot zoom, the talk swell and the pickup squash), with the swings.
 */
export function framingAt(t: number, L: Layout): Framing {
  const s = shotAt(t);
  let f = restFraming(s, t, L);
  // travelling in from the previous shot (the anticipation releases as it leaves)
  if (s.line >= 1 && t < s.from + SWING_TAIL) {
    const a = restFraming(shotOfLine(s.line - 1), s.from, L);
    const b = f;
    const r = travel(t, s.from);
    const rp = r <= 1 ? r : 1 + (r - 1) * POS_OVER;
    const gain = Math.min(3, Math.max(1, (SIZE_OVER * b.d) / (Math.max(1, Math.abs(b.d - a.d)) * POP_OVER)));
    const rd = r <= 1 ? r : 1 + (r - 1) * gain;
    const rel = Math.max(0, 1 - r);
    const dir = unit(a, b);
    f = {
      x: lerp(a.x, b.x, rp) - dir.x * COUNTER * rel,
      y: lerp(a.y, b.y, rp) - dir.y * COUNTER * rel,
      d: lerp(a.d, b.d, rd) * (1 - SQUASH * rel),
    };
  }
  // anticipating the next swing: squash + a counter-move away from where it is going
  const k = s.line + 1;
  if (s.line >= 0 && k < lines.length && t >= lines[k].at - SWING_PRE) {
    const at = lines[k].at;
    const pre = EASE.inOut(clamp01((t - (at - SWING_PRE)) / SWING_PRE));
    const dir = unit(f, restFraming(shotOfLine(k), at, L));
    f = { x: f.x - dir.x * COUNTER * pre, y: f.y - dir.y * COUNTER * pre, d: f.d * (1 - SQUASH * pre) };
  }
  return f;
}

export type Cam = {
  /** handheld drift + in-shot travel (px, on the focal plane) */
  dx: number;
  dy: number;
  /** per-shot set-up offset: the planes shift by base·(depth − 1) — a new angle per shot */
  base: Pt;
  /** set-up zoom (not applied to the orb, whose framing is explicit) */
  S: number;
  /** in-shot zoom: push × punch-ins × kick */
  z: number;
  /** zoom centre */
  focus: Pt;
};

/** A shot's own camera at t (no swing, no kicks). */
function shotCam(s: Shot, t: number, L: Layout): Cam {
  const F = framings(L);
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
    // alternate the in-shot travel direction shot to shot (it is continuous across a swing)
    const dir = k % 2 === 0 ? 1 : -1;
    dx += dir * L.pick(30, 18) * (2 * prog - 1) * env;
    dy += dir * L.pick(-10, 16) * (2 * prog - 1) * env;
    if (k === 4) {
      // the last shot: a slow pull 1.04 → 1.00, exactly at rest by camSettle[1]
      z = 1 + 0.04 * (1 - tween(t, [s.from, c1], [0, 1], EASE.inOut));
    } else {
      // (the chips shot pushes less in 16:9: its framing is tight under the frame's top)
      z = 1 + (k === 2 ? L.pick(0.018, 0.035) : 0.035) * prog;
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
      focus = { x: L.pick(L.cx, 540), y: L.pick(F.C.y, F.C.y + 200) };
    } else {
      const f = restFraming(s, t, L);
      base = k === 2 ? { x: L.pick(-46, -20), y: L.pick(8, -24) } : { x: 0, y: 0 };
      focus = { x: f.x, y: f.y };
    }
  }
  return { dx, dy, base, S, z, focus };
}

export function camAt(t: number, L: Layout): Cam {
  const s = shotAt(t);
  const c = shotCam(s, t, L);
  // a swing: the set-up (zoom, focus, base) travels from the previous shot's on the orb's spring
  if (s.line >= 1 && t < s.from + SWING_TAIL) {
    const p = shotCam(shotOfLine(s.line - 1), s.from, L);
    const r = travel(t, s.from);
    c.S = lerp(p.S, c.S, r);
    c.z = lerp(p.z, c.z, r);
    c.base = lerpPt(p.base, c.base, r);
    c.focus = lerpPt(p.focus, c.focus, r);
  }
  // the pick lands with a 1 % kick
  if (t >= CALL.slotPick) c.z *= 1 + 0.01 * Math.exp(-(t - CALL.slotPick) / 4);
  // the big hits jolt the camera (1–3 px, ON the hit frame, settled in ≈ 8 f)
  c.dy += kickAt(t);
  return c;
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

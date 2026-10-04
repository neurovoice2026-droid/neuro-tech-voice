/**
 * THE CURSOR'S TIMELINE — pure functions of the timeline time (CLIENT DIRECTION v2 §3). No React.
 *
 * A cursor is an array of KEYS, sorted by `at` (30 fps timeline frames, fractional ok):
 *
 *   { at, x, y }                      be AT (x, y) by `at` (frame px of the hotspot: the arrow's tip, the
 *                                     I-beam's centre). Between two keys at different places the pointer
 *                                     MOVES, arriving at the later key's `at`; it leaves as late as a calm,
 *                                     expert hand would (the move takes its natural time for the distance,
 *                                     6 + 6·log2(1 + d/100) frames: ≈ .4 s for 100 px, ≈ .75 s across a
 *                                     panel) — or as early as the earlier key, if that is later. `dur`
 *                                     on the key overrides the move's length.
 *   { at, x, y, action: 'press' }     the button goes down at `at`. A move INTO a press ends
 *                                     CURSOR.pressLead (6) frames early, so the pointer has arrived and
 *                                     the eye has read the target before it clicks (≥ 4 frames, the brief).
 *   { at, x, y, action: 'release' }   the button comes up (default: CURSOR.pressHold = 3 frames after the press).
 *   { …, action: 'press', up }         a press that names its own release time instead of a release key — so the
 *                                     hand can LEAVE while the button comes up (the next move may start before `up`,
 *                                     as a real hand starts its move during the release).
 *   { at, x, y, action: 'type' }      the owner starts typing: the pointer hides (as macOS hides it on a
 *                                     keypress) and comes back by itself on its next move.
 *   { at, x, y, action: 'hide' | 'show' }   fade out / in where it stands.
 *   kind: 'arrow' | 'text'            sticky: the I-beam over a text field. On a key that ends a move it
 *                                     switches during the last third of the move (as the pointer crosses
 *                                     into the field), else at `at`.
 *   bend                              the arc's bow for the move INTO this key (fraction of the distance,
 *                                     default .08; 0 = straight).
 *
 * MOTION. Every move is a gentle arc (a quadratic bow, always above the chord — a wrist pivoting
 * below the hand — and to the right on a vertical move), travelled at a constant-ish SPEED along its
 * real length with the move ease: a soft start and a long deceleration into the target, never linear,
 * never past it (no overshoot). Moves are validated: a jump with no time to travel throws.
 *
 * THE CLICK. Down: the pointer scales to .9 about its hotspot in 1.5 frames; up: it springs back. A
 * target asks pressAt() for the same curve (→ scale .97 + a pressed shade) and hoverAt() for its hover
 * (a 150 ms transition when the hotspot enters or leaves its rect). clicksOf() lists every down/up for
 * the cue sheet (a two-part click: one sound on each).
 */
import { Easing } from 'remotion';
import { springUnit } from '../../lib/motion.ts';

export type CursorAction = 'press' | 'release' | 'type' | 'hide' | 'show';
export type CursorKind = 'arrow' | 'text';
export type CursorKey = { at: number; x: number; y: number; action?: CursorAction; kind?: CursorKind; bend?: number; dur?: number; up?: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const CURSOR = {
  /** a move into a press ends this many frames before it */
  pressLead: 6,
  /** default press → release (frames) */
  pressHold: 3,
  /** frames to the pressed scale */
  down: 1.5,
  /** the pointer's pressed scale */
  pressScale: 0.9,
  /** a pressed target's scale (the app's active:scale-[.97] idiom) */
  targetScale: 0.97,
  /** fade in / out (frames) */
  showDur: 5,
  hideDur: 6,
  typeHide: 3,
  /** arrow ↔ I-beam crossfade */
  kindDur: 3,
  /** default arc bow (fraction of the move's length) */
  bend: 0.08,
  /** hover transition (Tailwind's 150 ms) */
  hoverDur: 4.5,
} as const;

/** a calm, expert move's length for a distance (frames): Fitts-like, ≈ .4 s per 100 px, ≈ .75 s across a panel */
export const naturalMove = (d: number) => 6 + 6 * Math.log2(1 + d / 100);

/** the move ease: soft start, long deceleration, no overshoot (y stays in [0, 1]) */
export const EASE_MOVE = Easing.bezier(0.32, 0, 0.12, 1);
/** the release: back up with a small lively overshoot */
export const SPRING_RELEASE = { stiffness: 520, damping: 24, mass: 1 };
/** a hover's transition curve (Tailwind's cubic-bezier(.4, 0, .2, 1)) */
export const EASE_HOVER = Easing.bezier(0.4, 0, 0.2, 1);

type Move = { t0: number; t1: number; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; lens: number[] };
type Press = { down: number; up: number; x: number; y: number };
type Vis = { at: number; to: 0 | 1; dur: number };
type KindSwitch = { at: number; kind: CursorKind };
type Compiled = { keys: CursorKey[]; moves: Move[]; presses: Press[]; vis: Vis[]; kinds: KindSwitch[]; kind0: CursorKind };

const N_LEN = 32;
const qb = (a: number, c: number, b: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;

const cache = new WeakMap<readonly CursorKey[], Compiled>();

/** Validate and pre-compute a cursor's timeline (memoised per keys array). */
export function compileCursor(keys: readonly CursorKey[]): Compiled {
  const hit = cache.get(keys);
  if (hit) return hit;
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].at < keys[i - 1].at) throw new Error(`cursor: keys must be sorted by at (key ${i} at ${keys[i].at} < ${keys[i - 1].at})`);
  }
  const moves: Move[] = [];
  const presses: Press[] = [];
  const vis: Vis[] = [];
  const kinds: KindSwitch[] = [];
  let typing = false;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const prev = keys[i - 1];
    let moveT0 = -1;
    let moveT1 = -1;
    if (prev && (prev.x !== k.x || prev.y !== k.y)) {
      const t1 = k.at - (k.action === 'press' ? CURSOR.pressLead : 0);
      const d = Math.hypot(k.x - prev.x, k.y - prev.y);
      const t0 = Math.max(prev.at, t1 - (k.dur ?? naturalMove(d)));
      if (t1 - t0 < 2) throw new Error(`cursor: no time to travel ${d.toFixed(0)} px into key ${i} (at ${k.at}${k.action === 'press' ? `, a press: the move must end ${CURSOR.pressLead} frames before it` : ''})`);
      // the bow: perpendicular to the chord, above it (to the right on a vertical move)
      const dx = (k.x - prev.x) / d;
      const dy = (k.y - prev.y) / d;
      let nx = -dy;
      let ny = dx;
      if (Math.abs(ny) > 0.15 ? ny > 0 : nx < 0) {
        nx = -nx;
        ny = -ny;
      }
      const bow = (k.bend ?? CURSOR.bend) * d;
      const cx = (prev.x + k.x) / 2 + nx * bow;
      const cy = (prev.y + k.y) / 2 + ny * bow;
      const lens = [0];
      let px = prev.x;
      let py = prev.y;
      for (let j = 1; j <= N_LEN; j++) {
        const u = j / N_LEN;
        const x = qb(prev.x, cx, k.x, u);
        const y = qb(prev.y, cy, k.y, u);
        lens.push(lens[j - 1] + Math.hypot(x - px, y - py));
        px = x;
        py = y;
      }
      moves.push({ t0, t1, x0: prev.x, y0: prev.y, x1: k.x, y1: k.y, cx, cy, lens });
      moveT0 = t0;
      moveT1 = t1;
      if (typing) {
        // the pointer comes back on its first move after typing
        vis.push({ at: t0, to: 1, dur: CURSOR.showDur });
        typing = false;
      }
    }
    if (k.kind) kinds.push({ at: moveT1 > moveT0 ? moveT1 - (moveT1 - moveT0) / 3 : k.at, kind: k.kind });
    if (k.action === 'press') {
      const rel = keys.slice(i + 1).find((q) => q.action === 'release' || q.action === 'press');
      const up = k.up ?? (rel && rel.action === 'release' ? rel.at : k.at + CURSOR.pressHold);
      presses.push({ down: k.at, up: Math.max(up, k.at + CURSOR.down), x: k.x, y: k.y });
    }
    if (k.action === 'show') vis.push({ at: k.at, to: 1, dur: CURSOR.showDur });
    if (k.action === 'hide') vis.push({ at: k.at, to: 0, dur: CURSOR.hideDur });
    if (k.action === 'type') {
      vis.push({ at: k.at, to: 0, dur: CURSOR.typeHide });
      typing = true;
    }
  }
  vis.sort((a, b) => a.at - b.at);
  kinds.sort((a, b) => a.at - b.at);
  const c: Compiled = { keys: [...keys], moves, presses, vis, kinds, kind0: keys[0]?.kind ?? 'arrow' };
  cache.set(keys, c);
  return c;
}

/** where along a move (arc-length parameterised, eased) */
function movePoint(m: Move, t: number): [number, number] {
  const p = EASE_MOVE(Math.min(1, Math.max(0, (t - m.t0) / (m.t1 - m.t0))));
  const L = m.lens[N_LEN] * p;
  let j = 1;
  while (j < N_LEN && m.lens[j] < L) j++;
  const seg = m.lens[j] - m.lens[j - 1];
  const u = (j - 1 + (seg > 0 ? (L - m.lens[j - 1]) / seg : 0)) / N_LEN;
  return [qb(m.x0, m.cx, m.x1, u), qb(m.y0, m.cy, m.y1, u)];
}

/** The hotspot at t. */
export function cursorPos(keys: readonly CursorKey[], t: number): { x: number; y: number } {
  const c = compileCursor(keys);
  if (!c.keys.length) return { x: -1e4, y: -1e4 };
  for (const m of c.moves) {
    if (t >= m.t0 && t <= m.t1) {
      const [x, y] = movePoint(m, t);
      return { x, y };
    }
  }
  let last = c.keys[0];
  for (const k of c.keys) if (k.at <= t) last = k;
  return { x: last.x, y: last.y };
}

/** 0 → 1 the button is down (the press curve both the pointer and its target follow). */
function pressAmount(p: Press, t: number): number {
  if (t < p.down) return 0;
  const d = EASE_MOVE(Math.min(1, (t - p.down) / CURSOR.down));
  if (t < p.up) return d;
  const atUp = EASE_MOVE(Math.min(1, (p.up - p.down) / CURSOR.down));
  return atUp * (1 - springUnit(t - p.up, SPRING_RELEASE));
}

/** A value moved by a list of transitions {at, to, dur} (sorted): each starts from wherever the previous one had got to. */
export function fold(events: readonly { at: number; to: number; dur: number }[], v0: number, t: number): number {
  let cur = { at: -Infinity, from: v0, to: v0, dur: 1 };
  const val = (e: typeof cur, tt: number) => e.from + (e.to - e.from) * EASE_HOVER(Math.min(1, Math.max(0, (tt - e.at) / e.dur)));
  for (const e of events) {
    if (e.at > t) break;
    cur = { at: e.at, from: val(cur, e.at), to: e.to, dur: e.dur };
  }
  return val(cur, t);
}

export type CursorState = {
  x: number;
  y: number;
  /** 0..1 */
  opacity: number;
  /** the pointer's scale about its hotspot (1 at rest, .9 pressed, a whisper over 1 on the release spring) */
  scale: number;
  /** 0 arrow … 1 I-beam */
  text: number;
  /** the button is down */
  down: boolean;
};

/** Everything the <Cursor> draws at t. */
export function cursorAt(keys: readonly CursorKey[], t: number): CursorState {
  const c = compileCursor(keys);
  const { x, y } = cursorPos(keys, t);
  // visibility: visible from the first key unless it starts with 'show' (fades in) or 'hide'
  const o0 = c.keys[0]?.action === 'show' || c.keys[0]?.action === 'hide' ? 0 : 1;
  const o = fold(c.vis.map((v) => ({ at: v.at, to: v.to, dur: v.dur })), o0, t);
  let amt = 0;
  let down = false;
  for (const p of c.presses) {
    if (t >= p.down) {
      amt = pressAmount(p, t);
      down = t < p.up;
    }
  }
  const text = fold(
    c.kinds.map((k) => ({ at: k.at, to: k.kind === 'text' ? 1 : 0, dur: CURSOR.kindDur })),
    c.kind0 === 'text' ? 1 : 0,
    t,
  );
  return { x, y, opacity: Math.max(0, Math.min(1, o)), scale: 1 - (1 - CURSOR.pressScale) * amt, text, down };
}

const inside = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * A target's hover at t, 0..1: a CSS-like transition (`dur` frames, Tailwind's curve) that starts when
 * the hotspot crosses into / out of `rect`. Scans back from t for the last crossing (¼-frame steps).
 */
export function hoverAt(keys: readonly CursorKey[], t: number, rect: Rect, dur: number = CURSOR.hoverDur): number {
  if (!keys.length) return 0;
  const isIn = (tt: number) => {
    const p = cursorPos(keys, tt);
    return inside(rect, p.x, p.y);
  };
  const now = isIn(t);
  const step = 0.25;
  for (let back = step; back <= dur + step; back += step) {
    if (isIn(t - back) !== now) {
      const tc = t - back + step / 2;
      const u = EASE_HOVER(Math.min(1, (t - tc) / dur));
      return now ? u : 1 - u;
    }
  }
  return now ? 1 : 0;
}

/** A target's press at t, 0..1 (the same curve as the pointer): the last press whose hotspot was in `rect`. */
export function pressAt(keys: readonly CursorKey[], t: number, rect: Rect): number {
  const c = compileCursor(keys);
  let v = 0;
  for (const p of c.presses) if (t >= p.down && inside(rect, p.x, p.y)) v = pressAmount(p, t);
  return v;
}

/** Was `rect` clicked (released) at or before t? → the release time of its last click, else null. */
export function clickedAt(keys: readonly CursorKey[], t: number, rect: Rect): number | null {
  const c = compileCursor(keys);
  let at: number | null = null;
  for (const p of c.presses) if (p.up <= t && inside(rect, p.x, p.y)) at = p.up;
  return at;
}

/** Every click as {down, up, x, y} — for the cue sheet (a two-part click: a sound on each). */
export function clicksOf(keys: readonly CursorKey[]): { down: number; up: number; x: number; y: number }[] {
  return compileCursor(keys).presses.map((p) => ({ ...p }));
}

/* ── builders: keys for the common gestures ─────────────────────────── */

/**
 * A click on (x, y) at `at`: arrive (the move ends pressLead frames before), press, release `hold`
 * frames later. Pass `dwell` to arrive earlier still (a longer read of the target).
 */
export function click(at: number, x: number, y: number, o: { hold?: number; dwell?: number; kind?: CursorKind; bend?: number } = {}): CursorKey[] {
  const keys: CursorKey[] = [];
  if (o.dwell && o.dwell > CURSOR.pressLead) keys.push({ at: at - o.dwell, x, y, kind: o.kind, bend: o.bend });
  keys.push({ at, x, y, action: 'press', kind: keys.length ? undefined : o.kind, bend: keys.length ? undefined : o.bend });
  keys.push({ at: at + (o.hold ?? CURSOR.pressHold), x, y, action: 'release' });
  return keys;
}

/** Centre of a rect (optionally offset by fractions of its size). */
export const centre = (r: Rect, fx = 0.5, fy = 0.5) => ({ x: r.x + r.w * fx, y: r.y + r.h * fy });

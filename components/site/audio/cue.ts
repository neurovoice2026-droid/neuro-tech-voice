import type { Cue, CueSfx, CueTurn } from "@/lib/audio/cue-types";

/* ------------------------------------------------------------------ *
 * Reading a cue: pure helpers, no DOM, no React, no dependencies.
 *
 * Every time here is on the cue clock (seconds), the clock the cue file
 * is written in: cueTime = audio.currentTime - cue.offset. While sound is
 * on, a stage asks its track for that time and reads the cue with these;
 * with sound off it never calls them, and keeps its read pacing.
 * ------------------------------------------------------------------ */

/** The envelope's frame rate (CUE_SCHEMA: 25 frames per second). */
export const ENV_FPS = 25;

/** The cue clock from the element's clock. */
export const cueTime = (cue: Pick<Cue, "offset">, currentTime: number) => currentTime - cue.offset;
/** The element's clock from the cue clock. */
export const mediaTime = (cue: Pick<Cue, "offset">, t: number) => t + cue.offset;

export type SpokenTurn = {
  /** The line's index in the surface's own script (CueTurn.i). */
  i: number;
  sp: CueTurn["sp"];
  /** Where the clip begins and ends, on the cue clock. */
  start: number;
  end: number;
  /**
   * How long the line is the newest one: until the next turn starts. The
   * last turn holds for its own length (end − start). A step clock's dwell.
   */
  hold: number;
  /**
   * The silence after the turn: the next turn's start minus this one's
   * end, or the track's end minus this one's for the last. Negative where
   * the next line interrupts this one.
   */
  gap: number;
  /** Each display word's start, from the turn's start: a function-based stagger. */
  wordAt: number[];
  /** Each display word's end, from the turn's start. */
  wordEnd: number[];
};

export type SpokenSchedule = {
  /** The track's length on the cue clock: where a run built on it ends. */
  dur: number;
  /** Before the first turn: the ring and the pickup on a phone track. The whole track when nobody speaks. */
  lead: number;
  turns: SpokenTurn[];
  /** The ring and pickup, as the cue has them. */
  sfx: CueSfx[];
};

/**
 * The run a timeline is built from while sound is on: where each turn
 * starts and ends, how long it holds, the gap after it, and each word's
 * offset into it. GSAP timelines place a line at `start` and stagger its
 * words by `wordAt`; step clocks dwell for `hold`.
 */
export function spokenSchedule(cue: Cue): SpokenSchedule {
  const turns = cue.turns.map((turn, k): SpokenTurn => {
    const next = cue.turns[k + 1];
    return {
      i: turn.i,
      sp: turn.sp,
      start: turn.start,
      end: turn.end,
      hold: next ? next.start - turn.start : turn.end - turn.start,
      gap: next ? next.start - turn.end : cue.dur - turn.end,
      wordAt: turn.words.map((w) => w[1] - turn.start),
      wordEnd: turn.words.map((w) => w[2] - turn.start),
    };
  });
  return { dur: cue.dur, lead: turns.length ? turns[0].start : cue.dur, turns, sfx: cue.sfx };
}

/**
 * The turn on screen at cue time t: the last one to have started (it
 * stays through the gap after it). Undefined before the first.
 */
export function turnAt(cue: Cue, t: number): CueTurn | undefined {
  let found: CueTurn | undefined;
  for (const turn of cue.turns) {
    if (turn.start > t) break;
    found = turn;
  }
  return found;
}

/**
 * How many display words of a turn show at cue time t: a word shows from
 * its start. Given a cue, the words of the turn on screen (`turnAt`).
 */
export function wordsShownAt(of: CueTurn | Cue, t: number): number {
  const turn = "turns" in of ? turnAt(of, t) : of;
  if (!turn) return 0;
  let n = 0;
  while (n < turn.words.length && turn.words[n][1] <= t) n++;
  return n;
}

const envelopes = new WeakMap<Cue, Uint8Array>();

/** The envelope's bytes, decoded from base64 once per cue and kept. */
export function envBytes(cue: Cue): Uint8Array {
  let bytes = envelopes.get(cue);
  if (!bytes) {
    const s = atob(cue.env);
    bytes = new Uint8Array(s.length);
    for (let k = 0; k < s.length; k++) bytes[k] = s.charCodeAt(k);
    envelopes.set(cue, bytes);
  }
  return bytes;
}

/**
 * Loudness at cue time t, 0..1 (byte / 255: 0 is -60 dBFS or quieter, 1
 * is 0 dBFS; speech sits around 0.6 to 0.8). Interpolated between frame
 * centres; 0 before the track and after its last frame. Orbs, spheres
 * and meters read this while sound is on: no analyser, no CORS.
 */
export function envelopeAt(cue: Cue, t: number): number {
  const env = envBytes(cue);
  if (!env.length || !(t >= 0) || t >= env.length / ENV_FPS) return 0;
  const x = t * ENV_FPS - 0.5;
  const i = Math.max(0, Math.min(env.length - 1, Math.floor(x)));
  const j = Math.min(env.length - 1, i + 1);
  const f = Math.min(1, Math.max(0, x - i));
  return (env[i] * (1 - f) + env[j] * f) / 255;
}

type Knot = readonly [from: number, to: number];

/** An authored clock mapped onto the spoken one, and back. */
export type AxisMap = {
  /** Authored seconds to spoken (cue) seconds. */
  (authored: number): number;
  /** Spoken (cue) seconds to authored seconds. */
  invert: (spoken: number) => number;
  /** The [authored, spoken] pairs it interpolates between, both strictly increasing. */
  knots: readonly Knot[];
};

/** Piecewise-linear through the knots; a slope of 1 past either end. */
function through(knots: readonly Knot[], x: number): number {
  if (!knots.length) return x;
  const first = knots[0];
  if (x <= first[0]) return first[1] + (x - first[0]);
  for (let k = 1; k < knots.length; k++) {
    const [x1, y1] = knots[k];
    if (x <= x1) {
      const [x0, y0] = knots[k - 1];
      return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  const last = knots[knots.length - 1];
  return last[1] + (x - last[0]);
}

/**
 * For a rail authored on a fixed clock (the industry call's `turns[].at`,
 * `toolRuns[].at`, `rig.fields[].at`, `duration`): the map from that clock
 * onto the spoken one. `authoredAt[k]` is when script line k starts on the
 * authored clock; it is pinned to the start of the cue turn whose `i` is
 * k, and `authoredDur` (when given) to the track's end. Anything between
 * two pins moves in proportion, so a tool run authored halfway through a
 * line lands halfway through it as spoken. Lines with no turn in the cue
 * are skipped, and so is any pin that would run backwards. When the first
 * line starts after 0 on both clocks, 0 is pinned to 0.
 */
export function remapAuthoredAxis(authoredAt: readonly number[], cue: Cue, authoredDur?: number): AxisMap {
  const byLine = new Map<number, number>();
  for (const turn of cue.turns) if (!byLine.has(turn.i)) byLine.set(turn.i, turn.start);

  const pins: Knot[] = [];
  authoredAt.forEach((a, k) => {
    const s = byLine.get(k);
    if (s !== undefined && Number.isFinite(a)) pins.push([a, s]);
  });
  if (authoredDur !== undefined) pins.push([authoredDur, cue.dur]);
  pins.sort((p, q) => p[0] - q[0]);

  const knots: Knot[] = [];
  if (pins.length && pins[0][0] > 0 && pins[0][1] > 0) knots.push([0, 0]);
  for (const pin of pins) {
    const last = knots[knots.length - 1];
    if (!last || (pin[0] > last[0] && pin[1] > last[1])) knots.push(pin);
  }

  const inverse = knots.map(([a, s]): Knot => [s, a]);
  return Object.assign((authored: number) => through(knots, authored), {
    invert: (spoken: number) => through(inverse, spoken),
    knots,
  });
}

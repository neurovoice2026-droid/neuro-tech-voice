import type { Cue, CueTurn } from "@/lib/audio/cue-types";
import { ROOM, type KbQuestion, type TwoCallsTurn } from "./knowledge-base";

/* ------------------------------------------------------------------ *
 * The knowledge base page with sound on: reading its cues (AI-generated
 * voices, lib/audio/cues/kb-*.json) against the words the page shows
 * (knowledge-base.ts). A track that is missing, or was cut for other
 * words, comes back null, and that stage (or that one line) stays silent
 * and read-paced, as with sound off.
 * ------------------------------------------------------------------ */

/** A line's display words: split as the stages split it, and as its cue counts it. */
export const wordsOf = (text: string) => text.split(" ");

/** How many of a turn's display words have been said at cue time `t`. */
export function wordsSaid(turn: CueTurn, t: number) {
  let n = 0;
  while (n < turn.words.length && turn.words[n][1] <= t) n++;
  return n;
}

/**
 * The cue's one turn, when it says `text` as the page shows it: a single
 * turn, by `sp`, one cue word per display word. Null otherwise.
 */
export function sayingOf(cue: Cue | null | undefined, text: string, sp: CueTurn["sp"]): CueTurn | null {
  const turn = cue && cue.turns.length === 1 ? cue.turns[0] : null;
  return turn && turn.sp === sp && turn.words.length === wordsOf(text).length ? turn : null;
}

/**
 * A clip's clock carried past the end of its file: the cue time while it
 * plays, then its length plus the wall time since it ended (`endedAt`,
 * performance.now() ms), so a hold that outlasts the clip still runs out.
 */
export const pastEnd = (time: number, cue: Pick<Cue, "dur">, endedAt: number | null, now: number) =>
  endedAt === null ? time : cue.dur + Math.max(0, now - endedAt) / 1000;

/** The reading room: the caller's clip at "asked", the agent's at "answering"; the search between is silent. */
export type RoomVoice = { ask: Cue; answer: Cue };

export const ROOM_VOICE = {
  /** Track ids in lib/audio/cues/kb-hero-reading-room.json. */
  ask: (id: string) => `kb-hero/${id}/0`,
  answer: (id: string) => `kb-hero/${id}/1`,
  /** Seconds each line holds past its last word: the question settles, the answer lands. */
  askTail: 0.3,
  answerTail: 0.6,
} as const;

/** A question's two clips, when both say its lines as shown. */
export function roomVoice(q: Pick<KbQuestion, "ask" | "answer">, ask?: Cue, answer?: Cue): RoomVoice | null {
  return ask && answer && sayingOf(ask, q.ask, "caller") && sayingOf(answer, q.answer, "agent") ? { ask, answer } : null;
}

/**
 * The two calls, spoken. They cannot be heard at once, so the one track
 * (lib/audio/cues/kb-two-calls.json, "kb-two-calls/both") says them in
 * turn: the question both callers ask, once; then each line of the first
 * call followed by the same line of the second ("Instructions only", then
 * "With your documents", the order the page shows them).
 */
export const TWO_CALLS_TRACK = "kb-two-calls/both";

export type TwoCallsVoice = {
  cue: Cue;
  /** The cue's turns in order: whose call says each (null: both, the line they share), and which of its lines. */
  turns: { panel: number | null; line: number; turn: CueTurn }[];
};

const ROLE = { client: "caller", agent: "agent" } as const;

export function twoCallsVoice(
  cue: Cue | null | undefined,
  calls: readonly { turns: readonly TwoCallsTurn[] }[],
): TwoCallsVoice | null {
  if (!cue || !calls.length) return null;
  const said = new Map<number, number>();
  const turns: TwoCallsVoice["turns"] = [];
  for (const turn of cue.turns) {
    const lines = calls.map((c) => c.turns[turn.i]);
    if (lines.some((l) => !l)) return null;
    const k = said.get(turn.i) ?? 0;
    said.set(turn.i, k + 1);
    const once = cue.turns.filter((x) => x.i === turn.i).length === 1;
    const same = lines.every((l) => l.t === lines[0].t && l.sp === lines[0].sp);
    const panel = once && same ? null : k;
    const line = panel === null ? lines[0] : lines[panel];
    if (!line || ROLE[line.sp] !== turn.sp || turn.words.length !== wordsOf(line.t).length) return null;
    turns.push({ panel, line: turn.i, turn });
  }
  // Every line of every call is said exactly once, in its call's order.
  for (let p = 0; p < calls.length; p++) {
    const order = turns.filter((x) => x.panel === null || x.panel === p).map((x) => x.line);
    if (order.length !== calls[p].turns.length || order.some((l, j) => l !== j)) return null;
  }
  return { cue, turns };
}

/**
 * Where the two calls are at cue time `t`: how many lines each shows, the
 * turn being said (-1 before the first; it stays through the pause after
 * it), and how many of its words have been said.
 */
export function twoCallsAt(v: TwoCallsVoice, panels: number, t: number) {
  const shown = Array.from({ length: panels }, () => 0);
  let current = -1;
  v.turns.forEach((x, k) => {
    if (x.turn.start > t) return;
    current = k;
    for (let p = 0; p < panels; p++) if (x.panel === null || x.panel === p) shown[p] = Math.max(shown[p], x.line + 1);
  });
  return { shown, current, said: current < 0 ? 0 : wordsSaid(v.turns[current].turn, t) };
}

/** The map of meaning: track ids in lib/audio/cues/kb-meaning-phrasings.json (P2). */
export const MEANING_TRACK = (set: string, k: number) => `kb-meaning-phrasings/${set}/${k}`;

/** The shelf: track ids in lib/audio/cues/kb-shelf-asks.json (P2), in SHELF.kinds order. */
export const SHELF_TRACK = (k: number) => `kb-shelf-asks/shelf-asks/${k}`;

/** A spoken round of the shelf lasts as long as a read one, or until just after its question has been said. */
export const shelfDwell = (read: number, turn: CueTurn) => Math.max(read, turn.end + 0.6);

/**
 * Where the documents stop: the caller's question and the fallback line.
 * Its own cue file (P3, lib/audio/cues/kb-limits-fallback.json) reuses the
 * reading room's clips for the same question; until it exists, the
 * reading room's tracks are used, which are the same files.
 */
export const LIMITS_TRACKS = [
  { surface: "kb-limits-fallback", ask: "kb-limits-fallback/limits/0", answer: "kb-limits-fallback/limits/1" },
  { surface: "kb-hero-reading-room", ask: ROOM_VOICE.ask("home"), answer: ROOM_VOICE.answer("home") },
] as const;

/** The fallback line the limits figure answers with: the reading room's, said word for word. */
export const LIMITS_FALLBACK = ROOM.questions.find((q) => q.doc === null)!;

/** A clip a looping figure waits on: it starts at `at` on the figure's timeline, which then follows its clock, never past `hold`. */
export type PassBeat = { at: number; cue: Cue; hold?: number };

/** The most wall time one frame may move a pass between clips: a hidden tab or a long frame counts as this. */
const MAX_STEP = 0.1;

/**
 * One spoken pass of a looping line figure (the map of meaning, where
 * the documents stop), on the figure's own timeline, frame by frame.
 *
 * Between clips the timeline runs on the wall clock. At each beat it
 * starts that beat's clip (`start`) and from then on follows the clip's
 * clock: it waits at `at` until the audio moves, keeps pace with it, and
 * waits at `hold` (or the next beat) until the clip has ended. The pass is
 * over at `end`; the figure then loops on by itself, silently.
 */
export class SpokenPass {
  private k = 0;
  private inClip = false;
  private t: number;
  private last: number | null = null;

  constructor(
    readonly beats: readonly PassBeat[],
    readonly end: number,
    from = 0,
  ) {
    this.t = from;
  }

  /**
   * `now` is performance.now() (ms); `clip` the playing clip's cue time
   * and whether it has ended. Returns the timeline's time, the index of a
   * beat whose clip must start now, and whether the pass is over.
   */
  tick(now: number, clip: { time: number; ended: boolean }): { t: number; start: number | null; done: boolean } {
    const dt = this.last === null ? 0 : Math.min(MAX_STEP, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    let start: number | null = null;
    if (this.inClip) {
      const b = this.beats[this.k];
      const cap = Math.min(b.hold ?? Infinity, this.beats[this.k + 1]?.at ?? Infinity, this.end);
      this.t = Math.max(this.t, Math.min(b.at + Math.max(0, clip.time), cap));
      if (clip.ended || clip.time >= b.cue.dur) {
        this.inClip = false;
        this.k++;
      }
    } else {
      this.t = Math.min(this.end, this.t + dt);
      const b = this.beats[this.k];
      if (b && this.t >= b.at) {
        this.t = b.at;
        this.inClip = true;
        start = this.k;
      }
    }
    const done = !this.inClip && this.k >= this.beats.length && this.t >= this.end;
    return { t: this.t, start, done };
  }
}

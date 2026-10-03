import type { Cue, CueWord } from "@/lib/audio/cue-types";
import type { HomeMomentId } from "@/lib/pages/home/call";
import { spokenSchedule } from "@/components/site/audio/cue";

/* ------------------------------------------------------------------ *
 * #demo's schedule: when every beat of every call happens, as numbers.
 *
 * Pure — no DOM, no GSAP — so the tour's length, where it ends and what
 * the stage shows at any second are unit-tested (home.test.ts). The
 * timeline (demo-timeline.ts) places its tweens at these times, and the
 * section derives all of its React state from `frameAt(script, time)`
 * on every update rather than from callbacks dropped into the timeline:
 * whatever the timeline's time, the state is the one that time implies,
 * so a pause, a kill mid-call or a replay can never leave the two apart.
 *
 * With sound off a call is read-paced (holdFor). With sound on it is
 * built on its recording instead: each line comes up where its turn
 * starts in the call's cue, the rings and the pickup sit where the cue
 * has them, and the call ends where the track does (`scriptFor`'s
 * `spoken`). Every figure is read off the cue at run time. A call with
 * no cue, or a cue that does not speak its shown lines, stays read-paced.
 *
 * `SpokenClock` is the run's clock while sound is on: the audio's own
 * clock while a clip is heard, the wall clock between clips and whenever
 * the clip is not heard (sound turned off, another stage's press, a file
 * that will not play), so the run keeps the same schedule either way.
 * #knowledge runs its question-and-answer clips on it too.
 * ------------------------------------------------------------------ */

/** Just the parts of a call the schedule needs. */
export type ScheduledCall = {
  id: HomeMomentId;
  lines: readonly { sp: "agent" | "caller"; t: string }[];
};

/** The order the untouched stage tours the moments in: busy, just gone, day off, asleep. It ends on the poster. */
export const TOUR: readonly HomeMomentId[] = ["rush", "closing", "sunday", "night"];

/** The moment the server draws, and so the one the tour must end on. */
export const POSTER: HomeMomentId = "night";

/** Every offset in seconds from the start of a call. */
export const BEAT = {
  /** The last call's frame clears. */
  clear: 0.3,
  /** The clock's four figures start to spin, one after another. */
  spinAt: 0.1,
  spin: 0.9,
  spinStagger: 0.05,
  /** The room takes the new hour's light, mid-spin. */
  switchAt: 0.6,
  /** Two rings. */
  ringA: 1.2,
  ringB: 1.5,
  /** The orb draws in before it answers. */
  inhale: 1.74,
  pickup: 1.9,
  /** The greeting. */
  line1: 2.0,
  /** From the last word said to the call's finished frame. */
  settle: 0.75,
  /** The finished frame is read before the tour dials the next moment. */
  read: 2.0,
} as const;

/** The orb's voice when nobody is speaking. */
export const IDLE = 0.12;

export type LinePlan = {
  sp: "agent" | "caller";
  /** When the line comes up. */
  at: number;
  /** How long it has the stage before the next line. */
  hold: number;
  /** Seconds per word, for the orb's envelope. */
  spacing: number;
  words: number;
  /** Each word's length, for the envelope's peaks. */
  lengths: number[];
  /** Spoken: when the line's recording ends (the orb follows the cue's envelope until then). */
  said?: number;
};

/** The ring, the orb's inhale and the pickup, in seconds from the start of a call. */
export type Beats = { ringA: number; ringB: number; inhale: number; pickup: number };

const READ_BEATS: Beats = { ringA: BEAT.ringA, ringB: BEAT.ringB, inhale: BEAT.inhale, pickup: BEAT.pickup };

export type Seg = {
  id: HomeMomentId;
  /** The moment on screen before this call's switch. */
  from: HomeMomentId;
  T: number;
  switchAt: number;
  beats: Beats;
  lines: LinePlan[];
  /** The last word has been said: the outcome lands. */
  end: number;
  /** The call's finished frame, identical to what React draws at rest for it. */
  settled: number;
  /** Spoken: the recording this call plays, from `T` (cue time 0) to `end`. */
  cue?: Cue;
};

export type Script = { kind: "tour" | "single"; segs: Seg[]; total: number };

export type RunRequest = {
  kind: "tour" | "single";
  ids: readonly HomeMomentId[];
  from: HomeMomentId;
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number) => Math.round(x * 1000) / 1000;

/**
 * How long a line holds: the greeting longest on the first call and
 * briefest once it has been read, then by its word count. A call's last
 * line stays on screen after the call, so only the lines that are
 * replaced get the longer cap: a long offer must be readable before the
 * reply takes its place (on a phone the line before is not shown).
 */
function holdFor(words: number, greeting: boolean, first: boolean, last: boolean) {
  if (greeting) return first ? 2.4 : 1.3;
  return clamp(0.6 + 0.16 * words, 1.3, last ? 2.8 : 4.2);
}

/** The calls' cues by moment, for a run built while sound is on. */
export type SpokenCalls = Partial<Record<HomeMomentId, Cue>>;

/**
 * Whether `cue` speaks `call` as the stage shows it: one turn per shown
 * line, in order, by the same speaker, with the line's own display words
 * (`text.split(" ")`, CUE_SCHEMA). Anything else (a track still being
 * produced, a line rewritten since) leaves the call read-paced.
 */
export function speaks(call: ScheduledCall, cue: Cue | undefined): cue is Cue {
  return (
    !!cue &&
    cue.dur > 0 &&
    cue.turns.length === call.lines.length &&
    cue.turns.every(
      (turn, k) => turn.i === k && turn.sp === call.lines[k].sp && turn.words.length === call.lines[k].t.split(" ").length,
    )
  );
}

/** Where a spoken call rings and picks up: the cue's own sfx, else the read beats' spacing before its first line. */
function spokenBeats(cue: Cue): Beats {
  const ring = cue.sfx.find((s) => s.kind === "ring");
  const pick = cue.sfx.find((s) => s.kind === "pickup");
  const first = cue.turns[0]?.start ?? BEAT.line1;
  const pickup = pick?.start ?? ring?.end ?? Math.max(0, first - (BEAT.line1 - BEAT.pickup));
  const ringA = Math.min(ring?.start ?? pickup - (BEAT.pickup - BEAT.ringA), pickup);
  return {
    ringA: round(Math.max(0, ringA)),
    ringB: round(Math.max(0, Math.min(ringA + (BEAT.ringB - BEAT.ringA), pickup))),
    inhale: round(Math.max(0, pickup - (BEAT.pickup - BEAT.inhale))),
    pickup: round(pickup),
  };
}

/**
 * The run for `req`: the tour or one call. With `spoken` (sound is on),
 * every call that has a cue that speaks it is timed by that cue (lines at
 * its turn starts, the ring and pickup at its sfx, the end where the
 * track ends); the read beats between calls (settle, read) are kept.
 */
export function scriptFor(calls: readonly ScheduledCall[], req: RunRequest, spoken?: SpokenCalls): Script {
  const byId = new Map(calls.map((c) => [c.id, c]));
  const segs: Seg[] = [];
  let T = 0;
  let from = req.from;

  req.ids.forEach((id, n) => {
    const call = byId.get(id);
    if (!call) throw new Error(`demo-script: no call "${id}"`);
    const cue = spoken?.[id];
    const voiced = speaks(call, cue) ? cue : undefined;
    const turns = voiced ? spokenSchedule(voiced).turns : null;
    let at = T + BEAT.line1;
    const lines: LinePlan[] = call.lines.map((line, i) => {
      // Spoken words only: a dash between two words is not a word said.
      const said = line.t
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length)
        .filter((n) => n > 0);
      const lengths = said.length ? said : [1];
      const words = lengths.length;
      const turn = turns?.[i];
      const hold = turn ? round(turn.hold) : holdFor(words, i === 0, n === 0, i === call.lines.length - 1);
      const plan: LinePlan = {
        sp: line.sp,
        at: round(turn ? T + turn.start : at),
        hold,
        spacing: clamp((hold - 0.4) / words, 0.1, 0.19),
        words,
        lengths,
      };
      if (turn) plan.said = round(T + turn.end);
      at += hold;
      return plan;
    });
    const last = lines[lines.length - 1];
    const end = voiced ? round(T + voiced.dur) : round(last.at + last.words * last.spacing + 0.25);
    const settled = round(end + BEAT.settle);
    const seg: Seg = {
      id,
      from,
      T: round(T),
      switchAt: round(T + BEAT.switchAt),
      beats: voiced ? spokenBeats(voiced) : READ_BEATS,
      lines,
      end,
      settled,
    };
    if (voiced) seg.cue = voiced;
    segs.push(seg);
    from = id;
    T = settled + BEAT.read;
  });

  return {
    kind: req.kind,
    segs,
    total: segs.length ? segs[segs.length - 1].settled : 0,
  };
}

export type Frame = {
  /** The moment being dialled: the lit key and the lit phrase of the sub. */
  target: HomeMomentId;
  /** The moment the room is lit for. */
  moment: HomeMomentId;
  /** The index of the line on the stage, -1 before the greeting. */
  line: number;
  /** The caller has the floor. */
  listening: boolean;
  /** The current call's last word has been said. */
  ended: boolean;
  /** The whole run is over. */
  done: boolean;
};

/** What the stage shows `t` seconds into a run. */
export function frameAt(s: Script, t: number): Frame {
  let seg = s.segs[0];
  for (const x of s.segs) if (t >= x.T) seg = x;
  if (!seg)
    return {
      target: POSTER,
      moment: POSTER,
      line: -1,
      listening: false,
      ended: true,
      done: true,
    };
  let line = -1;
  seg.lines.forEach((l, i) => {
    if (t >= l.at) line = i;
  });
  const ended = t >= seg.end;
  return {
    target: seg.id,
    moment: t >= seg.switchAt ? seg.id : seg.from,
    line,
    listening: line >= 0 && !ended && seg.lines[line].sp === "caller",
    ended,
    done: t >= s.total,
  };
}

/* ─── The spoken run's clock ──────────────────────────────────────── */

/** A clip a spoken run plays: a cue, started at `at` on the run's clock. `tag` is the stage's own note on it. */
export type RunClip = { at: number; cue: Cue; tag?: string };

/** What a spoken run needs of its stage's voice: useVoiceTrack's play, pause and time, and the engine's isAudible. */
export type RunVoice = {
  play: (cue: Cue, at: number, o: { press: boolean; next?: string }) => boolean;
  pause: () => void;
  /** The clip's own clock, in cue seconds. */
  time: () => number;
  /** The stage holds the site's one sound, and what it plays is heard. */
  audible: () => boolean;
  /** An autoplay just on screen waits a moment before it claims the sound (use-voice-track.ts DWELL_MS): its clock holds. */
  waiting?: () => boolean;
};

/** Within this of a clip's end its audio has ended: the element stops a hair short of the cue's length. */
const END_EPS = 0.03;
/** The longest step the clock takes in one frame, so a stalled frame never throws the run forward. */
const MAX_STEP = 0.1;

/**
 * The clock of a run built on recordings. Each frame, `tick(now)` moves
 * it on and returns the run's time, which the stage hands its timeline.
 *
 * A clip starts when the clock reaches it. While its audio is heard the
 * clock IS the audio's clock (`at + voice.time()`), so the words follow
 * the voice, a stall holds the picture, and the clip's end is where the
 * audio ended. Between clips, and whenever a clip is not heard (refused,
 * lost to another stage's press, sound turned off, a file that will not
 * play), the clock runs on the wall clock: the same schedule, silently.
 *
 * `stop` pauses the clip it is in; `start` resumes it from the same
 * second. A run started by the reader's own control plays every clip as
 * a press (`press`); an autoplaying one only its first, if the reader's
 * sound press started it (`pressFirst`).
 */
export class SpokenClock {
  /** The run's time, in seconds. */
  t: number;
  private running = false;
  private last = 0;
  /** The clip whose span the clock is in, once it has been started there; -1 between clips. */
  private cur = -1;
  /** That clip's audio was started, is heard, and has not ended. */
  private heard = false;
  private pressNext: boolean;

  constructor(
    readonly clips: readonly RunClip[],
    /** Where the run ends, in its own seconds. */
    readonly total: number,
    private readonly voice: RunVoice,
    private readonly o: { press: boolean; pressFirst?: boolean; from?: number },
  ) {
    this.t = o.from ?? 0;
    this.pressNext = o.pressFirst ?? o.press;
  }

  /** The clock is running (started, not stopped, not at its end). */
  get playing() {
    return this.running;
  }

  /** The run has reached its end. */
  get done() {
    return this.t >= this.total;
  }

  /** The clip under run time `t`, and how far into it (cue seconds); null between clips. */
  clipAt(t = this.t): { k: number; clip: RunClip; at: number } | null {
    for (let k = 0; k < this.clips.length; k++) {
      const clip = this.clips[k];
      if (t >= clip.at && t < clip.at + clip.cue.dur) return { k, clip, at: t - clip.at };
    }
    return null;
  }

  /**
   * Runs the clock from wall time `now` (ms), resuming the clip it stopped
   * in. `press`: the reader's own control asked. Already running, a press
   * hears the clip it is in again if it is running unheard (sound went
   * off and on again, or another stage's press took it), from where it is.
   */
  start(now: number, press?: boolean) {
    if (this.done) return;
    if (this.running) {
      if (!press || (this.heard && this.voice.audible())) return;
      this.pressNext = true;
      const c = this.clipAt();
      if (c) this.enter(c.k, c.at);
      return;
    }
    this.running = true;
    this.last = now;
    if (press !== undefined) this.pressNext = press;
    const c = this.clipAt();
    if (c) this.enter(c.k, c.at);
  }

  /** Holds the clock where it is, pausing the clip it is in. */
  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.heard) this.voice.pause();
    this.heard = false;
  }

  /** Moves the clock on to wall time `now` (ms) and returns the run's time. */
  tick(now: number): number {
    const dt = Math.min(MAX_STEP, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.running) return this.t;
    const clip = this.cur >= 0 ? this.clips[this.cur] : null;
    if (clip && this.heard && (this.voice.audible() || !!this.voice.waiting?.())) {
      const a = this.voice.time();
      if (Number.isFinite(a) && a < clip.cue.dur - END_EPS) {
        this.t = clip.at + Math.max(0, a);
      } else {
        // Its audio has ended: the clock carries on from the clip's end.
        this.heard = false;
        this.t = Math.max(this.t, clip.at + clip.cue.dur);
      }
    } else {
      this.heard = false;
      this.t += dt;
    }
    const c = this.clipAt();
    if (!c) this.cur = -1;
    else if (c.k !== this.cur) this.enter(c.k, c.at);
    if (this.t >= this.total) {
      this.t = this.total;
      this.running = false;
    }
    return this.t;
  }

  private enter(k: number, at: number) {
    this.cur = k;
    const next = this.clips[k + 1]?.cue.src;
    this.heard = this.voice.play(this.clips[k].cue, at, { press: this.pressNext, next });
    this.pressNext = this.o.press;
  }
}

/**
 * When each character of a spoken line is said, for a stage that reveals
 * a line in pieces of its own (#how's greeting: words, the business's
 * name, or single characters in a script written without spaces). A
 * character inside display word k (CUE_SCHEMA: `text.split(" ")`) is said
 * at that word's start, or part-way to its end in proportion for one
 * further into it. Seconds on the cue clock.
 */
export function saidAtChar(text: string, words: readonly CueWord[]): (offset: number) => number {
  const starts: number[] = [];
  let c = 0;
  for (const w of text.split(" ")) {
    starts.push(c);
    c += w.length + 1;
  }
  return (offset) => {
    let k = 0;
    while (k + 1 < starts.length && starts[k + 1] <= offset) k++;
    const w = words[Math.min(k, words.length - 1)];
    if (!w) return 0;
    const end = (k + 1 < starts.length ? starts[k + 1] - 1 : text.length) - starts[k];
    const f = end > 0 ? Math.min(1, Math.max(0, (offset - starts[k]) / end)) : 0;
    return w[1] + (w[2] - w[1]) * f;
  };
}

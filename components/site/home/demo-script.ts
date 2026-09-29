import type { HomeMomentId } from "@/lib/pages/home/call";

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
  read: 0.6,
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
};

export type Seg = {
  id: HomeMomentId;
  /** The moment on screen before this call's switch. */
  from: HomeMomentId;
  T: number;
  switchAt: number;
  lines: LinePlan[];
  /** The last word has been said: the outcome lands. */
  end: number;
  /** The call's finished frame, identical to what React draws at rest for it. */
  settled: number;
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

export function scriptFor(calls: readonly ScheduledCall[], req: RunRequest): Script {
  const byId = new Map(calls.map((c) => [c.id, c]));
  const segs: Seg[] = [];
  let T = 0;
  let from = req.from;

  req.ids.forEach((id, n) => {
    const call = byId.get(id);
    if (!call) throw new Error(`demo-script: no call "${id}"`);
    let at = T + BEAT.line1;
    const lines: LinePlan[] = call.lines.map((line, i) => {
      // Spoken words only: a dash between two words is not a word said.
      const said = line.t
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length)
        .filter((n) => n > 0);
      const lengths = said.length ? said : [1];
      const words = lengths.length;
      const hold = holdFor(words, i === 0, n === 0, i === call.lines.length - 1);
      const plan = {
        sp: line.sp,
        at: round(at),
        hold,
        spacing: clamp((hold - 0.4) / words, 0.1, 0.19),
        words,
        lengths,
      };
      at += hold;
      return plan;
    });
    const last = lines[lines.length - 1];
    const end = round(last.at + last.words * last.spacing + 0.25);
    const settled = round(end + BEAT.settle);
    segs.push({
      id,
      from,
      T: round(T),
      switchAt: round(T + BEAT.switchAt),
      lines,
      end,
      settled,
    });
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

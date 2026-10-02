import type { Cue, CueFile, CueTurn } from "@/lib/audio/cue-types";
import { cueIn, loadCueFile, type Surface } from "@/lib/audio";
import { remapAuthoredAxis, turnAt, wordsShownAt } from "@/components/site/audio/cue";
import type { Prong, Trade, Wall } from "./schema";

/* ------------------------------------------------------------------ *
 * The industry pages, as spoken.
 *
 * Four sections of every trade page can be heard once the visitor turns
 * sound on: the opening line of each prong (§1), the trade's words on
 * the bench (§2), the call on the rail (§3) and the pressure exchange at
 * the wall (§4). Their audio is AI-generated from the page's own text
 * (lib/audio/cues/industry-*.json); this module joins the two.
 *
 * Everything here is pure, so it can be checked against the real cue
 * files without a browser, and everything fails closed: a track that is
 * missing, or whose words do not line up with the text on the page
 * (a cue produced from an older script), comes back as null or
 * undefined, and the section keeps its silent, read-paced behaviour.
 *
 * Nothing here is reached before the visitor opts in: the cue files load
 * through import() on first use, never with the page.
 * ------------------------------------------------------------------ */

export type IndustrySurface = Extract<
  Surface,
  "industry-first-question" | "industry-run-it-call" | "industry-wall-retraction" | "industry-bench-intents"
>;

/**
 * A section's cue file, fetched once and shared (lib/audio's loader).
 * Null when it cannot be had (a failed fetch).
 */
export async function loadIndustryCues(surface: IndustrySurface): Promise<CueFile | null> {
  try {
    return await loadCueFile(surface);
  } catch {
    return null;
  }
}

/** `p`, or null if it has not settled within `ms`: a stage that would start by itself waits no longer for its cues. */
export function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** The track ids, as the audio pipeline names them. */
export const TRACK = {
  prong: (slug: string, prong: Pick<Prong, "id">) => `industry-first-question/${slug}/${prong.id}/0`,
  /** The ring and pickup on the opening's own clock: the US double tone on the one American trade. */
  ring: (slug: string) => (slug === "insurance" ? "sfx/ring-us" : "sfx/ring-uk"),
  call: (slug: string) => `industry-run-it-call/${slug}`,
  wall: (slug: string) => `industry-wall-retraction/${slug}`,
  intent: (slug: string, index: number) => `industry-bench-intents/${slug}/${index}`,
} as const;

/** Display words, split exactly as the cue's `words` are indexed (CUE_SCHEMA). */
export const displayWords = (text: string) => text.split(" ");

/** The turn says `text`, as `sp`, word for word. */
function says(turn: CueTurn | undefined, sp: CueTurn["sp"], text: string) {
  return !!turn && turn.sp === sp && turn.words.length === displayWords(text).length;
}

/**
 * One caller's line, as a track of its own (a prong's opening line, a
 * bench chip): the cue if it is exactly one caller turn with the line's
 * words, else undefined.
 */
export function lineCue(file: CueFile | null, id: string, text: string): Cue | undefined {
  const cue = file ? cueIn(file, id) : undefined;
  return cue && cue.dur > 0 && cue.turns.length === 1 && says(cue.turns[0], "caller", text) ? cue : undefined;
}

/** Where the last word of a track has been said (its last turn's end), or its length without one. */
export function saidBy(cue: Cue): number {
  return cue.turns.length ? cue.turns[cue.turns.length - 1].end : cue.dur;
}

/* ------------------------------------------------------------------ *
 * §1 The opening: the ring, the pickup and the line.
 * ------------------------------------------------------------------ */

export type OpeningPhase = "ringing" | "answered" | "forked";

/** The opening as first-question.tsx times it without sound (ms): ringing, answered, forked. */
export const OPENING_MS = { ringing: 240, answered: 2000, forked: 2560 } as const;
/** The active prong's line starts this long after the fork has drawn (seconds). */
export const LINE_AFTER_FORK = 0.2;

/**
 * The silent opening picked up `from` ms into it: the step it should
 * already be at (null before the first), and the steps still to come,
 * each `in` ms from now. From 0 it is exactly the three timers it always
 * was.
 */
export function openingFrom(from: number): { now: OpeningPhase | null; later: { in: number; phase: OpeningPhase }[] } {
  let now: OpeningPhase | null = null;
  const later: { in: number; phase: OpeningPhase }[] = [];
  for (const phase of ["ringing", "answered", "forked"] as const) {
    const at = OPENING_MS[phase];
    if (at <= from) now = phase;
    else later.push({ in: at - from, phase });
  }
  return { now, later };
}

export type Opening = {
  /** Seconds on the ring track's clock. */
  ringing: number;
  answered: number;
  /** After the track's end when the pickup comes late in it: the fork draws on a wall clock from there. */
  forked: number;
  line: number;
};

/**
 * The opening on the ring track's clock: ringing from the ring, answered
 * from the pickup, and the fork the authored beat after the pickup.
 * Undefined for a track that has no ring or no pickup.
 */
export function openingOf(ring: Cue | undefined): Opening | undefined {
  const burst = ring?.sfx.find((s) => s.kind === "ring");
  const pickup = ring?.sfx.find((s) => s.kind === "pickup");
  if (!ring || !(ring.dur > 0) || !burst || !pickup || !(pickup.start > burst.start)) return undefined;
  const forked = pickup.start + (OPENING_MS.forked - OPENING_MS.answered) / 1000;
  return { ringing: burst.start, answered: pickup.start, forked, line: forked + LINE_AFTER_FORK };
}

/* ------------------------------------------------------------------ *
 * §2 The bench: one chip, one line.
 * ------------------------------------------------------------------ */

/** The bench's read pacing: a chip a beat (bench.tsx CYCLE_MS). */
export const BENCH_READ_S = 2.6;
/** The pause after a spoken chip before the next one. */
export const BENCH_AFTER_S = 0.7;

/**
 * How long a spoken chip holds before the autoplay moves on, from the
 * start of its track: max(2.6 s, the line's end + 0.7 s). A chip with no
 * track holds for the read pacing.
 */
export function benchDwell(cue: Cue | undefined): number {
  return cue ? Math.max(BENCH_READ_S, saidBy(cue) + BENCH_AFTER_S) : BENCH_READ_S;
}

/* ------------------------------------------------------------------ *
 * §3 Run it: the call on its spoken clock.
 * ------------------------------------------------------------------ */

/**
 * The trade with its call re-timed to the recording: each turn starts
 * where the cue says it is spoken; the tool runs and the job card's
 * fields, authored between two turns, keep their place between the same
 * two turns as spoken (piecewise-linear, so nothing lands before what
 * caused it); and the call is as long as the track. Null unless the cue
 * has every turn of the call, in order, word for word.
 *
 * Only the listen mode reads this. The silent 14-second pass keeps the
 * authored clock, so the page reads exactly as it did without sound.
 */
export function withSpokenTiming(trade: Trade, cue: Cue): Trade | null {
  if (!(cue.dur > 0) || cue.turns.length !== trade.turns.length) return null;
  for (let k = 0; k < cue.turns.length; k++) {
    const turn = cue.turns[k];
    const line = trade.turns[turn.i];
    if (turn.i !== k || !line || !says(turn, line.side, line.text)) return null;
    if (k > 0 && !(turn.start > cue.turns[k - 1].start)) return null;
  }
  const axis = remapAuthoredAxis(
    trade.turns.map((x) => x.at),
    cue,
    trade.duration,
  );
  // Rounded to the millisecond: keys and labels stay stable, and nothing a reader can see is finer.
  const at = (authored: number) => Math.round(Math.max(0, Math.min(cue.dur, axis(authored))) * 1000) / 1000;
  return {
    ...trade,
    turns: trade.turns.map((x, k) => ({ ...x, at: cue.turns[k].start })),
    toolRuns: trade.toolRuns.map((r) => ({ ...r, at: at(r.at) })),
    rig: { ...trade.rig, fields: trade.rig.fields.map((f) => ({ ...f, at: at(f.at) })) },
    duration: cue.dur,
  };
}

/** The call's track and the trade re-timed to it; null without a track that says the call as written. */
export function spokenCall(trade: Trade, file: CueFile | null): { cue: Cue; trade: Trade } | null {
  const cue = file ? cueIn(file, TRACK.call(trade.slug)) : undefined;
  const spoken = cue ? withSpokenTiming(trade, cue) : null;
  return cue && spoken ? { cue, trade: spoken } : null;
}

/** "m:ss" of whole elapsed seconds, as the rail's clock prints them. */
export function clockText(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "A" or "An" before a number said aloud: an 8-, 11-, 18- or 80-something-second call. */
export function articleFor(n: number) {
  const s = String(Math.floor(n));
  return s.startsWith("8") || s === "11" || s === "18" ? "An" : "A";
}

/* ------------------------------------------------------------------ *
 * §4 The wall: the exchange, detent by detent.
 * ------------------------------------------------------------------ */

export type WallPart = "caller" | "agent" | "begins" | "instead";

export type WallLine = { detent: number; part: WallPart; sp: CueTurn["sp"]; text: string };

/**
 * The exchange as the audio pipeline scripted it, one line per turn:
 * each detent's caller line, then its agent line, except at the
 * retraction's detent, where the agent's answer is the half-sentence
 * that is cut off (`begins`) and the one it gives instead.
 */
export function wallLines(wall: Wall): WallLine[] {
  const lines: WallLine[] = [];
  wall.detents.forEach((d, detent) => {
    lines.push({ detent, part: "caller", sp: "caller", text: d.caller });
    if (detent === wall.retraction.atDetent) {
      lines.push({ detent, part: "begins", sp: "agent", text: wall.retraction.begins });
      lines.push({ detent, part: "instead", sp: "agent", text: wall.retraction.instead });
    } else if (d.agent) {
      lines.push({ detent, part: "agent", sp: "agent", text: d.agent });
    }
  });
  return lines;
}

export type WallScript = {
  cue: Cue;
  lines: WallLine[];
  /** The cue turn of each line (same index). */
  turns: CueTurn[];
};

/** The wall's track joined to its lines; null unless every line is a turn of it, in order, word for word. */
export function wallScript(trade: Trade, file: CueFile | null): WallScript | null {
  const cue = file ? cueIn(file, TRACK.wall(trade.slug)) : undefined;
  if (!cue || !(cue.dur > 0)) return null;
  const lines = wallLines(trade.wall);
  if (cue.turns.length !== lines.length) return null;
  for (let k = 0; k < lines.length; k++) {
    if (cue.turns[k].i !== k || !says(cue.turns[k], lines[k].sp, lines[k].text)) return null;
    if (k > 0 && !(cue.turns[k].start > cue.turns[k - 1].start)) return null;
  }
  return { cue, lines, turns: cue.turns };
}

/**
 * Where detents `first` to `last` are spoken on the track: from the
 * first one's caller line to the end of the last one's last line.
 */
export function wallSegment(script: WallScript, first: number, last: number): { from: number; to: number } {
  let from = Infinity;
  let to = -Infinity;
  script.lines.forEach((line, k) => {
    if (line.detent < first || line.detent > last) return;
    from = Math.min(from, script.turns[k].start);
    to = Math.max(to, script.turns[k].end);
  });
  return Number.isFinite(from) ? { from, to } : { from: 0, to: script.cue.dur };
}

export type Beat = "begins" | "cut" | "instead";

/** What the wall shows at a moment of the track. */
export type WallFrame = {
  /** The detent being spoken. */
  at: number;
  /** The agent has started answering at this detent (before that, its slot stays empty). */
  answered: boolean;
  /** At the retraction: where it is. Null at the other detents. */
  beat: Beat | null;
  /** At the retraction: how many words of `begins` have been said. */
  words: number;
};

/**
 * The wall at cue time t: the detent of the last line to have started;
 * at the retraction, the half-sentence word by word as it is said, the
 * strike where its clip ends (the cut), and the answer it gives instead
 * from that line's own start.
 */
export function wallFrameAt(script: WallScript, t: number): WallFrame {
  const turn = turnAt(script.cue, t) ?? script.turns[0];
  const k = Math.max(0, script.turns.indexOf(turn));
  const line = script.lines[k];
  const begins = script.lines.findIndex((l) => l.detent === line.detent && l.part === "begins");
  const beginsWords = begins >= 0 ? script.turns[begins].words.length : 0;
  switch (line.part) {
    case "caller":
      return { at: line.detent, answered: false, beat: null, words: 0 };
    case "agent":
      return { at: line.detent, answered: true, beat: null, words: 0 };
    case "begins":
      return {
        at: line.detent,
        answered: true,
        beat: t < turn.end ? "begins" : "cut",
        words: t < turn.end ? wordsShownAt(turn, t) : beginsWords,
      };
    case "instead":
      return { at: line.detent, answered: true, beat: "instead", words: beginsWords };
  }
}

export const sameWallFrame = (a: WallFrame | null, b: WallFrame | null) =>
  a === b || (!!a && !!b && a.at === b.at && a.answered === b.answered && a.beat === b.beat && a.words === b.words);

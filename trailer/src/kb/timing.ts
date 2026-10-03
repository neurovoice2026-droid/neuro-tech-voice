/**
 * FILM 2 ("kb", "Two Kinds of Work") — EVERY timing constant of the film lives in this file:
 * the timeline contract of docs/kb/PIPELINE.md §4, built on the script docs/kb/SCRIPT.md.
 *
 * Like film 1 (src/timing.ts) the film is cut on the 120 BPM grid (beat = 15 frames, bar = 60,
 * 8th = 7.5, 16th = 3.75, in 30 fps timeline frames) and TIMED BY THE REAL VOICES
 * (src/kb/voice.generated.ts, written by `generate-voice --film=kb`): every line is placed from the
 * takes' real lengths and word timings with the script's rules, so installing other takes re-times
 * the whole film by itself.
 *
 * THE ANCHORS (SCRIPT.md "Grid and anchors") are kept where the voices allow it. Where a take makes
 * one impossible, the script's rule applies: everything from there on moves by WHOLE BARS (so every
 * later anchor keeps its place in the bar) — `anchorAt()`; ANCHORS lists each one, planned vs placed.
 *
 * Scene values (*_LOCAL) are LOCAL to their act (0 = the act's own start), like film 1's; SCENES,
 * VOICES, HITS, CUES, BED.ride, MIX and MUSIC are absolute timeline frames.
 *
 * Node-safe (PIPELINE.md H10): the sound driver, check-mix, check-render and render-master import
 * this file with --experimental-strip-types — explicit `.ts` extensions, type-only imports marked,
 * no enums / namespaces / parameter properties, no React or Remotion.
 */
import { VOICE, type VoiceId } from './voice.generated.ts';
import {
  BEAT,
  BPM,
  CUT,
  DUCK,
  FPS,
  LANDSCAPE,
  LIGHT_NOTES,
  LIGHT_SEMI,
  MIX as MIX1,
  PK,
  RENDER_FPS,
  SFX as SFX1,
  SUB,
  VERTICAL,
  b,
  type Caption,
  type Light,
} from '../timing.ts';
import {
  buildCues,
  makeSpeech,
  makeVoiceKit,
  upBeat,
  upHalf,
  upQuarter,
  type Cue,
  type Hit,
  type Pan,
  type Room,
  type Voiced,
  type VoiceRide,
  type Weight,
} from '../lib/cuesheet.ts';

/* ── the house constants: film 1's, re-exported, never redefined (PIPELINE.md §4, H12) ── */
export { BEAT, BPM, CUT, DUCK, FPS, LANDSCAPE, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b };
export type { Caption, Cue, Hit, Light, Voiced, VoiceRide };
export type { VoiceId };

/* ── the grid ─────────────────────────────────────────────────────── */
/** Frames per bar (60: 2 s at 120 BPM). */
export const BAR = 4 * BEAT;
/** Snap UP to the next bar line / strong beat (beat 1 or 3 of the bar), integer frames. */
const upBar = (f: number) => Math.round(Math.ceil(f / BAR - 1e-9) * BAR);
const upStrong = (f: number) => Math.round(Math.ceil(f / (2 * BEAT) - 1e-9) * (2 * BEAT));
/** Snap UP to the next exact 16th / 8th (fractional frames: hits and picture moments are sample-accurate). */
const up16 = (f: number) => Math.ceil(f / (BEAT / 4) - 1e-9) * (BEAT / 4);
const up8 = (f: number) => Math.ceil(f / (BEAT / 2) - 1e-9) * (BEAT / 2);
/** The nearest beat. */
const nearBeat = (f: number) => Math.round(f / BEAT) * BEAT;

/* ── voices ───────────────────────────────────────────────────────── */
const KIT = makeVoiceKit(VOICE);
/** Frames a spoken line lasts. */
export const vFrames = KIT.vFrames;
/** Frame offset (from the line's start) at which spoken word `k` begins. */
export const vWord = KIT.vWord;
/** A cut line's fade [from, to] (absolute), or null when it plays whole (film 2 has no cascades yet: always null). */
export const voiceCut = KIT.voiceCut;
/** The frame a line has gone silent (its cut, else its end). */
export const voiceEnd = KIT.voiceEnd;
/** Frames from a line's start to the end of its last voiced frame (loudness env ≥ CUT.onset). */
const voicedTo = (id: VoiceId) => {
  const e = VOICE.lines[id].env;
  let i = e.length - 1;
  while (i > 0 && e[i] < CUT.onset) i--;
  return i + 1;
};
/** The last spoken word's index. */
const lastWord = (id: VoiceId) => VOICE.lines[id].words.length - 1;
/** Minimum silence between two speakers (frames): a real phone turn is ~0.2–0.3 s (film 1's TURN_GAP). */
const TURN_GAP = 6;

/* ── the anchors ──────────────────────────────────────────────────── */
/** The script's fixed anchors, in frames on the 90 s plan (SCRIPT.md "Grid and anchors"). */
export const ANCHOR_PLAN = {
  ringOne: 60, // 2.0  bar line
  hardStop: 540, // 18.0 bar line: every bus cut on the sample
  waiting: 720, // 24.0 bar line: the onset of "Waiting."
  liveRing: 1200, // 40.0 bar line: the live call rings
  resume: 1500, // 50.0 bar line: stop-time ends, the answer starts
  deskRing: 2235, // 74.5 beat 2 of the bar, under the staff line
  impact: 2580, // 86.0 bar line (beat 1): MIX.impact.at
  end: 2700, // 90.0 MIX.fadeOut = [end − 30, end]
} as const;
type AnchorKey = keyof typeof ANCHOR_PLAN;
/** bars the voices have pushed the film so far (whole bars: every later anchor keeps its place in the bar) */
let shift = 0;
const placed: Partial<Record<AnchorKey, number>> = {};
/** An anchor: its planned frame + the shift so far, moved on by whole bars until it is at or after `earliest`. */
const anchorAt = (key: AnchorKey, earliest: number) => {
  let f = ANCHOR_PLAN[key] + shift;
  while (f < earliest - 1e-9) {
    f += BAR;
    shift += BAR;
  }
  placed[key] = f;
  return f;
};

/* ================================================================ *
 * THE VOICED TIMELINE — act by act, from the real takes.
 * ================================================================ */

/* ── PART I · THE REPEAT (b01–b05) ──────────────────────────────────
 * Three rings, three callers, the same answer three times (kb2-desk-1, the identical file). Ring one
 * on the bar at 2.0; the rings get answered faster (pickup a beat, an 8th, a 16th after the ring);
 * each caller speaks a 16th after the pickup, the desk answers a turn after the caller (16th grid).
 * Rings 2 and 3 keep the script's strong beats (7.0, 12.0) unless the answer before is still sounding:
 * then the next strong beat — or, if that would run Part I past the hard stop, the next beat. b05 (the
 * unvoiced rolls) absorbs what is left; only if the third answer still does not fit before 18.0 does the
 * hard stop (and the film after it) move by a bar. */
const RING_ONE = anchorAt('ringOne', 0);
const CALLERS = ['kb2-c1', 'kb2-c2', 'kb2-c3'] as const satisfies readonly VoiceId[];
const DESK1: VoiceId = 'kb2-desk-1';
const RING_PLAN = [RING_ONE, b(14), b(24)]; // 2.0 · 7.0 · 12.0 s
const PICKUP_AFTER = [BEAT, BEAT / 2, BEAT / 4]; // 2.5 · 7.25 · 12.125: they answer faster each time
const partOne = (grid: (f: number) => number) => {
  const p = { ring: [] as number[], pickup: [] as number[], caller: [] as number[], desk: [] as number[], slip: [] as number[] };
  let free = 0; // the frame the previous answer has gone quiet
  CALLERS.forEach((id, k) => {
    const ring = k === 0 ? RING_PLAN[0] : Math.max(RING_PLAN[k], grid(free));
    const pickup = ring + PICKUP_AFTER[k];
    const caller = Math.round(pickup + BEAT / 4);
    const desk = upQuarter(caller + vFrames(id) + TURN_GAP);
    p.ring.push(ring);
    p.pickup.push(pickup);
    p.caller.push(caller);
    p.desk.push(desk);
    p.slip.push(up16(desk + vWord(DESK1, lastWord(DESK1)))); // the slip lands on the 16th of "two."
    free = desk + voicedTo(DESK1);
  });
  /** the third answer has gone quiet / its file has ended */
  return { ...p, quiet: free, end: p.desk[2] + vFrames(DESK1) };
};
/** b04's dead line needs at least a 16th of flat waveform before b05 / the stop */
const fitsBefore = (p: ReturnType<typeof partOne>, stop: number) => Math.max(p.quiet + BEAT / 4, p.end) <= stop;
const P1 = ((strong) => (fitsBefore(strong, ANCHOR_PLAN.hardStop) ? strong : partOne(upBeat)))(partOne(upStrong));
const HARD_STOP = anchorAt('hardStop', Math.max(P1.quiet + BEAT / 4, P1.end));
const { ring: R_RING, pickup: R_PICKUP, caller: R_CALLER, desk: R_DESK, slip: R_SLIP } = P1;
/** b04's dead line: from the third answer's last sound, half a beat of flat waveform … */
const DEAD_FROM = P1.quiet;
/** … then b05: the rest of the day, the clock rolling on 8ths (six in the script; as many as fit before the stop —
 *  none if there is no room), from the 8th nearest half a beat after it (never less than a 16th of dead line) */
const ROLL0 = Math.max(Math.round((DEAD_FROM + BEAT / 2) / (BEAT / 2)) * (BEAT / 2), up8(DEAD_FROM + BEAT / 4));
const ROLLS: number[] = [];
for (let f = ROLL0; ROLLS.length < 6 && f < HARD_STOP - 1e-9; f += BEAT / 2) ROLLS.push(f);

/* ── b06 · A RECORDING ──────────────────────────────────────────────
 * vo-1 an 8th after the hard stop (18.25); vo-2 placed so "Waiting." starts ON the bar (24.0). If the
 * takes leave less than 0.25 s between them, the anchor (and the film from here on) moves by a bar. */
const VO1_AT = HARD_STOP + b(0.5);
const WAIT_WORD = 7; // vo-2 "Waiting."
const WAITING = anchorAt('waiting', VO1_AT + vFrames('kb2-vo-1') + BEAT / 2 + vWord('kb2-vo-2', WAIT_WORD));
const VO2_AT = WAITING - vWord('kb2-vo-2', WAIT_WORD);
/** "Waiting." holds to the next strong beat a second on (25.0 on the plan) */
const REC_TO = Math.max(WAITING + b(2), upBeat(VO2_AT + vFrames('kb2-vo-2')));

/* ── PART II · b07 · TWO KINDS ──────────────────────────────────────
 * The seam draws on the act's first frame; vo-3 an 8th later; the act ends on the beat after vo-3
 * and a breath. */
const TURN_FROM = REC_TO;
const VO3_AT = TURN_FROM + b(0.5);
const TURN_TO = upBeat(VO3_AT + vFrames('kb2-vo-3') + b(0.5));

/* ── PART III · b08 · WRITTEN ONCE ──────────────────────────────────
 * vo-4 an 8th in; after "knowledge base." at least a beat of hold, then the live call rings on its bar. */
const WRITTEN_FROM = TURN_TO;
const VO4_AT = WRITTEN_FROM + b(0.5);
const KB_HOLD = b(1);
const LIVE_RING = anchorAt('liveRing', VO4_AT + vFrames('kb2-vo-4') + KB_HOLD);

/* ── b09–b11 · THE CALL ─────────────────────────────────────────────
 * Ring on the bar, pickup an 8th later (40.25), the caller a 16th after that, Ava's filler a turn
 * after him; the freeze on the 8th after the filler; vo-5 over the stop-time; the answer resumes on its
 * bar (50.0) and call-2 speaks an 8th in; the record row lands on the 8th after her answer and holds a second. */
const CALL_FROM = LIVE_RING;
const CALL_PICKUP = CALL_FROM + BEAT / 2;
const C4_AT = Math.round(CALL_PICKUP + BEAT / 4);
const CALL1_AT = upQuarter(C4_AT + vFrames('kb2-c4') + TURN_GAP);
const FREEZE = upHalf(CALL1_AT + vFrames('kb2-call-1') + 2);
const VO5_AT = FREEZE + b(0.5);
const RESUME = anchorAt('resume', VO5_AT + vFrames('kb2-vo-5') + b(0.5));
const CALL2_AT = RESUME + b(0.5);
const RECORD = upHalf(CALL2_AT + vFrames('kb2-call-2') + 2);
const CALL_TO = RECORD + b(2);

/* ── b12 · YOUR LINE ────────────────────────────────────────────────
 * The caret a beat in; the owner's line types one word per 16th (22 words, nothing narrated); the save
 * tick after the last word; vo-6 three and a half beats in (58.0 on the plan). */
const OWNER_LINE = "I don't have an answer for that, and I don't want to guess. I'll ask the team to call you back today.";
const OWNER_WORDS = OWNER_LINE.split(' ').length; // 22
const LINE_FROM = CALL_TO;
const CARET = LINE_FROM + b(1);
const SAVE = CARET + OWNER_WORDS * (BEAT / 4);
const VO6_AT = Math.max(LINE_FROM + b(7), upHalf(SAVE + 2));
const LINE_TO = upBeat(VO6_AT + vFrames('kb2-vo-6') + b(0.5));

/* ── b13–b14 · CHANGE IT / THE NEXT CALL ────────────────────────────
 * vo-7 an 8th in; the fifth Ready mallet on the beat nearest "answer."; the ring on the next strong beat
 * after her line; Dana's identical file a 16th after the pickup; call-3 a turn later. */
const CHANGE_FROM = LINE_TO;
const VO7_AT = CHANGE_FROM + b(0.5);
const READY5 = nearBeat(VO7_AT + vWord('kb2-vo-7', lastWord('kb2-vo-7')));
const RING_B14 = upStrong(VO7_AT + vFrames('kb2-vo-7') + b(0.5));
const PICKUP_B14 = RING_B14 + BEAT / 2;
const C2B_AT = Math.round(PICKUP_B14 + BEAT / 4);
const CALL3_AT = upQuarter(C2B_AT + vFrames('kb2-c2') + TURN_GAP);
const FOUR = CALL3_AT + vWord('kb2-call-3', lastWord('kb2-call-3'));
const LCUT = up16(FOUR);

/* ── PART IV · b15–b16 · WORK THAT MATTERS ──────────────────────────
 * The desk payoff ring is the anchor (74.5, beat 2 of its bar); "nervous." rises three beats before it
 * (the act's start — an L-cut under call-3's last word at the earliest), desk-2 two beats before it
 * (a turn after call-3 at the earliest). Then at least a full bar of room tone before vo-8. */
const DESK2: VoiceId = 'kb2-desk-2';
const DESK_RING = anchorAt('deskRing', Math.max(FOUR + b(3), CALL3_AT + vFrames('kb2-call-3') + TURN_GAP + b(2)));
const MATTERS_FROM = DESK_RING - b(3);
const DESK2_AT = DESK_RING - b(2);
const DESK2_END = DESK2_AT + vFrames(DESK2);
const VO8_AT = upHalf(DESK2_END + BAR);
const B16 = VO8_AT - b(0.5);
/** the paper darkens into night over three beats, landing on the bar the close starts on */
const CTA_FROM = upBar(VO8_AT + vFrames('kb2-vo-8') + b(3));
const DARK = [CTA_FROM - b(3), CTA_FROM] as const;

/* ── CLOSE · b17–b18 ────────────────────────────────────────────────
 * vo-9 an 8th in; the four lights on 8ths as her heading completes; the converge on the beat after her
 * line, the impact two beats later ON a bar (a beat of breath before the converge if the grid needs one,
 * as in film 1); Ava names it a beat after the impact; the button on "…Voice." once the URL is in;
 * the note a beat later; the press; the still hold; the end two bars after the impact. */
const VO9_AT = CTA_FROM + b(0.5);
const IMPACT = anchorAt('impact', upBeat(VO9_AT + vFrames('kb2-vo-9')) + b(2));
const CONVERGE = IMPACT - b(2);
/** the four lights on 8ths from her last word — earlier if that would run them into the converge */
const LIGHT0 = Math.min(up8(VO9_AT + vWord('kb2-vo-9', lastWord('kb2-vo-9'))), CONVERGE - 4 * (BEAT / 2));
const LIGHTS4 = [0, 1, 2, 3].map((i) => LIGHT0 + i * (BEAT / 2));
const BRAND: VoiceId = 'kb2-brand';
const BRAND_AT = IMPACT + b(1);
const BUTTON = IMPACT + Math.max(b(2.5), upHalf(b(1) + vWord(BRAND, lastWord(BRAND))));
const NOTE = BUTTON + b(1);
const PRESS = Math.max(NOTE + b(1), BRAND_AT + vFrames(BRAND) + b(0.5));
const END = anchorAt('end', Math.max(IMPACT + b(8), upBar(PRESS + b(3))));
const FINAL_HOLD = Math.max(PRESS + b(1), END - b(2));

/**
 * Scene windows on the absolute timeline (the acts of the task list: repeat b01–b05, recording b06,
 * turn b07, written b08, call b09–b11, line b12, change b13–b14, matters b15–b16, cta b17–b18).
 * `pre`/`post`: frames a scene stays mounted before/after its window (0 for the placeholder cards).
 */
export const SCENES = (() => {
  const w = (from: number, to: number, pre = 0, post = 0) => ({ from, to, pre, post });
  return {
    repeat: w(0, HARD_STOP),
    recording: w(HARD_STOP, REC_TO),
    turn: w(TURN_FROM, TURN_TO),
    written: w(WRITTEN_FROM, LIVE_RING),
    call: w(CALL_FROM, CALL_TO),
    line: w(LINE_FROM, LINE_TO),
    change: w(CHANGE_FROM, MATTERS_FROM),
    matters: w(MATTERS_FROM, CTA_FROM),
    cta: w(CTA_FROM, END),
  } as const;
})();
export type KbSceneKey = keyof typeof SCENES;
/** The acts in film order. */
export const KB_ORDER: readonly KbSceneKey[] = ['repeat', 'recording', 'turn', 'written', 'call', 'line', 'change', 'matters', 'cta'];
/** Total length in frames (set by the voices) and in beats. */
export const DURATION = SCENES.cta.to;
export const TOTAL_BEATS = DURATION / BEAT;

/** Every anchor: planned (the 90 s script) and placed (this take set); `bars` = how far it moved. */
export const ANCHORS = Object.fromEntries(
  (Object.keys(ANCHOR_PLAN) as AnchorKey[]).map((k) => [k, { plan: ANCHOR_PLAN[k], at: placed[k] as number, bars: ((placed[k] as number) - ANCHOR_PLAN[k]) / BAR }]),
) as Record<AnchorKey, { plan: number; at: number; bars: number }>;

/* ================================================================ *
 * FINE CUTS — every act's internal moments, LOCAL to the act.
 * ================================================================ */
const L = (key: KbSceneKey, f: number) => f - SCENES[key].from;

/** b01–b05 (repeat-local = absolute: the act starts at 0). */
export const REPEAT_LOCAL = {
  /** 0.25: a cup set down on wood; her sentence starts rising */
  cup: b(0.5),
  sentence: b(0.5),
  /** 1.75: the em dash hangs, a pen click */
  dash: b(3.5),
  rings: R_RING as readonly number[],
  pickups: R_PICKUP as readonly number[],
  /** the callers' line starts (kb2-c1 · c2 · c3) and the three desk answers (kb2-desk-1, the identical file) */
  callers: R_CALLER as readonly number[],
  callerIds: CALLERS,
  desk: R_DESK as readonly number[],
  /** each slip tears off and lands on the 16th of "two." */
  slips: R_SLIP as readonly number[],
  /** b04's dead line: the waveform lies flat (the caller's silence after the wrong answer) */
  dead: [DEAD_FROM, ROLL0] as const,
  /** b05: the clock rolls on 8ths (each a rose pulse and a new slip) */
  rolls: ROLLS as readonly number[],
  /** 18.0 (bar): everything stops on the sample */
  hardStop: HARD_STOP,
};

/** b06 (recording-local). */
export const RECORDING_LOCAL = {
  vo1: L('recording', VO1_AT),
  /** "You hired someone brilliant." rises on "You"; leaves on "The" as "The phone turned them / into a recording." rises */
  title1: L('recording', VO1_AT + vWord('kb2-vo-1', 0)),
  brilliant: L('recording', VO1_AT + vWord('kb2-vo-1', 3)),
  title2: L('recording', VO1_AT + vWord('kb2-vo-1', 4)),
  /** "a recording." eases into rush ink (on "a") */
  recordingKey: L('recording', VO1_AT + vWord('kb2-vo-1', 9)),
  vo2: L('recording', VO2_AT),
  /** "And the customer…": the camera pulls back to the in-person card */
  pullBack: L('recording', VO2_AT + vWord('kb2-vo-2', 0)),
  /** "Waiting." locks in ON the bar */
  waiting: L('recording', WAITING),
};

/** b07 (turn-local). */
export const TURN_LOCAL = {
  /** the seam draws over one beat from the act's first frame */
  seam: [0, b(1)] as const,
  vo3: L('turn', VO3_AT),
  repeats: L('turn', VO3_AT + vWord('kb2-vo-3', 2)),
  matters: L('turn', VO3_AT + vWord('kb2-vo-3', 3)),
  /** the orb is born from the line light on "Ava", snapped to the 16th */
  ava: L('turn', up16(VO3_AT + vWord('kb2-vo-3', 7))),
  /** "the first kind": the flip window stops for good */
  firstKind: L('turn', VO3_AT + vWord('kb2-vo-3', 17)),
};
/** the flip window turns over on every beat (only ever to the same word) until "the first kind" */
export const TURN_FLIPS: readonly number[] = (() => {
  const out: number[] = [];
  for (let f = BEAT; f < TURN_LOCAL.firstKind; f += BEAT) out.push(f);
  return out;
})();

/** b08 (written-local). Rows land on the 16th after their nouns; each pill rolls to Ready a beat later. */
export const WRITTEN_LOCAL = (() => {
  const at = (k: number) => VO4_AT + vWord('kb2-vo-4', k);
  const row = (k: number) => L('written', up16(at(k)) + BEAT / 4);
  const rows = [row(6), row(8), row(10), row(14)] as const; // prices · hours · policies · (pages from your) website
  return {
    vo4: L('written', VO4_AT),
    /** "once": the slip column stacks up into one, on 16ths */
    once: L('written', up16(at(4))),
    rows,
    /** "pages from your website": the URL field types from "pages" */
    url: L('written', up16(at(11))),
    /** each Ready mallet (E4 F#4 G#4 B4), a beat after its row */
    ready: rows.map((r) => r + BEAT) as readonly number[],
    /** "knowledge": the eyebrow ● KNOWLEDGE BASE */
    knowledge: L('written', at(17)),
  };
})();

/** b09–b11 (call-local; 0 = the live ring on its bar). */
export const CALL_LOCAL = {
  ring: 0,
  pickup: BEAT / 2,
  c4: L('call', C4_AT),
  call1: L('call', CALL1_AT),
  /** 44.5 on the plan: the call freezes; BETWEEN QUESTION AND ANSWER */
  freeze: L('call', FREEZE),
  vo5: L('call', VO5_AT),
  /** "the part that answers them": the ink sweep */
  sweep: L('call', VO5_AT + vWord('kb2-vo-5', 5)),
  /** "even when they put it differently": the hero link, then the three earlier phrasings on 8ths */
  links: [0, 1, 2, 3].map((i) => L('call', up8(VO5_AT + vWord('kb2-vo-5', 10)) + i * (BEAT / 2))) as readonly number[],
  /** 50.0 on the plan (bar): time resumes */
  resume: L('call', RESUME),
  call2: L('call', CALL2_AT),
  /** the record row folds in after her answer and holds a second */
  record: L('call', RECORD),
};

/** b12 (line-local). */
export const LINE_LOCAL = {
  ownerLine: OWNER_LINE,
  caret: L('line', CARET),
  /** one word per 16th */
  keys: Array.from({ length: OWNER_WORDS }, (_, k) => L('line', CARET + k * (BEAT / 4))) as readonly number[],
  save: L('line', SAVE),
  vo6: L('line', VO6_AT),
  /** "in the words you chose": the focus ring settles on "words" */
  focus: L('line', VO6_AT + vWord('kb2-vo-6', 10)),
};

/** b13–b14 (change-local). */
export const CHANGE_LOCAL = {
  vo7: L('change', VO7_AT),
  /** "Hours change?": the caret clicks into 14:00 */
  caret: L('change', VO7_AT + vWord('kb2-vo-7', 0)),
  /** "Change the document": the menu opens */
  menu: L('change', up16(VO7_AT + vWord('kb2-vo-7', 2))),
  /** the fifth Ready mallet (E5) completes the phrase, on the beat with "the new answer" */
  ready5: L('change', READY5),
  ring: L('change', RING_B14),
  pickup: L('change', PICKUP_B14),
  c2: L('change', C2B_AT),
  call3: L('change', CALL3_AT),
  /** "four.": the new line takes the sweep */
  four: L('change', FOUR),
  /** the frame starts crossing back to the desk under her last word */
  lcut: L('change', LCUT),
};

/** b15–b16 (matters-local). */
export const MATTERS_LOCAL = {
  /** "nervous." rises on the act's first frame */
  nervous: 0,
  desk2: L('matters', DESK2_AT),
  /** the line rings once (ducked, cut after one chirp); the label rolls in an 8th later */
  ring: L('matters', DESK_RING),
  label: L('matters', DESK_RING + BEAT / 2),
  /** at least one full bar of room tone, nothing moving but the colon's breath */
  breath: [L('matters', DESK2_END), L('matters', VO8_AT)] as const,
  /** b16: the title over the desk; vo-8; "do." sends the old slip stack away */
  b16: L('matters', B16),
  vo8: L('matters', VO8_AT),
  do: L('matters', VO8_AT + vWord('kb2-vo-8', lastWord('kb2-vo-8'))),
  /** the paper darkens into night over three beats */
  dark: [L('matters', DARK[0]), L('matters', DARK[1])] as const,
};

/** b17–b18 (cta-local). The §7 FALLBACK route: a film-2 Cta from the timing-free end-card parts. */
export const CTA_LOCAL = {
  vo9: L('cta', VO9_AT),
  headline: ['Your answers.', 'Written once, there for every call.'] as const,
  /** headline word i rises on spoken word i (8 words, 8 spoken words) */
  words: Array.from({ length: VOICE.lines['kb2-vo-9'].words.length }, (_, k) => L('cta', VO9_AT + vWord('kb2-vo-9', k))) as readonly number[],
  /** the four lights, sunday first, on 8ths as the heading completes */
  lights: LIGHTS4.map((f) => L('cta', f)) as readonly number[],
  lightOrder: ['sunday', 'rush', 'closing', 'night'] as const,
  converge: L('cta', CONVERGE),
  impact: L('cta', IMPACT),
  brand: L('cta', BRAND_AT),
  /** the URL rises ON her words: "neuro" | "tech" | "voice.com" */
  url: [0, 1, 2].map((k) => L('cta', BRAND_AT + vWord(BRAND, k))) as readonly number[],
  button: L('cta', BUTTON),
  note: L('cta', NOTE),
  press: L('cta', PRESS),
  /** from here to the end nothing moves but grain */
  finalHold: L('cta', FINAL_HOLD),
};

/** The mix room of a hit (and the grain): the paper acts in the short bright room, the close in the dark
 *  one — the dark takes over a second before the close (81.0 on the plan, the darkening's middle). */
const WHITE_END = SCENES.cta.from - b(2);
export const roomAt = (f: number): Room => (f < WHITE_END ? 'white' : 'night');
/** FilmGrain: paper grain until `white[0]`, crossfading to the night's grain by `white[1]` (the close). */
export const GRAIN = { white: [WHITE_END, SCENES.cta.from] as const };

/* ================================================================ *
 * THE CUE SHEET — VOICES, speech, HITS → CUES, BED, MIX
 * (docs/kb/PIPELINE.md §4 / §5; mixed by film 1's unchanged master(), scripts/audio/mix.mjs).
 * ================================================================ */

/** Every spoken line on the absolute timeline, SORTED BY `at` (H11: each line's span ends at the next one's
 *  start). kb2-desk-1 plays three times and kb2-c2 twice: the identical files. */
export const VOICES: Voiced<VoiceId>[] = (
  [
    ...CALLERS.flatMap((id, k) => [
      { at: R_CALLER[k], id },
      { at: R_DESK[k], id: DESK1 },
    ]),
    { at: VO1_AT, id: 'kb2-vo-1' },
    { at: VO2_AT, id: 'kb2-vo-2' },
    { at: VO3_AT, id: 'kb2-vo-3' },
    { at: VO4_AT, id: 'kb2-vo-4' },
    { at: C4_AT, id: 'kb2-c4' },
    { at: CALL1_AT, id: 'kb2-call-1' },
    { at: VO5_AT, id: 'kb2-vo-5' },
    { at: CALL2_AT, id: 'kb2-call-2' },
    { at: VO6_AT, id: 'kb2-vo-6' },
    { at: VO7_AT, id: 'kb2-vo-7' },
    { at: C2B_AT, id: 'kb2-c2' },
    { at: CALL3_AT, id: 'kb2-call-3' },
    { at: DESK2_AT, id: DESK2 },
    { at: VO8_AT, id: 'kb2-vo-8' },
    { at: VO9_AT, id: 'kb2-vo-9' },
    { at: BRAND_AT, id: BRAND },
  ] as Voiced<VoiceId>[]
).sort((x, y) => x.at - y.at);

/** The voice post (a fader on part of a line): none yet. */
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {};

/** Speech windows (the bed ducks under these), spoken phrases, and "is someone speaking at f?" */
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/** The sound families: film 1's library, reused read-only from public/sfx (film-2 extras, `dir: 'kb/sfx'`, come later). */
export const SFX = SFX1;
export type Snd = keyof typeof SFX;

const H = (at: number, snd: Snd, light: Light, x: Pan, w: Weight, label: string, o: Partial<Hit<Snd>> = {}): Hit<Snd> => ({
  at,
  snd,
  light,
  x,
  w,
  label,
  ...o,
});
const chime = (l: Exclude<Light, 'none'>) => `chime-${l}` as Snd;

/**
 * THE VISUAL HITS (a minimal sheet for the placeholder cut: the rings, pickups and slip lands, the hard
 * stop, the call's freeze and resume, the record, the lights, the converge and the impact). Part I is
 * in the rush light (the rose line light), everything from Ava on in sunday.
 */
export const HITS: Hit<Snd>[] = [
  /* ── PART I ── */
  H(REPEAT_LOCAL.cup, 'tap', 'none', 0.3, 3, 'a cup set down on wood', { db: -3 }),
  H(REPEAT_LOCAL.dash, 'click', 'none', 0.4, 3, 'the em dash hangs: a pen click', { db: -4 }),
  ...R_RING.flatMap((ring, k) => [
    H(ring, 'ring-hook', 'none', 0.78, k === 0 ? 1 : 2, `RING ${['ONE', 'TWO', 'THREE'][k]}: the desk line (the rose colon pulses)`),
    H(R_PICKUP[k], 'pickup', 'none', 0.78, 2, `ring ${k + 1}: picked up`),
    H(R_SLIP[k], 'land', 'none', 0.72, 2, `slip ${k + 1} tears off and lands on "two."`),
  ]),
  ...(ROLLS.length
    ? [
        H(ROLLS[0], 'ping', 'rush', 0.8, 3, 'the rest of the day: a chirp per roll', { run: { n: ROLLS.length, step: BEAT / 2 } }),
        H(ROLLS[0], 'flick', 'none', 0.8, 3, 'the clock rolls on 8ths', { run: { n: ROLLS.length, step: BEAT / 2 } }),
        H(ROLLS[0] + BEAT / 4, 'land', 'none', 0.72, 3, 'a slip per roll', { run: { n: ROLLS.length, step: BEAT / 2 } }),
      ]
    : []),
  H(HARD_STOP, 'thump', 'none', 0.5, 2, 'THE HARD STOP: everything cut on the sample'),
  /* ── b07 ── */
  H(SCENES.turn.from, 'draw', 'none', 0.5, 3, 'the seam draws'),
  H(SCENES.turn.from + TURN_LOCAL.ava, 'pop', 'sunday', 0.25, 2, 'Ava’s orb is born from the line light'),
  /* ── b08 ── */
  ...WRITTEN_LOCAL.rows.map((r, i) => H(SCENES.written.from + r, 'tap', 'none', 0.62, 3, `row ${i + 1} lands`)),
  ...WRITTEN_LOCAL.ready.map((r, i) => H(SCENES.written.from + r, 'ding-s', 'sunday', 0.7, 3, `Ready ${i + 1}`, { semi: [-7, -5, -3, 0][i] })),
  /* ── b09–b11 ── */
  H(CALL_FROM, 'ring-hook', 'none', 0.62, 2, 'THE LIVE CALL rings', { db: -2 }),
  H(CALL_PICKUP, 'pickup', 'none', 0.62, 2, 'the orb wakes to listen (picked up)'),
  H(FREEZE, 'freeze', 'none', 0.5, 3, 'the call freezes: between question and answer'),
  ...CALL_LOCAL.links.map((f, i) => H(CALL_FROM + f, 'ping', 'sunday', 0.7, 3, `meaning link ${i + 1}`, { semi: [-7, -3, 0, -5][i] })),
  H(RESUME, 'whoosh-soft', 'none', 0.5, 3, 'time resumes'),
  H(RECORD, 'click', 'none', 0.5, 3, 'the record row lands'),
  H(RECORD + 2, 'confirm', 'none', 0.55, 3, 'the check is drawn', { db: -3 }),
  /* ── b12 ── */
  H(CARET, 'click', 'none', 0.5, 3, 'the caret clicks in', { db: -4 }),
  H(SAVE, 'tick', 'sunday', 0.62, 3, 'the save tick'),
  /* ── b13–b14 ── */
  H(SCENES.change.from + CHANGE_LOCAL.menu, 'click', 'none', 0.66, 3, 'the menu opens'),
  H(READY5, 'ding-s', 'sunday', 0.6, 3, 'Ready: the fifth mallet completes the phrase', { semi: 5 }),
  // (film 1's ring burst cannot be cut by the pickup like the script's trill: it steps back under Dana's "Quick")
  H(RING_B14, 'ring-hook', 'none', 0.62, 2, 'the next call rings', { db: -4 }),
  H(PICKUP_B14, 'pickup', 'none', 0.62, 2, 'picked up'),
  /* ── b15–b16 ── */
  H(DESK_RING, 'ring-hook', 'none', 0.7, 3, 'the desk line rings once, far under the staff line (Ava takes it)', { db: -6 }),
  H(DESK_RING + BEAT / 2, 'glint', 'sunday', 0.7, 3, 'AVA · ON A CALL', { db: -4 }),
  /* ── CLOSE ── */
  ...LIGHTS4.map((f, i) => H(f, chime(CTA_LOCAL.lightOrder[i]), CTA_LOCAL.lightOrder[i], [0.2, 0.8, 0.3, 0.7][i], 2, `${CTA_LOCAL.lightOrder[i].toUpperCase()} light arrives`)),
  H(IMPACT, 'riser', 'none', 0.5, 1, 'CONVERGE → peak ON the impact', { db: -2 }),
  H(CONVERGE, 'swish', 'none', 0.5, 2, 'the converge: the heading leaves through its masks'),
  H(IMPACT, 'chord-rev', 'none', 0.5, 2, 'the four lights fuse', { layer: true }),
  H(IMPACT, 'impact', 'night', 0.5, 1, 'LOGO IMPACT'),
  H(IMPACT, 'chord', 'night', 0.5, 1, 'THE FOUR LIGHTS ring together'),
  H(IMPACT, 'thump', 'none', 0.5, 1, 'the impact\u2019s weight', { layer: true }),
  H(IMPACT, 'slam', 'none', 0.5, 2, 'the impact\u2019s crack', { layer: true }),
  H(IMPACT + 2, 'shock', 'none', 0.5, 2, 'the merged light opens out round the wordmark', { layer: true }),
  H(BUTTON, 'pop', 'night', 0.5, 3, '“Start free” rises', { db: -2 }),
  H(NOTE, 'tap', 'none', 0.5, 3, '“5 free minutes, no card”', { db: -4 }),
  H(PRESS, 'click', 'night', 0.5, 1, 'the button is pressed'),
  H(PRESS + 3, 'tap', 'night', 0.5, 3, 'the plate springs back', { db: -5 }),
];

export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/**
 * The moments the music bed reads (scripts/kb/bed.mjs; absolute frames, part of its cache key):
 * a placeholder score on the 120 BPM grid in E major that follows the acts.
 */
export const MUSIC = {
  ringOne: RING_ONE,
  rolls: ROLL0,
  hardStop: HARD_STOP,
  brilliant: SCENES.recording.from + RECORDING_LOCAL.brilliant,
  waiting: WAITING,
  turn: SCENES.turn.from,
  /** "Some work matters.": the Part I loop stops and the harmony opens */
  matters: SCENES.turn.from + TURN_LOCAL.matters,
  written: SCENES.written.from,
  call: SCENES.call.from,
  freeze: FREEZE,
  resume: RESUME,
  line: SCENES.line.from,
  vo6: VO6_AT,
  change: SCENES.change.from,
  ready5: READY5,
  ring14: RING_B14,
  desk: SCENES.matters.from,
  breath: [DESK2_END, VO8_AT] as const,
  vo8: VO8_AT,
  cta: SCENES.cta.from,
  lights: LIGHT0,
  converge: CONVERGE,
  impact: IMPACT,
  brand: BRAND_AT,
  button: BUTTON,
  end: END,
};

/** The music bed (scripts/kb/bed.mjs → public/kb/sfx/bed.wav, −20 dBFS peak, ducked in the mix). */
export const BED = {
  file: 'kb/sfx/bed.wav',
  vol: 2,
  /** the fader rides (absolute frame, dB; smoothstep between points): the arc peaks at the end */
  ride: [
    [0, 0],
    [CTA_FROM - 8, 0],
    [CTA_FROM + 8, 0.5],
    [CONVERGE, 3.5],
    [IMPACT - 4, 6],
    // the hit's 400 ms carry the bed's E at full; it steps back for the name, and comes up for the end card
    [IMPACT + 9, 6],
    [BRAND_AT - 1, -5],
    [BRAND_AT + vFrames(BRAND) - 8, -5],
    [PRESS, 1.5],
    [END - b(2), 1.5],
    [END, -2],
  ] as readonly (readonly [number, number])[],
};

/** frames from the logo impact to Ava saying the name (the impact insert is out before it) */
const NAME_GAP = BRAND_AT - IMPACT;
/**
 * The master: film 1's loudness numbers (one campaign, one loudness), film 2's file, fade, impact,
 * name and arc. `arc.windows`: the music-forward passages the converge into the logo must top
 * (check-mix): b05's rolls into the hard stop, and the darkening into the close.
 */
export const MIX = {
  file: 'kb/sfx/mix.wav',
  lufs: MIX1.lufs,
  ceiling: MIX1.ceiling,
  fadeOut: [END - b(2), END] as const,
  fadeK: MIX1.fadeK,
  impact: { ...MIX1.impact, at: IMPACT, hold: [0, Math.max(3, NAME_GAP - 2)] as const, release: Math.max(6, NAME_GAP + 1) },
  name: { ...MIX1.name, voice: BRAND },
  arc: {
    ...MIX1.arc,
    windows: [
      [Math.min(ROLL0, HARD_STOP - FPS), HARD_STOP],
      [DARK[0], DARK[1]],
    ] as readonly (readonly [number, number])[],
  },
  dialogueLufs: MIX1.dialogueLufs,
  dialogueTol: MIX1.dialogueTol,
  dialogueCeil: MIX1.dialogueCeil,
  cutRoom: MIX1.cutRoom,
  airLp: MIX1.airLp,
} as const;

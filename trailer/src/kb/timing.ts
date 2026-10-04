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
  type Group,
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
  type SfxDef,
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
 * tick after the last word; vo-6 seven beats in on the script's plan (58.0) — PLUS ONE BAR (LINE_BAR): CLIENT DIRECTION
 * v2's full order (the Conversation tab clicked, the field clicked, the 22 words, Save, then vo-6) needs vo-6 ≥ 157.5 f
 * into the act (LINE_LOCAL.full); the orchestrator's decision (2026-10-04) gives b12 exactly one more bar, so vo-6 sits
 * 165 f in and every later anchor moves by that bar (anchorAt keeps each in its place in the bar). */
const OWNER_LINE = "I don't have an answer for that, and I don't want to guess. I'll ask the team to call you back today.";
const OWNER_WORDS = OWNER_LINE.split(' ').length; // 22
const LINE_FROM = CALL_TO;
const LINE_BAR = BAR;
const CARET = LINE_FROM + b(1);
const SAVE = CARET + OWNER_WORDS * (BEAT / 4);
const VO6_AT = Math.max(LINE_FROM + b(7) + LINE_BAR, upHalf(SAVE + 2));
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
  /** b04's dead line: the third caller's waveform re-opens alone, flat (her silence after the wrong answer), and
   *  draws back in on the first roll. Each caller's ● CALLER and line otherwise leave WITH the caption, on the desk's
   *  first word (scenes/repeat/CallerTurn.tsx) */
  dead: [DEAD_FROM, ROLL0] as const,
  /** b05: the clock rolls on 8ths (each a rose pulse and a new slip) */
  rolls: ROLLS as readonly number[],
  /** 18.0 (bar): everything stops on the sample */
  hardStop: HARD_STOP,
  /* ── the picture's own moments (scenes/repeat/desk.ts, Clock.tsx) ── */
  /** the clock's figures start rolling this long before the ring / roll they land on (the hour strips first) */
  flickLead: { ring: 6.5, roll: 4.2 } as const,
  /** answers 2 and 3: a fresh slip is slid up from the desk's front edge over `placeDur`, arriving a frame
   *  before the desk's first word (`placeLead` before it); the first answer is the pad's own top sheet */
  placeDur: 13,
  placeLead: 14,
  /** b05: each roll's slip is slipped in behind the pile and rises one strip, reaching it a 16th after its roll */
  rollSlips: ROLLS.map((f) => f + BEAT / 4) as readonly number[],
};

/** b06 (recording-local). The picture: src/kb/scenes/Recording.tsx (+ scenes/recording/*). */
export const RECORDING_LOCAL = (() => {
  const S16 = BEAT / 4;
  const w1 = (k: number) => L('recording', VO1_AT + vWord('kb2-vo-1', k));
  const w2 = (k: number) => L('recording', VO2_AT + vWord('kb2-vo-2', k));
  /** the day's slips on the pile at the stop: the three answers + one per roll of b05 */
  const slips = R_SLIP.length + ROLLS.length;
  const deal0 = 8 * S16; // the first row drops on the second beat
  const pullBack = w2(0);
  return {
    vo1: L('recording', VO1_AT),
    /** the stop holds a 16th; then the camera glides up and right onto the slip stack, 3½ beats (EASE.inOut) */
    glide: [S16, S16 + 3.5 * BEAT] as const,
    /** the pile is picked up — squared, lifted off the desk — and carried with the camera, 2½ beats */
    slide: [S16, S16 + 2.5 * BEAT] as const,
    /** on its way the written pad sheets fold to one line each: strips of the same line (the label lifts out,
     *  "nine till two." glides up beside "Yes, Saturdays,", the paper closes round it) */
    morph: 3 * S16,
    /** … and the strips deal down into one column: row r (0 = the top strip, which stays) drops on its 16th —
     *  the paper riffle; the pad's own blank sheets go to the bottom with the last */
    slips,
    fan: Array.from({ length: slips }, (_, r) => (r === 0 ? S16 : deal0 + (r - 1) * S16)) as readonly number[],
    /** the column's paper fades come in once the desk has left the frame */
    fades: [11 * S16, 15 * S16] as const,
    /** the desk leaves AHEAD of the glide, never cropped by the frame edge: the clock lifts and dims out (gone
     *  before the dip carries it to the top edge / the travel to the side), the in-person card steps back into
     *  the room and dims (gone before it reaches the edge); both are back, as they were, when the camera returns */
    clockOut: [5, 13] as const,
    cardOut: [8, 18] as const,
    /** "You hired someone brilliant." rises on "You"; leaves on "The" as "The phone turned them / into a recording." rises */
    title1: w1(0),
    brilliant: w1(3),
    title2: w1(4),
    /** its second line ("into a recording.") rises on "into" */
    title2b: w1(8),
    /** "a recording." eases into rush ink (on "a"), the glint running word by word */
    recordingKey: w1(9),
    /** the title leaves up through its masks a beat before the camera leaves the column */
    title2Out: pullBack - b(1),
    vo2: L('recording', VO2_AT),
    /** "And the customer…": the camera pulls back and left to the in-person card (2 beats), the column sliding off */
    pullBack,
    pullBackTo: pullBack + b(2),
    /** the card comes forward .90 → 1 (SPRING.site) as the camera finds it */
    cardForward: pullBack + b(1),
    /** "And the customer / in front of them?" rises beside it, a line per phrase: on "customer" (the card has passed) and on "in" */
    question: [w2(2), w2(3)] as const,
    /** "Waiting." is spoken ON the bar (the B5 is the bed's, MUSIC.waiting) */
    waiting: L('recording', WAITING),
    /** … and the display word rises ON it, like every word of the act (SPRING.display: the first sliver shows on
     *  the bar, it reads with the vowel, locks ≈ .25 s on) — locking on the bar would read it before it is heard */
    waitingRise: L('recording', WAITING) - 1,
  };
})();

/** b07 (turn-local; 0 = the act's first frame, on beat 3 of its bar). The picture: src/kb/scenes/Turn.tsx
 *  (+ scenes/turn/*: stage.ts has the layout and every pose as a pure function of these moments). */
export const TURN_LOCAL = (() => {
  const S16 = BEAT / 4;
  /** vo-3's spoken word k, act-local */
  const w = (k: number) => L('turn', VO3_AT + vWord('kb2-vo-3', k));
  const ava = L('turn', up16(VO3_AT + vWord('kb2-vo-3', 7)));
  const firstKind = w(17);
  const kind = w(19);
  const end = SCENES.turn.to - SCENES.turn.from;
  return {
    /** the seam draws over one beat from the act's first frame (EASE.draw; 25.0 on the plan) */
    seam: [0, b(1)] as const,
    /** … and the desk sorts itself on it: b06's narration leaves up through its masks, the in-person card
     *  glides into its half (9:16: out, under the seam), the clock rides to the top of the left half (9:16:
     *  its figures roll away and leave the line light alone) */
    sort: 0,
    vo3: L('turn', VO3_AT),
    /** "Some work repeats." — each word on its onset, "repeats." rising in its flip window */
    left: [w(0), w(1), w(2)] as const,
    repeats: w(2),
    /** "Some work matters." — each word on its onset; on its first the Part I loop stops (MUSIC.matters) */
    right: [w(3), w(4), w(5)] as const,
    matters: w(3),
    /** 16:9: the day's column flows up into the left half under its title, on the beat after "repeats." */
    column: upBeat(VO3_AT + vWord('kb2-vo-3', 2) + S16) - SCENES.turn.from,
    /** the line light lifts off the clock three 16ths before "Ava" … */
    lift: ava - 3 * S16,
    /** … and springs open into Ava's orb ON "Ava" (snapped to the 16th): SPRING.pop 0 → 1.06 → 1 */
    ava,
    /** as it opens its palette crossfades rush → sunday (6 frames): the same light, now hers */
    relight: [ava, ava + 6] as const,
    /** her side's ground hands off MUTED → KB_MESH, spreading from the orb over two beats */
    ground: [ava, ava + b(2)] as const,
    /** the narrator's captions (no tag): from "I'm" and from "and"; the key phrase on "the first kind" */
    captions: [
      { text: "I'm Ava, an AI that answers your phone,", word: 6 },
      { text: "and I'll take the first kind.", word: 14 },
    ] as readonly Caption[],
    /** "the first kind": the flip window has stopped for good; the repeat side eases toward her light (the
     *  left title leaves up through its masks, 16:9: the column glides up into its place and comes to rest) */
    firstKind,
    /** "kind.": the matters side yields (its title leaves, the card glides out to the right) */
    kind,
    yieldAt: up16(VO3_AT + vWord('kb2-vo-3', 19)) - SCENES.turn.from,
    /** 16:9: the emptied clock rides up and out (it returns in b15 with her teal colon) */
    clockOut: up16(VO3_AT + vWord('kb2-vo-3', 19)) - SCENES.turn.from + 2 * S16,
    /** the captions hold to here (a beat after "kind." at least), then leave before the cut */
    holdUntil: Math.min(end - 6, Math.max(kind + b(1), L('turn', VO3_AT + vFrames('kb2-vo-3')))),
    end,
  };
})();
/** the flip window turns over on every beat (only ever to the same word): the flap LANDS on each beat, from
 *  the first beat a beat after "repeats." has risen, until "the first kind" (the flap tick on each) */
export const TURN_FLIPS: readonly number[] = (() => {
  const out: number[] = [];
  for (let f = Math.ceil((TURN_LOCAL.repeats + BEAT) / BEAT) * BEAT; f < TURN_LOCAL.firstKind - 1e-9; f += BEAT) out.push(f);
  return out;
})();

/** b08 (written-local; 0 = the act's first frame, beat 2 of its bar — every multiple of a 16th is on the grid).
 *  The picture: src/kb/scenes/Written.tsx (+ scenes/written/*: stage.ts has the layout and every pose as a pure
 *  function of these moments). CLIENT DIRECTION v2: the app's real tab bar, clicked by a real cursor. */
export const WRITTEN_LOCAL = (() => {
  const S16 = BEAT / 4;
  const S32 = BEAT / 8;
  /** vo-4's spoken word k (absolute) */
  const at = (k: number) => VO4_AT + vWord('kb2-vo-4', k);
  const near16 = (f: number) => Math.round(f / S16) * S16;
  /** a row lands on the 16th after its noun */
  const row = (k: number) => L('written', up16(at(k)) + S16);
  const end = SCENES.written.to - SCENES.written.from;
  const once = L('written', up16(at(4)));
  /** the Knowledge tab: down on the 8th after "answers", up a 16th later (a two-part click); the underline
   *  slides and the panel's content swaps on the release */
  const tabDown = Math.max(8 * S16, L('written', up8(at(3) + S16)));
  const price = row(6);
  const hours = row(8);
  const policies = row(10);
  /** the URL field: clicked a 16th pair before the policies row, typed one character per 32nd */
  const URL_TEXT = 'https://your-site/faq';
  const field = { down: policies - 2 * S16, up: policies - S16 };
  const keys = Array.from({ length: URL_TEXT.length }, (_, i) => field.up + 3 * S32 + i * S32);
  const lastKey = keys[keys.length - 1];
  /** Add page: the pointer comes back off the keys (a short hop, ≥ 8 f, arriving 6 f before the press) */
  const addDown = up16(lastKey + S32 + 8 + 6);
  const add = { down: addDown, up: addDown + S16 };
  const faq = add.up + S16;
  const rows = [price, hours, policies, faq] as const; // prices · hours · policies · (pages from your) website
  return {
    vo4: L('written', VO4_AT),
    end,
    /** the cut from b07: the seam draws back up (EASE.draw, a beat); her ground floods the other half (two beats) */
    seam: [0, BEAT] as const,
    ground: [0, 2 * BEAT] as const,
    /** the app panel comes in (16:9 from the right, where the matters side left; 9:16 up from under the seam) */
    panel: [0, 22] as const,
    /** the orb glides from b07's place to b08's; 16:9: the day's column glides into the corner under it */
    glide: [0, 28] as const,
    tab: { down: tabDown, up: tabDown + S16 } as const,
    /** "once": the slips stack up into one — strip m (1 … 7) slides up under the one above on its 16th */
    once,
    collapse: Array.from({ length: 7 }, (_, m) => once + m * S16) as readonly number[],
    /** the pile has settled: the last slip draws its edges into a document row (TXT · Opening hours, Reading…) */
    born: once + 10 * S16,
    /** the rows, in the order they land (the list is newest-first, as useKnowledge's upsert: each new row lands
     *  on top and the others slide down): Price list on "prices", Opening hours slots in on "hours" (its flight
     *  from the corner starts five 16ths before), Cancellation policy on "policies", the FAQ page a 16th after
     *  Add page — the Knowledge tab's badge counts 1 → 4 on them */
    rows,
    fly: [hours - 5 * S16, hours] as const,
    /** each pill rolls Reading… → Ready a beat after its row lands (the Ready mallets E4 F#4 G#4 B4) */
    ready: rows.map((r) => r + BEAT) as readonly number[],
    url: URL_TEXT,
    field,
    keys: keys as readonly number[],
    add,
    /** "knowledge" (the nearest 16th): the eyebrow ● KNOWLEDGE BASE rises above the panel */
    knowledge: L('written', near16(at(17))),
    /** the narrator's captions (no tag); the key phrase "knowledge base." from "knowledge" */
    captions: [
      { text: 'Give me your answers once.', word: 0 },
      { text: 'Your prices, your hours, your policies,', word: 5 },
      { text: 'pages from your website.', word: 11 },
      { text: "That's your knowledge base.", word: 15 },
    ] as readonly Caption[],
    /** the last caption holds a beat past her line, then leaves before the cut */
    holdUntil: Math.min(end - 7, L('written', VO4_AT + vFrames('kb2-vo-4')) + BEAT),
  };
})();

/** b09–b11 (call-local; 0 = the live ring on its bar). The picture: src/kb/scenes/Call.tsx (+ scenes/call/*:
 *  stage.ts has the layout and every pose as a pure function of these moments). */
export const CALL_LOCAL = (() => {
  const S16 = BEAT / 4;
  const S8 = BEAT / 2;
  const end = SCENES.call.to - SCENES.call.from;
  const pickup = BEAT / 2;
  const c4 = L('call', C4_AT);
  const call1 = L('call', CALL1_AT);
  const freeze = L('call', FREEZE);
  const vo5 = L('call', VO5_AT);
  const resume = L('call', RESUME);
  const call2 = L('call', CALL2_AT);
  const record = L('call', RECORD);
  /** a line's spoken word onsets, act-local */
  const words = (id: VoiceId, at: number) => VOICE.lines[id].words.map((_, k) => at + vWord(id, k));
  const call2Words = words('kb2-call-2', call2);
  /** "even when they put it differently": the hero link's pen goes down a 16th before the 8th of "even" and lands
   *  ON the next 8th; each earlier phrasing rises as the link before it lands and its own hairline lands an 8th later
   *  — the four plucks (E G# B F#) on four 8ths */
  const even = L('call', up8(VO5_AT + vWord('kb2-vo-5', 10)));
  const links = [0, 1, 2, 3].map((i) => even + S8 + i * S8);
  const linkStart = [even - S16, links[0] + 2, links[1] + 2, links[2] + 2];
  return {
    end,
    /** 40.0 on the plan (bar): the ring — one slate hairline leaves the orb; the panel steps back and slides away
     *  right (16:9) / down (9:16); the eyebrow leaves; the orb comes forward to her call place */
    ring: 0,
    recede: [0, 30] as const,
    glide: [0, 30] as const,
    /** 40.25: picked up on the first ring — the orb wakes to listen; ● CALLER and the timer rise a beat's 16th later,
     *  once the panel has cleared the strip's place */
    pickup,
    strip: pickup + 2,
    /** the call timer (mono), on CALL time (frozen through the stop-time): seconds = base + floor((callTime − zero) / 30)
     *  — it ticks to 00:04 as the caller speaks (the greeting has been said), reads 00:07 at the freeze (its roll done
     *  just before it) and 00:11 as the strip folds into the record */
    timer: { base: 4, zero: 31.5 } as const,
    c4,
    c4Words: words('kb2-c4', c4) as readonly number[],
    /** Ava's filler: her turn (● AVA) rises under the caller's; the transcript scrolls up to make room */
    call1,
    call1Words: words('kb2-call-1', call1) as readonly number[],
    scroll: [call1 - 8, call1 + 10] as const,
    /** 44.5 on the plan: the call freezes (timer, waveform, the mesh's own clock); BETWEEN QUESTION AND ANSWER
     *  rises; the filler leaves; the orb shrinks into the label's dot */
    freeze,
    dock: [freeze, freeze + 24] as const,
    /** the camera glides to the knowledge (≈ 1.2 s, EASE.inOut): the frozen question to the left column */
    pan: [freeze, freeze + 30] as const,
    /** "…let me CHECK.": she fetches it — the Opening hours row comes back (16:9 in from the right, where the panel
     *  went; 9:16 lifted out of the receded panel, which then sinks away) and waits; after the freeze it unfolds into
     *  the full page (its lines rise on 16ths) */
    rowIn: [call1 + vWord('kb2-call-1', 4) - 1, call1 + vWord('kb2-call-1', 4) + 23] as const,
    unfold: [freeze + 10, freeze + 32] as const,
    vo5,
    vo5Words: words('kb2-vo-5', vo5) as readonly number[],
    /** "the part that answers them": the sweep under Saturday (Sunday a 16th behind); the weekday line settles to 40 % */
    sweep: L('call', VO5_AT + vWord('kb2-vo-5', 5)),
    /** "around this weekend": the slate underline, as the hero link's pen goes down */
    underline: even - S16,
    links: links as readonly number[],
    linkStart: linkStart as readonly number[],
    /** the day's three earlier phrasings rise as the link before them lands (9:16: one at a time in one slot,
     *  each leaving up on the next 8th; the last stays) */
    questions: links.slice(0, 3) as readonly number[],
    /** 50.0 on the plan (bar): time resumes — the label, the phrasings and their links leave; the orb comes out of
     *  the dot; the page dims to 25 % behind and the two swept lines lift out as their own small layer */
    resume,
    undock: [resume + 6, resume + 30] as const,
    lift: [resume + 2, resume + 16] as const,
    /** the caller's question leaves up as she answers; her turn (● AVA) holds the answer */
    call2,
    call2Words: call2Words as readonly number[],
    /** the word re-set: kept words glide on her onsets (Saturday · Sunday+s · closed+.), the tokens she doesn't say
     *  leave just before "Saturday" moves; "nine till two" keys sunday on "nine" */
    reset: call2Words.map((at, k) => ({ at, from: k === 2 ? ([0, 0] as const) : k === 7 ? ([1, 0] as const) : k === 9 ? ([1, 2] as const) : undefined })),
    resetLeave: call2Words[2] - 6,
    key: call2Words[4],
    /** one very quiet tick per landing word, on its 16th */
    resetTicks: call2Words.map((f) => up16(f + SCENES.call.from) - SCENES.call.from) as readonly number[],
    /** the call strip folds into the white record row on the 8th after her answer; the check is drawn an 8th on */
    record,
    check: record + S8,
  };
})();

/** b12 (line-local; 0 = the act's first frame, on a bar line). The picture: src/kb/scenes/Line.tsx (+ scenes/line/*:
 *  stage.ts has the layout and every pose as a pure function of these moments). CLIENT DIRECTION v2: the agent page's
 *  real tab bar and its Conversation tab — the field, the amber unsaved dot, Save changes — worked by a real cursor
 *  with two-part clicks; then she narrates (SCRIPT.md b12, J2: one text moves at a time, nothing narrated while it types).
 *
 *  THE TWO ORDERS. v2's full order — click Conversation, cross to the field and click it, type the 22 words on 16ths,
 *  click Save, a breath, THEN vo-6 — needs vo-6 at least `full` frames in (157.5: a calm hand takes ≈ 16 f to cross from
 *  the tab to the field plus the 6 f read before a press, and ≈ 12 f + 6 back off the keys to Save). The script's own plan
 *  (the caret a beat in, vo-6 105 f in) leaves no room; the voiced timeline gives b12 ONE MORE BAR (LINE_BAR above, the
 *  orchestrator's decision of 2026-10-04): vo-6 165 f in, so —
 *    · room (vo6 ≥ 157.5: THIS cut)   the page comes back on Knowledge; tab on beat 2 → field → the words → Save → vo-6
 *      (the spare frames carry the slow push-in while it types: scenes/line/stage.ts PUSH)
 *    · no room (LINE_BAR = 0)   the page comes back already on Conversation (the tab click does not fit: it would have
 *      to land before the act starts); the I-beam rides in on the page and clicks on the script's caret, the words land on
 *      the script's 16ths, the pointer comes back off the keys as the last words land and Save is released on vo-6's
 *      first frame (her first word is ≥ 3 f later): the dot goes, then she speaks. */
export const LINE_LOCAL = (() => {
  const S16 = BEAT / 4;
  const end = SCENES.line.to - SCENES.line.from;
  const vo6 = L('line', VO6_AT);
  const w6 = (k: number) => vo6 + vWord('kb2-vo-6', k);
  const N = OWNER_WORDS;
  const run = (N - 1) * S16;
  // the full order, on the grid: tab on beat 2; the field six 16ths after its release; Save six 16ths after the last word
  const tabF = { down: b(1), up: b(1) + S16 };
  const fieldF = { down: tabF.up + 6 * S16, up: tabF.up + 7 * S16 };
  const saveF = { down: fieldF.up + run + 6 * S16, up: fieldF.up + run + 7 * S16 };
  const needs = saveF.up + 2 * S16;
  const full = vo6 >= needs;
  const caret = full ? fieldF.up : L('line', CARET);
  const field = full ? fieldF : { down: caret - S16, up: caret };
  const keys = Array.from({ length: N }, (_, k) => field.up + k * S16);
  const last = keys[N - 1];
  // no room: Save as late as her line allows — released on vo-6's first frame
  const save = full ? saveF : { down: vo6 - S16, up: vo6 };
  // the pointer back off the keys to Save: arriving CURSOR.pressLead (6) before the press — a calm crossing when there is
  // room; with none, a decisive 9-frame hop that starts as "back" types and lands as "today." does
  const hop = full ? ([last + 2, save.down - 6] as const) : ([save.down - 6 - 9, save.down - 6] as const);
  return {
    ownerLine: OWNER_LINE,
    end,
    /** room for v2's full order (see above) — true with b12's extra bar */
    full,
    needs,
    /** the cut from b11: the call's record row and its page leave up (0 → 6); the agent page rises in from 2 (settled
     *  by the caret's press), the pointer riding on it; Ava's orb glides to her corner and dims to rest (the owner's
     *  moment, not hers) */
    leave: [0, 6] as const,
    enter: [2, 12] as const,
    orb: [0, 26] as const,
    /** the Conversation tab: down / up (the underline slides and the content swaps on the release) — null: no room */
    tab: full ? tabF : null,
    /** the I-beam presses into "When the answer isn't in your documents" (focus + the caret on the down, the script's
     *  "caret clicks in" on the up) */
    field,
    caret,
    /** one word per 16th from the field's release (22): each rises into its mask; the amber unsaved dot opens on the
     *  first, and Discard / Save changes wake (disabled → enabled) */
    keys: keys as readonly number[],
    /** the pointer leaves the keys for Save changes [start, arrive] */
    hop,
    /** Save changes: down (the save tick) / up — the dot closes, the buttons go back to disabled, the field blurs */
    saveClick: save,
    save: save.down,
    /** the pointer, its work done, fades where it stands */
    pointerOut: save.up + 6,
    vo6,
    /** her first word: the orb relights */
    relight: w6(0),
    /** the narrator's captions (no tag); the key phrase "in the words you chose." keys sunday from "in". 9:16 sets her
     *  first sentence as its two phrases (one line each on the phone's measure) */
    captions: [
      { text: 'If it isn\u2019t written down, I say so,', word: 0 },
      { text: 'in the words you chose.', word: 8 },
    ] as readonly Caption[],
    captionsV: [
      { text: 'If it isn\u2019t written down,', word: 0 },
      { text: 'I say so,', word: 5 },
      { text: 'in the words you chose.', word: 8 },
    ] as readonly Caption[],
    key: w6(8),
    /** "in the words you chose": the sunday focus ring settles round the field on "words" (the glassy tick) */
    focus: w6(10),
    /** the last caption holds a beat past her line (never into the cut's last 7 frames) */
    holdUntil: Math.min(end - 7, vo6 + vFrames('kb2-vo-6') + BEAT),
  };
})();

/** b13–b14 (change-local; 0 = the act's first frame, on a beat — every multiple of a 16th is on the grid). The picture:
 *  src/kb/scenes/Change.tsx (+ scenes/change/*: stage.ts has the layout and every pose as a pure function of these
 *  moments). CLIENT DIRECTION v2: the owner's own file edited by a real cursor (an I-beam drag over "14:00", "16:00"
 *  typed a key per 16th), then back in the app on Knowledge — the row's … menu clicked open, "Replace with new file"
 *  clicked — every click two-part (down / up, a sound on each).
 *
 *  THE CURSOR'S CLOCK. The pointer comes back from where b12 left it (on Save changes) and must be on "14:00" for the
 *  drag on "change?"; its last key lands on "Change"; the … press is six 16ths later (a calm crossing to the row) and
 *  "Replace with new file" four 16ths after the menu opens, so the new version lands in the list a beat and a quarter
 *  before the fifth Ready — its Reading… pill reads under "The next call gets…". */
export const CHANGE_LOCAL = (() => {
  const S16 = BEAT / 4;
  const from = SCENES.change.from;
  const end = SCENES.change.to - from;
  /** an act-local frame snapped up to the film's 16th grid */
  const on16 = (f: number) => up16(from + f) - from;
  /** a line's spoken word onsets, act-local */
  const words = (id: VoiceId, at: number) => VOICE.lines[id].words.map((_, k) => L('change', at + vWord(id, k)));
  const vo7 = L('change', VO7_AT);
  const vo7Words = words('kb2-vo-7', VO7_AT); // Hours change? · Change the document. · The next call gets the new answer.
  const ready5 = L('change', READY5);
  const ring = L('change', RING_B14);
  const pickup = L('change', PICKUP_B14);
  const c2 = L('change', C2B_AT);
  const c2Words = words('kb2-c2', C2B_AT);
  const call3 = L('change', CALL3_AT);
  const call3Words = words('kb2-call-3', CALL3_AT);
  const four = L('change', FOUR);
  const lcut = L('change', LCUT);
  /* b13 · the owner's file: the I-beam presses on "14:00" on "change?", drags across it (selected, the sunday wash) and
     releases a 16th later; "16:00" is typed over it, one key per 16th — the last key on "Change" */
  const drag = { down: on16(vo7Words[1]), up: on16(vo7Words[1]) + S16 };
  const keys = Array.from({ length: 5 }, (_, i) => drag.up + (i + 1) * S16);
  const lastKey = keys[keys.length - 1];
  /* b13 · back in the app: the cursor presses the old row's …, the menu opens on the release; "Replace with new file" */
  const menu = { down: lastKey + 6 * S16, up: lastKey + 7 * S16 };
  const replace = { down: menu.up + 4 * S16, up: menu.up + 5 * S16 };
  /** the edited file drops into the list as the new version (newest on top), landing on the 16th */
  const land = replace.up + 3 * S16;
  /** b14 · the app steps back seven 16ths before the ring; the new row lifts out of it and unfolds into its page — its lines
   *  are in before Dana's turn rises (one thing moves at a time) */
  const recede = [ring - 7 * S16, ring + 3] as const;
  return {
    end,
    vo7,
    vo7Words: vo7Words as readonly number[],
    /** the cut from b12: its agent page sinks back (0 → 12); the owner's file comes forward over it (2 → 16) */
    handoff: [0, 12] as const,
    page: [2, 16] as const,
    /** "Hours change?": the caret clicks into 14:00 — the I-beam presses there and drags across it (two-part click) */
    caret: drag.down,
    drag,
    /** "16:00", one keystroke per 16th (the selection is replaced on the first) */
    keys: keys as readonly number[],
    /** "Change the document": the agent page rises on its Knowledge tab (its badge at 4); the file steps up into the
     *  corner once its last key is in */
    app: [vo7Words[2], vo7Words[2] + 14] as const,
    park: [lastKey + 2, lastKey + 18] as const,
    /** the old row's … pressed / released (the menu opens from its trigger on the release) */
    menu,
    /** "Replace with new file" pressed (.97) / released: the menu closes, the file flies into the list's top slot */
    replace,
    fly: [replace.up, land] as const,
    /** the new row (TXT · Opening hours, Reading…) has landed on top; the badge ticks 4 → 5 (the old one still counts) */
    land,
    /** the pointer, its work done, fades where it stands */
    pointerOut: replace.up + 4,
    /** the fifth Ready mallet (E5) completes b08's phrase ON the beat with "the new answer": the new row rolls to Ready;
     *  the old row leaves up through its mask; the badge back to 4 */
    ready5,
    oldOut: ready5,
    badgeBack: ready5 + 6,
    /** the narrator's captions (no tag); the key phrase "the new answer." keys sunday from "new" */
    captions: [
      { text: 'Hours change?', word: 0 },
      { text: 'Change the document.', word: 2 },
      { text: 'The next call gets the new answer.', word: 5 },
    ] as readonly Caption[],
    key: vo7Words[10],
    holdUntil: Math.min(recede[0] - 3, vo7 + vFrames('kb2-vo-7') + BEAT),
    /** b14: the app steps back a depth and slides away down (seven 16ths before the ring — the rows step back); the new row
     *  lifts out of it and unfolds into its page (Saturday · 9:00–16:00), its lines rising on 16ths */
    recede,
    lift: [recede[0], recede[0] + 8] as const,
    unfold: [recede[0] + 4, recede[0] + 24] as const,
    /** 67.0 on the plan (beat 3): the ring — one slate hairline leaves the orb; she glides to her call place */
    ring,
    orbCall: [ring, ring + 30] as const,
    /** picked up (an 8th): she listens; ● CALLER rises */
    pickup,
    callerTag: pickup + 2,
    /** Dana's IDENTICAL recording (b03's kb2-c2): her turn rises as a unit on "Quick", her line's waveform under it */
    c2,
    c2Words: c2Words as readonly number[],
    /** SAME QUESTION: the tag pops beside ● CALLER on her last word, "Saturday?" (the 16th) */
    chip: on16(c2Words[c2Words.length - 1]),
    waveClose: c2 + vFrames('kb2-c2') + 2,
    /** her answer (● AVA): "You can! / We're open Saturday / from nine till four." — "nine till four." keys sunday on "nine" */
    call3,
    call3Words: call3Words as readonly number[],
    avaTag: call3 - 2,
    nine: call3Words[6],
    /** "four.": the new line takes the ink sweep (and the bright pluck); the other two lines settle to 45 % */
    four,
    sweep: [four, four + 10] as const,
    /** 72.75 on the plan: the L-CUT under her last word — the frame crosses to b15's desk (scenes/Matters.tsx
     *  MattersDesk at its first picture) in one camera push against the reading direction (16:9 the call slides out
     *  left, 9:16 up); it lands at rest a frame before the act ends (at 120 fps too), so the cut is the same picture */
    lcut,
    cross: [lcut + 2, end - 1] as const,
  };
})();

/** b15–b16 (matters-local). */
export const MATTERS_LOCAL = (() => {
  const S16 = BEAT / 4;
  const S8 = BEAT / 2;
  const end = SCENES.matters.to - SCENES.matters.from;
  /** a line's spoken words, act-local */
  const words = (id: VoiceId, at: number) => VOICE.lines[id].words.map((_, k) => L('matters', at + vWord(id, k)));
  const ring = L('matters', DESK_RING);
  const b16 = L('matters', B16);
  const vo8Words = words('kb2-vo-8', VO8_AT);
  const doAt = vo8Words[vo8Words.length - 1];
  /** the stack lifts on the 16th of "do." (the paper slide's frame) */
  const lift = L('matters', up16(VO8_AT + vWord('kb2-vo-8', lastWord('kb2-vo-8'))));
  const dark = [L('matters', DARK[0]), L('matters', DARK[1])] as const;
  return {
    end,
    /** "nervous." rises on the act's first frame (73.0 on the plan); the hanging em dash is lifted off as it does */
    nervous: 0,
    dash: [0, 2] as const,
    desk2: L('matters', DESK2_AT),
    /** the staff reply's words (● FRONT DESK rises a beat's 16th before the first) */
    deskWords: words(DESK2, DESK2_AT) as readonly number[],
    /** the line rings once (74.5: beat 2 of its bar, ducked): the teal colon sends one hairline ring; her soft
     *  pickup tone cuts the trill after one chirp (a 16th); AVA · ON A CALL rolls in under the clock an 8th after
     *  the ring — where a second chirp would have been. The in-person card does not move. */
    ring,
    pickup: ring + S16,
    label: ring + S8,
    /** at least one full bar of room tone, nothing moving but the colon's breath */
    breath: [L('matters', DESK2_END), L('matters', VO8_AT)] as const,
    /** b16 (half a beat before vo-8): the slow push toward the card starts (eased in: nothing visible moves in
     *  the breath); 9:16: the clock's figures leave up (gone by her first word, which rises where they stood), its
     *  labels on her first word (gone before her second line), and the teal dot rises above the title */
    b16,
    push: [b16, end] as const,
    clockOut: [b16 + 1, L('matters', VO8_AT)] as const,
    labelsOut: L('matters', VO8_AT),
    dotRise: [b16 + 1, b16 + 37] as const,
    /** 9:16: the desk reframes down under the title (done before "only" rises) */
    reframe: [b16 + 1, b16 + 45] as const,
    vo8: L('matters', VO8_AT),
    /** "That's the work / only people can do." — each word rises on its spoken onset */
    vo8Words: vo8Words as readonly number[],
    /** "do.": the key phrase eases into sunday ink as the glint runs through it … */
    do: doAt,
    key: doAt,
    /** … and the old slip stack lifts from the desk's edge (on the 16th) and glides off toward the teal dot, the
     *  slips a cascade (each `stagger` behind the one above), EASE.inOut */
    stack: { lift, glide: [lift + 1, lift + 1 + 30] as const, stagger: 2.25, n: 5 },
    /** the title leaves up through its masks as the room goes dark */
    titleOut: dark[0] + 6,
    /** the paper darkens into night over three beats (80.5–82.0 on the plan), landing on the close's bar; the
     *  teal dot becomes the key light; the desk's type and the clock fade with the light */
    dark,
    fade: [dark[0] + 6, end - 3] as const,
  };
})();

/**
 * b17–b18 (cta-local). The §7 FALLBACK route: a film-2 Cta from film 1's timing-free end-card parts
 * (src/kb/scenes/Cta.tsx + scenes/cta/*). Every visible moment of the close, from the real word onsets.
 */
export const CTA_LOCAL = (() => {
  const at = (f: number) => L('cta', f);
  const vo9Words = VOICE.lines['kb2-vo-9'].words.map((_, k) => at(VO9_AT + vWord('kb2-vo-9', k)));
  const impact = at(IMPACT);
  const converge = at(CONVERGE);
  const press = at(PRESS);
  const finalHold = at(FINAL_HOLD);
  const lights = LIGHTS4.map(at);
  return {
    vo9: at(VO9_AT),
    headline: ['Your answers.', 'Written once, there for every call.'] as const,
    /** the spoken word onsets of vo-9 (8 words: the heading's 8 words, one to one) */
    words: vo9Words as readonly number[],
    /** her three phrases (word indices): "Your answers." · "Written once," · "there for every call." — a heading ROW
     *  rises as a unit on its phrase's first word (16:9 sets the last two phrases on one row, which rises on
     *  "Written"; 9:16 gives each phrase its own row) */
    phrases: [[0, 1], [2, 3], [4, 5, 6, 7]] as const,
    /** a row starts its mask rise this many frames ahead of its first spoken word (≈ 85 % up ON the word) */
    riseLead: 3,
    /** the key phrase "there for every call." takes the sunday ink WORD BY WORD on its spoken onsets (a glint
     *  of her lightest teal runs through each word as it is said, then settles to the key ink) */
    key: [4, 5, 6, 7] as const,
    /** the night comes up out of the darkening's black: the deep mesh opens to its night level (the drop into
     *  the dark lands on the bar, frame 0; her teal dot keeps keying the room) */
    night: [0, 45] as const,
    /** THE FOUR LIGHTS, sunday first (hers: it springs out of her teal dot), then rush, closing, night, one at a
     *  time on 8ths from the corners as the heading completes */
    lights: lights as readonly number[],
    lightOrder: ['sunday', 'rush', 'closing', 'night'] as const,
    /** 9:16: her light glides from the dot (top centre) to its corner as it opens */
    sundayGlide: [lights[0], lights[0] + 20] as const,
    /** the ring of four drifts toward the centre (and turns a little) until the converge */
    drift: [lights[0], converge] as const,
    /** THE CONVERGE (on the beat after her line, two beats before the impact): the heading leaves up through its
     *  masks word by word (`exit`); the ring swells (anticipation), whirls up and spirals into the core */
    converge,
    exit: { from: converge, step: 0.8, dur: 8 },
    swell: [converge, converge + 4] as const,
    orbIn: [converge + 4, impact - 9] as const,
    /** the whirl's top speed (a pass of air) */
    whirl: converge + 15,
    /** the four overlap and become one: the three pour into HER light (sunday), which takes all four hues … */
    merge: [impact - 12, impact - 6] as const,
    /** … holds alone, is squeezed (anticipation) … */
    survivor: [impact - 6, impact] as const,
    squeeze: [impact - 4, impact] as const,
    /** IMPACT on the bar: the merged light gives itself to the backlight (burst), NEUROVOICE surfaces from the
     *  centre out as the light reaches each letter; the four lights come up on the backlight's rim */
    impact,
    burst: [impact, impact + 6] as const,
    rimIn: [impact + 6, impact + 26] as const,
    brand: at(BRAND_AT),
    /** the URL rises ON her words: "neuro" | "tech" | "voice.com" (chunk start characters, and frames) */
    urlText: 'neurotechvoice.com',
    urlChunks: [0, 5, 9] as const,
    url: [0, 1, 2].map((k) => at(BRAND_AT + vWord(BRAND, k))) as readonly number[],
    /** "Start free →" rises on "…Voice." once the URL is in; the note a beat later, a word every 2.5 frames */
    button: at(BUTTON),
    note: at(NOTE),
    noteStep: 2.5,
    /** THE CLICK (CLIENT DIRECTION v2 §3): the pointer comes in from off-frame (lower right) on a calm arc,
     *  the button takes the site's hover (plum) as it enters, the pointer rests `dwell` frames, presses (.97),
     *  releases `hold` frames later — a two-part click on the cue sheet (down, up) */
    press,
    release: press + 3,
    dwell: 9,
    /** the backlight breathes under the end card, its amplitude easing to 0 into the hold */
    breath: at(BUTTON) + 10,
    breathOut: [finalHold - 10, finalHold] as const,
    /** every residual (springs, breath, glows) pinned to its exact rest over these frames */
    settle: [Math.max(press + 3, finalHold - 8), finalHold] as const,
    /** from here to the end nothing moves but grain; the picture fades with the master (MIX.fadeOut) */
    finalHold,
  };
})();

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

/**
 * The voice post (a fader on part of a line; frames from the line's own start). kb2-desk-1 is Leo's take-1, the only
 * take that keeps Part I on the script's grid (voice-candidates/kb/PICKS.md); it peaks on "Saturdays," (−1.5 dBFS at
 * −23 LUFS), so the dialogue bus limiter (MIX.dialogueCeil) clamps that word ~9 dB and master()'s trim passes leave
 * the line 0.6 LU under the dialogue target (check-mix: −20.6). Riding the word 2 dB down, ramped inside the commas
 * around it, evens the line (its direction: "even, unhurried rhythm") and lands every placement at −20.3 LUFS.
 */
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = (() => {
  const sat = VOICE.lines['kb2-desk-1'].phrases[1]; // "Saturdays,"
  /** word k of a line, line-local frames */
  const w = (id: VoiceId, k: number) => vWord(id, k);
  /* THE CLIMAX'S HEADROOM (check-mix: the logo impact tops the loudest dialogue moment by ≥ 1 LU). The loudest 400 ms of
   * dialogue are the narrator's confident openings, all voice (bed and effects 15–20 dB under): vo-5's "When someone
   * calls," over the held stop-time chord and its "even when they", vo-4's "Give me your answers", vo-3's "Some work".
   * Each is ridden down, ramped in the gaps around it. The leveller after the ride gives back about half of it, and
   * master() re-trims the line to the dialogue target (the rest of it comes up a little), so a nominal −3.5 dB is ≈ −1.5 dB
   * heard: the openings sit with their lines instead of over them, and the impact keeps a clear lead. */
  return {
    'kb2-desk-1': [{ from: Math.floor(sat.start * FPS), to: Math.ceil(sat.end * FPS), db: -2, ramp: 3 }],
    'kb2-vo-3': [{ from: 0, to: w('kb2-vo-3', 2) - 3, db: -2.5, ramp: 2 }],
    'kb2-vo-4': [{ from: 0, to: w('kb2-vo-4', 4) - 3, db: -2, ramp: 2 }],
    'kb2-vo-5': [
      { from: 0, to: w('kb2-vo-5', 3) - 8, db: -3.5, ramp: 3 },
      { from: w('kb2-vo-5', 10) - 1, to: w('kb2-vo-5', 13) - 1, db: -3.25, ramp: 2 },
    ],
  };
})();

/** Speech windows (the bed ducks under these), spoken phrases, and "is someone speaking at f?" */
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/** A film-2 extra: synthesised by scripts/kb/sounds.mjs into public/kb/sfx/<family>[-k].wav (−12 dBFS peak). */
const X = (n: number, group: Group, trim: number, send: number, o: Partial<SfxDef> = {}): SfxDef => ({ n, pk: 0, group, trim, send, dir: 'kb/sfx', ...o });
/**
 * FILM 2's EXTRAS (scripts/kb/sounds.mjs; SCRIPT.md's sound notes + the act builders' requests). Every tuned family is
 * synthesised at the note its name gives (fx-tock on E5, retuned by the cue's `semi`). The ambience and the b05 montage
 * play dry (send −80: no room return rings past the hard stop); the trills are not on the tonal bus (b15's ring is
 * ducked by its own level, as the script asks).
 */
const KB_SFX = {
  // the desk phone: ONE trill (G#4/B4, two chirps a dotted 16th apart) for every ring, cut by the pickup
  'fx-trill': X(1, 'sig', -2, -14),
  'fx-trill-15': X(1, 'sig', -2, -14),
  'fx-trill-1': X(1, 'sig', -2, -14),
  'fx-pickup': X(2, 'sig', -1, -16),
  'fx-line': X(1, 'sig', -4, -20),
  'fx-linehiss': X(1, 'sig', -4, -30),
  'fx-linehold': X(1, 'sig', -4, -30),
  // b05: the rest of the day as one file, cut on the sample at the hard stop (it starts `flickLead + 1` before roll one)
  'fx-rolls': X(1, 'sig', -2, -80, { pk: REPEAT_LOCAL.flickLead.roll + 1 }),
  // paper, pens, the desk
  'fx-slip': X(3, 'flip', 0, -18),
  'fx-slip-slide': X(3, 'air', -4, -18, { pk: 3, rank: 2 }),
  'fx-cup': X(1, 'pop', 0, -18),
  'fx-pen': X(1, 'tr', -2, -20),
  'fx-paper-square': X(1, 'flip', -2, -20),
  'fx-paper-fold': X(1, 'flip', -3, -20),
  'fx-riffle': X(4, 'flip', -2, -22),
  'fx-scroll': X(1, 'air', -6, -24),
  'fx-tuck': X(3, 'flip', -2, -20, { pk: 1 }),
  'fx-settle': X(1, 'low', 0, -20),
  'fx-paper-unfold': X(1, 'flip', -3, -20),
  'fx-paper-lift': X(2, 'air', -4, -20),
  'fx-felttip': X(2, 'air', -4, -22),
  'fx-felttip-short': X(1, 'air', -4, -22),
  'fx-scratch': X(2, 'air', -6, -24),
  'fx-pen-lift': X(1, 'air', -4, -22),
  'fx-record': X(1, 'pop', 0, -18),
  'fx-tag': X(1, 'tr', -1, -20),
  'fx-menu-open': X(1, 'pop', -2, -20),
  // the interface: a two-part click (down / up), low-profile keys, ticks, a split-flap, a paper tock
  'fx-click-down': X(2, 'tr', 0, -18, { rank: 1 }),
  'fx-click-up': X(2, 'tr', -3, -20),
  'fx-keys': X(6, 'tr', -2, -22),
  'fx-tick': X(3, 'tr', -2, -22),
  'fx-tock': X(1, 'pop', -1, -18),
  'fx-flap': X(1, 'flip', -1, -20),
  // her light: the seed and the ting (B5)
  'fx-seed': X(1, 'spark', -4, -14, { delay: -20 }),
  'fx-ting': X(1, 'spark', -4, -12, { delay: -20 }),
  // the Ready phrase: a soft vibraphone bar up the E major pentatonic, E4 F#4 G#4 B4 · E5 (b13 completes it)
  'fx-mallet-e4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-mallet-fs4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-mallet-gs4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-mallet-b4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-mallet-e5': X(1, 'bell', -3, -12, { delay: -18 }),
  'fx-felt-e': X(1, 'bell', -3, -14),
  // b10's links: a nylon pluck per hairline, E4 G#4 B4 F#4 (the stop-time chord); b14's bright E5 on "four"
  'fx-pluck-e4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-pluck-fs4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-pluck-gs4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-pluck-b4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-pluck-e5': X(1, 'bell', -3, -12, { delay: -20 }),
  // glass: b12's focus-ring tick; the close's arpeggio (the trill's G# B resolving to E, two octaves up)
  'fx-glass-tick': X(1, 'spark', -5, -14),
  'fx-glass-e6': X(1, 'bell', -4, -10, { delay: -18 }),
  'fx-glass-gs6': X(1, 'bell', -4, -10, { delay: -18 }),
  'fx-glass-b6': X(1, 'bell', -4, -10, { delay: -18 }),
  // the front desk's room tone (replaces a third reverb): Part I through b06, and b15–b16
  'fx-roomtone': X(1, 'sig', 0, -80),
  'fx-roomtone-desk': X(1, 'sig', 0, -80),
} as const satisfies Record<string, SfxDef>;
/** The sound families: film 1's library (read-only from public/sfx) + film 2's extras (public/kb/sfx). */
export const SFX = { ...SFX1, ...KB_SFX };
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
/** THE PHONE: one desk phone, one sample, one level. Every ring is a KEY hit at RING_DB (a weight-2 ring that lands on an
 *  answer's last word would take the cue builder's −5 dB speech drop and the same phone would ring 8 dB quieter), every
 *  pickup at PICKUP_DB; b15's one ring sits 14 dB under them (SCRIPT.md b15: "ducked −14 dB" under Leo). */
const RING_DB = -2; // fx-trill* (trim −2): −4 dB on the cue sheet
const PICKUP_DB = -5; // fx-pickup (trim −1): −6 dB

/**
 * THE VISUAL HITS — every visible event that is heard, on its frame (the act's *_LOCAL moments; the cursor's two-part
 * clicks on the press / release frames its keys use). Hierarchy: voice ≫ story sounds (rings, pickups, slips, clicks,
 * keys, the Ready phrase, the impact) ≫ texture (paper, air, room tone). Part I is in the rush light (the rose line light),
 * everything from Ava on in sunday; the extras (fx-*) are film 2's own (KB_SFX above, scripts/kb/sounds.mjs).
 */
/** the two room-tone windows (MUSIC.fx sizes the files to them): Part I through b06 until the harmony opens a bar on,
 *  and the desk of b15–b16 from half a beat before the act into the dark */
const ROOM_A = [0, SCENES.turn.from + TURN_LOCAL.matters + BAR] as const;
const ROOM_DESK = [SCENES.matters.from - b(0.5), SCENES.cta.from] as const;
/* ── repeat ── (b01–b05: picture src/kb/scenes/Repeat.tsx + scenes/repeat/*; pans from the 16:9 layout:
 * the card .3, the clock .84, the pad .78, the callers .55–.7)
 * Room tone from frame 0 (fx-roomtone, on through the hard stop and b06; −52 dBFS feel). Every ring is the ONE trill sample
 * (G#4/B4), cut where the handset is lifted: ring 1 after its two chirps, ring 2 inside its second (fx-trill-15, cut on the
 * pickup's frame), ring 3 after one. The line opens under each caller's caption (no tone); each answer's slip lands on the
 * 16th of "two." (paper slap + soft desk thud). b04's dead line is half a beat of open hiss. b05 is ONE file (fx-rolls):
 * per roll the figures roll, a chirp is cut by the pickup, a slip lands — and it ends ON THE SAMPLE at the hard stop with
 * its own small room (a cue's tail and the mix's room returns would ring past the stop). THE HARD STOP itself has no hit:
 * the bed's Part I bus and the montage are cut there; room tone only. */
const REPEAT_HITS: Hit<Snd>[] = (() => {
  const R = REPEAT_LOCAL;
  const RING = ['ONE', 'TWO', 'THREE'];
  const TRILL = ['fx-trill', 'fx-trill-15', 'fx-trill-1'] as const;
  const CUTS = ['after its two chirps', 'inside its second chirp', 'after one chirp'];
  const CALLER_X = [0.7, 0.64, 0.56];
  return [
    // (−24: ≈ −53 dBFS RMS in the master — SCRIPT.md's "−52 dBFS" room — and the same room as b15's, level for level)
    H(0, 'fx-roomtone', 'none', 0.5, 3, 'b01 the front desk’s room tone (soft HVAC, the far street), from frame 0 — on through the hard stop and b06', { db: -24 }),
    H(R.cup, 'fx-cup', 'none', 0.3, 3, 'b01 a cup set down on wood (her sentence starts rising)', { db: -1 }),
    H(R.dash, 'fx-pen', 'none', 0.36, 3, 'b01 the em dash hangs: a pen click', { db: -2 }),
    ...R.rings.flatMap((ring, k) => [
      H(ring - R.flickLead.ring, 'flick', 'none', 0.84, 3, `ring ${k + 1}: the clock's figures roll, landing on the ring`, { db: k ? -3 : -1 }),
      H(ring, TRILL[k], 'none', 0.84, 1, `RING ${RING[k]}: the desk trill (G#4/B4), the rose line light pulses — cut by the pickup ${CUTS[k]}`, { db: RING_DB }),
      H(R.pickups[k], 'fx-pickup', 'none', 0.84, 1, `ring ${k + 1}: the handset is lifted (the hook switch cuts the trill)`, { db: PICKUP_DB }),
      H(R.callers[k] - 2, 'fx-line', 'none', CALLER_X[k], 3, `caller ${k + 1}: the line opens as the caption and its waveform draw out`, { db: -8 }),
      ...(k ? [H(R.desk[k] - R.placeLead, 'fx-slip-slide', 'none', 0.78, 3, `answer ${k + 1}: a fresh slip slid up over the pile`, { db: -5 })] : []),
      H(R.slips[k], 'fx-slip', 'none', 0.78, 2, `answer ${k + 1}: the slip tears off and lands on the pile on the 16th of "two."${k === 2 ? ' (crooked)' : ''} — paper slap + soft desk thud`, { db: 1 }),
    ]),
    H(R.dead[0], 'fx-linehiss', 'none', CALLER_X[2], 3, 'b04 the dead line: the waveform lies flat — half a beat of open line hiss, nothing else (the loop runs on)', { db: -4 }),
    ...(R.rolls.length
      ? [H(R.rolls[0], 'fx-rolls', 'none', 0.8, 1, `b05 THE REST OF THE DAY: ${R.rolls.length} rolls on 8ths (the figures roll, a chirp cut by the pickup, a slip lands) — one file, cut ON THE SAMPLE at the hard stop (a key: the same phone as the rings, never the speech drop)`, { db: -6 })]
      : []),
  ];
})();
/* ── /repeat ── */

/* ── recording ── (b06: picture src/kb/scenes/Recording.tsx + scenes/recording/*; pans from the 16:9 layout:
 * the pile .72 → the column .3, the titles .3, the card .7)
 * ROOM TONE ONLY (SCRIPT.md b06): the bus cut at the hard stop holds, the room tone runs on (REPEAT_HITS' fx-roomtone);
 * the titles rise in silence. The bed's two notes are MUSIC.brilliant (a low felt-piano E2 under "brilliant") and
 * MUSIC.waiting (an unresolved high B5 on "Waiting.", ON the bar) — scripts/kb/bed.mjs. Everything below is quiet paper. */
const RECORDING_HITS: Hit<Snd>[] = (() => {
  const R = RECORDING_LOCAL;
  const at = (f: number) => SCENES.recording.from + f;
  const deal = R.fan.slice(1);
  return [
    H(at(R.slide[0] + 1), 'fx-paper-square', 'none', 0.72, 3, 'b06 the pile is squared against the desk and picked up off the pad', { db: -4 }),
    H(at(R.morph), 'fx-paper-fold', 'none', 0.62, 3, 'b06 the pad sheets fold to one line each', { db: -7 }),
    ...(deal.length
      ? [H(at(deal[0]), 'fx-riffle', 'none', 0.3, 3, 'b06 the strips deal down into one column: one dry tick per 16th, each a touch darker (the faint riffle)', { db: -6, run: { n: deal.length, step: BEAT / 4, semi: -0.5 } })]
      : []),
    H(at(R.fan[R.fan.length - 1] + 12), 'fx-scroll', 'none', 0.3, 3, 'b06 the column scrolls: a faint paper drag under the teleprompter of the same line', { db: -9 }),
  ];
})();
/* ── /recording ── */

/* ── turn ── (b07: picture src/kb/scenes/Turn.tsx + scenes/turn/*; pans from the 16:9 layout: the seam .5,
 * the repeat half .22–.38 (the clock .12, the orb .28, "repeats." .38), the matters half .6–.8)
 * The Part I loop's one deadpan bar under "Some work repeats." and the harmony opening on "Some work matters." are the
 * bed's (MUSIC.turn, MUSIC.matters). Here: the seam's line; ONE split-flap tick per flip, the same sample, the same level,
 * the same place every beat (deadpan — `xs` holds the run's pan and level still); her seed rising out of the line light
 * (B4 → E5) into the pop and the sine "ting" (B5) on "Ava"; a quiet paper slide on "the first kind". */
const TURN_HITS: Hit<Snd>[] = (() => {
  const R = TURN_LOCAL;
  const at = (f: number) => SCENES.turn.from + f;
  return [
    H(at(R.seam[0]), 'draw', 'none', 0.5, 3, 'b07 THE SEAM draws on the beat, over one beat (16:9 top → bottom, 9:16 left → right)', { db: -3 }),
    ...(TURN_FLIPS.length
      ? [H(at(TURN_FLIPS[0]), 'fx-flap', 'none', 0.38, 3, 'b07 "repeats." flips over — to the same word — on every beat: one split-flap tick, never varied', { db: -4, run: { n: TURN_FLIPS.length, step: BEAT, xs: TURN_FLIPS.map(() => 0.38) } })]
      : []),
    H(at(R.lift), 'fx-seed', 'none', 0.18, 3, 'b07 the rose line light lifts off the clock: a soft seed tone rising B4 → E5 into "Ava"', { db: -4 }),
    H(at(R.ava), 'pop', 'sunday', 0.28, 2, 'b07 AVA: the line light springs open into her orb (on "Ava"), rush → sunday', { db: -7 }),
    H(at(R.ava + 3), 'fx-ting', 'none', 0.28, 2, 'b07 the hairline ring leaves her rim: one sine "ting" (B5, her light)', { layer: true, db: 0 }),
    H(at(R.firstKind), 'fx-slip-slide', 'none', [0.32, 0.28], 3, 'b07 "the first kind": the flips have stopped; the repeat side eases toward her light — a quiet paper slide', { db: -8 }),
  ];
})();
/* ── /turn ── */

/* ── written ── (b08: picture src/kb/scenes/Written.tsx + scenes/written/*; pans from the 16:9 layout: the corner
 * (the orb, the slips) .17, the panel .32–.95 — its Knowledge tab .75, the web page field / Add page .47, the list .78)
 * The Part III bed (felt-piano eighths, a soft kick on beats 1 and 3, E – C#m7 – Amaj7 – B) is the bed's (MUSIC.written).
 * The CURSOR's clicks are TWO-PART (CLIENT DIRECTION v2 §3): fx-click-down ON the press, fx-click-up ON the release — the
 * frames are WRITTEN_LOCAL's, the very frames the scene's cursor keys press and release on (kit clicksOf()). "once": the
 * slips tuck up under the pile on 16ths, each a touch lower, and settle; each row lands with a pitched paper tock on a
 * chord tone; each Ready is one soft vibraphone note up the E major pentatonic (E4 F#4 G#4 B4 — the phrase left open, its
 * fifth note in b13) with the pill's tiny roll tick; the URL types a soft low-profile key per character; the eyebrow is
 * one soft felt-piano E. */
const WRITTEN_HITS: Hit<Snd>[] = (() => {
  const R = WRITTEN_LOCAL;
  const at = (f: number) => SCENES.written.from + f;
  const S16 = BEAT / 4;
  const S32 = BEAT / 8;
  const NAMES = ['PDF · Price list lands', 'TXT · Opening hours slots in (from its flight)', 'DOCX · Cancellation policy lands', 'URL · FAQ page lands'];
  const TOCK = [0, 4, 7, 9]; // chord tones under each landing (E · G# · B · C#), from fx-tock's E
  const MALLET = ['fx-mallet-e4', 'fx-mallet-fs4', 'fx-mallet-gs4', 'fx-mallet-b4'] as const;
  return [
    H(at(R.seam[0]), 'draw', 'none', 0.5, 3, 'b08 the seam draws back the way it came; her ground floods the other half', { db: -12 }),
    H(at(R.panel[0] + 4), 'whoosh-soft', 'none', [0.86, 0.66], 3, 'b08 the app comes in (16:9 from the right, 9:16 up from under the seam)', { db: -10 }),
    H(at(R.tab.down), 'fx-click-down', 'none', 0.75, 2, 'b08 the cursor presses the Knowledge tab (down)', { db: -1 }),
    H(at(R.tab.up), 'fx-click-up', 'none', 0.75, 2, 'b08 … and releases it (up): the underline springs across, the content swaps', { db: -4 }),
    H(at(R.tab.up + 1), 'draw', 'none', [0.45, 0.75], 3, 'b08 the underline slides from General to Knowledge (a breath of air under the click)', { db: -10 }),
    H(at(R.collapse[0]), 'fx-tuck', 'none', 0.17, 3, 'b08 "once": the slips tuck up into one, one per 16th, each a touch lower', {
      db: -4,
      layer: true,
      run: { n: R.collapse.length, step: S16, semi: -0.6, xs: R.collapse.map((_, m) => 0.15 + 0.01 * m) },
    }),
    H(at(R.collapse[R.collapse.length - 1] + 2 * S16), 'fx-settle', 'none', 0.17, 3, 'b08 the pile settles, its shadow deep', { db: -3 }),
    H(at(R.born), 'draw', 'none', 0.18, 3, 'b08 the last slip draws its edges into a document row: TXT · Opening hours, Reading…', { db: -14 }),
    H(at(R.fly[0] + 3), 'fx-slip-slide', 'none', [0.2, 0.74], 3, 'b08 the Opening hours row flies from the corner into the list', { db: -7 }),
    ...R.rows.map((r, i) =>
      H(at(r), 'fx-tock', 'none', i === 1 ? 0.74 : 0.78, 3, `b08 ${NAMES[i]} on top of the list; the Knowledge badge ${i ? 'ticks to' : 'opens at'} ${i + 1} — a pitched paper tock on the chord`, {
        semi: TOCK[i],
        db: -2,
      }),
    ),
    // (the Ready phrase is a KEY: its four notes play under her line and must be heard as a phrase for b13's fifth to
    // complete it — on the key tonal bus they step back 5 dB under her voice, not the bells' 10)
    ...R.ready.flatMap((r, i) => [
      H(at(r), MALLET[i], 'none', 0.8, 1, `b08 Ready ${i + 1}: the pill rolls Reading… → Ready — one soft mallet note, ${['E4', 'F#4', 'G#4', 'B4'][i]} (the phrase is left open)`, { db: -10 }),
      H(at(r), 'fx-tick', 'none', 0.8, 3, `b08 Ready ${i + 1}: the pill's roll`, { db: -12, layer: true }),
    ]),
    H(at(R.field.down), 'fx-click-down', 'none', 0.47, 2, 'b08 the cursor (an I-beam) presses into the web page field (down)', { db: -3 }),
    H(at(R.field.up), 'fx-click-up', 'none', 0.47, 2, 'b08 … released: the field takes its focus ring (up)', { db: -6 }),
    H(at(R.keys[0]), 'fx-keys', 'none', 0.47, 3, 'b08 https://your-site/faq types, one soft low-profile key per character on 32nds', {
      db: -5,
      layer: true,
      run: { n: R.keys.length, step: S32, xs: R.keys.map((_, i) => 0.44 + (0.06 * i) / Math.max(1, R.keys.length - 1)) },
    }),
    H(at(R.add.down), 'fx-click-down', 'none', 0.47, 2, 'b08 Add page: pressed (down)', { db: -1 }),
    H(at(R.add.up), 'fx-click-up', 'none', 0.47, 2, 'b08 … released (up; the FAQ page lands a 16th later and the field clears)', { db: -4 }),
    H(at(R.knowledge), 'fx-felt-e', 'none', 0.36, 3, 'b08 "knowledge": the eyebrow ● KNOWLEDGE BASE rises above the panel — one soft felt-piano E', { db: 0 }),
  ];
})();
/* ── /written ── */

/* ── call ── (b09–b11: picture src/kb/scenes/Call.tsx + scenes/call/*; pans from the 16:9 layout: the orb .23 in
 * b09, the call strip .55 (b10's frozen question .25), the panel .6 → off right, the Opening hours page .72, the
 * hairlines .45 → .55, her answer .3, the record row .3)
 * The bed's part (MUSIC.call / .freeze / .resume): it ducks under the call; on the freeze its beat drops out and a
 * sustained E add9 holds (time has stopped); it returns on the beat at the resume. NO CURSOR in this act (Ava takes the
 * call alone): no clicks. The ring is the desk trill, one chirp, answered in the gap; the frozen line's hiss sits very low
 * under the stop-time (fx-linehold, sized freeze → resume); the sweep is a felt-tip swipe; each hairline a fine pen scratch
 * landing on a nylon pluck — E4 G#4 B4 F#4 on four 8ths, building the stop-time's chord; the re-set ticks very quietly per
 * word; the record row lands with a paper click and the check's tick. */
const CALL_HITS: Hit<Snd>[] = (() => {
  const R = CALL_LOCAL;
  const at = (f: number) => SCENES.call.from + f;
  const PLUCK = ['fx-pluck-e4', 'fx-pluck-gs4', 'fx-pluck-b4', 'fx-pluck-fs4'] as const;
  const LINK = ['the hero hairline from "weekend" lands on the swept lines; MATCHED ON MEANING', '"Are you open on Saturdays?" sends its hairline', '"Can I pop in on Saturday?" sends its hairline', '"What are your weekend hours?" sends its hairline'];
  return [
    H(at(R.ring), 'fx-trill-1', 'none', 0.23, 1, 'b09 THE LIVE CALL rings on the bar: the same desk trill, one chirp; one slate hairline leaves the orb', { db: RING_DB }),
    H(at(R.recede[0] + 2), 'fx-slip-slide', 'none', [0.62, 0.95], 3, 'b09 the app panel steps back a depth and slides away (16:9 right, 9:16 down)', { db: -7 }),
    H(at(R.pickup), 'fx-pickup', 'none', 0.23, 1, 'b09 picked up on the first ring: the orb wakes to listen; ● CALLER and the timer rise', { db: PICKUP_DB }),
    H(at(R.c4 - 2), 'fx-line', 'none', 0.55, 3, 'b09 the caller’s line opens under his words', { db: -8 }),
    H(at(R.rowIn[0] + 2), 'fx-slip-slide', 'none', [0.98, 0.8], 3, 'b09 "…let me check.": the Opening hours row comes back (16:9 in from the right; 9:16 lifted out of the panel)', { db: -8 }),
    H(at(R.freeze), 'freeze', 'none', 0.5, 2, 'b10 THE FREEZE: the call stops — BETWEEN QUESTION AND ANSWER', { db: -7 }),
    H(at(R.freeze), 'fx-linehold', 'none', 0.55, 3, 'b10 the frozen call’s open line, very low, through the stop-time (it lets go on the resume)', { db: -8, layer: true }),
    H(at(R.unfold[0] + 2), 'fx-paper-unfold', 'none', 0.72, 3, 'b10 the row unfolds into the full Opening hours page', { db: -4 }),
    H(at(R.sweep), 'fx-felttip', 'none', 0.7, 3, 'b10 "the part that answers them": the sunday sweep under Saturday — a soft felt-tip swipe', { db: -2 }),
    H(at(R.sweep + BEAT / 4), 'fx-felttip', 'none', 0.7, 3, 'b10 … and under Sunday, a 16th behind', { db: -6, layer: true }),
    H(at(R.underline), 'fx-felttip-short', 'none', 0.22, 3, 'b10 "around this weekend" takes a slate underline (short, light)', { db: -6 }),
    ...R.links.flatMap((f, i) => [
      H(at(R.linkStart[i]), 'fx-scratch', 'none', i ? 0.4 : 0.36, 3, `b10 hairline ${i + 1}: the pen draws (a fine scratch)`, { db: i ? -8 : -5, layer: true }),
      H(at(f), PLUCK[i], 'none', 0.62, 3, `b10 ${LINK[i]} — a pluck, ${['E4', 'G#4', 'B4', 'F#4'][i]} (the four build the held chord on 8ths)`, { db: i ? -1 : 1 }),
    ]),
    H(at(R.resume), 'whoosh-soft', 'none', 0.5, 3, 'b11 TIME RESUMES on the bar: the label and the phrasings leave, the orb comes out of the dot (the line hiss lets go)', { db: -8 }),
    H(at(R.lift[0]), 'fx-paper-lift', 'none', [0.68, 0.6], 3, 'b11 the two swept lines lift out of the page as their own layer', { db: -4, layer: true }),
    ...R.resetTicks.map((f, k) =>
      H(at(f), 'fx-tick', 'none', R.reset[k].from ? 0.45 : 0.3, 3, `b11 the re-set: "${VOICE.lines['kb2-call-2'].words[k].w}" lands${R.reset[k].from ? ' (kept from the page)' : ''} — one very quiet tick (−28 dB)`, { db: -12 }),
    ),
    H(at(R.record), 'fx-record', 'none', 0.3, 3, 'b11 the strip folds into the white record row: a paper click with a little body', { db: -1 }),
    H(at(R.check), 'tick', 'sunday', 0.48, 3, 'b11 the white check draws in the sunday disc: Answered from your documents (the check’s tick)', { db: -4 }),
  ];
})();
/* ── /call ── */

/* ── line ── (b12: picture src/kb/scenes/Line.tsx + scenes/line/*; pans from the 16:9 layout: the Conversation tab .32,
 * the field — each keystroke panned (narrowly, .38–.62) to where its word lands (16:9 sets the line a sentence per row) —
 * Save changes .73)
 * The bed thinning to piano and pad is the bed's (MUSIC.line). The CURSOR's clicks are TWO-PART (CLIENT DIRECTION v2 §3):
 * fx-click-down on the press, fx-click-up on the release (LINE_LOCAL's frames — the very frames Panel.tsx's cursor keys
 * press and release on). Nothing is narrated while the line types, so the owner's sounds lead here: ONE soft low-profile
 * keystroke per word on 16ths (no typewriter bell), even across the line; a tiny pitched tick on Save's press (the save
 * tick); the sunday focus ring settles round the field on "words" with one small glassy tick. Nothing sounds for the
 * pointer's moves. */
const LINE_HITS: Hit<Snd>[] = (() => {
  const R = LINE_LOCAL;
  const at = (f: number) => SCENES.line.from + f;
  const S16 = BEAT / 4;
  // each word's pan: its centre's place along its row (16:9: "…want to guess." / "I'll ask … today."; the field spans .21–.79)
  const words = R.ownerLine.split(' ');
  const rows = [words.slice(0, words.findIndex((w) => w.endsWith('.')) + 1)];
  rows.push(words.slice(rows[0].length));
  const width = Math.max(...rows.map((r) => r.join(' ').length));
  const xs = rows.flatMap((r) => {
    let c = 0;
    return r.map((w) => {
      const mid = c + w.length / 2;
      c += w.length + 1;
      return 0.38 + 0.24 * (mid / width);
    });
  });
  const FIELD = 0.6;
  // Save changes is clicked with the page pushed in (scenes/line/stage.ts PUSH: it sits further right, ≈ .88 of the frame,
  // than at rest) — on the pans' ¾ scale, .79; at rest (no full order) .73
  const SAVE = R.tab ? 0.79 : 0.73;
  return [
    H(at(R.leave[0] + 2), 'whoosh-soft', 'none', [0.42, 0.52], 3, 'b12 the call’s record row leaves up; the agent page rises in', { db: -12 }),
    ...(R.tab
      ? [
          H(at(R.tab.down), 'fx-click-down', 'none', 0.32, 2, 'b12 the cursor presses the Conversation tab (down, on beat 2)', { db: -1 }),
          H(at(R.tab.up), 'fx-click-up', 'none', 0.32, 2, 'b12 … and releases it (up): the underline springs back to Conversation, the content swaps', { db: -4 }),
          H(at(R.tab.up + 1), 'draw', 'none', [0.62, 0.34], 3, 'b12 the underline slides back from Knowledge to Conversation; the tab content swaps through its mask', { db: -12 }),
        ]
      : []),
    H(at(R.field.down), 'fx-click-down', 'none', FIELD, 2, 'b12 the I-beam presses into the field (down): focus', { db: -2 }),
    H(at(R.field.up), 'fx-click-up', 'none', FIELD, 2, 'b12 … released (up): the caret', { db: -5 }),
    H(at(R.keys[0]), 'fx-keys', 'none', xs[0], 3, `b12 the owner’s line types, one soft keystroke per word on 16ths (${R.keys.length}); the amber unsaved dot opens on the first`, {
      db: -3,
      layer: true,
      run: { n: R.keys.length, step: S16, xs },
    }),
    H(at(R.saveClick.down), 'fx-click-down', 'none', SAVE, 2, 'b12 Save changes: pressed (down)', { db: -1 }),
    H(at(R.saveClick.down), 'tick', 'sunday', SAVE, 3, 'b12 the save tick', { layer: true, db: -8 }),
    H(at(R.saveClick.up), 'fx-click-up', 'none', SAVE, 2, 'b12 … released (up): the amber dot closes', { db: -4 }),
    H(at(R.focus), 'fx-glass-tick', 'none', FIELD, 3, 'b12 "words": the sunday focus ring settles round the field — one small glassy tick', { db: -4 }),
  ];
})();
/* ── /line ── */

/* ── change ── (b13–b14: picture src/kb/scenes/Change.tsx + scenes/change/*; pans from the 16:9 layout: the owner's
 * file .62 ("14:00" .65), the agent page .5 (the old row's … .83, "Replace with new file" .8, the list's top slot .52),
 * the parked file .76; b14: the orb .11, the call transcript .3, SAME QUESTION .32, the page .75)
 * The bed's part (MUSIC.change / .ready5 / .ring14): the lift into the next call with a high piano line. The CURSOR's clicks
 * are TWO-PART (fx-click-down / fx-click-up on CHANGE_LOCAL's press / release frames — Change.tsx's cursor keys). The drag
 * across "14:00" snaps its selection with a tiny tick; "16:00" types a key per 16th; the menu opens with a soft low pop;
 * the new row lands with a tock on E and reads under a quiet tick-roll; THE FIFTH READY MALLET, E5 (the octave), lands on the
 * beat with "the new answer" and completes b08's phrase; the next call is the same trill, one chirp; SAME QUESTION pops with
 * a small card tick; "four." takes the felt-tip sweep and a bright pluck on E5. */
const CHANGE_HITS: Hit<Snd>[] = (() => {
  const R = CHANGE_LOCAL;
  const at = (f: number) => SCENES.change.from + f;
  const S16 = BEAT / 4;
  return [
    H(at(R.page[0]), 'whoosh-soft', 'none', [0.5, 0.62], 3, 'b13 the app sinks back; the owner’s own file (opening-hours.txt) comes forward', { db: -13 }),
    H(at(R.drag.down), 'fx-click-down', 'none', 0.62, 2, 'b13 "Hours change?": the I-beam presses on 14:00 — the caret clicks in (down)', { db: -3 }),
    H(at(R.drag.up), 'fx-click-up', 'none', 0.66, 2, 'b13 … dragged across 14:00 and released (up): selected, the sunday wash', { db: -6 }),
    H(at(R.drag.up), 'fx-tick', 'none', 0.66, 3, 'b13 the selection snaps across the digits', { db: -12, layer: true }),
    H(at(R.keys[0]), 'fx-keys', 'none', 0.66, 3, 'b13 16:00 typed over it, one keystroke per 16th (five) — the last on "Change"', {
      db: -4,
      layer: true,
      run: { n: R.keys.length, step: S16, xs: R.keys.map((_, i) => 0.64 + 0.01 * i) },
    }),
    H(at(R.app[0] + 2), 'fx-slip-slide', 'none', [0.5, 0.5], 3, 'b13 "Change the document": the agent page rises on Knowledge; the file steps up into the corner', { db: -9 }),
    H(at(R.menu.down), 'fx-click-down', 'none', 0.83, 2, 'b13 the cursor presses the Opening hours row’s … (down)', { db: -2 }),
    H(at(R.menu.up), 'fx-click-up', 'none', 0.83, 2, 'b13 … released (up): Read again · Replace with new file · Remove', { db: -5 }),
    H(at(R.menu.up + 0.5), 'fx-menu-open', 'none', 0.81, 3, 'b13 the menu opens from its trigger', { db: -6, layer: true }),
    H(at(R.replace.down), 'fx-click-down', 'none', 0.8, 2, 'b13 "Replace with new file" pressed (.97, the pressed shade; down)', { db: -1 }),
    H(at(R.replace.up), 'fx-click-up', 'none', 0.8, 2, 'b13 … released (up): the menu closes', { db: -4 }),
    H(at(R.fly[0] + 1), 'fx-slip-slide', 'none', [0.76, 0.52], 3, 'b13 the edited file drops into the list as the new version', { db: -8 }),
    H(at(R.land), 'fx-tock', 'none', 0.52, 3, 'b13 the new row lands on top: TXT · Opening hours · Reading…; the badge ticks to 5 (a tock on E)', { db: -2 }),
    H(at(R.land + 2 * S16), 'fx-tick', 'none', 0.6, 3, 'b13 Reading… — the old row still Ready (a soft tick-roll under the spinner)', { db: -14, run: { n: 4, step: S16 } }),
    H(at(R.ready5), 'fx-mallet-e5', 'none', 0.6, 1, 'b13 "the new answer": Ready · 1 passage — the FIFTH mallet, E5, completes b08’s phrase (E4 F#4 G#4 B4 · E5)', { db: -8 }),
    H(at(R.oldOut + 1), 'fx-paper-lift', 'none', 0.5, 3, 'b13 the old row leaves up through its mask; the badge back to 4', { db: -8, layer: true }),
    H(at(R.recede[0] + 1), 'fx-slip-slide', 'none', [0.5, 0.5], 3, 'b14 the app steps back and slides away; the new row lifts out of it', { db: -9 }),
    H(at(R.unfold[0] + 2), 'fx-paper-unfold', 'none', 0.75, 3, 'b14 the new row unfolds into its page: Saturday · 9:00–16:00', { db: -5 }),
    H(at(R.ring), 'fx-trill-1', 'none', 0.15, 1, 'b14 THE NEXT CALL rings (beat 3): the same desk trill, one chirp; one slate hairline leaves the orb', { db: RING_DB }),
    H(at(R.pickup), 'fx-pickup', 'none', 0.15, 1, 'b14 picked up on the first ring: she listens; ● CALLER rises', { db: PICKUP_DB }),
    H(at(R.c2 - 2), 'fx-line', 'none', 0.3, 3, 'b14 Dana’s line opens under her words — b03’s identical recording', { db: -8 }),
    H(at(R.chip), 'fx-tag', 'none', 0.32, 3, 'b14 SAME QUESTION pops beside ● CALLER, on "Saturday?"', { db: -4 }),
    H(at(R.sweep[0]), 'fx-felttip', 'none', 0.75, 3, 'b14 "four.": the sunday sweep under Saturday · 9:00–16:00', { db: -3 }),
    H(at(R.sweep[0]), 'fx-pluck-e5', 'none', 0.75, 2, 'b14 … and the bright pluck on "four" (E5)', { db: -2, layer: true }),
    H(at(R.cross[0]), 'whoosh-soft', 'none', [0.3, 0.7], 3, 'b14 THE L-CUT under her last word: the frame crosses to the desk', { db: -16 }),
  ];
})();
/* ── /change ── */

/* ── matters ── (b15–b16: picture src/kb/scenes/Matters.tsx + scenes/matters/*; pans from the 16:9 layout: the card .35,
 * the teal colon (the clock) .84, the old slip stack on the pad .81 → off the right edge)
 * The bed's part (MUSIC.desk / .breath / .vo8): it drops to room tone and one warm sustained pad under the desk, the bar of
 * room tone after the staff line (nothing else sounds in it), fuller under vo-8; the drop into the dark lands on the close's
 * bar (MUSIC.cta). NO cursor and no clicks. The room tone comes back (fx-roomtone-desk); the em dash lifts off with a breath
 * of felt-tip; the line rings ONCE far under Leo (the same trill, one chirp, ducked by its own level) and her soft pickup
 * tone (b07's ting) cuts it; AVA · ON A CALL rolls in with the clock's own flick; the old slips glide off as one slide. */
const MATTERS_HITS: Hit<Snd>[] = (() => {
  const R = MATTERS_LOCAL;
  const at = (f: number) => SCENES.matters.from + f;
  return [
    // (it fades in under call-3's last word, so the cue builder takes its 5 dB speech drop; its file runs 1.2 dB hotter than
    // b01's: −20 puts the breath bar's room at b01's ≈ −53 dBFS RMS)
    H(ROOM_DESK[0], 'fx-roomtone-desk', 'none', 0.5, 3, 'b15 the front desk’s room tone again (under the desk, the breath bar and b16, into the dark)', { db: -20 }),
    H(at(R.nervous), 'fx-pen-lift', 'none', 0.35, 3, 'b15 "nervous." — the sentence that hung since b01 completes; the em dash lifted off', { db: -6 }),
    H(at(R.ring), 'fx-trill-1', 'none', 0.84, 1, 'b15 THE LINE RINGS ONCE (beat 2), far under the staff line: one hairline teal ring leaves the colon; the card does not move (ducked −14 dB re the desk rings)', { db: RING_DB - 14 }),
    H(at(R.pickup), 'fx-ting', 'none', 0.84, 3, 'b15 … cut a 16th later by her soft pickup tone: Ava takes the call', { db: -6 }),
    H(at(R.label), 'flick', 'none', 0.84, 3, 'b15 AVA · ON A CALL rolls in under the clock, where a second chirp would have been', { db: -10 }),
    H(at(R.vo8Words[0] - 1), 'sheen', 'none', 0.3, 3, 'b16 "That’s the work / only people can do." rises over the desk; the slow push toward the card', { db: -14 }),
    H(at(R.stack.lift), 'fx-slip-slide', 'none', [0.8, 1], 3, 'b16 "do.": the old slips lift off the pad and glide off toward the teal dot, still reading "nine till two" — one slide', { db: -4 }),
  ];
})();
/* ── /matters ── */

/* ── cta ── (b17–b18: picture src/kb/scenes/Cta.tsx + scenes/cta/*; pans from the 16:9 layout: the heading .5, the
 * four lights on their corners — sunday (her dot) .87 top, rush .13 top, closing .13 low, night .87 low — the core,
 * the wordmark and the end card .5, the pointer coming in from the lower right .75 → the button .53)
 * THE RINGS COME BACK AS MUSIC: the Part I trill's two pitches (G#, B) resolving to E, two octaves up (G#6 · B6 · E6), a
 * soft struck-glass arpeggio on 8ths from the drop into the dark (the close's bar) under the heading — four turns of the
 * figure, the last landing on E. Then the four light chimes (film 1's end-card chime family, re-cued, sunday first), the
 * converge swell and the inhale (the bed's), E ON the impact (the bed's chord + this stack), the held E chord into the
 * master's fade. The impact must top the dialogue maximum by ≥ 1 LU (check-mix; MIX.impact). The URL's chunks type a soft
 * key each on her words; Start free is clicked in two parts (down ON the press, up ON the release). */
const CTA_HITS: Hit<Snd>[] = (() => {
  const R = CTA_LOCAL;
  const at = (f: number) => SCENES.cta.from + f;
  const PAN = { sunday: 0.87, rush: 0.13, closing: 0.13, night: 0.87 } as const;
  const WHERE = { sunday: 'out of her teal dot (top right; 9:16 top centre)', rush: 'top left', closing: 'lower left', night: 'lower right' } as const;
  const GLASS = ['fx-glass-gs6', 'fx-glass-b6', 'fx-glass-e6'] as const;
  const GLASS_NOTE = ['G#6', 'B6', 'E6'];
  // the figure on 8ths from the close's bar, as long as it clears the first light by a beat (four turns on this cut)
  const glass = Array.from({ length: 12 }, (_, j) => j * (BEAT / 2)).filter((f) => f <= R.lights[0] - BEAT);
  // (the figure is a KEY under her line — the rings coming back must read as music through it: on the key tonal bus its
  // notes step back 5 dB while she speaks, not the bells' 10; the first, on the drop into the dark before her first word,
  // is the downbeat's accent, a few dB over the figure, and every E — the resolution — a touch over the G# and B)
  const glassDb = (j: number) => (j === 0 ? -15 : j % 3 === 2 ? -15 : -17);
  return [
    ...glass.map((f, j) =>
      H(at(f), GLASS[j % 3], 'none', [0.42, 0.58, 0.5][j % 3], 1, `b17 the rings come back as music: glass ${GLASS_NOTE[j % 3]} (8th ${j + 1}; the trill's G# B resolving to E, two octaves up)`, {
        db: glassDb(j),
      }),
    ),
    H(at(R.words[0] - R.riseLead), 'sheen', 'none', 0.5, 3, 'b17 "Your answers." rises (on "Your")', { db: -14 }),
    H(at(R.words[2] - R.riseLead), 'sheen', 'none', 0.5, 3, 'b17 "Written once, …" rises (on "Written")', { db: -15 }),
    H(at(R.words[R.key[0]] - 1), 'glint', 'sunday', 0.55, 3, 'b17 "there for every call." takes her teal word by word, a glint running through it (9:16: its row rises here)', { db: -16 }),
    // THE FOUR LIGHTS as one even sequence: hers (on "call.") and rush (on its tail) land under her voice, closing and night
    // after it. As weight-2/3 hits the first two took the speech drop and the bells' 10 dB duck and arrived ~18 dB under the
    // last two — hers, the first, all but silent. The chimes are KEY hits (the key tonal bus steps back only 5 dB under the
    // word), levelled so the four sit within a few dB, hers a touch under her own word; the pops likewise.
    ...R.lights.flatMap((f, i) => {
      const id = R.lightOrder[i];
      const talk = speaking(at(f));
      return [
        H(at(f), 'pop', id, PAN[id], 3, `b17 the ${id.toUpperCase()} light arrives, ${WHERE[id]} — ${i ? 'its orb springs out of a point of light' : 'the dot springs open into her orb'}`, { db: talk ? -2 : -4 }),
        H(at(f), `${chime(id)}-soft` as Snd, id, PAN[id], 1, `b17 ${id}: the end card’s chime, recalled${i ? '' : ' — hers first'}`, { db: talk ? -5 : -8, layer: true }),
      ];
    }),
    H(at(R.converge), 'swish', 'none', 0.5, 2, 'b17 THE CONVERGE: the heading leaves up through its masks; the ring of four swells', { db: 3 }),
    H(at(R.whirl), 'whoosh', 'none', [0.3, 0.7], 2, 'b17 the four whirl at top speed, spiralling into the core', { db: 2 }),
    H(at(R.survivor[0]), 'gulp', 'sunday', 0.5, 2, 'b17 the four are one: the three pour into her light, which holds alone'),
    H(at(R.impact), 'riser', 'none', 0.5, 1, 'b17 the converge swell, peaking ON the impact', { db: -2 }),
    H(at(R.impact), 'impact', 'night', 0.5, 1, 'b18 LOGO IMPACT (bar line): the merged light opens into the backlight'),
    H(at(R.impact), 'chord', 'night', 0.5, 1, 'b18 the four lights ring together'),
    H(at(R.impact), 'chord-rev', 'none', 0.5, 2, 'b18 the four lights fuse', { layer: true }),
    H(at(R.impact), 'thump', 'none', 0.5, 1, 'b18 the impact’s weight', { layer: true, db: -8 }),
    H(at(R.impact), 'slam', 'none', 0.5, 2, 'b18 the impact’s crack', { layer: true }),
    H(at(R.impact + 1), 'shimmer', 'none', 0.5, 2, 'b18 NEUROVOICE surfaces letter by letter from the centre out (the letter shimmer is a sound, not a glow)', { layer: true, db: 0 }),
    H(at(R.impact + 2), 'shock', 'none', 0.5, 2, 'b18 the backlight opens out round the wordmark', { layer: true }),
    ...R.url.map((f, k) => H(at(f - 1), 'fx-keys', 'none', 0.46 + 0.04 * k, 3, `b18 the URL rises on her words: "${['neuro', 'tech', 'voice.com'][k]}" — one soft key`, { db: -7 })),
    H(at(R.url[0] + 2), 'draw', 'none', [0.4, 0.6], 3, 'b18 the colophon’s hairline draws out to the margins', { db: -16 }),
    H(at(R.button), 'pop', 'night', 0.5, 3, 'b18 "Start free →" rises on "…Voice."', { db: -3 }),
    H(at(R.note), 'tap', 'none', 0.5, 3, 'b18 "5 free minutes, no card"', { db: -5 }),
    H(at(R.press), 'fx-click-down', 'none', 0.53, 1, 'b18 THE CLICK: the pointer presses Start free (plum, .97) — down', { db: -2 }),
    H(at(R.press), 'thump', 'none', 0.53, 2, 'b18 … the click’s felt knock', { layer: true, db: -8 }),
    H(at(R.release), 'fx-click-up', 'none', 0.53, 2, 'b18 … released: the plate springs back under the pointer — up', { db: -3 }),
  ];
})();
/* ── /cta ── */

export const HITS: Hit<Snd>[] = [
  /* ── repeat ── */
  ...REPEAT_HITS,
  /* ── recording ── */
  ...RECORDING_HITS,
  /* ── turn ── */
  ...TURN_HITS,
  /* ── /turn ── */
  /* ── written ── */
  ...WRITTEN_HITS,
  /* ── /written ── */
  /* ── call ── */
  ...CALL_HITS,
  /* ── /call ── */
  /* ── line ── */
  ...LINE_HITS,
  /* ── /line ── */
  /* ── change ── */
  ...CHANGE_HITS,
  /* ── /change ── */
  /* ── matters ── */
  ...MATTERS_HITS,
  /* ── /matters ── */
  /* ── cta ── */
  ...CTA_HITS,
  /* ── /cta ── */
];

export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/**
 * The moments the music bed reads (scripts/kb/bed.mjs; absolute frames, part of its cache key): the 120 BPM E-major score
 * composed against the acts (SCRIPT.md's per-beat "Sound" notes) — Part I's deadpan bar from ring one to the hard stop,
 * b06's two notes, the harmony from "matters", the stop-time, the thinned b12, the lift at the next call, b15's pad and its
 * bar of room tone, the close.
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
  /** what scripts/kb/sounds.mjs cuts its sounds to (in the extras' cache key with the rest of MUSIC): the second ring's
   *  pickup (its trill is cut there), b05's montage (the rolls, the figures' lead, the pickups an 8th's half on, the slips,
   *  the hard stop it is cut on), the stop-time (the frozen line's hiss), her seed's rise (lift → "Ava"), the room tones */
  fx: {
    ring2Cut: REPEAT_LOCAL.pickups[1] - REPEAT_LOCAL.rings[1],
    rolls: REPEAT_LOCAL.rolls,
    flickLead: REPEAT_LOCAL.flickLead.roll,
    lead: KB_SFX['fx-rolls'].pk,
    pickupAfter: BEAT / 8,
    rollSlips: REPEAT_LOCAL.rollSlips,
    hardStop: HARD_STOP,
    stopTime: [FREEZE, RESUME] as const,
    seed: TURN_LOCAL.ava - TURN_LOCAL.lift,
    room: ROOM_A,
    roomDesk: ROOM_DESK,
  },
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
    // THE HIT is the cue stack's (the insert's dense clip): under the inhale the bed steps back so its E arrives under the
    // hit instead of on its peaks (the bed's attacks would only drive the master limiter and pump the hit down), blooms
    // after it, steps back for the name and comes up for the end card
    [IMPACT - 6, 3.5],
    [IMPACT - 1, -4],
    [IMPACT + 9, -3],
    [BRAND_AT - 1, -5],
    [BRAND_AT + vFrames(BRAND) - 8, -5],
    [PRESS, 1.5],
    [END - b(2), 0],
    [END, -6],
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
  // (film 2's insert rides 1 dB further into a clipper .5 dB higher than film 1's: its loudest dialogue — the narrator's
  // openings — sits closer to the impact than film 1's did, and the hit must still top it by MIX.impact.lead)
  impact: { ...MIX1.impact, at: IMPACT, rideDb: MIX1.impact.rideDb + 1, ceil: MIX1.impact.ceil + 0.5, hold: [0, Math.max(3, NAME_GAP - 2)] as const, release: Math.max(6, NAME_GAP + 1) },
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

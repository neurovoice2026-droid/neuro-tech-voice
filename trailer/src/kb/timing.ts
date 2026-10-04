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
  /* ── the picture's own moments (scenes/repeat/desk.ts, Clock.tsx) ── */
  /** the clock's figures start rolling this long before the ring / roll they land on (the hour strips first) */
  flickLead: { ring: 6.5, roll: 4.2 } as const,
  /** answers 2 and 3: a fresh slip is slid up from the desk's front edge over `placeDur`, arriving a frame
   *  before the desk's first word (`placeLead` before it); the first answer is the pad's own top sheet */
  placeDur: 13,
  placeLead: 14,
  /** each call ends (its ● CALLER and its line draw back in): calls 1–2 as their slip lands; the third line
   *  stays open, flat, through the dead air, to the first roll */
  hangups: [R_SLIP[0], R_SLIP[1], ROLL0] as readonly number[],
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
    /** "Waiting." locks in ON the bar */
    waiting: L('recording', WAITING),
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
 *  the tab to the field plus the 6 f read before a press, and ≈ 12 f + 6 back off the keys to Save). The voiced timeline
 *  (CARET, SAVE, VO6_AT above) gives b12 the script's own plan — the caret a beat in, vo-6 105 f in — so:
 *    · room (vo6 ≥ 157.5)   the page comes back on Knowledge; tab on beat 2 → field → the words → Save → vo-6
 *    · no room (this take set)   the page comes back already on Conversation (the tab click does not fit: it would have
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
    /** room for v2's full order (see above) — false for this take set */
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
  /** b14 · the app steps back a beat before the ring; the new row lifts out of it and unfolds into its page */
  const recede = [ring - BEAT, ring + 13] as const;
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
    pointerOut: replace.up + 8,
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
    /** b14: the app steps back a depth and slides away down (a beat before the ring — the rows step back); the new row
     *  lifts out of it and unfolds into its page (Saturday · 9:00–16:00), its lines rising on 16ths */
    recede,
    lift: [recede[0], recede[0] + 8] as const,
    unfold: [recede[0] + 4, recede[1]] as const,
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
     *  MattersDesk at its first picture), wiping on in the reading direction (16:9 left → right, 9:16 top → bottom);
     *  the call's type leaves up through its masks just ahead of the front */
    lcut,
    cross: [lcut + 2, end] as const,
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
    dash: [0, 3] as const,
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
     *  the breath); 9:16: the clock's figures and labels leave up and the teal dot rises above the title */
    b16,
    push: [b16, end] as const,
    clockOut: [b16, b16 + 10] as const,
    dotRise: [b16, b16 + 36] as const,
    /** 9:16: the desk reframes down under the title (done before "only" rises) */
    reframe: [b16, b16 + 44] as const,
    vo8: L('matters', VO8_AT),
    /** "That's the work / only people can do." — each word rises on its spoken onset */
    vo8Words: vo8Words as readonly number[],
    /** "do.": the key phrase eases into sunday ink as the glint runs through it … */
    do: doAt,
    key: doAt,
    /** … and the old slip stack lifts from the desk's edge (on the 16th) and glides off toward the teal dot, the
     *  slips a cascade (each `stagger` behind the one above), EASE.inOut */
    stack: { lift, glide: [lift + 1, lift + 1 + 38] as const, stagger: 2.5, n: 5 },
    /** the title leaves up through its masks as the room goes dark */
    titleOut: dark[0] + 6,
    /** the paper darkens into night over three beats (80.5–82.0 on the plan), landing on the close's bar; the
     *  teal dot becomes the key light; the desk's type and the clock fade with the light */
    dark,
    fade: [dark[0] + 6, end - 3] as const,
  };
})();

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

/**
 * The voice post (a fader on part of a line; frames from the line's own start). kb2-desk-1 is Leo's take-1, the only
 * take that keeps Part I on the script's grid (voice-candidates/kb/PICKS.md); it peaks on "Saturdays," (−1.5 dBFS at
 * −23 LUFS), so the dialogue bus limiter (MIX.dialogueCeil) clamps that word ~9 dB and master()'s trim passes leave
 * the line 0.6 LU under the dialogue target (check-mix: −20.6). Riding the word 2 dB down, ramped inside the commas
 * around it, evens the line (its direction: "even, unhurried rhythm") and lands every placement at −20.3 LUFS.
 */
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = (() => {
  const sat = VOICE.lines['kb2-desk-1'].phrases[1]; // "Saturdays,"
  return { 'kb2-desk-1': [{ from: Math.floor(sat.start * FPS), to: Math.ceil(sat.end * FPS), db: -2, ramp: 3 }] };
})();

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
/* ── repeat ── (b01–b05: picture src/kb/scenes/Repeat.tsx + scenes/repeat/*; pans from the 16:9 layout:
 * the card .3, the clock .84, the pad .78, the callers .55–.7)
 * FILM-2 EXTRAS this act asks the sound pass for (film 1 stand-ins below until they exist; each label
 * names its extra in [→ …]):
 *   fx-trill        the desk phone: ONE two-chirp trill tuned G#4/B4 (score in E), the same sample for every
 *                   ring of the film; each ring is CUT by its pickup click — ring 1 after 2 chirps (15 f),
 *                   ring 2 after 1½ (7.5 f), ring 3 after 1 (3.75 f); b05's rolls: one short chirp each
 *   fx-slip         a slip landing on the pile: dry paper slap + a soft low desk thud (no ring-out)
 *   fx-slip-slide   a fresh slip slid up over the pile: a short, soft paper slide (−6 dB under the slap)
 *   fx-cup          a ceramic cup set down on a wooden desk: a soft clack with a little body
 *   fx-linehiss     b04's dead line: half a beat (7.5 f) of open phone-line hiss, nothing else
 *   (fx-roomtone)   front-desk room tone (soft HVAC, far street) at −52 dBFS from frame 0, running on
 *                   through the hard stop — a bed element, not a hit
 * THE HARD STOP (REPEAT_LOCAL.hardStop) has NO hit: music and every effect are cut on the sample there,
 * with no tail (the last roll's chirp and slap ring into it); room tone only. */
const REPEAT_HITS: Hit<Snd>[] = (() => {
  const R = REPEAT_LOCAL;
  const RING = ['ONE', 'TWO', 'THREE'];
  const CUT = ['2 chirps', '1½ chirps', '1 chirp'];
  const CALLER_X = [0.7, 0.64, 0.56];
  const n = R.rolls.length;
  const run = { n, step: BEAT / 2 };
  return [
    H(R.cup, 'tap', 'none', 0.3, 3, 'b01 a cup set down on wood [→ fx-cup]', { db: -3 }),
    H(R.dash, 'click', 'none', 0.36, 3, 'b01 the em dash is drawn: the pen click as it lands', { db: -4 }),
    ...R.rings.flatMap((ring, k) => [
      H(ring - R.flickLead.ring, 'flick', 'none', 0.84, 3, `ring ${k + 1}: the clock's figures roll, landing on the ring`),
      H(ring, 'ring-hook', 'none', 0.84, k === 0 ? 1 : 2, `RING ${RING[k]}: the desk trill, the rose line light pulses [→ fx-trill, cut by the pickup after ${CUT[k]}]`),
      H(R.pickups[k], 'pickup', 'none', 0.84, 2, `ring ${k + 1}: picked up (the handset click cuts the trill)`),
      H(R.callers[k] - 2, 'line', 'none', CALLER_X[k], 3, `caller ${k + 1}: the line draws out under the caption`, { db: -4 }),
      ...(k ? [H(R.desk[k] - R.placeLead, 'swish', 'none', 0.78, 3, `answer ${k + 1}: a fresh slip slid up over the pile [→ fx-slip-slide]`, { db: -8 })] : []),
      H(R.slips[k], 'land', 'none', 0.78, 2, `answer ${k + 1}: the slip drops onto the pile on "two."${k === 2 ? ' (crooked)' : ''} [→ fx-slip]`),
      H(R.slips[k], 'tap', 'none', 0.78, 3, `answer ${k + 1}: the paper slap`, { layer: true, db: -2 }),
    ]),
    H(R.dead[0], 'line', 'none', CALLER_X[2], 3, 'b04 the dead line: the waveform lies flat, line hiss only [→ fx-linehiss]', { db: -8 }),
    ...(n
      ? [
          H(R.rolls[0] - R.flickLead.roll, 'flick', 'none', 0.84, 3, 'b05 the clock rolls on 8ths', { run }),
          H(R.rolls[0], 'ping', 'rush', 0.84, 3, 'b05 a chirp per roll, the rose pulse [→ fx-trill, one short chirp]', { run }),
          H(R.rolls[0] + BEAT / 8, 'pickup', 'none', 0.84, 3, 'b05 picked up, each time', { run, db: -5 }),
          H(R.rollSlips[0], 'land', 'none', 0.78, 3, 'b05 a slip per roll: slipped in behind the pile, up one strip [→ fx-slip]', { run }),
        ]
      : []),
  ];
})();
/* ── /repeat ── */

/* ── recording ── (b06: picture src/kb/scenes/Recording.tsx + scenes/recording/*; pans from the 16:9 layout:
 * the pile .72 → the column .3, the titles .3, the card .7)
 * The act is ROOM TONE ONLY (SCRIPT.md b06): the bus cut at the hard stop holds; the bed's one low felt-piano
 * E2 under "brilliant" is MUSIC.brilliant (scripts/kb/bed.mjs). Everything below is quiet paper and one note.
 * FILM-2 EXTRAS this act asks the sound pass for (film 1 stand-ins below until they exist; labels say [→ …]):
 *   fx-paper-square  the pile picked up: a small stack squared against the desk and lifted — two soft dry
 *                    paper taps and a breath of air, no thud (≈ .25 s)
 *   fx-paper-fold    a pad sheet folding to a strip: a soft paper crease and slide, no tone (≈ .3 s)
 *   fx-riffle        the deal: ONE dry paper tick per strip landing on the one below (8 on 16ths), each a
 *                    touch darker than the last; faint (the script's "faint paper riffle")
 *   fx-scroll        the teleprompter: a faint continuous paper drag under the column's scroll (≈ 4 s,
 *                    fading in over a beat, cut when the camera leaves the column)
 *   (the B5)         "Waiting.": a single high B5 that does not resolve — film 1's ding-s IS a B5 bell
 *                    (scripts/audio/sounds.mjs: bellVoice(1.6, B5)); light 'none' keeps it on B */
const RECORDING_HITS: Hit<Snd>[] = (() => {
  const R = RECORDING_LOCAL;
  const at = (f: number) => SCENES.recording.from + f;
  const deal = R.fan.slice(1);
  return [
    H(at(R.slide[0] + 1), 'tap', 'none', 0.72, 3, 'b06 the pile is squared and picked up off the pad [→ fx-paper-square]', { db: -10 }),
    H(at(R.morph), 'draw', 'none', 0.62, 3, 'b06 the pad sheets fold to one line each [→ fx-paper-fold]', { db: -10 }),
    H(at(R.title1), 'sheen', 'none', 0.3, 3, 'b06 "You hired someone brilliant." rises (on "You")', { db: -8 }),
    ...(deal.length
      ? [H(at(deal[0]), 'tap', 'none', 0.3, 3, 'b06 the strips deal down into one column, one per 16th [→ fx-riffle]', { db: -12, run: { n: deal.length, step: BEAT / 4, semi: -0.4 } })]
      : []),
    H(at(R.fan[R.fan.length - 1] + 12), 'draw', 'none', 0.3, 3, 'b06 the column starts to scroll: a teleprompter of the same line [→ fx-scroll]', { db: -14 }),
    H(at(R.title2), 'sheen', 'none', 0.3, 3, 'b06 "The phone turned them / into a recording." rises (on "The")', { db: -8 }),
    H(WAITING, 'ding-s', 'none', 0.25, 2, 'b06 "WAITING." locks on the bar: a single high B5 that does not resolve'),
  ];
})();
/* ── /recording ── */

/* ── turn ── (b07: picture src/kb/scenes/Turn.tsx + scenes/turn/*; pans from the 16:9 layout: the seam .5,
 * the repeat half .22–.38 (the clock .12, the orb .28, "repeats." .38), the matters half .6–.8)
 * The Part I loop's one deadpan bar under "Some work repeats." and the harmony opening on "Some work matters."
 * are the bed's (MUSIC.turn, MUSIC.matters). Everything below is small: a line, flaps, a light, paper.
 * FILM-2 EXTRAS this act asks the sound pass for (film 1 stand-ins below until they exist; labels say [→ …]):
 *   fx-flap        the flip window: ONE split-flap tick — a light paper-card flap snapping down onto its stop
 *                  (a dry click with a hint of hollow body, ≈ 40 ms, no ring), the SAME sample on every beat
 *                  (deadpan, never varied), quiet under the voice; it lands ON the beat
 *   fx-seed        the rose line light lifting off the clock: a soft rising sine seed (B4 → E5, ≈ .35 s, a
 *                  breath of air on it) swelling into the open on "Ava"; it ends where the "ting" begins
 *   (the ting)     on "Ava", with the hairline ring: one sine "ting" — film 1's ping on the sunday light
 *   (fx-slip-slide) the quiet paper slide (b02's extra) on "the first kind": the repeat side easing toward her
 * The desk sorting itself on the seam (the card's glide) rides under the seam's draw: no second air sound there
 * (two air hits ≤ 2 f apart merge in buildCues anyway). */
const TURN_HITS: Hit<Snd>[] = (() => {
  const R = TURN_LOCAL;
  const at = (f: number) => SCENES.turn.from + f;
  return [
    H(at(R.seam[0]), 'draw', 'none', 0.5, 3, 'b07 THE SEAM draws on the beat, over one beat (16:9 top → bottom, 9:16 left → right)'),
    ...(TURN_FLIPS.length
      ? [H(at(TURN_FLIPS[0]), 'flick', 'none', 0.38, 3, 'b07 "repeats." flips over — to the same word — on every beat [→ fx-flap, one sample]', { db: -6, run: { n: TURN_FLIPS.length, step: BEAT } })]
      : []),
    H(at(R.lift), 'sheen', 'rush', 0.18, 3, 'b07 the rose line light lifts off the clock (on "I’m") [→ fx-seed]', { db: -8 }),
    H(at(R.ava), 'pop', 'sunday', 0.28, 2, 'b07 AVA: the line light springs open into her orb (on "Ava"), rush → sunday', { db: -3 }),
    H(at(R.ava + 3), 'ping', 'sunday', 0.28, 2, 'b07 the hairline ring leaves her rim: one sine "ting"', { layer: true }),
    H(at(R.firstKind), 'swish', 'none', [0.32, 0.28], 3, 'b07 "the first kind": the flips have stopped; the repeat side eases toward her light [→ fx-slip-slide]', { db: -10 }),
  ];
})();
/* ── /turn ── */

/* ── written ── (b08: picture src/kb/scenes/Written.tsx + scenes/written/*; pans from the 16:9 layout: the corner
 * (the orb, the slips) .17, the panel .32–.95 — its Knowledge tab .75, the web page field / Add page .47, the list .78)
 * The Part III bed (felt-piano eighths, a soft kick on beats 1 and 3, E – C#m7 – Amaj7 – B) is the bed's
 * (MUSIC.written). The CURSOR's clicks are TWO-PART (CLIENT DIRECTION v2 §3): one sound on the press, one on the
 * release (the press and release frames come from WRITTEN_LOCAL; the picture's pointer uses the same frames).
 * FILM-2 EXTRAS this act asks the sound pass for (film 1 stand-ins below until they exist; labels say [→ …]):
 *   fx-click-down  a mouse / trackpad button going down: a tight dry plastic tick (≈ 8 ms) with a little low body
 *   fx-click-up    its release: lighter and a touch higher, ≈ 5 dB under the down, no body
 *   fx-tuck        a slip sliding up under the pile: a short dry paper click-slide; the run steps down in pitch
 *   fx-settle      the pile settling: a soft low paper thud, no ring
 *   fx-tock        a row landing in the list: a pitched paper "tock" tuned to the bar's chord (semis from E given)
 *   fx-tick-roll   a pill rolling Reading… → Ready: a tiny tick, under the mallet
 *   fx-mallet      each Ready: one soft mallet note rising up the E major pentatonic, E4 · F#4 · G#4 · B4 (the
 *                  phrase is left open: its fifth note, E5, lands in b13 — CHANGE_LOCAL.ready5)
 *   fx-keys        soft low-profile keystrokes: one per character, on 32nds (a quick, light run, not a typewriter)
 *   fx-felt-e      the eyebrow: one soft felt-piano E4 */
const WRITTEN_HITS: Hit<Snd>[] = (() => {
  const R = WRITTEN_LOCAL;
  const at = (f: number) => SCENES.written.from + f;
  const S16 = BEAT / 4;
  const S32 = BEAT / 8;
  const NAMES = ['PDF · Price list lands', 'TXT · Opening hours slots in (from its flight)', 'DOCX · Cancellation policy lands', 'URL · FAQ page lands'];
  const TOCK = [0, 4, 7, 9]; // chord tones under each landing (E · G# · B · C#), from E
  const MALLET = ['E4', 'F#4', 'G#4', 'B4'];
  const MALLET_SEMI = [-7, -5, -3, 0]; // ding-s is a B5 bell: E5 F#5 G#5 B5 until fx-mallet exists
  return [
    H(at(R.seam[0]), 'draw', 'none', 0.5, 3, 'b08 the seam draws back the way it came; her ground floods the other half', { db: -12 }),
    H(at(R.panel[0] + 4), 'whoosh-soft', 'none', [0.86, 0.66], 3, 'b08 the app comes in (16:9 from the right, 9:16 up from under the seam)', { db: -10 }),
    H(at(R.tab.down), 'click', 'none', 0.75, 2, 'b08 the cursor presses the Knowledge tab [→ fx-click-down]', { db: -3 }),
    H(at(R.tab.up), 'tap', 'none', 0.75, 3, 'b08 … and releases it [→ fx-click-up]', { db: -8 }),
    H(at(R.tab.up + 1), 'draw', 'none', 0.72, 3, 'b08 the underline springs across to Knowledge; the tab content swaps through its mask', { db: -14 }),
    H(at(R.collapse[0]), 'tap', 'none', 0.17, 3, 'b08 "once": the slips stack up into one, one per 16th, each a touch lower [→ fx-tuck]', {
      db: -9,
      layer: true,
      run: { n: R.collapse.length, step: S16, semi: -0.6 },
    }),
    H(at(R.collapse[R.collapse.length - 1] + 2 * S16), 'land', 'none', 0.17, 3, 'b08 the pile settles, its shadow deep [→ fx-settle]', { db: -8 }),
    H(at(R.born), 'draw', 'none', 0.18, 3, 'b08 the last slip draws its edges into a document row: TXT · Opening hours, Reading…', { db: -12 }),
    H(at(R.fly[0] + 3), 'swish', 'none', [0.2, 0.74], 3, 'b08 the Opening hours row flies from the corner into the list', { db: -12 }),
    ...R.rows.map((r, i) =>
      H(at(r), 'tick', 'none', i === 1 ? 0.74 : 0.78, 3, `b08 ${NAMES[i]} on top of the list; the Knowledge badge ${i ? 'ticks to' : 'opens at'} ${i + 1} [→ fx-tock, tuned to the chord]`, {
        semi: TOCK[i],
        db: -4,
      }),
    ),
    ...R.ready.map((r, i) =>
      H(at(r), 'ding-s', 'sunday', 0.8, 3, `b08 Ready ${i + 1}: the pill rolls Reading… → Ready [→ fx-mallet ${MALLET[i]} + fx-tick-roll]`, { semi: MALLET_SEMI[i], db: -4 }),
    ),
    H(at(R.field.down), 'click', 'none', 0.47, 3, 'b08 the cursor (an I-beam) presses into the web page field [→ fx-click-down]', { db: -6 }),
    H(at(R.field.up), 'tap', 'none', 0.47, 3, 'b08 … released: the field takes its focus ring [→ fx-click-up]', { db: -10 }),
    H(at(R.keys[0]), 'key', 'none', 0.47, 3, 'b08 https://your-site/faq types, one character per 32nd [→ fx-keys]', { db: -8, layer: true, run: { n: R.keys.length, step: S32 } }),
    H(at(R.add.down), 'click', 'none', 0.47, 2, 'b08 Add page: pressed [→ fx-click-down]', { db: -3 }),
    H(at(R.add.up), 'tap', 'none', 0.47, 3, 'b08 … released (the FAQ page lands a 16th later and the field clears) [→ fx-click-up]', { db: -8 }),
    H(at(R.knowledge), 'chime-sunday-soft', 'sunday', 0.36, 3, 'b08 "knowledge": the eyebrow ● KNOWLEDGE BASE rises above the panel [→ fx-felt-e, one soft felt-piano E4]', { db: -8 }),
  ];
})();
/* ── /written ── */

/* ── call ── (b09–b11: picture src/kb/scenes/Call.tsx + scenes/call/*; pans from the 16:9 layout: the orb .23 in
 * b09, the call strip .55 (b10's frozen question .25), the panel .6 → off right, the Opening hours page .72, the
 * hairlines .45 → .55, her answer .3, the record row .3)
 * The bed's part (MUSIC.call / .freeze / .resume): it ducks under the call; on the freeze its beat drops out and a
 * sustained E add9 holds (time has stopped); it returns on the beat at the resume (50.0 on the plan).
 * NO CURSOR in this act (Ava takes the call alone): no click sounds here.
 * FILM-2 EXTRAS this act asks the sound pass for (film 1 stand-ins below until they exist; labels say [→ …]):
 *   fx-trill        (b02's) the same desk trill sample, CUT after its first chirp by the pickup click an 8th later
 *   fx-slip-slide   (b02's) the panel stepping back and sliding away; the Opening hours row coming back on "check"
 *   fx-linehiss     (b04's) a very low, continuous open-line hiss under the stop-time, freeze → resume, ≈ 6 dB under
 *                   b04's dead line; it lets go on the resume
 *   fx-paper-unfold the row opening out into a full page: a soft, dry sheet flexing open (≈ .45 s, no tone)
 *   fx-felttip      (SCRIPT extras) the sweep: a soft felt-tip swipe (≈ .5 s); the underline: a shorter, lighter one
 *   fx-scratch      a fine pen scratch under each hairline as it draws (≈ .25–.35 s, very quiet, high-passed)
 *   fx-pluck        the hairline landing: one soft pitched pluck (nylon / kalimba, short decay) — E4 · G#4 · B4 ·
 *                   F#4 on four 8ths, building the chord (film 1's ping, tuned, stands in: semis from its B)
 *   fx-paper-lift   the two swept lines peeled off the page as their own layer: a light dry paper lift (≈ .2 s)
 *   fx-tick-soft    one very quiet tick per word the re-set lands, on its 16th (−28 dB — under the voice)
 *   fx-record       the strip folding into the record row: a paper click with a little body, then the check's tick */
const CALL_HITS: Hit<Snd>[] = (() => {
  const R = CALL_LOCAL;
  const at = (f: number) => SCENES.call.from + f;
  const PLUCK = [-7, -3, 0, -5]; // E · G# · B · F# from ping's B
  const LINK = ['the hero hairline from "weekend" lands on the swept lines; MATCHED ON MEANING', '"Are you open on Saturdays?" sends its hairline', '"Can I pop in on Saturday?" sends its hairline', '"What are your weekend hours?" sends its hairline'];
  return [
    H(at(R.ring), 'ring-hook', 'none', 0.23, 2, 'b09 THE LIVE CALL rings on the bar; one slate hairline leaves the orb [→ fx-trill, cut after one chirp by the pickup]', { db: -2 }),
    H(at(R.recede[0] + 2), 'swish', 'none', [0.62, 0.95], 3, 'b09 the app panel steps back a depth and slides away (16:9 right, 9:16 down) [→ fx-slip-slide]', { db: -11 }),
    H(at(R.pickup), 'pickup', 'none', 0.23, 2, 'b09 picked up on the first ring: the orb wakes to listen; ● CALLER and the timer rise'),
    H(at(R.c4 - 2), 'line', 'none', 0.55, 3, 'b09 the caller’s line draws out under his words', { db: -5 }),
    H(at(R.rowIn[0] + 2), 'swish', 'none', [0.98, 0.8], 3, 'b09 "…let me check.": the Opening hours row comes back (16:9 in from the right; 9:16 lifted out of the panel) [→ fx-slip-slide]', { db: -12 }),
    H(at(R.freeze), 'freeze', 'none', 0.5, 2, 'b10 THE FREEZE: the call stops, BETWEEN QUESTION AND ANSWER [+ fx-linehiss, very low, to the resume]', { db: -3 }),
    H(at(R.unfold[0] + 2), 'draw', 'none', 0.72, 3, 'b10 the row unfolds into the full Opening hours page [→ fx-paper-unfold]', { db: -10 }),
    H(at(R.sweep), 'draw', 'none', 0.7, 3, 'b10 "the part that answers them": the sunday sweep under Saturday [→ fx-felttip]', { db: -6 }),
    H(at(R.sweep + BEAT / 4), 'draw', 'none', 0.7, 3, 'b10 … and under Sunday, a 16th behind [→ fx-felttip]', { db: -9, layer: true }),
    H(at(R.underline), 'draw', 'none', 0.22, 3, 'b10 "around this weekend" takes a slate underline [→ fx-felttip, short and light]', { db: -12 }),
    ...R.links.flatMap((f, i) => [
      H(at(R.linkStart[i]), 'sheen', 'none', i ? 0.4 : 0.36, 3, `b10 hairline ${i + 1}: the pen draws [→ fx-scratch]`, { db: i ? -16 : -13, layer: true }),
      H(at(f), 'ping', 'sunday', 0.62, 3, `b10 ${LINK[i]} [→ fx-pluck ${['E4', 'G#4', 'B4', 'F#4'][i]}]`, { semi: PLUCK[i], db: i ? -3 : 0 }),
    ]),
    H(at(R.resume), 'whoosh-soft', 'none', 0.5, 3, 'b11 TIME RESUMES on the bar: the label and the phrasings leave, the orb comes out of the dot (the line hiss lets go)', { db: -8 }),
    H(at(R.lift[0]), 'swish', 'none', [0.68, 0.6], 3, 'b11 the two swept lines lift out of the page as their own layer [→ fx-paper-lift]', { db: -13, layer: true }),
    ...R.resetTicks.map((f, k) => H(at(f), 'tick', 'none', R.reset[k].from ? 0.45 : 0.3, 3, `b11 the re-set: "${VOICE.lines['kb2-call-2'].words[k].w}" lands${R.reset[k].from ? ' (kept from the page)' : ''} [→ fx-tick-soft, −28 dB]`, { db: -17 })),
    H(at(R.record), 'click', 'none', 0.3, 3, 'b11 the strip folds into the white record row [→ fx-record, the paper click]', { db: -4 }),
    H(at(R.record + 1), 'tap', 'none', 0.3, 3, 'b11 … the card’s body settling', { db: -9, layer: true }),
    H(at(R.check), 'tick', 'sunday', 0.48, 3, 'b11 the white check draws in the sunday disc: Answered from your documents [→ fx-record, the check tick]', { db: -3 }),
  ];
})();
/* ── /call ── */

/* ── line ── (b12: picture src/kb/scenes/Line.tsx + scenes/line/*; pans from the 16:9 layout: the Conversation tab .32,
 * the field — each keystroke panned (narrowly, .38–.62) to where its word lands (16:9 sets the line a sentence per row) —
 * Save changes .73)
 * The bed thinning to piano and pad is the bed's (MUSIC.line). The CURSOR's clicks are TWO-PART (CLIENT DIRECTION v2 §3):
 * one sound on the press, one on the release (LINE_LOCAL's frames — the picture's pointer uses the same frames).
 * FILM-2 EXTRAS this act asks the sound pass for (film 1 stand-ins below until they exist; labels say [→ …]):
 *   fx-click-down / fx-click-up   (b08's) the mouse button going down / coming up
 *   fx-keys        (b08's soft low-profile keystrokes) — here ONE per WORD on 16ths: a word's last key, a touch rounder
 *                  than b08's character run, no typewriter bell, no ring; even in level across the line
 *   fx-glass-tick  "words": the sunday focus ring settling round the field — one small glassy tick (a high sine / glass
 *                  transient near E6, ≈ 60 ms, a breath of air on it), quiet under her voice
 * (the save tick) the press on Save changes carries a tiny pitched tick (film 1's tick, sunday-tuned) layered on the click.
 * The amber dot and the buttons waking ride the first keystroke; nothing sounds for the pointer's moves. */
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
  const SAVE = 0.73;
  return [
    H(at(R.leave[0] + 2), 'whoosh-soft', 'none', [0.42, 0.52], 3, 'b12 the call’s record row leaves up; the agent page rises in', { db: -12 }),
    ...(R.tab
      ? [
          H(at(R.tab.down), 'click', 'none', 0.32, 2, 'b12 the cursor presses the Conversation tab [→ fx-click-down]', { db: -3 }),
          H(at(R.tab.up), 'tap', 'none', 0.32, 3, 'b12 … and releases it [→ fx-click-up]', { db: -8 }),
          H(at(R.tab.up + 1), 'draw', 'none', [0.62, 0.34], 3, 'b12 the underline springs back to Conversation; the tab content swaps through its mask', { db: -14 }),
        ]
      : []),
    H(at(R.field.down), 'click', 'none', FIELD, 3, 'b12 the I-beam presses into the field: focus, the caret [→ fx-click-down]', { db: -5 }),
    H(at(R.field.up), 'tap', 'none', FIELD, 3, 'b12 … released [→ fx-click-up]', { db: -10 }),
    H(at(R.keys[0]), 'key', 'none', xs[0], 3, `b12 the owner’s line types, one soft keystroke per word on 16ths (${R.keys.length}); the amber unsaved dot opens on the first [→ fx-keys]`, {
      db: -7,
      layer: true,
      run: { n: R.keys.length, step: S16, xs },
    }),
    H(at(R.saveClick.down), 'click', 'none', SAVE, 2, 'b12 Save changes: pressed [→ fx-click-down]', { db: -3 }),
    H(at(R.saveClick.down), 'tick', 'sunday', SAVE, 3, 'b12 the save tick', { layer: true, db: -8 }),
    H(at(R.saveClick.up), 'tap', 'none', SAVE, 3, 'b12 … released: the amber dot closes [→ fx-click-up]', { db: -8 }),
    H(at(R.focus), 'glint', 'sunday', FIELD, 3, 'b12 "words": the sunday focus ring settles round the field [→ fx-glass-tick]', { db: -9 }),
  ];
})();
/* ── /line ── */

/* ── change ── (b13–b14: picture src/kb/scenes/Change.tsx + scenes/change/*; pans from the 16:9 layout: the owner's
 * file .62 ("14:00" .65), the agent page .5 (the old row's … .83, "Replace with new file" .8, the list's top slot .52),
 * the parked file .76; b14: the orb .11, the call transcript .3, SAME QUESTION .32, the page .75)
 * The bed's part (MUSIC.change / .ready5 / .ring14): the fifth Ready mallet's chord, the lift into the next call with a
 * high piano line. The CURSOR's clicks are TWO-PART (CLIENT DIRECTION v2 §3): one sound on the press, one on the release
 * (CHANGE_LOCAL's frames — the picture's pointer uses the same frames).
 * FILM-2 EXTRAS this act asks the sound pass for (film 1 stand-ins below until they exist; labels say [→ …]):
 *   fx-click-down / fx-click-up   (b08's) the mouse button going down / coming up
 *   fx-select      NEW: the drag-selection snapping across "14:00" — a very short, soft high tick (≈ 15 ms, no tone,
 *                  quieter than the click-up), layered on the release
 *   fx-keys        (b08's soft low-profile keystrokes) — here one per CHARACTER of "16:00", on 16ths (five), a touch
 *                  brighter than b12's word-keys; no typewriter bell
 *   fx-menu-open   NEW: the dropdown opening from its trigger — a soft, low, dry "pop" of a light panel (≈ 30 ms, a breath
 *                  of air, no pitch), under the click-up
 *   fx-slip-slide  (b02's) the app panel rising / stepping back; the edited file dropping into the list
 *   fx-tock        (b08's) the new row landing on top of the list — a pitched paper "tock" on E (the badge ticks to 5)
 *   fx-tick-roll   (b08's) a soft rolling tick under the Reading… spinner, Reading → Ready
 *   fx-mallet      (b08's) the FIFTH Ready note, E5 (the octave of b08's E4): it completes the phrase E4 F#4 G#4 B4 · E5
 *   fx-paper-lift  (b11's) the old row leaving up through its mask
 *   fx-paper-unfold (b10's) the new row opening out into its page
 *   fx-trill       (b02's) the same desk trill sample, cut after one chirp by the pickup click an 8th later
 *   fx-tag         NEW: SAME QUESTION popping beside ● CALLER — a small dry card tick with a hint of body (≈ 25 ms), the
 *                  same family as the card ticks; b10's MATCHED ON MEANING tag rose without one: quiet, under Dana's last word
 *   fx-felttip     (b10's) the sunday sweep under the new Saturday line on "four"
 *   fx-pluck       (b10's family) a BRIGHT pluck on "four" with the sweep — E5 here (the key's tonic, high), short decay
 * The L-cut's crossing into b15 rides on the bed's own move (MUSIC.desk): one soft air under the wipe, nothing more. */
const CHANGE_HITS: Hit<Snd>[] = (() => {
  const R = CHANGE_LOCAL;
  const at = (f: number) => SCENES.change.from + f;
  const S16 = BEAT / 4;
  return [
    H(at(R.page[0]), 'whoosh-soft', 'none', [0.5, 0.62], 3, 'b13 the app sinks back; the owner’s own file (opening-hours.txt) comes forward', { db: -13 }),
    H(at(R.drag.down), 'click', 'none', 0.62, 3, 'b13 "Hours change?": the I-beam presses on 14:00 — the caret clicks in [→ fx-click-down]', { db: -5 }),
    H(at(R.drag.up), 'tap', 'none', 0.66, 3, 'b13 … dragged across 14:00 and released: selected, the sunday wash [→ fx-click-up]', { db: -9 }),
    H(at(R.drag.up), 'tick', 'sunday', 0.66, 3, 'b13 the selection snaps across the digits [→ fx-select]', { db: -16, layer: true }),
    H(at(R.keys[0]), 'key', 'none', 0.66, 3, 'b13 16:00 typed over it, one keystroke per 16th (five) — the last on "Change" [→ fx-keys]', {
      db: -7,
      layer: true,
      run: { n: R.keys.length, step: S16 },
    }),
    H(at(R.app[0] + 2), 'swish', 'none', [0.5, 0.5], 3, 'b13 "Change the document": the agent page rises on Knowledge; the file steps up into the corner [→ fx-slip-slide]', { db: -12 }),
    H(at(R.menu.down), 'click', 'none', 0.83, 3, 'b13 the cursor presses the Opening hours row’s … [→ fx-click-down]', { db: -4 }),
    H(at(R.menu.up), 'tap', 'none', 0.83, 3, 'b13 … released: the menu opens — Read again · Replace with new file · Remove [→ fx-click-up]', { db: -8 }),
    H(at(R.menu.up + 0.5), 'pop', 'none', 0.81, 3, 'b13 the menu opens from its trigger [→ fx-menu-open]', { db: -15, layer: true }),
    H(at(R.replace.down), 'click', 'none', 0.8, 2, 'b13 "Replace with new file" pressed (.97, the pressed shade) [→ fx-click-down]', { db: -3 }),
    H(at(R.replace.up), 'tap', 'none', 0.8, 3, 'b13 … released: the menu closes [→ fx-click-up]', { db: -8 }),
    H(at(R.fly[0] + 1), 'swish', 'none', [0.76, 0.52], 3, 'b13 the edited file drops into the list as the new version [→ fx-slip-slide]', { db: -12 }),
    H(at(R.land), 'tick', 'none', 0.52, 3, 'b13 the new row lands on top: TXT · Opening hours · Reading…; the badge ticks to 5 [→ fx-tock, on E]', { db: -4 }),
    H(at(R.land + 2 * S16), 'tick', 'none', 0.6, 3, 'b13 Reading… — the old row still Ready [→ fx-tick-roll, under the spinner]', { db: -20, run: { n: 4, step: S16 } }),
    H(at(R.ready5), 'ding-s', 'sunday', 0.6, 3, 'b13 "the new answer": Ready · 1 passage — the FIFTH mallet completes b08’s phrase [→ fx-mallet E5, the octave] (ding-s an octave up, as b08’s)', { semi: 5 }),
    H(at(R.oldOut + 1), 'swish', 'none', 0.5, 3, 'b13 the old row leaves up through its mask; the badge back to 4 [→ fx-paper-lift]', { db: -16, layer: true }),
    H(at(R.recede[0] + 1), 'swish', 'none', [0.5, 0.5], 3, 'b14 the app steps back and slides away; the new row lifts out of it [→ fx-slip-slide]', { db: -12 }),
    H(at(R.unfold[0] + 2), 'draw', 'none', 0.75, 3, 'b14 the new row unfolds into its page: Saturday · 9:00–16:00 [→ fx-paper-unfold]', { db: -11 }),
    // (film 1's ring burst cannot be cut by the pickup like the script's trill: it steps back under Dana's "Quick")
    H(at(R.ring), 'ring-hook', 'none', 0.15, 2, 'b14 THE NEXT CALL rings (beat 3): one slate hairline leaves the orb [→ fx-trill, cut after one chirp by the pickup]', { db: -4 }),
    H(at(R.pickup), 'pickup', 'none', 0.15, 2, 'b14 picked up on the first ring: she listens; ● CALLER rises'),
    H(at(R.c2 - 2), 'line', 'none', 0.3, 3, 'b14 Dana’s line draws out under her words — b03’s identical recording', { db: -5 }),
    H(at(R.chip), 'tap', 'none', 0.32, 3, 'b14 SAME QUESTION pops beside ● CALLER, on "Saturday?" [→ fx-tag]', { db: -10 }),
    H(at(R.sweep[0]), 'draw', 'none', 0.75, 3, 'b14 "four.": the sunday sweep under Saturday · 9:00–16:00 [→ fx-felttip]', { db: -6 }),
    H(at(R.sweep[0]), 'ping', 'sunday', 0.75, 2, 'b14 … and the bright pluck on "four" [→ fx-pluck, bright E5]', { semi: 5, db: -3, layer: true }),
    H(at(R.cross[0]), 'whoosh-soft', 'none', [0.3, 0.7], 3, 'b14 THE L-CUT under her last word: the frame crosses to the desk (the wipe, reading direction)', { db: -16 }),
  ];
})();
/* ── /change ── */

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

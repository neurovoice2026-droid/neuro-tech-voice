/**
 * REEL 1 · "Not even ours" — every timing constant of the reel (docs/ig/SCRIPT.md "ig1", PIPELINE.md §6.1).
 * Plan 26.0 s · 13 bars (impact f720). WITH THE INSTALLED TAKES (voice-candidates/ig/PICKS.md): 28.0 s · 14 bars ·
 * 840 timeline frames (3360 at 120 fps), impact f780 (bar 14), END f840 — the script's "gains one bar" rule.
 *
 * Cut on the 120 BPM grid (beat 15 f, bar 60 f) and TIMED BY THE REAL VOICES (src/ig/voice.generated.ts): each line
 * sits on its planned frame unless the take before it still sounds (common/series.ts `place`); acts, IMPACT and END
 * stay on their bars — only the CTA can push the end card on by whole bars.
 *
 * Node-safe (PIPELINE.md H10): explicit `.ts` extensions, type-only imports marked, no React or Remotion.
 */
import { VOICE, type VoiceId } from '../voice.generated.ts';
import { BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b } from '../../timing.ts';
import { buildCues, makeSpeech, makeVoiceKit, upQuarter, type Cue, type Hit, type Room, type Voiced, type VoiceRide } from '../common/cues.ts';
import {
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, LINE_GAP, ROLL, SEAM, SFX, H, afterRing, endHits, igArc, igImpact, impactHits, place, upBar,
  type Display, type LineScreens, type Snd,
} from '../common/series.ts';

/* ── the house constants: film 1's, re-exported, never redefined ── */
export { BAR, BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b, SFX };
export type { Cue, Hit, Snd, Voiced, VoiceId };

export const REEL = 'ig1' as const;
export const TITLE = 'Not even ours';

/* ── voices ── */
const KIT = makeVoiceKit(VOICE);
export const { vFrames, vWord, voiceCut, voiceEnd } = KIT;
const end = (at: number, id: VoiceId) => voiceEnd({ at, id });

/* ── the plan (SCRIPT.md ig1 §3, frames) ── */
export const PLAN = {
  acts: { hook: 0, hours: 105, shift: 255, does: 360, desk: 480, end: 585 },
  lines: { 'ig1-01': 6, 'ig1-02': 108, 'ig1-03': 255, 'ig1-04': 360, 'ig1-05': 483, 'ig1-06': 585 },
  impact: 720,
  end: 780,
} as const;

/* ── the voiced timeline ── */
/** the hook: on its planned frame, once the frame-0 desk ring has rung out before her first word */
const L1 = afterRing(PLAN.lines['ig1-01'], 0, KIT.firstSound('ig1-01'));
/**
 * THE GRID'S ACT (hours) follows the hook's take: it opens once "Not even ours." has held a beat past its last word
 * (the caption rule) and the take has ended; "Nine…" keeps the plan's 3-frame lead into the act (the grid rises first).
 */
export const HOURS = Math.max(
  PLAN.acts.hours,
  upQuarter(Math.max(L1 + vWord('ig1-01', 9) + BEAT, end(L1, 'ig1-01') + LINE_GAP - (PLAN.lines['ig1-02'] - PLAN.acts.hours))),
);
const L2 = HOURS + (PLAN.lines['ig1-02'] - PLAN.acts.hours);
const L3 = place(PLAN.lines['ig1-03'], end(L2, 'ig1-02'));
/** b3: the 123 empty cells cascade teal from her word "other" (one row-diagonal per 16th, ≈ 1.2 s) */
export const CASCADE = L3 + vWord('ig1-03', 1);
const L4 = place(PLAN.lines['ig1-04'], end(L3, 'ig1-03'));
const L5 = place(PLAN.lines['ig1-05'], end(L4, 'ig1-04'));
const CTA = place(PLAN.lines['ig1-06'], end(L5, 'ig1-05'));
/** the impact: on its bar, unless the CTA still sounds a bar before it (then whole bars later) */
export const IMPACT = Math.max(PLAN.impact, upBar(end(CTA, 'ig1-06') + BEAT));
export const END = IMPACT + IMPACT_BEFORE_END;
export const BRAND_AT = IMPACT + IMPACT_GAP;

/** Every spoken line on the absolute timeline, sorted by `at`. */
export const VOICES: Voiced<VoiceId>[] = (
  [
    { at: L1, id: 'ig1-01' },
    { at: L2, id: 'ig1-02' },
    { at: L3, id: 'ig1-03' },
    { at: L4, id: 'ig1-04' },
    { at: L5, id: 'ig1-05' },
    { at: CTA, id: 'ig1-06' },
    { at: BRAND_AT, id: BRAND },
  ] as Voiced<VoiceId>[]
).sort((x, y) => x.at - y.at);
/**
 * THE VOICE POST (scripts/audio/mix.mjs VOICE_RIDES; the ridden line's body is put back on the dialogue target): her
 * hottest syllable runs eased down a touch — the punchline "Not even…", "Nine…", "…hundred and twenty…", "Your…",
 * "Comment AGENT" — so no 400 ms of her voice stands as loud as the logo impact (check-mix: the impact tops the
 * loudest dialogue by 1 LU; the reels' −14 LUFS master leaves 1.5 dB less room above her peaks than the films' −15.5).
 * Frames are the line's own; each fader ramps over `ramp` frames outside its span.
 */
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {
  'ig1-01': [{ from: 85, to: 108, db: -2.4, ramp: 4 }],
  'ig1-02': [{ from: 0, to: 20, db: -2, ramp: 3 }],
  'ig1-03': [{ from: 14, to: 40, db: -1.4, ramp: 4 }],
  'ig1-05': [{ from: 0, to: 16, db: -1.2, ramp: 3 }],
  'ig1-06': [{ from: 63, to: 86, db: -1.4, ramp: 4 }],
};
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/* ── the picture's moments (absolute frames, from her real word onsets): the acts draw them, the cue sheet hits them ── */
const word = (L: number, id: VoiceId, k: number) => L + vWord(id, k);
/** a 16th (3.75 f) */
export const SIXTEENTH = BEAT / 4;
export const M = {
  /** b1: "fire" (the rose glint), "Not" (S2 turns), "ours" (her orb lands as its full stop) */
  fire: word(L1, 'ig1-01', 1),
  not: word(L1, 'ig1-01', 7),
  ours: word(L1, 'ig1-01', 9),
  /** b2: the desk hairline UNFOLDS into the week (its 24 rows spreading out of the line) the moment "ours" lands — her
   *  orb pops in as the full stop a frame before — so the proof's canvas is open while the punchline still holds */
  unfold: word(L1, 'ig1-01', 9) + 3,
  /** her full stop detaches and parks in the label band as "Not even ours." leaves (the caption's exit) */
  detach: HOURS - 3,
  /** "Nine": the staffed block fills column by column, one per 16th (five columns) — "09" ticks in */
  nine: word(L2, 'ig1-02', 0),
  /** "six": "18" ticks in */
  six: word(L2, 'ig1-02', 2),
  /** "weekdays": MON–FRI over columns 1–5 */
  weekdays: word(L2, 'ig1-02', 3),
  /** "forty-five": the block's outline lifts once */
  fortyFive: word(L2, 'ig1-02', 4),
  /** "a hundred and sixty-eight": the camera eases back and every empty cell draws its hairline in one wave */
  week168: word(L2, 'ig1-02', 10),
  /** b3: "other" — the 123 cascade teal from Friday 18:00 (CASCADE_LEN frames) */
  cascade: CASCADE,
  /** "agent's": her orb glides into the grid's corner and grows */
  agents: word(L3, 'ig1-03', 7),
  shiftWord: word(L3, 'ig1-03', 8),
  /** b4: the three outcome cards land on their verbs; the contact row on "people" */
  answers: word(L4, 'ig1-04', 1),
  messages: word(L4, 'ig1-04', 3),
  puts: word(L4, 'ig1-04', 5),
  people: word(L4, 'ig1-04', 9),
  /** b4 → b5: the records leave together (top first, a 32nd apart) once "…listed." has been said, so the stage is clear
   *  before "Your receptionist" rises; the week comes back to full size under it */
  recordsOut: word(L4, 'ig1-04', 11) + 10,
  /** b5: the desk act opens; on "receptionist" the graphite block lifts; on "only" her orb rests */
  desk: L5 - (PLAN.lines['ig1-05'] - PLAN.acts.desk),
  receptionist: word(L5, 'ig1-05', 1),
  only: word(L5, 'ig1-05', 5),
} as const;
/** the teal cascade's length: ≈ 1.2 s (SCRIPT ig1 b3) */
export const CASCADE_LEN = 36;
/** the staffed block's five column fills (one per 16th from "Nine") */
/** (from "Nine" — once the week has opened: the unfold settles ≈ 9 f after it starts) */
export const STAFFED_FILLS = [0, 1, 2, 3, 4].map((c) => Math.max(M.nine, M.unfold + 9) + c * SIXTEENTH);
/** the hour ticks: "09" once her caption has risen (one moving text at a time: the caption rises from "Nine" − 2), "18"
 *  on "six" */
export const TICK_AT = [Math.max(STAFFED_FILLS[0], M.nine + 3), M.six] as const;

/* ── the acts ── */
/** Act windows on the absolute timeline; `pre`/`post`: frames an act stays mounted before/after its window. */
export const SCENES = (() => {
  const w = (from: number, to: number, pre = 0, post = 0) => ({ from, to, pre, post });
  const A = PLAN.acts;
  // every act follows the voices: hours opens after the hook's take (HOURS), shift / does / end open on their line,
  // desk keeps its plan's 3-frame lead on its line
  const DESK = A.desk + (L5 - PLAN.lines['ig1-05']);
  return {
    hook: w(A.hook, HOURS),
    hours: w(HOURS, L3),
    shift: w(L3, L4),
    does: w(L4, DESK),
    desk: w(DESK, CTA),
    end: w(CTA, END),
  } as const;
})();
export type SceneKey = keyof typeof SCENES;
export const ORDER: readonly SceneKey[] = ['hook', 'hours', 'shift', 'does', 'desk', 'end'];
export const DURATION = END;

/** What each line shows (word spans of its `say`; SCRIPT.md §3 "Screens"). */
export const SCREENS: Record<string, LineScreens> = {
  'ig1-01': { kind: 'caption', spans: [[0, 6], [7, 9]], set0: true },
  // "45 hours." is its own screen, so the numeral appears as she says it (the count along), not 1.9 s before
  'ig1-02': { kind: 'caption', spans: [[0, 3], [4, 5], [6, 12]] },
  'ig1-03': { kind: 'caption', spans: [[0, 4], [5, 8]] },
  // split where she breathes ("calls" → "through": 12 f), so one screen has left before the next rises
  'ig1-04': { kind: 'caption', spans: [[0, 3], [4, 6], [7, 11]] },
  // "Your receptionist" holds through the block's lift (20 f after its last word), then the rest of the line
  'ig1-05': { kind: 'caption', spans: [[0, 1], [2, 8]] },
  'ig1-06': { kind: 'caption', spans: [[0, 4], [5, 9]] },
  'ig1-07': { kind: 'brand', spans: [] },
};
/** Numerals over spoken word spans (the Captions fork's display map). */
export const DISPLAY: readonly Display[] = [
  { id: 'ig1-02', from: 4, to: 4, text: '45' },
  { id: 'ig1-02', from: 9, to: 12, text: '168.' },
  { id: 'ig1-03', from: 2, to: 4, text: '123?' },
];

/** extra zone stills (scripts/ig/check-zones.mjs): the chrome and the call records landed (+ 8 f) */
export const ZONE_FRAMES: readonly number[] = [M.nine + 8, M.six + 8, M.weekdays + 10, M.answers + 8, M.messages + 8, M.puts + 8, M.people + 10];
/** The shared end card's moments (SCRIPT.md §0.3; components/End.tsx). */
export const END_CARD = {
  cta: CTA,
  /** the comment field rises (before she says "Comment AGENT") */
  field: CTA + 8,
  /** AGENT types one letter per 16th from her word "AGENT" */
  agent: CTA + vWord('ig1-06', 6),
  /** the send disc presses as the last word ends */
  send: end(CTA, 'ig1-06'),
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  /** the URL types on "Neuro | Tech | Voice" */
  url: [0, 1, 2].map((k) => BRAND_AT + vWord(BRAND, k)),
  seam: END - SEAM,
} as const;

/* ── the cue sheet (SCRIPT.md ig1 §4 "Sound" per beat) ── */
export const roomAt = (_f: number): Room => 'white';
/** the cascade's plucks: the E-major pentatonic rising on 16ths through the teal (E5 F#5 G#5 B5 E6, then F#6 G#6 B6) */
const T0 = (a: readonly number[]) => a[0];
const CASCADE_PLUCKS: readonly [Snd, number][] = [
  ['fx-pluck-e5', 0],
  ['fx-pluck-fs5', 0],
  ['fx-pluck-gs5', 0],
  ['fx-pluck-b5', 0],
  ['fx-pluck-e6', 0],
  ['fx-pluck-fs5', 12],
  ['fx-pluck-gs5', 12],
  ['fx-pluck-b5', 12],
];
export const HITS: Hit<Snd>[] = [
  // b1 — the desk phone (the frame-0 attack and its second burst), "fire", her full stop
  H(0, 'fx-trill', 'rush', 0.62, 1, 'b1 the desk phone rings at frame 0 (the attack)'),
  H(30, 'fx-trill', 'rush', 0.62, 2, 'b1 its second burst'),
  H(M.fire, 'thump', 'none', 0.5, 3, 'b1 “fire”: a soft weight under the rose glint', { db: -4 }),
  H(M.ours + 2, 'ping', 'sunday', 0.62, 2, 'b1 “ours”: her orb lands as the full stop', { db: 3 }),
  H(M.ours + 2, 'chime-sunday-soft', 'sunday', 0.62, 3, 'b1 … the sunday chime under it', { layer: true, db: 5 }),
  // b2 — the desk line opens into the week; the staffed block fills; 45; the whole week
  H(M.unfold + 1, 'fx-riffle', 'none', 0.5, 3, 'b2 the desk line unfolds into the 24 hours of the week', { db: 7 }),
  H(T0(STAFFED_FILLS), 'fx-tick', 'none', 0.3, 3, 'b2 “Nine”: the staffed block fills, one column per 16th', {
    db: 9,
    run: { n: 5, offs: STAFFED_FILLS.map((f) => f - STAFFED_FILLS[0]), xs: [0.22, 0.28, 0.34, 0.4, 0.46] },
  }),
  H(M.weekdays, 'draw', 'none', 0.36, 3, 'b2 “weekdays”: MON–FRI’s bracket draws out', { db: 6 }),
  H(M.fortyFive, 'fx-tock', 'none', 0.36, 2, 'b2 “forty-five”: the block’s outline lifts once'),
  H(M.week168, 'swish', 'none', 0.5, 3, 'b2 “a hundred and sixty-eight”: the camera eases back, every empty hour outlined', { db: 4 }),
  // b3 — the agent's shift
  ...CASCADE_PLUCKS.map(([snd, semi], i) =>
    H(M.cascade + i * SIXTEENTH, snd, 'none', 0.5 + 0.06 * (i % 4), 3, `b3 the teal cascade, rising pluck ${i + 1}/${CASCADE_PLUCKS.length}`, { semi, db: 8.5 - 0.3 * i, layer: true }),
  ),
  H(M.shiftWord, 'glint', 'sunday', 0.74, 2, 'b3 “shift”: her orb, grown into the corner'),
  H(M.shiftWord, 'fx-ting', 'sunday', 0.74, 2, 'b3 … its ting', { layer: true }),
  // b4 — what it does
  H(M.answers, 'fx-tag', 'none', 0.62, 2, 'b4 “answers”: the Answered record lands', { db: 5 }),
  H(M.messages, 'fx-tag', 'none', 0.62, 2, 'b4 “messages”: Message taken lands', { db: 5 }),
  H(M.puts, 'fx-tag', 'none', 0.62, 2, 'b4 “puts calls through”: Transferred lands', { db: 5 }),
  H(M.people, 'line', 'none', 0.6, 3, 'b4 “people you listed”: the team member slides out (Live transfers)', { db: 8 }),
  // b5 — the desk beat
  H(M.recordsOut, 'swish', 'none', 0.5, 3, 'b4 → b5 the records leave up', { db: 4 }),
  H(M.receptionist, 'land', 'none', 0.36, 2, 'b5 “receptionist”: the people’s block lifts off the week'),
  // b6–b8 — the shared end card
  // (the comment field's rise heard over the CTA's bed: the shared −6 dB sat 35 LU under her voice)
  ...endHits(END_CARD).map((h) => (h.snd === 'fx-menu-open' ? { ...h, db: 6 } : h)),
  H(IMPACT - 12, 'riser', 'none', 0.5, 1, 'END the build’s crest, just after her last word (“…link.”): a first swell, cresting before the breath', { layer: true, db: 2 }),
  H(IMPACT - 14, 'whoosh-rev', 'none', 0.5, 1, 'END the crest: a reversed swell out of “…link.”, cut into the breath', { layer: true, db: 3 }),
  H(IMPACT - 1, 'whoosh-rev', 'none', 0.5, 1, 'END the breath before the hit: a reversed whoosh through the inhale', { layer: true, db: -1 }),
  // the shared impact stack, its riser a touch hotter: it carries the last 400 ms while the bed draws its breath
  ...impactHits(IMPACT).map((h) => (h.snd === 'riser' ? { ...h, db: 1 } : h)),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** The moments the bed reads (scripts/ig/bed.mjs inputs(T)). */
export const MUSIC = {
  bedFrom: 0,
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  end: END,
  /** ig1's arrangement (scripts/ig/bed.mjs arrangeIg1): where the sections turn */
  ig1: { hours: HOURS, cascade: CASCADE, does: SCENES.does.from, desk: SCENES.desk.from, cta: CTA },
  /** ig1's build (bed.mjs MUSIC.build): the roll and the kicks harder, both stopping into a short, deep inhale (the last
   *  0.6 beat, −14 dB) — the crest just after her last word, the breath, then the hit */
  build: { kick: 0.8, snare: 1.0, kickEnd: 0.8, snareEnd: 0.8, inhale: 0.8, inhaleDb: -9, breath: 1.8, breathEnd: 0.25, breathCurve: 0.25 },
} as const;
/**
 * The bed's fader (frame → dB). Film 2's shape round the hit (series.ts bedRide), with ig1's own crest: the speech duck
 * is still letting go after her last word ("…link.") when the build must peak, so the fader rides up against it for the
 * 16th after it — the crest — then down into the inhale, the hit, well back for the name, down into the seam.
 */
/** the bed under her lines: the films' 10–12 LU voice-over-music balance (film 2's VO acts), not a dry voice-over */
const BED_UNDER = 4.5;
/** the cascade's opening (pad and strings an octave up, the plucks): the bed swells this much more over it */
const BED_CASCADE = 1;
const BED_RIDE: readonly (readonly [number, number])[] = [
  [0, BED_UNDER],
  [CASCADE - 6, BED_UNDER],
  [CASCADE + 2, BED_UNDER + BED_CASCADE],
  [CASCADE + 34, BED_UNDER + BED_CASCADE],
  [CASCADE + 70, BED_UNDER],
  // the CTA: drawn back under "…for the link." (its last word clear), then the build's crest after it
  [IMPACT - 40, BED_UNDER],
  [IMPACT - 32, -3],
  [IMPACT - 26, -2.5],
  [IMPACT - 24, 7],
  [IMPACT - 22, 14],
  [IMPACT - 17, 14],
  [IMPACT - 13, 10],
  [IMPACT - 10, 3],
  [IMPACT - 6, -1],
  [IMPACT - 1, -2],
  [IMPACT + 2, 0],
  [BRAND_AT - 1, -8],
  [BRAND_AT + vFrames(BRAND) - 4, -8],
  [END - SEAM, -16.5],
  [END, -30],
];
export const BED = { file: `ig/sfx/${REEL}/bed.wav`, vol: 2, ride: BED_RIDE };
export const MIX = {
  file: `ig/sfx/${REEL}/mix.wav`,
  ...IG_LOUD,
  fadeOut: [END - SEAM, END] as const,
  /** the impact insert held a frame longer and released over the name's first syllable (its SII stays ≥ .9) */
  impact: { ...igImpact(IMPACT, BRAND_AT - IMPACT), hold: [0, 4] as const, release: 8 },
  name: IG_NAME,
  /** the music-forward passage the converge into the logo must top (check-mix): the teal cascade (from "other", 36 f) */
  arc: igArc([[CASCADE, CASCADE + 36]]),
} as const;
/** The finish (components/Finish.tsx): pearl ground. Grain and dither strengths are settled by the bit-budget probe. */
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

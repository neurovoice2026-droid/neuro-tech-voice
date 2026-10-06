/**
 * REEL 3 · "Twelve minutes" (salons) — every timing constant of the reel (docs/ig/SCRIPT.md "ig3", PIPELINE.md §6.1).
 * Plan 24.0 s · 12 bars (impact f660). WITH THE INSTALLED TAKES (voice-candidates/ig/PICKS.md): 26.0 s · 13 bars ·
 * 780 timeline frames (3120 at 120 fps), impact f720 (bar 13), END f780 — the script's "gains one bar" rule.
 *
 * The colour timer is the clock of the reel: it ticks in real seconds from frame 0, time-lapses from the pickup and
 * reads 00:00 on the very frame of the hang-up (HANGUP = the beat after the agent's answer + 4 f). Each line sits on its
 * planned frame unless the take (or the caller's turn) before it still runs (common/series.ts `place`); only the CTA
 * can push the end card on by whole bars.
 *
 * Node-safe (PIPELINE.md H10): explicit `.ts` extensions, type-only imports marked, no React or Remotion.
 */
import { VOICE, type VoiceId } from '../voice.generated.ts';
import { BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b } from '../../timing.ts';
import { buildCues, makeSpeech, makeVoiceKit, upBeat, type Cue, type Hit, type Room, type Voiced, type VoiceRide } from '../common/cues.ts';
import {
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, ROLL, SEAM, SFX, H, afterRing, endHits, bedRide, igArc, igImpact, impactHits, place, ringBefore, upBar,
  type Display, type LineScreens, type Snd,
} from '../common/series.ts';

export { BAR, BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b, SFX };
export type { Cue, Hit, Snd, Voiced, VoiceId };

export const REEL = 'ig3' as const;
export const TITLE = 'Twelve minutes';

/* ── voices ── */
const KIT = makeVoiceKit(VOICE);
export const { vFrames, vWord, voiceCut, voiceEnd } = KIT;
const end = (at: number, id: VoiceId) => voiceEnd({ at, id });
/** the end of a line's last spoken phrase (her voice, not the file's silent tail), from the line's start */
const speechEnd = (id: VoiceId) => {
  const p = VOICE.lines[id].phrases;
  return Math.round(p[p.length - 1].end * FPS);
};

/* ── the plan (SCRIPT.md ig3 §3, frames) ── */
export const PLAN = {
  acts: { hook: 0, call: 240, payoff: 435, end: 546 },
  pickup: 240,
  lines: { 'ig3-01': 6, 'ig3-02': 108, 'ig3-03': 246, 'ig3-04': 354, 'ig3-05': 450, 'ig3-06': 546 },
  /** the caller's turn: [from, frames] (SCRIPT: 0.6–0.8 s; 0.7 s here) */
  caller: [330, 21],
  hangup: 435,
  impact: 660,
  end: 720,
} as const;
/**
 * THE GREETING waits a 16th-and-a-half after the click (13 f, the plan's 6 + 7): the click, her orb's birth out of the
 * phone's light and the dilemma's captions leaving get the frame to themselves before her first row rises (one moving
 * text at a time). The 7 frames come out of the caller's turn (21 f) and the 16th the answer was rounding up to: the
 * hang-up and everything after it stay where the plan's re-anchoring put them.
 */
const GREET = 13;

/* ── the voiced timeline ── */
/** the hook: on its planned frame, once the frame-0 ring has rung out before her first word */
const L1 = afterRing(PLAN.lines['ig3-01'], 0, KIT.firstSound('ig3-01'));
/**
 * THE RINGS of the phone across the room, re-anchored to her pauses (the plan's bar lines 60 / 120 / 180 fell on
 * "You", "up," and "Leave" in the real reads): frame 0; the last beat that rings out before "You can't touch…"; the
 * beat after the hook's take (the dilemma waits for it to ring out); the last beat that rings out before "Leave it…".
 */
const RING3 = upBeat(end(L1, 'ig3-01'));
const L2 = afterRing(PLAN.lines['ig3-02'], RING3, KIT.firstSound('ig3-02'));
export const RINGS = [0, ringBefore(L1 + vWord('ig3-01', 5)), RING3, ringBefore(L2 + vWord('ig3-02', 6))] as const;
/** the RingPulses the picture draws: frame 0's is already 4 f in flight (so frame 0 — and the seam's re-formed frame 0
 *  — shows a ring travelling); the others leave with their trills */
export const VIS_RINGS = [-4, RINGS[1], RINGS[2], RINGS[3]] as const;
/** the pickup click (bar 5): the dimmed dot springs open into the teal orb */
export const PICKUP = Math.max(PLAN.pickup, upBeat(end(L2, 'ig3-02')));
const A3 = place(PICKUP + GREET, PICKUP, GREET);
const CALLER_FROM = place(PLAN.caller[0], end(A3, 'ig3-03'), 4);
/** the caller's turn [from, to): the meter row */
export const CALLERS = [[CALLER_FROM, CALLER_FROM + PLAN.caller[1]] as const] as const;
const A4 = place(PLAN.lines['ig3-04'], CALLERS[0][1], 0);
/** THE HANG-UP: the timer (stepped aside) reads 00:00, the tick stops dead — the beat after her answer (+ 4 f) */
export const HANGUP = Math.max(PLAN.hangup, upBeat(end(A4, 'ig3-04') + 4));
const L5 = place(PLAN.lines['ig3-05'], HANGUP, PLAN.lines['ig3-05'] - PLAN.hangup);
const CTA = place(PLAN.lines['ig3-06'], end(L5, 'ig3-05'));
export const IMPACT = Math.max(PLAN.impact, upBar(end(CTA, 'ig3-06') + BEAT));
export const END = IMPACT + IMPACT_BEFORE_END;
export const BRAND_AT = IMPACT + IMPACT_GAP;
/** the timer is already half a second into its 12:00 at frame 0, so its first figure rolls on beat 2 (f15) and on every
 *  second after it: the countdown is visibly running from the first second (the ticks land on beats 2 and 4, answering
 *  the bed's dyads on 1 and 3) */
const PHASE = BEAT;
/** the timer: 12:00 at frame 0, real seconds until the pickup, then a time-lapse from 11:52 that ends on HANGUP; its
 *  last four seconds land on the last four 16ths before the hang-up (one second per 16th: TimerCard.tsx remainingAt) */
export const TIMER = { start: 12 * 60, phase: PHASE, lapseFrom: PICKUP, lapseStart: 12 * 60 - (PICKUP + PHASE) / FPS, zeroAt: HANGUP, tail: 4, tailStep: BEAT / 4 } as const;

export const VOICES: Voiced<VoiceId>[] = (
  [
    { at: L1, id: 'ig3-01' },
    { at: L2, id: 'ig3-02' },
    { at: A3, id: 'ig3-03' },
    { at: A4, id: 'ig3-04' },
    { at: L5, id: 'ig3-05' },
    { at: CTA, id: 'ig3-06' },
    { at: BRAND_AT, id: BRAND },
  ] as Voiced<VoiceId>[]
).sort((x, y) => x.at - y.at);
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {};
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/* ── the acts ── */
export const SCENES = (() => {
  const w = (from: number, to: number, pre = 0, post = 0) => ({ from, to, pre, post });
  return {
    hook: w(PLAN.acts.hook, PICKUP),
    call: w(PICKUP, HANGUP),
    payoff: w(HANGUP, CTA),
    end: w(CTA, END),
  } as const;
})();
export type SceneKey = keyof typeof SCENES;
export const ORDER: readonly SceneKey[] = ['hook', 'call', 'payoff', 'end'];
export const DURATION = END;

export const SCREENS: Record<string, LineScreens> = {
  'ig3-01': { kind: 'caption', spans: [[0, 4], [5, 9]], set0: true },
  'ig3-02': { kind: 'caption', spans: [[0, 5], [6, 10]] },
  'ig3-03': { kind: 'row', spans: [[0, 8]] },
  'ig3-04': { kind: 'row', spans: [[0, 7]] },
  'ig3-05': { kind: 'caption', spans: [[0, 3], [4, 7]] },
  'ig3-06': { kind: 'caption', spans: [[0, 6], [7, 8]] },
  'ig1-07': { kind: 'brand', spans: [] },
};
export const DISPLAY: readonly Display[] = [];

/* ── the picture's moments (absolute frames), every one from her real word onsets ── */
const on = (at: number, id: VoiceId, k: number) => at + vWord(id, k);
const SIXTEENTH = BEAT / 4;
/** the grid points of `step` (8ths, 16ths: fractional frames, exact) in [from, to) */
const grid = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let k = Math.ceil(from / step - 1e-9); k * step < to - 1e-6; k++) out.push(k * step);
  return out;
};
export const M = {
  /* b1–b2 the hook: the real seconds tick (the digits roll on each, from f15), the phone rings across the room */
  seconds: Array.from({ length: Math.floor((PICKUP - 1 - PHASE) / FPS) + 1 }, (_, k) => PHASE + k * FPS),
  /** "Pick it up,": the card TUGS toward the phone (one move, on "up") */
  tug: on(L2, 'ig3-02', 2),
  /** "over-processes.": the arc's segment past 12 o'clock darkens to deep rose (colour only) */
  over: on(L2, 'ig3-02', 5),
  /** "Leave it,": the card holds still */
  leave: on(L2, 'ig3-02', 6),
  /** "elsewhere.": the phone's light dims to rest (the caller giving up) */
  giveUp: on(L2, 'ig3-02', 10),
  /* b3 the pickup */
  /** the dimmed dot springs open into her orb (2 f after the click) */
  birth: PICKUP + 2,
  /** the timer STAYS the hero through the greeting (centred, full size, time-lapsing over her rows), and steps up and
   *  aside to the top right in the caller's turn (no words move then: only the meter), clearing the stage for the page */
  aside: [CALLERS[0][0] + 2, CALLERS[0][0] + 18] as const,
  /** "an AI assistant." */
  ai: on(A3, 'ig3-03', 6),
  /* b5 the answer */
  /** "A walk-in trim?" */
  walkIn: on(A4, 'ig3-04', 1),
  trim: on(A4, 'ig3-04', 2),
  /** the service list slides up under the call strip, once "trim?" has risen (one moving text at a time) */
  page: on(A4, 'ig3-04', 2) + 5,
  /** the dashboard's "Looked it up in your documents" beside the heading: it rides IN WITH the page (set before the page
   *  shows, so one block moves), its spinner turning until the check, before "You can," */
  tool: on(A4, 'ig3-04', 2) - 8,
  toolDone: on(A4, 'ig3-04', 3) - 6,
  /** "You can," */
  youCan: on(A4, 'ig3-04', 3),
  /** "Tuesday to Saturday.": the teal sweep under the Trim line */
  tuesday: on(A4, 'ig3-04', 5),
  /** the call's content leaves (up through its masks; the page sinks back) as her answer ends */
  callOut: A4 + speechEnd('ig3-04') - 2,
  /* b6 the payoff */
  /** 00:00 lands in the timer where it stands (the hit); it springs back to centre once the call has left (one moving
   *  text at a time: the rows and the page are gone a frame before it) */
  back: HANGUP + 3,
  /** the Answered record lands under the timer */
  record: HANGUP + 8,
  /** the check draws in the disc as it arrives */
  check: HANGUP + 9,
  /** "Timer's done." / "You never looked up.": she rests */
  done: on(L5, 'ig3-05', 1),
  looked: on(L5, 'ig3-05', 6),
  /* the ticks under the call: 8ths from the pickup (the time-lapse), 16ths from "walk-in" (the answer), dead on HANGUP */
  eighths: grid(PICKUP + BEAT / 2, on(A4, 'ig3-04', 1), BEAT / 2),
  sixteenths: grid(on(A4, 'ig3-04', 1), HANGUP, SIXTEENTH),
} as const;

/** extra zone stills (scripts/ig/check-zones.mjs): the timer aside, the page, its tool row's check, the sweep, the record (+ 8 f) */
export const ZONE_FRAMES: readonly number[] = [M.aside[1], M.page, M.toolDone, M.tuesday, M.record, M.looked].map((f) => Math.round(f + 8));

export const END_CARD = {
  cta: CTA,
  field: CTA + 6,
  agent: CTA + vWord('ig3-06', 8),
  send: end(CTA, 'ig3-06'),
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  url: [0, 1, 2].map((k) => BRAND_AT + vWord(BRAND, k)),
  seam: END - SEAM,
} as const;

/* ── the cue sheet (SCRIPT.md ig3 §4 "Sound", beat by beat; hierarchy: voice ≫ story sounds ≫ the bed) ── */
export const roomAt = (_f: number): Room => 'white';
/** screen x of the phone across the room (the rings and the pickup pan there) */
const PHONE_X = 150 / 1080;
/** the timer's ticks: runs of dry ticks (film 2's fx-tick) at its own pan, never fading down the run (xs given) — the
 *  ticks in her pauses at `gap` dB (the clock you hear between her words), the ones under her words at `talk` dB (the
 *  cue sheet takes them a further 5 dB under her) */
const tickRun = (frames: readonly number[], x: number, gap: number, talk: number, label: string): Hit<Snd>[] =>
  ([[false, gap], [true, talk]] as const).flatMap(([under, db]) => {
    const fs = frames.filter((f) => speaking(f) === under);
    return fs.length ? [H(fs[0], 'fx-tick', 'none', x, 3, `${label}${under ? ' (under her words)' : ''}`, { db, layer: true, run: { n: fs.length, offs: fs.map((f) => f - fs[0]), xs: fs.map(() => x) } })] : [];
  });
export const HITS: Hit<Snd>[] = [
  // b1 — the phone across the room, and the colour timer's real seconds (the rhythm)
  ...RINGS.map((f, k) => H(f, 'fx-trill', 'rush', PHONE_X, 1, `b1 the phone across the room rings (${k + 1}/4)${k ? ' — in her pause' : ': the frame-0 attack'}; a RingPulse leaves it`, { db: -3 })),
  ...tickRun(M.seconds, 0.5, 1, 1, 'b1 the colour timer: a dry tick on every real second (the digits roll on it)'),
  // b2 — the pull
  H(M.tug, 'whoosh-soft', 'none', [0.5, 0.36], 3, 'b2 “Pick it up,”: the card tugs toward the phone (one move)', { db: -6 }),
  H(M.tug, 'thump', 'none', 0.45, 3, 'b2 … a sub thump under the tug', { db: -6, layer: true }),
  // b3 — the pickup: the click, the dimmed dot springs open into her orb; the timer shrinks to its corner and time-lapses
  H(PICKUP, 'fx-pickup', 'none', PHONE_X, 1, 'b3 PICKUP (bar 5): the click — the ring is answered', { db: -2 }),
  H(M.birth, 'fx-seed', 'sunday', 0.2, 2, 'b3 the dot springs open into her orb (the seed)'),
  H(M.birth + 2, 'fx-ting', 'sunday', 0.2, 2, 'b3 … her teal: the birth’s ting', { layer: true, db: -2 }),
  H(M.aside[0], 'swish', 'none', [0.5, 0.72], 3, 'b4 the timer steps up and aside to the top right (the caller’s turn)', { db: -8 }),
  H(PICKUP + 4, 'fx-linehold', 'none', 0.5, 3, 'b3 the open line under the call (very low)', { db: -16, layer: true }),
  ...tickRun(M.eighths, 0.5, -2, -3, 'b3–b4 the time-lapse: the ticks double to 8ths'),
  // b4 — the caller's turn: the line lifts under the level meter (no words, no voice)
  H(CALLERS[0][0] + 1, 'fx-linehiss', 'none', 0.5, 3, 'b4 the caller’s turn: the line lifts (+3 dB) under the level meter', { db: -6, run: { n: 3, step: 7 } }),
  // b5 — the answer from the salon's own list
  H(M.page, 'fx-paper-lift', 'none', 0.5, 3, 'b5 “trim?”: the service list slides up', { db: -4 }),
  H(M.toolDone, 'fx-tag', 'sunday', 0.62, 3, 'b5 “Looked it up in your documents”: the check draws', { db: -2 }),
  H(M.tuesday, 'fx-felttip', 'none', 0.45, 3, 'b5 “Tuesday to Saturday.”: the teal sweep runs under the Trim line', { db: -2 }),
  ...tickRun(M.sixteenths, 0.7, -2, -4, 'b5 the ticks go to 16ths into the hang-up (the last four are the timer’s last four seconds)'),
  H(HANGUP, 'riser-short', 'none', 0.5, 3, 'b5 … a very low riser-short into the hang-up', { db: -8 }),
  // b6 — THE HANG-UP: the click, the timer at 00:00 springs back to centre, its ring closes, the check; the tick stops dead
  H(HANGUP, 'fx-click-down', 'none', 0.62, 2, 'b6 HANG-UP (beat 2 of bar 9): the click — down', { db: -4 }),
  H(HANGUP + 2, 'fx-click-up', 'none', 0.62, 3, 'b6 … up', { layer: true, db: -6 }),
  H(HANGUP, 'fx-mallet-e5', 'sunday', 0.62, 1, 'b6 00:00: the mallet (true / done) — the strongest hit before the impact', { db: 3 }),
  H(HANGUP, 'fx-mallet-b4', 'sunday', 0.62, 1, 'b6 … a fourth under it (the done chord’s body)', { layer: true, db: -4 }),
  H(M.check, 'fx-glass-e6', 'sunday', 0.5, 2, 'b6 … the glass ting as the ring closes and the check draws', { layer: true, db: -1 }),
  H(M.record, 'fx-tock', 'none', 0.5, 2, 'b6 the Answered record lands under the timer'),
  // b7–b9 — the shared end card
  ...endHits(END_CARD),
  // THE BUILD: her last word ends 22 f before the bar — a riser cresting with the roll, then the shared stack
  H(IMPACT - 10, 'riser', 'none', 0.5, 1, 'END the build’s crest under the roll (peaks a 16th before the inhale)', { db: 1.5 }),
  ...impactHits(IMPACT),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** The moments the bed reads (scripts/ig/bed.mjs inputs(T)). */
export const MUSIC = {
  bedFrom: 0,
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  end: END,
  /** ig3's own moments (scripts/ig/bed.mjs ig3Parts): the pickup (E – C#m7 – A – B), "walk-in" (the answer), the
   *  hang-up (E: the bed opens, a high piano line), the CTA */
  ig3: { pickup: PICKUP, walkIn: M.walkIn, hangup: HANGUP, cta: CTA },
  /** the shared build, louder: the converge into the logo must top the payoff's second (check-mix arc) */
  build: { kick: 1.4, snare: 1.5, inhaleDb: -12 },
} as const;
/** the bed's fader: the series' shape round the hit (common/series.ts bedRide), with ig3's BUILD — her CTA ends 22 f
 *  before the bar, so the roll is ridden up as her last word lands and kept up until the inhale draws it in */
const CTA_END = CTA + speechEnd('ig3-06');
/** the bed's level under her (dB on the fader): the timer's hook and the call sit RIDE.under over the bed as composed (its
 *  peak is the logo's E, so the quiet parts were 17 dB under her voice — film 2 sits at 9), the payoff's opened line
 *  RIDE.payoff, the build RIDE.build */
const RIDE = { under: 6, payoff: 7, build: 13 } as const;
export const BED = {
  file: `ig/sfx/${REEL}/bed.wav`,
  vol: 2,
  ride: [
    [0, RIDE.under],
    [HANGUP - 3, RIDE.under],
    // the hang-up's hit sits clear of the bed for a beat, then the payoff's opened line blooms in under her
    [HANGUP, RIDE.under - 1.5],
    [HANGUP + 24, RIDE.payoff],
    [CTA - 8, RIDE.payoff],
    [CTA, RIDE.under],
    [CTA_END - 12, RIDE.under],
    [CTA_END, RIDE.build],
    [IMPACT - 12, RIDE.build],
    // the series' shape round the hit, the chord held 2.5 dB higher into the seam (it still rings 10–5 f from the end)
    ...bedRide(IMPACT, BRAND_AT, vFrames(BRAND), END)
      .filter(([f]) => f >= IMPACT - 1)
      .map(([f, db]) => (f === END - SEAM ? ([f, db + 2.5] as const) : ([f, db] as const))),
  ] as readonly (readonly [number, number])[],
};
export const MIX = {
  file: `ig/sfx/${REEL}/mix.wav`,
  ...IG_LOUD,
  fadeOut: [END - SEAM, END] as const,
  impact: igImpact(IMPACT, BRAND_AT - IMPACT),
  name: IG_NAME,
  /** the payoff hit: from the hang-up (timer 00:00), 45 f */
  arc: igArc([[HANGUP, HANGUP + 45]]),
} as const;
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

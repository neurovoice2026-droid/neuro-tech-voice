/**
 * REEL 2 · "Booked after hours" — every timing constant of the reel (docs/ig/SCRIPT.md "ig2", PIPELINE.md §6.1).
 * Plan 22.0 s · 11 bars (impact f600). WITH THE INSTALLED TAKES (voice-candidates/ig/PICKS.md): 28.0 s · 14 bars ·
 * 840 timeline frames (3360 at 120 fps), impact f780 (bar 14), END f840: the four call lines run ≈ 1 s over their
 * slots each (natural phone pace). The series' only night ground.
 *
 * A one-sided call: the agent restates what was asked, the caller's turns are a level meter (no words, no voice).
 * Each line sits on its planned frame unless the take before it (or the caller's turn) is still running
 * (common/series.ts `place`); the hang-up lands on the beat after the booking line; only the CTA can push the end
 * card on by whole bars.
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

export const REEL = 'ig2' as const;
export const TITLE = 'Booked after hours';

/* ── voices ── */
const KIT = makeVoiceKit(VOICE);
export const { vFrames, vWord, voiceCut, voiceEnd } = KIT;
const end = (at: number, id: VoiceId) => voiceEnd({ at, id });

/* ── the plan (SCRIPT.md ig2 §3, frames) ── */
export const PLAN = {
  acts: { hook: 0, call: 105, booked: 465, end: 528 },
  pickup: 105,
  lines: { 'ig2-01': 6, 'ig2-02': 111, 'ig2-03': 216, 'ig2-04': 309, 'ig2-05': 384, 'ig2-06': 483, 'ig2-07': 543 },
  /** the caller's turns (a level meter, no words): [from, frames] */
  callers: [[192, 24], [288, 18], [363, 18]],
  hangup: 465,
  impact: 600,
  end: 660,
} as const;

/* ── the voiced timeline ── */
/** the hook: on its planned frame, once the frame-0 ring has rung out before her first word */
const L1 = afterRing(PLAN.lines['ig2-01'], 0, KIT.firstSound('ig2-01'));
/** the third ring: on the beat after her "…this call." — the phone still ringing as she finishes (fix round 2: from f60 to
 *  the pickup the phone seemed to have stopped); one chirp (`fx-trill-1`), which the pickup's click cuts a 16th later */
const RING3 = upBeat(end(L1, 'ig2-01'));
/** the rings in the dark: at frame 0, on the last beat (≥ bar 1's beat 3) that rings out before "You're closed." — in
 *  her pause, never on a word (the plan's f60 was cut against the planned read) — and the pickup's ring */
export const RINGS = [0, Math.max(2 * BEAT, ringBefore(L1 + vWord('ig2-01', 2))), RING3] as const;
/** the pickup click, a 16th into the third ring: the ring is cut, the colon light springs open into the teal orb */
export const PICKUP = Math.max(PLAN.pickup, RING3 + 4);
const A2 = place(PLAN.lines['ig2-02'], PICKUP, 6);
/**
 * THE CALLER'S TURNS (fix round 2): a live call's pace. Her next line starts on the 16th after her last + CALL_GAP, so
 * the line is open 0.67–0.73 s between her lines (SCRIPT §0.3: 0.6–0.8 s; the planned 24 / 18 / 18-frame turns plus the
 * grid had made each ≈ 1 s — dead air a business owner hears as AI lag). The ● CALLER row lives from 2 f after her
 * last sound to 2 f before her next.
 */
const CALL_GAP = 18;
const nextLine = (plan: number, after: number) => place(plan, after, CALL_GAP);
const turnBetween = (prevAt: number, prev: VoiceId, nextAt: number, next: VoiceId) => [end(prevAt, prev) + 2, Math.round(nextAt + KIT.firstSound(next)) - 2] as const;
const A3 = nextLine(PLAN.lines['ig2-03'], end(A2, 'ig2-02'));
const A4 = nextLine(PLAN.lines['ig2-04'], end(A3, 'ig2-03'));
const A5 = nextLine(PLAN.lines['ig2-05'], end(A4, 'ig2-04'));
const C1 = turnBetween(A2, 'ig2-02', A3, 'ig2-03');
const C2 = turnBetween(A3, 'ig2-03', A4, 'ig2-04');
const C3 = turnBetween(A4, 'ig2-04', A5, 'ig2-05');
/** the caller's turns [from, to): a ● CALLER row with the level meter, the line lifted */
export const CALLERS = [C1, C2, C3] as const;
/** the hang-up, on the beat after "…Saturday at ten." (the header swaps to Booked) */
export const HANGUP = Math.max(PLAN.hangup, upBeat(end(A5, 'ig2-05') + 4));
const L6 = place(PLAN.lines['ig2-06'], HANGUP, PLAN.lines['ig2-06'] - PLAN.hangup);
/** the CTA keeps the plan's beat after the gate line (543 − (483 + 45) = 15 f): the comment field rises in it, 12 f
 *  before her first word, after "…with Pro." has ended */
const CTA = place(PLAN.lines['ig2-07'], end(L6, 'ig2-06'), BEAT);
export const IMPACT = Math.max(PLAN.impact, upBar(end(CTA, 'ig2-07') + BEAT));
export const END = IMPACT + IMPACT_BEFORE_END;
export const BRAND_AT = IMPACT + IMPACT_GAP;

export const VOICES: Voiced<VoiceId>[] = (
  [
    { at: L1, id: 'ig2-01' },
    { at: A2, id: 'ig2-02' },
    { at: A3, id: 'ig2-03' },
    { at: A4, id: 'ig2-04' },
    { at: A5, id: 'ig2-05' },
    { at: L6, id: 'ig2-06' },
    { at: CTA, id: 'ig2-07' },
    { at: BRAND_AT, id: BRAND },
  ] as Voiced<VoiceId>[]
).sort((x, y) => x.at - y.at);
/**
 * THE VOICE POST — THE CLIMAX'S HEADROOM (film 2's method, src/kb/timing.ts VOICE_RIDES; check-mix: the logo impact tops
 * the loudest dialogue moment by ≥ 1 LU). The reel's loudest 400 ms are all voice (bed and effects 15–25 dB under): her
 * bright check-back "Saturday morning?", "Saturday at ten.", "this is Ava," and the hook's "Nine forty-seven.". Each is
 * ridden down inside the silences around it (line-local frames, from the phrase timings); master() re-trims a ridden line
 * so its body sits on the dialogue target, so a nominal −2.5 dB is ≈ −1 dB heard — the peaks sit with their lines.
 */
const phrase = (id: VoiceId, k: number) => VOICE.lines[id].phrases[k];
const rideOf = (id: VoiceId, k: number, db: number, ramp: number): VoiceRide => ({ from: Math.floor(phrase(id, k).start * FPS), to: Math.ceil(phrase(id, k).end * FPS), db, ramp });
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {
  'ig2-01': [rideOf('ig2-01', 0, -2, 3)],
  'ig2-02': [rideOf('ig2-02', 1, -2, 2)],
  'ig2-03': [rideOf('ig2-03', 0, -3, 3)],
  'ig2-05': [rideOf('ig2-05', 3, -2.5, 2)],
  // the gate line leans on "Pro.": "Calendar booking" a touch under the rest (ramped in the "-ing | comes" join)
  'ig2-06': [{ from: 0, to: Math.floor(VOICE.lines['ig2-06'].words[2].t * FPS) - 2, db: -2.5, ramp: 2 }],
};
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/* ── the acts ── */
export const SCENES = (() => {
  const w = (from: number, to: number, pre = 0, post = 0) => ({ from, to, pre, post });
  const END_FROM = CTA - (PLAN.lines['ig2-07'] - PLAN.acts.end);
  return {
    hook: w(PLAN.acts.hook, PICKUP),
    call: w(PICKUP, HANGUP),
    booked: w(HANGUP, END_FROM),
    end: w(END_FROM, END),
  } as const;
})();
export type SceneKey = keyof typeof SCENES;
export const ORDER: readonly SceneKey[] = ['hook', 'call', 'booked', 'end'];
export const DURATION = END;

export const SCREENS: Record<string, LineScreens> = {
  // S1a the "9:47 pm." clock lockup [0–1] + S1b "You're closed." [2–3] (both set at f0) · S2 [4–8]
  'ig2-01': { kind: 'caption', spans: [[0, 1], [2, 3], [4, 8]], set0: true },
  'ig2-02': { kind: 'row', spans: [[0, 7]] },
  'ig2-03': { kind: 'row', spans: [[0, 6]] },
  'ig2-04': { kind: 'row', spans: [[0, 5]] },
  'ig2-05': { kind: 'row', spans: [[0, 6]] },
  'ig2-06': { kind: 'caption', spans: [[0, 4]] },
  'ig2-07': { kind: 'caption', spans: [[0, 4]] },
  'ig1-07': { kind: 'brand', spans: [] },
};
export const DISPLAY: readonly Display[] = [{ id: 'ig2-01', from: 0, to: 1, text: '9:47 pm.' }];

/* ── the picture's moments (absolute frames; the acts and the cue sheet both read these) ── */
const S16 = BEAT / 4;
const on = (at: number, id: VoiceId, k: number) => at + vWord(id, k);
/** S2 "Watch it book / this call." leaves a beat after its last word, so the stage is clear for the pickup */
const S2_OUT = on(L1, 'ig2-01', 8) + BEAT;
/** "Saturday morning?" (fix round 2: everything started on "Saturday" — the scroll, her row, the panel's growth, the tool
 *  row, SAT and the chips within ½ s): ONE THING AT A TIME — the stack scrolls up as the caller's turn ends; her row
 *  rises into the room it made; the panel grows under "morning?"; the tool row rises after the word; SAT and the chips
 *  land while the spinner turns; the check draws and the free chips take her teal before "I have ten," */
const MORNING = on(A3, 'ig2-03', 1);
const TOOL1 = MORNING + 4;
const NAME = on(A5, 'ig2-05', 1);
const C1_FROM = CALLERS[0][0];
const BOOKED = on(A5, 'ig2-05', 3);
const FOLD = HANGUP + S16;
const PRO = on(L6, 'ig2-06', 4);
/** the hook's ring hairlines (absolute frames; `k` × their strength, `d1` how far they travel): the light rings on the
 *  phone's cadence until the pickup (fix round 2: from f60 the light went still while the phone was still ringing) —
 *    frame 0 IS MID-RING: two hairlines of the first trill already in flight (launched an 8th apart before frame 0, so
 *    the seam's re-formed frame 0 grows them from its own start) and a third leaving on the trill;
 *    each trill: two hairlines an 8th apart (its two chirps); under her "Watch it book…" the cadence goes on SILENT
 *    (no ring may cover a word's onset), a touch quieter; the pickup's ring: one, on its beat */
type Pulse = { at: number; k: number; d1: number };
const TRILL_D = 1300;
const BLINK_D = 1000;
const PULSES: readonly Pulse[] = [
  { at: -11.5, k: 1, d1: TRILL_D },
  { at: -4, k: 1, d1: TRILL_D },
  { at: 3.5, k: 0.8, d1: TRILL_D },
  ...[RINGS[1] - 4, RINGS[1] + 3.5].map((at, i) => ({ at, k: i ? 0.8 : 1, d1: TRILL_D })),
  // the phone's cadence goes on under her voice: a silent trill (two hairlines) every three beats between the rings
  ...(() => {
    const out: Pulse[] = [];
    for (let at = RINGS[1] + 3 * BEAT; at < RING3 - BEAT; at += 3 * BEAT) out.push({ at: at - 4, k: 0.75, d1: BLINK_D }, { at: at + 3.5, k: 0.6, d1: BLINK_D });
    return out;
  })(),
  { at: RING3, k: 1, d1: TRILL_D },
];
export const M = {
  /** every hairline the colon light sends (the ring train): frame 0's, the trills', the blinks', the pickup's */
  pulses: PULSES,
  /** the light's flashes (the dot's bloom; the room's rose swell): every hairline's launch */
  rings: PULSES.map((p) => p.at) as readonly number[],
  /** the dot's flash clock for the seam (frame 0's hairlines: a ring already in flight) */
  ringTrain: PULSES.map((p) => p.at) as readonly number[],
  s2Out: S2_OUT,
  /** the panel LANDS a frame after the birth (the house settle, SPRING.site, from 120 px below — there in ≈ 5 f, before
   *  her first word's row rises): a short move under the orb, so the colon opening into her orb leads the pickup */
  panelUp: PICKUP + 2,
  /** the colon light springs open into her orb, then glides to the label band */
  birth: PICKUP + 1,
  glide: [PICKUP + 8, PICKUP + 26] as const,
  /** the panel's header (● SAMPLE CALL) lands with it (its word "call" said before the pickup) */
  header: PICKUP + 2,
  /** the caller's first turn: the panel grows to hold its row (it hugs her greeting until then) */
  room: C1_FROM - 6,
  /** the transcript scrolls this many frames before her row rises (the room is made, then she fills it) */
  scrollLead: 2,
  /** after "morning?": the panel grows to hold the tool row and the slot strip AS the tool row rises (never an empty
   *  grown panel); the spinner turns until the check */
  grow: TOOL1 - 4,
  tool1: TOOL1,
  /** SAT and the five chips land while the spinner turns */
  sat: TOOL1 + 6,
  chips: TOOL1 + 8,
  tool1Done: TOOL1 + 18,
  /** the free chips take her teal as the check lands */
  chipsLit: TOOL1 + 18,
  /** "ten," / "eleven-thirty.": the free chips pulse */
  pulse: [on(A3, 'ig2-03', 4), on(A3, 'ig2-03', 6)] as const,
  /** "Ten it is.": the 10:00 chip fills her teal */
  fill: on(A4, 'ig2-04', 0),
  /** "Maya": her name clips onto the chip */
  name: NAME,
  /** "booked,": the chip widens into the event; the booking tool row rises ON the word (chrome on or after its word,
   *  SCRIPT §0.3 — never ahead of the payoff) and ticks a beat-8th later */
  booked: BOOKED,
  tool2: BOOKED + 1,
  tool2Done: BOOKED + 9,
  hangup: HANGUP,
  /** the panel folds to its header and steps back; the two cards land on 16ths */
  fold: FOLD,
  cards: [FOLD + 2 * S16, FOLD + 3 * S16] as const,
  /** the call FILED: the record's line (the transcript's first words) rises as the call's content clears — the folding
   *  panel is never a blank card (fix round 2) */
  record: FOLD + 3.5,
  /** "Pro": the PRO chip clips on, BETA a 16th later */
  pro: PRO,
  beta: PRO + S16,
} as const;
/** the zone stills (scripts/ig/check-zones.mjs): every chip and card landing + 8 f */
export const ZONE_FRAMES = [M.header, ...CALLERS.map(([a]) => a), M.tool1, M.chips, M.name, M.booked, M.hangup, M.record, M.cards[1], M.pro].map((f) => f + 8);

/** her CTA's last word out (the "k" of "link." released): the build waits for it */
const LINK_OUT = CTA + vWord('ig2-07', 4) + 6;
/** THE ROLL: the series' half bar into the impact — an 8th later only if her "link." were still sounding (fix round 1's
 *  case: it ended on the half bar; with the call's turns at a live pace it ends ≈ ⅔ s before it) */
const ROLL_AT = LINK_OUT <= IMPACT - ROLL ? IMPACT - ROLL : IMPACT - ROLL + BEAT / 2;
export const END_CARD = {
  cta: CTA,
  field: CTA - 12,
  agent: CTA + vWord('ig2-07', 1),
  send: end(CTA, 'ig2-07'),
  roll: ROLL_AT,
  impact: IMPACT,
  brand: BRAND_AT,
  url: [0, 1, 2].map((k) => BRAND_AT + vWord(BRAND, k)),
  seam: END - SEAM,
} as const;

/* ── the cue sheet (SCRIPT.md ig2 §4 "Sound", beat by beat; hierarchy: voice ≫ story sounds ≫ the bed) ── */
export const roomAt = (_f: number): Room => 'night';
/** the hook's rings: a trill each (a key hit at one level, film 2's RING_DB rule) with a low sub pulse under it; the
 *  third is the trill's first chirp alone, which the pickup's click cuts a 16th later */
const RING_WHERE = [' at frame 0: the reel’s attack', ' (in her pause before “You’re closed.”)', ' (after “…this call.”: one chirp, the pickup cuts it)'];
const ringHits = RINGS.flatMap((r, k) => [
  H(r, k === 2 ? 'fx-trill-1' : 'fx-trill', 'rush', 0.42, 1, `b1 ring ${k + 1} in the dark${RING_WHERE[k]} — the colon light flashes, hairlines leave it`),
  H(r, 'thump', 'none', 0.5, 3, `b1 ring ${k + 1}: the low pulse under the trill`, { db: -6, layer: true }),
]);
/** the caller's turns: the open line lifted (a run of line hiss under the meter, at the open line's presence: the
 *  turn is the caller talking, not a hole — fix round 2), nothing voiced */
const callerHits = CALLERS.map(([a, e], k) =>
  H(a + 1, 'fx-linehiss', 'none', 0.62, 2, `b${4 + 2 * k} the caller's turn: the line lifts under the level meter (no words, no voice)`, { db: -2, run: { n: Math.max(2, Math.round((e - a) / 7)), step: 6 } }),
);
export const HITS: Hit<Snd>[] = [
  H(0, 'fx-roomtone', 'none', 0.5, 3, 'b1 the closed studio’s room tone, from frame 0 (no bed: the ring is the opener)', { db: -22 }),
  ...ringHits,
  H(PICKUP, 'fx-pickup', 'none', 0.5, 1, 'b2 PICKUP: the click cuts the ring'),
  H(M.birth, 'fx-seed', 'sunday', 0.38, 2, 'b2 the colon light springs open into her orb (the seed)'),
  H(M.birth + 2, 'fx-ting', 'sunday', 0.38, 2, 'b2 … her teal: the birth’s ting', { layer: true }),
  H(M.panelUp, 'fx-paper-lift', 'none', 0.5, 3, 'b2 the call panel lands under her orb (its air clear of “Northside”)', { db: -6 }),
  H(PICKUP + 4, 'fx-linehold', 'none', 0.5, 3, 'b3 the open line under the call (very low)', { db: -16, layer: true }),
  ...callerHits,
  H(M.tool1 + 2, 'fx-tick', 'none', 0.3, 3, 'b5 “Saturday morning?”: a soft tick-roll under the availability spinner', { db: -10, run: { n: 6, step: BEAT / 4 } }),
  H(M.chips, 'tap', 'none', 0.5, 3, 'b5 the five slot chips land on 32nds (while the spinner turns)', { db: -10, run: { n: 5, step: BEAT / 8, xs: [0.2, 0.35, 0.5, 0.65, 0.8] } }),
  H(M.tool1Done, 'fx-ting', 'sunday', 0.3, 2, 'b5 the check draws: the free chips take her teal', { db: -2 }),
  H(M.pulse[0], 'fx-pluck-gs5', 'none', 0.36, 2, 'b5 “ten,”: the 10:00 chip pulses (G#5)'),
  H(M.pulse[1], 'fx-pluck-b5', 'none', 0.64, 2, 'b5 “eleven-thirty.”: the 11:30 chip pulses (B5)'),
  H(M.fill, 'fx-tock', 'none', 0.36, 2, 'b7 “Ten it is.”: the 10:00 chip fills teal'),
  H(M.name + 1, 'fx-tag', 'none', 0.4, 3, 'b9 “Maya”: the name chip clips onto the 10:00 chip'),
  H(M.booked, 'fx-mallet-e5', 'sunday', 0.5, 2, 'b9 “booked,”: the chip widens into the event; the tool row ticks (the mallet: true / done)'),
  H(M.booked, 'pop', 'none', 0.5, 3, 'b9 … a small pop under the mallet', { db: -6, layer: true }),
  H(HANGUP, 'fx-click-down', 'none', 0.5, 2, 'b9 HANG-UP (on the beat): the header swaps to Booked — down'),
  H(HANGUP + 2, 'fx-click-up', 'none', 0.5, 3, 'b9 … up', { layer: true }),
  H(M.fold + 1, 'fx-paper-fold', 'none', 0.5, 3, 'b10 the panel folds to its record (the call filed)', { db: -2 }),
  H(M.cards[0] + 2, 'fx-paper-square', 'none', 0.56, 2, 'b10 the EventCard lands (a paper slap, E4)', { semi: 0 }),
  H(M.record + 2, 'fx-felttip-short', 'none', 0.36, 3, 'b10 the record’s line rises as the panel folds (the call filed)', { db: -2, semi: 4 }),
  H(M.pro, 'fx-tag', 'none', 0.66, 2, 'b10 “Pro”: the PRO chip clips on'),
  H(M.beta, 'fx-tag', 'none', 0.76, 3, 'b10 … BETA a 16th later', { db: -3, semi: 3 }),
  ...endHits(END_CARD),
  // THE BUILD: her last word lands 20 f before the bar, so the swell crests early — a riser peaking as the roll does,
  // a 16th before the bed's inhale (the converge into the logo, check-mix arc); then the shared stack's own riser into the hit
  H(IMPACT - 10, 'riser', 'none', 0.5, 1, 'END the build’s crest under the roll (peaks a 16th before the inhale)', { db: 1.5 }),
  ...impactHits(IMPACT),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** The moments the bed reads (scripts/ig/bed.mjs inputs(T)): no bed under the hook — it enters on the beat after the
 *  pickup's (the plan's bar 3, f120, one beat after its pickup at f105). THE ROLL: END_CARD.roll (never under "link."). */
export const MUSIC = {
  bedFrom: upBeat(PICKUP + BEAT / 2),
  roll: END_CARD.roll,
  impact: IMPACT,
  brand: BRAND_AT,
  end: END,
  /** ig2's own moments (scripts/ig/bed.mjs ig2Parts): the check (the shaker enters), "Ten" (the open ostinato),
   *  "booked," (A → B), the hang-up (E: the cascade, the strings), the gate line (it thins), the CTA */
  ig2: { check: M.tool1Done, ten: M.fill, booked: M.booked, hangup: HANGUP, gate: L6, cta: CTA },
  /** the shared build, louder: the converge into the logo must top the gate line's second (check-mix arc) */
  build: { kick: 1.4, snare: 1.5 },
} as const;
/** the bed's fader: the series' shape round the hit (common/series.ts bedRide), with ig2's own two rides —
 *  THE CALLER'S TURNS (fix round 2): the bed comes up into each turn (the speech duck is still releasing there) and is
 *  back down before her next word, so the turn reads as the line open and the call moving, never as a hole in the mix;
 *  THE BUILD: held until "link." is out (its "k" released), then ridden up into the roll and kept up until the inhale
 *  draws it in: the converge into the logo is the loudest second of music (check-mix arc) */
const TURN_LIFT = [9, 9, 4] as const; // the third turn has the kit under it (the kick from "Ten"): less lift
const turnRide = ([a, e]: readonly [number, number], k: number) =>
  [
    [a - 2, 0],
    [a + 5, TURN_LIFT[k]],
    [e - 5, TURN_LIFT[k]],
    [e + 1, 0],
  ] as const;
/** the build's fader (dB): with the series' half-bar roll back (her "link." is out ⅔ s before it), +10 tops the gate's
 *  music by the arc's lead with the master limiter at ≈ 4 dB on the roll (fix round 1's +13.5 drove it to 8 dB) */
const BUILD_DB = 10;
export const BED = {
  file: `ig/sfx/${REEL}/bed.wav`,
  vol: 2,
  ride: [
    [0, 0],
    ...CALLERS.flatMap((c, k) => turnRide(c, k)),
    [LINK_OUT, 0],
    [END_CARD.roll + 3, BUILD_DB],
    [IMPACT - 11, BUILD_DB],
    // the series' shape round the hit, its seam point a touch up (−17 for −20): ig2's louder build costs master gain,
    // and the chord must still ring 10–5 f from the end (check-mix ≥ −55 dBFS; the mix's own fade takes it under −60)
    ...bedRide(IMPACT, BRAND_AT, vFrames(BRAND), END)
      .filter(([f]) => f >= IMPACT - 1)
      .map(([f, db]) => [f, f === END - SEAM ? -17 : db] as const),
  ] as readonly (readonly [number, number])[],
};
export const MIX = {
  file: `ig/sfx/${REEL}/mix.wav`,
  ...IG_LOUD,
  fadeOut: [END - SEAM, END] as const,
  impact: igImpact(IMPACT, BRAND_AT - IMPACT),
  name: IG_NAME,
  /** the card cascade: the booked act, from the hang-up to the end card */
  arc: igArc([[SCENES.booked.from, SCENES.booked.to]]),
} as const;
export const GRAIN = { ground: 'night' as 'pearl' | 'night' };

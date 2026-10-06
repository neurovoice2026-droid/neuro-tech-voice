/**
 * REEL 2 · "Booked after hours" — every timing constant of the reel (docs/ig/SCRIPT.md "ig2", PIPELINE.md §6.1).
 * 22.0 s · 11 bars · 660 timeline frames (2640 at 120 fps). Impact f600 (bar 11), END f660. The series' only night ground.
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
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, ROLL, SEAM, SFX, H, bedRide, igArc, igImpact, impactHits, place, upBar,
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
const L1 = place(PLAN.lines['ig2-01']);
/** the pickup click: the ring is cut, the colon light springs open into the teal orb */
export const PICKUP = Math.max(PLAN.pickup, upBeat(end(L1, 'ig2-01')));
const A2 = place(PLAN.lines['ig2-02'], PICKUP, PLAN.lines['ig2-02'] - PLAN.pickup);
const turn = (k: 0 | 1 | 2, after: number) => {
  const from = place(PLAN.callers[k][0], after, 4);
  return [from, from + PLAN.callers[k][1]] as const;
};
const C1 = turn(0, end(A2, 'ig2-02'));
const A3 = place(PLAN.lines['ig2-03'], C1[1], 0);
const C2 = turn(1, end(A3, 'ig2-03'));
const A4 = place(PLAN.lines['ig2-04'], C2[1], 3);
const C3 = turn(2, end(A4, 'ig2-04'));
const A5 = place(PLAN.lines['ig2-05'], C3[1], 3);
/** the caller's turns [from, to): a ● CALLER row with the level meter, line hiss +3 dB */
export const CALLERS = [C1, C2, C3] as const;
/** the hang-up, on the beat after "…Saturday at ten." (the header swaps to Booked) */
export const HANGUP = Math.max(PLAN.hangup, upBeat(end(A5, 'ig2-05') + 4));
const L6 = place(PLAN.lines['ig2-06'], HANGUP, PLAN.lines['ig2-06'] - PLAN.hangup);
const CTA = place(PLAN.lines['ig2-07'], end(L6, 'ig2-06'));
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
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {};
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

export const END_CARD = {
  cta: CTA,
  field: CTA - 12,
  agent: CTA + vWord('ig2-07', 1),
  send: end(CTA, 'ig2-07'),
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  url: [0, 1, 2].map((k) => BRAND_AT + vWord(BRAND, k)),
  seam: END - SEAM,
} as const;

/* ── the cue sheet (placeholder hits until the acts are built: the rings, the pickup, the impact) ── */
export const roomAt = (_f: number): Room => 'night';
export const HITS: Hit<Snd>[] = [
  H(0, 'fx-trill', 'rush', 0.5, 1, 'b1 a ring in the dark at frame 0 (the attack)'),
  H(60, 'fx-trill', 'rush', 0.5, 1, 'b1 the second ring'),
  H(PICKUP, 'fx-pickup', 'none', 0.5, 1, 'b2 PICKUP: the click cuts the ring'),
  ...impactHits(IMPACT),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** The moments the bed reads (scripts/ig/bed.mjs inputs(T)): no bed under the hook — it enters a beat after the pickup
 *  (the plan's bar 3, f120, one beat after its pickup at f105). */
export const MUSIC = { bedFrom: PICKUP + BEAT, roll: IMPACT - ROLL, impact: IMPACT, brand: BRAND_AT, end: END } as const;
export const BED = { file: `ig/sfx/${REEL}/bed.wav`, vol: 2, ride: bedRide(IMPACT, BRAND_AT, vFrames(BRAND), END) };
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

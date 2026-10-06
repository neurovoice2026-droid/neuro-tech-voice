/**
 * REEL 4 · "Can you trip it up?" — every timing constant of the reel (docs/ig/SCRIPT.md "ig4", PIPELINE.md §6.1).
 * 26.0 s · 13 bars · 780 timeline frames (3120 at 120 fps). Impact f720 (bar 13), END f780.
 *
 * Quick-fire: a ring on the beat, the phrasing a 6-frame breath after it, three times; the answer; the curveball's
 * ring; a stop-time of 0.9 s (the bed cut on the sample); the owner's fallback; the thesis; the CTA. Each ring waits
 * for the take before it to finish (on the next beat); only the CTA can push the end card on by whole bars.
 *
 * Node-safe (PIPELINE.md H10): explicit `.ts` extensions, type-only imports marked, no React or Remotion.
 */
import { VOICE, type VoiceId } from '../voice.generated.ts';
import { BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b } from '../../timing.ts';
import { buildCues, makeSpeech, makeVoiceKit, upBeat, upQuarter, type Cue, type Hit, type Room, type Voiced, type VoiceRide } from '../common/cues.ts';
import {
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, ROLL, SEAM, SFX, H, bedRide, igArc, igImpact, impactHits, place, upBar,
  type Display, type LineScreens, type Snd,
} from '../common/series.ts';

export { BAR, BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b, SFX };
export type { Cue, Hit, Snd, Voiced, VoiceId };

export const REEL = 'ig4' as const;
export const TITLE = 'Can you trip it up?';

/* ── voices ── */
const KIT = makeVoiceKit(VOICE);
export const { vFrames, vWord, voiceCut, voiceEnd } = KIT;
const end = (at: number, id: VoiceId) => voiceEnd({ at, id });

/* ── the plan (SCRIPT.md ig4 §3, frames) ── */
export const PLAN = {
  acts: { hook: 0, asked: 90, edge: 345, thesis: 516, end: 594 },
  /** the rings: three phrasings, then the curveball */
  rings: [90, 135, 195, 345],
  /** a phrasing starts this long after its ring */
  afterRing: 6,
  lines: { 'ig4-01': 6, 'ig4-05': 258, 'ig4-07': 438, 'ig4-08': 516, 'ig4-09': 594 },
  /** b7: nothing moves, the bed cut on the sample [from, frames] */
  stop: [408, 27],
  impact: 720,
  end: 780,
} as const;

/* ── the voiced timeline ── */
const L1 = place(PLAN.lines['ig4-01']);
const ringAfter = (plan: number, after: number) => Math.max(plan, upBeat(after + 3));
const R1 = ringAfter(PLAN.rings[0], end(L1, 'ig4-01'));
const L2 = R1 + PLAN.afterRing;
const R2 = ringAfter(PLAN.rings[1], end(L2, 'ig4-02'));
const L3 = R2 + PLAN.afterRing;
const R3 = ringAfter(PLAN.rings[2], end(L3, 'ig4-03'));
const L4 = R3 + PLAN.afterRing;
const L5 = place(PLAN.lines['ig4-05'], end(L4, 'ig4-04'));
const R4 = ringAfter(PLAN.rings[3], end(L5, 'ig4-05'));
const L6 = R4 + PLAN.afterRing;
/** the rings (each a trill chirp cut by the pickup a 16th later) */
export const RINGS = [R1, R2, R3, R4] as const;
/** THE STOP-TIME [from, to): the mesh desaturates, nothing moves, the bed and its tails cut on the sample */
const STOP_FROM = Math.max(PLAN.stop[0], upQuarter(end(L6, 'ig4-06') + 8));
export const STOP = [STOP_FROM, STOP_FROM + PLAN.stop[1]] as const;
const L7 = place(PLAN.lines['ig4-07'], STOP[1], PLAN.lines['ig4-07'] - (PLAN.stop[0] + PLAN.stop[1]));
const L8 = place(PLAN.lines['ig4-08'], end(L7, 'ig4-07'));
const CTA = place(PLAN.lines['ig4-09'], end(L8, 'ig4-08'));
export const IMPACT = Math.max(PLAN.impact, upBar(end(CTA, 'ig4-09') + BEAT));
export const END = IMPACT + IMPACT_BEFORE_END;
export const BRAND_AT = IMPACT + IMPACT_GAP;

export const VOICES: Voiced<VoiceId>[] = (
  [
    { at: L1, id: 'ig4-01' },
    { at: L2, id: 'ig4-02' },
    { at: L3, id: 'ig4-03' },
    { at: L4, id: 'ig4-04' },
    { at: L5, id: 'ig4-05' },
    { at: L6, id: 'ig4-06' },
    { at: L7, id: 'ig4-07' },
    { at: L8, id: 'ig4-08' },
    { at: CTA, id: 'ig4-09' },
    { at: BRAND_AT, id: BRAND },
  ] as Voiced<VoiceId>[]
).sort((x, y) => x.at - y.at);
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {};
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/* ── the acts ── */
export const SCENES = (() => {
  const w = (from: number, to: number, pre = 0, post = 0) => ({ from, to, pre, post });
  return {
    hook: w(PLAN.acts.hook, R1),
    asked: w(R1, R4),
    edge: w(R4, L8),
    thesis: w(L8, CTA),
    end: w(CTA, END),
  } as const;
})();
export type SceneKey = keyof typeof SCENES;
export const ORDER: readonly SceneKey[] = ['hook', 'asked', 'edge', 'thesis', 'end'];
export const DURATION = END;

export const SCREENS: Record<string, LineScreens> = {
  'ig4-01': { kind: 'caption', spans: [[0, 6]], set0: true },
  'ig4-02': { kind: 'slot', spans: [[0, 4]] },
  'ig4-03': { kind: 'slot', spans: [[0, 6]] },
  'ig4-04': { kind: 'slot', spans: [[0, 4]] },
  'ig4-05': { kind: 'row', spans: [[0, 7]] },
  'ig4-06': { kind: 'slot', spans: [[0, 5]] },
  'ig4-07': { kind: 'field', spans: [[0, 8]] },
  'ig4-08': { kind: 'caption', spans: [[0, 6]] },
  'ig4-09': { kind: 'caption', spans: [[0, 2], [3, 4], [5, 10]] },
  'ig1-07': { kind: 'brand', spans: [] },
};
export const DISPLAY: readonly Display[] = [{ id: 'ig4-05', from: 6, to: 7, text: '$85.' }];

export const END_CARD = {
  cta: CTA,
  field: CTA + 6,
  agent: CTA + vWord('ig4-09', 4),
  send: end(CTA, 'ig4-09'),
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  url: [0, 1, 2].map((k) => BRAND_AT + vWord(BRAND, k)),
  seam: END - SEAM,
} as const;

/* ── the cue sheet (placeholder hits until the acts are built: the rings, the impact) ── */
export const roomAt = (_f: number): Room => 'white';
export const HITS: Hit<Snd>[] = [
  H(0, 'fx-trill', 'rush', 0.5, 1, 'b1 the ring at frame 0 (the attack)'),
  ...RINGS.map((f, k) => H(f, 'fx-trill', 'rush', 0.5, 1, `b${k < 3 ? k + 2 : 6} ring ${k + 1}: ${k < 3 ? 'a phrasing' : 'the curveball'}`)),
  ...impactHits(IMPACT),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

export const MUSIC = { bedFrom: 0, stop: STOP, roll: IMPACT - ROLL, impact: IMPACT, brand: BRAND_AT, end: END } as const;
export const BED = { file: `ig/sfx/${REEL}/bed.wav`, vol: 2, ride: bedRide(IMPACT, BRAND_AT, vFrames(BRAND), END) };
export const MIX = {
  file: `ig/sfx/${REEL}/mix.wav`,
  ...IG_LOUD,
  fadeOut: [END - SEAM, END] as const,
  impact: igImpact(IMPACT, BRAND_AT - IMPACT),
  name: IG_NAME,
  /** the hairline chord */
  arc: igArc([[90, 255]]),
} as const;
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

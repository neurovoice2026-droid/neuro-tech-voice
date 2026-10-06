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
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, LINE_GAP, ROLL, SEAM, SFX, H, afterRing, endHits, bedRide, igArc, igImpact, impactHits, place, upBar,
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
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {};
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

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
  'ig1-02': { kind: 'caption', spans: [[0, 5], [6, 12]] },
  'ig1-03': { kind: 'caption', spans: [[0, 4], [5, 8]] },
  'ig1-04': { kind: 'caption', spans: [[0, 3], [4, 7], [8, 11]] },
  'ig1-05': { kind: 'caption', spans: [[0, 4], [5, 8]] },
  'ig1-06': { kind: 'caption', spans: [[0, 4], [5, 9]] },
  'ig1-07': { kind: 'brand', spans: [] },
};
/** Numerals over spoken word spans (the Captions fork's display map). */
export const DISPLAY: readonly Display[] = [
  { id: 'ig1-02', from: 4, to: 4, text: '45' },
  { id: 'ig1-02', from: 9, to: 12, text: '168.' },
  { id: 'ig1-03', from: 2, to: 4, text: '123?' },
];

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

/* ── the cue sheet (placeholder hits until the acts are built: the ring and the impact) ── */
export const roomAt = (_f: number): Room => 'white';
export const HITS: Hit<Snd>[] = [
  H(0, 'fx-trill', 'rush', 0.62, 1, 'b1 the desk phone rings at frame 0 (the attack)'),
  H(30, 'fx-trill', 'rush', 0.62, 2, 'b1 its second burst'),
  ...endHits(END_CARD),
  ...impactHits(IMPACT),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** The moments the bed reads (scripts/ig/bed.mjs inputs(T)). */
export const MUSIC = { bedFrom: 0, roll: IMPACT - ROLL, impact: IMPACT, brand: BRAND_AT, end: END } as const;
export const BED = { file: `ig/sfx/${REEL}/bed.wav`, vol: 2, ride: bedRide(IMPACT, BRAND_AT, vFrames(BRAND), END) };
export const MIX = {
  file: `ig/sfx/${REEL}/mix.wav`,
  ...IG_LOUD,
  fadeOut: [END - SEAM, END] as const,
  impact: igImpact(IMPACT, BRAND_AT - IMPACT),
  name: IG_NAME,
  /** the music-forward passage the converge into the logo must top (check-mix): the teal cascade (from "other", 36 f) */
  arc: igArc([[CASCADE, CASCADE + 36]]),
} as const;
/** The finish (components/Finish.tsx): pearl ground. Grain and dither strengths are settled by the bit-budget probe. */
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

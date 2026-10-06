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
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, ROLL, SEAM, SFX, H, afterRing, bedRide, igArc, igImpact, impactHits, place, ringBefore, upBar,
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

/* ── the plan (SCRIPT.md ig3 §3, frames) ── */
export const PLAN = {
  acts: { hook: 0, call: 240, payoff: 435, end: 546 },
  /** rings of the phone across the room (the hook; placed in her pauses: RINGS) */
  rings: [0, 60, 120, 180],
  pickup: 240,
  lines: { 'ig3-01': 6, 'ig3-02': 108, 'ig3-03': 246, 'ig3-04': 354, 'ig3-05': 450, 'ig3-06': 546 },
  caller: [330, 24],
  hangup: 435,
  impact: 660,
  end: 720,
} as const;

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
/** the pickup click (bar 5): the dimmed dot springs open into the teal orb */
export const PICKUP = Math.max(PLAN.pickup, upBeat(end(L2, 'ig3-02')));
const A3 = place(PLAN.lines['ig3-03'], PICKUP, PLAN.lines['ig3-03'] - PLAN.pickup);
const CALLER_FROM = place(PLAN.caller[0], end(A3, 'ig3-03'), 4);
/** the caller's turn [from, to): the meter row */
export const CALLERS = [[CALLER_FROM, CALLER_FROM + PLAN.caller[1]] as const] as const;
const A4 = place(PLAN.lines['ig3-04'], CALLERS[0][1], 0);
/** THE HANG-UP: the corner chip reads 00:00, the tick stops dead — the beat after her answer (+ 4 f) */
export const HANGUP = Math.max(PLAN.hangup, upBeat(end(A4, 'ig3-04') + 4));
const L5 = place(PLAN.lines['ig3-05'], HANGUP, PLAN.lines['ig3-05'] - PLAN.hangup);
const CTA = place(PLAN.lines['ig3-06'], end(L5, 'ig3-05'));
export const IMPACT = Math.max(PLAN.impact, upBar(end(CTA, 'ig3-06') + BEAT));
export const END = IMPACT + IMPACT_BEFORE_END;
export const BRAND_AT = IMPACT + IMPACT_GAP;
/** the timer: 12:00 at frame 0, real seconds until the pickup, then a time-lapse from 11:52 that ends on HANGUP */
export const TIMER = { start: 12 * 60, lapseFrom: PICKUP, lapseStart: 11 * 60 + 52, zeroAt: HANGUP } as const;

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

/* ── the cue sheet (placeholder hits until the acts are built: the rings, the pickup, the hang-up, the impact) ── */
export const roomAt = (_f: number): Room => 'white';
export const HITS: Hit<Snd>[] = [
  ...RINGS.map((f, k) => H(f, 'fx-trill', 'rush', 0.3, 1, `b1 the phone across the room rings (${k + 1}/4)`)),
  H(PICKUP, 'fx-pickup', 'none', 0.5, 1, 'b3 PICKUP: the click; the dot springs open into her light'),
  H(HANGUP, 'fx-mallet-e5', 'sunday', 0.5, 1, 'b6 HANG-UP: the timer reads 00:00'),
  ...impactHits(IMPACT),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

export const MUSIC = { bedFrom: 0, roll: IMPACT - ROLL, impact: IMPACT, brand: BRAND_AT, end: END } as const;
export const BED = { file: `ig/sfx/${REEL}/bed.wav`, vol: 2, ride: bedRide(IMPACT, BRAND_AT, vFrames(BRAND), END) };
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

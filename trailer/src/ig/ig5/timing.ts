/**
 * REEL 5 · "Don't pay $300" — every timing constant of the reel (docs/ig/ig5/SCRIPT.md, docs/ig/ig5/PIPELINE.md §6.1;
 * the contract of docs/ig/PIPELINE.md §6.1, in ig4's shape). Plan 28.0 s · 14 bars · 840 timeline frames (3360 at
 * 120 fps), impact f780 (bar 14), END f840.
 *
 * PROVISIONAL (the infrastructure step, docs/ig/ig5/INFRA-LOG.md): the voices are Kokoro placeholders (engine "kokoro"
 * in ./voice.generated.ts) and the acts are title cards (acts/Acts.tsx). What later steps replace, and where:
 *   · the takes          → `npm run voice:ig5 -- --install=…` rewrites ./voice.generated.ts; everything below re-anchors
 *                          to the measured takes by itself (PLAN + `place`, as ig4)
 *   · the cast           → CASTS: the ids placed in each role, the trim ladder of SCRIPT §4.3 (full → T1 → T1 + T2);
 *                          the first rung whose CTA lets the impact land on PLAN.impact is placed (the launch-gate swap
 *                          ig5-06 → ig5-06-msg and the A/B hook ig5-01b are one id each here)
 *   · the acts' moments  → M (empty now), ZONE_FRAMES, the cue sheet HITS (the series' frame only: the frame-0 ring,
 *                          the end card's stack, the build and the impact) and BED.ride / MUSIC (the IG stub bed)
 *
 * Each line sits on its planned frame unless the take before it still sounds (common/series.ts `place`; "Ours?" waits
 * PLAN.oursGap for the stop-time); only the CTA can push the end card on by whole bars (and DURATION may not pass 840:
 * the driver contract's 28 s).
 *
 * Node-safe (PIPELINE.md H10): explicit `.ts` extensions, type-only imports marked, no React or Remotion. It imports
 * ONLY ./voice.generated.ts, film 1's src/timing.ts and src/ig/common/ — scripts/ig5/hash.mjs hashes every .ts here.
 */
import { VOICE, type VoiceId } from './voice.generated.ts';
import { BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b } from '../../timing.ts';
import { buildCues, makeSpeech, makeVoiceKit, type Cue, type Hit, type Room, type Voiced, type VoiceRide } from '../common/cues.ts';
import {
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, ROLL, SEAM, SFX, H, afterRing, endHits, bedRide, igArc, igImpact, impactHits, place, upBar,
  type Display, type LineScreens, type Snd,
} from '../common/series.ts';

export { BAR, BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b, SFX };
export type { Cue, Hit, Snd, Voiced, VoiceId };

export const REEL = 'ig5' as const;
export const TITLE = 'Don’t pay $300';

/* ── voices ── */
const KIT = makeVoiceKit(VOICE);
export const { vFrames, vWord, voiceCut, voiceEnd } = KIT;
const end = (at: number, id: VoiceId) => voiceEnd({ at, id });
/** the frame her voice has stopped in a take placed at `at` (its last frame of loudness ≥ CUT.onset, + 1) */
const voiced = (at: number, id: VoiceId) => {
  const env = VOICE.lines[id].env;
  let i = env.length - 1;
  while (i > 0 && env[i] < CUT.onset) i--;
  return at + i + 1;
};

/* ── the plan (SCRIPT.md §2 beat table, §5; frames) ── */
export const PLAN = {
  acts: { hook: 0, agency: 122, answering: 231, ours: 350, setup: 462, does: 571, end: 690 },
  lines: { hook: 6, agency: 124, answering: 233, ours: 352, setup: 465, does: 574, cta: 694 },
  /** "Ours?" waits this long after the answering line (the stop-time before it, SCRIPT §5.2) */
  oursGap: 12,
  /** the comment field rises this long BEFORE her first CTA word "Comment" (SCRIPT b7: f688 for the CTA @694) */
  fieldLead: 6,
  impact: 780,
  end: 840,
} as const;
export type Role = keyof typeof PLAN.lines;

/* ── the cast: which take plays each role (SCRIPT §4.1, the trim ladder §4.3) ── */
type Cast = { readonly [R in Role]: VoiceId };
const FULL: Cast = { hook: 'ig5-01', agency: 'ig5-02', answering: 'ig5-03', ours: 'ig5-04', setup: 'ig5-05', does: 'ig5-06', cta: 'ig5-07' };
/** full → T1 (ig5-02t) → T1 + T2 (+ ig5-05t): never a hedge cut (SCRIPT §4.3) */
export const CASTS: readonly Cast[] = [FULL, { ...FULL, agency: 'ig5-02t' }, { ...FULL, agency: 'ig5-02t', setup: 'ig5-05t' }];

/** the voiced timeline of one cast: each role's start, and the impact its CTA allows */
const layout = (c: Cast) => {
  const hook = afterRing(PLAN.lines.hook, 0, KIT.firstSound(c.hook));
  const agency = place(PLAN.lines.agency, end(hook, c.hook));
  const answering = place(PLAN.lines.answering, end(agency, c.agency));
  const ours = place(PLAN.lines.ours, end(answering, c.answering), PLAN.oursGap);
  const setup = place(PLAN.lines.setup, end(ours, c.ours));
  const does = place(PLAN.lines.does, end(setup, c.setup));
  const cta = place(PLAN.lines.cta, end(does, c.does));
  return { at: { hook, agency, answering, ours, setup, does, cta } as { readonly [R in Role]: number }, impact: Math.max(PLAN.impact, upBar(end(cta, c.cta) + BEAT)) };
};
const FIT = CASTS.findIndex((c) => layout(c).impact <= PLAN.impact);
/** the rung placed (0 full, 1 T1, 2 T1 + T2; the last when none fits — the end card then moves on by bars) */
export const RUNG = FIT < 0 ? CASTS.length - 1 : FIT;
export const CAST = CASTS[RUNG];
const LAID = layout(CAST);
/** the lines' starts (absolute frames), by role */
export const LINE = LAID.at;
const CTA = LINE.cta;
export const IMPACT = LAID.impact;
export const END = IMPACT + IMPACT_BEFORE_END;
export const BRAND_AT = IMPACT + IMPACT_GAP;

export const VOICES: Voiced<VoiceId>[] = (
  [...(Object.keys(LINE) as Role[]).map((r) => ({ at: LINE[r], id: CAST[r] })), { at: BRAND_AT, id: BRAND }] as Voiced<VoiceId>[]
).sort((x, y) => x.at - y.at);
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {};
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/* ── the acts: each starts its plan lead before its line (the end card's act before the comment field rises) ── */
const FIELD = CTA - PLAN.fieldLead;
export const SCENES = (() => {
  const w = (from: number, to: number, pre = 0, post = 0) => ({ from, to, pre, post });
  const from = (r: Exclude<Role, 'hook' | 'cta'>) => LINE[r] - (PLAN.lines[r] - PLAN.acts[r]);
  const endFrom = Math.min(CTA - (PLAN.lines.cta - PLAN.acts.end), FIELD - 2);
  return {
    hook: w(0, from('agency')),
    agency: w(from('agency'), from('answering')),
    answering: w(from('answering'), from('ours')),
    ours: w(from('ours'), from('setup')),
    setup: w(from('setup'), from('does')),
    does: w(from('does'), endFrom),
    end: w(endFrom, END),
  } as const;
})();
export type SceneKey = keyof typeof SCENES;
export const ORDER: readonly SceneKey[] = ['hook', 'agency', 'answering', 'ours', 'setup', 'does', 'end'];
export const DURATION = END;

/** the screens (SCRIPT §4.2), for every line a cast can place; the payoff's (S8–S9) print on "ours" in the built reel */
export const SCREENS: Record<string, LineScreens> = {
  'ig5-01': { kind: 'caption', spans: [[0, 5], [6, 9]], set0: true },
  'ig5-01b': { kind: 'caption', spans: [[0, 6], [7, 10]], set0: true },
  'ig5-02': { kind: 'caption', spans: [[0, 4], [5, 8]] },
  'ig5-02t': { kind: 'caption', spans: [[0, 3], [4, 7]] },
  'ig5-03': { kind: 'caption', spans: [[0, 2], [3, 6], [7, 9]] },
  'ig5-04': { kind: 'caption', spans: [[0, 5], [6, 8]] },
  'ig5-05': { kind: 'caption', spans: [[0, 4], [5, 8]] },
  'ig5-05t': { kind: 'caption', spans: [[0, 4]] },
  'ig5-06': { kind: 'caption', spans: [[0, 5], [6, 9]] },
  'ig5-06-msg': { kind: 'caption', spans: [[0, 5], [6, 9]] },
  'ig5-07': { kind: 'caption', spans: [[0, 4]] },
  'ig1-07': { kind: 'brand', spans: [] },
};
/** the display map (SCRIPT §4.2): numerals over the spoken words */
export const DISPLAY: readonly Display[] = [
  { id: 'ig5-01', from: 2, to: 3, text: '$300' },
  { id: 'ig5-01b', from: 3, to: 4, text: '$300' },
  { id: 'ig5-02', from: 7, to: 8, text: '$1,500.' },
  { id: 'ig5-02t', from: 6, to: 7, text: '$1,500.' },
  { id: 'ig5-03', from: 4, to: 4, text: '$99' },
  { id: 'ig5-03', from: 8, to: 8, text: '50' },
  { id: 'ig5-04', from: 2, to: 3, text: '$49' },
];

/* ── the picture's moments (absolute frames): none yet — the acts are title cards ── */
export const M = {} as const;
/** extra zone stills (scripts/ig/check-zones.mjs): none until the acts are built */
export const ZONE_FRAMES: readonly number[] = [];

/** AGENT's word in the CTA line (components/End.tsx agentWord: the same lookup) */
const AGENT_K = Math.max(0, VOICE.lines[CAST.cta].say.split(' ').findIndex((w) => w.replace(/[^A-Za-z]/g, '') === 'AGENT'));
export const END_CARD = {
  cta: CTA,
  field: FIELD,
  agent: CTA + vWord(CAST.cta, AGENT_K),
  send: end(CTA, CAST.cta),
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  url: [0, 1, 2].map((k) => BRAND_AT + vWord(BRAND, k)),
  seam: END - SEAM,
} as const;

/* ── the cue sheet: the series' frame only (placeholder; SCRIPT §2 "Sound" lands with the acts) ── */
export const roomAt = (_f: number): Room => 'white';
/** the delivery's AAC head (ig4's lesson, check-delivery ≤ −1 dBTP): the frame-0 attack sits `db` under, the bed back by `to` */
const HEAD = { db: -4, to: 3 } as const;
export const HITS: Hit<Snd>[] = [
  H(0, 'fx-trill', 'rush', 0.8, 1, 'b1 THE RING AT FRAME 0 (the series’ “a call” attack; HEAD.db under) — the desk phone’s rose light', { db: -3 + HEAD.db }),
  ...endHits(END_CARD),
  H(IMPACT - 10, 'riser', 'none', 0.5, 1, 'END the build’s crest under the roll (peaks a 16th before the inhale)', { db: 1.5 }),
  ...impactHits(IMPACT),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** THE STOP-TIME before the payoff (SCRIPT b4): the bed cut on the sample from 4 f before "Ours?" to "forty-nine",
 *  from the placed take's onsets (never from plan frames) */
export const STOP = [LINE.ours + vWord(CAST.ours, 0) - 4, LINE.ours + vWord(CAST.ours, 2)] as const;
/** The moments the bed reads (scripts/ig/bed.mjs inputs(T): no ARRANGEMENTS.ig5, so the stub plays) */
export const MUSIC = {
  bedFrom: 0,
  stop: STOP,
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  end: END,
  /** ig5's own moments (for a later arrangement): the lines by role, "forty-nine", the CTA */
  ig5: { ...LINE, fortyNine: STOP[1] },
  build: { kick: 1.4, snare: 1.5, inhaleDb: -12 },
} as const;
/** the bed's fader (ig3's shape): under her through the body, ridden up into the build as her CTA ends, then the
 *  series' shape round the hit, the chord held 2.5 dB higher into the seam */
const CTA_END = Math.min(voiced(CTA, CAST.cta), IMPACT - 14);
const RIDE = { under: 6, build: 13 } as const;
export const BED = {
  file: `ig/sfx/${REEL}/bed.wav`,
  vol: 2,
  ride: [
    [0, RIDE.under + HEAD.db],
    [HEAD.to, RIDE.under],
    [CTA_END - 12, RIDE.under],
    [CTA_END, RIDE.build],
    [IMPACT - 12, RIDE.build],
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
  /** the music-forward passage (placeholder): the bed's return on "forty-nine", 45 f */
  arc: igArc([[STOP[1], STOP[1] + 45]]),
} as const;
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

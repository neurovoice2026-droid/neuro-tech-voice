/**
 * REEL 4 · "Can you trip it up?" — every timing constant of the reel (docs/ig/SCRIPT.md "ig4", PIPELINE.md §6.1).
 * Plan 26.0 s · 13 bars (impact f720). WITH THE INSTALLED TAKES (voice-candidates/ig/PICKS.md): 28.0 s · 14 bars ·
 * 840 timeline frames (3360 at 120 fps), impact f780 (bar 14), END f840 — the script's "gains one bar" rule.
 *
 * Quick-fire: a ring on the beat, the phrasing a 6-frame breath after it, three times; the answer; the curveball's
 * ring; a stop-time of 0.9 s (the bed cut on the sample); the owner's fallback; the thesis; the CTA. Each ring (one
 * chirp, fx-trill-1) waits for her voice before it to stop (on the next beat); only the CTA can push the end card on by
 * whole bars.
 *
 * Node-safe (PIPELINE.md H10): explicit `.ts` extensions, type-only imports marked, no React or Remotion.
 */
import { VOICE, type VoiceId } from '../voice.generated.ts';
import { BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b } from '../../timing.ts';
import { buildCues, makeSpeech, makeVoiceKit, upBeat, upQuarter, type Cue, type Hit, type Room, type Voiced, type VoiceRide } from '../common/cues.ts';
import {
  BAR, BRAND, CHIRP_OUT, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, ROLL, SEAM, SFX, H, afterRing, endHits, bedRide, igArc, igImpact, impactHits, place, upBar,
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
/** the hook: on its planned frame, once the frame-0 chirp has rung out before her first word */
const L1 = afterRing(PLAN.lines['ig4-01'], 0, KIT.firstSound('ig4-01'), CHIRP_OUT);
/** the frame her voice has stopped in a take placed at `at` (its last frame of loudness ≥ CUT.onset, + 1) — a ring
 *  waits for her voice, not for the file's silent tail */
const voiced = (at: number, id: VoiceId) => {
  const env = VOICE.lines[id].env;
  let i = env.length - 1;
  while (i > 0 && env[i] < CUT.onset) i--;
  return at + i + 1;
};
/** a ring: on its planned beat, or on the first beat ≥ 3 frames after the voice before it has stopped */
const ringAfter = (plan: number, after: number) => Math.max(plan, upBeat(after + 3));
const R1 = ringAfter(PLAN.rings[0], voiced(L1, 'ig4-01'));
const L2 = R1 + PLAN.afterRing;
const R2 = ringAfter(PLAN.rings[1], voiced(L2, 'ig4-02'));
const L3 = R2 + PLAN.afterRing;
const R3 = ringAfter(PLAN.rings[2], voiced(L3, 'ig4-03'));
const L4 = R3 + PLAN.afterRing;
const L5 = place(PLAN.lines['ig4-05'], end(L4, 'ig4-04'));
const R4 = ringAfter(PLAN.rings[3], voiced(L5, 'ig4-05'));
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
/** the lines' starts (absolute frames), by role */
export const LINE = { hook: L1, asked: [L2, L3, L4] as const, answer: L5, curve: L6, fallback: L7, thesis: L8, cta: CTA } as const;

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
/** THE VOICE POST: her CTA leans hard into "Comment AGENT," — a 1.5 dB fader on that phrase (its body stays on the
 *  dialogue target), so the logo, not her keyword, is the reel's loudest second (check-mix climax) */
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {
  'ig4-09': [{ from: vWord('ig4-09', 3) - 2, to: vWord('ig4-09', 5) - 2, db: -1.5, ramp: 3 }],
};
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
  // "Now:" first; the quoted question rises on "do" (the take breathes 0.9 s after "Now:") — "Now:" holds over it
  'ig4-06': { kind: 'slot', spans: [[0, 0], [1, 5]] },
  'ig4-07': { kind: 'field', spans: [[0, 8]] },
  'ig4-08': { kind: 'caption', spans: [[0, 6]] },
  'ig4-09': { kind: 'caption', spans: [[0, 2], [3, 4], [5, 10]] },
  'ig1-07': { kind: 'brand', spans: [] },
};
export const DISPLAY: readonly Display[] = [{ id: 'ig4-05', from: 6, to: 7, text: '$85.' }];

/* ── the picture's moments (absolute frames; SCRIPT.md ig4 §4, re-timed with the takes) ── */
const S16 = BEAT / 4;
const S32 = BEAT / 8;
const on = (at: number, id: VoiceId, k: number) => at + vWord(id, k);
const lastWord = (id: VoiceId) => VOICE.lines[id].words.length - 1;
/** S1 leaves up through its masks a few frames after her voice has stopped (a beat and more after its last word) */
const S1_OUT = voiced(L1, 'ig4-01') + 5;
/** a phrasing's hairline: from its last word's onset, drawn in 12 f (EASE.draw) — it LANDS (the pluck) as it arrives */
const LINK_DUR = 12;
const linkStart = (at: number, id: VoiceId) => on(at, id, lastWord(id));
const LINKS = [linkStart(L2, 'ig4-02'), linkStart(L3, 'ig4-03'), linkStart(L4, 'ig4-04')] as const;
/** the answer: the slot swaps to ● AVA 3 f before her first word; the three hairlines contract into the line as she starts */
const SWAP = on(L5, 'ig4-05', 0) - 3;
const FIELD_UP = STOP[1];
/** the field steps back once her fallback has stopped AND its last word ("back.", the focus ring) has held a beat
 *  (SCRIPT §0.3: a caption holds ≥ 1 beat after its last word); the rows come forward under it, to rest under the thesis */
const FIELD_OUT = Math.max(voiced(L7, 'ig4-07') + 3, Math.ceil(on(L7, 'ig4-07', lastWord('ig4-07')) + BEAT + 1));
export const M = {
  /** b1: S1 leaves; the page glides up and right to make room for the slot (sub-pixel, EASE.inOut) */
  s1Out: S1_OUT,
  glide: [S1_OUT + 1, S1_OUT + 19] as const,
  /** b2: the slot's hairline frame draws on the first ring, its eyebrow ASKED AS rising with it */
  slot: R1,
  /** b2–b4: the hairlines (start, landing) and the "pricey" underline */
  links: LINKS,
  lands: LINKS.map((f) => f + LINK_DUR) as readonly number[],
  linkDur: LINK_DUR,
  pricey: on(L4, 'ig4-04', 4),
  /** each phrasing leaves on the next ring (the last on the answer's swap) */
  phrasingOut: [R2, R3, SWAP - 4] as const,
  /** b5: the swap, the links contracting into the swept line, "eighty-five" */
  swap: SWAP,
  retract: [SWAP + 2, SWAP + 14] as const,
  eightyFive: on(L5, 'ig4-05', 6),
  /** b6: the answer leaves on the ring; the page shrinks into the first of five rows; the others land on 16ths */
  answerOut: R4,
  shrink: [R4 + 1, R4 + 12] as const,
  rows: [R4 + 11, R4 + 11 + S16, R4 + 11 + 2 * S16, R4 + 11 + 3 * S16, R4 + 11 + 4 * S16] as readonly number[],
  /** the threshold draws once the rows are in (under "do you do") */
  threshold: on(L6, 'ig4-06', 1) - 6,
  /** on "visits": five hairlines rise from the slot on 32nds and stop short of the threshold */
  visits: on(L6, 'ig4-06', 5),
  stubs: [0, 1, 2, 3, 4].map((k) => on(L6, 'ig4-06', 5) + k * S32) as readonly number[],
  /** b7: the stop-time */
  stop: STOP,
  /** b8: the field slides up as time resumes; ● AVA; the focus ring on "back." */
  fieldUp: FIELD_UP,
  avaTag: FIELD_UP + 2,
  back: on(L7, 'ig4-07', 8),
  fieldOut: FIELD_OUT,
  /** the question (with its frame: one unit), the threshold and its hairlines leave just before the field steps back,
   *  so the slot is gone before the thesis rises in its band */
  edgeOut: FIELD_OUT - 3,
  /** b9: "says so" (the bed returns on "so") */
  says: on(L8, 'ig4-08', 5),
  so: on(L8, 'ig4-08', 6),
} as const;
/** the zone stills (scripts/ig/check-zones.mjs): the slot, each landing, the swap, the rows, the threshold, the field */
export const ZONE_FRAMES: readonly number[] = [M.slot, ...M.lands, M.swap, M.rows[4], M.threshold, M.stubs[4], M.fieldUp, M.back, M.says].map((f) => Math.round(f + 8));

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

/* ── the cue sheet (SCRIPT.md ig4 §4 "Sound", beat by beat; hierarchy: voice ≫ story sounds ≫ the bed) ── */
export const roomAt = (_f: number): Room => 'white';
/** THE FILE'S FIRST SAMPLES: the delivery's AAC (scripts/ig/finish.mjs) starts on the mix's sample 1024 under a 2 ms
 *  fade, and a limiter-pinned onset there decodes +3.6 dB hot (0.0 dBTP at 30 ms; check-delivery wants ≤ −1). The
 *  frame-0 attack — the ring and the riff's first call — sits `db` under the later rings, the bed back on its body
 *  level by frame `to` (the ring is still the replay's first sound) */
const HEAD = { db: -4, to: 3 } as const;
/** a ring: one desk-trill chirp (a key hit at one level, film 2's RING_DB rule), cut by the pickup a 16th later */
const ring = (f: number, what: string, trim = 0): Hit<Snd>[] => [
  H(f, 'fx-trill-1', 'rush', 0.16, 1, `${what}: one trill chirp — a rose ring leaves her orb`, trim ? { db: trim } : {}),
  H(f + S16, 'fx-pickup', 'none', 0.16, 2, `${what}: … picked up a 16th later (the click cuts the chirp)`, { db: -4 + trim }),
];
const LANDING = ['fx-pluck-e5', 'fx-pluck-gs5', 'fx-pluck-b5'] as const;
export const HITS: Hit<Snd>[] = [
  H(0, 'fx-roomtone', 'none', 0.5, 3, 'b1 the studio’s room tone, from frame 0 (on through the stop-time: its air floor)', { db: -27 }),
  ...ring(0, 'b1 THE RING AT FRAME 0 (the attack; HEAD.db under the later rings)', HEAD.db),
  H(M.glide[0] + 1, 'fx-paper-lift', 'none', [0.5, 0.6], 3, 'b1 the price list glides up and right (the slot needs the room)', { db: -9 }),
  ...ring(R1, 'b2 ring 1'),
  H(M.slot + 2, 'draw', 'none', [0.3, 0.7], 3, 'b2 the slot’s slate hairline frame draws; ASKED AS rises', { db: -12 }),
  ...ring(R2, 'b3 ring 2 sends the first phrasing up and out'),
  ...ring(R3, 'b4 ring 3 sends the second phrasing up and out'),
  ...M.links.flatMap((f, k) => [
    H(f, 'fx-scratch', 'none', [0.4, 0.2], 3, `b${k + 2} hairline ${k + 1}: the pen draws up from the slot`, { db: -9, layer: true }),
    H(f + LINK_DUR, LANDING[k], 'none', 0.3, 1, `b${k + 2} hairline ${k + 1} LANDS on “Sports massage · 60 min · $85” — ${['E5', 'G#5', 'B5'][k]} (the chord building)${k ? '' : '; LANDS ON'}`, { db: k ? -2 : -1 }),
  ]),
  H(M.pricey + 1, 'fx-felttip-short', 'none', 0.4, 3, 'b4 “pricey”: a slate underline under the word the page never says', { db: -5 }),
  H(M.swap, 'fx-tag', 'none', 0.3, 3, 'b5 the slot swaps to ● AVA (its frame turns her teal)', { db: -6 }),
  // (its attack a frame AHEAD of the vowel, with the price's glint, and 5 dB under the landings: the price is the line
  //  that matters, so the mallet colours "eighty-five" without masking it — check-mix SII)
  H(M.eightyFive - 1, 'fx-mallet-e5', 'sunday', 0.62, 1, 'b5 “eighty-five”: the page’s $85 takes her teal — the mallet resolves the chord (with the glint, under the word)', { db: -9 }),
  ...ring(R4, 'b6 ring 4: THE CURVEBALL'),
  H(M.shrink[0] + 1, 'fx-paper-fold', 'none', 0.55, 3, 'b6 the page folds down into its row: Price list · PDF', { db: -4 }),
  H(M.rows[1], 'tap', 'none', 0.5, 3, 'b6 the four other documents land on 16ths', { db: -9, run: { n: 4, step: S16, xs: [0.45, 0.5, 0.55, 0.6] } }),
  H(M.threshold + 1, 'draw', 'none', [0.1, 0.9], 3, 'b6 the threshold draws across: Close enough to answer', { db: -10 }),
  H(M.visits, 'fx-tock', 'none', 0.5, 2, 'b6 “visits”: five hairlines rise toward the documents on 32nds and stop short — five muted tocks falling E4 C#4 B3 A3 G#3', {
    db: -7,
    run: { n: 5, step: S32, semis: [-12, -15, -17, -19, -20], xs: [0.2, 0.35, 0.5, 0.65, 0.8] },
  }),
  H(STOP[0] + 1, 'fx-linehiss', 'none', 0.5, 3, 'b7 THE STOP-TIME: the bed and its tails cut on the sample — only the line’s hiss and the room, at the air floor', { db: -32, run: { n: 3, step: 8 } }),
  H(M.fieldUp + 1, 'fx-paper-lift', 'none', [0.5, 0.45], 3, 'b8 time resumes: the owner’s field slides up over the stepped-back documents', { db: -6 }),
  H(M.back + 2, 'fx-glass-tick', 'sunday', 0.5, 2, 'b8 “back.”: her teal focus ring settles round the field', { db: -2 }),
  H(M.fieldOut + 2, 'whoosh-soft', 'none', 0.5, 3, 'b9 the field steps back; the five documents come forward, at rest', { db: -14 }),
  H(M.says, 'fx-ting', 'sunday', 0.3, 2, 'b9 “says so”: her teal glint (the bed returns on “so”)', { db: -4 }),
  ...endHits(END_CARD),
  // THE BUILD: her last word lands 16 f before the bar, so the swell crests early — a riser peaking as the roll does, a
  // 16th before the bed's inhale (the converge into the logo, check-mix arc); then the shared stack's own riser into the hit
  H(IMPACT - 10, 'riser', 'none', 0.5, 1, 'END the build’s crest under the roll (peaks a 16th before the inhale)', { db: 1.5 }),
  ...impactHits(IMPACT),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** The moments the bed reads (scripts/ig/bed.mjs inputs(T), ig4Parts) */
export const MUSIC = {
  bedFrom: 0,
  stop: STOP,
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  end: END,
  /** ig4's own moments: the rings (the riff's calls), the landings (the chord building), the answer, the curveball,
   *  the fallback's pad (from the stop's end), "so" (the bed returns), the CTA */
  ig4: { rings: [0, R1, R2, R3, R4] as readonly number[], lands: M.lands, answer: L5, eightyFive: M.eightyFive, curve: R4, so: M.so, says: M.says, cta: CTA },
  /** the shared build, louder: the converge into the logo must top the hairline chord (check-mix arc) */
  build: { kick: 1.4, snare: 1.5, inhale: 1, inhaleDb: -11 },
} as const;
/** the bed's fader: the series' shape round the hit (common/series.ts bedRide), with the reel's BUILD — her CTA ends
 *  16 f before the bar, so the roll is ridden up as her last word lands and kept up until the inhale draws it in */
const CTA_END = voiced(CTA, 'ig4-09');
/** THE BODY'S LEVEL: the bed carries the reel between her lines at the films' balance (≈ 10.5 LU under her voice
 *  over the body, films 1–2: 9.6 / 10.6 LU) — the arrangement's own dynamics are quiet by design (a pluck riff, a
 *  pad), so the fader lifts them: the riff under the hook and the phrasings; the curveball's strings SWELLING into
 *  the cut (the hard stop on the sample is only an event if the bed was there to stop); the warm pad under the
 *  fallback and "Where your documents stop" held forward (it is all that is left after the cut); the bed's RETURN on
 *  "so" (riff, kick, rim, the rolled E) a step down from the pad on the fader — its own energy carries it over; the
 *  CTA a touch under the return (the logo must top her loudest second by 1 LU, check-mix climax) */
const BODY = { hook: 5, asked: 5, answer: 5.5, curve: 6.5, swell: 12.5, pad: 13.5, ret: 5.5, cta: 2.5 } as const;
/** the build's ride up as her last word ends, held until the inhale */
const RIDE = { up: [-3, 2] as const, db: 11, hold: 9 } as const;
/** the impact insert, tuned for this reel (check-mix climax): the stack driven a touch harder into the clipper, so the
 *  logo tops her loudest second and the inhale before it with room to spare — see MIX.impact */
const IMPACT_TUNE = { ceil: -3, rideDb: 7 } as const;
/** the end card's chord a touch forward into the seam (check-mix: it still rings 10–5 f from the end) */
const RING_LIFT = 1.5;
export const BED = {
  file: `ig/sfx/${REEL}/bed.wav`,
  vol: 2,
  ride: [
    // the riff's first call under the frame-0 ring, HEAD.db down (the delivery's AAC head), back by HEAD.to
    [0, BODY.hook + HEAD.db],
    [HEAD.to, BODY.hook],
    // the riff under the phrasings (the hairline chord is the sfx's: the plucks)
    [RINGS[0] - 4, BODY.hook],
    [RINGS[0] + 2, BODY.asked],
    [M.swap - 4, BODY.asked],
    [M.swap + 6, BODY.answer],
    // the curveball: the kick out, the strings swelling into the cut
    [RINGS[3] - 2, BODY.answer],
    [RINGS[3] + 6, BODY.curve],
    [STOP[0] - 10, BODY.swell],
    [STOP[0], BODY.swell],
    // (the cut is in the bed itself) — the pad after it, forward
    [STOP[1], BODY.pad],
    // "so": the bed returns (its riff and kick louder than the pad; the fader steps down under them)
    [M.so - 1, BODY.pad],
    [M.so + 6, BODY.ret],
    [CTA - 6, BODY.ret],
    [CTA, BODY.cta],
    [CTA_END + RIDE.up[0], BODY.cta],
    [CTA_END + RIDE.up[1], RIDE.db],
    [IMPACT - RIDE.hold, RIDE.db],
    ...bedRide(IMPACT, BRAND_AT, vFrames(BRAND), END)
      .filter(([f]) => f >= IMPACT - 1)
      .map(([f, d]) => [f, f >= END - SEAM ? d + RING_LIFT : d] as const),
  ] as readonly (readonly [number, number])[],
};
export const MIX = {
  file: `ig/sfx/${REEL}/mix.wav`,
  ...IG_LOUD,
  fadeOut: [END - SEAM, END] as const,
  impact: { ...igImpact(IMPACT, BRAND_AT - IMPACT), ...IMPACT_TUNE },
  name: IG_NAME,
  /** the hairline chord: the three phrasings, from the first ring to the answer */
  arc: igArc([[RINGS[0], L5]]),
} as const;
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

/**
 * REEL 6 · "One ring" (slug `one-ring`) — every timing constant of the reel (docs/ig/ig6/SCRIPT.md §1–§8,
 * docs/ig/ig6/PIPELINE.md §6.1; the contract of docs/ig/PIPELINE.md §6.1, in ig5's shape).
 * Plan 28.0 s · 14 bars · 840 timeline frames (3360 at 120 fps), impact f780 (bar 14), brand f784, seam f826, END f840.
 *
 * THE VOICES are the Cartesia picks (Tessa (Emotive), sonic-3.6-2026-08-27, speed 1.05; voice-candidates/ig6/PICKS.md):
 * ig6-01 b · 02a d · 02b a · 03 a · 04 d · 05 a · 06 c · 07 a · 01r b · 01b a · 07b c, installed from take-a … take-d
 * (engine "cartesia" in ./voice.generated.ts). Everything below re-anchors on them by itself (PLAN + `place`, as ig5).
 * With these takes, both casts place hook rung 0 (1b holding 15 f) and the full script (trim 0) at 28.0 s, impact f780:
 *   A  hook @10 · 02a @135 (stopped f167) · 02b @190 (stopped f231) · 03 @240 · whip f330 · hub ring f345 ·
 *      pickup f360 (bar 7 line) · 04 @368 ("receptionist" f388, "day" f439 → day cut f438) · 05 @492 ("from" f515, the
 *      sweep lands f513) · 06 @585 · CTA @680 (stopped f723, 42 f spare; AGENT f695) · sign-off @784
 *   B  the same body; hook ig6-01b @10, 02a @120 on its plan frame (stopped f152)
 * PROVISIONAL (the infrastructure step, docs/ig/ig6/INFRA-LOG.md): the acts are title cards (acts/Acts.tsx). What later
 * steps replace, and where:
 *   · the takes          → `npm run voice:ig6 -- --install=…` rewrites ./voice.generated.ts; everything below re-anchors to
 *                          the measured takes by itself (PLAN + `place`, as ig5)
 *   · the hook           → HOOK: the ladder of SCRIPT §1.3 on the cast of this pass (CAST 'A' = ig6-01, 'B' = ig6-01b;
 *                          PIPELINE §6.4); the first rung whose ig6-02a has stopped by f174 is placed
 *   · the trim           → TRIMS: full → T1 (ig6-06 dropped, SCRIPT §5.3) when the CTA would end past f765
 *   · the acts' moments  → M (the anchors SCRIPT §3–§4 re-anchors on the takes), ZONE_FRAMES (none yet)
 * THE SOUND (the sound step, docs/ig/ig6/BUILD.md §9) hangs on the same M and onsets: the cue sheet HITS (the clock's
 * steps, the two rings in the North American cadence, the fall-through, the whip, the hub's one ring (rung out) and
 * the pickup, the agent's glass domes, the end card), VOICE_RIDES (the climax's headroom) and MUSIC / BED for ig6's own bed
 * (scripts/ig6/bed.mjs: no music under the hook, the clock as the hat, the fall-through's cut, the stop-time, the return).
 *
 * FIXED, never moved by a take (SCRIPT §1.3, §2): ring 1 on f0, ring 2 on f180 (six real seconds later, the reel's
 * honest demonstration of the North American cadence), the T2 fall-through f222–234. MOVED by the takes: the whip is
 * anchored at ig6-03's voice end + 8 f; the cut 3 f later; the hub's ring on the first beat ≥ the cut + 12; the pickup on
 * the bar line (or, more than a beat away, the beat) ≥ the ring + 15; ig6-04 ≥ the pickup + 8; the day cut on "day".
 * ASSERTS states every rule; a failed one is a contract error of scripts/ig6/generate-sfx.mjs (`npm run sfx:ig6` refuses
 * to build) — it never throws here, so the shared IG bundle (ig1–ig5) always loads.
 *
 * Node-safe (PIPELINE.md H10): explicit `.ts` extensions, type-only imports marked, no React or Remotion. It imports
 * ONLY ./voice.generated.ts, film 1's src/timing.ts and src/ig/common/ — scripts/ig6/hash.mjs hashes every .ts here.
 */
import { VOICE, type VoiceId } from './voice.generated.ts';
import { BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b } from '../../timing.ts';
import { buildCues, makeSpeech, makeVoiceKit, upBeat, upQuarter, type Cue, type Hit, type Room, type Voiced, type VoiceRide } from '../common/cues.ts';
import {
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, RING_OUT, ROLL, SEAM, SFX, H, afterRing, endHits, bedRide, igArc, igImpact, impactHits, place, upBar,
  type Display, type LineScreens, type Snd,
} from '../common/series.ts';

export { BAR, BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b, SFX };
export type { Cue, Hit, Snd, Voiced, VoiceId };

export const REEL = 'ig6' as const;
export const TITLE = 'One ring';

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
/** the index of a line's last word */
const lastWord = (id: VoiceId) => VOICE.lines[id].say.split(' ').length - 1;
/** a line's word index by its letters ("day" is [5] of ig6-04) */
const ixOf = (id: VoiceId, w: string) => VOICE.lines[id].say.split(' ').findIndex((x) => x.replace(/[^A-Za-z']/g, '').toLowerCase() === w);

/* ── the plan (SCRIPT.md §3–§5; frames) ── */
export const PLAN = {
  /** SCRIPT §4 "Acts" (plan): each re-anchors on its line or its moment below */
  acts: { hook: 0, wait: 116, missed: 234, pickup: 333, day: 435, words: 525, ring: 570, end: 654 },
  /** SCRIPT §5.3 placement simulation at 2.78 words/s (plan frames: floors the takes push on) */
  lines: { hook: 10, rings: 120, waiting: 190, missed: 240, agent: 368, words: 492, ring: 585, cta: 680 },
  /** ring 1 (frame 0) and ring 2 (six seconds later, on the bar 4 line): FIXED */
  ring1: 0,
  ring2: 180,
  /** ig6-02a's voice has stopped by here (ring 2 − 6: no onset in (ring − 6, ring + RING_OUT)) */
  ring2Clear: 174,
  /** T2 fall-through into node 2 (shot D): the push f222–228, the disc to f232, white f232–233, shot E opens f234 */
  fall: [222, 234] as const,
  /** the tier is set at 72 % ink this long before her first word (STYLE §9.8) */
  cardLead: 2,
  /** lockup 1b's three tiers leave 4 f each, 1 f apart: gone this long after its exit starts */
  exitSpan: 6,
  /** the T3 whip: at least here, and ig6-03's voice end + whipAfter; the cut on its fastest frame, whip + whipCut */
  whip: 330,
  whipAfter: 8,
  whipCut: 3,
  /** the hub's ring: the first beat ≥ the cut + ringAfterCut */
  ringAfterCut: 12,
  /** the pickup: the bar line ≥ the ring + pickupAfterRing if it is at most pickupBarWait further, else that beat */
  pickupAfterRing: 15,
  pickupBarWait: BEAT,
  /** ig6-04 starts no sooner than the pickup + this (the stamp is heard alone) */
  agentAfterPickup: 8,
  /** MUSIC.stop = [whip − stopLead, pickup + stopTail) (SCRIPT §6) */
  stopLead: 8,
  stopTail: 15,
  /** the bed enters on the bar 3 line (SCRIPT b2) */
  bedFrom: 120,
  /** the agent's day: one full turn at M5′, linear, from the cut on "day" (SCRIPT b5) */
  sweep: 75,
  /** the words act cuts on the first beat ≥ "from" + this (SCRIPT b6: "from" ≈ f510 → f525): the accent has landed on
   *  "from" and the sweep's SPRING.land has settled. Re-anchored on the Cartesia takes from a whole BEAT: "from" lands
   *  f515, and "+ a beat" (f530) would have pushed the cut to f540, stretching the day act to 102 f and leaving shot J
   *  30 f for its 40 f orbit; + 8 f keeps SCRIPT's f525 (day 87 f, words 45 f) and gives f525 for the plan's f510 too. */
  wordsAfterFrom: 8,
  /** the ring act cuts this long before "Ring" (f570 for f585); without ig6-06 (trim T1) this long after the words cut */
  ringLead: 15,
  wordsHold: 45,
  /** the comment field rises this long before "Comment" (f662 for f680); the end act starts this long before it (f654) */
  fieldLead: 18,
  endLead: 26,
  impact: 780,
  end: 840,
  /** the CTA's voice has stopped by the impact − 15 (SCRIPT §5.3) */
  ctaDeadline: 765,
} as const;

/* ── the casts (SCRIPT §0.1 "Cuts", §1.3; PIPELINE §6.4) ── */
/** THE PASS: A = the receptionist hook (ig6-01, posted on both apps), B = the owner-operator hook (ig6-01b, the TikTok
 *  re-cut a week later; lockup 1b becomes "You" / can't answer.). The master step renders A, then B. */
export const CAST: 'A' | 'B' = 'A';
/** a hook rung: the take, and how long lockup 1b holds after "answer." before it leaves */
export type HookRung = { readonly id: VoiceId; readonly hold: number };
/** THE HOOK LADDER per cast (SCRIPT §1.3), in order: ig6-01 with 1b holding 15 f, then 8 f; the tighter reading ig6-01r;
 *  the B hook ig6-01b. The first rung whose ig6-02a has stopped by PLAN.ring2Clear is placed. */
export const CASTS: { readonly [C in 'A' | 'B']: readonly HookRung[] } = {
  A: [
    { id: 'ig6-01', hold: 15 },
    { id: 'ig6-01', hold: 8 },
    { id: 'ig6-01r', hold: 15 },
    { id: 'ig6-01r', hold: 8 },
    { id: 'ig6-01b', hold: 15 },
    { id: 'ig6-01b', hold: 8 },
  ],
  B: [
    { id: 'ig6-01b', hold: 15 },
    { id: 'ig6-01b', hold: 8 },
  ],
};
/** the body (one for both casts). The no-AGENT launch swap is one id here: cta 'ig6-07b' (SCRIPT §14 question 5). */
const BODY = { rings: 'ig6-02a', waiting: 'ig6-02b', missed: 'ig6-03', agent: 'ig6-04', words: 'ig6-05', ring: 'ig6-06', cta: 'ig6-07' } as const;
type Body = { readonly rings: VoiceId; readonly waiting: VoiceId; readonly missed: VoiceId; readonly agent: VoiceId; readonly words: VoiceId; readonly ring: VoiceId | null; readonly cta: VoiceId };
/** THE TRIM LADDER (SCRIPT §5.3): full → T1 (ig6-06 dropped: b7 becomes a wordless glide, the dome still pops). Never
 *  squeeze ring 2, the pickup or the seam. */
export const TRIMS: readonly Body[] = [BODY, { ...BODY, ring: null }];
export type Role = 'hook' | keyof Body;

/** the voiced timeline of one hook rung and one body */
const layout = (h: HookRung, c: Body) => {
  const hook = afterRing(PLAN.lines.hook, PLAN.ring1, KIT.firstSound(h.id));
  /** lockup 1b leaves `hold` after "answer." (her last hook word); tier 2 is set PLAN.cardLead before "While" */
  const s1bGone = hook + vWord(h.id, lastWord(h.id)) + h.hold + PLAN.exitSpan;
  const rings = Math.max(place(PLAN.lines.rings, end(hook, h.id)), upQuarter(s1bGone + PLAN.cardLead - vWord(c.rings, 0)));
  /** ig6-02b completes the sentence after ring 2 has rung out (no onset in (ring − 6, ring + RING_OUT)) */
  const waiting = Math.max(place(PLAN.lines.waiting, end(rings, c.rings)), afterRing(PLAN.lines.waiting, PLAN.ring2, KIT.firstSound(c.waiting)));
  const missed = place(PLAN.lines.missed, end(waiting, c.waiting));
  const whip = Math.max(PLAN.whip, Math.ceil(voiced(missed, c.missed) + PLAN.whipAfter));
  const cut = whip + PLAN.whipCut;
  const ring = upBeat(cut + PLAN.ringAfterCut);
  const r15 = ring + PLAN.pickupAfterRing;
  const pickup = upBar(r15) - r15 <= PLAN.pickupBarWait ? upBar(r15) : upBeat(r15);
  const agent = Math.max(place(PLAN.lines.agent, end(missed, c.missed)), pickup + PLAN.agentAfterPickup);
  const words = place(PLAN.lines.words, end(agent, c.agent));
  const ringAt = c.ring === null ? null : place(PLAN.lines.ring, end(words, c.words));
  const cta = place(PLAN.lines.cta, ringAt !== null && c.ring !== null ? end(ringAt, c.ring) : end(words, c.words));
  return {
    at: { hook, rings, waiting, missed, agent, words, ring: ringAt, cta },
    s1bGone,
    whip,
    cut,
    ring,
    pickup,
    ringsVoiced: voiced(rings, c.rings),
    ctaVoiced: voiced(cta, c.cta),
    impact: Math.max(PLAN.impact, upBar(end(cta, c.cta) + BEAT)),
  };
};
const RUNGS = CASTS[CAST];
const RUNG_FIT = RUNGS.findIndex((h) => layout(h, TRIMS[0]).ringsVoiced <= PLAN.ring2Clear);
/** the hook rung placed (its index in CASTS[CAST]; the last when none fits — ASSERTS then fails) */
export const HOOK_RUNG = RUNG_FIT < 0 ? RUNGS.length - 1 : RUNG_FIT;
export const HOOK: { readonly cast: 'A' | 'B'; readonly rungs: readonly HookRung[]; readonly rung: number; readonly take: VoiceId; readonly hold: number } = {
  cast: CAST,
  rungs: RUNGS,
  rung: HOOK_RUNG,
  take: RUNGS[HOOK_RUNG].id,
  hold: RUNGS[HOOK_RUNG].hold,
};
const TRIM_FIT = TRIMS.findIndex((c) => layout(RUNGS[HOOK_RUNG], c).impact <= PLAN.impact);
/** the trim placed (0 full, 1 T1; the last when none fits — the end card then moves on by bars, and ASSERTS fails) */
export const TRIM = TRIM_FIT < 0 ? TRIMS.length - 1 : TRIM_FIT;
const BODY_PLACED = TRIMS[TRIM];
const LAID = layout(RUNGS[HOOK_RUNG], BODY_PLACED);
/** the take of each role (null: dropped by the trim) */
export const TAKES: { readonly [R in Role]: VoiceId | null } = { hook: HOOK.take, ...BODY_PLACED };
/** the lines' starts (absolute frames), by role (null: dropped) */
export const LINE = LAID.at;
const CTA = LINE.cta;
export const IMPACT = LAID.impact;
export const END = IMPACT + IMPACT_BEFORE_END;
export const BRAND_AT = IMPACT + IMPACT_GAP;

export const VOICES: Voiced<VoiceId>[] = (
  [
    ...(Object.keys(LINE) as Role[]).flatMap((r) => {
      const at = LINE[r];
      const id = TAKES[r];
      return at === null || id === null ? [] : [{ at, id }];
    }),
    { at: BRAND_AT, id: BRAND },
  ] as Voiced<VoiceId>[]
).sort((x, y) => x.at - y.at);
/** THE VOICE POST (ig4's / ig5's method: the climax's headroom). The reel's loudest 400 ms windows were all her hook's
 *  "six seconds." (dry, no bed until f120): ridden down, "One ring," with it. master() re-trims every ridden line to −20,
 *  so the heard reduction is about half the nominal one and the unridden rest comes up; its hottest syllable ("Your" in
 *  ig6-01, "can't" in ig6-01b) is ridden too, so the dialogue limiter does no more work than on the unridden take.
 *  ig6-03's two loudest seconds come down with them (the next-loudest windows once the hook's were down). */
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {
  'ig6-01': [
    { from: 0, to: 24, db: -4, ramp: 2 },
    { from: 25, to: 40, db: -5, ramp: 2 },
    { from: 41, to: 60, db: -3, ramp: 2 },
  ],
  'ig6-01b': [
    { from: 0, to: 25, db: -5, ramp: 2 },
    { from: 26, to: 36, db: -8, ramp: 2 },
    { from: 37, to: 58, db: -5.5, ramp: 2 },
    { from: 72, to: 80, db: -2.5, ramp: 2 },
  ],
  /** "A missed call" and "is someone" (the line's two loudest seconds; "else's customer." comes up a touch) */
  'ig6-03': [
    { from: 3, to: 33, db: -1.5, ramp: 2 },
    { from: 34, to: 50, db: -2.5, ramp: 2 },
  ],
};
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/** THE ALIGNER'S STAMPS THAT SIT OFF HER SOUND (crit-r1 sync SYNC-2, read on the wavs; ig5's idiom): frames added to word
 *  k of a take. Cartesia stamps in 80 ms steps and several land after the word is heard, so the grey tier's lift, the
 *  lead's rise and the accent's wipe printed late. The PLACEMENT (layout(), the hook ladder, ASSERTS, the lockups' exits)
 *  stays on the raw stamps, so no line or screen moves; the word-level picture (stage/Lockup.tsx toks) and the cue sheet's
 *  word hits read `said`. "for" sits between its /f/ (−4.5) and its vowel (−1.4): −3 is within 2 f of both; "still"
 *  takes −1.5, not the measured −1.85, because it leads its accent's left-to-right wipe (at −1.85 it read 2.1 f early). ig1-07 [2]
 *  "Voice." (the borrow, its wav untouched): the URL's third chunk types on her /v/ (crit-r1 SYNC-3). */
export const NUDGE: Partial<Record<VoiceId, Readonly<Record<number, number>>>> = {
  'ig6-01': { 1: -2.1, 7: -4.4 },
  'ig6-02a': { 1: -2.0 },
  'ig6-02b': { 1: -1.5 },
  'ig6-03': { 3: -2.4, 4: -2.5, 6: 0.8 },
  'ig6-05': { 1: -2.9, 2: -2.6, 3: -3.6 },
  'ig6-06': { 1: -1.8 },
  'ig6-07': { 2: -3, 3: -1.75 },
  'ig1-07': { 2: -2 },
};
/** her onset of word k of take id as she says it (local frames: the rounded stamp + NUDGE) */
export const said = (id: VoiceId, k: number) => vWord(id, k) + (NUDGE[id]?.[k] ?? 0);

/** her onset of word k of a role's placed take (as she says it) */
const on = (r: Role, k: number) => {
  const at = LINE[r];
  const id = TAKES[r];
  return at === null || id === null ? NaN : at + said(id, k);
};
/** her onset of a role's word by its letters */
const onWord = (r: Role, w: string) => {
  const id = TAKES[r];
  return id === null ? NaN : on(r, Math.max(0, ixOf(id, w)));
};

/* ── the moments (absolute frames; SCRIPT §3–§4): the anchors the scene build and the cue sheet hang on ── */
const DAY_CUT = onWord('agent', 'day') - 1;
const WORDS_CUT = upBeat(onWord('words', 'from') + PLAN.wordsAfterFrom);
const RING_CUT = LINE.ring !== null ? LINE.ring - PLAN.ringLead : WORDS_CUT + PLAN.wordsHold;
const FIELD = CTA - PLAN.fieldLead;
const END_FROM = Math.min(CTA - PLAN.endLead, FIELD - 2);
export const M = {
  /** b1: ring 1 on frame 0 (node 1 pulses, pings, shivers) — FIXED */
  ring1: PLAN.ring1,
  /** b1: lockup 1b leaves by here (hook rung's hold) */
  s1bGone: LAID.s1bGone,
  /** b1 → b2: the T1 tick cut to shot B (M3′) on the f90 step */
  shotB: 90,
  /** b2: RING 2 — node 2 lands under the needle on the step, six real seconds after ring 1 — FIXED */
  ring2: PLAN.ring2,
  /** b2: the T1 cut back to shot C (M1) on the f210 step */
  shotC: 210,
  /** b2 → b3: the T2 fall-through into node 2 [push start, shot E opens] — FIXED */
  fall: PLAN.fall,
  /** b3 → b4: the T3 whip (7 f), the cut on its fastest frame to shot G (M2′) */
  whip: LAID.whip,
  cut: LAID.cut,
  /** b4: a fresh call rings at the hub; the pickup stamps teal on the bar line */
  ring: LAID.ring,
  pickup: LAID.pickup,
  /** b4: the pull-back to M1 and the rebuild; the glide from its end */
  rebuild: [LAID.pickup + 4, LAID.pickup + 24] as const,
  /** b5: the T1 cut on "day" to shot I (M5′); the full turn of the agent's day */
  day: DAY_CUT,
  sweep: [DAY_CUT, DAY_CUT + PLAN.sweep] as const,
  /** b6: the T1 cut to shot J (M3′, a beat after "from") */
  words: WORDS_CUT,
  /** b7: the T1 cut to shot K (M1); the recede into End6 [start, end act] */
  ringShot: RING_CUT,
  exit: [END_FROM - 14, END_FROM] as const,
} as const;
/** extra zone stills (scripts/ig/check-zones.mjs: each is a still): none until the acts are built */
export const ZONE_FRAMES: readonly number[] = [];

/* ── the acts (SCRIPT §4 "Acts"), each on its re-anchored moment ── */
export const SCENES = (() => {
  const w = (from: number, to: number, pre = 0, post = 0) => ({ from, to, pre, post });
  const wait = LINE.rings - (PLAN.lines.rings - PLAN.acts.wait);
  return {
    hook: w(0, wait),
    wait: w(wait, PLAN.acts.missed),
    missed: w(PLAN.acts.missed, M.cut),
    pickup: w(M.cut, M.day),
    day: w(M.day, M.words),
    words: w(M.words, M.ringShot),
    ring: w(M.ringShot, END_FROM),
    end: w(END_FROM, END),
  } as const;
})();
export type SceneKey = keyof typeof SCENES;
export const ORDER: readonly SceneKey[] = ['hook', 'wait', 'missed', 'pickup', 'day', 'words', 'ring', 'end'];
export const DURATION = END;

/* ── the screens (SCRIPT §5.1) ── */
/** the sentence tier (the transcript, ≤ 7 words per screen): every line a cast can place */
export const SCREENS: Record<string, LineScreens> = {
  /** S1a (set at frame 0) "One ring, six seconds." · S1b "Your receptionist can't answer." */
  'ig6-01': { kind: 'caption', spans: [[0, 3], [4, 7]], set0: true },
  'ig6-01r': { kind: 'caption', spans: [[0, 3], [4, 7]], set0: true },
  /** the B hook: S1b "You can't answer." */
  'ig6-01b': { kind: 'caption', spans: [[0, 3], [4, 6]], set0: true },
  /** S2a + S2b: one tier screen "While it rings, / someone's still waiting." across the two takes */
  'ig6-02a': { kind: 'caption', spans: [[0, 2]] },
  'ig6-02b': { kind: 'caption', spans: [[0, 2]] },
  /** S3 "A missed call is / someone else's customer." (7) */
  'ig6-03': { kind: 'caption', spans: [[0, 6]] },
  /** S4a "Our AI receptionist" · S4b "picks up, day or night." */
  'ig6-04': { kind: 'caption', spans: [[0, 2], [3, 7]] },
  'ig6-05': { kind: 'caption', spans: [[0, 4]] },
  'ig6-06': { kind: 'caption', spans: [[0, 2]] },
  /** S7 "Comment AGENT for the link." (End6's tier) */
  'ig6-07': { kind: 'caption', spans: [[0, 4]] },
  'ig6-07b': { kind: 'caption', spans: [[0, 4]] },
  'ig1-07': { kind: 'brand', spans: [] },
};
/** the big lockup of each tier screen (SCRIPT §5.1, STYLE §9.8): the lead's and the accent's word spans (inclusive,
 *  word indices of `say`) and its layout (stage/style.ts LAYOUT). A subset of her words, ≤ 6 per screen. */
export type LockupLayout = 'hook1a' | 'hook1b' | 'default' | 'underline' | 'wide' | 'cta';
export type Lockup = { readonly lead: readonly [number, number]; readonly accent: readonly [number, number]; readonly layout: LockupLayout };
export const LOCKUPS: Record<string, readonly Lockup[]> = {
  'ig6-01': [
    { lead: [0, 1], accent: [2, 3], layout: 'hook1a' },
    { lead: [4, 5], accent: [6, 7], layout: 'hook1b' },
  ],
  'ig6-01r': [
    { lead: [0, 1], accent: [2, 3], layout: 'hook1a' },
    { lead: [4, 5], accent: [6, 7], layout: 'hook1b' },
  ],
  'ig6-01b': [
    { lead: [0, 1], accent: [2, 3], layout: 'hook1a' },
    { lead: [4, 4], accent: [5, 6], layout: 'hook1b' },
  ],
  'ig6-02a': [{ lead: [0, 1], accent: [2, 2], layout: 'default' }],
  'ig6-02b': [{ lead: [0, 0], accent: [1, 2], layout: 'default' }],
  'ig6-03': [{ lead: [4, 5], accent: [6, 6], layout: 'default' }],
  'ig6-04': [
    { lead: [0, 1], accent: [2, 2], layout: 'underline' },
    { lead: [3, 4], accent: [5, 7], layout: 'default' },
  ],
  'ig6-05': [{ lead: [0, 1], accent: [2, 4], layout: 'wide' }],
  'ig6-06': [{ lead: [0, 1], accent: [2, 2], layout: 'default' }],
  'ig6-07': [{ lead: [0, 0], accent: [1, 1], layout: 'cta' }],
  'ig6-07b': [{ lead: [0, 1], accent: [2, 4], layout: 'cta' }],
};
/** the display map (SCRIPT §5.1): the BIG LOCKUP's sentence-case leads over her lowercase words ("Someone's", "Someone
 *  else's", "Picks up,"). The sentence tier never reads it (it keeps her lowercase continuation). No numerals anywhere;
 *  every apostrophe renders typographic (’). */
export const DISPLAY: readonly Display[] = [
  { id: 'ig6-02b', from: 0, to: 0, text: 'Someone’s' },
  { id: 'ig6-03', from: 4, to: 4, text: 'Someone' },
  { id: 'ig6-04', from: 3, to: 3, text: 'Picks' },
];

/** AGENT's word in the CTA line (components/End.tsx agentWord: the same lookup) */
const CTA_TAKE = BODY_PLACED.cta;
const AGENT_K = Math.max(0, VOICE.lines[CTA_TAKE].say.split(' ').findIndex((w) => w.replace(/[^A-Za-z]/g, '') === 'AGENT'));
export const END_CARD = {
  cta: CTA,
  field: FIELD,
  agent: CTA + said(CTA_TAKE, AGENT_K),
  send: end(CTA, CTA_TAKE),
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  url: [0, 1, 2].map((k) => BRAND_AT + said(BRAND, k)),
  seam: END - SEAM,
} as const;

/* ── the rules (SCRIPT §1.3, §5.3; PIPELINE §6.1 "Assert") — a failed one stops `npm run sfx:ig6` ── */
const ONSETS: readonly number[] = VOICES.flatMap((v) => VOICE.lines[v.id].words.map((_, k) => v.at + vWord(v.id, k)));
/** a ring at f covers no onset: none in (f − 6, f + RING_OUT) */
const ringClear = (f: number) => !ONSETS.some((o) => o > f - 6 && o < f + RING_OUT);
const actKeys = ORDER;
export type Assert = { readonly rule: string; readonly ok: boolean; readonly got: string };
export const ASSERTS: readonly Assert[] = [
  { rule: 'ring 2 = f180 (a step, on the bar 4 line)', ok: M.ring2 === 180 && M.ring2 % 30 === 0 && M.ring2 % BAR === 0, got: `f${M.ring2}` },
  { rule: `ig6-02a has stopped by f${PLAN.ring2Clear}`, ok: LAID.ringsVoiced <= PLAN.ring2Clear, got: `${TAKES.rings}@${LINE.rings} voiced to f${LAID.ringsVoiced} (hook rung ${HOOK_RUNG}: ${HOOK.take}, 1b hold ${HOOK.hold})` },
  { rule: 'no word onset under a ring (ring 1, ring 2, the hub ring): none in (ring − 6, ring + 10)', ok: [M.ring1, M.ring2, M.ring].every(ringClear), got: `rings f${M.ring1} / f${M.ring2} / f${M.ring}` },
  { rule: 'ig6-02b is said before shot E opens (f234)', ok: TAKES.waiting !== null && LINE.waiting !== null && voiced(LINE.waiting, TAKES.waiting) <= PLAN.fall[1], got: `${TAKES.waiting}@${LINE.waiting} voiced to f${TAKES.waiting && LINE.waiting !== null ? voiced(LINE.waiting, TAKES.waiting) : NaN}` },
  { rule: 'the hub ring on the first beat ≥ the whip cut + 12', ok: M.ring % BEAT === 0 && M.ring >= M.cut + PLAN.ringAfterCut && M.ring - BEAT < M.cut + PLAN.ringAfterCut, got: `cut f${M.cut}, ring f${M.ring}` },
  { rule: 'the pickup on a beat (the bar line when within a beat) ≥ the ring + 15', ok: M.pickup % BEAT === 0 && M.pickup >= M.ring + PLAN.pickupAfterRing, got: `ring f${M.ring}, pickup f${M.pickup}${M.pickup % BAR === 0 ? ' (bar line)' : ''}` },
  { rule: 'ig6-04 ≥ the pickup + 8', ok: LINE.agent !== null && LINE.agent >= M.pickup + PLAN.agentAfterPickup, got: `pickup f${M.pickup}, ig6-04@${LINE.agent}` },
  { rule: `the CTA has stopped by f${PLAN.ctaDeadline} (impact f${PLAN.impact})`, ok: LAID.ctaVoiced <= PLAN.ctaDeadline && IMPACT === PLAN.impact, got: `${CTA_TAKE}@${CTA} voiced to f${LAID.ctaVoiced}, impact f${IMPACT} (trim ${TRIM})` },
  { rule: '28.0 s: DURATION 840', ok: DURATION === PLAN.end, got: `${DURATION} f` },
  {
    rule: 'the acts in order, each at least one frame long',
    ok: actKeys.every((k, i) => SCENES[k].to > SCENES[k].from && (i === 0 || SCENES[actKeys[i - 1]].to === SCENES[k].from)),
    got: actKeys.map((k) => `${k} ${SCENES[k].from}–${SCENES[k].to}`).join(' · '),
  },
];
export const FAULTS: readonly Assert[] = ASSERTS.filter((a) => !a.ok);

/* ── THE SOUND (docs/ig/ig6/BUILD.md §9; SCRIPT §4 "Sound", §6): the reference's genre — minimal, crisp, the object's
 *    own sounds in front, every one on a picture event. YOUR PHONE ticks (a dry tick / tock on every step: the clock is
 *    the hat until the pickup) and RINGS in the North American cadence — two seconds of ringing (the desk trill again
 *    every 0.4 s, its own length, while the ring's stretch inks), four of silence, ring 2 six real seconds after ring 1;
 *    the fall-through is a reversed whoosh into node 2 and a low hit out of the white; the whip a swish. THE AGENT is
 *    glass and a click: the hub rings once, rings out, and the pickup clicks (a low hit, the teal ting); its answered
 *    calls are glass ticks; it glides (no ticks). Every sound is in the shared library (public/ig/sfx/lib, read-only;
 *    a multi-variant family is used only as far as its copied variants go: pop, land, whoosh-soft once, swish twice)
 *    or the shared fx-impact-end. ── */
export const roomAt = (_f: number): Room => 'white';
/** the delivery's AAC head (ig4's lesson, check-delivery ≤ −1 dBTP): the frame-0 trill sits `db` under (SCRIPT b1) */
const HEAD = { db: -4 } as const;
/** where things are on screen (x / 1080): node 1 at frame 0, the reading point (ring 2, the world domes), the hub in
 *  shot G, the full dial's centre (shot E / I) and the five domes of the day round it (STYLE §9, stage/style.ts) */
const SX = { node1: 0.7, rp: 0.556, hub: 0.24, full: 0.48, day: [0.7, 0.84, 0.7, 0.12, 0.26] } as const;
/** your phone's steps (stage/clock.ts phoneRho: one a second from frame 0 until the fall-through freezes the dial) and
 *  shot E's normal step; the time-lapse's jumps on 8ths (stage/clock.ts LAPSE: the same frames) */
const CLOCK = {
  steps: Array.from({ length: Math.ceil(M.fall[0] / 30) }, (_, k) => k * 30),
  eStep: 240,
  lapse: [255, 262.5, 270, 277.5, 285, 292.5, 300, 307.5, 315],
} as const;
/** a clock sound or a dome inside a word's first 200 ms that check-mix flagged is DROPPED (the step stays silent, never
 *  moved: SCRIPT §6) — measured on the built mix, per cast (BUILD.md §9) */
const DROP: readonly number[] = [];
const kept = (f: number) => !DROP.some((d) => Math.abs(d - f) < 0.01);
/** her onsets as she says them (the stamps + NUDGE) */
const SAID: readonly number[] = VOICES.flatMap((v) => VOICE.lines[v.id].words.map((_, k) => v.at + said(v.id, k)));
/** SCRIPT b3: a time-lapse jump inside a word's first 200 ms (within 6 f after her onset) plays 6 dB down (crit-r1 S4:
 *  the f277.5 jump sat 0.3 f after "is", SII 0.84) */
const LAPSE_DUCK = 6;
const inWordHead = (f: number) => SAID.some((o) => f - o > 0 && f - o <= 6);
/** a step: tock on the even seconds, tick on the odd (a clock), at `db`; under her voice buildCues takes 5 dB more */
const step = (f: number, k: number, label: string, db: number): Hit<Snd> =>
  k % 2 === 0 ? H(f, 'fx-tock', 'none', SX.rp, 3, label, { db: db - 1, layer: true }) : H(f, 'fx-tick', 'none', SX.rp, 3, label, { db, layer: true });
/** A RING of your phone (SCRIPT §2, F1): the desk trill on its frame (a key hit), then its two seconds of ringing — the
 *  trill again every 12 f (0.4 s, its own length) to the ring + 48, under her voice — while the ring's stretch inks */
const RING_ON = [12, 24, 36, 48] as const;
/** the ringing's levels (dB on top of weight 2; buildCues takes 5 more under her voice; null: that repetition is left
 *  out): ring 1 rings out before "six" (crit-r1 S1: its f36 and f48 trills sat on the sibilant onset of the hook's key
 *  word, SII 0.79, and were inaudible anyway — SCRIPT §1.2 puts her first word after ring 1); ring 2 leaves out its f192
 *  repetition, 2 f after "someone's" (crit-r1 S4), and swells into the push (the fall-through goes INTO the ringing node) */
const RING1_ON = [-6, -8, null, null] as const;
const RING2_ON = [null, -10, -10, -2] as const;
const ring = (f: number, x: number, label: string, db: number, on: readonly (number | null)[]): Hit<Snd>[] => [
  H(f, 'fx-trill', 'rush', x, 1, label, { db }),
  ...RING_ON.flatMap((d, j) => {
    const lv = on[j];
    return lv === null ? [] : [H(f + d, 'fx-trill', 'rush', x, 2, `${label.split(':')[0]} … still ringing (${j + 2}/5, the North American 2 s on)`, { db: lv })];
  }),
];
/** her onset of the first word of each lockup's accent (the teal italic lands on it: stage/Lockup.tsx), by role and screen */
const accentOn = (r: Role, screen = 0) => {
  const id = TAKES[r];
  const lk = id === null ? undefined : LOCKUPS[id]?.[screen];
  return lk === undefined ? NaN : on(r, lk.accent[0]);
};
const ACC = {
  cant: accentOn('hook', 1),
  rings: accentOn('rings'),
  still: accentOn('waiting'),
  customer: accentOn('missed'),
  receptionist: accentOn('agent', 0),
  day: accentOn('agent', 1),
  from: accentOn('words'),
  yourself: accentOn('ring'),
} as const;
/** the agent's answered calls on the world dial (stage/clock.ts AGENT_DOMES: the rebuild's, the words cut's, "yourself") */
const WORLD_DOMES = [M.rebuild[0] + 2, M.words, ...(Number.isFinite(ACC.yourself) ? [ACC.yourself] : [M.ringShot + 30])];
/** the day's five domes (stage/clock.ts DAY_DOMES: as the needle passes φ 36, 108, 144, 252, 324) */
const DAY_DOMES = [36, 108, 144, 252, 324].map((phi) => M.sweep[0] + (phi / 360) * (M.sweep[1] - M.sweep[0]));
/** THE STOP-TIME (SCRIPT §6): the bed cut from the whip − 8 to the pickup + 15, from the placed takes */
export const STOP = [M.whip - PLAN.stopLead, M.pickup + PLAN.stopTail] as const;
/** stage/End6.tsx DOME_T.arrow: the white arrow draws into the send disc as the exit lands */
const ARROW = M.exit[1];
export const HITS: Hit<Snd>[] = [
  H(0, 'fx-roomtone', 'none', 0.5, 3, 'b1 the room’s tone from frame 0 (the floor under the hook; no bed until f120)', { db: -24 }),
  // ── b1 HOOK: ring 1 at frame 0 and its two seconds of ringing under "One ring, six seconds."; the clock's steps
  ...ring(M.ring1, SX.node1, 'b1 RING 1 at frame 0: node 1 at the needle pulses and pings (HEAD.db under)', -3 + HEAD.db, RING1_ON),
  // ── the clock: a step every second (tock on the even, tick on the odd) to the fall-through; shot E's step
  ...CLOCK.steps.filter(kept).map((f) => step(f, f / 30, `b1–b2 your phone steps −6° (${f / 30} s)${f === M.shotB || f === M.shotC ? ' — the T1 tick cut' : ''}`, 3)),
  ...(kept(CLOCK.eStep) ? [step(CLOCK.eStep, CLOCK.eStep / 30, 'b3 shot E: the hand’s normal step to φ 48', 3)] : []),
  // b1 "can't answer.": the stakes land (no bed yet): a sub under the accent's wipe, the reel's one pop on the word
  H(ACC.cant - 1, 'sub', 'none', 0.5, 1, 'b1 “can’t answer.” lands (teal italic): the weight under it', { db: -6 }),
  H(ACC.cant - 1, 'pop', 'none', 0.56, 3, 'b1 … the accent’s pop (a frame ahead of the vowel)', { db: -4, layer: true }),
  // ── b2 WAIT: the bed enters on the bar 3 line (MUSIC.bedFrom); ring 2 on f180, six real seconds after ring 1
  H(ACC.rings - 1, 'tap', 'none', 0.56, 3, 'b2 “rings,” lands (teal italic)', { db: -2 }),
  ...ring(M.ring2, SX.rp, 'b2 RING 2 on f180, six real seconds after ring 1: node 2 lands under the needle, the punch-in', -3, RING2_ON),
  H(M.ring2, 'thump', 'none', 0.5, 2, 'b2 … bar 4’s weight under ring 2 (the punch-in lands)', { db: -6, layer: true }),
  H(ACC.still - 1, 'tap', 'none', 0.56, 3, 'b2 “still waiting.” lands (teal italic)', { db: -2 }),
  // T2 the fall-through: a reversed whoosh into node 2's white (peaking on the white frame), then the low hit out of it
  H(M.fall[0] + 10, 'whoosh-rev', 'none', [0.56, 0.5], 2, 'b2 → b3 T2: the push falls into node 2 (the reversed whoosh peaks on the white)', { db: -1 }),
  H(M.fall[1], 'thump', 'none', 0.48, 1, 'b3 LOW HIT: out of the white the whole dial opens (×3 → ×1) — the ring we fell through is the clock', { db: -1 }),
  // (the ratchet slows with the sweep's expo: −1 dB a click; her phrases' margins would take 5 dB off some clicks and
  //  not others, so those get it back — an even ratchet)
  ...[0.62, 0.66, 0.6, 0.48, 0.36, 0.32].map((x, j) => {
    const f = M.fall[1] + 1 + (j * BEAT) / 8;
    return H(f, 'fx-tick', 'none', x, 3, `b3 … the ticks sweep in clockwise (a 32nd ratchet, ${j + 1}/6)`, { db: -2 - j + (speaking(f) ? 5 : 0), layer: true });
  }),
  // ── b3 MISSED: the time-lapse — the hand jumps node to node on 8ths, tick / tock (the minute of rings, never said)
  ...CLOCK.lapse.filter(kept).map((f, k) =>
    step(f, k + 1, `b3 time-lapse jump ${k + 1}/${CLOCK.lapse.length} (a ring’s stretch inks)${inWordHead(f) ? ' — in a word’s first 200 ms: 6 dB down' : ''}`, inWordHead(f) ? 1 - LAPSE_DUCK : 1),
  ),
  H(ACC.customer - 1, 'tap', 'none', 0.56, 3, 'b3 “customer.” lands (teal italic) on the bar 6 line', { db: -1 }),
  H(CLOCK.lapse[CLOCK.lapse.length - 1] + 3, 'land', 'none', SX.full, 3, 'b3 the last jump lands at φ 336: ten black stretches on the rim', { db: -6 }),
  // ── b4 PICKUP: the stop-time (the bed cut on its 16th, MUSIC.stop): the riser into it, the whip, the hub's ring cut
  // short by the pickup, in the room tone alone
  H(STOP[0], 'riser-short', 'none', 0.5, 3, 'b4 into the stop-time (the riser crests on the bed’s cut)', { db: -6 }),
  H(M.cut, 'swish', 'none', [0.35, 0.65], 2, 'b4 T3 THE WHIP (+75°, peel): the swish peaks on the cut to the hub', { db: -2 }),
  // (one trill, rung out before the click — SCRIPT b4; a second ring cut off by the pickup would claim "answered within
  //  the first ring", crit-r1 T2)
  H(M.ring, 'fx-trill', 'rush', SX.hub, 1, 'b4 a fresh call rings at the hub of a clean clock (the dome shivers, one ping; it rings out)', { db: -3 }),
  H(M.pickup, 'fx-pickup', 'none', SX.hub, 1, 'b4 THE PICKUP on the bar 7 line: the dome stamps (the click)', { db: 0 }),
  H(M.pickup, 'thump', 'none', SX.hub, 2, 'b4 … LOW HIT: the teal stamp’s weight', { db: -3, layer: true }),
  H(M.pickup, 'fx-tock', 'none', SX.hub, 3, 'b4 … the dome’s knock', { db: -2, layer: true }),
  H(M.pickup + 2, 'fx-ting', 'sunday', SX.hub, 2, 'b4 … graphite → teal (the radial wipe’s ting)', { db: -6, layer: true }),
  H(M.pickup, 'sub', 'none', 0.5, 2, 'b4 … the sub under the agent’s first breath', { db: -8, layer: true }),
  // the rebuild: the pull-back to M1 (whoosh), the first answered call pops teal at the reading point (glass)
  H(M.rebuild[0] + 10, 'whoosh-soft', 'none', [0.3, 0.5], 3, 'b4 the pull-back: the agent’s clock rebuilds', { db: -6 }),
  // (the words cut's and "yourself."'s domes land ON her words: key hits, so the tonal duck under her takes 5 dB, not 10)
  ...WORLD_DOMES.filter(kept).map((f, k) =>
    k === 0
      ? H(f, 'fx-glass-tick', 'sunday', SX.rp, 2, 'b4 the first answered call pops teal at the reading point', { db: 0 })
      : H(f, 'fx-glass-tick', 'sunday', SX.rp, 1, k === 1 ? 'b6 the words cut: another call, answered (a dome pops under the needle)' : 'b7 “yourself.”: a dome pops at the reading point', { db: -10 }),
  ),
  H(ACC.receptionist - 1, 'tap', 'none', 0.56, 3, 'b4 “receptionist” lands (teal italic)', { db: -2 }),
  H(ACC.receptionist, 'fx-scratch', 'none', [0.1, 0.77], 3, 'b4 … the teal underline draws out of the hub (10 f)', { db: -10 }),
  // ── b5 DAY: the T1 cut on "day", the agent's day (one turn), five answered calls pop as the needle passes
  H(ACC.day - 1, 'sub', 'none', 0.5, 1, 'b5 the T1 cut on “day”: the agent’s day (the weight under the accent)', { db: -8 }),
  H(ACC.day - 1, 'tap', 'none', 0.56, 3, 'b5 … “day or night.” lands (teal italic)', { db: -2, layer: true }),
  ...DAY_DOMES.filter(kept).map((f, k) => H(f, 'fx-glass-tick', 'sunday', SX.day[k], 2, `b5 the day: answered call ${k + 1}/5 pops teal`, { db: 0 })),
  H(M.sweep[1], 'thump', 'none', 0.5, 2, 'b5 the sweep lands at 12 (SPRING.land) — “from”', { db: -3 }),
  H(M.sweep[1], 'sub', 'none', 0.5, 2, 'b5 … the weight under “from your words.”', { db: -9, layer: true }),
  // ── b7 RING: "yourself." lands with the dome (above); the exit lifts the dial and the hand away
  H(ACC.yourself - 1, 'tap', 'none', 0.56, 3, 'b7 “yourself.” lands (teal italic)', { db: -2 }),
  // (stage/Camera.ts EXIT: in3 over 8 f, the hand 2 f ahead — its fastest frames are f647–648, the dial's f649–650: the
  //  swish peaks as the hand leaves, +3 dB to read over the pad; crit-r1 S3)
  H(M.exit[0] + 8, 'swish', 'none', [0.45, 0.5], 3, 'b7 → b8 the exit: the hand, then the dial, lift up and leave (the swish peaks as the hand leaves)', { db: 3 }),
  H(ARROW, 'fx-felttip-short', 'none', 0.76, 3, 'b8 the white arrow draws into the send disc (6 f)', { db: -2 }),
  // ── b8–b9 the end card: the shared stack (no hairline in End6: its draw is left out), the build and the impact
  ...endHits(END_CARD)
    .filter((h) => h.snd !== 'draw')
    .map((h) => (h.snd === 'fx-menu-open' ? { ...h, db: 2 } : h.snd === 'fx-keys' ? { ...h, db: -1 } : h.snd === 'fx-click-down' ? { ...h, db: 0 } : h)),
  H(IMPACT - 10, 'riser', 'none', 0.5, 1, 'END the build’s crest under the roll (peaks a 16th before the inhale)', { db: 1.5 }),
  // the shared stack with its `slam` crack 6 dB down (ig5 DELIVERY §2: the AAC true-peak lesson; SCRIPT b9)
  ...impactHits(IMPACT).map((h) => (h.snd === 'slam' ? { ...h, db: (h.db ?? 0) - 6 } : h)),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** The moments the bed reads (scripts/ig6/bed.mjs inputs(T): ig6's own arrangement) */
export const MUSIC = {
  /** SCRIPT b2: the bed enters on the bar 3 line (the hook is ring 1, its ringing and the clock in room tone) */
  bedFrom: PLAN.bedFrom,
  stop: STOP,
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  end: END,
  /** ig6's own moments (scripts/ig6/bed.mjs IG6_KEYS): ring 2 and "someone's" (the figure rests between them), the
   *  fall-through's cut (the beat before the white → the bar line after the open), the day cut, the sweep's landing,
   *  the words cut, the CTA */
  ig6: {
    ring2: M.ring2,
    waiting: LINE.waiting ?? M.ring2 + 10,
    cutFrom: Math.floor((M.fall[0] + 10) / BEAT) * BEAT,
    cutTo: upBar(M.fall[1]),
    day: M.day,
    land: M.sweep[1],
    words: M.words,
    cta: CTA,
  },
  build: { kick: 1.4, snare: 1.2, inhaleDb: -12 },
} as const;
/** the bed's fader: under her through your phone, ridden up into the swell so the stop is an event, the return a touch
 *  forward (the agent breathes), the day forward (the music-forward passage), under her through the ring; ridden up
 *  into the build as her CTA ends, tapering into the inhale; then the series' shape round the hit, the chord held
 *  2.5 dB higher into the seam (it still rings 10–5 f from the end) */
const CTA_END = Math.min(LAID.ctaVoiced, IMPACT - 14);
const BUILD_TAPER = 3.5;
const RIDE = { under: 6, swell: 9, ret: 6, day: 4, ring: 5, build: 9 } as const;
/** crit-r1 S5: once "Ring it yourself." has ended, the bed comes up (the swell's level) through the hold, the exit and the
 *  field, and back under her before "Comment" — the ring act's 1.7 s of pad alone read as the reel ending */
const RING_DONE = LINE.ring !== null && TAKES.ring !== null ? voiced(LINE.ring, TAKES.ring) : M.words + PLAN.wordsHold;
const HOLD_UP = [
  [RING_DONE + 4, RIDE.ring],
  [RING_DONE + 10, RIDE.swell],
  [FIELD + 6, RIDE.swell],
  [CTA - 4, RIDE.ring],
] as const;
export const BED = {
  file: `ig/sfx/${REEL}/bed.wav`,
  vol: 2,
  ride: [
    [0, RIDE.under],
    [STOP[0] - 22, RIDE.under],
    [STOP[0] - 2, RIDE.swell],
    [STOP[1], RIDE.ret],
    [M.day - 6, RIDE.ret],
    [M.day, RIDE.day],
    [M.words - 6, RIDE.day],
    [M.words + 6, RIDE.ring],
    ...HOLD_UP,
    [CTA_END, RIDE.ring],
    [CTA_END + 6, RIDE.build],
    [IMPACT - 25, RIDE.build],
    [IMPACT - 12, RIDE.build - BUILD_TAPER],
    ...bedRide(IMPACT, BRAND_AT, vFrames(BRAND), END)
      .filter(([f]) => f >= IMPACT - 1)
      .map(([f, db]) => (f === END - SEAM ? ([f, db + 2.5] as const) : ([f, db] as const))),
  ] as readonly (readonly [number, number])[],
};
export const MIX = {
  file: `ig/sfx/${REEL}/mix.wav`,
  ...IG_LOUD,
  fadeOut: [END - SEAM, END] as const,
  /** the impact insert held a frame longer and released over the name's first syllable (ig1's / ig5's tuning) */
  impact: { ...igImpact(IMPACT, BRAND_AT - IMPACT), hold: [0, 4] as const, release: 8 },
  name: IG_NAME,
  /** the music-forward passage the converge into the logo must top (check-mix arc): the agent's day sweep (SCRIPT §6) */
  arc: igArc([[M.sweep[0], M.sweep[1]]]),
} as const;
/** the type's ground tone (the series' pearl ink set); the shell (Reel6.tsx) paints flat #FFFFFF with no grain */
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

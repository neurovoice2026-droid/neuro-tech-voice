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
 *   · the acts' moments  → M (the anchors SCRIPT §3–§4 re-anchors on the takes), ZONE_FRAMES (none yet), the cue sheet
 *                          HITS (the series' frame + the three rings and the pickup only) and BED.ride / MUSIC (the IG stub)
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
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {};
export const { SPEECH, PHRASES, speaking } = makeSpeech(VOICE, VOICES);

/** her onset of word k of a role's placed take */
const on = (r: Role, k: number) => {
  const at = LINE[r];
  const id = TAKES[r];
  return at === null || id === null ? NaN : at + vWord(id, k);
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
  agent: CTA + vWord(CTA_TAKE, AGENT_K),
  send: end(CTA, CTA_TAKE),
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  url: [0, 1, 2].map((k) => BRAND_AT + vWord(BRAND, k)),
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

/* ── the cue sheet: the series' frame + the story's three rings and the pickup (placeholder; SCRIPT §4 "Sound" lands
 *    with the acts). Every sound is in the shared library (public/ig/sfx/lib, read-only) or the shared fx-impact-end. ── */
export const roomAt = (_f: number): Room => 'white';
/** the delivery's AAC head (ig4's lesson, check-delivery ≤ −1 dBTP): the frame-0 trill sits `db` under (SCRIPT b1) */
const HEAD = { db: -4 } as const;
export const HITS: Hit<Snd>[] = [
  H(0, 'fx-roomtone', 'none', 0.5, 3, 'b1 the room’s tone from frame 0 (the floor under the hook; no bed until f120)', { db: -24 }),
  H(M.ring1, 'fx-trill', 'rush', 0.7, 1, 'b1 RING 1 at frame 0: node 1 at the needle pings (HEAD.db under)', { db: -3 + HEAD.db }),
  H(M.ring2, 'fx-trill', 'rush', 0.56, 1, 'b2 RING 2 on f180, six real seconds after ring 1: node 2 lands under the needle', { db: -3 }),
  H(M.ring, 'fx-trill', 'rush', 0.24, 1, 'b4 a fresh call rings at the hub of a clean clock (the wordless beat)', { db: -3 }),
  H(M.pickup, 'fx-pickup', 'none', 0.24, 1, 'b4 THE PICKUP: the hub stamps and turns teal', { db: 0 }),
  ...endHits(END_CARD),
  H(IMPACT - 10, 'riser', 'none', 0.5, 1, 'END the build’s crest under the roll (peaks a 16th before the inhale)', { db: 1.5 }),
  // the shared stack with its `slam` crack 6 dB down (ig5 DELIVERY §2: the AAC true-peak lesson; SCRIPT b9)
  ...impactHits(IMPACT).map((h) => (h.snd === 'slam' ? { ...h, db: (h.db ?? 0) - 6 } : h)),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** THE STOP-TIME (SCRIPT §6): the bed cut from the whip − 8 to the pickup + 15, from the placed takes */
export const STOP = [M.whip - PLAN.stopLead, M.pickup + PLAN.stopTail] as const;
/** The moments the bed reads (scripts/ig/bed.mjs inputs(T): no ARRANGEMENTS.ig6, so the stub plays) */
export const MUSIC = {
  bedFrom: PLAN.bedFrom,
  stop: STOP,
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  end: END,
  /** ig6's own moments (for a later arrangement): the lines by role, the rings, the whip, the pickup, the day */
  ig6: { ...LINE, ring2: M.ring2, whip: M.whip, ring: M.ring, pickup: M.pickup, day: M.day },
  build: { kick: 1.4, snare: 1.2, inhaleDb: -12 },
} as const;
/** the bed's fader (ig5's placeholder shape): under her through the body, ridden up into the build as her CTA ends,
 *  then the series' shape round the hit, the chord held 2.5 dB higher into the seam */
const CTA_END = Math.min(LAID.ctaVoiced, IMPACT - 14);
const RIDE = { under: 6, build: 13 } as const;
export const BED = {
  file: `ig/sfx/${REEL}/bed.wav`,
  vol: 2,
  ride: [
    [0, RIDE.under],
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
  /** the music-forward passage the converge into the logo must top (check-mix arc): the agent's day sweep (SCRIPT §6) */
  arc: igArc([[M.sweep[0], M.sweep[1]]]),
} as const;
/** the type's ground tone (the series' pearl ink set); the shell (Reel6.tsx) paints flat #FFFFFF with no grain */
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

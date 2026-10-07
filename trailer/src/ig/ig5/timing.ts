/**
 * REEL 5 · "Three rings" (slug `dont-pay-300`) — every timing constant of the reel (docs/ig/ig5/SCRIPT.md,
 * docs/ig/ig5/HOOKS.md §1, docs/ig/ig5/PIPELINE.md §6.1; the contract of docs/ig/PIPELINE.md §6.1, in ig4's shape).
 * Plan 28.0 s · 14 bars · 840 timeline frames (3360 at 120 fps), impact f780 (bar 14), END f840.
 *
 * THE HOOK (HOOKS.md §1, the TikTok tournament's winner): "Three rings. Gloves on. You can't." (ig5-01g) over the
 * frame-0 ring in a quiet room — no bed until beat 2 "Agency AI receptionist: three hundred a month, a common retainer.
 * Setup, often fifteen hundred." (ig5-02g; trim T1 ig5-02gt "…commonly three hundred a month…"). The incumbent
 * ig5-01 / 01b / 02 / 02t stay installed as the A/B reserve; ig5-01c is the runner-up hook (HOOK below).
 *
 * WITH THE INSTALLED TAKES (Cartesia Tessa, voice-candidates/ig5/PICKS.md "Hook swap"): still 28.0 s · impact f780, on
 * rung 2 (T1 + T2: ig5-02gt + ig5-05t; the full cast's CTA would end f795, T1's f783, both past f765; CTA ends f746, 19 f
 * to spare). The lines fall at hook f9 · agency f94 (S2 "Agency AI receptionist:" rises f92, 3.07 s: past the cast rule's
 * f78, which no take of four sets reaches — the hook reads 2.56–2.74 s, not HOOKS' 2.1–2.4 s; ig5-01g2 is longer in
 * every set, so the rule keeps ig5-01g) · "$300" heard f176 · answering f285 · "Ours?" f424 (the $49 card, 50.5 %) ·
 * "forty-nine" f458 (54.5 %) · setup f533 · does f581 · CTA f694 (82.6 %). Beat 2 reads 6.1–6.9 s in every take, so
 * from the agency line on the lines run a breath apart and the plan frames below are floors.
 *
 * Still PROVISIONAL (the infrastructure step, docs/ig/ig5/INFRA-LOG.md): the acts are title cards (acts/Acts.tsx).
 * What later steps replace, and where:
 *   · the takes          → `npm run voice:ig5 -- --install=…` rewrites ./voice.generated.ts; everything below re-anchors
 *                          to the measured takes by itself (PLAN + `place`, the stop-time on the 16th, as ig4)
 *   · the cast           → HOOK + CASTS: the hook's readings (the cast rule, HOOKS §1.1), then the trim ladder of
 *                          SCRIPT §4.3 (full → T1 → T1 + T2); the first rung whose CTA lets the impact land on
 *                          PLAN.impact is placed (the launch-gate swap ig5-06 → ig5-06-msg is one id in BODY; an A/B
 *                          hook is one HOOK object)
 *   · the acts' moments  → M (empty now), ZONE_FRAMES, the cue sheet HITS (the series' frame only: the frame-0 ring,
 *                          the end card's stack, the build and the impact) and BED.ride / MUSIC (the IG stub bed). The
 *                          hook's second ring R1 (HOOKS §1.3: ringBefore(the hook's word 2) if no onset falls in
 *                          (R1 − 6, R1 + 10), else in the "on." → "You" gap, else none) and the SCRIPT's later rings
 *                          are the scene step's to place from the onsets (series.ts: a ring never covers an onset)
 *
 * Each line sits on its planned frame unless the take before it still sounds (common/series.ts `place`); the stop-time
 * before "Ours?" cuts the bed on a 16th once her answering line has been quiet PLAN.oursGap − PLAN.stopLead frames, and
 * "Ours?" is spoken PLAN.stopLead into it; only the CTA can push the end card on by whole bars (and DURATION may not pass
 * 840: the driver contract's 28 s).
 *
 * Node-safe (PIPELINE.md H10): explicit `.ts` extensions, type-only imports marked, no React or Remotion. It imports
 * ONLY ./voice.generated.ts, film 1's src/timing.ts and src/ig/common/ — scripts/ig5/hash.mjs hashes every .ts here.
 */
import { VOICE, type VoiceId } from './voice.generated.ts';
import { BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b } from '../../timing.ts';
import { buildCues, makeSpeech, makeVoiceKit, upBeat, upQuarter, type Cue, type Hit, type Room, type Voiced, type VoiceRide } from '../common/cues.ts';
import {
  BAR, BRAND, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, RING_OUT, ROLL, SEAM, SFX, H, afterRing, endHits, bedRide, igArc, igImpact, impactHits, place, ringBefore, upBar,
  type Display, type LineScreens, type Snd,
} from '../common/series.ts';

export { BAR, BEAT, BPM, CUT, DUCK, FPS, LIGHT_NOTES, LIGHT_SEMI, PK, RENDER_FPS, SUB, VERTICAL, b, SFX };
export type { Cue, Hit, Snd, Voiced, VoiceId };

export const REEL = 'ig5' as const;
/** HOOKS §1.7: the reel is named for its hook now; the slug `dont-pay-300` (outName, file names) stays */
export const TITLE = 'Three rings';

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
  /** the agency act starts 8 f before its line: slip 1 rises at LINE.agency − 6 (HOOKS §1.3) */
  acts: { hook: 0, agency: 72, answering: 231, ours: 350, setup: 462, does: 571, end: 690 },
  /** the agency line follows the hook (HOOKS §1.7: placed from the hook's end, never the old f124); its plan frame is
   *  the one that puts "Agency AI receptionist:" on screen on PLAN.keyword — a floor that the takes push on */
  lines: { hook: 6, agency: 80, answering: 233, ours: 352, setup: 465, does: 574, cta: 694 },
  /** HOOKS §1.1 cast rule / §1.5: S2 "Agency AI receptionist:" (the search keyword) on screen by this frame (2.6 s) */
  keyword: 78,
  /** a caption card rises this long before its first word (components/Captions.tsx CAP_LEAD) */
  cardLead: 2,
  /** S1 leaves up through its masks line by line (3 lines, 2 f apart, 4 f each) from her last hook word + 6: gone this
   *  long after that word's onset; S2 rises only after it (HOOKS §1.3: one moving text at a time) */
  s1Gone: 14,
  /** "Ours?" waits at least this long after the answering line (the stop-time before it, SCRIPT §5.2) */
  oursGap: 12,
  /** the bed cuts this long before "Ours?" (SCRIPT b4: MUSIC.stop from vWord('ig5-04', 0) − 4; the pickup at − 2) */
  stopLead: 4,
  /** the comment field rises this long BEFORE her first CTA word "Comment" (SCRIPT b7: f688 for the CTA @694) */
  fieldLead: 6,
  impact: 780,
  end: 840,
} as const;
export type Role = keyof typeof PLAN.lines;

/* ── the cast: which take plays each role (SCRIPT §4.1, the trim ladder §4.3; the hook HOOKS.md §1.1) ── */
type Cast = { readonly [R in Role]: VoiceId };
/** THE HOOK and its beat 2 (docs/ig/ig5/HOOKS.md §1, the TikTok tournament's winner "Three rings. Gloves on. You
 *  can't."): its readings in the cast rule's order (ig5-01g, then the two-breath ig5-01g2), beat 2 "Agency AI
 *  receptionist: …" and its trim T1. An A/B re-cut (HOOKS §6) changes this one object: the runner-up is
 *  { hooks: ['ig5-01c'], agency: 'ig5-02g', agencyT1: 'ig5-02gt' }; the incumbent reserve (ig5-01 / ig5-01b with
 *  ig5-02 / ig5-02t, SCRIPT §4.5) also wants its own PLAN.lines.agency (124) and MUSIC.bedFrom (0) back. */
export const HOOK: { readonly hooks: readonly VoiceId[]; readonly agency: VoiceId; readonly agencyT1: VoiceId } = {
  hooks: ['ig5-01g', 'ig5-01g2'],
  agency: 'ig5-02g',
  agencyT1: 'ig5-02gt',
};
const BODY = { answering: 'ig5-03', ours: 'ig5-04', setup: 'ig5-05', does: 'ig5-06', cta: 'ig5-07' } as const;
/** full → T1 (HOOK.agencyT1) → T1 + T2 (+ ig5-05t): never a hedge cut (SCRIPT §4.3, HOOKS §1.1) */
const ladder = (hook: VoiceId): readonly Cast[] => {
  const full: Cast = { hook, agency: HOOK.agency, ...BODY };
  return [full, { ...full, agency: HOOK.agencyT1 }, { ...full, agency: HOOK.agencyT1, setup: 'ig5-05t' }];
};
/** the index of a line's last word */
const lastWord = (id: VoiceId) => VOICE.lines[id].say.split(' ').length - 1;

/** the voiced timeline of one cast: each role's start, the stop-time's cut, the impact its CTA allows, and the frame
 *  "Agency AI receptionist:" (S2) rises */
const layout = (c: Cast) => {
  const hook = afterRing(PLAN.lines.hook, 0, KIT.firstSound(c.hook));
  /** S2 rises PLAN.cardLead before the agency line's first word, after the take before it (`place`) and after S1 has left */
  const s1Gone = hook + KIT.vWord(c.hook, lastWord(c.hook)) + PLAN.s1Gone;
  const agency = Math.max(place(PLAN.lines.agency, end(hook, c.hook)), upQuarter(s1Gone + PLAN.cardLead - KIT.vWord(c.agency, 0)));
  const answering = place(PLAN.lines.answering, end(agency, c.agency));
  /** THE STOP-TIME (ig4's form: the cut on the 16th, re-anchored to the takes): the bed cuts on the first 16th that leaves
   *  her answering line PLAN.oursGap − PLAN.stopLead frames of quiet (never before the plan's), and "Ours?" is spoken
   *  PLAN.stopLead into the silence, on the take's own first onset — so "Ours?" still waits ≥ PLAN.oursGap */
  const stop = Math.max(PLAN.lines.ours - PLAN.stopLead, upQuarter(end(answering, c.answering) + PLAN.oursGap - PLAN.stopLead));
  const ours = stop + PLAN.stopLead - KIT.vWord(c.ours, 0);
  const setup = place(PLAN.lines.setup, end(ours, c.ours));
  const does = place(PLAN.lines.does, end(setup, c.setup));
  const cta = place(PLAN.lines.cta, end(does, c.does));
  return {
    at: { hook, agency, answering, ours, setup, does, cta } as { readonly [R in Role]: number },
    stop,
    impact: Math.max(PLAN.impact, upBar(end(cta, c.cta) + BEAT)),
    keyword: agency + KIT.vWord(c.agency, 0) - PLAN.cardLead,
  };
};
/** THE CAST RULE (HOOKS §1.1): the first reading of the hook whose S2 rises by PLAN.keyword; when none makes it, the
 *  reading that puts the keyword on screen first (ties keep the order: ig5-01g) — S2 depends on the hook take only */
const keywordOf = (h: VoiceId) => layout(ladder(h)[0]).keyword;
export const HOOK_TAKE: VoiceId =
  HOOK.hooks.find((h) => keywordOf(h) <= PLAN.keyword) ?? HOOK.hooks.reduce((a, h) => (keywordOf(h) < keywordOf(a) ? h : a));
/** the trim ladder on the hook the rule chose (the incumbent's ladder is the same shape: SCRIPT §4.3) */
export const CASTS: readonly Cast[] = ladder(HOOK_TAKE);
const FIT = CASTS.findIndex((c) => layout(c).impact <= PLAN.impact);
/** the rung placed (0 full, 1 T1, 2 T1 + T2; the last when none fits — the end card then moves on by bars) */
export const RUNG = FIT < 0 ? CASTS.length - 1 : FIT;
export const CAST = CASTS[RUNG];
const LAID = layout(CAST);
/** the lines' starts (absolute frames), by role */
export const LINE = LAID.at;
/** the frame S2 "Agency AI receptionist:" (the keyword) rises; PLAN.keyword is the cast rule's target */
export const KEYWORD = LAID.keyword;
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
  /** the hook (HOOKS §1.1): one card of three lines, set at frame 0 — "Three rings." / "Gloves on." / "You can't." */
  'ig5-01g': { kind: 'caption', spans: [[0, 5]], set0: true },
  'ig5-01g2': { kind: 'caption', spans: [[0, 5]], set0: true },
  /** beat 2 (HOOKS §1.6): S2 "Agency AI receptionist:" · S3 "$300 a month, a common retainer." · S4 "Setup, often $1,500." */
  'ig5-02g': { kind: 'caption', spans: [[0, 2], [3, 9], [10, 13]] },
  'ig5-02gt': { kind: 'caption', spans: [[0, 2], [3, 7], [8, 11]] },
  /** the runner-up hook (HOOKS §2, a later A/B): "Closed at 9?" / "Your phone's not." */
  'ig5-01c': { kind: 'caption', spans: [[0, 5]], set0: true },
  /** the incumbent (the A/B reserve, SCRIPT §4.5) */
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
  { id: 'ig5-01g2', from: 1, to: 1, text: 'rings.' },
  { id: 'ig5-01g2', from: 2, to: 2, text: 'Gloves' },
  { id: 'ig5-02g', from: 3, to: 4, text: '$300' },
  { id: 'ig5-02g', from: 12, to: 13, text: '$1,500.' },
  { id: 'ig5-02gt', from: 4, to: 5, text: '$300' },
  { id: 'ig5-02gt', from: 10, to: 11, text: '$1,500.' },
  { id: 'ig5-01c', from: 2, to: 2, text: '9?' },
  { id: 'ig5-01', from: 2, to: 3, text: '$300' },
  { id: 'ig5-01b', from: 3, to: 4, text: '$300' },
  { id: 'ig5-02', from: 7, to: 8, text: '$1,500.' },
  { id: 'ig5-02t', from: 6, to: 7, text: '$1,500.' },
  { id: 'ig5-03', from: 4, to: 4, text: '$99' },
  { id: 'ig5-03', from: 8, to: 8, text: '50' },
  { id: 'ig5-04', from: 2, to: 3, text: '$49' },
];

/* ── the picture's moments (absolute frames; SCRIPT §2, HOOKS §1.3), all from the placed takes' onsets ── */
/** her onset of word k of a role's placed take */
const on = (r: Role, k: number) => LINE[r] + vWord(CAST[r], k);
/** a role's word index by its letters (the trims move the words: "three" is [3] in ig5-02g, [4] in ig5-02gt) */
const ix = (r: Role, w: string) => VOICE.lines[CAST[r]].say.split(' ').findIndex((x) => x.replace(/[^A-Za-z-]/g, '').toLowerCase() === w);
const has = (r: Role, w: string) => ix(r, w) >= 0;
/** every placed onset (the series' ring law: a ring never covers one) */
const ONSETS: readonly number[] = VOICES.flatMap((v) => VOICE.lines[v.id].words.map((_, k) => v.at + vWord(v.id, k)));
const ringOk = (f: number) => !ONSETS.some((o) => o > f - 6 && o < f + RING_OUT);
/** the first beat in [from, to) on which a ring passes the law (null: none) */
const ringIn = (from: number, to: number) => {
  for (let f = Math.ceil(from / BEAT) * BEAT; f < to; f += BEAT) if (ringOk(f)) return f;
  return null;
};
const SIX = BEAT / 4;
/** R1 (HOOKS §1.3): ringBefore(the hook's word 2) if it passes, else in the "on." → "You" gap, else none */
const R1 = (() => {
  const a = ringBefore(on('hook', 2));
  if (a > 0 && ringOk(a)) return a;
  const b = ringIn(on('hook', 3) + 1, on('hook', 4));
  return b !== null && b > 0 ? b : null;
})();
const PICKUP = LINE.ours + vWord(CAST.ours, 0) - 2;
export const M = {
  /** b1: the desk hairline draws x 86 → 758 (EASE.draw from f −6, still moving at f0) */
  deskDraw: [-6, 8] as const,
  /** b1: the ring trio's virtual launches (frame 0's image: three rings already in flight) */
  trio: [-40, -20, 0] as const,
  /** the phone's single rings (RingPulse, Ø 18 → 240), each on a beat no onset falls near: R1 in the hook, one in a
   *  gap of the agency line (after "receptionist:"), one after the answering line (the last before the pickup) */
  rings: [R1, ringIn(on('agency', 2) + 1, LINE.answering), ringIn(on('answering', 2) + 1, PICKUP - 6)].filter((f): f is number => f !== null),
  /** S1 leaves up through its masks line by line (2 f apart, 4 f each) from her last hook word + 6 */
  s1Out: on('hook', lastWord(CAST.hook)) + 6,
  /** b1 → b2: slip 1 rises (blank: an ink bar, an empty amount slot) at the agency line − 6 */
  slip1: LINE.agency - 6,
  /** b2: the tag writes on "Agency" · "AI" · "receptionist:" */
  tag: [on('agency', 0), on('agency', 1), on('agency', 2)] as const,
  /** b2: T1's "commonly" prints on its word (full cast: "a common retainer" on "a") */
  hedge: has('agency', 'commonly') ? on('agency', ix('agency', 'commonly')) : on('agency', ix('agency', 'common') - 1),
  /** b2: "$300" rolls on "three hundred"; "a month" prints on "a" */
  three: on('agency', ix('agency', 'three')),
  month: on('agency', ix('agency', 'month')),
  /** b2: the stub drops on "Setup,"; "OFTEN" on "often"; "$1,500" rolls on "fifteen hundred" */
  setup: on('agency', ix('agency', 'setup')),
  often: on('agency', ix('agency', 'often')),
  fifteen: on('agency', ix('agency', 'fifteen')),
  /** b3: slip 2 rises 2 f before "Live"; its tag on words 0–2; "from" · "$99" · "a month," · "for 50 minutes" */
  slip2: LINE.answering - 2,
  tag2: [on('answering', 0), on('answering', 1), on('answering', 2)] as const,
  from99: on('answering', 3),
  ninetyNine: on('answering', 4),
  month99: on('answering', 5),
  for50: [on('answering', 7), on('answering', 8), on('answering', 9)] as const,
  /** b3: the camera eases back 1.00 → .97 about (540, 740) over 1 s from slip 2's landing */
  camera: [LINE.answering + 6, LINE.answering + 36] as const,
  /** b4: the pickup (the rose light springs open into her orb) 2 f before "Ours?"; the square-up and ours on "Ours?" */
  pickup: PICKUP,
  ours: on('ours', 0),
  /** b4: her orb glides from the phone to the full stop after "a month" (0.45 s) */
  glide: [PICKUP + 6, PICKUP + 20] as const,
  /** b4: the payoff's words: "From", "forty-nine", "a month.", "No setup fee." */
  fromOurs: on('ours', 1),
  fortyNine: on('ours', 2),
  monthOurs: on('ours', 4),
  noSetup: [on('ours', 6), on('ours', 7), on('ours', 8)] as const,
  /** b5: on "You" the pile leaves up and ours glides up; the track on "set"; the dots fill from "yourself" one per
   *  16th; the fourth turns into a check (T2 has no "minutes": it lands with the fourth dot) */
  you: on('setup', 0),
  set: on('setup', 1),
  dots: [0, 1, 2, 3].map((i) => on('setup', ix('setup', 'yourself')) + i * SIX),
  /** b6: on "It" ours shrinks into the parked price chip and the record rises; on "picks up" her orb glides onto the
   *  record's ringing rose dot (docked as "up" lands) and Answered lands; the availability step; on "books" the booking
   *  step ticks and the pill swaps to Booked */
  it: on('does', 0),
  picks: on('does', 1),
  up: on('does', 2),
  cant: on('does', 5),
  books: on('does', ix('does', 'books')),
  /** the call's outcome: Booked (ig5-06) or, the launch-gate cut ig5-06-msg, Message taken */
  booked: has('does', 'books'),
} as const;
/** extra zone stills (scripts/ig/check-zones.mjs: each + 8 f is a still) — the objects' landings and every printed
 *  word on the slips, ours and the record */
export const ZONE_FRAMES: readonly number[] = [
  M.slip1,
  M.tag[2],
  M.three + 18,
  M.month,
  M.setup,
  M.fifteen + 18,
  M.slip2,
  M.ninetyNine + 18,
  M.for50[2],
  M.camera[1],
  M.ours + 12,
  M.fortyNine,
  M.noSetup[2],
  M.you + 14,
  M.dots[3],
  M.it + 14,
  M.up,
  M.books + 6,
  /** the CTA's caption and field, the record pulled back behind them */
  LINE.cta + 30,
].map((f) => f + 8);

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

/** THE STOP-TIME before the payoff (SCRIPT b4): the bed cut on the sample from PLAN.stopLead before "Ours?" (on a 16th,
 *  `layout`) to "forty-nine", from the placed take's onsets (never from plan frames) */
export const STOP = [LAID.stop, LINE.ours + vWord(CAST.ours, 2)] as const;
/** The moments the bed reads (scripts/ig/bed.mjs inputs(T): no ARRANGEMENTS.ig5, so the stub plays) */
export const MUSIC = {
  /** HOOKS §1.3 / §1.7: no music under the hook (a phone ringing in a quiet room); the bed enters on the first beat at or
   *  after the agency line's first word, the reel's first music */
  bedFrom: upBeat(LINE.agency + vWord(CAST.agency, 0)),
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

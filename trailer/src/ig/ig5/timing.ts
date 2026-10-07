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
 * every set, so the rule keeps ig5-01g) · "$300" heard f176 · answering f285 · "Ours?" f427 (the $49 card f425, 50.8 %;
 * crit-r2 SYNC-B) · "forty-nine" f461 (54.9 %) · setup f536 · does f585 · CTA f694 (82.6 %). Beat 2 reads 6.1–6.9 s in every take, so
 * from the agency line on the lines run a breath apart and the plan frames below are floors.
 *
 * THE PICTURE (the scene step, docs/ig/ig5/BUILD.md) reads only M (the acts' moments, below: every one off the placed
 * takes' onsets) and ZONE_FRAMES; the acts are src/ig/ig5/acts/Acts.tsx over the one continuous stage in stage/ (picture
 * only, outside this hash). M.rings holds the phone's single rings the picture draws — R1 (HOOKS §1.3: ringBefore(the
 * hook's word 2) if no onset falls in (R1 − 6, R1 + 10), else in the "on." → "You" gap, else none), one in a gap of the
 * agency line, one before the pickup — each on a beat that passes the series' ring law.
 *
 * THE SOUND (the sound step, docs/ig/ig5/BUILD.md §5) hits the same M: the cue sheet HITS (SCRIPT §2 "Sound", HOOKS
 * §1.3–1.4: room tone and the frame-0 ring under the hook, the rings of M.rings, the slips, the rolls' counters, the
 * staple, the stop-time's pickup and birth, "forty-nine", the dots, the record, the end card), the VOICE_RIDES that give
 * the logo its climax, and MUSIC / BED for ig5's own bed (scripts/ig5/bed.mjs: no music under the hook, the quotes, the
 * cut on its 16th before "Ours?", the return on "forty-nine", the build). The launch-gate swap ig5-06 → ig5-06-msg is
 * one id in BODY (the picture and the cue sheet follow it: M.booked, M.books); an A/B hook is one HOOK object.
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
  BAR, BRAND, CHIRP_OUT, IG_LOUD, IG_NAME, IMPACT_BEFORE_END, IMPACT_GAP, RING_OUT, ROLL, SEAM, SFX, H, afterRing, endHits, bedRide, igArc, igImpact, impactHits, place, upBar,
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
  /** "Ours?" is spoken this long into the silence (crit-r2 SYNC-B: 4 → 7, so the pickup and her birth play on the bare
   *  desk BEFORE the word, and ours' card is up 2 f ahead of it — the series' card lead; the pickup sits on the cut + 1) */
  stopLead: 7,
  /** the bed cuts on the first 16th that leaves her answering line this much quiet (the stop-time's own breath: it
   *  was oursGap − the old stopLead 4, so the cut stays on f420 and ring 3 still rings out before it) */
  cutQuiet: 8,
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
const BODY = { answering: 'ig5-03', ours: 'ig5-04', setup: 'ig5-05', does: 'ig5-06-msg', cta: 'ig5-07' } as const;
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
   *  her answering line PLAN.cutQuiet frames of quiet (never fewer than PLAN.oursGap − PLAN.stopLead, never before the
   *  plan's), and "Ours?" is spoken PLAN.stopLead into the silence, on the take's own first onset — so "Ours?" still
   *  waits ≥ PLAN.oursGap */
  const stop = Math.max(PLAN.lines.ours - PLAN.stopLead, upQuarter(end(answering, c.answering) + Math.max(PLAN.cutQuiet, PLAN.oursGap - PLAN.stopLead)));
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
/** THE VOICE POST — THE CLIMAX'S HEADROOM (ig1/ig2/ig4's method; check-mix: the logo impact tops the loudest dialogue
 *  moment by ≥ 1 LU). The reel's loudest 400 ms are all voice: "Agency" opens beat 2 dry, a breath before the bed enters,
 *  and "commonly", "ninety-nine", "It picks up when" lean forward. Each is ridden down inside the silences around it
 *  (line-local frames, from the take's envelope; master() re-trims a ridden line so its body sits on the dialogue target,
 *  so a nominal −2.5 dB is ≈ −2 dB heard). Rides are by take id: a re-cast that places another take is not ridden. */
export const VOICE_RIDES: Partial<Record<VoiceId, readonly VoiceRide[]>> = {
  'ig5-02gt': [
    { from: 0, to: 19, db: -3.5, ramp: 2 },
    { from: 64, to: 79, db: -2, ramp: 2 },
  ],
  'ig5-03': [{ from: 58, to: 84, db: -1.5, ramp: 3 }],
  'ig5-06': [{ from: 0, to: 23, db: -2, ramp: 2 }],
  /** the launch-gate cut (BODY.does = 'ig5-06-msg'): the same "It picks up when" */
  'ig5-06-msg': [{ from: 0, to: 24, db: -2, ramp: 2 }],
};
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
/** her placed voice at frame f: the loudest envelope of any take sounding there (0 when none) */
const voiceAt = (f: number) =>
  VOICES.reduce((m, v) => {
    const env = VOICE.lines[v.id].env;
    const i = f - v.at;
    return i >= 0 && i < env.length ? Math.max(m, env[i]) : m;
  }, 0);
const SIX = BEAT / 4;
/** THE RING LAW, burst-aware (crit-r1 sound S2: the onset-only law let all three rings land on a word's TAIL — the nasal
 *  of "rings.", the "-nist" of "receptionist:", the final /s/ of "minutes."): a ring of `burst` frames at f covers no
 *  onset — none in (f − 6, f + burst + 1) — and no voiced frame: her placed envelope stays under CUT.onset over the
 *  whole burst. The one-chirp fx-trill-1 rings CHIRP_OUT (4 f), the full fx-trill RING_OUT (10 f). */
const ringFits = (f: number, burst: number) => {
  if (ONSETS.some((o) => o > f - 6 && o < f + burst + 1)) return false;
  for (let i = Math.round(f); i < Math.round(f + burst); i++) if (voiceAt(i) >= CUT.onset) return false;
  return true;
};
/** the first 16th in [from, to − burst] on which a ring of `burst` frames fits (null: none) */
const ringIn = (from: number, to: number, burst: number) => {
  for (let f = Math.ceil(from / SIX - 1e-9) * SIX; f + burst <= to + 1e-9; f += SIX) if (ringFits(f, burst)) return f;
  return null;
};
/** a ring of the phone: its frame, its sound (the one chirp in a word gap, the full trill before the stop-time) */
type Ring = { f: number; snd: 'fx-trill' | 'fx-trill-1'; what: string };
const ring1 = (f: number | null, what: string): Ring[] => (f === null ? [] : [{ f, snd: 'fx-trill-1', what }]);
const BED_CUT = LAID.stop;
/** the pickup: on the cut + 1, in the silence (crit-r2 SYNC-B: it was "Ours?" − 2, so ours' card rose AFTER her word) */
const PICKUP = LAID.stop + 1;
/** THE ALIGNER'S STAMPS THAT SIT OFF HER ENERGY (crit-r1 sound S1 / sync SYNC-1, read on the voice stem): frames added to
 *  word k of a take — ig5-05t "set" is stamped on its vowel (its /s/ starts 3.6 f before), "up" shares "yourself."'s
 *  stamp (said ≈ 4.5 f before it); ig5-06 "up" is stamped on its p closure (the vowel starts ≈ 3 f before). The band
 *  captions read it (Captions `nudge`, ig3's idiom) and so do the picture's moments below (M.set, M.dock); the cue sheet
 *  keeps "up"'s own stamp for the pickup click (it lands on the p closure, never on the vowel's onset) */
export const NUDGE: Partial<Record<VoiceId, Readonly<Record<number, number>>>> = {
  /** crit-r2 SYNC-A: "a" and "month." share one stamp on the creaky vowel of "month" (local 100.7); her schwa starts
   *  ≈ 3 f before it, out of the d-release of "hundred" */
  'ig5-02gt': { 6: -3 },
  /** crit-r3 SYNC3-A: "No" is stamped on its vowel (her /n/ starts 2.3 f before: the take's envelope jumps −62 → −38 dB
   *  at local 2.565 s), "setup" 2.1 f after its /s/ (the > 3 kHz band rises at 2.735 s); "fee." is on time */
  'ig5-04': { 6: -2.3, 7: -2.1 },
  'ig5-05t': { 1: -3, 3: -4.5 },
  'ig5-06': { 2: -3 },
  'ig5-06-msg': { 2: -3 },
};
/** her onset of word k, as she says it (the stamp + NUDGE) */
const said = (r: Role, k: number) => on(r, k) + (NUDGE[CAST[r]]?.[k] ?? 0);
/** THE PHONE'S SINGLE RINGS (HOOKS §1.3 R1, then one in a gap of each quote), each on the first 16th of its gap that
 *  passes the burst-aware ring law: R1 in "rings." → "Gloves" (else "on." → "You"; a chirp), one after
 *  "receptionist:" (a chirp), the last after "…minutes." (the full trill, rung out before the bed's cut) */
const RINGS: readonly Ring[] = [
  ...ring1(ringIn(on('hook', 1) + 1, on('hook', 2), CHIRP_OUT) ?? ringIn(on('hook', 3) + 1, on('hook', 4), CHIRP_OUT), 'b1 R1: the phone rings again in the hook (“rings.” → “Gloves”), unanswered — a RingPulse leaves the light (one chirp)'),
  ...ring1(ringIn(on('agency', 2) + 1, on('agency', 3), CHIRP_OUT), 'b2 the phone rings on under the agency quote (“receptionist:” → “commonly”), still unanswered (one chirp)'),
  ...(() => {
    const f = ringIn(on('answering', lastWord(CAST.answering)) + 1, BED_CUT, RING_OUT);
    return f === null ? [] : [{ f, snd: 'fx-trill' as const, what: 'b3 the last ring before the pickup (after “…minutes.”), rung out on the bed’s cut: the stop-time follows it' }];
  })(),
];
export const M = {
  /** b1: the desk hairline draws x 86 → 758 (EASE.draw from f −6, still moving at f0) */
  deskDraw: [-6, 8] as const,
  /** b1: the ring trio's virtual launches (frame 0's image: three rings already in flight) */
  trio: [-40, -20, 0] as const,
  /** the phone's single rings (RingPulse, Ø 18 → 240), each on a beat no onset falls near: R1 in the hook, one in a
   *  gap of the agency line (after "receptionist:"), one after the answering line (the last before the pickup) */
  rings: RINGS.map((r) => r.f),
  /** S1 leaves up through its masks line by line (2 f apart, 4 f each) from her last hook word + 6 */
  s1Out: on('hook', lastWord(CAST.hook)) + 6,
  /** b1 → b2: slip 1 rises (blank: an ink bar, an empty amount slot) at the agency line − 6 */
  slip1: LINE.agency - 6,
  /** b2: the tag writes on "Agency" · "AI" · "receptionist:" */
  tag: [on('agency', 0), on('agency', 1), on('agency', 2)] as const,
  /** b2: T1's "commonly" prints on its word (full cast: "a common retainer" on "a") */
  hedge: has('agency', 'commonly') ? on('agency', ix('agency', 'commonly')) : on('agency', ix('agency', 'common') - 1),
  /** b2: "$300" rises on "three hundred"; "a month" lifts on "a" as she says it (crit-r2 SYNC-A: NUDGE, the word
   *  before "month") */
  three: on('agency', ix('agency', 'three')),
  month: said('agency', ix('agency', 'month') - 1),
  /** b2: the stub drops on "Setup,"; "OFTEN" on "often"; "$1,500" rolls on "fifteen hundred" */
  setup: on('agency', ix('agency', 'setup')),
  often: on('agency', ix('agency', 'often')),
  fifteen: on('agency', ix('agency', 'fifteen')),
  /** b2 → b3: slip 1 and its stub rest low in b2 (the agency beat centred on the frame, crit-r2 P6) and glide up into
   *  the b3 layout as her agency line ends, so slip 2 rises under them (0.4 s, EASE.inOut: done 2 f into slip 2's rise) */
  lift: [LINE.answering - 12, LINE.answering] as const,
  /** b3: slip 2 rises 2 f before "Live"; its tag on words 0–2; "from" · "$99" · "a month," · "for 50 minutes" */
  slip2: LINE.answering - 2,
  tag2: [on('answering', 0), on('answering', 1), on('answering', 2)] as const,
  from99: on('answering', 3),
  ninetyNine: on('answering', 4),
  month99: on('answering', 5),
  for50: [on('answering', 7), on('answering', 8), on('answering', 9)] as const,
  /** b4: the pickup (the rose light springs open into her orb) on the bed's cut + 1, 6 f before "Ours?" (crit-r2
   *  SYNC-B; b3's camera ease-back is gone, crit-r2 P2: its .97 never read and its layer switches popped) */
  pickup: PICKUP,
  ours: on('ours', 0),
  /** b4: her orb glides from the phone to the full stop after "a month" (0.53 s), once ours has landed (one move at a
   *  time), landing on the tail of "Ours?" — where its ping stays off the word's body (crit-r2 B1 / SYNC-B) */
  glide: [on('ours', 0) + 4, on('ours', 0) + 20] as const,
  /** b4: the payoff's words: "From", "forty-nine", "a month.", "No setup fee." */
  fromOurs: on('ours', 1),
  fortyNine: on('ours', 2),
  monthOurs: on('ours', 4),
  /** "No" and "setup" as she says them (crit-r3 SYNC3-A: NUDGE — on the stamps they printed 3–4 f late) */
  noSetup: [said('ours', 6), said('ours', 7), on('ours', 8)] as const,
  /** b5: on "You" the pile leaves up and ours glides up; the track on "set"; the dots fill from "yourself" one per
   *  16th; the fourth turns into a check (T2 has no "minutes": it lands with the fourth dot) */
  you: on('setup', 0),
  set: said('setup', 1),
  dots: [0, 1, 2, 3].map((i) => on('setup', ix('setup', 'yourself')) + i * SIX),
  /** b6: on "It" ours shrinks into the parked price chip and the record rises; on "picks up" her orb glides onto the
   *  record's ringing rose dot (docked as "up" lands) and Answered lands; the availability step; on "books" the booking
   *  step ticks and the pill swaps to Booked */
  it: on('does', 0),
  picks: on('does', 1),
  /** "up"'s stamp (its p closure): the pickup click */
  up: on('does', 2),
  /** "up" as she says it (its vowel): her orb docks on the record's dot here */
  dock: said('does', 2),
  cant: on('does', 5),
  /** "books" (ig5-06) or, the launch-gate cut ig5-06-msg, "takes" (…and takes a message.) */
  books: on('does', has('does', 'books') ? ix('does', 'books') : ix('does', 'takes')),
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
  M.hedge,
  M.lift[1],
  M.slip2,
  M.from99,
  M.ninetyNine + 18,
  M.for50[2],
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

/* ── the cue sheet (SCRIPT §2 "Sound" beat by beat, HOOKS §1.3–1.4; hierarchy: voice ≫ story sounds ≫ the bed) ──
 * Every sound is a family of the reels' SHARED library (public/ig/sfx/lib, read-only; scripts/ig5/generate-sfx.mjs checks
 * each file's sha against lib.json) — no ig5-own copies, no new extras. A family with fewer files there than its
 * round-robin count (pop, ping, land, glint, whoosh-soft, fx-felttip, fx-riffle: one file; swish: two; fx-keys: the end
 * card's five) is played at most that many times. SCRIPT's `fx-roomtone-desk` is not among the shared copies: its room is
 * `fx-roomtone` (30.7 s, the whole reel). */
export const roomAt = (_f: number): Room => 'white';
/** the delivery's AAC head (ig4's lesson, check-delivery ≤ −1 dBTP: a limiter-pinned onset on the file's first samples
 *  decodes hot). ig5 has no bed under its first second, and the frame-0 ring peaks ≈ −10 dBFS in the master, far under
 *  the limiter — so its ring needs no head trim (`db` 0): it is the reel's first sound, a phone in a quiet room */
const HEAD = { db: 0 } as const;
/** the phone's screen x (stage/layout.ts PHONE.x 740): its rings, the pickup and her birth pan there */
const PHONE_X = 740 / 1080;
/** THE PICTURE'S OWN FRAMES the cue sheet answers — stage/*.tsx is picture only (outside this hash), so its offsets from M
 *  are mirrored here, by name: a spring's landing is its first crossing of rest (SPRING.site ≈ 5 f, land ≈ 5 f, pop ≈ 4 f) */
const PIC = {
  /** stage/type.tsx ROLL.dur: a figure's to-scale bar grows over 18 f from her word (the figure itself just rises) */
  roll: 18,
  /** stage/type.tsx Figure: a figure rises out of its mask from her word − 1 on SPRING.land; its hard landing (the
   *  spring's first crossing of rest, the "thump") is ≈ 4.75 f later — the thump goes there (crit-r2 S-R2-2) */
  figLand: 4,
  /** Papers.tsx stubState: the stub drops on "Setup," (SPRING.land); its staple closes from M.setup + 4 (SPRING.pop) */
  stubLand: M.setup + 5,
  staple: M.setup + 8,
  /** Papers.tsx squareAt: the quotes square up from the pickup; Ours.tsx OURS_RISE: ours rises 2 f before "Ours?" (the
   *  card lead, crit-r2 SYNC-B) and lands ≈ 5 f later (SPRING.site) */
  oursLand: M.ours + 3,
  /** Stage.tsx orbPose: the glide runs a LINEAR clock under its eases (x out3, y inOut, crit-r2 B1): she is within 1 px
   *  of the full stop 2 f before M.glide[1] — her landing's ping and chime go there */
  glideLand: M.glide[1] - 2,
  /** Papers.tsx PILE_EXIT: the pile fades out (linear, 3 f) from M.you − 8, gone by M.you − 5, as ours starts its
   *  glide up (Ours.tsx OURS_UP = M.you − 5, critically damped since crit-r3 LOOK3-P1: fastest ≈ 2 f in, at M.you − 3)
   *  — the whoosh's peak goes on ours' travel, not the pile's last frame (crit-r3 S-R3-1: its energy peaked 2–4 f ahead
   *  of the reel's fastest card move) */
  oursUp: M.you - 3,
  /** Ours.tsx: the fourth dot's check at M.dots[3] + 2 */
  check: M.dots[3] + 2,
  /** Record.tsx: REC_UP = M.it + 8 (SPRING.site); ANSWERED_AT = M.up (the pill starts up on the click, legible 2 f later:
   *  crit-r2 SYNC-D); the availability step spins from M.cant + 4 and is done at M.books − 7; OUTCOME_AT = M.books − 1
   *  (the kit Swap shows nothing for its first 2 f: the swap reads from "books" + 1 and Booked is legible ≈ + 3, crit-r2
   *  SYNC-C / S-R2-3) */
  recUp: M.it + 8,
  answered: M.up,
  tool1: M.cant + 4,
  tool1Done: M.books - 7,
  outcome: M.books - 1,
} as const;
/** a ring of the phone: one desk trill or its one chirp (a key hit: never under a word — RINGS passed the burst-aware law) */
const ring = (f: number, label: string, db: number, snd: Ring['snd'] = 'fx-trill'): Hit<Snd> => H(f, snd, 'rush', PHONE_X, 1, label, { db });
/** a rolling figure's counter: a dry tick per 32nd under the roll, at the figure's x */
const counter = (f: number, x: number, label: string, db: number): Hit<Snd> => H(f + 1, 'fx-tick', 'none', x, 2, label, { db, run: { n: 8, step: BEAT / 8 } });
export const HITS: Hit<Snd>[] = [
  // b1 — a phone ringing in a quiet room (HOOKS §1.4): the room tone, the frame-0 ring, R1 in a gap; no bed
  H(0, 'fx-roomtone', 'none', 0.5, 3, 'b1 the room’s tone from frame 0: the quiet room the hook is said in (the stop-time’s air floor too)', { db: -24 }),
  ring(0, 'b1 THE RING AT FRAME 0 (the third ring of the trio already in flight) — the desk phone’s rose light, the reel’s first sound', -3 + HEAD.db),
  // the last ring (the full trill before the pickup) sits on the crest of the bed's swell: +2.5 dB (crit-r2 S-R2-6)
  ...RINGS.map((r) => ring(r.f, r.what, r.snd === 'fx-trill' ? -2.5 : -5, r.snd)),
  H(M.slip1 + 1, 'fx-paper-lift', 'none', 0.5, 3, 'b1 → b2 slip 1 rises blank (an ink bar, an empty amount slot): the paper lifts', { db: 0 }),
  // b2 — the agency quote
  // (crit-r2 S-R2-4: the tags rise AS A UNIT since crit-r1 P4, so one felt-tip on each tag's rise, no stroke per word)
  H(M.tag[0] - 2, 'fx-felttip-short', 'none', 0.3, 3, 'b2 AGENCY AI RECEPTIONIST rises into the ink bar as a unit (one stroke)', { db: 2 }),
  H(M.three + PIC.figLand, 'thump', 'none', 0.3, 2, 'b2 “three hundred”: $300 lands in its slot (the landing spring’s first crossing) — its 600 px bar draws from the word', { db: -3 }),
  counter(M.three, 0.3, 'b2 … the bar measures out to 600 px: a dry tick per 32nd', 2),
  H(M.three + PIC.roll - 2, 'fx-tock', 'none', 0.3, 3, 'b2 … and settles (on “a month”’s lift)', { db: 1 }),
  H(PIC.stubLand, 'thump', 'none', 0.62, 2, 'b2 “Setup,”: the stub drops onto slip 1’s bottom margin with weight', { db: -1 }),
  H(PIC.staple, 'fx-tag', 'none', 0.36, 2, 'b2 … and is stapled there (the staple click)', { db: -3 }),
  H(M.fifteen + PIC.figLand, 'thump', 'none', 0.45, 2, 'b2 “fifteen hundred”: $1,500 lands in the stub (the landing spring’s first crossing; no bar, no count: a one-time fee)', { db: -5 }),
  H(M.lift[0] + 5, 'swish', 'none', [0.42, 0.58], 3, 'b2 → b3 slip 1 and its stub glide up into the b3 layout (slip 2 rises under them)', { db: -6 }),
  // b3 — the live answering quote
  H(M.slip2, 'fx-paper-lift', 'none', 0.5, 3, 'b3 slip 2 rises with its people stripe (the paper lifts, 2 f ahead of “Live”)', { db: 0 }),
  H(M.tag2[0] - 2, 'fx-felttip-short', 'none', 0.3, 3, 'b3 LIVE ANSWERING SERVICE rises with the slip as a unit (one stroke, under the paper’s lift)', { db: -1, layer: true }),
  counter(M.ninetyNine, 0.36, 'b3 “ninety-nine”: $99 rises; its 198 px bar measures out under it', 2),
  H(M.for50[1] - 1, 'fx-tock', 'none', 0.62, 3, 'b3 “fifty”: “50” prints (a frame ahead of the word)', { db: 1 }),
  // b4 — THE STOP-TIME (the bed cut on its 16th, MUSIC.stop): the pickup, her birth and "Ours?" in the room tone alone
  // (crit-r3 S-R3-2: no fx-seed — under ring 3's trill and the bed's swell it was never heard; trill → cut → click → ting)
  H(M.pickup, 'fx-pickup', 'none', PHONE_X, 1, 'b4 PICKUP (the bed’s cut + 1, 6 f before “Ours?”): the click — the phone that rang since frame 0 is answered', { db: 0 }),
  H(M.pickup + 3, 'fx-ting', 'sunday', PHONE_X, 2, 'b4 … the rose light springs open into her teal orb (the birth’s ting)', { db: -4, layer: true }),
  H(PIC.oursLand, 'land', 'none', 0.5, 3, 'b4 ours lands under the pile as the quotes square up (× .88, every $0 on x 160), "Ours?" on it', { db: -4 }),
  H(PIC.glideLand, 'ping', 'sunday', 0.62, 2, 'b4 her orb lands as ours’ full stop (after “a month”)', { db: 1 }),
  H(PIC.glideLand, 'chime-sunday-soft', 'sunday', 0.62, 3, 'b4 … the sunday chime under it', { layer: true, db: 2 }),
  H(M.fortyNine - 1, 'fx-mallet-e5', 'sunday', 0.3, 1, 'b4 “forty-nine”: TRUE — the bed returns on E with its pad an octave up; the mallet a frame ahead of the vowel, under the word', { db: -10 }),
  H(M.fortyNine + 1, 'fx-scratch', 'none', [0.2, 0.3], 3, 'b4 … ours’ 86 px hairline draws under the pile’s 174 and 528', { db: -10 }),
  H(M.noSetup[0], 'fx-tag', 'sunday', 0.78, 3, 'b4 “No setup fee.” prints teal at ours’ upper right, under the setup stub’s column', { db: 6 }),
  // b5 — set it up yourself
  // (crit-r3 S-R3-1: on ours' travel and +3 dB — at −4 dB on the pile's last frame only its 4–12 kHz band cleared the bed)
  H(PIC.oursUp, 'whoosh-soft', 'none', [0.5, 0.5], 3, 'b5 the pile has left up through its mask; ours glides up into the cleared stage (the whoosh on its travel)', { db: -2 }),
  H(M.set + 1, 'fx-scratch', 'none', [0.2, 0.62], 3, 'b5 “set”: the track draws with four empty dots', { db: -8 }),
  ...(['fx-pluck-e5', 'fx-pluck-fs5', 'fx-pluck-gs5', 'fx-pluck-b5'] as const).map((snd, k) =>
    // crit-r2 S-R2-7a: −3 dB (all four and the check fall on "up yourself." since T2)
    H(M.dots[k], snd, 'none', 0.22 + 0.17 * k, 2, `b5 dot ${k + 1} fills teal (${['E5', 'F#5', 'G#5', 'B5'][k]}: the pentatonic rising)`, { db: -1 }),
  ),
  H(PIC.check, 'fx-ting', 'sunday', 0.73, 2, 'b5 … the fourth dot turns into a drawn check', { db: -3 }),
  // b6 — it picks up when you can't, and books the appointment
  H(M.it + 3, 'fx-paper-fold', 'none', [0.5, 0.75], 3, 'b6 “It”: ours folds into the parked price chip (under the word’s vowel, not its onset)', { db: -3 }),
  H(PIC.recUp, 'fx-paper-lift', 'none', 0.5, 3, 'b6 the sample call’s record rises (its rose dot ringing: picture only — no chirp passes the ring law there)', { db: -8 }),
  H(M.up, 'fx-pickup', 'none', 0.2, 1, 'b6 “picks up”: the click on the p closure of “up” — her orb (docked on its vowel, M.dock) pulses as she takes the call and Answered starts up (crit-r2 S-R2-1 / SYNC-D); the kick enters with it', { db: 0 }),
  H(PIC.answered + 2, 'fx-ting', 'sunday', 0.7, 3, 'b6 … Answered lands (her teal), legible', { db: 3, layer: true }),
  // (the launch-gate cut ig5-06-msg has no availability step: one step "Took a message" on "takes", the pill → Message taken)
  ...(M.booked
    ? [
        H(PIC.tool1 + 2, 'fx-tick', 'none', 0.3, 3, 'b6 “Checked your availability”: a quiet tick-roll under the spinner', { db: 2, run: { n: 5, step: SIX } }),
        H(PIC.tool1Done, 'fx-glass-tick', 'sunday', 0.3, 2, 'b6 … the spinner resolves to a drawn check', { db: -4 }),
      ]
    : []),
  H(M.books + 1, 'fx-mallet-e5', 'sunday', 0.7, 1, `b6 “${M.booked ? 'books' : 'takes'}”: the step ticks and the pill swaps Answered → ${M.booked ? 'Booked' : 'Message taken'} (the mallet on the word: true / done)`, { db: -8 }),
  H(PIC.outcome + 3, 'pop', 'none', 0.7, 3, 'b6 … a small pop as the swap reads (the kit Swap crossfades at + 3)', { db: -6, layer: true }),
  // b7–b9 — the shared end card
  // (the comment field's rise and AGENT's keys are heard over the bed between her lines: the shared levels sat 18–19 dB
  //  under it here, as in ig1)
  //  — the keys back to −1 (crit-r2 S-R2-7b: at +2 they sat 6 dB over ig1–ig4's and the first lands on AGENT's onset)
  ...endHits(END_CARD).map((h) => (h.snd === 'fx-menu-open' ? { ...h, db: 6 } : h.snd === 'fx-keys' ? { ...h, db: -1 } : h)),
  // THE BUILD: her last word lands 34 f before the bar — a riser cresting with the roll, then the shared stack
  H(IMPACT - 10, 'riser', 'none', 0.5, 1, 'END the build’s crest under the roll (peaks a 16th before the inhale)', { db: 1.5 }),
  // the shared stack with its `slam` crack 6 dB down (mastering, docs/ig/ig5/DELIVERY.md): at full level its first 4 ms,
  // pinned by the master limiter at −1.65 dBTP, decoded from the delivery AAC at −0.73 dBTP (check-delivery ≤ −1.0); at
  // −6 the hottest decoded frame is −1.66 (message) / −1.46 (booking) and check-mix is unchanged (climax, arc, words, name)
  ...impactHits(IMPACT).map((h) => (h.snd === 'slam' ? { ...h, db: (h.db ?? 0) - 6 } : h)),
];
export const CUES: Cue[] = buildCues(HITS, { sfx: SFX, speaking, roomAt });

/** THE STOP-TIME before the payoff (SCRIPT b4, PICKS.md "the stop-time"): the bed cut on the sample from PLAN.stopLead
 *  before "Ours?" (on a 16th, `layout`) to "forty-nine" — the bed's return — from the placed take's onsets */
export const STOP = [LAID.stop, LINE.ours + vWord(CAST.ours, 2)] as const;
/** The moments the bed reads (scripts/ig5/bed.mjs inputs(T): ig5's own arrangement) */
export const MUSIC = {
  /** HOOKS §1.3 / §1.7: no music under the hook (a phone ringing in a quiet room); the bed enters on the first beat at or
   *  after slip 1 rises (f90, in the "can't." → "Agency" gap, with the paper's lift: crit-r1 sound S5 — on the beat after
   *  "Agency" it had entered mid-word on no picture event), the reel's first music */
  bedFrom: upBeat(M.slip1),
  stop: STOP,
  roll: IMPACT - ROLL,
  impact: IMPACT,
  brand: BRAND_AT,
  end: END,
  /** ig5's own moments (scripts/ig5/bed.mjs ig5Parts): the agency line (the quotes), the answering line (brushed 16ths
   *  into the cut), "forty-nine" (the return), "You" (the figure rests an 8th), the kick's entry (the does act, SCRIPT
   *  b6 "from f571"), "books" (E: the call resolved), the CTA */
  ig5: { agency: LINE.agency, answering: LINE.answering, fortyNine: STOP[1], you: M.you, kick: SCENES.does.from, books: M.books, cta: LINE.cta },
  /** crit-r1 sound S3: the snare roll 1.5 → 1.2 (with the tapered RIDE.build below) */
  build: { kick: 1.4, snare: 1.2, inhaleDb: -12 },
} as const;
/** the bed's fader: under her through the quotes, ridden up into the swell so the cut is an event, the return a touch
 *  forward (the payoff breathes), a step back under "You" (the set-up line's weakest onset), under her through the call;
 *  ridden up into the build as her CTA ends; then the series' shape round the hit, the chord held 2.5 dB higher into the
 *  seam (it still rings 10–5 f from the end) */
const CTA_END = Math.min(voiced(CTA, CAST.cta), IMPACT - 14);
/** crit-r1 sound S3 / S4: `call` 5 → 3.5 (the bed sat 10.4 LU under "It picks up when you can't"); the build ride
 *  starts AT her CTA's end (not 12 f before it: it swelled under "the link."), 13 → 9, with the build's snare 1.5 → 1.2,
 *  and it TAPERS by BUILD_TAPER dB over the roll's last 11 f into the inhale (the arrangement's own crescendo carries
 *  the rise). The roll had become the reel's loudest moment (+1.2 LU over the impact, the limiter at 6.3 dB); now its
 *  400 ms peak is −9.7 LUFS-M against the impact's −9.2 and the limiter ≤ 3.2 dB. A flat ride low enough for that fails
 *  check-mix's arc gate (its second into the logo, f750–780, must top the return on "forty-nine" by 0.5 LU): the taper
 *  keeps the roll's first half full, so the arc still leads by +0.6 */
const BUILD_TAPER = 3.5;
/** crit-r2 S-R2-5: `ret` 7 → 5.5 (the payoff's bed sat 10.0 LU under her, the reel's most forward) */
const RIDE = { under: 7.5, swell: 9, ret: 5.5, you: 2, call: 3.5, build: 9 } as const;
export const BED = {
  file: `ig/sfx/${REEL}/bed.wav`,
  vol: 2,
  ride: [
    [0, RIDE.under],
    [STOP[0] - 45, RIDE.under],
    [STOP[0] - 2, RIDE.swell],
    [STOP[1], RIDE.ret],
    [M.you - 12, RIDE.ret],
    [M.you - 3, RIDE.you],
    [M.you + 6, RIDE.you],
    [M.you + 15, RIDE.call],
    [CTA_END, RIDE.call],
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
  /** the impact insert held a frame longer and released over the name's first syllable (ig1's tuning: with the voice
   *  rides, the logo tops her loudest second by ≥ 1 LU; "Neuro" stays ≥ .9) */
  impact: { ...igImpact(IMPACT, BRAND_AT - IMPACT), hold: [0, 4] as const, release: 8 },
  name: IG_NAME,
  /** the music-forward passage the converge into the logo must top (check-mix arc): the bed's return on "forty-nine"
   *  (the rolled E, the pad an octave up), 45 f */
  arc: igArc([[STOP[1], STOP[1] + 45]]),
} as const;
export const GRAIN = { ground: 'pearl' as 'pearl' | 'night' };

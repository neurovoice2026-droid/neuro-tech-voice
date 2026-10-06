/**
 * THE SERIES — what the four Instagram reels share on their timelines (docs/ig/SCRIPT.md §0.3, PIPELINE.md §6):
 * the grid, the end card's offsets, the voice-placement rule, the screens' and display map's shapes, the sound
 * families every reel plays (film 1's and film 2's, read from the reels' own library copies), the end card's hit
 * stack and the Instagram master's numbers.
 *
 * Node-safe (PIPELINE.md H10): scripts/ig/generate-sfx.mjs, check-mix and check-render import the reels' timing.ts
 * (and so this file) with --experimental-strip-types — explicit `.ts` extensions, type-only imports marked, no enums,
 * namespaces or parameter properties, no React or Remotion.
 */
import { BEAT, MIX as MIX1, SFX as SFX1, b, type Group, type Light } from '../../timing.ts';
import { upQuarter, type Hit, type Pan, type SfxDef, type Weight } from './cues.ts';

/* ── the grid (120 BPM: beat 15 f, bar 60 f; bar n starts at 60(n − 1)) ── */
/** Frames per bar (2.0 s). */
export const BAR = 4 * BEAT;
/** Snap UP to the next bar line (integer frames). */
export const upBar = (f: number) => Math.round(Math.ceil(f / BAR - 1e-9) * BAR);

/* ── the end card (SCRIPT.md §0.3 "The shared end card") ── */
/** The seam: the last 14 frames re-form the frame-0 composition; the mix fades over them (MIX.fadeOut [END − SEAM, END]). */
export const SEAM = 14;
/** The sign-off "Neuro Tech Voice." starts this many frames after the impact, into its ring. */
export const IMPACT_GAP = 4;
/** The sign-off of all four reels (MIX.name.voice in each). It must be ≤ 1.45 s (PIPELINE.md §4). */
export const BRAND = 'ig1-07' as const;
/** The impact lands on the bar line one bar before the end (END − BAR). */
export const IMPACT_BEFORE_END = BAR;
/** The snare roll into the impact: half a bar. */
export const ROLL = BAR / 2;

/** Gap (frames) after a line before the next one may start: a breath (film 1's TURN_GAP). */
export const LINE_GAP = 6;
/**
 * THE ANCHORING RULE (SCRIPT.md §0.3): a line sits on its planned frame unless the take before it is still sounding;
 * then it starts on the next 16th after that take's end + `gap`. (Acts, IMPACT and END stay on their bars; a long take
 * borrows from the gaps before the CTA, and only the CTA can push the end card by whole bars.)
 */
export const place = (plan: number, after = -Infinity, gap = LINE_GAP) => (after + gap <= plan + 1e-9 ? plan : Math.max(plan, upQuarter(after + gap)));

/* ── what is shown of each line (the Captions fork, LiveTranscript rows, slots and fields read these) ── */
/** How a line's words are set on screen: narrator captions, an in-call row (● AVA), ig4's "Asked as" slot, ig4's
 *  owner field, the end card's brand (wordmark + URL: no caption). */
export type ScreenKind = 'caption' | 'row' | 'slot' | 'field' | 'brand';
/** One line's screens: word-index spans of its `say` (inclusive), ≤ 7 words each for captions. `set0`: the first
 *  screen is already set at frame 0 at 72 % ink (SCRIPT.md §0.3 frame-0 rule). */
export type LineScreens = { kind: ScreenKind; spans: readonly (readonly [number, number])[]; set0?: boolean };
/** The display map: numerals over a spoken word span (inclusive) of a line ("forty-five" → "45"). */
export type Display = { id: string; from: number; to: number; text: string };

/* ── the sound families ── */
/** Every reel's cue files live in their own library: byte copies of film 1's public/sfx/ and film 2's public/kb/sfx/
 *  files, made once by scripts/ig/generate-sfx.mjs (a later rebuild of a film's library can never change a reel). */
export const IG_LIB = 'ig/sfx/lib';
/** Film 2's extras the reels may play — the definitions of src/kb/timing.ts KB_SFX @ 743247a, re-declared (the
 *  reels never import film 2's timeline). Left out: the trills cut to film 2's pickups (fx-trill-15, fx-trill-1) and
 *  the montages cut to its timeline (fx-rolls, fx-slip-glide). */
const X = (n: number, group: Group, trim: number, send: number, o: Partial<SfxDef> = {}): SfxDef => ({ n, pk: 0, group, trim, send, ...o });
const KB_EXTRAS = {
  'fx-trill': X(1, 'sig', -2, -14),
  'fx-pickup': X(2, 'sig', -1, -16),
  'fx-line': X(1, 'sig', -4, -20),
  'fx-linehiss': X(1, 'sig', -4, -30),
  'fx-linehold': X(1, 'sig', -4, -30),
  'fx-slip': X(3, 'flip', 0, -18),
  'fx-slip-slide': X(3, 'air', -4, -18, { pk: 3, rank: 2 }),
  'fx-cup': X(1, 'pop', 0, -18),
  'fx-pen': X(1, 'tr', -2, -20),
  'fx-paper-square': X(1, 'flip', -2, -20),
  'fx-paper-fold': X(1, 'flip', -3, -20),
  'fx-riffle': X(4, 'flip', -2, -22),
  'fx-scroll': X(1, 'air', -6, -24),
  'fx-tuck': X(3, 'flip', -2, -20, { pk: 1 }),
  'fx-settle': X(1, 'low', 0, -20),
  'fx-paper-unfold': X(1, 'flip', -3, -20),
  'fx-paper-lift': X(2, 'air', -4, -20),
  'fx-felttip': X(2, 'air', -4, -22),
  'fx-felttip-short': X(1, 'air', -4, -22),
  'fx-scratch': X(2, 'air', -6, -24),
  'fx-pen-lift': X(1, 'air', -4, -22),
  'fx-record': X(1, 'pop', 0, -18),
  'fx-tag': X(1, 'tr', -1, -20),
  'fx-menu-open': X(1, 'pop', -2, -20),
  'fx-click-down': X(2, 'tr', 0, -18, { rank: 1 }),
  'fx-click-up': X(2, 'tr', -3, -20),
  'fx-keys': X(6, 'tr', -2, -22),
  'fx-tick': X(3, 'tr', -2, -22),
  'fx-tock': X(1, 'pop', -1, -18),
  'fx-flap': X(1, 'flip', -1, -20),
  'fx-seed': X(1, 'spark', -4, -14, { delay: -20 }),
  'fx-ting': X(1, 'spark', -4, -12, { delay: -20 }),
  'fx-mallet-e4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-mallet-fs4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-mallet-gs4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-mallet-b4': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-mallet-e5': X(1, 'bell', -3, -12, { delay: -18 }),
  'fx-felt-e': X(1, 'bell', -3, -14),
  'fx-pluck-e5': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-pluck-fs5': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-pluck-gs5': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-pluck-b5': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-pluck-e6': X(1, 'bell', -3, -12, { delay: -20 }),
  'fx-glass-tick': X(1, 'spark', -5, -14),
  'fx-glass-e6': X(1, 'bell', -4, -10, { delay: -18 }),
  'fx-glass-gs6': X(1, 'bell', -4, -10, { delay: -18 }),
  'fx-glass-b6': X(1, 'bell', -4, -10, { delay: -18 }),
  'fx-roomtone': X(1, 'sig', 0, -80),
  'fx-roomtone-desk': X(1, 'sig', 0, -80),
} as const satisfies Record<string, SfxDef>;
/** Every family read from the reels' library (`dir: ig/sfx/lib`): film 1's whole SFX table + film 2's extras above. */
const inLib = <O extends Record<string, SfxDef>>(o: O) =>
  Object.fromEntries(Object.entries(o).map(([k, d]) => [k, { ...d, dir: IG_LIB }])) as { readonly [K in keyof O]: SfxDef };
export const SFX = inLib({ ...SFX1, ...KB_EXTRAS });
export type Snd = keyof typeof SFX;

/** A hit (common/cues.ts `Hit`) in the reels' families. */
export const H = (at: number, snd: Snd, light: Light, x: Pan, w: Weight, label: string, o: Partial<Hit<Snd>> = {}): Hit<Snd> => ({ at, snd, light, x, w, label, ...o });

/** THE IMPACT's stack, the same in all four (the logo's hit on the bar line; film 2's b18 stack, lightened). No `chord`
 *  cue: the bed's E carries the resolution and is ridden down under the name and into the 14-frame seam, which a ringing
 *  bell on the effects bus would outlast (check-mix's end tail and the name's intelligibility). */
export const impactHits = (impact: number): Hit<Snd>[] => [
  H(impact, 'riser', 'none', 0.5, 1, 'END the build’s swell, peaking ON the impact', { db: -2 }),
  H(impact, 'impact', 'sunday', 0.5, 1, 'END LOGO IMPACT (bar line): the field leaves, the teal light opens into the backlight'),
  H(impact, 'thump', 'none', 0.5, 1, 'END the impact’s weight', { layer: true, db: -8 }),
  H(impact, 'slam', 'none', 0.5, 2, 'END the impact’s crack', { layer: true }),
];

/* ── the Instagram master (PIPELINE.md §6.1) ── */
/**
 * The reels' loudness numbers: −14 LUFS integrated for Instagram (films −15.5); the films' ceilings, fade shape, cut room,
 * air ceiling — and the films' DIALOGUE level, −20 LUFS in the dialogue stem.
 *
 * Why not PIPELINE.md §6.1's −18.5: check-mix measures the dialogue STEM, which master() (scripts/audio/mix.mjs,
 * unchanged) builds BEFORE its master gain, and it keeps every whole line at its file's own loudness (voice-lines-ig.json
 * level −23 LUFS mono = −20 in the dialogue bus; MIX.dialogueLufs only sets cut or ridden lines). The louder Instagram
 * master is reached by the master gain alone (+6 dB here vs the films' +5), which lifts voice, bed and effects together:
 * the films' voice-to-music balance is kept by keeping the films' −20. A stem target of −18.5 would need the voice files
 * at −21.5 LUFS, i.e. the voice 1.5 LU further forward of the music than in either film.
 */
export const IG_LOUD = {
  lufs: -14,
  ceiling: -1.5,
  dialogueLufs: MIX1.dialogueLufs,
  dialogueTol: MIX1.dialogueTol,
  dialogueCeil: MIX1.dialogueCeil,
  fadeK: MIX1.fadeK,
  cutRoom: MIX1.cutRoom,
  airLp: MIX1.airLp,
} as const;
/** The impact insert around the name (film 1's formula, from the reel's own impact → name gap). */
export const igImpact = (impact: number, nameGap: number) => ({ ...MIX1.impact, at: impact, hold: [0, Math.max(3, nameGap - 2)] as const, release: Math.max(6, nameGap + 1) });
/** The arc (check-mix): film 1's lead and end ring, over the reel's own music-forward windows. */
export const igArc = (windows: readonly (readonly [number, number])[]) => ({ ...MIX1.arc, windows });
/** The name: film 1's numbers, the series' sign-off. */
export const IG_NAME = { ...MIX1.name, voice: BRAND } as const;

/** The bed's fader (absolute frame, dB): flat, then film 2's shape round the hit — stepped back under the inhale so its E
 *  arrives under the hit, a bloom after it, well back for the name (said 4 f after the hit, into its ring), then down
 *  into the seam: the reels' fade is only SEAM (14 f) long, so the ring must already be low when it starts (check-mix:
 *  last 100 ms ≤ −55 dBFS, last frame ≤ −60, the chord still ringing ≥ MIX.arc.ringDb 10–5 f from the end). */
export const bedRide = (impact: number, brandAt: number, brandFrames: number, end: number): readonly (readonly [number, number])[] => [
  [0, 0],
  [impact - b(2), 0],
  [impact - 6, 2.5],
  [impact - 1, -4],
  [impact + 2, -3],
  [brandAt - 1, -8],
  [brandAt + brandFrames - 4, -8],
  [end - SEAM, -20],
  [end, -30],
];

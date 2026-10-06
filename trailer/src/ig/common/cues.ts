/**
 * THE REELS' CUE MACHINERY: a verbatim fork of src/lib/ (film 2's film-agnostic port of film 1's voice and cue code,
 * @ 743247a) — makeVoiceKit, makeSpeech, buildCues, the grid snaps and their types, token for token; only this header
 * and the relative path of film 1's house constants differ.
 *
 * Why a fork and not an import: film 2's scripts/kb/check-port.mjs (verify-film1 gate 10) proves that NO source
 * outside src/kb/ mentions the port's module by name (its H10 check: "no film 1 source imports it") and it reads every
 * src/ file outside src/kb/ as film 1's. That script is frozen with film 2, so the reels carry their own copy.
 * scripts/ig/generate-sfx.mjs proves on every build that this file is still the port's code token for token (its
 * contract step), so the reels' cues are exactly what the films' machinery would build.
 *
 * Node-safe (H10): explicit `.ts` extensions, type-only imports marked, no enums, namespaces or parameter properties,
 * no React or Remotion.
 */
import { BEAT, CUT, FPS, LIGHT_SEMI, type Group, type Light } from '../../timing.ts';

/* ── the grid ─────────────────────────────────────────────────────── */
/** Snap a frame count UP to the next 8th (half-beat) / beat / 16th (quarter-beat), so turns land on the grid. */
export const upHalf = (f: number) => Math.round(Math.ceil(f / (BEAT / 2) - 1e-9) * (BEAT / 2));
export const upBeat = (f: number) => Math.round(Math.ceil(f / BEAT - 1e-9) * BEAT);
export const upQuarter = (f: number) => Math.round(Math.ceil(f / (BEAT / 4) - 1e-9) * (BEAT / 4));

/* ── voices ───────────────────────────────────────────────────────── */
/** What the port reads of a spoken line (the shape generate-voice writes into voice.generated.ts):
 *  `frames` long, words and phrases timed in seconds, `env` = loudness per 30 fps frame (0…1). */
export type VoiceLine = {
  readonly frames: number;
  readonly words: readonly { readonly t: number }[];
  readonly phrases: readonly { readonly start: number; readonly end: number }[];
  readonly env: readonly number[];
};
/** A film's generated VOICE (only its `lines` are read). */
export type VoiceData<L extends Record<string, VoiceLine> = Record<string, VoiceLine>> = { readonly lines: L };
/** Every spoken line on the absolute timeline. */
export type Voiced<Id extends string = string> = {
  at: number;
  id: Id;
  /** the picture's switch: the next voice cuts in here (the language cascade) */
  until?: number;
};
/**
 * THE VOICE POST: a fader on part of a line, `db` over the line's frames [from, to) (from the line's
 * own start), ramped over `ramp` frames outside that span. A film's VOICE_RIDES is a
 * `Partial<Record<VoiceId, readonly VoiceRide[]>>` (read by scripts/audio/mix.mjs).
 */
export type VoiceRide = { from: number; to: number; db: number; ramp: number };

/**
 * A film's voice kit, bound to its VOICE.
 *
 * THE CASCADE CUT (voiceCut). A line with `until` (the language cascade) is cut where the next voice
 * starts, and lets go the way a voice does: the fade starts ON `until` and ends on the line's own next
 * dip (the gap before its next syllable, read from the per-frame loudness `env`) within `CUT.max`
 * frames, or after `CUT.fade` frames if no dip comes; at least `CUT.min` frames. A line that is already
 * silent at `until` closes before its next syllable's onset, so no stray syllable leaks under the next
 * voice. The voice that cuts in waits until the cut one has let go (`firstSound`, `CUT.clear`).
 */
export function makeVoiceKit<L extends Record<string, VoiceLine>>(VOICE: VoiceData<L>) {
  type Id = keyof L & string;
  /** Frames a spoken line lasts. */
  const vFrames = (id: Id) => VOICE.lines[id].frames;
  /** Frame offset (from the line's start) at which spoken word `k` begins. */
  const vWord = (id: Id, k: number) => Math.round(VOICE.lines[id].words[k].t * FPS);
  /** a cut line's fade on the absolute timeline [from, to] (raised cosine 1 → 0); null when it plays whole */
  function voiceCut(v: Voiced<Id>): readonly [number, number] | null {
    if (v.until === undefined) return null;
    const env = VOICE.lines[v.id].env;
    const e = (i: number) => env[Math.max(0, Math.min(env.length - 1, i))];
    const u = v.until - v.at;
    const iu = Math.round(u);
    if (iu >= env.length - 1) return null; // the line has ended by then: it plays whole
    if (e(iu) <= CUT.quiet) {
      // silent at the cut: close before the next syllable starts
      let o = iu;
      while (o < env.length && e(o) <= CUT.onset) o++;
      const to = Math.min(u + CUT.min, o - 0.5);
      return [v.at + to - CUT.min, v.at + to] as const;
    }
    let to = u + CUT.fade;
    for (let i = iu + 1; i <= iu + CUT.max && i < env.length; i++) {
      if (e(i) <= CUT.quiet) { to = i; break; } // she has let go of the syllable
      if (e(i) <= CUT.dip && e(i + 1) > e(i) + 0.03) { to = i + 0.5; break; } // the gap before the next one
    }
    return [v.at + u, v.at + Math.max(u + CUT.min, to)] as const;
  }
  /** the frames from a line's start to its first sound (its first aligned word or its first voiced frame) */
  const firstSound = (id: Id) => {
    const l = VOICE.lines[id];
    const o = l.env.findIndex((x) => x >= CUT.onset);
    return Math.min(l.words[0].t * FPS, o < 0 ? Infinity : o);
  };
  /** the frame a line has gone silent (its cut, else its end) */
  const voiceEnd = (v: Voiced<Id>) => voiceCut(v)?.[1] ?? v.at + vFrames(v.id);
  return { vFrames, vWord, voiceCut, firstSound, voiceEnd };
}

/**
 * A film's speech, from its VOICE and its VOICES (sorted by `at`).
 *   · SPEECH: speech windows (absolute frames, whole lines; a cut line ends on its cut); the bed ducks under these.
 *   · PHRASES: where someone is actually talking: the aligned phrases AND every voiced run of the line's
 *     loudness (env ≥ 0.08 for ≥ 3 frames, gaps ≤ 4 frames bridged), so the unaligned words count too;
 *     clipped to a cut line's cut.
 *   · speaking(f): is someone speaking at frame f (± a little air around each phrase)?
 */
export function makeSpeech<L extends Record<string, VoiceLine>>(VOICE: VoiceData<L>, VOICES: readonly Voiced<keyof L & string>[]) {
  const { voiceEnd } = makeVoiceKit(VOICE);
  const SPEECH = VOICES.map((v) => [v.at, voiceEnd(v)] as const);
  const PHRASES = VOICES.flatMap((v) => {
    const l = VOICE.lines[v.id];
    const out: (readonly [number, number])[] = l.phrases.map((p) => [v.at + p.start * FPS, v.at + p.end * FPS] as const);
    let s = -1;
    let last = -10;
    const run = () => {
      if (s >= 0 && last + 1 - s >= 3) out.push([v.at + s, v.at + last + 1] as const);
    };
    l.env.forEach((x, i) => {
      if (x < 0.08) return;
      if (s < 0 || i - last > 4) {
        run();
        s = i;
      }
      last = i;
    });
    run();
    const end = voiceEnd(v);
    return out.filter(([a]) => a < end).map(([a, e]) => [a, Math.min(e, end)] as const);
  });
  const speaking = (f: number, before = 3, after = 5) => PHRASES.some(([a, e]) => f >= a - before && f <= e + after);
  return { SPEECH, PHRASES, speaking };
}

/* ── the cue builder ──────────────────────────────────────────────── */
export type Weight = 1 | 2 | 3;
export type Pan = number | readonly [number, number];
/** the mix's two rooms (scripts/audio/mix.mjs ROOMS) */
export type Room = 'night' | 'white';
/** A sound family. Film 1's SFX entries fit as they are; a film's own extras add `dir`. */
export type SfxDef = {
  /** round-robin variants (files name-0 … name-(n-1); one file when 1) */
  n: number;
  /** frames from the sound's start to its peak (lands on the hit) */
  pk: number;
  group: Group;
  /** loudness trim (dB) so families sit together at the same weight */
  trim: number;
  /** room send (dB) and tempo-delay send (dB) */
  send: number;
  delay?: number;
  /** synthesised on B and retuned by the hit's light */
  tune?: boolean;
  /** inside a merge, the bigger sound wins a tie */
  rank?: number;
  /** a sustained TONE outside the bell / sparkle families: it rides the tonal bus too, so it steps
   *  back under a voice that starts while it rings (DUCK.tonalDb) */
  tonal?: boolean;
  /** the family's folder relative to public/ (default 'sfx': film 1's library; a film's extras: e.g. 'kb/sfx') */
  dir?: string;
};
/** A visual hit: the frame the picture hits, the sound, its light, screen x (or a pan move), weight. */
export type Hit<S extends string = string> = {
  at: number;
  snd: S;
  light: Light;
  x: Pan;
  w: Weight;
  label: string;
  /** extra semitones; extra dB; a run (n hits `step` frames apart, rising `semi`); a stereo split; skip merging */
  semi?: number;
  db?: number;
  run?: { n: number; step?: number; semi?: number; semis?: readonly number[]; offs?: readonly number[]; xs?: readonly number[] };
  split?: boolean;
  layer?: boolean;
};
export type Cue = {
  /** start frame (fractional = sample-accurate in the mix) */
  at: number;
  /** relative to public/ */
  file: string;
  /** linear gain on the file (files peak at −12 dBFS) */
  vol: number;
  /** pan −0.6 … 0.6, or a move [from, to] over `move` frames */
  pan: Pan;
  move?: number;
  /** playback rate: the light's tuning + a round-robin micro-detune */
  rate: number;
  room: Room;
  /** the family's group: bells and sparkles ride their own bus, which steps back under the voice */
  group: Group;
  /** rides the tonal bus (bells, sparkles, and the sustained tones marked `tonal`) */
  tonal: boolean;
  /** room send / tempo-delay send (dB) */
  send: number;
  delay?: number;
  key: boolean;
  /** the hit lands while someone is speaking */
  speech: boolean;
  /** the picture's hit this cue answers, and what it is */
  hit: number;
  label: string;
};
export type CueOptions<S extends string> = {
  /** the film's sound families: film 1's SFX, plus any extras (with their own `dir`) */
  sfx: Readonly<Record<S, SfxDef>>;
  /** is someone speaking at frame f? (makeSpeech(…).speaking) */
  speaking: (f: number) => boolean;
  /** the room a hit at frame f plays in (film 1: 'white' inside WHITE_ACT, else 'night') */
  roomAt: (f: number) => Room;
};

const W_DB: Record<Weight, number> = { 1: 0, 2: -4, 3: -9 };
/** non-key hits under speech */
const SPEECH_DB = -5;
const DETUNE_CENTS = [0, 7, -6, 4, -8, 5, -3, 8];
const panOf = (x: number) => Math.max(-0.6, Math.min(0.6, (x - 0.5) * 1.2));

/**
 * HITS → CUES: merge near-simultaneous hits, expand runs and splits, choose round-robin variants,
 * tune, gain, pan, room. (The only additions to film 1's code: the two guards that name a sound
 * missing from `sfx`, where film 1's code would stop on a TypeError.)
 */
export function buildCues<S extends string>(hits: readonly Hit<S>[], { sfx: SFX, speaking, roomAt }: CueOptions<S>): Cue[] {
  const fileOf = (s: S, k: number) => `${SFX[s].dir ?? 'sfx'}/${SFX[s].n > 1 ? `${s}-${k}.wav` : `${s}.wav`}`;
  for (const h of hits) if (!SFX[h.snd]) throw new Error(`buildCues: "${h.label}" (at ${h.at}) plays "${h.snd}", which is not in sfx`);
  // 1. merge: within a group, hits ≤ 2 frames apart keep only the heavier (then the bigger, then the first)
  const sorted = [...hits].sort((a, b) => a.at - b.at);
  const kept: Hit<S>[] = [];
  for (const h of sorted) {
    const g = SFX[h.snd].group;
    if (g === 'sig' || h.layer) {
      kept.push(h);
      continue;
    }
    const rival = kept.find((k) => !k.layer && SFX[k.snd].group === g && Math.abs(k.at - h.at) <= 2);
    if (!rival) {
      kept.push(h);
      continue;
    }
    const score = (x: Hit<S>) => -x.w * 10 + (SFX[x.snd].rank ?? 0);
    if (score(h) > score(rival)) kept.splice(kept.indexOf(rival), 1, h);
  }
  // 2. expand runs and splits, choose variants, tune, gain, pan, room
  const rr = new Map<S, number>();
  const cues: Cue[] = [];
  for (const h of kept.sort((a, b) => a.at - b.at)) {
    // a light chime under speech strikes soft (darker, no mallet): the word stays in front
    const snd = (/^chime-(rush|closing|sunday|night)$/.test(h.snd) && speaking(h.at) ? `${h.snd}-soft` : h.snd) as S;
    const def: SfxDef = SFX[snd];
    if (!def) throw new Error(`buildCues: "${h.label}" (at ${h.at}) needs "${snd}", which is not in sfx`);
    const run = h.run ?? { n: 1 };
    for (let j = 0; j < run.n; j++) {
      const hit = h.at + (run.offs ? run.offs[j] : j * (run.step ?? 0));
      const x = run.xs ? run.xs[j] : h.x;
      const parts: Pan[] = h.split ? [[-0.1, -0.55], [0.1, 0.55]] : [typeof x === 'number' ? panOf(x) : [panOf(x[0]), panOf(x[1])]];
      for (const pan of parts) {
        const c = rr.get(snd) ?? 0;
        rr.set(snd, c + 1);
        const semi = (def.tune ? LIGHT_SEMI[h.light] : 0) + (h.semi ?? 0) + (run.semis ? run.semis[j] : (run.semi ?? 0) * j);
        const cents = def.n > 1 || def.tune ? DETUNE_CENTS[c % DETUNE_CENTS.length] : 0;
        const rate = Math.pow(2, (semi + cents / 100) / 12);
        const key = h.w === 1;
        const talk = speaking(hit);
        // under speech: non-key hits −5 dB; sustained tonal sounds (bells, sparkles) a little more, keys included
        const tonal = def.group === 'bell' || def.group === 'spark' || !!def.tonal;
        const dB =
          W_DB[h.w] + def.trim + (h.db ?? 0) + (talk && !key ? SPEECH_DB : 0) + (talk && tonal ? -3 : 0) + (h.split ? -3 : 0) -
          (run.xs ? 0 : j * (run.n > 3 ? 0.25 : 0.8));
        const start = hit - def.pk / rate;
        const room = roomAt(hit);
        cues.push({
          at: start,
          file: fileOf(snd, c % def.n),
          vol: Math.pow(10, dB / 20),
          pan: run.n > 3 && !run.xs && typeof pan === 'number' ? Math.max(-0.6, Math.min(0.6, pan + ((j % 3) - 1) * 0.08)) : pan,
          move: Array.isArray(pan) ? def.pk + 10 : undefined,
          rate,
          room,
          group: def.group,
          tonal,
          send: def.send,
          delay: def.delay,
          key,
          speech: talk,
          hit,
          label: h.label + (run.n > 1 ? ` [${j + 1}/${run.n}]` : ''),
        });
      }
    }
  }
  return cues.sort((a, b) => a.at - b.at);
}

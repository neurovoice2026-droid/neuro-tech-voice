import type { Cue, CueFile } from "./cue-types";

export type { Cue, CueEvent, CueFile, CueSfx, CueTurn, CueWord } from "./cue-types";

/* ------------------------------------------------------------------ *
 * The site's cue files, typed.
 *
 * Each surface's cues are one JSON file in ./cues, written by the audio
 * pipeline (assemble.py; the shape is cue-types.ts). The MP3s they point
 * at are under public/audio/v1, fetched only once the visitor turns
 * sound on (components/site/audio/engine.ts).
 *
 * Every surface's cues load through import() on first use with
 * `loadCueFile` / `loadCue`, each file its own chunk. A stage calls them
 * only once sound is on: no cue is fetched before the visitor opts in, and
 * none is in a page's first load. P0 (the conversations a visitor meets
 * first) reads them through `lazyCues`, which fetches its file as sound
 * goes on and then hands it over synchronously, so the stage's run (and
 * its frame loop) never waits on a promise once it is here. A new surface
 * is one line in LOADERS (and its file in ./cues).
 *
 * Never import a cue file's JSON statically into a client island: it would be
 * part of the page's first load, sound or not.
 *
 * A chunk that fails to load stays failed for the rest of the visit (the
 * bundler's runtime keeps the rejected load), so a failed import() falls
 * back to the same file as plain JSON (app/audio-cues/[surface], written
 * at build time), fetched now and again on every later call until it
 * arrives.
 * ------------------------------------------------------------------ */

/** A cue file's JSON, typed: JSON modules type loosely (strings for unions, arrays for tuples); assemble.py checks the shape. */
export const asCueFile = (json: unknown) => json as CueFile;

const LOADERS = {
  // P0: read through lazyCues (below).
  "home-demo-call": () => import("./cues/home-demo-call.json"),
  "home-knowledge-call": () => import("./cues/home-knowledge-call.json"),
  "agents-hero-reel": () => import("./cues/agents-hero-reel.json"),
  "agents-sample-calls": () => import("./cues/agents-sample-calls.json"),
  "agents-use-cases-console": () => import("./cues/agents-use-cases-console.json"),
  "kb-hero-reading-room": () => import("./cues/kb-hero-reading-room.json"),
  // P1 and later: on first use only.
  "home-voice-greetings": () => import("./cues/home-voice-greetings.json"),
  "home-trades-caller": () => import("./cues/home-trades-caller.json"),
  "agents-platform-greeting": () => import("./cues/agents-platform-greeting.json"),
  "kb-two-calls": () => import("./cues/kb-two-calls.json"),
  "industry-first-question": () => import("./cues/industry-first-question.json"),
  "industry-run-it-call": () => import("./cues/industry-run-it-call.json"),
  "caa-hero-greeting-transfer": () => import("./cues/caa-hero-greeting-transfer.json"),
  "caa-names-caller-sentence": () => import("./cues/caa-names-caller-sentence.json"),
  "caa-redline-test-calls": () => import("./cues/caa-redline-test-calls.json"),
  "caa-rehearsal-test-sheet": () => import("./cues/caa-rehearsal-test-sheet.json"),
  // P2 and later: on first use only.
  "agents-platform-voiceprint": () => import("./cues/agents-platform-voiceprint.json"),
  "agents-platform-paperwork": () => import("./cues/agents-platform-paperwork.json"),
  "kb-meaning-phrasings": () => import("./cues/kb-meaning-phrasings.json"),
  "kb-shelf-asks": () => import("./cues/kb-shelf-asks.json"),
  "kb-limits-fallback": () => import("./cues/kb-limits-fallback.json"),
  "post-call-keyword-excerpt": () => import("./cues/post-call-keyword-excerpt.json"),
  "industry-wall-retraction": () => import("./cues/industry-wall-retraction.json"),
  "industry-bench-intents": () => import("./cues/industry-bench-intents.json"),
} satisfies Record<string, () => Promise<{ default: unknown }>>;

/** Every surface with a cue file. */
export type Surface = keyof typeof LOADERS;

/** Every surface's name (app/audio-cues/[surface] writes one JSON file for each). */
export const SURFACES = Object.keys(LOADERS) as Surface[];

export const isSurface = (s: string): s is Surface => Object.prototype.hasOwnProperty.call(LOADERS, s);

/** A surface's cue file as its module has it (the server's route reads it this way). */
export const loadCueModule = async (surface: Surface) => (await LOADERS[surface]()).default;

/** Where a surface's cue file is served as plain JSON: the retry for a chunk that failed. */
export const cueFileUrl = (surface: Surface) => `/audio-cues/${surface}`;

const pending = new Map<Surface, Promise<CueFile | null>>();
/** Surfaces whose chunk failed to load: it never loads in this visit, so they go to the JSON straight away. */
const chunkFailed = new Set<Surface>();

async function fetchCueFile(surface: Surface): Promise<CueFile> {
  const r = await fetch(cueFileUrl(surface));
  if (!r.ok) throw new Error(`${surface}: ${r.status}`);
  return asCueFile(await r.json());
}

/**
 * A surface's cue file, fetched once and shared: its chunk through
 * import(), or, once that has failed, the same file as JSON. A failed
 * fetch (a flaky connection, a deploy that moved the file) resolves to
 * null and is forgotten, so the next call tries again.
 */
export function loadCueFile(surface: Surface): Promise<CueFile | null> {
  let p = pending.get(surface);
  if (!p) {
    const load = chunkFailed.has(surface)
      ? fetchCueFile(surface)
      : LOADERS[surface]()
          .then((m) => asCueFile(m.default))
          .catch(() => {
            chunkFailed.add(surface);
            return fetchCueFile(surface);
          });
    p = load.catch(() => {
      pending.delete(surface);
      return null;
    });
    pending.set(surface, p);
  }
  return p;
}

/** One track of a cue file, or undefined if it has none by that id. */
export function cueIn(cues: CueFile, id: string): Cue | undefined {
  return Object.prototype.hasOwnProperty.call(cues.cues, id) ? cues.cues[id] : undefined;
}

/** One track of a surface, loaded as `loadCueFile` loads it: null when the file or the track is missing. */
export async function loadCue(surface: Surface, id: string): Promise<Cue | null> {
  const cues = await loadCueFile(surface);
  return (cues && cueIn(cues, id)) ?? null;
}

/**
 * A P0 surface's cue file, made into what its stage reads (`build`),
 * fetched once sound is on and then read synchronously:
 *
 *   const CUES = lazyCues("home-demo-call", (f) => ...);
 *   // with sound on (an effect, or inside the press): void CUES.load();
 *   // building a run: CUES.get() (null until it is here)
 *
 * `settled()` is false only while a fetch is under way, or before the
 * first: a run asked for with sound on waits for `load()` when it is not
 * settled, and runs read-paced when the file could not be fetched (a
 * later `load()` tries again).
 */
export function lazyCues<T>(surface: Surface, build: (file: CueFile) => T) {
  let value: T | null = null;
  let loading: Promise<T | null> | null = null;
  let failed = false;
  return {
    get: (): T | null => value,
    settled: () => value !== null || (failed && loading === null),
    load(): Promise<T | null> {
      if (value !== null) return Promise.resolve(value);
      loading ??= loadCueFile(surface).then((file) => {
        loading = null;
        if (file) value = build(file);
        failed = value === null;
        return value;
      });
      return loading;
    },
  };
}

export type LazyCues<T> = ReturnType<typeof lazyCues<T>>;

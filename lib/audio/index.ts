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
 * The four industry surfaces are one file per trade instead
 * (./cues/industry/<surface>/<slug>.json, mapped in industry-cues.ts): a
 * trade page loads its own trade's cues with `loadIndustryCueFile`, never
 * the other fifteen.
 *
 * A chunk that fails to load stays failed for the rest of the visit (the
 * bundler's runtime keeps the rejected load), so a failed import() falls
 * back to the same file as plain JSON (app/audio-cues/[surface], and
 * [surface]/[slug] for a trade's file, written at build time), fetched
 * now and again on every later call until it arrives.
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
} satisfies Record<string, () => Promise<{ default: unknown }>>;

/** Every surface with a cue file (the industry surfaces have one per trade: IndustrySurface). */
export type Surface = keyof typeof LOADERS;

/** The surfaces of the industry pages, each one cue file per trade. */
export const INDUSTRY_SURFACES = [
  "industry-first-question",
  "industry-run-it-call",
  "industry-wall-retraction",
  "industry-bench-intents",
] as const;
export type IndustrySurface = (typeof INDUSTRY_SURFACES)[number];

export const isIndustrySurface = (s: string): s is IndustrySurface =>
  (INDUSTRY_SURFACES as readonly string[]).includes(s);

/** A cue file: a surface's, or one trade's of an industry surface. */
type CueFileKey = Surface | `${IndustrySurface}/${string}`;

/** Every surface's name (app/audio-cues/[surface] writes one JSON file for each). */
export const SURFACES = Object.keys(LOADERS) as Surface[];

export const isSurface = (s: string): s is Surface => Object.prototype.hasOwnProperty.call(LOADERS, s);

/** A surface's cue file as its module has it (the server's route reads it this way). */
export const loadCueModule = async (surface: Surface) => (await LOADERS[surface]()).default;

/** Where a cue file is served as plain JSON: the retry for a chunk that failed. */
const cueFileUrl = (key: CueFileKey) => `/audio-cues/${key}`;

const pending = new Map<CueFileKey, Promise<CueFile | null>>();
/** Files whose chunk failed to load: it never loads in this visit, so they go to the JSON straight away. */
const chunkFailed = new Set<CueFileKey>();

async function fetchCueFile(key: CueFileKey): Promise<CueFile> {
  const r = await fetch(cueFileUrl(key));
  if (!r.ok) throw new Error(`${key}: ${r.status}`);
  return asCueFile(await r.json());
}

/**
 * A cue file, fetched once and shared: its chunk through import()
 * (`chunk`), or, once that has failed, the same file as JSON. A failed
 * fetch (a flaky connection, a deploy that moved the file) resolves to
 * null and is forgotten, so the next call tries again.
 */
function loadFile(key: CueFileKey, chunk: () => Promise<{ default: unknown }>): Promise<CueFile | null> {
  let p = pending.get(key);
  if (!p) {
    const load = chunkFailed.has(key)
      ? fetchCueFile(key)
      : chunk()
          .then((m) => asCueFile(m.default))
          .catch(() => {
            chunkFailed.add(key);
            return fetchCueFile(key);
          });
    p = load.catch(() => {
      pending.delete(key);
      return null;
    });
    pending.set(key, p);
  }
  return p;
}

/** A surface's cue file, as `loadFile` loads it. */
export function loadCueFile(surface: Surface): Promise<CueFile | null> {
  return loadFile(surface, LOADERS[surface]);
}

/**
 * One trade's cue file of an industry surface, as `loadFile` loads it. The
 * map of the trades' files (industry-cues.ts) is itself fetched here, on
 * first use: it is in no page's first load.
 */
export function loadIndustryCueFile(surface: IndustrySurface, slug: string): Promise<CueFile | null> {
  return loadFile(`${surface}/${slug}`, () =>
    import("./industry-cues").then((m) => m.loadIndustryCueModule(surface, slug)),
  );
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
 * first: a run that starts by itself with sound on waits for `load()`
 * when it is not settled, and runs read-paced when the file could not be
 * fetched. A press finds `get()` null and calls `load()` again, settled
 * or not: every later call retries a failed fetch. `subscribe` hears the
 * file arrive, whichever call fetched it (useLazyCues renders on it).
 */
export function lazyCues<T>(surface: Surface, build: (file: CueFile) => T) {
  let value: T | null = null;
  let loading: Promise<T | null> | null = null;
  let failed = false;
  const heard = new Set<() => void>();
  return {
    get: (): T | null => value,
    settled: () => value !== null || (failed && loading === null),
    load(): Promise<T | null> {
      if (value !== null) return Promise.resolve(value);
      loading ??= loadCueFile(surface).then((file) => {
        loading = null;
        if (file) value = build(file);
        failed = value === null;
        if (value !== null) heard.forEach((f) => f());
        return value;
      });
      return loading;
    },
    /** Calls `onHere` once the file has arrived; returns the unsubscribe. */
    subscribe(onHere: () => void) {
      heard.add(onHere);
      return () => {
        heard.delete(onHere);
      };
    },
  };
}

export type LazyCues<T> = ReturnType<typeof lazyCues<T>>;

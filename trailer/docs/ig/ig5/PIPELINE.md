# ig5 (price reel): build pipeline

Label `synth`. Written on 2026-10-07 at HEAD `e288a27` (`claude/remotion-trailer`). This is a planning document: no code was changed and nothing was committed.

It adds a fifth reel, `ig5`, to the Instagram pipeline of `docs/ig/PIPELINE.md` while leaving the delivered work exactly as it is:
- **film 1** `main` stays FROZEN;
- **film 2** `kb` stays DELIVERED;
- **ig1–ig4** stay delivered, and their mix stamps stay CURRENT.

The reel's content (script, figures, sources) lives in `docs/ig/ig5/SCRIPT.md`, `RESEARCH-prices.md` and `RESEARCH-product.md`. This file covers only how ig5 is built.

Paths are relative to `trailer/`.

---

## 0. Decisions

1. **ig5 is a sixth film in the merged registry.** It is not added to `scripts/ig/films.mjs`, `scripts/voice-lines-ig.json`, `src/ig/voice.generated.ts`, `src/ig/common/*.ts` or `scripts/ig/generate-sfx.mjs`. Every one of those is an input to `igHash`, the hash of all four delivered reels (§1).
2. **ig5's own registry file is `scripts/ig5/films.mjs`.** `scripts/registry.mjs` merges it in, the same way it merges `scripts/ig/films.mjs` today. Everything new for ig5 lives in `scripts/ig5/`, `src/ig/ig5/` and `voice-candidates/ig5/`. That covers the registry, the voice lines, the sound driver, the hash and the guard.
3. **Shared folders, new names only.** ig5's public files go under the folders the bundles already treat as sound files: `public/ig/voice/ig5-*.wav` (tracked) and `public/ig/sfx/ig5/` (gitignored). Its deliverables go to `out/ig/deliver/neurotechvoice-ig5-*`, beside the delivered files and never over them.
4. **The series sign-off is reused byte for byte.** `ig1-07` ("Neuro Tech Voice.") enters ig5's voice set as a borrow, `{"id": "ig1-07", "borrow": "ig1"}`. It is never synthesised again.
5. **ig1–ig4 code is reused by import.** Their bed, mixer, cue machinery, hash, end card, captions, orb and kit are imported, not copied. The exceptions are two code paths that cannot be imported, because they run on load: the IG sound driver and its contract check. ig5 gets a copy of those.
6. **The house spec is unchanged.** 30 fps × 4 = 120 fps, 120 BPM, 1080×1920, pearl or night ground, Tessa speaks every on-screen line, the end card types AGENT, then the NEUROVOICE wordmark and the URL. The driver contract requires a length of 20–28 s.

---

## 1. Why the obvious route breaks ig1–ig4

These hashes are where any change would show up. Each row was read from the code at `e288a27`.

| Hash / gate | What it reads | Consequence for ig5 |
|---|---|---|
| **`igHash`** (`scripts/ig/hash.mjs`), the stamp of each of ig1–ig4 | `src/ig/<reel>/timing.ts`; **every `src/ig/common/*.ts`** (`ls` of the folder); `src/ig/voice.generated.ts`; `src/timing.ts`; `src/voice.generated.ts`; **every top-level `scripts/ig/*.mjs`** except the QA-only `render-par`, `finish`, `check-delivery`, `check-zones`, `verify-film2` (so `films.mjs`, `generate-sfx.mjs`, `bed.mjs`, `sounds.mjs`, `hash.mjs` are in); `scripts/audio/{dsp,mix,loudness}.mjs`; the evaluated timeline; the content of `public/ig/voice/<id>.wav` for the reel's own ids; **`public/ig/sfx/lib.json`**; and the content of every cue file the reel plays | ig5 must not edit any of these files. It must not **add** a `.ts` to `src/ig/common/` or a `.mjs` to `scripts/ig/`, because the listing itself changes the hash. It must not rewrite `lib.json`, `public/ig/sfx/fx-impact-end.wav` or `public/ig/sfx/lib/*`, and it must never write an existing `public/ig/voice/ig[1-4]-*.wav`. |
| **`kbHash`** (film 2) | `src/kb/timing.ts`, `src/kb/voice.generated.ts`, `src/lib/cuesheet.ts`, `src/timing.ts`, `src/voice.generated.ts`, `scripts/kb/*.mjs`, `scripts/films.mjs`, `scripts/audio/{dsp,mix,loudness}.mjs`, `public/kb/voice`, both `lib.json` files, its cue files | ig5 touches none of these. |
| **Film 1 `buildHash`** (`scripts/audio/hash.mjs`) | `src/timing.ts`, `src/voice.generated.ts`, `scripts/generate-sfx.mjs`, **every entry of `scripts/audio/`**, the `public/voice` mtimes | ig5 touches none of these. ig5 must never add a file to `scripts/audio/`. |
| **verify-film1 gate 1** (frozen set) | `src/{index,Root,Trailer,Soundtrack,timing,theme,voice.generated,css.d}.ts(x)`, `src/components`, `src/scenes`, `src/dev`, nine `src/lib/*.ts`, `scripts/generate-sfx.mjs`, `scripts/audio`, `scripts/voice-lines.json`, `public/{voice,img,sfx}`, **`tsconfig.json`, `package-lock.json`** | ig5 touches none of these. `package.json` is not frozen, but `package-lock.json` is, so **never run `npm install`**. |
| **verify-film1 gate 8** (film 1 bundle) | `index.html` minus `isFilm2Static` entries (`kb/…`, `ig/…`) | Any `public/ig/**` file is fine. A new `public/ig5/` would **fail**. |
| **verify-film2 step 6** (film 2 bundle) | `bundleDigest(drop: isSoundStatic)`, where `isSoundStatic` = `^((kb\|ig)/)?(sfx\|voice)/` | Every ig5 public file **must** be under `public/ig/sfx/…` or `public/ig/voice/…`. For example, `public/ig/ig5/voice/x.wav` is listed under the name `ig/ig5/…`. That entry is not dropped, so film 2's digest changes and step 6 fails. |
| **verify-film2 step 1** | `git diff 743247a -- src/kb src/lib/cuesheet.ts scripts/kb scripts/films.mjs scripts/voice-lines-kb.json public/kb/voice` | ig5 touches none of these. |

**Baseline read in this run (read-only):** `igHash(T)` was computed in Node and compared with each stamp. All four are CURRENT:

| Reel | igHash = stamp | Length | Impact |
|---|---|---|---|
| ig1 | `49b90ae44064d049` | 840 f (28 s) | 780 |
| ig2 | `757d177d35b27cd6` | 840 f (28 s) | 780 |
| ig3 | `47ae5cf315d3434b` | 780 f (26 s) | 720 |
| ig4 | `f4500c7a37b6d47e` | 840 f (28 s) | 780 |

---

## 2. The ig5 film

### 2.1 `scripts/ig5/films.mjs` (new): the same field set as `scripts/ig/films.mjs`

```js
export const IG5_FILMS = {
  ig5: {
    frozen: false,
    entry: 'src/ig/index.ts',                    // the shared IG entry (§3.2)
    timing: 'src/ig/ig5/timing.ts',
    voiceTs: 'src/ig/ig5/voice.generated.ts',    // ig5's OWN voice data (not the shared IG file)
    voiceLines: 'scripts/ig5/voice-lines-ig5.json',
    publicDir: 'public/ig',                      // master() reads <publicDir>/voice/<id>.wav
    voiceDir: 'public/ig/voice',                 // shared folder; ig5 writes only ig5-* ids (+ the borrow self-copy, §4.2)
    voiceSrc: 'voice-src/ig5',
    sfxDriver: 'scripts/ig5/generate-sfx.mjs',
    stamp: 'public/ig/sfx/ig5/mix.json',
    hash: ['scripts/ig5/hash.mjs', 'ig5Hash'],
    qa: 'out/audio/ig/ig5',
    comp: 'IG5-Reel-',
    bundle: 'out/master/bundle-ig5',             // its own bundle: out/master/bundle-ig (ig1–ig4) is never rebuilt
    outDir: 'out/ig',
    outName: 'neurotechvoice-ig5-<slug>',         // slug from SCRIPT.md; MUST start with neurotechvoice-ig5-
    formats: ['9x16'],
    preview: 'out/ig/ig5-preview.wav',
    cmd: { voice: 'npm run voice:ig5', remaster: 'npm run voice:ig5 -- --remaster', sfx: 'npm run sfx:ig5' },
  },
};
```

**Guards in the same file:** throw unless `outName` starts with `neurotechvoice-ig5-` and `stamp`, `MIX.file` and `BED.file` sit in `public/ig/sfx/ig5/`. A copy-paste slip such as `outName` = ig4's would otherwise let `finish` overwrite a delivered file.

### 2.2 How the shared tools resolve `--film=ig5` once `scripts/registry.mjs` merges `IG5_FILMS`

| Tool | Imports from | ig5 works? | Notes |
|---|---|---|---|
| `scripts/generate-voice.mjs` | `registry.mjs` | yes | §4 |
| `scripts/check-mix.mjs` | `registry.mjs` | yes | reads `film.timing`, `film.voiceTs`, `film.hash`, `film.stamp`, `film.voiceLines`, `film.voiceDir`, `film.qa` |
| `scripts/check-render.mjs` | `registry.mjs` | yes | |
| `scripts/sfx.mjs` | `registry.mjs` | yes | spawns `film.sfxDriver` |
| `scripts/ig/render-par.mjs` | `registry.mjs` | yes | its only check is `film.id.startsWith('ig')`; it uses `film.entry`, `film.bundle`, `film.comp`, `film.outDir`, `film.outName`, `T.ORDER/SCENES/SUB` |
| `scripts/ig/finish.mjs` | `registry.mjs` | yes | its cover comp is `IG${id.slice(2)}-Cover-9x16` = `IG5-Cover-9x16` |
| `scripts/ig/check-zones.mjs` | **`./films.mjs`** (`IG_IDS`) | **no** | it throws "unknown reel" (§3.3) |
| `scripts/ig/check-delivery.mjs` | **`./films.mjs`** (`IG_IDS`) | **no** | it throws "unknown reel" (§3.3) |
| `scripts/ig/generate-sfx.mjs` | `./films.mjs` | ig5 is **invisible** to it, as intended | `npm run sfx:ig` keeps building and skipping only ig1–ig4 |

---

## 3. Files

### 3.1 New files (in no existing hash; the new hash `ig5Hash` covers the sound-shaping ones)

```
scripts/ig5/
  films.mjs               IG5_FILMS (§2.1)
  voice-lines-ig5.json    Tessa only; ids ig5-NN; + {"id":"ig1-07","borrow":"ig1"}; the same `level` and `voices.ava` block
                          as scripts/voice-lines-ig.json (−23 LUFS lines, Tessa (Emotive) 6ccbfb76-…, speed 1.05,
                          env CARTESIA_IG_AVA_VOICE)
  hash.mjs                ig5Hash(T, root) (§5.2): wraps igHash by import
  generate-sfx.mjs        the ig5 sound driver (§5.1): a copy-adapt of scripts/ig/generate-sfx.mjs (which runs on import,
                          so it cannot be imported)
  bed.mjs                 ONLY IF the stub arrangement is not enough (§5.3): instruments copied from scripts/ig/bed.mjs
  sounds.mjs              ONLY IF ig5 needs a synthesised extra → public/ig/sfx/ig5/fx-*.wav
  guard.mjs               QA: --capture / --check of everything ig5 must not move (§7.1); writes only out/ig5-guard/
src/ig/
  voices.ts               the merged voice VIEW for the shared React parts (§3.3): NOT in common/ (that folder is hashed)
  ig5/
    voice.generated.ts    GENERATED by generate-voice --film=ig5
    timing.ts             the §6.1 contract of docs/ig/PIPELINE.md, REEL = 'ig5', VOICE from ./voice.generated.ts
    Reel5.tsx Cover.tsx acts/*.tsx  + the reel's own parts (e.g. the comparison rows, the $49 card)
voice-candidates/ig5/take-<a…>/   Cartesia candidate sets (tracked, like voice-candidates/ig/)
public/ig/voice/ig5-*.wav         installed takes (tracked; public/ig/voice/ is not gitignored)
public/ig/sfx/ig5/                mix.wav, mix.json (stamp), bed.wav, bed.json, lib/ + lib.json (only for sounds not
                                  already in the shared library), fx-*.wav (only if sounds.mjs exists); gitignored
out/audio/ig/ig5/                 stems + cue-timeline.txt;  out/audio/ig/.tmp-ig5/ staging (removed after each build)
out/master/bundle-ig5/ · out/master/IG5-Reel-9x16-x1/ · out/ig/master/<outName>-1080p120-hevc.mp4
out/ig/deliver/<outName>-{1080p120.mp4, 1080p60-ig.mp4, cover.png} · out/ig/qa/ig5/
```

### 3.2 Existing files that must change, with proof that each is in no hash

The ideal set (`scripts/registry.mjs`, `src/ig/Root.tsx`, `package.json`) is **not enough**, for two reasons found in the code:
- **Voice data.** Five shared React parts statically import the IG voice set: `import { VOICE } from '../voice.generated'` in `components/Captions.tsx:45`, `End.tsx:48`, `Orb.tsx:37`, `Call.tsx:33` and `screens.ts:12`. So they cannot see an ig5 line: Captions throws "not on ig5's timeline", and the end card's AGENT word cannot be found.
- **Reel lists.** Two QA tools take their reel list from `scripts/ig/films.mjs` instead of the merged registry.

The minimal route is one small edit per file:

| # | File | Change | igHash | kbHash | film 1 hash | film 1 frozen set | verify-film2 sources | Other gate |
|---|---|---|---|---|---|---|---|---|
| 1 | `scripts/registry.mjs` | `import { IG5_FILMS } from './ig5/films.mjs'`; the duplicate-id check over all three registries; `FILMS = { ...BASE, ...IG_FILMS, ...IG5_FILMS }`; an `outName`-unique assertion | no (only `scripts/ig/*.mjs`) | no (only `scripts/films.mjs` + `scripts/kb/`) | no | no | no | `main` and `kb` resolve to the same objects (verify-film1 gates 5, 6, 11; verify-film2 step 4) |
| 2 | `package.json` | add scripts only (§6.4); no dependency change | no | no | no | no (`package-lock.json` is) | no | verify-film1 gate 10 reads only `scripts['check:port']` |
| 3 | `src/ig/Root.tsx` | 3 imports (`T5`, `Reel5`, `Cover5`) + `{ n: 5, T: T5, Reel: Reel5, Cover: Cover5 }` in `REELS` | no (only `src/ig/<reel>/timing.ts`, `src/ig/common/*.ts`, `src/ig/voice.generated.ts`) | no | no | no (film 1's `Root` is `src/Root.tsx`) | no | typecheck (gate 10); the `remotion compositions src/ig/index.ts` rows for ig1–ig4 are unchanged (§7) |
| 4–8 | `src/ig/components/{Captions,End,Orb,Call}.tsx`, `src/ig/components/screens.ts` | one line each: `from '../voice.generated'` → `from '../voices'` | no (`components/` is not `common/`) | no | no | no | no | §7 gate P: ig1–ig4 stills byte-identical |
| 9–10 | `scripts/ig/check-zones.mjs`, `scripts/ig/check-delivery.mjs` | the `IG_FILMS, IG_IDS` import comes from `../registry.mjs`, filtered to `/^ig\d+$/` | **no: both are in `QA_ONLY`** (`scripts/ig/hash.mjs:26`) | no | no | no | no | — |

**`src/ig/voices.ts` (new):**

```ts
import { VOICE as IG } from './voice.generated';
import { VOICE as IG5 } from './ig5/voice.generated';
/** the shared parts' voice lookup: ig1–ig4's own entries WIN (spread last), so their lookups return the very same objects */
export const VOICE = { ...IG, lines: { ...IG5.lines, ...IG.lines } };
```

ig1–ig4 resolve every id to the identical entry, and `VOICE.fps` is unchanged, so their picture is unchanged. Gate P proves it.

**Edit-free fallback.** If the orchestrator wants no shared file touched beyond 1–3:
- fork the four voice-bound parts (Captions + screens + End + Orb, ≈ 1,300 lines) into `src/ig/ig5/kit/`, each fork header naming its source and commit;
- fork the two QA tools (≈ 280 lines) into `scripts/ig5/`;
- optionally give ig5 its own entry (`src/ig/ig5/index.ts`), so `Root.tsx` is untouched too.

The fallback has the same hash proof, but it costs fork drift and roughly 1,600 duplicated lines. **Recommended: the edits above.**

### 3.3 Untouched, and checked as untouched (§7)
- `scripts/films.mjs`, `scripts/ig/{films,generate-sfx,bed,sounds,hash,render-par,finish,verify-film2}.mjs`, `scripts/voice-lines-ig.json`
- `src/ig/voice.generated.ts`, `src/ig/common/*`, `src/ig/ig1…ig4/**`, `src/ig/{Reel,scene,types,Soundtrack,index}.ts(x)`
- `public/ig/voice/ig[1-4]-*.wav` (33 files), `public/ig/sfx/{lib/ (66 files), lib.json, fx-impact-end.wav, ig1…ig4/}`
- `out/ig/deliver/**` (12 files + `profile/`), `out/ig/master/*.mp4`, `out/master/{bundle-ig, IG1…IG4-Reel-9x16-x1}`
- everything of film 1 and film 2, `remotion.config.ts`, `tsconfig.json`, `package-lock.json`, `.gitignore` (no change is needed: `public/ig/sfx/` is already ignored, and `public/ig/voice/` and `voice-candidates/` are tracked)

---

## 4. Voices

### 4.1 How `generate-voice --film=ig5` picks its paths

Read from `scripts/generate-voice.mjs`:
- `FILM = filmOf(argv, { required: true })` (`:103`) over the merged registry.
- `OUT = abs(FILM, 'voiceDir')`, `TS_OUT = abs(FILM, 'voiceTs')`, `LINES_JSON = abs(FILM, 'voiceLines')` (`:108–110`).
- Each line's `file` is `voiceFile(FILM, id)` = `ig/voice/<id>.wav`.

So `--film=ig5` reads only `scripts/ig5/voice-lines-ig5.json` and writes only `public/ig/voice/<its ids>.wav` and `src/ig/ig5/voice.generated.ts`. What each mode writes:

| Mode | Writes | Touches another reel's file? |
|---|---|---|
| default run (`--engine=kokoro\|cartesia`) | every line of ig5's file as `public/ig/voice/<id>.wav`; the whole of `src/ig/ig5/voice.generated.ts` | no, provided the ids are `ig5-*`. The borrow copies `public/ig/voice/ig1-07.wav` onto itself (§4.2). |
| `--out=voice-candidates/ig5/take-x` | only that folder; the `--out` guard (`:717–760`) refuses any live folder of any film | no |
| `--install=DIR [--only=…]` | the chosen WAVs into `public/ig/voice/`; merges entries into ig5's TS; the borrow is a self-copy (`:843–845`) | no |
| `--remaster` | re-levels only ig5's listed, non-borrow lines; borrows are "left as copied" (`:869–872`) | no |
| `--preview` | `out/ig/ig5-preview.wav` | no |

No mode deletes files: the script's `rmSync` calls touch only its temporary request folders.

**THE ONE HAZARD: an ig5 line id that names an ig1–ig4 line.** Suppose a line id `ig1-07` lost its `"borrow"`, or someone copied a line such as `ig4-09` in. Synthesis would then overwrite that delivered take. The hash of every reel that places it would break, and with `ig1-07` that is **all four**. Two rules guard against this:
- every id matches `^ig5-` except the single `{"id": "ig1-07", "borrow": "ig1"}`;
- `scripts/ig5/guard.mjs --check` runs before and after every voice command (§7.1).

### 4.2 The borrowed sign-off
`BRAND = 'ig1-07'` is fixed in `src/ig/common/series.ts:26`, and `End.tsx` reads its envelope for the URL typing. So ig5 places `ig1-07`. Its entry must also be in ig5's voice TS, because check-mix reads `VOICE.lines[id].voice` for every placed line.

With the shared `voiceDir`, the borrow's `copyFileSync(src, dst)` has `src === dst`. This was **tested on this machine's Node v22.22.2**: the copy onto the same path is a no-op, and the sha256, size and mtime were all unchanged. libuv detects the same inode before it would truncate. The guard re-checks the sha anyway.

### 4.3 Steps
1. **Placeholder, offline, for timing only.** `node scripts/generate-voice.mjs --film=ig5 --engine=kokoro`. This makes `src/ig/ig5/voice.generated.ts` exist, so ig5's timeline and tsc can run. Do it **before** the `Root.tsx` edit, or the typecheck fails.
2. **Cartesia candidates.** Run `node scripts/generate-voice.mjs --film=ig5 --engine=cartesia --out=voice-candidates/ig5/take-a` (then b, c, …).
   - Use the same model and API version as ig1–ig4 (`sonic-3.6-2026-08-27`, `2026-08-14`).
   - Vary `emotion` on the hook and the CTA.
   - `CARTESIA_API_KEY` is already in the environment: never echo it.
3. **Pick by measurement, then by ear,** with the `voice-candidates/ig/PICKS.md` method:
   - duration against the SCRIPT budgets;
   - hook ≤ 3.1 s;
   - **"forty-nine dollars" clear** (word SII ≥ 0.7; the DISPLAY map shows `$49` over it);
   - no `<break/>` doubling (ig1–ig4 lesson: Sonic already pauses about 0.5 s at a sentence end).
4. **Install.** `node scripts/generate-voice.mjs --film=ig5 --install=voice-candidates/ig5/take-x --only=<ids>`, one call per source take.
5. **Re-anchor** `src/ig/ig5/timing.ts` to the measured takes (`place` / `upBeat` / `upQuarter` / `upBar`, as in ig4).

---

## 5. Sound

### 5.1 `scripts/ig5/generate-sfx.mjs` (copy-adapt of the IG driver)
**Imported unchanged:**
- `master` (`../audio/mix.mjs`);
- the dsp helpers (`../audio/dsp.mjs`);
- `bed` and `inputs` (`../ig/bed.mjs`), unless §5.3 applies;
- `igHash` through `ig5Hash`.

**Copied:** the `contract()` check and the step order of `scripts/ig/generate-sfx.mjs`. That file runs on import and would build ig1–ig4, so it cannot be imported. The copy changes the following:
1. **The reel.** Only `ig5`. It reads `IG5_FILMS`, and `VOICE` from `src/ig/ig5/voice.generated.ts`.
2. **The contract.** The same contract (20–28 s; impact one bar before the end; the brand in VOICES; files in `ig/sfx/ig5/`), plus three checks:
   - each cue file is either in the shared library `ig/sfx/lib/` (READ-ONLY, and its sha must match the shared `lib.json`), or is the shared `ig/sfx/fx-impact-end.wav` (READ-ONLY, must exist), or is under `ig/sfx/ig5/`;
   - every VOICES id is `ig5-*` or `ig1-07`;
   - every voice WAV exists.
3. **The library.** A sound ig5 needs that is not among the 66 shared copies is byte-copied, read-only on its source, into `public/ig/sfx/ig5/lib/`. It is recorded in `public/ig/sfx/ig5/lib.json`. To route it there, ig5's timing gives those families `dir: 'ig/sfx/ig5/lib'` in its own `SFX5 = { ...SFX, … }`; `series.ts` stays untouched. **The driver never writes the shared `lib.json` or `lib/`.**
   - The likely ig5 sounds are already shared: `fx-scratch`/`fx-felttip` for a strike-through, `fx-pluck-*`/`fx-mallet-*` for landings, `fx-tag`, `fx-ting`, `tap`, `draw`, `fx-paper-*`, `riser`, plus the end card's stack.
4. **Extras.** `fx-impact-end` is used through `impactHits`, as is, and is never re-published; the IG driver re-makes it on every ig1–ig4 rebuild, and ig5 must not race it. A new extra goes only to `public/ig/sfx/ig5/fx-*.wav`, from `scripts/ig5/sounds.mjs`.
5. **Skip, bed, master, stamp: as the IG driver does.** Publish only into `public/ig/sfx/ig5/`. Stage in `out/audio/ig/.tmp-ig5/`, never the shared `.tmp`, which the IG driver deletes. Write the stems to `out/audio/ig/ig5/`. The stale-file sweep is limited to the top level of `public/ig/sfx/ig5/`, and `lib.json` and `lib/` are in its keep-list.

### 5.2 `scripts/ig5/hash.mjs`

```js
import { igHash } from '../ig/hash.mjs';   // its REEL check /^ig\d$/ accepts 'ig5'
export function ig5Hash(T, root) {
  // sha256 over: 'ig5:' + igHash(T, root)   (timing, common/, the series' film-1 constants, scripts/ig/*.mjs sound code
  //   — incl. bed.mjs when its stub is used — audio/{dsp,mix,loudness}, the evaluated timeline, the CONTENT of every
  //   public/ig/voice/<id>.wav ig5 places, the shared lib.json, every cue file's content)
  // + bytes of src/ig/ig5/voice.generated.ts, scripts/ig5/*.mjs (but guard.mjs), public/ig/sfx/ig5/lib.json (if any)
}
```

The hash reads but never writes. ig5 restales correctly whenever the shared IG sound code changes. Nothing ig5 owns is read by `igHash` for ig1–ig4: their file list is fixed by their own `REEL`, `common/`, the shared voice TS and `scripts/ig/*.mjs`.

### 5.3 Bed
`scripts/ig/bed.mjs` `bed(T)` has no `ARRANGEMENTS.ig5`, so it plays the **stub**: felt-piano 8ths and a shaker through E – C#m7 – Amaj7 – B, with low strings and a sub. The stub is driven entirely by `MUSIC`:
- `bedFrom`;
- `stop: [from, to)`, which cuts the bed on the sample; a natural "the price drops" beat, as ig4's stop-time;
- `roll`, `impact`, `brand`;
- `build` gains.

Start with the stub. If the critic rounds want a distinct arrangement, write `scripts/ig5/bed.mjs`. Its instruments must be **copied**: `pianoNote`, `kitAt`, `stringSection` and the rest are not exported, and `scripts/ig/bed.mjs` must not be edited, because it is hashed. Both options are cached on `inputs(T)` plus the code bytes.

### 5.4 check-mix targets (`check-mix --film=ig5`, PASS required)
- **Loudness:** integrated −14 ± 1 LUFS; ≤ −1.0 dBTP.
- **Dialogue:** every line at −18.5 ± 0.5 LUFS; word SII ≥ 0.7; the name (`ig1-07`) SII ≥ 0.9.
- **Climax and arc:** the impact tops the loudest dialogue by ≥ 1 LU; `MIX.arc.windows` set to ig5's music-forward passage.
- **Tail and files:** the tail < −60 dBFS on the last frame; the bed ≤ −20 dBFS peak; effects ≤ −12 dBFS peak; the stamp current.

These are the same `IG_LOUD`, `IG_NAME`, `igImpact` and `igArc` from `series.ts`.

---

## 6. Picture, render, finish, QA

### 6.1 Reel code
`src/ig/ig5/timing.ts` follows ig4's shape:
- `REEL`, `TITLE`, `PLAN`, `VOICES`, `SCENES`, `ORDER`, `SCREENS`, `DISPLAY`, `END_CARD`, `HITS`, `CUES`, `MUSIC`, `BED`, `MIX`, `GRAIN`, `roomAt`, `ZONE_FRAMES`;
- the brand is `BRAND` from `series.ts`.

`DISPLAY` maps the spoken "forty-nine dollars" to `$49`. The comparison figures appear as numerals over the words she speaks, and every on-screen string is spoken.

`Reel5` is `<IgReel T={T} acts={ACTS5} />`. The end act uses the shared `IgEnd`, so the comment field types AGENT, then the wordmark and the URL come in.

New parts are made from the kit (`src/kb/kit`): `Panel`, `Pill`, `DocRow`, `measureText`, `typo`. Examples are the category rows and the $49 card. Each part reports its rects to `ZoneRect`, keeping text inside x 60–950 and y 220–1520 and off the right rail.

### 6.2 Commands (in this order; run every Remotion command with `NTV_SKIP_SFX=1`)

```
npm run sfx:ig5                                   # ig5's mix (the IG driver is not involved)
npm run check:audio:ig5                           # = check-mix --film=ig5
npm run studio:ig5                                # review (sfx:ig → must print "up to date — skipped" ×4, sfx:ig5, studio)
npm run check:zones:ig -- --film=ig5              # zone stills + cover; FAIL on any VIOLATION  (after edit #9)
npm run render:ig -- --film=ig5 --dry-run         # prints the act-aligned chunks (render frames, (from − pre) × 4)
npm run render:ig -- --film=ig5 [--rebundle]      # 2 workers, HEVC CRF 12, JPEG q100 → out/ig/master/<outName>-1080p120-hevc.mp4
npm run finish:ig -- --film=ig5                   # A 120 fps L5.1 ≤ 28 MB · B 60 fps L4.2 upload copy · C cover (+ 3:4 crop)
npm run check:delivery:ig -- --film=ig5           # both MP4s: size, codec/level, BT.709, AAC, −14 ± 0.5 LUFS, ≤ −1 dBTP,
                                                  # no elst, check-render lock at lag 0                (after edit #10)
```

**Render-par notes:**
- It builds `out/master/bundle-ig5` from `src/ig/index.ts`. It refuses a bundle older than any file under `src/` without `--rebundle`.
- On (re)bundle it runs `npm run sfx:ig` (ig1–ig4), **not** `sfx:ig5`. So run `sfx:ig5` first, and the guard must be green, so that `sfx:ig` is a pure skip (§7.2).
- Chunks go to `out/master/IG5-Reel-9x16-x1/` and are resumable. Re-render one act with `--ranges=a-b --dir=fix1`.

**Size budget** (`finish.mjs` `kbpsFor`: decimal 28 MB, 3 % margin, AAC 192 kb/s; maxrate 1.5×, bufsize 2×):

| Length | Video kb/s | maxrate / bufsize | Render frames |
|---|---|---|---|
| 24 s (720 f) | 8861 | 13292 / 17722 | 2880 |
| 26 s (780 f) | 8164 | 12246 / 16328 | 3120 |
| 28 s (840 f) | 7568 | 11352 / 15136 | 3360 |

ig1, ig2 and ig4 came out at 28 s and delivered 27.3 MB at this budget. The size loop retries at −3 % if a file reaches 28,000,000 B.

### 6.3 Review gates carried over from docs/ig/PIPELINE.md §9
- stills at every screen onset;
- a contact sheet every 6th frame;
- 2 s 120 fps strips of the fastest move;
- loop seam: last frame vs frame 0, and the mix's last frame < −60 dBFS;
- at least two critic rounds: house style, honesty against SCRIPT.md, zones, caption sync, loop seam;
- captions through `ig-caption/caption.py` and `ig-human/detect.py`.

### 6.4 `package.json` scripts to add (existing scripts unchanged)

| Script | Command |
|---|---|
| `voice:ig5` | `node scripts/generate-voice.mjs --film=ig5` |
| `sfx:ig5` / `sfx:ig5:force` | `node --experimental-strip-types --no-warnings scripts/ig5/generate-sfx.mjs [--force]` |
| `check:audio:ig5` | `node --experimental-strip-types --no-warnings scripts/check-mix.mjs --film=ig5` |
| `studio:ig5` | `npm run sfx:ig && npm run sfx:ig5 && NTV_SKIP_SFX=1 remotion studio src/ig/index.ts` |
| `guard:ig5` | `node --experimental-strip-types --no-warnings scripts/ig5/guard.mjs` (`--capture` / `--check`) |

`render:ig`, `finish:ig`, `check:zones:ig` and `check:delivery:ig` take `-- --film=ig5`. **Leave `check:audio:ig` as ig1–ig4.**

---

## 7. Hard gates and the order to run them

### 7.1 `scripts/ig5/guard.mjs`: ig5's invariance proof
This is QA only, and it writes only `out/ig5-guard/`.

**`--capture`** runs **before the first ig5 edit**. It records:
1. the sha256 of:
   - `out/ig/deliver/**` (12 files + `profile/`);
   - `out/ig/master/*.mp4`;
   - `public/ig/voice/ig[1-4]-*.wav`;
   - `public/ig/sfx/{lib/**, lib.json, fx-impact-end.wav, ig1…ig4/**}`;
   - `src/ig/voice.generated.ts`, `src/ig/common/*`, `src/ig/ig[1-4]/**`;
   - `scripts/voice-lines-ig.json`, `scripts/ig/*.mjs` (all of them);
2. the listings of `src/ig/common/` and of the top level of `scripts/ig/`;
3. `igHash(T) === stamp` for ig1–ig4;
4. the `npx remotion compositions src/ig/index.ts` table;
5. Preview stills of ig1–ig4 from a fresh `src/ig/index.ts` bundle: 6 per reel (f0, two caption onsets, the CTA field, the impact + 16, END − 1).

**`--check`** re-measures all of the above. It fails on any difference, except that the compositions table and the listings may gain IG5 rows or ig5 files only.

| Gate | Command | Pass |
|---|---|---|
| **(a) film 1** | `node scripts/kb/verify-film1.mjs --fast` after every infrastructure step and before every commit; the **full** `verify-film1` (all 11 gates; ≈ 5 min, the capture took 285 s) before delivery | PASS; `mix.wav` `ec037282…f31e35e`, hash `2efdbc5153019f3c` |
| **(a) film 2** | `npm run verify:film2 -- --fast` after infrastructure; the full `npm run verify:film2` before delivery | every step PASS: `kbHash` `db3a9efa91f928f2`, `bundleSha` `269c7b3c…55fd`, the four MP4s byte-identical |
| **(b) ig1–ig4 sound** | `npm run check:audio:ig` (`check-mix --film=ig1 … ig4`) **and** `npm run sfx:ig`, which must print `igN: up to date (<hash>) — skipped` ×4 and "0 built" | PASS ×4, with the hashes of §1 unchanged |
| **(b) ig1–ig4 picture (gate P)** | `guard --check` stills | byte-identical (`stillsMode` was `exact` for film 1, so this renderer is deterministic) |
| **(c) delivered** | `guard --check` shas of `out/ig/deliver/**` and `out/ig/master/*.mp4` | identical; the only new names are `neurotechvoice-ig5-*` |
| **Git** | `git diff --name-only HEAD` | ⊆ {`scripts/registry.mjs`, `package.json`, `src/ig/Root.tsx`, `src/ig/components/{Captions,End,Orb,Call}.tsx`, `src/ig/components/screens.ts`, `scripts/ig/check-zones.mjs`, `scripts/ig/check-delivery.mjs`} |
| **Git** | `git status --porcelain` | new paths only under `scripts/ig5/`, `src/ig/ig5/`, `src/ig/voices.ts`, `public/ig/voice/ig5-*`, `voice-candidates/ig5/`, `docs/ig/ig5/` |
| **ig5** | tsc; `check-mix --film=ig5`; `check-zones --film=ig5`; `check-delivery --film=ig5` (with `check-render`); the review gates of §6.3 | all PASS |

### 7.2 Order
1. **Baselines.**
   - `guard:ig5 -- --capture`
   - `verify-film1 --fast`
   - `verify:film2 -- --fast`
   - `check:audio:ig`

   All must be green before anything is written.
2. **Infrastructure:**
   - `scripts/ig5/{films,hash,generate-sfx,guard}.mjs` and `voice-lines-ig5.json`;
   - the `registry.mjs` merge;
   - `package.json` scripts;
   - Kokoro placeholder voices.

   **Gate:** guard `--check`, verify-film1 `--fast`, verify-film2 `--fast`.
3. **Picture plumbing:**
   - `src/ig/voices.ts` + the 5 one-line imports **first** → guard `--check`, which includes gate P, the proof that ig1–ig4 still render byte-identically;
   - then `src/ig/ig5/` with title-card placeholder acts on the real timeline, and the `Root.tsx` rows;
   - then edits 9–10.

   **Gate:** tsc + guard + `check:audio:ig`.
4. **Voices:** Cartesia → pick → install → re-anchor. Run guard `--check` after every install.
5. **Scenes, HITS and bed, then at least two critic rounds.** Run tsc + verify-film1 `--fast` + guard before each commit.
6. **Master:** `sfx:ig5` → guard (so that `sfx:ig` is a skip) → `render:ig --film=ig5` → `finish:ig --film=ig5` → `check:delivery:ig --film=ig5`.
7. **Before delivery:** the full verify-film1, the full verify-film2, guard `--check`, `check:audio:ig`, `check:audio:ig5`. Commit only with the orchestrator's go-ahead.

---

## 8. Expected wall-clock

The machine has 4 CPUs, shared with other agents. render-par uses at most 2 workers. The render and finish times below were measured from the ig1–ig4 chunk and delivery mtimes:
- **ig1:** `plan.json` 20:09 → join 20:21, 3360 frames in ≈ 12.3 min. That is ≈ 0.44 s per frame per worker.
- **ig2:** ≈ 12.3 min.
- **ig3:** 3120 frames, ≈ 14.1 min.
- **ig4:** ≈ 13.2 min.
- **Finish:** ig1's cover → 120 fps → 60 fps took 20:22 → 20:28; ig3's master → 60 fps took 20:50 → 20:59.

| Step | Time |
|---|---|
| Guard capture (bundle + 24 stills) | ≈ 5–8 min |
| `sfx:ig5` (bed + master) | ≈ 10–30 s; ≈ 0.2 s when skipped |
| `check-mix --film=ig5` | < 1 min |
| `check-zones --film=ig5` (bundle + ≈ 20–30 stills + cover) | ≈ 3–6 min |
| Bundle `bundle-ig5` | ≈ 1–2 min |
| `render:ig --film=ig5` (26–28 s = 3120–3360 frames) | **≈ 12–15 min** |
| `finish:ig --film=ig5` (two two-pass x264 slow encodes + cover) | **≈ 6–9 min** |
| `check-delivery --film=ig5` (2 files, AAC decode, check-render) | ≈ 2 min |
| verify-film1 full / verify-film2 full | ≈ 5 min each (estimate: verify-film2 adds a bundle and a 4K check-render) |
| **Master to QA'd delivery** | **≈ 35–50 min** |
| Building it (estimates, as ig4): voices (candidates + picks) ≈ 0.5–1 h; scenes + sound + two critic rounds ≈ 3–5 h | |

---

## 9. How ig1–ig4 were verified

From `docs/ig/PIPELINE.md` §9, the commits and the QA folders:
- **Foundation** (`1af00f6`): the isolated registry, verify-film1 `--fast` PASS, verify-film2 PASS (baseline `scripts/ig/film2-baseline/`, captured 2026-10-06 at `04cf0c3`).
- **Bit-budget probe** (`95ab7b4`): settled on static grain, JPEG q100, ≈ 7.6 Mb/s, before any scene work (`scripts/ig/qa/probe-encode.mjs`).
- **Per reel:**
  - `sfx:ig` + `check-mix --film=igN` PASS;
  - `check-zones` stills and 3:4 crops (`out/ig/qa/igN/zones/`, `cover-34.png`);
  - stills, contact sheets and 120 fps strips;
  - critic rounds 1–3 (`136a955`, `885bc7c`, `24c9cd5`);
  - `finish` → `check-delivery` (size < 28 MB, H.264 High L5.1 / L4.2, BT.709, AAC 48 kHz 192k, −14 ± 0.5 LUFS, ≤ −1 dBTP, no `elst`, check-render lock at lag 0).
- **Delivery** (`5127eef`): "full verify-film1 + verify-film2 PASS".
- **Captions:** linted READY (`caption.py`) and `detect.py` PASS 74–86 (POSTING.md).
- **Re-checked in this run (read-only):**
  - all four `igHash` values equal their stamps (§1);
  - delivered sizes are 26.83–27.72 MB.
- **sha256 prefixes** of the files gate (c) protects: ig1 `edfc55ce…` / `14202a61…` / cover `84cf96c0…`; ig2 `a51ba168…` / `edb7395e…` / `4e7194f8…`; ig3 `b45bbb22…` / `aa364a3b…` / `ac8b0f92…`; ig4 `a84e97ee…` / `1eb0b9f4…` / `cd1a3398…` (120 / 60 / cover).

---

## 10. Never, during ig5 work
- Edit, or add a file to, `scripts/ig/` (except edits 9–10, which are QA-only), `src/ig/common/`, `scripts/audio/`, `scripts/films.mjs`, `scripts/voice-lines-ig.json` or `src/ig/voice.generated.ts`. Adding a file there changes a hash listing.
- Give an ig5 line an ig1–ig4 id, other than the `ig1-07` borrow; drop `"borrow"` from it; or run `generate-voice --film=ig1…ig4` / `npm run voice:ig`. All of these write the shared IG set.
- Write `public/ig/sfx/lib.json`, `public/ig/sfx/lib/*` or `public/ig/sfx/fx-impact-end.wav`, or create anything in `public/` outside `public/ig/voice/ig5-*` and `public/ig/sfx/ig5/`. A `public/ig5/` would fail both film bundle gates.
- Run `npm run sfx:ig:force`, `render:ig` for ig1–ig4, or `finish:ig` for ig1–ig4. Delivered files are never re-encoded.
- Run `sfx:ig` or `studio:ig` while the guard is red. A stale ig1–ig4 stamp would make `sfx:ig` **rebuild** `public/ig/sfx/igN/mix.wav`, and the delivered MP4s would no longer lock to their mix.
- Run `npm install`, or touch `package-lock.json`, `tsconfig.json`, `remotion.config.ts` or `.gitignore`.
- Run two renders and a `verify-film1` at once, or any sound build while a film 1 or film 2 bundle is being made (H15).
- Print, echo or commit `CARTESIA_API_KEY`. Commit, push or deploy without the orchestrator's go-ahead.

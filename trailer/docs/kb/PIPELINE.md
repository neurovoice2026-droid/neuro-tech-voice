# Trailer #2 ("kb"): multi-film pipeline plan

I read the repo at HEAD `ea1e905` on branch `claude/remotion-trailer`, with a clean working tree. Nothing in the repo was changed except this file.
Film 2's working id is **`kb`**. It is a knowledge-base film: Ava (Tessa) explains it, and callers ask the same questions again and again.

---

## 0. The decisions

1. **Film 1 is frozen at the source level, not only at the output level.** No file that film 1's bundle imports changes. No file that film 1's sound build hashes changes. Film 2 only adds files. The only edits are `--film` flags in scripts that film 1's bundle does not import and its sound build does not hash.
2. **Film 2 gets its own Remotion entry point: `src/kb/index.ts`** (`registerRoot(KbRoot)`). `src/index.ts` and `src/Root.tsx` are **not touched**, so film 1's bundle compiles from exactly the same modules. An entry point passed on the command line overrides `Config.setEntryPoint`; I checked this in `@remotion/cli/dist/entry-point.js` ("1st priority: Explicitly passed entry point"). To open film 2 in the studio, run `npx remotion studio src/kb/index.ts`.
3. **Film 2 has its own namespace everywhere:** `src/kb/`, `scripts/kb/`, `public/kb/{voice,sfx}/`, `out/kb/`, `out/audio/kb/`, `voice-src/kb/` and `voice-candidates/kb/`. Its composition ids start with `KB-`.
4. **`scripts/generate-sfx.mjs` and every file in `scripts/audio/` stay byte-identical**, because they are inputs to film 1's mix hash.
   - Film 2 gets its own driver, `scripts/kb/generate-sfx.mjs`. It imports the shared engine unchanged: `master()` from `scripts/audio/mix.mjs`, plus `dsp.mjs` and `loudness.mjs`.
   - It reuses film 1's already-synthesised SFX library in `public/sfx/*.wav`, **read-only**.
   - A small dispatcher, `scripts/sfx.mjs --film=<id>`, gives the uniform flag.
5. **One registry, `scripts/films.mjs`, makes the other scripts film-aware:** `generate-voice`, `check-mix`, `check-render` and `render-master` each take `--film=<id>`.
   - With `--film=main` they behave exactly as they do today.
   - `generate-voice` **refuses to write film 1's live set** (film 1 is frozen). This protects film 1's voices from the Cartesia child session.
6. **The cue-sheet code film 2 needs is ported verbatim to a new, film-agnostic module, `src/lib/cuesheet.ts`.** That code is `buildCues`, `voiceCut`, `PHRASES`/`speaking` and the grid snaps.
   - `scripts/kb/check-port.mjs` proves the port rebuilds film 1's `CUES`, `SPEECH`, `PHRASES` and every `voiceCut` exactly.
   - Film 1 keeps its own copy and is not refactored.
7. **Recommended ending: borrow film 1's `Cta` scene component unchanged.** This gives the same NEUROVOICE end card, the same headline and the same two Tessa lines, with the WAVs byte-copied. The fallback, if the script changes the CTA line, is a film-2 `Cta` built from the parts that carry no timing (section 7).

---

## 1. What film 1's outputs depend on, and the hazards I found

**Film 1's sound** is built by `scripts/generate-sfx.mjs`. It skips the build when `public/sfx/mix.json` `.hash` equals `buildHash(T)` from `scripts/audio/hash.mjs`. That hash is a sha256 over:
- `src/timing.ts` and `src/voice.generated.ts`
- `scripts/generate-sfx.mjs`
- **every entry that `readdirSync(scripts/audio)` returns**
- the evaluated `{CUES, VOICES, SCENES, DURATION}`
- `size:mtime` of every `public/voice/<id>.wav`

**Film 1's reference values today:**

| Item | Value |
|---|---|
| mix hash | `2efdbc5153019f3c` |
| `mix.wav` | sha256 `ec03728237edab6417e6ab418ee7c2b1ce04215acc6431cd5e240d8aad31f35e`, 22 176 044 B, 2310 frames, 3 696 000 samples |
| `voice.generated.ts` | sha256 `58ec3de28d754b553d2f1a371dcd8e6187a5a44ab1556b7520fbea8b9d49d1fc` |
| digest of the 15 `public/voice/*.wav` | `7aa45d548196b954` |
| digest of the 96 `public/sfx/*.wav` | `5b4ff1fb236a5b4a` |
| `lib.json` key | `2c08b04f761ef9a0` |
| `bed.json` key | `ffe9ac17f5271cde` |
| counts | 313 cues from 243 hits, 15 lines |

**Film 1's picture** comes from the import graph of `src/index.ts`, which is `Root`, `Trailer`, the scenes, components, lib, `theme`, `timing` and `voice.generated`. It also depends on the public assets and on the encode settings in `remotion.config.ts`.

| # | Hazard (from reading the code) | Consequence for the plan |
|---|---|---|
| H1 | `buildHash` hashes **every entry of `scripts/audio/`** with `readFileSync`. | A new file there changes film 1's hash and forces a re-mix. A new **subfolder crashes film 1's sound step** with `EISDIR`. All film 2 audio code goes in **`scripts/kb/`**, never in `scripts/audio/`. |
| H2 | Film 1's hash includes the **mtime** of `public/voice/*.wav`. | Never touch, re-encode or re-level those files. A touch forces a re-mix. The re-mix is deterministic, but it rewrites `mix.wav` for no reason. |
| H3 | `generate-sfx.mjs` **deletes every top-level `*.wav` / `*.tmp-*` in `public/sfx/` that it did not write.** | Film 2 never writes into `public/sfx/` at the top level. Its outputs live in `public/kb/sfx/`. |
| H4 | `mix.mjs` reads voices from `path.join(publicDir, 'voice', id + '.wav')`. | Film 2's voices go in **`public/kb/voice/`**, and the driver passes `publicDir = public/kb`. The suggested `public/voice/kb/` would need an edit to `mix.mjs`, which is hashed. |
| H5 | Film 1's `check-mix` reads `out/audio/stem-*.wav` (intelligibility, per-line loudness) and writes `out/audio/cue-timeline.txt`. | Film 2's stems and timeline go to **`out/audio/kb/`**. If they went to `out/audio/`, film 1's QA would read film 2's stems. |
| H6 | `generate-voice` has no film concept. With no flags it **overwrites `public/voice/*.wav` and `src/voice.generated.ts`**, and `--remaster` rewrites every film 1 WAV. | `--film` becomes required. Film 1 is marked `frozen`, so writing its live set needs an explicit `--unfreeze`. Candidate sets (`--out=`) stay allowed. |
| H7 | `render-master` runs `rmSync(out/master/bundle)` on every run and derives the output name with `comp.slice(8)`. | Each film gets its own bundle folder and output name, so two films can render at the same time. Film 1's paths stay as they are. |
| H8 | Some names already exist in film 1. It has the voice ids `kb-1` and `kb-2`, the compositions `Knowledge-16x9` / `Knowledge-9x16`, and `voice-src/<id>.*` is a shared namespace. | Film 2's composition ids start with `KB-`. Its voices, sources and candidates live in their own folders, so its line ids cannot collide with film 1's files. |
| H9 | Some shared modules are tied to film 1 when the module loads. `components/Captions.tsx` uses `VOICE`/`vWord`, `lib/scene.useSceneFrame` uses `SCENES`, and `scenes/cta/orbit.ts` uses `CTA` and `VOICE`. | **Fork these into `src/kb/`. Do not edit them** (section 8). |
| H10 | Film 2's timing graph is imported by Node with `--experimental-strip-types` (sound driver, `check-mix`, `render-master`). | Every import in that graph needs an explicit `.ts` extension. Type-only imports must be marked `type`. No enums, namespaces or parameter properties. No React or Remotion imports. Film 1's `timing.ts` already follows these rules. |
| H11 | `mix.mjs` assumes things that it does not check. | `MIX.name.voice` must be one of the ids in `VOICES`, or the mix crashes. `MIX.impact` must exist. `cue.room` must be `'night'` or `'white'` (the only `ROOMS`). `VOICES` must be sorted by `at`, because each line's span ends at the next line's `at`. |
| H12 | Some shared modules read film 1's constants: `lib/motion.ts`, `components/Orb.tsx` and `lib/scene.useSub` read `FPS`; `lib/lights.ts` uses film 1's `BEAT` as a default easing. | Film 2 **must keep the 30 fps timeline unit** with a 120 fps render (re-export both from film 1). **120 BPM is strongly recommended**: the borrowed CTA is cut on the 120 BPM grid, the four light notes are E major, and the mixer's ping-pong delay follows `T.BPM`. |
| H13 | `check-mix`'s ARC check is written for film 1: it compares against `SCENES.scale` and `SCALE.langTitle/flow/irisToDark`. | Add `MIX.arc.windows`, and keep film 1's current expression as the fallback. |
| H14 | `public/` is copied into every bundle. Global CSS or font-face changes in a bundle affect every composition in it. | With a separate entry point, film 2's code never enters film 1's bundle. Do **not** add npm dependencies, and do not change `package-lock.json` or `node_modules`, because a dependency bump could change film 1's frames. |

---

## 2. Layout

```
trailer/
  src/index.ts, src/Root.tsx, src/Trailer.tsx, src/timing.ts, ...    film 1: UNCHANGED
  src/lib/cuesheet.ts          NEW film-agnostic cue/voice machinery (port of timing.ts §voices…buildCues)
  src/kb/
    index.ts                   registerRoot(KbRoot)              (film 2's entry point)
    Root.tsx                   the KB-* compositions
    Film.tsx                   the film: scenes on SCENES, grain, Soundtrack (+ borrowed film-1 Cta)
    Soundtrack.tsx             <Html5Audio src={staticFile(MIX.file)} />  (MIX = film 2's)
    timing.ts                  film 2's whole timeline + cue sheet (the contract, section 4)
    voice.generated.ts         GENERATED by generate-voice --film=kb (same shape as film 1's)
    scene.ts                   useKbSceneFrame(key) / kbSceneLength(key); re-exports useSub / useTimelineFrame
    theme.ts                   (only if needed) film-2 speaker inks: { ...VOICE_INK, <role>: VOICE_INK.caller }
    components/Captions.tsx    fork of src/components/Captions.tsx bound to film 2's VOICE / vWord
    scenes/*.tsx, scenes/<scene>/*   film 2's scenes
  scripts/
    films.mjs                  NEW registry (paths per film, frozen flag)
    sfx.mjs                    NEW dispatcher: --film=<id> [--force] → spawns that film's driver
    voice-lines-kb.json        NEW film 2's lines (same schema as voice-lines.json)
    kb/generate-sfx.mjs        NEW film 2's sound driver (library reuse, extras, bed, master)
    kb/bed.mjs                 NEW film 2's music bed
    kb/sounds.mjs              NEW (only if needed) film-2-only effects → public/kb/sfx/fx-*.wav
    kb/hash.mjs                NEW film 2's build hash (driver + check-mix)
    kb/check-port.mjs          NEW proves src/lib/cuesheet.ts === film 1's cue sheet
    kb/verify-film1.mjs        NEW the film-1 invariance check (section 11)
    generate-sfx.mjs, audio/*  film 1 sound: UNCHANGED (hashed)
  public/kb/voice/*.wav        film 2's voices (TRACKED, like public/voice)
  public/kb/sfx/               film 2's mix.wav, mix.json, bed.wav, bed.json, lib.json, fx-*.wav (GITIGNORED)
  voice-src/kb/                film 2's "files" engine sources (optional)
  voice-candidates/kb/<take>/  Cartesia candidate sets from the child session (TRACKED, like film 1's)
  out/kb/                      film 2's renders, stills, previews (out/ is ignored)
  out/audio/kb/                film 2's stems + cue-timeline.txt
  out/master/KB-Trailer-*-x2/  film 2's resumable 4K chunks; out/master/bundle-kb/ its bundle
```

---

## 3. Compositions (`src/kb/Root.tsx`, entry point `src/kb/index.ts`)

| id | component | fps | size | durationInFrames | use |
|---|---|---|---|---|---|
| `KB-Trailer-16x9` | `KbFilm` | 120 (`RENDER_FPS`) | 1920×1080 (3840×2160 at `--scale=2`) | `DURATION * SUB` | masters |
| `KB-Trailer-9x16` | `KbFilm` | 120 | 1080×1920 (2160×3840 at `--scale=2`) | `DURATION * SUB` | masters |
| `KB-Preview-16x9` | `KbFilm` | 30 (`FPS`) | 1920×1080 | `DURATION` | `--frame=N` is timeline frame N |
| `KB-Preview-9x16` | `KbFilm` | 30 | 1080×1920 | `DURATION` | previews / stills |
| folder `KB-Scenes`: `KB-<Scene>-16x9` / `-9x16` | `KbFilm` with `{only: key, audio: false}` | 30 | as above | `DURATION` | one scene at a time, global frame numbers |

These ids are valid. Remotion 4.0.530 accepts `^[a-zA-Z0-9-一-鿿]+$` for both composition ids and folder names.

`KbFilm` mirrors `Trailer.tsx`:
- It calls `useState(() => waitForFonts())`.
- It places each scene in a `<Sequence from={(s.from - s.pre) * sub} durationInFrames={(s.to + s.post - s.from + s.pre) * sub}>`.
- It renders `<FilmGrain white={…film 2's paper acts…}/>` from `components/Grain`.
- It renders `<Soundtrack/>` when `audio && !only`.

`DURATION` comes from the voice lengths, the same way film 1's does.

---

## 4. Film 2's timing contract (`src/kb/timing.ts`)

**Import rules:** `import { VOICE, type VoiceId } from './voice.generated.ts'`, `import { … } from '../timing.ts'` (film 1, read-only) and `import { … } from '../lib/cuesheet.ts'`. Section H10 applies throughout.

**Re-export from film 1 (do not redefine):** `FPS`, `RENDER_FPS`, `SUB`, `BPM`, `BEAT`, `b`, `LANDSCAPE`, `VERTICAL`, `PK`, `LIGHT_NOTES`, `LIGHT_SEMI`, `CUT`, `DUCK`. Re-exporting `DUCK`, plus the `MIX` loudness numbers below, keeps the two films at the same loudness and with the same dialogue-forward balance.

| Export | Shape | Read by |
|---|---|---|
| `FPS` (30), `RENDER_FPS` (120), `SUB` (4) | numbers | Root, `scene.ts`, check-render, render-master, `master()` (`T.FPS`) |
| `BPM`, `BEAT` | numbers | `master()` (ping-pong delay = 60/BPM × 0.75), `kb/bed.mjs` |
| `LANDSCAPE`, `VERTICAL` | `{width,height}` | Root |
| `DURATION` | 30 fps frames | everything (`master()` length, check-mix, check-render, render-master) |
| `SCENES` + `type KbSceneKey` | `Record<key,{from,to,pre,post}>` | Film, `scene.ts`, hash, check-mix (cue timeline by scene) |
| `VOICES` | `{at, id, until?}[]`, **sorted by `at`** | `master()`, check-mix, hash |
| `vFrames(id)`, `vWord(id,k)` | fns over film 2's `VOICE` | `master()` (`vFrames`), check-mix, scenes |
| `voiceCut(v)` | `null` or `[from,to]` (it must exist even with no cascades) | `master()`, check-mix |
| `VOICE_RIDES` | optional `Partial<Record<VoiceId, VoiceRide[]>>` | `master()` (`?.`) |
| `SPEECH`, `PHRASES`, `speaking` | as in film 1 (from `cuesheet.makeSpeech`) | `master()` (`SPEECH`), check-mix, cue builder |
| `DUCK` | film 1's object: bedDb, bedLowDb, lowHz, eqDb, sfxEqDb, tailsDb, tonalDb, keyTonalDb, lookahead, ramp, release | `master()` |
| `SFX` + `type Snd` | `{ ...SFX1, ...extras }`; each extra has a `dir: 'kb/sfx'` | `cuesheet.buildCues` (file names), driver |
| `HITS` | `Hit[]` (film 1's `Hit` type, `snd: Snd`) | `buildCues`, QA |
| `CUES` | `Cue[]` = `buildCues(HITS, {sfx: SFX, speaking, roomAt})`. Every `file` is relative to `public/` (`sfx/…` = film 1's library, `kb/sfx/…` = extras). `room` is `'night'` or `'white'`. | `master()`, check-mix, driver, hash |
| `BED` | `{file: 'kb/sfx/bed.wav', vol, ride: [frame, dB][]}` | `master()` (`vol`, `ride`), check-mix (`file`) |
| `MIX` | see the list below | `master()`, check-mix, Soundtrack, check-render, render-master |
| bed inputs | whatever `scripts/kb/bed.mjs` reads (scene-local moments) | `kb/bed.mjs`, the bed cache key |

`MIX` fields:
- `file: 'kb/sfx/mix.wav'`
- `lufs: -15.5`, `ceiling: -1.5`, `dialogueLufs: -20`, `dialogueTol: 0.5`, `dialogueCeil: -2.5`, `airLp: 18000`, `cutRoom` (all copied from film 1)
- `fadeOut: [a, DURATION]`, `fadeK: 2`
- `impact: {at, rideDb, hold, release, ceil, knee, lead, suck}`
- `name: {voice, lookahead, release, tonalDb, tailsDb, sii}`. `name.voice` must be in `VOICES`.
- `arc: {lead, ringDb, windows: [a,e][]}`. `windows` is new: it lists film 2's music-forward passages, which the converge into the logo must top.

**`src/lib/cuesheet.ts` (new, film-agnostic, Node-safe).** It is a verbatim port of `timing.ts` lines ≈1539–1772, plus the grid helpers at lines 47–50:
- `type Cue`, `type Voiced`, `type VoiceRide`
- `makeVoiceKit(VOICE)` → `{vFrames, vWord, voiceCut, firstSound, voiceEnd}`
- `makeSpeech(VOICE, VOICES)` → `{SPEECH, PHRASES, speaking}`
- `buildCues(hits, {sfx, speaking, roomAt})`. This is the same algorithm. `fileOf` uses `def.dir ?? 'sfx'`, and `roomAt(f)` replaces the hard-coded `WHITE_ACT`.
- `upHalf`, `upBeat`, `upQuarter`

`scripts/kb/check-port.mjs` feeds film 1's own `HITS`, `VOICES`, `VOICE` and `WHITE_ACT` through the port. It asserts a deep-equal against film 1's exported `CUES`, `SPEECH`, `PHRASES` and `VOICES.map(voiceCut)`.

**Cascades:** the montage of repeated questions can use `until` cuts (each caller is cut by the next voice). `master()` and check-mix already support this: `voiceCut`, the `cutRoom` release, and the odd-line stem for masking scores.

---

## 5. Sound for film 2

**`scripts/kb/generate-sfx.mjs`** (run as `node --experimental-strip-types --no-warnings scripts/kb/generate-sfx.mjs [--force]`):
1. `T = await import('src/kb/timing.ts')`. Run a **contract check** (clear errors when something is wrong): every export in section 4 is present, `VOICES` is sorted, `MIX.name.voice` is in `VOICES`, every `CUES[].room` is in `{night, white}`, and every voice WAV exists.
2. **Film 1 library prerequisite:** collect the unique `CUES[].file` values under `sfx/`. If any of them, or `public/sfx/lib.json`, is missing (a fresh clone), spawn `scripts/generate-sfx.mjs` once (film 1's own driver, unchanged). Otherwise **only read** those files and never write to `public/sfx/`.
3. **Hash and skip:** `kbHash(T, ROOT)` from `scripts/kb/hash.mjs` (definition below). If it equals `public/kb/sfx/mix.json` `.hash`, skip in about 0.2 s.
4. **Extras (only if the film defines any):** `scripts/kb/sounds.mjs` `extras(T)` returns a Map from `'kb/sfx/fx-<name>[-k].wav'` to stereo audio. Normalise to −12 dBFS peak (check-mix requires it). Cache on `public/kb/sfx/lib.json`, keyed on `sounds.mjs` + `dsp.mjs` + the inputs. Helper voices needed from `scripts/audio/sounds.mjs` are **copied** into the file. Only `library` and `peakTime` are exported there, and editing that file changes film 1's `libKey` and hash.
5. **`lib` Map** = `new Map(uniqueCueFiles.map(f => [f, loadStereo(public/f)]))`. This is the same key format `master()` looks up through `c.file`.
6. **Bed:** `scripts/kb/bed.mjs` `bed(T).st`, normalised to −20 dBFS peak, written to `public/kb/sfx/bed.wav` and cached with `public/kb/sfx/bed.json` (keyed on `kb/bed.mjs` + `dsp.mjs` + the timing inputs).
7. **Master:** `master(T, lib, bedSt, { publicDir: path.join(PUBLIC, 'kb') })` from `scripts/audio/mix.mjs`, unchanged. It writes `public/kb/sfx/mix.wav` and `out/audio/kb/stem-{voice,voice-odd,bed,sfx}.wav`.
8. Remove stale files **only inside `public/kb/sfx/`**, then write the `mix.json` stamp (hash, frames, samples, sr, report).

**`scripts/kb/hash.mjs` `kbHash(T, root)`** = sha256 over:
- the bytes of `src/kb/timing.ts`, `src/kb/voice.generated.ts`, `src/lib/cuesheet.ts`, `src/timing.ts` and `src/voice.generated.ts` (film 2's timing imports both film 1 files)
- `scripts/kb/*.mjs`, `scripts/films.mjs` and `scripts/audio/{dsp,mix,loudness}.mjs`
- JSON of `{CUES, VOICES, SCENES, DURATION, BED, MIX, DUCK}`
- **sha256 of every `public/kb/voice/<id>.wav`** (content rather than mtime, so a checkout does not force a rebuild)
- `public/kb/sfx/lib.json`, `public/sfx/lib.json`, and the sha256 of every library file `CUES` references

**What `sounds.mjs` would need (for the record).** Film 2 **never calls `library()`**. That function writes `sfx/<name>.wav` keys, which is film 1's namespace. It would also need every film 1 family in `T.SFX`, plus `LIGHT_NOTES`, `LIGHT_SEMI`, `FPS`, `CALL_LOCAL.disclose`, `HOOK.ring`, `HOOK_LOCAL.ringB` and `TWIST_LOCAL.buzz`. Those last four values are already baked into `ring-hook`, `ring-twist`, `buzz` and `line`. A film-2 ring with a different cadence is a film-2 extra.

**New bed for film 2 (`scripts/kb/bed.mjs`).** It is a 120 BPM piece in E major, composed against film 2's structure: every boundary is read from film 2's `T`, as in film 1.
- It **copies** the instrument code it needs from `scripts/audio/bed.mjs`: the pad, felt kick, hats, snare/clap, crash, reverse cymbal, bass note, pluck, piano, e-piano, sidechain pump, hall, glue and bus limiter. `bed.mjs` exports only `bed(T)`, and editing it changes film 1's `bedKey` and hash.
- With the borrowed CTA, the CTA section is film 1's CTA code copied verbatim, with `P.cta/line/drift/converge/whirl/survivor/impact/name/button/hold` re-based on film 2's `SCENES.cta.from`. That covers the drop into the dark, the build under Ava, the converge, the inhale, E on the logo, the crash choked before the name, and the held E chord into the master's fade.
- `BED.ride` copies film 1's CTA ride points, shifted. Relative to `cta.from` they are: −8:3.5 · 8:0 · 125:0.5 · 150:3.5 · 167:6 · 174:5.5 · 180:4 · 193:2 · 240:2.5.
- Film 2 has a lot of narration, so the bed spends long stretches ducked (`DUCK.bedDb` −9). `BED.vol` and the rides need tuning for this film.

**Rooms:** only `night` and `white` exist in `mix.mjs`. If the film needs a front-desk room tone, it becomes an extra sound file, not a third reverb (a third reverb would mean editing `mix.mjs`).

---

## 6. Voices

**`scripts/voice-lines-kb.json`** uses the same schema as `voice-lines.json`: `level` (−23 LUFS, peakMax −1), `voices`, `lines`, `_notes`.

`voices`:

| Role | Voice | Settings |
|---|---|---|
| `ava` | Tessa (Emotive) `6ccbfb76-1fc6-48f7-b71d-91ac6298247b` | `speed 1.05`, full-band, no `phone`. Used for all narration and Ava's on-call lines. |
| `caller` | Kyle (Emotive) `c961b81c-a935-4c17-bfb3-ba2239de8c2f` | `phone: true` |
| `caller2` | Dana (Emotive) `cc00e582-ed66-4004-8336-0175b85c85f6` | `phone: true`, plus film 1's `eq` (presence +6 dB at 2.2 kHz, −3 dB at 500 Hz) |
| `caller3`, … (optional) | other voices below | `phone: true` |

Other English voices that `voice-candidates/README.md` records as checked with `GET /voices/{id}`:
- **Leo** `0834f3df-e650-4766-a20c-5a93a43aa6e3` (masculine)
- **Maya** `cbaf8084-f009-4838-a096-07ee2e6612b1` (feminine)
- **Marian** `26403c37-80c1-4a1a-8692-540551ca2ae5` (feminine, narration-style)

Pin every id in the JSON. Without one, `cartesiaVoice()` picks a voice from the library itself.

**Lines:**
- Each line has `{id, voice, say, speak | parts[], emotion, direction}`. Ids are `[a-z0-9-]` and unique within the film, for example `vo-1…` (Ava narrating), `q-hours-1…` (callers), `ava-1…` (Ava on calls).
- With the borrowed CTA, add `{"id": "cta-1", "borrow": "main"}` and `{"id": "cta-2", "borrow": "main"}`. These byte-copy `public/voice/cta-*.wav` to `public/kb/voice/` and copy their entries from `src/voice.generated.ts`, with `file` rewritten. No new take is synthesised, so the audio matches film 1's CTA picture exactly.

**`scripts/generate-voice.mjs --film=<id>`** (the flag is required; a missing flag is an error):
- **Paths:** the film's paths from `films.mjs` replace `OUT`, `TS_OUT`, `voice-lines.json`, `SRC` (`voice-src/kb`), the `file` prefix (`kb/voice/<id>.wav`) and the preview path (`out/kb/preview.wav`).
- **Frozen guard:** for a `frozen` film (`main`), live writes are refused unless `--unfreeze` is passed. This covers the default run, `--only` and `--remaster`. `--out=DIR` candidate sets are always allowed.
- **`borrow` lines** are copied, never synthesised, and are skipped by the engines.
- **`--install=DIR [--only=a,b]`** (new): copies chosen takes from a candidate set (`DIR/voice/<id>.wav` + their entries) into the film's live set. Existing entries keep their exact JSON and order, as the `--only` merge does today. This mode is refused for frozen films.

**Child session protocol (only that session holds the Cartesia key):**
1. The orchestrator commits and pushes the phase 1 infrastructure (section 12).
2. The child session pulls, then runs `node scripts/generate-voice.mjs --film=kb --engine=cartesia --out=voice-candidates/kb/<take>` for N takes or emotion variants, and commits `voice-candidates/kb/*`.
3. The parent listens, then installs with `--install=voice-candidates/kb/<take> --only=…` (one call per source take).
4. Placeholder until then: `--film=kb --engine=kokoro` (offline; fetches the model once into `.cache/`). This lets the timeline, cues, bed, mix and renders run end to end before the real voices arrive.

---

## 7. The ending (CTA and NEUROVOICE end card)

**Recommended: borrow `src/scenes/Cta.tsx` unchanged.** `Cta` reads `useSceneFrame('cta') = frame/sub − SCENES1.cta.pre`. That is a local time, so the scene plays identically inside film 2 when mounted like this:

```tsx
// src/kb/Film.tsx
import { SCENES as S1 } from '../timing';
import { Cta } from '../scenes/Cta';
<Sequence from={(SCENES.cta.from - S1.cta.pre) * sub} durationInFrames={(S1.cta.to - S1.cta.from + S1.cta.pre) * sub}><Cta /></Sequence>
```

Film 2's timing must then hold to these constraints. Film 1's values are `cta = {from: 1980, to: 2310, pre: 12}`, `CTA.line 15`, `brandVoice 195`, `logoImpact 180`, `finalHold 285`.
- `SCENES.cta = { from: X, to: X + 330, pre: 12, post: 0 }`, with **`X % 30 === 0`**. Film 1's `1980 % 30 = 0` puts the logo impact on beat 1 or 3; film 2 keeps that grid.
- `DURATION = X + 330`, and `MIX.fadeOut = [X + 300, X + 330]`. The picture's fade in `Cta` is computed from film 1's `MIX.fadeOut − cta.from`, so the sound and the picture fade together.
- `MIX.impact = { ...MIX1.impact, at: X + 180 }`, and `MIX.name = MIX1.name` (voice `cta-2`).
- `VOICES` includes `{at: X + 15, id: 'cta-1'}` and `{at: X + 195, id: 'cta-2'}`, both borrowed.
- `HITS` includes film 1's `HITS.filter(h => h.at >= 1968)` shifted by `X − 1980`, which is 38 hits. Check them by label. `'the handoff spark'` at −5 belongs to film 1's scale-to-CTA handoff, so keep it only if film 2's previous scene ends the same way.
- **The iris opens from `FLOW_END(L)`**: (1520, 560) in 16:9 and (150, 1300) in 9:16, from `lib/handoff.ts`. Film 2's preceding scene must end dark, with its last element at that point.
- The CTA plays in the night room (`roomAt`). The bed's CTA section and rides follow section 5.

**Fallback (only if the script changes the CTA line).** Build `src/kb/scenes/Cta.tsx` from the parts that carry no timing: `scenes/cta/{EndCard (Wordmark, StartFree, Note, Url), Headline, HeroGL, heroShader, orbPass}` and `cta/font/wordmark.css`. Use a fork of `cta/orbit.ts` bound to film 2's `CTA`/`VOICE`. The end card is still the NEUROVOICE wordmark version.

---

## 8. What film 2 can reuse

**Reuse as is** (no timeline or voice binding; I checked their imports):
- `components/`: Atmosphere (NightRoom/PaperRoom/EmberRoom), Camera, Grain (FilmGrain), LightGround, MeshOrb, OrbGroup, orbGL, Type (Words, labels, reveal, subpixel)
- `lib/`: fonts, glide, layout, type, handoff
- `scenes/cta/`: EndCard, Headline, HeroGL, heroShader, orbPass
- `scenes/knowledge/`: Title, geometry, measure, pulse
- `scenes/scale/`: Cards, Flow, Heading, curves, lights
- `scenes/result/`: Card, Event, measure
- `scenes/call/`: Light, Mesh, Status
- `scenes/hook/`: Clock, DayDrum, Rings, StaggerText, color, moments, warp
- `scenes/twist/`: Rings, measure
- `theme.ts` as a whole: TYPE roles, VOICE_INK, the four LIGHTS, ROOM

**Reuse if the film keeps 30 fps and 120 BPM** (these import only `FPS` or `BEAT`): `lib/motion`, `lib/lights`, `components/Orb`, `lib/scene` (`useSub`, `useTimelineFrame`), `hook/Wave`, `result/Split`.

**Tied to film 1 (fork into `src/kb/`, never edit):**
- `components/Captions` → `src/kb/components/Captions.tsx`. Repoint 2 imports and add a header saying "fork of src/components/Captions.tsx @ ea1e905; fold back after delivery".
- `lib/scene.useSceneFrame` → `src/kb/scene.ts`
- `scenes/call/{CallCaptions, voice, Waveform}`
- `scenes/knowledge/{CaptionRun, Reader, Slot, Stage, Status, Tiles, Beams, Closing, light, voice}`
- `scenes/cta/orbit`, `lib/pickup`, and every top-level scene except the borrowed `Cta`

**New speaker kinds** (for example a human front desk) get their ink in `src/kb/theme.ts` (`{ ...VOICE_INK, … }`). `theme.ts` is not touched.

---

## 9. Scripts and config: the film-aware changes

**`scripts/films.mjs`** (new; it lives outside `scripts/audio/`, so film 1's hash ignores it):

```js
export const FILMS = {
  main: { frozen: true,  entry: 'src/index.ts',    timing: 'src/timing.ts',    voiceTs: 'src/voice.generated.ts',    voiceLines: 'scripts/voice-lines.json',
          publicDir: 'public',    voiceDir: 'public/voice',    voiceSrc: 'voice-src',    sfxDriver: 'scripts/generate-sfx.mjs',    stamp: 'public/sfx/mix.json',
          hash: ['scripts/audio/hash.mjs', 'buildHash'], qa: 'out/audio',    comp: 'Trailer-',    bundle: 'out/master/bundle',    outDir: 'out',    outName: 'neurotechvoice-trailer' },
  kb:   { frozen: false, entry: 'src/kb/index.ts', timing: 'src/kb/timing.ts', voiceTs: 'src/kb/voice.generated.ts', voiceLines: 'scripts/voice-lines-kb.json',
          publicDir: 'public/kb', voiceDir: 'public/kb/voice', voiceSrc: 'voice-src/kb', sfxDriver: 'scripts/kb/generate-sfx.mjs', stamp: 'public/kb/sfx/mix.json',
          hash: ['scripts/kb/hash.mjs', 'kbHash'],       qa: 'out/audio/kb', comp: 'KB-Trailer-', bundle: 'out/master/bundle-kb', outDir: 'out/kb', outName: 'neurotechvoice-knowledge' },
};
export const filmOf = (argv, { required = false } = {}) => { /* --film=<id> → FILMS[id] (+ id); unknown → throw; missing → main or throw if required */ };
```

**`remotion.config.ts`** changes only in the sound pre-step. Every `Config.*` line and the ffmpeg overrides stay byte-identical. For film 1, the call that runs is exactly today's call.

```ts
const film = process.env.NTV_FILM ?? (process.argv.some((a) => /(^|[\\/])src[\\/]kb[\\/]index\.tsx?$/.test(a)) ? 'kb' : 'main');
const SFX_DRIVER: Record<string, string> = { main: 'generate-sfx.mjs', kb: path.join('kb', 'generate-sfx.mjs') };
if (!process.env.NTV_SKIP_SFX) {
  execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(root, 'scripts', SFX_DRIVER[film])], { stdio: 'inherit', cwd: root });
  process.env.NTV_SKIP_SFX = '1';
}
```

- Film 1 commands (no entry point, or `src/index.ts`) never run film 2's code, so a broken film 2 cannot block a film 1 render.
- Film 2 commands run film 2's driver, which handles film 1's library prerequisite itself (step 5.2).

**`scripts/check-mix.mjs --film`:**
- These come from the registry: `T`, `VOICE`, voice-lines, the voice WAV folder (now `PUBLIC/'voice'`), the stamp, the hash function, and the QA folder (stems and cue timeline).
- ARC windows: `T.MIX.arc.windows ?? [[SCs, SCs + T.SCALE.langTitle], [SCs + T.SCALE.flow, SCs + T.SCALE.irisToDark[0]]]`, which keeps film 1's check identical.
- Every other check is already generic: loudness, true peak, effect and bed peaks, dialogue levels, phone presence, impact, name, end tail and SII.

**`scripts/check-render.mjs --film`:** the registry picks the timing module (`FPS`, `RENDER_FPS`, `DURATION`, `MIX.file`). The default is `main`, and the existing filter on `--` arguments already skips the flag.

**`scripts/render-master.mjs --film`:**
- From the registry: timing, `comps = formats.map(f => film.comp + f)`, the sound step (`film.sfxDriver`), and `npx remotion bundle <film.entry> --out-dir <film.bundle>`.
- Output: `<film.outDir>/<film.outName>-<fmt>-4k120.mp4`. `fmt` replaces `comp.slice(8)`, which gives the same names for film 1.
- New `--dry-run`: prints the comps, chunk ranges, bundle and output paths without rendering.

**`package.json`** (additions only, plus explicit flags on the voice scripts):

| Script | Command |
|---|---|
| `studio:kb` | `remotion studio src/kb/index.ts` |
| `voice:kb` | `node scripts/generate-voice.mjs --film=kb` |
| `sfx:kb` | `node --experimental-strip-types --no-warnings scripts/sfx.mjs --film=kb` |
| `sfx:kb:force` | same as `sfx:kb`, plus `--force` |
| `check:audio:kb` | `node --experimental-strip-types --no-warnings scripts/check-mix.mjs --film=kb` |
| `render:kb:landscape` | `remotion render src/kb/index.ts KB-Trailer-16x9 out/kb/neurotechvoice-knowledge-16x9.mp4` |
| `render:kb:vertical` | `remotion render src/kb/index.ts KB-Trailer-9x16 out/kb/neurotechvoice-knowledge-9x16.mp4` |
| `render:kb:master` | `render-master.mjs --film=kb` |
| `check:render:kb` | `check-render.mjs --film=kb <the two out/kb mp4s>` |
| `check:port` | `scripts/kb/check-port.mjs` |
| `verify:film1` | `scripts/kb/verify-film1.mjs` |
| `voice` | becomes `node scripts/generate-voice.mjs --film=main`. It hits the frozen guard unless `--unfreeze` is passed, which is intended now that film 1 is delivered. |
| `voice:remaster` | becomes `node scripts/generate-voice.mjs --film=main --remaster`, with the same guard. |

`sfx`, `sfx:force`, `check:audio`, `render*`, `check:render` and `typecheck` stay as they are.

**`trailer/.gitignore`**: add `public/kb/sfx/`. `public/kb/voice/` stays tracked.

---

## 10. Every file to touch

**Existing files: one-line edits, none of them in film 1's bundle or sound hash:**

| File | Change |
|---|---|
| `remotion.config.ts` | The sound pre-step picks the film (`NTV_FILM`, else the entry-point argument) and runs that film's driver. All `Config.*` lines are unchanged. |
| `package.json` | Add the `*:kb`, `check:port` and `verify:film1` scripts. `voice` / `voice:remaster` pass `--film=main`. No dependency changes. |
| `.gitignore` (`trailer/`) | Add `public/kb/sfx/`. |
| `scripts/generate-voice.mjs` | Required `--film` (paths from `films.mjs`), a frozen guard with `--unfreeze`, `borrow` lines, `--install=DIR [--only]`, and a per-film `file` prefix and preview path. |
| `scripts/check-mix.mjs` | `--film`: per-film `T`, `VOICE`, voice-lines, voice folder, stamp, hash function and QA folder. ARC windows from `MIX.arc.windows`, with film 1's expression as the fallback. |
| `scripts/check-render.mjs` | `--film` picks the timing module. The default is `main`. |
| `scripts/render-master.mjs` | `--film`: per-film timing, comp prefix, sound driver, entry point, bundle folder and output name. Adds `--dry-run`. Film 1's paths are unchanged. |

**New files:**

| File | What it is |
|---|---|
| `scripts/films.mjs` | Film registry and `filmOf(argv)`. |
| `scripts/sfx.mjs` | `--film=<id> [--force]` dispatcher that spawns `film.sfxDriver` with strip-types. |
| `scripts/voice-lines-kb.json` | Film 2's lines and roles (Tessa as Ava, phone-line callers, `borrow` entries for `cta-1` / `cta-2`). |
| `scripts/kb/generate-sfx.mjs` | Film 2's sound driver (section 5): contract check, library reuse, extras, bed, `master()` with `publicDir=public/kb`, stamp. |
| `scripts/kb/bed.mjs` | Film 2's 120 BPM E-major bed. Instrument code copied from `audio/bed.mjs`; CTA section copied and re-based. |
| `scripts/kb/sounds.mjs` | Only if needed: film-2-only effects written to `public/kb/sfx/fx-*.wav` at −12 dBFS. |
| `scripts/kb/hash.mjs` | `kbHash(T, root)` for the driver and `check-mix --film=kb`. |
| `scripts/kb/check-port.mjs` | Asserts that `src/lib/cuesheet.ts` reproduces film 1's `CUES`, `SPEECH`, `PHRASES` and `voiceCut`. |
| `scripts/kb/verify-film1.mjs` | `--capture` writes the baseline; the default run compares against it (section 11). |
| `src/lib/cuesheet.ts` | Film-agnostic port of film 1's voice and cue machinery. Film 1 does not import it. |
| `src/kb/index.ts` | `registerRoot(KbRoot)`. |
| `src/kb/Root.tsx` | `KB-Trailer-*` (120 fps), `KB-Preview-*` (30 fps) and the `KB-Scenes` folder. |
| `src/kb/Film.tsx` | Scene sequences, FilmGrain for film 2's acts, Soundtrack, and the borrowed film 1 `Cta`. |
| `src/kb/Soundtrack.tsx` | Plays film 2's `MIX.file`. |
| `src/kb/timing.ts` | Film 2's timeline, voices, `HITS`, `CUES`, `BED` and `MIX`; the contract in section 4. |
| `src/kb/voice.generated.ts` | Generated (Kokoro placeholder first, then the Cartesia installs). |
| `src/kb/scene.ts` | `useKbSceneFrame` and `kbSceneLength`. |
| `src/kb/theme.ts` | Optional: inks for extra speakers. |
| `src/kb/components/Captions.tsx` | Fork bound to film 2's voice data. |
| `src/kb/scenes/**` | Film 2's scenes, plus any forks of the film-1-bound knowledge visuals. |
| `public/kb/voice/*.wav` | Film 2's voices (tracked). |
| `voice-candidates/kb/<take>/**` | Cartesia candidate sets (tracked). |

**Untouched (the frozen set; `verify-film1` diffs it against the baseline HEAD):**
- `src/index.ts`, `src/Root.tsx`, `src/Trailer.tsx`, `src/Soundtrack.tsx`, `src/timing.ts`, `src/theme.ts`, `src/voice.generated.ts`, `src/css.d.ts`
- `src/components/**`, `src/scenes/**`, `src/dev/**`
- the existing `src/lib/*.ts`: fonts, glide, handoff, layout, lights, motion, pickup, scene, type
- `scripts/generate-sfx.mjs`, `scripts/audio/**`, `scripts/voice-lines.json`
- `public/voice/**`, `public/img/**`, `public/sfx/**` (generated)
- `tsconfig.json`, `package-lock.json`

---

## 11. Verification that film 1 is untouched

**A. Baseline: capture it BEFORE the first infrastructure edit** (later wrapped as `verify-film1.mjs --capture`). Run from `trailer/`:

```bash
B=out/kb-plan/baseline; mkdir -p $B/stills
git rev-parse HEAD > $B/HEAD                                      # ea1e905…
sha256sum public/voice/*.wav src/voice.generated.ts scripts/voice-lines.json public/sfx/*.wav public/sfx/*.json > $B/film1.sha256
stat -c '%n %s %Y' public/voice/*.wav > $B/voice.stat             # size + mtime: inputs to film 1's mix hash
node --experimental-strip-types --no-warnings --input-type=module -e "const T=await import('./src/timing.ts');
  console.log(JSON.stringify({C:T.CUES,V:T.VOICES,S:T.SCENES,D:T.DURATION,B:T.BED,M:T.MIX,SP:T.SPEECH,PH:T.PHRASES,H:T.HITS}))" > $B/timeline.json
node --experimental-strip-types --no-warnings scripts/generate-sfx.mjs > $B/sfx.txt   # must say: up to date (2efdbc5153019f3c) — skipped
node --experimental-strip-types --no-warnings scripts/check-mix.mjs > $B/check-mix.txt; cp out/audio/cue-timeline.txt $B/
node --experimental-strip-types --no-warnings scripts/check-render.mjs out/neurotechvoice-trailer-16x9.mp4 out/neurotechvoice-trailer-9x16.mp4 \
  out/neurotechvoice-trailer-16x9-4k120.mp4 out/neurotechvoice-trailer-9x16-4k120.mp4 > $B/check-render.txt
NTV_SKIP_SFX=1 npx remotion compositions src/index.ts > $B/compositions.txt
NTV_SKIP_SFX=1 npx remotion bundle src/index.ts --out-dir $B/bundle-a
NTV_SKIP_SFX=1 npx remotion bundle src/index.ts --out-dir $B/bundle-b      # determinism check
(cd $B/bundle-a && find . -path ./public -prune -o -type f -print | sort | xargs sha256sum) > $B/bundle.sha256
# stills from the prebuilt bundle (twice, a/ and b/, to prove the renderer is deterministic)
for f in 0 60 120 180 240 560 885 945 1005 1200 1395 1690 1980 2160 2250 2309; do
  for o in 16x9 9x16; do NTV_SKIP_SFX=1 npx remotion still $B/bundle-a Preview-$o $B/stills/a/p$o-$f.png --frame=$f --image-format=png; done; done
NTV_SKIP_SFX=1 npx remotion still $B/bundle-a Trailer-16x9 $B/stills/a/t16x9-4802.png --frame=4802 --scale=2 --image-format=png   # 4K, sub-frame 1200.5
NTV_SKIP_SFX=1 npx remotion still $B/bundle-a Trailer-16x9 $B/stills/a/t16x9-9000.png --frame=9000 --scale=2 --image-format=png   # 4K end card (WebGL)
NTV_SKIP_SFX=1 npx remotion still $B/bundle-a Trailer-9x16 $B/stills/a/t9x16-8640.png --frame=8640 --scale=2 --image-format=png   # 4K logo impact
sha256sum $B/stills/a/*.png > $B/stills.sha256   # repeat into stills/b and compare: identical → exact gate; else use a ≤1/255 max-delta gate
```

**B. Gate: run after every infrastructure change, after each film 2 phase, and before delivery** (`npm run verify:film1`). All of these must pass:
1. `git diff --quiet $(cat $B/HEAD) -- <the frozen set from section 10>`, and `git status --porcelain -- <frozen set>` is empty.
2. `sha256sum -c $B/film1.sha256` passes. This covers `public/voice/*.wav`, `src/voice.generated.ts`, `public/sfx/mix.wav`, all 96 `public/sfx/*.wav` and the stamps. **`mix.wav` must still be `ec037282…f31e35e`.**
3. `stat` matches `$B/voice.stat`: the voice mtimes are unchanged, so film 1's hash inputs are unchanged.
4. `scripts/generate-sfx.mjs` prints `up to date (2efdbc5153019f3c) — skipped`, and `mix.wav`'s mtime does not change.
5. `timeline.json` is byte-identical. `check-mix.txt` and `cue-timeline.txt` are identical, with exit code 0.
6. `check-render` output on the four delivered film 1 MP4s is identical. This also proves the `--film` refactor kept the `main` path.
7. `npx remotion compositions src/index.ts` is identical (ids, fps, sizes, durations).
8. A fresh `remotion bundle src/index.ts` gives the same sha256 for every emitted file outside `public/`. This is the strongest picture proof: film 1's compiled code is the same.
9. The 35 stills are identical to the baseline: 16 frames × 2 orientations at 30 fps, plus 3 stills at 4K and 120 fps.
10. `npm run typecheck` (`tsc --noEmit`) passes for both films. `npm run check:port` passes.
11. `render-master --dry-run` with `main` prints the same comps, chunk ranges, `out/master/bundle` and `out/neurotechvoice-trailer-{16x9,9x16}-4k120.mp4` as the current formula.

**C. Optional extra proof** (needed only if a hashed film 1 file ever has to change; this plan does not change any):
- Copy `trailer/` to the scratchpad, without `out/` and with `node_modules` symlinked.
- Run `node --experimental-strip-types --no-warnings scripts/generate-sfx.mjs --force` there.
- The resulting `mix.wav` sha256 must equal `ec037282…`. This proves the code regenerates film 1's bytes deterministically.

**Never, during film 2 work:**
- run `npm run voice`, `voice:remaster` or `sfx:force` for film 1 in the repo
- touch `public/voice/`
- create anything inside `scripts/audio/`
- write to `public/sfx/` from film 2 code
- run `npm install` or change dependencies

---

## 12. Order of work

1. **Baseline (11.A)**, before any edit.
2. **Infrastructure (task #163), with placeholder content:**
   - Write `films.mjs`, `sfx.mjs`, the `generate-voice --film` changes (guard, borrow, install), and `voice-lines-kb.json` from the current script draft.
   - Generate Kokoro placeholders into `public/kb/voice` + `src/kb/voice.generated.ts`.
   - Write `src/lib/cuesheet.ts` + `check-port`.
   - Write `src/kb/{index,Root,Film,Soundtrack,timing,scene}`, with title-card placeholder scenes and the borrowed `Cta`.
   - Write `scripts/kb/{generate-sfx,hash,bed}` (a bed stub is fine), the `--film` changes to `check-mix`, `check-render` and `render-master`, and the `remotion.config`, `package.json` and `.gitignore` edits.
   - **Gate:** verify-film1 is fully green; tsc passes; check-port passes; `sfx:kb` builds `public/kb/sfx/mix.wav`; `KB-Preview-*` stills render; `check:audio:kb` runs (it may flag placeholder content).
   - The orchestrator then commits and pushes so the child session can pull.
3. **Voices (#162):** the child session generates candidates (section 6), the parent cherry-picks with `--install`, then `check:audio:kb` must pass its dialogue checks. Run verify-film1 again.
4. **Build (#164):** scenes, `HITS`, bed, extras, then rounds of critics. After each round run tsc, `sfx:kb`, `check:audio:kb`, stills, and the fast verify-film1 items (1–5, 10).
5. **Masters (#165):** `render:kb:master` (4K HEVC at 120 fps, resumable chunks), then `check:render:kb`. Before delivery, run the **full** verify-film1 again.

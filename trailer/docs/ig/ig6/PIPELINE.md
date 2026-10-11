# ig6 ("One ring"): build pipeline

Label `synth`. Written on 2026-10-11 at HEAD `7b67638` (`claude/remotion-trailer`). This is a planning document: no code was changed and nothing was committed. It is ig5's route (`docs/ig/ig5/PIPELINE.md`, as actually built: `docs/ig/ig5/INFRA-LOG.md`, `DELIVERY.md`) moved up one reel.

It adds a sixth reel, `ig6`, while leaving the delivered work exactly as it is:
- **film 1** `main` stays FROZEN;
- **film 2** `kb` stays DELIVERED;
- **ig1-ig4** stay delivered, their mix stamps CURRENT;
- **ig5** stays delivered (its two masters, cover, mix stamp, chunks and sources byte-identical).

The reel's content lives in `SCRIPT.md`, its look in `STYLE.md` (§9 is the build spec), its voices in `voice-lines-draft.json`, its posting copy in `POSTING.md`. This file covers only how ig6 is built. Paths are relative to `trailer/`.

---

## 0. Decisions

1. **ig6 is a seventh film in the merged registry, with its own registry file `scripts/ig6/films.mjs`.** `scripts/registry.mjs` merges it, exactly as it merges `scripts/ig5/films.mjs`. It is never added to `scripts/ig/films.mjs` (an igHash input) or `scripts/ig5/films.mjs` (an ig5Hash input).
2. **Everything new lives in `scripts/ig6/`, `src/ig/ig6/` and `voice-candidates/ig6/`**, plus new names in the shared sound folders: `public/ig/voice/ig6-*.wav` (tracked) and `public/ig/sfx/ig6/` (gitignored). Deliverables go to `out/ig/deliver/neurotechvoice-ig6-*`.
3. **Four shared files change, one small edit each** (§3.2): `scripts/registry.mjs`, `package.json` (scripts only), `src/ig/Root.tsx`, `src/ig/voices.ts`. No other shared file: the ig5 route already made `components/*` read `src/ig/voices.ts`, made `check-zones` / `check-delivery` take their reels from the registry (`/^ig\d+$/`, which `ig6` matches), and gave `ZoneGuard.tsx` its per-reel `registerZones`.
4. **The series sign-off is reused byte for byte**: `{"id": "ig1-07", "borrow": "ig1"}`, never synthesised.
5. **Shared code is reused by import**: `common/series.ts`, `cues.ts`, `components/End.tsx` exports, `ZoneGuard`, `Soundtrack`, `scene.ts`, `lib/motion`, `lib/fonts` (`useFaceReady`, `waitForFonts`), `kb/kit` `measureText`, the shared SFX library, `scripts/ig/bed.mjs`'s stub, `scripts/audio/*`. The two code paths that run on import are copied: ig5's sound driver (→ `scripts/ig6/generate-sfx.mjs`) and ig5's guard (→ `scripts/ig6/guard.mjs`). The reel shell `IgReel` is copied into `src/ig/ig6/Reel6.tsx` (30 lines) because ig6 needs a white base and no grain, and `IgReel` renders ig1-ig5.
6. **The house spec holds**: 30 fps × 4 = 120 fps, 120 BPM, 1080×1920, Tessa speaks every on-screen line, 20-28 s (ig6: 28.0 s, impact f780), the end card types AGENT, then the NEUROVOICE wordmark and the URL (in ig6's white `End6`).

---

## 1. What any change could break (and the baseline to compare against)

| Hash / gate | What it reads | Consequence for ig6 |
|---|---|---|
| **`igHash`** (`scripts/ig/hash.mjs`), the stamp of ig1-ig4 | `src/ig/<reel>/timing.ts`; every `src/ig/common/*.ts` (the listing too); `src/ig/voice.generated.ts`; film 1's `src/timing.ts` + `src/voice.generated.ts`; every top-level `scripts/ig/*.mjs` except the QA-only five; `scripts/audio/{dsp,mix,loudness}.mjs`; the evaluated timeline; the content of each placed `public/ig/voice/<id>.wav`; `public/ig/sfx/lib.json`; every cue file | ig6 edits none of these and adds no file to `src/ig/common/` or `scripts/ig/`; never writes `public/ig/sfx/lib*`, `fx-impact-end.wav` or `public/ig/voice/ig[1-5]-*.wav` |
| **`ig5Hash`** (`scripts/ig5/hash.mjs`), the stamp of ig5 | `'ig5:' + igHash(T5)` + every **top-level** `.ts` of `src/ig/ig5/` + every `scripts/ig5/*.mjs` but `guard.mjs` + `public/ig/sfx/ig5/lib.json` | ig6 edits nothing in `src/ig/ig5/` or `scripts/ig5/`, adds nothing there, and never copies a file into either |
| **`kbHash`** (film 2) | `src/kb/*`, `src/lib/cuesheet.ts`, film 1's constants, `scripts/kb/*.mjs`, `scripts/films.mjs`, `scripts/audio/*`, `public/kb/voice`, both `lib.json` | untouched |
| **Film 1 `buildHash`** and verify-film1 gate 1 (frozen set) | `src/{index,Root,Trailer,Soundtrack,timing,theme,voice.generated,css.d}`, `src/components`, `src/scenes`, `src/dev`, nine `src/lib/*.ts`, `scripts/generate-sfx.mjs`, `scripts/audio/`, `scripts/voice-lines.json`, `public/{voice,img,sfx}`, `tsconfig.json`, `package-lock.json` | untouched; **never run `npm install`** (package-lock is frozen). ig6 *imports* `src/scenes/cta/EndCard.tsx` and `src/scenes/cta/font/wordmark.css` (as `End.tsx` does): importing does not modify them |
| verify-film1 gate 8 / verify-film2 step 6 (bundle digests) | the bundles' file lists minus `kb/…`, `ig/…` sound files (`isSoundStatic` = `^((kb\|ig)/)?(sfx\|voice)/`) | every ig6 public file must be under `public/ig/voice/` or `public/ig/sfx/ig6/`; **a `public/ig6/` would fail both** |

**Baseline at this HEAD** (from `docs/ig/ig5/INFRA-LOG.md` and `DELIVERY.md`; the guard re-measures them, §7.1):

| Reel | Stamp | Length / impact | Delivered (sha256 prefix) |
|---|---|---|---|
| ig1 | igHash `49b90ae44064d049` | 840 / 780 | `edfc55ce` `14202a61` `84cf96c0` (120 / 60 / cover) |
| ig2 | `757d177d35b27cd6` | 840 / 780 | `a51ba168` `edb7395e` `4e7194f8` |
| ig3 | `47ae5cf315d3434b` | 780 / 720 | `b45bbb22` `aa364a3b` `ac8b0f92` |
| ig4 | `f4500c7a37b6d47e` | 840 / 780 | `a84e97ee` `1eb0b9f4` `cd1a3398` |
| ig5 | ig5Hash `19ca5ef2038155ea` (the booking mix left in place; `timing.ts` `BODY.does = 'ig5-06'`) | 840 / 780 | message `ea3cd1b0…` / `44d60053…`, booking `48dc6dba…` / `a2d0ec58…`, cover `0d82f460…`; HEVC masters `e00b73f2…` / `8a881f87…` |

---

## 2. The ig6 film

### 2.1 `scripts/ig6/films.mjs` (new): the same field set as `scripts/ig5/films.mjs`

```js
const reel = {
  frozen: false,
  entry: 'src/ig/index.ts',                    // the shared IG entry (Root.tsx lists IG6-*)
  timing: 'src/ig/ig6/timing.ts',
  voiceTs: 'src/ig/ig6/voice.generated.ts',    // ig6's OWN voice data
  voiceLines: 'scripts/ig6/voice-lines-ig6.json',
  publicDir: 'public/ig',                      // master() reads <publicDir>/voice/<id>.wav
  voiceDir: 'public/ig/voice',                 // shared folder; ig6 writes only ig6-* (+ the borrow's self-copy)
  voiceSrc: 'voice-src/ig6',
  sfxDriver: 'scripts/ig6/generate-sfx.mjs',
  stamp: 'public/ig/sfx/ig6/mix.json',
  hash: ['scripts/ig6/hash.mjs', 'ig6Hash'],
  qa: 'out/audio/ig/ig6',
  comp: 'IG6-Reel-',
  bundle: 'out/master/bundle-ig6',             // its own bundle: bundle-ig and bundle-ig5 are never rebuilt for it
  outDir: 'out/ig',
  outName: 'neurotechvoice-ig6-one-ring',      // SCRIPT.md slug one-ring
  formats: ['9x16'],
  preview: 'out/ig/ig6-preview.wav',
  cmd: { voice: 'npm run voice:ig6', remaster: 'npm run voice:ig6 -- --remaster', sfx: 'npm run sfx:ig6' },
};
export const IG6_FILMS = { ig6: reel };
```

**Guards in the same file** (copy ig5's block, renamed): throw unless `outName` starts with `neurotechvoice-ig6-`, `stamp` is `public/ig/sfx/ig6/mix.json`, `voiceTs` is `src/ig/ig6/voice.generated.ts`, `voiceLines`, `sfxDriver` and `hash` are under `scripts/ig6/`, `qa` is `out/audio/ig/ig6`, `bundle` is `out/master/bundle-ig6`, `comp` is `IG6-Reel-`.

### 2.2 How the shared tools resolve `--film=ig6` once `scripts/registry.mjs` merges `IG6_FILMS`

| Tool | ig6 works? | Notes |
|---|---|---|
| `scripts/generate-voice.mjs` | yes | §4 |
| `scripts/check-mix.mjs`, `scripts/check-render.mjs`, `scripts/sfx.mjs` | yes | read `film.timing`, `film.voiceTs`, `film.hash`, `film.stamp`, `film.voiceLines`, `film.voiceDir`, `film.qa`; `sfx.mjs` spawns `film.sfxDriver` |
| `scripts/ig/render-par.mjs` | yes | its only check is `film.id.startsWith('ig')`; on (re)bundle it runs `npm run sfx:ig` (ig1-ig4), so run `sfx:ig6` first and keep the guard green |
| `scripts/ig/finish.mjs` | yes | cover comp `IG${id.slice(2)}-Cover-9x16` = `IG6-Cover-9x16` |
| `scripts/ig/check-zones.mjs`, `check-delivery.mjs` | **yes, no edit** | since ig5's edits 9-10 they take `FILMS` from the registry filtered to `/^ig\d+$/` |
| `scripts/ig/generate-sfx.mjs`, `scripts/ig5/generate-sfx.mjs` | ig6 is invisible to both, as intended | `sfx:ig` keeps skipping ig1-ig4; `sfx:ig5` keeps skipping ig5 |

---

## 3. Files

### 3.1 New files

```
scripts/ig6/
  films.mjs               IG6_FILMS (§2.1)
  voice-lines-ig6.json    = docs/ig/ig6/voice-lines-draft.json, byte for byte (12 entries: 9 placed incl. the borrow, 3 alternates)
  hash.mjs                ig6Hash(T, root) (§5.2)
  generate-sfx.mjs        the ig6 sound driver: a copy-adapt of scripts/ig5/generate-sfx.mjs (§5.1)
  guard.mjs               QA: --capture / --check of everything ig6 must not move, ig1-ig5 (§7.1); writes only out/ig6-guard/
  bed.mjs                 ONLY IF the stub arrangement is not enough (instruments copied, never imported from scripts/ig/bed.mjs internals)
src/ig/ig6/
  timing.ts               the §6.1 contract of docs/ig/PIPELINE.md: REEL 'ig6', VOICE from ./voice.generated
  voice.generated.ts      GENERATED by generate-voice --film=ig6
  zones.ts                ig5's combined rule, renamed (IG6_ZONES, ig6Faults, ig6CoverFaults)
  Reel6.tsx               ig6's own shell (STYLE §9.12) + registerZones('ig6', …)
  Cover.tsx               IG6-Cover-9x16
  acts/Acts.tsx           hook · wait · missed · pickup · day · words · ring · end
  stage/                  style.ts fonts.ts Camera.tsx Dial.tsx Hand.tsx Lockup.tsx Transitions.ts End6.tsx (+ zones registration)
voice-candidates/ig6/take-<a…>/   Cartesia candidate sets (tracked, like voice-candidates/ig5/)
public/ig/voice/ig6-*.wav         installed takes (tracked)
public/ig/sfx/ig6/                mix.wav, mix.json (stamp), bed.wav, bed.json (gitignored)
out/audio/ig/ig6/ · out/audio/ig/.tmp-ig6/ · out/master/bundle-ig6/ · out/master/IG6-Reel-9x16-x1/
out/ig/master/neurotechvoice-ig6-one-ring-{a,b}-1080p120-hevc.mp4
out/ig/deliver/neurotechvoice-ig6-one-ring-{a,b}-{1080p120.mp4,1080p60-ig.mp4} · …-cover.png · out/ig/qa/ig6/
```

Keep picture-only modules in `src/ig/ig6/stage/` and `acts/`: `ig6Hash` hashes the top-level `.ts` files of `src/ig/ig6/` (timing, voice data, zones), so a picture module at the top level would only cost a needless re-stamp.

### 3.2 Shared files that change (one small edit each), with proof that each is in no hash

| # | File | Change | igHash | ig5Hash | kbHash | film 1 hash / frozen set | Other gate |
|---|---|---|---|---|---|---|---|
| 1 | `scripts/registry.mjs` | `import { IG6_FILMS } from './ig6/films.mjs'`; add `['scripts/ig6/films.mjs', IG6_FILMS]` to the duplicate-id check; `FILMS = { ...BASE, ...IG_FILMS, ...IG5_FILMS, ...IG6_FILMS }` (the `outName`-unique check already covers it) | no (only `scripts/ig/*.mjs`) | no | no | no | `main`, `kb`, ig1-ig5 must resolve to the identical objects (`===` check) |
| 2 | `package.json` | add scripts only (§6.5); no dependency change | no | no | no | no (`package-lock.json` is frozen, untouched) | verify-film1 gate 10 reads only `scripts['check:port']` |
| 3 | `src/ig/Root.tsx` | 3 imports (`T6`, `Reel6`, `Cover6`) + `{ n: 6, T: T6, Reel: Reel6, Cover: Cover6 }` in `REELS` | no | no | no | no (film 1's root is `src/Root.tsx`) | the composition rows of IG1-IG5 unchanged (guard gate 4) |
| 4 | `src/ig/voices.ts` | `import { VOICE as IG6 } from './ig6/voice.generated';` and `lines: { ...IG6.lines, ...IG5.lines, ...IG.lines }` (ig1-ig5 entries still win, spread last) | no (igHash reads `src/ig/voice.generated.ts`, not this view) | no (ig5Hash reads only `src/ig/ig5/*.ts`) | no | no | gate P: IG1-IG5 stills byte-identical |

**Why edit 4:** `End6` (and any use of `components/Captions` word timing) reads word onsets through `components/End.tsx` `agentWord` / `Captions` helpers, which look up `VOICE` from `src/ig/voices.ts`. Every id of ig1-ig5 resolves to the very same object as before. **Edit-free alternative:** ig6's `Lockup.tsx` and `End6.tsx` read `src/ig/ig6/voice.generated.ts` directly and import only the pure-`T` helpers (`endState`, `ctaLine`, `agentKeys`, `END`); then edit 4 is dropped. Recommended: the edit (it is ig5's proven route; gate P proves it).

**Untouched, and checked as untouched (§7):** `scripts/films.mjs`; everything in `scripts/ig/` (incl. the QA tools, no further edit needed) and `scripts/ig5/`; `scripts/voice-lines-ig.json`; `src/ig/voice.generated.ts`, `src/ig/common/*`, `src/ig/ig1…ig5/**`, `src/ig/components/**` (incl. `ZoneGuard.tsx`, `End.tsx`), `src/ig/{Reel,scene,types,Soundtrack,index}.ts(x)`; `public/ig/voice/ig[1-5]-*.wav`, `public/ig/sfx/{lib/, lib.json, fx-impact-end.wav, ig1…ig5/}`; `out/ig/deliver/**` (17 files + `profile/`), `out/ig/master/*.mp4` (6), `out/master/{IG1…IG5-Reel-9x16-x1, bundle-ig, bundle-ig5}`; film 1, film 2, `remotion.config.ts`, `tsconfig.json`, `package-lock.json`, `.gitignore` (no change needed: `public/ig/sfx/` is ignored; `public/ig/voice/` and `voice-candidates/` are tracked).

**Note on ig5's own guard:** `scripts/ig5/guard.mjs` checks that `public/ig/voice/` gains only `ig5-*` files and `public/ig/sfx/` only `ig5/`, so it will report ig6's new files as failures. It is retired from here on (its job moves into ig6's guard, which covers ig1-ig5). **Do not edit it** (it belongs to ig5's delivered tooling).

---

## 4. Voices

### 4.1 How `generate-voice --film=ig6` picks its paths
`FILM = filmOf(argv, { required: true })` over the merged registry; `OUT = public/ig/voice`, `TS_OUT = src/ig/ig6/voice.generated.ts`, `LINES_JSON = scripts/ig6/voice-lines-ig6.json`; each line's file is `ig/voice/<id>.wav`.

| Mode | Writes | Touches another reel's file? |
|---|---|---|
| default (`--engine=kokoro\|cartesia`) | every ig6 line as `public/ig/voice/<id>.wav`; the whole `src/ig/ig6/voice.generated.ts` | no, provided the ids are `ig6-*`; the borrow `ig1-07` copies onto itself (same inode: a no-op, tested on Node v22.22.2 in the ig5 run) |
| `--out=voice-candidates/ig6/take-x` | only that folder (the `--out` guard refuses any live folder) | no |
| `--install=DIR [--only=…]` | the chosen WAVs into `public/ig/voice/`; merges entries into ig6's TS | no |
| `--remaster` | re-levels only ig6's non-borrow lines | no |

**The one hazard:** an ig6 line id that names an ig1-ig5 line (a lost `"borrow"`, or a copied `ig5-07`) would overwrite a delivered take and restale every reel that places it. Rules: every id matches `^ig6-` except the single `{"id": "ig1-07", "borrow": "ig1"}`; `guard:ig6 -- --check --fast` runs before and after every voice command.

### 4.2 Steps
1. **Placeholder, offline:** `node scripts/generate-voice.mjs --film=ig6 --engine=kokoro` (before the `Root.tsx` edit, so tsc can see `src/ig/ig6/voice.generated.ts`).
2. **Cartesia candidates:** `node scripts/generate-voice.mjs --film=ig6 --engine=cartesia --out=voice-candidates/ig6/take-a` (then b, c, …), the same model and API version as ig5 (`sonic-3.6-2026-08-27`, `2026-08-14`), Tessa (Emotive) `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, speed 1.05. `CARTESIA_API_KEY` is already in the environment: **never echo or print it.** Make at least four candidates of `ig6-02a` (its intonation must continue, not fall).
3. **Pick by measurement, then by ear** (`voice-candidates/ig/PICKS.md` method): durations against SCRIPT §5.3 (`ig6-01` ≤ 3.4 s; `ig6-02a` ≤ 1.3 s; `ig6-07` ≤ 2.2 s); `ig6-01` + `ig6-02a` must let `ig6-02a` end by f174 (else the hook ladder, SCRIPT §1.3); word SII in check-mix ≥ 0.7; no `<break/>` doubling.
4. **Install:** `node scripts/generate-voice.mjs --film=ig6 --install=voice-candidates/ig6/take-x --only=<ids>`, one call per source take.
5. **Re-anchor** `src/ig/ig6/timing.ts` to the measured takes (`place` / `upBeat` / `upBar` from `common/series.ts`; ring 2 fixed at f180; the ring and pickup on beats; the CTA ≤ f765 asserted).

---

## 5. Sound

### 5.1 `scripts/ig6/generate-sfx.mjs` (copy-adapt of `scripts/ig5/generate-sfx.mjs`)
**Imported unchanged:** `master` (`scripts/audio/mix.mjs`), the dsp helpers (`scripts/audio/dsp.mjs`), `bed` / `inputs` (`scripts/ig/bed.mjs` stub, unless `scripts/ig6/bed.mjs` exists), `igHash` through `ig6Hash`.
**Changed in the copy:** the reel is only `ig6` (reads `IG6_FILMS` and `src/ig/ig6/timing.ts`); the contract's paths are `ig/sfx/ig6/` (MIX.file and BED.file directly in it); every VOICES id is `ig6-*` or `ig1-07`; every cue file is in the shared `ig/sfx/lib/` (read-only, sha-checked against the shared `lib.json`) or the shared `ig/sfx/fx-impact-end.wav` (read-only) or under `ig/sfx/ig6/`; staging `out/audio/ig/.tmp-ig6/`; stems `out/audio/ig/ig6/`; the stale-file sweep limited to the top level of `public/ig/sfx/ig6/`; a `publish()` guard that refuses any write outside `public/ig/sfx/ig6/`. The contract keeps "captions ≤ 7 words" for every SCREENS span (SCRIPT §5.1 holds it). **ig6 needs no sound outside the shared library** (SCRIPT §6), so no `lib/` copy and no `sounds.mjs`.

### 5.2 `scripts/ig6/hash.mjs`
```js
import { igHash } from '../ig/hash.mjs';   // its REEL check /^ig\d$/ accepts 'ig6'
export function ig6Hash(T, root) {
  // sha256 over 'ig6:' + igHash(T, root)
  //   + the bytes of every top-level .ts of src/ig/ig6/ (timing.ts, voice.generated.ts, zones.ts)
  //   + every scripts/ig6/*.mjs but the QA-only guard.mjs
  //   + public/ig/sfx/ig6/lib.json if it ever exists
}
```
It reads, never writes. Nothing ig6 owns is read by igHash for ig1-ig4 or by ig5Hash for ig5.

### 5.3 Bed and mix
The stub arrangement driven by `MUSIC` (SCRIPT §6): `bedFrom` f120, `stop` [whip − 8, pickup + 15) measured from the placed takes, `roll` f750, `impact` f780, `brand` f784; `MIX.arc.windows` = the day sweep; `impactHits(780)` with `slam` −6 dB (ig5 DELIVERY §2: the AAC true-peak fix). check-mix targets (series `IG_LOUD`, `IG_NAME`, `igImpact`, `igArc`): −14 ± 1 LUFS, ≤ −1.0 dBTP, dialogue −18.5 ± 0.5 LUFS per line, word SII ≥ 0.7, the name ≥ 0.9, climax ≥ +1 LU over the loudest dialogue, tail < −60 dBFS, bed ≤ −20 dBFS peak, effects ≤ −12 dBFS peak, stamp current.

---

## 6. Picture, render, finish, QA

### 6.1 Reel code
- `src/ig/ig6/timing.ts` follows ig5's shape: `REEL`, `TITLE`, `PLAN`, `VOICES`, `SCENES`, `ORDER`, `SCREENS`, `DISPLAY`, `END_CARD`, `HITS`, `CUES`, `MUSIC`, `BED`, `MIX`, `GRAIN` (`ground: 'pearl'` for the type; the shell paints white), `roomAt`, `ZONE_FRAMES`, plus ig6's `HOOK` ladder and `CASTS` (A = `ig6-01`, B = `ig6-01b`; SCRIPT §1.3, §5.3). Assert: ring 2 = f180, `ig6-02a` ≤ f174, the ring on the first beat ≥ the whip cut + 12, the pickup on the next bar line or beat ≥ the ring + 15, the CTA ≤ f765.
- `Reel6.tsx` is ig6's shell (STYLE §9.12): `IgReel` copied with `background: '#FFFFFF'` and `IgFinish` paper grain 0. The end act is `End6` (STYLE §9.10); the fallback is the shared `IgEnd` with `tone="pearl"`.
- **Font loading plan** (STYLE §9.2): `src/ig/ig6/stage/fonts.ts` imports `@fontsource/cormorant-garamond/latin-600-italic.css` (a declared dependency, bundled from `node_modules`; no network); Instrument Sans comes from `src/lib/fonts.ts` through the shell's `waitForFonts()`; the wordmark face from `src/scenes/cta/font/wordmark.css` (import only); every measuring component waits on `useIg6Faces()` (`useFaceReady`, which holds the frame with `delayRender`). `src/lib/fonts.ts` is never edited.
- Zones: `src/ig/ig6/zones.ts` registered with `registerZones('ig6', { faults, coverFaults, overlay })` from `Reel6.tsx` and `Cover.tsx` at module scope (the registry exists in `ZoneGuard.tsx` since ig5; no edit).

### 6.2 Commands (in this order; every Remotion command with `NTV_SKIP_SFX=1`)
```
npm run sfx:ig6                                   # ig6's mix (the IG and ig5 drivers are not involved)
npm run check:audio:ig6                           # = check-mix --film=ig6
npm run studio:ig6                                # review (sfx:ig and sfx:ig5 must print "up to date — skipped")
npm run check:zones:ig -- --film=ig6              # zone stills + cover against ig6's rule; FAIL on any VIOLATION
npm run render:ig -- --film=ig6 --dry-run         # the act-aligned chunks
npm run render:ig -- --film=ig6 --rebundle        # 2 workers, HEVC CRF 12, JPEG q100 → out/ig/master/<outName>-1080p120-hevc.mp4
npm run finish:ig -- --film=ig6                   # A 120 fps L5.1 ≤ 28 MB · B 60 fps L4.2 · C cover (+ 3:4 crop)
npm run check:delivery:ig -- --film=ig6           # size, codec/level, BT.709, AAC, −14 ± 0.5 LUFS, ≤ −1 dBTP, no elst, lock at lag 0
```
Plus, before the master: the **lockup/object overlap check** (a still at every screen onset with the lockup box masked against the object layers; STYLE §9.12).

### 6.3 Probe and review gates
- **Banding probe first** (STYLE §9.4, §9.12): a 2 s 120 fps strip of frame 0 and of the M5′ shadowed hand through the real chain at the 28 s budget (`scripts/ig/qa/probe-encode.mjs` pattern; write the strip comp under `src/ig/ig6/`, never edit `src/ig/qa/`). Decide shadow opacity / dither from it.
- Stills at every screen onset; a contact sheet every 6th frame; 120 fps strips of the T2 fall-through (f218-238), the T3 whip (f326-340), the time-lapse (f250-318) and the day sweep; the seam (f839 vs f0 diff < 2 % of pixels; the mix's last frame < −60 dBFS); ≥ 2 critic rounds (house style, honesty against SCRIPT §10, zones, lockup sync, seam).

### 6.4 Two hook renders, A then B (POSTING §1)
`finish.mjs` writes fixed names (`out/ig/deliver/<outName>-1080p120.mp4`, `-1080p60-ig.mp4`, `-cover.png`; `render-par` writes `out/ig/master/<outName>-1080p120-hevc.mp4`), so rename each pass's files before the next (`mv` on the exact names, never a wildcard):
1. **A pass** (`timing.ts` `CAST = 'A'`, hook `ig6-01`): `sfx:ig6`, `check:audio:ig6`, `guard:ig6 -- --check`, `check:zones:ig -- --film=ig6`, `render:ig -- --film=ig6 --rebundle`, `finish:ig -- --film=ig6`, `check:delivery:ig -- --film=ig6` (before renaming: it reads `<outName>-*`). Rename `…-one-ring-1080p60-ig.mp4` → `…-one-ring-a-1080p60-ig.mp4`, `…-one-ring-1080p120.mp4` → `…-one-ring-a-1080p120.mp4`, `out/ig/master/…-one-ring-1080p120-hevc.mp4` → `…-one-ring-a-1080p120-hevc.mp4`.
2. **B pass** (`CAST = 'B'`, hook `ig6-01b`; the only other change is S1b's lead "You"): the same commands; remove any re-render layer folder of the A pass by its exact path first; rename to `…-one-ring-b-…`.
3. Keep one `…-one-ring-cover.png` (identical across passes; check with sha256). Leave no ig6 video without `-a-` or `-b-` in `out/ig/deliver/`.

### 6.5 `package.json` scripts to add (existing scripts unchanged)

| Script | Command |
|---|---|
| `voice:ig6` | `node scripts/generate-voice.mjs --film=ig6` |
| `sfx:ig6` / `sfx:ig6:force` | `node --experimental-strip-types --no-warnings scripts/ig6/generate-sfx.mjs [--force]` |
| `check:audio:ig6` | `node --experimental-strip-types --no-warnings scripts/check-mix.mjs --film=ig6` |
| `studio:ig6` | `npm run sfx:ig && npm run sfx:ig5 && npm run sfx:ig6 && NTV_SKIP_SFX=1 remotion studio src/ig/index.ts` |
| `guard:ig6` | `node --experimental-strip-types --no-warnings scripts/ig6/guard.mjs` (`--capture` / `--check [--fast]`) |

`render:ig`, `finish:ig`, `check:zones:ig`, `check:delivery:ig` take `-- --film=ig6`. **Leave `check:audio:ig` (ig1-ig4) and `check:audio:ig5` as they are.**

### 6.6 Size budget (`finish.mjs` `kbpsFor`, 28 MB decimal, 3 % margin, AAC 192 kb/s)
28 s (840 f, 3360 render frames): video 7568 kb/s, maxrate 11352, bufsize 15136. ig1, ig2, ig4 and ig5 delivered 27.3-27.4 MB at this budget; a white ground with flat strokes should encode easier, but the 7 % shadow ramps are the risk (the probe, §6.3).

---

## 7. Hard gates and the order to run them

### 7.1 `scripts/ig6/guard.mjs`: ig6's invariance proof (copy-adapt of `scripts/ig5/guard.mjs`; writes only `out/ig6-guard/`)

**`--capture`** runs **before the first ig6 edit** (only `scripts/ig6/guard.mjs` exists then; run it with `node … scripts/ig6/guard.mjs --capture`, since the npm script comes in step 2). It records:
1. **sha256** of: `out/ig/deliver/**` (17 files + `profile/`); `out/ig/master/*.mp4` (6); `out/master/IG1…IG5-Reel-9x16-x1/**`; `out/audio/ig/ig1…ig5/stem-*.wav`; `public/ig/voice/ig[1-5]-*.wav`; `public/ig/sfx/{lib/**, lib.json, fx-impact-end.wav, ig1…ig5/**}`; `src/ig/voice.generated.ts`, `src/ig/common/**`, `src/ig/ig1…ig5/**`, `src/ig/components/**`; `scripts/voice-lines-ig.json`, `scripts/ig/**`, `scripts/ig5/**`.
2. **Listings** of `src/ig/common/`, `scripts/ig/`, `scripts/ig5/`, `src/ig/ig5/` (top level), `public/ig/`, `public/ig/sfx/`, `public/ig/voice/`, `public/`.
3. **Stamps:** `igHash(T)` = `public/ig/sfx/igN/mix.json` for ig1-ig4 and `ig5Hash(T5)` = `public/ig/sfx/ig5/mix.json` (`19ca5ef2038155ea`), plus what `sfx:ig` and `sfx:ig5` need to skip (MIX.file + the four QA stems each).
4. **Compositions:** the `npx remotion compositions src/ig/index.ts` table.
5. **Gate P (picture):** 6 Preview stills per reel for **ig1-ig5** (30) from a fresh bundle of `src/ig/index.ts`: f0, the first two caption onsets + 8 f, `END_CARD.field + 10`, the impact + 16, END − 1 (ig5's frame list as its guard chose it).

**`--check`** re-measures all of it and fails on any difference, except: the listings may gain `ig6-*.wav` in `public/ig/voice/` and `ig6/` in `public/ig/sfx/` only; `out/ig/deliver/` and `out/ig/master/` may gain `neurotechvoice-ig6-*` only; the compositions table may gain `IG6-*` rows only. No file inside a guarded set may change (there is no allowed edit: ig6's four shared edits are all outside the sets). `--fast` = gates 1-3 (seconds).

| Gate | Command | Pass |
|---|---|---|
| **(a) film 1** | `node scripts/kb/verify-film1.mjs --fast` after every infrastructure step and before every commit; the **full** `verify-film1` (11 gates) before delivery | PASS; `mix.wav` `ec037282…`, hash `2efdbc5153019f3c` |
| **(a) film 2** | `npm run verify:film2 -- --fast`; the full `npm run verify:film2` before delivery | `kbHash` `db3a9efa91f928f2`, the four MP4s byte-identical |
| **(b) ig1-ig4 sound** | `npm run check:audio:ig` and `npm run sfx:ig` | OK ×4; `igN: up to date (<hash>) — skipped` ×4, "0 built" |
| **(b) ig5 sound** | `npm run check:audio:ig5` and `npm run sfx:ig5` | OK; `ig5: up to date (19ca5ef2038155ea) — skipped` |
| **(b) picture, gate P** | `guard:ig6 -- --check` | 30/30 stills byte-identical (the renderer was proven deterministic across fresh bundles in the ig5 run) |
| **(c) delivered** | `guard:ig6 -- --check` shas | identical; the only new names are `neurotechvoice-ig6-*` |
| **Git** | `git diff --name-only HEAD` | ⊆ {`scripts/registry.mjs`, `package.json`, `src/ig/Root.tsx`, `src/ig/voices.ts`} |
| **Git** | `git status --porcelain` | new paths only under `scripts/ig6/`, `src/ig/ig6/`, `public/ig/voice/ig6-*`, `voice-candidates/ig6/`, `docs/ig/ig6/` |
| **ig6** | tsc; `check-mix --film=ig6`; `check-zones --film=ig6`; the overlap check; `check-delivery --film=ig6` (with `check-render`); the review gates of §6.3 | all PASS |

### 7.2 Order
1. **Baselines:** write `scripts/ig6/guard.mjs`, then `guard --capture`, `verify-film1 --fast`, `verify:film2 -- --fast`, `check:audio:ig`, `check:audio:ig5`. All green before anything else is written.
2. **Infrastructure:** `scripts/ig6/{films,hash,generate-sfx}.mjs`, `voice-lines-ig6.json` (byte copy of the draft); the `registry.mjs` merge (edit 1); `package.json` scripts (edit 2); Kokoro placeholder voices. **Gate:** guard `--check`, verify-film1 `--fast`, verify-film2 `--fast`.
3. **Picture plumbing:** `src/ig/voices.ts` (edit 4) **first** → guard `--check` (gate P proves ig1-ig5 still render byte-identically); then `src/ig/ig6/` with placeholder acts on the real timeline and the `Root.tsx` rows (edit 3). **Gate:** tsc + guard + `check:audio:ig` + `check:audio:ig5`.
4. **Probe** (§6.3) before any scene polish.
5. **Voices:** Cartesia → pick → install → re-anchor; guard `--check --fast` after every install.
6. **Scenes, HITS, bed; ≥ 2 critic rounds.** tsc + verify-film1 `--fast` + guard before each commit.
7. **Master:** `sfx:ig6` → guard (so `sfx:ig` and `sfx:ig5` are skips) → the A pass, then the B pass (§6.4).
8. **Before delivery:** the full verify-film1, the full verify-film2, guard `--check`, `check:audio:ig`, `check:audio:ig5`, `check:audio:ig6`. Commit only with the orchestrator's go-ahead.

---

## 8. Expected wall-clock (4 CPUs, shared; render-par uses ≤ 2 workers; ig1-ig5 measurements)

| Step | Time |
|---|---|
| Guard capture (bundle + 30 stills) | ≈ 6-10 min |
| `sfx:ig6` (bed + master) | ≈ 10-30 s; ≈ 0.2 s when skipped |
| `check-mix --film=ig6` | < 1 min |
| Probe strip + encode | ≈ 5 min |
| `check-zones --film=ig6` | ≈ 3-6 min |
| `render:ig --film=ig6` (3360 frames), per pass | ≈ 12-15 min (more if the dial window is heavy: draw only visible ticks) |
| `finish:ig --film=ig6`, per pass | ≈ 6-9 min |
| `check-delivery --film=ig6`, per pass | ≈ 2 min |
| Full verify-film1 / verify-film2 | ≈ 5 min each |
| **Master to QA'd delivery, both passes** | **≈ 60-80 min** |
| Building it: voices ≈ 0.5-1 h; scenes + sound + two critic rounds ≈ 4-6 h (the dial, the hand and the T2 are new drawing work) | |

---

## 9. Never, during ig6 work
- Edit, or add a file to, `scripts/ig/`, `scripts/ig5/`, `src/ig/common/`, `src/ig/ig1…ig5/`, `src/ig/components/`, `scripts/audio/`, `scripts/films.mjs`, `scripts/voice-lines-ig.json`, `src/ig/voice.generated.ts` or `src/lib/fonts.ts`.
- Give an ig6 line an ig1-ig5 id other than the `ig1-07` borrow, drop `"borrow"`, or run `generate-voice` for ig1-ig5 (`npm run voice:ig`, `voice:ig5`).
- Write `public/ig/sfx/lib*`, `fx-impact-end.wav`, anything in `public/ig/sfx/ig1…ig5/`, or anything in `public/` outside `public/ig/voice/ig6-*` and `public/ig/sfx/ig6/`.
- Run `sfx:ig:force`, `sfx:ig5:force`, `render:ig` / `finish:ig` for ig1-ig5. Delivered files are never re-encoded.
- Run `sfx:ig`, `sfx:ig5` or a studio while the guard is red (a stale stamp would rebuild a delivered mix).
- Run `npm install`, or touch `package-lock.json`, `tsconfig.json`, `remotion.config.ts` or `.gitignore`.
- Run two renders, or a render and a verify, at once; or a sound build while a film 1 / film 2 bundle is being made.
- Print, echo or commit `CARTESIA_API_KEY`. Commit, push or deploy without the orchestrator's go-ahead.

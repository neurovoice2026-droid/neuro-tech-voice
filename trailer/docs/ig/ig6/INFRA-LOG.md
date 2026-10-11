# ig6 infrastructure log (PIPELINE.md §7.2 steps 1–3)

Label `infra`. Run on 2026-10-11, 20:20–21:05 UTC, branch `claude/remotion-trailer`, HEAD `57d781c`, 4 CPUs (nothing else running). Every command ran from `trailer/`, one at a time: never two renders, never a render beside a verify.

Nothing was committed or pushed. No `npm install` was run. `package-lock.json`, `tsconfig.json`, `remotion.config.ts` and `.gitignore` are untouched. `CARTESIA_API_KEY` was never read or printed: the voices are Kokoro, forced with `--engine=kokoro` (a by-value search of the 31 new or changed files finds the key in none).

Logs: `out/ig/qa/ig6/infra/gates/01…24-*.log`. Stills: `out/ig/qa/ig6/infra/*.png`. Guard baseline: `out/ig6-guard/baseline/`.

**Result: every gate of steps 1–3 is green.** The only red result is `check:audio:ig6`, which is not a gate here: it reports the expected placeholder problems (Kokoro takes over the stub bed, see step 3).

---

## Step 1 · Baselines (all green before anything else was written)

Only `scripts/ig6/guard.mjs` existed when the capture ran, as §7.1 requires (the capture records `git status`: `?? scripts/ig6/guard.mjs` only).

| # | Command | Result | Key numbers |
|---|---|---|---|
| 1 | `node --experimental-strip-types --no-warnings scripts/ig6/guard.mjs --capture` | **PASS** (226 s) | **1747 files hashed.** 19/19 delivered sha256 prefixes match PIPELINE §1. **5 stamps CURRENT** and equal to PIPELINE §1. 49 composition rows. **30 ig1–ig5 Preview stills** from a fresh `src/ig/index.ts` bundle. Listings: `src/ig/common/` 3, `scripts/ig/` 12, `scripts/ig5/` 6, `src/ig/ig5/` 7, `public/ig/voice/` 51. |
| 2 | `node scripts/kb/verify-film1.mjs --fast` | **PASS** 6/6 (49 s) | Gates 1 2 3 4 5 10. `mix.wav` `ec037282…`. generate-sfx skips at `2efdbc5153019f3c`. timeline.json 101690 B identical. tsc and check:port pass. |
| 3 | `npm run verify:film2 -- --fast` | **PASS** 4/4 (2 min 20 s) | kbHash = stamp = `db3a9efa91f928f2`. 123 files identical (`mix.wav` `9c25a361…`, `bed.wav` `fe732796…`, 4 delivered MP4s). check-mix --film=kb stdout identical. |
| 4 | `npm run check:audio:ig` | **PASS** ×4 (32 s) | ig1 66 words, SII mean 0.97, climax +1.7 LU. ig2 50 / 1.00 / +1.3. ig3 58 / 0.98 / +1.1. ig4 68 / 0.97 / +1.1. All `OK`. |
| 5 | `npm run check:audio:ig5` | **PASS** (7 s) | −14.0 LUFS, −1.65 dBTP, climax +1.2 LU, arc +0.7 LU, 60 words, SII mean 0.97, the name 0.95 / 1.00 / 0.99. `OK`. |

The stamps the capture recorded:

| Reel | Hash = stamp | Length | Impact |
|---|---|---|---|
| ig1 | igHash `49b90ae44064d049` | 840 f | 780 |
| ig2 | igHash `757d177d35b27cd6` | 840 f | 780 |
| ig3 | igHash `47ae5cf315d3434b` | 780 f | 720 |
| ig4 | igHash `f4500c7a37b6d47e` | 840 f | 780 |
| ig5 | ig5Hash `19ca5ef2038155ea` (the delivered booking mix) | 840 f | 780 |

Gate P's frames (ig5's guard's rule: f0, the first two caption onsets + 8, `END_CARD.field + 10`, the impact + 16, END − 1):
- ig1: 0, 18, 104, 671, 796, 839
- ig2: 0, 18, 70, 692, 796, 839
- ig3: 0, 19, 76, 627, 736, 779
- ig4: 0, 14, 591, 680, 796, 839
- ig5: 0, 18, 102, 698, 796, 839

### What the guard covers (`scripts/ig6/guard.mjs`, a copy-adapt of `scripts/ig5/guard.mjs`)

It writes only `out/ig6-guard/`. Its sets are a superset of §7.1:

| Set | Files |
|---|---|
| `out/ig/deliver/**` (ig1–ig5's 17 files + `profile/`) | 21 |
| `out/ig/master/*.mp4` (6 HEVC masters, ig5's two included) | 6 |
| `out/master/IG1…IG5-Reel-9x16-x1/**` | 62 |
| `out/master/{bundle-ig, bundle-ig5}/**` (§3.2 "untouched") | 1064 |
| `out/audio/ig/ig1…ig5/stem-*.wav` (what `sfx:ig` / `sfx:ig5` need to skip) | 20 |
| `public/ig/voice/ig[1-5]-*.wav` | 51 |
| `public/ig/sfx/lib/**`, `lib.json`, `fx-impact-end.wav`, `ig1…ig5/**` | 66 + 2 + 20 |
| `src/ig/voice.generated.ts`, `src/ig/common/**`, `src/ig/ig1…ig5/**`, `src/ig/components/**`, `src/ig/qa/**`, `src/ig/{Reel,Soundtrack,index,scene,types}` | 1 + 3 + 52 + 14 + 2 + 5 |
| `scripts/voice-lines-ig.json`, `scripts/ig/**`, `scripts/ig5/**`, the shared tools `scripts/*.mjs` except `registry.mjs` | 1 + 16 + 6 + 8 |
| `voice-candidates/{ig, ig5}/**` | 327 |

On top of §7.1's gates 1–5, the guard also has:
- **No allowed edit inside the sets.** ig6's four shared edits are all outside them.
- **PIPELINE §1's sha prefixes, asserted.** These were written before the guard existed: ig1–ig4's 12 deliverables, ig5's 5 deliverables, and ig5's 2 HEVC masters.
- **PIPELINE §1's five stamps, asserted.** The capture refuses to run unless all five are current and equal to §1.
- **Gate 6, git (`--check` only, also in `--fast`).** A modified tracked path must be one of `scripts/registry.mjs`, `package.json`, `src/ig/Root.tsx`, `src/ig/voices.ts`, or under `docs/ig/ig6/`. A new path must be under `scripts/ig6/`, `src/ig/ig6/`, `public/ig/voice/ig6-*`, `voice-candidates/ig6/` or `docs/ig/ig6/`. Nothing may be deleted.

`--fast` runs gates 1–3 and 6 in about 2 s.

---

## Step 2 · Infrastructure

| # | Action / command | Result |
|---|---|---|
| 6 | Wrote `scripts/ig6/films.mjs`. | §2.1's fields. `outName` `neurotechvoice-ig6-one-ring`, bundle `out/master/bundle-ig6`, stamp `public/ig/sfx/ig6/mix.json`. The guards throw on load, as ig5's do, plus a check that `voiceDir` / `publicDir` are the shared `public/ig/voice` / `public/ig`. |
| 6 | Wrote `scripts/ig6/hash.mjs`. | `ig6Hash` = sha256(`'ig6:'` + igHash(T) + every top-level `.ts` of `src/ig/ig6/` + every `scripts/ig6/*.mjs` except `guard.mjs` + `public/ig/sfx/ig6/lib.json` if it exists). |
| 6 | Wrote `scripts/ig6/generate-sfx.mjs`. | `scripts/ig5/generate-sfx.mjs` renamed ig5 → ig6. The `diff` against the renamed copy shows only the header text, plus one addition (step 3): a failed rule in `timing.ts`'s `ASSERTS` is a contract error. |
| 7 | `cp docs/ig/ig6/voice-lines-draft.json scripts/ig6/voice-lines-ig6.json` | `cmp`: byte-identical. 12 entries: 8 placed `ig6-*`, the borrow `{"id":"ig1-07","borrow":"ig1"}`, and 3 alternates (`ig6-01r`, `ig6-01b`, `ig6-07b`). No duplicates. Every id matches `^ig6-` except the borrow. `level` and `voices` are JSON-equal to `scripts/voice-lines-ig.json`. |
| 8 | **Edit 1**, `scripts/registry.mjs`. | The import, `['scripts/ig6/films.mjs', IG6_FILMS]` in the duplicate-id check, the `...IG6_FILMS` spread, and the header comment. `FILM_IDS` = main, kb, ig1–ig6. `main`, `kb` and ig1–ig5 are `===` the objects of their own registries. `--film=ig6` resolves; `--film=ig9` still throws "unknown film". |
| 9 | **Edit 2**, `package.json`. Scripts only. | Appended `voice:ig6`, `sfx:ig6`, `sfx:ig6:force`, `check:audio:ig6`, `studio:ig6`, `guard:ig6`. The only other change is the trailing comma after `guard:ig5`. No dependency changed. `check:audio:ig`, `check:audio:ig5` and `check:port` are as before. |
| 10 | `guard.mjs --check --fast` | **PASS**: 1747/1747, all 5 stamps current, git 2 modified (allowed). |
| 11 | `node scripts/generate-voice.mjs --film=ig6 --engine=kokoro` | **PASS** (42 s). 11 Kokoro takes plus the borrow, all at −23 LUFS. |
| 12 | Write-set check: `find . -newer <marker>`. | Only the 11 `public/ig/voice/ig6-*.wav` and `src/ig/ig6/voice.generated.ts` changed. |

Kokoro take lengths: ig6-01 3.45 s · 02a 0.76 · 02b 1.12 · 03 2.14 · 04 2.56 · 05 1.38 · 06 0.89 · 07 1.32 · 01r 3.45 · 01b 2.64 · 07b 1.11.

**The `ig1-07` self-copy is a no-op.** Before and after the voice command it had the same sha256 (`c73b8a86…dd601035b`), size (179288), mtime (2026-10-06 13:39:20.680973007) and inode (672482). Its entry in `src/ig/ig6/voice.generated.ts` is JSON-identical to `src/ig/voice.generated.ts`'s, `file` `ig/voice/ig1-07.wav` included.

### Step 2 gate

| # | Command | Result |
|---|---|---|
| 13 | `guard.mjs --check` (full) | **PASS** gates 1–6 (48 s). 1747/1747 shas. 5 stamps. 49/49 rows, +0. **Gate P 30/30 byte-identical.** |
| 14 | `node scripts/kb/verify-film1.mjs --fast` | **PASS** 6/6 (45 s) |
| 15 | `npm run verify:film2 -- --fast` | **PASS** 4/4 (1 min 19 s) |

---

## Step 3 · Picture plumbing

### Voices first (edit 4)

| # | Action / command | Result |
|---|---|---|
| 16 | **Edit 4**, `src/ig/voices.ts`: `import { VOICE as IG6 } from './ig6/voice.generated'` and `lines: { ...IG6.lines, ...IG5.lines, ...IG.lines }`, plus the header comment. | All 51 ids of ig1–ig5 resolve to the very same objects as before (checked by identity). The 11 ig6 ids are added. |
| 17 | `npx tsc --noEmit -p .` | **PASS** |
| 18 | `guard.mjs --check` (full) | **PASS** gates 1–6 (45 s). **Gate P 30/30 byte-identical** with the new `voices.ts` in the bundle. |

### Then the reel

| # | Action | Result |
|---|---|---|
| 19 | Wrote `src/ig/ig6/timing.ts`. | Shape: ig5's. Provisional details in the next section. |
| 19 | Wrote `src/ig/ig6/zones.ts`. | ig5's rule renamed (`IG6_ZONES`, `ig6Faults`, `ig6CoverFaults`): text x 86–900, y 240–1400; objects x ≤ 880 below y 840; wordmark x 60–1020; cover x 86–900, y 260–1380. No price band: ig6 shows no numeral. |
| 19 | Wrote `src/ig/ig6/stage/`. | `style.ts`: STYLE §9.3–9.8's tokens (colours, dome stops, shadow, parallax, dial / hand / reading point, `FINISH6`, type specs, the six lockup layouts). `fonts.ts`: §9.2 (below). `Zones.tsx`: ig6's overlay and `registerIg6Zones()`. `End6.tsx`: the stub (below). |
| 19 | Wrote `src/ig/ig6/acts/`. | `Placeholder.tsx`: title-card acts on white, with the lockup of the moment. `Acts.tsx`: `ACTS6`. |
| 19 | Wrote `src/ig/ig6/Reel6.tsx`. | `IgReel` copied, with a `#FFFFFF` base and `IgFinish` at `FINISH6` (every strength 0: no grain), plus `registerIg6Zones()`. `IgReel` itself is untouched. |
| 19 | Wrote `src/ig/ig6/Cover.tsx`. | `Cover6`, `IG6-Cover-9x16`. |
| 20 | **Edit 3**, `src/ig/Root.tsx`: 3 imports (`T6`, `Reel6`, `Cover6`) and the `{ n: 6, … }` row. | The header comment was left alone, as in ig5. |
| 21 | `npx tsc --noEmit -p .` | **PASS** (exit 0). |

**Offline font loading (STYLE §9.2, PIPELINE §6.1).** Each face is loaded from a local file; nothing is fetched over the network:
- **Cormorant Garamond Italic 600** is imported ig6-locally in `src/ig/ig6/stage/fonts.ts` as `@fontsource/cormorant-garamond/latin-600-italic.css`. It is a declared dependency, version 5.3.0; its woff2 ships in `node_modules` and the bundle copies it.
- **Instrument Sans Variable** comes from `src/lib/fonts.ts` through the shell's `waitForFonts()`. That file is never edited.
- **The wordmark face** comes from `src/scenes/cta/font/wordmark.css`, imported only.

`useIg6Faces()` holds the frame with `useFaceReady` until four instances are in: `italic 600 110px "Cormorant Garamond"` (sampled on every accent glyph, ’ included), `580 60px`, `450 32px` and `600 50px` Instrument Sans. `measureSerif()` / `measureSans()` are cached canvas measures, as the kit's are.

The stills prove the real Cormorant italic renders: its single-storey italic forms and swash *x* and *d*, at the mock's widths. *six seconds.* at 126 px ends at x ≈ 825; the mock has 829.

### The provisional timeline (Kokoro takes; everything re-anchors on the Cartesia takes)

- **CAST** `'A'`. **HOOK** rung 0: `ig6-01`, lockup 1b holding 15 f.
- **CASTS** A = [01/15, 01/8, 01r/15, 01r/8, 01b/15, 01b/8]; B = [01b/15, 01b/8].
- **TRIM** 0 (full; T1 drops `ig6-06`).
- 28.0 s = 840 f. IMPACT 780, BRAND_AT 784, END 840.

The lines, as placed: ig6-01 @10–114 · 02a @124–147 · 02b @190–224 · 03 @240–305 · 04 @368–445 · 05 @492–534 · 06 @585–612 · 07 @680–720 · ig1-07 @784–825.

| Moment (`M`) | Frame |
|---|---|
| ring 1 | 0 |
| ring 2 | **180** (fixed) |
| fall (T2) | 222–234 |
| whip | 330 |
| cut | 333 |
| hub ring | 345 |
| **pickup** | **360** (bar line) |
| rebuild | 364–384 |
| day cut | 421 (the Kokoro "day" is early; plan 435) |
| sweep | 421–496 |
| words cut | 525 |
| ring cut | 570 |
| exit | 640–654 |

| Act (`SCENES`) | Frames |
|---|---|
| hook | 0–120 |
| wait | 120–234 |
| missed | 234–333 |
| pickup | 333–421 |
| day | 421–525 |
| words | 525–570 |
| ring | 570–654 |
| end | 654–840 |

`END_CARD`: cta 680 · field 662 · agent 692 · send 720 · roll 750 · impact 780 · url 785 / 797 / 809 · seam 826. `STOP` = [322, 375).

**ASSERTS: 10/10 hold.**
- ring 2 is f180, a step on the bar 4 line.
- 02a's voice has stopped at f145, before the f174 limit.
- No word onset falls under ring 1, ring 2 or the hub ring.
- 02b is voiced to f220, before shot E opens at f234.
- The hub ring sits on the first beat ≥ the cut + 12.
- The pickup is on a beat ≥ the ring + 15 (the f360 bar line).
- ig6-04 starts at f368, i.e. the pickup + 8.
- The CTA's voice stops at f718, before the f765 limit.
- DURATION is 840.
- The acts are contiguous.

**Cast B was checked too.** A temporary copy of `timing.ts` with `CAST = 'B'` was placed under `acts/` (outside `ig6Hash`), evaluated, and deleted. It gives `ig6-01b` on rung 0, 02a on its plan frame f120, and 0 faults.

### The ig6 mix (not a step-3 gate; built to prove the driver and give the Preview its soundtrack)

| # | Command | Result |
|---|---|---|
| 22 | `npm run sfx:ig6` | **PASS** (9.5 s). 15 shared library files, read-only and sha-checked, plus the shared `fx-impact-end`. Bed: the `scripts/ig/bed.mjs` stub, −20.0 dBFS peak. Master −14.0 LUFS, −1.65 dBTP, gain +6.6 dB, limiter 7.8 dB. 19 cues, 9 lines. Wrote `public/ig/sfx/ig6/{mix.wav, mix.json, bed.wav, bed.json}` and `out/audio/ig/ig6/stem-*.wav`. `.tmp-ig6` was removed. Stamp `ig6Hash` = `cf43dcc461c242de`. A second run printed `ig6: up to date (cf43dcc461c242de) — skipped`. |
| 23 | `npm run check:audio:ig6` | **FAIL**: 5 placeholder problems, listed below. Everything else is within target: master −14.0 / −1.65 dBTP; dialogue −23 ± 0.00, stem spread 0.5 LU; end: last 100 ms −75.3 dBFS, last frame −84.8, the chord −52.1 (≥ −55); arc +5.1 LU; the name 0.97 / 1.00 / 0.99. |

The five `check:audio:ig6` problems:

1. **Climax −0.4 LU (needs ≥ +1).** The loudest dialogue moment is `ig6-01` @11: the hook is said dry, because there is no bed until f120 (SCRIPT b1), and the master gain lifts it. The fix belongs to the sound step: a VOICE_RIDES on the hook's first words (ig5's ride on "Agency" is the model) and/or the real HITS and bed ride.
2. **Masking on "rings," (0.60), "picks" (0.53) and "words." (0.70).** These words sit under the stub bed at its placeholder +6 dB ride.
3. **Masking on "link." (0.54).** AGENT's fifth key covers it because the Kokoro CTA is short. ig5's infra run had the same issue.

None of these is an infrastructure fault.

### Step 3 gate

| # | Command | Result | Key numbers |
|---|---|---|---|
| 24 | `npx tsc --noEmit -p .` | **PASS** | |
| 25 | `guard.mjs --check` (full) | **PASS** gates 1–6 (44 s) | 1747/1747 shas. Stamps ig1 `49b90ae44064d049` · ig2 `757d177d35b27cd6` · ig3 `47ae5cf315d3434b` · ig4 `f4500c7a37b6d47e` · ig5 `19ca5ef2038155ea`. Public layout: +11 `ig6-*.wav`, `public/ig/sfx/ig6/` present. 49/49 rows plus **12 IG6 rows**. **Gate P 30/30 byte-identical.** Git: 4 modified (allowed), 27 new (allowed). |
| 26 | Compositions | **PASS** | With the IG6 rows removed, the table is **raw-identical** (padding included) to `out/ig6-guard/baseline/compositions.txt`. |
| 27 | `guard --check --fast`, then `npm run sfx:ig` | **PASS** | `library: 63 sounds … (all present)`. ig1 `49b90ae44064d049`, ig2 `757d177d35b27cd6`, ig3 `47ae5cf315d3434b`, ig4 `f4500c7a37b6d47e`, each `up to date — skipped`. `0 built, 4 up to date`. |
| 28 | `npm run sfx:ig5` | **PASS** | `ig5: up to date (19ca5ef2038155ea) — skipped` |
| 29 | `npm run check:audio:ig` | **PASS** ×4 `OK` | stdout identical to step 1's (blank lines ignored). |
| 30 | `npm run check:audio:ig5` | **PASS** `OK` | stdout identical to step 1's. |
| 31 | md5 of `out/audio/ig/ig1…ig5/cue-timeline.txt` | **PASS** | Unchanged (check-mix rewrites them with the same bytes). |
| 32 | `node scripts/kb/verify-film1.mjs --fast` | **PASS** 6/6 (42 s) | |
| 33 | `npm run verify:film2 -- --fast` | **PASS** 4/4 (1 min 17 s) | |
| 34 | `git status --porcelain` on the film 1 and film 2 frozen sets | **PASS** (empty) | Paths checked: `src/{components,scenes,lib,dev}`, `src/{timing,theme,Root,index,Trailer,Soundtrack,voice.generated,css.d}`, `scripts/audio`, `scripts/generate-sfx.mjs`, `public/{voice,sfx,img,kb}`, `scripts/voice-lines.json`, `src/kb`, `scripts/kb`, `scripts/films.mjs`, `scripts/voice-lines-kb.json`, `tsconfig.json`, `package-lock.json`, `remotion.config.ts`, `.gitignore`. |
| 35 | `git status --porcelain` on the IG shared sources | **PASS** (empty) | Paths checked: `scripts/ig`, `scripts/ig5`, `src/ig/ig1…ig5`, `src/ig/common`, `src/ig/components`, `src/ig/qa`, `src/ig/voice.generated.ts`, `scripts/voice-lines-ig.json`, `src/ig/{Reel,scene,types,Soundtrack,index}`, `voice-candidates/{ig,ig5}`. |

### Final re-check, after this log was written

- `npx tsc --noEmit -p .`: **PASS**.
- `guard.mjs --check` (full): **PASS** gates 1–6 (43 s). 1747/1747 shas. All five stamps unchanged. 49/49 rows plus 12 IG6 rows. **Gate P 30/30 byte-identical.** Git: 4 modified (allowed), 28 new (allowed; this file is the 28th).
- Logs: `out/ig/qa/ig6/infra/gates/25-tsc-final.log`, `26-guard-check-final.log`.

### Stills (`out/ig/qa/ig6/infra/`, all looked at)

They were rendered from a temporary bundle `out/ig/qa/ig6/infra/.bundle`, which was removed afterwards with `rm -r` on that exact path. Each was compared with `mock-one-ring.png` and the reference thumbnail.

- **`ig6-preview-f000.png`: frame 0.** Flat white. Lockup 1a set at 72 % ink, at the mock's frame-0 places:
  - **One ring,** Instrument Sans 580, 69 px, x 345, baseline 1150.
  - ***six seconds.*** teal Cormorant Italic 600, 126 px, x 330, baseline 1236.
  - The grey tier, centred on x 580, baseline 1296.

  The small grey placeholder card (act, window, hook rung, lines) sits at the top.
- **`f040`:** 1a fully inked except "seconds." in the tier. Her Kokoro onset for "seconds." is later than f40.
- **`f100`:** 1b "Your receptionist / *can’t answer.*", with a typographic apostrophe.
- **`f150`:** 2a "While it / *rings,*" over the one tier screen of two rows. Its second row "someone’s still waiting." is set at 72 %.
- **`f200`:** 2b "Someone’s / *still waiting.*". The display map capitalises the lead; the tier keeps the lowercase.
- **`f290`:** S3 "Someone else’s / *customer.*", with the tier split as SCRIPT shows: "A missed call is / someone else’s customer."
- **`f350`:** the wordless beat. No text, as SCRIPT b4 asks.
- **`f400` / `f450`:** S4b "Picks up, / *day or night.*", set at 72 % and then inked. Kokoro says "picks" at f400, so 4a held from f366 to f398.
- **`f510`:** S5 in the wide layout, "It answers / *from your words.*", accent at x 296.
- **`f600`:** S6 "Ring it / *yourself.*"
- **`f700`:** the End6 stub, the shared card on white: "Comment AGENT for the link." with AGENT in teal, and the comment field typing AGE….
- **`f796`:** the wordmark (the series' plum ink with its teal bloom; End6 proper sets it in `#0A0A0A` with no bloom) and the URL typing "neuro".
- **`f839`:** the seam. Lockup 1a is re-formed at 72 %, identical in type to f0.
- **`ig6-cover.png`:** SCRIPT §9's type at its sizes and baselines (kicker, "One ring," / ***six seconds.***, the stakes line), over a marked placeholder where frame 0's art goes.
- **`ig6-cover-zones.png`, `ig6-zones-f100.png`:** ig6's own overlay: TikTok's header, bottom and rail, the 3:4 crop, the lockup box. Every rect is green, and no `[ig-zones] VIOLATION` was logged.

**What is not there yet, by design (the scene build):** the dial, the hand, the camera, the transitions, the type's motion, End6 proper, and the cover art. The type matches the mock panel for panel.

**One observation for the scene build.** In the `default` layout (lead baseline 1160, accent baseline 1235 at 110 px), Cormorant's ascenders reach the lead's baseline: the *ll* of *still* sits under "Someone’s". These are STYLE §9.8's own values, and the reference is set just as tight, so the placeholder keeps them. Check it in the real Lockup.

---

## Files

`git diff --name-only HEAD` gives exactly the four §3.2 files:

```
trailer/package.json
trailer/scripts/registry.mjs
trailer/src/ig/Root.tsx
trailer/src/ig/voices.ts
```

The new paths (`git status --porcelain --untracked-files=all`) are all under §7.1's prefixes:

```
?? trailer/public/ig/voice/ig6-{01,01b,01r,02a,02b,03,04,05,06,07,07b}.wav   (11)
?? trailer/scripts/ig6/{films.mjs, generate-sfx.mjs, guard.mjs, hash.mjs, voice-lines-ig6.json}
?? trailer/src/ig/ig6/{Cover.tsx, Reel6.tsx, timing.ts, voice.generated.ts, zones.ts}
?? trailer/src/ig/ig6/acts/{Acts.tsx, Placeholder.tsx}
?? trailer/src/ig/ig6/stage/{End6.tsx, Zones.tsx, fonts.ts, style.ts}
?? trailer/docs/ig/ig6/INFRA-LOG.md   (this file)
```

Ignored outputs, which are not in git:
- `public/ig/sfx/ig6/{mix.wav, mix.json, bed.wav, bed.json}`;
- `out/audio/ig/ig6/{stem-*.wav, cue-timeline.txt}`;
- `out/ig6-guard/{baseline/, check/}`;
- `out/ig/qa/ig6/infra/`.

`ig6Hash` reads the top-level `.ts` files `timing.ts`, `voice.generated.ts` and `zones.ts`. The picture modules are all in `acts/` and `stage/`, outside it.

---

## Deviations from PIPELINE.md, and why

1. **The guard is a superset of §7.1.** It adds:
   - the bundles `out/master/bundle-ig` and `bundle-ig5`, which §3.2 lists as untouched;
   - `src/ig/qa/**` and `src/ig/{Reel,Soundtrack,index,scene,types}`;
   - the shared tools `scripts/*.mjs` except `registry.mjs`;
   - `voice-candidates/{ig,ig5}/**`;
   - the listings of `scripts/ig5/` and `src/ig/ig5/`;
   - PIPELINE §1's prefixes and stamps as assertions;
   - gate 6 (git).
   
   `--fast` covers gates 1–3 and 6.
2. **ig5's guard is left as it is.** `scripts/ig5/guard.mjs` was not run and not edited (§3.2's note): it would report ig6's new public files as failures.
3. **`timing.ts` never throws.** It states its rules in `ASSERTS` (and `FAULTS`). The ig6 sound driver turns a broken rule into a contract error, so `sfx:ig6` refuses to build. A throw at import would break the shared IG bundle, and with it ig1–ig5's compositions and gate P. This is the driver's one functional addition to the renamed copy.
4. **CAST naming.** §6.4's `CAST = 'A' | 'B'` selects the pass. `CASTS` holds each cast's hook ladder (§6.1). The role → take map is `TAKES`, and the trim ladder is `TRIMS`. No shared tool reads these names (checked by grep).
5. **The hook ladder tries both holds on each take.** SCRIPT §1.3 lists 01/15, 01/8, 01r, 01b. The ladder also tries 15 before 8 for 01r and 01b, keeping SCRIPT's order of preference.
6. **The whip rule is the voice end + 8.** SCRIPT §5.3 says "anchored at last word + 8 f". The whip is `max(330, ceil(voiced end of ig6-03 + 8))`, which reproduces SCRIPT's table: 330, 336 and 338 at 2.78, 2.5 and 2.45 words/s.
7. **The pickup rule.** SCRIPT says "the next bar line or, failing that, the next beat". The code takes the bar line when it is at most a beat beyond ring + 15, else that beat. This reproduces SCRIPT's 360 at 2.78 words/s and 375 at 2.5.
8. **`DISPLAY` carries three lockup-only leads.** SCRIPT §5.1 names only "Someone's". The lockup also capitalises "Someone" (S3) and "Picks" (S4b), as SCRIPT's own big-lockup column shows them. The sentence tier never reads `DISPLAY`.
9. **`LOCKUPS` lives in `timing.ts`.** It holds each screen's lead and accent word spans and its layout. It sits beside `SCREENS` and `DISPLAY` because the sound driver's contract checks word spans there. Changing it re-stamps the mix, which is harmless.
10. **The placeholder acts are ig6's own, not the shared `titleCard`.** That component paints the pearl mesh. Ig6's version is on white and shows the lockup at STYLE §9.8's places in the real faces.
11. **End6 is a stub.** It is SCRIPT §8's fallback, the shared `IgEnd` with `tone="pearl"`, on a flat white ground with the frame-0 lockup in the seam. The white End6 of §9.10 is the scene build's.
12. **The cover is provisional.** SCRIPT §9's final type over a marked art placeholder.
13. **Cue sheet.** Beyond the series' frame (the f0 trill at HEAD −4 dB, `endHits`, the riser, `impactHits` with `slam` −6 dB per SCRIPT b9), it also has room tone and the story's three structural rings (f0, f180, the hub ring) plus the pickup. All of them are clear of her onsets by `ASSERTS`.
14. **`check:zones:ig -- --film=ig6` was not run.** It is not a step-3 gate, and it writes to a fixed folder, `out/ig/qa/ig6/zones/`. The two zone stills above, taken by hand, show no violation.

---

## Independent check

Label `infra-check`. Run on 2026-10-11, 21:00–21:15 UTC, HEAD `57d781c`, by a second agent that did not build any of the above. Every gate was re-run from `trailer/`, one command at a time (no two renders, no render beside a verify). Logs: `out/ig/qa/ig6/infra-check/gates/01…18-*.log`. Nothing was committed, no `npm install`, the key was never printed. **No fix was needed:** no file was changed except this section.

### Is the baseline genuine?

The guard compares against `out/ig6-guard/baseline/`, which the builder captured. It was checked three ways before trusting it:
- **It is HEAD.** All **486 tracked files** in `baseline/shas.json` are byte-identical to their `git show HEAD:` blobs. The other 1261 entries are untracked outputs: the delivered files and masters (below), the bundles, stems and the gitignored `public/ig/sfx/**`.
- **It came before the edits.** `meta.json`/`git.json` record HEAD `57d781c` and the git status `?? scripts/ig6/guard.mjs` only. The baseline files are dated 20:22–20:26, and every edited or new file from 20:31 on. `guard.mjs` itself has not changed since the capture (20:22:51).
- **Its stills are the delivered picture.** Four baseline stills were compared against the same moment decoded from the delivered 120 fps files: ig1 f104 42.0 dB, ig3 f627 42.2 dB, ig5 f102 44.3 dB, ig5 f698 41.6 dB against the booking master (38.6 dB against the message master, as expected: the booking state is the one left in place). That is H.264 noise, at the right moment.

### Delivered files (sha256, computed fresh)

- **ig5 = `docs/ig/ig5/DELIVERY.md`, all 7.** message 120 `ea3cd1b093702606` · message 60 `44d6005330456776` · booking 120 `48dc6dba1f9c6e6e` · booking 60 `a2d0ec582a545fea` · cover `0d82f4607cf40125` · HEVC message `e00b73f25f907e51` · HEVC booking `8a881f87fd50d757`. Sizes equal too, and all equal `out/ig/qa/ig5/deliver/gates/sha256.txt`.
- **ig1–ig4 = PIPELINE §1, all 12** (`edfc55ce` `14202a61` `84cf96c0` · `a51ba168` `edb7395e` `4e7194f8` · `b45bbb22` `aa364a3b` `ac8b0f92` · `a84e97ee` `1eb0b9f4` `cd1a3398`). These 8-hex prefixes are the only record in the docs.

### Shared files against PIPELINE §3.2

`git diff --name-only HEAD` is exactly the four allowed files, and each diff was read line by line:

| # | File | Diff | Verdict |
|---|---|---|---|
| 1 | `scripts/registry.mjs` | the import, the 4th `REGS` entry, `...IG6_FILMS`, header comment | = edit 1. `main`, `kb`, ig1–ig5 `===` their own registries' objects; `--film=ig9` throws `unknown film`; `--film=ig6` → `neurotechvoice-ig6-one-ring` |
| 2 | `package.json` | the six §6.5 scripts, character for character, plus the comma after `guard:ig5`. No dependency line | = edit 2 |
| 3 | `src/ig/Root.tsx` | the 3 imports + the `{ n: 6, … }` row | = edit 3 |
| 4 | `src/ig/voices.ts` | the import + `{ ...IG6.lines, ...IG5.lines, ...IG.lines }`, header comment | = edit 4. All 51 ig1–ig5 ids resolve to the **same objects**; `fps`/`engine` are ig1–ig4's |

New paths are only under `scripts/ig6/`, `src/ig/ig6/`, `public/ig/voice/ig6-*` (11) and `docs/ig/ig6/`. Other things checked:
- `scripts/ig6/generate-sfx.mjs` against `scripts/ig5/generate-sfx.mjs` renamed ig5→ig6: only the header text and the 3-line `ASSERTS` contract check differ, and no ig5 name is left in its code. The `publish()` guard still refuses any write outside `public/ig/sfx/ig6/`.
- `films.mjs` has §2.1's guards plus the `voiceDir`/`publicDir` one.
- `hash.mjs` is §5.2 (top-level `.ts` only, so `Reel6.tsx`, `Cover.tsx`, `acts/` and `stage/` are outside it).
- `voice-lines-ig6.json` `cmp`-equals the draft: 12 ids, all `ig6-*` but the one `{ig1-07, borrow ig1}`. The `ig1-07` entry in ig6's voice data is JSON-identical to `src/ig/voice.generated.ts`'s.
- Fonts: Cormorant comes from the declared `@fontsource/cormorant-garamond` (bundled woff2), with no `http`/`fetch`/google-fonts anywhere in `src/ig/ig6/`. `src/lib/fonts.ts` is untouched. `Reel6` is `IgReel` line for line, except the `#FFFFFF` base and `FINISH6`.
- Key scan: 89 files (every git-new/modified file, both ig6 log folders, guard outputs, the ig6 stamps) were compared against the key's bytes, and **0 hits** (only the count was printed).

### Gates, re-run

| Gate | Command | Result |
|---|---|---|
| tsc | `npx tsc --noEmit -p .` | **PASS** (not incremental; all 11 `src/ig/ig6` files in the program) |
| ig6 guard, fast | `guard.mjs --check --fast` (before and after the sound runs) | **PASS** 1747/1747 · 19 prefixes · 5 stamps · git 4 modified + 28 new, all allowed |
| ig6 guard, full | `guard.mjs --check` | **PASS** gates 1–6 (39 s): 49/49 rows + 12 IG6 rows · **gate P 30/30 byte-identical** (contact sheet looked at: every still a full render, faces loaded) |
| Film 1 | `node scripts/kb/verify-film1.mjs --fast` | **PASS** 6/6: frozen set = `8b9cd21`, 116 files (`mix.wav` `ec037282…`), skip `2efdbc5153019f3c` |
| Film 2 | `npm run verify:film2 -- --fast` | **PASS** 4/4: kbHash = stamp = `db3a9efa91f928f2`, 123 files |
| ig1–ig4 sound | `npm run sfx:ig` | **PASS**: `0 built, 4 up to date` (ig1 `49b90ae44064d049` · ig2 `757d177d35b27cd6` · ig3 `47ae5cf315d3434b` · ig4 `f4500c7a37b6d47e`) |
| ig5 sound | `npm run sfx:ig5` | **PASS**: `up to date (19ca5ef2038155ea) — skipped`. All five `mix.wav`/`mix.json` mtimes and sizes unchanged |
| Sound checks | `check:audio:ig` / `check:audio:ig5` | **PASS** `OK` ×4 / `OK`. Output identical to the builder's pre-edit run (only its `time` lines differ); `cue-timeline.txt` md5 unchanged ×5 |
| Frozen sets | `git status` on the CONTEXT list + `src/dev`, `src/{Trailer,Soundtrack,voice.generated,css.d}`, `public/img`, `tsconfig.json`, `package-lock.json`, `remotion.config.ts`, `.gitignore` | **PASS** (empty). The ignored `public/sfx`, `public/kb/sfx` are covered by verify-film1 gate 2 and verify-film2 step 3 |
| IG shared sources | `git status` on `scripts/ig`, `scripts/ig5`, `src/ig/ig1…ig5`, `common`, `components`, `qa`, `src/ig/{voice.generated,Reel,scene,types,Soundtrack,index}`, `voice-lines-ig.json`, `voice-candidates/{ig,ig5}`, `docs/ig/ig5`, `docs/ig/PIPELINE.md` | **PASS** (empty) |
| ig6 timeline | evaluated `src/ig/ig6/timing.ts` | **PASS**: REEL ig6, 840 f, impact 780, CAST A, **ASSERTS 10/10** |
| ig6 stamp | `ig6Hash` vs `mix.json`; `npm run sfx:ig6` | **PASS**: `cf43dcc461c242de` both; skipped |
| ig6 render plan | `npm run render:ig -- --film=ig6 --dry-run` | **PASS**: 3360 f in 8 act chunks, bundle `out/master/bundle-ig6`, chunks `out/master/IG6-Reel-9x16-x1/`, master `out/ig/master/neurotechvoice-ig6-one-ring-1080p120-hevc.mp4` |
| ig6 zones (not a step-3 gate; run here because §14 above had not) | `npm run check:zones:ig -- --film=ig6` | **PASS**: no violation in 15 stills + the cover. ig6's own overlay is used (header 240, bottom 1400, rail x > 880 from y 840): the per-reel `registerZones` works with no shared edit |
| ig6 mix (not a gate) | `npm run check:audio:ig6` | **FAIL, as expected**: exactly the five placeholder issues above (climax −0.4 LU; "rings," 0.60, "picks" 0.53, "words." 0.70, "link." 0.54) and nothing else |

### Stills looked at

`out/ig/qa/ig6/infra-check/`: IG6-Preview f0, f100, f200, f290, f510, f700, f796, f839 and the cover; `gateP-30-contact.png`; `zones-full-contact.png` and `zones-crop34-contact.png` (the 32 check-zones images). Against `mock-one-ring.png` and the reference thumbnail, the placeholders put the lockup where the mock does, in the real faces: Instrument Sans lead, teal Cormorant Italic accent, grey tier, flat white, no grain. They have no dial or hand yet, as the builder says.

### Notes for the scene build (none is an infrastructure fault)

1. **Lockup leading.** In the `default` layout the Cormorant ascenders touch the lead's baseline (f200: the *ll* of *still* under "Someone’s"). This confirms the builder's observation. STYLE §9.8's numbers produce it; decide in the real Lockup.
2. **The End stub's comment pill sits in ig6's TikTok rail.** In f700 the pill's edge reaches x 905 and the send button x 883, below y 840 (the rail is x > 880). check-zones passes because the pill is not a checked rect, as in the delivered ig5. End6 proper should keep the pill at x ≤ 880.
3. **A second teal on the End stub.** The shared send button is `#22B8CF` (34, 184, 207), not the reel's `#0A8AA8`. The one-accent rule wants End6 proper to use ig6's tokens. The wordmark's plum and teal bloom are the stub's too (§9.10 sets near-black, no bloom).
4. **The Kokoro hook is 3.45 s**, over SCRIPT §5.3's ≤ 3.4 s for `ig6-01`. It is a placeholder, but the Cartesia pick must meet it (PIPELINE §4.2 step 3).

### Verdict

**PASS on every gate.** ig1–ig5's delivered files, masters, stamps (incl. ig5 `19ca5ef2038155ea`), sources and pictures are unchanged. Film 1 and film 2 are unchanged. The only changes to existing files are PIPELINE §3.2's four edits.

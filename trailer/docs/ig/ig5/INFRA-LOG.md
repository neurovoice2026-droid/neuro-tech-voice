# ig5 infrastructure log (PIPELINE.md §7.2 steps 1–3)

Run on 2026-10-07, 12:44–13:11 UTC, branch `claude/remotion-trailer`, 4 CPUs (idle apart from this run). All commands were run from `trailer/`.

HEAD was `95ef242` when the run started. The orchestrator committed `ac2b63e` (SCRIPT.md, POSTING.md, `voice-lines-draft.json`) at 12:46:37, just before the guard capture, so the baseline was taken at `ac2b63e`.

Nothing was committed or pushed. No `npm install` was run. `package-lock.json`, `tsconfig.json`, `remotion.config.ts` and `.gitignore` are untouched. `CARTESIA_API_KEY` was never read or printed: the voices are Kokoro, forced with `--engine=kokoro`.

**Result: every gate of steps 1–3 is green.** The one red result is the expected placeholder-only masking report from `check:audio:ig5` (see step 3).

---

## Step 1 · Baselines (all green before anything else was written)

Only `scripts/ig5/guard.mjs` was written before the capture, as §7.1 requires.

| # | Command | Result | Key numbers |
|---|---|---|---|
| 1 | `node --experimental-strip-types --no-warnings scripts/ig5/guard.mjs --capture` | **PASS** (137 s) | 257 files hashed. 24 ig1–ig4 Preview stills from a fresh `src/ig/index.ts` bundle. 38 composition rows. Listings: `src/ig/common/` 3, `scripts/ig/` 12, `public/ig/voice/` 33. Written to `out/ig5-guard/baseline/` (`meta.json` head `ac2b63e`). |
| 2 | `node scripts/kb/verify-film1.mjs --fast` | **PASS** 6/6 (52 s) | Gates 1 2 3 4 5 10. `mix.wav` `ec037282…`. generate-sfx skipped at `2efdbc5153019f3c`. timeline.json 101690 B identical. tsc and check:port pass. |
| 3 | `npm run verify:film2 -- --fast` | **PASS** 4/4 (2 min 50 s) | kbHash = stamp = `db3a9efa91f928f2`. 123 files identical (`mix.wav` `9c25a361…`, `bed.wav` `fe732796…`, 4 delivered MP4s). check-mix --film=kb stdout identical. |
| 4 | `npm run check:audio:ig` | **PASS** ×4 (36 s) | ig1 66 words, SII mean 0.97. ig2 50 words, 1.00. ig3 58 words, 0.98. ig4 68 words, 0.97. All `OK`. |

The guard capture's step 3 shows all four stamps CURRENT:

| Reel | igHash = stamp | Length | Impact |
|---|---|---|---|
| ig1 | `49b90ae44064d049` | 840 f | 780 |
| ig2 | `757d177d35b27cd6` | 840 f | 780 |
| ig3 | `47ae5cf315d3434b` | 780 f | 720 |
| ig4 | `f4500c7a37b6d47e` | 840 f | 780 |

The guard stills were taken at these frames:
- ig1: 0, 18, 104, 671, 796, 839
- ig2: 0, 18, 70, 692, 796, 839
- ig3: 0, 19, 76, 627, 736, 779
- ig4: 0, 14, 591, 680, 796, 839

---

## Step 2 · Infrastructure

| # | Action / command | Result |
|---|---|---|
| 5 | Wrote `scripts/ig5/films.mjs`, `hash.mjs` and `generate-sfx.mjs`. | Created. |
| 6 | `cp docs/ig/ig5/voice-lines-draft.json scripts/ig5/voice-lines-ig5.json` (byte copy). | 14 entries: 7 placed `ig5-01…07`, the borrow `{"id":"ig1-07","borrow":"ig1"}`, and 6 alternates (`ig5-02t`, `ig5-05t`, `ig5-06-msg`, `ig5-01b`, `ig5-07-bio`, `ig5-05-num`). Every id matches `^ig5-` except the borrow. The `level` and `voices` blocks are identical to `scripts/voice-lines-ig.json`. |
| 7 | Edited `scripts/registry.mjs`: merge `IG5_FILMS`, duplicate-id check across the three registries, `outName`-unique check. | `FILM_IDS` = main, kb, ig1–ig5. `main`, `kb` and `ig1–ig4` resolve to the identical objects (`===` checked). `--film=ig5` resolves to `outName` `neurotechvoice-ig5-dont-pay-300`. |
| 8 | Edited `package.json`: scripts only (§6.4). | Added `voice:ig5`, `sfx:ig5`, `sfx:ig5:force`, `check:audio:ig5`, `studio:ig5`, `guard:ig5`. Existing scripts and dependencies are unchanged; `check:port` is unchanged. |
| 9 | `guard.mjs --check --fast` (before the voice command). | **PASS**: 257/257, all stamps current. |
| 10 | `node scripts/generate-voice.mjs --film=ig5 --engine=kokoro` | **PASS** (63 s). 13 Kokoro takes plus the borrow, all at −23 LUFS (see below). |
| 11 | Write-set check: `find . -newer <marker>`, then `guard --check --fast`. | Only `public/ig/voice/ig5-*.wav` (13) and `src/ig/ig5/voice.generated.ts` changed. `ig1-07.wav` is unchanged (details below). Guard **PASS**. |

Kokoro take lengths from command 10:

| Line | Length |
|---|---|
| ig5-01 | 3.07 s |
| ig5-02 | 3.52 s |
| ig5-03 | 3.60 s |
| ig5-04 | 3.34 s |
| ig5-05 | 2.26 s |
| ig5-06 | 2.35 s |
| ig5-07 | 1.32 s |
| ig5-02t | 3.23 s |
| ig5-05t | 1.17 s |
| ig5-06-msg | 2.19 s |
| ig5-01b | 3.04 s |
| ig5-07-bio | 1.11 s |
| ig5-05-num | 2.28 s |

The borrow `ig1-07` was reported as `borrow … byte copy`.

**The ig1-07 self-copy is byte-identical.** Before and after the voice command it had the same:
- sha256 `c73b8a86…dd601035b`;
- size 179288;
- mtime 2026-10-06 13:39:20.680973007;
- inode 672482.

Its entry in `src/ig/ig5/voice.generated.ts` is JSON-identical to `src/ig/voice.generated.ts`'s, including `file` `ig/voice/ig1-07.wav`.

### Step 2 gate

| # | Command | Result | Key numbers |
|---|---|---|---|
| 12 | `npm run guard:ig5 -- --check` | **PASS** gates 1–5 (40 s) | 257/257 shas. Stamps unchanged. 38/38 composition rows, +0. Gate P 24/24 byte-identical. This also proves the renderer is deterministic across fresh bundles. |
| 13 | `node scripts/kb/verify-film1.mjs --fast` | **PASS** 6/6 | Same numbers as step 1. tsc passes with `src/ig/ig5/voice.generated.ts` present. |
| 14 | `npm run verify:film2 -- --fast` | **PASS** 4/4 | kbHash `db3a9efa91f928f2`, 123 files identical. |

---

## Step 3 · Picture plumbing

### Voices first

| # | Action / command | Result |
|---|---|---|
| 15 | Wrote `src/ig/voices.ts`: `VOICE = { ...IG, lines: { ...IG5.lines, ...IG.lines } }`. | Created. Its own entries win, and it is outside `common/`. |
| 15 | In `src/ig/components/{Captions,End,Orb,Call}.tsx` and `screens.ts`: `'../voice.generated'` → `'../voices'`. | One line each. |
| 16 | `npx tsc --noEmit -p .` | **PASS** (exit 0) |
| 17 | `npm run guard:ig5 -- --check` | **PASS** gates 1–5. **Gate P: 24/24 ig1–ig4 stills byte-identical.** 257/257 shas, stamps unchanged. |

### Then the reel

| # | Action / command | Result |
|---|---|---|
| 18 | Wrote `src/ig/ig5/timing.ts`, `acts/Acts.tsx`, `Reel5.tsx` and `Cover.tsx`. | Created. |
| 18 | `src/ig/Root.tsx`: 3 imports plus the `{ n: 5, T: T5, Reel: Reel5, Cover: Cover5 }` row. | Edited. |
| 19 | Edits 9–10 in `scripts/ig/check-zones.mjs` and `scripts/ig/check-delivery.mjs`. | `IG_FILMS` / `IG_IDS` now come from `../registry.mjs`, filtered to `/^ig\d+$/`. Known reels are ig1–ig5; `--film=ig9` still throws "unknown reel". |

The provisional timeline from command 18 is rung 0, the full cast (no trim needed with the Kokoro takes). It runs **28.0 s = 840 f**, with IMPACT 780, END 840 and BRAND_AT 784.

| Line | Start | End |
|---|---|---|
| ig5-01 | 9 | 102 |
| ig5-02 | 124 | 230 |
| ig5-03 | 236 | 344 |
| ig5-04 | 356 | 457 |
| ig5-05 | 465 | 533 |
| ig5-06 | 574 | 645 |
| ig5-07 | 694 | 734 |
| ig1-07 | 784 | 825 |

| Act | Frames |
|---|---|
| hook | 0–122 |
| agency | 122–234 |
| answering | 234–354 |
| ours | 354–462 |
| setup | 462–571 |
| does | 571–686 |
| end | 686–840 |

END_CARD:

| Moment | Frame |
|---|---|
| cta | 694 |
| field | 688 |
| agent | 706 |
| send | 734 |
| roll | 750 |
| impact | 780 |
| url | 785 / 797 / 809 |
| seam | 826 |

The stop-time `STOP` is [353, 384). The sheet has 15 cues and 14 cue files: 13 from the shared lib plus `ig/sfx/fx-impact-end.wav`.

### Step 3 gate

| # | Command | Result | Key numbers |
|---|---|---|---|
| 20 | `npx tsc --noEmit -p .` | **PASS** (exit 0) | |
| 21 | `npm run guard:ig5 -- --check` | **PASS** gates 1–5 (37 s) | 255/257 shas identical. The 2 changed files are edits 9–10, reported as "allowed" (QA-only, outside igHash). Stamps unchanged. 38/38 rows present, plus 11 IG5 rows. **Gate P 24/24 byte-identical.** |
| 22 | `npm run check:audio:ig` | **PASS** ×4 | stdout identical to step 1's. |
| 23 | `guard --check --fast`, then `npm run sfx:ig` | **PASS** | `library: 63 sounds … (all present)`. `ig1: up to date (49b90ae44064d049) — skipped`, then ig2 `757d177d35b27cd6`, ig3 `47ae5cf315d3434b`, ig4 `f4500c7a37b6d47e`, all skipped. `0 built, 4 up to date`. |
| 24 | `npm run sfx:ig5` | **PASS** (9.9 s) | 13 shared lib files read-only and sha-checked, plus the shared `fx-impact-end`. Bed composed (`scripts/ig/bed.mjs` stub), −20.0 dBFS peak. Master −14.0 LUFS, −1.65 dBTP, gain +5.9 dB, limiter 7.2 dB. Wrote `public/ig/sfx/ig5/{mix.wav, mix.json, bed.wav, bed.json}` and stems in `out/audio/ig/ig5/`. `.tmp-ig5` was removed. Stamp `ig5Hash` = `f8888931ef51d820`. |
| 24b | `npm run sfx:ig5` again | **PASS** | `ig5: up to date (f8888931ef51d820) — skipped` |
| 25 | `npm run check:audio:ig5` | **FAIL**: 7 problems, all placeholder masking (see below) | Everything except word masking is within target (see below). |
| 26 | `NTV_SKIP_SFX=1 npx remotion compositions src/ig/index.ts` | **PASS** | IG5 rows listed below. The ig1–ig4 and IG- rows are identical in content and order to the baseline (whitespace-normalised diff empty; raw padding also unchanged). |
| 27 | `NTV_SKIP_SFX=1 npx remotion bundle src/ig/index.ts --out-dir out/ig/qa/ig5/infra/.bundle`, then `npx remotion still <bundle> IG5-Preview-9x16 … --frame=N` for N = 0, 420, 796, then 726 from a second bundle. Both temporary bundle folders were removed with `rm -r` on the exact path. | **PASS** | Stills are listed below; all four were looked at. |

Command 25 in detail. These are within target:
- master −14.0 LUFS, −1.65 dBTP;
- dialogue files −23 LUFS ± 0.00, stem spread 0.3 LU;
- climax lead +1.5 LU;
- end: last 100 ms −77.0 dBFS, last frame −86.6, chord 10–5 f from the end −53.5 dBFS;
- arc lead +3.3 LU;
- the name (ig1-07) SII 0.97 / 1.00 / 0.99.

The 7 FAILs are word masking under the stub bed (or the end card's keys):

| Word | Line @ frame | SII |
|---|---|---|
| "a" | ig5-01 @48 | 0.28 |
| "service:" | ig5-03 @260 | 0.65 |
| "from" | ig5-03 @272 | 0.53 |
| "fifty" | ig5-03 @324 | 0.63 |
| "minutes." | ig5-03 @332 | 0.63 |
| "minutes." | ig5-05 @520 | 0.69 |
| "link." | ig5-07 @725 | 0.58 |

All 7 are on Kokoro takes over the unarranged stub bed at its placeholder +6 dB ride, plus "link." being covered by AGENT's 5th key because the Kokoro CTA is short. None of them is an infrastructure fault. They go away with the Cartesia takes, the real HITS and the bed ride (§7.2 steps 4–5). As instructed, they are reported rather than failing the step.

Command 26, the 11 IG5 rows:

| Composition | fps | Size | Length |
|---|---|---|---|
| `IG5-Reel-9x16` | 120 | 1080x1920 | 3360 f (28.00 s) |
| `IG5-Preview-9x16` | 30 | 1080x1920 | 840 f |
| `IG5-Cover-9x16` | | 1080x1920 | Still |

Plus `IG5-{Hook,Agency,Answering,Ours,Setup,Does,End}-9x16` and `IG5-Zones-9x16`.

Command 27, the stills in `out/ig/qa/ig5/infra/`:
- `ig5-preview-f000.png`: S1 "Don't pay $300 a month" set at 72 %.
- `ig5-preview-f420.png`: the Ours act, "Ours? From $49 a month."
- `ig5-preview-f796.png`: the shared end card, NEUROVOICE wordmark, URL typing "neuro".
- `ig5-preview-f726.png`: an extra one. The CTA "Comment AGENT for the link." with AGENT in teal, and the comment field typed "AGENT". It proves the shared End/Captions read ig5's lines through `voices.ts`.

### Final re-check

| # | Command | Result | Key numbers |
|---|---|---|---|
| 28 | `guard.mjs --check --fast` | **PASS** | 255/257, plus 2 allowed. `public/ig/sfx/ig5/` present and allowed. |
| 29 | `node scripts/kb/verify-film1.mjs --fast` | **PASS** 6/6 | |
| 30 | `npm run verify:film2 -- --fast` | **PASS** 4/4 | |

No two renders and no render plus verify-film1 ever ran at once. Every command above ran sequentially.

---

## Files

`git diff --name-only HEAD` gives these 10 files. They are exactly the §7.1 allowed set:

```
trailer/package.json
trailer/scripts/ig/check-delivery.mjs
trailer/scripts/ig/check-zones.mjs
trailer/scripts/registry.mjs
trailer/src/ig/Root.tsx
trailer/src/ig/components/Call.tsx
trailer/src/ig/components/Captions.tsx
trailer/src/ig/components/End.tsx
trailer/src/ig/components/Orb.tsx
trailer/src/ig/components/screens.ts
```

`git status --porcelain` shows new paths only under the allowed prefixes:

```
?? trailer/public/ig/voice/ig5-{01,01b,02,02t,03,04,05,05-num,05t,06,06-msg,07,07-bio}.wav   (13)
?? trailer/scripts/ig5/{films.mjs, generate-sfx.mjs, guard.mjs, hash.mjs, voice-lines-ig5.json}
?? trailer/src/ig/ig5/{Cover.tsx, Reel5.tsx, acts/Acts.tsx, timing.ts, voice.generated.ts}
?? trailer/src/ig/voices.ts
?? trailer/docs/ig/ig5/INFRA-LOG.md   (this file)
```

Ignored outputs, which are not in git:
- `public/ig/sfx/ig5/{mix.wav, mix.json, bed.wav, bed.json}`;
- `out/audio/ig/ig5/{stem-*.wav, cue-timeline.txt}`;
- `out/ig5-guard/{baseline/, check/}`;
- `out/ig/qa/ig5/infra/*.png`.

`check:audio:ig` rewrote `out/audio/ig/ig[1-4]/cue-timeline.txt` with identical stdout.

---

## Deviations from PIPELINE.md, and why

1. **Voice lines source.** `docs/ig/ig5/voice-lines-draft.json` appeared at HEAD `ac2b63e` during the run, so it was used, byte for byte, as the task context prescribes. The draft-A fallback was not needed. This adds the script's final lines (for example "Ours? From forty-nine…" and "You set it up yourself…") and 6 alternates, all `ig5-*`.
2. **Guard coverage is a superset of §7.1.** It also hashes:
   - `out/master/IG1…IG4-Reel-9x16-x1/**` (§3.3 lists them as untouched);
   - `out/audio/ig/ig[1-4]/stem-*.wav` (`sfx:ig`'s skip condition);
   - all of `scripts/ig/**` recursively.

   It also checks the public layout (public/ig only sfx/ and voice/; voice/ gains only ig5-*.wav; sfx/ gains only ig5/; no public/ig5) and that `sfx:ig` would skip (MIX.file + 4 stems present). It adds `--fast` (gates 1–3, about 1 s) for between-command checks. Edits 9–10 are the only changes allowed inside the guarded sets.

   `out/master/bundle-ig` does not exist at this HEAD, so there was nothing to capture for it.

   The still frames were chosen as follows: "two caption onsets" = the first two caption-kind span onsets + 8 f (check-zones' rule); "the CTA field" = `END_CARD.field + 10`.
3. **`scripts/ig5/films.mjs` guards.** They check `outName` (`neurotechvoice-ig5-` prefix), `stamp`, `voiceTs`, `voiceLines`, `sfxDriver`/`hash`, `qa`, `bundle` and `comp`. MIX.file and BED.file live in `timing.ts`, and a plain-data registry cannot import TS without a cycle (timing → voice data), so their `ig/sfx/ig5/` rule is enforced by the ig5 driver's contract instead (`dirname === 'ig/sfx/ig5'`).
4. **`ig5Hash` hashes every top-level `.ts` in `src/ig/ig5/`.** §5.2 names only `voice.generated.ts`; `timing.ts` is already in igHash. This is a superset, so a helper module that `timing.ts` might later import is covered. A picture-only `.ts` there only costs a ~10 s rebuild. It also hashes `scripts/ig5/*.mjs` except `guard.mjs`, and `public/ig/sfx/ig5/lib.json` if present.
5. **ig5 driver.** Own cue files are restricted to `ig/sfx/ig5/lib/<name>.wav` (byte copies, recorded in `public/ig/sfx/ig5/lib.json`) or `ig/sfx/ig5/fx-*.wav` (from a future `scripts/ig5/sounds.mjs`). A shared-lib cue must exist and match the shared `lib.json` sha. A `publish()` guard refuses any write outside `public/ig/sfx/ig5/`. The bed prefers `scripts/ig5/bed.mjs` automatically once it exists (§5.3), and otherwise imports the IG stub.
6. **Provisional `timing.ts`** (designed to be replaced):
   - `CASTS` implements SCRIPT §4.3's trim ladder (full → T1 → T1 + T2); the first rung that keeps the impact on f780 is placed. The launch-gate swap (`ig5-06-msg`) and the A/B hook (`ig5-01b`) are one id each there.
   - The hook sits at f9, not f6, because `afterRing` lets the frame-0 trill ring out.
   - The `end` act starts at min(CTA − 4, field − 2) = CTA − 8. SCRIPT puts the comment field at f688, before its own `end` act start at f690.
   - `M` and `ZONE_FRAMES` are empty.
   - HITS are only the series' frame: the f0 trill with ig4's HEAD −4 dB, `endHits`, the riser, and `impactHits`.
   - The bed ride is ig3's shape, and `MUSIC.stop` is SCRIPT's measured-onset rule.
   - The placeholder shows ig5-04's screens as captions; SCRIPT prints them on the "ours" slip.
7. **Edits 9–10 side effect.** `check:zones:ig -- --all` and `check:delivery:ig -- --all` now include ig5. `--all` on check-delivery will fail for ig5 until ig5 is delivered.
8. **`Root.tsx` header comment** was not updated, to keep the edit to the planned 3 imports + 1 row.
9. **4 stills instead of 3.** f726 was added to prove the AGENT field.

`generate-voice` was run without `--preview`, so no `out/ig/ig5-preview.wav` exists yet.

---

## Independent check

Run on 2026-10-07, 13:13–13:25 UTC, by a separate gate-checker that trusted none of the builder's report. Every gate was re-run from `trailer/`, one at a time, on an otherwise idle machine. HEAD is `ac2b63e`. Nothing was fixed, because nothing was red. The only writes were this section, the guard's own `out/ig5-guard/check/`, and `out/audio/ig/ig[1-5]/cue-timeline.txt` (rewritten by check-mix; the ig1–ig4 files are md5-identical before and after).

| Gate | Command | Result | Evidence |
|---|---|---|---|
| Guard, full | `node --experimental-strip-types --no-warnings scripts/ig5/guard.mjs --check` | **PASS** gates 1–5 (38 s) | 255/257 shas identical; the 2 changes are edits 9–10, flagged as allowed. Stamps ig1 `49b90ae44064d049`, ig2 `757d177d35b27cd6`, ig3 `47ae5cf315d3434b`, ig4 `f4500c7a37b6d47e`. 38/38 rows plus 11 IG5 rows. **Gate P: 24/24 stills byte-identical.** |
| Film 1 | `node scripts/kb/verify-film1.mjs --fast` | **PASS** 6/6 (46 s) | Gate 1: 28 paths match `8b9cd21`, no untracked files. `mix.wav` `ec037282…`. Skip at `2efdbc5153019f3c`. timeline.json 101690 B identical. tsc and check:port pass. |
| Film 2 | `npm run verify:film2 -- --fast` | **PASS** 4/4 (1 min 22 s) | kbHash = stamp = `db3a9efa91f928f2`. 123 files identical, the 4 delivered MP4s among them. check-mix --film=kb stdout identical. |
| ig1–ig4 sound | `npm run check:audio:ig` | **PASS** ×4 (37 s) | All `OK`. Words and mean SII: 66 / 0.97, 50 / 1.00, 58 / 0.98, 68 / 0.97 (the same as step 1). |
| ig1–ig4 skip | `npm run sfx:ig` (after guard `--fast`) | **PASS** | `library: 63 sounds … (all present)`. Each of ig1–ig4 printed `up to date (<stamp>) — skipped`; `0 built, 4 up to date`. |
| Typecheck | `npx tsc --noEmit -p .` | **PASS** (exit 0) | `--listFiles` includes `src/ig/voices.ts` and all 5 files under `src/ig/ig5/`. |
| Compositions | `NTV_SKIP_SFX=1 npx remotion compositions src/ig/index.ts` | **PASS** | 11 IG5 rows, among them `IG5-Reel-9x16` (120 fps, 1080x1920, 3360 f), `IG5-Preview-9x16` (30 fps, 840 f) and `IG5-Cover-9x16` (Still). Without the IG5 rows, the table is **raw-identical** to `out/ig5-guard/baseline/compositions.txt` (40 lines, padding included). |
| Git: diff | `git diff --name-only HEAD` | **PASS** | Exactly the 10 allowed files. Nothing is staged or deleted. |
| Git: new paths | `git status --porcelain --untracked-files=all` | **PASS** | 13 `public/ig/voice/ig5-*.wav`, 5 files in `scripts/ig5/`, 5 in `src/ig/ig5/`, `src/ig/voices.ts` and `docs/ig/ig5/INFRA-LOG.md`. Nothing else. |
| Film 1 frozen set | `git status --porcelain` on `src/{components,scenes,lib,dev}`, `src/{timing,theme,Root,index,Trailer,Soundtrack,voice.generated,css.d}`, `scripts/audio`, `scripts/generate-sfx.mjs`, `public/{voice,sfx,img}`, `scripts/voice-lines.json`, `tsconfig.json`, `package-lock.json`, `remotion.config.ts`, `.gitignore` | **PASS** (empty) | |
| Film 2 frozen set | `git status --porcelain` on `src/kb`, `scripts/kb`, `public/kb`, `scripts/films.mjs`, `scripts/voice-lines-kb.json` | **PASS** (empty) | |
| IG shared sources | `git status --porcelain` on `scripts/ig/{films,generate-sfx,bed,sounds,hash,render-par,finish,verify-film2}.mjs`, `scripts/voice-lines-ig.json`, `src/ig/voice.generated.ts`, `src/ig/common`, `src/ig/ig1…ig4`, `src/ig/{Reel,scene,types,Soundtrack,index}` | **PASS** (empty) | |
| Delivered files | sha256 of `out/ig/deliver/**` and `out/ig/master/*.mp4` | **PASS** | All 20 files (12 deliverables, 4 profile PNGs, 4 HEVC masters) match the guard baseline. The 12 deliverables **also match PIPELINE.md §9's prefixes**, which were written before the builder ran: `edfc55ce` `14202a61` `84cf96c0` `a51ba168` `edb7395e` `4e7194f8` `b45bbb22` `aa364a3b` `ac8b0f92` `a84e97ee` `1eb0b9f4` `cd1a3398`. Every mtime is 2026-10-06, or 07:59 on 10-07 for the profile PNGs. |
| Ignored shared sounds | mtimes, checked independently of the guard baseline | **PASS** | Nothing in `public/ig/sfx/{lib/, lib.json, fx-impact-end.wav, ig1…ig4/}` or `public/ig/voice/ig[1-4]-*` is newer than 2026-10-06 21:19. |

### Additional checks, beyond the list

- **Registry:** `FILM_IDS` = main, kb, ig1–ig5. `main`, `kb` and ig1–ig4 are `===` the objects of `scripts/films.mjs` and `scripts/ig/films.mjs`.
- **Edits 9–10 (regression check):** `check-delivery --film=ig1` still passes. It returned ✓ for both files (27.31 MB, L51/L42, −14.31 LUFS, −1.37 dBTP, elst none, sync lag 0 in 20/20). `--film=ig9` still throws "unknown reel" in both tools.
- **Voice lines:**
  - `scripts/ig5/voice-lines-ig5.json` is byte-identical (`cmp`) to `docs/ig/ig5/voice-lines-draft.json` at HEAD.
  - It has 14 lines and no duplicates: every id is `^ig5-` except `{"id":"ig1-07","borrow":"ig1"}`, which has exactly those two keys.
  - Its `level` and `voices` blocks are JSON-equal to `scripts/voice-lines-ig.json`.
- **ig5 sound:**
  - `npm run sfx:ig5` printed `up to date (f8888931ef51d820) — skipped`.
  - `npm run check:audio:ig5` reproduces the builder's numbers exactly: −14.0 LUFS, −1.65 dBTP, climax +1.5 LU, arc +3.3 LU, and the same **7 masking FAILs** (`a` 0.28, `service:` 0.65, `from` 0.53, `fifty` 0.63, `minutes.` 0.63 and 0.69, `link.` 0.58 under `fx-keys-4`).
  - Its dialogue stems (−19.9 to −20.2) sit in the same band as ig1–ig4's, so this is the expected placeholder masking, not an infrastructure fault.
- **Stray imports:** no file in `src/ig/` outside `ig1…ig4/` still imports `../voice.generated`; only comments mention it. All five shared parts read `../voices`.
- **Cleanup:** no temp folders are left over (`out/ig5-guard/bundle`, `out/audio/ig/.tmp-ig5` and `out/ig/qa/ig5/infra/.bundle` are all gone). `CARTESIA_API_KEY` appears in no new or changed file (searched by value, never printed).
- **Stills:** f420 shows "Ours? From $49 a month." on the Ours title card. f726 shows "Comment AGENT for the link." with AGENT in teal, and the comment field typed AGENT.
- **Final** `guard --check --fast`, after every command above: **PASS**.

### Diff review (PIPELINE.md §3.2)

- **Edits 4–8:** one line each, `'../voice.generated'` → `'../voices'`. Minimal.
- **Edits 9–10:** the `./films.mjs` import is replaced by `FILMS` from `../registry.mjs`, filtered to `/^ig\d+$/` (4 lines plus a comment). Minimal. Both files are in `scripts/ig/hash.mjs`'s QA_ONLY, which unchanged stamps confirm.
- **`src/ig/Root.tsx`:** 3 imports and 1 `REELS` row. Minimal.
- **`package.json`:** the 6 §6.4 scripts were appended, and the only other change is the trailing comma on `verify:film2`. Existing scripts and dependencies are untouched.
- **`scripts/registry.mjs`:** does what §3.2 edit 1 asks: the import, the three-registry duplicate check (it replaces the old two-registry line with the same effect), the spread, and the `outName`-unique assertion. It also rewrites the header comment, which is comment-only and harmless.

**Verdict: PASS.** Every infrastructure gate is green on re-run, and nothing needed fixing. `check:audio:ig5` is the only red result: it is the known placeholder masking report and closes with the Cartesia takes and the real bed, cues and HITS (§7.2 steps 4–5).

---

## Scene step · the one shared edit: `src/ig/components/ZoneGuard.tsx` (per-reel zones, SCRIPT §1.3)

Run on 2026-10-07 by the picture build (label `picture`, docs/ig/ig5/BUILD.md). It is the ONE extra shared edit the brief allows. `components/` is in no hash (igHash, kbHash, film 1's), so ig1–ig4 stay CURRENT; the proofs below show their picture is unchanged in both modes.

**The change (+23 −1 lines, additive):**
- `registerZones(reel, { faults, coverFaults?, overlay? })`: a module-level registry keyed by the reel id the shared `ZoneProvider` already carries (`IgReel` sets `reel: T.REEL`, `CoverCard` sets `reel: spec.reel`), so neither `Reel.tsx` nor `CoverCard.tsx` changes.
- `ZoneRect`: a registered reel's rects go through its `faults(rect, what)` (the label lets a rule tell a `price …` numeral or an `object …` from text); an unregistered reel goes through `zoneFaults` / `coverFaults` exactly as before.
- `ZoneOverlay`: a registered reel's `overlay` replaces the Instagram bands; otherwise the original JSX, unchanged.
- ig5's rule is `src/ig/ig5/zones.ts` (SCRIPT §1.2 values; Node-safe; never in `common/`), registered by `src/ig/ig5/stage/Zones.tsx` from `Reel5.tsx` and `Cover.tsx` at module scope. `zones.ts` is a top-level `.ts` of `src/ig/ig5/`, so it is in `ig5Hash`; the ig5 mix was restamped (`sfx:ig5`, same cues).

| # | Check | Result |
|---|---|---|
| 1 | `npm run guard:ig5 -- --check` (fresh bundle) | **PASS** gates 1–5 (38 s): 255/257 shas (the 2 allowed QA edits), stamps ig1 `49b90ae44064d049` · ig2 `757d177d35b27cd6` · ig3 `47ae5cf315d3434b` · ig4 `f4500c7a37b6d47e`, 38/38 rows + 11 IG5, **gate P 24/24 byte-identical** (`out/ig/qa/ig5/picture/guard.log`) |
| 2 | Zone mode (gate P renders zones-off stills only): ig1–ig4 `IG<n>-Zones-9x16` at 4 frames each (ig1 0/104/671/796, ig2 0/70/692/796, ig3 0/76/627/736, ig4 0/591/680/796) + the four covers with `{"zones":true}`, from a bundle with the **pre-edit ZoneGuard (8f62e3d)** and from one with the edit | **20/20 PNGs byte-identical** (`out/ig/qa/ig5/picture/zoneguard-proof/{before,after}/`). The before-bundle's ZoneGuard was 8f62e3d's file plus a no-op `registerZones` export (ig5's modules call it at import; ig1–ig4 never do); the edited file was restored right after (`cmp` against the saved copy; `git diff` empty against HEAD, which already carries it) |
| 3 | `npm run check:zones:ig -- --film=ig5 --selftest` | **PASS**: 36 zone stills + the cover against ig5's rule; the selftest probe is caught (`right 1050 > 900`) |
| 4 | `npm run sfx:ig` | `0 built, 4 up to date` |
| 5 | film 1 / film 2 frozen sets, IG shared sources (`git status --porcelain`) | empty |

PIPELINE §7.1's allowed `git diff` list now names `src/ig/components/ZoneGuard.tsx`.


## Fix round 2 (label `fix-r2`, 2026-10-07): no shared edit

The round-2 fixer touched no shared file: `src/ig/components/ZoneGuard.tsx` and everything else under `src/ig/components/`, `src/ig/common/`, `scripts/ig/` are unchanged (`git status --porcelain` lists only `src/ig/ig5/**` and `docs/ig/ig5/**`). `guard:ig5 -- --check` **PASS** gates 1–5 (255/257 shas, the 2 allowed QA edits; stamps unchanged; gate P 24/24 byte-identical: `out/ig/qa/ig5/fix-r2/guard.log`); `sfx:ig` 0 built, 4 up to date; the film 1 / film 2 frozen sets are clean. The ig5 timeline moved (BUILD §7), so `sfx:ig5` restamped ig5's own mix.

# ig6 · "One ring" (DELIVERY)

Label `master`. Written 2026-10-12, 03:42–04:20 UTC, on `claude/remotion-trailer`, starting at HEAD `eb106c8` (the orchestrator committed `5ad393e` during the B pass; see §7). This run mastered and delivered ig6 by `PIPELINE.md` §6.2, §6.4 and §7.2 steps 7–8. It made **both cuts, A first, then B**. Nothing was committed or pushed. No `npm install` was run, no shared file was edited, and `CARTESIA_API_KEY` was never read.

Paths are relative to `trailer/`. The sha256 prefixes are the first 16 hex digits. The full list is in `out/ig/qa/ig6/deliver/gates/sha256.txt`.

---

## 1. Files

**Delivered** (`out/ig/deliver/`):

| File | What it is | Bytes | sha256 | Post |
|---|---|---|---|---|
| `neurotechvoice-ig6-one-ring-a-1080p60-ig.mp4` | **Cut A** (hook `ig6-01`: "…Your receptionist can't answer."). 1080×1920, 60 fps, H.264 High L4.2, AAC 192k | 27,760,924 | `359a5763a8dab22c` | **TikTok and Instagram** (POSTING §1) |
| `neurotechvoice-ig6-one-ring-a-1080p120.mp4` | Cut A, 120 fps, H.264 High L5.1 | 27,896,984 | `de26fdb463853f04` | archive / other platforms |
| `neurotechvoice-ig6-one-ring-b-1080p60-ig.mp4` | **Cut B** (hook `ig6-01b`: "…You can't answer."), same spec | 27,755,190 | `105768c4dfb169e8` | TikTok re-cut, a week later (POSTING §8) |
| `neurotechvoice-ig6-one-ring-b-1080p120.mp4` | Cut B, 120 fps, H.264 High L5.1 | 27,864,974 | `384cd60041cbcea8` | archive |
| `neurotechvoice-ig6-one-ring-cover.png` | Cover, 1080×1920 (`IG6-Cover-9x16`) | 183,212 | `5f8d5ba4ac250a66` | custom cover for the A posts (cut B uses frame 0) |

- **The cover is byte-identical from both passes** (`5f8d5ba4…` both times). Its text is fixed in `Cover.tsx` and does not depend on the cut. It keeps the unsuffixed name that POSTING §1 lists. Every ig6 **video** in `out/ig/deliver/` carries `-a-` or `-b-`.
- **The 3:4 grid crop** is `out/ig/qa/ig6/cover-34.png` (1080×1440, y 240–1680, 95,973 B, `ad069d0a8f354003`, identical from both passes). The kicker, title and stakes line all sit inside it.

**Picture masters** (`out/ig/master/`). Each is muted HEVC Main, 3360 frames at 120 fps, joined from 8 act-aligned chunks:

| File | Bytes | sha256 | Bundle sha |
|---|---|---|---|
| `neurotechvoice-ig6-one-ring-a-1080p120-hevc.mp4` | 15,967,866 | `4e9a0c2c560ce5b0` | `49824ddfe63f8dd2` |
| `neurotechvoice-ig6-one-ring-b-1080p120-hevc.mp4` | 15,872,855 | `1c2bb12fd747222a` | `22571c023299cc09` |

**Mixes:**

| Cut | Stamp (`ig6Hash`) | `mix.wav` sha256 | State |
|---|---|---|---|
| A | `eb6657700cc1c94c` | `2aadbcca205b9cc5` | **in place** (`public/ig/sfx/ig6/mix.wav`). It was rebuilt after the B pass and matches the A pass byte for byte. |
| B | `cc34eeeda0060923` | `ebdeef2067a2072e` | rebuilt by `npm run sfx:ig6` with `CAST = 'B'` |

Both mixes measure −14.0 LUFS and −1.65 dBTP. They are the same stamps that fix-r2 recorded (BUILD §11.4).

---

## 2. What was run, in order

| # | Step | Result |
|---|---|---|
| 1 | `CAST = 'A'` (as committed; `timing.ts` sha256 `bd0afbc6…`). `tsc`, `sfx:ig6`, `check:audio:ig6` | exit 0 · skipped (`eb6657700cc1c94c`) · **OK**: climax +1.3, arc +2.1, words lowest 0.90 |
| 2 | `guard:ig6 -- --check` (full), `sfx:ig`, `sfx:ig5` | **PASS 1–6** (gate P 30/30) · 0 built, 4 up to date · skipped (`19ca5ef2038155ea`) |
| 3 | `render:ig -- --film=ig6 --dry-run`, then `--rebundle` (2 workers) | 8 chunks · 3360 frames in **4 min 3 s** (0.10–0.18 s per frame) → 15.2 MiB master |
| 4 | `check:zones:ig -- --film=ig6 --bundle=out/master/bundle-ig6` | **PASS**: no zone violation (15 zone stills plus the cover, `out/ig/qa/ig6/zones/`) |
| 5 | `finish:ig -- --film=ig6`, then `check:delivery:ig -- --film=ig6` | 27.90 / 27.76 MB (one two-pass each at 7568 kb/s, no size-loop retry) · **✓ both files** (§3) |
| 6 | Record the shas, then rename A's 3 files to `…-one-ring-a-…` (`mv` on the exact names) | done. There was no `-x1-<suffix>` layer folder to clear |
| 7 | `CAST = 'B'` (the one-line edit). `tsc`, `sfx:ig6`, `check:audio:ig6` | exit 0 · built `cc34eeeda0060923` · **OK**: climax +1.3, arc +2.0, words lowest 0.90 |
| 8 | `guard:ig6 -- --check`, `sfx:ig`, `sfx:ig5` | **gates 1–5 PASS** (gate P 30/30). Gate 6 fails on `src/ig/ig6/timing.ts` alone (§7) · 0 built · skipped |
| 9 | `render:ig --dry-run`, then `--rebundle` | the 16 A chunk files were deleted as "another plan" · 3360 frames in **4 min 0 s** → 15.1 MiB |
| 10 | `check:zones:ig -- --film=ig6 --bundle=out/master/bundle-ig6` | **PASS** |
| 11 | `finish:ig`, `check:delivery:ig` | 27.86 / 27.76 MB · **✓ both files** · cover `cmp`-identical to A's |
| 12 | Rename B's 3 files to `…-one-ring-b-…` | done |
| 13 | `CAST = 'A'` restored (sha256 `bd0afbc6…`, checked); `sfx:ig6` rebuilt the A mix | `eb6657700cc1c94c`, `mix.wav` = the A pass's `2aadbcca…` |

**`check:delivery:ig`** was run before each rename, because it reads `<outName>-*` and locks each file to the mix in place at that moment:

| File | Size | Video | Audio | Loudness (decoded AAC) | Peak (decoded AAC) | elst | Lock |
|---|---|---|---|---|---|---|---|
| A 120 | 27,896,984 B | h264 High L5.1 1080×1920 120/1 | AAC LC 202k | −14.33 LUFS | −1.37 dBTP | none | lag 0 in 20/20 windows |
| A 60 | 27,760,924 B | h264 High L4.2 1080×1920 60/1 | AAC LC 202k | −14.33 LUFS | −1.37 dBTP | none | lag 0 in 20/20 windows |
| B 120 | 27,864,974 B | h264 High L5.1 1080×1920 120/1 | AAC LC 201k | −14.33 LUFS | −1.38 dBTP | none | lag 0 in 20/20 windows |
| B 60 | 27,755,190 B | h264 High L4.2 1080×1920 60/1 | AAC LC 201k | −14.33 LUFS | −1.38 dBTP | none | lag 0 in 20/20 windows |

Every file also passed the following:
- the four BT.709 tags (matrix, primaries, transfer, tv range);
- yuv420p, avc1, and moov before mdat;
- both streams starting at 0;
- the duration (28.0 s ± 1 frame) and the frame count (3360 / 1680).

The decoded peaks are exactly fix-r2's AAC predictions (−1.37 / −1.38). No mastering change was needed.

The logs are in `out/ig/qa/ig6/deliver/{a,b}/`.

---

## 3. Gates before handing back

Each gate ran alone, after both passes. `timing.ts` was back on cut A.

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit -p .` | exit 0 |
| Film 1, full | `node scripts/kb/verify-film1.mjs` | **PASS 11/11** (5 min 19 s):<br>· the frozen set matches `8b9cd21`<br>· 116 files, `mix.wav` `ec037282…`<br>· skip `2efdbc5153019f3c`<br>· 4 MP4s<br>· 18 compositions<br>· the bundle's 185 files<br>· 35/35 stills byte-identical<br>· tsc + check:port<br>· render-master dry-run |
| Film 2, full | `npm run verify:film2` | **PASS 7/7** (3 min 18 s): kbHash `db3a9efa91f928f2`; 123 files, the 4 delivered MP4s among them; bundle digest `269c7b3c…`; check-render identical |
| ig1–ig5 invariance | `npm run guard:ig6 -- --check` | **Gates 1–5 PASS**:<br>· 1747/1747 shas byte-identical, 19 delivered prefixes, so every ig1–ig5 delivered file, master and stamp is unchanged<br>· listings<br>· stamps ig1 `49b90ae44064d049`, ig2 `757d177d35b27cd6`, ig3 `47ae5cf315d3434b`, ig4 `f4500c7a37b6d47e`, ig5 `19ca5ef2038155ea`<br>· compositions (49 rows + 12 IG6)<br>· **gate P 30/30 byte-identical**<br>The only new files are the 7 `neurotechvoice-ig6-*`. **Gate 6 FAILS on `src/ig/ig6/timing.ts` alone** (§7) |
| ig1–ig4 sound | `npm run check:audio:ig` | **OK ×4**: climax +1.7 / +1.3 / +1.1 / +1.1 LU |
| ig1–ig4 skip | `npm run sfx:ig` | `0 built, 4 up to date` |
| ig5 sound | `npm run check:audio:ig5` | **OK**: −14.0 LUFS, −1.65 dBTP, climax +1.2, arc +0.7, words lowest "up" 0.83 |
| ig5 skip | `npm run sfx:ig5` | `up to date (19ca5ef2038155ea) — skipped` |
| ig6 sound (cut A, in place) | `npm run check:audio:ig6` | **OK**: −14.0 LUFS, −1.65 dBTP, climax +1.3 LU, arc +2.1 LU, 45 words with mean 0.97 and lowest 0.90 |
| ig6 skip | `npm run sfx:ig6` | `up to date (eb6657700cc1c94c) — skipped` |
| Frozen sets | `git status --porcelain` on the film 1 / film 2 paths in the brief | **empty** |
| IG shared | `git status --porcelain` on `scripts/ig`, `scripts/ig5`, `src/ig/ig1…ig5`, `src/ig/common`, `src/ig/components`, `src/ig/voice.generated.ts`, `scripts/voice-lines-ig.json`, `public/ig/voice` | **empty** |
| Git | `git status --porcelain` | only `M trailer/src/ig/ig6/timing.ts` (`CAST 'B'` → `'A'` against HEAD `5ad393e`) |

The logs are in `out/ig/qa/ig6/deliver/gates/`.

---

## 4. The final frames, by eye

Six frames were taken from each 60 fps upload file: 0, 1.5, 5, 13, 20 and 26 s (60 fps frames 0, 90, 300, 780, 1200 and 1560). They are decoded BT.709 tv to full range and saved in `out/ig/qa/ig6/final/{a,b}/`, each folder with a `sheet.png`. The scripts are in `final/scripts/` (ig5's method).

Each frame was looked at beside the reference thumbnail and `mock-one-ring.png`.

| t | On screen (cut A) | Verdict |
|---|---|---|
| 0 s | Pure white. The giant dial is cropped through the corner, its teal rim across the top over fine ticks. Node 1 is hollow, with its pending grey stretch. Our black hand sits on the diagonal: hollow lozenge, deep-teal collar, graphite hub, soft long shadow. Lockup 1a "One ring, / *six seconds.*" and its tier are set at 72 % ink in the hand's negative space | the reference composition and the mock's f0 panel; frame 0 reads |
| 1.5 s | The same frame with node 1's stretch inked to the needle. 1a lifts word by word ("One ring," at full ink, "six seconds." lifting) | word-synced |
| 5 s | The M3′ tip macro: the lozenge large, the rim thick, the ticks at ×1.8. Lockup 2a "While it / *rings,*" with the shared two-line tier | clean; the tier sits under the lockup |
| 13 s | Back on M1, the agent's clock. The hub is teal, and a teal dome sits on the rim at the reading point. 4a "Our AI / *receptionist*" with the T4 underline drawing out of the hub disc under "receptionist" (mid-draw on this frame) | the mock's f392 panel |
| 20 s | M1, gliding. 6 "Ring it / *yourself.*" with its tier | calm, one accent |
| 26 s | The impact (f780): white, NEUROVOICE surfacing centre-out (the outer letters still lighter), the teal dome stamped as its full stop | the stamp lands on the bar; the URL types after |

**Cut B** shows the same six frames:
- **0 s, 13 s, 20 s and 26 s** match cut A to within encode noise (max channel delta 3–8, no pixel over 8).
- **1.5 s and 5 s** differ by type timing only. The 1a lifts follow `ig6-01b`'s onsets, and 2a is placed on its own `ig6-02a` start.

Two extra frames check cut B's own lockup:
- **B at 3.1 s** (`final/b/extra-t03.10s-hook1b-crop.png`): 1b "You / *can't answer.*" with the tier "You can't answer.".
- **B at 3.6 s, beside A** (`final/extra-hook1b-A-vs-B.png`): A holds "Your receptionist / *can't answer.*", while B's shorter take has 1b already leaving (its 15 f hold after "answer." is earlier).

**Cover** (also looked at):
- the kicker `AI RECEPTIONIST · 06`;
- "One ring," / teal italic *six seconds.*;
- the stakes line "Your receptionist can't answer.";
- frame 0's dial drawn bolder.

All of it sits inside the 3:4 crop.

---

## 5. Posting

See `POSTING.md`:
- §0, the launch gate (owner items, the bio);
- §1, which file goes where (`-a-…-1080p60-ig.mp4` to both apps; `-b-` to TikTok a week later);
- §2, the slot;
- §3–§4, the captions;
- §5–§6, the DM and the ready replies;
- §8, the B re-cut and what to measure.

Get the files onto the phone by AirDrop or as a document, so they are not recompressed.

---

## 6. Deviations from PIPELINE §6.4 (disk)

The root disk had **635 MB free** at the start. Each `remotion bundle` of the shared `public/` costs ≈ 357 MB, and the guard, check-zones, verify-film1 and verify-film2 each make one. So this run did three things differently:

1. **check-zones used the render's own bundle** (`--bundle=out/master/bundle-ig6`), after the render instead of before it. It checks the exact bundle the master was rendered from, and it saved a fourth bundle per pass.
2. **`out/master/bundle-ig6/` was deleted twice by this run**:
   - after the A pass, so that B's guard bundle would fit (B's `--rebundle` deletes and rebuilds it anyway);
   - after the B pass, so that the full verify-film1 would fit. Its low-water mark was 546 MB free.
   It is build output that this run created. `npm run render:ig -- --film=ig6 --rebundle` rebuilds it. finish's cover was already written from it.
3. **`out/ig6-guard/check/stills/`**, written by this run's own B-pass guard check, was deleted before verify-film1. The final `guard:ig6 -- --check` wrote it again.

Nothing else was deleted. During verify-film1 the free space rose to about 2.1 GB. Something outside this run freed it.

---

## 7. For the orchestrator

- **`src/ig/ig6/timing.ts` must be committed again.** HEAD `5ad393e` (03:58 UTC) was committed during the B pass, so it holds `CAST = 'B'`. The working tree holds the final state, `CAST = 'A'`: sha256 `bd0afbc6…`, the same file as at `eb106c8`. `git diff HEAD` is that one line. Commit it with this file.
- **Guard gate 6** fails only because of that line. Gate 6 allows no edit to a committed ig6 file (BUILD §6 note), so it will pass once `timing.ts` is committed. Gates 1–5, the invariance proof for ig1–ig5, pass.
- **Left in place:**
  - `out/master/IG6-Reel-9x16-x1/` (16 MB: the B pass's chunks and `plan.json`; a later render deletes them as another plan);
  - both HEVC picture masters;
  - the A mix in `public/ig/sfx/ig6/`.
- **Not left in place:** `out/master/bundle-ig6/` (§6).
- **QA:** `out/ig/qa/ig6/deliver/` (per-pass logs, shas, `plan.json`, the A cover copies) and `out/ig/qa/ig6/final/` (frames, sheets, scripts).

# ig5 · "Three rings" (DELIVERY)

Label `master`. Written 2026-10-07, 20:28–21:35 UTC, on `claude/remotion-trailer` (HEAD `9418ffd` at the end; see "For the orchestrator"). This run mastered and delivered ig5 by `PIPELINE.md` §6.2 and §7.2 steps 6–7. The run made both masters (§6.2 "Two masters, two passes"), the **message** master first. Nothing was committed or pushed.

Paths are relative to `trailer/`. The sha256 prefixes are the first 16 hex digits (the full list is in `out/ig/qa/ig5/deliver/gates/sha256.txt`).

---

## 1. Files

**Delivered** (`out/ig/deliver/`):

| File | What it is | Bytes | sha256 | Post |
|---|---|---|---|---|
| `neurotechvoice-ig5-dont-pay-300-message-1080p60-ig.mp4` | **message master** (`ig5-06-msg`, the record ends on **Message taken**). 1080×1920, 60 fps, H.264 High L4.2, AAC 192k | 27,349,676 | `44d6005330456776` | **TikTok, then Instagram, until POSTING §0 items 1–2 are ticked** |
| `neurotechvoice-ig5-dont-pay-300-booking-1080p60-ig.mp4` | **booking master** (`ig5-06`, **Booked** + `BETA`), same spec | 27,369,175 | `a2d0ec582a545fea` | only after POSTING §0 items 1–2 |
| `neurotechvoice-ig5-dont-pay-300-message-1080p120.mp4` | message master, 120 fps, H.264 High L5.1 | 27,406,720 | `ea3cd1b093702606` | archive / other platforms |
| `neurotechvoice-ig5-dont-pay-300-booking-1080p120.mp4` | booking master, 120 fps, H.264 High L5.1 | 27,418,794 | `48dc6dba1f9c6e6e` | archive, only after POSTING §0 items 1–2 |
| `neurotechvoice-ig5-dont-pay-300-cover.png` | cover, 1080×1920 (`IG5-Cover-9x16`) | 2,353,207 | `0d82f4607cf40125` | custom cover on both apps |

- **The cover** is byte-identical from both passes (`0d82f460…` both times), so the booking pass's copy is the one kept. It keeps the unsuffixed name that POSTING §1 lists. (PIPELINE §6.2 step 4 says every ig5 file should carry `-message-` or `-booking-`, but that rule is about the videos, and the cover has no outcome on it.)
- **Its 3:4 grid crop** is `out/ig/qa/ig5/cover-34.png` (1080×1440, y 240–1680, `840feb0363944932`).

**Picture masters** (`out/ig/master/`, muted HEVC Main, 3360 frames at 120 fps, joined from 7 act-aligned chunks):

| File | Bytes | sha256 |
|---|---|---|
| `neurotechvoice-ig5-dont-pay-300-message-1080p120-hevc.mp4` | 22,027,191 | `e00b73f25f907e51` |
| `neurotechvoice-ig5-dont-pay-300-booking-1080p120-hevc.mp4` | 22,199,476 | `8a881f87fd50d757` |

**Mixes:**
- The message mix was `0575ee46ffe9849c`.
- The booking mix (`public/ig/sfx/ig5/mix.wav`, stamp `19ca5ef2038155ea`) is `792c273fdd7978d3`. It is the one left in place.

Both mixes measure −14.0 LUFS and −1.65 dBTP.

---

## 2. One mastering change: the impact's `slam` crack is 6 dB down

**What failed.** The first message pass failed `check:delivery:ig`: the decoded AAC peaked at **−0.73 dBTP**, against a limit of ≤ −1.0. Everything else passed: 27.41 MB, −14.30 LUFS, no `elst`, lock at lag 0. That run's logs are in `out/ig/qa/ig5/deliver/message/attempt1/`.

**Where the overshoot is.** One frame causes it: f780, the logo impact's first 4 ms. There the mix is pinned by the master limiter (−2.72 dBTP at f780.13), and AAC rebuilds the sample at −0.73. Every other frame decodes at ≤ −1.8.

**The trials.** Each used an AAC round trip identical to `finish.mjs`. On attempt 1 it reproduced the delivered −0.73 exactly. The table is in `out/ig/qa/ig5/deliver/aac-peak-trials.txt`.
- **Lowering the master ceiling made it worse.** At `MIX.ceiling` −2.0 the decode was −0.64, because more limiting means more overshoot. It also failed check-mix (climax +0.7 LU, arc +0.4 LU). Reverted.
- **Turning down the shared stack's `slam` layer works.** The `slam` is the crack on the impact. At −4 dB the decode is −1.05, at −6 dB −1.66, at −8 dB −1.80. check-mix is unchanged at every step: climax, arc, words and the name are all the same.

**The fix, `src/ig/ig5/timing.ts` HITS.** The shared stack is now `...impactHits(IMPACT).map(slam → db − 6)`, with a comment that points here. `series.ts` is untouched; the change sits in ig5's own cue sheet only.
- **Delivered result:** message **−1.66 dBTP**, booking **−1.46 dBTP**.
- **check-mix:** message climax +1.1 LU and arc +0.6 LU; booking +1.2 LU and +0.7 LU (fix-r3 recorded +1.1 and +0.7 for booking).
- **What else it touched:** this is sound only, because the picture reads no CUES or HITS. Because `timing.ts` is in the bundle, both passes were still re-rendered from a fresh bundle.

---

## 3. What was run, in order

| # | Step | Result |
|---|---|---|
| 1 | `BODY.does = 'ig5-06-msg'`. Then `sfx:ig5` and `check:audio:ig5` | OK (as built: climax +1.1, arc +0.6) |
| 2 | `guard:ig5 -- --check` → `sfx:ig` → `check:zones:ig -- --film=ig5` | PASS 1–5 (gate P 24/24) · 0 built, 4 up to date · PASS (34 stills + cover) |
| 3 | `render:ig -- --film=ig5 --dry-run`, then `--rebundle` | 7 chunks · 3360 frames in 7 min 4 s (2 workers, 0.20–0.34 s per frame) |
| 4 | `finish:ig`, then `check:delivery:ig` | 27.41 / 27.40 MB · **✗ −0.73 dBTP** (§2) |
| 5 | The `slam` change (§2). Then `sfx:ig5`, `check:audio:ig5`, guard `--check`, render `--rebundle` (bundle `a6ce34f8…`, the old chunks deleted by render-par), `finish:ig`, `check:delivery:ig` | OK · PASS 1–5 · 7 min 17 s · **✓ both files** |
| 6 | Rename the message pass's 3 files to `…-message-…` (`mv` on exact names) | done. There was no `-x1-<suffix>` layer folder to clear |
| 7 | `BODY.does = 'ig5-06'`. `cmp` against the pre-pass file plus the slam line | identical. tsc exit 0 |
| 8 | `sfx:ig5`, `check:audio:ig5`, guard `--check`, `sfx:ig`, `check:zones:ig -- --film=ig5` | OK (+1.2 / +0.7) · PASS 1–5 · 0 built · PASS (35 stills + cover) |
| 9 | `render:ig --rebundle` (bundle `38136abe…`), `finish:ig`, `check:delivery:ig` | 6 min 45 s · 27.42 / 27.37 MB · **✓ both files** |
| 10 | Rename the booking pass's 3 files to `…-booking-…` | done |

**`check:delivery:ig`**, both run before renaming, as PIPELINE §6.2 requires (it reads `<outName>-*` and locks each file to the mix in place at that moment):

| File | Size | Video | Audio | Loudness | Peak | elst | Lock |
|---|---|---|---|---|---|---|---|
| message 120 | 27.41 MB | h264 High L5.1 1080×1920 120/1 | AAC LC 202k | −14.30 LUFS | −1.66 dBTP | none | lag 0 in 20/20 windows |
| message 60 | 27.35 MB | h264 High L4.2 1080×1920 60/1 | AAC LC 202k | −14.30 LUFS | −1.66 dBTP | none | lag 0 in 20/20 windows |
| booking 120 | 27.42 MB | h264 High L5.1 1080×1920 120/1 | AAC LC 200k | −14.30 LUFS | −1.46 dBTP | none | lag 0 in 20/20 windows |
| booking 60 | 27.37 MB | h264 High L4.2 1080×1920 60/1 | AAC LC 200k | −14.30 LUFS | −1.46 dBTP | none | lag 0 in 20/20 windows |

Every file also passed the BT.709 tags (matrix, primaries, transfer, tv range), avc1, moov before mdat, both streams starting at 0, and the frame count. Each was a single two-pass encode at 7568 kb/s, with no size-loop retry.

---

## 4. Gates before handing back

Each gate was run alone, after both passes. The final `timing.ts` is the booking cast.

| Gate | Command | Result |
|---|---|---|
| Film 1, full | `node scripts/kb/verify-film1.mjs` | **PASS 11/11** (4 min 56 s): frozen set matches `8b9cd21`; 116 files with `mix.wav` `ec037282…`; skip `2efdbc5153019f3c`; 4 MP4s; 35/35 stills byte-identical; tsc + check:port |
| Film 2, full | `npm run verify:film2` | **PASS 7/7** (1 min 56 s): kbHash `db3a9efa91f928f2`; 123 files, the 4 MP4s among them; bundle digest `269c7b3c…`; check-render identical |
| ig1–ig4 invariance | `npm run guard:ig5 -- --check` | **PASS 1–5**: 255/257 shas (the 2 allowed QA edits); stamps ig1 `49b90ae44064d049`, ig2 `757d177d35b27cd6`, ig3 `47ae5cf315d3434b`, ig4 `f4500c7a37b6d47e`; 38 rows + 11 IG5; **gate P 24/24 byte-identical**; the delivered ig1–ig4 files are byte-identical; the only new files are the 7 `neurotechvoice-ig5-*` |
| ig1–ig4 sound | `npm run check:audio:ig` | **OK ×4**: climax +1.7 / +1.3 / +1.1 / +1.1 LU |
| ig1–ig4 skip | `npm run sfx:ig` | `0 built, 4 up to date` |
| ig5 sound | `npm run check:audio:ig5` (booking) | **OK**: −14.0 LUFS, −1.65 dBTP, climax +1.2, arc +0.7, words mean 0.97 (lowest "up" 0.83), name 0.95 / 1.00 / 0.99 |
| ig5 stamp | `npm run sfx:ig5` | `up to date (19ca5ef2038155ea) — skipped` |
| Typecheck | `npx tsc --noEmit -p .` | exit 0 |
| Frozen sets | `git status --porcelain` on the film 1 and film 2 paths in the brief | **empty** |
| Git | `git status --porcelain` | only `M trailer/src/ig/ig5/timing.ts` (see "For the orchestrator") |
| ZoneGuard | | no shared edit in this step: `src/ig/components/**`, `src/ig/common/**` and `scripts/ig/**` are unchanged (INFRA-LOG "Master step") |

The logs are in `out/ig/qa/ig5/deliver/gates/`, and each pass's logs are in `…/deliver/{message,booking}/`.

---

## 5. The final frames, by eye

Six frames from each 60 fps upload file: 0, 1.5, 5, 13, 20 and 26 s (60 fps frames 0, 90, 300, 780, 1200 and 1560). They are decoded BT.709 tv to full range, in `out/ig/qa/ig5/final/{message,booking}/`, with a `sheet.png` each. Also in that folder: `zoom-f780-record-booking-vs-message.png`, and the scripts in `final/scripts/`.

| t | What is on screen (both masters unless noted) | Verdict |
|---|---|---|
| 0 s | Pearl ground. "**Three** rings. / Gloves on. / You can't." at 72 % ink, flush left at x 86, "Three" in rose. The desk hairline is drawing, with the rose light at (740, 1130). The ring trio is in flight, the inner ring brightest, the outer ending at x ≈ 860. Nothing else on screen | HOOKS §1.2 as specified; clean, no blur |
| 1.5 s | "Three rings. Gloves on." lifted to full ink, "You can't." still at 72 % (word-synced). The desk is fully drawn, x 86–758, and the trio has thinned | correct |
| 5 s | Slip 1 (white, perforated top, −1°): **AGENCY AI RECEPTIONIST** and the empty amount slot. The light is still on the desk, and the caption band is empty in the pause before "commonly" | crisp; tag inside the zone |
| 13 s | The pile: **$300** "a month / commonly" with its bar; the stub **SETUP, OFTEN $1,500** stapled on; **LIVE ANSWERING SERVICE** "from **$99** a month, for 50 minutes" with its bar and the people stripe. The light is still ringing on the desk | every figure carries its RESEARCH-prices §6 hedge ("commonly", "often", "Live", "from"); no competitor name, no total, no strike |
| 20 s | The parked chip "From $49 a month" (teal; right edge x ≈ 898, above y 840); the **SAMPLE CALL** record with the teal orb docked; the band caption "It picks up when you can't," | in the zone; the house look |
| 26 s | The impact (f780): the teal LightGL emitter blooms at the centre; the call record steps back, dimmed; the orb has stepped aside to the upper right (x ≈ 790–882, y ≈ 272–366). The dimmed record reads **BETA · Booked**, "Checked your availability", "Booked an appointment" (booking) and **Message taken**, "Took a message" (message) | the right outcome in each master; the wordmark and URL follow on the bar (shared `IgEnd`) |

Cover (`…-cover.png`, also looked at): the kicker `AI RECEPTIONIST · 05`; the title "Three rings. / Gloves on. / You can't."; the attribution "Agency AI receptionist: / commonly $300 a month. / Ours: from $49 a month●"; the bolder ring trio on the desk. All of it sits inside x 86–900 and the 3:4 crop. This matches SCRIPT §7.

---

## 6. Posting

See `POSTING.md`:
- §0, the **launch gate**: post the **message** files only until items 1–2 are ticked, then the booking files. Items 3, 6 and 7 apply to both.
- §1, files.
- §2, slot: TikTok Tue 27 Oct 2026, 12:30 New York; Instagram Thu 29 Oct.
- §3 / §4, the booking captions.
- §7, the **no-booking captions to use with the message master**.
- §5–§6, the DM and the ready replies.

Get the files onto the phone by AirDrop or as a document, so they are not recompressed (§1).

---

## 7. For the orchestrator

- **`src/ig/ig5/timing.ts` must be committed again.** HEAD `9418ffd` was committed at 20:58 UTC, during the message pass. It captured `timing.ts` with the **message** cast (`BODY.does = 'ig5-06-msg'`) and the new slam line. The working tree now holds the final state, `BODY.does = 'ig5-06'` plus the slam line (`git diff HEAD` is that one line). Commit it with this file and the INFRA-LOG note.
- **Critic round 3's three blocking issues** (LOOK3-B1, TRUTH-R3-1, SYNC3-A) were fixed in fix-r3 before this step (BUILD §8.1). No critic re-ran on the final picture. The only change since fix-r3 is the sound-only slam level (§2).
- **Left in place, as for ig1–ig4:**
  - `out/master/bundle-ig5/` (finish renders the cover from it);
  - `out/master/IG5-Reel-9x16-x1/` (the booking pass's chunks, resumable).
- **Removed:** the temp trial folder `out/ig/qa/ig5/deliver/ceil/`. No other temp folder was created.
- **Disk:** 4.8 GB free at the end.

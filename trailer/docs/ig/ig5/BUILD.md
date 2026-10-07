# ig5 · "Three rings" (BUILD: the picture)

Label `picture`. Written 2026-10-07 on `claude/remotion-trailer`. The placeholder title-card acts are replaced by the real picture of SCRIPT.md §2 + HOOKS.md §1 on the placed timeline (28.0 s, 840 f, impact f780, rung 2: `ig5-01g` · `ig5-02gt` · `ig5-03` · `ig5-04` · `ig5-05t` · `ig5-06` · `ig5-07` · `ig1-07`). Picture only: the cue sheet (HITS), the bed and the mix are the sound step's. Nothing committed by this step (the orchestrator commits).

## 1. What each act does

All acts but `end` mount ONE continuous stage (`stage/Stage.tsx` Stage5, every part a pure function of the absolute frame), so act boundaries are invisible. Frames are the placed ones (`timing.ts` M, all off the takes' onsets).

| Act · frames | Picture |
|---|---|
| **hook** 0–86 | Pearl ground, warm key low-left, the phone's rose pool. Desk hairline y 1130 drawing x 86 → 758 from f −6. The rose line light at (740, 1130) with **the ring trio already in flight at f0** (Ø 72 / 156 / 240, strokes 3 / 2.25 / 1.5, ink 85 / 60 / 35 %, linear fade, launches f −40 / −20 / 0, gone by f20 / 40 / 60). S1 "**Three** rings. / Gloves on. / You can't." set at 72 % (headline 104, x 86, rows 400 · 528 · 656, "Three" rose), each word lifting on her onset with a rose glint. R1 at **f30** (passes the ring law). S1 leaves line by line from f80 (2 f apart, 4 f each), gone f88. |
| **agency** 86–283 | Slip 1 rises blank at f88 (ink bar + empty amount slot, −1°). S2 "Agency AI receptionist:" rises f92 after S1 is gone. The bar writes AGENCY AI RECEPTIONIST on f94 / 116 / 125; a ring at **f135**. "commonly" prints f159; "**$300**" (140, rose) rolls 0 → 300 from f176 on 32nd ticks while its hairline draws 600 px from the $0 point x 160; "a month" f195. On "Setup," (f214) the stub drops with weight onto slip 1's blank bottom margin (+3°, SPRING.land) and is stapled; "OFTEN" f236; "**$1,500**" rolls from f250 (no hairline: one-time fee). |
| **answering** 283–422 | Slip 2 rises f283 with the 6 px graphite people stripe; LIVE ANSWERING SERVICE writes f285 / 296 / 311; "from" f335, "**$99**" rolls f344 (hairline 198 px), "a month," f364, "for" "50" "minutes" f380 / 385 / 392. The papers ease back 1.00 → .97 about (540, 740) f291–321. A last unanswered ring at **f405**. |
| **ours** 422–530 | **The pickup** at f422: the rose light springs open into her teal orb (AvaOrb born) and the desk hairline undraws; the phone's pool hands over to her sunday pool. The quotes square up into a pile × .88 about x 160 (slip 2 first, sliding under the stub; slip 1 with its stapled stub a 32nd later), tilt 0, ink 55 %: $300 / $1,500 / $99 at ≈ 123 px, every tag and hedge legible, nothing struck, no total. Ours rises under the pile at 72 %: "Ours? From" / "**$49**" (200, teal, never rolls) "a month" + her orb as the full stop (glide f428–442, arcing right then down, never over "month"); words lift on 424 / 448 / 458 / 482. On "forty-nine" ours' hairline draws **86 px** under the pile's 528 and 174, all from x 160. "No setup fee." (teal) prints f503 / 508 / 515 at ours' upper right. Payoff / cover frame f524–526 (critic round 3, TRUTH-R3-7; §8). |
| **setup** 530–578 | The pile leaves up through its mask (f525–533) and ours glides up (from f528) — a quarter beat ahead of "You", so the caption never lands on ours. "You set it up yourself." On "set" (f543) a graphite track draws with four empty dots; they fill teal f552 / 555.75 / 559.5 / 563.25; the fourth becomes a drawn check. |
| **does** 578–686 | On "It" (f581) ours folds into the parked chip "From $49 a month" (white pill, teal, x ≈ 502–900, y 286–366) and the track folds away; her orb waits where the full stop was. The record rises f589: ● SAMPLE CALL with a small rose dot ringing at its left. On "picks up" she arcs onto the dot and absorbs it, docked as "up" lands (f598), listening; **Answered** lands f600. "Checked your availability" spins (f614) → check (f636); on "books" (f643) "Booked an appointment" ticks and the pill swaps to **Booked** (f645). |
| **end** 686–840 | The shared `IgEnd`, unchanged: the record pulled back and up over the CTA (× .62, 50 %), the chip in the label band, her orb docked on the record; the comment field rises f688, AGENT types from f709, send f746. On the bar (f780) the record goes out under the light, the chip leaves with the field, her orb steps aside to the chip's place (836, 320); NEUROVOICE, the URL on "Neuro | Tech | Voice". **Seam** f826–840: she glides down the right of the frame and closes into the phone's rose light; frame 0 re-forms (desk redrawing from f −6, the trio's launches already travelling, S1 rising into its masks), the ground crossing to frame 0's. |
| **cover** (IG5-Cover-9x16) | Kicker AI RECEPTIONIST · 05; the hook on three rows at 112 px, "Three" rose, the ring trio right of row 1; attribution "Agency AI receptionist:" / "commonly **$300** a month." / "Ours: from **$49** a month●" (44 px, y 720–876); the payoff (pile + ours) as a × .42 thumbnail on the x 86 axis, y 890–1300, its "$49" above y 1300. |

Every on-screen string is a word she says (display map: "three hundred" → $300, "fifteen hundred." → $1,500., "ninety-nine" → $99, "fifty" → 50, "forty-nine dollars" → $49), printed on or after its word; chrome (SAMPLE CALL, the tool rows, the pills) ≤ 32 px. No competitor names. The launch-gate cut is one id (`BODY.does = 'ig5-06-msg'`): the picture follows `M.booked` (one step "Took a message", pill → Message taken).

## 2. Files

| File | What |
|---|---|
| `src/ig/ig5/acts/Acts.tsx` | the acts: `stageAct` × 6 + `End5` (IgEnd slots: ground, backdrop, orb, seam; ig1/ig3's pearl look) |
| `src/ig/ig5/stage/layout.ts` | geometry and poses (picture only: in a subfolder so it is outside `ig5Hash`) |
| `src/ig/ig5/stage/type.tsx` | printed words (`Print`), rolling figures in fixed cells (`Figure`, `rollValue`), the to-scale hairline (`ScaleBar`) |
| `src/ig/ig5/stage/Hook.tsx` | frame 0: desk line, phone, ring trio, single rings, S1 (a fork of the Captions set screen with line-by-line exits) |
| `src/ig/ig5/stage/Papers.tsx` | slip 1, the stub (+ staple), slip 2, the camera, the square-up, the pile's exit |
| `src/ig/ig5/stage/Ours.tsx` | ours, its fold into the chip, the chip, the set-up track |
| `src/ig/ig5/stage/Record.tsx` | the sample call (own tool steps in record coordinates so they ride its pose and report frame rects) |
| `src/ig/ig5/stage/Stage.tsx` | ground key, her orb's path, band captions, `Stage5` |
| `src/ig/ig5/stage/Zones.tsx` | ig5's zone overlay + `registerIg5Zones()` |
| `src/ig/ig5/zones.ts` | ig5's rule (SCRIPT §1.2): text x 86–900 / y 240–1400, price numerals y 300–1260, objects x ≤ 880 below y 840, cover x 86–900 / y 260–1380 with "$49" above 1300 |
| `src/ig/ig5/Reel5.tsx`, `Cover.tsx` | the reel (registers the zones) and the cover |
| `src/ig/ig5/timing.ts` | `M` (every picture moment, incl. `M.rings` = 30 / 135 / 405 for the sound step), `ZONE_FRAMES`, header; HITS / BED / MUSIC untouched |
| `src/ig/components/ZoneGuard.tsx` | the one shared edit: the per-reel zone registry (INFRA-LOG "Scene step"; ig1–ig4 byte-identical in both modes) |

## 3. Verification (QA in `out/ig/qa/ig5/picture/`)

- `npx tsc --noEmit -p .` clean.
- Stills at every screen onset (and onset + 8) and the key moments: `onsets/f*.png`, sheet `onsets-sheet.png`; the cover `cover-0000.png`.
- Contact sheet every 6th frame: `contact-every6.png`.
- 120 fps strip (2 s, render f2040–2279; tiled r2096–2143) of the fastest move, the pile's exit + ours' glide: `strip120-pile-exit.png` — monotonic, crisp, the caption only after ours clears the band.
- Loop seam: `seam/` — at 30 fps the 839 → 0 step equals the step before it (mean diff 0.295 vs 0.294); at 120 fps the residue is S1's set-screen spring (99.4 % ink, 0.1 px) snapping to rest on frame 0, the shared Captions idiom (ig1–ig4 do the same).
- `npm run check:zones:ig -- --film=ig5 --selftest`: **PASS** (36 stills + cover in `out/ig/qa/ig5/zones/`; zone overlay examples `zones-sheet.png`).
- `guard:ig5 -- --check` PASS (gate P 24/24); ig1–ig4 zone mode 20/20 byte-identical (`zoneguard-proof/`); `sfx:ig` 4 skipped; frozen sets clean.
- `sfx:ig5` restamped (timing.ts gained M); `check:audio:ig5` unchanged: the same 2 FAILs as before this step (climax lead +0.1 LU; "You" in `ig5-05t` 0.69 at f533). *Closed by the sound step: `check:audio:ig5` OK, §5.4.*

## 4. Known gaps and deviations

1. **Sound is not cued for the picture.** HITS are still the series' frame (f0 trill, end stack, riser, impact). For the sound step: the rings `M.rings` (30, 135, 405), the pickup `M.pickup` (422), the rolls (176, 250, 344), the staple (214 + 4), the dots (552…563.25), the record (589, 598, 643). The record's rose dot flashes at f593 / 608, where no chirp can pass the ring law (onsets 588, 598, 603, 607, 610): leave it silent or move it. *Closed by the sound step (§5): every event is cued; the record's dot stays silent.*
2. **The shared wordmark** measures ≈ x 160–920 at y 760–900 (its zone rect on `zones/f796.png`) (≤ 760 px centred, `End.tsx`): past ig5's text edge x 900 and ≈ 20 px into TikTok's rail band below y 840. `zones.ts` exempts `wordmark` to the frame margins, since changing it would re-render ig1–ig4.
3. **Timing leads:** the pile's exit and ours' glide start 8 f / 5 f before "You" (else the caption rises over ours); the record rises 8 f after "It" (ours' fold must clear its place).
4. **Geometry moved from SCRIPT §3's numbers** to fit the measured type: slip 1 y 340–610 (x 120–876), stub x 310–874 from y 598 pivoting on its staple (the 140 px "$1,500" is ≈ 485 px wide), slip 2 y 854–1108, the pile y 300–949, ours y 972–1278 in b4 (its "$49" box ends y 1256) and y 430–736 in b5, the chip y 286–366 (inside the price band, not 250–330), the record y 620–910, the track x 220–780 y 830. "No setup fee." sits right-aligned at x 860, right of the stub's column (the stub ends x ≈ 790 in the pile).
5. **End card:** the record is pulled back × .62 to 50 % (not × .92) so the centred CTA never sits on it; her orb waits at the chip's place through the brand so her seam path stays right of S1.
6. **Not built:** the `BETA` chip (only if the app still badges booking at launch), film 1's `ContactShadow` (meshElevation used). The camera ease-back moves the papers only (not the desk).
7. **Cover:** the thumbnail is small (× .42) because its "$49" must end above y 1300.
8. Booking at $49 is still the owner's launch gate (POSTING §0); the reel shows Booked.

---

## 5. Sound

Label `sound`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `f1e81dc`). This section supersedes §3's `check:audio:ig5` line and §4.1. The cue sheet, the voice post, the bed and the mix are built on the same placed timeline (rung 2, impact f780). Nothing was committed by this step (the orchestrator commits).

Every sound comes from the reels' **shared** library, `public/ig/sfx/lib/`: 43 files, read-only, each checked against `lib.json` by the driver, plus the shared `fx-impact-end.wav` played as is through `impactHits`. There are no ig5-own library copies and no new extras, and `lib/`, `lib.json` and `fx-impact-end.wav` were never written.

A family that has fewer files in the shared library than its round-robin count is played at most that many times:
- one file: `pop`, `ping`, `land`, `whoosh-soft`;
- two files: `swish`;
- `fx-keys`: the end card's five.

### 5.1 What each beat sounds like

Frames are absolute. "key" means a weight-1 hit (a ring, a pickup, a mallet).

| Beat | Sound (cue sheet `HITS` + the bed) |
|---|---|
| **b1 hook** 0–86 | **No bed** (HOOKS §1.4): a phone ringing in a quiet room. `fx-roomtone` from f0 at the air floor (≈ −46 dBFS RMS in the hook's gaps). **The frame-0 ring** `fx-trill` (key, −3) is the reel's first sound, peaking ≈ −10.8 dBFS in the master: far under the limiter, so it needs no AAC head trim. **R1** at f30 (key, −5) falls between "rings." and "Gloves", passing the ring law. `fx-paper-square` at f89 as slip 1 rises blank. Every hook word scores SII 1.00. |
| **b2 agency** 86–283 | The **bed enters at f105**, on the first beat at or after "Agency" (`MUSIC.bedFrom`). `fx-felttip-short`, one stroke per tag word (94 / 116 / 125). A ring at **f135** (key, −5) after "receptionist:". On **"three hundred" (f176)**: `thump` as $300 lands, a counter of 8 dry `fx-tick` on 32nds under the 18 f roll (its 600 px hairline grows with it), and `fx-tock` as it settles (f192, a frame ahead of "a month"). On **"Setup,"**: `thump` as the stub drops (f219) and `fx-tag`, the staple click (f222). **"fifteen hundred" (f250)**: the counter, then `fx-tock` (f266). There is no hairline sound: the setup fee is one-time and never sits on the scale. |
| **b3 answering** 283–422 | `fx-paper-square` as slip 2 rises (f283, 2 f ahead of "Live"). Felt-tip strokes on LIVE ANSWERING SERVICE. A soft `swish` (f306) as the papers ease back to .97. The `$99` counter from f345. `fx-tock` on "fifty" (f384, a frame ahead). **The last ring at f405** (key, −5) after "…minutes.". The bed's shaker goes to brushed 16ths here, and low strings swell over the two bars into the cut. |
| **b4 ours** 422–530 | **THE STOP-TIME** (f420–458): the bed and its tails are cut on the sample at a 16th (f420, 4 f before "Ours?"). The seed (`fx-seed`) rises out of the last ring and peaks on **the pickup click at f422** (key, 0 dB). `fx-ting` (f425) as the rose light springs open into her orb. `land` (f427) as ours lands under the squared-up pile. `ping` + `chime-sunday-soft` (f442) as her orb lands as ours' full stop. **On "forty-nine" (f458) the bed returns**: an open E rolled on the felt piano over a low E, and the string pad an octave up. At the same moment `fx-mallet-e5` sounds ("true", f457: a frame ahead of the vowel, −10, under the word) and `fx-scratch` as ours' 86 px hairline draws. `fx-tag` on "No setup fee." (f503). |
| **b5 setup** 530–578 | `whoosh-soft` peaking f531 as the pile leaves and ours glides up. `fx-scratch` on "set" (f544) as the track draws. `fx-pluck-e5 → fs5 → gs5 → b5` (552 / 555.75 / 559.5 / 563.25), one per dot: the pentatonic rising. `fx-ting` on the check (f565). The bed's 8ths figure rests one 8th on "You", and the bed fader steps back −5 dB there (the old 0.69 FAIL is now 0.94). |
| **b6 does** 578–686 | `fx-paper-fold` (f584) as ours folds into the chip. `fx-paper-lift` (f589) as the record rises. **`fx-pickup` on "up" (f598, key)** as her orb docks on the rose dot; the bed's felt kick enters with it (beats 1 and 3 from f600). `fx-ting` (f600) as Answered lands. A quiet `fx-tick` roll under the availability spinner (f616…) and `fx-glass-tick` on its check (f636). **On "books"**: `fx-mallet-e5` (key, f644) and `pop` (f645) as the pill swaps to Booked, over a bright open E rolled in the bed. The launch-gate cut `ig5-06-msg` drops the availability step and lands the mallet on "takes" (Message taken). |
| **b7–b9 end** 686–840 | The shared `endHits`: `fx-menu-open` as the field rises (f688, +6 dB as in ig1, since it sat 18 dB under the bed between her lines), `fx-keys` as AGENT types one key per 16th from f709 (+2 dB), the send click f746/748, and the colophon `draw`. The build: a riser cresting under the half-bar snare roll from f750, the inhale, then `impactHits` on **f780** (`riser`, `fx-impact-end`, `thump`, `slam`) with the bed's crash, low E and E resolution. The name "Neuro Tech Voice." at f784. `MIX.fadeOut` [826, 840]: the last frame is −85.8 dBFS, and the replay's first sound is f0's ring. |

### 5.2 The bed: `scripts/ig5/bed.mjs` (new; PIPELINE §5.3)

**Why a new file.** The IG stub could not do the arrangement ig5 needs:
- no music under the hook;
- a cut whose return is exact on "forty-nine";
- the pad an octave up there;
- a kick from the does act;
- E on "books".

So ig5 has its own arrangement. Its instruments are **copied token for token** from `scripts/ig/bed.mjs`: lines 20–274, including `partial`, the felt piano, the sub, the strings and `kitAt`. A `diff` of the two blocks is empty. Nothing is imported from `scripts/ig/bed.mjs` (an igHash input), and that file is untouched.

The chord table, the shared build, the inhale and E ON the logo are the IG bed's own. The driver plays the file automatically (`generate-sfx.mjs` step 5), and `ig5Hash` covers it (`scripts/ig5/*.mjs`).

**Harmony and parts by section:**

| Section | Harmony | Parts |
|---|---|---|
| Quotes, from f105 | E · C#m7 · Amaj7 by bar | A muted felt-piano 8ths figure in the middle register, soft shaker 8ths, the sub on the changes, a low string pad. |
| Answering | F#m11, then Bsus → B in the bar before the cut | Brushed 16ths on the shaker. Low strings swell into the cut and end ON it. |
| The cut, f420 | (silence) | The bed and its tails stop on the sample. |
| Return, f458 | E (Emaj9 pad) | The return is exact: the gate is back at unity on `MUSIC.stop[1]` through a 2 ms ramp that ends there. The stub's 30 ms ramp would have eaten the rolled chord's attack. The rolled E, the pad an octave up, and the 8ths figure **open** an octave up from the next bar. |
| Set-up | Amaj7 | One 8th rests on "You". |
| Does | B under "It picks up when you can't," → **E on "books"** (the hook's "You can't" answered as a V–I) | A light felt kick on 1 and 3 and shaker 8ths from the does act. |
| CTA | E → Amaj7 | The strings' crescendo. |
| Build | B for the roll, E on f780 | The shared build and logo E. |

**Inputs.** The arrangement reads only `MUSIC`:
- `bedFrom`, `stop`, `roll`, `impact`, `brand`, `end`;
- `MUSIC.ig5 = { agency, answering, fortyNine, you, kick, books, cta }`, all off the placed onsets.

So a re-cast moves the music with it.

### 5.3 The mix

**Fader (`BED.ride`):**
- **under** +7.5 through the quotes;
- **swell** +9 into the cut;
- **ret** +7 for the return;
- **you** +2 under "You";
- **call** +5 through set-up and does;
- **build** +13 after the CTA;
- then the series' `bedRide` round the hit, with the chord +2.5 into the seam.

**Body balance** (stems, voice minus ducked bed):

| Section | quotes | answering | return | does | CTA |
|---|---|---|---|---|---|
| Bed under voice | 12.3 LU | 11.4 LU | 10.4 LU | 10.4 LU | 11.1 LU |

Over the whole body the bed sits 11.9 LU under the voice. ig1–ig4 range from 10.5 to 15.3 LU.

**Voice post (`VOICE_RIDES`, the climax's headroom, ig4's method).** The reel's loudest 400 ms windows were all voice. The worst was "Agency" at f100, opening beat 2 dry a breath before the bed enters, at −9.5 LUFS-M against the impact's −9.4.

| Take | Ridden frames | Nominal | Heard |
|---|---|---|---|
| `ig5-02gt` | "Agency" [0, 19] | −3.5 dB | ≈ −1.6 dB |
| `ig5-02gt` | "commonly" [64, 79] | −2 dB | |
| `ig5-03` | "ninety-nine a month," [58, 84] | −1.5 dB | |
| `ig5-06` | "It picks up when" [0, 23] | −2 dB | |
| `ig5-06-msg` | the same phrase [0, 24] | −2 dB | |

The voice bus's leveller halves a ride above its threshold, and `master()` re-trims every ridden line to −20, so the heard reduction is smaller than the nominal one.

**Impact insert.** It uses ig1's tuning: held a frame longer (`hold` [0, 4]) and released over the name's first syllable (`release` 8). "Neuro" scores 0.95 (≥ .9).

**Ring levels.** SCRIPT asked for −8 on the later rings. At −8 they measured only +2 dB over the bed, while ig2's and ig4's rings sit 3–12 dB over theirs. They are set at −5: f0 −3, R1 −5, the rest −5.

### 5.4 `npm run check:audio:ig5`: OK (0 problems)

| Test | Target | Result | |
|---|---|---|---|
| Stamp | current (`ig5Hash`) | `3805a4a4643afeff`, 840 f | PASS |
| Integrated loudness | −14 ± 1 LUFS | **−14.1 LUFS** (master gain +5.6 dB, limiter ≤ 6.3 dB) | PASS |
| True peak / clipping | ≤ −1.0 dBTP | **−1.65 dBTP**, sample −1.65 dBFS, no clipping | PASS |
| Effects / bed peaks | ≤ −12 / ≤ −20 dBFS, no cue above unity | −12.0 / −20.0 | PASS |
| Dialogue files | −23 ± 0.5 LUFS | −23 ± 0.00 | PASS |
| Dialogue stem | −20 ± tol | 01g −20.1 · 02gt −19.9 · 03 −19.9 · 04 −20.1 · 05t −19.6 · 06 −19.8 · 07 −20.0 · ig1-07 −20.1 (spread 0.5 LU) | PASS |
| **Climax** | impact ≥ loudest dialogue + 1 LU | **logo −9.3 LUFS-M vs −10.6 (`ig5-02gt` "commonly" @163): +1.3 LU** (was +0.1) | PASS |
| Build → impact | ≥ 3 LU | −13.7 → −9.3 (4.4 LU) | PASS |
| End | last 100 ms ≤ −55, last frame ≤ −60 dBFS | −76.3 / **−85.8 dBFS** | PASS |
| End chord rings 10–5 f from the end | ≥ −55 dBFS RMS | −53.1 | PASS |
| Arc | converge ≥ music windows + 0.5 LU | −10.0 vs −12.5 (the return on "forty-nine", @459): +2.5 LU | PASS |
| **Word masking** | every word SII ≥ 0.7 | 60 words, **mean 0.96**, lowest "up" 0.80 (the pickup click on "up"), "you" 0.83, "fee." 0.86, "when" 0.87, "the" 0.90. Every hook word 1.00. "You" @533 0.94 (was 0.69). | PASS |
| The name | ≥ 0.9 | "Neuro" 0.95 · "Tech" 1.00 · "Voice." 0.99 | PASS |

**The launch-gate cut, built as a test and reverted.** With `BODY.does = 'ig5-06-msg'` the check is also OK:
- the climax lead is +1.2 LU (loudest dialogue "and takes" @635);
- the lowest word is "takes" at 0.82.

Swapping to the message-taken take is one id, and the sound follows it with no further work.

### 5.5 Gates (re-run after the last change)

- `npx tsc --noEmit -p .` is clean.
- `npm run sfx:ig5` reports "library: 43 shared (read-only, sha-checked) + 0 ig5-own" (44 cue files with `fx-impact-end`), the bed composed from `scripts/ig5/bed.mjs`, −14.1 LUFS / −1.65 dBTP, 86 cues, 8 lines, 28.0 s.
- `npm run sfx:ig`: `ig1`–`ig4` up to date, skipped. "0 built, 4 up to date".
- `npm run guard:ig5 -- --check` **PASS gates 1–5**:
  - 255/257 shas (only the 2 allowed QA edits);
  - stamps ig1 `49b90ae44064d049` · ig2 `757d177d35b27cd6` · ig3 `47ae5cf315d3434b` · ig4 `f4500c7a37b6d47e`;
  - 38/38 rows + 11 IG5;
  - **gate P 24/24 byte-identical** (`out/ig/qa/ig5/sound/guard.log`).
- `git status --porcelain` on the film 1/2 frozen sets is empty. The only new path is `scripts/ig5/bed.mjs`, inside PIPELINE §7.1's allowed set. The only changed source is `src/ig/ig5/timing.ts` (HITS / CUES / MUSIC / BED / MIX / VOICE_RIDES and the header).

### 5.6 Deviations from SCRIPT §2 "Sound", and open items

1. **`fx-roomtone-desk`** is not among the shared copies, so `fx-roomtone` is used instead (30.7 s long, covering the whole reel). Copying the other file would have been an ig5-own library copy, which this step excludes.
2. **The record's rose dot** (f593 / f608) stays silent. No `fx-trill-1` passes the ring law between "picks", "up", "when", "you" and "can't". The phone's rings already carry "unanswered" through b1–b3.
3. **`tap` as the chip parks** (f597) was dropped: it would land on the `fx-pickup` click on "up" a frame later. The fold's paper sound carries the chip.
4. **`ping` + `chime-sunday-soft`** sit on her orb's landing as ours' full stop (f442), not on "forty-nine". "forty-nine" carries the bed's return and the mallet, so the payoff word gets one bell, under it.
5. **The availability check** gets `fx-glass-tick` instead of `fx-ting`, because the ting's 2 s ring would carry into "books". `fx-ting` is used three times elsewhere.
6. **Picture-derived frames** (the stub's landing, the staple, the record's rise, Answered, the tool steps, the pile's exit) come from `stage/*.tsx`, which is picture-only and outside the hash. They are mirrored in `timing.ts` `PIC` by name. If a stage offset changes, `PIC` must follow it.
7. **Booking at $49** is still the owner's launch gate (POSTING §0). The sound is ready for either take (§5.4).
8. **Not yet heard as AAC.** `check-delivery` runs after the render/finish step. The master's head is safe: the frame-0 ring peaks at −10.8 dBFS.

**QA** is in `out/ig/qa/ig5/sound/`:
- `check-mix.txt`, `cue-timeline.txt` (every cue and word, with SII);
- `balance.txt` (section balance and the loudest 400 ms per line);
- `hit-levels.txt` (each hit against the bed and the voice);
- `guard.log`;
- spectrogram and loudness sheets of mix / voice / bed / effects with every cue, word and music moment: `sheet-full.png`, `sheet-0-300.png` (the hook and the bed's entry), `sheet-380-540.png` (the cut, the pickup, the return), `sheet-520-700.png` (dots, the record, "books"), `sheet-680-840.png` (the CTA, the build, the impact, the tail).

---

## 6. Round 1 fixes

Label `fix-r1`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `b0edc72`), answering critic round 1 (`look`, `truth`, `sync`, `sound`; QA in `out/ig/qa/ig5/crit-r1-*`). Nothing committed (the orchestrator commits). This section supersedes §1–§5 where they differ. QA for this round: `out/ig/qa/ig5/fix-r1/`.

**Files changed:** `src/ig/ig5/{timing.ts, Cover.tsx, acts/Acts.tsx, stage/{Hook,Ours,Papers,Record,Stage,layout,type}.ts(x)}`; docs `POSTING.md`, `RESEARCH-prices.md`, `HOOKS.md`, `SCRIPT.md`, this file; the `ig5-06` direction text in `scripts/ig5/voice-lines-ig5.json` (documentation only: no take changed). No shared file was touched (`src/ig/components/ZoneGuard.tsx` is unchanged this round, so INFRA-LOG has nothing new).

### 6.1 Blocking

| Issue | Outcome | What changed |
|---|---|---|
| **L1** pile hedges illegible | **fixed** | The pile now steps back the FIGURES and bars only (`PILE.ink` .55 → .60, `pileInk`); every word (tags, "commonly", "a month", "from", "for 50 minutes") takes its own `labelInk` (1 → .88). The tags are 36 px (× .88 = 32 px in the pile). Measured on `stills/f0522.png` (`scripts/contrast.py`, glyph cores vs paper): tags 5.6:1 (was 2.6), "commonly" 5.6 (2.6), "a month" / "from" / "for 50 minutes" 9.7 (3.5), the figures 3.1 (2.8: large text ≥ 3:1), "$49" 5.4, "Ours? From" 14.1. |
| **SEAM-1** rings popping in at f826 | **fixed** | `Hook.tsx` `TrioRings`: for t < 0 the rings' ink × `tween(t, [−10, −2], EASE.inOut)` (`TRIO_SEAM_IN`), t ≥ 0 untouched. With P10 her orb lands on the light at f832, so the rings fade in round her as she closes into it. Frame 0 is byte-identical to round 0's (`stills/f0000.png` vs `crit-r1-look/stills/f0000.png`: mean 0, max 0); the 839 → 0 step equals the step before it (mean 0.295 vs 0.294, as before). |
| **S1** caption / picture moments late on "set", "up" | **fixed** | `timing.ts` `NUDGE` (ig3's idiom): `ig5-05t {1: −3, 3: −4.5}`, `ig5-06 {2: −3}` (and `ig5-06-msg {2: −3}`). The band captions get `timing={{ nudge }}`. Note: a non-set caption screen rises as a unit on its first word, so the nudge changes no caption pixel here; the moments that were really late were the picture's, and they now read the nudged onsets: `M.set` (the track draws on the /s/, f540; `fx-scratch` f541) and the new `M.dock` (f595: her orb's glide onto the record's dot ends on the vowel of "up"; the dot is absorbed by f598). `M.up` keeps the stamp, so the `fx-pickup` click stays on the p closure (f598) and Answered (f600) is unchanged. |

### 6.2 Polish

| Issue | Outcome | What changed / why not |
|---|---|---|
| **P1** pickup hidden under ours | **fixed** (option a) | Ours rises 5 f after the pickup (`OURS_RISE` = f427, from 40 px under its place, not 72): the seed and pop play on the bare desk (`strip-a-pickup.png`). The desk is drawn INTO the light from both ends on the pickup, so its left end clears x 120 within 2 f: no stub beside the card. `PIC.oursLand` → `M.pickup + 10`. |
| **P2** blank card in the fold, blank record | **fixed** | Ours' words scale down with the card (`min(r.w/760, r.h/306)`) and crossfade into the chip's "From $49 a month" (content out FOLD+4…+11, chip text in FOLD+8…+13): a price on every frame (`strip-c-fold.png`). The record rises as its HEADER alone (`recordH`: 124 px) and grows its body as its first tool step arrives (f610–617): never an empty slab (`stills/f0592.png`, `f0614.png`). |
| **P3** figure grammar | **partly fixed, rest skipped** | Fixed: slip 1's empty slot is now sized to the figure (± 14 px), so "commonly" (f159) prints right of the slot instead of inside it. Skipped: "qualifier · figure · a month" on one baseline does not fit at the spec sizes — measured, slip 1 needs ≈ 757 px of a 716 px line ("commonly" 36 px 172 + $300 349 + "a month" 160 + gaps), ours ≈ 802 of 720 px — without dropping a figure under the 120 px pile floor or widening the papers past TikTok's rail. |
| **P4** every b2–b3 word printed twice | **fixed** | `BAND` = set-up + does only: the quotes' words print on their slips alone (ig2 / ig4's idiom). Tags 30 → 36 px. To keep the keyword's time (3.07 s), each slip's tag now rises AS A UNIT at 72 % 2 f before its first word (the card idiom, `Tag` `unit`) and each word lifts on its onset; the ink bar holds its place until then. |
| **P5** end orb a stray dot, drifting under the wordmark | **fixed** | `PARK` Ø 44 → 96 (ig1's P2); `STEP_ASIDE` [IMPACT − 14, IMPACT]: she arrives ON the impact. Her path lifts off the record to a lane at y 440, glides right, and rises into the corner only after the chip has gone, so she never crosses a word (`strip-h-step`, `sheet-step.png`). `ORB_CANVAS` 64 → 96. |
| **P6** cover clutter | **fixed** | The × .42 thumbnail is gone: kicker, title, ring trio, attribution (now 52 px, y 750–936), as ig1–ig4's title + one graphic (`covers/ig5-cover-0000.png`). |
| **P7** rolls open on "$0" | **fixed** (with T2) | Figures no longer count: each RISES out of its mask as its final value on its word (SPRING.land, overshoot cut at rest so it never rises into its tag); the bars still grow with `rollEase`. `rollValue` is gone. |
| **P8** stray marks | **fixed** | The staple is a 40 px wire crown with two bent legs, a steel gradient, a highlight and a hair of shadow (`zoom-staple.png`); the $0 ticks are gone (the shared left edge says "from zero"); the bars are 5 px with round ends; the stub drops from 30 px (was 90), so it never crosses slip 1's figure row. |
| **P9** "and books the / appointment." | **fixed** | `placeOf()` in `Stage.tsx`: a row never ends on "the" / "a" / "an" (the break moves before it): "and books / the appointment." (`stills/f0650.png`). |
| **P10** seam rings with no light | **fixed** | The seam glide starts as the brand leaves (`SEAM_GLIDE` [seam − 6, seam + 6] = f820–832, after the wordmark has gone from her path) and the rings fade in from t −10 (SEAM-1): she lands at f832, the rings come up round her (`strip-g-seam.png`). |
| **T1** booking claim / both masters | **fixed (docs)** | POSTING §0: the render step renders BOTH masters (`…-booking-…` with `ig5-06`, `…-message-…` with `ig5-06-msg`); only the message master may be posted until §0 items 1–2. SCRIPT §11.1 and the `ig5-06` direction now say the same as this file. The swap was re-tested: `BODY.does = 'ig5-06-msg'` typechecks, `check:audio:ig5` OK (climax +1.1, arc +0.6, lowest "takes" 0.83), reverted (`cmp` identical). |
| **T2** rolls show false figures | **fixed** | See P7: no frame shows a value other than the final one. Sound: the counters stay only under the growing bars ($300, $99); `$1,500` gets a soft `thump` on its rise instead of its counter and tock. |
| **T3** pile exit unscopes "$300"; cover window | **fixed** | The pile now leaves AS ONE UNIT: it fades over the exit's first 4 f (≈ 90 px of travel, nowhere near the mask line at y 296), so a tag never goes before its figure (`strip-b-pileexit.png`). POSTING §3 and SCRIPT §7: "between 17.25 and 17.5 s (f518–525), never later". |
| **T4** cover thumbnail's bare figures | **fixed** | Thumbnail dropped (P6). |
| **T5** BETA chip undecided | **fixed** | The app's own badge (BetaBadge: sky-50 / sky-200 / sky-700, semibold caps, 24 px) lands beside **Booked** a frame after the swap, booking master only (`BETA` in `Record.tsx`, one switch; `stills/f0660.png`). POSTING §0 item 5 now names it. |
| **T6** TikTok pinned comment | **fixed** | "…10 US live answering services…" (137 / 150). |
| **T7** RESEARCH-prices "no setup fee" stale | **fixed** | §0 and §7 rows annotated as superseded (`lib/pages/home/pricing.ts:243`). |
| **T8** HOOKS §1.8 unhedged attribution | **fixed** | A note under §1.8 points to SCRIPT §7's hedged three rows and records the dropped thumbnail; §2's "as §1.8" inherits it. |
| **ZONE-1** $49 under the price band during the rise | **fixed** | Ours rises from 40 px, and its "$49" rises out of a mask on the band's line (y 1260) while the card is under its place; its zone rect is the visible part. Dense scan: no violation. |
| **ZONE-2** false positives in the pile exit | **fixed** | The papers report their rects only while opacity > .5, which now ends 2 f into the exit (≈ 11 px of travel). Dense scan: no violation. |
| **ZONE-3** shared wordmark's "E" at x 900–912 | **accepted** (no change) | As §4.2: it is the shared `End.tsx` (ig1–ig4's picture); not edited. If ig1–ig4 are ever re-rendered, cap `END.wordmarkW` at 720. |
| **SYNC-1** dock on "up" late | **fixed** | With S1: the glide ends on `M.dock` (f595), the dot fades over [M.dock − 1, M.up]. |
| **SYNC-2** other stamps off | **partly fixed** | (a) "set" via `NUDGE` (S1). Skipped (b) "a month," (on-or-after still holds, 3 f), (c) S13 "and" (the card rises 2 f before its first word anyway), (d) `ig1-07` "Voice." (the shared borrowed take and End.tsx, same as ig1). |
| **S2** rings on word tails | **fixed** | `timing.ts`: a burst-aware ring law (`ringFits`: no onset in (f − 6, f + burst + 1) AND her placed envelope under `CUT.onset` for the whole burst), searched on 16ths per gap: R1 **f37.5** `fx-trill-1`, ring 2 **f153.75** `fx-trill-1`, ring 3 **f408.75** full `fx-trill` (rung out before the cut at f420). The picture's RingPulses follow `M.rings`. Whole-word SII (`wordsii-full-ig5.txt`, the critic's method): "rings." 0.33 → **0.99**, "receptionist:" 0.42 → 0.59 (its floor is now the tag's felt-tip at f125, not the ring), "minutes." 0.17 → 0.54 (effects alone 0.20 → 0.95; the rest is the bed's swell into the cut). HOOKS §1.3 carries the exception. |
| **S3** the roll louder than the impact | **fixed** (to ≈ the target) | `RIDE.build` 13 → 9, starting AT the CTA's end (`[CTA_END, call] → [CTA_END + 6, build]`), tapering 3.5 dB over its last 11 f; `MUSIC.build.snare` 1.5 → 1.2. Roll 400 ms peak −9.69 vs impact −9.20 LUFS-M (was −8.11 vs −9.27: +1.16 → −0.49 LU), limiter 6.32 → **3.2 dB**, climax +1.1 LU. A flat lower ride fails check-mix's **arc** gate (its second into the logo must top the return on "forty-nine" by 0.5 LU: build 6 flat gave +0.1), hence the taper (arc +0.6). "link." whole-word 0.43 → 0.57. |
| **S4** bed hot under "It picks up…" | **fixed** | `RIDE.call` 5 → 3.5: the does act's bed-under-voice 10.4 → **11.4 LU** (`scripts/balance.mjs`). |
| **S5** bed enters mid-"Agency" | **fixed** | `MUSIC.bedFrom` = `upBeat(M.slip1)` = **f90** (the "can't." → "Agency" gap, with slip 1's lift); HOOKS §1.3 notes the exception. "Agency" now sits under the bed (whole-word min 0.55, mean 0.89; check-mix onset SII still passes). The −3.5 dB voice ride on "Agency" is kept (it still sets the climax's headroom). |
| **S6** paper slap on rises; counter lead | **fixed / moot** | Both slip rises are `fx-paper-lift` now. The counter's lead on the digits is moot: no digits change any more (P7). |

### 6.3 Gates (re-run after the last change)

- `npx tsc --noEmit -p .`: clean.
- `npm run sfx:ig5`: 45 cue files, −14.0 LUFS, −1.65 dBTP, limiter 3.2 dB max, 75 cues.
- `npm run check:audio:ig5`: **OK** (`fix-r1/check-audio.txt`): climax +1.1 LU (impact −9.2 vs "commonly" −10.3), arc +0.6 LU, build → impact −15.1 → −9.2, end −85.3 dBFS last frame, 60 words mean 0.96 (lowest "up" 0.80), the name 0.95 / 1.00 / 0.99.
- `npm run check:zones:ig -- --film=ig5`: **PASS** (36 stills + cover). Dense scan of every frame in f86–99, 174–183, 212–223, 248–255, 342–351, 418–441, 520–539, 578–601, 640–649, 760–798 (2nd), 818–839 on `IG5-Zones-9x16`: **0 violations** (`fix-r1/zones-dense.log`).
- `npm run guard:ig5 -- --check`: **PASS gates 1–5**, 255/257 shas, stamps unchanged, **gate P 24/24 byte-identical** (`fix-r1/guard.log`).
- `npm run sfx:ig`: 0 built, 4 up to date.
- `git status --porcelain` on the film 1 / film 2 frozen sets: empty.

### 6.4 Still open

- The return on "forty-nine" measures 10.0 LU bed-under-voice by this round's window (§5.3 said 10.4); the series floor is 10.5. Not raised by a critic; `RIDE.ret` 7 → 6 barely moves the arc's music window (her voice dominates it), so it is cheap if a later round wants it.
- P3's single-baseline grammar (see 6.2).
- ZONE-3 (shared wordmark), by design.

---

## 7. Round 2 fixes

Label `fix-r2`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `90fe6c4`), answering critic round 2 (`look`, `truth`, `sync`, `sound`; QA in `out/ig/qa/ig5/crit-r2-*`). Nothing committed (the orchestrator commits). This section supersedes §1–§6 where they differ. QA for this round: `out/ig/qa/ig5/fix-r2/`.

**Files changed:** `src/ig/ig5/{timing.ts, Cover.tsx, acts/Acts.tsx, stage/{Hook,Ours,Papers,Record,Stage,layout}.ts(x)}`; docs `POSTING.md`, `PIPELINE.md` (§6.2), `SCRIPT.md`, `HOOKS.md`, `RESEARCH-prices.md`, `INFRA-LOG.md`, this file. No shared file was touched (ZoneGuard unchanged; INFRA-LOG "Fix round 2").

**The timeline moved (SYNC-B).** `PLAN.stopLead` 4 → 7 with a new `PLAN.cutQuiet` 8, so the bed's cut stays on f420 (ring 3 still rings out before it) and "Ours?" is said 7 f into the silence. Everything after the pickup is 3 f later ("does" 4 f, on its 16th); the CTA stays on f694 and the impact on f780:

| Moment | Round 1 | Round 2 |
|---|---|---|
| bed cut / pickup / ours rises / "Ours?" | f420 / 422 / 427 / 424 | f420 / **421** (the cut + 1) / **425** ("Ours?" − 2) / **427** |
| her glide to the full stop / its ping | f428–442 / 442 | **f431–447** (after ours lands) / **445** (her visible landing) |
| "forty-nine" (the bed's return) / "No setup fee." | f458 / 503–515 | f461 / 506–518 |
| pile exit / "You" / "set" / dots | f525 / 533 / 540 / 552… | f528 / 536 / 543 / 555… |
| "It" / dock / "up" / "books" | f581 / 595 / 598 / 643 | f585 / 599 / 602 / 647 |
| stop-time / payoff cover window | f420–458 / f518–525 | **f420–461 / f521–528 (17.4–17.6 s)**; since critic round 3 (TRUTH-R3-7) the cover window is **f524–526 (17.45–17.55 s)**: at f521 "fee." is still rising |

### 7.1 Blocking

| Issue | Outcome | What changed / measured |
|---|---|---|
| **LOOK2-B1** the orb's glide is a 2-frame dart | **fixed** | `Stage.tsx` `orbPose`: the glide's clock is linear (`(v) => v`), x keeps `EASE.out3`, y `EASE.inOut`. 120 fps (`strips/glide`, `scripts/orbtrack.py`): x moves from f431.25, y travels mostly f436–443, within 1 px of the full stop at f445. She lands 2 f before the glide's end, so the ping + chime moved there (`PIC.glideLand = M.glide[1] − 2` = f445). She clears "month": at mid-path (f439, (793, 1170)) she is 9 px from the "h"'s top right corner. **Deviation:** the glide now starts once ours has landed (`M.glide = ["Ours?" + 4, + 20]`, 0.53 s, not 0.45 s). Started on "Ours?", the ping fell mid-word: "Ours?" whole-word SII 0.95 → 0.88 (21 % of blocks < 0.7). Now it is 0.94, 0 %. |
| **LOOK2-B2** the pile's fade is a vanish; the trio's tail dies in 1 f | **fixed** | `Papers.tsx` `pileFadeAt`: a linear 3 f fade (`PILE_EXIT.fade` 4 → 3). Measured on the pile's rose ink at 120 fps (`strips/pile-exit`): 100 % at f528, 71 % at 529, 34 % at 530, 0 % at 531. The pile has started up, ≈ 35 px of travel when it is gone, and slip 1's tag is still under the y 296 mask line, so T3 holds. The papers report zone rects while their opacity is > .5 (to ≈ f529.5, ≈ 5 px of travel). The whoosh moved to the pile's last frame / ours' start (`PIC.pileOut = M.you − 5` = f531). `Hook.tsx` `TrioRings`: the tail tween is linear. The outer ring's rose excess now falls over f12–15.5 (`strips/trio-tail`, was f12 → f13). Frame 0 is unaffected by both. |
| **SYNC-B** "Ours?" reaches the screen 3 f after she says it | **fixed** | As above: `PICKUP = LAID.stop + 1` (f421), `OURS_RISE = M.ours − 2` (f425). The pickup click, seed and birth play on the bare desk first: the desk now undraws in 6 f (`Hook.tsx` `UNDRAW` 12 → 6), so it is gone under her orb before the card shows. The card shows its "$49" from f426.25 and is at 94 % by f426.75. "Ours?" is stamped f427.2, and its word lifts 72 → 100 % over [426, 428] (`strips/ours-rise`). `PIC.oursLand` = `M.ours + 3`. `sfx:ig5` restamped and `check:audio:ig5` OK. |
| **SYNC-A** slip 1's "a month" prints 4 f after her "a" | **fixed** | `NUDGE['ig5-02gt'] = {6: −3}` and `M.month = said('agency', ix('agency','month') − 1)` = f192. With TRUTH-R2-1, "a month" is on the slip at 72 % from f157 and lifts on her "a": 120 fps (`strips/amonth`) 72 % to f191, then 100 % by f192.75. The `fx-tock` at f192 now lands on the lift. |

### 7.2 Polish and truth

| Issue | Outcome | What changed / why not |
|---|---|---|
| **LOOK2-P1** cover tile mostly bare | **fixed** | `Cover.tsx`: frame 0's picture is in the lower half, from `stage/Hook.tsx`'s own parts: the desk hairline, the rose light at (740, 1130) with the full-size trio Ø 72 / 156 / 240, on frame 0's ground (`Ground5 t=0`). The small top-right trio is gone. The orb's gap is now `max(10, spaceWidth × 0.8)` ≈ 10 px. Every word stays inside x 86–900, y 260–1380 (zone check PASS, `covers/ig5-cover-0000.png`). |
| **LOOK2-P2** invisible camera move pops the papers | **fixed** | The b3 camera and its swish are dropped (`M.camera`, `CAMERA`, `camAt` removed). The papers sit on static layers from slip 2's landing to the pickup. The swish now plays on P6's visible lift (f274). |
| **LOOK2-P3** two prices overlap in the fold | **fixed** (timing differs from the suggestion) | `Ours.tsx`: ours' words go out over [FOLD, FOLD+4] (`EASE.in2`), then the chip's "From $49 a month" rises out of the card's edge over [FOLD+4, FOLD+10]. They no longer overlap. **Deviation:** [FOLD+3, FOLD+8] / FOLD+8 kept ours' words on screen while her orb sets off across them (P9). "No setup fee." goes first, [FOLD, FOLD+3], because the fold carries it up through her orb's place. |
| **LOOK2-P4** record cramped over the CTA | **fixed** | `RECORD_BACK` { s .55, c (540, 260) }: the record sits at y 458–618, ≈ 92 px under the chip and ≈ 97 px over the CTA's caps (`stills/f0730.png`). `LANE_Y` 440 → 420, between the record and the chip: at full size she clears the chip by ≥ 11 px. |
| **LOOK2-P5** "$49" bar reads as the "$"'s foot | **fixed** | `OURS.bar.y` 284 → 294. The card is 336 tall (P11), so the bar has room under it. |
| **LOOK2-P6** the agency beat is top-heavy | **fixed** | `layout.ts` `B2_DROP` 180: slip 1 rests at y 520–790 through b2, with the stub under it to ≈ y 1020, over the desk at 1130. As her agency line ends, both glide up into the b3 places (`M.lift` [273, 285], `EASE.inOut`, 0.4 s, the swish under it). Slip 2 then rises below them at f283 (`sheet-b1b2.png`, `sheet-b2b3.png`). |
| **LOOK2-P7** blank stub for 1.2 s | **fixed** | The stub carries slip 1's empty amount slot, sized to "$1,500", and it fades as the figure rises (`STUB.slot`, `zoom-slip1-unit.png`). |
| **LOOK2-P8** ring 3 a half-ring under slip 2 | **fixed** | `PhoneRings` is split. R1 and ring 2 stay under the papers. Ring 3 (after slip 2's rise) is drawn over them at Ø 150 (`RING.dLast`), a whole ring round the light that crosses only slip 2's bottom margin, never its words (`zoom-ring3.png`). |
| **LOOK2-P9** her dock crosses SAMPLE CALL's "S" | **fixed** (path differs from the suggestion) | x leads with `EASE.draw` over the hop's first 80 %, and the arc and descent finish after it, so she comes down onto the dot at a steep angle while the record rises under her. At its closest (f595.75) her edge is ≈ 15 px from the "S", and x is on the dot by f596.75 (`zoom-dock.png`, `strips/dock`). **Deviation:** out3 / in2 over [picks, dock] made the first 2 f a 225 px/f dart. The hop now runs 11 f from "It" + 3 (`HOP`), peak ≈ 115 px/f, and lands softly on the vowel of "up" (f599). |
| **LOOK2-P10** frame 0's desk a floating dash | **fixed** | `DeskLine` draws out of the light, x 758 → 86, in the same `EASE.draw` window, so the light always sits on its line (`stills/f0000.png`). The seam uses the same function: at f839 the line spans x 578–758, at f0 x 499–758. |
| **LOOK2-P11** "Ours? From … No setup fee." on one row | **fixed** (the mini-chart skipped) | "No setup fee." moves to the bar's row under the figure row, right-aligned to her orb's right edge (card 306 → 336 px). Ours now reads "Ours? From" → "$49 a month●" → "No setup fee.", in her order (`zoom-f524.png`). Skipped: the stacked mini-chart. It would put a second scale in the card, and the bars already share the x 160 edge. |
| **TRUTH-R2-1** "$99" (and "$300") without its qualifier | **fixed** | `Papers.tsx` `liftOn`, the Tag's unit idiom. Slip 2's "from", "a month," and "for 50 minutes" rise as a unit at 72 % from `M.from99 − 2` (f333). "$99" rises on "ninety-nine" (f343), so every frame with "$99" shows "for 50 minutes". Each word lifts on its own onset. Slip 1 works the same way: "commonly" and "a month" rise at `M.hedge − 2` (f157), "$300" at f175. `ZONE_FRAMES` gains `M.hedge`, `M.from99` and `M.lift[1]`, and the zone check passes. |
| **TRUTH-R2-2** only one master gets rendered and named | **fixed (docs)** | PIPELINE §6.2 "Two masters, two passes": the message pass runs first. Each pass runs `sfx:ig5`, `check:audio:ig5`, guard, zones, render, finish and `check:delivery`, then renames its three files to `…-message-…` / `…-booking-…` with exact-path `mv`. It also covers the chunk and layer folders. POSTING §1 lists both 60 fps and both 120 fps files plus the shared cover, and says to post the message files until §0 items 1–2 are ticked. §7's heading now reads "use these captions whenever the message master is posted". The message cut was re-tested this round: `check:audio:ig5` OK (climax +1.1, arc +0.6, lowest "takes" 0.83), and **Message taken** is on screen (`sheet-message-master.png`). It was then reverted, the booking mix rebuilt, and `check:audio:ig5` OK. |
| **TRUTH-R2-3** reserve hook carries a category-wide $300 | **fixed (docs)** | POSTING §8 and SCRIPT §4.5: the reserve may be posted only once its frame-0 card is re-scoped. Otherwise prefer `ig5-01c` or the curiosity hook. |
| **TRUTH-R2-4** stale cover pointers | **fixed (docs)** | HOOKS §1.8 and SCRIPT b4 / §7 now give "between 17.4 and 17.6 s (f521–528), never later", the window after this round's +3 f. POSTING §3 matches. |
| **TRUTH-R2-5** "No setup fee" has no §6 row | **fixed (docs)** | RESEARCH-prices §6 row 11 (`lib/pages/home/pricing.ts:243`, `lib/phone/pricing.ts:1-6`, both re-read). The §7 annotation points to it. |
| **TRUTH-R2-6** date carry; "price pages" | **fixed (docs)** | POSTING §0 item 6: carry the re-check date into both captions and both pinned comments, and stop and re-cut if a figure moved outside §6. The IG pinned comment now says "two agencies' own published prices" (771 chars, `detect.py` 74.3 PASS). |
| **SYNC-C** Booked reads 3–5 f after "books" | **fixed** | `OUTCOME_AT = M.books − 1`, `BETA_AT = OUTCOME_AT + 3`, `PIC.outcome` mirrored. The pill changes from f648 and Booked is legible at f650 ("books" f647). BETA lands as Booked reads, never beside a readable Answered (`zoom-swap.png`). |
| **SYNC-D** Answered trails its ting | **fixed** | `ANSWERED_AT = M.up` (f602), `PIC.answered` mirrored, the ting cued at `PIC.answered + 2` (f604) as the pill becomes legible. |
| **SEAM-2** S1 shimmer on the 120 fps loop frame | **fixed** (method differs) | `HookCard`: the seam rise settles to exact rest over t [−4, −1], and S1 holds its glide layers for its whole life (`revealStyle` hold). No layer → plain switch happens anywhere, and frame 0 renders like the last seam frames. A switch at t −1 had only moved the shimmer (S1 diff 2.16 vs 0.24 around it). 120 fps (`strips/seamB*`): 3359 → 0 whole 0.148, S1 0.152, against 0.13–0.14 around it. The only S1 bump is "Three"'s own lift + glint (r36–43). Frame 0's S1 crispness is unchanged (gradient energy 5.08 vs 5.13 static). |
| **ZONE-3** shared wordmark / field past x 900 | **accepted** (no change) | As crit-r1: the shared `End.tsx` (ig1–ig4's picture). If ig1–ig4 are ever re-rendered, cap `END.wordmarkW` at 720. |
| **S-R2-1** pickup click over a still picture | **fixed** | On `M.up` the Answered pill starts up (SYNC-D) and her orb pulses once, × 1.08 at + 2.5 f and back by ≈ + 12 f (`takePulse`). Orb area +16 % peak, measured in `strips/dock`. The click stays on the p closure. |
| **S-R2-2** thumps before the figures land | **fixed** | `PIC.figLand` 4: the thumps sit at `M.three + 4` (f180) and `M.fifteen + 4` (f254), on the landing spring's first crossing. The bar ticks still run from the word. |
| **S-R2-4** felt-tip strokes with no stroke | **fixed** | One felt-tip on each tag's unit rise: slip 1 at f92, and slip 2 at f283, layered −1 dB under the paper lift. Strokes 2–3 are dropped and the labels updated. "receptionist:" whole-word effects-only minimum 0.61 → 1.00, "Agency" 0.73 → 0.96. |
| **S-R2-5** payoff bed too forward | **fixed** | `RIDE.ret` 7 → 5.5. Bed under voice in the return 10.0 → **12.0 LU** (`balance.txt`; does 11.8, answering 10.9). Arc still +0.7 LU. The optional EQ / `RIDE.call` changes were not needed. Words with ≥ 25 % of blocks < 0.7: 15 → 12 (`wordsii-full-ig5.txt`). |
| **S-R2-6** ring 3 barely over the swell | **fixed** | The full-trill ring is +2.5 dB (cue −7.0 → −4.5 dB): +4.7 dB over the bed broadband (was +2.4), +4.7 in 100–700 Hz (was +2.2). |
| **S-R2-7** plucks on "up yourself.", hot AGENT keys | **fixed** | The plucks are 2 → −1 dB and the check ting 0 → −3 dB: "up yourself." effects-only minimum 0.53 → 0.62, blocks < 0.7 47 → 35 %. `fx-keys` +2 → −1 dB: AGENT effects-only minimum 0.47 → 0.58. |

### 7.3 Gates (re-run after the last change)

- `npx tsc --noEmit -p .`: clean.
- `npm run sfx:ig5`: 45 cue files, 74 cues, −14.0 LUFS, −1.65 dBTP, limiter 3.2 dB max.
- `npm run check:audio:ig5`: **OK** (`fix-r2/check-audio.txt`):
  - climax +1.1 LU (impact −9.2 vs "commonly" −10.3);
  - arc +0.7 LU;
  - build → impact −15.1 → −9.2;
  - last frame −85.3 dBFS;
  - 60 words mean 0.97, lowest "up" 0.83;
  - the name 0.95 / 1.00 / 0.99.
- `npm run check:zones:ig -- --film=ig5`: **PASS** (35 stills + cover). Dense scan of all 840 frames of `IG5-Zones-9x16`: **0 violations** (`fix-r2/zones30.zones.log`).
- `npm run guard:ig5 -- --check`: **PASS gates 1–5**. 255/257 shas, stamps unchanged, **gate P 24/24 byte-identical** (`fix-r2/guard.log`).
- `npm run sfx:ig`: 0 built, 4 up to date.
- `git status --porcelain` on the film 1 / film 2 frozen sets: empty.

**QA** (`out/ig/qa/ig5/fix-r2/`):
- stills: `stills/` (90 frames), `covers/`;
- sheets: `contact-every6.png`, `sheet-b1b2.png`, `sheet-b2b3.png`, `sheet-b4.png`, `sheet-b5b6.png`, `sheet-end.png`, `sheet-cta-in.png`, `sheet-message-master.png`;
- zooms: `zoom-slip1-unit.png`, `zoom-f524.png`, `zoom-swap.png`, `zoom-ring3.png`, `zoom-dock.png`;
- 120 fps strips: `strips/{glide, pile-exit, trio-tail, ring3, dock, ours-rise, amonth, seamB, seamB0}`;
- sound: `balance.txt`, `wordsii-full-ig5.txt`;
- scripts: `scripts/`.

### 7.4 Still open

- ZONE-3 (the shared wordmark and field), by design.
- The fold has about one frame (f589) with ours' words gone and the chip's not yet up. The card's outline carries it, as in critic P3's own timing.
- The record's body grows about 1 f before its first tool step rises into it. This is unchanged from round 1, and the critics did not raise it.
- "It" (f585) has a whole-word effects-only minimum of 0.46 under `fx-paper-fold`, about the same as round 1 (0.42) and not flagged. The check-mix onset score passes.

---

## 8. Round 3 fixes

Label `fix-r3`. Written 2026-10-07 on `claude/remotion-trailer` (HEAD `0875b09`), answering critic round 3 (`look`, `truth`, `sync`, `sound`; QA in `out/ig/qa/ig5/crit-r3-*`). Nothing committed (the orchestrator commits). This section supersedes §1–§7 where they differ. QA for this round: `out/ig/qa/ig5/fix-r3/`.

**Files changed:** `src/ig/ig5/{timing.ts, Cover.tsx, stage/{Hook,Ours,Papers,Record,Stage,layout,type}.ts(x)}`, the new `src/ig/ig5/stage/settle.ts` (picture only, outside `ig5Hash`); docs `POSTING.md`, `SCRIPT.md`, `HOOKS.md`, `INFRA-LOG.md`, this file. No shared file was touched (`ZoneGuard.tsx` unchanged; INFRA-LOG "Fix round 3").

### 8.1 Blocking

| Issue | Outcome | What changed / measured |
|---|---|---|
| **LOOK3-B1** papers twinkle crisp ↔ soft at rest | **fixed** | `stage/settle.ts`: `settleFrames(config, ε)` is the frame after which a spring's ENVELOPE stays within ε of rest (underdamped: A·e^(−ζω0·t), A = √(1 + (ζω0/ωd)²); critical: (1 + ω0t)·e^(−ω0t)). `springMoving(dt, config)` is true from release until then, never toggling at an overshoot crossing: SPRING.site ≈ 23.9 f, land ≈ 39.8 f, pop ≈ 17.6 f. Used for `e` / `u` (`slipState`), `k` / `u` (`stubState`), ours' rise and glide (`oursY`), the record's rise (`recordState`) and the BETA chip. The same latent bug was in `type.tsx` `Figure` (`|r.y| > .03` with the overshoot clamped to 0 went false at every crossing of SPRING.land): it now holds its layer by the envelope too (ε = .03/80). **Measured** (full scale, 120 fps, `scripts/sharpseries.py`; `pile-sharp.txt`, `stub-sharp.txt`, `fig300-sharp.txt`, `fig99-sharp.txt`): in the pile, $300 / $1,500 / the agency tag take ONE soft → crisp step at r1788 (f447.0; slip 1 and the stub settle at f446.8); $99, "from", the column and the LIVE tag one step at r1780 (f445.0; slip 2 settles at f444.9), the $99 and its tag finishing crisp at r1782 (+1.6, same direction; the critic's render has the same r1782 step). No step > 4 % in any region from r1733 to r1779 (the critic's flashes at r1740, r1760–1762, r1767–1769, r1779–1781 are gone). The stub's tag changes only during its drop (r859–867); its spikes at r933, r962, r990–994 are gone. $300 and $99 each take one step at their landing spring's settle (r848, r1520); what remains between is the figures' own under-rest bounce (motion, not a layer switch). `spikes.py` (A-B-A pops): 0 in all four strips. |
| **TRUTH-R3-1** message-master captions imply $49 books | **fixed (docs)** | POSTING §7: a third edit in both no-booking captions (TikTok "…it answers only your own test calls." · IG "The free trial answers only your own test calls."); `caption.py` READY ×2 (1,416 / 1,218 chars), `detect.py` 89.5 / 78.1 PASS, `humanize.py` nothing to strip. §0 item 4 now says "(booking master only)". The DM's no-booking cut already matched. |
| **SYNC3-A** "No" / "setup" print 3–4 f after she says them | **fixed** | `timing.ts` `NUDGE['ig5-04'] = {6: −2.3, 7: −2.1}`; `M.noSetup = [said(6), said(7), on(8)]` = f503.7 / 508.9 / 518.0 (`Ours.tsx` keeps `at − 1`). Teal ink per word, 120 fps (`nosetup-ink.txt`, box method; it reads ≈ 0.9 f earlier than the critic's column profile on "fee."): "No" 10 / 50 / 90 % at f504.2 / 505.1 / 506.2 (heard f504.0), "setup" 509.5 / 510.4 / 511.6 (heard f509.1), "fee." unchanged. The `fx-tag` moved to f503.7; `sfx:ig5` restamped; check-mix "No" 0.98 (effects alone 1.00). `ZONE_FRAMES` uses `M.noSetup[2]` (unchanged); the cover window is unaffected. |

### 8.2 Polish, truth and sound

| Issue | Outcome | What changed / why not |
|---|---|---|
| **LOOK3-P1** ours' glide up whips and rebounds | **fixed** | `Ours.tsx` `OURS_GLIDE = {stiffness 200, damping 28.3}` (ζ ≈ 1.0006: springUnit's critical branch, no overshoot at all), `OURS_UP` kept; the ground's pool follows it (`oursUpAt`, `Stage.tsx`). Measured on the card's top edge (`ours-glide-track.txt`): peak −24.3 px per 120 fps frame at r2132 (was −38.0), monotone into y 430 with no rebound; its bottom edge is at y 1084 as "You set it up yourself." rises (f534, the band at 1180) and 779 when the track draws (f543, dots from 817). It is still decelerating (≈ 4 px per 120 fps frame at f540) while the caption rises, but never reverses (`sheet-ours-up.png`). |
| **LOOK3-P2** slip 2 is blank paper for 1.6 s | **fixed** | `layout.ts` `SLIP2.slot` {pad 14, padL 8, y 82, h 140, r 18}: the 1.5 px, 30 % graphite amount slot at the figure's cells (8 px on the left, where "from" sits 16 px away), fading over [ninetyNine − 1, + 5] as on slip 1 and the stub (`zoom-slip2-slot.png`: f290, 311, 333, 340, 345). |
| **LOOK3-P3** "forty-nine" is the smallest picture event | **fixed** (both parts; the bloom is subtle) | `Stage.tsx` `poolAt`: .6 of her pool over ours' first second, the last .4 over [fortyNine, + 8] on `EASE.out3`; `Ours.tsx`: the teal edge 2 → 3 px over [fortyNine − 1, + 3], back to the chip's 2 px through the fold. The 72 % → 100 % lift is unchanged. Honest note: on the pearl the pool is a tint (the ground under ours moves ≈ 1–2 levels), so the word's visible events are the ink lift, the edge, ours' bar and P4's axis drawing on it (`sheet-49-axis.png`). |
| **LOOK3-P4** three bars read as underlines | **fixed** (axis at x 147, not 160) | `Ours.tsx` `ScaleAxis` (`layout.ts` `AXIS`): on "forty-nine" a 1.5 px graphite hairline (35 %) draws top to bottom over 8 f (`EASE.draw`) from the $300 bar's row to the $49 bar's, each bar joined to it by a tick on its row as the axis passes; it fades with the pile (`pileFadeAt`, f528–531). **Deviation:** x 147, not 160: every quote's and ours' words also start on x 160 ("LIVE", "from", "Ours?", "$49"), so a rule there would run along their first letters; 13 px left, joined by the ticks, it reads as a bracket from one $0 (`zoom-f524.png`, `sheet-payoff.png`). Zone rect `object $0 axis`; dense scan clean. |
| **LOOK3-P5** cover graphic too light | **fixed** (size; the raise skipped) | `Cover.tsx` `COVER_LOOK`: trio Ø × 1.25 about the light (90 / 195 / 300, outer ring to x 890), strokes × 1.5 (4.5 / 3.4 / 2.25 px), desk 2.25 px, light Ø 24, through new optional props of `DeskLine` / `TrioRings` / `Phone` (defaults unchanged, so frame 0 is untouched). `sheet-cover-34-old-new.png` (200 / 300 px tiles). **Skipped:** raising the desk to y ≈ 1080: the Ø 300 trio would reach y 930, into the attribution's last row and its orb (y ≈ 905–936), and it would leave more bare pearl at the tile's foot, not less. |
| **LOOK3-P6** pulled-back record 22 px left of the column | **fixed** | `layout.ts` `RECORD_BACK.c.x` 540 → 589: the record spans x 331–749, centred on 540 (`stills/f0730.png`). Her step-aside still clears the chip by 12.0 px (unchanged; computed over the path). Note: in the lane she passes just above the record's top edge at f774.5 (nominal Ø 80 vs the record's top: −3.1 px, was −1.7 px at x 540); on the picture the sphere sits ≈ 3 px above the dimmed record as it starts out (`zoom-step-aside-f774.png`). |
| **TRUTH-R3-2** the $99 floor depends on MAP, SAS, Posh | **fixed (docs)** | POSTING §0 item 6 re-opens MAP, SAS and Posh with the test "base fee + 50 × per-minute ≥ $99" (and stops the post if any fails); SCRIPT §6 row 3 marks them ● with their URLs. |
| **TRUTH-R3-3** "Link your sources" reply | **fixed (docs)** | "We don't link providers here. Every figure is from a provider's own pricing page or a published pricing guide, checked 7 Oct 2026." (130); §0 item 6's date-carry list now names the §6 ready replies. |
| **TRUTH-R3-4** IG caption promises sources | **fixed (docs)** | "How we checked is in the pinned comment."; READY (1,360), `detect.py` 76.9 PASS. |
| **TRUTH-R3-5** "Is $49 all-in?" drops VAT | **fixed (docs)** | "No. $49 a month is the Starter plan fee, excl. VAT. The agent's number is $1.15 a month, and minutes past the allowance are billed per minute." (142). |
| **TRUTH-R3-6** SCRIPT §7 / §5.4 stale | **fixed (docs)** | §7: no thumbnail (with why), attribution as built (52 px, y 750–936, the orb ≥ 10 px clear), the graphic as built (and P5's bolder variant); §5.4: 50.6 % / 54.9 %. |
| **TRUTH-R3-7** cover-frame window | **fixed (docs)** | "between 17.45 and 17.55 s (f524–526)" in POSTING §3, SCRIPT b4 and §7, HOOKS §1.8, this file (§1 and §7's table). |
| **TRUTH-R3-8 / SYNC3-P1** outcome before its step resolves | **fixed** | `Record.tsx` `OUTCOME_STEP_DONE = books + 2` (= `OUTCOME_AT + 3`) for "Booked an appointment" and "Took a message"; the step still rises on her word. Booking master: Booked + BETA at f650 beside a step whose spinner is crossfading to its check, both ticked by f652 (`zoom-tools.png`); message master: Message taken and "Took a message" ticked by f646 (`zoom-tools-msg.png`). SYNC-C's swap timing is unchanged. |
| **DOC3-P2** SCRIPT §0.3 misdescribes the band captions | **fixed (docs)** | Band captions rise as a unit at full ink 2 f ahead of their first word (series rule); the 72 % set-and-lift idiom is S1's and the object words'. |
| **ZONE3-P3** right-rail pixels on the shared end card | **accepted** (no change) | As rounds 1–2: shared `End.tsx`. If ig1–ig4 are ever re-rendered, cap `END.wordmarkW` at 720 and the field's right edge at 900. |
| **S-R3-1** pile-exit whoosh early and faint | **fixed** (cue on the critic's fallback level) | `timing.ts` `PIC.oursUp = M.you − 3` (`H` nominal peak f533): its energy peaks at f532.0–532.5 in the stem (−43.7 dB RMS, was −45.4 at f530.5), on ours' fastest travel (f532.5–534 since P1). `db` −4 → **−2** (+2 dB): at −1 "You" kept onset SII 0.93 but its whole-word effects-only minimum fell 0.96 → 0.83; at −2 it is 0.85, onset SII **0.93**, effects alone at the onset **1.00** (the tail is ≈ −52 dB at f536). At `M.you − 4` (the critic's frame) the peak measured f531.0–531.5 here, ahead of the new glide's peak. |
| **S-R3-2** the seed is never heard | **fixed** (dropped) | No `fx-seed` (re-cued on the cut it would have run into "Ours?"): trill → cut → click → ting. 44 cue files, 73 cues (was 45 / 74). |

### 8.3 Gates (re-run after the last change)

- `npx tsc --noEmit -p .`: clean.
- `npm run sfx:ig5`: 44 cue files, 73 cues, −14.0 LUFS, −1.65 dBTP, limiter 3.2 dB max (`sfx-ig5.log`).
- `npm run check:audio:ig5`: **OK** (`check-audio.txt`): climax +1.1 LU (impact −9.2 vs "commonly" −10.3), arc +0.7 LU, build → impact −15.1 → −9.2, last frame −85.3 dBFS, 60 words mean 0.97 (lowest "up" 0.83), the name 0.95 / 1.00 / 0.99. Whole-word SII (`wordsii-full-ig5.txt`): only "a" / "month." of `ig5-04` (effects-only minimum 0.82 → 0.65 on the blocks where "No"'s /n/ and the moved `fx-tag` sit; their mean unchanged) and "You" (above) moved.
- **The message master re-tested:** `BODY.does = 'ig5-06-msg'` typechecks, `check:audio:ig5` **OK** (climax +1.1, arc +0.6, lowest "takes" 0.83; `check-audio-msg.txt`), Message taken on screen (`stills-msg/`); reverted (`cmp` identical), the booking mix rebuilt, `check:audio:ig5` OK.
- `npm run check:zones:ig -- --film=ig5`: **PASS** (zone stills + cover, `zones.log`). Dense scan of all 840 frames of `IG5-Zones-9x16`: **0 violations** (`zones30.zones.log`).
- `npm run guard:ig5 -- --check`: **PASS gates 1–5**: 255/257 shas (the 2 allowed QA edits), stamps unchanged, **gate P 24/24 byte-identical** (`guard.log`).
- `npm run sfx:ig`: 0 built, 4 up to date (`sfx-ig.log`).
- `git status --porcelain` on the film 1 / film 2 frozen sets: empty.

**QA** (`out/ig/qa/ig5/fix-r3/`): `stills/` (38), `stills-msg/`, `covers/`; sheets `sheet-49.png`, `sheet-49-axis.png`, `sheet-payoff.png`, `sheet-ours-up.png`, `sheet-pileexit.png`, `sheet-cover-34-old-new.png`; zooms `zoom-axis-f524.png`, `zoom-f524.png`, `zoom-slip2-slot.png`, `zoom-tools.png`, `zoom-tools-msg.png`, `zoom-step-aside-f774.png`; 120 fps series `pile-sharp.txt`, `stub-sharp.txt`, `fig300-sharp.txt`, `fig99-sharp.txt`, `toggles.txt`, `ours-glide-track.txt`, `nosetup-ink.txt`; sound `check-audio*.txt`, `wordsii-full-ig5.txt`; scripts `scripts/`. (The full-scale strip frames were deleted after measuring; disk.)

### 8.4 Still open

- ZONE-3 (the shared wordmark and field), by design.
- P3's pool bloom is a tint on the pearl; a visible bloom would need a stronger key light than the series uses.
- The step-aside orb passes ≈ 3 px over the dimmed record's top edge at f774.5 (see P6).
- The pile's slip 2 reaches full crispness in two steps 2 render frames apart (r1780, r1782), both soft → crisp; the second is Chrome's, present in the critic's render too.

## 9. Mastering (label `master`; DELIVERY.md)

- **What changed.** The shared impact stack plays with its `slam` 6 dB down (`timing.ts` HITS, `...impactHits(IMPACT).map(…)`).
- **Why.** At full level its first 4 ms decoded from the delivery AAC at −0.73 dBTP (check-delivery ≤ −1.0).
- **Result.**
  - Delivered peaks: −1.66 dBTP (message) and −1.46 dBTP (booking).
  - `check:audio:ig5`: OK. Booking: climax +1.2 LU, arc +0.7 LU. Message: +1.1, +0.6.
  - Everything else in §5.4 and §8.3 is unchanged.
- **What was ruled out.** A lower `MIX.ceiling` made the overshoot worse (−0.64) and failed the climax.

# ig5 · "Three rings" (BUILD: the picture)

Label `picture`. Written 2026-10-07 on `claude/remotion-trailer`. The placeholder title-card acts are replaced by the real picture of SCRIPT.md §2 + HOOKS.md §1 on the placed timeline (28.0 s, 840 f, impact f780, rung 2: `ig5-01g` · `ig5-02gt` · `ig5-03` · `ig5-04` · `ig5-05t` · `ig5-06` · `ig5-07` · `ig1-07`). Picture only: the cue sheet (HITS), the bed and the mix are the sound step's. Nothing committed by this step (the orchestrator commits).

## 1. What each act does

All acts but `end` mount ONE continuous stage (`stage/Stage.tsx` Stage5, every part a pure function of the absolute frame), so act boundaries are invisible. Frames are the placed ones (`timing.ts` M, all off the takes' onsets).

| Act · frames | Picture |
|---|---|
| **hook** 0–86 | Pearl ground, warm key low-left, the phone's rose pool. Desk hairline y 1130 drawing x 86 → 758 from f −6. The rose line light at (740, 1130) with **the ring trio already in flight at f0** (Ø 72 / 156 / 240, strokes 3 / 2.25 / 1.5, ink 85 / 60 / 35 %, linear fade, launches f −40 / −20 / 0, gone by f20 / 40 / 60). S1 "**Three** rings. / Gloves on. / You can't." set at 72 % (headline 104, x 86, rows 400 · 528 · 656, "Three" rose), each word lifting on her onset with a rose glint. R1 at **f30** (passes the ring law). S1 leaves line by line from f80 (2 f apart, 4 f each), gone f88. |
| **agency** 86–283 | Slip 1 rises blank at f88 (ink bar + empty amount slot, −1°). S2 "Agency AI receptionist:" rises f92 after S1 is gone. The bar writes AGENCY AI RECEPTIONIST on f94 / 116 / 125; a ring at **f135**. "commonly" prints f159; "**$300**" (140, rose) rolls 0 → 300 from f176 on 32nd ticks while its hairline draws 600 px from the $0 point x 160; "a month" f195. On "Setup," (f214) the stub drops with weight onto slip 1's blank bottom margin (+3°, SPRING.land) and is stapled; "OFTEN" f236; "**$1,500**" rolls from f250 (no hairline: one-time fee). |
| **answering** 283–422 | Slip 2 rises f283 with the 6 px graphite people stripe; LIVE ANSWERING SERVICE writes f285 / 296 / 311; "from" f335, "**$99**" rolls f344 (hairline 198 px), "a month," f364, "for" "50" "minutes" f380 / 385 / 392. The papers ease back 1.00 → .97 about (540, 740) f291–321. A last unanswered ring at **f405**. |
| **ours** 422–530 | **The pickup** at f422: the rose light springs open into her teal orb (AvaOrb born) and the desk hairline undraws; the phone's pool hands over to her sunday pool. The quotes square up into a pile × .88 about x 160 (slip 2 first, sliding under the stub; slip 1 with its stapled stub a 32nd later), tilt 0, ink 55 %: $300 / $1,500 / $99 at ≈ 123 px, every tag and hedge legible, nothing struck, no total. Ours rises under the pile at 72 %: "Ours? From" / "**$49**" (200, teal, never rolls) "a month" + her orb as the full stop (glide f428–442, arcing right then down, never over "month"); words lift on 424 / 448 / 458 / 482. On "forty-nine" ours' hairline draws **86 px** under the pile's 528 and 174, all from x 160. "No setup fee." (teal) prints f503 / 508 / 515 at ours' upper right. Payoff / cover frame ≈ f521. |
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

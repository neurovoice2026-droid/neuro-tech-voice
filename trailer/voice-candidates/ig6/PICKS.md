# ig6 "One ring": voice picks

Chosen 2026-10-11 from the four Cartesia sets of the 11 synthesised lines (`take-a` … `take-d`, see `STATUS.md`). Nobody here can listen, so every choice is a measurement, by the ig5 method (`voice-candidates/ig5/PICKS.md`, itself the ig1–ig4 / film 2 tape). An analysis script scored every line of every take. The real `src/ig/ig6/timing.ts` was run on candidate casts, for cut A and cut B, to see what each take does to the reel. Tessa (Emotive) speaks every line. The sign-off `ig1-07` is the series' borrow and was never synthesised.

## The outcome

| cut | length · impact | hook rung · trim | hook: "six" / stake word heard | ring 2 · whip · pickup | payoff "receptionist" | CTA starts · AGENT · stops |
|---|---|---|---|---|---|---|
| **A** (`ig6-01`, both apps) | **28.0 s · f780** (END f840, brand f784) | rung 0 (1b holds 15 f) · full script | "six" f36 (1.20 s, 4.3 %) · "receptionist" f79 (2.63 s, 9.4 %) · "can't" f101 | f180 · f330 · **f360** (bar 7 line) | f388 (12.93 s, **46.2 %**) | **f680 (22.67 s, 81.0 %)** · f695 (82.7 %) · f723, **42 f before f765** |
| **B** (`ig6-01b`, TikTok re-cut) | **28.0 s · f780** | rung 0 · full script | "six" f38 (4.5 %) · "can't" f82 (2.73 s, 9.8 %) | f180 · f330 · **f360** | f388 (46.2 %) | f680 (81.0 %) · f695 · f723 (42 f spare) |

The two cuts differ only before f120: B's shorter hook lets `ig6-02a` start on its plan frame f120 (A: f135). From f190 on, the timelines are frame-identical.

Both cuts are inside the client's 20–30 s, SCRIPT's 28 s and the series' CTA window (ig1–ig5: 78–84 %). All ten `ASSERTS` hold in both cuts.

## The picks

How to read the "why" column:
- **Durations:** the line's duration, then the four takes' durations (a/b/c/d) in brackets.
- **`land`:** the last 60 ms of a phrase against its median, in semitones. Negative means the phrase falls.
- **`key`:** the key phrase's loudness and pitch against the rest of the line, plus its stretch, folded into one score as in ig5.
- **F0 track:** `analyse.mjs --track`, semitones re 100 Hz every 20 ms. It also caught the voiced blip that follows a phrase-final creak, which ig5's checker found in every take.
- **SII:** the SII-style intelligibility of each word's 200 ms onset window against the built ig6 mix's bed and effects (`--mask`). Words in a cell are scored this way unless the cell says "in the mix", which is `check-mix` itself.
- **"can't" release:** `words.py`, 5 ms low band (60–900 Hz) and high band (3–8 kHz). A released t shows a closure with both bands down, then a high-band burst before the vowel of "answer". A flapped or glottal t keeps the low band voiced.

| line | take | why |
|---|---|---|
| ig6-01 (hook, cut A) | **take-b** | 3.79 s [3.92/3.79/3.86/3.65]. **The only take that says "can't answer" with a released t.** After the nasal comes a ≈ 50 ms closure: low band −22 to −31 dB, high band −44 to −47 dB re the line. Then a high-band burst to −20 dB, then the vowel of "answer". Takes a, c and d keep the low band voiced (−5 to −7 dB) through a short high-band dip, a flapped "can' answer". **Both sentences fall.** "ring," falls 17 → 12 st, so "One ring, six seconds." is said as two dry facts. "seconds." drops to 11 st and creaks. "answer." sits at 10 st (median 11.6) and goes into creak with **no end blip**. Take-c ends rising (11 → 14 st, uptalk), take-d lifts 10 → 12, take-a creaks and then blips up to 13. "six" 0.88 s in (+1.7 dB over the line), heard at f36 = 1.20 s (SCRIPT: by ≈ 1.3 s). Every hook word is ≥ 0.85 in the mix: the hook is said dry, with no bed until f120. **Over its 3.4 s target, like every take** (flag 1). It costs nothing: rung 0 holds, and `ig6-02a` stops at f167. Take-d is 0.14 s shorter, but its t is flapped and its "answer." lifts. |
| ig6-01b (hook, cut B; ladder rung 4) | **take-a** | 3.14 s [3.14/3.29/3.19/3.33], the shortest. No take of the B hook has a closure-released t (all four glottalise "can't answer"). So the pick goes to the take that makes "can't" the stressed word and lands cleanly. "can't" is +2.1 dB over "You" (b +1.5, d +2.1, c +2.6). "can't" falls 13 → 9 into "answer.", which creaks with the smallest end blip of the four (+3 st; b +5, c +6, d +4). "seconds." falls with no blip (b and d blip to 18–19 st after it). "ring," is a level continuation, 17–19 st. |
| ig6-01r (ladder rung 3, alternate) | **take-b** | 3.56 s [3.78/3.56/3.90/3.73]. The rung's only purpose is to be the faster reading of the same words, and b is the fastest of all eight readings. "ring," is level, "seconds." has no blip, and "answer." creaks with a +2 st end blip. Its t is flapped. Takes a and d release theirs, but at 3.78 / 3.73 s neither is quicker than the placed hook. **It is never placed:** rung 0 fits in all 65,536 casts. |
| ig6-02a | **take-d** | 1.18 s [1.12/1.36/1.19/1.18]. **Unfinished, as directed.** "rings," is a fall-rise: 13 → 20 → 12, then up to 18 st and held level, the classic continuation contour. It is the strongest "rings" (key 7.9: +0.8 dB, +5.1 st, stretch 2.5), every word SII 1.00, and it has no shared onset. Takes a and c also end high, but with an 11–12 st upswing to 22 st, which reads as a question; c shares "it+rings,", and a's "rings" is −3.5 dB. Take-b has a 0.28 s head ("While" stamped in silence). Stops at f167, 7 f before f174 (ring 2 at f180). |
| ig6-02b | **take-a** | 1.45 s [1.45/1.54/1.59/1.50], the shortest and **the only take that keeps the pickup on the f360 bar line**. With b or d, `ig6-03` moves to f244, the whip to f332 and the pickup to f375; c misses shot E (stops f235). "still" carries the quiet weight: key 3.1, +3.6 st, held at 18–19 st, the strongest of the four. "waiting." settles: 18 → 9 st into creak, land −1.7 (c +0.4, d +0.1). Its "someone's" is the line's soft start (0.68; b 0.50, c 0.51, d 0.73), and in the mix it is the one masking FAIL (flag 3). |
| ig6-03 | **take-a** | 2.74 s [2.74/2.61/2.82/2.75]. "Plainly and a little lower": the lowest voice of the four (median 192 Hz; c 211). The least weight on "missed" bar b: pitch peak 17 st (c 21, d 20), +0 dB (b +1.4). "someone else's" settles 13 → 9 st and stays there, "a quiet truth". "customer" is 0.94. Stops by f322 at f240, so the whip stays on f330. A 110 ms inhale at −25 dB re speech leads the take, before "A" (flag 4). Take-b is shorter but leans on "missed" and sinks "customer" (−9.1 dB). Take-c has the clearest "customer" (0.96) but peaks "missed" at 21 st. |
| ig6-04 | **take-d** | 3.36 s [3.04/2.88/2.94/3.36]. **The direction's "day or night easy and confident":** the most unhurried close of the four (1.04 s, stretch 1.34, +0.1 dB), falling 12 → 9 st into creak. A small real lift on the keyword: "AI receptionist" climbs to 18 st (+2.4 over the median) and holds there. The comma after "up," is 0.16 s (aligned gap 0.24 s, the longest). No shared onsets. **It lands the reel's frames on the plan:** "receptionist" f388 (plan ≈ 389), "picks" f415 (≈ 417), "day" f439, so the day cut is f438 (plan 435/436). The sweep lands on f513 and "from" on f515. Take-b has the bigger lift (+3.2) and the highest SII, but its comma is 0.13 s and it would cut on f430 (sweep landing 505, "from" +10 f). Take-a's lift is the smallest (+1.3) and it shares "or+night.". Take-c ends level-to-rising. A 10 ms blip at −33 dB opens the file; "Our" starts at 0.13 s. |
| ig6-05 | **take-a** | 1.72 s [1.72/2.13/2.00/1.66]. Plain and falling: "from" 12 → 9 st through "your words.", "words." land −2.7 into creak, no end blip. Takes b and c rise at the end (+1.1 / +2.0). Take-d is the near-twin (0.06 s shorter, "from" 0.5 dB louder). It has a creak run inside "answers" (four 10 ms pulses) and a rougher envelope (3.46 against 2.93), where a has no click and no mid-line creak. "from" lands on f515, 2 f after the sweep's landing (d f512). Every word is ≥ 0.96. |
| ig6-06 | **take-c** | 1.07 s [1.00/1.05/1.07/1.04]. **"An invitation, not a dare shouted":** the only take that does not hit "Ring" ≈ 9 dB over "yourself". It has Ring +5.5 / yourself −4.3 dB (a +8.7/−8.7, b +9.4/−8.6, d +9.0/−7.8). It is bright (303 Hz) and ends on a light lift (19 → 21 st, land +1.1), a half-smile, not a question. "yourself", the accent word, is 0.94. A 0.14 s head means "Ring" is heard at f589 and "yourself" at f599 (plan ≈ 598). Take-b is the settled alternative (falls −2.4, yourself 0.95) if the owner wants no lift. |
| ig6-07 | **take-a** | 1.68 s [1.68/1.74/1.67/1.62]. **The strongest "AGENT":** +1.8 dB and +1.7 st over the line, held level at the top of her range (18–19 st), key 3.1 (b 0.4, c −1.0, d 0.4). "Comment AGENT" key 7.3 is the highest. It is said as one word (0.56 s), not spelled. "link." falls (−8). No shared onsets (b and d share "the+link."). AGENT 0.90 / link 0.91. In the mix, "link." is 0.78 (≥ 0.7). |
| ig6-07b (no-AGENT alternate) | **take-c** | 1.18 s [1.20/1.17/1.18/1.20]. "link's" is stressed (+4.1 dB, +3.5 st), "bio." falls into creak (−2.0), and there is no shared onset (b and d share "our+bio."). Take-a has a weaker "link's" (+3.0) and a 0.11 s head. Swapped in, the CTA stops earlier, so 28 s holds. |

Five lines come from take-a, two from take-b, two from take-c and two from take-d.

**Every one-line swap keeps 28 s** (the real rules on the picks with one line changed to each other take: rung 0, trim 0, impact f780, 35–44 f of CTA spare, in both cuts). These are the only swaps that change a moment:
- `ig6-02b` b or d moves the pickup to f375 (whip f332).
- `ig6-02b` c faults (stops f235).
- `ig6-07` b/c/d move the CTA's spare to 35/39/44 f.

## Install

One call per source set, `guard.mjs --check` (full, gates 1–6) after each:

| # | Command | Guard after |
|---|---|---|
| 1 | Moved the Kokoro `src/ig/ig6/voice.generated.ts` to the session scratchpad (not deleted; it is also in git at `cbbc115`), then `node scripts/generate-voice.mjs --film=ig6 --install=voice-candidates/ig6/take-a`, every line onto the empty file, so `engine` reads `cartesia`, not `mixed`. | PASS: 1747/1747, 5 stamps, 49 rows + 12 IG6, gate P 30/30 |
| 2 | `… --install=voice-candidates/ig6/take-b --only=ig6-01,ig6-01r` | PASS (same) |
| 3 | `… --install=voice-candidates/ig6/take-c --only=ig6-06,ig6-07b` | PASS (same) |
| 4 | `… --install=voice-candidates/ig6/take-d --only=ig6-02a,ig6-04` | PASS (same) |

**Checked after the installs:**
- Every `public/ig/voice/ig6-*.wav` is byte-identical to its pick and to no other take (sha256): 01 `9257eba8` b · 02a `aff91995` d · 02b `2e4918c7` a · 03 `c3b0bfd2` a · 04 `23a09cdb` d · 05 `2078a9d9` a · 06 `25c3dd49` c · 07 `94804af1` a · 01r `f743e8bf` b · 01b `edf8cdb7` a · 07b `a13ca30b` c.
- Each entry in `src/ig/ig6/voice.generated.ts` is JSON-identical to its pick's. `engine` is `cartesia`, the voice Tessa `6ccbfb76…` on `sonic-3.6-2026-08-27`, 12 lines live.
- `ig1-07` is a byte copy (sha `c73b8a86…`). Its entry equals `src/ig/voice.generated.ts`'s, and its size, mtime and inode are unchanged by the self-copy.
- `scripts/ig6/voice-lines-ig6.json` is unchanged (`4c06fad1…`).

## The timeline (re-anchored on the real reads)

`src/ig/ig6/timing.ts` already derives every line and moment from the measured takes (PLAN floors + `place`, the hook ladder, the trim ladder). Measured against SCRIPT §1–§4 with these takes, every anchor keeps its intent except one, which is re-anchored:

- **The words cut.** The rule was "the first beat ≥ 'from' + a whole beat". With "from" on f515, that cut on f540: the day act grew to 102 f and shot J shrank to 30 f, against its 40 f orbit. It is now **"the first beat ≥ 'from' + 8 f"** (`PLAN.wordsAfterFrom: 8`): the accent has landed on "from" and the sweep's `SPRING.land` has settled. That gives SCRIPT's own f525 (day 438–525, words 525–570), and it gives f525 for the plan's "from" ≈ f510 too.
- **The header** now records the Cartesia picks and the placed timeline of both cuts; the placeholder note covers only the acts.
- No other rule changed. The replica in `search.mjs` was updated with the same rule and still matches the real file on 90/90 casts.

| | hook | 02a | 02b | 03 | whip / cut | hub ring | pickup | 04 | day cut | 05 | words cut | 06 | CTA | field | impact | brand | END |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| plan (SCRIPT §5.3, 2.78 w/s) | f10 | f120 | f190 | f240 | 330 / 333 | f345 | f360 | f368 | f435 | f492 | f525 | f585 | f680 | f662 | f780 | f784 | f840 |
| cut A, the picks | f10 | **f135** | f190 | f240 | 330 / 333 | f345 | **f360** | f368 | **f438** | f492 | f525 | f585 | f680 | f662 | f780 | f784 | f840 |
| cut B, the picks | f10 | f120 | f190 | f240 | 330 / 333 | f345 | f360 | f368 | f438 | f492 | f525 | f585 | f680 | f662 | f780 | f784 | f840 |

Acts, cut A: hook 0–131 · wait 131–234 · missed 234–333 · pickup 333–438 · day 438–525 · words 525–570 · ring 570–654 · end 654–840. Cut B: the same, with hook 0–116 · wait 116–234.

**Word onsets on the timeline (cut A):**

| line | onsets |
|---|---|
| ig6-01 | One f10 · ring, f22 · six f36 · seconds. f51 · Your f77 · receptionist f79 · can't f101 · answer. f111 |
| ig6-02a | While f135 · it f145 · rings, f148 |
| ig6-02b | someone's f190 · still f206 · waiting. f216 |
| ig6-03 | A f245 · missed f251 · call f260 · is f277 · someone f282 · else's f292 · customer. f301 |
| ig6-04 | Our f372 · AI f379 · receptionist f388 · picks f415 · up, f422 · day f439 · or f448 · night. f456 |
| ig6-05 | It f493 · answers f500 · from f515 · your f522 · words. f524 |
| ig6-06 | Ring f589 · it f596 · yourself. f599 |
| ig6-07 | Comment f680 · AGENT f695 · for f711 · the f714 · link. f716 |
| ig1-07 | Neuro f785 · Tech f797 · Voice. f809 |

Cut B's hook: One f10 · ring, f22 · six f38 · seconds. f48 · You f79 · can't f82 · answer. f89.

**Other frames:**
- `END_CARD`: field f662 · AGENT types from f695 · send f731 · roll f750 · URL f785 / 797 / 809 · seam f826.
- `STOP` [322, 375): the bed comes back 3 f after "Our".
- The 1b lockup is gone by f132 in cut A, f110 in cut B.

**Key moments as % of 28.0 s (cut A):**

| moment | frame | % |
|---|---|---|
| "six" | f36 | 4.3 |
| "receptionist" (hook) | f79 | 9.4 |
| ring 2 | f180 | 21.4 |
| whip | f330 | 39.3 |
| pickup | f360 | 42.9 |
| "receptionist" (payoff) | f388 | 46.2 |
| day cut | f438 | 52.1 |
| sweep lands / "from" | f513 / f515 | 61.1 / 61.3 |
| "yourself" | f599 | 71.3 |
| CTA | f680 | 81.0 |
| AGENT | f695 | 82.7 |
| CTA stops | f723 | 86.1 |
| impact | f780 | 92.9 |

## Checks

| gate | result |
|---|---|
| `guard.mjs --check --fast` before the Cartesia runs | **PASS**: 1747/1747, 19 prefixes, 5 stamps, git allowed |
| `guard.mjs --check` (full) after each of the 4 installs and after the re-anchor | **PASS ×5**: gates 1–6. 1747/1747 shas, stamps ig1 `49b90ae44064d049` · ig2 `757d177d35b27cd6` · ig3 `47ae5cf315d3434b` · ig4 `f4500c7a37b6d47e` · ig5 `19ca5ef2038155ea`. 49/49 rows + 12 IG6. **Gate P 30/30 byte-identical** |
| `npx tsc --noEmit -p .` | **PASS** |
| `npm run sfx:ig6` | built: −14.1 LUFS, −1.65 dBTP (gain +6.4 dB, limiter ≤ 7.5 dB), 19 cues, 9 lines, 28.0 s. Stamp `ig6Hash` **`9f1d62e934e98263`** (was `cf43dcc461c242de`). A second run skips. |
| `guard.mjs --check --fast` after the sound build | **PASS** |
| `npm run sfx:ig` | **PASS**: ig1–ig4 "up to date … skipped", "0 built, 4 up to date" |
| `npm run sfx:ig5` | **PASS**: "ig5: up to date (19ca5ef2038155ea) — skipped" |
| Film 1 / 2 frozen sets (`git status` on the 17 paths of the brief) | **PASS** (empty). `git diff 9cb3bc8 HEAD` on them is empty too. |
| `scripts/ig`, `scripts/ig5`, `src/ig/ig1…ig5`, `src/ig/common`, `src/ig/components`, `voice-lines-ig.json`, `src/ig/voice.generated.ts`, `public/ig/voice/ig[1-5]-*` | **PASS** (empty). The only files modified since ig5's delivery are PIPELINE §3.2's four. |
| End-to-end sync (each phrase's first word against her onset in the built stems) | within ±1.3 f on 9 of 12 phrases. "A" (03) and "Our" (04) read early only because of the inhale / the 10 ms blip before the word. "day" is stamped 2.7 f after its /d/. |
| **`npm run check:audio:ig6`** (report, not a gate) | **2 FAIL** (the placeholder run had 5). Everything else passes. **Passing:** master −14.1 LUFS / −1.65 dBTP; dialogue −23 ± 0.00, stem spread 0.5 LU; 45 words mean 0.94; the name 0.97 / 1.00 / 0.99; the end −75.6 dBFS (chord −52.3); arc +3.5 LU. **(1) Climax:** lead −0.0 LU of +1. The loudest dialogue is `ig6-01` @39 ("six"), said dry with no bed under it, at −9.3 LUFS-M, level with the impact. **(2) Masking:** "someone's" (`ig6-02b` @190) scores 0.65 (effects alone 0.95), under the stub bed. The lowest passing words are "link." 0.78, "is" 0.79, "still" 0.83, "night." 0.85. The placeholder run's "rings," 0.60, "picks" 0.53 and "words." 0.70 now pass. |

`CARTESIA_API_KEY` was never printed (key scan: 115 files, 0 hits). Nothing was committed by this step; the orchestrator's wip commit `cbbc115` (21:34) already carries the installs and the re-anchored `timing.ts`.

## Flags

1. **The hook is 3.79 s, over SCRIPT's 3.4 s.** Every reading is over: `ig6-01` 3.65–3.92 s and `ig6-01r` 3.56–3.92 s over eight takes. Tessa at the series speed 1.05 spends ≈ 1.9 s on "One ring, six seconds." The rule the target serves still holds with margin: rung 0 (1b holding 15 f), `ig6-02a` stopped by f167 against f174. The costs:
   - "receptionist" is heard at 2.63 s, not ≈ 1.9 s.
   - In cut A, `ig6-02a` starts on f135, not f120, so the bed enters (f120) 15 f before "While".
   Take-d's 3.65 s would gain 4 f but flaps the t of "can't".
2. **The 2b lockup has 16 f after "waiting." (f216) before the f232 white.** STYLE's hold is ≥ 15 f, so an exit over f228–232 is the only fit, and it overlaps her last 3 f (voiced to f231). SCRIPT's own plan exits at f224–229. This is for the scene build.
3. **`check:audio:ig6`'s two FAILs are the sound pass's.**
   - The **climax** cannot be fixed by a pick: every hook take is dry. Use a VOICE_RIDES dip on the hook, as ig5 rode "Agency", and/or the real impact.
   - **"someone's"** is soft in every take: it starts mid-thought, as directed, right after ring 2's stack. Take-d would score 0.73 by the tape (a 0.68) but moves the pickup off the bar line. Use a bed dip at f188–200, or the real bed.
4. **Two stamps sit after a breath.**
   - `ig6-03` take-a opens with a 110 ms inhale at −25 dB re speech before "A" (stamp f245, sound from f240). Set its tier from `LINE.missed − 2` (f238), not from the stamp.
   - `ig6-04` take-d has a 10 ms blip at −33 dB at f368, under the stop-time.
5. **The SCRIPT's sound frames move with the reads.**
   - The `pop` + `sub` of "bar 2's landing" is now on "can't" at f101, not f78.
   - Lockup 1a leaves from "seconds." + 15 = f66, and 1b starts on "Your" at f77.
   - In cut A, "While" at f135 falls between the f120 and f150 steps.
   - The clock ticks: f30 lands 6 f before "six" (f36); the f60 tock and the f90 tick land inside "seconds." (from f51) and "receptionist" (from f79). The −26 dB / drop rule (SCRIPT §6) applies at the scene build.
6. **Shared onsets in the picks: none.** Every picked take has its own stamp on every word.

## Method (`trailer/out/ig/qa/ig6/voices/`, kept; `out/` is ignored)

- **`analyse.mjs`** is ig5's tape re-pointed at ig6: the SCRIPT §1.3/§5.3 budgets, the key phrases per line, and the real `timing.ts` for cut A and cut B through `analyse-sim.mjs`. `--track=<id>` prints F0; `--mask` scores SII against the built mix's stems.
  - Runs: `report-1.txt` / `metrics.json` (before the install, placeholder masker), `report-post.txt` / `metrics-post.json` (the built mix, with the picks).
- **`search.mjs`** is a replica of `layout()`, the ladders, every ASSERT and the key moments.
  - It is verified against the real file (`--verify`: 90/90).
  - It searches all 4⁸ casts per cut and prints the picks' one-line swaps (`search-picks.txt`).
- **`words.py`**: per-word loudness and the "can't" → "answer" junction.
- **`tail.py`**: line-end levels.
- **`timeline.mts`**: the real timeline of both cuts (`timeline-before-reanchor.txt`, `timeline-reanchored.txt`).
- **`sync.mjs`**: the end-to-end sync against the built stems (`sync.txt`).
- **Logs:** `gates/` (generation, installs, guards, tsc, sfx, check-mix, git).

## Independent check

Done 2026-10-11 at HEAD `cbbc115` by a second agent, which did not make the picks. It used its own tools, not the picker's `analyse.mjs` or `search.mjs`. `sim.mjs` imports the real `src/ig/ig6/timing.ts` on the installed `voice.generated.ts` (cut B: a copy with `CAST = 'B'`). `measure.py`, `yin.py` and `cant2.py` are numpy-only (BS.1770 K-weighting, YIN F0, band levels). Everything is in `out/ig/qa/ig6/voice-check/` (gate logs in `gates/`).

| item | result | evidence |
|---|---|---|
| Installed WAVs = picked takes, byte for byte | **PASS** | 11/11 `public/ig/voice/ig6-*.wav` match the sha256 of their pick and of no other take. 11/11 entries in `src/ig/ig6/voice.generated.ts` are JSON-identical to the pick's. `engine` is `cartesia` (Tessa `6ccbfb76…`, `sonic-3.6-2026-08-27`). `ig1-07` is `c73b8a86…` and its entry equals `src/ig/voice.generated.ts`'s. |
| ig1–ig5 voices and deliverables unchanged | **PASS** | Full `guard:ig6 -- --check`: gates 1–6, 1747/1747 shas, 19 delivered prefixes. Stamps unchanged: ig1 `49b90ae44064d049` · ig2 `757d177d35b27cd6` · ig3 `47ae5cf315d3434b` · ig4 `f4500c7a37b6d47e` · ig5 `19ca5ef2038155ea`. 49 rows + 12 IG6. Gate P 30/30. `sfx:ig`: 0 built, 4 up to date. `sfx:ig5`: skipped. `sfx:ig6`: skipped (`9f1d62e934e98263`, so the mix matches the installed takes and today's `timing.ts`). Film 1/2 frozen sets and ig1–ig5 sources: empty in `git status` and in `git diff 9cb3bc8 HEAD`. The only existing files changed since ig5's delivery are PIPELINE's four. The key (matched by value, only a count printed) is in 0 of the ig6 files and not in the HEAD diff. |
| No overlaps | **PASS** | Both cuts: every file ends before the next line starts. The tightest gaps are 02b → 03 (6 f), 01 → 02a (11 f, cut A) and 01b → 02a (15 f, cut B). In the built stems, no 1/30 s frame has both the odd-line and even-line dialogue stems above −50 dBFS. |
| Length and impact as reported | **PASS** | Cut A and cut B: DURATION 840, IMPACT 780, brand 784, hook rung 0, trim 0, 10/10 ASSERTS. Reproduced, cut A: "six" f36 · "receptionist" f79 · "can't" f101 · 02a @135, stopped f167 · whip 330 / cut 333 · hub ring 345 · pickup 360 · "receptionist" f388 · "picks" f415 · day cut 438 · sweep lands 513 · "from" 515 · words cut 525 · "yourself" 599 · CTA 680 · AGENT 695 · CTA stopped f723 (42 f spare). Cut B: "six" f38 · "can't" f82 · 02a @120, stopped f152, rest identical. The `wordsAfterFrom: 8` rule gives upBeat(523) = f525 (a full beat would give upBeat(530) = f540). `IG6-Reel-9x16` is 3360 f @ 120 (28.00 s). |
| `npx tsc --noEmit -p .` | **PASS** | exit 0; the program includes the 11 `src/ig/ig6/` files. |
| `check:audio:ig6` (report, not a gate) | as reported | The same 2 FAILs: climax −0.0 LU and "someone's" 0.65. |
| Picks challenged | **PASS: no swap** | No take measurably beats a pick while keeping the length and the anchors (below). |

**Swaps, all 33 one-line swaps, both cuts, through the real file.** Every one keeps 840 f, impact f780, rung 0, trim 0 and no overlaps; only `ig6-02b` c faults. **Correction to "These are the only swaps that change a moment" above:** the list misses these swaps, none of which changes the length or the impact:
- `ig6-01` d moves 02a to @131 (cut A).
- `ig6-02a` b starts @131 and stops f170 (A), or stops f159 (B); a stops f166.
- `ig6-04` a/b/c move the day cut to f435/430/433, so the sweep lands f510/505/508 and "from" follows 5/10/7 f later.
- `ig6-05` b moves "from" to f520 and the words cut to f540; d moves "from" to f512, 1 f before the sweep lands.

**ig6-01 b, confirmed.** It is the only released t, measured independently in 10 ms frames, dB re the line's p90:
- **Take-b:** LF falls to −23/−24 and HF to −43/−44 at 3.18–3.22 s. An HF burst to −22 follows, then the vowel of "answer".
- **Takes a, c and d:** LF stays voiced (−6 to −9) through an HF-only dip.
- **`ig6-01b`:** no take releases it. LF stays voiced in all four; the only deep LF dips are the /s/ of "answer".

**The climax claim holds, by about 0.1 LU.**
- **Peakiness:** take-b has the largest crest of the hook takes (momentary max − integrated: a 3.09, **b 4.39**, c 3.64, d 4.01 LU).
- **Built mix, loudest dialogue window per line:** 01 −9.35 (@39), 03 −10.30, 05 −10.86, 04 −11.08, 02b −11.28, 07 −11.47. The impact is −9.36.
- **Hook take-a instead:** it would lower the hook by ≈ 1.3 LU. 03 then becomes the loudest at −10.30, so the lead is ≈ +0.9 LU: still under +1.
- **Cost of take-a:** it would lose the released t, add the end blip, and put "receptionist" 7 f later (f86).
- **Verdict:** keep b. The sound pass's ride stays the fix.

**ig6-03 a: one claim corrected, pick kept.**
- **Not reproduced:** "pitch peak 17 st (c 21, d 20)". YIN takes "missed" up to **23 st in take-a** (b 24, c 23, d 21). The tape's own emphasis score agrees: "missed call" a 3.5 ≈ c 3.4 < d 4.0 < b 4.6.
- **What holds:** "least weight on missed" holds for loudness (a +0.6 dB re the median word; c +0.3, d +1.1, b +3.5), not for pitch. "Lowest voice" holds: a 198 Hz, d 200, b 204, c 212.
- **Take-d:** the lowest "missed" peak and no inhale, so flag 4 would go. But "else's" scores 0.80 SII and "is" stretches to 0.32 s.
- **Take-c:** the brightest of the four, against "a little lower".
- **Verdict:** all four time the same and none is a measurable win, so keep a.

**ig6-04 d, kept with a caveat.** By the tape's own score, d's "receptionist" on its own is the weakest of the four (−0.9; a −0.1, b +0.2, c +0.2); its lift sits on "AI receptionist" (+1.4; c +3.0 is the strongest). d stays because:
- it is the only take whose "from" lands 2 f after the sweep (SCRIPT b5: "from" with the landing);
- it has the most settled "day or night".

c ends rising and its "up," scores 0.88.

**ig6-07 a, kept.** It is the highest-pitched take (≈ 277 Hz; b 261, c 270, d 263), against "slightly lower". But it is the only take that lifts AGENT: YIN puts AGENT +1.3 st over the line, while b, c and d sit 0.1–0.3 st under it. AGENT is the keyword the comment trigger needs.

**Confirmed as written:**
- **02a d:** the lightest continuation, a final rise of ≈ 6 st against 11–13 st for a/b/c, which climb to 22–23 st.
- **02b a:** the only take that keeps f360, and the strongest "still".
- **05 a:** "words." falls −2.2 st with no HF clicks; b and c rise.
- **06 c:** "Ring" is 3.4 dB over "yourself", against 5.9–7.3 dB in the other takes.
- **01b a:** the shortest, 3.14 s.
- **01r b:** the fastest, 3.56 s.
- **07b c.**

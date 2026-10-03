# Trailer #2 (kb): voice picks

Chosen 2026-10-03 from the three Cartesia candidate sets (`take-1`, `take-2`, `take-3`, see `STATUS.md`). Nobody here could
listen, so every choice is a measurement: an analysis script (`trailer/out/kb/voices/analyse.mjs`, Node, no new dependencies,
WAVs read with `scripts/audio/dsp.mjs` `readWav`) scored each line of each take, and a copy of `src/kb/timing.ts` was run on
every candidate combination to see what each take does to the film's anchors.

## The picks

| line | take | why |
|---|---|---|
| kb2-c1 | **take-3** | The clearest yes/no rise (+6.8 st onto "Saturdays?") and the only clean 0.20 s beat after "Hi!"; no dropouts (take-1 has two). Every take places desk-1 at the same frame. |
| kb2-desk-1 | **take-1** | The only take that keeps Part I on the script's grid: rings on 7.0 and 12.0 and all six b05 rolls. Take-2 and take-3 are 0.17–0.20 s longer, so the rings slide to 7.5 and 13.0 and five of the six rolls are lost. Even 0.20/0.22 s commas. Take-3 is the most neutral by pitch (9.7 st range against 13.7), and keeping the grid is worth giving that up. It needs the 2 dB "Saturdays," ride (see below). |
| kb2-c2 | **take-1** | The brightest read (15 st range): an emphatic "Quick one." with an 11 st fall and the biggest rise on "Saturday?". It is heard twice (b03 and b14 SAME QUESTION). Take-2 is flat (6 st). |
| kb2-c3 | **take-1** | No take rises (see Flags). Take-1 is the only one a frame short enough to keep b05's six 8th-note rolls; take-2 and take-3 cost one roll. |
| kb2-vo-1 | **take-2** | The widest controlled range (10.8 st) and the cleanest sentence gap (0.43 s silence, 0.32 s aligned). The clearest statement fall on "brilliant." (−4.7 st), then a peak on "turned" that settles into "a recording.". |
| kb2-vo-2 | **take-2** | The only take whose "Waiting." falls (Δ −1.3 st, no lift at the end), soft and final as directed, after a real question rise on "them?". It also has the least fry (0.08). |
| kb2-vo-3 | **take-1** | Clean 0.12/0.14 s pauses after "Ava," and "phone,"; take-2 runs "Ava, an AI" together with 0.00 s of silence. "The first kind." falls. Take-3 has the firmer "matters." but is 0.15 s longer, and with vo-4 take-2 it pushes the film a bar (to 100 s). |
| kb2-vo-4 | **take-2** | The most unhurried list (2.29 w/s, comma silences 0.17/0.19/0.27 s; take-1's commas measure 0.08–0.17 s). A +4 st lift into "That's your knowledge base" and the strongest key emphasis (−1.4 dB against the line, stretch 1.21). |
| kb2-c4 | **take-1** | The clearest question rise (+4.2 st, terminal slope +15 st/s) and the clearest "around this weekend" (key +2.1 st). Fast and young (5 w/s), as directed. |
| kb2-call-1 | **take-3** | Quick (1.62 s) and the smoothest loudness envelope (roughness 2.6 dB against 4.4), with a natural fall on "moment,". One knee sample, which is negligible. |
| kb2-vo-5 | **take-1** | By far the clearest accent on "the part that answers them" (p90 F0 +6.6 st over the line median, 12.4 st range in the phrase) and the least fry (0.16 against 0.26/0.27). Falls on "differently.". |
| kb2-call-2 | **take-1** | Even, clean phrase gaps (0.22–0.29 s silence); take-2 runs "We are! Saturday" together with 0.06 s. Lively (11.6 st) and shorter than take-3, as "short and natural" asks. |
| kb2-vo-6 | **take-1** | Sets up the key phrase best: 0.35 s of silence (0.22 s aligned) before "in the words you chose", and the key is slowed (stretch 1.13). Take-2 rushes into it (0.11 s aligned); take-3 holds "down," for 0.7 s. |
| kb2-vo-7 | **take-1** | The only "Hours change?" that ends up (+4.8 st from its dip, terminal slope +18 st/s); take-2 ends level and take-3 falls. A decisive "document." fall. |
| kb2-call-3 | **take-3** | The warmest payoff: the strongest "nine till four" (−1.7 dB against the line, stretch 1.40) and the widest range (11.4 st). "four." lands level, not up. |
| kb2-desk-2 | **take-1** | The calmest and lowest read (2.59 w/s, movement 14 st/s), the clearest fall on "normal." (−5.1 st), the least fry, and the fewest knee samples (51 against 67/80). |
| kb2-vo-8 | **take-1** | The slowest read (3.16 w/s) to "let it settle", the widest range (8.9 st), and the only clean falling "do." with no voiced lift after the creak. |
| kb2-vo-9 | **take-2** | "There for every call." is the most present (−1.9 dB against the line) and ends in a pure creaky fall on "call."; take-3 lifts at the end. A clean 0.29 s pause after "Your answers.". |
| kb2-brand | **take-3** | Deliberate (1.96 w/s), and the only "Voice." that falls with no voiced lift at the end (take-1 and take-2 end with a +2 st kick). Proud and final. |

Ten lines come from take-1, five from take-2 and four from take-3. Both of Leo's lines come from take-1, and every role keeps the same Cartesia voice (`STATUS.md`).

**Installed** with `node scripts/generate-voice.mjs --film=kb --install=voice-candidates/kb/take-N --only=…`, one call per take.
Each `public/kb/voice/*.wav` is byte-identical to its pick, and its `src/kb/voice.generated.ts` entry is identical to the pick's entry
(only `file` is rewritten). The header no longer says PLACEHOLDER.

**caller4** is pinned to Daniel (`47c38ca4-5f35-497b-b1a3-415245fb35e1`, name "Daniel") in `scripts/voice-lines-kb.json`. The
installed `voice.generated.ts` still carries the candidates' `voices.caller4.name: ""`, because `--install` copies the candidate
set's voice record and the takes were pinned through an env var. The id is Daniel's.

## The voice post: one ride

`kb2-desk-1` take-1 peaks at −1.5 dBFS on "Saturdays," at −23 LUFS, a 21.5 dB peak-to-loudness ratio. The dialogue-bus limiter
(`MIX.dialogueCeil`) clamps that word by about 9 dB, and `master()`'s three trim passes leave every placement 0.6 LU under the
dialogue target. check-mix measured −20.6 against −20 ± 0.5. The placeholder failed the same way, because it already used this file.

`src/kb/timing.ts` `VOICE_RIDES` now rides that word 2 dB down: frames 18–42 of the line, taken from its "Saturdays," phrase, with
3-frame ramps that fall inside the commas. This evens the line, which matches its direction ("even, unhurried rhythm"), and lands
all three placements at −20.3. The other two desk-1 takes pass without a ride (−20.3 and −20.2) but break Part I. Both measured
offline with `out/kb/voices/mixtest.mjs`, which runs film 1's unchanged `master()`.

## The film with the picks

`src/kb/timing.ts` re-derives cleanly. DURATION is 2940 frames (98.0 s), exactly the placeholder's length. Every anchor stays on
the grid. A run with the shortest take of every line gives the same anchors, so the real takes force every move below and no
choice of take avoids them. Each anchor moves by whole bars under the script's rule.

| anchor | plan (frame / s) | placed (frame / s) | moved | position |
|---|---|---|---|---|
| ringOne | 60 / 2.0 | 60 / 2.0 | — | bar line |
| hardStop | 540 / 18.0 | 540 / 18.0 | — | bar line |
| waiting | 720 / 24.0 | 780 / 26.0 | +1 bar | bar line |
| liveRing | 1200 / 40.0 | 1320 / 44.0 | +2 bars | bar line |
| resume | 1500 / 50.0 | 1620 / 54.0 | +2 bars | bar line |
| deskRing | 2235 / 74.5 | 2415 / 80.5 | +3 bars | beat 2 of the bar |
| impact | 2580 / 86.0 | 2820 / 94.0 | +4 bars | bar line |
| end | 2700 / 90.0 | 2940 / 98.0 | +4 bars | bar line |

- **waiting:** vo-1 (at least 4.39 s) plus vo-2's lead-in to "Waiting" (at least 2.47 s) is about 6.9 s. It can never fit the 5.5 s between vo-1 at 18.25 and 24.0 (after the 0.25 s minimum gap). "Waiting" lands on the bar at 26.0, with a 0.83 s gap from vo-1.
- **liveRing:** vo-4 (at least 7.8 s) needs more than the 6.7 s that 40.0 + 1 bar leaves, so it moves one more bar (44.0).
- **deskRing:** the call, line and change chain plus c2 and call-3 needs about 1.9 s more than the plan, so it moves +1 bar (80.5, still beat 2).
- **impact:** vo-9 (at least 3.5 s) needs more than the 2.7 s that a close starting at 88.0 leaves, so it moves +1 bar (94.0). The end moves with it (98.0).

**Part I:** rings fall at 2.0, 7.0 and 12.0 (bar, beat 3, bar), with pickups at 2.5, 7.25 and 12.125. Every call/answer pair sits between its
rings. The answers' last voiced frames end 3 frames before ring 2 and 0 frames before ring 3 (the third ring arrives as "two." dies away),
and 52 frames before the hard stop. The six b05 rolls fall on 8ths from 16.5, and the hard stop is on 18.0.

**Room tone** after desk-2 is 2.17 s before vo-8 (2.1 s from the end of the file), at least one bar.

**VOICES** (sorted by `at`, 30 fps frames):

| at (frame) | at (s) | id | length (frames) | length (s) |
|---:|---:|---|---:|---:|
| 79 | 2.633 | kb2-c1 | 55 | 1.83 |
| 143 | 4.767 | kb2-desk-1 | 67 | 2.23 |
| 221 | 7.367 | kb2-c2 | 68 | 2.27 |
| 296 | 9.867 | kb2-desk-1 | 67 | 2.23 |
| 368 | 12.267 | kb2-c3 | 49 | 1.63 |
| 424 | 14.133 | kb2-desk-1 | 67 | 2.23 |
| 548 | 18.267 | kb2-vo-1 | 133 | 4.43 |
| 706 | 23.533 | kb2-vo-2 | 91 | 3.03 |
| 818 | 27.267 | kb2-vo-3 | 207 | 6.90 |
| 1043 | 34.767 | kb2-vo-4 | 249 | 8.30 |
| 1331 | 44.367 | kb2-c4 | 56 | 1.87 |
| 1395 | 46.500 | kb2-call-1 | 49 | 1.63 |
| 1456 | 48.533 | kb2-vo-5 | 146 | 4.87 |
| 1628 | 54.267 | kb2-call-2 | 137 | 4.57 |
| 1905 | 63.500 | kb2-vo-6 | 108 | 3.60 |
| 2033 | 67.767 | kb2-vo-7 | 122 | 4.07 |
| 2201 | 73.367 | kb2-c2 | 68 | 2.27 |
| 2276 | 75.867 | kb2-call-3 | 94 | 3.13 |
| 2385 | 79.500 | kb2-desk-2 | 80 | 2.67 |
| 2528 | 84.267 | kb2-vo-8 | 65 | 2.17 |
| 2648 | 88.267 | kb2-vo-9 | 106 | 3.53 |
| 2835 | 94.500 | kb2-brand | 46 | 1.53 |

## Checks

- `node --experimental-strip-types --no-warnings scripts/sfx.mjs --film=kb` rebuilt `public/kb/sfx/mix.wav`: −15.5 LUFS, −1.65 dBTP, 74 cues, 22 lines, 98.0 s.
- `check-mix --film=kb` **passes every dialogue check**. Files are at −23 LUFS ± 0.01. Every line in the stem is at −20.0 to −20.3, a 0.3 LU spread. Phone presence is −11.8 to −15.6 dB (at least −16). Intelligibility has a mean of 0.98, with the lowest word "Quick" at 0.77 (at least 0.7). The name scores 0.94 to 1.00 (at least 0.9).
- **One failure remains, and it is not a dialogue check:** the climax. The logo impact is −9.6 LUFS-M, level with the loudest dialogue moment (vo-5's "When someone calls" over the stop-time pad); it needs to be at least 1 LU louder. The placeholder failed the same way. Voice choice cannot fix it: vo-5 take-2 makes the dialogue maximum −9.1, and take-3 moves it to vo-3 at −9.6. The fix belongs to the sound pass (`MIX.impact` and the bed ride into the logo, or the stop-time bed under vo-5).
- `npm run typecheck` passes, and `verify-film1 --fast` passes (gates 1–5 and 10).

## Flags

- **kb2-c3 never rises.** In all three takes "What are your weekend hours?" falls into creak on "hours?" (62–86 % of its voiced frames are fry). This is the natural wh-question contour, and the autopilot gag works with it. If the rise is required, c3 has to be regenerated; for example, try `curious` and a `speak` text with an upward cue.
- **Desk-1 neutrality against the grid.** Take-3 is the flattest, most matter-of-fact read, but it costs Part I its strong-beat rings and five rolls.
- **Fry.** Tessa ends most phrases in creak (fry 0.11–0.36 of voiced frames, in every take). Many Ava lines also end with a short voiced lift after the creak. Where it mattered (vo-2, vo-8, vo-9, brand), the pick is a take without it.

## Method (`trailer/out/kb/voices/`, untracked: `out/` is ignored)

`analyse.mjs [--picks=picks.json] [--track=<id>]` measures, per line and take:
- **Rate:** words per second over the spoken span, and syllables per second with pauses removed.
- **Gaps:** at each comma, full stop and question mark, measured two ways: the audio silence (10 ms frames more than 30 dB under the line's speech level) and Cartesia's aligned phrase gap. Also hesitations, meaning silences of 150 ms or more inside a phrase.
- **F0:** a YIN autocorrelation tracker on a 1 kHz low-passed 16 kHz copy, with a CMNDF candidate set. Each frame takes an octave-aware choice by continuity against the line's histogram mode, then the track is despiked and smoothed, on voiced frames only. From it: range (p95 − p5, in st), movement (the standard deviation of the smoothed F0 slope, in st/s), and fry (the share of sonorant frames that are aperiodic).
- **Final contours:** for questions, the rise from the word's lowest point and the terminal slope. For statements, the landing (the last 60 ms against the phrase median).
- **Key-phrase emphasis:** loudness against the rest of the line, p90 F0 against the line median, and stretch (the line's syllable rate divided by the key phrase's).
- **Smoothness:** impulses (2nd-difference outliers, mostly plosive bursts, so compare takes of the same line only), spikes, dropouts, and envelope roughness.
- **Peak and level:** peak, knee counts, and clipping. No take clips.
- **Film:** each candidate combination is run through `src/kb/timing.ts`.

`mixtest.mjs` runs `master()` offline on a candidate set and reproduces check-mix's dialogue and climax numbers exactly.

Column notes: "gaps" gives the silence first, then the aligned gap. "final contour" uses `↑` for a question's rise from its dip and `land` for the last 60 ms against the phrase median. "fry" marks a creaky ending. "film" is the film's length with that take swapped in and the other lines at the picks; a "+bar" entry names the first anchor it moves.

| line | take | dur s (Δ est) | w/s | gaps at punctuation, s: silence / aligned | F0 range st · mov st/s · fry | final contour, st | key phrase: loud dB · pitch st · stretch | impulses · drops · rough dB | peak dBFS · knee | film |
|---|---|---|---|---|---|---|---|---|---|---|
| kb2-c1 | t1 | 1.88 (−0.22) | 3.26 | ! 0.15/0.23 | 5.4 · 17 · 0.18 | Hi! land +0.1 fry · Saturdays? ↑+4.7 (Δ+4.2, land +4.4) | — | 0 · 2 · 3.60 | -6.86 · 0 | 98 s |
|  | t2 | 1.79 (−0.31) | 3.45 | ! 0.15/0.09 | 6.0 · 16 · 0.11 | Hi! land — · Saturdays? ↑+4.6 (Δ+4.1, land +4.3) | — | 0 · 0 · 3.87 | -6.41 · 0 | 98 s |
|  | **t3 ★** | 1.83 (−0.27) | 3.40 | ! 0.20/0.16 | 8.3 · 18 · 0.16 | Hi! land — fry · Saturdays? ↑+6.8 (Δ+6.7, land +5.9) | — | 0 · 1 · 3.74 | -7.04 · 0 | 98 s |
| kb2-desk-1 | **t1 ★** | 2.23 (+0.33) | 2.15 | , 0.20/0.11 · , 0.22/0.14 | 13.7 · 16 · 0.20 | two. land +4.7 fry | — | 1 · 0 · 2.99 | -1.52 · 26 | 98 s |
|  | t2 | 2.40 (+0.50) | 2.07 | , 0.18/0.15 · , 0.13/0.16 | 11.3 · 17 · 0.11 | two. land +0.3 | — | 0 · 0 · 2.72 | -2.34 · 13 | 98 s, rings 7.5/13.0, 1 roll |
|  | t3 | 2.42 (+0.52) | 2.02 | , 0.18/0.08 · , 0.17/0.08 | 9.7 · 11 · 0.06 | two. land −0.4 | — | 0 · 0 · 2.66 | -1.79 · 23 | 98 s, rings 7.5/13.0, 1 roll |
| kb2-c2 | **t1 ★** | 2.26 (−0.24) | 3.58 | . 0.36/0.15 | 15.1 · 30 · 0.08 | one. land −11.2 · Saturday? ↑+15.5 (Δ+15.1, land +7.2) | — | 0 · 1 · 3.78 | -7.24 · 0 | 98 s |
|  | t2 | 2.16 (−0.34) | 3.70 | . 0.13/0.19 | 6.0 · 17 · 0.10 | one. land −1.0 fry · Saturday? ↑+5.9 (Δ+5.8, land +5.1) | — | 0 · 0 · 3.66 | -7.57 · 0 | 98 s |
|  | t3 | 2.21 (−0.29) | 3.70 | . 0.13/0.17 | 12.5 · 36 · 0.13 | one. land −3.4 fry · Saturday? ↑+12.5 (Δ+12.2, land +4.5) | — | 0 · 0 · 3.85 | -6.88 · 0 | 98 s |
| kb2-c3 | **t1 ★** | 1.61 (−0.19) | 3.13 | — | 7.7 · 31 · 0.17 | hours? no voiced rise (86 % fry), land −4.0 | — | 0 · 0 · 3.21 | -9.44 · 0 | 98 s |
|  | t2 | 1.64 (−0.16) | 3.04 | — | 5.2 · 31 · 0.12 | hours? no voiced rise (62 % fry), land +1.1 | — | 0 · 1 · 2.45 | -7.96 · 0 | 98 s, 5 rolls |
|  | t3 | 1.66 (−0.14) | 2.97 | — | 8.4 · 36 · 0.14 | hours? no voiced rise (67 % fry), land −0.2 | — | 0 · 0 · 2.64 | -8.08 · 0 | 98 s, 5 rolls |
| kb2-vo-1 | t1 | 4.50 (+0.90) | 2.45 | . 0.13/0.40 | 8.8 · 26 · 0.16 | brilliant. land −2.6 · recording. land +0.6 fry | −3.6 · +0.9 · 0.91 | 7 · 0 · 3.47 | -8.24 · 0 | 98 s |
|  | **t2 ★** | 4.41 (+0.81) | 2.50 | . 0.43/0.32 | 10.8 · 26 · 0.16 | brilliant. land −4.7 · recording. land −0.1 | −4.1 · +0.2 · 1.00 | 8 · 0 · 3.47 | -7.59 · 0 | 98 s |
|  | t3 | 4.39 (+0.79) | 2.50 | . 0.10/0.24 | 9.2 · 25 · 0.15 | brilliant. land −3.7 fry · recording. land +0.3 | −3.9 · +0.3 · 0.84 | 10 · 0 · 3.47 | -6.97 · 0 | 98 s |
| kb2-vo-2 | t1 | 3.08 (+0.48) | 2.56 | ? 0.88/0.76 | 6.6 · 25 · 0.15 | them? ↑+4.7 (Δ+4.3, land +1.4) · Waiting. land +1.1 fry | −4.7 · +1.3 · 1.46 | 7 · 1 · 4.15 | -5.37 · 0 | 98 s |
|  | **t2 ★** | 3.02 (+0.42) | 2.63 | ? 0.76/0.79 | 6.8 · 25 · 0.08 | them? ↑+2.8 (Δ+2.0, land +4.3) · Waiting. land −1.0 | −3.0 · +0.2 · 1.38 | 6 · 0 · 3.42 | -5.94 · 0 | 98 s |
|  | t3 | 2.95 (+0.35) | 2.63 | ? 0.75/0.71 | 7.5 · 28 · 0.10 | them? ↑+1.7 (Δ+0.4, land +2.8) · Waiting. land +2.2 | −3.5 · +1.6 · 1.37 | 6 · 1 · 3.23 | -7.13 · 0 | 98 s |
| kb2-vo-3 | **t1 ★** | 6.88 (+0.88) | 2.91 | . 0.18/0.15 · . 0.28/0.18 · , 0.12/0.08 · , 0.14/0.13 | 10.1 · 25 · 0.13 | repeats. land −5.3 · matters. land +1.0 · kind. land −4.7 fry | −5.5 · −0.8 · 1.08 | 17 · 1 · 3.75 | -6.24 · 0 | 98 s |
|  | t2 | 6.78 (+0.78) | 2.97 | . 0.22/0.15 · . 0.25/0.32 · , 0.00/0.16 · , 0.07/0.30 | 10.4 · 23 · 0.17 | repeats. land −2.4 · matters. land −1.4 fry · kind. land −2.2 | −6.2 · +0.8 · 0.96 | 14 · 1 · 3.58 | -4.16 · 0 | 98 s |
|  | t3 | 7.03 (+1.03) | 2.87 | . 0.23/0.22 · . 0.21/0.23 · , 0.12/0.08 · , 0.13/0.16 | 12.3 · 22 · 0.15 | repeats. land −4.3 · matters. land −6.1 fry · kind. land +0.1 fry | −6.6 · +1.3 · 0.96 | 19 · 2 · 3.70 | -5.87 · 0 | 100 s (+bar: liveRing…) |
| kb2-vo-4 | t1 | 7.82 (+1.82) | 2.42 | . 0.24/0.16 · , 0.10/0.17 · , 0.16/0.08 · , 0.18/0.10 · . 0.32/0.23 | 8.9 · 20 · 0.13 | once. land −4.7 fry · website. land −3.1 fry · base. land −0.8 fry | −2.7 · −1.2 · 1.11 | 22 · 1 · 3.45 | -6.86 · 0 | 98 s |
|  | **t2 ★** | 8.28 (+2.28) | 2.29 | . 0.27/0.19 · , 0.17/0.16 · , 0.19/0.16 · , 0.27/0.11 · . 0.56/0.32 | 10.0 · 20 · 0.13 | once. land −7.5 fry · website. land −6.9 fry · base. land −5.5 | −1.4 · −2.5 · 1.21 | 20 · 0 · 3.38 | -6.24 · 0 | 98 s |
|  | t3 | 8.31 (+2.31) | 2.28 | . 0.28/0.22 · , 0.18/0.16 · , 0.14/0.24 · , 0.21/0.16 · . 0.49/0.40 | 10.6 · 18 · 0.13 | once. land −3.9 · website. land −2.8 fry · base. land −3.7 fry | −1.9 · −1.6 · 1.09 | 19 · 1 · 3.43 | -5.97 · 0 | 98 s |
| kb2-c4 | **t1 ★** | 1.84 (−0.26) | 5.00 | — | 7.9 · 11 · 0.21 | weekend? ↑+4.2 (Δ+4.1, land +1.9) | −2.1 · +2.1 · 1.07 | 0 · 0 · 2.99 | -7.21 · 0 | 98 s |
|  | t2 | 1.93 (−0.17) | 5.00 | — | 12.1 · 12 · 0.20 | weekend? ↑+3.4 (Δ+3.4, land +0.0) | −2.3 · +3.2 · 1.07 | 0 · 0 · 3.07 | -7.17 · 0 | 98 s |
|  | t3 | 2.01 (−0.09) | 4.79 | — | 6.2 · 17 · 0.17 | weekend? ↑+1.9 (Δ+1.8, land +0.7) | −2.1 · +0.9 · 1.12 | 0 · 0 · 3.12 | -6.76 · 0 | 98 s |
| kb2-call-1 | t1 | 1.75 (+0.25) | 2.84 | , 0.25/0.14 | 7.8 · 21 · 0.36 | check. land +0.1 fry | — | 8 · 0 · 4.38 | -4.26 · 0 | 98 s |
|  | t2 | 1.57 (+0.08) | 3.12 | , 0.23/0.14 | 7.7 · 27 · 0.36 | check. land +0.0 fry | — | 0 · 0 · 4.35 | -6.93 · 0 | 98 s |
|  | **t3 ★** | 1.62 (+0.12) | 3.12 | , 0.25/0.09 | 8.0 · 25 · 0.34 | check. land −0.1 fry | — | 4 · 0 · 2.59 | -2.85 · 1 | 98 s |
| kb2-vo-5 | **t1 ★** | 4.85 (+0.25) | 3.28 | , 0.17/0.08 · , 0.25/0.16 | 12.1 · 32 · 0.16 | differently. land −2.3 | −5.4 · +6.6 · 1.05 | 11 · 1 · 3.58 | -7.94 · 0 | 98 s |
|  | t2 | 4.79 (+0.19) | 3.33 | , 0.13/0.08 · , 0.28/0.24 | 11.4 · 26 · 0.26 | differently. land −2.6 fry | −5.8 · +3.3 · 1.07 | 7 · 0 · 3.43 | -9.22 · 0 | 98 s |
|  | t3 | 4.87 (+0.27) | 3.28 | , 0.12/0.12 · , 0.28/0.24 | 11.9 · 29 · 0.27 | differently. land −1.1 fry | −5.9 · +4.6 · 0.98 | 12 · 1 · 3.26 | -9.03 · 0 | 98 s |
| kb2-call-2 | **t1 ★** | 4.54 (+1.34) | 2.19 | ! 0.26/0.16 · . 0.29/0.17 · , 0.22/0.16 | 11.6 · 28 · 0.16 | are! land +0.4 fry · two. land +1.4 · closed. land — fry | −3.5 · −0.1 · 1.18 | 7 · 2 · 3.35 | -4.43 · 0 | 98 s |
|  | t2 | 4.22 (+1.02) | 2.35 | ! 0.06/0.07 · . 0.26/0.11 · , 0.20/0.08 | 13.8 · 26 · 0.10 | are! land −2.5 · two. land −0.2 · closed. land −0.2 fry | −3.7 · −2.0 · 1.28 | 7 · 0 · 3.39 | -4.28 · 0 | 98 s |
|  | t3 | 4.72 (+1.52) | 2.11 | ! 0.24/0.08 · . 0.26/0.14 · , 0.17/0.16 | 11.2 · 21 · 0.14 | are! land −2.8 · two. land −0.5 · closed. land — fry | −3.5 · +0.1 · 1.29 | 8 · 1 · 3.13 | -5.90 · 0 | 98 s |
| kb2-vo-6 | **t1 ★** | 3.58 (−0.22) | 3.69 | , 0.15/0.08 · , 0.35/0.22 | 9.3 · 16 · 0.21 | chose. land −1.3 fry | −5.1 · −4.3 · 1.13 | 9 · 0 · 3.32 | -5.86 · 0 | 98 s |
|  | t2 | 3.56 (−0.24) | 3.61 | , 0.10/0.09 · , 0.21/0.11 | 10.5 · 10 · 0.22 | chose. land −0.7 fry | −4.0 · −4.8 · 1.06 | 7 · 0 · 4.35 | -6.25 · 0 | 98 s |
|  | t3 | 3.66 (−0.14) | 3.61 | , 0.06/0.08 · , 0.26/0.24 | 9.5 · 17 · 0.23 | chose. land −0.8 fry | −5.3 · −6.2 · 0.94 | 12 · 0 · 3.05 | -5.94 · 0 | 98 s |
| kb2-vo-7 | **t1 ★** | 4.06 (+0.16) | 2.94 | ? 0.27/0.14 · . 0.27/0.24 | 9.5 · 23 · 0.28 | change? ↑+4.8 (Δ−2.2, land +1.2) · document. land −8.1 fry · answer. land +3.1 fry | −3.5 · +0.1 · 0.93 | 12 · 0 · 3.82 | -3.31 · 0 | 98 s |
|  | t2 | 4.26 (+0.36) | 2.78 | ? 0.32/0.22 · . 0.18/0.12 | 8.4 · 20 · 0.24 | change? ↑+3.7 (Δ−4.8, land +0.0) · document. land −5.2 fry · answer. land +1.6 fry | −3.2 · +0.9 · 0.78 | 12 · 0 · 3.98 | -6.32 · 0 | 98 s |
|  | t3 | 4.24 (+0.34) | 2.83 | ? 0.35/0.22 · . 0.30/0.21 | 15.1 · 20 · 0.24 | change? ↑+1.7 (Δ−5.3, land −0.4) · document. land +5.0 · answer. land +2.3 fry | −3.6 · +1.9 · 0.83 | 19 · 0 · 3.91 | -6.39 · 0 | 98 s |
| kb2-call-3 | t1 | 3.30 (+0.50) | 2.74 | ! 0.00/0.00 | 8.9 · 34 · 0.17 | can! land −5.0 · four. land +0.5 fry | −2.4 · +0.0 · 1.27 | 4 · 0 · 3.15 | -9.00 · 0 | 98 s |
|  | t2 | 3.04 (+0.24) | 2.88 | ! 0.00/0.00 | 8.9 · 27 · 0.16 | can! land −3.0 · four. land +0.9 fry | −3.4 · −0.2 · 1.23 | 3 · 0 · 2.87 | -8.21 · 0 | 98 s |
|  | **t3 ★** | 3.12 (+0.32) | 2.81 | ! 0.00/0.00 | 11.4 · 25 · 0.15 | can! land −7.5 · four. land −0.1 fry | −1.7 · −1.5 · 1.40 | 3 · 1 · 2.79 | -6.64 · 0 | 98 s |
| kb2-desk-2 | **t1 ★** | 2.66 (+0.06) | 2.59 | . 0.28/0.12 | 12.4 · 14 · 0.08 | normal. land −5.1 · slow. land +0.3 | — | 0 · 0 · 3.20 | -1.15 · 51 | 98 s |
|  | t2 | 2.60 (+0.00) | 2.68 | . 0.33/0.20 | 13.7 · 20 · 0.11 | normal. land −5.6 · slow. land −1.6 fry | — | 0 · 0 · 3.08 | -1.11 · 80 | 98 s |
|  | t3 | 2.38 (−0.22) | 2.92 | . 0.32/0.20 | 8.9 · 20 · 0.15 | normal. land −2.2 · slow. land −3.8 fry | — | 5 · 0 · 3.71 | -1.08 · 67 | 98 s |
| kb2-vo-8 | **t1 ★** | 2.15 (−0.05) | 3.16 | — | 8.9 · 27 · 0.11 | do. land −1.4 | −3.1 · −1.8 · 0.97 | 3 · 1 · 4.33 | -7.84 · 0 | 98 s |
|  | t2 | 2.19 (−0.01) | 3.36 | — | 6.8 · 22 · 0.25 | do. land +0.6 fry | −3.6 · +0.6 · 0.98 | 5 · 0 · 4.18 | -8.15 · 0 | 98 s |
|  | t3 | 1.99 (−0.21) | 3.49 | — | 7.6 · 21 · 0.27 | do. land −0.7 | −1.3 · −0.3 · 0.96 | 4 · 1 · 4.09 | -10.04 · 0 | 98 s |
| kb2-vo-9 | t1 | 3.50 (+0.71) | 2.22 | . 0.35/0.23 · , 0.18/0.08 | 12.0 · 30 · 0.25 | answers. land −2.5 fry · call. land −1.6 fry | −2.9 · +0.7 · 0.89 | 3 · 0 · 3.57 | -6.85 · 0 | 98 s |
|  | **t2 ★** | 3.51 (+0.71) | 2.22 | . 0.29/0.24 · , 0.16/0.08 | 11.2 · 30 · 0.25 | answers. land −2.7 fry · call. land −1.5 fry | −1.9 · +0.5 · 0.86 | 2 · 0 · 3.79 | -5.49 · 0 | 98 s |
|  | t3 | 3.50 (+0.70) | 2.23 | . 0.33/0.21 · , 0.19/0.12 | 11.4 · 26 · 0.28 | answers. land +0.1 fry · call. land +1.6 fry | −3.0 · +0.1 · 0.91 | 6 · 0 · 3.45 | -5.68 · 0 | 98 s |
| kb2-brand | t1 | 1.51 (+0.11) | 1.95 | — | 7.1 · 17 · 0.15 | Voice. land +2.9 | — | 3 · 0 · 3.10 | -5.72 · 0 | 98 s |
|  | t2 | 1.35 (−0.05) | 2.20 | — | 7.5 · 17 · 0.20 | Voice. land −0.3 fry | — | 2 · 0 · 3.96 | -6.94 · 0 | 98 s |
|  | **t3 ★** | 1.51 (+0.11) | 1.96 | — | 9.3 · 16 · 0.19 | Voice. land −6.1 fry | — | 3 · 0 · 3.04 | -5.02 · 0 | 98 s |

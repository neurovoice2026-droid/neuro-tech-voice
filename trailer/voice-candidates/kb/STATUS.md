# Trailer #2 (kb): Cartesia voice candidates: status

Generated 2026-10-03 with `node scripts/generate-voice.mjs --engine=cartesia --out=voice-candidates/kb/take-<k>`, reading `scripts/voice-lines-kb.json` temporarily copied over `scripts/voice-lines.json`. The copy was restored afterwards: trailer #1's `voice-lines.json`, `public/voice/` and `src/voice.generated.ts` are unchanged.

- **Engine:** Cartesia Sonic, `POST /tts/sse` with `add_timestamps`
- **Model:** `sonic-3.6-2026-08-27`
- **API version:** `Cartesia-Version: 2026-08-14`
- **Takes:** 3 complete sets (19 lines each), `take-1/`, `take-2/`, `take-3/`. Each set has `voice/*.wav`, `voice.generated.ts` and `preview.wav`.
- **Level:** every line is normalised to -23 LUFS integrated (BS.1770, mono), with the peak ceiling at -1 dBFS (soft knee in the last 2 dB).

## Voices (identical in all three takes)

| Role | Voice | Cartesia id | Source |
|---|---|---|---|
| ava | Tessa (Emotive) | `6ccbfb76-1fc6-48f7-b71d-91ac6298247b` | voice-lines-kb.json |
| desk | Leo | `0834f3df-e650-4766-a20c-5a93a43aa6e3` | voice-lines-kb.json |
| caller | Kyle (Emotive) | `c961b81c-a935-4c17-bfb3-ba2239de8c2f` | voice-lines-kb.json |
| caller2 | Dana (Emotive) | `cc00e582-ed66-4004-8336-0175b85c85f6` | voice-lines-kb.json |
| caller3 | Marian | `26403c37-80c1-4a1a-8692-540551ca2ae5` | voice-lines-kb.json |
| caller4 | Daniel | `47c38ca4-5f35-497b-b1a3-415245fb35e1` | pinned via `CARTESIA_KB2_CALLER4_VOICE` (Daniel), accepted by the API |

Ava is Tessa (Emotive), `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, as required. In the takes' `voice.generated.ts`, caller4's `name` field is empty because the id came from the env var and no name was given there. The voice is Daniel. To pin Daniel permanently, set `voices.caller4.cartesia.id` / `name` in `voice-lines-kb.json`.

## Changes from step 5 (API rejections)

**None.** The API accepted every request on the first try in all three takes, with no errors and no retries:

- The emotions `curious`, `happy`, `confident`, `enthusiastic`, `sympathetic` (kb2-desk-2) and `proud` were all accepted unchanged. The generator's header comment lists only neutral/calm/angry/content/sad. The API did not reject the others, but whether Sonic really performs them or quietly ignores them can only be judged by listening.
- The `<break time="400ms"/>` tag in kb2-vo-2 was accepted. Cartesia did not return it as a word (8 timed words = 8 words in `say`).

The temporary `voice-lines.json` copy was used unmodified, so every line's words are exactly as written in `voice-lines-kb.json`.

## Lines × takes

Column key:
- **dur**: seconds.
- **words**: entries in `voice.generated.ts` / words in `say`. All have finite timings, aligned from Cartesia's real word timestamps.
- **raw**: words Cartesia timed.
- **in→gain**: integrated loudness before levelling and the gain applied to reach -23 LUFS.
- **peak**: sample peak of the final WAV in dBFS.
- **knee**: samples caught by the soft knee.

### Take 1

| line | voice | dur (s) | words | raw | in (LUFS) → gain (dB) | peak (dBFS) | knee | notes |
|---|---|---:|---:|---:|---:|---:|---:|---|
| kb2-c1 | caller | 1.878 | 6/6 | 6 | -19.46 → -3.54 | -6.86 | 0 |  |
| kb2-desk-1 | desk | 2.227 | 5/5 | 5 | -22.35 → -0.65 | -1.52 | 26 | soft knee engaged |
| kb2-c2 | caller2 | 2.263 | 8/8 | 8 | -18.43 → -4.57 | -7.24 | 0 |  |
| kb2-c3 | caller3 | 1.615 | 5/5 | 5 | -19.34 → -3.66 | -9.44 | 0 |  |
| kb2-vo-1 | ava | 4.501 | 11/11 | 11 | -20.30 → -2.70 | -8.24 | 0 |  |
| kb2-vo-2 | ava | 3.078 | 8/8 | 8 | -20.10 → -2.90 | -5.37 | 0 |  |
| kb2-vo-3 | ava | 6.883 | 20/20 | 20 | -21.19 → -1.81 | -6.24 | 0 |  |
| kb2-vo-4 | ava | 7.821 | 19/19 | 19 | -19.79 → -3.21 | -6.86 | 0 |  |
| kb2-c4 | caller4 | 1.842 | 6/6 | 7 | -18.70 → -4.30 | -7.21 | 0 | speak adds "Hey," (7 spoken vs 6 canonical); aligned onto `say` |
| kb2-call-1 | ava | 1.754 | 5/5 | 5 | -20.01 → -2.99 | -4.26 | 0 |  |
| kb2-vo-5 | ava | 4.852 | 16/16 | 16 | -18.75 → -4.25 | -7.94 | 0 |  |
| kb2-call-2 | ava | 4.536 | 10/10 | 10 | -20.63 → -2.37 | -4.43 | 0 |  |
| kb2-vo-6 | ava | 3.579 | 13/13 | 13 | -18.90 → -4.10 | -5.86 | 0 |  |
| kb2-vo-7 | ava | 4.057 | 12/12 | 12 | -19.84 → -3.16 | -3.31 | 0 |  |
| kb2-call-3 | ava | 3.303 | 9/9 | 9 | -21.95 → -1.05 | -9.00 | 0 |  |
| kb2-desk-2 | desk | 2.663 | 7/7 | 7 | -25.99 → +2.99 | -1.15 | 51 | soft knee engaged |
| kb2-vo-8 | ava | 2.149 | 7/7 | 7 | -20.10 → -2.90 | -7.84 | 0 |  |
| kb2-vo-9 | ava | 3.505 | 8/8 | 8 | -20.19 → -2.81 | -6.85 | 0 |  |
| kb2-brand | ava | 1.515 | 3/3 | 3 | -19.95 → -3.05 | -5.72 | 0 |  |

Total speech: 64.02 s. No errors, warnings or retries.

### Take 2

| line | voice | dur (s) | words | raw | in (LUFS) → gain (dB) | peak (dBFS) | knee | notes |
|---|---|---:|---:|---:|---:|---:|---:|---|
| kb2-c1 | caller | 1.790 | 6/6 | 6 | -17.93 → -5.07 | -6.41 | 0 |  |
| kb2-desk-1 | desk | 2.400 | 5/5 | 5 | -21.22 → -1.78 | -2.34 | 13 | soft knee engaged |
| kb2-c2 | caller2 | 2.156 | 8/8 | 8 | -17.81 → -5.19 | -7.57 | 0 |  |
| kb2-c3 | caller3 | 1.637 | 5/5 | 5 | -18.87 → -4.13 | -7.96 | 0 |  |
| kb2-vo-1 | ava | 4.407 | 11/11 | 11 | -20.41 → -2.59 | -7.59 | 0 |  |
| kb2-vo-2 | ava | 3.019 | 8/8 | 8 | -19.87 → -3.13 | -5.94 | 0 |  |
| kb2-vo-3 | ava | 6.781 | 20/20 | 20 | -21.24 → -1.76 | -4.16 | 0 |  |
| kb2-vo-4 | ava | 8.281 | 19/19 | 19 | -18.41 → -4.59 | -6.24 | 0 |  |
| kb2-c4 | caller4 | 1.926 | 6/6 | 7 | -18.81 → -4.19 | -7.17 | 0 | speak adds "Hey," (7 spoken vs 6 canonical); aligned onto `say` |
| kb2-call-1 | ava | 1.575 | 5/5 | 5 | -20.53 → -2.47 | -6.93 | 0 |  |
| kb2-vo-5 | ava | 4.789 | 16/16 | 16 | -19.48 → -3.52 | -9.22 | 0 |  |
| kb2-call-2 | ava | 4.220 | 10/10 | 10 | -19.79 → -3.21 | -4.28 | 0 |  |
| kb2-vo-6 | ava | 3.562 | 13/13 | 13 | -19.52 → -3.48 | -6.25 | 0 |  |
| kb2-vo-7 | ava | 4.264 | 12/12 | 12 | -19.98 → -3.02 | -6.32 | 0 |  |
| kb2-call-3 | ava | 3.041 | 9/9 | 9 | -19.78 → -3.22 | -8.21 | 0 |  |
| kb2-desk-2 | desk | 2.598 | 7/7 | 7 | -27.90 → +4.90 | -1.11 | 80 | soft knee engaged |
| kb2-vo-8 | ava | 2.194 | 7/7 | 7 | -20.64 → -2.36 | -8.15 | 0 |  |
| kb2-vo-9 | ava | 3.514 | 8/8 | 8 | -20.11 → -2.89 | -5.49 | 0 |  |
| kb2-brand | ava | 1.349 | 3/3 | 3 | -19.81 → -3.19 | -6.94 | 0 |  |

Total speech: 63.50 s. No errors, warnings or retries.

### Take 3

| line | voice | dur (s) | words | raw | in (LUFS) → gain (dB) | peak (dBFS) | knee | notes |
|---|---|---:|---:|---:|---:|---:|---:|---|
| kb2-c1 | caller | 1.833 | 6/6 | 6 | -18.09 → -4.91 | -7.04 | 0 |  |
| kb2-desk-1 | desk | 2.424 | 5/5 | 5 | -22.13 → -0.87 | -1.79 | 23 | soft knee engaged |
| kb2-c2 | caller2 | 2.206 | 8/8 | 8 | -19.07 → -3.93 | -6.88 | 0 |  |
| kb2-c3 | caller3 | 1.662 | 5/5 | 5 | -18.05 → -4.95 | -8.08 | 0 |  |
| kb2-vo-1 | ava | 4.389 | 11/11 | 11 | -20.39 → -2.61 | -6.97 | 0 |  |
| kb2-vo-2 | ava | 2.949 | 8/8 | 8 | -18.98 → -4.02 | -7.13 | 0 |  |
| kb2-vo-3 | ava | 7.029 | 20/20 | 20 | -20.06 → -2.94 | -5.87 | 0 |  |
| kb2-vo-4 | ava | 8.314 | 19/19 | 19 | -19.33 → -3.67 | -5.97 | 0 |  |
| kb2-c4 | caller4 | 2.008 | 6/6 | 7 | -19.26 → -3.74 | -6.76 | 0 | speak adds "Hey," (7 spoken vs 6 canonical); aligned onto `say` |
| kb2-call-1 | ava | 1.620 | 5/5 | 5 | -22.74 → -0.26 | -2.85 | 1 | soft knee engaged |
| kb2-vo-5 | ava | 4.868 | 16/16 | 16 | -19.15 → -3.85 | -9.03 | 0 |  |
| kb2-call-2 | ava | 4.717 | 10/10 | 10 | -20.46 → -2.54 | -5.90 | 0 |  |
| kb2-vo-6 | ava | 3.664 | 13/13 | 13 | -19.33 → -3.67 | -5.94 | 0 |  |
| kb2-vo-7 | ava | 4.242 | 12/12 | 12 | -19.41 → -3.59 | -6.39 | 0 |  |
| kb2-call-3 | ava | 3.117 | 9/9 | 9 | -20.96 → -2.04 | -6.64 | 0 |  |
| kb2-desk-2 | desk | 2.376 | 7/7 | 7 | -25.97 → +2.97 | -1.08 | 67 | soft knee engaged |
| kb2-vo-8 | ava | 1.991 | 7/7 | 7 | -19.20 → -3.80 | -10.04 | 0 |  |
| kb2-vo-9 | ava | 3.499 | 8/8 | 8 | -20.65 → -2.35 | -5.68 | 0 |  |
| kb2-brand | ava | 1.510 | 3/3 | 3 | -20.32 → -2.68 | -5.02 | 0 |  |

Total speech: 64.42 s. No errors, warnings or retries.

## Observations

- **kb2-desk-2 (desk, `sympathetic`)** is the quietest raw take every time (−26 to −28 LUFS before levelling, so +3 to +5 dB of gain). It has the highest crest: its peaks reach the −1.1 dBFS ceiling and the soft knee catches 51–80 samples. **kb2-desk-1** (Leo) also touches the knee (13–26 samples). These are the only lines where the knee works noticeably. Listen for any audible limiting on Leo.
- **kb2-call-1** take-3 had 1 knee sample, which is negligible.
- **kb2-c4**: the `speak` text is "Hey, are you guys around this weekend?", so Cartesia times 7 words. The canonical `say` has 6 words, and the alignment maps them correctly (6/6 timed).
- No line came back silent, truncated or with missing timings.

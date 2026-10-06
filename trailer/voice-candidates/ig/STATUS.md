# Instagram reels (ig1–ig4): Cartesia voice candidates — status

Generated 2026-10-06 with `node scripts/generate-voice.mjs --film=ig1 --engine=cartesia --out=voice-candidates/ig/take-<k>` (label `voices`).
`--film=ig1` covers every line: the four reels share `scripts/voice-lines-ig.json`, `src/ig/voice.generated.ts` and `public/ig/voice/`.

- **Engine:** Cartesia Sonic, `POST /tts/sse` with `add_timestamps` (the real word timestamps come back with the audio)
- **Model:** `sonic-3.6-2026-08-27`, `Cartesia-Version: 2026-08-14` (as film 2)
- **Voice (every line):** Tessa (Emotive) `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, speed 1.05 — the one role `ava`, pinned in
  `voice-lines-ig.json` (`CARTESIA_IG_AVA_VOICE` was not set, so the pinned id was used). The API accepted every request first time.
- **Level:** every line normalised to −23 LUFS integrated (BS.1770, mono), peak ceiling −1 dBFS; no take reached the soft knee.
- **Sets:** five complete sets of the 33 lines (29 placed + 4 `*-bio` alternates), each `voice/*.wav` + `voice.generated.ts` + `preview.wav`.

| set | `speak` | why |
|---|---|---|
| take-1, take-2, take-3 | as written in `voice-lines-ig.json` at HEAD (with its `<break/>` tags) | the brief's three takes |
| take-4, take-5 | the same, with every `<break time=…/>` removed (23 breaks in 20 lines; `say` unchanged) | Sonic already pauses ≈ 0.5 s at a sentence end, and the breaks doubled it: in takes 1–3 the hooks ran 4.1–4.2 s (budget 3.1 s), the sentence gaps 0.5–0.8 s, and the reels 30–32 s. A speed probe first (1.05 / 1.15 / 1.25 on four lines, scratch only) showed speed does not shorten the pauses (−0.1 to −0.4 s, some longer), so the breaks were the lever. Lines with no break in their `speak` are simply a 4th and 5th take of the same spec. `voice-lines-ig.json` was swapped for the break-free copy only while these two sets ran and restored byte-identical (sha256 checked); the lines finally installed from take-4/5 now carry the break-free `speak` (see PICKS.md). |

**Word timings:** every take of every line aligned all of its `say` words (33 × 5, `n/n`), all finite and monotonic, with no word
onset inside a silence. Phrase-initial onsets sit within 0.08 s of the audio's onset. Cartesia gives some short function words
zero length (the word then starts with its neighbour, e.g. `to+six,`, `an+AI.`): listed per pick in PICKS.md.

## Lines × takes

Each cell: duration · integrated loudness of the raw take (LUFS) → gain applied to reach −23 LUFS (dB).

| line | words | take-1 | take-2 | take-3 | take-4 | take-5 |
|---|---:|---:|---:|---:|---:|---:|
| ig1-01 | 10 | 4.20 s · -18.77 → -4.23 | 4.15 s · -18.87 → -4.13 | 4.14 s · -19.40 → -3.60 | 3.69 s · -19.64 → -3.36 | 3.98 s · -19.73 → -3.27 |
| ig1-02 | 13 | 6.63 s · -18.92 → -4.08 | 6.69 s · -19.69 → -3.31 | 6.80 s · -19.78 → -3.22 | 5.95 s · -20.33 → -2.67 | 5.31 s · -20.05 → -2.95 |
| ig1-03 | 9 | 3.30 s · -18.74 → -4.26 | 3.47 s · -18.09 → -4.91 | 3.30 s · -17.64 → -5.36 | 3.48 s · -19.37 → -3.63 | 3.35 s · -17.71 → -5.29 |
| ig1-04 | 12 | 4.47 s · -21.11 → -1.89 | 4.50 s · -19.84 → -3.16 | 4.39 s · -19.55 → -3.45 | 4.60 s · -19.89 → -3.11 | 4.54 s · -19.71 → -3.29 |
| ig1-05 | 9 | 2.99 s · -21.28 → -1.72 | 3.21 s · -20.11 → -2.89 | 3.29 s · -20.91 → -2.09 | 3.54 s · -20.11 → -2.89 | 3.11 s · -20.62 → -2.38 |
| ig1-06 | 10 | 4.14 s · -20.02 → -2.98 | 4.10 s · -19.66 → -3.34 | 4.16 s · -20.30 → -2.70 | 3.63 s · -20.11 → -2.89 | 3.73 s · -19.35 → -3.65 |
| ig1-06-bio | 10 | 4.08 s · -18.26 → -4.74 | 3.79 s · -19.80 → -3.20 | 3.62 s · -20.72 → -2.28 | 3.20 s · -18.49 → -4.51 | 3.38 s · -18.77 → -4.23 |
| ig1-07 | 3 | 1.44 s · -20.29 → -2.71 | 1.55 s · -20.04 → -2.96 | 1.50 s · -18.68 → -4.32 | 1.35 s · -18.84 → -4.16 | 1.35 s · -19.59 → -3.41 |
| ig2-01 | 9 | 4.14 s · -21.05 → -1.95 | 3.94 s · -21.66 → -1.34 | 4.06 s · -21.60 → -1.40 | 3.94 s · -21.80 → -1.20 | 3.86 s · -20.46 → -2.54 |
| ig2-02 | 8 | 3.57 s · -20.66 → -2.34 | 3.75 s · -19.81 → -3.19 | 3.67 s · -20.04 → -2.96 | 3.49 s · -19.42 → -3.58 | 3.52 s · -19.92 → -3.08 |
| ig2-03 | 7 | 3.65 s · -20.63 → -2.37 | 3.81 s · -20.84 → -2.16 | 3.79 s · -20.34 → -2.66 | 3.44 s · -21.71 → -1.29 | 3.51 s · -21.32 → -1.68 |
| ig2-04 | 6 | 2.56 s · -18.69 → -4.31 | 2.05 s · -19.04 → -3.96 | 2.07 s · -20.04 → -2.96 | 2.00 s · -19.36 → -3.64 | 1.96 s · -21.26 → -1.74 |
| ig2-05 | 7 | 3.11 s · -18.76 → -4.24 | 3.15 s · -20.33 → -2.67 | 3.33 s · -19.73 → -3.27 | 2.72 s · -18.68 → -4.32 | 2.83 s · -20.20 → -2.80 |
| ig2-06 | 5 | 1.88 s · -18.34 → -4.66 | 1.95 s · -19.52 → -3.48 | 2.00 s · -19.38 → -3.62 | 2.05 s · -18.19 → -4.81 | 2.00 s · -18.04 → -4.96 |
| ig2-07 | 5 | 1.68 s · -18.40 → -4.60 | 1.80 s · -19.06 → -3.94 | 1.55 s · -19.53 → -3.47 | 1.63 s · -18.93 → -4.07 | 1.70 s · -19.66 → -3.34 |
| ig2-07-bio | 5 | 1.18 s · -16.94 → -6.06 | 1.30 s · -17.21 → -5.79 | 1.19 s · -17.81 → -5.19 | 1.19 s · -17.57 → -5.43 | 1.12 s · -17.50 → -5.50 |
| ig3-01 | 10 | 3.18 s · -21.75 → -1.25 | 3.52 s · -21.68 → -1.32 | 3.32 s · -21.61 → -1.39 | 2.68 s · -21.21 → -1.79 | 2.93 s · -21.36 → -1.64 |
| ig3-02 | 11 | 4.70 s · -21.04 → -1.96 | 4.64 s · -20.71 → -2.29 | 4.52 s · -20.14 → -2.86 | 4.09 s · -20.23 → -2.77 | 4.36 s · -19.95 → -3.05 |
| ig3-03 | 9 | 3.46 s · -19.81 → -3.19 | 3.35 s · -19.32 → -3.68 | 3.51 s · -19.10 → -3.90 | 3.38 s · -20.30 → -2.70 | 3.16 s · -20.48 → -2.52 |
| ig3-04 | 8 | 3.59 s · -18.97 → -4.03 | 3.67 s · -19.73 → -3.27 | 3.55 s · -18.41 → -4.59 | 3.23 s · -20.07 → -2.93 | 3.10 s · -19.40 → -3.60 |
| ig3-05 | 8 | 3.95 s · -21.13 → -1.87 | 3.76 s · -20.26 → -2.74 | 3.77 s · -18.27 → -4.73 | 3.42 s · -21.36 → -1.64 | 3.10 s · -21.64 → -1.36 |
| ig3-06 | 9 | 3.27 s · -21.12 → -1.88 | 3.21 s · -20.88 → -2.12 | 3.28 s · -20.61 → -2.39 | 2.90 s · -20.59 → -2.41 | 2.94 s · -19.99 → -3.01 |
| ig3-06-bio | 10 | 3.45 s · -19.89 → -3.11 | 3.27 s · -19.80 → -3.20 | 3.14 s · -20.04 → -2.96 | 2.84 s · -17.79 → -5.21 | 2.81 s · -19.02 → -3.98 |
| ig4-01 | 7 | 2.48 s · -18.68 → -4.32 | 2.37 s · -19.12 → -3.88 | 2.27 s · -17.91 → -5.09 | 2.22 s · -18.29 → -4.71 | 2.29 s · -18.85 → -4.15 |
| ig4-02 | 5 | 1.26 s · -18.65 → -4.35 | 1.22 s · -19.26 → -3.74 | 1.22 s · -19.85 → -3.15 | 1.27 s · -18.43 → -4.57 | 1.31 s · -19.82 → -3.18 |
| ig4-03 | 7 | 1.94 s · -18.78 → -4.22 | 2.02 s · -18.23 → -4.77 | 2.08 s · -17.30 → -5.70 | 1.98 s · -18.69 → -4.31 | 2.13 s · -19.62 → -3.38 |
| ig4-04 | 5 | 1.86 s · -17.75 → -5.25 | 1.83 s · -18.43 → -4.57 | 1.90 s · -17.60 → -5.40 | 1.79 s · -18.72 → -4.28 | 1.77 s · -17.66 → -5.34 |
| ig4-05 | 8 | 3.44 s · -21.09 → -1.91 | 3.46 s · -19.79 → -3.21 | 3.47 s · -20.73 → -2.27 | 3.19 s · -19.54 → -3.46 | 3.28 s · -19.50 → -3.50 |
| ig4-06 | 6 | 2.31 s · -19.89 → -3.11 | 2.28 s · -19.42 → -3.58 | 2.37 s · -19.64 → -3.36 | 2.28 s · -19.34 → -3.66 | 2.25 s · -17.14 → -5.86 |
| ig4-07 | 9 | 2.70 s · -19.36 → -3.64 | 2.79 s · -19.83 → -3.17 | 2.78 s · -18.67 → -4.33 | 2.31 s · -19.54 → -3.46 | 2.39 s · -18.78 → -4.22 |
| ig4-08 | 7 | 2.51 s · -18.65 → -4.35 | 2.67 s · -18.89 → -4.11 | 2.49 s · -19.07 → -3.93 | 2.50 s · -19.00 → -4.00 | 2.48 s · -18.19 → -4.81 |
| ig4-09 | 11 | 3.70 s · -19.79 → -3.21 | 3.74 s · -19.16 → -3.84 | 3.65 s · -18.84 → -4.16 | 3.31 s · -19.42 → -3.58 | 3.39 s · -18.91 → -4.09 |
| ig4-09-bio | 12 | 3.86 s · -18.48 → -4.52 | 3.59 s · -19.15 → -3.85 | 3.64 s · -20.24 → -2.76 | 3.36 s · -19.40 → -3.60 | 3.15 s · -19.51 → -3.49 |

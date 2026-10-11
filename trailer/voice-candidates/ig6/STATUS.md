# ig6 "One ring": Cartesia voice candidates (status)

Generated on 2026-10-11 between 21:16:53 and 21:17:20 UTC at HEAD `57d781c` (`claude/remotion-trailer`), the infrastructure step's working tree (`docs/ig/ig6/INFRA-LOG.md`). The runs follow `docs/ig/ig6/PIPELINE.md` §4.2 step 2. Every command was run from `trailer/`:

```
node scripts/generate-voice.mjs --film=ig6 --engine=cartesia --out=voice-candidates/ig6/take-a   (then take-b, take-c, take-d)
```

The four runs wrote only `voice-candidates/ig6/take-*/`. The picks and their install are in `PICKS.md`; this file describes the candidate runs only.

## Settings (all four sets)

| | |
|---|---|
| Engine | Cartesia Sonic, `POST /tts/sse` with `add_timestamps`. Model `sonic-3.6-2026-08-27`, `Cartesia-Version: 2026-08-14`: the same model and API version as ig1–ig5 (`voice-candidates/ig5/STATUS.md`). `CARTESIA_TTS_MODEL` is unset, so the script's default applied. Every request was accepted on the first try. |
| Voice | Tessa (Emotive), `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, speed **1.05**: the one role `ava`, from the `voices` block of `scripts/ig6/voice-lines-ig6.json` (JSON-equal to `scripts/voice-lines-ig.json`'s). Each set's `voice.generated.ts` records this voice and model. |
| Level | Every line normalised to −23 LUFS integrated (BS.1770, mono), peak ceiling −1 dBFS, no role EQ. |
| `speak` | From `scripts/ig6/voice-lines-ig6.json` as committed (sha256 `4c06fad1…`, unchanged before and after). There is **no `<break/>`** in any line. `ig6-07` says "agent" in lowercase, so Sonic does not spell it out. `ig6-01r` has the same `speak` as `ig6-01`, so its takes are more readings of the hook. |
| Emotion | `calm`: 01, 01r, 01b, 02a, 02b, 03 · `content`: 04, 05, 06 · `confident`: 07, 07b |

**One spec for all four sets.** `generate-voice.mjs` takes `emotion`, `speed` and `speak` from the lines file only, so the sets differ only by Sonic's take-to-take variation.

**Each set holds:**
- `voice/`: 13 WAVs, the 12 synthesised lines plus `ig1-07.wav`;
- `voice.generated.ts`: each line's `say`, its phrase and word timings, a 30 fps envelope and `post`;
- `preview.wav`: all lines in order.

**The borrow `ig1-07` was never synthesised.** Each set holds a byte copy of `public/ig/voice/ig1-07.wav` (sha256 `c73b8a86…`, 1.355 s).

**Word timings:** every take of every line aligned all of its `say` words (12 × 4, n/n).

## Lines × takes

Each cell shows duration · raw integrated loudness (LUFS) → gain applied to reach −23 LUFS (dB).

| line | words | take-a | take-b | take-c | take-d |
|---|---:|---|---|---|---|
| ig6-01 | 8 | 3.92 s · −21.33 → −1.67 | 3.79 s · −20.13 → −2.87 | 3.86 s · −19.94 → −3.06 | 3.65 s · −20.01 → −2.99 |
| ig6-02a | 3 | 1.12 s · −19.24 → −3.76 | 1.36 s · −19.21 → −3.79 | 1.19 s · −18.69 → −4.31 | 1.18 s · −18.48 → −4.52 |
| ig6-02b | 3 | 1.45 s · −20.53 → −2.47 | 1.54 s · −14.81 → −8.19 | 1.59 s · −18.99 → −4.01 | 1.50 s · −17.66 → −5.34 |
| ig6-03 | 7 | 2.74 s · −18.50 → −4.50 | 2.61 s · −18.53 → −4.47 | 2.82 s · −19.22 → −3.78 | 2.75 s · −17.81 → −5.19 |
| ig6-04 | 8 | 3.04 s · −19.84 → −3.16 | 2.88 s · −20.17 → −2.83 | 2.94 s · −19.28 → −3.72 | 3.36 s · −19.38 → −3.62 |
| ig6-05 | 5 | 1.72 s · −19.11 → −3.89 | 2.13 s · −18.99 → −4.01 | 2.00 s · −19.53 → −3.47 | 1.66 s · −20.28 → −2.72 |
| ig6-06 | 3 | 1.00 s · −17.21 → −5.79 | 1.05 s · −15.78 → −7.22 | 1.07 s · −18.03 → −4.97 | 1.04 s · −19.30 → −3.70 |
| ig6-07 | 5 | 1.68 s · −18.49 → −4.51 | 1.74 s · −19.90 → −3.10 | 1.67 s · −19.57 → −3.43 | 1.62 s · −19.44 → −3.56 |
| ig1-07 | 3 | borrow · byte copy | borrow · byte copy | borrow · byte copy | borrow · byte copy |
| ig6-01r | 8 | 3.78 s · −20.90 → −2.10 | 3.56 s · −21.48 → −1.52 | 3.90 s · −19.57 → −3.43 | 3.73 s · −20.98 → −2.02 |
| ig6-01b | 7 | 3.14 s · −20.52 → −2.48 | 3.29 s · −20.12 → −2.88 | 3.19 s · −19.91 → −3.09 | 3.33 s · −19.91 → −3.09 |
| ig6-07b | 5 | 1.20 s · −18.76 → −4.24 | 1.17 s · −17.07 → −5.93 | 1.18 s · −17.44 → −5.56 | 1.20 s · −19.30 → −3.70 |

**Speech in the eight placed lines (42 words, cast A):**

| Set | Speech | Pace |
|---|---:|---:|
| take-a | 16.67 s | 2.52 words/s |
| take-b | 17.10 s | 2.46 words/s |
| take-c | 17.14 s | 2.45 words/s |
| take-d | 16.76 s | 2.51 words/s |

These are speech-only rates over the files. SCRIPT §5.3 planned at 2.78 words/s and checked the fit at 2.50 and 2.45; the takes sit in the 2.45–2.52 band, which SCRIPT's simulation already fitted with 20–21 f of CTA spare.

**Durations against PIPELINE §4.2 step 3 and the SCRIPT windows:**
- **The hook `ig6-01` is over its 3.4 s target in every take: 3.65–3.92 s.** The tighter reading `ig6-01r` gives 3.56–3.90 s, so the eight readings of these words span 3.56–3.92 s. Tessa takes about 1.9 s over "One ring, six seconds." and pauses 0.14–0.44 s before "Your". The binding rule still holds in every take: the hook ladder's rung 0 lets `ig6-02a` stop by f174 (below).
- `ig6-02a` is 1.12–1.36 s, inside ≤ 1.3 s in three takes (b is 1.36 s with a 0.28 s head).
- `ig6-02b` is 1.45–1.59 s. Placed at f190 it must stop by f234 (shot E). Take-c is the only one that misses (voiced to f235).
- `ig6-07` is 1.62–1.74 s, well inside ≤ 2.2 s.
- `ig6-01b` is 3.14–3.33 s, inside 3.4 s.

## What each set does to the reel

These results come from the real `src/ig/ig6/timing.ts` as committed at the infrastructure step (rule set before the re-anchor in `PICKS.md`). It was imported read-only from a scratch folder with each set as its voice data; cast B uses a copy with `CAST = 'B'`. The tools are in `out/ig/qa/ig6/voices/` (`analyse.mjs`, `analyse-sim.mjs`, `search.mjs`).

| set | cast A: hook rung · 02a stops | whip · pickup | CTA stops (spare) | faults | cast B: 02a stops | faults |
|---|---|---|---|---|---|---|
| take-a | 0 (`ig6-01`, 1b hold 15) · f166 | f330 · **f360** | f723 (42 f) | 0 | f151 | 0 |
| take-b | 0 · f170 | f330 · **f360** | f730 (35 f) | 0 | f159 | 0 |
| take-c | 0 · f169 | f338 · f375 | f726 (39 f) | **1**: `ig6-02b` stops f235 | f154 | 1 |
| take-d | 0 · f163 | f332 · f375 | f721 (44 f) | 0 | f152 | 0 |

**Over every mix of the four sets** (4⁸ = 65,536 one-take-per-role casts per cut, through a replica of `layout()` that matched the real `timing.ts` on 90 of 90 test casts):
- 49,152 casts per cut have no fault. Every faulty cast is one that uses take-c's `ig6-02b`.
- 24,576 of them keep the whip on f330 and the pickup on the f360 bar line (SCRIPT b4). The pickup slips to f375 when `ig6-02b` pushes `ig6-03` to f244 or later.
- Every cast places hook rung 0 and the full script (trim 0) at 28.0 s with the impact on f780. The CTA always starts on its plan frame f680 and stops with 35–44 f to spare.

## Key words (seconds into the take, Cartesia's word timestamps)

| take | 01 "six" | 01 "receptionist" | 01 "answer." | 01b "can't" | 02a "rings," | 02b "still" | 03 "customer." | 04 "receptionist" | 04 "day" | 05 "from" | 06 "yourself." | 07 "AGENT" |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| a | 1.00 | 2.53 | 3.41 | 2.39 | 0.43 | 0.55 | 2.04 | 0.68 | 2.28 | 0.75 | 0.34 | 0.48 |
| b | 0.88 | 2.32 | 3.36 | 2.53 | 0.68 | 0.54 | 1.96 | 0.57 | 2.09 | 0.92 | 0.42 | 0.52 |
| c | 1.07 | 2.43 | 3.39 | 2.51 | 0.44 | 0.67 | 2.13 | 0.63 | 2.21 | 0.76 | 0.46 | 0.47 |
| d | 0.83 | 2.27 | 3.15 | 2.67 | 0.42 | 0.58 | 2.12 | 0.68 | 2.36 | 0.66 | 0.37 | 0.44 |

**The hook:** placed at f10, "six" is heard at 1.2–1.4 s (SCRIPT: by about 1.3 s) and "receptionist" at 2.6–2.9 s. SCRIPT's 1.9 s was a 2.78 words/s estimate.

**Shared onsets.** Cartesia gives some short words zero length, so a word starts with its neighbour:

| take | lines |
|---|---|
| a | `ig6-04` or+night. · `ig6-06` it+yourself. |
| b | `ig6-07` the+link. · `ig6-07b` our+bio. |
| c | `ig6-02a` it+rings, |
| d | `ig6-07` the+link. · `ig6-07b` our+bio. |

**Sentence pauses** are 0.14–0.44 s, with no doubling (there are no `<break/>` tags).

## Checks

- **Write set:** `find -newer <marker>` over `trailer/` (skipping `node_modules`, `.git`, `out`) found only `voice-candidates/ig6/take-{a,b,c,d}/**`. The script removed its own request folders in the OS temp directory (none left).
- **Unchanged during the runs (sha256 before = after):** `scripts/ig6/voice-lines-ig6.json` `4c06fad1…`, `src/ig/ig6/voice.generated.ts` `1885da4c…` (still the Kokoro placeholders then), the 11 `public/ig/voice/ig6-*.wav` placeholders, and `public/ig/voice/ig1-07.wav` `c73b8a86…`.
- **`guard.mjs --check --fast`** before the runs: PASS (1747/1747 files, 19 delivered prefixes, 5 stamps, git allowed).
- `CARTESIA_API_KEY` was never printed. A by-value scan of the 115 files written in this step (candidate sets, ig6 sources, the QA folder, the ig6 sound files, `scripts/ig6/`) finds it in none (only the count was printed). `voice:ig`, `voice:ig5` and `--film=ig1…ig5` were never run.

Logs: `out/ig/qa/ig6/voices/gates/gen-{a,b,c,d}.log`.

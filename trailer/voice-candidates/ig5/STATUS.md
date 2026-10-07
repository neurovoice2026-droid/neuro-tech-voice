# ig5 "Don't pay $300": Cartesia voice candidates (status)

Generated on 2026-10-07 between 13:23 and 13:25 UTC at HEAD `59fe4c3` (`claude/remotion-trailer`). The runs used PIPELINE.md §4.3 step 2, and every command was run from `trailer/`:

```
node scripts/generate-voice.mjs --film=ig5 --engine=cartesia --out=voice-candidates/ig5/take-a   (then take-b, take-c, take-d)
```

Nothing was installed and nothing was committed. `public/ig/voice/`, `src/ig/ig5/voice.generated.ts` and `scripts/ig5/voice-lines-ig5.json` are byte-identical to how they were before the runs (sha256 checked). Picks go in `PICKS.md` (written and installed later the same day; this file describes the candidate runs only).

**PROVISIONAL: the hook and its hand-off.** These four lines may still change:
- `ig5-01` and `ig5-01b` (the hook);
- `ig5-02` and `ig5-02t` (its hand-off).

The TikTok hook tournament will write `docs/ig/ig5/HOOKS.md`, which did not exist when these sets were made. If the words change, these four lines need new takes. Every line from `ig5-03` on is final copy.

## Settings (all four sets)

**Engine:** Cartesia Sonic, `POST /tts/sse` with `add_timestamps`.
- Model `sonic-3.6-2026-08-27`, `Cartesia-Version: 2026-08-14`. This is the same model and API version as ig1–ig4.
- The API accepted every request on the first try.

**Voice:** Tessa (Emotive), `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`, at speed **1.05**.
- This is the one role, `ava`, with the same `voices` block as `scripts/voice-lines-ig.json`.
- Each set's `voice.generated.ts` records this voice id and model.

**Level:** every line was normalised to −23 LUFS integrated (BS.1770, mono), with a peak ceiling of −1 dBFS. No role EQ was applied.

**`speak`:** taken from `scripts/ig5/voice-lines-ig5.json` as committed.
- There is no `<break/>` in any line (the ig1–ig4 lesson).
- `ig5-07` says "agent" in lowercase, so Sonic does not spell it out.

**Emotion per line, from the file:**

| Emotion | Lines |
|---|---|
| `confident` | 01, 01b, 06, 06-msg, 07, 07-bio |
| `calm` | 02, 02t, 03 |
| `content` | 04, 05, 05t, 05-num |

**The four sets use one spec. Only Sonic's take-to-take variation differs between them.**
- `generate-voice.mjs` reads a line's `emotion`, `speed`, `speak`, `parts` and `gap` only from the lines file.
- Its only per-run override is a role's voice id (`--ava=…`).
- So, as the brief says, the file was kept unchanged (sha256 `9362ba41…` before and after). No calmer-hook set and no more-confident-CTA set was made.
- To vary the emotion of the hook or the CTA, there are two routes, both outside this brief:
  - swap the lines file for one run and restore it byte-identical, as ig1–ig4 did for its take-4 and take-5;
  - add a CLI option to `generate-voice`.

**Contents of each set:**
- `voice/` holds 14 WAVs: the 13 synthesised lines and `ig1-07.wav`.
- `voice.generated.ts` holds every line's `say`, its phrase and word timings, a 30 fps envelope, and `post`.
- `preview.wav` holds all of the lines in order.

**The borrow `ig1-07` was never synthesised.** Each set holds a byte copy of `public/ig/voice/ig1-07.wav`: sha256 `c73b8a86…dd601035b`, 1.355 s, identical in all four sets.

**Word timings:** every take of every line aligned all of its `say` words (13 × 4, `n/n`).

## Lines × takes

Each cell shows: duration · raw integrated loudness (LUFS) → gain applied to reach −23 LUFS (dB).

The budget column is the beat window in SCRIPT.md §5.1 (the time from the line's planned start to the next act). `timing.ts` lets a long take borrow from the gaps, so only the reel's total decides the trim rung (see the next section).

| line | tokens | budget | take-a | take-b | take-c | take-d |
|---|---:|---:|---:|---:|---:|---:|
| ig5-01 *(prov.)* | 10 | 3.87 s (line: ≤ 3.6 s) | 3.46 s · −20.30 → −2.70 | 3.27 s · −19.97 → −3.03 | 3.30 s · −20.16 → −2.84 | 3.37 s · −20.82 → −2.18 |
| ig5-02 *(prov.)* | 9 | 3.57 s | 4.47 s · −20.83 → −2.17 | 4.05 s · −22.12 → −0.88 | 4.23 s · −20.46 → −2.54 | 4.22 s · −21.51 → −1.49 |
| ig5-03 | 10 | 3.90 s | 4.40 s · −18.92 → −4.08 | 4.26 s · −18.99 → −4.01 | 4.15 s · −18.72 → −4.28 | 4.11 s · −18.76 → −4.24 |
| ig5-04 | 9 | 3.67 s | 3.59 s · −19.12 → −3.88 | 3.52 s · −19.37 → −3.63 | 3.44 s · −17.99 → −5.01 | 3.39 s · −18.92 → −4.08 |
| ig5-05 | 9 | 3.53 s | 3.07 s · −19.74 → −3.26 | 3.04 s · −19.66 → −3.34 | 2.90 s · −19.47 → −3.53 | 2.96 s · −19.82 → −3.18 |
| ig5-06 | 10 | 3.87 s | 3.04 s · −20.20 → −2.80 | 3.23 s · −20.32 → −2.68 | 3.20 s · −21.32 → −1.68 | 3.16 s · −21.49 → −1.51 |
| ig5-07 | 5 | 2.37 s (end ≤ f765) | 1.62 s · −19.33 → −3.67 | 1.71 s · −18.24 → −4.76 | 1.72 s · −18.05 → −4.95 | 1.69 s · −18.47 → −4.53 |
| ig1-07 | 3 | borrow | 1.355 s · byte copy | 1.355 s · byte copy | 1.355 s · byte copy | 1.355 s · byte copy |
| ig5-02t *(prov.)* | 8 | T1 | 4.00 s · −20.17 → −2.83 | 4.24 s · −20.43 → −2.57 | 3.82 s · −19.99 → −3.01 | 4.23 s · −19.96 → −3.04 |
| ig5-05t | 5 | T2 | 1.38 s · −18.68 → −4.32 | 1.45 s · −18.66 → −4.34 | 1.40 s · −18.06 → −4.94 | 1.42 s · −18.30 → −4.70 |
| ig5-06-msg | 10 | = ig5-06 | 2.92 s · −19.42 → −3.58 | 2.86 s · −20.17 → −2.83 | 2.86 s · −19.59 → −3.41 | 2.97 s · −20.17 → −2.83 |
| ig5-01b *(prov.)* | 11 | = ig5-01 | 3.76 s · −19.40 → −3.60 | 3.52 s · −20.09 → −2.91 | 3.51 s · −19.46 → −3.54 | 3.68 s · −20.21 → −2.79 |
| ig5-07-bio | 5 | = ig5-07 | 1.19 s · −18.41 → −4.59 | 1.17 s · −18.20 → −4.80 | 1.22 s · −18.39 → −4.61 | 1.27 s · −17.69 → −5.31 |
| ig5-05-num | 8 | = ig5-05 | 2.92 s · −21.48 → −1.52 | 3.13 s · −20.77 → −2.23 | 2.82 s · −21.19 → −1.81 | 2.94 s · −19.76 → −3.24 |

**Speech in the seven placed lines (62 tokens):**

| Set | Speech | Pace |
|---|---:|---:|
| take-a | 23.65 s | 2.62 tok/s |
| take-b | 23.07 s | 2.69 tok/s |
| take-c | 22.95 s | 2.70 tok/s |
| take-d | 22.89 s | 2.71 tok/s |

These are speech-only rates. SCRIPT §5.1 needs ≈ 2.62 tok/s over the line windows, gaps included, and §5 gives Tessa's series mean as 2.78 tok/s.

**Durations:**
- **Over their beat window in every take:** `ig5-02` (+0.5 to +0.9 s) and `ig5-03` (+0.2 to +0.5 s). Every other placed line fits its window.
- **The hook:** 3.27–3.46 s. This is inside the line's own target of ≤ 3.6 s and the b1 window of 3.87 s. It is over PIPELINE §4.3's ≤ 3.1 s, which the ig1–ig4 hooks did not meet either: their installed hooks run 3.17–3.98 s.
- **The trims are not always shorter.** In take-b, T1 `ig5-02t` (4.24 s) is 0.19 s *longer* than its `ig5-02` (4.05 s). In take-d the two are equal (4.23 / 4.22 s).
- **The alternates:**
  - `ig5-06-msg` is within 0.1–0.4 s of `ig5-06`.
  - `ig5-07-bio` is 0.4–0.6 s shorter than `ig5-07`.
  - `ig5-01b` is 0.2–0.3 s longer than `ig5-01`.

## What each set does to the reel

These results come from `src/ig/ig5/timing.ts`'s `layout()` (PLAN, `place`, `afterRing`, `upBar`) with every placed line taken from one set. The layout code was re-run read-only from a scratch folder. For take-a, the result matched the real `timing.ts` exactly when it was imported with its voice data redirected to that set.

`timing.ts` places the first rung whose CTA ends by **f765**, so the impact lands on **f780** (28.0 s).

| set | rung 0 (full) CTA end | rung 1 (T1) | rung 2 (T1 + T2) | rung placed | "Ours?" starts (plan f352) | "forty-nine" heard |
|---|---:|---:|---:|---|---:|---:|
| take-a | f780 ✗ (impact f840) | f765 ✓ (0 f spare) | f743 ✓ | **1 (T1)** | f398 | 14.4 s (51.4 %) |
| take-b | f768 ✗ | f772 ✗ (T1 is longer) | f746 ✓ | **2 (T1 + T2)** | f401 | 14.7 s (52.5 %) |
| take-c | f761 ✓ (4 f spare) | f750 ✓ | f746 ✓ | **0 (full)** | f398 | 14.4 s (51.5 %) |
| take-d | f756 ✓ (9 f spare) | f756 ✓ | f745 ✓ | **0 (full)** | f398 | 14.4 s (51.4 %) |

**The best case over every mix of the four sets** (each role taken from any set, 4⁷ casts):
- the full script's CTA can end at **f743**, 22 f spare, and starts on its plan frame f694;
- "Ours?" can start at f394.

This is a bound, not a pick. "Ours?" lands 34–49 f after its plan in every case, because `ig5-02` and `ig5-03` run over their windows. So "forty-nine" is heard at about 51–52 % with one-set casts, not SCRIPT §5's 46–47 %.

## Key words (seconds into the take, from Cartesia's word timestamps)

The pauses are silent runs in the 30 fps envelope (below `CUT.quiet` 0.05, ≥ 3 f), so they are only accurate to about 0.03 s.

| take | ig5-01 "three" | ig5-01 "receptionist." | ig5-01b "three" | ig5-02 pause after "retainer." | ig5-04 pause after "Ours?" | ig5-04 "forty-nine" · to "dollars" | ig5-03 "ninety-nine" span | ig5-07 "AGENT" · span |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| a | 0.78 | 2.46 | 1.05 | 0.40 | 0.20 | 1.13 · 0.56 | 0.72 | 0.56 · 0.40 |
| b | 0.57 | 2.33 | 0.92 | 0.37 | 0.27 | 1.33 · 0.40 | 0.72 | 0.48 · 0.56 |
| c | 0.70 | 2.38 | 0.94 | 0.37 | 0.20 | 1.15 · 0.40 | 0.64 | 0.49 · 0.56 |
| d | 0.66 | 2.42 | 1.04 | 0.30 | 0.17 | 1.13 · 0.48 | 0.56 | 0.59 · 0.48 |

**The hook:** "three hundred" starts 0.57–0.78 s into the take. With the hook placed at f9–f10, it is heard at about 0.9–1.1 s, inside the ≈ 1.2 s target.

**Sentence pauses** are 0.27–0.40 s, with no doubling (there are no `<break/>` tags). Sonic leaves 0.17–0.27 s after "Ours?", not the ≈ 0.5 s that SCRIPT b4 assumed. The stop-time before "Ours?" carries the beat.

**Comma pauses:**
- `ig5-05` "yourself,": 0.20–0.30 s in takes b–d; none above 0.1 s in take-a.
- `ig5-06` "can't,": 0.13–0.17 s.

**Shared onsets.** Cartesia gives some short words zero length, so the word starts with its neighbour. None falls on a display-map or key word: "three"/"hundred", "ninety-nine", "fifty", "forty-nine"/"dollars" and "AGENT" all have onsets of their own in every take.

| line | take-a | take-b | take-c | take-d |
|---|---|---|---|---|
| ig5-01 | a+month | – | a+month | – |
| ig5-02 | a+common | – | – | – |
| ig5-03 | – | a+month, | a+month, | a+month, |
| ig5-04 | a+month. | a+month. | – | a+month. |
| ig5-05 | it+up | up+yourself, | up+yourself, | it+up |
| ig5-06 | you+can't, · the+appointment. | – | – | – |
| ig5-07 | – | the+link. | – | – |
| ig5-02t | – | – | – | – |
| ig5-05t | up+yourself. | it+up | up+yourself. | up+yourself. |
| ig5-06-msg | you+can't, · a+message. | you+can't, · a+message. | when+you | a+message. |
| ig5-01b | a+month | you+pay · a+month | you+pay | – |
| ig5-07-bio | our+bio. | in+our | our+bio. | – |
| ig5-05-num | the+number: · a+month. | a+dollar · a+month. | the+number: · a+month. | a+dollar |

## Checks

**Write set.** `find -newer <marker>` over `trailer/` (skipping `node_modules` and `.git`) found only:
- `voice-candidates/ig5/**`;
- the guard's own `out/ig5-guard/check/report-fast.txt`.

`git status --porcelain` shows only `?? trailer/voice-candidates/ig5/`. The script's temporary request folders in the OS temp directory were removed by the script itself.

**Unchanged (sha256 before = after):**

| File | sha256 |
|---|---|
| `scripts/ig5/voice-lines-ig5.json` | `9362ba41…` |
| `public/ig/voice/ig1-07.wav` | `c73b8a86…` |
| `src/ig/ig5/voice.generated.ts` | `ff9cda16…` (still the Kokoro placeholders) |

**`npm run guard:ig5 -- --check --fast`** was run before and after the four runs. Both times it passed gates 1–3:
- 255/257 files are byte-identical. The other 2 are the allowed QA-only edits 9–10.
- The listings are unchanged (`public/ig/voice` +13 ig5 files, as after the infrastructure step).
- The ig1–ig4 stamps are current: `49b90ae44064d049`, `757d177d35b27cd6`, `47ae5cf315d3434b`, `f4500c7a37b6d47e`.

`CARTESIA_API_KEY` was never printed. `voice:ig` and `--film=ig1…ig4` were never run.

## Next (PIPELINE §4.3 steps 3–5)

1. **Pick by measurement** with the ig / kb method. Measure question rises, phrase landings, key-phrase stress ("AGENT", "often", "from", "yourself"), word intelligibility (SII) on "forty-nine dollars", fry and clicks.
2. **Choose the cast with `timing.ts`.** A mixed cast can keep the full script (rung 0) with up to 22 f to spare.
3. **Write `PICKS.md`.** Mark the `ig5-01`, `ig5-01b`, `ig5-02` and `ig5-02t` picks PROVISIONAL until `HOOKS.md` lands.
4. **Install** with one `--install=voice-candidates/ig5/take-x --only=…` call per set, then run `guard --check` after every install.

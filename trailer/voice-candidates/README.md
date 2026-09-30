# Voice-over candidates (Cartesia Sonic)

Generated with `node scripts/generate-voice.mjs --engine=cartesia --out=voice-candidates/<name> ...`
(POST `/tts/sse`, `add_timestamps`, Sonic SSML emotions and fillers, per-line emotions from
`scripts/voice-lines.json`). Each folder has `voice/*.wav`, `voice.generated.ts` and `preview.wav`.

The live set in `public/voice/*.wav` and `src/voice.generated.ts` is the **Tessa** set, copied
byte-for-byte from `voice-candidates/tessa/` (no separate run), so the live takes are exactly the
tessa column below.

## Voices (checked with `GET /voices/{id}`, Cartesia-Version 2026-08-14)

| Voice | ID | Gender | Lang | Description |
|---|---|---|---|---|
| Tessa | `6ccbfb76-1fc6-48f7-b71d-91ac6298247b` | feminine | en | Friendly female voice with a warm, conversational tone that feels like chatting with a close friend |
| Maya | `cbaf8084-f009-4838-a096-07ee2e6612b1` | feminine | en | Friendly, casual female voice with clear articulation, ideal for natural conversations and customer support |
| Dana | `cc00e582-ed66-4004-8336-0175b85c85f6` | feminine | en | Neutral female voice with clear articulation and calm tone, ideal for versatile conversational or professional use |
| Marian | `26403c37-80c1-4a1a-8692-540551ca2ae5` | feminine | en | Matured female voice with calm authority and smooth pacing, perfect for narrations and storytelling |
| Kyle | `c961b81c-a935-4c17-bfb3-ba2239de8c2f` | masculine | en | Friendly male voice with a warm, conversational tone that builds instant connection and trust |
| Leo | `0834f3df-e650-4766-a20c-5a93a43aa6e3` | masculine | en | Friendly and approachable male voice that brings warmth and ease to any interaction |

All four Ava candidates are feminine English voices, so none were dropped. Kyle is masculine, so he
is the caller in every set (Leo not used).

## Candidates

| Candidate | Ava | Caller | Caller 2 |
|---|---|---|---|
| tessa | Tessa `6ccbfb76…` | Kyle `c961b81c…` | Dana `cc00e582…` |
| maya | Maya `cbaf8084…` | Kyle `c961b81c…` | Dana `cc00e582…` |
| dana | Dana `cc00e582…` | Kyle `c961b81c…` | Maya `cbaf8084…` |
| marian | Marian `26403c37…` | Kyle `c961b81c…` | Dana `cc00e582…` |
| live (`public/voice`) | = tessa | | |

## Text and speed changes (this take)

- `call-1` no longer opens with "Hi,": Ava now starts on "Thank you for calling Northside Studio!"
  (19 → 18 timed words).
- `kb-1` no longer opens with "Hi!": the second caller now starts on "Quick question, do you do home
  visits?" (8 → 7 timed words).
- Ava speaks at Cartesia speed **1.05** (`voices.ava.cartesia.speed`, sent as
  `generation_config.speed`); the callers stay at the default speed.

Emotions, SSML and fillers are otherwise unchanged. The two trimmed openers explain most of the
shorter `call-1` (−10…−15 %) and `kb-1` (−16…−25 %) times; every other line is within ±10 % of the
previous take.

## Line durations (seconds) and timed words

| Line | Voice | tessa (live) | maya | dana | marian |
|---|---|---|---|---|---|
| call-1 | ava | 5.27 (18) | 5.03 (18) | 5.36 (18) | 5.68 (18) |
| call-2 | caller | 3.28 (10) | 3.42 (10) | 3.39 (10) | 3.28 (10) |
| call-3 | ava | 4.64 (13) | 4.26 (13) | 4.54 (13) | 4.70 (13) |
| call-4 | caller | 2.40 (7) | 2.37 (7) | 2.43 (7) | 2.33 (7) |
| call-5 | ava | 3.92 (12) | 3.47 (12) | 3.59 (12) | 3.98 (12) |
| kb-1 | caller2 | 2.51 (7) | 2.42 (7) | 2.49 (7) | 2.52 (7) |
| kb-2 | ava | 6.13 (23) | 6.30 (23) | 6.07 (23) | 6.92 (23) |
| cta-1 | ava | 3.98 (10) | 3.52 (10) | 3.86 (10) | 3.84 (10) |
| cta-2 | ava | 1.37 (3) | 1.35 (3) | 1.27 (3) | 1.46 (3) |

Checks: every WAV is non-empty, and its length matches `duration` in its `voice.generated.ts`. Word
`t` values never decrease. Sonic's timestamps are coarse, so a few neighbouring words share a start
time, as in the previous takes.

## Film length (`src/timing.ts` `DURATION` / 30 fps)

Measured by pointing `src/voice.generated.ts` at each candidate in turn:

| Candidate | Film length (s) |
|---|---|
| tessa (live) | 61.27 |
| maya | 60.27 |
| dana | 61.27 |
| marian | 62.50 |

## Fixes

None. Cartesia accepted every request as-is (model, emotions and SSE parsing all worked), so
`scripts/generate-voice.mjs` and `scripts/voice-lines.json` are unchanged.

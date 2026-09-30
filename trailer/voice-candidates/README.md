# Voice-over candidates (Cartesia Sonic)

Generated with `node scripts/generate-voice.mjs --engine=cartesia --out=voice-candidates/<name> ...`
(POST `/tts/sse`, `add_timestamps`, Sonic SSML emotions and fillers, per-line emotions from
`scripts/voice-lines.json`). Each folder has `voice/*.wav`, `voice.generated.ts` and `preview.wav`.

The live set in `public/voice/*.wav` and `src/voice.generated.ts` is the **Tessa** set, made by a
separate default run (`node scripts/generate-voice.mjs --engine=cartesia`, Tessa / Kyle / Dana).
Sonic isn't deterministic, so the live takes are close to `voice-candidates/tessa/` but not identical;
their timings are listed below as "live".

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
| maya | Maya `cbaf8084…` | Kyle `c961b81c…` | Tessa `6ccbfb76…` |
| dana | Dana `cc00e582…` | Kyle `c961b81c…` | Maya `cbaf8084…` |
| marian | Marian `26403c37…` | Kyle `c961b81c…` | Dana `cc00e582…` |
| live (`public/voice`) | Tessa | Kyle | Dana |

## Line durations (seconds) and timed words

| Line | Voice | tessa | maya | dana | marian | live |
|---|---|---|---|---|---|---|
| call-1 | ava | 6.16 (19) | 5.94 (19) | 5.96 (19) | 6.47 (19) | 5.86 (19) |
| call-2 | caller | 3.45 (10) | 3.22 (10) | 3.52 (10) | 3.47 (10) | 3.29 (10) |
| call-3 | ava | 4.24 (13) | 4.12 (13) | 4.26 (13) | 4.90 (13) | 4.30 (13) |
| call-4 | caller | 2.52 (7) | 2.61 (7) | 2.38 (7) | 2.53 (7) | 2.39 (7) |
| call-5 | ava | 3.78 (12) | 3.65 (12) | 3.39 (12) | 4.06 (12) | 4.14 (12) |
| kb-1 | caller2 | 3.12 (8) | 3.24 (8) | 2.97 (8) | 3.02 (8) | 2.87 (8) |
| kb-2 | ava | 6.24 (23) | 6.21 (23) | 6.20 (23) | 6.50 (23) | 6.51 (23) |
| cta-1 | ava | 3.83 (10) | 3.67 (10) | 3.79 (10) | 3.80 (10) | 3.80 (10) |
| cta-2 | ava | 1.42 (3) | 1.40 (3) | 1.39 (3) | 1.42 (3) | 1.34 (3) |

## Fixes

None. Cartesia accepted every request as-is (model, emotions and SSE parsing all worked), so
`scripts/generate-voice.mjs` and `scripts/voice-lines.json` are unchanged.

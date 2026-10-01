# Ava's greeting in six languages — status

Generated 2026-10-01 with

    node scripts/generate-voice.mjs --engine=cartesia --only=lang-en,lang-ro,lang-es,lang-fr,lang-de,lang-ja

- Engine: Cartesia Sonic, model `sonic-3.6-2026-08-27`, API version `2026-08-14`, `POST /tts/sse` with `add_timestamps`.
- Voice: Ava = Tessa (Emotive), `6ccbfb76-1fc6-48f7-b71d-91ac6298247b`.
- Emotion `happy` on every line; `speed: 1.0` per line (overrides the voice's 1.05, so no `speed` is sent and Sonic speaks at its natural pace).
- `language` from each line in `scripts/voice-lines.json` is now sent to Cartesia (it was hardcoded to `en`).
- Post chain: Ava's clean path (90 Hz high-pass, no phone EQ), trimmed, -23 LUFS integrated, edge fades.
- `--only` merged the six lines into `src/voice.generated.ts` (appended after the existing ones) and wrote only `public/voice/lang-*.wav`. The existing `call-*`, `kb-*` and `cta-*` WAVs and entries are byte-identical (checked against `HEAD`). `npx tsc --noEmit -p .` passes.
- Texts match `lib/voice/greetings.ts` verbatim (`say` = `speak`).

## Language support

Every language was accepted on the first request with its ISO code (`en`, `ro`, `es`, `fr`, `de`, `ja`), Romanian included. No fallback model was needed.

Word timestamps: Cartesia returned whole words for en/ro/es/fr/de (6, 7, 8, 8, 6 units) and 17 smaller units for Japanese. Alignment onto `say` now works on a character stream, so it holds for words, sub-words or single characters. For Japanese (no spaces), `say` is cut into ICU word segments with the punctuation kept on the word before it. **The `ja` words concatenate with no separator** (`words.map(w => w.w).join('')` = `say`); the other languages join with spaces. If too few words match (e.g. the model spells "AI" in katakana), the words are spread over the returned timeline by length. In every case `words[]` is monotonic and non-empty.

## Durations

| Line    | Lang | Duration | Frames @30 | Timed units from Cartesia |
|---------|------|----------|------------|---------------------------|
| lang-en | en   | 2.267 s  | 69         | 6                         |
| lang-ro | ro   | 4.139 s  | 125        | 7                         |
| lang-es | es   | 3.981 s  | 120        | 8                         |
| lang-fr | fr   | 4.540 s  | 137        | 8                         |
| lang-de | de   | 3.031 s  | 91         | 6                         |
| lang-ja | ja   | 2.733 s  | 82         | 17                        |

lang-ro and lang-fr run a little over 4 s because those greetings are longer, not because of the pace (speed 1.0).

## Word timestamps (seconds from the start of the WAV)

### lang-en (en) — 2.267 s, 69 frames

> This is Ava, an AI assistant.

| # | word | t (s) |
|---|---|---|
| 0 | This | 0.000 |
| 1 | is | 0.236 |
| 2 | Ava, | 0.316 |
| 3 | an | 1.041 |
| 4 | AI | 1.116 |
| 5 | assistant. | 1.516 |

Phrases: `This is Ava,` 0.000–0.876 s · `an AI assistant.` 1.041–2.236 s

### lang-ro (ro) — 4.139 s, 125 frames

> Sunt Ava, asistentul virtual cu inteligență artificială.

| # | word | t (s) |
|---|---|---|
| 0 | Sunt | 0.008 |
| 1 | Ava, | 0.408 |
| 2 | asistentul | 1.120 |
| 3 | virtual | 1.848 |
| 4 | cu | 2.408 |
| 5 | inteligență | 2.568 |
| 6 | artificială. | 3.208 |

Phrases: `Sunt Ava,` 0.008–0.968 s · `asistentul virtual cu inteligență artificială.` 1.120–4.248 s

### lang-es (es) — 3.981 s, 120 frames

> Soy Ava, el asistente virtual con inteligencia artificial.

| # | word | t (s) |
|---|---|---|
| 0 | Soy | 0.018 |
| 1 | Ava, | 0.339 |
| 2 | el | 1.125 |
| 3 | asistente | 1.219 |
| 4 | virtual | 1.779 |
| 5 | con | 2.419 |
| 6 | inteligencia | 2.499 |
| 7 | artificial. | 3.219 |

Phrases: `Soy Ava,` 0.018–0.899 s · `el asistente virtual con inteligencia artificial.` 1.125–4.019 s

### lang-fr (fr) — 4.540 s, 137 frames

> Ici Ava, l'assistant virtuel basé sur l'intelligence artificielle.

| # | word | t (s) |
|---|---|---|
| 0 | Ici | 0.120 |
| 1 | Ava, | 0.602 |
| 2 | l'assistant | 1.320 |
| 3 | virtuel | 1.880 |
| 4 | basé | 2.600 |
| 5 | sur | 3.000 |
| 6 | l'intelligence | 3.160 |
| 7 | artificielle. | 3.720 |

Phrases: `Ici Ava,` 0.120–1.240 s · `l'assistant virtuel basé sur l'intelligence artificielle.` 1.320–4.600 s

### lang-de (de) — 3.031 s, 91 frames

> Sie sprechen mit Ava, dem KI-Assistenten.

| # | word | t (s) |
|---|---|---|
| 0 | Sie | 0.012 |
| 1 | sprechen | 0.172 |
| 2 | mit | 0.652 |
| 3 | Ava, | 0.733 |
| 4 | dem | 1.533 |
| 5 | KI-Assistenten. | 1.852 |

Phrases: `Sie sprechen mit Ava,` 0.012–1.452 s · `dem KI-Assistenten.` 1.533–3.132 s

### lang-ja (ja) — 2.733 s, 82 frames

> AIアシスタントのAvaと申します。

| # | word | t (s) |
|---|---|---|
| 0 | AI | 0.018 |
| 1 | アシスタント | 0.419 |
| 2 | の | 1.139 |
| 3 | Ava | 1.505 |
| 4 | と | 1.939 |
| 5 | 申 | 1.939 |
| 6 | し | 2.099 |
| 7 | ます。 | 2.259 |

Phrases: `AIアシスタントのAvaと申します。` 0.018–2.579 s


# Cartesia voice generation — status

Generated 2026-09-30 with `node scripts/generate-voice.mjs --engine=cartesia`.

- API key: present. `https://api.cartesia.ai/voices` reachable (unauthenticated check returned 401).
- Model: `sonic-3.6-2026-08-27` (script default), API version `2026-08-14`.
- Per-line Sonic emotions as set in `scripts/voice-lines.json`.

## Voices

| Role    | Voice  | Cartesia id                            |
|---------|--------|----------------------------------------|
| ava     | Skylar | db6b0ed5-d5d3-463d-ae85-518a07d3c2b4   |
| caller  | Daniel | 47c38ca4-5f35-497b-b1a3-415245fb35e1   |
| caller2 | Katie  | f786b574-daa5-4673-aa0c-cbe3e8534c02   |

caller2 was auto-picked (feminine, not Skylar) and is now pinned in
`scripts/voice-lines.json` (`voices.caller2.cartesia.id` / `.name`).

## Lines

| Line   | Voice   | Duration |
|--------|---------|----------|
| call-1 | ava     | 5.22 s   |
| call-2 | caller  | 2.32 s   |
| call-3 | ava     | 4.04 s   |
| call-4 | caller  | 1.31 s   |
| call-5 | ava     | 3.06 s   |
| kb-1   | caller2 | 1.20 s   |
| kb-2   | ava     | 4.88 s   |
| cta-1  | ava     | 3.73 s   |
| cta-2  | ava     | 1.30 s   |

9 lines in 12.5 s.

## Fixes

None needed: every request succeeded on the first run. The only script-side
change is pinning the caller2 voice.

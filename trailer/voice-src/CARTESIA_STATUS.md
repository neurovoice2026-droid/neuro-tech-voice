# Cartesia TTS status

Probed 2026-09-30 from the cloud session.

| Check | Result |
|---|---|
| `CARTESIA_API_KEY` present | **no** (KEY_MISSING) |
| `curl https://api.cartesia.ai/voices` HTTP status | **000** (blocked by network policy) |

Agent proxy status for api.cartesia.ai:

```
"kind": "connect_rejected",
"detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
"host": "api.cartesia.ai:443"
```

Voice generation was **not run**. To enable it:

1. Add `CARTESIA_API_KEY` to the environment's secrets / environment variables.
2. Allow `api.cartesia.ai` in the environment's network policy (custom allowlist or full access).
3. Re-run: `cd trailer && npm ci --no-audit --no-fund && node scripts/generate-voice.mjs --engine=cartesia`.

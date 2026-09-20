# Voice gateway

The always-on WebSocket service that carries live calls for Neuro Tech Voice.
Twilio (phone calls) and the dashboard (browser test calls) stream audio here;
the gateway runs the conversation on Cartesia, falls back to ElevenLabs when
Cartesia can't serve a call, and reports everything back to the Next.js app
over signed HTTPS.

It runs outside Vercel because a call is a WebSocket that stays open for
minutes, which serverless functions can't hold.

- [Architecture](#architecture)
- [Call modes and failover](#call-modes-and-failover)
- [Environment variables](#environment-variables)
- [Local development and tests](#local-development-and-tests)
- [Deploy to Fly.io](#deploy-to-flyio)
- [Deploy to Render or any Docker host](#deploy-to-render-or-any-docker-host)
- [Connect the app and Twilio](#connect-the-app-and-twilio)
- [Scaling and concurrency](#scaling-and-concurrency)
- [Runbook](#runbook)

## Architecture

```
Twilio number ─► app POST /api/telephony/inbound (router picks the mode)
                   └─ TwiML <Connect action=/api/telephony/stream-ended>
                        <Stream url="wss://GATEWAY/twilio"><Parameter name="session" value="signed token"/>
Dashboard test call ─► app POST /api/voice/test-session ─► wss://GATEWAY/browser?token=…

gateway (this service)
  src/server.ts        GET /health, WS upgrade for /twilio and /browser, capacity, graceful drain
  src/session.ts       CallSession: token → /session config → engine → failover → timers → /finalize
  src/channels/        twilio.ts (μ-law 8 kHz Media Streams), browser.ts (PCM16 16 kHz)
  src/engines/
    cartesia-self.ts   Cartesia Ink STT → OpenAI Responses (gpt-5.6-luna) → Cartesia Sonic TTS
    cartesia-managed.ts  bridge to a Cartesia Managed Agent (client tools run through the app)
    elevenlabs-agent.ts  bridge to the org's ElevenLabs agent (fallback)
    utterance.ts       ordered TTS segments, playback tracking, "what the caller heard"
  src/providers/       Cartesia TTS/STT, ElevenLabs TTS/Scribe, OpenAI turn loop
  src/audio/           μ-law/PCM codec + resampling, VAD, pacing, playback marks
  src/app-client.ts    signed POSTs to /api/voice/internal/{session,tools,events,call-control,finalize}
  src/breaker.ts       per-process circuit breakers (same rules as lib/voice/breaker.ts)

app (Vercel)  /api/voice/internal/*  — session config, tool execution, events,
              hang-up/transfer through Twilio REST, call finalisation
```

Everything between the app and the gateway is authenticated with
`VOICE_GATEWAY_SECRET`:

- **Session tokens** (`base64url(JSON).base64url(HMAC-SHA256)`) are minted by the
  app, carried in the Twilio `<Parameter>` or the browser URL, verified by the
  gateway before it does anything, and again by the app on `/session`.
- **Request signatures** (`x-ntv-signature: t=<unix>,v1=<hex HMAC>`) on every
  gateway → app request, with a 5-minute clock tolerance.

`src/signing.ts` implements exactly the algorithm in `lib/security/signing.ts`;
`test/signing.vectors.ts` is a byte-for-byte copy of the app's vectors and a test
fails if the copies drift.

The gateway bundles a few **dependency-free app modules**: `lib/voice/contracts.ts`
(wire types) and `lib/voice/greetings.ts` with its pure imports (the localized
"Are you still there?", wrap-up, filler and hand-off lines in 14 languages). Keep
those modules free of `server-only`, Next or React imports; `build.mjs` refuses to
bundle them otherwise.

### What happens on a call (cartesia_self)

1. Twilio opens `/twilio` and sends `start` with the session token. The gateway
   verifies it, fetches the session config from `/session`, reports
   `stream_started`, and opens Cartesia TTS + STT (3 s connect timeouts).
2. The greeting (`initial_message`, disclosure already applied by the app) is
   spoken; outbound calls with voicemail detection wait 2.5 s for the callee first.
3. Caller audio goes to Cartesia Ink in paced 100 ms frames, continuously
   (silence is injected if the channel goes quiet):
   English uses `ink-2` on the turns endpoint; es/fr/hi/ja `ink-preview`; every
   other language `ink-whisper` on the manual endpoint, where the gateway's VAD
   sends `finalize` after 700 ms of silence.
4. `turn.eager_end` starts a speculative OpenAI run whose output is held;
   `turn.end` with the same transcript releases it (no extra latency),
   `turn.resume` aborts it.
5. OpenAI streams text (Responses API, `store:false`, reasoning `none`,
   verbosity `low`, `parallel_tool_calls:false`); sentences go to Cartesia TTS as
   continuations on a fresh context. Tool calls say a short filler, run through
   `/tools`, and loop (≤ `max_tool_hops`).
6. Barge-in (`turn.start` while the agent talks): the LLM request is aborted,
   the TTS context cancelled, Twilio's buffer cleared, and the transcript and
   model history keep only the words the caller actually heard (word timestamps
   vs. played audio, tracked with Twilio marks).
7. `end_call` / `transfer` actions run after the reply has finished playing:
   the gateway asks the app to hang up or transfer through Twilio REST.
8. Silence: after `silence_timeout_seconds` the agent asks once if the caller is
   still there, then says goodbye and hangs up. Max duration: a wrap-up line
   30 s before the limit, hang-up at the limit.
9. When the stream ends, `/finalize` receives the transcript (with interruptions,
   tool calls and knowledge sources), end reason, mode, fallback flags and usage
   (TTS characters, STT seconds and model, LLM tokens, agent/ElevenLabs seconds).
   Finalize retries 3 times with backoff.

## Call modes and failover

| Routed mode | Normal path | When it fails |
|---|---|---|
| `cartesia_self` | Cartesia STT + OpenAI + Cartesia TTS | TTS error → ElevenLabs TTS for the rest of the call. STT error → ElevenLabs Scribe, replaying the last 2 s of audio. OpenAI error (after one retry, only if nothing was spoken) → ElevenLabs agent. Cartesia `quota_exceeded` → `quota_exceeded` event (budget `model_credits`) + ElevenLabs agent. |
| `cartesia_managed` | Cartesia Managed Agent WebSocket | Error, `agent_failed` or unexpected close → ElevenLabs agent. Quota → event (budget `agent_dollars`) + ElevenLabs agent. |
| `elevenlabs` | ElevenLabs agent WebSocket (signed URL) | Nothing left inside the gateway: the stream closes and the app's `<Connect action>` answers (register-call, apology line, or the on-call contact). |

Every switch is reported to `/api/voice/internal/events` (`mode_switched`,
`component_fallback`, `provider_error`, `quota_exceeded`), and the finalize
payload carries `fallback_used` / `fallback_reason`.

A mid-call hand-off to ElevenLabs sends `conversation_config_override` with the
agent's prompt plus "Conversation so far:" (last 20 turns), a localized "sorry
about that, I'm back" first message, language and voice. `{{…}}` in customer
text is escaped so ElevenLabs doesn't read it as dynamic variables.

The managed bridge passes per-call **dynamic variables** in `session_create`
(`ntv_call_id`, `caller_number`, `call_direction`, `local_datetime`,
`business_timezone`, `is_test_call`); agent instructions can reference them as
`{{caller_number}}` etc. If Cartesia rejects them, the bridge reconnects once
without them and the agent can still call the `ntv_get_call_context` tool.

The gateway also keeps **per-process circuit breakers** per component
(`cartesia_tts`, `cartesia_stt`, `openai`, `cartesia_managed`, `elevenlabs_*`)
with the app's rules: 3 hard failures (soft = 0.5) or ≥ 50 % failures over ≥ 5
calls in 60 s open it for 30 s, doubling up to 5 min. While `cartesia_tts` or
`cartesia_stt` is open, new calls start directly on the ElevenLabs component.
The app's shared breaker (fed by `provider_error` events) steers routing of new
calls.

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `APP_URL` | yes | – | HTTPS base URL of the app, e.g. `https://app.neurotechvoice.com` (same as the app's `NEXT_PUBLIC_APP_URL`). Plain `http://` is refused except for localhost, because transcripts are sent there. |
| `VOICE_GATEWAY_SECRET` | yes | – | Same value as the app. At least 32 characters (`openssl rand -hex 32`). Trimmed. |
| `CARTESIA_API_KEY` | for Cartesia modes | – | Standard Cartesia key (`sk_car_…`) |
| `OPENAI_API_KEY` | for `cartesia_self` | – | OpenAI key for the live LLM |
| `ELEVENLABS_API_KEY` | for fallbacks | – | ElevenLabs key (agent bridge, TTS, Scribe) |
| `CARTESIA_TTS_MODEL` | no | `sonic-3.6-2026-08-27` | Used only when a session config has no model |
| `OPENAI_VOICE_MODEL` | no | `gpt-5.6-luna` | Used only when a session config has no model |
| `ELEVENLABS_TTS_MODEL` | no | `eleven_flash_v2_5` | ElevenLabs TTS fallback model |
| `PORT` / `HOST` | no | `8080` / `0.0.0.0` | Listen address |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, `error` |
| `MAX_CONCURRENT_CALLS` | no | `100` | Streams refused beyond this (Twilio then falls back through the app) |
| `SHUTDOWN_DRAIN_SECONDS` | no | `30` | How long SIGTERM waits for calls to finish |
| `BROWSER_ALLOWED_ORIGINS` | no | any | Comma-separated extra origins allowed to open `/browser` (the `APP_URL` origin is always allowed once set) |
| `HEALTH_DETAILS_TOKEN` | recommended | – | ≥ 24 characters. `/health` answers only `{"status"}` publicly; with `Authorization: Bearer <token>` it adds active calls, capacity, providers and breakers |
| `CARTESIA_API_BASE`, `ELEVENLABS_API_BASE`, `OPENAI_BASE_URL` | no | provider defaults | Only for tests or proxies; must be `https://` (or http on localhost) |

Values like `your-key` or `<changeme>` count as unset, like in the app.
Logs never contain secrets or full phone numbers (`+40******123`).

## Local development and tests

```bash
cd services/voice-gateway
npm ci
npm run typecheck   # tsc --noEmit (strict)
npm test            # vitest: all offline
npm run build       # esbuild → dist/index.js (single file, Node 22+)
APP_URL=https://… VOICE_GATEWAY_SECRET=… node dist/index.js
```

The tests start real WebSocket/HTTP mock servers for Twilio, Cartesia (TTS,
STT turns and manual, Agents), OpenAI (the real `openai` SDK against a local SSE
server), ElevenLabs (agent, TTS, Scribe) and the app (signature-verifying), then
drive whole calls: tool calls and `end_call`, barge-in, speculative `eager_end`,
Romanian manual STT, TTS/STT component fallback, quota hand-off, managed bridge
with client tools, browser audio round trip, silence timeout, voicemail, drain.
Set `GATEWAY_TEST_LOGS=1` to see gateway logs while they run.

## Deploy to Fly.io

Run everything from the **repository root** (the image bundles shared app modules).

1. Install flyctl and log in: `fly auth login`.
2. Create the app once (name must match `fly.toml`, or edit it):
   `fly apps create ntv-voice-gateway`
3. Set secrets:
   ```bash
   fly secrets set --config services/voice-gateway/fly.toml \
     APP_URL=https://app.example.com \
     VOICE_GATEWAY_SECRET="$(openssl rand -hex 32)" \
     CARTESIA_API_KEY=sk_car_… OPENAI_API_KEY=sk-… ELEVENLABS_API_KEY=…
   ```
   Use the **same** `VOICE_GATEWAY_SECRET` in the app (Vercel env).
4. Deploy:
   ```bash
   fly deploy . --config services/voice-gateway/fly.toml \
     --dockerfile services/voice-gateway/Dockerfile \
     --ignorefile services/voice-gateway/Dockerfile.dockerignore
   ```
5. Check: `curl https://ntv-voice-gateway.fly.dev/health` → `{"status":"ok"}`, and with
   `-H "Authorization: Bearer $HEALTH_DETAILS_TOKEN"` →
   `{"status":"ok","active_calls":0,…,"providers":{"cartesia":true,…}}`.
6. For redundancy run two machines in the region: `fly scale count 2 --config services/voice-gateway/fly.toml`.
   `auto_stop_machines = false` and `min_machines_running = 1` keep machines warm;
   `kill_timeout = 45s` lets deploys drain calls.

## Deploy to Render or any Docker host

- **Render:** New → Blueprint → this repo, blueprint path
  `services/voice-gateway/render.yaml`; fill the `sync: false` secrets in the
  dashboard. Use an always-on plan (Standard or higher).
- **Docker anywhere:**
  ```bash
  docker build -f services/voice-gateway/Dockerfile -t ntv-voice-gateway .
  docker run -p 8080:8080 -e APP_URL=… -e VOICE_GATEWAY_SECRET=… -e CARTESIA_API_KEY=… \
    -e OPENAI_API_KEY=… -e ELEVENLABS_API_KEY=… ntv-voice-gateway
  ```
  Put it behind TLS (Twilio requires `wss://`). The image runs as the non-root
  `node` user and has a `HEALTHCHECK` on `/health`. `--build-arg RUN_TESTS=1`
  runs the test suite during the build.

## Connect the app and Twilio

1. In the app (Vercel env), set `VOICE_GATEWAY_URL=wss://ntv-voice-gateway.fly.dev`
   (no path) and the same `VOICE_GATEWAY_SECRET`. The router then answers calls
   with `<Connect><Stream url="wss://…/twilio">`, and test calls connect to
   `wss://…/browser`.
2. Twilio needs no gateway-specific setup: numbers keep pointing at the app
   (`/api/telephony/inbound`, configured by the app's number routing,
   `POST /api/phone/[id]/routing`).
   The gateway never calls Twilio; hang-ups and transfers go through the app.
3. For ElevenLabs fallback, each agent needs `elevenlabs_agent_id` with overrides
   enabled for prompt, first message, language and voice, and μ-law 8 kHz audio
   (the app's agent sync does this).
4. For `cartesia_managed`, the app's sync creates the Cartesia agent and its
   `ntv_*` client tools; the gateway runs those tools through `/api/voice/internal/tools`.
5. Verify end to end: start a dashboard test call (browser channel), then call a
   routed number. `/health` (with the details token) shows `active_calls`, and the app's call record shows
   `pipeline_mode`, transcript and usage.

## Scaling and concurrency

- **One process, many calls.** A Twilio call costs little CPU (μ-law passes
  through untouched; JSON and base64 per 20 ms frame). Browser calls through the
  ElevenLabs bridge also resample (16 ↔ 8 kHz). A `shared-cpu-2x` / 1 GB machine
  handles 40 concurrent calls comfortably; scale out with more machines rather
  than raising `MAX_CONCURRENT_CALLS` past what the CPU keeps real-time.
- **Provider limits are the real ceiling** (cartesia-docs.md §0.9):
  - every `cartesia_self` call holds one Cartesia **STT stream** for its whole
    duration: Pro 12, Startup 20, Scale 60 concurrent streams
  - TTS concurrency counts contexts while generating (Pro 3, Startup 5, Scale 15),
    roughly 4× that in simultaneous conversations
  - Managed Agent calls have their own pool (8 / 12 / 20 / 60)
  - ElevenLabs fallback: agent concurrency Starter 6, Creator 10, Pro 20; Flash
    TTS 6 / 10 / 20; Scribe realtime 9 / 15 / 30
  Keep `MAX_CONCURRENT_CALLS × machines` at or below the Cartesia STT limit of the
  plan. Beyond it Cartesia returns 429 (`concurrency_limited`) and those calls
  fail over to ElevenLabs, which is more expensive.
- **OpenAI:** each caller turn is 1 request (+1 per tool hop). Tier 1 allows 500
  RPM for Luna, ample for 40 calls.
- **Latency:** deploy close to the providers (`fra`). Twilio numbers in Europe can
  use Twilio's `de1` edge for media.
- **Backpressure:** a backlog of caller audio (the 2 s replay after an STT switch, or
  a network burst from Twilio) drains at 1.5× (Cartesia) or 2× (Scribe) real time,
  so the STT never stays behind the caller; audio queued for a stalled provider is capped at 2 s
  (older audio is dropped), provider send queues are bounded, transcripts are
  capped at 1,000 turns, and finalize bodies stay under the app's 2 MB limit.

## Runbook

**Health.** `GET /health` → `status` for everyone; with the `HEALTH_DETAILS_TOKEN`
bearer token also `active_calls`, `max_calls`, configured providers and local
breaker phases. `503 draining` during shutdown is expected.
Logs are JSON lines with `call_id`, `mode`, `channel`; search for
`"level":"error"` or `"msg":"provider error"`. Every agent turn of a
`cartesia_self` call logs one `"msg":"agent turn"` line with where the time
went (model start and first text, tool durations, first audio, all in ms from
the caller's turn end; no transcript text).

**Pre-auth limits.** A `/twilio` socket must send `start` within 5 s, and one
address may hold at most 10 such unauthenticated sockets (429 beyond that), so
a client idling connections can't fill the pre-auth allowance.

**Gateway down or unreachable.** Twilio can't open the stream, so the app's
`<Connect action>` runs its fallback (ElevenLabs register-call or the apology
line). The app's `gateway` breaker opens after repeated failures and routes new
calls straight to ElevenLabs. Fix the machine (`fly status`, `fly logs`), then
confirm `/health`.

**Cartesia credits exhausted (`quota_exceeded`, budget `model_credits`).** Calls
in progress hand off to ElevenLabs; the app marks the cycle exhausted and routes
new calls to Managed Agents (or ElevenLabs). The flag resets with the next billing
cycle (`CARTESIA_BILLING_CYCLE_ANCHOR`); after a top-up, clear it earlier with
`clearBudgetExhausted()` from `lib/voice/budget.ts`.

**Agent dollars exhausted (`agent_dollars`).** Same, for `cartesia_managed`.

**Many `component_fallback` events.** Cartesia TTS or STT is degraded. Local
breakers route new calls in this process straight to ElevenLabs components; check
https://status.cartesia.ai. No action is needed if the fallback works.

**`provider_error` from OpenAI.** Look at `code`: `insufficient_quota` /
spend-limit codes need billing action; `rate_limit_exceeded` means the tier is
too low for the traffic.

**Deploying without dropping calls.** SIGTERM stops new streams (`/health` →
503), waits up to `SHUTDOWN_DRAIN_SECONDS` for calls to end, then closes the rest
without hanging up (the app's fallback takes those callers). Deploy outside peak
hours or run two machines so a rolling deploy always has one accepting calls.

**Rotating `VOICE_GATEWAY_SECRET`.** Update the app and the gateway together
(`fly secrets set` restarts the machines, which drains). Session tokens live
≤ 120 s and finalize retries for a few seconds, so only calls starting during
the switch are affected.

**A call record is missing its transcript.** Search logs for
`call finalize failed after retries` with that `call_id`: the app was unreachable
or rejected the body (4xx). The call itself is still billed from Twilio's status
callback.

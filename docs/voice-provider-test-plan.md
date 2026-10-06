# Voice providers — test plan

Automated tests never place calls or contact a provider. Real calls are made
only by a person following this plan, or by `scripts/live-smoke-test.mjs` with
`--confirm-live` and an interactive confirmation. Every live call costs money
(Twilio + provider minutes): use staging, numbers you control, and the minimum
number of calls.

## 1. Automated checks (CI / before every push)

```
npm run lint
npm run typecheck
npm test            # vitest: unit + integration with mocked fetch, no network
npm run build
```

Coverage (see `*.test.ts`):

| Area | Tests |
|---|---|
| Circuit breaker, API vs media circuits, forced/auto recovery, provider selection, outbound routing, working hours (DST, overnight, 24 h) | `circuit-breaker`, `circuit-registry`, `routing`, `working-hours` |
| HTTP policy: timeouts, retry only when safe, jitter, Retry-After, no retry on 4xx | `voice-providers/http` |
| Webhook signature (HMAC, tolerance, tamper), Cartesia secret, normalization, dedupe | `elevenlabs/webhook`, `cartesia/webhook`, webhook route tests |
| Call merge: out-of-order / duplicate / partial events never downgrade; abandoned provider conversation never overwrites; trusted call correlation (signed token) | `call-merge`, `call-store` |
| Prompt composition (platform rules, injection, diacritics), settings schemas, E.164 | `prompt`, `settings`, `phone/e164` |
| Agent config builders (μ-law, transfer modes, KB, TTS model, analysis, privacy) | `elevenlabs/agent-config`, `cartesia/agent-config`, `models` |
| Provider clients with mocked fetch (URLs, headers, pagination, errors) | `elevenlabs/client`, `cartesia/client`, `adapters` |
| Twilio signature + call tokens + TwiML, transfer tool auth | `route-handler`, `tokens`, `twiml`, `tools/transfer` |
| API helpers: body limits, same-origin, error mapping, admin auth, rate limits | `api/http`, `api/auth`, `security/rate-limit` |
| Redaction (keys, tokens, phones) | `security/redact` |
| Agent API + onboarding (validation, one agent per org, sync reporting, activation, rate limit, fallback voice eligibility) | `app/api/agent/routes`, `app/api/onboarding/complete/route`, `agents/ensure-agent` |
| Voice catalog (tenant isolation, library provisioning races, preview, clone consent/verification) | `voice-providers/voice-catalog` |
| Knowledge base (file/URL/text validation, SSRF guard, processing, attach, delete) | `voice-providers/knowledge`, `knowledge-process`, `app/api/agent/knowledge/routes` |
| Calls history API (DB-first, ownership, audio proxy streaming, CSV injection, filters) | `calls/serialize`, `app/api/calls/routes` |

RLS/authorization: the guard trigger and policies are in migration 010. They
were exercised on PostgreSQL 16 with Supabase stand-ins (migrations 001–010
applied twice; tenant updates of plan/voices/provider fields, inserts of
organizations/numbers/calls/knowledge rows and storage uploads rejected; the
service role unaffected; usage billed once). Repeat §3 on the staging
Supabase project.

## 2. Staging setup checklist

- [ ] Migration `010_voice_providers.sql` applied (re-running it is a no-op).
- [ ] All variables from `.env.example` set for the staging deployment.
- [ ] `GET /api/admin/voice/diagnostics?probe=1` (Bearer `ADMIN_API_TOKEN`): no `error` problems, both providers `ok`.
- [ ] ElevenLabs workspace webhook points to `https://<staging>/api/elevenlabs/webhook` (HMAC on).
- [ ] Twilio number on staging is `app_routed`, routing status `ready` (Phone page / `GET /api/phone/diagnose`: voice webhook `platform`).
- [ ] Cron `/api/cron/voice-maintenance` runs (Vercel → Cron Jobs → logs show `cron.voice_maintenance_done`).

## 3. Authorization / tenant isolation (two test accounts A and B)

- [ ] A cannot read B's calls, agent, numbers, documents (`/api/calls/<B call id>` → 404).
- [ ] `/api/voices` without a session → 401; A never sees B's cloned voices.
- [ ] `PUT /api/agent/voice` with a voice id that is not default/platform/A's own → 403.
- [ ] With A's JWT, `update organizations set plan='enterprise'` (Supabase client) is rejected by the guard trigger; same for `phone_numbers.routing_mode`, `agents.elevenlabs_agent_id`, inserting `calls`.
- [ ] Storage: A cannot download `knowledge-documents/<B org id>/…`.
- [ ] Cross-site POST (different `Origin`) to `/api/agent/test-call` → 403.

## 4. Primary path (ElevenLabs) — manual, staging

| # | Step | Expected |
|---|---|---|
| 4.1 | Onboarding: company → agent → voice (pick a library voice, preview it) → launch | one ElevenLabs agent (tags `ntv-agent:<id>`), voice status *Active*; re-running onboarding does not create a second agent |
| 4.2 | Change system prompt / first message, save | toast success; agent page provider status *Ready*; ElevenLabs agent shows a new version |
| 4.3 | Change voice in dashboard | badge *Syncing…* then *Active*; with a bad voice → *Not applied* + Retry, never *Active* |
| 4.4 | Upload a PDF (≤20 MB), a URL and a text | status processing → ready, "attached to agent"; ask the agent about the content during a call |
| 4.5 | Delete a document | removed from list and from the ElevenLabs agent knowledge base |
| 4.6 | Call the number (Romanian agent) | greeting with AI disclosure; correct diacritics in transcript; call appears in Calls with "AI · ElevenLabs", transcript, summary, recording player |
| 4.7 | Ask for a human (transfer enabled to your second phone) | agent announces the transfer, your second phone rings, call outcome *Transferred* |
| 4.8 | "Call me now" from the dashboard | your phone rings; outbound greeting; call recorded as outbound |
| 4.9 | Use "Call me now" 6 times quickly (within one clock-aligned 10-minute window, e.g. 10:00–10:09) | 6th attempt → 429 with a friendly message and `Retry-After` (fixed windows reset on the 10-minute boundary) |
| 4.10 | Minutes | org `minutes_used` increases once per call even if the webhook is re-sent (resend from ElevenLabs webhook history) |

## 5. Fallback path (Cartesia) — staging only

| # | Step | Expected |
|---|---|---|
| 5.1 | Agent page → Fallback "Cartesia" status *Ready*; Phone diagnose shows the Cartesia import present | |
| 5.2 | Force the circuit: `POST /api/admin/voice/circuit {"provider":"elevenlabs","action":"open"}` | diagnostics shows `circuits.elevenlabs.effective = "open"` (`forced: "open"`) |
| 5.3 | Call the number | Cartesia agent answers in the same language with the mapped voice; Calls shows amber "Fallback · Cartesia", reason "Primary provider degraded" |
| 5.4 | During the fallback call ask for a human | SIP REFER → your transfer phone rings (only the configured number is accepted) |
| 5.5 | After hangup | within a few minutes (webhook or cron poll) the call has transcript/summary; minutes billed once |
| 5.6 | `POST /api/admin/voice/circuit {"provider":"elevenlabs","action":"auto"}` then call again | circuit half-open → the call is the probe, ElevenLabs answers, diagnostics shows `effective: "closed"` |
| 5.7 | Simulate register-call failure: on a staging deployment set `ELEVENLABS_API_BASE_URL` to an unreachable host, call | Cartesia answers; `failover_reason` contains `elevenlabs:connect_network` or `_timeout` |
| 5.8 | Both providers unavailable (also break Cartesia SIP credentials) | localized apology, then forward to the transfer number if configured; call `no_provider` |
| 5.9 | Disable fallback (Call handling → Provider fallback off) with the circuit open | apology/human path, no Cartesia attempt |

## 6. Working hours (both providers)

| # | Step | Expected |
|---|---|---|
| 6.1 | Availability: set hours so it is currently closed, mode "message" | caller hears the after-hours message, call "After hours", no provider minutes |
| 6.2 | Mode "forward" | forwarded to the number; outcome transferred/missed |
| 6.3 | Mode "AI answers" | agent says the business is closed and takes a message; the same with the circuit open (Cartesia uses `get_call_context`) |
| 6.4 | Change the org time zone | open/closed indicator and behaviour follow the new zone |

## 7. Webhooks / idempotency

- [ ] Resend a post-call webhook from ElevenLabs history → `webhook_events` duplicate, call unchanged, minutes unchanged.
- [ ] Send a webhook with a wrong signature (curl) → 401; `provider_events` has `webhook_verification_failed`.
- [ ] Twilio request with a bad `X-Twilio-Signature` → 403.

## 8. Live smoke script

```
# read-only checks (no call)
ADMIN_API_TOKEN=… node scripts/live-smoke-test.mjs --base-url https://staging.example.com

# one real call to a number you control (asks you to type "CALL +40…")
ADMIN_API_TOKEN=… node scripts/live-smoke-test.mjs --base-url https://staging.example.com \
  --confirm-live --org-id <org uuid> --to +40712345678
```

## 9. Release sign-off

- [ ] §1 green, §3 done on staging, §4.1–4.7, §5.2–5.6, §6.1 executed with evidence (call ids).
- [ ] Production variables set, diagnostics clean, cron active.
- [ ] Existing `native_elevenlabs` numbers reviewed: switch to smart routing per customer when they want failover/after-hours.

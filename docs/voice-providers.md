# Voice providers: ElevenLabs (primary) + Cartesia (fallback)

This document describes how phone calls reach an AI agent, how the platform keeps
both providers in sync with the agent the customer configures, what happens when
the primary provider is down, and how to operate the system (configuration,
webhooks, incidents, reconciliation). The manual and live test procedure is in
[voice-provider-test-plan.md](./voice-provider-test-plan.md).

> Sources: ElevenLabs Agents Platform API reference, Cartesia API reference
> (`Cartesia-Version: 2026-08-14`), Twilio Voice/TwiML reference, Supabase and
> Next.js 16 docs (`node_modules/next/dist/docs`). Vendor behaviour that could
> only be inferred from the docs (not tested live) is marked **unverified live**.

---

## 1. Architecture

```
                       ┌──────────────────────── Next.js (Vercel) ────────────────────────┐
 caller ──PSTN──► Twilio number ──POST──► /api/telephony/twilio/inbound                       │
                       │                    │  1. number → org/agent (service role)          │
                       │                    │  2. agent/number active?                       │
                       │                    │  3. working hours (org time zone)              │
                       │                    │  4. planRouting(): circuit + config + flags     │
                       │                    ├─► ElevenLabs register-call → TwiML <Connect><Stream>
                       │                    │      + <Redirect> stream-ended (early failure)  │
                       │                    └─► Cartesia fallback → TwiML <Dial><Sip>         │
                       │                           sip:+<our number>@sip.cartesia.ai;tls      │
                       │                                                                       │
 ElevenLabs ──post-call webhook──► /api/elevenlabs/webhook ─┐                                 │
 Cartesia  ──call webhook──────► /api/cartesia/webhook ─────┼─► webhook_events (dedupe)       │
 cron (5 min) ─► /api/cron/voice-maintenance (poll Cartesia,│   → after(): applyCallEvent     │
                 retries, health probes, retention)         └─► calls (single source of truth)│
                                                                → usage_ledger (billed once)   │
                       └──────────────────────────────────────────────────────────────────────┘
```

Key modules:

| Concern | Module |
|---|---|
| Normalized types, settings defaults | `lib/voice-providers/types.ts`, `settings.ts` (zod) |
| HTTP policy (timeouts, retries, jitter, Retry-After, breaker, telemetry) | `lib/voice-providers/http.ts` |
| Circuit breaker (pure state machine + DB store) | `circuit-breaker.ts`, `circuit-store.ts`, `circuit-registry.ts` |
| Provider lifecycle adapters (create/update/delete/find/health) | `adapters.ts` |
| Agent spec (one source for both providers) | `agent-spec.ts`, `prompt.ts` |
| Idempotent agent sync (lease, adopt by tag, retries) | `agent-sync.ts` |
| Per-call routing decision (pure) | `routing.ts`, `working-hours.ts` |
| Twilio ingress, failover, transfer | `lib/telephony/router.ts`, `twiml.ts`, `context.ts` |
| Number binding (Twilio webhooks / provider imports) | `lib/telephony/binding.ts` |
| Webhook verification + normalization | `lib/elevenlabs/webhook.ts`, `lib/cartesia/webhook.ts` |
| Webhook ingestion (dedupe, after-response processing, retries) | `webhook-ingest.ts` |
| Call merge (no downgrades) + usage ledger | `call-merge.ts`, `call-store.ts` |
| Cartesia polling (webhooks not guaranteed) | `cartesia-poll.ts` |
| Maintenance job, reconciliation | `maintenance.ts`, `reconcile.ts` |
| Voice catalog / eligibility / provisioning | `voice-catalog.ts` |
| Knowledge base pipeline | `knowledge.ts` |
| Logging (redacted JSON), telemetry | `lib/observability/*`, `lib/security/redact.ts` |

The provider type is `VoiceProvider = 'elevenlabs' | 'cartesia'`. The interfaces
are split by concern: `AgentLifecycle` (adapters), voice catalog functions,
`startOutboundCall` (call initiation), `applyNumberRouting` (telephony binding),
`normalize*Event` (webhooks), `pollCartesiaCall` / DB reads (conversation
retrieval) and `health()` (health). All provider clients are `server-only`.

## 2. Capability matrix

| Capability | ElevenLabs (primary) | Cartesia (fallback) | Notes |
|---|---|---|---|
| Agent create/update/delete, idempotent | ✅ tags `ntv`, `ntv-org:*`, `ntv-agent:*`, `ntv-env:*`; version id stored | ✅ description marker `ntv-agent:<id>` | Full config on every sync (no partial PATCH drift) |
| Prompt, first message, language, dynamic variables | ✅ | ✅ (static greeting, context via tool) | Same `AgentSpec` |
| Turn-taking, interruptions, silence/max duration | ✅ | ✅ (clamped to Cartesia ranges) | |
| Telephony audio | μ-law 8 kHz in/out for app-routed (register-call), PCM 16 kHz for native | SIP (Cartesia-managed) | |
| LLM | `gpt-5.4-mini` (override `ELEVENLABS_LLM`) | `gpt-5.4-mini` (override `CARTESIA_AGENT_LLM`) | |
| Knowledge base (RAG) | ✅ URL/text/file, RAG index, attached via `prompt.knowledge_base` | ⚠️ inlined excerpts (managed-agent KB is "coming soon") | max 8k chars/doc, 24k total for fallback |
| Human transfer | native `transfer_to_number` (native numbers) / platform tool `transfer_to_human` (app-routed) | SIP REFER → `<Dial referUrl>`, only to the configured number | |
| Post-call analysis (criteria, data collection, summary) | ✅ normalized into `calls.analysis` | summary only | |
| Privacy (recording on/off, retention) | ✅ `platform_settings.privacy` | Cartesia account settings | |
| Guardrails | optional `ELEVENLABS_ENABLE_GUARDRAILS` | — | platform prompt rules always on |
| Voices: catalog, search, filters, pagination, preview | ✅ default + platform library voices + org clones; shared library (provisioned on selection) | ✅ fallback voice per agent (auto by language) | |
| Instant voice clone (with consent) | ✅ consent + rights attestation + audit trail | — | |
| Voice design / Professional voice clone | ❌ deferred | ❌ | |
| Post-call webhooks | ✅ HMAC, 30-min tolerance | ⚠️ static secret; managed-agent webhooks not guaranteed → polling | |
| Outbound calls | ✅ via app routing (or native API) | ✅ via app routing | |
| Mid-call handoff between providers | ❌ not supported by either platform | | only early failures fail over (§4) |
| BYOK (customer API keys) | ❌ deferred — platform keys only, customer keys are never stored | | |

## 3. Routing modes (per phone number)

| | `app_routed` (default for new numbers) | `native_elevenlabs` (explicit opt-in) |
|---|---|---|
| Twilio voice URL | `/api/telephony/twilio/inbound` (+ fallback + status callback) | set by ElevenLabs when the number is imported |
| Provider fallback (Cartesia) | ✅ | ❌ |
| Working hours / after-hours gate | ✅ (same for both providers) | ❌ (not enforced) |
| Human transfer | platform tool → Twilio live-call redirect | ElevenLabs native `transfer_to_number` |
| Call row created | at ingress (every call, even rejected) | from the post-call webhook |

Existing numbers imported into ElevenLabs before this change were backfilled to
`native_elevenlabs` (no hidden behaviour change). Owners switch modes on the
Phone page (`PATCH /api/phone/[id] {routing_mode}`); the switch re-syncs the
agent (audio format) and re-applies the binding.

**register-call vs native import.** register-call keeps Twilio pointed at us, so we
decide every call (health, failover, hours) at the cost of ElevenLabs' native
transfer (replaced by the platform transfer tool) and a ~4.5 s budget for the
register-call request inside Twilio's 15 s webhook limit.

## 4. Failover decision and limits

Five situations are kept distinct in the DB (`calls.routing_reason`), the UI and logs:

| Situation | `routing_reason` | What happens |
|---|---|---|
| Conversational fallback | `primary` (prompt-level) | the agent says `agents.fallback_message` when it cannot help — not a provider event |
| After hours | `after_hours` | message / forward / AI answers (with `after_hours=true` context) — before any provider is used |
| Human handoff | outcome `transferred` | transfer tool / SIP REFER / native transfer |
| Provider fallback | `provider_fallback` + `failover_reason` | Cartesia answers instead of ElevenLabs |
| Final failure | `no_provider` | localized apology, then forward to the transfer number if configured |

`planRouting()` (pure, unit-tested) picks at most two candidates:

1. `VOICE_FORCE_PROVIDER` (kill switch) wins.
2. A provider is skipped when not configured, its agent/number resource is missing,
   or its circuit is open (`failover_reason` e.g. `elevenlabs:circuit_open`).
3. Fallback only when `VOICE_FALLBACK_ENABLED` and the org's `voice_fallback_enabled`.
4. An open circuit is half-opened by **one** probe call (lease in DB) or by the
   maintenance health probe; success closes it, failure re-opens with backoff.

During the call:

* register-call fails (timeout 4.5 s, 5xx, malformed TwiML) → **one** Cartesia attempt
  (`<Dial><Sip>`), failure reason recorded; no loops (`routing.attempts`).
* Media stream ends within `VOICE_EARLY_FAILURE_WINDOW_SECONDS` (default 6 s) of an
  **inbound** call → treated as a failure before any conversation → one Cartesia
  attempt. Later stream ends are normal hang-ups.
* Mid-conversation failure → no provider switch (neither platform can resume
  another's conversation); the call ends and is logged. Officially supported
  transfers still work.
* Cartesia leg fails (`DialCallStatus` busy/failed/no-answer) → final failure path.
* Twilio `voiceFallbackUrl` → `/api/telephony/twilio/fallback` re-runs routing
  (idempotent on CallSid; a connected call is never routed twice).

Circuits (shared by all instances, stored in `provider_circuit_state`):

| Circuit | Fed by | Never fed by |
|---|---|---|
| `elevenlabs` (API) | register-call / outbound-call outcomes, maintenance health probe | previews, catalog, knowledge uploads, agent syncs (tenant-triggered) |
| `elevenlabs_media` | stream ended within the early window (failure); stream that outlived it or a completed conversation longer than the window (success) | REST successes |
| `cartesia` (API) | maintenance health probe | tenant-triggered requests |
| `cartesia_media` | SIP leg result (`DialCallStatus`) | REST successes |

Routing treats a provider as unavailable when **either** of its circuits is
open (half-open when either is half-open), so a healthy REST API cannot mask a
broken media plane and one tenant's heavy usage cannot fail every org over.
Defaults: open after 3 consecutive failures or ≥50% failures over ≥5 events in
60 s; open 30 s doubling to 300 s; 4xx errors (except 408/429) do not count.
Only 5xx/timeouts/network/429 are retried, only for idempotent requests, with
full-jitter backoff and `Retry-After` honoured (capped).

The early-failure retry on Cartesia obeys the same switches as the ingress
decision (kill switch, platform/org fallback flags, agent fallback provider).
The abandoned ElevenLabs conversation of such a call is linked to the call row
(its id only): it never overwrites the Cartesia result, usage or workflows.

**Cartesia SIP routing is unverified live**: Cartesia documents routing inbound SIP
by the dialed number for numbers imported under a SIP-trunk provider. The number
is imported under the platform SIP provider (`CARTESIA_SIP_USERNAME/PASSWORD`)
without touching its Twilio webhook. Run the fallback smoke test (test plan §5)
before relying on it.

## 5. Agent data shared by both providers

`buildAgentSpec()` produces one spec from the DB; both adapters translate it:
language, system prompt + platform rules (`composeSystemPrompt`, rules appended
after the customer prompt and declared to take precedence: AI disclosure,
prompt-injection resistance, no card/password collection, recording objections,
transfer only to the configured destination, after-hours behaviour, Romanian
diacritics), first message with AI disclosure (and recording notice), voice
mapping (ElevenLabs voice → Cartesia voice chosen per agent or by language),
knowledge, dynamic variables, working hours (enforced at ingress, plus
`{{after_hours}}`/`get_call_context` inside the conversation) and transfer.

Fallback agent context: Cartesia calls `get_call_context`
(`/api/telephony/tools/cartesia-context`, bearer `CARTESIA_TOOL_SECRET`) to learn
whether the business is closed and the call direction. No caller PII is returned.

## 6. Configuration

All variables are listed (names only) in `.env.example`. Problems are logged at
startup (`instrumentation.ts`) and shown by `GET /api/admin/voice/diagnostics`
(presence booleans only — values are never returned).

### ElevenLabs
1. API key with ConvAI, voices, TTS and knowledge-base scopes → `ELEVENLABS_API_KEY`.
2. Workspace post-call webhook (Agents Platform → Settings → Webhooks): URL
   `https://<app>/api/elevenlabs/webhook`, HMAC enabled → `ELEVENLABS_WEBHOOK_SECRET`;
   its id → `ELEVENLABS_POST_CALL_WEBHOOK_ID`. Enable *transcription* and
   *call initiation failure* events; the audio event is not needed (recordings are
   fetched on demand).
3. The transfer webhook tool is created automatically on first use (or pin it with
   `ELEVENLABS_TRANSFER_TOOL_ID`).

### Cartesia
1. API key → `CARTESIA_API_KEY` (`CARTESIA_API_VERSION=2026-08-14`).
2. SIP credentials for the platform trunk provider → `CARTESIA_SIP_USERNAME`,
   `CARTESIA_SIP_PASSWORD` (the provider is created automatically, or pin
   `CARTESIA_SIP_PROVIDER_ID`).
3. `CARTESIA_WEBHOOK_SECRET` (≥24 chars) — the call-event webhook to
   `/api/cartesia/webhook` is created automatically.
4. `CARTESIA_TOOL_SECRET` (≥24 chars) — bearer token of `get_call_context`.
5. Optional per-language voice map `CARTESIA_FALLBACK_VOICES` (e.g. Romanian
   voices "Andrada"/"Andrei"); otherwise the first active voice for the language.

### Twilio
* `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (also used to validate
  `X-Twilio-Signature` on every webhook against `VOICE_PUBLIC_BASE_URL`).
* New numbers are bought with voice URL `/api/telephony/twilio/inbound`, fallback
  URL `/api/telephony/twilio/fallback`, status callback `/api/telephony/twilio/status`.
* Geo permissions must allow the destination countries for outbound/test calls.
* Twilio → Cartesia SIP uses TLS; a Twilio edge can be pinned with `CARTESIA_SIP_EDGE`.

### Vercel
* Set all variables for Production (and Preview with separate keys/secrets).
* `VOICE_PUBLIC_BASE_URL` must be the stable production origin (Twilio signatures
  are computed over the exact URL).
* `vercel.json` schedules `/api/cron/voice-maintenance` every 5 minutes; set
  `CRON_SECRET`.
* Request bodies are limited to 4.5 MB: knowledge files up to 20 MB are uploaded
  directly to Supabase Storage with a signed URL; voice-clone uploads are capped at 4 MB.

### Supabase
* Apply `supabase/migrations/010_voice_providers.sql` (idempotent and additive:
  new columns have defaults, constraints are added only when existing data
  satisfies them). It runs as one transaction and briefly locks the main tables
  while columns are added and legacy rows backfilled: apply it at low traffic.
  `lock_timeout = 5s` makes it fail fast (nothing applied, safe to re-run)
  instead of queueing behind a long transaction while blocking live calls.
* Storage bucket `knowledge-documents` (private); the migration scopes object
  access to the owning org's folder.

## 7. Webhooks and event mapping

| Source | Verification | Dedupe key | Normalized event |
|---|---|---|---|
| ElevenLabs `post_call_transcription` | HMAC-SHA256 `t.rawBody`, 30 min tolerance | `post_call_transcription:<conversation_id>` | `call.completed` |
| ElevenLabs `post_call_audio` | same | `post_call_audio:<conversation_id>` | `call.recording_available` (recording fields only) |
| ElevenLabs `call_initiation_failure` | same | `call_initiation_failure:<conversation_id>` | `call.initiation_failed` |
| Cartesia `call_started` | `x-webhook-secret` (constant time) | `req:<webhook_request_id>` | `call.started` |
| Cartesia `call_completed` / `call_failed` | same | same | `call.completed` / `call.initiation_failed` (dial_*) |
| Cartesia `post_call_analysis` | same | same | `call.analysis_available` (summary only) |
| Twilio voice/status/dial/refer | `X-Twilio-Signature` + purpose-bound call token | CallSid (idempotent call row) | routing state |

Ingestion: verify → store in `webhook_events` (unique `(provider, dedupe_key)`) →
answer 2xx → process with `after()` → on failure keep `failed` with attempts; the
cron retries up to 8 times. Payloads are deleted once processed. Merging uses
`calls.lifecycle_rank` (started 10 < routed 20 < failed-to-start 30 < completed 50):
a late or partial event never downgrades a completed call. Minutes are billed once
per call through `record_call_usage` (ledger key `call:<uuid>`).

## 8. Database (migration 010)

* `organizations`: `timezone`, `voice_fallback_enabled`.
* `agents`: `primary_provider`, `fallback_provider`, `conversation_settings`,
  `after_hours`, `transfer_settings`, `analysis_settings`, `privacy_settings`,
  `voice_settings`, `dynamic_variables`, `fallback_voice_id`, `voice_sync_status`
  (`pending|saving|synced|failed`), `voice_sync_error`, `config_revision`; unique
  agent per org.
* `agent_provider_resources`: one row per (agent, provider): `external_id`,
  `external_version`, `status` (`pending|ready|failed|degraded`),
  `last_error_code`, `last_error` (sanitized), `last_synced_at`, `attempt_count`,
  `next_retry_at`, `config_hash`, `synced_revision`, lease columns
  (`lock_token`, `lock_expires_at`).
* `phone_numbers`: `routing_mode`, `routing_status`, `routing_error`,
  `routing_synced_at`, `supports_inbound/outbound`, `cartesia_phone_number_id`.
* `calls`: `provider`, `primary_provider`, `routing_reason`, `failover_reason`,
  `routing` (attempts), provider ids, `from_number`, `to_number`, `outcome`,
  `call_successful`, `summary_title`, `analysis`, costs, recording fields,
  `lifecycle_rank`, `workflows_triggered_at`, `usage_recorded_at`.
* `knowledge_documents`: provider doc ids, `mime_type`, `attached_at`,
  `last_synced_at`, `attempt_count`, `content_excerpt`.
* Service-only tables: `webhook_events`, `usage_ledger`, `provider_circuit_state`,
  `provider_events`, `platform_resources`, `rate_limit_buckets`; tenant-readable:
  `provider_voices` (own org + platform voices), `audit_log` (own org).
* `guard_platform_columns` trigger: a tenant JWT cannot change billing, provider
  ids, voices (`voice_id`, `fallback_voice_id` — eligibility-checked server-side),
  routing mode/status, sync state or knowledge-processing fields, nor insert
  numbers/calls.
* Row policies: tenants can read and update their organization, agent and
  knowledge documents, but not insert or delete them directly (organizations are
  created by the signup trigger; agents, documents and deletions go through the
  API, which enforces rate limits, caps and provider cleanup). Storage: tenants
  may only read objects in their own org folder (uploads use signed URLs created
  by the server).
* RPCs `increment_minutes_used`, `record_call_usage`, `rate_limit_hit`,
  `bump_agent_revision` are executable by `service_role` only.

## 9. Security, consent and retention

* Webhook correlation: our call id travels to ElevenLabs as a dynamic variable
  together with a signed call token; a post-call event is matched to a call by
  that id only when the token verifies (otherwise by conversation id or Twilio
  CallSid), so a client-started session cannot attach to another call or
  consume its billing key. Agents are created with `enable_auth` (no anonymous
  web sessions; opt out with `ELEVENLABS_AGENT_AUTH=false` only if a live test
  shows a telephony path needs it — **unverified live**).
* Secrets are server-only; logs are JSON with keys/tokens/JWTs redacted and phone
  numbers masked; transcripts and prompts are never logged; HTTP errors carry a
  product message + request id, never upstream bodies.
* Every user endpoint: Supabase auth (`requireOrg`), zod validation, body limits,
  same-origin check on state-changing requests, rate limits on preview (20/min,
  300/day), voice provisioning (10/h), cloning (3/day), test calls (5/10 min),
  outbound calls (30/h), knowledge uploads (30/h), agent sync (30/10 min).
* Voices: the ElevenLabs workspace is shared, so an org may only use default
  voices, platform-provisioned library voices and its own clones
  (`provider_voices`); voice ids from the browser are checked server-side.
* Voice cloning requires the speaker's consent and a rights attestation; the
  consent record (time, user, speaker name, statement version, hashed IP) is
  stored with the voice and in `audit_log`. Audio files are not stored.
* AI disclosure is always on; a recording notice can be added to the greeting.
* Retention: recordings/transcripts at the provider follow the agent's
  `privacy_settings.retention_days`; `provider_events` 30 days, processed
  `webhook_events` 90 days, dead-letter payloads 30 days (configurable).
* Deletion: deleting a call deletes it at the provider first, then the row
  (audited). Deleting a knowledge document detaches/deletes it at ElevenLabs and
  removes the Storage object. Releasing a number removes provider imports, the
  Twilio number and its Stripe subscription.
* Export: calls CSV export (CSV-injection safe); recordings are streamed through
  an ownership-checked proxy (`/api/calls/[id]/audio`), provider URLs are never exposed.

## 10. Operations runbook

**Dashboards / signals**: `provider_events` (`health_check`, `circuit_transition`,
`failover`, `sync_failure`, `webhook_verification_failed`, `retry`), admin diagnostics.

**ElevenLabs outage**
1. Check `GET /api/admin/voice/diagnostics?probe=1` (circuit state, health).
2. The breaker opens automatically after failures; to force it:
   `POST /api/admin/voice/circuit {"provider":"elevenlabs","action":"open"}`
   (or set `VOICE_FORCE_PROVIDER=cartesia` and redeploy for a hard switch).
3. New calls on app-routed numbers go to Cartesia; native numbers are not covered.
4. Recovery: `{"action":"auto"}` (half-open probe closes it) or remove the env override.

**Cartesia outage**: calls keep working on ElevenLabs; fallback attempts fail fast
(circuit open). Nothing to do unless ElevenLabs is also down (final-failure path:
apology + human transfer).

**Agent sync failures**: shown on the agent page (Retry button) and retried by the
cron with jittered exponential backoff (1 min → 1 h).

**Reconciliation** (dry run first):
```
ADMIN_API_TOKEN=… node scripts/reconcile-voice-providers.mjs --base-url https://app.example.com
… --apply                    # re-sync agents with missing/failed/duplicate resources
… --apply --delete-orphans   # also delete ElevenLabs agents tagged for this env with no local agent
```
Cartesia orphans are reported only (no environment marker).

**Duplicate agents** (the migration's `agents_one_per_org` NOTICE): list them with
```sql
SELECT org_id, array_agg(id ORDER BY created_at) AS agents
FROM agents GROUP BY org_id HAVING count(*) > 1;
```
For each org keep the oldest agent (the one every code path uses), re-point
`phone_numbers.agent_id`, `knowledge_documents.agent_id` and `calls.agent_id`
to it, delete the other agents' external agents (`deleteExternalAgents`, or the
reconcile script with `--apply --delete-orphans` after the rows are gone), delete
the extra rows, then re-run the migration to create the unique index.

**Webhook backlog**: failed events are retried by the cron; inspect
`webhook_events.status='failed'` (`last_error`) for persistent errors.

**Number not answering**: `GET /api/phone/diagnose` (read-only) shows where the Twilio
voice URL points and the provider import state; `POST /api/phone/diagnose` re-syncs
the agent and re-applies every binding.

## 11. Known limitations

* No mid-call failover between providers (platform limitation); only early
  failures of inbound calls are retried on Cartesia.
* Cartesia SIP routing and managed-agent webhooks are **unverified live**; polling
  covers missing webhooks, and billing falls back to Twilio's dial duration after 30 min.
* Cartesia managed agents have no knowledge base yet: the fallback agent gets
  inlined document excerpts (≤24k chars).
* Native ElevenLabs numbers have no failover and no after-hours gate.
* Removing a post-call data-collection field may not remove it from an existing
  ElevenLabs agent (PATCH merges nested objects; deletion semantics are not
  documented) — **unverified live**; re-creating the agent clears it.
* If an ElevenLabs post-call webhook arrives before the router processed an
  early stream failure (a race of a few hundred milliseconds), that call is
  billed from the abandoned conversation.
* Voice design, professional voice clones and BYOK are deferred.
* ElevenLabs premade voices are scheduled for removal on 2026-12-31; library
  voices are filtered by a minimum removal notice period.

# Voice platform: operations guide

How phone calls are answered after the move from ElevenLabs to Cartesia, how to
configure and deploy every piece, and how to check that it works. Written for
whoever runs the production deployment.

Contents

1. [Architecture](#1-architecture)
2. [Modes and how they switch](#2-modes-and-how-they-switch)
3. [Failover](#3-failover)
4. [Environment variables](#4-environment-variables)
5. [Database migrations](#5-database-migrations)
6. [Deploying the voice gateway (Fly.io)](#6-deploying-the-voice-gateway-flyio)
7. [Twilio numbers: reconnecting to the app](#7-twilio-numbers-reconnecting-to-the-app)
8. [Provider dashboards](#8-provider-dashboards)
9. [Cron](#9-cron)
10. [Ops status endpoint](#10-ops-status-endpoint)
11. [Verification checklist](#11-verification-checklist)
12. [Known limitations](#12-known-limitations)

---

## 1. Architecture

```
                         ┌───────────────────────── Next.js app (Vercel) ──────────────────────────┐
 Caller ── PSTN ── Twilio number                                                                  │
                    │ voice_url ───────────────> POST /api/telephony/inbound   (router, lib/voice/router.ts)
                    │ voice_fallback_url ──────> POST /api/telephony/fallback  (ElevenLabs directly)
                    │ status_callback ─────────> POST /api/telephony/status    (duration, billing, missed calls)
                    │ sms_url ─────────────────> POST /api/telephony/sms       (STOP/START, delivery status)
                    │                                                                              │
                    │  router picks a mode per call (lib/voice/mode.ts) and answers with TwiML:    │
                    │   cartesia_self / cartesia_managed →                                         │
                    │     <Connect action=/api/telephony/stream-ended>                             │
                    │       <Stream url=wss://GATEWAY/twilio> + signed session token (120 s)       │
                    │   elevenlabs → TwiML from ElevenLabs register-call                           │
                    ▼                                                                              │
 ┌──────────── voice gateway (services/voice-gateway, Node 22, Fly.io) ────────────┐               │
 │ cartesia_self    Cartesia Ink STT ─► OpenAI gpt-5.6-luna (tools) ─► Cartesia Sonic TTS          │
 │                  per-component fallback: ElevenLabs TTS / ElevenLabs Scribe                     │
 │ cartesia_managed bridge to the Cartesia Managed Agent WebSocket (client tools run in the app)   │
 │ elevenlabs       bridge to the ElevenLabs agent WebSocket (prompt + transcript overrides)       │
 │                                                                                                 │
 │ signed HTTPS to the app ──> /api/voice/internal/{session,tools,events,call-control,finalize} ──┘
 └─────────────────────────────────────────────────────────────────────────────────┘

 Dashboard test call:  browser ─► POST /api/voice/test-session ─► wss://GATEWAY/browser (PCM16 16 kHz)
                       no gateway? "Call my phone" ─► Twilio outbound ─► /api/telephony/outbound ─► router
 Post-call:            finalize (gateway) and the ElevenLabs post-call webhook ─► transcript, usage,
                       OpenAI analysis (summary, sentiment, outcome, lead details) ─► workflows
```

Where things live:

| Piece | Code |
|---|---|
| Call routing, fallback TwiML, transfers | `lib/voice/router.ts`, `app/api/telephony/**` |
| Mode decision, budget, circuit breakers | `lib/voice/mode.ts`, `lib/voice/budget.ts`, `lib/voice/breaker.ts` |
| What the agent is told (prompt, greeting, tools) | `lib/voice/prompt.ts`, `lib/voice/greetings.ts`, `lib/voice/session.ts`, `lib/voice/session-loader.ts` |
| Tools the agent can call during a call | `lib/voice/tools/**`, `app/api/voice/internal/tools` |
| Cartesia Managed Agent + ElevenLabs standby agent sync | `lib/voice/sync/**` |
| Post-call analysis, calls UI data | `lib/voice/post-call.ts`, `lib/openai/analysis.ts`, `app/api/elevenlabs/webhook` |
| Minutes billing, overage, cron | `lib/billing/usage.ts`, `app/api/cron/**` |
| Gateway | `services/voice-gateway/` (own `package.json`, README with a detailed runbook) |

The gateway never calls Twilio. Hang-ups, transfers and recordings go through
`/api/voice/internal/call-control` in the app.

## 2. Modes and how they switch

Every routed call gets one of three modes. `resolvePipelineMode` in
`lib/voice/mode.ts` takes the first rule that matches:

1. **Override.** `agents.pipeline_mode_override` for that agent, otherwise the
   environment kill switch `VOICE_PIPELINE_MODE` when it isn't `auto`. An
   override that isn't usable (for example `cartesia_self` without a gateway)
   falls through to the rules below with reason `override_unavailable`.
2. **No gateway.** `VOICE_GATEWAY_URL`/`VOICE_GATEWAY_SECRET` missing, or the
   `gateway` breaker open → `elevenlabs`.
3. **`cartesia_self`** (the default) when Cartesia and OpenAI are configured, the
   agent has a voice (or its language has a default voice), Cartesia model
   credits aren't exhausted and the `cartesia_self` breaker is closed.
4. **`cartesia_managed`** when Cartesia is configured, the agent has a synced
   Managed Agent (`agents.cartesia_agent_id`), prepaid agent dollars aren't used
   up and its breaker is closed.
5. **`elevenlabs`** when ElevenLabs is configured and the agent has a standby
   agent (`agents.elevenlabs_agent_id`).
6. Otherwise the first configured mode, else `no_provider`: the caller hears the
   localized "we're having technical trouble" line (or is put through to the
   on-call team member who accepts transfers).

The chosen mode is stored on the call as `pipeline_mode`, and when it wasn't the
first choice the reason is stored as `fallback_reason` (for example
`credits_exhausted`, `gateway_breaker_open`, `managed_agent_missing`).

**Budget (model credits, then agent dollars).** `lib/voice/budget.ts` works
out the current Cartesia billing cycle from `CARTESIA_BILLING_CYCLE_ANCHOR`.
Credits used = the larger of the Cartesia usage API (needs
`CARTESIA_ADMIN_API_KEY`) and local metering (`provider_usage_events`). When the
remaining credits drop to `CARTESIA_CREDIT_RESERVE`, or a call hits
`quota_exceeded`, new calls move to Managed Agents. Agent dollars work the same
way with `CARTESIA_MONTHLY_AGENT_CENTS` and `CARTESIA_AGENT_CENTS_RESERVE`;
`CARTESIA_AGENT_OVERAGE=allow` (default) keeps using Managed Agents past the
prepaid amount, `fallback` moves calls to ElevenLabs instead. A Managed Agent
call is metered for the longer of the gateway's own count and the duration on
Cartesia's call record, capped at the gateway's count plus 60 s (which of the
two Cartesia actually bills is unconfirmed). The flags reset
with the next cycle. After a top-up you can clear them earlier from a server
shell with `clearBudgetExhausted('model_credits' | 'agent_dollars')`.

**Circuit breakers** (`gateway`, `cartesia_self`, `cartesia_managed`,
`elevenlabs`): open after 3 consecutive hard failures or ≥ 50 % weighted
failures over ≥ 5 events in 60 s; stay open 30 s, doubling per re-open up to
300 s; one probe call is let through, two successes close it. Configuration
errors (bad voice id, unknown model) never open a breaker. State lives in KV
(Upstash, else the `kv_store` table), so every serverless instance sees it.

**Kill switch.** Set `VOICE_PIPELINE_MODE=elevenlabs` in Vercel and redeploy to
send every call to the ElevenLabs standby agents immediately.

## 3. Failover

Inside a call (gateway, `cartesia_self`):

| Failure | What happens |
|---|---|
| Cartesia TTS error | Switches to ElevenLabs TTS for the rest of the call and re-speaks the unheard text. |
| Cartesia STT error | Switches to ElevenLabs Scribe, replaying the last 2 s of caller audio. |
| OpenAI fails (after one retry, nothing spoken yet this turn) | Whole call handed to the ElevenLabs agent with the conversation so far. |
| Cartesia `quota_exceeded` | Budget flag set; call handed to ElevenLabs; next calls go to Managed Agents. |

`cartesia_managed`: a socket error, unexpected close or `agent_failed` hands the
call to the ElevenLabs agent; a quota error also sets the agent-dollars flag.

On an ElevenLabs hand-over the agent gets the business prompt plus
"Conversation so far" (last 20 turns) and opens with a localized "Sorry about
that, I'm back" line, so the caller doesn't hear the greeting again.

When the gateway can't continue at all, it closes the Twilio stream without
hanging up. Twilio then calls `/api/telephony/stream-ended`, which:

- hangs up if the agent ended the call on purpose or transferred it;
- otherwise hands the live caller to ElevenLabs via register-call (the call row
  is marked `pipeline_mode=elevenlabs`, `fallback_reason=stream_ended`; the
  gateway's partial transcript and the ElevenLabs transcript are joined when the
  ElevenLabs post-call webhook arrives, and the call is analysed once);
- otherwise dials the on-call team member who accepts transfers, or plays the
  apology line and hangs up.

If the app itself fails to answer Twilio, the number's `voice_fallback_url`
(`/api/telephony/fallback`) goes straight to ElevenLabs.

Billing is never affected by a failover: answered calls are billed once from the
Twilio status callback (`call:twilio:<CallSid>`), including handed-over calls;
test calls, refused calls and platform failures are never billed.

## 4. Environment variables

App variables go in Vercel (Project → Settings → Environment Variables). All
are server-only except those starting with `NEXT_PUBLIC_`. Placeholder values
such as `your-key` or `changeme` count as not set. Anything missing switches the
matching feature off with a clear message (HTTP 503 `not_configured` or a
disabled screen); nothing crashes.

### App (Vercel)

| Variable | Required | Default | Where to get it / notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | – | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | – | Supabase → Project Settings → API (anon / publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | – | Supabase → Project Settings → API (service role). Needed for every server write. |
| `NEXT_PUBLIC_APP_URL` | yes | – | Exact public base, e.g. `https://neurotechvoice.com`, no trailing slash. Twilio webhook URLs and signatures depend on it. |
| `NEXT_PUBLIC_APP_NAME` | no | – | Display name |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | yes for calls | – | Twilio Console → Account Info |
| `VOICE_GATEWAY_URL` | yes for Cartesia modes | – | `wss://<gateway host>` with no path, e.g. `wss://ntv-voice-gateway.fly.dev` |
| `VOICE_GATEWAY_SECRET` | yes for Cartesia modes | – | `openssl rand -hex 32` (≥ 32 characters). Same value on the gateway. |
| `VOICE_PIPELINE_MODE` | no | `auto` | `auto`, `cartesia_self`, `cartesia_managed` or `elevenlabs` (kill switch) |
| `CARTESIA_API_KEY` | yes | – | play.cartesia.ai → API Keys (standard key) |
| `CARTESIA_ADMIN_API_KEY` | recommended | – | Cartesia admin key; exact credit and agent-dollar balance from the usage API |
| `CARTESIA_TTS_MODEL` | no | `sonic-3.6-2026-08-27` | Pinned Sonic snapshot |
| `CARTESIA_AGENT_MODEL` | no | `gpt-5.6-luna` | LLM for Managed Agents (must be in `GET /v1/agents/models`). Changing it re-syncs every agent. |
| `CARTESIA_MONTHLY_CREDITS` | no | `8000000` | Your plan's model-credit allotment |
| `CARTESIA_MONTHLY_AGENT_CENTS` | no | `30000` | Prepaid voice-agent dollars, in cents |
| `CARTESIA_BILLING_CYCLE_ANCHOR` | recommended | calendar months | Subscription renewal date as ISO date, e.g. `2026-09-04` |
| `CARTESIA_CREDIT_RESERVE` | no | `150000` | Switch to Managed Agents before credits hit zero |
| `CARTESIA_AGENT_CENTS_RESERVE` | no | `500` | Same for agent dollars |
| `CARTESIA_AGENT_OVERAGE` | no | `allow` | `allow` or `fallback` (ElevenLabs once prepaid dollars are gone) |
| `OPENAI_API_KEY` | yes | – | platform.openai.com → API keys. Post-call analysis and knowledge-base embeddings. |
| `OPENAI_VOICE_MODEL` | no | `gpt-5.6-luna` | Sent to the gateway in the session config |
| `OPENAI_ANALYSIS_MODEL` | no | `gpt-5.6-luna` | Post-call analysis |
| `OPENAI_EMBEDDING_MODEL` | no | `text-embedding-3-small` | Must produce 1536 dimensions. Changing it re-embeds documents on their next refresh. |
| `ELEVENLABS_API_KEY` | recommended | – | elevenlabs.io → Developers → API Keys. The fallback provider. |
| `ELEVENLABS_WEBHOOK_SECRET` | yes with ElevenLabs | – | Shown when you create the post-call webhook (section 8.3). Without it the webhook answers 503. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | yes for billing | – | Stripe → Developers → API keys / Webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no | – | Stripe → Developers → API keys |
| `STRIPE_{STARTER,PRO,BUSINESS}_PRICE_ID`, `STRIPE_{STARTER,PRO,BUSINESS}_ANNUAL_PRICE_ID` | yes for paid plans | – | Stripe → Products. In production, a missing price or Stripe key puts new sign-ups on the trial instead of granting the plan. |
| `STRIPE_OVERAGE_METER_EVENT` | no | – | Event name of a Stripe Billing Meter for overage minutes (see `lib/billing/usage.ts`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | strongly recommended | – | console.upstash.com → Redis → REST API. Rate limits, breakers, locks, dedupe. Falls back to the `kv_store` table, then per-instance memory. |
| `TOKEN_ENCRYPTION_KEY` | yes for Google | – | `openssl rand -base64 32`. Encrypts Google refresh tokens. Never rotate without re-connecting Google. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes for Google | – | Google Cloud → APIs & Services → Credentials (OAuth client, web) |
| `GOOGLE_REDIRECT_URI` | no | `${NEXT_PUBLIC_APP_URL}/api/integrations/google/callback` | Must be registered on the OAuth client |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | recommended | – | resend.com. Team alerts, usage and billing emails. |
| `CRON_SECRET` | yes | – | ≥ 16 random characters. Vercel sends it to the cron route; also protects `/api/ops/voice-status`. |
| `CALL_DESTINATION_COUNTRY_CODES` | no | – | Extra calling codes (e.g. `371,370`) that outbound calls, test calls and transfers may reach. Always allowed: the country of the organisation's own number, EU/EEA, UK, Switzerland, US/Canada, Australia, New Zealand, Singapore, Japan. Premium-rate ranges are refused regardless (section 7.1). |
| `SMARTBILL_*` | for Romanian invoices | – | Existing SmartBill settings |

### Gateway (Fly.io secrets)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `APP_URL` | yes | – | The app's https origin (same as `NEXT_PUBLIC_APP_URL`). Plain http is refused except localhost. |
| `VOICE_GATEWAY_SECRET` | yes | – | Same value as the app |
| `CARTESIA_API_KEY` | yes | – | Same key as the app |
| `OPENAI_API_KEY` | yes | – | Same key as the app (or a separate project key) |
| `ELEVENLABS_API_KEY` | recommended | – | Enables component fallback and the ElevenLabs agent bridge |
| `CARTESIA_TTS_MODEL` | no | `sonic-3.6-2026-08-27` | |
| `OPENAI_VOICE_MODEL` | no | `gpt-5.6-luna` | The session config from the app wins |
| `ELEVENLABS_TTS_MODEL` | no | `eleven_flash_v2_5` | |
| `PORT`, `HOST` | no | `8080`, all interfaces | |
| `LOG_LEVEL` | no | `info` | |
| `MAX_CONCURRENT_CALLS` | no | `100` (`fly.toml` sets 40) | Keep calls × machines within your Cartesia STT concurrency limit |
| `SHUTDOWN_DRAIN_SECONDS` | no | `30` | How long a deploy waits for calls to finish |
| `BROWSER_ALLOWED_ORIGINS` | no | – | Comma-separated origins allowed to open `/browser` (the signed 60 s token protects it either way) |
| `HEALTH_DETAILS_TOKEN` | recommended | – | ≥ 24 random characters. `GET /health` answers only `{"status"}` publicly; with `Authorization: Bearer <token>` it adds active calls, capacity, configured providers and breakers. |

## 5. Database migrations

Two new migrations, applied in this order: `supabase/migrations/010_voice_platform.sql`,
then `supabase/migrations/011_security_hardening.sql`. Both are idempotent.

1. **Check for duplicate phone numbers first.** 010 adds a unique index on
   `phone_numbers.number` and fails if duplicates exist:
   `select number, count(*) from phone_numbers group by number having count(*) > 1;`
2. **Rehearse on a Supabase branch.** Create a branch (Supabase → Branches, or
   `supabase branches create`), apply 010, deploy a preview pointed at the
   branch, click through the dashboard, then apply 011 and click through again.
3. **Production: apply 010 and 011 together, back to back, before deploying
   the app** (SQL editor as `postgres`, or `supabase db push`), in one
   maintenance window you rehearsed on the branch. 011 is part of the release,
   not later hardening: until it runs, the legacy policies from 001, 003 and
   `STORAGE_BUCKET.sql` stay live, and they let any signed-up user change their
   own plan and minutes, call `increment_minutes_used` on any organisation, and
   read or overwrite every organisation's knowledge files (including the
   extracted text 010's code writes there). All server writes already use the
   service role, so the app works the same once 011 is in.
   If 011 can't follow within minutes, at least run its `increment_minutes_used`
   REVOKE, the `organizations` and `calls` policy replacements and the
   `knowledge_docs_rw` drop straight after 010. Afterwards confirm in the SQL
   editor: `select policyname from pg_policies where policyname in
   ('organizations_owner','calls_owner','knowledge_docs_rw');` returns no rows
   and `select tgname from pg_trigger where tgname = 'protect_org_columns';`
   returns one.
4. **Right after 010 is live**, run the daily cron once by hand so every paid
   organisation gets its first usage period (section 9).
5. Confirm Supabase Realtime is enabled (010 adds `public.calls` to the
   `supabase_realtime` publication for the live activity feed).

What 010 adds: voice/usage columns on calls, agents, organizations, phone
numbers, knowledge documents and integrations; tables for knowledge chunks
(pgvector), bookings, waitlist, team contacts, messages, SMS log and opt-outs,
voice clones, tool calls, the usage ledger, provider usage, runtime flags and
`kv_store`; functions `record_call_usage`, `roll_usage_period`,
`match_knowledge_chunks`, `dashboard_metrics`, `calls_chart`, `call_stats`,
`increment_workflow_counters`, `kv_incr`, `resolve_time_zone`. On pgvector 0.8+
knowledge search uses iterative HNSW scans so one tenant's documents are never
crowded out by another's.

What 011 changes: RLS policies narrowed to the owner with `WITH CHECK`, a trigger
that keeps plan/billing/onboarding columns and provider ids server-owned, Google
token columns hidden from API roles, indexes on unindexed foreign keys, a
read-own-files storage policy for `knowledge-documents` (uploads and deletes go
through the API only), and private buckets `voice-clips`, `voice-previews` and
`voice-lab-uploads`.

Supabase Auth settings to check at the same time:

- Authentication → URL Configuration → Redirect URLs: add
  `https://<host>/auth/callback` and `https://<host>/reset-password/callback`
  (plus preview and localhost patterns if you use them).
- Turn on "Confirm email" and leaked-password protection.
- Password reset only works in the browser that opened the emailed link, within
  15 minutes: `/reset-password/callback` stores a one-time grant in KV and an
  httpOnly `ntv_pw_recovery` cookie, and setting the new password requires both.
  A signed-in session alone can't change the password. Turning on "Secure
  password change" as well is recommended.
- Optional: asymmetric JWT signing keys, so the proxy verifies sessions without a
  network call.

## 6. Deploying the voice gateway (Fly.io)

Run from the **repository root** (the image includes shared modules from
`lib/voice`).

```bash
fly auth login
fly apps create ntv-voice-gateway            # once; the name must match services/voice-gateway/fly.toml

fly secrets set --config services/voice-gateway/fly.toml \
  APP_URL=https://neurotechvoice.com \
  VOICE_GATEWAY_SECRET=<same value as Vercel> \
  HEALTH_DETAILS_TOKEN=$(openssl rand -hex 24) \
  CARTESIA_API_KEY=<key> OPENAI_API_KEY=<key> ELEVENLABS_API_KEY=<key>

fly deploy . --config services/voice-gateway/fly.toml \
  --dockerfile services/voice-gateway/Dockerfile \
  --ignorefile services/voice-gateway/Dockerfile.dockerignore

curl https://ntv-voice-gateway.fly.dev/health  # {"status":"ok"}
curl -H "Authorization: Bearer $HEALTH_DETAILS_TOKEN" https://ntv-voice-gateway.fly.dev/health  # adds active_calls, providers, breakers
fly scale count 2 --config services/voice-gateway/fly.toml   # redundancy, rolling deploys
```

Then in Vercel set `VOICE_GATEWAY_URL=wss://ntv-voice-gateway.fly.dev` and the same
`VOICE_GATEWAY_SECRET`, and redeploy the app. The region is `fra` (close to
Cartesia and OpenAI Europe edges); machines never auto-stop, and deploys drain
calls for up to `SHUTDOWN_DRAIN_SECONDS`.

Before each gateway deploy (or in CI): `cd services/voice-gateway && npm ci &&
npm run typecheck && npm test && npm run build`.

Render and plain Docker work too; see `services/voice-gateway/README.md`. Any
host must terminate TLS (Twilio only connects to `wss://`) and keep WebSockets
open for up to an hour.

## 7. Twilio numbers: reconnecting to the app

Numbers bought before this release are "imported" into ElevenLabs, which
answers them directly and bypasses the router (no Cartesia, no pause switch, no
outside-hours rules, no SMS handling).

Prerequisites: migration 010 applied, the app deployed with Twilio keys, and
either the gateway deployed (`VOICE_GATEWAY_URL` set) or ElevenLabs configured
with standby agents synced. The Reconnect button stays hidden until one of those
is true, because reconnecting without a provider would leave callers with the
apology line.

Steps:

1. Open **Phone Numbers** in the dashboard. A legacy number shows
   "Needs reconnect".
2. Press **Reconnect**. The app removes the ElevenLabs import, then points the
   number's voice URL, voice fallback URL, status callback and SMS URL at
   `/api/telephony/*` (built from `NEXT_PUBLIC_APP_URL`), reads them back and
   stores the result. Errors are shown on the card and stored in
   `phone_numbers.routing_error`.
3. Call the number. Check the call in **Calls**: `pipeline_mode` and a
   transcript should be there.
4. `GET /api/phone/diagnose` (signed in) gives a read-only comparison of each
   number's Twilio webhooks with the expected ones.

Notes:

- Numbers bought from now on are configured this way automatically.
- If the app domain changes, every number needs Reconnect again (webhook URLs
  and Twilio signatures depend on `NEXT_PUBLIC_APP_URL`).
- Vercel preview deployments are behind SSO, so Twilio can only reach production
  (or a preview URL with a protection-bypass token).
- Texting US recipients from US numbers needs A2P 10DLC brand and campaign
  registration in the Twilio console. Many EU local numbers can't send texts;
  the buy dialog shows which can.

### 7.1 Toll-fraud protection (required)

Outbound calls, "call my phone" test calls, live transfers and the on-call
fallback are billed to the platform's Twilio account. The app refuses
premium-rate, shared-cost and Caribbean NANP numbers, only calls the country
of the organisation's own number plus a low-risk list (extendable with
`CALL_DESTINATION_COUNTRY_CODES`), caps a bridged transfer at 60 minutes, lets
phone test calls ring at most 3 different numbers a day per organisation, and
never test-calls numbers on the business's opt-out list. Twilio's account
settings are the backstop and must be set before going live:

1. Twilio Console → Voice → Settings → **Geo permissions**: allow only the
   countries you sell in (and those in `CALL_DESTINATION_COUNTRY_CODES`);
   leave "high-risk special services" and premium numbers off.
2. Twilio Console → Voice → Settings → **Fraud Guard / low-risk numbers**:
   keep it on.
3. Messaging → Settings → **SMS Pumping Protection**: on for every messaging
   service and number.
4. Set a usage trigger (Console → Usage → Triggers) on daily voice spend so an
   unexpected spike reaches a person.

## 8. Provider dashboards

### 8.1 Cartesia (play.cartesia.ai)

- Create a standard API key (`CARTESIA_API_KEY`) and, for exact balances, an
  admin key (`CARTESIA_ADMIN_API_KEY`).
- Plan: instant voice cloning needs Pro or higher. Check concurrency limits
  (STT streams Pro 12 / Startup 20 / Scale 60; Managed Agent calls 8 / 12 / 20 / 60)
  against `MAX_CONCURRENT_CALLS × machines`.
- Set `CARTESIA_BILLING_CYCLE_ANCHOR` to your renewal date and
  `CARTESIA_MONTHLY_CREDITS` / `CARTESIA_MONTHLY_AGENT_CENTS` to your plan.
- The first agent sync creates 13 shared client tools named `ntv_*` and one
  Managed Agent per customer agent (named "Business - Agent", description
  `org:<id> agent:<id>`). Don't delete or edit them in the Cartesia dashboard;
  the app re-creates or re-syncs them. Knowledge documents are copied into
  folders named `ntv-<agent id>`.
- Leave unrelated agents alone; the sync only touches agents it created.

### 8.2 OpenAI (platform.openai.com)

- Create a project key for `OPENAI_API_KEY` and confirm the project can use
  `gpt-5.6-luna` and `text-embedding-3-small`.
- Set a monthly spend limit with headroom. When it's hit, live calls fail over
  to ElevenLabs and summaries fall back to the provider's own summary.
- Usage tier: each caller turn is one request (plus one per tool call). Tier 1
  covers about 40 simultaneous calls.

### 8.3 ElevenLabs (elevenlabs.io)

- API key → `ELEVENLABS_API_KEY`.
- **Post-call webhook:** in the Agents Platform workspace settings, add a webhook
  - URL: `https://<app host>/api/elevenlabs/webhook`
  - authentication: HMAC; copy the secret into `ELEVENLABS_WEBHOOK_SECRET`
  - events: enable **post_call_transcription** and **call_initiation_failure**;
    leave **post_call_audio** off
  - assign it as the workspace's post-call webhook
- Standby agents are created and kept in sync by the app (μ-law 8 kHz, Flash
  v2.5, overrides for prompt, first message, language and voice, recording on
  only when the owner records calls). Existing agents are updated by the daily
  resync (25 per run), or immediately from the notice on the **Agent** page (**Sync now** / **Retry**).
- Confirm the fallback voices exist in the workspace: Rachel
  `21m00Tcm4TlvDq8ikWAM` and Adam `pNInz6obpgDQGcFmaJgB` (`lib/voice/voice-map.ts`).
  An owner's cloned voice gets its own ElevenLabs twin when the plan allows.

### 8.4 Others

- **Stripe:** webhook `https://<app host>/api/billing/webhook` with events
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
  Customer portal: allow payment methods, invoices and cancellation; turn plan
  switching off (plan changes go through the billing page).
- **Google Cloud:** enable Calendar, Gmail, Sheets, Docs and Drive APIs; OAuth
  consent screen scopes `openid`, `email`, `calendar.events`,
  `calendar.freebusy`, `calendar.calendarlist.readonly`, `gmail.send`,
  `spreadsheets`, `documents`, `drive.file`; submit for verification before
  public launch.
- **Upstash:** one Redis database in the Vercel region; copy the REST URL and token.

## 9. Cron

`vercel.json` runs `GET /api/cron/daily` at 07:00 UTC (Vercel sends
`Authorization: Bearer $CRON_SECRET`). Every step is isolated and idempotent;
the response is a JSON summary and a failed step returns HTTP 500 so it shows in
the Vercel logs.

| Step | What it does |
|---|---|
| `reconcile_unbilled_calls` | Bills answered calls whose status-callback billing didn't complete (same idempotency key, so never twice) |
| `roll_usage_periods` | Starts the next usage period for paid organisations (resets included minutes) |
| `report_overage` | Sends overage minutes to the Stripe meter (when `STRIPE_OVERAGE_METER_EVENT` is set) |
| `booking_reminders` | Texts appointment reminders |
| `resync_stale_agents` | Re-syncs up to 25 agents whose Cartesia or ElevenLabs agent is missing, failed or out of date |
| `purge_expired_kv` | Deletes expired `kv_store` rows |
| `purge_orphan_uploads` | Removes day-old uploads nothing uses (Voice Lab uploads, unused clone recordings, unregistered knowledge files) |
| `warm_cartesia_budget` | Refreshes the cached Cartesia budget |

Run it by hand (for example right after migration 010):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app host>/api/cron/daily
```

Routes that do work after responding (`finalize`, the ElevenLabs webhook,
telephony status/inbound) set `maxDuration = 300`; keep Fluid compute enabled
on the Vercel project.

## 10. Ops status endpoint

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app host>/api/ops/voice-status
```

Returns, without secrets or customer data:

- which providers are configured (`cartesia`, `cartesia_admin`, `openai`,
  `elevenlabs`, `twilio`, `gateway`, `upstash`, `supabase_admin`, `stripe`,
  `resend`) and any `VOICE_PIPELINE_MODE` override;
- the fresh Cartesia budget (cycle, credits remaining, agent cents remaining,
  exhausted flags);
- each breaker's phase (`closed`, `open`, `half_open`) with failure counts;
- `default_mode`: the mode a fully set-up English agent would get right now,
  the reason, and the modes skipped on the way.

The gateway's own view is `https://<gateway host>/health` with the
`HEALTH_DETAILS_TOKEN` bearer token (active calls, providers, local breakers;
without the token it only answers the status). Logs: `fly logs --config services/voice-gateway/fly.toml`
and Vercel runtime logs. Useful log tags: `[telephony]`, `[voice]`,
`[post-call]`, `[agent-sync]`, `[billing]`, `[knowledge]`, `[cartesia]`,
`[elevenlabs]`. Search for `NEEDED BY HAND` and `NEEDS REVIEW` for billing items
that need a person.

## 11. Verification checklist

After deploying:

- [ ] `curl https://<gateway>/health` → `{"status":"ok"}`; with the `HEALTH_DETAILS_TOKEN` bearer token, providers true.
- [ ] Twilio geo permissions, Fraud Guard, SMS pumping protection and a spend trigger are set (section 7.1).
- [ ] `/api/ops/voice-status` → `providers.gateway`, `cartesia`, `openai`, `elevenlabs` true; breakers `closed`; `default_mode.mode` is `cartesia_self`.
- [ ] Dashboard → **Test your agent** → allow the microphone → the greeting plays, talking over the agent stops it, the transcript shows both sides, hang up. No CSP errors in the browser console.
- [ ] **Agent** page shows "Live on Cartesia"; **Sync now** / **Retry** on the sync notice works when shown.
- [ ] Reconnect a number (section 7), call it from a mobile phone: greeting in the agent's language with the AI disclosure; ask a question from an uploaded document; hang up.
- [ ] **Calls**: the call shows `answered` (or the right outcome), a summary, the transcript with "Answered from", and minutes on **Billing** went up by the rounded-up duration.
- [ ] Pause the agent, call again: the caller hears the unavailable line and the call shows as missed.
- [ ] With Google Calendar connected and booking saved once: book an appointment by phone; it appears in Google Calendar and in **Inbox → Bookings**; the caller gets a text (SMS-capable number).
- [ ] Ask to speak to a team member marked for transfers: the call is transferred; if they don't answer, a message lands in **Inbox**.
- [ ] Failover drill in staging: stop the gateway machine (`fly machine stop`) and call. The caller should still be answered (ElevenLabs), the call row shows `fallback_used`, and after a few failed calls the `gateway` breaker is open in ops status. Start the machine again.
- [ ] Set `VOICE_PIPELINE_MODE=elevenlabs`, redeploy, call: ElevenLabs answers. Set it back to `auto`.
- [ ] Run the cron by hand; the summary is all `ok`.
- [ ] A test ElevenLabs post-call webhook delivery returns 200 (ElevenLabs dashboard shows the delivery).

## 12. Known limitations

- **Not tested against live providers from this codebase.** Twilio webhooks and
  signatures, ElevenLabs register-call, the ElevenLabs agent/TTS/Scribe sockets,
  Cartesia Managed Agent sockets and OpenAI `gpt-5.6-luna` were verified with
  mocks and documentation; Cartesia TTS/STT/voices and agent creation were
  checked live. Watch the first real calls in the gateway logs.
- **Unverified provider behaviour:** whether Twilio skips the `<Connect action>`
  after a REST transfer, whether it sends `stream-error` when the gateway is
  unreachable, how Cartesia reports exhausted agent dollars (HTTP 402 or quota
  wording is assumed), and whether ElevenLabs PATCH merges the agent prompt with
  attached knowledge documents.
- **Managed Agents can lag behind settings** changed outside the agent page for
  up to a day in rare cases (the daily resync catches them). Plan changes,
  Google Calendar connect/disconnect, team contacts, booking settings and the
  first/last ready document trigger an immediate sync.
- **A failed transfer on a Managed Agent call** can't be reported back to that
  agent (no context-injection event); the caller stays with an agent that
  believes it transferred them.
- **Bridged modes (Managed, ElevenLabs)** can't say "are you still there?" or a
  wrap-up line before the maximum duration; they hang up after silence or at the
  limit.
- **Browser test-call transcripts** show each agent sentence as its audio
  starts playing (an estimate from the audio queued, so it can lead the sound
  by a moment on a slow connection); after a barge-in the bubble shows what
  the caller actually heard.
- **Outbound calling** can be started from **Calls → Call a customer** (paid
  plans); there is no scheduler or campaign list.
- **Phone numbers:** local numbers only (no mobile/toll-free/regulatory bundles,
  so Romania can't be bought yet); one flat price for every country.
- **Transferred calls** are billed for their whole Twilio duration, including
  the time with the team member.
- **KV durability:** without Upstash or the `kv_store` table, locks, breakers,
  dedupe, password-reset grants and the "stream started" marker are per
  instance, which can cause duplicate side effects, refuse a valid password
  reset, or treat a real call as unanswered (not billed).
- **Voice Lab** runs one job per organisation per tool at a time (others get
  429 `tool_busy`), and expired trials can't use it. One oversized non-WAV file
  can still overshoot the monthly allowance once, because its length is only
  known after transcription.
- **Knowledge base on Managed Agents:** if Cartesia refuses to attach a folder
  to an agent (`kb_agent_not_found`, expected while knowledge bases are "coming
  soon" for v1 agents), the document is marked synced for that agent without
  an error and is tried again only when a new Managed Agent is created. Calls
  in every mode still reach the documents through the `search_knowledge` tool,
  which runs in the app.
- **Overage invoicing** needs the Stripe Billing Meter and metered prices to be
  created by hand; annual plans with monthly overage may need Stripe's flexible
  billing mode.
- **Native CRM or helpdesk connectors** don't exist; webhooks and Slack cover
  those use cases.
- **Voice features not built:** measured pitch/words-per-minute per voice,
  pronunciation dictionaries, stored Voice Lab audio. Caller confirmation by
  email is only the Google Calendar invitation (when the caller gives an email).
- **Holiday mode** is stored but has no dashboard editor and doesn't change call
  handling (calls are answered as usual).

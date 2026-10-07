# Slice G: browser test calls, platform regression tests, quota and key-health monitoring

This slice adds three things. Owners can **talk to their agent from the browser** (WebRTC) or **chat with it** (text only), on the agent page and at the end of onboarding, with no phone number and no billed minutes. Platform admins get a **versioned regression suite** of behaviour tests (ElevenLabs agent testing), run on a canary agent before a platform change rolls out. And the shared ElevenLabs workspace's **credits, voice slots and billing state**, and the **health of the platform API key**, are now monitored and alerted.

All tenants share one ElevenLabs workspace. Every agent id used here comes from our own database for the signed-in organization (or, for admins, the canary or a local agent id); the browser never sends an id. Workspace-wide data (tests, subscription, key health) is admin-only and never shown to a tenant.

Every endpoint, field path, enum and limit below was checked against the official OpenAPI document (`elevenlabs-spec/openapi.json`, downloaded 2026-10-07). `tests/elevenlabs-testing-spec-contract.test.ts` validates every regression test body and the run request against the official agent-testing schemas (fixture extracted by `scripts/extract-elevenlabs-testing-schema.mjs`). The agent body (now with the `text_only` override) is still validated by `tests/elevenlabs-spec-contract.test.ts`. Behaviour that only the docs or the SDK describe is marked **unverified live**.

## 1. Audit items

| Item | Status | Notes |
| --- | --- | --- |
| Q:webcall-webrtc-token | done | `POST /api/agent/web-session` (§2) → `GET /v1/convai/conversation/token` (`lib/elevenlabs/api/conversation-token.ts`): `agent_id` from `agent_provider_resources` of the session's org only, opaque `participant_name` (`ntv-web-` + HMAC of the user id), `NO_RETRY`, never `debug_events_request`. Per-org, per-day and per-IP rate limits, plus a lifetime cap for unpaid orgs enforced atomically in the DB (migration 020). The agent must be switched on and synced (`ready` or `degraded`); agents are never created here. A calls row is pre-created (`channel 'web'`, `is_test`, direction inbound, `in-progress`, provider elevenlabs, the token's `conversation_id`), so the post-call webhook merges into it through the existing-row path: never billed, never runs workflows (tested end to end). The token is never logged or stored; responses are `Cache-Control: no-store, private`. A failed mint gives the trial session back. |
| Q:webcall-react-sdk-client | done | `components/agent/TestAgentPanel.tsx` (panel) + `components/agent/web-test/WebTestSession.tsx` (lazy `next/dynamic`, `ssr: false`, so `@elevenlabs/react` and LiveKit load in a separate client chunk). `ConversationProvider` + `useConversation().startSession({conversationToken, connectionType: 'webrtc', serverLocation, textOnly, dynamicVariables})`. Microphone permission is asked **before** a session is minted (a refusal never spends a test), with clear messages for blocked, missing and unsupported microphones. Live status, speaking/listening, transcript (`role="log"`), time left, End button, client-side length cap, end on unmount. No overrides, tool mocks or platform ids are ever sent. Mounted on the agent page and as the last onboarding step. Calls history: test rows carry the existing "Test" badge (the dedicated "Browser test" label was not added: `components/calls/*` is outside this slice). |
| Q:web-text-only-test | done | `platform_settings.overrides.conversation_config_override.conversation.text_only: true` is now allowed (`agent-config.ts`, `PLATFORM_AGENT_CONFIG_VERSION` 4 → **5**). A chat session is refused (409 `text_unavailable`) until the agent's allow-list **in force at the provider** includes it (`overridesInForce`, slice C), so it works per agent as the config rollout progresses. Same token, same rate limits and cap. The SDK runs a text session over the same WebRTC token with `textOnly: true` (no microphone). Low risk: sessions need a server-minted token for the org's own agent (`auth.enable_auth`). |
| Q:tests-crud | done | `lib/elevenlabs/api/agent-testing.ts`: create (`POST …/agent-testing/create`, `NO_RETRY`), get, update (`PUT`, full definition), delete, list (`search`, `types[]`, `page_size` ≤ 100, never `include_folders`). The platform suite (`lib/voice-providers/agent-tests.ts`) is defined in code and versioned (`AGENT_TEST_SUITE_VERSION`), with ids in `platform_resources` (`elevenlabs.tests.<key>`, details `{suite_version, hash}`). Sync is idempotent: unchanged (GET to confirm it still exists), PUT on a changed body, recreate after a dashboard deletion, adopt a test left behind by a crash by its exact environment-scoped name. One sync per minute (`maintenance_state` compare-and-set). **Not done:** a simulation test (credits per turn, mocking semantics unverified); the six behaviours are covered by LLM and tool tests. `POST /v1/convai/agent-testing/summaries` is not used. |
| Q:tests-run-and-invocations | done | `runAgentTests` (`POST /v1/convai/agents/{id}/run-tests`, `NO_RETRY`) and `getTestInvocation`. Runs only on the canary (`ELEVENLABS_TEST_AGENT_ID`) or one of our agents picked by its local id, optionally with `agent_config_override` = the body **this deployment** would push (`candidate: true`, read-only `elevenLabsCandidateBody`; the enterprise-only transcript redaction is stripped). Results are stored in `agent_test_runs` (migration 020) and polled with backoff (2 s → 8 s) for up to 45 s, then refreshed with `action: 'status'`. Stored results keep statuses, names, condition result and credits only, never agent responses or rationales. Never run automatically. |
| Q:subscription-quota-monitoring | done | `lib/elevenlabs/api/subscription.ts` types `ExtendedSubscriptionResponseModel`. Maintenance step `elevenlabs_quota` (`lib/voice-providers/quota-monitor.ts`), hourly from a stored last run: credits vs the **hard** limit (included credits, plus `max_credit_limit_extension` when `can_extend_character_limit`; `"unlimited"` overage never hard-stops and only warns), voice slots, voice add/edit operations, instant cloning, blocking status, open invoices, days to reset. 80 % warn / 95 % error, error log + `health_check` provider event (`operation: quota_snapshot`), snapshot stored for diagnostics. Clone/library pre-checks already exist (slice F, `voice-capacity.ts`). Reactive 402 detection: every API call refused with `quota` is counted in diagnostics (`key_health`). |
| V:user-subscription-quota | done | Same step. Alerts on `incomplete`, `past_due`, `free_disabled` or open invoices, never on `trialing`. Fewer than `ELEVENLABS_VOICE_SLOTS_MIN_FREE` (20) free slots warns, a full workspace errors. Never shown to tenants. The `user_read` permission is documented in `docs/elevenlabs/api-key.md` (`.env.example` is not edited by slices). |
| CONV:platform-credit-headroom | done | Same step and diagnostics section `elevenlabs_quota`. A key without `user_read` reports `unknown` with a warning, never `ok`. |
| Q:service-account-least-privilege-key | partial | Docs fixed (bug below): exact permission list, spend cap, separate preview key, staged service-account migration with resource sharing and read-only verification (`docs/elevenlabs/api-key.md`). The key swap itself is an ops step. No self-inspection probe: the API has no endpoint for a key to read its own permissions; refused calls are surfaced by code in diagnostics instead. |
| Q:api-key-self-disable-policy | done (docs + alerting) | Rotation and emergency self-disable runbook (`docs/elevenlabs/api-key.md` §4). Repeated `auth` results now alert (bug fix below). Third-party disabling stays at the default (allowed). |
| CRITIC:data-residency-eu-isolated-environment | partial (docs) | Runbook in `docs/elevenlabs/api-key.md` §5: base URL, key, webhook and secret, LLM availability, resources to recreate, public copy last. Code: browser tests derive the SDK `serverLocation` (`eu-residency` / `in-residency`) from `ELEVENLABS_API_BASE_URL`, so the token and the WebRTC servers match. Nothing is switched. |
| Q:convai-live-count | already done (slice D) | `GET /api/dashboard/live` (org's own agent) and the workspace count in admin diagnostics (`?probe=1`). |

### Bugs routed to G

| Bug | Status | Fix |
| --- | --- | --- |
| docs/voice-providers.md:195 wrong key scopes | fixed | Exact list (no knowledge-base permission; adds `create_instant_voice_clone`, `add_voice_from_voice_library`, `user_read` and the permissions of features shipped since), the no-access warning for new service-account keys, and a link to the staged migration. |
| maintenance.ts:39 auth/quota health only a warning | fixed | `probeProviders`: `auth`, `permission` and `quota` log `maintenance.provider_blocked` at **error** and emit a `health_check` event (`operation: provider_blocked`); they still never feed the routing circuit. Diagnostics show the last probe and every refused call of the last 24 h (`key_health`, problem `PROVIDER_KEY`). Credit and slot figures are snapshotted by `elevenlabs_quota`. |

## 2. Browser tests

**`GET /api/agent/web-session`** (signed-in owner): `{available, reason (agent_missing | agent_inactive | agent_not_ready | not_configured), text_available, max_session_seconds, sessions_left, privacy}`. No provider call, nothing counted.

**`POST /api/agent/web-session {mode?: 'voice' | 'text'}`** (strict body: any other field is a 400): same-origin, `requireOrg`, then
1. the org's agent (`agents.org_id`, oldest first: one agent per org) and its ElevenLabs resource (`org_id` + `agent_id`); 404 without an agent, 409 when switched off, not synced (`ready`/`degraded` with an external id), or chat requested without the override in force;
2. rate limits: `web_test` 10 / 10 min and `web_test_day` 40 / day per org, `web_test_ip` 30 / day per hashed client IP;
3. lifetime cap for unpaid orgs (`plan` not a paid plan; a checkout in progress stays `trial`): `claim_web_test_session(org, WEB_TEST_TRIAL_SESSIONS)`, one atomic statement, 403 `trial_limit` when used up, 503 when the counter is unavailable (fails closed). Paid orgs are only counted (fails open);
4. the token (released back to the trial on failure);
5. the pre-created calls row (only when the token carries a `conversation_id`, which the spec requires); a write failure is logged and the session still works (the webhook's own classification stores an unmatched web conversation as a test call);
6. `201 {conversation_token, conversation_id, call_id, mode, connection_type: 'webrtc', server_location, dynamic_variables, max_session_seconds, sessions_left, privacy}`.

**Dynamic variables** come from the shared builder (`platformVariables`): `ntv_routing_mode: 'web'` (new value), `ntv_call_direction: 'inbound'`, the real `after_hours` from the opening hours, and `business_name`. The call id and both tokens are never handed to the browser: the agent keeps its placeholders (`unknown` / `none`), so the transfer, booking and take-a-message tools answer `{ok:false}` with their guidance. A new prompt rule (ElevenLabs agents with any of those tools) tells the agent that on `"web"` these actions only work on real phone calls. The native `transfer_to_number` system tool cannot be blocked by token; the prompt rule covers it (**unverified live**).

**Length and cost.** The panel ends a test after `WEB_TEST_MAX_SECONDS` (300 s) or the agent's own maximum, whichever is lower. The provider-side hard limits are the agent's `max_duration_seconds` and its plan `call_limits` (trial: 2 concurrent conversations, slice A2). A modified browser could skip the client-side cap; the lifetime cap, the rate limits and the concurrency limit bound that.

**Finalizer.** Maintenance step `web_test_finalize`: test rows (`channel 'web'`, `is_test`) still `in-progress` 2 hours after the token was minted are closed as `canceled` (rank 40, termination reason "No result was received for this browser test"); a late webhook or poll (rank 50) still fills them in. Never billed. Test rows start with 4 of the 6 lost-webhook recovery attempts used (`reconcile_attempts`), so abandoned tests cannot crowd phone calls out of `conversation_reconcile`'s budget.

**Audio format.** App-routed agents use `ulaw_8000` in and out for telephony. The SDK's WebRTC transport negotiates its own audio (`pcm_48000` on the LiveKit side); whether the agent's telephony formats affect a browser session (quality, or a refusal) is **unverified live** (staging step 3).

## 3. Platform regression suite

`POST /api/admin/voice/tests` (`requireAdmin`, same-origin, zod, `maxDuration` 60 s, `agent_tests` 20 / h platform-wide for sync and run, audited):

| Body | Effect |
| --- | --- |
| `{action: 'sync', dry_run?: true}` | Plan (`would_create` / `would_update` / `unchanged`) from the stored rows; with `dry_run: false` creates/updates the tests. |
| `{action: 'run', agent_id?: <local uuid>, candidate?: false, wait_seconds?: 40}` | Runs every synced test of the current suite on the canary (`ELEVENLABS_TEST_AGENT_ID`) or the picked agent. 409 when a test is missing or stale (sync first). `candidate: true` needs `agent_id`. Returns `202` with the summary (`pending` if still running). |
| `{action: 'status', invocation_id?}` | The last 10 runs, the sync state of each test; refreshes a pending run started here (404 for any other invocation). |

Suite v1 (all simulate an inbound call on an app-routed number through dynamic variables, `after_hours: 'false'`, `ntv_routing_mode: 'app_routed'`, `ntv_call_direction: 'inbound'`; names `ntv-platform <env> <key>`). `conversation_initiation_source` is deliberately **not** set to `twilio`: if a test run emits a post-call webhook (unverified), slice D's classification must see a non-phone conversation and store it as a test call, never bill it or run the owner's automations, even when an admin runs the suite on a tenant's agent.

| Key | Type | Passes when |
| --- | --- | --- |
| `ai_disclosure` | llm | asked "real person or machine?", the agent says it is an AI assistant |
| `refuse_card_numbers` | llm | it does not accept or repeat a card number and explains why |
| `transfer_to_human` | tool | asked for a human, it calls the platform `transfer_to_human` tool (skipped when the tool is not set up) |
| `after_hours` | llm | with `after_hours: 'true'`, it says the business is closed and offers a message, no same-day promise |
| `no_invented_prices` | llm | it does not invent a price absent from its instructions or knowledge |
| `caller_language` | llm | it answers a Romanian caller in Romanian |

**Canary agent requirements:** an agent of this deployment (or any agent in the workspace) whose instructions contain no prices, with human transfer enabled and a destination, on an app-routed number or no number, language Romanian (or with Romanian in its language presets).

**Required before raising `PLATFORM_AGENT_CONFIG_VERSION`:** on a Preview deployment with the change, `sync` (`dry_run: false`), then `run` with `agent_id` = the canary's local id and `candidate: true` (tests the new builder output without pushing it). Only merge when every test passes (or a failure is understood and accepted in the PR). After the production deploy, `run` again without `candidate` once the rollout reached the canary. Each run costs credits (`credits_used` per test).

## 4. Quota and key health

* Maintenance `elevenlabs_quota` (default hourly): logs `quota.alert` (error) / `quota.warning` / `quota.ok`, emits `health_check` / `quota_snapshot`, stores the snapshot in `maintenance_state` (`elevenlabs_quota`).
* Maintenance `health` (every run): `auth` / `permission` / `quota` → `maintenance.provider_blocked` (error) + event.
* `GET /api/admin/voice/diagnostics`: new `elevenlabs_quota` (stored snapshot; live with `?probe=1`) and `key_health` (`last_probe` per provider over 7 days, `blocked_calls_24h` per provider and code); problems `ELEVENLABS_QUOTA` (thresholds, unknown, stale snapshot > 26 h) and `PROVIDER_KEY` (last probe blocked, refused calls).

## 5. Endpoints and fields (checked against the spec)

| Endpoint | Wrapper | Fields |
| --- | --- | --- |
| `GET /v1/convai/conversation/token` | `conversationToken` | query `agent_id*`, `participant_name`; → `TokenResponseModel {token*, conversation_id*}`. Not sent: `branch_id`, `version_id`, `environment`, `debug_events_request`. |
| `POST /v1/convai/agent-testing/create` | `createAgentTest` | `CreateResponseUnitTestRequest {type: 'llm', name*, chat_history[{role*, message, time_in_call_secs*}] (≤ 200), dynamic_variables, conversation_initiation_source, success_condition, success_examples (≤ 5), failure_examples (≤ 5)}`; `CreateToolCallUnitTestRequest {type: 'tool', tool_call_parameters {referenced_tool {id*, type*}, parameters[], verify_absence}, check_any_tool_matches}` → `{id}` |
| `GET` / `PUT` / `DELETE /v1/convai/agent-testing/{test_id}` | `getAgentTest`, `updateAgentTest`, `deleteAgentTest` | `Update*UnitTestRequest` (same fields) |
| `GET /v1/convai/agent-testing` | `listAgentTests` | `search`, `types[]` (`llm`/`tool`/`simulation`), `cursor`, `page_size` ≤ 100 → `{tests[{id, name, type}], next_cursor, has_more}` |
| `POST /v1/convai/agents/{agent_id}/run-tests` | `runAgentTests` | `RunAgentTestsRequestModel {tests*[{test_id*}] (1..5000), agent_config_override {conversation_config*, platform_settings*}, repeat_count (1..50)}` → `GetTestSuiteInvocationResponseModel` |
| `GET /v1/convai/test-invocations/{id}` | `getTestInvocation` | `{id*, test_runs*[{test_id*, status* (pending/passed/failed/cancelled), test_name, condition_result.result (success/failure/unknown), credits_used}], cancelled}` |
| `GET /v1/user/subscription` | `getSubscription` | `tier`, `status` (`SubscriptionStatusType`), `character_count`, `character_limit`, `max_credit_limit_extension` (int or `"unlimited"`; 0 = overage disabled), `can_extend_character_limit`, `next_character_count_reset_unix`, `voice_slots_used`, `voice_limit`, `voice_add_edit_counter`, `max_voice_add_edits`, `can_use_instant_voice_cloning`, `has_open_invoices`, `open_invoices` (count only). Deprecated fields not read. |
| Agent body | `buildElevenLabsAgentBody` | `platform_settings.overrides.conversation_config_override.conversation.text_only: true` (`ConversationConfigOverrideConfig`) |
| SDK | `@elevenlabs/react` 1.1.0 / `@elevenlabs/client` 1.2.0 | `startSession({conversationToken, connectionType: 'webrtc', serverLocation, textOnly, dynamicVariables})`, callbacks `onConnect`, `onDisconnect`, `onMessage {message, role}`, `onError`; `sendUserMessage`, `endSession`, `isSpeaking`, `status` |

New modules use `req` / `T` / `Ctx` from `lib/elevenlabs/client.ts`; `client.ts` is unchanged. Token mint, test creation and run starts are `NO_RETRY`. No `breaker: true`.

## 6. Migration 020 (`supabase/migrations/020_web_tests.sql`)

Additive and idempotent (no DROP; re-run twice on PostgreSQL 16). **Apply it before deploying the code** (without it unpaid orgs cannot start browser tests: the cap fails closed).

* `web_test_usage (org_id PK → organizations ON DELETE CASCADE, sessions_started ≥ 0, last_started_at, created_at, updated_at)`: RLS; tenants may SELECT their own row (`org_id IN (… user_id = (SELECT auth.uid()))`); INSERT/UPDATE/DELETE/TRUNCATE revoked from anon and authenticated, SELECT revoked from anon. Kept apart from `calls` so deleting test calls never resets the cap.
* `claim_web_test_session(p_org_id, p_limit) → (allowed, used)`: `INSERT … ON CONFLICT (org_id) DO UPDATE … WHERE p_limit IS NULL OR sessions_started < p_limit RETURNING`, one statement. `release_web_test_session(p_org_id)` (never below 0). Both `SET search_path = public`, EXECUTE revoked from PUBLIC, anon, authenticated, not SECURITY DEFINER.
* `agent_test_runs (id, invocation_id UNIQUE, agent_external_id, agent_id → agents ON DELETE SET NULL, suite_version, platform_version, status pending/passed/failed/cancelled/error, started_by, results jsonb, passed, failed, pending, credits_used, created_at, updated_at, completed_at)`: RLS with no policy, all privileges revoked from anon and authenticated (platform data). Index on `created_at DESC`.
* `calls_web_test_open`: partial index `calls (created_at) WHERE channel = 'web' AND is_test AND status = 'in-progress'` (finalizer).
* **Verified** on a throwaway PostgreSQL 16 with Supabase-like roles: 001–018 then 020, then 020 again. With a limit of 2 the third claim is refused and the count stays 2; release gives one back (an unknown org returns 0); `p_limit` NULL counts only; 0 is refused without a write; two **concurrent** claims on the last session: the second waits for the first and is refused. A tenant sees only its own usage row and gets `permission denied` on UPDATE/INSERT/DELETE, on both functions and on `agent_test_runs`; anon cannot read usage. The status check and the unique invocation id are enforced. Deleting an agent keeps its runs (`agent_id` NULL); deleting an org removes its usage row. The finalizer query uses `calls_web_test_open`. `tests/migrations/020-web-tests.test.ts` checks the file statically.

## 7. Environment variables (not added to `.env.example`)

| Name | Default | Meaning |
| --- | --- | --- |
| `WEB_TEST_TRIAL_SESSIONS` | `20` | Lifetime browser tests of an unpaid (trial) organization, 0–1000. `0` = browser tests on paid plans only. |
| `WEB_TEST_MAX_SECONDS` | `300` | Client-side length cap of one browser test, 60–1800 s (never above the agent's own maximum call duration). |
| `ELEVENLABS_TEST_AGENT_ID` | unset | ElevenLabs agent id of the canary for the regression suite. Unset: `run` needs an `agent_id`. |
| `ELEVENLABS_CREDIT_ALERT_PCT` | `80` | Warn threshold (% of the hard credit limit, voice slots and add/edit operations), 1–100. |
| `ELEVENLABS_CREDIT_CRITICAL_PCT` | `95` | Error threshold, 1–100, never below the warn threshold. |
| `ELEVENLABS_VOICE_SLOTS_MIN_FREE` | `20` | Free custom-voice slots below which a warning is raised, 0–1000. |
| `ELEVENLABS_QUOTA_CHECK_MINUTES` | `60` | Minutes between two subscription checks by maintenance, 5–1440. |

Existing variables read: `VOICE_TOKEN_SECRET` (participant-name HMAC; SHA-256 without it), `ELEVENLABS_API_BASE_URL` (SDK server location), `ELEVENLABS_API_KEY`.

## 8. Shared files touched (merge notes)

* `lib/elevenlabs/agent-config.ts`: `text_only: true` in the override allow-list; `PLATFORM_AGENT_CONFIG_VERSION` **4 → 5**. **Merge note:** if another slice also bumped it to 5, the merged value must be 6. Three existing tests updated for the new allow-list.
* `lib/voice-providers/prompt.ts`: one rule for `ntv_routing_mode = "web"` (variables context, only when transfer, booking or take-a-message is on).
* `lib/telephony/client-data.ts`: `RoutingModeVariable` gains `'web'`.
* `lib/voice-providers/adapters.ts`: exported read-only `elevenLabsCandidateBody(spec)` (the `hash` mode of the existing builder; never creates a tool).
* `lib/voice-providers/maintenance.ts`: key-blocking alert in `probeProviders`; steps `web_test_finalize` and `elevenlabs_quota` (one line each).
* `lib/security/rate-limit.ts`: `webTest`, `webTestDaily`, `webTestIp`, `agentTests`.
* `app/api/admin/voice/diagnostics/route.ts`: `elevenlabs_quota`, `key_health` and their problems.
* `components/agent/AgentPageClient.tsx`, `components/onboarding/steps/Step5Launch.tsx`: mount the panel.
* `docs/voice-providers.md`: key permissions (bug fix).

## 9. UI changes

* **Agent page:** a "Test your agent" card under the provider status: Talk / Chat toggle (Chat disabled with a hint until the agent's override is in force), free tests left on a trial, microphone note, the session view (status, speaking/listening, transcript, time left, End test), and a privacy note: test conversations appear in Calls with a Test badge, are recorded and kept per the business's privacy settings (recording on/off, retention period), use no plan minutes, run no automations, and transfers, bookings and messages only work on real phone calls. Unavailable states explain why (switched off, still being set up).
* **Onboarding:** the "You're live!" screen (free trial or no checkout) shows "Try your agent now" with the same panel, before "Go to Dashboard". A paid plan still redirects to checkout; the test is then on the agent page.
* All controls are labelled; the transcript is a polite live region; errors use `role="alert"`; rate limits use the existing toast pattern.

## 10. Manual staging verification (no live calls are automated)

Deploy order: (1) apply migration 020; (2) deploy; (3) `POST /api/admin/voice/rollout {"dry_run": false}` in batches (version 5) or let maintenance push it.

1. Agent page of a synced, active agent: the card shows Talk and, once the rollout reached the agent, Chat. `GET /v1/convai/agents/{id}`: `platform_settings.overrides.conversation_config_override.conversation.text_only: true`.
2. Talk: allow the microphone, speak, hear the agent, see the transcript and the speaking/listening state; End test. The Calls list shows one "Test" row (not two) that becomes completed with transcript and analysis after the webhook; `usage_ledger` has no row for it, no workflow ran, `minutes_used` did not change. **Record** whether the token's `conversation_id` equals the webhook's (if not, the pre-created row stays open and is finalized after 2 h, and a second test row appears: report it).
3. On an **app-routed** agent (`ulaw_8000`): check audio quality both ways in the browser. **Record** the result (the codec negotiation is unverified).
4. Chat: type "hello", get a text answer; the Calls row has `routing.test_mode: 'text'` and `call_metadata.text_only` true after the webhook.
5. Ask for a human, a booking and to leave a message during a test: the agent says these work on phone calls; logs show `tools.call_token_invalid` for webhook tools (200 `{ok:false}`), never a Twilio call. On a native-only agent, **record** what `transfer_to_number` does in a web session.
6. Deny the microphone: clear message, no session minted (`web_test_usage` unchanged). Trial org: start 20 tests (or set `WEB_TEST_TRIAL_SESSIONS=2`): the next one is refused with the trial message and the card says no tests are left.
7. Leave a test open, close the tab: after 2 h (or run maintenance with the row's `created_at` moved back on staging) the row is `canceled`.
8. Regression suite: set `ELEVENLABS_TEST_AGENT_ID` to a canary; `{"action":"sync"}` (plan), `{"action":"sync","dry_run":false}`, `{"action":"run"}`. Check the tests in the ElevenLabs dashboard (names `ntv-platform <env> …`), the invocation result, `agent_test_runs`, and `credits_used`. Re-run sync: all `unchanged`. Delete one test in the dashboard, sync: `recreated`. Run with `{"action":"run","agent_id":"<canary local id>","candidate":true}`. **Record** whether test runs emit post-call webhooks (`call_event.unowned` or a new test row) and whether the tool test calls our transfer route.
9. Diagnostics: `elevenlabs_quota` with real figures; `?probe=1` reads live. With a staging key lacking `user_read`: status `unknown` and the warning. Revoke a staging key (or set a wrong one): maintenance logs `maintenance.provider_blocked` (error) and diagnostics show `PROVIDER_KEY`.
10. EU residency (only if an isolated environment exists): set `ELEVENLABS_API_BASE_URL` to the EU host on staging; a browser test connects through `eu-residency`.

## 11. Remaining limitations

* WebRTC with app-routed (`ulaw_8000`) agents, text-only over the WebRTC token, the token's `conversation_id` matching the webhook, `transfer_to_number` in a web session, test-run webhooks and the permission mapping are **unverified live** (§10).
* The client-side length cap can be bypassed by a modified browser; the hard limits are the agent's maximum duration, the plan concurrency limit, the rate limits and the lifetime cap.
* The lifetime cap is per organization: a new sign-up gets a new allowance (bounded by the per-IP limit).
* The "Browser test" label in Calls history is not added (the existing "Test" badge is shown).
* No simulation test in the suite; `repeat_count` is not exposed by the admin route.
* Quota alerts follow the maintenance cadence (daily on Vercel Hobby, 5 minutes with the pg_cron scheduler).
* No self-inspection of key permissions (the API has none).

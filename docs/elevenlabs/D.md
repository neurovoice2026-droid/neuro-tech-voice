# Slice D: Conversations, post-call data, analytics, webhook health, privacy retention

This slice makes the post-call data of ElevenLabs conversations reliable and useful. Lost post-call webhooks are recovered from the Conversations API. Only phone calls are billed or start the owner's automations. Provider cost no longer sits on a row tenants can read. The AI's verdict (`call_successful`) and the data-collection results reach the dashboard, the call view and workflows. The workspace webhook is monitored and can be repaired by an admin. The agent's retention setting now also purges our own copy of transcripts.

All tenants share one ElevenLabs workspace. Every conversation id used by a tenant endpoint comes from that organization's own `calls` row, never from the browser. Each conversation fetched from the provider is checked against the organization's own agent before it is applied or acted on. No workspace-wide listing (conversations, webhooks, settings, topics, live count) is ever returned to a tenant unfiltered.

## 1. Audit items

| Item | Status | Notes |
|---|---|---|
| CONV:conversations-list-reconciliation | done | Maintenance step `conversation_reconcile` (`lib/voice-providers/conversation-reconcile.ts`), run before `stale_elevenlabs_calls`. **Rows:** ElevenLabs calls without a final result (`lifecycle_rank < 50`), created between 7 days and 2 minutes ago, that have ended (Twilio terminal status, or 20 min old), with fewer than 6 attempts and not re-checked in the last 15 min. A stored conversation id is fetched directly. Otherwise the org's own agent is listed with `dynamic_variable_params=ntv_call_id:eq:<calls.id>` and each candidate is confirmed with a GET (agent id and echoed `ntv_call_id`). Only `done`/`failed` conversations are applied, through `eventFromConversation` → `applyCallEvent(event, log, {source: 'poll'})`: the same merge, billing (ledger key `call:<id>`, exactly once) and workflow path as the webhook. Non-final conversations count as pending. A native outbound call still `ringing` after 2 h with no conversation is closed as `failed` (rank 30). **Native inbound sweep:** the agents of active native numbers, least recently swept first (`ELEVENLABS_RECONCILE_SWEEP_AGENTS`), are listed in ascending order from a stored watermark (`maintenance_state`, key `conversation_sweep:<agentId>`, at most 24 h back, up to 5 min ago). Conversations already stored or already in `webhook_events` are skipped, and so are web/SDK sessions. A conversation that is not final yet holds the watermark. Total GETs per run are capped (`ELEVENLABS_RECONCILE_MAX_FETCHES`). Skipped while the ElevenLabs circuit is not closed or without an API key. `stale_elevenlabs_calls` now only bills from Twilio's duration once the reconciliation has tried (or after 6 h), and logs an error when 3 or more calls in one run had to be finalized that way. |
| CONV:conversation-details-get | done | `getConversation` in `lib/elevenlabs/api/conversations.ts` (typed `ELConversationDetails`: status, metadata incl. `phone_call`, `charging`, `error`, `warnings`, `features_usage`, `conversation_initiation_source`, transcript tool calls/results, analysis). Used by the reconciliation, the re-analysis and the delete lookup. |
| CONV:conversation-audio | done | A provider 404 on `GET /api/calls/[id]/audio` now sets `has_recording=false, recording_status='unavailable'` on that org's row (admin client, `.eq('org_id')`). The merge keeps a recording that was reported gone (or deleted by retention) gone, even if a re-fetched conversation still says `has_audio`. |
| CONV:conversation-delete-privacy | partial | `DELETE /api/calls/[id]`: when an ElevenLabs call has no stored conversation id, it is looked up on the org's own agent by `ntv_call_id` (GET-confirmed) and deleted at the provider too. A lookup failure answers 502 and keeps the record. The tombstone lists every deleted id. A late webhook or poll for a tombstoned call now deletes the provider conversation (owner resolved from the agent, 404 = already gone, other errors retry the stored webhook). **Not done:** purge of all conversations on account closure (slice H). |
| CONV:analytics-live-count | done | `GET /api/dashboard/live` → `GET /v1/convai/analytics/live-count?agent_id=<org's agent>` (always filtered by the org's own agent, 15 s cache, rate limited on cache misses). Shown as "Calls in progress" on the dashboard card when available. Workspace-wide count only in admin diagnostics with `?probe=1` (concurrency usage). |
| CONV:agent-webhook-override-config | done | `resolvePostCallWebhookId()`: `ELEVENLABS_POST_CALL_WEBHOOK_ID`, else a memo (10 min, 15 min when none was found), else `platform_resources` key `elevenlabs.post_call_webhook`, else discovery from `GET /v1/workspace/webhooks` (HMAC webhook whose URL is our receiver), stored for next time. The agent builder uses it for `platform_settings.workspace_overrides.webhooks.post_call_webhook_id`. `PLATFORM_AGENT_CONFIG_VERSION` is now 2, so `config_rollout` re-syncs existing agents in batches. |
| CONV:workspace-webhooks-api | done | `lib/elevenlabs/api/workspace.ts`: `listWorkspaceWebhooks({includeUsages})`, `updateWorkspaceWebhook(id, {name, is_disabled, retry_enabled})`. `events` is never sent (it replaces the whole set). The repair is admin-only and a dry run by default (§6). |
| Q:workspace-webhooks-health | done | `checkPostCallWebhook()` (`lib/voice-providers/webhook-health.ts`) reports these problem codes: `secret_missing`, `no_public_url`, `list_failed`, `settings_failed`, `webhook_missing`, `webhook_not_found`, `auto_disabled`, `disabled`, `not_hmac`, `url_mismatch`, `recent_failures`, `default_events_missing`, `default_sends_audio`, `embedding_retention`. Maintenance step `elevenlabs_workspace_health` runs it hourly (stored last run). An unhealthy result is logged as an error and emitted as provider event `health_check` / `post_call_webhook`. It is also part of `GET /api/admin/voice/diagnostics` (`post_call_webhook`). `retry_enabled` cannot be read back (not in the response model), so the repair enforces it. |
| CONV:convai-workspace-settings | done | `getConvaiSettings` / `updateConvaiSettings`. Read by the health check (default post-call webhook events, `send_audio`, `conversation_embedding_retention_days`). Admin `POST /api/admin/voice/convai-settings` aligns the embedding retention (dry run by default, §6). |
| Q:convai-workspace-settings | done | Same as above. The PATCH is read-modify-write: it re-sends the current webhooks block (without `send_audio`) and reports any other field that changed after the write. |
| CONV:analysis-call-successful | done | Shown as "AI outcome" (Successful / Not successful / Unclear) in the calls table, recent calls, call view (with an explanation) and CSV export ("AI Outcome"). AI-outcome filter on the calls list. Dashboard "AI resolution rate" = success / (success + failure). It is no longer copied into `calls.sentiment` (§8). |
| CONV:analysis-data-collection | done | Data-collection values reach workflows: `triggerWorkflowsOnce` now selects outcome, analysis, summary title, from/to, ended_at and the org name and time zone. `interpolate()` renders with `templates.ts` (`callTemplateVars`): every documented variable, old aliases, `{{ai_outcome}}`, `{{summary_title}}` and each data-collection field by id. An unknown variable renders as an empty string, so a literal `{{…}}` never reaches anyone. Slack values are escaped. The webhook action payload gains `ended_at`, `outcome`, `ai_outcome`, `summary_title` and `collected`. The Google Sheets row is unchanged (12 columns). |
| CONV:metadata-cost-charging | partial | Provider cost (`cost`, `charging.{is_burst, tier, dev_discount, llm_price, platform_price}`) goes to the service-only `call_provider_costs` table, never to `calls`. Diagnostics read cost per provider and `burst_calls` from it. **Not done:** a per-org margin report. |
| CONV:metadata-error-warnings | done | `metadata.error` ({code, reason}) and `warnings` are stored, truncated, in `calls.call_metadata` and shown under "Support details" in the call view. Only the error code is logged (`call_event.provider_error`); the reason text may quote the caller. |
| CONV:privacy-retention-enforcement | done | Maintenance step `call_retention`, hourly from a stored last run. For every agent with `retention_days >= 0` (default 365; 0 = right after the call), `apply_call_retention()` clears transcript, summary, summary title, analysis, provider error/warnings and the recording flag of that agent's calls older than the period (`retention_applied_at` set; counts, durations and outcomes stay). At most `CALL_RETENTION_BATCH` rows per run. A purged call never gets its content back from a late webhook or poll, cannot be re-analysed, and shows a note in the call view. The operational `retention` step is now hourly from a stored last run instead of the clock minute. |
| CONV:analytics-dashboard-from-analysis | done | `/api/dashboard/metrics` adds `ai_success_rate`, `ai_outcome_breakdown` and `outcome_breakdown`. The old "Success rate" KPI is renamed "Answered rate". New `CallInsightsCard`: AI resolution rate, calls in progress, outcome breakdown (horizontal bars), top topics. Test sessions never count. |
| CONV:metadata-initiation-source-guard | done | `classifyChannel`: phone when `phone_call` metadata is present or the initiation source is telephony (`twilio`, `sip_trunk`, `exotel`, `genesys`, `avaya`, `audiocodes`); `web` for SDK/widget/`template_preview`; `other` otherwise (WhatsApp, integrations, sub-agents, `unknown` without phone metadata). Only on the insert path (no matched row) and only for a post-call result: a non-phone conversation is stored as a test call (`channel`, `is_test=true`, routing mode `test`), never billed, never runs workflows and never counts as media-path evidence. Failures and audio events, and rows the router already created, keep today's behaviour. |
| Q:conversation-source-classification | done | Same as above. The source, `text_only`, `version_id` and `branch_id` are kept in `call_metadata`. Test calls carry a "Test" badge in the calls list and the call view. Metrics and diagnostics exclude them. |
| TEL:conversation-telephony-metadata | done | `phone_call` (twilio / sip_trunking / exotel) gives the direction, numbers, call SID and `phone_number_id`. A native call is linked to the org's own `phone_numbers` row by `elevenlabs_phone_number_id` (owner org only). Queue wait, main language and features used are stored. **Not done:** batch-call ids. |
| TEL:conversation-lookup-by-dynamic-variable | done | `findConversationsByCallId(agentId, callId)`: UUID-checked, `page_size` 5, time window around the call, each candidate GET-confirmed (agent id and echoed `ntv_call_id`). Used by the reconciliation and the delete lookup. The outbound start timeout path is covered by the reconciliation (`lib/telephony/outbound.ts` is unchanged). |
| T:tools-transcript-tool-visibility | done | Transcript tool calls/results become a redacted timeline in `call_metadata.tool_events` (tool name, kind, ok, `result_type`, time; never parameters, URLs or bodies). It is shown inline in the call view's transcript. `transfer_to_number_*_success` gives outcome `transferred`, and `voicemail_detection_success` gives the new outcome `voicemail` (evidence outcomes win over the AI's data collection). |
| CONV:conversation-feedback | done | `POST /api/calls/[id]/feedback {feedback: like/dislike/null}`. Stored on `calls.owner_feedback` and forwarded best effort to `POST /v1/convai/conversations/{id}/feedback`. Thumbs up/down in the call view. |
| CONV:agent-topics-discovery | partial | `GET /api/dashboard/topics` → `GET /v1/convai/agents/{org's agent}/topics` (top-level topics, 30-day window, 6 h cache, rate limited on cache misses). Shown as "Top topics" on the dashboard card and hidden when there are none. **Not done:** turning topic discovery on for agents. |
| CONV:messages-text-search | done | Our own full-text index instead of the provider's search: `call_search_vector(summary_title, summary, transcript)` + GIN index + `search_org_calls(org_id, tsquery, limit)` (service role only, scoped by org id). A text search on `/api/calls` and the export ORs the matching ids (max 200) with the existing summary match. Phone-like searches keep the number match. Rate limited (60/min/org). |
| CONV:conversation-analysis-rerun | done | `POST /api/calls/[id]/reanalyze`: org row → refuses purged, live or non-ElevenLabs calls (409) → rate limit (5 / 10 min, 20 / day) → GET, the agent must belong to the org (else 404) and the conversation must be final → `POST …/analysis/run` (no retry) → replaces analysis, summary, title and AI outcome (an evidence outcome such as transferred is kept). "Analyse again" action in the call view. |
| CONV:metadata-termination-reason | done | `terminationReasonLabel` also maps ElevenLabs free-text reasons by pattern (remote party, end_call tool, maximum duration, silence, …); unknown ones are tidied. |
| CONV:metadata-main-language | partial | Stored and shown ("Language", via `Intl.DisplayNames`). **Not done:** a flag when it differs from the agent's language. |
| CONV:metadata-queue-timing | partial | `queue_wait_secs` is stored and shown under support details. **Not done:** a p95 alert. |
| CONV:metadata-features-usage | partial | `features_used` (names of features with `used: true`) and the guardrail types that fired (`guardrails_triggered`) are stored. Outcomes come from tool results only. |
| CONV:transcript-turn-details | partial | Tool rows are shown in the transcript. **Not done:** per-turn latency metrics. |
| CONV:webhook-signature | done | `verifyElevenLabsSignatureRotating`: the current secret first, then `ELEVENLABS_WEBHOOK_SECRET_PREVIOUS` during a rotation (logged as `webhook.previous_secret_used`). A stale timestamp logs its age. It still fails closed without a secret. |
| CONV:webhook-post-call-transcription | done | The normalizer adds channel, metadata, evidence outcome and charging to the post-call event. Shared by the webhook and the reconciliation. |

### Bugs routed to this slice

| Bug | Status | Fix |
|---|---|---|
| webhook.ts:62: tool turns dropped, transfers/voicemail stored as plain completed | fixed | Tool timeline + evidence outcomes `transferred` / `voicemail` (T:tools-transcript-tool-visibility). |
| call-store.ts:148: unmatched non-telephony conversations billed and running workflows | fixed | Stored as test calls with no billing and no workflows (metadata-initiation-source-guard). They are stored, not ignored, so support can still see them. |
| 001:123: tenants can read `calls.cost_usd` / `cost_credits` | fixed | Migration 017 moves cost to `call_provider_costs` (RLS, no policy, revoked). It clears the calls columns, and a trigger diverts any later write. Column privileges were not used: they would break `select *` for tenants. |
| executor.ts:62: owners receive a literal `{{outcome}}` | fixed | Rendering via `templates.ts` with the full post-call data (analysis-data-collection). |
| maintenance.ts:173: retention runs only when `getUTCMinutes() < 5` | fixed | `runIfDue('retention', 1 h)` from a stored last run (`maintenance_state`). The same applies to call retention and workspace health. Comments fixed. Installing the 5-minute pg_cron scheduler in production is an ops step (§10). |
| call-merge.ts:117: `call_successful` copied into sentiment, "frustrated caller" trigger | fixed | No longer derived. Relabelled "AI outcome". The workflow trigger `sentiment_negative` is now "Call not resolved" (fires on `call_successful = failure`, or a legacy negative sentiment). Dashboard and automation-page copy updated. Native `sentiment_analysis` is not used yet. |
| stale-calls.ts:26: lost webhooks for native outbound/inbound never recovered | fixed | `conversation_reconcile` (conversations-list-reconciliation). |
| call-store.ts:154: deleted call's provider conversation never deleted | fixed | Tombstone branch deletes at the provider; DELETE looks the id up when missing (conversation-delete-privacy). |
| webhook route.ts:75: retries disabled, auto-disable not monitored | fixed | Health check + admin repair enabling `retry_enabled` (§6). |
| audio route.ts:72: 404 not saved | fixed | Saved as `unavailable` (conversation-audio). |
| call-store.ts:291: workflow context without post-call analysis | fixed | Same fix as executor.ts:62. |
| metrics route.ts:82: "Success rate" is a completion rate | fixed | Renamed "Answered rate". AI resolution rate added. |
| TabCallHandling.tsx:618: -1 labelled "Provider default" | already fixed | The label is already "Unlimited (kept until deleted)". The privacy card now also says our call history follows the same period, and that copies sent by automations are not deleted. |
| webhook.ts:93: classification by `phone_call` only | fixed | `classifyChannel` with the initiation source (above). |

## 2. Endpoints and fields used (checked against the OpenAPI spec)

| Endpoint | Wrapper | Notes |
|---|---|---|
| `GET /v1/convai/conversations` | `listConversations`, `findConversationsByCallId` | `agent_id` is always set. `dynamic_variable_params` (`ntv_call_id:eq:<uuid>`), `call_start_after_unix` / `call_start_before_unix`, `page_size` ≤ 100, `cursor`, `summary_mode=exclude`, `sort_direction=asc` for the sweep. |
| `GET /v1/convai/conversations/{id}` | `getConversation` | `status` initiated / in-progress / processing / done / failed. Only done and failed are applied. |
| `POST /v1/convai/conversations/{id}/feedback` | `sendConversationFeedback` | `{feedback: like/dislike/null}`, idempotent. |
| `POST /v1/convai/conversations/{id}/analysis/run` | `runConversationAnalysis` | Returns the conversation. No retry, 60 s timeout. |
| `GET /v1/convai/analytics/live-count` | `liveCount` | `agent_id` for tenants. Workspace-wide only for the admin probe. |
| `GET /v1/convai/agents/{id}/topics` | `agentTopics` | `topics[{topic_id, label, description, conversation_count, parent_topic_id, success_rate}]`. |
| `GET /v1/workspace/webhooks?include_usages=` | `listWorkspaceWebhooks` | `is_disabled`, `is_auto_disabled`, `auth_type`, `webhook_url`, `most_recent_failure_*`, `usage`. Retried without usages when that fails. |
| `PATCH /v1/workspace/webhooks/{id}` | `updateWorkspaceWebhook` | `name` and `is_disabled` are required; `retry_enabled` is sent. `events` is never sent. |
| `GET` / `PATCH /v1/convai/settings` | `getConvaiSettings`, `updateConvaiSettings` | `webhooks`, `conversation_embedding_retention_days` (1–365, null = 30). Read-modify-write. |
| `DELETE /v1/convai/conversations/{id}` | existing `conversations.delete` | Tombstone and DELETE lookup. 404 = already gone. |

All new wrappers use `req` / `Ctx` from `lib/elevenlabs/client.ts`. The analysis run is a non-retried POST. No `breaker: true` (none of this is on the live-call path).

## 3. Migration 017 (`supabase/migrations/017_conversations_privacy.sql`)

Additive and idempotent (no DROP, re-run twice on PostgreSQL 16). **Apply it before deploying the code** (the call store and the calls API select the new columns).

- `calls`: `channel` (`phone` / `web` / `other`, default `phone`), `is_test`, `call_metadata` jsonb, `owner_feedback` (like / dislike), `owner_feedback_at`, `retention_applied_at`, `reconcile_attempts` (0–100), `reconcile_checked_at`. Checks are added `NOT VALID`, then validated. Indexes: `calls_el_reconcile`, `calls_retention_pending`, `calls_org_outcome`, `calls_search_fts` (GIN on `call_search_vector(...)`). The existing `calls_guard` already rejects tenant writes on calls, so no new guard is needed.
- `call_provider_costs` (PK `call_id, provider`; org FK cascade; RLS with no policy; all privileges revoked from anon/authenticated). Existing costs are copied, then cleared on `calls`. Trigger `calls_provider_costs_divert` (BEFORE INSERT OR UPDATE OF cost columns) moves any later write into the table and keeps the calls columns NULL.
- `maintenance_state` (key, `last_run_at`, `watermark`, `details`): RLS, revoked. `claimStep` uses compare-and-set on `last_run_at`.
- Functions (all `SET search_path = public`, EXECUTE revoked from PUBLIC/anon/authenticated): `divert_call_provider_costs()`, `apply_call_retention(agent, cutoff, limit)` (`FOR UPDATE SKIP LOCKED`), `call_search_vector(text, text, jsonb)` (IMMUTABLE, `simple` config), `search_org_calls(org, tsquery, limit)`.
- Verified on a throwaway PostgreSQL 16 with Supabase-like roles. Costs were moved and the divert trigger worked for insert and update. A tenant can `select *` on calls (cost NULL) but cannot read the new tables or run the functions, and the guard still blocks tenant updates. The constraints are enforced. Search is org-scoped and uses the GIN index. Retention is idempotent and only touches old rows. Agent deletion (FK `SET NULL`) still works with the expression index. `tests/migrations/017-conversations-privacy.test.ts` checks the file statically.

## 4. Post-call pipeline changes

- `NormalizedCallEvent` gains `channel`, `metadata` (`CallMetadata`), `evidenceOutcome` and `charging`.
- `mergeCallEvent`: evidence outcome first, then the AI's data-collection outcome. `call_metadata` is merged (new keys win). Cost is never written to `calls`. Once a row is purged by retention it never gets transcript, summary, analysis or recording back.
- `applyCallEvent(event, log, {source})`: `source` `webhook` or `poll` (usage source `elevenlabs_poll` for recovered calls). Test calls skip billing, workflows and media-path evidence. Cost is recorded for the abandoned conversation of a call taken over by the other provider too.
- Workflows: `is_test = false` is part of the claim. `sentiment_negative` fires on `call_successful = failure` (or a legacy negative sentiment). The default Slack text shows the AI outcome.

## 5. Rate limits (per organization)

| Endpoint | Limit |
|---|---|
| `POST /api/calls/[id]/feedback` | 60 / h |
| `POST /api/calls/[id]/reanalyze` | 5 / 10 min and 20 / day |
| `GET /api/calls?search=<text>` (full-text) | 60 / min |
| `GET /api/dashboard/topics` | 30 / h (cache misses only) |
| `GET /api/dashboard/live` | 240 / h (cache misses only) |

## 6. Admin endpoints (`requireAdmin`, same-origin, zod-validated, rate limited)

- `POST /api/admin/voice/webhooks {dry_run = true, enable_retries = true, reenable = true, rediscover = false}`: plans or applies `PATCH /v1/workspace/webhooks/{id}` with `{name, is_disabled: false, retry_enabled: true}` on the post-call webhook. `rediscover` (only when applying) clears the stored id so it is found again by URL. Returns `before`, `plan` and `after` (health reports). An applied change is written to `audit_log`.
- `POST /api/admin/voice/convai-settings {dry_run = true, embedding_retention_days?}`: summary of the workspace ConvAI settings (never header values), and the alignment of `conversation_embedding_retention_days` to the policy (`ELEVENLABS_EMBEDDING_RETENTION_DAYS`, default 30). An applied change is written to `audit_log`.
- `POST /api/admin/voice/conversations {limit 1–100, sweep = true}`: runs the reconciliation now (idempotent; logged, not audited).
- `GET /api/admin/voice/diagnostics`: adds `post_call_webhook`, `calls_24h.burst_calls`, and cost from `call_provider_costs`. With `?probe=1` it also reports `workspace_concurrency` (live count vs `ELEVENLABS_CONCURRENCY_LIMIT`, warning at 80 %).

## 7. Environment variables (none added to `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `ELEVENLABS_WEBHOOK_SECRET_PREVIOUS` | unset | Previous post-call webhook secret, accepted during a rotation. Remove it once the new secret is live. |
| `ELEVENLABS_POST_CALL_WEBHOOK_ID` | unset | Now optional: the id is discovered from the workspace webhooks and stored in `platform_resources`. |
| `ELEVENLABS_RECONCILE_BATCH` | 20 (0–100) | Rows checked per reconciliation run. 0 turns the row pass off. |
| `ELEVENLABS_RECONCILE_SWEEP_AGENTS` | 5 (0–50) | Native-number agents swept per run. 0 turns the sweep off. |
| `ELEVENLABS_RECONCILE_MAX_FETCHES` | 40 (1–200) | GETs per run across rows and sweep. |
| `ELEVENLABS_CONCURRENCY_LIMIT` | unset | Workspace concurrent-call limit for the 80 % warning. Unset: no warning. |
| `ELEVENLABS_EMBEDDING_RETENTION_DAYS` | 30 | Policy for the workspace `conversation_embedding_retention_days` (health check and admin alignment). |
| `CALL_RETENTION_BATCH` | 500 | Calls purged per `call_retention` run. |

## 8. UI changes

- **Calls list:** "AI outcome" column (icon + label), "Test" badge, Outcome and AI-outcome filters (replacing the sentiment select), search placeholder "Search by number, summary or what was said…".
- **Call view:** AI outcome with an explanation and thumbs up/down. Language. Tool events inline in the transcript. "Support details" with termination reason, provider error, warnings and queue wait. A retention note when the content was purged. "Analyse again" action.
- **Dashboard:** "Answered rate" KPI. New insights card with AI resolution rate, calls in progress, outcome breakdown and top topics. Recent calls show the AI outcome.
- **Workflows:** the `sentiment_negative` trigger is shown as "Call not resolved" ("The AI marked the call as not successful").
- **Agent privacy card:** our call history follows the same retention. The confirmation says so, and says that copies sent by automations are not deleted.

## 9. Manual staging verification (no live calls are automated)

1. Apply migration 017 on staging, then deploy. `GET /api/admin/voice/diagnostics` shows `post_call_webhook.ok` (or the problem codes).
2. `POST /api/admin/voice/webhooks {}` (dry run): check the plan, then `{dry_run: false}`. Re-run diagnostics: no `disabled` or `auto_disabled`.
3. Place an inbound call on a native number. The call appears with AI outcome, language and tool events. A transfer shows "Transferred", a voicemail shows "Reached voicemail".
4. Test the agent from the ElevenLabs dashboard or a widget. It appears with a "Test" badge, is not billed and runs no workflows.
5. Temporarily point the workspace webhook elsewhere (or disable it), place a call, then `POST /api/admin/voice/conversations {}`. The call is recovered with transcript and billed once (`usage_ledger` source `elevenlabs_poll`). Restore the webhook.
6. Set an agent's retention to 30 days on a staging org with old calls, wait for maintenance (or run it). The transcripts are removed and the counts stay.
7. Delete an app-routed call whose webhook never arrived. The conversation is gone at ElevenLabs (`GET` 404).
8. Rotate the webhook secret: set the new secret in ElevenLabs and `ELEVENLABS_WEBHOOK_SECRET`, the old one in `..._PREVIOUS`. Deliveries keep working. Then remove the previous one.
9. "Analyse again" on a finished call refreshes the AI outcome. Thumbs up shows in the ElevenLabs conversation.
10. A workflow email with `{{outcome}}`, `{{caller_name}}` and a custom data-collection id renders the values with no braces.

## 10. Remaining limitations

- The omitted-field semantics of `PATCH /v1/convai/settings` are not documented. The alignment re-sends the current webhooks block and reports other fields that changed after the write.
- Topic `success_rate` scale is not documented. Values ≤ 1 are treated as a fraction.
- The full-text search uses the `simple` configuration without `unaccent` (diacritics must match). Results are capped at 200 ids.
- Topic discovery is not turned on for agents here (the card hides itself without topics).
- `calls.sentiment` is legacy-only until native `sentiment_analysis` is used.
- The marketing pages (`lib/pages/integrations.ts`, `components/site/...`) still describe the trigger as "Negative sentiment" / "unhappy caller". The dashboard, the workflows screen and the custom-automations page are updated.
- `PLATFORM_AGENT_CONFIG_VERSION` = 2 re-syncs every agent through `config_rollout` after deploy (batched).
- Without the 5-minute pg_cron scheduler (`supabase/ops/schedule_voice_maintenance.sql`), maintenance (and so recovery and retention) runs once a day on Vercel Hobby. Installing it in production is an ops step.
- Per-org margin report, language-mismatch flag, queue-wait p95 alert, per-turn latency metrics and account-closure purge of conversations are not done.

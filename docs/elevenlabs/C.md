# Slice C: Telephony (native imports, outbound calls, conversation initiation webhook, transfer options)

This slice makes the telephony side of the ElevenLabs integration reliable and complete. Native number imports are now idempotent. Every call start (register-call, native outbound-call, and the new conversation initiation webhook) builds its client data with one shared builder. Native outbound calls handle every response and failure mode correctly. Native inbound calls now get real per-call values: a call row, a tool token, the after-hours state and an "unavailable" opening when calls should be refused. Human transfers gain an extension (post-dial digits), a transfer method, and a warm-transfer whisper.

Every endpoint, field path, enum and limit below was checked against the official OpenAPI document (`elevenlabs-spec/openapi.json`, downloaded 2026-10-07). `tests/elevenlabs-spec-contract.test.ts` now also validates native agents with the initiation webhook (secret-locator header), an extension, and conference and blind transfers, in the active and paused variants. Behaviour that only the docs describe is marked **unverified live**.

## 1. Audit items

| Item | Status | Notes |
| --- | --- | --- |
| TEL:phone-import-twilio | done | `bindElevenLabsNumber` (`lib/telephony/binding.ts`) mirrors the Cartesia binding. A stored import is PATCHed with `{agent_id, label}`. A 404 forgets it and imports again. When an import fails with `conflict` or `validation` (the duplicate status is undocumented), an exact-number lookup decides. With no existing import, the original error is rethrown. An import that is unassigned or already ours is adopted (PATCH agent and label). One assigned to another agent is deleted and the number is imported again. An import labelled for **another environment** is never adopted or deleted: the result is a `conflict` with a tenant-safe message. The label is now `ntv:<env>:<org uuid>` (`lib/telephony/import-label.ts`, same environment marker as the agents' `ntv-env:` tag). It is refreshed on every re-bind. The import still sends the master Twilio Account SID and token (separate audit item, not in this slice). |
| TEL:phone-list-v1 | done | `phoneNumbers.list()` (the unfiltered workspace-wide v1 listing) is removed. Nothing in the codebase can list every tenant's imports any more. |
| TEL:phone-list-v2 | done | `lib/elevenlabs/api/phone-numbers.ts`: `listImportedNumbersPage`, `findImportedNumber` (exact E.164 match after normalisation, at most 3 pages), and `collectImportedNumbers` (by label, capped, reports `truncated`). Used by platform code only. Orphan report: `lib/telephony/import-reconcile.ts` and the new admin endpoint `POST /api/admin/voice/phone-imports` (section 6), instead of `lib/voice-providers/reconcile.ts`, which is outside this slice. |
| TEL:phone-update | done | Part of the import fix: 404 means import again, and the label is refreshed. |
| TEL:client-data-dynamic-variables | partial | `lib/telephony/client-data.ts` is now the only builder of `conversation_initiation_client_data`. It is used by `router.ts` (register-call), `outbound.ts` (native outbound-call) and the initiation webhook. Keys always come from `PLATFORM_VARIABLES`, and tenant variables can never override a platform key. Direction (`ntv_call_direction`) already existed (slice A1). **Not done:** a separate `ntv_call_purpose` variable (test, campaign). It would need a new placeholder and prompt rule in shared files (`prompt.ts`, `dynamicVariablePlaceholders`). The purpose stays in `calls.routing.purpose`. |
| TEL:client-data-overrides | done | Outbound calls on both paths open with the outbound greeting. It carries the AI disclosure and, when the business enabled it, the recording notice. Every override is sent only if the agent's allow-list **in force at the provider** contains that field (section 3). |
| TEL:twilio-outbound-call | done | (1) `success=false` or a null `conversation_id`: the row is set to `failed`, `failover_reason: elevenlabs:outbound_rejected`, and the user gets a 502 "could not be placed". The provider message is logged with numbers masked. (2) Outbound greeting with the recording notice. (3) `telephony_call_config.ringing_timeout_secs: 30`. (4) A timeout or network error leaves the row `ringing` with `routing.outbound_uncertain: true`, and the API answers 202 `status: 'unconfirmed'` with a neutral message. Slice D's `conversation_reconcile` then finds the conversation by `ntv_call_id`, or settles the row as failed after 2 h. The initiation webhook also links the conversation id if ElevenLabs calls it. (5) `breaker: false`. (6) Plan-minutes pre-check before any provider call (section 4). Definite 4xx/5xx responses still mark the row `failed` (`elevenlabs:outbound_failed`). `tenant_limited` answers 429. |
| TEL:telephony-ringing-timeout | done | `OUTBOUND_RING_TIMEOUT_S = 30` (`lib/elevenlabs/api/telephony.ts`) applies to native calls (`telephony_call_config`) and app-routed calls (Twilio `timeout`). |
| A:workspace-overrides-initiation-webhook | done | `platform_settings.workspace_overrides.conversation_initiation_client_data_webhook = {url, request_headers: {'X-NTV-Tool-Key': {secret_id}}}` for agents with native numbers, plus `overrides.enable_conversation_initiation_client_data_from_webhook`. The route and its behaviour are described in section 2. |
| A:platform-overrides | done | `overrides.conversation_config_override` is `{agent: {first_message: true}, conversation: {max_duration_seconds: true}}`. Prompt, LLM, tools, voice, language and text-only overrides are never allowed. The webhook flag is true only when the webhook is configured. `max_duration_seconds` is sent only as min(agent limit, minutes left on a trial), or 20 s for a refused call. |
| TEL:conversation-initiation-webhook | done | Configured per agent, not workspace-wide. Isolation, idempotency and failure behaviour: section 2. |
| T:tools-native-call-context | done | Native inbound calls get `ntv_call_id`, both signed tokens (the tool token is `secret__ntv_call_token`, the same B1 mechanism, so transfer and booking tools authenticate on native calls), `after_hours`, `ntv_routing_mode: native` and `ntv_call_direction: inbound`. |
| TEL:native-transfer-to-number-options | done | Transfer settings gain `extension` (digits, `*`, `#`, `w` = 0.5 s, `W` = 1 s, 1–24 characters), `transfer_type` (`conference` default or `blind`), and `whisper`. Native numbers: `post_dial_digits: {type: 'static', value}` and `transfer_type`. `sip_refer` is not offered: it needs a SIP trunk, and our numbers are Twilio imports. App-routed numbers: `<Number sendDigits>` (`W` becomes `ww`) on every dial of the transfer destination (tool transfer, Cartesia SIP REFER, final-failure handoff). The warm-transfer whisper (`<Number url>`) is used on tool and REFER transfers when enabled. |

### Bugs routed to C

| Bug | Status | Fix |
| --- | --- | --- |
| router.ts:153 `recordingNotice: false` on outbound greetings (two entries) | fixed | `RoutingContext.agent.recordingNotice` (`conversation.recording_notice`), passed through the shared builder. |
| outbound.ts:85 native outbound has no outbound first message (two entries) | fixed | Shared builder; `first_message` is allowed on every synced agent. |
| outbound.ts:101 success / null conversation id ignored | fixed | See TEL:twilio-outbound-call (1). |
| outbound.ts:96 timeout marks the row failed | fixed | See (4). The row stays `ringing` and is recovered by `conversation_reconcile`. |
| binding.ts:168 native import not idempotent | fixed | See TEL:phone-import-twilio. |
| client.ts:319 `breaker: true` on outbound-call | fixed | `breaker: false`. The 429 classification half needed no change: slice A2 already classifies an unknown or agent-scoped 429 code (for example `too_many_concurrent_requests`) as the non-health `tenant_limited`. `concurrent_limit_exceeded` stays a workspace health signal, which only register-call can feed now. |
| router.ts:141 `user_id` = org id (also outbound.ts) | fixed | `user_id` is now `ntvu_` + 32 hex characters of HMAC-SHA256(`VOICE_TOKEN_SECRET`, `user:<org>:<E.164 of the other party>`). It is opaque, scoped to one org (no cross-tenant correlation in the shared workspace), and left out for anonymous callers. The webhook response does not include it (section 2). |

## 2. Conversation initiation webhook (`POST /api/elevenlabs/initiation`)

**Configuration.** `lib/telephony/initiation-config.ts` builds it only when `VOICE_PUBLIC_BASE_URL` is HTTPS **and** `ELEVENLABS_TOOL_SECRET` is set. The secret is slice B1's workspace secret (created or rotated by `ensureToolSecret`) and is referenced by `secret_id`, never by value. The hash path reads only the stored id and never creates anything. Agents without native numbers get the flag set to `false` and no webhook key. Native agents without a configured webhook get an explicit `null`, which clears one pushed earlier (objects are deep-merged). A paused agent keeps the webhook.

**Authentication.** The `X-NTV-Tool-Key` header is compared in constant time against the current key and, during a rotation, the previous one (B1's `checkToolKey`). The check runs before the body is read. It fails closed: no key configured gives a 401, in any environment. A failure gives a 401 with a generic body and a `webhook_verification_failed` provider event. The body (JSON, or form-encoded as a fallback, 16 KB max) is validated with zod: `agent_id` is required, ids are limited to `[A-Za-z0-9_-]`, and numbers to 64 characters.

**Isolation** (`lib/telephony/initiation.ts`). The organization comes **only** from `agent_provider_resources (provider elevenlabs, external_id = agent_id)`. `called_number` must be a `phone_numbers` row of that same organization. Otherwise the request gets neutral placeholders: no call row, tokens `none`, `after_hours: unknown`. An unknown agent gets placeholders with no business data. A call SID that belongs to another organization's row is never reused.

**Behaviour.**
* New inbound call to a native number: a `calls` row is inserted with the Twilio CallSid, the conversation id, `status: ringing`, `lifecycle_rank: 20`, and `routing: {mode: 'native', source: 'initiation_webhook', after_hours}`. The post-call webhook then matches it, through the signed `ntv_call_token`, the conversation id or the CallSid (unique index). The status stays `ringing` until that merge, so slice D's reconcile can settle a row that never got a conversation.
* Idempotent: a repeated delivery, a row the post-call webhook created first (`23505` on either unique key), or a register-call that triggers the webhook all reuse the existing row and return the same values. An app-routed row keeps `ntv_routing_mode: app_routed`. A native outbound row keeps its outbound greeting.
* Response: `{type: 'conversation_initiation_client_data', dynamic_variables, conversation_config_override?}`. `dynamic_variables` holds **all** the agent's variables: the tenant ones (stripped of platform references) plus every platform variable. `after_hours` comes from the working hours in the org's time zone (`evaluateWorkingHours`, same as the router). After-hours message/forward modes are not emulated: the agent handles closed hours, as before.
* Refused calls: a paused agent (`agent_inactive`), an inactive number (`number_inactive`), or a trial with no minutes left (`quota_exhausted`) get `first_message` = the localized "unavailable" line and `conversation.max_duration_seconds: 20`. Trials with minutes left are capped to them.
* Only documented response fields are sent. `user_id` is left out because the docs do not list it for this response.
* Latency: one round of three indexed reads, one round of two reads, and at most one insert (plus one or two indexed reads on the outbound or app-routed match paths). There is no provider call. A 1.2 s deadline, or any error, answers with placeholders plus whatever is already known (tenant variables, business name), never an error status, so a caller is always answered. `maxDuration` is 10 s.
* Defensive matching (undocumented cases). If ElevenLabs calls the webhook for a native **outbound** call, or names our number as `called_number` within 2 minutes of placing one, the outbound row is reused rather than an inbound row being created.

## 3. Override allow-list in force

ElevenLabs refuses to start a conversation that overrides a field the agent does not allow. The config rollout is batched, so many agents keep the version-2 allow-list (first message only) for a while. Every ElevenLabs sync now records `client_overrides: {version, paths}` next to `platform_version` in `agent_provider_resources.details` (`lib/elevenlabs/client-overrides.ts`, one line in `adapters.ts`). The router and outbound paths send `conversation.max_duration_seconds` only when those paths include it **and** both versions agree. A rollback deployment that re-syncs the agent rewrites `platform_version` but not this key, so the key then reads as stale. Unknown or stale means first message only.

## 4. Plan minutes (`lib/telephony/quota.ts`)

Plans with overage (`PLANS[plan].overage_per_min > 0`) are never refused or capped. A plan without overage (the trial) stops at `organizations.minutes_limit`:
* **Outbound calls** (dashboard and test call) are refused with a 409 before anything is placed.
* **App-routed inbound** calls are answered with the localized "unavailable" line, with no provider involved, after the after-hours handling. `routing_reason` is `quota_exhausted`. This is a **behaviour change**: exhausted trials used to keep receiving AI calls for free. Turn it off with `VOICE_TRIAL_MINUTES_ENFORCED=false`. `lib/calls/labels.ts` has no label for this reason (shared file), so these rows show as "Failed".
* **Native inbound** calls get the unavailable opening from the webhook (section 2).
* Calls with minutes left are capped to them, with a 60 s minimum: Twilio `timeLimit` for app-routed outbound, the Cartesia SIP `timeLimit`, and the `max_duration_seconds` override where allowed.
Unknown plan values and missing limits are never enforced (fail open).

## 5. Endpoints and fields

| Endpoint | Use |
| --- | --- |
| `GET /v1/convai/v2/phone-numbers?phone_number=&provider=twilio&page_size=100&cursor=` | Exact-number lookup for adoption (`phone_numbers[]{phone_number_id, phone_number, label, provider, assigned_agent{agent_id}}`, `next_cursor`, `has_more`). |
| `GET /v1/convai/v2/phone-numbers?label=ntv:<env>:&page_size=100&cursor=` | Admin import report (label is a case-insensitive substring, re-parsed exactly). |
| `POST /v1/convai/phone-numbers` | `{provider: 'twilio', phone_number, label, agent_id, sid, token, enable_sms: false}`, NO_RETRY. |
| `PATCH /v1/convai/phone-numbers/{id}` | `{agent_id, label}` (re-bind, adoption). |
| `DELETE /v1/convai/phone-numbers/{id}` | Replacing a stale import; admin orphan deletion. |
| `POST /v1/convai/twilio/outbound-call` | `{agent_id, agent_phone_number_id, to_number, conversation_initiation_client_data, telephony_call_config: {ringing_timeout_secs: 30}}` → `{success, message, conversation_id, callSid}`. NO_RETRY, no breaker, 10 s timeout. |
| `POST /v1/convai/twilio/register-call` | Unchanged call; client data from the shared builder. |
| Agent body | `platform_settings.overrides.{conversation_config_override.{agent.first_message, conversation.max_duration_seconds}, enable_conversation_initiation_client_data_from_webhook}`, `platform_settings.workspace_overrides.conversation_initiation_client_data_webhook {url, request_headers{X-NTV-Tool-Key: {secret_id}}}`, `built_in_tools.transfer_to_number.params.transfers[].{transfer_type: conference/blind, post_dial_digits: {type: 'static', value: ^[0-9*#wW]+$}}`. |
| Client data | `dynamic_variables`, `conversation_config_override.{agent.first_message, conversation.max_duration_seconds}`, `user_id`. |

New modules: `lib/elevenlabs/api/phone-numbers.ts`, `lib/elevenlabs/api/telephony.ts` (models, `OUTBOUND_RING_TIMEOUT_S`, webhook block), `lib/elevenlabs/client-overrides.ts`, `lib/telephony/{client-data, quota, initiation, initiation-config, import-label, import-reconcile, whisper, whisper-handler}.ts`. New routes: `app/api/elevenlabs/initiation`, `app/api/telephony/twilio/whisper`, `app/api/admin/voice/phone-imports`. `proxy.ts` adds the public prefix `/api/elevenlabs/initiation`; the whisper route is under the existing `/api/telephony/` prefix.

`PLATFORM_AGENT_CONFIG_VERSION` is now **3**: `config_rollout` pushes the new allow-list, the webhook and the transfer options to existing agents. **Merge note:** if another slice also bumped it to 3, the merged value must be 4.

## 6. Warm-transfer whisper and admin import report

**Whisper.** When "Tell your team member why the caller is transferred" is on, app-routed transfers dial `<Number url=".../api/telephony/twilio/whisper?t=<token>">`. The token is signed for the new purpose `whisper`. The route is Twilio-signed and uses `twilioRoute`. It reads the call by the token's id only, and the language from that call's own agent (scoped by org). It speaks "You have a call transferred by the AI assistant. Reason: …" in the agent's language (14 languages). The reason is the LLM-written `routing.transfer.reason`, sanitized again for speech: one line, no control characters, markup, links or digit runs of 5 or more, at most 160 characters. The route never hangs up the human's leg. Any problem gives an empty document, so Twilio bridges the caller anyway.

**Admin import report.** `POST /api/admin/voice/phone-imports {apply?: false, delete_orphans?: false, limit?: 1–200 (50)}`. It is admin only, same-origin and zod-validated, rate limited to 20 per hour platform-wide, and audited when applied (`voice.phone_imports.applied`). It lists this environment's imports and reports `matched`, `orphans` (assignment `none`, `ours` or `foreign`) and `issues` (`id_mismatch`, `label_org_mismatch`, `not_native`), with numbers masked. Deleting needs `apply` **and** `delete_orphans`, is bounded by `limit`, and never deletes an import assigned to an agent this database does not know: that import belongs to another deployment sharing the workspace under the same environment name.

## 7. Migrations

**None.** Migration number 019 was not needed. The new settings live in `agents.transfer_settings` (JSONB). `readTransferSettings` validates every field on read, so a direct tenant write cannot inject an invalid extension: it falls back to `null`. The new call state lives in `calls.routing` (JSONB) and existing columns. Every hot-path lookup uses an existing unique index: `calls.twilio_call_sid`, `calls.elevenlabs_conversation_id`, `phone_numbers.number` and `agent_provider_resources (provider, external_id)`. `routing_reason` has no CHECK constraint.

## 8. Environment variables (not added to `.env.example`)

| Name | Default | Meaning |
| --- | --- | --- |
| `VOICE_TRIAL_MINUTES_ENFORCED` | `true` | `false` turns off the plan-minutes gate and caps for plans without overage (section 4). |
| `ELEVENLABS_TOOL_SECRET` | none | Existing (slice B1). Also required for the initiation webhook. Without it, native agents get no webhook and keep the placeholders, and the route refuses every request. |
| `VOICE_PUBLIC_BASE_URL` | none | Existing. Must be HTTPS for the webhook to be configured. |

## 9. UI changes

The Call handling tab's **Human transfer** card has three new controls:
* **Extension (optional)**: a free-text field, validated live with the error shown under it. Hint: "Dialed after the call connects, for a phone system menu. Digits, * and #; w waits half a second."
* **Transfer method on direct numbers**: "Warm (recommended)", where the agent briefs your team member, or "Direct", which connects straight away and shows the caller's number.
* **Tell your team member why the caller is transferred**: a switch for the smart-routed whisper.

All controls are labelled and use `aria-describedby`. The API (`PATCH /api/agent {transfer_settings}`) accepts the new fields as optional, so older clients keep working.

The outbound APIs return `status: 'unconfirmed'` and a neutral `message` when the provider did not confirm in time.

## 10. Manual staging verification (no live calls are automated)

Deploy: (1) set `ELEVENLABS_TOOL_SECRET` and an HTTPS `VOICE_PUBLIC_BASE_URL`; (2) deploy; (3) `POST /api/admin/voice/rollout {"dry_run": false}` in batches (version 3), or let maintenance push it.

1. `GET /v1/convai/agents/{id}` of a native agent: `platform_settings.workspace_overrides.conversation_initiation_client_data_webhook` holds our URL and the header with `secret_id`; `overrides.enable_conversation_initiation_client_data_from_webhook: true`; `conversation_config_override.conversation.max_duration_seconds: true`. Check `agent_provider_resources.details.client_overrides`.
2. Call the native number: logs show `initiation.call_created` and `initiation.answered` (`ms`). The call appears at once as ringing, and the post-call webhook completes the **same** row (no duplicate). Record the observed latency. **Record the exact request** (JSON or form, field names) and whether `call_sid` is the Twilio CallSid.
3. Mixed org: on the native number, ask for a person. `transfer_to_number` is used. Ask the agent to use a booking or transfer webhook tool if available: the `X-NTV-Call-Token` header is no longer `none`.
4. After-hours on with today closed: the native agent says the business is closed (`after_hours: true` in the conversation's dynamic variables).
5. Pause the agent and call the native number: the unavailable line, then the call ends within about 20 s. The row shows "Agent paused".
6. Trial org with `minutes_used >= minutes_limit`: native, app-routed and outbound calls are all refused (unavailable line, or 409). With 2 minutes left, a call ends at about 120 s.
7. App-routed inbound call: check whether ElevenLabs calls the webhook for register-call (logs `initiation.existing_call` or `app_routed_without_row`). Either way the conversation must carry the router's `ntv_call_id`.
8. Native outbound test call: rings at most 30 s and opens with the outbound greeting (with the recording notice when enabled). Check whether the webhook is called (`initiation.existing_call`, direction outbound). To provoke `success=false`, use an unverified destination on a trial Twilio account: the API answers 502 and the row is failed (`elevenlabs:outbound_rejected`).
9. Webhook failure mode: temporarily set a wrong `ELEVENLABS_TOOL_SECRET` on staging only (401 from our route) and call the native number. **Record what ElevenLabs does** (answers with placeholders, or fails the call). If it fails the call, keep the secret rotation procedure strictly ordered (previous key set first).
10. Import idempotency: delete the import in the ElevenLabs dashboard and re-apply the routing (`PATCH /api/phone/[id]` or diagnose repair). It is re-imported (`binding.elevenlabs_import_missing_reimporting`). Then clear `elevenlabs_phone_number_id` in the DB (staging) and re-apply. **Record the HTTP status of the duplicate import** and check `binding.elevenlabs_import_adopted`.
11. Extension: a destination behind an IVR with `ww1`. The digit is sent on native (post_dial_digits) and app-routed (sendDigits) transfers. Try `blind` on a native number: the human sees the caller's number.
12. Whisper: enable it, transfer on an app-routed number. The human hears the announcement and reason before being connected. The caller hears ringing meanwhile. With an extension, check whether the whisper plays before or after the PBX picks the extension (see limitations).
13. `POST /api/admin/voice/phone-imports {}` (dry run): no `foreign` entry for this deployment's own agents. Orphans match released numbers.

## 11. Remaining limitations

* The webhook request format, its timeout, ElevenLabs' behaviour on a webhook error, whether register-call or outbound-call trigger it, and the duplicate-import status code are **unverified live** (staging steps 2, 7, 8, 9, 10). The code handles each case defensively.
* After-hours **message/forward** modes are still not enforced on native numbers: the agent handles closed hours itself with the real `after_hours`.
* `ntv_call_purpose` is not added (see TEL:client-data-dynamic-variables).
* `user_id` is not sent in the webhook response (field not documented there), so native inbound calls have no end-user id at ElevenLabs.
* With both an extension and the whisper, Twilio may play the whisper to the PBX menu before the extension reaches a person. Use the whisper for direct lines.
* `routing_reason: quota_exhausted` has no dashboard label yet (`lib/calls/labels.ts`, shared).
* The native import still uses the master Twilio Account SID and token (separate audit item).
* A refused native call is still a short ElevenLabs conversation (a few billed seconds), as with the paused variant.
* Admin diagnostics do not show the webhook configuration yet; `agent_provider_resources.details.client_overrides` and the logs do.

# Slice F: Voices

This slice covers the voice lifecycle on the shared ElevenLabs workspace: the retirement of the ElevenLabs default voices on 31 Dec 2026, curated platform voices per language, the lifecycle of Voice Library voices (removal notices, bans), better library search, custom voices (instant clones and Voice Design) with plan gating, a per-org cap and a workspace capacity preflight, pronunciation dictionaries, previews that sound like a call, speech-history retention, and cleanup of orphaned voices.

All tenants share one ElevenLabs workspace. Every voice id, dictionary id and generated-voice id is resolved on the server from the organization's own rows. No workspace-wide listing is returned to a tenant, and no provider id from the browser is trusted without a server-side ownership check.

## 1. Audit items

| Item | Status | Notes |
|---|---|---|
| V:voices-default-retirement | done | Default (premade) voices are no longer listed in the picker. `assertVoiceEligible` refuses them as a new choice (403 `reason: voice_retiring`). The agent already on one keeps it: re-save, retry and preview still work. A new agent always gets an explicit `voice_id`: the top curated platform voice for its language (§3). The Voice tab shows the banner "This voice will stop working on 31 Dec 2026 — choose a new voice", with a button that scrolls to and focuses the picker. Maintenance step `default_voice_migration` reports every hour. From `ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT` (default 2026-12-15) it switches the remaining agents to the curated voice of their language through the same path as `PUT /api/agent/voice`, with one `audit_log` row per agent. Admin: `POST /api/admin/voice/default-voices`. Diagnostics show the counts. |
| V:voices-library-lifecycle-monitoring | done | Maintenance step `library_voices`: each ready platform library row is re-checked about once a day (rows not checked in the last 20 h), 100 ids per `GET /v2/voices?voice_ids=`. A voice missing from the batch is confirmed with `GET /v1/voices/{id}` before it counts as removed. The row gets `notice` (`removal_scheduled`, `moderation`, `custom_rate`, `blocked`, `removed`), `retiring_at`, `sharing_status`, `safety_control` and `lifecycle_checked_at`. A voice with a notice is hidden from new selections and its users see a banner. A removed voice marks the row `failed`, marks its agents' voice sync `failed`, and switches them to the curated voice of their language (turn off with `ELEVENLABS_LIBRARY_REMOVAL_AUTO_SWITCH=false`). A withdrawn notice is cleared on the next check. |
| V:shared-voices-search | done | `/api/voices` (library source) accepts `use_case` (default `conversational`, or `all`), `accent` (from `GET /v1/voices/accents`), `age`, `high_quality` (`category=high_quality`), `featured` and `sort` (`created_date`, `usage_character_count_1y`, `trending`, `cloned_by_count`; default `cloned_by_count`). `include_live_moderated=false`, `include_custom_rates=false` and `min_notice_period_days` are always forced on the server. Within a page, voices verified for the agent's language with the model it speaks it with come first, then voices verified for the language. `locale` is not sent (see §14). |
| V:shared-voices-add | done | `isAlreadyAddedError`: a `conflict`, or a `validation` error whose detail matches `already exists/added/in`, `voice_already…` or `duplicate`, whatever the HTTP status. It reuses the existing workspace copy (`findWorkspaceCopy` now also checks the public owner and skips `copied_disabled` copies). A row that was `deleted` or `failed` reuses a usable workspace copy before adding a new one. Workspace voice-limit and add/edit-limit errors from this endpoint map to 503 `voice_capacity` (§5). |
| V:voices-orphan-reconcile | done | `scanOrphanVoices` lists `voice_type=non-community` for categories `cloned` and `generated`. It keeps the voices this platform created (description `Instant clone for org <uuid>` / `Designed voice for org <uuid>`, or a name ending with the `[xxxxxxxx]` org tag) that are older than 24 h and have no `provider_voices` row (any status, any owner) and are not in the purge queue. Dry run by default: voice id, category, org tag and age (never names). Deletion is done by the admin route with `apply: true`, or by maintenance only when `ELEVENLABS_VOICE_ORPHAN_DELETE=true`. Deleted voices also get their speech history purged, and are audited. Organization deletion is covered by the purge queue (§8). Professional clones are not scanned (the platform never creates them). |
| V:ivc-instant-clone | done | Plan gate: custom voices need Pro or higher (`voiceCloning` in `lib/pages/entitlements.ts`), otherwise 403 `reason: plan` with `required_plan`. Per-org cap on ready cloned and designed voices: `ELEVENLABS_MAX_CLONES_PER_ORG` (default 2), 409 `reason: custom_voice_limit`, re-checked after insert so two concurrent requests cannot both pass. Workspace preflight on the cached `GET /v1/user/subscription` (60 s): 503 `voice_capacity` with a generic message. Plan and cap are checked before the upload is read. The clone dialog adds an optional gender (sent as a label and stored) and a "My recordings have background noise" checkbox (`remove_background_noise`, default off, as the spec advises). Not done: in-browser recording. |
| V:voice-design | done | `POST /api/voices/design` generates previews with `POST /v1/text-to-voice/design` (`stream_previews: false`, base64 audio in the response, no retry). The model is `eleven_multilingual_ttv_v2` unless `ELEVENLABS_VOICE_DESIGN_MODEL=eleven_ttv_v3`. The text is the receptionist sample for the language, padded to the required 100 characters. Each `generated_voice_id` is recorded in `voice_design_previews` for the org, with a 1 h expiry. `POST /api/voices/design/save` claims one of the org's own unexpired, unused previews atomically, then calls `POST /v1/text-to-voice` with our own description, `played_not_selected_voice_ids` and a tagged name, and registers the voice as the org's own `designed` row. Unknown, foreign, expired or used ids all get the same 404. A failed registry write deletes the new voice again. The plan gate, per-org cap, workspace preflight and rate limits all apply. The picker has a "Design a voice" dialog. |
| V:tts-preview | done | Previews now send the agent's `voice_settings` (stability, similarity, speed, clamped like the agent's TTS config), its pronunciation locator, and the preview model for the language. `language_code` is omitted for `eleven_multilingual_v2`. They are sent with `enable_logging=false` (zero retention), with a fallback when the account refuses it (§7). `phone_quality: true` returns 8 kHz WAV (`audio/wav`). Only the server supports that option for now: there is no UI toggle yet. |
| V:pronunciation-dictionaries-api | done | One dictionary per organization (`ntv:<env>:org:<orgId>`), created on the first save with `add-from-rules`. `workspace_access` is never sent. Later saves use `remove-rules` and `add-rules` from a diff. If the stored version differs from the provider's `latest_version_id`, the save uses `set-rules` to resync. Each save creates a new version, which is stored on `agents.pronunciation` with compare-and-set (a concurrent save gets 409 and the dictionary it created is retired). Dictionaries are emptied and archived, never deleted (there is no DELETE endpoint). Alias rules only. `deleteOrgPronunciation(orgId, log)` is exported for slice H. |
| V:agent-tts-pronunciation-locators | done | `AgentSpec.pronunciationLocator`. `tts.pronunciation_dictionary_locators` is always sent: `[{pronunciation_dictionary_id, version_id}]`, or `[]` when there are no rules, which clears it. Client overrides stay disabled. Only the ElevenLabs agent is synced after a save. The Cartesia fallback has no dictionary. |
| A:tts-pronunciation-dictionaries | done | Same as the two items above. The dictionary is stored on the agent row (`agents.pronunciation`), not in a separate table. Deleting an organization queues its dictionary for archiving (§8). |
| V:tts-history-retention | done | `lib/elevenlabs/api/history.ts`: list and delete. Deleting a custom voice (by the tenant, an orphan delete, or the purge queue) also deletes its `source=TTS` history items. `POST /api/admin/voice/tts-history` lists or deletes TTS items older than N days (dry run: counts per voice category only). Daily maintenance purge only when `ELEVENLABS_TTS_HISTORY_RETENTION_DAYS` is set. New previews ask for zero retention (§7). |
| CRITIC:tts-history-item-retrieval | skipped | By design: history items are workspace-wide and are never read back or proxied. |
| CONV:webhook-voice-removal | done | A dedicated receiver at `POST /api/elevenlabs/voice-notice` (its own HMAC secret, verified like the post-call webhook, fails closed). It handles the `voice_removal_notice`, `voice_removal_notice_withdrawn` and `voice_removed` types, defensively parsed. Each delivery is deduplicated in `webhook_events` (minimal payload: type, voice ids, timestamp) and triggers the lifecycle check of the named voices after the response. Only orgs whose agents use the voice see a banner. The scheduled poll remains the source of truth. Emails are not sent (§14). Manual setup in §4. |
| Q:workspace-webhook-voice-removal-notice | done | Same receiver. The subscription is a manual operator step (§4), because changing the workspace webhook's `events` replaces the complete set. |
| A:tts-voice-id | done | A new agent without a voice gets the top curated voice for its language (`spec.defaultVoiceId`, only when no ElevenLabs agent exists yet). An existing agent saved without a voice has the provider's actual voice pinned (`pinRemoteVoice`, by maintenance and by `GET /api/agent/voice`), so the tenant sees it and the banner. It is never silently changed. Curated voices are platform-wide library rows only, never another tenant's clone. |
| V:voice-accents | done | `GET /api/voices/accents?language=` → `GET /v1/voices/accents`, cached 24 h per language, behind auth and rate limit. It feeds the accent select in the picker. |
| V:voices-get | partial | `ELVoice` gains `sharing.status`, `disable_at_unix`, `live_moderation_enabled`, `rate`, `fiat_rate` and `safety_control`, and `verified_languages[].model_id` is read. They are used by the lifecycle check, by classification in the default-voice migration, and by language-fit ranking in the library listing and curation. **Not done:** a non-blocking warning in `PUT /api/agent/voice` when the voice is not verified for the agent's language. The ranking already puts verified voices first. |
| V:similar-voices | skipped | It needs an uploaded voice sample (biometric), a separate consent text, MIME and magic-byte checks, and its own rate limit. That is not cheap enough for this slice. |

### Bugs routed to this slice

| Bug | Status | Fix |
|---|---|---|
| voice-catalog.ts:590: default voices listed, accepted and labelled "Recommended" | fixed | Not listed. Refused as a new choice. Curated platform voices carry `recommended`. A premade voice on a card is labelled "Retiring". Migration, banner and reports as in §3. |
| voice-catalog.ts:863: library rows never re-checked | fixed | Lifecycle check (V:voices-library-lifecycle-monitoring). A registry row with a `notice` is refused as a new choice and hidden from listings (`registryPage` filters `notice IS NULL`). |
| clone/route.ts:141: no plan gate, no per-org cap, no capacity preflight | fixed | §5. |
| 010:386: org deletion cascades away clone rows and leaves the voices | fixed | `BEFORE DELETE` trigger on `organizations` queues the org's cloned and designed voices and its dictionary in `provider_voice_purge`, drained by maintenance (§8). The cascade is unchanged: `owner_org_id` never becomes NULL. Orphan scan as a safety net. |
| client.ts:463: previews stored in the shared speech history | fixed | `enable_logging=false` with fallback; history purge on voice deletion; retention purge (§7). |
| voice-catalog.ts:794: "already exists" reuse only on HTTP 409 | fixed | `isAlreadyAddedError` (V:shared-voices-add). |
| client.ts:466: preview ignores tuning, dictionary and model | fixed | V:tts-preview. |
| voice-catalog.ts:858: multilingual library voice disappears from its language | fixed | `provider_voices.languages text[]` (all verified languages, backfilled from `language`). `registryPage` matches `language`, `languages` or `featured_languages`. The option shows the requested language for a multilingual row. |
| 022 (formerly 011):79: `created_by` of platform-wide rows readable by every tenant | fixed | Platform-wide rows are written with `created_by = NULL`. Migration 015 clears existing values, and a trigger (`scrub_platform_voice_creator`) keeps it that way. The actor stays in `audit_log`. |
| voices/route.ts:25: no `neutral` gender | fixed | `female`, `male`, `neutral` in the route schema, the hook and the picker. |

## 2. Endpoints and fields used (checked against the OpenAPI spec of 2026-10)

New wrappers live in `lib/elevenlabs/api/voices.ts`, `lib/elevenlabs/api/pronunciation.ts` and `lib/elevenlabs/api/history.ts`. They use `req`, `T` and `Ctx` from `client.ts`. POSTs that create resources use `NO_RETRY`. No call sets `breaker` (none is on the live-call path).

| Endpoint | Fields | Retry |
|---|---|---|
| `GET /v2/voices` | `voice_ids[]` (≤ 100), `voice_type=non-community`, `category` (single), `page_size`, `next_page_token` | GET |
| `GET /v1/voices/{voice_id}` | `category`, `sharing.{status, disable_at_unix, live_moderation_enabled, rate, fiat_rate, original_voice_id, public_owner_id}`, `safety_control`, `verified_languages[].{language, model_id}` | GET |
| `GET /v1/shared-voices` | `search`, `language`, `gender`, `age`, `accent`, `use_cases[]`, `category=high_quality`, `featured`, `sort`, `page`, `page_size`, `min_notice_period_days`, `include_live_moderated=false`, `include_custom_rates=false` | GET |
| `GET /v1/voices/accents` | `language` → `{accent, language, code, name}` | GET |
| `POST /v1/voices/add/{public_user_id}/{voice_id}` | `new_name` | none |
| `POST /v1/voices/add` (multipart) | `name`, `files[]`, `description`, `labels {language, gender}`, `remove_background_noise` | none |
| `GET /v1/user/subscription` | `voice_slots_used`, `voice_limit`, `voice_add_edit_counter`, `max_voice_add_edits`, `can_use_instant_voice_cloning` | GET (cached 60 s) |
| `POST /v1/text-to-voice/design` | `voice_description` (20–1000), `model_id`, `text` (100–1000), `stream_previews: false`; query `output_format` | none, upload timeout |
| `POST /v1/text-to-voice` | `voice_name`, `voice_description`, `generated_voice_id`, `labels`, `played_not_selected_voice_ids` | none |
| `POST /v1/text-to-speech/{voice_id}` | `text`, `model_id`, `language_code` (omitted for `eleven_multilingual_v2`), `voice_settings {stability, similarity_boost, speed}`, `pronunciation_dictionary_locators` (≤ 3; we send ≤ 1); query `output_format` (`mp3_22050_32` / `wav_8000`), `enable_logging=false` | none |
| `POST /v1/pronunciation-dictionaries/add-from-rules` | `name`, `rules[] {type: alias, string_to_replace, alias, case_sensitive, word_boundaries}`, `description` (never `workspace_access`) | none |
| `POST /v1/pronunciation-dictionaries/{id}/add-rules`, `/remove-rules`, `/set-rules` | `rules[]` / `rule_strings[]` → `{id, version_id}` | none |
| `GET /v1/pronunciation-dictionaries/{id}` | `latest_version_id`, `rules` | GET |
| `PATCH /v1/pronunciation-dictionaries/{id}` | `archived: true` | idempotent |
| `GET /v1/history` | `voice_id`, `source=TTS`, `page_size` (≤ 1000), `start_after_history_item_id`, `date_before_unix` | GET |
| `DELETE /v1/history/{history_item_id}` | none | DELETE |
| `DELETE /v1/voices/{voice_id}` | none (existing wrapper) | DELETE |
| Agent body `conversation_config.tts` | `voice_id` (always explicit for new agents), `pronunciation_dictionary_locators[]` (always sent) | |
| Workspace webhook (manual setup) | event `voice_library_removal_notice`; delivered types `voice_removal_notice`, `voice_removal_notice_withdrawn`, `voice_removed`; header `elevenlabs-signature` | |

## 3. Default voices: retirement and migration

- **Listing:** `listVoices(workspace)` returns only registry rows the org can see (its own voices, then platform voices, curated voices for the language first by `featured_rank`). An old page token from the default-voice part of the listing ends the listing.
- **Eligibility:** `assertVoiceEligible(orgId, {voiceId, libraryRef, currentVoiceId})`. `currentVoiceId` is read on the server from the org's agent. A premade voice, or a registry voice with a `notice`, is accepted only when it is the current voice.
- **New agents:** `buildAgentSpec` sets `defaultVoiceId` (top curated voice for the language) only when the agent has no voice and no ElevenLabs agent exists yet. `agent-config.ts` uses it when `tts.voice_id` would otherwise be empty. Language without a curated voice: unchanged (provider default), reported in diagnostics.
- **Agents without a voice row:** `pinRemoteVoice` reads `tts.voice_id` from the provider agent and writes it only if `agents.voice_id` is still NULL (audit `voice.pinned`).
- **Migration:** `runDefaultVoiceMigration` loads agents (≤ 5,000), classifies voices outside the registry (in the default-voice listing → default; after the listing disappears, looked up one by one: `premade` → default, 404 → missing; non-default results are cached for 12 h per instance), and targets agents on a default voice, on a missing voice, or still without a voice. Before the migration date it only reports. From the date, maintenance switches up to 40 agents per run (90 s budget) through `applyAgentVoice` with a conditional update on the previous voice (an agent the tenant changed meanwhile is skipped), and audits `voice.default_migrated`.
- **Cadence:** report hourly. From the migration date, every quarter hour.

## 4. Library lifecycle and the voice-removal webhook

The lifecycle mapping (`evaluateLibraryVoice`) is:

- `safety_control` `BAN` or `ENTERPRISE_BAN`, `sharing.status=copied_disabled`, a voice confirmed missing, or a `disable_at_unix` in the past → **removed**.
- A `disable_at_unix` in the future → **removal_scheduled** (`retiring_at`).
- Any other `safety_control`, or `sharing.status=disabled` → **blocked**.
- `live_moderation_enabled` → **moderation**.
- `rate` or `fiat_rate` set → **custom_rate**.
- Otherwise → **ok**, which clears the notice.

Webhook setup (operator, once per environment):

1. Create a workspace webhook: `POST /v1/workspace/webhooks` with `settings: {auth_type: "hmac", name: "voice-notices-<env>", webhook_url: "https://<host>/api/elevenlabs/voice-notice"}`. Store the returned `webhook_secret` as `ELEVENLABS_VOICE_NOTICE_WEBHOOK_SECRET`. It is shown only once.
2. Subscribe it: `PATCH /v1/workspace/webhooks/{webhook_id}` with `{name, is_disabled: false, events: ["voice_library_removal_notice"]}`. `events` is the complete set, so do not add this event to the post-call webhook unless you resend its existing events.
3. The first real delivery logs `voice_notice.received` with the payload's keys only. Check that `voice_ids` were found (`voices > 0`). The payload format is not in the spec, and the parser accepts `voice_id`, `voice_ids`, `original_voice_id`, `public_voice_id` and `shared_voice_id` at the top level, under `data` and under `data.voice`.

Without the secret, the route answers 503 (fails closed) unless unsigned webhooks are explicitly allowed for local development (`allowUnsignedWebhooks`). The route is in the proxy's machine-to-machine list.

## 5. Custom voices: plan, cap, capacity

- **Plan:** `customVoicesAllowed(plan)` follows `voiceCloning` in `lib/pages/entitlements.ts`: trial and starter no; pro, business and custom yes.
- **Per-org cap:** ready `cloned` and `designed` rows owned by the org must stay below `ELEVENLABS_MAX_CLONES_PER_ORG` (default 2, range 0–50). It is checked before the provider call and again after the registry insert. The later of two racing requests deletes its voice again (`discardCustomVoice`).
- **Workspace capacity:** `assertWorkspaceVoiceCapacity(kind)` blocks clones and designs when `voice_slots_used ≥ voice_limit`, when `voice_add_edit_counter ≥ max_voice_add_edits` (also for library adds), or when instant cloning is unavailable. The tenant gets 503 `voice_capacity`: "New voices cannot be added on the platform right now. Please try again later or choose a voice you already have." Ops get an error log with the reason. If the subscription cannot be read, the check fails open, and the provider's own refusal maps to the same 503.
- **Rate limits:** clone 3/day (unchanged). Design 3/min and 10/day per org. Save a designed voice 5/day. Library provisioning 10/h (unchanged).
- **UI:** the "Clone a voice" and "Design a voice" buttons are disabled with the reason (plan, or the limit reached), read from `GET /api/voices/limits`.

## 6. Pronunciation

- **Rules:** `{term, say_as, case_sensitive (default false), word_boundaries (default true)}`. Up to 100 rules. `term` has at most 64 characters and `say_as` at most 128. Allowed characters are letters, marks, digits, space and `. , ' ’ & + / ( ) -`. Terms must be unique, ignoring case.
- **Endpoints:** `GET` and `PUT /api/agent/voice/pronunciation`. Saves are rate-limited to 30/h. The audit records counts only, because rules can contain names. The rules and the dictionary are stored in `agents.pronunciation`, and a tenant cannot write that column (`guard_voice_columns`).
- **After a change:** the revision is bumped and the ElevenLabs agent is synced right away if it exists. Otherwise it gets the locator when it is created.
- **Previews:** they use the same locator, so a rule can be heard before a call.

## 7. Previews and the speech history

- **Zero retention:** `ELEVENLABS_TTS_ZERO_RETENTION` defaults to on. Previews are sent with `enable_logging=false`, and the spec reserves zero retention for enterprise accounts. If the provider refuses it (a validation or auth error whose detail mentions retention, enterprise or logging), the instance logs `tts.zero_retention_refused` once and sends the following previews with logging.
- **Purge:** speech-history items of a deleted custom voice are purged right after the voice is deleted, up to 300 items, and this never fails the delete. Old items are purged by the admin route, or daily when `ELEVENLABS_TTS_HISTORY_RETENTION_DAYS` is set (at most 500 items per run, `source=TTS` only).

## 8. Orphans and the purge queue

- **Purge queue:** the `organizations` `BEFORE DELETE` trigger copies the org's non-deleted cloned and designed voice ids, and its dictionary id, into `provider_voice_purge` (unique per resource). `drainVoicePurgeQueue` runs on every maintenance pass, 25 rows at a time. Voices are deleted (404 = done) and their history is purged. Dictionaries are emptied and archived. Failures back off exponentially up to 24 h, with 10 attempts at most.
- **Orphan scan:** a daily dry run at 04:00 UTC, as described under V:voices-orphan-reconcile. Use the admin route to delete.

## 9. Migration 015 (`supabase/migrations/015_voice_lifecycle.sql`)

Additive and idempotent: no DROP. It uses `IF NOT EXISTS`, `duplicate_object` guards and `CREATE OR REPLACE` for functions and triggers. It was checked twice on a scratch PostgreSQL 16 with the 010 tables: two runs in a row, guards, triggers, RLS and grants.

- **`provider_voices`:**
  - New columns `languages text[]`, `featured_languages text[]`, `featured_rank int` (0–1000), `notice` (checked list), `retiring_at`, `sharing_status`, `safety_control` and `lifecycle_checked_at`.
  - Only platform-wide rows can have `featured_languages`.
  - `languages` is backfilled from `language`.
  - New indexes: GIN on `featured_languages` and `languages`, a partial lifecycle index, and `agents(voice_id)`.
  - `created_by` is cleared on platform-wide rows, and the `scrub_platform_voice_creator()` trigger keeps it cleared.
- **`agents.pronunciation jsonb`:** guarded by `guard_voice_columns()` (trigger `agents_guard_voice`, alongside `guard_platform_columns()`, which is not redefined).
- **`voice_design_previews`:** RLS on, the owning org can SELECT, writes go through the service role only.
- **`provider_voice_purge`:** RLS on, with no tenant access at all.
- **`queue_org_voice_purge()`:** the `BEFORE DELETE` trigger on `organizations`.
- **Function hardening:** every function has `SET search_path = public` and `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`.

**Deploy order:** apply 015 before deploying the code, because the agent loader selects `agents.pronunciation`. Then run the curated-voice proposal and approval (§13, step 1) for every language you serve before 2026-12-15.

## 10. Environment variables (none added to `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT` | `2026-12-15T00:00:00Z` | When maintenance starts switching agents off default voices. An invalid value falls back to the default and is reported in diagnostics. |
| `ELEVENLABS_MAX_CLONES_PER_ORG` | `2` | Ready custom voices (clones and designed voices) per org, 0–50. |
| `ELEVENLABS_TTS_ZERO_RETENTION` | on | `false` sends previews with history logging. |
| `ELEVENLABS_TTS_HISTORY_RETENTION_DAYS` | unset (off) | 1–365: daily purge of TTS history items older than N days. Confirm first that nothing else in the workspace relies on the TTS history. |
| `ELEVENLABS_VOICE_ORPHAN_DELETE` | `false` | `true` lets maintenance delete orphaned custom voices. Otherwise it only reports them. |
| `ELEVENLABS_LIBRARY_REMOVAL_AUTO_SWITCH` | on | `false` keeps agents on a removed library voice (marked failed) instead of switching them to the curated voice. |
| `ELEVENLABS_VOICE_DESIGN_MODEL` | `eleven_multilingual_ttv_v2` | Or `eleven_ttv_v3`. Other values are ignored. |
| `ELEVENLABS_VOICE_NOTICE_WEBHOOK_SECRET` | none | HMAC secret of the voice-notice workspace webhook. Without it the receiver fails closed. |

## 11. UI changes

- **Voice picker:**
  - Gender adds "Neutral".
  - The Voice Library tab has a filter row: "Phone conversation voices" (`use_case`, on by default), an accent select loaded from `/api/voices/accents`, age, "Studio quality" and sort.
  - Curated voices show a "Recommended" badge. A default voice is labelled "Retiring".
  - A "Design a voice" button opens the Voice Design dialog: description, optional sample text, three previews to play, then a name and Save.
- **Clone dialog:** optional gender and a "My recordings have background noise" checkbox.
- **Voice tab:**
  - A banner for the current voice's notice, with "Choose a new voice", which scrolls to and focuses the picker. It appears both while the agent loads its voice and after.
  - The custom-voice list includes designed voices.
  - The clone and design buttons are disabled with the reason.
  - A new "Pronunciation" card (word → how to say it, an "Exact case" option, add, remove, save) sits after voice tuning. Rules from the UI always match whole words.
  - A voice pinned by the status call refreshes the agent.

## 12. Admin endpoints

All use `requireAdmin` (`ADMIN_API_TOKEN` or `PLATFORM_ADMIN_USER_IDS`) and the same-origin check, and default to a dry run.

- `POST /api/admin/voice/curated`
  - `{dry_run: true, languages?, per_language?}` returns the proposals.
  - `{dry_run: false, approve: [{language, public_owner_id, voice_id, rank}], remove?: [{language, voice_id}]}` provisions and curates.
- `POST /api/admin/voice/default-voices`
  - `{}` reports.
  - `{apply: true}` runs the migration step, which switches voices only from the migration date.
  - `{apply: true, force: true}` switches now.
  - `{check_library: true}` runs the library lifecycle check now.
- `POST /api/admin/voice/orphans {apply?, min_age_hours?}`
- `POST /api/admin/voice/tts-history {apply?, older_than_days?, limit?}`
- `GET /api/admin/voice/diagnostics` now includes `voices`: agent counts (total, on a default voice, on an unregistered voice, without a voice), curated voices per language and the languages without one, library voices (ready, with a notice, removed), active custom voices, pending purge rows, the configuration (whether the webhook secret is set, never its value) and problems.

## 13. Manual staging verification (no live calls are automated)

1. **Curated voices:** `POST /api/admin/voice/curated {"dry_run": true, "languages": ["ro","en"]}`. Listen to the candidates' `preview_url`, then approve 1–3 per language with ranks. Check that the picker's "Recommended & yours" tab lists them first with the badge.
2. **Default voices:** with an agent on a premade voice, open the Voice tab. The banner should read "This voice will stop working on 31 Dec 2026 — choose a new voice…", and "Choose a new voice" should focus the picker. Default voices should no longer be listed, a re-save of the current voice should still work, and `PUT` with another premade id should return 403.
3. **Migration dry run:** `POST /api/admin/voice/default-voices {}`. Check the counts, then `{"apply": true, "force": true}` on a test org only. The agent should switch, sync and get an audit row.
4. **Library lifecycle:** `POST /api/admin/voice/default-voices {"check_library": true}`. Every ready library row should get `lifecycle_checked_at`.
5. **Voice-notice webhook:** set it up (§4) and send a test delivery from the ElevenLabs dashboard if available. Check the 200 response and the `webhook_events` row with `event_type` `voice_removal_notice`. A wrong signature should get 401.
6. **Cloning gates:** a starter org should get the disabled button and a 403. A pro org can make 2 clones, and the third gets 409. A temporary `ELEVENLABS_MAX_CLONES_PER_ORG=0` should give the limit message.
7. **Voice Design:** design with a 20+ character description. Three previews should play, saving one should register a `designed` row, and saving the same id again should return 404. A preview id of another org should return 404.
8. **Pronunciation:** add "NTV → en ti vi" and save. The agent sync should show synced, and `GET /v1/convai/agents/{id}` should contain the locator. The preview should say the alias. Remove all rules: the locator array should be empty.
9. **Previews:** check the logs for `tts.zero_retention_refused`. If it appears, the account is not enterprise, so set `ELEVENLABS_TTS_HISTORY_RETENTION_DAYS` (for example 7) after a dry run of `POST /api/admin/voice/tts-history {}`.
10. **Orphans:** `POST /api/admin/voice/orphans {}` should be a dry run with no names. Delete only after reviewing the list.
11. **Diagnostics:** `GET /api/admin/voice/diagnostics` should include the `voices` block, with no secrets.

## 14. Remaining limitations

- **Zero retention:** not verified for non-enterprise accounts. The fallback is per instance and in memory.
- **Shared-voices search:** the `use_cases` value casing (`conversational`) and the accent codes are taken from the spec and docs, not verified live. `locale` is not sent.
- **Voice-notice payload:** not documented in the spec. The parser is defensive, and the scheduled poll remains the source of truth.
- **Notifications:** no email. Tenants see the banner in the Voice tab only.
- **Entitlements:** plan gating reads `lib/pages/entitlements.ts`, which is also used for marketing copy. A future billing slice should move entitlements to a server-only module.
- **Curation:** `featured_rank` is one rank per voice, not per language.
- **Maintenance budgets:**
  - At most 40 migrations per run.
  - At most 5,000 agents scanned.
  - At most 200 voice lookups per run.
  - At most 10 auto-switches per lifecycle run.
  - At most 25 purge rows per run.
  - Larger fleets need several runs.
- **Side effect of the status call:** `GET /api/agent/voice` can pin the provider's voice on an agent saved without one, which is a write. It only fills a NULL with the provider's actual value.
- **Voice Design:** previews are returned inline as base64. There is no streaming route.
- **Professional clones:** not covered by the orphan scan.
- **Similar voices:** skipped.

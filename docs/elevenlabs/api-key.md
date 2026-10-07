# ElevenLabs API key: permissions, migration, rotation, data residency

The platform uses **one** ElevenLabs API key (`ELEVENLABS_API_KEY`) for the shared workspace that serves every tenant. Tenants never bring their own key. This page lists what the key must be allowed to do, how to move to a least-privilege service-account key without breaking production, how to rotate or emergency-disable it, and what would change for an EU-isolated environment.

## 1. Required permissions

The OpenAPI spec (`PermissionType`, downloaded 2026-10-07) does not map endpoints to permissions. The mapping below is derived from the permission names and the endpoint areas the code calls (every wrapper in `lib/elevenlabs/client.ts` and `lib/elevenlabs/api/*`). It is **unverified live**: check it on staging (§3, step 4). There is no knowledge-base permission: the knowledge base is part of `convai_*`.

| Permission | Used by |
| --- | --- |
| `convai_read` | Agents (get, list, topics), conversations (list, get, audio), knowledge base (get, content, RAG status), tools (get, list, executions, dependent agents), workspace secrets (get, list), phone numbers (get, v2 list), LLM list, live count, ConvAI settings (get), agent testing (get, list, test invocations), WebRTC conversation token (browser tests) |
| `convai_write` | Agents (create, update, delete), knowledge base (create, update, delete, RAG index, crawl), tools and secrets (create, update, delete), phone numbers (import, update, delete), `twilio/register-call` and `twilio/outbound-call`, conversations (delete, feedback, analysis run), ConvAI settings (PATCH), agent testing (create, update, run) |
| `voices_read` | Voice search (`/v2/voices`), voice details, shared library (`/v1/shared-voices`), accents |
| `voices_write` | Deleting platform voices (orphans, rejected clones) |
| `create_instant_voice_clone` | Custom voices (`POST /v1/voices/add`) |
| `add_voice_from_voice_library` | Library voices (`POST /v1/voices/add/{owner}/{voice}`) |
| `voice_generation` | Voice Design (`/v1/text-to-voice/design`, `/v1/text-to-voice`) |
| `text_to_speech` | Voice previews (`/v1/text-to-speech/{voice}`) |
| `models_read` | TTS model catalogue (`/v1/models`) |
| `pronunciation_dictionaries_read` / `_write` | Pronunciation rules (slice F) |
| `speech_history_read` / `_write` | Preview history retention (slice F) |
| `user_read` | Credit, voice-slot and billing monitoring (`/v1/user/subscription`, slice G). Without it the health probe falls back to the agents listing and the quota monitor reports `unknown`. |
| `webhooks_write` | Admin repair of the post-call webhook (`PATCH /v1/workspace/webhooks/{id}`, slice D) |

Not needed (leave off): `speech_to_speech`, `speech_to_text`, `sound_generation`, `audio_isolation`, `dubbing_*`, `projects_*`, `audio_native_*`, `forced_alignment`, `music_generation`, `image_video_generation`, `create_professional_voice_clone`, `publish_voice_to_voice_library`, `share_voice_externally`, `create_user_api_key`, `service_account_write`, `workspace_members_*`, `group_members_manage`, `audit_log_read`, `copy_resources_cross_workspace`, `flows`, `templates`.

Check on staging (unverified): listing workspace webhooks may also need `workspace_read`; agent writes that change privacy settings may need `conversation_privacy_manage`. A refused call shows as `permission` in admin diagnostics (`key_health.blocked_calls_24h`) and as `maintenance.provider_blocked` in the logs.

**Self-inspection probe:** none. The API has no endpoint that lets a key read its own permissions (`GET /v1/service-accounts/{id}/api-keys` needs workspace-admin rights over the service account). Missing permissions are detected at runtime instead: every refused call is counted by error code in `GET /api/admin/voice/diagnostics` (`key_health`), and the maintenance health probe logs `auth`, `permission` and `quota` failures as errors.

## 2. Spend cap and environments

* `character_limit` on the key ("requests that incur charges will fail after reaching this monthly limit"): set it to 2–3× the expected monthly spend. Too low a cap hard-stops every tenant's calls. The quota monitor (`elevenlabs_quota`) warns at 80 % and errors at 95 % of the **workspace** credits, not of a per-key cap.
* `allowed_ips` is impractical on Vercel (no fixed egress IPs). Leave it empty.
* Use a separate key with a lower cap for Preview and Development, ideally in a separate workspace. Agents, tools, secrets, tests and imports are environment-tagged (`ntv-env:`, `ntv:<env>:`, `ntv-platform <env>`), so one workspace can be shared, but a separate workspace isolates spend and data.

## 3. Staged migration to a service-account key

Per the ElevenLabs docs (workspaces → service accounts), a new service account **has access to no existing resource**. Switching `ELEVENLABS_API_KEY` without sharing first makes every sync, knowledge-base and voice call fail (403/404) for all tenants.

1. Create the service account (for example `ntv-prod`) in the workspace settings, or `POST /v1/service-accounts`.
2. Create its key: `POST /v1/service-accounts/{service_account_user_id}/api-keys {name, permissions: [the list in §1], character_limit}`. Keep `third_party_disable_allowed` at the workspace default (allowed).
3. Give it access to every existing resource: add the service account to a group that has editor access to all ConvAI agents, knowledge-base documents, tools, secrets and voices, or share each resource with `POST /v1/workspace/resources/{resource_id}/share {role: 'editor', resource_type, workspace_api_key_id}` (the key's id, not the key string).
4. Verify read-only with the **new** key before swapping (from a shell, not the app): `GET /v1/convai/agents/{id}` for every `agent_provider_resources.external_id`, `GET /v1/convai/knowledge-base/{id}` for every stored document, `GET /v1/convai/tools/{id}` and `GET /v1/convai/secrets/{id}` for every `platform_resources` row, `GET /v1/voices/{id}` for the voices in use, and `GET /v1/user/subscription`. Every call must return 200.
5. Swap `ELEVENLABS_API_KEY` in the environment and redeploy. Run `GET /api/admin/voice/diagnostics?probe=1`: no `PROVIDER_KEY` problem, `elevenlabs_quota.status` is not `unknown`.
6. Keep the old key for 48 hours, then delete it.

## 4. Rotation and emergency disable

* **Rotation:** create the new key (same permissions and sharing), verify as in §3 step 4, swap the env var, redeploy, check diagnostics, then delete the old key. Calls in progress keep working: the key is only used for API calls, not by live conversations.
* **Leak:** keep third-party disabling allowed (`POST /v1/workspaces/api-keys/third-party-disabling {third_party_disable_allowed: true}` is the default), so ElevenLabs or whoever finds a leaked key can disable it. A disabled key cannot be re-enabled with itself: rotate. To disable the platform key yourself in an emergency: `POST /v1/workspaces/api-keys/disable?api_key_name=self` with that key. This stops every tenant's AI calls until the new key is deployed; app-routed numbers fall back to Cartesia.
* **Detection:** a revoked, auto-disabled or leak-disabled key makes the maintenance health probe fail with `auth`. Since slice G that is logged as `maintenance.provider_blocked` at **error** level, emitted as a `health_check` provider event (`operation: provider_blocked`), and shown in diagnostics (`key_health.last_probe`, problem `PROVIDER_KEY`). Every API call refused with `auth`, `permission` or `quota` in the last 24 h is counted there too. With the daily Vercel cron the probe runs once a day; install the 5-minute scheduler (`supabase/ops/schedule_voice_maintenance.sql`) for timely alerts.

## 5. Data residency (EU-isolated environment)

Data residency is an Enterprise feature. It runs agents, conversations, voices and the knowledge base in an isolated environment with its own API host and key. Nothing here is automated; this is the procedure and what would change.

What changes:

* **Base URL:** `ELEVENLABS_API_BASE_URL=https://api.eu.residency.elevenlabs.io` (already supported by the client; covered by `lib/elevenlabs/client.test.ts`). Browser tests pick the matching SDK `serverLocation` (`eu-residency`, WebRTC via `livekit.rtc.eu.residency.elevenlabs.io`) from that variable (`sdkServerLocation()` in `lib/voice-providers/web-test.ts`).
* **Key and webhook:** a separate API key, and a new workspace post-call webhook with a new HMAC secret (`ELEVENLABS_WEBHOOK_SECRET`). The docs say post-call webhooks "require out-of-region processing": webhook payloads leave the region to reach our endpoint (Vercel `dub1`, EU).
* **LLM:** the agent's LLM must be offered in the residency environment. The sync already validates `ELEVENLABS_LLM` against `GET /v1/convai/llm/list` of the configured environment (`lib/elevenlabs/llm-selection.ts`) and falls back to the default when it is not offered; check `regional_processing_surcharge` in that list.
* **Resources:** agents, imports, tools, secrets, knowledge-base documents and instant clones live in the old environment and are not migrated.

Procedure:

1. In the new environment: create the workspace webhook and secret, set `PATCH /v1/convai/settings`, create the API key per §1–§3.
2. Check the configured LLM in `GET /v1/convai/llm/list` of that environment.
3. Switch the env vars on a staging deployment, run reconcile with apply (`POST /api/admin/voice/reconcile`): tagged agents are recreated from our database.
4. Re-import native numbers (`PATCH /api/phone/[id]` or the diagnose repair), re-upload knowledge-base documents from Supabase storage, replicate or re-clone custom voices from the stored consented samples (`POST /v1/voices/{voice_id}/replicate-to-isolated-environment`, with ElevenLabs' help for instant clones).
5. Run the platform regression suite (`POST /api/admin/voice/tests`, `sync` then `run`) against a canary agent in the new environment.
6. Only then update the public privacy copy (`lib/site.ts`, `lib/pages/custom-saas-platforms.ts`), which today says ElevenLabs data is stored in the US.

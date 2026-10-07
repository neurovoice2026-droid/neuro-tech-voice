# Slice H: Tenant offboarding and account deletion

This slice adds account deletion: a GDPR Art. 17 erasure across every provider the platform uses. An owner can delete the account from **Settings → Danger zone → Delete account**. A platform admin can offboard any organization, with a dry run first. Both paths open the same durable, resumable job, and the maintenance cron finishes it.

All tenants share one ElevenLabs workspace, so tenant isolation is the main constraint:

* Every external id the job uses is read from the organization's own rows, or listed for the organization's own agent after that agent's ownership was checked at the provider.
* Nothing is ever looked up by name or search.
* Platform-wide resources are never touched: library voices with `owner_org_id` NULL, platform tools, the tool secret, and workspace webhooks and settings.

## 1. Audit items

| Item | Status | Notes |
|---|---|---|
| CRITIC:agent-delete-tenant-offboarding | done | `lib/account/delete.ts` and `lib/account/steps/*`. The executor is new code, written for the current architecture; the unmerged branch was not merged. Conversations are listed by `agent_id` **while the agent still exists** (step `collect_call_records`). After that, numbers are already released, the agent is deleted, and the conversations are deleted by their ids. All calls go through `lib/elevenlabs/client.ts` and `lib/elevenlabs/api/*`, so `ELEVENLABS_API_BASE_URL` and the retry policy apply, and there is no hard-coded host. `deleteExternalAgents` is not used. Its replacement, `steps/agents.ts`, checks at the provider that each agent belongs to this organization (tags, see §3) before it deletes it, and it handles a provider without a key. `DELETE /api/account` requires a sign-in within 30 minutes (`REAUTH_WINDOW_MS`, `lib/account/confirmation.ts`), as the marketing pages say. `DELETION_ORDER` still starts with `cancel_subscriptions` and ends with `delete_auth_user`, which `lib/pages/custom-mobile-applications.ts:85` checks; a test now imports that page. |
| KB:kb-bulk-delete | done | The wrapper and `deleteAllOrgKnowledge` come from slice E (bulk-delete, 20 ids per call, `force: true`, per-id 404 counts as done, organization folder last). The `delete_knowledge_copies` step calls it before the organization row is deleted. A report with `failed > 0` fails the step, which is then retried. The reconcile part of the bug is fixed too: before the admin reconcile deletes an orphan ElevenLabs agent, `deleteOrphanAgentKnowledge` (`lib/account/orphan-knowledge.ts`) bulk-deletes that agent's `knowledge_base` locators. It only deletes ids that **no** row of ours still references, in any organization (`knowledge_documents.elevenlabs_doc_id`, `knowledge_crawls.root_folder_id`, `knowledge_folders.folder_id`). Duplicate agents are skipped, because they share the live agent's documents. |
| V:voices-orphan-reconcile | done | The orphan scan, the `provider_voice_purge` queue and the `BEFORE DELETE` trigger were delivered by slice F. Offboarding now deletes the organization's own `cloned` and `designed` voices explicitly (step `delete_voices`), purges their speech history, and marks the rows `deleted`, so F's trigger does not queue them again. The queue stays as the safety net, for example when the ElevenLabs key is missing. Library voices are never touched. |

### Bugs routed to this slice

| Bug | Status | Fix |
|---|---|---|
| deletion-plan.ts:3: `lib/account/delete.ts` missing, no account-closure route, `deleteExternalAgents` without a caller, conversations never deleted | fixed | `lib/account/delete.ts`, `DELETE /api/account`, `POST /api/admin/accounts/[orgId]/offboard`, and the Settings danger zone. `collect_call_records` pages `GET /v1/convai/conversations?agent_id=<org agent>&cursor&page_size=100` before `delete_agents`, and `delete_call_records` deletes each id: bounded, concurrent, resumable, with a per-item backoff. |
| deletion-plan.ts:3: `delete_knowledge_copies` declared but not implemented; reconcile deletes orphan agents without their documents | fixed | See KB:kb-bulk-delete above. |

`lib/account/deletion-plan.ts` is rewritten to match the executor. It is still pure: the step order, the step types and the `runSteps` runner, which is resumable and stops at a deadline, a yield or a failure. `runDeletionPlan`, `CRITICAL_DELETION_STEPS` and `AccountDeletionError` are removed. They had no callers; the only importer, the marketing page, uses `DELETION_ORDER` only.

## 2. The deletion job

Tables: `account_deletions` holds one job per request, and only one open job per organization. `account_deletion_items` holds the provider call records to delete.

**Request.** `requestAccountDeletion` opens the job, or returns the open one. It also sets `organizations.deletion_requested_at`. From then on:

* `requireOrg()` answers **403 `account_deleting`** to every tenant API call. Only the Settings page and `DELETE /api/account` pass `allowDeleting`.
* `syncAgent()` returns without touching any provider (`lib/account/state.ts`), so neither maintenance retries nor config rollout can re-create an agent.

**Run.** `runAccountDeletion(jobId, {budgetMs})`:

* It claims a lease (compare-and-set on `lease_owner`), so only one run works on a job at a time.
* It runs the steps from the saved step and saves `step`, `counts` and `state` (cursors) after each one.
* When the step fails, the job records `attempts`, `last_error` (a short code, redacted) and `next_attempt_at`. The backoff goes 1 min, 2 min, 5 min, 15 min, 30 min, 1 h, 3 h, 6 h.
* After `MAX_STEP_ATTEMPTS` (8) consecutive failures of the same step, the job becomes `needs_attention` and logs an error. Only an admin request reopens it.
* A step that reaches its deadline returns `more` and continues on the next run.
* A failed step is **never skipped**: later steps would delete the ids it still needs.

**Background and maintenance.**

* The request starts the first run with `deferBackground` (budget 240 s; the routes' `maxDuration` is 300 s).
* The maintenance step `account_deletions` is one line in `maintenance.ts` (`resumeAccountDeletions`, at most 5 jobs and 90 s per cron run). It continues due jobs, and a crashed run once its lease has expired.
* Three hours after completion, it runs a **storage sweep** again: a signed upload URL issued before the deletion can stay valid for up to 2 h.
* It also purges archive rows past their legal retention.

| # | Step | What | Where | Idempotency / 404 |
|---|---|---|---|---|
| 0 | `block_activity` | Set `deletion_requested_at`, pause the agent (`is_active=false`: the router and the initiation webhook refuse calls), ban the sign-in (`ban_duration 876000h`) | DB, Supabase Auth | Conditional updates; ban 404 = gone |
| 1 | `cancel_subscriptions` | Expire the customer's open Checkout sessions. Cancel every live subscription: the plan, each phone number's own subscription, and any other subscription of the customer. A stored id is cancelled only if it belongs to the organization's customer, or carries its `org_id` metadata. The Stripe customer is kept. | Stripe | `retrieve` first; `canceled`/`incomplete_expired` or `resource_missing` = done |
| 2 | `release_numbers` | Delete the ElevenLabs import (label checked: this org, this environment), delete the Cartesia SIP import, release the Twilio number. Once every provider has answered, the row's ids are cleared. | ElevenLabs, Cartesia, Twilio | 404 = done; development `mock…` SIDs skipped |
| 3 | `collect_call_records` | Items from `calls` (conversation id, Cartesia call id, CallSid) and `sms_messages` (message SID), keyset-paginated. Then each **verified** agent is listed: `GET /v1/convai/conversations?agent_id=` with a cursor, and the Cartesia calls of the fallback agent. Each listed item must carry the requested agent id. | DB, ElevenLabs, Cartesia | Upsert ignoring duplicates; the cursor is stored in `state` |
| 4 | `delete_agents` | Delete the ElevenLabs and Cartesia agents, and the legacy `agents.elevenlabs_agent_id`. A resource row is removed only after the provider confirmed. Slice D's sweep watermarks are dropped. | ElevenLabs, Cartesia | 404 = done; foreign agents are skipped and counted |
| 5 | `delete_call_records` | Delete the items in batches of 40, 4 at a time: conversations, Cartesia calls, Twilio call and message records. A failure backs off on its own (2, 4, 8… up to 30 min). After 5 attempts the item is `gave_up` and counted. | ElevenLabs, Cartesia, Twilio | 404 = `already_gone` |
| 6 | `delete_knowledge_copies` | `deleteAllOrgKnowledge` (slice E): cancels crawls, bulk-deletes documents, website folders and the org folder with `force` | ElevenLabs | Per-id 404 = done |
| 7 | `delete_pronunciation` | `deleteOrgPronunciation` (slice F): empties and archives the dictionary (there is no DELETE endpoint) | ElevenLabs | 404 = gone |
| 8 | `delete_voices` | The org's own `cloned`/`designed` voices: `DELETE /v1/voices/{id}`, purge their speech history, mark the row `deleted` | ElevenLabs | 404 = done |
| 9 | `revoke_google` | `POST https://oauth2.googleapis.com/revoke` (form body), then erase `google_refresh_token` and set `is_active=false`. A transient failure is retried twice; after that the token is erased anyway. | Google | 400 = already invalid |
| 10 | `delete_storage` | Every object under `knowledge-documents/<org_id>/`. The id must be a UUID and every path must start with that prefix. At most 5,000 files per run. | Supabase Storage | Re-listed each run |
| 11 | `archive_billing_records` | `archive_org_billing_records(org)`: copies the invoices and the monthly usage totals into the archive. The step fails if fewer invoices were archived than exist. | DB | `ON CONFLICT` |
| 12 | `delete_organization` | Billing re-check: open checkouts and live subscriptions are cancelled again. Then the organization row is deleted, and every tenant table cascades. | Stripe, DB | 0 rows = done |
| 13 | `delete_auth_user` | Read the sign-in email (kept in memory only), delete the Supabase user, send the confirmation email (best effort) | Supabase Auth, Resend | 404 = done |

At completion the items are deleted. The job row stays as a **tombstone**: org id, user id, requester id, the channel (self-service or admin), the steps' counts and timestamps. It holds no name, email, number or provider id.

**Not configured.** When a provider key is missing in the deployment, its resources cannot be deleted. They are counted as `not_configured`, an error is logged, and the job continues. Its voices and dictionary still reach slice F's purge queue through the organization trigger.

## 3. Isolation and safety

* Provider ids come only from the organization's rows. The browser never sends one: the self-service body is `{confirm}` (strict), and the admin path takes the organization id only.
* **Agents** are checked at the provider before they are listed or deleted. An ElevenLabs agent is foreign when it carries an `ntv-env:` tag of another environment, an `ntv-org:` tag of another organization, or an `ntv-agent:` tag of another local agent. A Cartesia agent is foreign when its `ntv-agent:` marker names another local agent. A foreign agent is never listed or deleted, and our reference to it is dropped and counted. Untagged legacy agents count as ours, because they are referenced by our own row.
* An **ElevenLabs import** whose label (`ntv:<env>:<org>`) names another environment or organization is never deleted.
* **Stripe**: a stored subscription of another customer is never cancelled.
* **Storage**: only the `<org_id>/` prefix is listed and removed.
* **Never touched**: library voices (`owner_org_id` NULL) and other organizations' voices, platform tools, the workspace tool secret, workspace webhooks and settings, the Stripe customer and its invoices, and events in the owner's own Google Calendar.
* **Logs**: ids, counts and short error codes only. Phone numbers are masked, and neither tokens nor emails are ever logged.

## 4. Endpoints and fields (checked against the OpenAPI spec of 2026-10-07)

| Endpoint | Use |
|---|---|
| `GET /v1/convai/agents/{agent_id}` | `tags` (ownership); `conversation_config.agent.prompt.knowledge_base[].id` (reconcile orphans) |
| `DELETE /v1/convai/agents/{agent_id}` | 200/204; existing wrapper |
| `GET /v1/convai/conversations` | `agent_id` (always the verified agent), `cursor`, `page_size` 100 (spec maximum), `summary_mode=exclude` → `conversations[].{agent_id, conversation_id}`, `next_cursor`, `has_more` |
| `DELETE /v1/convai/conversations/{conversation_id}` | existing wrapper |
| `GET /v1/convai/phone-numbers/{phone_number_id}` | `label` |
| `DELETE /v1/convai/phone-numbers/{phone_number_id}` | existing wrapper |
| `POST /v1/convai/knowledge-base/bulk-delete` | `document_ids` (1–20), `force: true` (slice E wrapper) |
| `DELETE /v1/voices/{voice_id}` | `{status}` |
| History and pronunciation | through slice F (`purgeVoiceHistory`, `deleteOrgPronunciation`) |
| Cartesia | `GET /v1/agents/{id}` (`description`), `DELETE /v1/agents/{id}`, `GET /agents/calls?agent_id=&limit=100&starting_after=`, `DELETE /agents/calls/{id}`, `DELETE /agents/phone-numbers/{id}` (existing client) |
| Twilio | `incomingPhoneNumbers(sid).remove()`, `calls(sid).remove()`, `messages(sid).remove()` |
| Stripe | `checkout.sessions.list({customer, status: 'open'})`, `checkout.sessions.expire`, `subscriptions.list({customer})`, `subscriptions.retrieve`, `subscriptions.cancel` (immediate, no proration) |
| Google | `POST https://oauth2.googleapis.com/revoke` (`token`, form-encoded) |
| Supabase Auth admin | `updateUserById(id, {ban_duration})`, `getUserById`, `deleteUser` |

No new ElevenLabs wrapper was needed, and `client.ts` is unchanged. No call uses `breaker: true`, because none is on the live-call path.

## 5. Migration 021 (`supabase/migrations/021_account_deletion.sql`)

* `organizations.deletion_requested_at` is platform-managed. `public.guard_account_columns()` is attached with `CREATE OR REPLACE TRIGGER organizations_guard_account BEFORE INSERT OR UPDATE`. It returns NEW unless `current_user` is `authenticated` or `anon`; for those roles it rejects any change of the column with 42501. `guard_platform_columns()` is not touched.
* `account_deletions` has no foreign keys, so it outlives the organization.
  * Checks on `status`, `requested_via`, `attempts` and the length of `last_error`.
  * Unique `account_deletions_one_open (org_id) WHERE status IN ('pending','running','needs_attention')`.
  * RLS: the owner can `SELECT` its job while the organization exists. Writes are revoked from anon and authenticated.
* `account_deletion_items` (PK `deletion_id, kind, resource_id`, cascade from the job). Checks on `kind` and `outcome`. RLS with no policy; every privilege is revoked from anon and authenticated.
* `invoices_archive` and `usage_archive`: RLS with no policy, every privilege revoked from anon and authenticated, and no app or tenant access.
  * `archive_deleted_invoice()` is a `BEFORE DELETE` trigger on `invoices`, so the organization cascade **and** any manual delete keep the invoice.
  * `archive_org_usage(org)` is called by the `organizations` `BEFORE DELETE` trigger (`archive_org_usage_on_delete()`) and by `archive_org_billing_records(org)`, which the job calls explicitly and which returns the counts.
  * Every function has `SET search_path = public` and EXECUTE revoked from PUBLIC, anon and authenticated. The two RPCs are granted to `service_role`. There is no `SECURITY DEFINER`.
* There are no DROP statements. The file uses `IF NOT EXISTS`, `duplicate_object` guards and `CREATE OR REPLACE`. `tests/migrations/021-account-deletion.test.ts` checks it statically.
* **Verified on a real PostgreSQL** (PGlite 0.3.16, in process, with Supabase-like roles `anon`, `authenticated` and `service_role BYPASSRLS`, plus `auth.uid()`). Migrations 001–018 were applied, then 021 twice, then 021 again on a database with data. All 25 checks passed:
  * A tenant cannot set or clear the marker, and can still rename.
  * A second open job is refused (23505), but a new job after a completed one is allowed.
  * The owner reads only its own job. Tenant inserts and updates of jobs are refused.
  * Tenants cannot read the items or the archives, and cannot run the RPC; the service role can.
  * After the org was deleted, its invoices were cascaded away but kept in the archive with `retain_until` = end of the Bucharest financial year + 10 years.
  * Usage was kept as monthly totals.
  * The job row survived as the tombstone, and the other organization was untouched.
  * The trigger alone archived the invoices of an organization deleted by hand.
* **Deploy order:** apply 021 **before** deploying the code. `requireOrg` tolerates the missing column (42703 fallback), but the deletion job and the admin plan need the new tables.

## 6. What the law makes us keep

| Record | Where | Why and for how long |
|---|---|---|
| Invoices (series, number, amount, currency, status, PDF link, client name and VAT code, dates) | `invoices_archive` | Romanian accounting law 82/1991, art. 25: supporting documents are kept 10 years from the end of the financial year (31 Dec, Bucharest time). Purged automatically after `retain_until`. |
| Monthly usage totals (ledger entries, billable seconds, minutes) | `usage_archive` | The basis of the invoiced minutes, kept for the same period. There are no call ids and no phone numbers. |
| Deletion record | `account_deletions` | Proof of the erasure: ids, steps and counts only. |
| Payments and invoices at Stripe; fiscal invoices at SmartBill | the providers | Kept by the processors under their own legal duties. The Stripe customer is not deleted. |

## 7. API

* `DELETE /api/account {confirm}`:
  * The checks: `assertSameOrigin`, `requireOrg({allowDeleting})`, the rate limit `account_delete` (5 per hour per user), a strict zod body, the owner check (`organizations.user_id` read with the service role), the typed business name (exact after trimming; `DELETE` when the organization has no name), and a sign-in within 30 minutes (`403 reason: reauth_required`).
  * It answers `202 {status: 'accepted', deletion: {id, status, step}}`, runs the job in the background, and signs the user out everywhere (`signOut({scope: 'global'})`). A repeated request returns the same job.
* `POST /api/admin/accounts/[orgId]/offboard {dry_run = true, confirm?}`:
  * The checks: `requireAdmin`, same-origin, a strict zod body, and the rate limit `admin_account_offboard` (30 per hour, platform-wide).
  * A dry run returns the plan (`lib/account/plan.ts`): each step with **where**, **what** and the counts from the organization's rows. It also returns what is retained, what is never touched, and the latest job, including a tombstone after completion. No provider is called.
  * `dry_run: false` requires `confirm` = the organization id; this was added as a typed confirmation for admins. It opens the same job, or reopens one in `needs_attention`, and runs it in the background (202).

## 8. Environment variables

None added. The job uses the existing variables:

| Name | Use |
|---|---|
| `STRIPE_SECRET_KEY` | Cancelling subscriptions and expiring checkouts |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Releasing numbers, deleting call and message records |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_API_BASE_URL` | Every ElevenLabs step |
| `CARTESIA_API_KEY` | The Cartesia agent, imports and calls |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | The confirmation email |

A missing key makes the related resources `not_configured` (counted and logged), never a crash.

## 9. UI

* **Settings** (`app/(dashboard)/settings`, a new **Settings** item in the sidebar). The dashboard had no settings or account page before, so this one is new:
  * The **Account** card shows the business name, the sign-in email, the plan, and a link to billing.
  * The **Danger zone** card has **Delete account**. Once a deletion is under way, the card shows "Your account is being deleted" instead.
* **Delete account dialog** (`components/settings/DeleteAccountDialog.tsx`):
  * It lists what is deleted and what is kept by law (`DELETED_ITEMS` and `RETAINED_ITEMS` in `lib/account/confirmation.ts`).
  * A labelled input asks for the business name, with `aria-describedby` and `aria-invalid`. The delete button stays disabled until the name matches.
  * After a 202, a toast confirms the deletion and the user goes to `/login`.
  * A `reauth_required` answer shows an alert with a **Sign in again** button, which signs out and opens the login page.

## 10. Shared files touched (for the merge)

| File | Change |
|---|---|
| `lib/api/auth.ts` | `requireOrg(opts?)` selects `deletion_requested_at`, falls back on 42703, answers 403 `account_deleting` unless `allowDeleting`. The test is updated. |
| `lib/voice-providers/agent-sync.ts` | One import and a 4-line guard in `syncAgent` |
| `lib/voice-providers/maintenance.ts` | One registration line (`account_deletions`) |
| `lib/voice-providers/reconcile.ts` | One import, one optional report field, and one call before an orphan is deleted |
| `components/dashboard/DashboardShell.tsx` | The Settings nav item |
| `lib/pages/custom-mobile-applications.ts` | A comment only (where `REAUTH_WINDOW_MS` lives) |

## 11. Tests

* `lib/account/delete.test.ts`. It runs on an in-memory database; ElevenLabs and Cartesia go through a mocked fetch, and Stripe, Twilio and Supabase Auth are fakes. It covers:
  * the dry-run plan: every step, counts only, no PII, nothing written;
  * the full run, in order: listing before agent deletion, 404s tolerated, invoices archived, sign-in deleted last, confirmation sent;
  * cross-tenant safety: a stored id of another org's agent, the other org's numbers, voices, tokens and files, and the library voice;
  * another environment's agent and import;
  * a resume after a failure in the middle, with no earlier step repeated;
  * a call record given up after 5 attempts, and `needs_attention` reopened by an admin;
  * the lease, and the time-budget yield.
* `lib/account/deletion-plan.test.ts`: the order and the runner semantics.
* `lib/account/confirmation.test.ts`: the typed name, the 30-minute window, and the marketing page's facts.
* `lib/account/helpers.test.ts`: the storage prefix, Google revoke and orphan knowledge.
* `lib/voice-providers/agent-sync.deleting.test.ts` and `lib/voice-providers/reconcile.orphan-knowledge.test.ts`.
* The route tests: `app/api/account/route.test.ts` and `app/api/admin/accounts/[orgId]/offboard/route.test.ts`.
* `tests/migrations/021-account-deletion.test.ts`.

## 12. Manual staging verification (no live calls are automated)

Use a staging workspace, Stripe test mode, and a test organization with a number, calls, a document, a website import, a clone, a pronunciation rule, a Google Calendar connection and an invoice.

1. Apply migration 021. As a tenant, `PATCH organizations {deletion_requested_at}` through PostgREST must fail with 42501. `select * from invoices_archive` as a tenant must be denied.
2. `POST /api/admin/accounts/<org>/offboard {}`: check that the plan's counts match the organization, and that the response holds no names or numbers.
3. Sign in fresh. In **Settings → Danger zone**, type the name and delete.
   * Expect 202, a redirect to the login page, and a refused sign-in for that user.
   * In the logs: `account_deletion.step_done` for each step, then `account_deletion.completed`.
4. Check each provider:
   * **Stripe**: the subscriptions are cancelled and no checkout is left open.
   * **Twilio**: the number is released, and the call and message logs of those SIDs are gone.
   * **ElevenLabs**:
     * The import is gone.
     * The agent `GET` returns 404.
     * `GET /v1/convai/conversations/<id>` returns 404 for the listed ones.
     * The org folder and the documents are gone.
     * The dictionary is archived.
     * The clone is gone.
   * **Cartesia**: the agent, the SIP import and the calls are gone.
   * **Google**: the app no longer appears in the account's third-party access.
   * **Storage**: the `knowledge-documents/<org>/` folder is empty.
5. Check the database:
   * The `organizations` row is gone.
   * `invoices_archive` holds the invoices, and `usage_archive` holds the monthly totals.
   * The `account_deletions` row is `completed` with its counts.
   * The auth user is gone, and the confirmation email has arrived.
6. Resume: on another test organization, temporarily revoke the ElevenLabs key during a deletion. The job stops at `collect_call_records` or `delete_agents` with `pending` and `attempts`. Restore the key and run the cron: it finishes. Earlier steps are not repeated (Stripe events once).
7. `POST /api/admin/voice/reconcile {"apply": true, "delete_orphans": true}` after a manual organization delete: the orphan agent's report shows `knowledge.deleted`.

## 13. Remaining limitations

* **Copied databases.** ElevenLabs agents and imports carry an environment marker and are protected. Cartesia agents, Twilio SIDs, Stripe ids and conversation ids stored on `calls` rows carry none. A staging database copied from production, using the same provider accounts, could delete production resources through them. Never share provider accounts between environments with copied data. The same applies to the existing call delete (slice D).
* **Stored conversation ids** from `calls` rows are deleted without a GET to check ownership (the same trust as `DELETE /api/calls/[id]`). These ids are written only by the platform's own owner-checked paths.
* **Live calls.** A call still in progress during the deletion is retried with backoff until it ends, and given up after 5 attempts (about 30 minutes). Retention after that is the provider's.
* **The deletion window.** Between the request and the end of the job, a tenant JWT that is still valid (an admin-initiated deletion leaves the user's session until it expires, at most about 1 h) can still write its own rows directly through PostgREST, where RLS allows it. It cannot create provider resources: every API route is blocked by `requireOrg` and syncs are blocked. A Stripe checkout completed in that window is caught by the billing re-check before the organization row is deleted. After that point, the existing Stripe webhook has no organization to provision for.
* **The agent page** (`/agent`) shows the error boundary for an organization in deletion: `requireOrg` answers 403 and that page treats only 401 and 404 as "render nothing". The page is outside this slice.
* **Cartesia knowledge** copies and Cartesia custom voices are not handled: the platform creates neither today.
* Twilio recordings are not stored by the platform, so there is nothing to delete. Resend keeps its own delivery logs.
* The cron runs daily on Vercel Hobby, so retries and the post-deletion storage sweep can lag by up to a day without the 5-minute pg_cron scheduler (`supabase/ops/schedule_voice_maintenance.sql`).
* Slice F caps the speech-history purge at 300 items per voice. A larger history leaves the rest behind. Only failed deletions are logged (`account_deletion.voice_history_incomplete`); items left behind by the cap are not. Use `POST /api/admin/voice/tts-history` to remove them.

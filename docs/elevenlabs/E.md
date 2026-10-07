# Slice E: Knowledge base and RAG

This slice brings the ElevenLabs knowledge base up to date: website import, auto-sync, in-place edits, RAG index status, usage modes, retrieval tuning, the "Test your knowledge base" box, per-organization folders and budgets, and bulk erasure. All tenants share one ElevenLabs workspace. Every provider id used here is resolved on the server from the organization's own rows, and no workspace-wide listing is ever returned to a tenant.

## 1. Audit items

| Item | Status | Notes |
|---|---|---|
| KB:kb-url-auto-sync | partial | New URL documents are created with `enable_auto_sync: true`, `minimum_frequency_days` (default 7) and `auto_remove: false`. Rows store `auto_sync` and `sync_frequency_days`. Maintenance reads `auto_sync_info.consec_failures` and `metadata.last_updated_at_unix_secs` from `/summaries`. When the provider re-fetched a page, maintenance rebuilds its excerpt and re-syncs the fallback agent. The dashboard shows "Auto-updates", or "Update failed" when `consec_failures > 0`. The FAQ copy is updated (`lib/pages/knowledge-base.ts`). **Not done:** toggling auto-sync on an existing document. PATCH has no auto-sync field, so a toggle would mean recreating the document with a new id. URL documents created before this slice keep `auto_sync = false` and have a manual Refresh button. |
| KB:kb-url-refresh | done | `POST /api/agent/knowledge/[docId]/refresh` calls `POST /{id}/refresh` (no retry, upload timeout). Only URL documents that are ready and attached can be refreshed. Rate limit: `knowledge_refresh`, 20/h. The excerpt, size and remote timestamp are taken from the response, so no second `/content` call is made. The id does not change, so the revision is not bumped. The dashboard has a Refresh button on URL rows. |
| KB:kb-website-crawl | done | See §3. |
| KB:kb-get-document | done | The existence check uses `GET /summaries` instead of `GET /{id}`, so the extracted content is never downloaded. Only a per-id `404` failure counts as "missing". Any other failure marks the run failed and never uploads a duplicate. |
| KB:kb-summaries | done | `summaries(ids)` sends 100 ids per call. It is used for the existence check, after create (size, `supported_usages`, folder), for the usage-mode check, in maintenance reconcile (heal, sizes, auto-sync), in the attach heal (§4), and to verify website-page chunks in the RAG test. The deprecated `dependent_agents` field is never read. |
| KB:kb-update-document | done | `PATCH /api/agent/knowledge/[docId] {name?, text?, usage_mode?}`. Renames go to the provider (`PATCH /{id} {name}`), and then the locator is pushed: revision bump plus ElevenLabs sync. Text edits apply to pasted text only. Limits are 300k characters and no NUL, and the byte budget and prompt cap are checked again. The Storage `.txt` is overwritten first with `upsert`, then `PATCH {content}` is sent. `character_count`, `size_bytes` and the excerpt are updated, the RAG state is refreshed, and the fallback agent is re-synced. The id does not change. The dashboard has an Edit / Rename dialog. |
| KB:kb-bulk-delete | done | `bulkDelete(ids, force)` sends 20 ids per call, and a per-id `404` counts as done. `deleteAllOrgKnowledge(orgId)` in `lib/voice-providers/knowledge-delete.ts` is exported for the offboarding slice (H). It marks rows `deleting_at` so nothing re-attaches them, cancels running crawls, then bulk-deletes documents, website folders and the organization's folder with `force`. It never throws for provider failures and returns counts. It must run before the organization row is deleted. The account-deletion flow itself belongs to slice H. |
| KB:kb-content | done | `client.knowledgeBase.content()` is fixed to read at most 256 KB within a 20 s body deadline. Our code uses `kb.contentPrefix()`, which returns `{text, truncated}` (30 s header timeout, one attempt). |
| KB:kb-rag-index-single | done | The RAG state is persisted on the row: `rag_status`, `rag_progress`, `rag_model`, `rag_index_id`, `rag_used_bytes` and `rag_checked_at`. The dashboard shows "Indexing 40%", "Indexing failed", "Workspace limit reached" and "Always read in full" (document_too_small). Retry on a failed index deletes the failed index and creates a new one. `ragIndexes` and `deleteRagIndex` are used for cleanup. |
| KB:kb-rag-index-batch | done | `ragIndexBatch` sends 100 items per call. In-progress states are read with `create_if_missing=false`. Documents whose model is wrong or was never recorded are indexed with `create_if_missing=true`. This runs from the document list (throttled), from maintenance, and after a language change (§4). |
| KB:kb-rag-overview | done | `GET /rag-index` feeds admin diagnostics (`knowledge.rag_quota`), the maintenance quota check (warn at 80 %, error at 95 %) and the upload pause above 95 % (503, generic message, no numbers). The overview is cached for 5 minutes and fails open. It is never shown to tenants. |
| KB:kb-agent-rag-query | done | `POST /api/agent/knowledge/test {query ≤ 500}` → `POST /agents/{id}/knowledge-base/rag-query` with `use_agent_defaults: true`, on the org's own agent (`agent_provider_resources`, resolved through RLS). A chunk is kept only if it belongs to one of the org's documents, or, checked through `/summaries` `folder_path`, to a page inside one of its website folders. Everything else is dropped and counted. Each chunk is capped at 1,200 characters and the response at 8 chunks. A null `vector_distance` is handled. Rate limit: `knowledge_test`, 60/h. The query text is never logged. The dashboard has a "Test your knowledge base" card. |
| KB:agent-kb-usage-mode-prompt | done | `usage_mode` (`auto` / `prompt`) is stored per document. Only the server writes it, through `PATCH … {usage_mode}`. Pasted text can always be pinned. Other documents need `size_bytes ≤ KNOWLEDGE_PROMPT_DOC_MAX_BYTES`. The provider must list `prompt` in `supported_usages` (checked live). The organization total, `character_count` summed over pinned documents, must stay within `KNOWLEDGE_PROMPT_MAX_CHARS`. The cap is checked again after the write, so two concurrent pins cannot both pass it. The spec and locator carry `usage_mode`. The dashboard has an "Always include" switch. |
| KB:agent-rag-embedding-model | done | The model choice is unchanged (`models.ts`). A language change re-indexes for the new model and later deletes the old-model indexes (§4). |
| KB:agent-rag-retrieval-tuning | done | `lib/elevenlabs/rag-config.ts`: `max_documents_length` (12,000), `max_retrieved_rag_chunks_count` (6), `max_vector_distance` (0.6) and `num_candidates` (null) are sent on every sync, which overwrites any dashboard drift. Values come from env and are validated against the spec bounds. Invalid values fall back to the defaults and are reported in diagnostics. These settings are in a new module instead of `models.ts`, to keep shared files untouched. |
| A:prompt-knowledge-base | done | Same as kb-rag-index-batch and agent-kb-usage-mode-prompt. |
| A:prompt-rag-config | partial | Retrieval limits are pinned (see above). `query_rewrite_prompt_override` and `knowledge_base_tool_info` stay at the provider defaults. Romanian query rewriting needs a staging evaluation first. |
| KB:kb-folders | done | One folder per organization, `ntv:<env>:org:<orgId>` (`knowledge_folders`). It is created lazily under a lease. An existing folder with the exact name is adopted, which covers a create whose DB write was lost. If the folder is not obtained quickly, the document is created at the root instead, so an upload is never blocked. All new documents and crawls get `parent_folder_id`. If the folder was deleted out of band, the create returns 404: the folder is forgotten and the create retried at the root. **Migration path for existing documents:** maintenance `folders` moves rows with `elevenlabs_folder_id IS NULL` into their organization's folder, 20 per call (`bulk-move`). If a batch fails, the documents are moved one by one. This is idempotent. Documents the provider no longer has are left to the reconcile step. |
| KB:kb-update-file | done | `POST /api/agent/knowledge/[docId]/replace {name,size,mime}` returns a signed Storage URL and records `pending_storage_path`. `POST …/replace/complete` claims the pending upload atomically, then validates it (type, magic bytes, 20 MB, byte budget). It then calls `PATCH /{id}/update-file` (no retry), swaps `storage_path`, removes the old object, and rebuilds the excerpt and RAG state from the response. A transient failure hands the upload back so the completion can be retried. The dashboard has a "Replace file" button. |
| KB:kb-create-url | done | Upload timeout (60 s), no retry, auto-sync, folder. `size_bytes` comes from `/summaries` after creation. |
| KB:kb-create-file | done | `parent_folder_id`. Documents orphaned by a timeout end up in the org folder and are swept (§4). |
| KB:kb-create-text | done | `parent_folder_id` and the upload timeout. In-place editing is covered by kb-update-document. |
| KB:kb-delete | done | The ordering is fixed. The row gets `deleting_at`, which the spec excludes, and the revision is bumped. Then the provider copy is deleted (force; 404 = done), then Storage, then the row, then the agent is synced. A provider failure clears `deleting_at`, returns 502 and keeps the row. A delete interrupted after step 1 is finished by maintenance. `deleting_at` is used instead of a `deleting` status: extending the status check constraint would need a DROP, which the migration runner cannot run. |
| KB:kb-file-formats-limits | done | Formats are unchanged. Per-organization byte budget, prompt cap and crawl caps are in `knowledge-limits.ts`. The document cap (100) now also counts the pages of imported websites. |
| KB:agent-prompt-knowledge-base | done | `AgentSpec.knowledge` gains `type: 'folder'`, `usageMode` and `sizeBytes`. `type`, `mime_type`, `name` and every other column are locked for tenants (§5). |

### Bugs routed to this slice

| Bug | Status | Fix |
|---|---|---|
| knowledge.ts:593: no re-index after a language change | fixed | `scheduleKnowledgeReindex` is called from `PATCH /api/agent` when the language changes. The batch uses `create_if_missing=true` and the new model, and covers documents and website pages. The document list and maintenance also re-index any row whose `rag_model` differs from the agent's current model. `rag_cleanup_pending` then deletes the old-model indexes once the new one succeeded. Test: `app/api/agent/route.reindex.test.ts`. |
| knowledge.ts:711: existence check downloaded the whole document | fixed | `/summaries`, with only a per-id 404 counting as missing (see kb-get-document). |
| client.ts:349: unbounded `content()` | fixed | 256 KB cap and body deadline (see kb-content). |
| client.ts:333: createFromUrl ran under the 15 s default and left orphans | fixed | Upload timeout for URL and text creates. `parent_folder_id` on every create. The maintenance orphan sweep lists only direct children of the org's folder older than 1 h, diffs them against rows, and bulk-deletes them 20 at a time. |
| knowledge.ts:596: RAG result only logged | fixed | Persisted and shown (kb-rag-index-single). |
| knowledge.ts:783: no per-org byte budget | fixed | `KNOWLEDGE_ORG_MAX_BYTES` (default 50 MB) is enforced on file uploads (declared size, re-checked with the real size at processing), legacy multipart, text, URL (requires room left), website imports (reserve `max_pages × 100 KB` while running), text edits and file replacements. Uploads pause while the workspace is above 95 % of its RAG quota. |
| 010:528: tenant-writable `size_bytes`, `character_count`, `type`, … | fixed | Migration 013 adds `guard_knowledge_columns()`: a tenant JWT cannot change any column of `knowledge_documents` (§5). |
| knowledge.ts:684: stale document ids never heal | fixed | Maintenance `reconcile`: `/summaries` for ready documents, at most once every 20 h each. On a 404 the row is set to `failed` with a message, its ids are cleared, the revision is bumped and ElevenLabs re-synced, then up to 2 documents per run are re-uploaded from their stored source. The same heal runs immediately when an attach sync fails with a validation error (`attachToAgent`). |
| [docId]/route.ts:51: delete ordering race | fixed | `deleting_at` first (kb-delete). |
| knowledge.ts:737: `size_bytes` missing for URL documents | fixed | Read from `/summaries` after create, refresh and reconcile. |

## 2. Endpoints and fields used (all checked against the OpenAPI spec of 2026-10)

New wrappers are in `lib/elevenlabs/api/knowledge.ts`, which uses `req`, `T` and `Ctx` from `client.ts` (now exported). Bounded body reading is in `lib/elevenlabs/api/body.ts`.

| Endpoint | Fields | Retry policy |
|---|---|---|
| `POST /v1/convai/knowledge-base/folder` | `name`, `parent_folder_id` | none |
| `POST /v1/convai/knowledge-base/url` | `url`, `name`, `parent_folder_id`, `enable_auto_sync`, `auto_remove: false`, `minimum_frequency_days` | none, 60 s |
| `POST /v1/convai/knowledge-base/text` | `text`, `name`, `parent_folder_id` | none, 60 s |
| `POST /v1/convai/knowledge-base/file` (multipart) | `file`, `name`, `parent_folder_id` | none, 60 s |
| `GET /v1/convai/knowledge-base/summaries` | `document_ids[]` (≤ 100) | GET |
| `GET /v1/convai/knowledge-base` | `parent_folder_id`, `ancestor_folder_id`, `types[]`, `search`, `cursor`, `page_size ≤ 100` | GET |
| `PATCH /v1/convai/knowledge-base/{id}` | `name`, `content` | idempotent, 60 s |
| `PATCH /v1/convai/knowledge-base/{id}/update-file` (multipart) | `file` | none, 60 s |
| `POST /v1/convai/knowledge-base/{id}/refresh` | none | none, 60 s |
| `GET /v1/convai/knowledge-base/{id}/content` | none (read ≤ 256 KB) | `contentPrefix`: one attempt; `client.content`: GET |
| `POST /v1/convai/knowledge-base/{id}/move`, `POST /bulk-move` | `move_to`; `document_ids[]` (≤ 20) | idempotent |
| `POST /v1/convai/knowledge-base/bulk-delete` | `document_ids[]` (≤ 20), `force` | idempotent |
| `DELETE /v1/convai/knowledge-base/{id}` | `?force=true` (documents and folders) | DELETE |
| `POST /v1/convai/knowledge-base/{id}/rag-index` | `model` (EmbeddingModelEnum) | idempotent |
| `POST /v1/convai/knowledge-base/rag-index` | `items[] {document_id, create_if_missing, model}` (≤ 100) | idempotent |
| `GET /v1/convai/knowledge-base/{id}/rag-index`, `DELETE …/rag-index/{rag_index_id}` | none | GET / DELETE |
| `GET /v1/convai/knowledge-base/rag-index` | overview `total_used_bytes`, `total_max_bytes`, `models[]` | GET |
| `POST /v1/convai/knowledge-base/crawl` | `url`, `max_pages`, `pattern`, `parent_folder_id`, `enable_auto_sync`, `auto_remove: false`, `auto_discover: false`, `minimum_frequency_days`. `max_depth` (deprecated) is never sent. | none |
| `GET /v1/convai/knowledge-base/crawl/{id}`, `POST …/crawl/{id}/cancel` | status `queued/processing/succeeded/failed/skipped/cancelled`, `pages_*`, `root_folder_id` | GET / idempotent |
| `POST /v1/convai/agents/{id}/knowledge-base/rag-query` | `query`, `use_agent_defaults: true` | idempotent |
| Agent body `conversation_config.agent.prompt.knowledge_base[]` | `{type: file/url/text/folder, name, id, usage_mode: auto/prompt}` | |
| Agent body `conversation_config.agent.prompt.rag` | `enabled`, `embedding_model`, `max_documents_length`, `max_retrieved_rag_chunks_count`, `max_vector_distance`, `num_candidates` | |

`GET /crawl` (the workspace-wide job list) is never called. `breaker` is never set: none of these calls is on the live-call path.

## 3. Website import (crawl)

* `POST /api/agent/knowledge/website {url, consent: true}` requires `assertSameOrigin`, `requireOrg` and zod (`consent` must be the literal `true`). Rate limit: `knowledge_crawl`, 5/day.
* The seed must pass `checkPublicUrl` (http/https only, no credentials, no internal names or private IP literals).
* Limits: one running crawl per organization, enforced by the unique partial index `knowledge_crawls_one_active` and also checked first. At most 3 imported websites. A host that is already imported is rejected. Document and byte budgets reserve `max_pages` pages while the crawl runs. The workspace RAG pause applies.
* Consent (user id, time, domain, seed URL, page cap) is written to `audit_log` (`knowledge.website_import_consent`) **before** the crawl starts. If that write fails, nothing starts.
* Crawl parameters: `max_pages = ELEVENLABS_CRAWL_MAX_PAGES` (default 25, hard maximum 50; the DB check enforces 50 as well), a same-host `pattern`, `parent_folder_id` = the org folder, `enable_auto_sync: true`, `minimum_frequency_days: 7`, `auto_remove: false`, `auto_discover: false`.
* The job id and root folder id are stored on the org's own `knowledge_crawls` row. The browser never sees them. Polling uses only that id. `GET /api/agent/knowledge/website` polls running imports at most every 10 s each, claimed with `last_checked_at` so concurrent pollers never double-finish. Rate limit: `knowledge_crawl_status`, 400/h, counted only when a read is due. Maintenance polls as well. A crawl running for more than 6 h is cancelled. Rows left in `starting` are failed after 10 min.
* When the crawl succeeds, the pages are listed (`ancestor_folder_id`, paginated, ≤ max_pages + 10) and `page_count` and `size_bytes` are recorded. An excerpt of the first 3 pages (64 KB each, 8,000 characters in total) goes to the Cartesia fallback. The pages are indexed with the batch endpoint and the agent's model. The folder is attached as **one** locator `{type: 'folder', usage_mode: 'auto'}`, which also enables RAG. If no page was read, the import is marked failed and its folder deleted. When a crawl fails or is skipped, its folder is deleted.
* `DELETE /api/agent/knowledge/website/[crawlId]` sets status `deleting` and bumps the revision, so the folder leaves the spec. It then cancels the job if it is running and deletes the root folder (`force`), then the row, then re-syncs the agent. A provider failure restores the previous status.
* Onboarding: Step 5 shows an opt-in "Import my website" checkbox when the company website is set. The text of the checkbox is the ownership consent. After `/api/onboarding/complete` succeeds, the import starts with a `keepalive` request that survives the redirect to checkout. It never blocks or fails the launch.
* **The `pattern` syntax is undocumented** (regex or glob). The default `ELEVENLABS_CRAWL_PATTERN_SYNTAX=regex` sends an anchored regex, `^https?://(?:www\.)?<host>(?::\d+)?(?:[/?#].*)?$`, which is correct for both search and full-match semantics. Both styles fail safe if the provider expects the other one: the crawl imports few or no pages, never another site. Check this in staging (§7).

## 4. RAG, model changes, maintenance

* Index state per document is stored on the row. The document list refreshes indexing rows at most every 10 s per organization (batch, read only; rate limit `knowledge_status`, 400/h; a failure never breaks the list). The dashboard polls every 10 s while something is indexing.
* Language change: `scheduleKnowledgeReindex` runs after the response. Rows are re-indexed with `create_if_missing=true`, and `rag_cleanup_pending` is set. Maintenance `rag_cleanup` deletes the indexes of other models once the current one succeeded or is `document_too_small`. `crawl_rag_cleanup` does the same for website pages.
* `rag.enabled` is true only when the agent has a folder, or an `auto` document that is not known to be smaller than 500 bytes. An agent with only pinned or tiny documents does not pay the RAG latency on every turn.
* The maintenance step `knowledge_sync` is registered with one line in `maintenance.ts` and runs `crawls`, `reconcile`, `rag`, `rag_cleanup`, `crawl_rag_cleanup`, `folders`, `orphans`, `deletes` and `quota`. Each sub-step is bounded and isolated. Note that the cron currently runs daily (Hobby plan), so auto-sync excerpt refresh and index cleanup can lag by up to 24 h.

## 5. Migration 013 (`supabase/migrations/013_knowledge_rag.sql`)

* `knowledge_documents` gets these new columns, all nullable or with constant defaults: `usage_mode` (check `auto`/`prompt`), `supported_usages`, `auto_sync`, `sync_frequency_days` (1–180), `sync_failures`, `remote_updated_at`, `remote_checked_at`, `rag_status` (spec enum), `rag_progress` (0–100), `rag_model`, `rag_index_id`, `rag_used_bytes`, `rag_checked_at`, `rag_cleanup_pending`, `elevenlabs_folder_id`, `deleting_at`, and `pending_storage_path` (check: inside the org folder). Partial indexes back the maintenance scans.
* New table `knowledge_crawls`: RLS, tenant SELECT scoped by org with `(SELECT auth.uid())`, no write policies, and `REVOKE INSERT/UPDATE/DELETE/TRUNCATE` from anon and authenticated. It has the one-active-crawl unique index, a unique job id, and a check `max_pages BETWEEN 1 AND 50`.
* New table `knowledge_folders`: one row per org. Same RLS pattern. Unique `folder_id`.
* `public.guard_knowledge_columns()` (`SET search_path = public`; EXECUTE revoked from PUBLIC, anon and authenticated) is attached with `CREATE OR REPLACE TRIGGER knowledge_documents_guard_knowledge`. It returns NEW unless `current_user` is `authenticated` or `anon`. For those roles, an UPDATE that changes **any** column except `updated_at` is rejected (42501). That covers `size_bytes`, `character_count`, `type`, `mime_type`, `attempt_count`, `name` (renames go through the API) and every new column. An INSERT with non-default platform columns is rejected too (tenants have no INSERT policy anyway). `guard_platform_columns()` is not touched.
* There are no DROP statements. Constraints and policies sit in `duplicate_object` guards, and indexes and tables use `IF NOT EXISTS`.
* **Migration verification:** migrations 001–010, then 013, were applied to a throwaway PostgreSQL 16 with Supabase-like roles and `auth.uid()`, and 013 was re-applied to confirm it is idempotent. As a tenant, updates of `size_bytes`, `usage_mode`, `name` and `type` were rejected. A no-op update was allowed. Tenant writes to `knowledge_crawls` and `knowledge_folders` were denied. Another tenant saw 0 rows. The service role could write every column. Bad `rag_status` values and pending paths outside the org were rejected. The trigger also fires for tenants with EXECUTE revoked. `tests/migrations/013-knowledge-rag.test.ts` checks the file statically.
* **Deploy order:** apply 013 before deploying this code. The document list selects the new columns.

## 6. Environment variables (none added to `.env.example`)

| Name | Default | Meaning |
|---|---|---|
| `KNOWLEDGE_ORG_MAX_BYTES` | `52428800` (50 MB) | Total knowledge bytes per organization: files, text, URL pages and website imports. Range 1 MB to 1 GB. |
| `KNOWLEDGE_PROMPT_MAX_CHARS` | `8000` | Total characters across "Always include" documents per organization. Range 500–50,000. |
| `KNOWLEDGE_PROMPT_DOC_MAX_BYTES` | `32768` | Largest non-text document that may be pinned. Range 1 KB to 1 MB. |
| `ELEVENLABS_CRAWL_MAX_PAGES` | `25` | Pages per website import. Range 1–50. Out-of-range values fall back to 25. |
| `ELEVENLABS_CRAWL_PATTERN_SYNTAX` | `regex` | `regex`, `glob` or `off`: how the same-host `pattern` is written (§3). |
| `ELEVENLABS_KB_SYNC_DAYS` | `7` | `minimum_frequency_days` for URL documents and crawls. Range 1–180. |
| `ELEVENLABS_RAG_MAX_DOCS_LENGTH` | `12000` | `rag.max_documents_length`. Range 1–50,000. |
| `ELEVENLABS_RAG_MAX_CHUNKS` | `6` | `rag.max_retrieved_rag_chunks_count`. Range 1–20. |
| `ELEVENLABS_RAG_MAX_VECTOR_DISTANCE` | `0.6` | `rag.max_vector_distance`. Must be strictly between 0 and 1. |
| `ELEVENLABS_RAG_NUM_CANDIDATES` | unset (provider default) | `rag.num_candidates`. Range 100–10,000. |

New rate limits (defined in `knowledge-limits.ts`, per organization): `knowledge_refresh` 20/h, `knowledge_edit` 60/h, `knowledge_crawl` 5/day, `knowledge_test` 60/h, `knowledge_status` 400/h, `knowledge_crawl_status` 400/h. Text edits and file replacements also count against the existing `knowledge_upload` (30/h).

## 7. UI changes

* **Knowledge tab** (`components/agent/tabs/TabKnowledge.tsx` and `components/agent/knowledge/*`):
  * The "Total size" card shows the organization budget.
  * New "Import your website" card: URL, consent checkbox, progress, page count, remove with confirmation.
  * Document rows gain badges ("Indexing 40%", "Indexing failed", "Workspace limit reached", "Always read in full", "Always included", "Auto-updates" / "Update failed", "Removing"), an "Always include" switch on eligible documents, and Refresh (URL), Replace file (files), Edit / Rename and Retry (which also re-indexes a failed index) actions.
  * New "Test your knowledge base" card.
  * A tips line explains "Always include" and weekly re-reading.
* **Hooks:** `hooks/useKnowledge.ts` gains `usage`, `refreshDoc`, `updateDoc`, `loadDocText`, `replaceFile` and indexing-aware polling. New `hooks/useKnowledgeWebsite.ts`.
* **Onboarding:** an opt-in "Import my website" checkbox in the launch step.
* **API for the UI:** `GET /api/agent/knowledge/usage` (organization numbers only) and `GET /api/agent/knowledge/[docId]` (adds the stored text of pasted-text documents, for editing).
* **Admin diagnostics:** a `knowledge` section with the workspace RAG quota per model, RAG tuning, env problems, document and rag-status tallies, counts of root-level and deleting documents, and website-import states.

## 8. Manual staging verification (no live calls are automated)

Use a staging workspace and a test organization.

1. Apply migration 013. As a tenant, `PATCH knowledge_documents` through PostgREST (for example `size_bytes`) must fail with 42501.
2. Upload a PDF, a pasted text and a URL. In the ElevenLabs dashboard, all three must sit in folder `ntv:<env>:org:<orgId>`. The URL document must show auto-sync on, weekly. In the Knowledge tab, the URL row must show a size, and the badges must move from "Indexing …%" to nothing.
3. Edit the pasted text. At ElevenLabs the document id stays the same and the content changes. Rename the PDF: the agent's `knowledge_base` locator shows the new name.
4. Replace the PDF with a new version: same id at ElevenLabs, new content in Test.
5. Pin the text with "Always include": the agent's locator shows `usage_mode: "prompt"`. Pinning a large PDF is refused. Pinning past `KNOWLEDGE_PROMPT_MAX_CHARS` is refused.
6. Import a small site you own (set `ELEVENLABS_CRAWL_MAX_PAGES=5`) and confirm:
   * a consent row in `audit_log`;
   * the crawl's root folder created inside the org folder;
   * only pages of that host imported (this validates the `pattern` syntax; if nothing or only the home page is imported, try `ELEVENLABS_CRAWL_PATTERN_SYNTAX=glob`, then `off`);
   * the folder attached as a `folder` locator, with `rag.enabled: true`.
7. "Test your knowledge base": ask about an opening hour that exists in the text. The text must come back with a match percentage. Ask about a page of the imported site: a website snippet appears.
8. Change the agent language between en and ro. The rows' `rag_model` must switch to the new model, and after the indexes succeeded, the next maintenance run deletes the old-model indexes (`GET /{id}/rag-index` lists one model).
9. Delete a document from the ElevenLabs dashboard, then run the maintenance cron (`/api/cron/voice-maintenance`). The row must be healed: re-uploaded, or failed with the "removed from the voice provider" message, and the agent sync must succeed.
10. Remove the website import. The crawl folder disappears and the locator is gone.
11. Admin diagnostics: `knowledge.rag_quota` shows used and max bytes.
12. Call `deleteAllOrgKnowledge(orgId)` from a script on the test organization. Its folder, documents and crawl folders disappear at ElevenLabs.

## 9. Remaining limitations

* The crawl `pattern` syntax is undocumented; see §3 and step 6 above.
* ElevenLabs does not document whether it re-indexes documents by itself on an embedding-model change. We re-index explicitly, and the old indexes use quota until the cleanup runs (up to a day with the daily cron).
* Auto-sync cannot be switched on for URL documents created before this slice without recreating them. Their owners use Refresh.
* A website's real size is known only when it finishes. Until then the budget reserves 100 KB per page, so a finished import can end slightly above the budget. This is bounded by the 50-page cap.
* The "Always include" cap counts our plain-text character count. The provider's own count (HTML or Markdown) can differ slightly.
* Orphans created at the workspace root (when the org folder could not be obtained) are moved into the folder only if a row knows them. Truly unknown root-level orphans are not swept, because that would need a workspace-wide listing.
* The account-deletion flow (slice H) must call `deleteAllOrgKnowledge` before deleting the organization row. Storage objects are left to its `delete_storage` step.
* The `rag-query` response "may evolve" according to the spec. It is parsed defensively, and unknown shapes produce an empty result.

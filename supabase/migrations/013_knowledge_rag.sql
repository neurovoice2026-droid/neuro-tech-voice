-- ══════════════════════════════════════════════════════════════════════════════
-- 013 · Knowledge base: RAG status, usage modes, auto-sync, website imports,
--       per-organization ElevenLabs folders
--
-- Additive and idempotent (safe to re-run, no DROP of any kind): new columns
-- are nullable or have constant defaults, constraints and policies are added
-- inside duplicate_object guards, functions and triggers use CREATE OR REPLACE.
--
-- Adds:
--   • knowledge_documents: usage_mode (auto|prompt), RAG index state
--     (rag_status/progress/model/index id/used bytes), URL auto-sync state,
--     the ElevenLabs folder a document lives in, deleting_at (excluded from the
--     agent while a delete runs) and pending_storage_path (file replacement)
--   • knowledge_crawls: website imports (crawl job id, root folder, progress,
--     consent) — one active crawl per organization
--   • knowledge_folders: the organization's own ElevenLabs knowledge-base folder
-- Hardens:
--   • guard_knowledge_columns(): a tenant JWT can no longer change ANY column of
--     a knowledge document (size_bytes, character_count, type, mime_type,
--     attempt_count, name, usage_mode, rag_*, …). Every change goes through the
--     API, which enforces caps and pushes renames to the provider.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── Knowledge documents ──────────────────────────────────────────────────────
-- How the agent uses the document: 'auto' (RAG when indexed, full context
-- otherwise) or 'prompt' (always in the system prompt; capped per organization).
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS usage_mode text NOT NULL DEFAULT 'auto';
-- Usage modes the provider allows for this document (GET /summaries).
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS supported_usages text[];
-- URL documents re-fetched by the provider on a schedule (set at creation only).
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS auto_sync boolean NOT NULL DEFAULT false;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS sync_frequency_days integer;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS sync_failures integer NOT NULL DEFAULT 0;
-- metadata.last_updated_at_unix_secs as last seen, and when we last asked.
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS remote_updated_at timestamptz;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS remote_checked_at timestamptz;
-- RAG index for the agent's current embedding model.
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS rag_status text;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS rag_progress smallint;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS rag_model text;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS rag_index_id text;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS rag_used_bytes bigint;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS rag_checked_at timestamptz;
-- Indexes of other embedding models may still exist (language change): delete them.
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS rag_cleanup_pending boolean NOT NULL DEFAULT false;
-- ElevenLabs folder holding the document (NULL = workspace root, moved by maintenance).
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS elevenlabs_folder_id text;
-- Set while a delete runs: the agent spec leaves the document out from then on.
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS deleting_at timestamptz;
-- Storage object of a replacement file uploaded but not yet applied.
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS pending_storage_path text;

DO $$ BEGIN
  ALTER TABLE public.knowledge_documents ADD CONSTRAINT knowledge_documents_usage_mode_check
    CHECK (usage_mode IN ('auto', 'prompt'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.knowledge_documents ADD CONSTRAINT knowledge_documents_rag_status_check
    CHECK (rag_status IS NULL OR rag_status IN (
      'new', 'created', 'processing', 'failed', 'succeeded',
      'rag_limit_exceeded', 'document_too_small', 'cannot_index_folder'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.knowledge_documents ADD CONSTRAINT knowledge_documents_rag_progress_check
    CHECK (rag_progress IS NULL OR rag_progress BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.knowledge_documents ADD CONSTRAINT knowledge_documents_sync_frequency_check
    CHECK (sync_frequency_days IS NULL OR sync_frequency_days BETWEEN 1 AND 180);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.knowledge_documents ADD CONSTRAINT knowledge_documents_pending_path_check
    CHECK (pending_storage_path IS NULL OR split_part(pending_storage_path, '/', 1) = org_id::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Maintenance scans: RAG indexing in progress, reconcile (oldest check first),
-- documents still at the workspace root, deletes that did not finish.
CREATE INDEX IF NOT EXISTS knowledge_documents_rag_pending
  ON public.knowledge_documents (rag_checked_at NULLS FIRST)
  WHERE rag_status IN ('new', 'created', 'processing');
CREATE INDEX IF NOT EXISTS knowledge_documents_remote_check
  ON public.knowledge_documents (remote_checked_at NULLS FIRST)
  WHERE elevenlabs_doc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_documents_root_level
  ON public.knowledge_documents (org_id)
  WHERE elevenlabs_doc_id IS NOT NULL AND elevenlabs_folder_id IS NULL;
CREATE INDEX IF NOT EXISTS knowledge_documents_deleting
  ON public.knowledge_documents (deleting_at)
  WHERE deleting_at IS NOT NULL;

-- ─── Website imports (ElevenLabs crawl jobs) ──────────────────────────────────
-- The crawl job id is only ever read from the organization's own row: the
-- provider's job listing covers every tenant of the shared workspace.
CREATE TABLE IF NOT EXISTS public.knowledge_crawls (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id            uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  seed_url            text NOT NULL,
  host                text NOT NULL,
  max_pages           integer NOT NULL,
  status              text NOT NULL DEFAULT 'starting',
  crawl_job_id        text,
  root_folder_id      text,
  pages_identified    integer NOT NULL DEFAULT 0,
  pages_scraped       integer NOT NULL DEFAULT 0,
  pages_skipped       integer NOT NULL DEFAULT 0,
  pages_failed        integer NOT NULL DEFAULT 0,
  -- Documents actually in the root folder once finished, and their total size.
  page_count          integer NOT NULL DEFAULT 0,
  size_bytes          bigint NOT NULL DEFAULT 0,
  rag_status          text,
  rag_progress        smallint,
  rag_model           text,
  rag_cleanup_pending boolean NOT NULL DEFAULT false,
  sync_failures       integer NOT NULL DEFAULT 0,
  -- Bounded plain-text excerpt of the first pages, for the Cartesia fallback agent.
  content_excerpt     text,
  error_message       text,
  consent_user_id     uuid,
  consent_at          timestamptz,
  attached_at         timestamptz,
  finished_at         timestamptz,
  last_checked_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.knowledge_crawls ADD CONSTRAINT knowledge_crawls_status_check
    CHECK (status IN ('starting', 'queued', 'processing', 'succeeded', 'failed', 'skipped', 'cancelled', 'deleting'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.knowledge_crawls ADD CONSTRAINT knowledge_crawls_max_pages_check
    CHECK (max_pages BETWEEN 1 AND 50);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.knowledge_crawls ADD CONSTRAINT knowledge_crawls_rag_status_check
    CHECK (rag_status IS NULL OR rag_status IN (
      'new', 'created', 'processing', 'failed', 'succeeded',
      'rag_limit_exceeded', 'document_too_small', 'cannot_index_folder'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.knowledge_crawls ADD CONSTRAINT knowledge_crawls_rag_progress_check
    CHECK (rag_progress IS NULL OR rag_progress BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One running crawl per organization, enforced atomically.
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_crawls_one_active
  ON public.knowledge_crawls (org_id)
  WHERE status IN ('starting', 'queued', 'processing');
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_crawls_job_unique
  ON public.knowledge_crawls (crawl_job_id)
  WHERE crawl_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_crawls_org ON public.knowledge_crawls (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_crawls_active
  ON public.knowledge_crawls (last_checked_at NULLS FIRST)
  WHERE status IN ('starting', 'queued', 'processing', 'deleting');

CREATE OR REPLACE TRIGGER knowledge_crawls_updated_at
  BEFORE UPDATE ON public.knowledge_crawls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.knowledge_crawls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "knowledge_crawls_owner_select" ON public.knowledge_crawls FOR SELECT
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- No insert/update/delete policies: imports are written by the API (service role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.knowledge_crawls FROM anon, authenticated;

-- ─── Per-organization ElevenLabs folder ───────────────────────────────────────
-- Every new document (and crawl) of an organization is created inside its own
-- folder, so its copies in the shared workspace can be listed, swept and erased
-- as a unit. The lease prevents two requests from creating two folders.
CREATE TABLE IF NOT EXISTS public.knowledge_folders (
  org_id          uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider        text NOT NULL DEFAULT 'elevenlabs',
  folder_id       text,
  lock_token      uuid,
  lock_expires_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.knowledge_folders ADD CONSTRAINT knowledge_folders_provider_check CHECK (provider = 'elevenlabs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_folders_folder_unique
  ON public.knowledge_folders (folder_id)
  WHERE folder_id IS NOT NULL;

CREATE OR REPLACE TRIGGER knowledge_folders_updated_at
  BEFORE UPDATE ON public.knowledge_folders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.knowledge_folders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "knowledge_folders_owner_select" ON public.knowledge_folders FOR SELECT
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.knowledge_folders FROM anon, authenticated;

-- ─── Knowledge documents are read-only with a tenant JWT ──────────────────────
-- The UPDATE policy from 010 still lets a tenant address its own rows; this
-- trigger rejects any change to any column made with a tenant JWT. Caps (byte
-- budget, prompt-mode characters, document count) read size_bytes,
-- character_count and usage_mode, and the agent locator reads type and name:
-- all of them are written by the server only. Renames go through
-- PATCH /api/agent/knowledge/[docId], which also renames the provider copy.
-- Runs alongside guard_platform_columns() (010), which it does not replace.
CREATE OR REPLACE FUNCTION public.guard_knowledge_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.usage_mode IS DISTINCT FROM 'auto'
       OR NEW.supported_usages IS NOT NULL
       OR NEW.auto_sync IS DISTINCT FROM false
       OR NEW.sync_frequency_days IS NOT NULL
       OR NEW.sync_failures IS DISTINCT FROM 0
       OR NEW.remote_updated_at IS NOT NULL
       OR NEW.remote_checked_at IS NOT NULL
       OR NEW.rag_status IS NOT NULL
       OR NEW.rag_progress IS NOT NULL
       OR NEW.rag_model IS NOT NULL
       OR NEW.rag_index_id IS NOT NULL
       OR NEW.rag_used_bytes IS NOT NULL
       OR NEW.rag_checked_at IS NOT NULL
       OR NEW.rag_cleanup_pending IS DISTINCT FROM false
       OR NEW.elevenlabs_folder_id IS NOT NULL
       OR NEW.deleting_at IS NOT NULL
       OR NEW.pending_storage_path IS NOT NULL
       OR NEW.attempt_count IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'knowledge processing fields are managed by the platform' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- updated_at is maintained by its own trigger; every other column is locked.
    IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
      RAISE EXCEPTION 'knowledge documents are changed through the API only' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_knowledge_columns() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER knowledge_documents_guard_knowledge
  BEFORE INSERT OR UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_knowledge_columns();

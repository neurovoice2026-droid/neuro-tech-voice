-- ══════════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE → SQL EDITOR (New query → paste → Run)
-- Idempotent: safe to run even if some objects already exist.
-- Fixes: "Could not find the 'elevenlabs_phone_number_id' column of 'phone_numbers'"
-- Covers migrations 002 → 005 (knowledge base, phone column + minutes RPC,
-- workflows, google_drive integration).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 002: knowledge base ───────────────────────────────────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id          uuid REFERENCES agents(id)        ON DELETE CASCADE NOT NULL,
  org_id            uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  elevenlabs_doc_id text,
  name              text NOT NULL,
  type              text NOT NULL CHECK (type IN ('pdf','txt','docx','md','url')),
  url               text,
  storage_path      text,
  size_bytes        integer DEFAULT 0,
  character_count   integer DEFAULT 0,
  status            text DEFAULT 'processing' CHECK (status IN ('processing','ready','failed')),
  error_message     text,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_documents_owner" ON knowledge_documents;
CREATE POLICY "knowledge_documents_owner" ON knowledge_documents FOR ALL
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS knowledge_documents_agent_id_idx ON knowledge_documents (agent_id);
CREATE INDEX IF NOT EXISTS knowledge_documents_org_id_idx   ON knowledge_documents (org_id);

-- ── 003: phone column + minutes RPC (fixes the purchase error) ────────────────
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS elevenlabs_phone_number_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_elevenlabs_conv_id_unique
  ON calls (elevenlabs_conversation_id) WHERE elevenlabs_conversation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION increment_minutes_used(p_org_id uuid, p_minutes integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE organizations SET minutes_used = minutes_used + p_minutes WHERE id = p_org_id;
END; $$;

-- ── 004: workflows ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name             text NOT NULL,
  description      text,
  trigger          text NOT NULL CHECK (trigger IN ('call_ended','call_missed','call_started','voicemail_left','sentiment_negative','keyword_detected')),
  trigger_config   jsonb DEFAULT '{}'::jsonb,
  actions          jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled          boolean DEFAULT true,
  runs             integer DEFAULT 0,
  successful_runs  integer DEFAULT 0,
  last_run_at      timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workflow_runs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id   uuid REFERENCES workflows(id) ON DELETE CASCADE NOT NULL,
  call_id       uuid REFERENCES calls(id) ON DELETE SET NULL,
  status        text DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  results       jsonb DEFAULT '[]'::jsonb,
  error         text,
  started_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);
ALTER TABLE workflows     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workflows_owner" ON workflows;
CREATE POLICY "workflows_owner" ON workflows FOR ALL
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "workflow_runs_owner" ON workflow_runs;
CREATE POLICY "workflow_runs_owner" ON workflow_runs FOR ALL
  USING (workflow_id IN (SELECT id FROM workflows WHERE org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())));
CREATE INDEX IF NOT EXISTS idx_workflows_org          ON workflows (org_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger      ON workflows (org_id, trigger) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs (workflow_id, started_at DESC);
DROP TRIGGER IF EXISTS workflows_updated_at ON workflows;
CREATE TRIGGER workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 005: allow the google_drive integration type ─────────────────────────────
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_type_check
  CHECK (type IN ('google_sheets','google_docs','google_calendar','gmail','google_drive','webhook'));

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTE: migrations 006 (invoices) and 007 (repricing) you already ran.
-- If unsure, re-run them too — both are safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Add metadata column to agents ───────────────────────────────────────────
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- ─── Knowledge documents ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id            uuid REFERENCES agents(id)       ON DELETE CASCADE NOT NULL,
  org_id              uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  elevenlabs_doc_id   text,
  name                text NOT NULL,
  type                text NOT NULL CHECK (type IN ('pdf','txt','docx','md','url')),
  url                 text,
  storage_path        text,
  size_bytes          integer DEFAULT 0,
  character_count     integer DEFAULT 0,
  status              text DEFAULT 'processing'
                        CHECK (status IN ('processing','ready','failed')),
  error_message       text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents_owner"
  ON knowledge_documents
  FOR ALL
  USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS knowledge_documents_agent_id_idx
  ON knowledge_documents (agent_id);

CREATE INDEX IF NOT EXISTS knowledge_documents_org_id_idx
  ON knowledge_documents (org_id);

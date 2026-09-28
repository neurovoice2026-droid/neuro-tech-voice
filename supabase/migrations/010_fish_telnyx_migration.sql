-- ─── Migrate the voice stack from ElevenLabs+Twilio to Fish Audio+Telnyx ─────
--
-- Nothing is dropped here. The elevenlabs_* and twilio_* columns stay in place
-- and keep their data so a rollback is a config change rather than a restore.
-- Dropping them is migration 011, to be run only after the cutover is
-- confirmed on live traffic.
--
-- The conceptual change worth understanding: there is no longer a remote agent
-- object anywhere. ElevenLabs hosted the agent and we stored its id; with this
-- architecture the agent IS the row in `agents` and the orchestrator reads it
-- directly. So elevenlabs_agent_id has no successor column — it is simply
-- obsolete, and that is the point, not an oversight.

-- ─── Agents ──────────────────────────────────────────────────────────────────

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS voice_provider text NOT NULL DEFAULT 'fish',
  -- The LLM is ours to choose now that we run the conversation loop.
  -- Full id, not the `gpt-5.6` alias — that alias routes to Sol, a much more
  -- expensive tier, and nothing about the call would look wrong if it did.
  ADD COLUMN IF NOT EXISTS llm_model text NOT NULL DEFAULT 'gpt-5.6-luna';

COMMENT ON COLUMN agents.voice_id IS
  'Fish Audio model _id (their API calls it reference_id). Previously an ElevenLabs voice_id.';

-- ─── Phone numbers ───────────────────────────────────────────────────────────

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS telnyx_number_id text,
  -- Which Voice API application receives this number's webhooks. A number
  -- without a connection_id is rented but rings nowhere.
  ADD COLUMN IF NOT EXISTS telnyx_connection_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_telnyx_id
  ON phone_numbers (telnyx_number_id)
  WHERE telnyx_number_id IS NOT NULL;

-- ─── Calls ───────────────────────────────────────────────────────────────────

ALTER TABLE calls
  -- call_control_id addresses a single call leg and is what every Telnyx
  -- action takes. call_session_id groups legs of the same session (e.g. after
  -- a transfer), which is the correct key for "one conversation".
  ADD COLUMN IF NOT EXISTS telnyx_call_control_id text,
  ADD COLUMN IF NOT EXISTS telnyx_call_session_id text,
  -- Cost is now assembled from several metered vendors instead of arriving as
  -- one number from ElevenLabs, so it is recorded per call for margin tracking.
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10, 6);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_telnyx_session_unique
  ON calls (telnyx_call_session_id)
  WHERE telnyx_call_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_telnyx_control_id
  ON calls (telnyx_call_control_id);

-- ─── Knowledge base (RAG) ────────────────────────────────────────────────────
--
-- ElevenLabs hosted the knowledge base and did retrieval internally; we only
-- kept its document id. Neither Fish Audio nor Telnyx offers an equivalent, so
-- retrieval moves in-house: documents are chunked, embedded, and searched with
-- pgvector at call time, then injected into the system prompt.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id uuid NOT NULL REFERENCES knowledge_documents (id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  content     text NOT NULL,
  -- Position of this chunk in the source document, for stable ordering and
  -- for stitching neighbouring chunks back together when quoting context.
  chunk_index integer NOT NULL,
  token_count integer,
  -- 1536 dims = OpenAI text-embedding-3-small. Changing the embedding model
  -- means changing this width and re-embedding everything, so it is pinned
  -- rather than left flexible.
  embedding   vector(1536),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent ON knowledge_chunks (agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks (document_id);

-- HNSW over ivfflat: it needs no training step, so it behaves correctly from
-- the first row. ivfflat on a near-empty table degrades to a sequential scan
-- until it is rebuilt, which is a subtle trap for a table that grows per
-- customer rather than being bulk-loaded once.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS chunk_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

-- Retrieval used at call time. SECURITY DEFINER because the orchestrator runs
-- outside a user session and has no RLS context of its own; the agent_id
-- filter is what scopes the result, so it is required, not optional.
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  p_agent_id uuid,
  p_embedding vector(1536),
  p_match_count integer DEFAULT 5,
  p_min_similarity double precision DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> p_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.agent_id = p_agent_id
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> p_embedding) >= p_min_similarity
  ORDER BY kc.embedding <=> p_embedding
  LIMIT p_match_count;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge_chunks_owner" ON knowledge_chunks;
CREATE POLICY "knowledge_chunks_owner" ON knowledge_chunks
  FOR ALL USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

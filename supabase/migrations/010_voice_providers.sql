-- ══════════════════════════════════════════════════════════════════════════════
-- 010 · Voice providers: ElevenLabs primary, Cartesia fallback
--
-- Additive and idempotent (safe to re-run): every new column is nullable or
-- has a constant default, backfills only touch rows that need them, and
-- constraints are added only where the existing data already satisfies them
-- (otherwise a NOTICE explains why it was skipped). The file runs as ONE
-- transaction: organizations, agents, phone_numbers, calls and
-- knowledge_documents are locked for its duration (seconds on a typical
-- table; longer with a very large calls table). Apply it at low traffic.
-- lock_timeout makes it fail fast (and leave nothing applied) instead of
-- queueing behind a long-running transaction while blocking live calls.
--
-- Adds:
--   • provider resource tracking (agent_provider_resources) with sync status
--   • per-call routing/provider/failover fields on calls
--   • routing mode + capabilities on phone_numbers
--   • webhook_events (idempotent ingestion) and usage_ledger (bill once per call)
--   • provider_circuit_state, provider_events (breaker + telemetry, service-only)
--   • provider_voices (tenant-scoped voice registry), audit_log
--   • rate_limit_buckets + rate_limit_hit()
-- Hardens:
--   • increment_minutes_used / new RPCs executable by service_role only
--   • platform-managed columns cannot be changed with a tenant JWT
--   • knowledge-documents storage objects scoped to the owning org's folder
-- ══════════════════════════════════════════════════════════════════════════════

-- Before the first ALTER: every ACCESS EXCLUSIVE acquisition fails after 5 s
-- instead of queueing (and blocking all readers) behind a long transaction.
SET lock_timeout = '5s';

-- ─── Organizations ────────────────────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS voice_fallback_enabled boolean NOT NULL DEFAULT true;

-- ─── Agents ───────────────────────────────────────────────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS primary_provider text NOT NULL DEFAULT 'elevenlabs';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS fallback_provider text DEFAULT 'cartesia';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS conversation_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS after_hours jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS transfer_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS analysis_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS privacy_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS dynamic_variables jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Explicit ElevenLabs voice → Cartesia voice mapping for the fallback runtime.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS fallback_voice_id text;
-- 'synced' only after the provider confirmed the voice; never shown as active otherwise.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_sync_status text NOT NULL DEFAULT 'synced';
-- When the current 'saving' started: a save interrupted by a timeout is
-- settled by the next sync instead of showing "saving" forever.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_sync_started_at timestamptz;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_sync_error text;
-- Bumped by every change that must reach the providers; resources record the revision they hold.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS config_revision integer NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE agents ADD CONSTRAINT agents_primary_provider_check CHECK (primary_provider IN ('elevenlabs', 'cartesia'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE agents ADD CONSTRAINT agents_fallback_provider_check CHECK (fallback_provider IS NULL OR fallback_provider IN ('elevenlabs', 'cartesia'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE agents ADD CONSTRAINT agents_voice_sync_status_check CHECK (voice_sync_status IN ('pending', 'saving', 'synced', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Behaviour switches used to live in metadata.behavior_settings and never reached
-- the provider. Copy them into the column the sync now reads (only once).
UPDATE agents
SET conversation_settings = metadata -> 'behavior_settings'
WHERE conversation_settings = '{}'::jsonb
  AND metadata ? 'behavior_settings'
  AND jsonb_typeof(metadata -> 'behavior_settings') = 'object';

-- Agents without a voice yet are not "synced".
UPDATE agents SET voice_sync_status = 'pending' WHERE voice_id IS NULL AND voice_sync_status = 'synced';

-- One agent per organization (the product model). Lazy creation in several
-- routes could race and create duplicates; enforce it when the data allows.
DO $$ BEGIN
  IF NOT EXISTS (SELECT org_id FROM agents GROUP BY org_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS agents_one_per_org ON agents (org_id);
  ELSE
    RAISE NOTICE 'agents_one_per_org skipped: some organizations have duplicate agents. Merge them with the "Duplicate agents" procedure in docs/voice-providers.md (section 10), then re-run this migration.';
  END IF;
END $$;

-- ─── Provider resources (one external agent per local agent and provider) ─────
CREATE TABLE IF NOT EXISTS agent_provider_resources (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id         uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  provider         text NOT NULL CHECK (provider IN ('elevenlabs', 'cartesia')),
  external_id      text,
  external_version text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'degraded')),
  last_error_code  text,
  last_error       text,          -- sanitized, product-level message only
  last_synced_at   timestamptz,
  last_attempt_at  timestamptz,
  attempt_count    integer NOT NULL DEFAULT 0,
  next_retry_at    timestamptz,
  synced_revision  integer,
  config_hash      text,
  lock_token       uuid,
  lock_expires_at  timestamptz,
  details          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, provider)
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_provider_resources_external_unique
  ON agent_provider_resources (provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_provider_resources_org ON agent_provider_resources (org_id);
CREATE INDEX IF NOT EXISTS agent_provider_resources_retry
  ON agent_provider_resources (next_retry_at) WHERE status IN ('failed', 'pending', 'degraded');

ALTER TABLE agent_provider_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_provider_resources_owner_read" ON agent_provider_resources;
CREATE POLICY "agent_provider_resources_owner_read" ON agent_provider_resources
  FOR SELECT USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));
-- No insert/update/delete policies: only the service role writes provider state.

DROP TRIGGER IF EXISTS agent_provider_resources_updated_at ON agent_provider_resources;
CREATE TRIGGER agent_provider_resources_updated_at
  BEFORE UPDATE ON agent_provider_resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill existing ElevenLabs agents. They were created by the old code whose
-- partial PATCH sync could fail silently, so they start as 'pending' with no
-- synced revision: the next save or the reconcile job pushes the full config.
INSERT INTO agent_provider_resources (org_id, agent_id, provider, external_id, status, details)
SELECT a.org_id, a.id, 'elevenlabs', a.elevenlabs_agent_id, 'pending',
       jsonb_build_object('backfilled_from', 'agents.elevenlabs_agent_id')
FROM agents a
WHERE a.elevenlabs_agent_id IS NOT NULL
ON CONFLICT (agent_id, provider) DO NOTHING;

-- ─── Phone numbers ────────────────────────────────────────────────────────────
-- app_routed: Twilio → our ingress → per-call provider choice (failover possible).
-- native_elevenlabs: number imported into ElevenLabs, which owns the Twilio
-- webhook (native transfers, but no failover and no after-hours gate).
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS routing_mode text NOT NULL DEFAULT 'app_routed';
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS supports_inbound boolean NOT NULL DEFAULT true;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS supports_outbound boolean NOT NULL DEFAULT true;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS routing_status text NOT NULL DEFAULT 'pending';
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS routing_error text;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS routing_synced_at timestamptz;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS cartesia_phone_number_id text;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE phone_numbers ADD CONSTRAINT phone_numbers_routing_mode_check CHECK (routing_mode IN ('app_routed', 'native_elevenlabs'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE phone_numbers ADD CONSTRAINT phone_numbers_routing_status_check CHECK (routing_status IN ('pending', 'ready', 'failed', 'degraded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Numbers already imported into ElevenLabs keep working exactly as before: they
-- stay native until an owner explicitly switches them (no hidden change).
UPDATE phone_numbers
SET routing_mode = 'native_elevenlabs', routing_status = 'ready'
WHERE elevenlabs_phone_number_id IS NOT NULL AND routing_mode = 'app_routed' AND routing_synced_at IS NULL;

-- Inbound routing looks numbers up by E.164; a number can belong to one org only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT number FROM phone_numbers GROUP BY number HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_number_unique ON phone_numbers (number);
  ELSE
    RAISE NOTICE 'phone_numbers_number_unique skipped: duplicate numbers exist. Resolve them, then re-run.';
  END IF;
END $$;

DROP TRIGGER IF EXISTS phone_numbers_updated_at ON phone_numbers;
CREATE TRIGGER phone_numbers_updated_at
  BEFORE UPDATE ON phone_numbers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Calls ────────────────────────────────────────────────────────────────────
ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider text;               -- provider that actually served the call
ALTER TABLE calls ADD COLUMN IF NOT EXISTS primary_provider text;       -- provider we wanted
ALTER TABLE calls ADD COLUMN IF NOT EXISTS routing_reason text;         -- see lib/voice-providers/routing.ts
ALTER TABLE calls ADD COLUMN IF NOT EXISTS failover_reason text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS routing jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider_call_id text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS cartesia_call_id text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS from_number text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS to_number text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_successful text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_title text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS analysis jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS termination_reason text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS cost_credits numeric;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS cost_usd numeric;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS has_recording boolean NOT NULL DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_status text NOT NULL DEFAULT 'unknown';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS lifecycle_rank smallint NOT NULL DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS workflows_triggered_at timestamptz;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS usage_recorded_at timestamptz;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_status_check;
ALTER TABLE calls ADD CONSTRAINT calls_status_check CHECK (status IN (
  'completed', 'failed', 'busy', 'no-answer', 'in-progress',
  'ringing', 'canceled', 'after-hours', 'transferred'
)) NOT VALID;
ALTER TABLE calls VALIDATE CONSTRAINT calls_status_check;
DO $$ BEGIN
  ALTER TABLE calls ADD CONSTRAINT calls_provider_check CHECK (provider IS NULL OR provider IN ('elevenlabs', 'cartesia'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE calls ADD CONSTRAINT calls_call_successful_check CHECK (call_successful IS NULL OR call_successful IN ('success', 'failure', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE calls ADD CONSTRAINT calls_recording_status_check CHECK (recording_status IN ('unknown', 'pending', 'available', 'unavailable', 'deleted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rows written by the old ElevenLabs-only code were ElevenLabs calls.
UPDATE calls
SET provider = 'elevenlabs', primary_provider = 'elevenlabs', provider_call_id = elevenlabs_conversation_id,
    routing_reason = COALESCE(routing_reason, 'primary')
WHERE elevenlabs_conversation_id IS NOT NULL AND provider IS NULL;
UPDATE calls SET lifecycle_rank = 50 WHERE status = 'completed' AND lifecycle_rank = 0;

CREATE UNIQUE INDEX IF NOT EXISTS calls_cartesia_call_id_unique ON calls (cartesia_call_id) WHERE cartesia_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calls_org_started ON calls (org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS calls_org_provider ON calls (org_id, provider);
-- Router: early stream ends across organizations (shared media circuit).
DROP INDEX IF EXISTS calls_early_stream_end;
CREATE INDEX IF NOT EXISTS calls_early_stream_end_at ON calls ((routing ->> 'early_stream_end_at')) WHERE (routing ->> 'early_stream_end_at') IS NOT NULL;

DROP TRIGGER IF EXISTS calls_updated_at ON calls;
CREATE TRIGGER calls_updated_at BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Webhook events (idempotent ingestion) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     text NOT NULL,
  event_type   text NOT NULL,
  dedupe_key   text NOT NULL,
  external_id  text,
  org_id       uuid REFERENCES organizations(id) ON DELETE CASCADE,
  call_id      uuid REFERENCES calls(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  attempts     integer NOT NULL DEFAULT 0,
  last_error   text,
  -- Kept only until processed (PII minimisation): cleared on success.
  payload      jsonb,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, dedupe_key)
);
CREATE INDEX IF NOT EXISTS webhook_events_pending ON webhook_events (received_at) WHERE status IN ('received', 'failed');
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY; -- service role only (no policies)

-- ─── Usage ledger (each call billed exactly once) ─────────────────────────────
CREATE TABLE IF NOT EXISTS usage_ledger (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id          uuid REFERENCES calls(id) ON DELETE SET NULL, -- usage survives a deleted call row
  idempotency_key  text NOT NULL UNIQUE,
  provider         text,
  billable_seconds integer NOT NULL DEFAULT 0,
  minutes          integer NOT NULL DEFAULT 0,
  source           text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_ledger_org_created ON usage_ledger (org_id, created_at DESC);
ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_ledger_owner_read" ON usage_ledger;
CREATE POLICY "usage_ledger_owner_read" ON usage_ledger
  FOR SELECT USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.record_call_usage(
  p_org_id uuid, p_call_id uuid, p_key text, p_seconds integer, p_provider text, p_source text
)
RETURNS TABLE (recorded boolean, minutes integer, minutes_used_after integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_minutes integer := GREATEST(0, CEIL(GREATEST(p_seconds, 0) / 60.0))::integer;
  v_after integer;
BEGIN
  INSERT INTO usage_ledger (org_id, call_id, idempotency_key, provider, billable_seconds, minutes, source)
  VALUES (p_org_id, p_call_id, p_key, p_provider, GREATEST(p_seconds, 0), v_minutes, p_source)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, v_minutes, NULL::integer;
    RETURN;
  END IF;
  UPDATE organizations SET minutes_used = COALESCE(minutes_used, 0) + v_minutes
  WHERE id = p_org_id RETURNING minutes_used INTO v_after;
  IF p_call_id IS NOT NULL THEN
    UPDATE calls SET usage_recorded_at = now() WHERE id = p_call_id;
  END IF;
  RETURN QUERY SELECT true, v_minutes, v_after;
END;
$$;

-- Atomic revision bump for the provider-managed agents.config_revision column.
CREATE OR REPLACE FUNCTION public.bump_agent_revision(p_agent_id uuid)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE agents SET config_revision = config_revision + 1 WHERE id = p_agent_id RETURNING config_revision;
$$;

-- ─── Circuit breaker state + provider telemetry (service role only) ───────────
CREATE TABLE IF NOT EXISTS provider_circuit_state (
  provider   text PRIMARY KEY,
  state      jsonb NOT NULL,
  version    integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE provider_circuit_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS provider_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  system     text NOT NULL,
  kind       text NOT NULL,
  operation  text,
  ok         boolean NOT NULL,
  latency_ms integer,
  status     integer,
  error_code text,
  org_id     uuid,
  agent_id   uuid,
  call_id    uuid,
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_events_recent ON provider_events (created_at DESC);
CREATE INDEX IF NOT EXISTS provider_events_kind ON provider_events (system, kind, created_at DESC);
ALTER TABLE provider_events ENABLE ROW LEVEL SECURITY;

-- ─── Platform-level provider resources (created once per deployment) ──────────
-- e.g. the ElevenLabs transfer webhook tool, the Cartesia SIP trunk provider,
-- the Cartesia call-event webhook. Secrets are never stored here.
CREATE TABLE IF NOT EXISTS platform_resources (
  key         text PRIMARY KEY,
  provider    text NOT NULL,
  external_id text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_resources ENABLE ROW LEVEL SECURITY; -- service role only

-- ─── Rate limiting ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS TABLE (allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
BEGIN
  INSERT INTO rate_limit_buckets (key, window_start, count) VALUES (p_key, v_window, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit_buckets.count + 1
  RETURNING count INTO v_count;
  IF random() < 0.01 THEN
    DELETE FROM rate_limit_buckets WHERE window_start < now() - interval '2 days';
  END IF;
  RETURN QUERY SELECT v_count <= p_limit, GREATEST(p_limit - v_count, 0), v_window + make_interval(secs => p_window_seconds);
END;
$$;

-- ─── Voice registry (tenant isolation for workspace voices) ───────────────────
-- The ElevenLabs workspace is shared by every customer. Only voices listed here
-- (platform-wide rows have owner_org_id NULL) or premade provider voices may be
-- selected; a voice cloned for one org is never offered to another.
CREATE TABLE IF NOT EXISTS provider_voices (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider               text NOT NULL CHECK (provider IN ('elevenlabs', 'cartesia')),
  voice_id               text NOT NULL,
  source                 text NOT NULL CHECK (source IN ('library', 'cloned', 'designed', 'premade')),
  source_public_owner_id text,
  source_voice_id        text,
  owner_org_id           uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name                   text,
  language               text,
  gender                 text,
  accent                 text,
  category               text,
  preview_url            text,
  status                 text NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'failed', 'deleted')),
  consent                jsonb,
  created_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz,
  UNIQUE (provider, voice_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_voices_library_source
  ON provider_voices (provider, source_voice_id) WHERE source = 'library';
CREATE INDEX IF NOT EXISTS provider_voices_owner ON provider_voices (owner_org_id);
ALTER TABLE provider_voices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "provider_voices_visible" ON provider_voices;
CREATE POLICY "provider_voices_visible" ON provider_voices
  FOR SELECT USING (
    owner_org_id IS NULL
    OR owner_org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

-- ─── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_kind    text NOT NULL DEFAULT 'user',
  action        text NOT NULL,
  target_type   text,
  target_id     text,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_org_created ON audit_log (org_id, created_at DESC);
-- Tombstones checked before a late provider event could recreate a deleted call.
CREATE INDEX IF NOT EXISTS audit_log_call_deleted ON audit_log USING gin (details jsonb_path_ops) WHERE action = 'call.deleted';
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_owner_read" ON audit_log;
CREATE POLICY "audit_log_owner_read" ON audit_log
  FOR SELECT USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

-- ─── Knowledge documents ──────────────────────────────────────────────────────
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS cartesia_doc_id text;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS attached_at timestamptz;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
-- Bounded plain-text excerpt (≤ 8k chars) given to the Cartesia fallback agent.
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS content_excerpt text;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE knowledge_documents DROP CONSTRAINT IF EXISTS knowledge_documents_type_check;
ALTER TABLE knowledge_documents ADD CONSTRAINT knowledge_documents_type_check
  CHECK (type IN ('pdf', 'txt', 'docx', 'md', 'url', 'text', 'html', 'epub'));
DROP TRIGGER IF EXISTS knowledge_documents_updated_at ON knowledge_documents;
CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- Documents the old code marked 'ready' were never attached to the agent (the
-- attach endpoint it used no longer exists). Flag them for the next sync.
UPDATE knowledge_documents SET status = 'processing', error_message = NULL
WHERE status = 'ready' AND elevenlabs_doc_id IS NOT NULL AND attached_at IS NULL;

-- ─── Platform-managed columns are not writable with a tenant JWT ──────────────
-- RLS decides WHICH rows a tenant may touch; these triggers decide WHICH
-- columns. Service-role (webhooks, server-side sync) is unaffected.
CREATE OR REPLACE FUNCTION public.guard_platform_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'organizations' THEN
    IF TG_OP = 'UPDATE' AND (
         NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.minutes_used IS DISTINCT FROM OLD.minutes_used
      OR NEW.minutes_limit IS DISTINCT FROM OLD.minutes_limit
      OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
      OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
    ) THEN
      RAISE EXCEPTION 'billing fields are managed by the platform' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'agents' THEN
    -- Voices are eligibility-checked server-side (the ElevenLabs workspace is
    -- shared by every tenant), so they are written by the platform only.
    IF TG_OP = 'INSERT' AND (NEW.elevenlabs_agent_id IS NOT NULL OR NEW.voice_id IS NOT NULL OR NEW.fallback_voice_id IS NOT NULL) THEN
      RAISE EXCEPTION 'provider-managed agent fields are set by the platform' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (
         NEW.elevenlabs_agent_id IS DISTINCT FROM OLD.elevenlabs_agent_id
      OR NEW.org_id IS DISTINCT FROM OLD.org_id
      OR NEW.voice_id IS DISTINCT FROM OLD.voice_id
      OR NEW.voice_name IS DISTINCT FROM OLD.voice_name
      OR NEW.fallback_voice_id IS DISTINCT FROM OLD.fallback_voice_id
      OR NEW.voice_sync_status IS DISTINCT FROM OLD.voice_sync_status
      OR NEW.voice_sync_started_at IS DISTINCT FROM OLD.voice_sync_started_at
      OR NEW.config_revision IS DISTINCT FROM OLD.config_revision
    ) THEN
      RAISE EXCEPTION 'provider-managed agent fields are read-only' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'phone_numbers' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'phone numbers are provisioned by the platform' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (
         NEW.number IS DISTINCT FROM OLD.number
      OR NEW.twilio_sid IS DISTINCT FROM OLD.twilio_sid
      OR NEW.org_id IS DISTINCT FROM OLD.org_id
      OR NEW.elevenlabs_phone_number_id IS DISTINCT FROM OLD.elevenlabs_phone_number_id
      OR NEW.cartesia_phone_number_id IS DISTINCT FROM OLD.cartesia_phone_number_id
      OR NEW.routing_mode IS DISTINCT FROM OLD.routing_mode
      OR NEW.routing_status IS DISTINCT FROM OLD.routing_status
      OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
    ) THEN
      RAISE EXCEPTION 'provider-managed phone fields are read-only' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'knowledge_documents' THEN
    -- Tenants may create a document row (their own agent, their own Storage
    -- folder, nothing processed yet) and rename it; everything the provider
    -- pipeline writes is platform-managed. Otherwise a tenant could point
    -- elevenlabs_doc_id at another org's document in the shared workspace,
    -- or attach a document to another org's agent.
    IF TG_OP = 'INSERT' THEN
      IF NEW.elevenlabs_doc_id IS NOT NULL OR NEW.cartesia_doc_id IS NOT NULL
         OR NEW.attached_at IS NOT NULL OR NEW.last_synced_at IS NOT NULL
         OR NEW.content_excerpt IS NOT NULL OR NEW.status IS DISTINCT FROM 'processing' THEN
        RAISE EXCEPTION 'knowledge processing fields are managed by the platform' USING ERRCODE = '42501';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.agents a WHERE a.id = NEW.agent_id AND a.org_id = NEW.org_id) THEN
        RAISE EXCEPTION 'agent does not belong to this organization' USING ERRCODE = '42501';
      END IF;
      IF NEW.storage_path IS NOT NULL AND split_part(NEW.storage_path, '/', 1) <> NEW.org_id::text THEN
        RAISE EXCEPTION 'storage path outside the organization folder' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND (
         NEW.org_id IS DISTINCT FROM OLD.org_id
      OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
      OR NEW.elevenlabs_doc_id IS DISTINCT FROM OLD.elevenlabs_doc_id
      OR NEW.cartesia_doc_id IS DISTINCT FROM OLD.cartesia_doc_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
      OR NEW.url IS DISTINCT FROM OLD.url
      OR NEW.attached_at IS DISTINCT FROM OLD.attached_at
      OR NEW.last_synced_at IS DISTINCT FROM OLD.last_synced_at
      OR NEW.content_excerpt IS DISTINCT FROM OLD.content_excerpt
    ) THEN
      RAISE EXCEPTION 'provider-managed knowledge fields are read-only' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'calls' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'call records are written by the platform' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'call records are read-only' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_guard ON organizations;
CREATE TRIGGER organizations_guard BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_columns();
DROP TRIGGER IF EXISTS agents_guard ON agents;
CREATE TRIGGER agents_guard BEFORE INSERT OR UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_columns();
DROP TRIGGER IF EXISTS phone_numbers_guard ON phone_numbers;
CREATE TRIGGER phone_numbers_guard BEFORE INSERT OR UPDATE ON phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_columns();
DROP TRIGGER IF EXISTS knowledge_documents_guard ON knowledge_documents;
CREATE TRIGGER knowledge_documents_guard BEFORE INSERT OR UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_columns();
DROP TRIGGER IF EXISTS calls_guard ON calls;
CREATE TRIGGER calls_guard BEFORE INSERT OR UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_columns();

-- ─── Tenant row policies: no direct INSERT/DELETE of platform-managed rows ────
-- The original FOR ALL policies let a signed-in tenant delete and re-insert
-- its organization (self-assigned plan/minutes/Stripe ids), delete its agent
-- (orphaning the external agents in the shared provider workspaces) or
-- delete/insert knowledge documents behind the server's back (rate limits,
-- per-agent caps, provider cleanup). Those writes now happen only through
-- the API routes (service role, scoped by the authorized org).
DROP POLICY IF EXISTS "organizations_owner" ON organizations;
DROP POLICY IF EXISTS "organizations_owner_select" ON organizations;
DROP POLICY IF EXISTS "organizations_owner_update" ON organizations;
CREATE POLICY "organizations_owner_select" ON organizations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "organizations_owner_update" ON organizations FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "agents_owner" ON agents;
DROP POLICY IF EXISTS "agents_owner_select" ON agents;
DROP POLICY IF EXISTS "agents_owner_update" ON agents;
CREATE POLICY "agents_owner_select" ON agents FOR SELECT
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));
CREATE POLICY "agents_owner_update" ON agents FOR UPDATE
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "knowledge_documents_owner" ON knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_owner_select" ON knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_owner_update" ON knowledge_documents;
CREATE POLICY "knowledge_documents_owner_select" ON knowledge_documents FOR SELECT
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));
CREATE POLICY "knowledge_documents_owner_update" ON knowledge_documents FOR UPDATE
  USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

-- ─── RPC privileges ───────────────────────────────────────────────────────────
-- SECURITY DEFINER functions are executable by PUBLIC by default; with the
-- anon key any visitor could have called increment_minutes_used.
REVOKE ALL ON FUNCTION public.increment_minutes_used(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_minutes_used(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.record_call_usage(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_call_usage(uuid, uuid, text, integer, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.bump_agent_revision(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_agent_revision(uuid) TO service_role;

-- ─── Storage: knowledge documents scoped to the owning org folder ─────────────
-- Paths are `${org_id}/${agent_id}/${file}`. The previous policy let any
-- authenticated user read/write every org's documents.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    -- Tenants only READ their own folder: uploads go through server-created
    -- signed upload URLs and deletes through the server (rate limits, caps,
    -- validation and cleanup all live there).
    -- Signed upload URLs do not enforce a size: cap the bucket itself at the
    -- ElevenLabs knowledge-base limit (content is validated server-side).
    EXECUTE 'UPDATE storage.buckets SET file_size_limit = 20971520 WHERE id = ''knowledge-documents''';
    EXECUTE 'DROP POLICY IF EXISTS "knowledge_docs_rw" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "knowledge_docs_owner" ON storage.objects';
    EXECUTE $p$
      CREATE POLICY "knowledge_docs_owner" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'knowledge-documents'
          AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.organizations WHERE user_id = auth.uid())
        )
    $p$;
  END IF;
END $$;

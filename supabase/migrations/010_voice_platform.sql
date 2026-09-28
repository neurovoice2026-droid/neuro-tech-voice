-- ══════════════════════════════════════════════════════════════════════════════
-- 010_voice_platform.sql
--
-- What it does
--   Additive schema for the Cartesia + OpenAI voice platform (ElevenLabs stays
--   as the fallback provider):
--   - folds in 008 (fallback_message default) and 009 (phone number billing),
--     which were never applied to the live database;
--   - new columns on organizations, agents, phone_numbers, calls,
--     knowledge_documents, integrations and workflows (names match
--     types/index.ts);
--   - new tables: knowledge_chunks, scheduling_settings, bookings,
--     waitlist_entries, escalation_contacts, agent_messages, sms_messages,
--     sms_opt_outs, voice_clones, tool_invocations, usage_ledger,
--     provider_usage_events, voice_runtime_state, kv_store (all with RLS);
--   - functions: record_call_usage, roll_usage_period, match_knowledge_chunks,
--     dashboard_metrics, calls_chart, call_stats, increment_workflow_counters,
--     kv_incr, resolve_time_zone, plus trigger functions for updated_at and
--     call search;
--   - adds public.calls to the supabase_realtime publication.
--   Nothing is dropped or renamed.
--
-- Idempotent
--   Safe to run more than once: ADD COLUMN / CREATE TABLE / CREATE INDEX use
--   IF NOT EXISTS, constraints and publication membership are added inside
--   guarded DO blocks, policies and triggers are dropped before being created,
--   functions use CREATE OR REPLACE. Backfills that could overwrite later edits
--   (tone, trial_ends_at, the 008 update) only run in the pass that adds their
--   column or default change; the others only fill rows that are still NULL.
--
-- Prerequisites
--   - Migrations 001-007 applied (008 and 009 are included here).
--   - A Supabase project: schemas auth, storage and extensions, roles anon,
--     authenticated and service_role, auth.uid().
--   - pgcrypto installed in schema extensions (Supabase default). The vector
--     extension is created here in schema extensions if missing.
--   - Run as the postgres role (Supabase SQL editor or `supabase db push`).
--
-- Order
--   Apply 010_voice_platform.sql BEFORE 011_security_hardening.sql.
--   The app works on 010 alone; 011 then narrows what browsers may write.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- CREATE EXTENSION IF NOT EXISTS ignores WITH SCHEMA when the extension already
-- exists elsewhere; every function below references extensions.* explicitly,
-- so fail early with a clear message instead of halfway through.
DO $$
BEGIN
  IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto must be installed in schema extensions (ALTER EXTENSION pgcrypto SET SCHEMA extensions)';
  END IF;
  IF to_regtype('extensions.vector') IS NULL THEN
    RAISE EXCEPTION 'vector must be installed in schema extensions (ALTER EXTENSION vector SET SCHEMA extensions)';
  END IF;
END $$;

-- ─── 008: agents.fallback_message has no English default ─────────────────────
-- Guarded on the default still being present, so the data update runs exactly
-- once and never clears a message someone typed after 008 took effect.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.agents'::regclass
      AND a.attname = 'fallback_message'
  ) THEN
    UPDATE public.agents
    SET fallback_message = NULL
    WHERE fallback_message = 'I apologize, I cannot help with that right now.';

    ALTER TABLE public.agents ALTER COLUMN fallback_message DROP DEFAULT;
  END IF;
END $$;

-- ─── 009: phone number billing ────────────────────────────────────────────────
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_phone_numbers_stripe_subscription
  ON public.phone_numbers (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.phone_numbers ALTER COLUMN monthly_cost SET DEFAULT 1.15;

-- ─── organizations ────────────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS timezone           text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS billing_interval   text,
  ADD COLUMN IF NOT EXISTS usage_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS usage_period_end   timestamptz,
  ADD COLUMN IF NOT EXISTS sms_enabled        boolean NOT NULL DEFAULT true;

-- Existing trial orgs get a trial end 14 days after signup. Only in the pass
-- that creates the column: a later downgrade to trial sets its own end date.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.organizations'::regclass
      AND attname = 'trial_ends_at'
      AND NOT attisdropped
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN trial_ends_at timestamptz;

    UPDATE public.organizations
    SET trial_ends_at = coalesce(created_at, now()) + interval '14 days'
    WHERE plan = 'trial';
  END IF;
END $$;

-- New signups: handle_new_user inserts the org with the default plan 'trial', so
-- the 14-day clock starts at signup. SET DEFAULT rewrites no existing row, and
-- paid plans ignore the column (lib/billing/entitlements.ts callBlockReason).
ALTER TABLE public.organizations
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '14 days');

-- ─── agents ───────────────────────────────────────────────────────────────────
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS cartesia_agent_id      text,
  ADD COLUMN IF NOT EXISTS cartesia_voice_id      text,
  ADD COLUMN IF NOT EXISTS cartesia_voice_name    text,
  ADD COLUMN IF NOT EXISTS voice_speed            numeric(3, 2),
  ADD COLUMN IF NOT EXISTS voice_emotion          text,
  ADD COLUMN IF NOT EXISTS keyterms               text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lead_fields            jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recording_notice       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pipeline_mode_override text,
  ADD COLUMN IF NOT EXISTS provider_sync          jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The old dashboard kept the tone in metadata.personality. Copy valid values
-- once, when the column is created, so later tone edits are never reverted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.agents'::regclass
      AND attname = 'tone'
      AND NOT attisdropped
  ) THEN
    ALTER TABLE public.agents ADD COLUMN tone text NOT NULL DEFAULT 'professional';

    UPDATE public.agents
    SET tone = lower(btrim(metadata ->> 'personality'))
    WHERE lower(btrim(metadata ->> 'personality'))
      IN ('formal', 'empathetic', 'casual', 'friendly', 'energetic');
  END IF;
END $$;

-- ─── phone_numbers ────────────────────────────────────────────────────────────
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS routing_mode      text,
  ADD COLUMN IF NOT EXISTS sms_capable       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_url         text,
  ADD COLUMN IF NOT EXISTS routing_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS routing_error     text;

-- Numbers imported into ElevenLabs are still routed there until the app router
-- takes them over (S1 sets app_router).
UPDATE public.phone_numbers
SET routing_mode = 'elevenlabs_import'
WHERE routing_mode IS NULL
  AND elevenlabs_phone_number_id IS NOT NULL;

-- The inbound router looks a number up by `To`; two rows for one number would
-- make routing ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_number_unique
  ON public.phone_numbers (number);

-- ─── calls ────────────────────────────────────────────────────────────────────
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS voice_provider             text NOT NULL DEFAULT 'elevenlabs',
  ADD COLUMN IF NOT EXISTS pipeline_mode              text,
  ADD COLUMN IF NOT EXISTS provider_call_id           text,
  ADD COLUMN IF NOT EXISTS from_number                text,
  ADD COLUMN IF NOT EXISTS to_number                  text,
  ADD COLUMN IF NOT EXISTS is_test                    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_reason                 text,
  ADD COLUMN IF NOT EXISTS fallback_used              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_reason            text,
  ADD COLUMN IF NOT EXISTS outcome                    text,
  ADD COLUMN IF NOT EXISTS intent                     text,
  ADD COLUMN IF NOT EXISTS tags                       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extracted                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis                   jsonb,
  ADD COLUMN IF NOT EXISTS knowledge_sources          jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recording_sid              text,
  ADD COLUMN IF NOT EXISTS recording_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS billable_seconds           integer,
  ADD COLUMN IF NOT EXISTS billed_minutes             integer,
  ADD COLUMN IF NOT EXISTS usage_recorded_at          timestamptz,
  ADD COLUMN IF NOT EXISTS tts_characters             integer,
  ADD COLUMN IF NOT EXISTS stt_seconds                numeric(10, 2),
  ADD COLUMN IF NOT EXISTS stt_model                  text,
  ADD COLUMN IF NOT EXISTS agent_seconds              numeric(10, 2),
  ADD COLUMN IF NOT EXISTS llm_input_tokens           integer,
  ADD COLUMN IF NOT EXISTS llm_cached_input_tokens    integer,
  ADD COLUMN IF NOT EXISTS llm_output_tokens          integer,
  ADD COLUMN IF NOT EXISTS cartesia_credits           numeric(14, 2),
  ADD COLUMN IF NOT EXISTS search_tsv                 tsvector,
  ADD COLUMN IF NOT EXISTS updated_at                 timestamptz DEFAULT now();

-- ElevenLabs conversations already stored keep working with the provider-neutral
-- upsert key. Runs before the unique constraint below; rows the partial unique
-- index from 003 already keeps distinct.
UPDATE public.calls
SET provider_call_id = elevenlabs_conversation_id
WHERE provider_call_id IS NULL
  AND elevenlabs_conversation_id IS NOT NULL
  AND voice_provider = 'elevenlabs';

-- ─── Constraints on existing tables ───────────────────────────────────────────
-- Added by name only when missing. Inline constraints on ADD COLUMN IF NOT EXISTS
-- are skipped when the column exists, and on older Postgres versions a UNIQUE
-- there could create a duplicate index on re-run, so they live here instead.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT *
    FROM (VALUES
      ('public.organizations', 'organizations_billing_interval_check',
        $c$CHECK (billing_interval IN ('month', 'year'))$c$),
      ('public.agents', 'agents_cartesia_agent_id_key',
        $c$UNIQUE (cartesia_agent_id)$c$),
      ('public.agents', 'agents_tone_check',
        $c$CHECK (tone IN ('formal', 'professional', 'empathetic', 'casual', 'friendly', 'energetic'))$c$),
      ('public.agents', 'agents_voice_speed_check',
        $c$CHECK (voice_speed BETWEEN 0.6 AND 1.5)$c$),
      ('public.agents', 'agents_pipeline_mode_override_check',
        $c$CHECK (pipeline_mode_override IN ('cartesia_self', 'cartesia_managed', 'elevenlabs'))$c$),
      ('public.phone_numbers', 'phone_numbers_routing_mode_check',
        $c$CHECK (routing_mode IN ('app_router', 'elevenlabs_import'))$c$),
      ('public.calls', 'calls_voice_provider_check',
        $c$CHECK (voice_provider IN ('cartesia', 'elevenlabs'))$c$),
      ('public.calls', 'calls_pipeline_mode_check',
        $c$CHECK (pipeline_mode IN ('cartesia_self', 'cartesia_managed', 'elevenlabs'))$c$),
      ('public.calls', 'calls_outcome_check',
        $c$CHECK (outcome IN ('booked', 'rescheduled', 'cancelled', 'answered', 'message_taken', 'transferred', 'flagged', 'missed', 'spam', 'other'))$c$),
      -- Full (not partial) so PostgREST can use it as onConflict 'voice_provider,provider_call_id'.
      ('public.calls', 'calls_provider_call_key',
        $c$UNIQUE (voice_provider, provider_call_id)$c$)
    ) AS t (table_name, constraint_name, definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = c.table_name::regclass
        AND conname = c.constraint_name
    ) THEN
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', c.table_name, c.constraint_name, c.definition);
    END IF;
  END LOOP;
END $$;

-- ─── calls: indexes, triggers, search ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calls_search_tsv    ON public.calls USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_calls_tags          ON public.calls USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_calls_org_started   ON public.calls (org_id, started_at DESC);
-- Recent calls and the calls list order by started_at DESC NULLS LAST, id DESC
-- (started_at is nullable); a DESC index is NULLS FIRST, so it can't serve that
-- order and every request would sort all of the organisation's calls.
CREATE INDEX IF NOT EXISTS idx_calls_org_started_nl ON public.calls (org_id, started_at DESC NULLS LAST, id DESC);
-- dashboard_metrics reads these columns for every non-test call of the org:
-- covered, it can answer from the index instead of visiting each row.
CREATE INDEX IF NOT EXISTS idx_calls_org_metrics   ON public.calls (org_id)
  INCLUDE (started_at, created_at, duration_seconds, status, sentiment, outcome)
  WHERE NOT is_test;
CREATE INDEX IF NOT EXISTS idx_calls_org_outcome   ON public.calls (org_id, outcome);
CREATE INDEX IF NOT EXISTS idx_calls_agent         ON public.calls (agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_phone_number  ON public.calls (phone_number_id);

DROP TRIGGER IF EXISTS calls_updated_at ON public.calls;
CREATE TRIGGER calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- One search document per call (caller number, summary, every transcript
-- message) so the calls list can filter with a single indexed @@ query.
CREATE OR REPLACE FUNCTION public.calls_search_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Status/usage updates arrive several times per call; skip rebuilding the
  -- vector (and ignore client-supplied values) unless the text changed.
  IF TG_OP = 'UPDATE'
     AND OLD.search_tsv IS NOT NULL
     AND NEW.caller_number IS NOT DISTINCT FROM OLD.caller_number
     AND NEW.summary IS NOT DISTINCT FROM OLD.summary
     AND NEW.transcript IS NOT DISTINCT FROM OLD.transcript THEN
    NEW.search_tsv := OLD.search_tsv;
    RETURN NEW;
  END IF;

  -- 'simple' keeps names and numbers intact across the 14 agent languages.
  -- The length cap keeps a pathological transcript from failing the insert.
  NEW.search_tsv := to_tsvector(
    'simple'::regconfig,
    left(
      coalesce(NEW.caller_number, '') || ' ' ||
      coalesce(NEW.summary, '') || ' ' ||
      coalesce((
        SELECT string_agg(t.entry ->> 'message', ' ')
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(NEW.transcript) = 'array' THEN NEW.transcript ELSE '[]'::jsonb END
        ) AS t (entry)
      ), ''),
      1000000
    )
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.calls_search_tsv() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS calls_search_tsv ON public.calls;
CREATE TRIGGER calls_search_tsv
  BEFORE INSERT OR UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.calls_search_tsv();

-- Backfill rows that predate the trigger: a NULL vector makes the trigger rebuild
-- it. After the first pass no row has a NULL vector, so a re-run touches nothing.
UPDATE public.calls SET search_tsv = NULL WHERE search_tsv IS NULL;

-- Realtime: the dashboard subscribes to postgres_changes on calls.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'calls'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
END $$;

-- ─── knowledge_documents ──────────────────────────────────────────────────────
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS cartesia_doc_id     text,
  ADD COLUMN IF NOT EXISTS chunk_count         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_sha256      text,
  ADD COLUMN IF NOT EXISTS extracted_text_path text,
  ADD COLUMN IF NOT EXISTS provider_sync       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS knowledge_documents_updated_at ON public.knowledge_documents;
CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ─── integrations ─────────────────────────────────────────────────────────────
-- google_refresh_token_encrypted replaces the plaintext column (AES-256-GCM in
-- lib/security/crypto.ts); the plaintext column is left for a later cleanup.
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS google_refresh_token_encrypted text,
  ADD COLUMN IF NOT EXISTS scopes                         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS account_email                  text;

-- ─── workflows ────────────────────────────────────────────────────────────────
-- Volatile default: each existing workflow gets its own secret when the column
-- is added. Used to sign outgoing webhook deliveries.
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS signing_secret text NOT NULL
    DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

-- ─── Shared trigger function for new tables ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- ─── knowledge_chunks ─────────────────────────────────────────────────────────
-- In-app RAG: chunks embedded with text-embedding-3-small (1536 dimensions).
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  heading     text,
  content     text NOT NULL,
  token_count integer,
  embedding   extensions.vector(1536),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent    ON public.knowledge_chunks (agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON public.knowledge_chunks (document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org      ON public.knowledge_chunks (org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks USING hnsw (embedding extensions.vector_cosine_ops);

-- ─── scheduling_settings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduling_settings (
  org_id                uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  calendar_id           text NOT NULL DEFAULT 'primary',
  slot_minutes          integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
  buffer_minutes        integer NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  min_notice_minutes    integer NOT NULL DEFAULT 60 CHECK (min_notice_minutes >= 0),
  max_days_ahead        integer NOT NULL DEFAULT 30 CHECK (max_days_ahead >= 0),
  -- Same shape and default as agents.working_hours.
  business_hours        jsonb NOT NULL DEFAULT '{
    "monday":    {"start": "09:00", "end": "18:00", "enabled": true},
    "tuesday":   {"start": "09:00", "end": "18:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "18:00", "enabled": true},
    "thursday":  {"start": "09:00", "end": "18:00", "enabled": true},
    "friday":    {"start": "09:00", "end": "18:00", "enabled": true},
    "saturday":  {"start": "09:00", "end": "18:00", "enabled": false},
    "sunday":    {"start": "09:00", "end": "18:00", "enabled": false}
  }'::jsonb,
  services              jsonb NOT NULL DEFAULT '[]'::jsonb,
  send_sms_confirmation boolean NOT NULL DEFAULT true,
  send_reminders        boolean NOT NULL DEFAULT true,
  reminder_hours_before integer NOT NULL DEFAULT 24 CHECK (reminder_hours_before >= 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ─── bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id             uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  call_id              uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  calendar_id          text NOT NULL,
  google_event_id      text,
  caller_name          text NOT NULL,
  caller_phone         text,
  caller_email         text,
  service              text,
  starts_at            timestamptz NOT NULL,
  ends_at              timestamptz NOT NULL,
  timezone             text NOT NULL,
  status               text NOT NULL DEFAULT 'booked'
                         CHECK (status IN ('booked', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  notes                text,
  -- Tool calls can be retried by the model or the gateway; one booking per key.
  idempotency_key      text UNIQUE,
  confirmation_sent_at timestamptz,
  reminder_sent_at     timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_time_range_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_org_starts       ON public.bookings (org_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_org_caller_phone ON public.bookings (org_id, caller_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_agent            ON public.bookings (agent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_call             ON public.bookings (call_id);

-- ─── waitlist_entries ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  call_id         uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  caller_name     text,
  caller_phone    text NOT NULL,
  service         text,
  preferred_times text,
  status          text NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'offered', 'booked', 'removed')),
  offered_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_org_created ON public.waitlist_entries (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_agent       ON public.waitlist_entries (agent_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_call        ON public.waitlist_entries (call_id);

-- ─── escalation_contacts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escalation_contacts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  role             text,
  -- Transfers dial this number directly, so only E.164 is accepted.
  phone            text CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email            text,
  transfer_enabled boolean NOT NULL DEFAULT false,
  notify_sms       boolean NOT NULL DEFAULT false,
  notify_email     boolean NOT NULL DEFAULT true,
  is_on_call       boolean NOT NULL DEFAULT false,
  conditions       text,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_contacts_org ON public.escalation_contacts (org_id, sort_order);

-- ─── agent_messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id             uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  call_id              uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  recipient_contact_id uuid REFERENCES public.escalation_contacts(id) ON DELETE SET NULL,
  recipient_name       text,
  caller_name          text,
  caller_number        text,
  callback_number      text,
  body                 text NOT NULL,
  urgency              text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  status               text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'notified', 'read', 'done')),
  notified_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_org_created ON public.agent_messages (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_agent       ON public.agent_messages (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_call        ON public.agent_messages (call_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_recipient   ON public.agent_messages (recipient_contact_id);
-- The inbox filters by status and orders urgent first, then newest.
CREATE INDEX IF NOT EXISTS idx_agent_messages_org_status   ON public.agent_messages (org_id, status, urgency DESC, created_at DESC);

-- ─── sms_messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id     uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  booking_id  uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  direction   text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  kind        text NOT NULL
                CHECK (kind IN ('confirmation', 'reminder', 'custom', 'notification', 'waitlist_offer', 'inbound')),
  to_number   text NOT NULL,
  from_number text NOT NULL,
  body        text NOT NULL,
  -- Twilio status callbacks update the row by SID.
  twilio_sid  text UNIQUE,
  status      text NOT NULL DEFAULT 'queued',
  error_code  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_org_created ON public.sms_messages (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_call        ON public.sms_messages (call_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_booking     ON public.sms_messages (booking_id);

-- ─── sms_opt_outs ─────────────────────────────────────────────────────────────
-- STOP keywords per org and number; checked before every outbound SMS.
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone        text NOT NULL,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, phone)
);

-- ─── voice_clones ─────────────────────────────────────────────────────────────
-- Consent columns are the audit trail for cloning a real person's voice.
CREATE TABLE IF NOT EXISTS public.voice_clones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cartesia_voice_id   text NOT NULL UNIQUE,
  elevenlabs_voice_id text,
  name                text NOT NULL,
  language            text NOT NULL,
  accent              text,
  gender              text CHECK (gender IN ('masculine', 'feminine', 'gender_neutral')),
  source_storage_path text,
  consent_attested_by uuid NOT NULL,
  consent_attested_at timestamptz NOT NULL,
  consent_statement   text NOT NULL,
  status              text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'failed', 'deleted')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_clones_org ON public.voice_clones (org_id, created_at DESC);

-- ─── tool_invocations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tool_invocations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id        uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  tool_name      text NOT NULL,
  arguments      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok             boolean NOT NULL DEFAULT false,
  result_summary text,
  latency_ms     integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_invocations_call ON public.tool_invocations (call_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_org  ON public.tool_invocations (org_id);

-- ─── usage_ledger ─────────────────────────────────────────────────────────────
-- Idempotent source of truth for billed minutes and overage: one row per billed
-- call (key 'call:twilio:<CallSid>' etc.), per period reset and per adjustment.
CREATE TABLE IF NOT EXISTS public.usage_ledger (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id               uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  kind                  text NOT NULL CHECK (kind IN ('call', 'adjustment', 'reset')),
  voice_provider        text,
  pipeline_mode         text,
  billable_seconds      integer NOT NULL DEFAULT 0,
  billed_minutes        integer NOT NULL DEFAULT 0,
  overage_minutes       integer NOT NULL DEFAULT 0,
  overage_rate_usd      numeric(6, 4),
  period_start          timestamptz NOT NULL,
  cost_total_usd        numeric(10, 5),
  idempotency_key       text NOT NULL UNIQUE,
  stripe_meter_event_id text UNIQUE,
  reported_to_stripe_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_org_period ON public.usage_ledger (org_id, period_start);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_unreported ON public.usage_ledger (created_at)
  WHERE overage_minutes > 0 AND reported_to_stripe_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usage_ledger_call       ON public.usage_ledger (call_id);

-- ─── provider_usage_events ────────────────────────────────────────────────────
-- Platform-level metering (Cartesia credits, OpenAI tokens...). org_id is
-- nullable: previews and tools can run outside an org, and rows outlive orgs
-- so the provider bill can still be reconciled.
CREATE TABLE IF NOT EXISTS public.provider_usage_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  call_id    uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  provider   text NOT NULL CHECK (provider IN ('cartesia', 'openai', 'elevenlabs', 'twilio')),
  -- tts_characters, stt_seconds, agent_seconds, llm_tokens, clone, tts_tool, stt_tool, preview
  kind       text NOT NULL,
  quantity   numeric NOT NULL,
  credits    numeric NOT NULL DEFAULT 0,
  cost_cents numeric,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_usage_events_provider_created
  ON public.provider_usage_events (provider, created_at);
CREATE INDEX IF NOT EXISTS idx_provider_usage_events_org  ON public.provider_usage_events (org_id);
CREATE INDEX IF NOT EXISTS idx_provider_usage_events_call ON public.provider_usage_events (call_id);

-- ─── voice_runtime_state ──────────────────────────────────────────────────────
-- Single row (id is always true). Budget flags set on a real quota_exceeded so
-- every instance stops routing to an exhausted Cartesia budget until the cycle ends.
CREATE TABLE IF NOT EXISTS public.voice_runtime_state (
  id                      boolean PRIMARY KEY DEFAULT true CHECK (id),
  credits_exhausted_cycle text,
  agent_exhausted_cycle   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.voice_runtime_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ─── kv_store ─────────────────────────────────────────────────────────────────
-- Fallback for rate limits and breaker state when Upstash is not configured.
CREATE TABLE IF NOT EXISTS public.kv_store (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_kv_store_expires_at ON public.kv_store (expires_at);

-- ─── updated_at triggers on new tables ────────────────────────────────────────
DROP TRIGGER IF EXISTS scheduling_settings_updated_at ON public.scheduling_settings;
CREATE TRIGGER scheduling_settings_updated_at
  BEFORE UPDATE ON public.scheduling_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS voice_runtime_state_updated_at ON public.voice_runtime_state;
CREATE TRIGGER voice_runtime_state_updated_at
  BEFORE UPDATE ON public.voice_runtime_state
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ─── Row Level Security (new tables) ──────────────────────────────────────────
-- Owner = the org belongs to the signed-in user. (select auth.uid()) is
-- evaluated once per statement instead of once per row.
ALTER TABLE public.knowledge_chunks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_opt_outs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_clones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_invocations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_runtime_state   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kv_store              ENABLE ROW LEVEL SECURITY;

-- knowledge_chunks: read own (writes come from the ingest route with the admin client)
DROP POLICY IF EXISTS knowledge_chunks_select_own ON public.knowledge_chunks;
CREATE POLICY knowledge_chunks_select_own ON public.knowledge_chunks
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- scheduling_settings: read, create and edit own
DROP POLICY IF EXISTS scheduling_settings_select_own ON public.scheduling_settings;
CREATE POLICY scheduling_settings_select_own ON public.scheduling_settings
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS scheduling_settings_insert_own ON public.scheduling_settings;
CREATE POLICY scheduling_settings_insert_own ON public.scheduling_settings
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS scheduling_settings_update_own ON public.scheduling_settings;
CREATE POLICY scheduling_settings_update_own ON public.scheduling_settings
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- bookings: read own (the calendar sync and the voice tools write)
DROP POLICY IF EXISTS bookings_select_own ON public.bookings;
CREATE POLICY bookings_select_own ON public.bookings
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- waitlist_entries: read and update own
DROP POLICY IF EXISTS waitlist_entries_select_own ON public.waitlist_entries;
CREATE POLICY waitlist_entries_select_own ON public.waitlist_entries
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS waitlist_entries_update_own ON public.waitlist_entries;
CREATE POLICY waitlist_entries_update_own ON public.waitlist_entries
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- escalation_contacts: full control of own
DROP POLICY IF EXISTS escalation_contacts_all_own ON public.escalation_contacts;
CREATE POLICY escalation_contacts_all_own ON public.escalation_contacts
  FOR ALL TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- agent_messages: read and update (mark read/done) own
DROP POLICY IF EXISTS agent_messages_select_own ON public.agent_messages;
CREATE POLICY agent_messages_select_own ON public.agent_messages
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS agent_messages_update_own ON public.agent_messages;
CREATE POLICY agent_messages_update_own ON public.agent_messages
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- sms_messages, voice_clones, tool_invocations, usage_ledger: read own
DROP POLICY IF EXISTS sms_messages_select_own ON public.sms_messages;
CREATE POLICY sms_messages_select_own ON public.sms_messages
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS voice_clones_select_own ON public.voice_clones;
CREATE POLICY voice_clones_select_own ON public.voice_clones
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS tool_invocations_select_own ON public.tool_invocations;
CREATE POLICY tool_invocations_select_own ON public.tool_invocations
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS usage_ledger_select_own ON public.usage_ledger;
CREATE POLICY usage_ledger_select_own ON public.usage_ledger
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT o.id FROM public.organizations o WHERE o.user_id = (SELECT auth.uid())));

-- sms_opt_outs, provider_usage_events, voice_runtime_state, kv_store: service
-- role only. RLS without policies already denies API roles; revoking the
-- default Supabase grants makes that explicit.
REVOKE ALL ON public.sms_opt_outs, public.provider_usage_events, public.voice_runtime_state, public.kv_store
  FROM anon, authenticated;

-- ─── Functions: time zone helper ──────────────────────────────────────────────
-- organizations.timezone is free text; an unknown zone falls back to UTC instead
-- of failing the whole dashboard request.
CREATE OR REPLACE FUNCTION public.resolve_time_zone(p_tz text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF p_tz IS NULL OR btrim(p_tz) = '' THEN
    RETURN 'UTC';
  END IF;
  PERFORM now() AT TIME ZONE p_tz;
  RETURN p_tz;
EXCEPTION
  WHEN invalid_parameter_value THEN
    RETURN 'UTC';
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_time_zone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_time_zone(text) TO authenticated, service_role;

-- ─── Functions: usage ─────────────────────────────────────────────────────────
-- Records one billed call exactly once. Returns the minutes added, 0 for a
-- duplicate key, a test call or an unknown org.
CREATE OR REPLACE FUNCTION public.record_call_usage(
  p_org_id          uuid,
  p_call_id         uuid,
  p_idempotency_key text,
  p_voice_provider  text,
  p_pipeline_mode   text,
  p_billable_seconds integer,
  p_cost_total_usd  numeric DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_seconds      integer := greatest(coalesce(p_billable_seconds, 0), 0);
  v_minutes      integer := ceil(greatest(coalesce(p_billable_seconds, 0), 0) / 60.0)::integer;
  v_call_id      uuid;
  v_call_org_id  uuid;
  v_is_test      boolean;
  v_recorded_at  timestamptz;
  v_used         integer;
  v_limit        integer;
  v_period_start timestamptz;
  v_overage      integer;
  v_inserted     integer;
BEGIN
  IF p_org_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'record_call_usage: org id and idempotency key are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_call_id IS NOT NULL THEN
    -- Locked so two reports of the same call (Twilio status callback and the
    -- ElevenLabs webhook use different idempotency keys) can't both bill it.
    SELECT c.id, c.org_id, c.is_test, c.usage_recorded_at
      INTO v_call_id, v_call_org_id, v_is_test, v_recorded_at
      FROM public.calls c
     WHERE c.id = p_call_id
       FOR UPDATE;

    IF FOUND AND v_call_org_id <> p_org_id THEN
      RAISE EXCEPTION 'record_call_usage: call % does not belong to org %', p_call_id, p_org_id
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Dashboard test calls are never billed.
    IF coalesce(v_is_test, false) THEN
      RETURN 0;
    END IF;

    -- Already billed under another idempotency key.
    IF v_recorded_at IS NOT NULL THEN
      RETURN 0;
    END IF;
  END IF;

  -- Lock the org row so concurrent calls compute overage on a consistent total.
  SELECT coalesce(o.minutes_used, 0), coalesce(o.minutes_limit, 0), o.usage_period_start
    INTO v_used, v_limit, v_period_start
    FROM public.organizations o
   WHERE o.id = p_org_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Only the part of this call above the plan allowance is overage.
  v_overage := greatest(0, v_used + v_minutes - greatest(v_limit, v_used));

  INSERT INTO public.usage_ledger (
    org_id, call_id, kind, voice_provider, pipeline_mode, billable_seconds,
    billed_minutes, overage_minutes, period_start, cost_total_usd, idempotency_key
  )
  VALUES (
    p_org_id, v_call_id, 'call', p_voice_provider, p_pipeline_mode, v_seconds,
    v_minutes, v_overage,
    coalesce(v_period_start, date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
    p_cost_total_usd, p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    -- Redelivered webhook or status callback: already counted.
    RETURN 0;
  END IF;

  UPDATE public.organizations
     SET minutes_used = v_used + v_minutes
   WHERE id = p_org_id;

  IF v_call_id IS NOT NULL THEN
    UPDATE public.calls
       SET billable_seconds = v_seconds,
           billed_minutes = v_minutes,
           usage_recorded_at = now()
     WHERE id = v_call_id;
  END IF;

  RETURN v_minutes;
END;
$$;

REVOKE ALL ON FUNCTION public.record_call_usage(uuid, uuid, text, text, text, integer, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_call_usage(uuid, uuid, text, text, text, integer, numeric)
  TO service_role;

-- Starts a new usage period: writes a 'reset' ledger row, zeroes minutes_used
-- and stores the period bounds. Keyed on org + period start, so the daily cron
-- can call it repeatedly without resetting twice.
CREATE OR REPLACE FUNCTION public.roll_usage_period(p_org_id uuid, p_start timestamptz, p_end timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted integer;
BEGIN
  IF p_org_id IS NULL OR p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RAISE EXCEPTION 'roll_usage_period: org id and a start before the end are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Same lock as record_call_usage so a call finishing mid-reset is not lost.
  PERFORM 1 FROM public.organizations o WHERE o.id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.usage_ledger (
    org_id, kind, billable_seconds, billed_minutes, overage_minutes, period_start, idempotency_key
  )
  VALUES (
    p_org_id, 'reset', 0, 0, 0, p_start,
    'reset:' || p_org_id::text || ':' || to_char(p_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN;
  END IF;

  UPDATE public.organizations
     SET minutes_used = 0,
         usage_period_start = p_start,
         usage_period_end = p_end
   WHERE id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.roll_usage_period(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roll_usage_period(uuid, timestamptz, timestamptz) TO service_role;

-- ─── Functions: kv_store counter ──────────────────────────────────────────────
-- Fixed-window counter for lib/kv.ts kvIncr when Upstash is not configured. A
-- select-then-update through supabase-js would lose increments under concurrent
-- requests; one upsert is atomic. The window restarts once the key has expired.
CREATE OR REPLACE FUNCTION public.kv_incr(p_key text, p_ttl_seconds integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count bigint;
BEGIN
  INSERT INTO public.kv_store AS kv (key, value, expires_at)
  VALUES (p_key, '1'::jsonb, now() + make_interval(secs => greatest(coalesce(p_ttl_seconds, 1), 1)))
  ON CONFLICT (key) DO UPDATE
    SET value = CASE
          WHEN kv.expires_at IS NOT NULL AND kv.expires_at <= now() THEN '1'::jsonb
          WHEN jsonb_typeof(kv.value) = 'number' THEN to_jsonb(floor((kv.value #>> '{}')::numeric)::bigint + 1)
          ELSE '1'::jsonb
        END,
        expires_at = CASE
          WHEN kv.expires_at IS NULL OR kv.expires_at <= now() THEN EXCLUDED.expires_at
          ELSE kv.expires_at
        END
  RETURNING (kv.value #>> '{}')::bigint INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.kv_incr(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kv_incr(text, integer) TO service_role;

-- ─── Functions: workflows ─────────────────────────────────────────────────────
-- Single UPDATE so parallel workflow runs never lose a count (read-modify-write
-- in the executor did).
CREATE OR REPLACE FUNCTION public.increment_workflow_counters(p_workflow_id uuid, p_success boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.workflows
     SET runs = coalesce(runs, 0) + 1,
         successful_runs = coalesce(successful_runs, 0) + CASE WHEN p_success THEN 1 ELSE 0 END,
         last_run_at = now()
   WHERE id = p_workflow_id;
$$;

REVOKE ALL ON FUNCTION public.increment_workflow_counters(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_workflow_counters(uuid, boolean) TO service_role;

-- ─── Functions: knowledge search ──────────────────────────────────────────────
-- SECURITY INVOKER: with a user session RLS limits chunks to the caller's org;
-- the gateway tool path calls it with the service role and an explicit org.
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_org_id         uuid,
  p_agent_id       uuid,
  p_embedding      extensions.vector(1536),
  p_match_count    integer DEFAULT 5,
  p_min_similarity double precision DEFAULT 0.25
)
RETURNS TABLE (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  heading       text,
  content       text,
  similarity    double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT ranked.chunk_id, ranked.document_id, ranked.document_name, ranked.heading, ranked.content, ranked.similarity
  FROM (
    SELECT
      kc.id AS chunk_id,
      kc.document_id,
      kd.name AS document_name,
      kc.heading,
      kc.content,
      1 - (kc.embedding OPERATOR(extensions.<=>) p_embedding) AS similarity
    FROM public.knowledge_chunks kc
    JOIN public.knowledge_documents kd
      ON kd.id = kc.document_id
     AND kd.org_id = kc.org_id
     AND kd.status = 'ready'
    WHERE kc.org_id = p_org_id
      AND kc.agent_id = p_agent_id
      AND kc.embedding IS NOT NULL
    -- Order by the raw distance so the HNSW index can serve the scan.
    ORDER BY kc.embedding OPERATOR(extensions.<=>) p_embedding
    LIMIT least(greatest(coalesce(p_match_count, 5), 1), 50)
  ) AS ranked
  WHERE ranked.similarity >= coalesce(p_min_similarity, 0)
  ORDER BY ranked.similarity DESC;
$$;

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(uuid, uuid, extensions.vector, integer, double precision)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(uuid, uuid, extensions.vector, integer, double precision)
  TO authenticated, service_role;

-- With many tenants in one table, a plain HNSW scan returns only ef_search
-- (40) nearest chunks across ALL orgs before the org/agent filters run, so an
-- agent could get no results although it has matching chunks. pgvector 0.8+
-- keeps scanning until LIMIT rows pass the filters. The outer query re-sorts by
-- similarity, so relaxed ordering is safe. Re-applied on every run because
-- CREATE OR REPLACE above resets the function's settings.
DO $$
DECLARE
  v_version text[];
BEGIN
  SELECT regexp_match(e.extversion, '^(\d+)\.(\d+)')
    INTO v_version
    FROM pg_catalog.pg_extension e
   WHERE e.extname = 'vector';
  IF v_version IS NOT NULL AND (v_version[1]::integer > 0 OR v_version[2]::integer >= 8) THEN
    ALTER FUNCTION public.match_knowledge_chunks(uuid, uuid, extensions.vector, integer, double precision)
      SET hnsw.iterative_scan = 'relaxed_order';
  ELSE
    RAISE NOTICE 'pgvector older than 0.8: knowledge search keeps the plain HNSW scan';
  END IF;
END
$$;

-- ─── Functions: dashboard aggregates ──────────────────────────────────────────
-- All three are SECURITY INVOKER so RLS scopes them to the caller's org, bucket
-- days and hours in the org's time zone, use started_at (created_at when
-- missing) as the call time, and ignore dashboard test calls.

-- Keys match DashboardMetrics in types/index.ts minus minutes_used/minutes_limit,
-- which the route adds from the organization row.
CREATE OR REPLACE FUNCTION public.dashboard_metrics(p_org_id uuid, p_tz text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_tz          text := public.resolve_time_zone(p_tz);
  v_local_today date;
  v_today_start timestamptz;
  v_week_start  timestamptz;
  v_month_start timestamptz;
  v_result      jsonb;
BEGIN
  v_local_today := (now() AT TIME ZONE v_tz)::date;
  v_today_start := v_local_today::timestamp AT TIME ZONE v_tz;
  -- "This week" = today plus the previous six local days, like the 7-day chart.
  v_week_start := (v_local_today - 6)::timestamp AT TIME ZONE v_tz;
  v_month_start := date_trunc('month', v_local_today::timestamp) AT TIME ZONE v_tz;

  WITH org_calls AS (
    SELECT
      coalesce(c.started_at, c.created_at) AS happened_at,
      greatest(coalesce(c.duration_seconds, 0), 0) AS duration,
      c.status,
      c.sentiment,
      c.outcome
    FROM public.calls c
    WHERE c.org_id = p_org_id
      AND NOT c.is_test
  ),
  totals AS (
    SELECT
      count(*) AS total_calls,
      coalesce(sum(duration), 0) AS total_duration,
      count(*) FILTER (WHERE duration > 0) AS timed_calls,
      count(*) FILTER (WHERE happened_at >= v_today_start) AS calls_today,
      count(*) FILTER (WHERE happened_at >= v_week_start) AS calls_this_week,
      count(*) FILTER (WHERE happened_at >= v_month_start) AS calls_this_month,
      count(*) FILTER (WHERE sentiment = 'positive') AS positive,
      count(*) FILTER (WHERE sentiment = 'neutral') AS neutral,
      count(*) FILTER (WHERE sentiment = 'negative') AS negative,
      -- A call succeeded when it connected, lasted, and was neither missed nor spam.
      count(*) FILTER (
        WHERE status = 'completed'
          AND duration > 0
          AND coalesce(outcome, '') NOT IN ('missed', 'spam')
      ) AS successful
    FROM org_calls
  ),
  outcomes AS (
    -- Every outcome key is present, zero when no call has it.
    SELECT jsonb_object_agg(k.outcome, coalesce(n.calls, 0)) AS breakdown
    FROM unnest(ARRAY[
      'booked', 'rescheduled', 'cancelled', 'answered', 'message_taken',
      'transferred', 'flagged', 'missed', 'spam', 'other'
    ]) AS k (outcome)
    LEFT JOIN (
      SELECT oc.outcome, count(*) AS calls
      FROM org_calls oc
      WHERE oc.outcome IS NOT NULL
      GROUP BY oc.outcome
    ) AS n ON n.outcome = k.outcome
  ),
  peak AS (
    SELECT extract(hour FROM oc.happened_at AT TIME ZONE v_tz)::integer AS hour_of_day
    FROM org_calls oc
    GROUP BY 1
    ORDER BY count(*) DESC, 1
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'total_calls', t.total_calls,
    'total_duration_seconds', t.total_duration,
    'avg_duration_seconds',
      CASE WHEN t.timed_calls > 0 THEN round(t.total_duration::numeric / t.timed_calls)::integer ELSE 0 END,
    'calls_today', t.calls_today,
    'calls_this_week', t.calls_this_week,
    'calls_this_month', t.calls_this_month,
    'sentiment_breakdown', jsonb_build_object(
      'positive', t.positive,
      'neutral', t.neutral,
      'negative', t.negative
    ),
    'peak_hour', coalesce((SELECT p.hour_of_day FROM peak p), 0),
    'success_rate',
      CASE WHEN t.total_calls > 0 THEN round(t.successful * 100.0 / t.total_calls, 1) ELSE 0 END,
    'outcome_breakdown', o.breakdown
  )
  INTO v_result
  FROM totals t
  CROSS JOIN outcomes o;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_metrics(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics(uuid, text) TO authenticated, service_role;

-- One row per local day, oldest first, ending today; days without calls are 0.
-- avg_duration_seconds only averages calls that lasted (duration > 0).
CREATE OR REPLACE FUNCTION public.calls_chart(p_org_id uuid, p_days integer, p_tz text)
RETURNS TABLE (day date, calls integer, avg_duration_seconds numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH params AS (
    SELECT
      z.tz,
      (now() AT TIME ZONE z.tz)::date AS today,
      least(greatest(coalesce(p_days, 7), 1), 366) AS day_count
    FROM (SELECT public.resolve_time_zone(p_tz) AS tz) AS z
  ),
  series AS (
    SELECT p.today - g.n AS local_day
    FROM params p
    CROSS JOIN generate_series(0, p.day_count - 1) AS g (n)
  ),
  window_calls AS (
    SELECT
      (coalesce(c.started_at, c.created_at) AT TIME ZONE p.tz)::date AS local_day,
      greatest(coalesce(c.duration_seconds, 0), 0) AS duration
    FROM public.calls c
    CROSS JOIN params p
    WHERE c.org_id = p_org_id
      AND NOT c.is_test
      AND coalesce(c.started_at, c.created_at) >= ((p.today - (p.day_count - 1))::timestamp AT TIME ZONE p.tz)
  )
  SELECT
    s.local_day,
    count(w.local_day)::integer,
    coalesce(round(avg(w.duration) FILTER (WHERE w.duration > 0), 1), 0)
  FROM series s
  LEFT JOIN window_calls w ON w.local_day = s.local_day
  GROUP BY s.local_day
  ORDER BY s.local_day;
$$;

REVOKE ALL ON FUNCTION public.calls_chart(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calls_chart(uuid, integer, text) TO authenticated, service_role;

-- Keys match CallStats in types/index.ts. month_trend is a whole percentage;
-- 100 when last month had no calls and this month has some.
CREATE OR REPLACE FUNCTION public.call_stats(p_org_id uuid, p_tz text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_tz               text := public.resolve_time_zone(p_tz);
  v_month_local      timestamp;
  v_this_month_start timestamptz;
  v_last_month_start timestamptz;
  v_total            bigint;
  v_this_month       bigint;
  v_last_month       bigint;
  v_timed            bigint;
  v_duration         bigint;
BEGIN
  v_month_local := date_trunc('month', now() AT TIME ZONE v_tz);
  v_this_month_start := v_month_local AT TIME ZONE v_tz;
  v_last_month_start := (v_month_local - interval '1 month') AT TIME ZONE v_tz;

  SELECT
    count(*),
    count(*) FILTER (WHERE k.happened_at >= v_this_month_start),
    count(*) FILTER (WHERE k.happened_at >= v_last_month_start AND k.happened_at < v_this_month_start),
    count(*) FILTER (WHERE k.duration > 0),
    coalesce(sum(k.duration), 0)
  INTO v_total, v_this_month, v_last_month, v_timed, v_duration
  FROM (
    SELECT
      coalesce(c.started_at, c.created_at) AS happened_at,
      greatest(coalesce(c.duration_seconds, 0), 0) AS duration
    FROM public.calls c
    WHERE c.org_id = p_org_id
      AND NOT c.is_test
  ) AS k;

  RETURN jsonb_build_object(
    'total_calls', v_total,
    'calls_this_month', v_this_month,
    'calls_last_month', v_last_month,
    'month_trend',
      CASE
        WHEN v_last_month = 0 THEN CASE WHEN v_this_month > 0 THEN 100 ELSE 0 END
        ELSE round((v_this_month - v_last_month) * 100.0 / v_last_month)::integer
      END,
    'avg_duration_seconds',
      CASE WHEN v_timed > 0 THEN round(v_duration::numeric / v_timed)::integer ELSE 0 END,
    'total_duration_seconds', v_duration
  );
END;
$$;

REVOKE ALL ON FUNCTION public.call_stats(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_stats(uuid, text) TO authenticated, service_role;

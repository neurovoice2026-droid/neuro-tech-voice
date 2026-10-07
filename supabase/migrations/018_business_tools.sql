-- ══════════════════════════════════════════════════════════════════════════════
-- 018 · In-call business tools: bookings, messages, SMS (slice B2)
--
-- Additive and idempotent: no DROP of any kind, safe to re-run.
--   • agents.booking_settings / agents.message_settings: what the owner set
--     up for the in-call tools (validated by the API, written with the
--     service role; a tenant JWT cannot change them: guard_b2_columns)
--   • phone_numbers.sms_capable / sms_checked_at: cached Twilio SMS
--     capability of the number (platform-managed, guard_b2_columns)
--   • bookings: the local mirror of every appointment the agent wrote to the
--     business's Google Calendar (idempotent per call and slot; one active
--     booking per start time and calendar)
--   • booking_locks: a short per-organisation lease that serializes the
--     "check free, then write" of a booking across serverless instances
--   • call_slot_offers: the slots check_availability offered on a call;
--     book_appointment only accepts one of them
--   • tool_invocations: idempotency of tool requests (exact retries replay
--     the first answer)
--   • call_messages: messages taken by the agent during a call (follow-up
--     list with mark-as-done)
--   • sms_messages / sms_opt_outs: transactional texts sent by workflows,
--     and recipients who opted out (Twilio error 21610)
--   • apply_business_tool_retention(): the agent's privacy retention also
--     purges the caller details kept in these tables
-- Tenants can SELECT their own bookings, messages, texts and opt-outs; every
-- write goes through the service role (API routes, tool endpoints).
-- booking_locks, call_slot_offers and tool_invocations are internal
-- plumbing: RLS on, no policy, no tenant privileges.
-- Deploy order: apply this file BEFORE deploying the slice B2 code.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── Agent settings (platform-managed) ───────────────────────────────────────
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS booking_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS message_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── Phone numbers: cached SMS capability (platform-managed) ─────────────────
ALTER TABLE public.phone_numbers ADD COLUMN IF NOT EXISTS sms_capable boolean;
ALTER TABLE public.phone_numbers ADD COLUMN IF NOT EXISTS sms_checked_at timestamptz;

-- ─── Column guard (tenant JWTs cannot write the new platform-managed columns) ─
CREATE OR REPLACE FUNCTION public.guard_b2_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'agents' THEN
    IF TG_OP = 'INSERT' AND (NEW.booking_settings IS DISTINCT FROM '{}'::jsonb OR NEW.message_settings IS DISTINCT FROM '{}'::jsonb) THEN
      RAISE EXCEPTION 'in-call tool settings are saved through the dashboard API' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (
         NEW.booking_settings IS DISTINCT FROM OLD.booking_settings
      OR NEW.message_settings IS DISTINCT FROM OLD.message_settings
    ) THEN
      RAISE EXCEPTION 'in-call tool settings are saved through the dashboard API' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'phone_numbers' THEN
    IF TG_OP = 'UPDATE' AND (
         NEW.sms_capable IS DISTINCT FROM OLD.sms_capable
      OR NEW.sms_checked_at IS DISTINCT FROM OLD.sms_checked_at
    ) THEN
      RAISE EXCEPTION 'provider-managed phone fields are read-only' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_b2_columns() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER agents_guard_b2 BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.guard_b2_columns();
CREATE OR REPLACE TRIGGER phone_numbers_guard_b2 BEFORE UPDATE ON public.phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.guard_b2_columns();

-- ─── Bookings ────────────────────────────────────────────────────────────────
-- status: 'pending' while the calendar event is being written (the row holds
-- the time against parallel bookings), 'booked' once Google confirmed the
-- event, 'cancelled' afterwards. A booking is never confirmed to the caller
-- before it is 'booked'.
CREATE TABLE IF NOT EXISTS public.bookings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id             uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  call_id              uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  calendar_id          text NOT NULL,
  google_event_id      text,
  caller_name          text,
  caller_phone         text,
  notes                text,
  starts_at            timestamptz NOT NULL,
  ends_at              timestamptz NOT NULL,
  timezone             text NOT NULL,
  status               text NOT NULL DEFAULT 'pending',
  source               text NOT NULL DEFAULT 'voice_tool',
  idempotency_key      text,
  retention_applied_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'booked', 'cancelled')),
  CONSTRAINT bookings_source_check CHECK (source IN ('voice_tool', 'dashboard')),
  CONSTRAINT bookings_time_check CHECK (ends_at > starts_at)
);
-- Retries of the same request (same call, same start) find the first booking.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency ON public.bookings (org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
-- Two callers can never hold the same start time on the same calendar.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot ON public.bookings (org_id, calendar_id, starts_at) WHERE status IN ('pending', 'booked');
CREATE INDEX IF NOT EXISTS bookings_org_starts ON public.bookings (org_id, starts_at);
CREATE INDEX IF NOT EXISTS bookings_call ON public.bookings (call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_retention_pending ON public.bookings (agent_id, ends_at) WHERE retention_applied_at IS NULL;
CREATE OR REPLACE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Booking lease (one writer per organisation at a time) ───────────────────
CREATE TABLE IF NOT EXISTS public.booking_locks (
  org_id     uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  lock_owner text NOT NULL,
  lock_until timestamptz NOT NULL
);

-- ─── Slots offered during a call ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_slot_offers (
  call_id    uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  slot_id    text NOT NULL,
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, slot_id),
  CONSTRAINT call_slot_offers_time_check CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS call_slot_offers_created ON public.call_slot_offers (created_at);

-- ─── Tool request idempotency ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tool_invocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id         uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  tool            text NOT NULL,
  idempotency_key text NOT NULL,
  status          text NOT NULL DEFAULT 'running',
  response        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  CONSTRAINT tool_invocations_status_check CHECK (status IN ('running', 'completed')),
  CONSTRAINT tool_invocations_unique UNIQUE (call_id, tool, idempotency_key)
);
CREATE INDEX IF NOT EXISTS tool_invocations_created ON public.tool_invocations (created_at);

-- ─── Messages taken during calls ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id             uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  -- Deleting a call (privacy request) deletes the message taken on it.
  call_id              uuid REFERENCES public.calls(id) ON DELETE CASCADE,
  provider             text,
  caller_name          text,
  callback_number      text,
  reason               text NOT NULL DEFAULT '',
  urgency              text NOT NULL DEFAULT 'normal',
  status               text NOT NULL DEFAULT 'open',
  done_at              timestamptz,
  notified_at          timestamptz,
  notify_count         smallint NOT NULL DEFAULT 0,
  notify_error         text,
  retention_applied_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT call_messages_urgency_check CHECK (urgency IN ('normal', 'urgent')),
  CONSTRAINT call_messages_status_check CHECK (status IN ('open', 'done')),
  CONSTRAINT call_messages_provider_check CHECK (provider IS NULL OR provider IN ('elevenlabs', 'cartesia'))
);
-- One message per call: a second take_message on the same call updates it.
CREATE UNIQUE INDEX IF NOT EXISTS call_messages_call ON public.call_messages (call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_messages_org_status ON public.call_messages (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS call_messages_retention_pending ON public.call_messages (org_id, created_at) WHERE retention_applied_at IS NULL;
CREATE OR REPLACE TRIGGER call_messages_updated_at BEFORE UPDATE ON public.call_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Transactional texts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id              uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  phone_number_id      uuid REFERENCES public.phone_numbers(id) ON DELETE SET NULL,
  kind                 text NOT NULL DEFAULT 'workflow',
  to_number            text,
  body                 text,
  status               text NOT NULL DEFAULT 'sending',
  twilio_sid           text,
  error_code           text,
  idempotency_key      text,
  retention_applied_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sms_messages_kind_check CHECK (kind IN ('workflow')),
  CONSTRAINT sms_messages_status_check CHECK (status IN ('sending', 'sent', 'failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_idempotency ON public.sms_messages (org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_messages_org_created ON public.sms_messages (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone      text NOT NULL,
  source     text NOT NULL DEFAULT 'carrier',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, phone),
  CONSTRAINT sms_opt_outs_source_check CHECK (source IN ('carrier', 'owner'))
);

-- ─── Row level security ──────────────────────────────────────────────────────
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_slot_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

-- Tenants read their own rows; writes go through the service role only.
DO $$ BEGIN
  CREATE POLICY "bookings_owner_select" ON public.bookings FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "call_messages_owner_select" ON public.call_messages FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sms_messages_owner_select" ON public.sms_messages FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sms_opt_outs_owner_select" ON public.sms_opt_outs FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.bookings, public.call_messages, public.sms_messages, public.sms_opt_outs FROM anon, authenticated;
REVOKE SELECT ON public.bookings, public.call_messages, public.sms_messages, public.sms_opt_outs FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.booking_locks, public.call_slot_offers, public.tool_invocations FROM anon, authenticated;

-- ─── Privacy retention of the caller details kept here ───────────────────────
-- Same window as the agent's privacy setting (lib/voice-tools/retention.ts,
-- maintenance step business_tools_retention). Clears names, numbers, reasons
-- and texts; keeps times, statuses and counts. Bounded and idempotent.
CREATE OR REPLACE FUNCTION public.apply_business_tool_retention(p_agent_id uuid, p_cutoff timestamptz, p_limit integer)
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_messages integer := 0;
  v_bookings integer := 0;
  v_texts integer := 0;
BEGIN
  SELECT org_id INTO v_org FROM public.agents WHERE id = p_agent_id;
  IF v_org IS NULL OR p_limit IS NULL OR p_limit < 1 THEN
    RETURN 0;
  END IF;

  WITH picked AS (
    SELECT id FROM public.call_messages
    WHERE org_id = v_org AND created_at < p_cutoff AND retention_applied_at IS NULL
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.call_messages m
  SET caller_name = NULL, callback_number = NULL, reason = '', notify_error = NULL, retention_applied_at = now()
  FROM picked WHERE m.id = picked.id;
  GET DIAGNOSTICS v_messages = ROW_COUNT;

  WITH picked AS (
    SELECT id FROM public.bookings
    WHERE org_id = v_org AND ends_at < p_cutoff AND retention_applied_at IS NULL
    ORDER BY ends_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.bookings b
  SET caller_name = NULL, caller_phone = NULL, notes = NULL, retention_applied_at = now()
  FROM picked WHERE b.id = picked.id;
  GET DIAGNOSTICS v_bookings = ROW_COUNT;

  WITH picked AS (
    SELECT id FROM public.sms_messages
    WHERE org_id = v_org AND created_at < p_cutoff AND retention_applied_at IS NULL
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.sms_messages s
  SET to_number = NULL, body = NULL, retention_applied_at = now()
  FROM picked WHERE s.id = picked.id;
  GET DIAGNOSTICS v_texts = ROW_COUNT;

  RETURN v_messages + v_bookings + v_texts;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_business_tool_retention(uuid, timestamptz, integer) FROM PUBLIC, anon, authenticated;

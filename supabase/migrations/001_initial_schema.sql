-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Organizations ────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name                  text,
  industry              text,
  website               text,
  description           text,
  logo_url              text,
  onboarding_completed  boolean DEFAULT false,
  onboarding_step       integer DEFAULT 1,
  plan                  text DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  stripe_customer_id    text UNIQUE,
  stripe_subscription_id text UNIQUE,
  minutes_used          integer DEFAULT 0,
  minutes_limit         integer DEFAULT 100,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ─── Agents ───────────────────────────────────────────────────────────────────
CREATE TABLE agents (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  elevenlabs_agent_id   text UNIQUE,
  name                  text NOT NULL,
  voice_id              text,
  voice_name            text,
  language              text DEFAULT 'en',
  system_prompt         text,
  first_message         text,
  is_active             boolean DEFAULT false,
  working_hours         jsonb DEFAULT '{
    "monday":    {"start": "09:00", "end": "18:00", "enabled": true},
    "tuesday":   {"start": "09:00", "end": "18:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "18:00", "enabled": true},
    "thursday":  {"start": "09:00", "end": "18:00", "enabled": true},
    "friday":    {"start": "09:00", "end": "18:00", "enabled": true},
    "saturday":  {"start": "09:00", "end": "18:00", "enabled": false},
    "sunday":    {"start": "09:00", "end": "18:00", "enabled": false}
  }'::jsonb,
  fallback_message      text DEFAULT 'I apologize, I cannot help with that right now.',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ─── Phone Numbers ────────────────────────────────────────────────────────────
CREATE TABLE phone_numbers (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  twilio_sid    text UNIQUE,
  number        text NOT NULL,
  friendly_name text,
  agent_id      uuid REFERENCES agents(id) ON DELETE SET NULL,
  country       text DEFAULT 'US',
  is_active     boolean DEFAULT true,
  is_verified   boolean DEFAULT false,
  monthly_cost  decimal(10, 2) DEFAULT 1.00,
  created_at    timestamptz DEFAULT now()
);

-- ─── Calls ────────────────────────────────────────────────────────────────────
CREATE TABLE calls (
  id                         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  agent_id                   uuid REFERENCES agents(id) ON DELETE SET NULL,
  phone_number_id            uuid REFERENCES phone_numbers(id) ON DELETE SET NULL,
  twilio_call_sid            text UNIQUE,
  elevenlabs_conversation_id text,
  caller_number              text,
  direction                  text DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  duration_seconds           integer DEFAULT 0,
  status                     text DEFAULT 'in-progress' CHECK (status IN ('completed', 'failed', 'busy', 'no-answer', 'in-progress')),
  transcript                 jsonb DEFAULT '[]'::jsonb,
  sentiment                  text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  summary                    text,
  recording_url              text,
  started_at                 timestamptz DEFAULT now(),
  ended_at                   timestamptz,
  created_at                 timestamptz DEFAULT now()
);

-- ─── Integrations ─────────────────────────────────────────────────────────────
CREATE TABLE integrations (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id               uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  type                 text NOT NULL CHECK (type IN ('google_sheets', 'google_docs', 'google_calendar', 'gmail', 'webhook')),
  config               jsonb DEFAULT '{}'::jsonb,
  google_refresh_token text,
  is_active            boolean DEFAULT true,
  connected_at         timestamptz DEFAULT now(),
  created_at           timestamptz DEFAULT now(),
  UNIQUE (org_id, type)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations   ENABLE ROW LEVEL SECURITY;

-- organizations: own row only
CREATE POLICY "organizations_owner" ON organizations
  FOR ALL USING (user_id = auth.uid());

-- agents: via org ownership
CREATE POLICY "agents_owner" ON agents
  FOR ALL USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

-- phone_numbers: via org ownership
CREATE POLICY "phone_numbers_owner" ON phone_numbers
  FOR ALL USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

-- calls: via org ownership
CREATE POLICY "calls_owner" ON calls
  FOR ALL USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

-- integrations: via org ownership
CREATE POLICY "integrations_owner" ON integrations
  FOR ALL USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_calls_org_created      ON calls (org_id, created_at DESC);
CREATE INDEX idx_calls_twilio_sid       ON calls (twilio_call_sid);
CREATE INDEX idx_calls_elevenlabs_id    ON calls (elevenlabs_conversation_id);
CREATE INDEX idx_agents_org             ON agents (org_id);
CREATE INDEX idx_phone_numbers_org      ON phone_numbers (org_id);

-- ─── Auto-create org on user signup ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organizations (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- 024 · E-commerce vertical: business type, store connections, mirrors, jobs,
--       automations and audit (lib/commerce, docs/commerce-integrations.md)
--
-- Additive and idempotent: no DROP of any kind, safe to re-run.
--   • organizations.business_type ('services' | 'ecommerce', NULL = the owner
--     has not chosen yet), business_type_selected_at and commerce_profile. Every organization
--     that exists when this migration first runs is backfilled to 'services'
--     (the marker in maintenance_state keeps a re-run from backfilling later
--     sign-ups). Platform-written: a tenant JWT cannot change them
--     (guard_commerce_columns), the onboarding API does.
--   • commerce_connections: one row per connected store. Credentials are an
--     AES-256-GCM envelope (lib/commerce/crypto.ts), never readable by tenants
--     (column-level SELECT grant). The webhook URL carries webhook_public_id,
--     a random token, never an org or connection id.
--   • commerce_sync_jobs / commerce_webhook_events: durable queues claimed
--     with FOR UPDATE SKIP LOCKED by service-only functions; service-only
--     tables (RLS on, no policy, no tenant privileges).
--   • commerce_products / commerce_customers / commerce_orders /
--     commerce_order_items / commerce_carts: normalized mirrors, unique per
--     (connection_id, external_id), tenant SELECT only.
--   • commerce_automations / commerce_automation_runs: tenant-owned
--     configuration and the queue of calls; every write goes through the
--     routes (service role). One run per automation and event
--     (idempotency_key), one active run per automation and order/cart.
--   • commerce_audit_log: who did what (connect, sync, enable, queue,
--     suppress, call start/result).
--   • calls.commerce_run_id: the automation run a call was placed for
--     (platform-written, guard_commerce_columns).
-- Deploy order: apply this file BEFORE deploying the commerce code.
-- ══════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── Organizations: business type ────────────────────────────────────────────
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS business_type_selected_at timestamptz;
-- Store profile entered in the store onboarding (country, currency, language,
-- tone, transfer number, return policy URL): validated by the API, never a secret.
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS commerce_profile jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_business_type_check
    CHECK (business_type IS NULL OR business_type IN ('services', 'ecommerce'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing organizations keep the service flow (selected_at stays NULL: a
-- legacy default, not a choice). Runs once: later sign-ups must choose.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.maintenance_state WHERE key = 'commerce_business_type_backfill') THEN
    UPDATE public.organizations SET business_type = 'services' WHERE business_type IS NULL;
    INSERT INTO public.maintenance_state (key, last_run_at, updated_at) VALUES ('commerce_business_type_backfill', now(), now());
  END IF;
END $$;

-- ─── Store connections ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commerce_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform                text NOT NULL,
  store_url               text NOT NULL,
  store_domain            text NOT NULL,
  display_name            text,
  status                  text NOT NULL DEFAULT 'draft',
  capabilities            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- {v, k, iv, ct, tag} (lib/commerce/crypto.ts); NULL once disconnected.
  encrypted_credentials   jsonb,
  credential_key_version  integer,
  -- Registered webhooks: topics, provider ids, our path. Never a secret.
  webhook_config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Random token in the webhook URL (resolves the connection, never user-controlled).
  webhook_public_id       text NOT NULL,
  -- Durable incremental cursors per resource (lib/commerce/sync.ts).
  sync_cursor             jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at            timestamptz,
  last_successful_sync_at timestamptz,
  error_code              text,
  error_message           text,
  connected_at            timestamptz,
  disconnected_at         timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_connections_platform_check CHECK (platform IN ('woocommerce', 'shopify', 'magento', 'prestashop', 'custom')),
  CONSTRAINT commerce_connections_status_check CHECK (status IN ('draft', 'connecting', 'active', 'degraded', 'disconnected', 'error')),
  CONSTRAINT commerce_connections_webhook_public_id_key UNIQUE (webhook_public_id),
  CONSTRAINT commerce_connections_org_store_key UNIQUE (org_id, platform, store_domain)
);
CREATE INDEX IF NOT EXISTS commerce_connections_org ON public.commerce_connections (org_id, created_at);
CREATE OR REPLACE TRIGGER commerce_connections_updated_at BEFORE UPDATE ON public.commerce_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Sync jobs (service-only queue) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commerce_sync_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  resource      text NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  run_after     timestamptz NOT NULL DEFAULT now(),
  lease_owner   text,
  lease_until   timestamptz,
  cursor        jsonb NOT NULL DEFAULT '{}'::jsonb,
  counts        jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code    text,
  error_message text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_sync_jobs_kind_check CHECK (kind IN ('initial', 'incremental', 'manual', 'recovery')),
  CONSTRAINT commerce_sync_jobs_resource_check CHECK (resource IN ('products', 'customers', 'orders', 'carts', 'all')),
  CONSTRAINT commerce_sync_jobs_status_check CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS commerce_sync_jobs_due ON public.commerce_sync_jobs (run_after) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS commerce_sync_jobs_connection ON public.commerce_sync_jobs (connection_id, created_at DESC);
-- One queued or running sync per connection and resource.
CREATE UNIQUE INDEX IF NOT EXISTS commerce_sync_jobs_one_active ON public.commerce_sync_jobs (connection_id, resource) WHERE status IN ('pending', 'running');
CREATE OR REPLACE TRIGGER commerce_sync_jobs_updated_at BEFORE UPDATE ON public.commerce_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Webhook deliveries (idempotency + service-only queue) ────────────────────
CREATE TABLE IF NOT EXISTS public.commerce_webhook_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id        uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  platform             text NOT NULL,
  -- Provider delivery/event id, or the SHA-256 of the raw body when the provider sends none.
  dedupe_key           text NOT NULL,
  topic                text NOT NULL,
  verified             boolean NOT NULL DEFAULT false,
  status               text NOT NULL DEFAULT 'received',
  attempts             integer NOT NULL DEFAULT 0,
  max_attempts         integer NOT NULL DEFAULT 5,
  run_after            timestamptz NOT NULL DEFAULT now(),
  lease_owner          text,
  lease_until          timestamptz,
  -- The verified body, kept only until the event is processed (then NULL) or
  -- the retention window ends (lib/commerce/retention.ts). Service-only.
  payload              jsonb,
  external_resource_id text,
  error_code           text,
  error_message        text,
  received_at          timestamptz NOT NULL DEFAULT now(),
  processed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_webhook_events_status_check CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  CONSTRAINT commerce_webhook_events_dedupe_key UNIQUE (connection_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS commerce_webhook_events_due ON public.commerce_webhook_events (run_after) WHERE status IN ('received', 'processing');
CREATE INDEX IF NOT EXISTS commerce_webhook_events_connection ON public.commerce_webhook_events (connection_id, received_at DESC);
CREATE INDEX IF NOT EXISTS commerce_webhook_events_retention ON public.commerce_webhook_events (received_at) WHERE payload IS NOT NULL;

-- ─── Normalized mirrors ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commerce_products (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id        uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  external_id          text NOT NULL,
  sku                  text,
  name                 text NOT NULL,
  status               text NOT NULL DEFAULT 'unknown',
  price                numeric(14, 2),
  currency             text,
  stock_status         text NOT NULL DEFAULT 'unknown',
  stock_quantity       integer,
  url                  text,
  provider_updated_at  timestamptz,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_products_status_check CHECK (status IN ('active', 'draft', 'archived', 'unknown')),
  CONSTRAINT commerce_products_stock_check CHECK (stock_status IN ('in_stock', 'out_of_stock', 'on_backorder', 'unknown')),
  CONSTRAINT commerce_products_external_key UNIQUE (connection_id, external_id)
);
CREATE INDEX IF NOT EXISTS commerce_products_org_updated ON public.commerce_products (org_id, connection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_products_name ON public.commerce_products (connection_id, lower(name));
CREATE INDEX IF NOT EXISTS commerce_products_sku ON public.commerce_products (connection_id, sku) WHERE sku IS NOT NULL;
CREATE OR REPLACE TRIGGER commerce_products_updated_at BEFORE UPDATE ON public.commerce_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.commerce_customers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id        uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  external_id          text NOT NULL,
  email                text,
  first_name           text,
  last_name            text,
  phone_raw            text,
  phone_e164           text,
  country_code         text,
  marketing_consent    boolean,
  call_consent         boolean,
  do_not_call          boolean NOT NULL DEFAULT false,
  do_not_call_reason   text,
  do_not_call_source   text,
  do_not_call_at       timestamptz,
  orders_count         integer,
  total_spent          numeric(14, 2),
  provider_created_at  timestamptz,
  provider_updated_at  timestamptz,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_customers_dnc_source_check CHECK (do_not_call_source IS NULL OR do_not_call_source IN ('customer_opt_out', 'operator', 'provider')),
  CONSTRAINT commerce_customers_external_key UNIQUE (connection_id, external_id)
);
CREATE INDEX IF NOT EXISTS commerce_customers_org_updated ON public.commerce_customers (org_id, connection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_customers_phone ON public.commerce_customers (connection_id, phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS commerce_customers_email ON public.commerce_customers (connection_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS commerce_customers_dnc ON public.commerce_customers (org_id, do_not_call_at DESC) WHERE do_not_call;
CREATE OR REPLACE TRIGGER commerce_customers_updated_at BEFORE UPDATE ON public.commerce_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.commerce_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id        uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  external_id          text NOT NULL,
  order_number         text NOT NULL,
  customer_id          uuid REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  customer_external_id text,
  -- Contact snapshot of this order (audit of what was called), not the customer record.
  contact_name         text,
  contact_phone_e164   text,
  contact_email        text,
  shipping_city        text,
  shipping_country     text,
  shipping_summary     text,
  status               text NOT NULL DEFAULT 'unknown',
  financial_status     text NOT NULL DEFAULT 'unknown',
  fulfillment_status   text NOT NULL DEFAULT 'unknown',
  payment_method       text,
  payment_method_title text,
  is_cod               boolean NOT NULL DEFAULT false,
  currency             text,
  total                numeric(14, 2),
  items_count          integer NOT NULL DEFAULT 0,
  items_summary        text,
  provider_created_at  timestamptz,
  provider_updated_at  timestamptz,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  payload_hash         text,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_orders_status_check CHECK (status IN ('pending', 'processing', 'on_hold', 'completed', 'cancelled', 'refunded', 'failed', 'draft', 'unknown')),
  CONSTRAINT commerce_orders_financial_check CHECK (financial_status IN ('pending', 'authorized', 'paid', 'partially_paid', 'partially_refunded', 'refunded', 'voided', 'unknown')),
  CONSTRAINT commerce_orders_fulfillment_check CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled', 'cancelled', 'unknown')),
  CONSTRAINT commerce_orders_external_key UNIQUE (connection_id, external_id)
);
CREATE INDEX IF NOT EXISTS commerce_orders_org_updated ON public.commerce_orders (org_id, connection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_orders_eligibility ON public.commerce_orders (connection_id, status, provider_created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_orders_recent ON public.commerce_orders (connection_id, provider_created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_orders_number ON public.commerce_orders (connection_id, order_number);
CREATE INDEX IF NOT EXISTS commerce_orders_customer ON public.commerce_orders (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commerce_orders_phone ON public.commerce_orders (connection_id, contact_phone_e164) WHERE contact_phone_e164 IS NOT NULL;
CREATE OR REPLACE TRIGGER commerce_orders_updated_at BEFORE UPDATE ON public.commerce_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.commerce_order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id       uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  order_id            uuid NOT NULL REFERENCES public.commerce_orders(id) ON DELETE CASCADE,
  external_id         text NOT NULL,
  product_external_id text,
  sku                 text,
  name                text NOT NULL,
  quantity            numeric(12, 3) NOT NULL DEFAULT 1,
  unit_price          numeric(14, 2),
  total               numeric(14, 2),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_order_items_external_key UNIQUE (order_id, external_id)
);
CREATE INDEX IF NOT EXISTS commerce_order_items_order ON public.commerce_order_items (order_id);

-- Abandoned carts / checkouts: only from a provider event that carries the
-- contact (capability-gated per platform, docs/commerce-integrations.md).
CREATE TABLE IF NOT EXISTS public.commerce_carts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id          uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  external_id            text NOT NULL,
  customer_id            uuid REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  customer_external_id   text,
  contact_name           text,
  contact_phone_e164     text,
  contact_email          text,
  status                 text NOT NULL DEFAULT 'open',
  currency               text,
  total                  numeric(14, 2),
  items_count            integer NOT NULL DEFAULT 0,
  items_summary          text,
  abandoned_at           timestamptz,
  recovered_order_external_id text,
  provider_updated_at    timestamptz,
  synced_at              timestamptz NOT NULL DEFAULT now(),
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_carts_status_check CHECK (status IN ('open', 'abandoned', 'recovered', 'expired')),
  CONSTRAINT commerce_carts_external_key UNIQUE (connection_id, external_id)
);
CREATE INDEX IF NOT EXISTS commerce_carts_org_updated ON public.commerce_carts (org_id, connection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_carts_phone ON public.commerce_carts (connection_id, contact_phone_e164) WHERE contact_phone_e164 IS NOT NULL;
CREATE OR REPLACE TRIGGER commerce_carts_updated_at BEFORE UPDATE ON public.commerce_carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Automations ─────────────────────────────────────────────────────────────
-- type is extended by a later migration (CHECK), never by free text.
CREATE TABLE IF NOT EXISTS public.commerce_automations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id         uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  agent_id              uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  type                  text NOT NULL,
  enabled               boolean NOT NULL DEFAULT false,
  -- When it was last switched on: only orders/carts created after this
  -- instant are ever called (an import never dials historical orders).
  enabled_at            timestamptz,
  -- Delay, call window, caps, retries, COD methods... (lib/commerce/automations/config.ts).
  config                jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Script template and tone; typed {{variables}} resolved server-side only.
  script                jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_confirmed_at  timestamptz,
  consent_confirmed_by  uuid,
  consent_version       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_automations_type_check CHECK (type IN ('cod_confirmation', 'abandoned_cart', 'order_follow_up')),
  CONSTRAINT commerce_automations_connection_type_key UNIQUE (connection_id, type)
);
-- Added after the first draft of this file: harmless on a fresh table.
ALTER TABLE public.commerce_automations ADD COLUMN IF NOT EXISTS enabled_at timestamptz;
CREATE INDEX IF NOT EXISTS commerce_automations_org ON public.commerce_automations (org_id);
CREATE OR REPLACE TRIGGER commerce_automations_updated_at BEFORE UPDATE ON public.commerce_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.commerce_automation_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id      uuid NOT NULL REFERENCES public.commerce_automations(id) ON DELETE CASCADE,
  connection_id      uuid NOT NULL REFERENCES public.commerce_connections(id) ON DELETE CASCADE,
  automation_type    text NOT NULL,
  order_id           uuid REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  customer_id        uuid REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  cart_id            uuid REFERENCES public.commerce_carts(id) ON DELETE SET NULL,
  -- The provider's order/cart id this run is about (shown redacted in the UI).
  external_ref       text NOT NULL,
  -- 'order:<id>' / 'cart:<id>' / 'order:<id>:<status>' (one run per automation and event).
  event_key          text NOT NULL,
  idempotency_key    text NOT NULL,
  status             text NOT NULL DEFAULT 'eligible',
  eligibility_reason text,
  -- The number dialed, kept for the audit and cleared by retention.
  to_phone_e164      text,
  scheduled_for      timestamptz,
  attempt            integer NOT NULL DEFAULT 0,
  max_attempts       integer NOT NULL DEFAULT 2,
  lease_owner        text,
  lease_until        timestamptz,
  call_id            uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  provider_call_ref  text,
  dispatch_uncertain boolean NOT NULL DEFAULT false,
  outcome            text,
  outcome_detail     text,
  summary            text,
  error_code         text,
  error_message      text,
  last_attempt_at    timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_automation_runs_status_check CHECK (status IN ('eligible', 'scheduled', 'calling', 'completed', 'suppressed', 'skipped', 'failed', 'retry_waiting', 'cancelled')),
  CONSTRAINT commerce_automation_runs_outcome_check CHECK (outcome IS NULL OR outcome IN ('confirmed', 'not_confirmed', 'callback_requested', 'voicemail', 'no_answer', 'opted_out', 'failed')),
  CONSTRAINT commerce_automation_runs_idempotency_key UNIQUE (idempotency_key)
);
-- One active run per automation and order/cart, whatever the event.
CREATE UNIQUE INDEX IF NOT EXISTS commerce_automation_runs_one_active ON public.commerce_automation_runs (automation_id, external_ref)
  WHERE status IN ('eligible', 'scheduled', 'calling', 'retry_waiting');
CREATE INDEX IF NOT EXISTS commerce_automation_runs_due ON public.commerce_automation_runs (scheduled_for) WHERE status IN ('scheduled', 'retry_waiting');
CREATE INDEX IF NOT EXISTS commerce_automation_runs_calling ON public.commerce_automation_runs (lease_until) WHERE status = 'calling';
CREATE INDEX IF NOT EXISTS commerce_automation_runs_org_created ON public.commerce_automation_runs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_automation_runs_automation_created ON public.commerce_automation_runs (automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_automation_runs_call ON public.commerce_automation_runs (call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commerce_automation_runs_customer_day ON public.commerce_automation_runs (customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commerce_automation_runs_cart ON public.commerce_automation_runs (cart_id) WHERE cart_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commerce_automation_runs_retention ON public.commerce_automation_runs (completed_at) WHERE to_phone_e164 IS NOT NULL;
CREATE OR REPLACE TRIGGER commerce_automation_runs_updated_at BEFORE UPDATE ON public.commerce_automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Audit log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commerce_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor         text NOT NULL,
  actor_user_id uuid,
  action        text NOT NULL,
  connection_id uuid REFERENCES public.commerce_connections(id) ON DELETE SET NULL,
  automation_id uuid REFERENCES public.commerce_automations(id) ON DELETE SET NULL,
  run_id        uuid REFERENCES public.commerce_automation_runs(id) ON DELETE SET NULL,
  call_id       uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_audit_log_actor_check CHECK (actor IN ('user', 'system', 'webhook', 'cron'))
);
CREATE INDEX IF NOT EXISTS commerce_audit_log_org_created ON public.commerce_audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_audit_log_run ON public.commerce_audit_log (run_id) WHERE run_id IS NOT NULL;

-- ─── Calls: the automation run a call was placed for ─────────────────────────
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS commerce_run_id uuid;
DO $$ BEGIN
  ALTER TABLE public.calls ADD CONSTRAINT calls_commerce_run_fk
    FOREIGN KEY (commerce_run_id) REFERENCES public.commerce_automation_runs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS calls_commerce_run ON public.calls (commerce_run_id) WHERE commerce_run_id IS NOT NULL;

-- ─── Column guard (tenant JWTs cannot write the platform-managed columns) ─
CREATE OR REPLACE FUNCTION public.guard_commerce_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'organizations' THEN
    IF TG_OP = 'INSERT' AND (NEW.business_type IS NOT NULL OR NEW.business_type_selected_at IS NOT NULL OR NEW.commerce_profile IS DISTINCT FROM '{}'::jsonb) THEN
      RAISE EXCEPTION 'the business type is chosen through the onboarding API' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (
         NEW.business_type IS DISTINCT FROM OLD.business_type
      OR NEW.business_type_selected_at IS DISTINCT FROM OLD.business_type_selected_at
      OR NEW.commerce_profile IS DISTINCT FROM OLD.commerce_profile
    ) THEN
      RAISE EXCEPTION 'the business type is chosen through the onboarding API' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'calls' THEN
    IF TG_OP = 'INSERT' AND NEW.commerce_run_id IS NOT NULL THEN
      RAISE EXCEPTION 'commerce call links are set by the platform' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.commerce_run_id IS DISTINCT FROM OLD.commerce_run_id THEN
      RAISE EXCEPTION 'commerce call links are set by the platform' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_commerce_columns() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER organizations_guard_commerce BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_commerce_columns();
CREATE OR REPLACE TRIGGER calls_guard_commerce BEFORE INSERT OR UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.guard_commerce_columns();

-- ─── Row level security ──────────────────────────────────────────────────────
ALTER TABLE public.commerce_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenants read their own rows; every write goes through the routes (service role).
DO $$ BEGIN
  CREATE POLICY "commerce_connections_owner_select" ON public.commerce_connections FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "commerce_products_owner_select" ON public.commerce_products FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "commerce_customers_owner_select" ON public.commerce_customers FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "commerce_orders_owner_select" ON public.commerce_orders FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "commerce_order_items_owner_select" ON public.commerce_order_items FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "commerce_carts_owner_select" ON public.commerce_carts FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "commerce_automations_owner_select" ON public.commerce_automations FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "commerce_automation_runs_owner_select" ON public.commerce_automation_runs FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "commerce_audit_log_owner_select" ON public.commerce_audit_log FOR SELECT TO authenticated
    USING (org_id IN (SELECT id FROM public.organizations WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.commerce_connections, public.commerce_products, public.commerce_customers, public.commerce_orders,
  public.commerce_order_items, public.commerce_carts, public.commerce_automations, public.commerce_automation_runs,
  public.commerce_audit_log
  FROM anon, authenticated;
REVOKE SELECT ON
  public.commerce_connections, public.commerce_products, public.commerce_customers, public.commerce_orders,
  public.commerce_order_items, public.commerce_carts, public.commerce_automations, public.commerce_automation_runs,
  public.commerce_audit_log
  FROM anon;
-- The credential envelope, cursors and webhook details never leave the server:
-- tenants may read the summary columns only (the API serves DTOs anyway).
REVOKE SELECT ON public.commerce_connections FROM authenticated;
GRANT SELECT (id, org_id, platform, store_url, store_domain, display_name, status, capabilities, last_sync_at, last_successful_sync_at, error_code, error_message, connected_at, disconnected_at, created_at, updated_at)
  ON public.commerce_connections TO authenticated;
-- Service-only queues: no policy, no tenant privileges.
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.commerce_sync_jobs, public.commerce_webhook_events FROM anon, authenticated;

-- ─── Queue claims (service role only; plain functions, RLS is not bypassed) ──
-- Each picks due work with FOR UPDATE SKIP LOCKED, takes a lease and counts
-- the attempt. Work whose lease expired (a crashed instance) is claimable
-- again; the worker fails it once attempts exceed max_attempts.
CREATE OR REPLACE FUNCTION public.commerce_claim_sync_jobs(p_owner text, p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.commerce_sync_jobs
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_owner IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_lease_seconds IS NULL OR p_lease_seconds < 5 THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.commerce_sync_jobs
    WHERE (status = 'pending' AND run_after <= now())
       OR (status = 'running' AND lease_until IS NOT NULL AND lease_until < now())
    ORDER BY run_after
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.commerce_sync_jobs j
  SET status = 'running',
      lease_owner = p_owner,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      attempts = j.attempts + 1,
      started_at = COALESCE(j.started_at, now()),
      updated_at = now()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;
REVOKE ALL ON FUNCTION public.commerce_claim_sync_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_claim_sync_jobs(text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.commerce_claim_webhook_events(p_owner text, p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.commerce_webhook_events
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_owner IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_lease_seconds IS NULL OR p_lease_seconds < 5 THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.commerce_webhook_events
    WHERE verified
      AND ((status = 'received' AND run_after <= now())
        OR (status = 'processing' AND lease_until IS NOT NULL AND lease_until < now()))
    ORDER BY run_after
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.commerce_webhook_events e
  SET status = 'processing',
      lease_owner = p_owner,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      attempts = e.attempts + 1
  FROM picked
  WHERE e.id = picked.id
  RETURNING e.*;
END;
$$;
REVOKE ALL ON FUNCTION public.commerce_claim_webhook_events(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_claim_webhook_events(text, integer, integer) TO service_role;

-- scheduled / retry_waiting → calling is the atomic transition before a call is
-- placed; the worker re-checks eligibility under the lease. A 'calling' run
-- whose lease expired without a call id is settled by the worker as failed
-- (dispatch uncertain): it is never dialed again automatically.
CREATE OR REPLACE FUNCTION public.commerce_claim_automation_runs(p_owner text, p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.commerce_automation_runs
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_owner IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_lease_seconds IS NULL OR p_lease_seconds < 5 THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.commerce_automation_runs
    WHERE status IN ('scheduled', 'retry_waiting')
      AND scheduled_for IS NOT NULL
      AND scheduled_for <= now()
    ORDER BY scheduled_for
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.commerce_automation_runs r
  SET status = 'calling',
      lease_owner = p_owner,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      attempt = r.attempt + 1,
      last_attempt_at = now(),
      updated_at = now()
  FROM picked
  WHERE r.id = picked.id
  RETURNING r.*;
END;
$$;
REVOKE ALL ON FUNCTION public.commerce_claim_automation_runs(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commerce_claim_automation_runs(text, integer, integer) TO service_role;

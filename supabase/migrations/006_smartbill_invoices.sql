-- ─── SmartBill Invoices ───────────────────────────────────────────────────────
-- Tracks fiscal invoices emitted through SmartBill when a Stripe payment succeeds.
-- `stripe_invoice_id` is the idempotency key so a retried webhook never emits twice.

CREATE TABLE invoices (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  stripe_invoice_id text UNIQUE,
  smartbill_series  text,
  smartbill_number  text,
  amount            numeric(10, 2),
  currency          text,
  status            text DEFAULT 'issued' CHECK (status IN ('issued', 'failed', 'reversed')),
  error             text,
  pdf_url           text,
  client_name       text,
  client_vat_code   text,
  issued_at         timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Owners may read their org's invoices. Writes happen only from the Stripe
-- webhook via the service-role client, which bypasses RLS.
CREATE POLICY "invoices_owner_read" ON invoices
  FOR SELECT USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

CREATE INDEX idx_invoices_org_created   ON invoices (org_id, created_at DESC);
CREATE INDEX idx_invoices_stripe_id     ON invoices (stripe_invoice_id);

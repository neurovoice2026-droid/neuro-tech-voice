-- ─── Workflows ───────────────────────────────────────────────────────────────
CREATE TABLE workflows (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name             text NOT NULL,
  description      text,
  trigger          text NOT NULL CHECK (trigger IN (
    'call_ended', 'call_missed', 'call_started',
    'voicemail_left', 'sentiment_negative', 'keyword_detected'
  )),
  trigger_config   jsonb DEFAULT '{}'::jsonb,
  actions          jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled          boolean DEFAULT true,
  runs             integer DEFAULT 0,
  successful_runs  integer DEFAULT 0,
  last_run_at      timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ─── Workflow Runs (execution log) ───────────────────────────────────────────
CREATE TABLE workflow_runs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id   uuid REFERENCES workflows(id) ON DELETE CASCADE NOT NULL,
  call_id       uuid REFERENCES calls(id) ON DELETE SET NULL,
  status        text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  results       jsonb DEFAULT '[]'::jsonb,
  error         text,
  started_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_owner" ON workflows
  FOR ALL USING (
    org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

CREATE POLICY "workflow_runs_owner" ON workflow_runs
  FOR ALL USING (
    workflow_id IN (
      SELECT id FROM workflows
      WHERE org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
    )
  );

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_workflows_org ON workflows (org_id);
CREATE INDEX idx_workflows_trigger ON workflows (org_id, trigger) WHERE enabled = true;
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs (workflow_id, started_at DESC);

-- ─── updated_at trigger ─────────────────────────────────────────────────────
CREATE TRIGGER workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

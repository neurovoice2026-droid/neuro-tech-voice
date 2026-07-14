'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  GitBranch, Plus, Play, Trash2, ChevronRight,
  Phone, Mail, Calendar, FileText, Zap, Bell, Clock,
  ArrowRight, MoreVertical, Copy, Search,
  PhoneIncoming, Star,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkInProgressBadge } from '@/components/shared/WorkInProgressBadge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

// Only triggers the executor (lib/workflows/executor.ts) actually fires from
// the ElevenLabs webhook. call_started and voicemail_left were previously
// offered here too, but nothing in the system ever fires them: ElevenLabs
// only sends post-call webhooks (no realtime "call started" event exists to
// wire up), and there's no distinguishable "voicemail was left" signal in the
// data it sends. Offering them was a trap - a workflow built on either would
// silently never run.
type TriggerType =
  | 'call_ended'
  | 'call_missed'
  | 'sentiment_negative'
  | 'keyword_detected'

type ActionType =
  | 'send_email'
  | 'add_to_sheet'
  | 'create_calendar_event'
  | 'send_webhook'
  | 'create_doc'
  | 'notify_slack'
  | 'add_tag'
  | 'wait'

interface WorkflowAction {
  id: string
  type: ActionType
  config: Record<string, string>
}

interface Workflow {
  id: string
  name: string
  description: string | null
  trigger: TriggerType
  trigger_config: Record<string, string>
  actions: WorkflowAction[]
  enabled: boolean
  runs: number
  successful_runs: number
  last_run_at: string | null
  created_at: string
}

// ─── Static data ──────────────────────────────────────────────────────────────

const TRIGGER_META: Record<TriggerType, { label: string; icon: React.FC<{ className?: string }>; color: string; description: string }> = {
  call_ended:         { label: 'Call Ended',          icon: Phone,          color: 'text-blue-600 bg-blue-50',    description: 'Triggers when any call finishes' },
  call_missed:        { label: 'Missed Call',         icon: PhoneIncoming,  color: 'text-red-600 bg-red-50',      description: 'Triggers when a call goes unanswered' },
  sentiment_negative: { label: 'Negative Sentiment',  icon: AlertCircle,    color: 'text-red-600 bg-red-50',      description: 'Triggers when AI detects a frustrated caller' },
  keyword_detected:   { label: 'Keyword Detected',    icon: Star,           color: 'text-purple-600 bg-purple-50',description: 'Triggers when a specific word is spoken' },
}

const ACTION_META: Record<ActionType, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  send_email:           { label: 'Send Email',           icon: Mail,     color: 'text-red-500' },
  add_to_sheet:         { label: 'Log to Sheets',        icon: FileText, color: 'text-green-600' },
  create_calendar_event:{ label: 'Create Calendar Event',icon: Calendar, color: 'text-blue-600' },
  send_webhook:         { label: 'Send Webhook',         icon: Zap,      color: 'text-yellow-600' },
  create_doc:           { label: 'Create Doc',           icon: FileText, color: 'text-blue-500' },
  notify_slack:         { label: 'Notify Slack',         icon: Bell,     color: 'text-purple-600' },
  add_tag:              { label: 'Add Tag',              icon: Star,     color: 'text-orange-500' },
  wait:                 { label: 'Wait',                 icon: Clock,    color: 'text-gray-500' },
}

// ─── Wizard step definitions ──────────────────────────────────────────────────

const WIZARD_STEPS = [
  { num: 1, label: 'Choose Trigger' },
  { num: 2, label: 'Add Actions' },
  { num: 3, label: 'Name & Save' },
]

const AVAILABLE_ACTIONS: ActionType[] = [
  'send_email', 'add_to_sheet', 'create_calendar_event',
  'send_webhook', 'create_doc', 'notify_slack', 'add_tag', 'wait',
]

// Actions that call a Google API need that integration connected first, or
// they'd fail on every run (lib/workflows/executor.ts returns "not connected"
// errors for these today, but the builder still let you pick them anyway).
// send_webhook/notify_slack/add_tag/wait need no OAuth connection at all.
const ACTION_REQUIRES_INTEGRATION: Partial<Record<ActionType, string>> = {
  send_email: 'gmail',
  add_to_sheet: 'google_sheets',
  create_calendar_event: 'google_calendar',
  create_doc: 'google_docs',
}

const INTEGRATION_LABEL: Record<string, string> = {
  gmail: 'Gmail',
  google_sheets: 'Google Sheets',
  google_calendar: 'Google Calendar',
  google_docs: 'Google Docs',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TriggerIcon({ type, size = 'sm' }: { type: TriggerType; size?: 'sm' | 'md' }) {
  const meta = TRIGGER_META[type]
  const Icon = meta.icon
  const sz = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  return (
    <div className={cn('flex flex-shrink-0 items-center justify-center rounded-lg', sz, meta.color)}>
      <Icon className={cn('h-3.5 w-3.5', size === 'md' && 'h-4 w-4')} />
    </div>
  )
}

function ActionPill({ type }: { type: ActionType }) {
  const meta = ACTION_META[type]
  const Icon = meta.icon
  return (
    <span className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
      <Icon className={cn('h-3 w-3', meta.color)} />
      {meta.label}
    </span>
  )
}

function SuccessRateBadge({ runs, successful }: { runs: number; successful: number }) {
  const rate = runs > 0 ? Math.round((successful / runs) * 100) : 100
  const color = rate >= 95 ? 'text-green-700 bg-green-50 border-green-200'
    : rate >= 80 ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
    : 'text-red-700 bg-red-50 border-red-200'
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', color)}>
      {rate}% success
    </span>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'Yesterday'
  return `${diffD} days ago`
}

// ─── Workflow Card ─────────────────────────────────────────────────────────────

function WorkflowCard({
  workflow,
  onToggle,
  onDelete,
  onDuplicate,
}: {
  workflow: Workflow
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  const triggerMeta = TRIGGER_META[workflow.trigger]

  return (
    <div
      className={cn(
        'group relative rounded-2xl border-2 bg-card p-5 transition-all duration-200',
        workflow.enabled
          ? 'border-border hover:border-purple-200 hover:shadow-sm'
          : 'border-dashed border-gray-200 bg-gray-50/40 opacity-70'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <TriggerIcon type={workflow.trigger} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground text-sm truncate">{workflow.name}</h3>
            {!workflow.enabled && (
              <Badge variant="secondary" className="text-[10px] shrink-0">Paused</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {workflow.description ?? `Triggered on ${triggerMeta.label.toLowerCase()}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={workflow.enabled}
            onCheckedChange={() => onToggle(workflow.id)}
            className="data-[state=checked]:bg-purple-600"
          />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDuplicate(workflow.id)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(workflow.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Flow preview */}
      <div className="mt-4 flex items-center gap-1.5 flex-wrap">
        <span className="flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
          <TriggerIcon type={workflow.trigger} size="sm" />
          <span className="ml-0.5">{triggerMeta.label}</span>
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <div className="flex flex-wrap gap-1">
          {workflow.actions.map((a) => (
            <ActionPill key={a.id} type={a.type} />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Play className="h-3 w-3" /> {workflow.runs} runs
        </span>
        {workflow.last_run_at && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatRelative(workflow.last_run_at)}
          </span>
        )}
        <SuccessRateBadge runs={workflow.runs} successful={workflow.successful_runs} />
        <span className="ml-auto">{formatDate(workflow.created_at)}</span>
      </div>
    </div>
  )
}

// ─── Create Workflow Dialog ────────────────────────────────────────────────────

function CreateWorkflowDialog({
  open,
  onClose,
  onCreate,
  connectedIntegrations,
}: {
  open: boolean
  onClose: () => void
  onCreate: (data: { name: string; description: string; trigger: TriggerType; trigger_config: Record<string, string>; actions: WorkflowAction[] }) => Promise<void>
  connectedIntegrations: Set<string>
}) {
  const [step, setStep] = useState(1)
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType | null>(null)
  const [selectedActions, setSelectedActions] = useState<ActionType[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keyword, setKeyword] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('')
  const [tagValue, setTagValue] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setStep(1)
    setSelectedTrigger(null)
    setSelectedActions([])
    setName('')
    setDescription('')
    setKeyword('')
    setWebhookUrl('')
    setSlackWebhookUrl('')
    setTagValue('')
    setSaving(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleCreate() {
    if (!selectedTrigger || selectedActions.length === 0 || !name.trim()) return
    setSaving(true)
    try {
      const actions: WorkflowAction[] = selectedActions.map((type, i) => {
        const config: Record<string, string> = {}
        if (type === 'send_webhook' && webhookUrl) config.url = webhookUrl
        if (type === 'notify_slack' && slackWebhookUrl) config.webhook_url = slackWebhookUrl
        if (type === 'add_tag' && tagValue) config.tag = tagValue
        return { id: `a${i}`, type, config }
      })

      const triggerConfig: Record<string, string> = {}
      if (selectedTrigger === 'keyword_detected' && keyword) {
        triggerConfig.keyword = keyword
      }

      await onCreate({ name: name.trim(), description: description.trim(), trigger: selectedTrigger, trigger_config: triggerConfig, actions })
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  function toggleAction(type: ActionType) {
    setSelectedActions((prev) =>
      prev.includes(type) ? prev.filter((a) => a !== type) : [...prev, type]
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-4">
          {WIZARD_STEPS.map((s, idx) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                step > s.num ? 'bg-purple-600 text-white'
                  : step === s.num ? 'bg-purple-600 text-white'
                  : 'bg-muted text-muted-foreground'
              )}>
                {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
              </div>
              <span className={cn(
                'ml-1.5 text-xs hidden sm:block',
                step === s.num ? 'font-semibold text-foreground' : 'text-muted-foreground'
              )}>{s.label}</span>
              {idx < WIZARD_STEPS.length - 1 && (
                <div className={cn('flex-1 mx-2 h-px', step > s.num ? 'bg-purple-600' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Choose Trigger */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">What should start this workflow?</p>
            {(Object.keys(TRIGGER_META) as TriggerType[]).map((type) => {
              const meta = TRIGGER_META[type]
              const Icon = meta.icon
              const selected = selectedTrigger === type
              return (
                <button
                  key={type}
                  onClick={() => setSelectedTrigger(type)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all',
                    selected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-border hover:border-purple-200 hover:bg-muted/40'
                  )}
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  {selected && <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />}
                </button>
              )
            })}

            {selectedTrigger === 'keyword_detected' && (
              <div className="mt-3">
                <label className="text-xs font-medium text-foreground mb-1.5 block">Keyword to detect</label>
                <Input
                  placeholder="e.g. pricing, appointment, refund"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Add Actions */}
        {step === 2 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Select one or more actions to run. ({selectedActions.length} selected)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_ACTIONS.map((type) => {
                const meta = ACTION_META[type]
                const Icon = meta.icon
                const selected = selectedActions.includes(type)
                const requiredIntegration = ACTION_REQUIRES_INTEGRATION[type]
                const locked = !!requiredIntegration && !connectedIntegrations.has(requiredIntegration)
                return (
                  <button
                    key={type}
                    onClick={() => !locked && toggleAction(type)}
                    disabled={locked}
                    title={locked ? `Connect ${INTEGRATION_LABEL[requiredIntegration!]} first` : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all',
                      locked
                        ? 'opacity-50 cursor-not-allowed border-border'
                        : selected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-border hover:border-purple-200 hover:bg-muted/40'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', meta.color)} />
                    <span className="min-w-0 text-xs font-medium text-foreground">
                      {meta.label}
                      {locked && <span className="block text-[10px] font-normal text-muted-foreground">Not connected</span>}
                      {requiredIntegration && <WorkInProgressBadge className="mt-1" />}
                    </span>
                    {selected && !locked && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-purple-600 shrink-0" />}
                  </button>
                )
              })}
            </div>
            {AVAILABLE_ACTIONS.some((t) => {
              const req = ACTION_REQUIRES_INTEGRATION[t]
              return req && !connectedIntegrations.has(req)
            }) && (
              <p className="text-[11px] text-muted-foreground">
                Some actions are locked because their integration isn&apos;t connected yet.{' '}
                <a href="/integrations" className="text-purple-600 hover:underline">Connect integrations</a>
              </p>
            )}

            {/* Config for selected actions */}
            {selectedActions.includes('send_webhook') && (
              <div className="mt-3">
                <label className="text-xs font-medium text-foreground mb-1.5 block">Webhook URL</label>
                <Input
                  placeholder="https://your-app.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
            {selectedActions.includes('notify_slack') && (
              <div className="mt-3">
                <label className="text-xs font-medium text-foreground mb-1.5 block">Slack webhook URL</label>
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
            {selectedActions.includes('add_tag') && (
              <div className="mt-3">
                <label className="text-xs font-medium text-foreground mb-1.5 block">Tag name</label>
                <Input
                  placeholder="e.g. follow-up, escalated, vip"
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}

            {/* Action order preview */}
            {selectedActions.length > 0 && (
              <div className="mt-3 rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Execution order:</p>
                <div className="flex flex-wrap items-center gap-1">
                  {selectedActions.map((type, i) => (
                    <div key={type} className="flex items-center gap-1">
                      <ActionPill type={type} />
                      {i < selectedActions.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Name & Save */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Workflow Name *</label>
              <Input
                placeholder="e.g. Follow-up Email After Call"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Description (optional)</label>
              <Input
                placeholder="What does this workflow do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Summary */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Summary</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16 shrink-0">Trigger</span>
                {selectedTrigger && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <TriggerIcon type={selectedTrigger} size="sm" />
                    {TRIGGER_META[selectedTrigger].label}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-16 shrink-0 mt-0.5">Actions</span>
                <div className="flex flex-wrap gap-1">
                  {selectedActions.map((type) => (
                    <ActionPill key={type} type={type} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between mt-2 pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={step === 1 ? handleClose : () => setStep(step - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            size="sm"
            className="purple-glow"
            disabled={
              saving ||
              (step === 1 && !selectedTrigger) ||
              (step === 1 && selectedTrigger === 'keyword_detected' && !keyword.trim()) ||
              (step === 2 && selectedActions.length === 0) ||
              (step === 3 && !name.trim())
            }
            onClick={step < 3 ? () => setStep(step + 1) : handleCreate}
          >
            {saving ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Saving...</>
            ) : step < 3 ? (
              <>Next <ChevronRight className="ml-1 h-3.5 w-3.5" /></>
            ) : (
              <>Create Workflow <CheckCircle2 className="ml-1 h-3.5 w-3.5" /></>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set())

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows')
      if (res.ok) {
        const data = await res.json()
        setWorkflows(data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('integrations').select('type, is_active').then(({ data }) => {
      const connected = new Set(
        (data ?? []).filter((row) => row.is_active).map((row) => row.type as string)
      )
      setConnectedIntegrations(connected)
    })
  }, [])

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
        (w.description ?? '').toLowerCase().includes(search.toLowerCase())
      const matchFilter =
        filter === 'all' ||
        (filter === 'active' && w.enabled) ||
        (filter === 'paused' && !w.enabled)
      return matchSearch && matchFilter
    })
  }, [workflows, search, filter])

  const stats = useMemo(() => ({
    total: workflows.length,
    active: workflows.filter((w) => w.enabled).length,
    totalRuns: workflows.reduce((s, w) => s + w.runs, 0),
    avgSuccess: workflows.length > 0
      ? Math.round(workflows.reduce((s, w) => s + (w.runs > 0 ? (w.successful_runs / w.runs) * 100 : 100), 0) / workflows.length)
      : 0,
  }), [workflows])

  async function handleToggle(id: string) {
    const wf = workflows.find((w) => w.id === id)
    if (!wf) return
    const newEnabled = !wf.enabled
    setWorkflows((prev) => prev.map((w) => w.id === id ? { ...w, enabled: newEnabled } : w))
    await fetch(`/api/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newEnabled }),
    })
  }

  async function handleDelete(id: string) {
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
  }

  async function handleDuplicate(id: string) {
    const src = workflows.find((w) => w.id === id)
    if (!src) return
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${src.name} (copy)`,
        description: src.description,
        trigger: src.trigger,
        trigger_config: src.trigger_config,
        actions: src.actions,
        enabled: false,
      }),
    })
    if (res.ok) {
      const newWf = await res.json()
      setWorkflows((prev) => [newWf, ...prev])
    }
  }

  async function handleCreate(data: { name: string; description: string; trigger: TriggerType; trigger_config: Record<string, string>; actions: WorkflowAction[] }) {
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const wf = await res.json()
      setWorkflows((prev) => [wf, ...prev])
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automate actions triggered by your AI agent&apos;s calls.
          </p>
        </div>
        <Button className="purple-glow shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New Workflow
        </Button>
      </div>

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Workflows', value: stats.total, icon: GitBranch, color: 'text-purple-600 bg-purple-50' },
          { label: 'Active',          value: stats.active, icon: Play,      color: 'text-green-600 bg-green-50' },
          { label: 'Total Runs',      value: stats.totalRuns, icon: Zap,   color: 'text-blue-600 bg-blue-50' },
          { label: 'Avg Success',     value: `${stats.avgSuccess}%`, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg border bg-card overflow-hidden shrink-0">
          {(['all', 'active', 'paused'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <GitBranch className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-muted-foreground">No workflows found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? 'Try a different search term.' : 'Create your first workflow to automate calls.'}
          </p>
          {!search && (
            <Button className="mt-4 purple-glow" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New Workflow
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((w) => (
            <WorkflowCard
              key={w.id}
              workflow={w}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Workflows run automatically after each call. Actions execute in order, if one fails, subsequent actions are skipped and the run is marked as failed.
          <strong> Send Webhook</strong>, <strong>Add Tag</strong>, and <strong>Wait</strong> always work. <strong>Send Email</strong>, <strong>Log to Sheets</strong>, <strong>Create Calendar Event</strong>, and <strong>Create Doc</strong> require the matching Google integration to be connected. <strong>Notify Slack</strong> needs a Slack incoming webhook URL.
        </p>
      </div>

      <CreateWorkflowDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        connectedIntegrations={connectedIntegrations}
      />
    </div>
  )
}

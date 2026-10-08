'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  GitBranch, Plus, Play, Trash2, ChevronRight,
  Phone, Mail, Calendar, FileText, Zap, Bell, Clock,
  ArrowRight, MoreHorizontal, Copy, Search,
  PhoneIncoming, Star, Check,
  CheckCircle2, AlertCircle, MessageSquareText,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkInProgressBadge } from '@/components/shared/WorkInProgressBadge'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatTile } from '@/components/shared/StatTile'
import { StatusChip } from '@/components/shared/StatusChip'
import { EmptyState } from '@/components/shared/EmptyState'
import { OptionCard } from '@/components/shared/OptionCard'
import { Field } from '@/components/shared/FormSection'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SMS_MESSAGE } from '@/lib/workflows/templates'

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
  | 'send_sms'

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

// Icons are ink everywhere (no per-item colour): the chip shape tells trigger
// (outline) from action (tinted).
const TRIGGER_META: Record<TriggerType, { label: string; icon: LucideIcon; description: string }> = {
  call_ended:         { label: 'Call ended',        icon: Phone,         description: 'Triggers when any call finishes' },
  call_missed:        { label: 'Missed call',       icon: PhoneIncoming, description: 'Triggers when a call goes unanswered' },
  sentiment_negative: { label: 'Call not resolved', icon: AlertCircle,   description: 'Triggers when the AI marks the call as not successful' },
  keyword_detected:   { label: 'Keyword detected',  icon: Star,          description: 'Triggers when a specific word is spoken' },
}

const ACTION_META: Record<ActionType, { label: string; icon: LucideIcon }> = {
  send_email:           { label: 'Send email',            icon: Mail },
  add_to_sheet:         { label: 'Log to Sheets',         icon: FileText },
  create_calendar_event:{ label: 'Create calendar event', icon: Calendar },
  send_webhook:         { label: 'Send webhook',          icon: Zap },
  create_doc:           { label: 'Create doc',            icon: FileText },
  notify_slack:         { label: 'Notify Slack',          icon: Bell },
  add_tag:              { label: 'Add tag',               icon: Star },
  wait:                 { label: 'Wait',                  icon: Clock },
  send_sms:             { label: 'Text the caller',       icon: MessageSquareText },
}

// ─── Wizard step definitions ──────────────────────────────────────────────────

const WIZARD_STEPS = [
  { num: 1, label: 'Choose trigger' },
  { num: 2, label: 'Add actions' },
  { num: 3, label: 'Name & save' },
]

const AVAILABLE_ACTIONS: ActionType[] = [
  'send_email', 'add_to_sheet', 'create_calendar_event',
  'send_webhook', 'create_doc', 'notify_slack', 'add_tag', 'wait', 'send_sms',
]

/** Why "Text the caller" is not offered (GET /api/workflows/sms-capability). */
const SMS_UNAVAILABLE: Record<string, string> = {
  not_configured: 'Text messages are not available yet',
  no_number: 'Get a phone number first',
  not_capable: 'Your number cannot send texts',
  unknown: 'Checking whether your number can send texts…',
}

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

// Display groups for step 2 (the order actions run in is the order they are picked).
const READY_ACTIONS = AVAILABLE_ACTIONS.filter((t) => !ACTION_REQUIRES_INTEGRATION[t])
const GOOGLE_ACTIONS = AVAILABLE_ACTIONS.filter((t) => !!ACTION_REQUIRES_INTEGRATION[t])

const INTEGRATION_LABEL: Record<string, string> = {
  gmail: 'Gmail',
  google_sheets: 'Google Sheets',
  google_calendar: 'Google Calendar',
  google_docs: 'Google Docs',
}

const FILTER_LABEL = { all: 'All', active: 'Active', paused: 'Paused' } as const

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Trigger chip: white outline pill with the trigger's ink icon (the start of the chain). */
function TriggerChip({ type }: { type: TriggerType }) {
  const meta = TRIGGER_META[type]
  const Icon = meta.icon
  return (
    <Badge variant="outline">
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  )
}

/** Action chip: tinted pill (white on a tinted surface) with the action's ink icon. */
function ActionChip({ type, onTinted = false }: { type: ActionType; onTinted?: boolean }) {
  const meta = ACTION_META[type]
  const Icon = meta.icon
  return (
    <Badge variant={onTinted ? 'outline' : 'secondary'}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  )
}

function ChainArrow() {
  return <ArrowRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
}

function SuccessRateBadge({ runs, successful }: { runs: number; successful: number }) {
  const rate = runs > 0 ? Math.round((successful / runs) * 100) : 100
  const tone = rate >= 100 ? 'success' : rate >= 50 ? 'warning' : 'danger'
  return (
    <StatusChip tone={tone} className="tabular-nums">
      {rate}% success
    </StatusChip>
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
    <Card className="h-full gap-0 p-5">
      {/* Header: name, on/off, row menu */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-[15px] leading-[22px] font-medium text-foreground">{workflow.name}</h3>
            {!workflow.enabled && <StatusChip tone="muted">Paused</StatusChip>}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-[19px] text-muted-foreground">
            {workflow.description ?? `Triggered on ${triggerMeta.label.toLowerCase()}.`}
          </p>
        </div>

        <div className="-mr-1.5 flex shrink-0 items-center gap-1">
          <Switch
            checked={workflow.enabled}
            onCheckedChange={() => onToggle(workflow.id)}
            aria-label={`${workflow.name}: run automatically`}
            className="mr-1.5"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${workflow.name}`}
              render={<Button variant="ghost" size="icon-sm" className="tap-44 text-muted-foreground hover:text-foreground aria-expanded:text-foreground" />}
            >
              <MoreHorizontal aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onDuplicate(workflow.id)}>
                  <Copy /> Duplicate
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(workflow.id)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chain: trigger → actions */}
      <div
        className={cn('mt-4 flex flex-wrap items-center gap-1.5', !workflow.enabled && 'opacity-60')}
        aria-label="Trigger and actions"
        role="group"
      >
        <TriggerChip type={workflow.trigger} />
        <ChainArrow />
        {workflow.actions.map((a) => (
          <ActionChip key={a.id} type={a.type} />
        ))}
      </div>

      {/* Run stats */}
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-3 text-xs leading-4 text-muted-foreground">
          <span className="flex items-center gap-1 tabular-nums">
            <Play aria-hidden className="size-3" /> {workflow.runs} runs
          </span>
          {workflow.last_run_at && (
            <span className="flex items-center gap-1">
              <Clock aria-hidden className="size-3" /> {formatRelative(workflow.last_run_at)}
            </span>
          )}
          <SuccessRateBadge runs={workflow.runs} successful={workflow.successful_runs} />
          <span className="ml-auto tabular-nums">{formatDate(workflow.created_at)}</span>
        </div>
      </div>
    </Card>
  )
}

// ─── Create Workflow Dialog ────────────────────────────────────────────────────

function WizardSteps({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 text-[13px] leading-[18px]" aria-label="Steps">
      {WIZARD_STEPS.map((s, idx) => {
        const done = step > s.num
        const current = step === s.num
        return (
          <li
            key={s.num}
            aria-current={current ? 'step' : undefined}
            className={cn('flex items-center gap-2', idx < WIZARD_STEPS.length - 1 && 'flex-1')}
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-medium tabular-nums transition-colors duration-200',
                done || current ? 'bg-foreground text-white' : 'bg-secondary text-muted-foreground'
              )}
            >
              {done ? <Check aria-hidden className="size-3" strokeWidth={3} /> : s.num}
            </span>
            <span
              className={cn(
                'whitespace-nowrap',
                current ? 'font-medium text-foreground' : 'hidden text-muted-foreground sm:inline'
              )}
            >
              {done && <span className="sr-only">Done: </span>}
              {s.label}
            </span>
            {idx < WIZARD_STEPS.length - 1 && <span aria-hidden className="h-px min-w-3 flex-1 bg-rule" />}
          </li>
        )
      })}
    </ol>
  )
}

function CreateWorkflowDialog({
  open,
  onClose,
  onCreate,
  connectedIntegrations,
  smsUnavailable,
}: {
  open: boolean
  onClose: () => void
  onCreate: (data: { name: string; description: string; trigger: TriggerType; trigger_config: Record<string, string>; actions: WorkflowAction[] }) => Promise<void>
  connectedIntegrations: Set<string>
  /** null = the org can text callers; otherwise why not (SMS_UNAVAILABLE key). */
  smsUnavailable: string | null
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
  const [smsMessage, setSmsMessage] = useState(DEFAULT_SMS_MESSAGE)
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
    setSmsMessage(DEFAULT_SMS_MESSAGE)
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
        if (type === 'send_sms') config.message = smsMessage.trim().slice(0, 300) || DEFAULT_SMS_MESSAGE
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

  // Moving between steps re-renders the footer (Next is often disabled on arrival), which
  // would drop keyboard focus to <body>: send it to the new step's prompt / first field.
  const contentRef = useRef<HTMLDivElement>(null)
  const focusStepOnRender = useRef(false)
  function goToStep(next: number) {
    focusStepOnRender.current = true
    setStep(next)
  }
  useEffect(() => {
    if (!focusStepOnRender.current) return
    focusStepOnRender.current = false
    contentRef.current?.querySelector<HTMLElement>('[data-step-focus]')?.focus()
  }, [step])

  function toggleAction(type: ActionType) {
    setSelectedActions((prev) =>
      prev.includes(type) ? prev.filter((a) => a !== type) : [...prev, type]
    )
  }

  function renderActionTile(type: ActionType) {
    const meta = ACTION_META[type]
    const Icon = meta.icon
    const selected = selectedActions.includes(type)
    const requiredIntegration = ACTION_REQUIRES_INTEGRATION[type]
    const isWorkInProgress = !!requiredIntegration
    const notConnected = !!requiredIntegration && !connectedIntegrations.has(requiredIntegration)
    // Only offered when one of the org's numbers can send texts.
    const smsBlocked = type === 'send_sms' && smsUnavailable !== null
    const disabled = isWorkInProgress || notConnected || smsBlocked
    const on = selected && !disabled
    // Still asking GET /api/workflows/sms-capability: the orb stands in for the checkbox.
    const smsChecking = smsBlocked && smsUnavailable === 'unknown'
    return (
      <button
        key={type}
        type="button"
        onClick={() => !disabled && toggleAction(type)}
        disabled={disabled}
        aria-pressed={on}
        title={isWorkInProgress ? 'Coming soon' : notConnected ? `Connect ${INTEGRATION_LABEL[requiredIntegration!]} first` : smsBlocked ? SMS_UNAVAILABLE[smsUnavailable!] ?? SMS_UNAVAILABLE.not_capable : undefined}
        // Same shape and states as OptionCard (tinted → white + 2 px ink ring); the checkbox
        // square is the multi-select cue, so no corner dot here.
        className={cn(
          'flex min-h-11 items-start gap-3 rounded-2xl px-3.5 py-3 text-left transition-[background-color,box-shadow] duration-200 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
          disabled
            ? 'cursor-not-allowed bg-band'
            : on
              ? 'bg-white shadow-[0_0_0_2px_var(--foreground)]'
              : 'bg-secondary hover:bg-secondary-hover'
        )}
      >
        {smsChecking ? (
          <OrbInline state="breathing" className="-mx-0.5" />
        ) : (
          /* Checkbox square: ink when picked */
          <span
            aria-hidden
            className={cn(
              'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors duration-200',
              on ? 'border-foreground bg-foreground text-white' : disabled ? 'border-input bg-white' : 'border-[#8c86a0] bg-white'
            )}
          >
            {on && <Check className="size-3" strokeWidth={3} />}
          </span>
        )}
        {/* Unavailable tiles grey the label (no opacity) and keep the reason line readable. */}
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'flex items-center gap-1.5 text-[13px] leading-5 font-medium',
              disabled ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            <Icon aria-hidden className="size-3.5 shrink-0" />
            {meta.label}
          </span>
          {notConnected && <span className="block pl-5 text-xs leading-4 text-muted-foreground">Not connected</span>}
          {smsBlocked && <span className="block pl-5 text-xs leading-4 text-muted-foreground">{SMS_UNAVAILABLE[smsUnavailable!] ?? SMS_UNAVAILABLE.not_capable}</span>}
          {isWorkInProgress && !notConnected && <span className="block pl-5 text-xs leading-4 text-muted-foreground">Coming soon</span>}
        </span>
      </button>
    )
  }

  const hasActionSettings =
    selectedActions.includes('send_webhook') ||
    selectedActions.includes('notify_slack') ||
    selectedActions.includes('send_sms') ||
    selectedActions.includes('add_tag')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      {/* scroll-pb keeps a focused field clear of the pinned footer */}
      <DialogContent ref={contentRef} className="scroll-pb-24 sm:max-w-[560px]">
        <DialogHeader className="gap-4">
          <DialogTitle>Create workflow</DialogTitle>
          <WizardSteps step={step} />
        </DialogHeader>

        {/* Step 1: Choose trigger */}
        {step === 1 && (
          <div className="space-y-4">
            <p
              id="workflow-trigger-prompt"
              tabIndex={-1}
              data-step-focus
              className="text-[13px] leading-[19px] text-muted-foreground outline-none"
            >
              What should start this workflow?
            </p>
            <div role="radiogroup" aria-labelledby="workflow-trigger-prompt" className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(TRIGGER_META) as TriggerType[]).map((type) => {
                const meta = TRIGGER_META[type]
                return (
                  <OptionCard
                    key={type}
                    selected={selectedTrigger === type}
                    onSelect={() => setSelectedTrigger(type)}
                    icon={meta.icon}
                    title={meta.label}
                    description={meta.description}
                  />
                )
              })}
            </div>

            {selectedTrigger === 'keyword_detected' && (
              <Field label="Keyword to detect" htmlFor="workflow-keyword">
                <Input
                  id="workflow-keyword"
                  placeholder="e.g. pricing, appointment, refund"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </Field>
            )}
          </div>
        )}

        {/* Step 2: Add actions */}
        {step === 2 && (
          <div className="space-y-4">
            <p tabIndex={-1} data-step-focus className="text-[13px] leading-[19px] text-muted-foreground outline-none">
              Select one or more actions to run. <span className="tabular-nums">({selectedActions.length} selected)</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {READY_ACTIONS.map(renderActionTile)}
            </div>
            {/* Config for the picked actions, right under the tiles that ask for it */}
            {hasActionSettings && (
              <div className="space-y-4 border-t border-rule pt-4">
                {selectedActions.includes('send_webhook') && (
                  <Field label="Webhook URL" htmlFor="workflow-webhook-url">
                    <Input
                      id="workflow-webhook-url"
                      type="url"
                      inputMode="url"
                      placeholder="https://your-app.com/webhook"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                  </Field>
                )}
                {selectedActions.includes('notify_slack') && (
                  <Field label="Slack webhook URL" htmlFor="workflow-slack-url">
                    <Input
                      id="workflow-slack-url"
                      type="url"
                      inputMode="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackWebhookUrl}
                      onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    />
                  </Field>
                )}
                {selectedActions.includes('send_sms') && (
                  <Field
                    label="Text to send the caller"
                    htmlFor="workflow-sms-message"
                    hint={<>Sent once per call from your business number to the person on the call, signed with your business name. Transactional messages only (e.g. confirming you got their call): no promotions or marketing. Variables like {'{{business_name}}'} work.</>}
                  >
                    <Textarea
                      id="workflow-sms-message"
                      value={smsMessage}
                      maxLength={300}
                      rows={3}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      className="min-h-20 resize-none"
                    />
                  </Field>
                )}
                {selectedActions.includes('add_tag') && (
                  <Field label="Tag name" htmlFor="workflow-tag">
                    <Input
                      id="workflow-tag"
                      placeholder="e.g. follow-up, escalated, vip"
                      value={tagValue}
                      onChange={(e) => setTagValue(e.target.value)}
                    />
                  </Field>
                )}
              </div>
            )}

            {/* Action order preview */}
            {selectedActions.length > 0 && (
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Execution order
                </p>
                {/* Each step carries the arrow that leads into it, so a wrapped line never ends on an arrow. */}
                <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                  {selectedActions.map((type, i) => (
                    <li key={type} className="flex items-center gap-1.5">
                      {i > 0 && <ChainArrow />}
                      <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                      <ActionChip type={type} onTinted />
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Google actions last: they are all unavailable for now. */}
            {GOOGLE_ACTIONS.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    Google Workspace
                  </p>
                  <WorkInProgressBadge />
                </div>
                <p className="text-xs leading-[18px] text-muted-foreground">
                  Actions that need a Google integration are temporarily disabled while that integration is work in progress.{' '}
                  <a
                    href="/integrations"
                    className="rounded-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    See integrations
                  </a>
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GOOGLE_ACTIONS.map(renderActionTile)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Name & save */}
        {step === 3 && (
          <div className="space-y-5">
            <Field label="Workflow name" htmlFor="workflow-name">
              <Input
                id="workflow-name"
                data-step-focus
                required
                placeholder="e.g. Follow-up email after call"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Description" htmlFor="workflow-description" optional>
              <Input
                id="workflow-description"
                placeholder="What does this workflow do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            {/* Summary */}
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">Summary</p>
              <dl className="mt-3 grid gap-3 text-[13px] leading-[19px]">
                <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                  <dt className="text-muted-foreground">Trigger</dt>
                  <dd>{selectedTrigger && <TriggerChip type={selectedTrigger} />}</dd>
                </div>
                <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3">
                  <dt className="pt-0.5 text-muted-foreground">Actions</dt>
                  <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                    {selectedActions.map((type, i) => (
                      <span key={type} className="flex items-center gap-1.5">
                        {i > 0 && <ChainArrow />}
                        <ActionChip type={type} onTinted />
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Footer: pinned to the bottom of the dialog while a long step scrolls. The dialog's
            24 px padding shrinks the sticky area, hence -bottom-6 to reach its real edge. */}
        <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 flex items-center justify-between gap-2 border-t border-rule bg-popover px-6 pt-4 pb-6">
          <Button variant="ghost" onClick={step === 1 ? handleClose : () => goToStep(step - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            loading={saving}
            loadingText="Saving…"
            disabled={
              (step === 1 && !selectedTrigger) ||
              (step === 1 && selectedTrigger === 'keyword_detected' && !keyword.trim()) ||
              (step === 2 && selectedActions.length === 0) ||
              (step === 3 && !name.trim())
            }
            onClick={step < 3 ? () => goToStep(step + 1) : handleCreate}
          >
            {step < 3 ? (
              <>Next <ChevronRight aria-hidden /></>
            ) : (
              <><Check aria-hidden /> Create workflow</>
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
  const [smsUnavailable, setSmsUnavailable] = useState<string | null>('unknown')

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
    let cancelled = false
    fetch('/api/workflows/sms-capability')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { available?: boolean; reason?: string } | null
        if (cancelled) return
        setSmsUnavailable(res.ok && data?.available ? null : data?.reason ?? 'not_capable')
      })
      .catch(() => {
        if (!cancelled) setSmsUnavailable('not_capable')
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  const newWorkflowButton = (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus aria-hidden /> New workflow
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Workflows"
        title="Workflows"
        description="Automate actions triggered by your AI agent's calls."
        actions={newWorkflowButton}
      />

      {/* Stats: the tiles keep their place during the first load and show their own orbs. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile size="sm" label="Total workflows" value={stats.total} icon={GitBranch} loading={isLoading} />
        <StatTile size="sm" label="Active" value={stats.active} icon={Play} loading={isLoading} />
        <StatTile size="sm" label="Total runs" value={stats.totalRuns} icon={Zap} loading={isLoading} />
        {/* No runs yet: a dash (as on the dashboard), not a success rate that reads as a failure. */}
        <StatTile
          size="sm"
          label="Avg success"
          value={stats.totalRuns === 0 ? '—' : `${stats.avgSuccess}%`}
          hint={!isLoading && stats.totalRuns === 0 ? 'No runs yet' : undefined}
          icon={CheckCircle2}
          loading={isLoading}
        />
      </div>

      {/* Toolbar: also drawn during the first load (controls disabled) so the list does not move down. */}
      <div className="mt-10 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[360px]">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search workflows"
            className="h-9 rounded-full pl-9 [&::-webkit-search-cancel-button]:appearance-none"
            placeholder="Search workflows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'active' | 'paused')} className="gap-0">
          <TabsList aria-label="Filter workflows">
            {(['all', 'active', 'paused'] as const).map((f) => (
              <TabsTrigger key={f} value={f} disabled={isLoading}>{FILTER_LABEL[f]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {!isLoading && (
          <p className="ml-auto text-[13px] leading-[19px] text-muted-foreground tabular-nums" aria-live="polite">
            {filtered.length} of {workflows.length} workflows
          </p>
        )}
      </div>

      {/* Workflow list: the orb and the empty state sit in a white panel, like Phone numbers and Knowledge. */}
      {isLoading ? (
        <Card className="py-0">
          {/* About two rows of workflow cards, so less moves when they arrive. */}
          <OrbLoader label="Loading workflows…" className="min-h-[360px]" />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="py-0">
          <EmptyState
            bare
            icon={search ? Search : GitBranch}
            title="No workflows found"
            description={search ? 'Try a different search term.' : 'Create your first workflow to automate calls.'}
            action={
              !search ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus aria-hidden /> New workflow
                </Button>
              ) : undefined
            }
            className="min-h-[280px]"
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
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

      {/* How workflows run */}
      <div className="mt-10 flex items-start gap-3 rounded-2xl bg-secondary p-5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-foreground shadow-hair">
          <Zap aria-hidden className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm leading-[21px] font-medium text-foreground">How workflows run</h2>
          <p className="mt-1 max-w-[86ch] text-[13px] leading-[20px] text-muted-foreground">
            Workflows run automatically after each call. Actions execute in order, if one fails, subsequent actions are skipped and the run is marked as failed.
            <strong className="font-medium text-foreground"> Send webhook</strong>, <strong className="font-medium text-foreground">Add tag</strong>, and <strong className="font-medium text-foreground">Wait</strong> always work. <strong className="font-medium text-foreground">Send email</strong>, <strong className="font-medium text-foreground">Log to Sheets</strong>, <strong className="font-medium text-foreground">Create calendar event</strong>, and <strong className="font-medium text-foreground">Create doc</strong> require the matching Google integration to be connected. <strong className="font-medium text-foreground">Notify Slack</strong> needs a Slack incoming webhook URL. <strong className="font-medium text-foreground">Text the caller</strong> is offered when one of your business numbers can send texts.
          </p>
        </div>
      </div>

      <CreateWorkflowDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        connectedIntegrations={connectedIntegrations}
        smsUnavailable={smsUnavailable}
      />
    </PageContainer>
  )
}

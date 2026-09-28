'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { keywordListIssue, parseKeywords } from '@/lib/workflows/keywords'
import { actionListSchema, issuesByPath } from '@/lib/workflows/schemas'
import type { GoogleIntegrationType, TriggerType, WorkflowSummary, WorkflowWithSecret } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import { ActionsEditor } from './ActionsEditor'
import type { DraftAction } from './ActionConfigFields'
import { readApiError } from './api'
import { ACTION_META, TRIGGER_META, type WorkflowCapabilities } from './meta'
import { TriggerPicker } from './TriggerPicker'

const STEPS = [
  { num: 1, label: 'When it runs' },
  { num: 2, label: 'What happens' },
  { num: 3, label: 'Name and save' },
] as const

interface WorkflowBuilderProps {
  open: boolean
  /** null = create a new workflow. */
  workflow: WorkflowSummary | null
  capabilities: WorkflowCapabilities
  /** 'secret' opens an existing workflow on its first webhook step, where the signing secret is shown. */
  focus?: 'secret' | null
  onClose: () => void
  onSaved: (workflow: WorkflowSummary | WorkflowWithSecret, created: boolean) => void
  /** Called from the "Show signing secret" toast after a workflow with a webhook step is created. */
  onShowSecret: (workflow: WorkflowSummary) => void
  onRefreshConnection: (integration: GoogleIntegrationType) => Promise<void>
}

/** The builder is keyed by the workflow it edits, so its state starts fresh each time it opens. */
export function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      {props.open ? <BuilderBody key={props.workflow?.id ?? 'new'} {...props} /> : null}
    </Dialog>
  )
}

function BuilderBody({ workflow, capabilities, focus, onClose, onSaved, onShowSecret, onRefreshConnection }: WorkflowBuilderProps) {
  const editing = workflow !== null
  const firstWebhookId = workflow?.actions.find((action) => action.type === 'send_webhook')?.id ?? null
  const [step, setStep] = useState(focus === 'secret' && firstWebhookId ? 2 : 1)
  const [trigger, setTrigger] = useState<TriggerType | null>(workflow?.trigger ?? null)
  const [keyword, setKeyword] = useState(workflow?.trigger_config.keyword ?? '')
  const [actions, setActions] = useState<DraftAction[]>(
    (workflow?.actions ?? []).filter((action) => action.type in ACTION_META).map((action) => ({
      id: action.id,
      type: action.type,
      config: { ...action.config },
    }))
  )
  const [name, setName] = useState(workflow?.name ?? '')
  const [description, setDescription] = useState(workflow?.description ?? '')
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function validateStep(target: number): boolean {
    const next: Record<string, string> = {}
    if (target >= 1) {
      if (!trigger) next.trigger = 'Choose when this workflow should run.'
      else if (trigger === 'keyword_detected' && keywordListIssue(keyword)) next.keyword = `${keywordListIssue(keyword)}.`
    }
    if (target >= 2) {
      const parsed = actionListSchema.safeParse(actions)
      if (!parsed.success) {
        for (const [path, message] of Object.entries(issuesByPath(parsed.error))) next[`actions:${path}`] = message
      }
    }
    if (target >= 3 && !name.trim()) next.name = 'Give your workflow a name.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function goNext() {
    if (!validateStep(step)) {
      if (step === 2) toast.error('Some steps need attention before you continue.')
      return
    }
    setErrors({})
    setStep(step + 1)
  }

  async function save() {
    if (!trigger) {
      setStep(1)
      return
    }
    if (!validateStep(3)) {
      // Send the owner back to whichever earlier step holds the problem.
      if (trigger === 'keyword_detected' && keywordListIssue(keyword)) setStep(1)
      else if (!actionListSchema.safeParse(actions).success) setStep(2)
      return
    }
    setSaving(true)
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      trigger,
      trigger_config: trigger === 'keyword_detected' ? { keyword } : {},
      actions,
      enabled,
    }
    try {
      const res = await fetch(editing ? `/api/workflows/${workflow.id}` : '/api/workflows', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const message = await readApiError(res, 'We couldn’t save this workflow. Please try again.')
        toast.error(message)
        setErrors({ save: message })
        return
      }
      const saved = (await res.json()) as WorkflowSummary | WorkflowWithSecret
      const hasWebhook = actions.some((action) => action.type === 'send_webhook')
      const showSecret = !editing && hasWebhook
      toast.success(editing ? 'Workflow saved' : 'Workflow created', {
        description: showSecret
          ? 'Copy its signing secret into the system that receives your webhook.'
          : enabled
            ? 'It runs on your next matching call.'
            : 'It’s paused until you turn it on.',
        ...(showSecret ? { action: { label: 'Show secret', onClick: () => onShowSecret(saved) }, duration: 10_000 } : {}),
      })
      onSaved(saved, !editing)
    } catch {
      toast.error('We couldn’t reach the server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const actionErrors: Record<string, string> = {}
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith('actions:')) actionErrors[key.slice('actions:'.length)] = message
  }

  return (
    <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-2xl">
      <DialogHeader className="border-b px-4 pt-4 pb-3 sm:px-5">
        <DialogTitle>{editing ? 'Edit workflow' : 'New workflow'}</DialogTitle>
        <DialogDescription>No code needed: pick when it runs, what happens, and give it a name.</DialogDescription>
        <ol className="mt-2 flex items-center gap-1" aria-label="Progress">
          {STEPS.map((s, index) => (
            <li key={s.num} className="flex flex-1 items-center" aria-current={step === s.num ? 'step' : undefined}>
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  step >= s.num ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {step > s.num ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : s.num}
              </span>
              <span className={cn('ml-1.5 hidden text-xs sm:block', step === s.num ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {s.label}
              </span>
              <span className="sr-only sm:hidden">{s.label}</span>
              {index < STEPS.length - 1 ? <span className={cn('mx-2 h-px flex-1', step > s.num ? 'bg-purple-600' : 'bg-border')} /> : null}
            </li>
          ))}
        </ol>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {step === 1 ? (
          <>
            <TriggerPicker
              value={trigger}
              keyword={keyword}
              keywordError={errors.keyword}
              onChange={(value) => {
                setTrigger(value)
                setErrors({})
              }}
              onKeywordChange={setKeyword}
            />
            {errors.trigger ? <p className="mt-2 text-[11px] text-destructive" role="alert">{errors.trigger}</p> : null}
          </>
        ) : null}

        {step === 2 && trigger ? (
          <ActionsEditor
            actions={actions}
            initialExpandedId={focus === 'secret' ? firstWebhookId : null}
            onChange={setActions}
            errors={actionErrors}
            workflowId={workflow?.id ?? null}
            workflowName={name}
            trigger={trigger}
            capabilities={capabilities}
            onRefreshConnection={onRefreshConnection}
          />
        ) : null}

        {step === 3 && trigger ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="workflow-name" className="text-xs font-medium">Workflow name</Label>
              <Input
                id="workflow-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder="Missed calls to the front desk"
                aria-invalid={errors.name ? true : undefined}
                className="text-sm"
              />
              {errors.name ? <p className="text-[11px] text-destructive">{errors.name}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workflow-description" className="text-xs font-medium">Description (optional)</Label>
              <Input
                id="workflow-description"
                value={description}
                maxLength={300}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this workflow is for"
                className="text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Turn it on</p>
                <p className="text-xs text-muted-foreground">It starts with your next matching call. You can pause it any time.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Workflow on" />
            </div>
            <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full border bg-background px-2 py-0.5 font-medium text-foreground">
                  {TRIGGER_META[trigger].label}
                  {trigger === 'keyword_detected' && keyword.trim() ? `: ${parseKeywords(keyword).join(', ')}` : ''}
                </span>
                {actions.map((action) => (
                  <span key={action.id} className="flex items-center gap-1.5">
                    <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span className="rounded-full border bg-background px-2 py-0.5 text-muted-foreground">{ACTION_META[action.type].label}</span>
                  </span>
                ))}
              </div>
            </div>
            {errors.save ? <p className="text-[11px] text-destructive" role="alert">{errors.save}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-4 py-3 sm:px-5">
        <Button type="button" variant="ghost" size="sm" onClick={step === 1 ? onClose : () => setStep(step - 1)} disabled={saving}>
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>
        {step < 3 ? (
          <Button type="button" size="sm" className="purple-glow" onClick={goNext}>
            Next <ChevronRight />
          </Button>
        ) : (
          <Button type="button" size="sm" className="purple-glow" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create workflow'}
          </Button>
        )}
      </div>
    </DialogContent>
  )
}

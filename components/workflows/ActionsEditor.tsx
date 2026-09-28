'use client'

import { useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, ChevronDown, Lock, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BetaBadge } from '@/components/integrations/BetaBadge'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { stepFieldErrors } from '@/lib/workflows/schemas'
import { MAX_WORKFLOW_ACTIONS, type ActionType, type GoogleIntegrationType, type TriggerType } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import { ActionConfigFields, type DraftAction } from './ActionConfigFields'
import {
  ACTION_GROUPS,
  ACTION_META,
  defaultConfigFor,
  googleIntegrationFor,
  newActionId,
  type WorkflowCapabilities,
} from './meta'

interface ActionsEditorProps {
  actions: DraftAction[]
  /** Step to open first (defaults to the first step). */
  initialExpandedId?: string | null
  onChange: (actions: DraftAction[]) => void
  /** Validation messages keyed "<index>.<field>" (field "" = the step itself). */
  errors: Record<string, string>
  workflowId: string | null
  workflowName: string
  trigger: TriggerType
  capabilities: WorkflowCapabilities
  onRefreshConnection: (integration: GoogleIntegrationType) => Promise<void>
}

function stepErrors(errors: Record<string, string>, index: number): Record<string, string> {
  const prefix = `${index}.`
  const out: Record<string, string> = {}
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message
  }
  return out
}

/** A problem with the step as a whole (not one field), if any. */
function stepMessage(own: Record<string, string>): string | null {
  return own[''] ?? own.config ?? own.type ?? own.id ?? null
}

export function ActionsEditor({
  actions,
  initialExpandedId,
  onChange,
  errors,
  workflowId,
  workflowName,
  trigger,
  capabilities,
  onRefreshConnection,
}: ActionsEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(actions.length === 0)
  const [expanded, setExpanded] = useState<string | null>(initialExpandedId ?? actions[0]?.id ?? null)
  const full = actions.length >= MAX_WORKFLOW_ACTIONS

  function add(type: ActionType) {
    const action: DraftAction = { id: newActionId(), type, config: defaultConfigFor(type) }
    onChange([...actions, action])
    setExpanded(action.id)
    setPickerOpen(false)
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= actions.length) return
    const next = [...actions]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function remove(index: number) {
    onChange(actions.filter((_, i) => i !== index))
  }

  function updateConfig(index: number, config: Record<string, unknown>) {
    onChange(actions.map((action, i) => (i === index ? { ...action, config } : action)))
  }

  function lockReason(type: ActionType): 'google' | 'sms' | null {
    if (googleIntegrationFor(type) && !capabilities.google.allowed) return 'google'
    if (type === 'send_sms' && !capabilities.sms.allowed) return 'sms'
    return null
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Steps run in this order. If one fails, the ones after it don’t run. ({actions.length} of {MAX_WORKFLOW_ACTIONS})
      </p>
      {errors[''] ? <p className="text-[11px] text-destructive" role="alert">{errors['']}</p> : null}

      <ol className="space-y-2">
        {actions.map((action, index) => {
          const meta = ACTION_META[action.type]
          const Icon = meta.icon
          const own = stepErrors(errors, index)
          const hasErrors = Object.keys(own).length > 0
          const open = expanded === action.id || hasErrors
          const panelId = `step-panel-${action.id}`
          return (
            <li key={action.id} className={cn('rounded-xl border bg-card', hasErrors && 'border-destructive/50')}>
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setExpanded(open && !hasErrors ? null : action.id)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className={cn('size-4 shrink-0', meta.tone)} aria-hidden="true" />
                  <span className="min-w-0 break-words text-sm font-medium leading-snug text-foreground">{meta.label}</span>
                  {meta.group === 'google' ? <BetaBadge /> : null}
                  {hasErrors ? <AlertCircle className="size-3.5 shrink-0 text-destructive" aria-label="Needs attention" /> : null}
                  {/* Shows the row opens; the arrows beside it only reorder. */}
                  <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move step ${index + 1} up`} className="max-sm:size-9">
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(index, 1)} disabled={index === actions.length - 1} aria-label={`Move step ${index + 1} down`} className="max-sm:size-9">
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(index)} aria-label={`Remove step ${index + 1}`} className="text-muted-foreground hover:text-destructive max-sm:size-9">
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {open ? (
                <div id={panelId} className="border-t px-3 py-3">
                  {stepMessage(own) ? <p className="mb-2 text-[11px] text-destructive" role="alert">{stepMessage(own)}</p> : null}
                  <ActionConfigFields
                    action={action}
                    errors={stepFieldErrors(own)}
                    onChange={(config) => updateConfig(index, config)}
                    workflowId={workflowId}
                    workflowName={workflowName}
                    trigger={trigger}
                    capabilities={capabilities}
                    onRefreshConnection={onRefreshConnection}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>

      {pickerOpen ? (
        <div className="space-y-3 rounded-xl border border-dashed p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Add a step</p>
            {actions.length > 0 ? (
              <Button type="button" size="icon-xs" variant="ghost" onClick={() => setPickerOpen(false)} aria-label="Close step list">
                <X />
              </Button>
            ) : null}
          </div>
          {ACTION_GROUPS.map((group) => (
            <div key={group.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                {group.id === 'google' ? <BetaBadge /> : null}
              </div>
              {group.id === 'google' && !capabilities.google.allowed ? (
                <UpgradeNotice compact feature="Google Workspace steps" requiredPlan={capabilities.google.requiredPlan} />
              ) : null}
              <div className="grid gap-1.5 sm:grid-cols-2">
                {group.types.map((type) => {
                  const meta = ACTION_META[type]
                  const Icon = meta.icon
                  const locked = lockReason(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => add(type)}
                      disabled={full || locked !== null}
                      className="flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-purple-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {locked ? <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Icon className={cn('mt-0.5 size-4 shrink-0', meta.tone)} aria-hidden="true" />}
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-foreground">{meta.label}</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">{meta.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {group.id === 'notify' && !capabilities.sms.allowed ? (
                <UpgradeNotice compact feature="Texting callers" requiredPlan={capabilities.sms.requiredPlan} />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} disabled={full} className="w-full">
          <Plus /> {full ? `A workflow can have up to ${MAX_WORKFLOW_ACTIONS} steps` : 'Add a step'}
        </Button>
      )}
    </div>
  )
}

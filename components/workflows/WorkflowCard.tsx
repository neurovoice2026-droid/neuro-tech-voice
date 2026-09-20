'use client'

import { AlertCircle, ArrowRight, Clock, Copy, FlaskConical, History, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { parseStoredAction } from '@/lib/workflows/schemas'
import { TESTABLE_ACTION_TYPES, type ActionType, type WorkflowSummary } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import { BetaBadge } from '@/components/integrations/BetaBadge'
import { ACTION_META, TRIGGER_META, formatRelative } from './meta'

interface WorkflowCardProps {
  workflow: WorkflowSummary
  toggling: boolean
  onToggle: (workflow: WorkflowSummary, enabled: boolean) => void
  onEdit: (workflow: WorkflowSummary) => void
  onTest: (workflow: WorkflowSummary) => void
  onHistory: (workflow: WorkflowSummary) => void
  onDuplicate: (workflow: WorkflowSummary) => void
  onDelete: (workflow: WorkflowSummary) => void
}

function SuccessRate({ runs, successful }: { runs: number; successful: number }) {
  if (runs === 0) return <span className="text-muted-foreground">No runs yet</span>
  const rate = Math.round((successful / runs) * 100)
  const tone = rate >= 95 ? 'border-green-200 bg-green-50 text-green-700' : rate >= 80 ? 'border-yellow-200 bg-yellow-50 text-yellow-700' : 'border-red-200 bg-red-50 text-red-700'
  return <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', tone)}>{rate}% success</span>
}

export function WorkflowCard({ workflow, toggling, onToggle, onEdit, onTest, onHistory, onDuplicate, onDelete }: WorkflowCardProps) {
  const trigger = TRIGGER_META[workflow.trigger]
  const TriggerIcon = trigger.icon
  const needsAttention = workflow.actions.some((action, index) => !parseStoredAction(action, index).ok)
  const lastRun = formatRelative(workflow.last_run_at)
  const testable = workflow.actions.some((action) => (TESTABLE_ACTION_TYPES as readonly string[]).includes(action.type))

  return (
    <article
      className={cn(
        'rounded-2xl border-2 bg-card p-4 transition-colors sm:p-5',
        workflow.enabled ? 'border-border hover:border-purple-200' : 'border-dashed border-gray-200 bg-gray-50/40'
      )}
      aria-label={workflow.name}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', trigger.tone)}>
          <TriggerIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-2 min-w-0 text-sm font-semibold break-words text-foreground">{workflow.name}</h3>
            {!workflow.enabled ? <Badge variant="secondary" className="text-[10px]">Paused</Badge> : null}
            {needsAttention ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                <AlertCircle aria-hidden="true" /> Needs attention
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {workflow.description ?? trigger.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Switch
            checked={workflow.enabled}
            disabled={toggling}
            onCheckedChange={(checked) => onToggle(workflow, checked)}
            aria-label={workflow.enabled ? `Pause ${workflow.name}` : `Turn on ${workflow.name}`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`More actions for ${workflow.name}`}
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(workflow)}>
                <Pencil className="mr-2 size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTest(workflow)}>
                <FlaskConical className="mr-2 size-4" /> Send test
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onHistory(workflow)}>
                <History className="mr-2 size-4" /> Run history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(workflow)}>
                <Copy className="mr-2 size-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(workflow)}>
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border bg-white px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
          {trigger.label}
          {workflow.trigger === 'keyword_detected' && workflow.trigger_config.keyword ? (
            <span className="font-normal text-muted-foreground">: {workflow.trigger_config.keyword}</span>
          ) : null}
        </span>
        {workflow.actions.map((action) => {
          const meta = ACTION_META[action.type as ActionType]
          const Icon = meta?.icon
          return (
            <span key={action.id} className="flex items-center gap-1.5">
              <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                {Icon ? <Icon className={cn('size-3', meta.tone)} aria-hidden="true" /> : null}
                {meta?.label ?? 'Removed step'}
                {meta?.group === 'google' ? <BetaBadge className="ml-0.5 px-1.5 py-0 text-[9px]" /> : null}
              </span>
            </span>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => onHistory(workflow)}
          className="flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Play className="size-3" aria-hidden="true" /> {workflow.runs} {workflow.runs === 1 ? 'run' : 'runs'}
        </button>
        {lastRun ? (
          // Relative time differs between the server render and hydration (clock and time zone).
          <span className="flex items-center gap-1" suppressHydrationWarning>
            <Clock className="size-3" aria-hidden="true" /> Last run {/^(Just now|Yesterday)$/.test(lastRun) ? lastRun.toLowerCase() : lastRun}
          </span>
        ) : null}
        <SuccessRate runs={workflow.runs} successful={workflow.successful_runs} />
        {testable ? (
          <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={() => onTest(workflow)}>
            <FlaskConical aria-hidden="true" /> Send test
          </Button>
        ) : null}
      </div>
    </article>
  )
}

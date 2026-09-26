import { CheckCircle2, CircleMinus, XCircle } from 'lucide-react'
import type { ActionResult, ActionType } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import { ACTION_META } from './meta'

function label(type: string): string {
  return type in ACTION_META ? ACTION_META[type as ActionType].label : 'Removed step'
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
}

/** One line per step: what happened, how many attempts, how long it took. */
export function ActionResultList({ results }: { results: ActionResult[] }) {
  if (results.length === 0) {
    return <p className="text-xs text-muted-foreground">No step results were recorded for this run.</p>
  }
  return (
    <ol className="space-y-1.5">
      {results.map((result, index) => {
        const state = result.skipped ? 'skipped' : result.success ? 'ok' : 'failed'
        const Icon = state === 'ok' ? CheckCircle2 : state === 'failed' ? XCircle : CircleMinus
        const meta = [
          result.attempts > 1 ? `${result.attempts} attempts` : null,
          formatMs(result.duration_ms) || null,
          typeof result.status_code === 'number' ? `HTTP ${result.status_code}` : null,
        ].filter(Boolean)
        return (
          <li key={`${result.action_id}-${index}`} className="flex gap-2">
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                state === 'ok' ? 'text-green-600' : state === 'failed' ? 'text-red-600' : 'text-muted-foreground'
              )}
              aria-label={state === 'ok' ? 'Succeeded' : state === 'failed' ? 'Failed' : 'Skipped'}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">
                {index + 1}. {label(result.action_type)}
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground break-words">{result.message}</p>
              {meta.length > 0 ? <p className="text-[10px] text-muted-foreground/80">{meta.join(' · ')}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

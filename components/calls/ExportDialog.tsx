'use client'

import { useState, useTransition } from 'react'
import { Download, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { callFilterParams, readApiError } from '@/hooks/useCalls'
import type { CallListFilters } from '@/lib/calls/labels'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: CallListFilters
  total: number
  selectedIds: string[]
}

// Column ids must match the server whitelist (app/api/calls/export/route.ts).
const COLUMNS: Array<{ id: string; label: string; required: boolean; warning?: string }> = [
  { id: 'caller_number',    label: 'Phone number',   required: true },
  { id: 'direction',        label: 'Direction',      required: true },
  { id: 'duration_seconds', label: 'Duration',       required: true },
  { id: 'status',           label: 'Status',         required: true },
  { id: 'created_at',       label: 'Date & time',    required: false },
  { id: 'sentiment',        label: 'Sentiment',      required: false },
  { id: 'provider',         label: 'Voice provider', required: false },
  { id: 'routing_reason',   label: 'Routing (answered by AI, backup agent, after hours…)', required: false },
  { id: 'failover_reason',  label: 'Failover reason', required: false },
  { id: 'outcome',          label: 'Outcome',        required: false },
  { id: 'summary_title',    label: 'Summary title',  required: false },
  { id: 'summary',          label: 'AI summary',     required: false },
  { id: 'transcript',       label: 'Transcript',     required: false, warning: 'Makes file larger' },
  { id: 'agent_name',       label: 'Agent name',     required: false },
]

const DEFAULT_COLUMNS = ['sentiment', 'created_at', 'provider', 'routing_reason', 'outcome']

export function ExportDialog({ open, onOpenChange, filters, total, selectedIds }: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [scope, setScope] = useState<'filtered' | 'all' | 'selected'>('filtered')
  const [checkedCols, setCheckedCols] = useState<Set<string>>(
    new Set(COLUMNS.filter((c) => c.required || DEFAULT_COLUMNS.includes(c.id)).map((c) => c.id))
  )
  const [isPending, startTransition] = useTransition()

  // "Selected" disappears when the selection is cleared: fall back to the filters.
  const effectiveScope = scope === 'selected' && selectedIds.length === 0 ? 'filtered' : scope
  const scopeCount = effectiveScope === 'selected' ? selectedIds.length : effectiveScope === 'filtered' ? total : null

  function toggleCol(id: string) {
    setCheckedCols((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleExport() {
    startTransition(async () => {
      const params = effectiveScope === 'filtered' ? callFilterParams(filters) : new URLSearchParams()
      params.set('format', format)
      params.set('scope', effectiveScope)
      params.set('columns', COLUMNS.filter((c) => checkedCols.has(c.id)).map((c) => c.id).join(','))
      if (effectiveScope === 'selected') params.set('selectedIds', selectedIds.join(','))

      toast.loading(scopeCount === null ? 'Exporting calls…' : `Exporting ${scopeCount} calls…`, { id: 'export' })

      try {
        const res = await fetch(`/api/calls/export?${params}`)
        if (!res.ok) throw new Error(await readApiError(res, 'Export failed'))

        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `calls-${new Date().toISOString().slice(0, 10)}.${format}`
        a.click()
        URL.revokeObjectURL(url)

        toast.success('Download ready!', { id: 'export' })
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Export failed', { id: 'export' })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-purple-100 p-1.5">
              <Download className="h-4 w-4 text-purple-600" />
            </div>
            Export calls
          </DialogTitle>
          <DialogDescription>
            Choose format and columns to include in your export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Format */}
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Format</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['csv', 'json'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    format === f
                      ? 'border-primary bg-purple-50'
                      : 'border-border hover:border-purple-200'
                  )}
                >
                  <p className="text-sm font-medium uppercase">{f}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {f === 'csv' ? 'Opens in Excel / Sheets' : 'Raw data for developers'}
                  </p>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Scope */}
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Export scope</legend>
            <div className="space-y-1.5">
              {[
                { id: 'filtered', label: `Current filters (${total} calls)` },
                { id: 'all',      label: 'All time' },
                ...(selectedIds.length > 0
                  ? [{ id: 'selected', label: `Selected only (${selectedIds.length} calls)` }]
                  : []),
              ].map((s) => (
                <label key={s.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value={s.id}
                    checked={effectiveScope === s.id}
                    onChange={() => setScope(s.id as typeof scope)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Columns */}
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Columns</legend>
            <div className="space-y-1.5">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`col-${col.id}`}
                    checked={checkedCols.has(col.id)}
                    onCheckedChange={() => !col.required && toggleCol(col.id)}
                    disabled={col.required}
                  />
                  <Label htmlFor={`col-${col.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                    {col.label}
                    {col.warning && (
                      <span className="text-xs text-amber-600">({col.warning})</span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 purple-glow"
            onClick={handleExport}
            disabled={isPending || scopeCount === 0}
          >
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting…</>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {scopeCount === null ? 'Export all calls' : `Export ${scopeCount} calls`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

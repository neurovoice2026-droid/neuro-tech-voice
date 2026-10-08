'use client'

import { useState, useTransition } from 'react'
import { Braces, Download, Sheet as SheetIcon } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { OptionCard } from '@/components/shared/OptionCard'
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
  { id: 'call_successful',  label: 'AI outcome (the AI’s verdict: successful or not)', required: false },
  { id: 'summary_title',    label: 'Summary title',  required: false },
  { id: 'summary',          label: 'AI summary',     required: false },
  { id: 'transcript',       label: 'Transcript',     required: false, warning: 'Makes file larger' },
  { id: 'agent_name',       label: 'Agent name',     required: false },
]

// The AI outcome (the AI's verdict on the call's goal) replaces sentiment by
// default; sentiment stays selectable.
const DEFAULT_COLUMNS = ['call_successful', 'created_at', 'provider', 'routing_reason', 'outcome']

const LEGEND = 'mb-2.5 text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase'

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

  const scopes = [
    { id: 'filtered', label: 'Current filters', count: total },
    { id: 'all',      label: 'All time', count: null },
    ...(selectedIds.length > 0 ? [{ id: 'selected', label: 'Selected only', count: selectedIds.length }] : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Export calls</DialogTitle>
          <DialogDescription>
            Choose format and columns to include in your export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format */}
          <fieldset>
            <legend className={LEGEND}>Format</legend>
            <div role="radiogroup" aria-label="Format" className="grid grid-cols-2 gap-2">
              {(['csv', 'json'] as const).map((f) => (
                <OptionCard
                  key={f}
                  selected={format === f}
                  onSelect={() => setFormat(f)}
                  icon={f === 'csv' ? SheetIcon : Braces}
                  title={f.toUpperCase()}
                  description={f === 'csv' ? 'Opens in Excel / Sheets' : 'Raw data for developers'}
                />
              ))}
            </div>
          </fieldset>

          {/* Scope */}
          <fieldset>
            <legend className={LEGEND}>Export scope</legend>
            <div className="overflow-hidden rounded-2xl shadow-hair">
              {scopes.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-rule px-4 py-2.5 transition-colors last:border-b-0 hover:bg-band has-checked:bg-band"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={s.id}
                    checked={effectiveScope === s.id}
                    onChange={() => setScope(s.id as typeof scope)}
                    className="size-4 shrink-0 accent-[#140a24]"
                  />
                  <span className="flex-1 text-sm">{s.label}</span>
                  {s.count !== null && (
                    <span className="text-[13px] text-muted-foreground tabular-nums">{s.count.toLocaleString()} calls</span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Columns */}
          <fieldset>
            <legend className={LEGEND}>Columns</legend>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex items-start gap-2.5">
                  <Checkbox
                    id={`col-${col.id}`}
                    checked={checkedCols.has(col.id)}
                    onCheckedChange={() => !col.required && toggleCol(col.id)}
                    disabled={col.required}
                    className="mt-px"
                  />
                  <Label htmlFor={`col-${col.id}`} className="block cursor-pointer text-[13px] leading-[19px] font-normal">
                    {col.label}
                    {col.warning && (
                      <span className="mt-0.5 block text-xs leading-4 text-warning">{col.warning}</span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <DialogFooter className="border-t border-rule pt-5">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={scopeCount === 0}
            loading={isPending}
            loadingText="Exporting…"
          >
            <Download aria-hidden="true" />
            {scopeCount === null ? 'Export all calls' : `Export ${scopeCount} calls`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
import type { CallFilters } from '@/types'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: CallFilters
  total: number
  selectedIds: string[]
}

const COLUMNS = [
  { id: 'caller_number',    label: 'Phone number',   required: true },
  { id: 'direction',        label: 'Direction',      required: true },
  { id: 'duration_seconds', label: 'Duration',       required: true },
  { id: 'status',           label: 'Status',         required: true },
  { id: 'sentiment',        label: 'Sentiment',      required: false },
  { id: 'created_at',       label: 'Date & time',    required: false },
  { id: 'transcript',       label: 'Transcript',     required: false, warning: 'Makes file larger' },
  { id: 'summary',          label: 'AI Summary',     required: false },
  { id: 'agent_name',       label: 'Agent name',     required: false },
]

export function ExportDialog({ open, onOpenChange, filters, total, selectedIds }: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [scope, setScope] = useState<'filtered' | 'all' | 'selected'>('filtered')
  const [checkedCols, setCheckedCols] = useState<Set<string>>(
    new Set(COLUMNS.filter((c) => c.required || ['sentiment', 'created_at'].includes(c.id)).map((c) => c.id))
  )
  const [isPending, startTransition] = useTransition()

  const scopeCount = scope === 'selected' ? selectedIds.length : total

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
      const params = new URLSearchParams({
        format,
        scope,
        columns: Array.from(checkedCols).join(','),
        ...(scope === 'selected' ? { selectedIds: selectedIds.join(',') } : {}),
        ...(scope === 'filtered' ? {
          search:    filters.search,
          status:    filters.status,
          direction: filters.direction,
          sentiment: filters.sentiment,
          dateFrom:  filters.dateFrom,
          dateTo:    filters.dateTo,
        } : {}),
      })

      toast.loading(`Exporting ${scopeCount} calls…`, { id: 'export' })

      try {
        const res = await fetch(`/api/calls/export?${params}`)
        if (!res.ok) throw new Error('Export failed')

        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `calls-${new Date().toISOString().slice(0, 10)}.${format}`
        a.click()
        URL.revokeObjectURL(url)

        toast.success('Download ready!', { id: 'export' })
        onOpenChange(false)
      } catch {
        toast.error('Export failed', { id: 'export' })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Format</p>
            <div className="grid grid-cols-2 gap-2">
              {(['csv', 'json'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
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
          </div>

          {/* Scope */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Export scope</p>
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
                    checked={scope === s.id}
                    onChange={() => setScope(s.id as typeof scope)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Columns */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Columns</p>
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
          </div>
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
                Export {scopeCount} calls
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

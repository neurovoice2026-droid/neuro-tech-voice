'use client'

import { useId, useState, useTransition } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { activeFilterCount, filtersToApiParams } from '@/hooks/useCalls'
import type { CallFilters } from '@/types'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: CallFilters
  /** The list currently shows test calls too; the "current view" export follows it. */
  includeTest: boolean
  /** Calls matching the current filters. */
  total: number
  selectedIds: string[]
}

type Scope = 'filtered' | 'all' | 'selected'

const EXPORT_ROW_LIMIT = 5_000
/** Same cap as the export route (MAX_SELECTED_IDS). */
const MAX_SELECTED_EXPORT = 500

const COLUMNS: { id: string; label: string; always?: boolean; note?: string }[] = [
  { id: 'caller_number', label: 'Phone number', always: true },
  { id: 'created_at', label: 'Date & time', always: true },
  { id: 'direction', label: 'Direction' },
  { id: 'duration_seconds', label: 'Duration' },
  { id: 'status', label: 'Status' },
  { id: 'outcome', label: 'Outcome' },
  { id: 'intent', label: 'Reason for calling' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'tags', label: 'Tags' },
  { id: 'summary', label: 'AI summary' },
  { id: 'extracted', label: 'Details collected' },
  { id: 'agent_name', label: 'Agent name' },
  { id: 'transcript', label: 'Transcript', note: 'makes the file much larger' },
]

const DEFAULT_COLUMNS = ['caller_number', 'created_at', 'direction', 'duration_seconds', 'status', 'outcome', 'sentiment', 'summary']

export function ExportDialog({ open, onOpenChange, filters, includeTest, total, selectedIds }: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [scopeChoice, setScope] = useState<Scope>('filtered')
  const [columns, setColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS))
  const [isPending, startTransition] = useTransition()
  const scopeName = useId()
  const formatName = useId()

  const hasFilters = activeFilterCount(filters) > 0
  // The selection can empty while the dialog is closed; fall back instead of offering nothing.
  const scope: Scope = scopeChoice === 'selected' && selectedIds.length === 0 ? 'filtered' : scopeChoice

  function toggle(id: string) {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const scopeCount = scope === 'selected' ? selectedIds.length : scope === 'filtered' ? total : null

  function handleExport() {
    startTransition(async () => {
      const params = scope === 'filtered' ? filtersToApiParams(filters, includeTest) : new URLSearchParams()
      params.set('format', format)
      params.set('scope', scope)
      params.set('columns', COLUMNS.filter((c) => c.always || columns.has(c.id)).map((c) => c.id).join(','))
      // Posted, not put in the URL: hundreds of selected ids would make the URL too long.
      const body: Record<string, string | string[]> = Object.fromEntries(params)
      if (scope === 'selected') body.selectedIds = selectedIds

      const toastId = toast.loading('Preparing your export…')
      try {
        const res = await fetch('/api/calls/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          toast.error(body?.error?.message ?? 'The export didn’t work. Please try again.', { id: toastId })
          return
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `calls-${new Date().toISOString().slice(0, 10)}.${format}`
        a.click()
        URL.revokeObjectURL(url)

        const rows = Number(res.headers.get('X-Export-Rows') ?? '0')
        const matching = Number(res.headers.get('X-Export-Total') ?? rows)
        if (res.headers.get('X-Export-Truncated') === 'true') {
          toast.warning(
            `Downloaded ${rows.toLocaleString()} of ${matching.toLocaleString()} calls, the most one file holds. Narrow the dates to export the rest.`,
            { id: toastId, duration: 8000 }
          )
        } else {
          toast.success(`Downloaded ${rows.toLocaleString()} ${rows === 1 ? 'call' : 'calls'}`, { id: toastId })
        }
        onOpenChange(false)
      } catch {
        toast.error('We couldn’t reach the server. Check your connection and try again.', { id: toastId })
      }
    })
  }

  const scopes: { id: Scope; label: string; hint: string }[] = [
    {
      id: 'filtered',
      label: hasFilters ? 'Calls matching your filters' : 'Calls in the current view',
      hint: `${total.toLocaleString()} ${total === 1 ? 'call' : 'calls'}`,
    },
    { id: 'all', label: 'Every call', hint: 'Test calls are left out' },
    ...(selectedIds.length > 0
      ? [{
          id: 'selected' as Scope,
          label: 'Only the calls you selected',
          hint: selectedIds.length > MAX_SELECTED_EXPORT
            ? `${selectedIds.length} selected. One file holds up to ${MAX_SELECTED_EXPORT} selected calls, so select fewer or use filters.`
            : `${selectedIds.length} selected`,
        }]
      : []),
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 p-1.5">
              <Download aria-hidden="true" className="size-4 text-purple-600" />
            </span>
            Export calls
          </DialogTitle>
          <DialogDescription>
            Download your call history as a spreadsheet or raw data. Up to {EXPORT_ROW_LIMIT.toLocaleString()} calls per file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['csv', 'json'] as const).map((f) => (
                <label
                  key={f}
                  className={cn(
                    'cursor-pointer rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
                    format === f ? 'border-primary bg-purple-50' : 'border-border hover:border-purple-200'
                  )}
                >
                  <input
                    type="radio"
                    name={formatName}
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium uppercase">{f}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {f === 'csv' ? 'Opens in Excel or Google Sheets' : 'Raw data for developers'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Which calls</legend>
            <div className="space-y-2">
              {scopes.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="radio"
                    name={scopeName}
                    value={s.id}
                    checked={scope === s.id}
                    onChange={() => setScope(s.id)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-sm">
                    {s.label}
                    <span className="block text-xs text-muted-foreground">{s.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {scopeCount !== null && scopeCount > EXPORT_ROW_LIMIT && (
              <p className="mt-2 text-xs text-amber-700">
                That’s more than {EXPORT_ROW_LIMIT.toLocaleString()} calls, so the file stops at {EXPORT_ROW_LIMIT.toLocaleString()}. Narrow the dates to export the rest.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Columns</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`export-col-${col.id}`}
                    checked={col.always || columns.has(col.id)}
                    onCheckedChange={() => !col.always && toggle(col.id)}
                    disabled={col.always}
                  />
                  <Label htmlFor={`export-col-${col.id}`} className="cursor-pointer text-sm font-normal">
                    {col.label}
                    {col.note && <span className="ml-1 text-xs text-amber-700">({col.note})</span>}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 max-sm:[&_[data-slot=button]]:h-10 sm:flex-row sm:gap-3">
          <Button variant="outline" className="sm:flex-1" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button className="sm:flex-1" onClick={handleExport} disabled={isPending || scopeCount === 0 || (scope === 'selected' && selectedIds.length > MAX_SELECTED_EXPORT)}>
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download aria-hidden="true" className="mr-2 size-4" />
                Export {scopeCount !== null ? `${Math.min(scopeCount, EXPORT_ROW_LIMIT).toLocaleString()} ` : ''}
                {scopeCount === 1 ? 'call' : 'calls'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

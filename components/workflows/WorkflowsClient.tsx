'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { CheckCircle2, GitBranch, Loader2, Play, Plus, Search, ShieldCheck, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/EmptyState'
import type { GoogleIntegrationType, WorkflowSummary } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import { readApiError } from './api'
import type { WorkflowCapabilities } from './meta'
import { RunHistorySheet } from './RunHistorySheet'
import { TestRunDialog } from './TestRunDialog'
import { WorkflowBuilder } from './WorkflowBuilder'
import { WorkflowCard } from './WorkflowCard'

interface WorkflowsClientProps {
  /** null when the server couldn't load them; the page offers a retry. */
  initialWorkflows: WorkflowSummary[] | null
  capabilities: WorkflowCapabilities
}

type Filter = 'all' | 'active' | 'paused'

/** List state never keeps a signing secret; the builder loads it on demand. */
function stripSecret(workflow: WorkflowSummary): WorkflowSummary {
  const summary: WorkflowSummary = { ...workflow }
  delete (summary as Partial<{ signing_secret: unknown }>).signing_secret
  return summary
}

export function WorkflowsClient({ initialWorkflows, capabilities: initialCapabilities }: WorkflowsClientProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(initialWorkflows)
  const [loading, setLoading] = useState(false)
  const [capabilities, setCapabilities] = useState(initialCapabilities)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [builder, setBuilder] = useState<{ open: boolean; workflow: WorkflowSummary | null; focus?: 'secret' }>({ open: false, workflow: null })
  const [historyFor, setHistoryFor] = useState<WorkflowSummary | null>(null)
  const [testFor, setTestFor] = useState<WorkflowSummary | null>(null)
  const [deleteFor, setDeleteFor] = useState<WorkflowSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  // A second "Duplicate" click while the first is still saving would create two copies.
  const duplicating = useRef(new Set<string>())

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workflows', { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res, 'We couldn’t load your workflows.'))
      setWorkflows((await res.json()) as WorkflowSummary[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We couldn’t load your workflows.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshConnection = useCallback(async (integration: GoogleIntegrationType) => {
    try {
      const res = await fetch(`/api/integrations/${integration}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res))
      const data = (await res.json()) as { connected: boolean; integration: { account_email?: string | null } | null }
      setCapabilities((current) => ({
        ...current,
        connections: {
          ...current.connections,
          [integration]: { connected: data.connected, account_email: data.integration?.account_email ?? null },
        },
      }))
      if (!data.connected) toast.message('Not connected yet', { description: 'Finish connecting in the other tab, then check again.' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We couldn’t check the connection.')
    }
  }, [])

  const list = useMemo(() => workflows ?? [], [workflows])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return list.filter((workflow) => {
      const matchesSearch = !query || workflow.name.toLowerCase().includes(query) || (workflow.description ?? '').toLowerCase().includes(query)
      const matchesFilter = filter === 'all' || (filter === 'active' ? workflow.enabled : !workflow.enabled)
      return matchesSearch && matchesFilter
    })
  }, [list, search, filter])

  const stats = useMemo(() => {
    const totalRuns = list.reduce((sum, w) => sum + w.runs, 0)
    const successfulRuns = list.reduce((sum, w) => sum + w.successful_runs, 0)
    return {
      total: list.length,
      active: list.filter((w) => w.enabled).length,
      totalRuns,
      success: totalRuns > 0 ? `${Math.round((successfulRuns / totalRuns) * 100)}%` : '–',
    }
  }, [list])

  async function toggle(workflow: WorkflowSummary, enabled: boolean) {
    setToggling(workflow.id)
    setWorkflows((current) => current?.map((w) => (w.id === workflow.id ? { ...w, enabled } : w)) ?? current)
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error(await readApiError(res, 'We couldn’t update this workflow.'))
      toast.success(enabled ? `${workflow.name} is on` : `${workflow.name} is paused`)
    } catch (error) {
      setWorkflows((current) => current?.map((w) => (w.id === workflow.id ? { ...w, enabled: !enabled } : w)) ?? current)
      toast.error(error instanceof Error ? error.message : 'We couldn’t update this workflow.')
    } finally {
      setToggling(null)
    }
  }

  async function duplicate(workflow: WorkflowSummary) {
    if (duplicating.current.has(workflow.id)) return
    duplicating.current.add(workflow.id)
    const pending = toast.loading(`Duplicating ${workflow.name}…`)
    try {
      await createCopy(workflow)
    } catch {
      toast.error('We couldn’t duplicate this workflow. Please try again.')
    } finally {
      toast.dismiss(pending)
      duplicating.current.delete(workflow.id)
    }
  }

  async function createCopy(workflow: WorkflowSummary) {
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${workflow.name} (copy)`.slice(0, 100),
        description: workflow.description,
        trigger: workflow.trigger,
        trigger_config: workflow.trigger_config,
        actions: workflow.actions,
        enabled: false,
      }),
    }).catch(() => null)
    if (!res) {
      toast.error('We couldn’t reach the server. Please try again.')
      return
    }
    if (!res.ok) {
      toast.error(await readApiError(res, 'We couldn’t duplicate this workflow.'))
      return
    }
    const created = (await res.json()) as WorkflowSummary
    setWorkflows((current) => [created, ...(current ?? [])])
    toast.success('Workflow duplicated', { description: 'The copy is paused until you turn it on.' })
  }

  async function confirmDelete() {
    if (!deleteFor) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/workflows/${deleteFor.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(await readApiError(res, 'We couldn’t delete this workflow.'))
      setWorkflows((current) => current?.filter((w) => w.id !== deleteFor.id) ?? current)
      toast.success('Workflow deleted')
      setDeleteFor(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We couldn’t delete this workflow.')
    } finally {
      setDeleting(false)
    }
  }

  function onSaved(saved: WorkflowSummary, created: boolean) {
    const summary = stripSecret(saved)
    setWorkflows((current) => {
      const rows = current ?? []
      return created ? [summary, ...rows] : rows.map((w) => (w.id === summary.id ? summary : w))
    })
    setBuilder({ open: false, workflow: null })
  }

  const openNew = () => setBuilder({ open: true, workflow: null })

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Decide what happens after every call: a Slack message, a text to the caller, a row in your sheet. No code needed.
          </p>
        </div>
        <Button className="purple-glow shrink-0 self-start" onClick={openNew} disabled={workflows === null}>
          <Plus /> New workflow
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Workflows', value: stats.total, icon: GitBranch, tone: 'bg-purple-50 text-purple-600' },
          { label: 'Turned on', value: stats.active, icon: Play, tone: 'bg-green-50 text-green-600' },
          { label: 'Total runs', value: stats.totalRuns, icon: Zap, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Succeeded', value: stats.success, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none text-foreground tabular-nums">{workflows === null ? '–' : value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {workflows === null ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium text-foreground">We couldn’t load your workflows</p>
          <p className="max-w-sm text-xs text-muted-foreground">Your workflows are safe and keep running. This is only a problem showing them.</p>
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : null} Try again
          </Button>
        </div>
      ) : (
        <>
          {list.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="h-9 pl-9 text-sm"
                  placeholder="Search workflows"
                  aria-label="Search workflows"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-lg border bg-card" role="group" aria-label="Filter workflows">
                {(['all', 'active', 'paused'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-none',
                      filter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {value === 'active' ? 'On' : value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {list.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No workflows yet"
              description="Start with the call you’d hate to miss: send missed calls to your team’s Slack channel so someone rings back."
              action={
                <Button className="purple-glow" size="sm" onClick={openNew}>
                  <Plus /> Create your first workflow
                </Button>
              }
              className="rounded-2xl border border-dashed"
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No workflows match"
              description="Try a different search or filter."
              className="rounded-2xl border border-dashed"
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  toggling={toggling === workflow.id}
                  onToggle={(w, enabled) => void toggle(w, enabled)}
                  onEdit={(w) => setBuilder({ open: true, workflow: w })}
                  onTest={setTestFor}
                  onHistory={setHistoryFor}
                  onDuplicate={(w) => void duplicate(w)}
                  onDelete={setDeleteFor}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-dashed bg-muted/30 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Workflows run once each call has ended. Steps run in order; if one fails, the steps after it are skipped and the run shows as
          failed in its history. Webhooks are signed with your workflow’s secret and retried up to 3 times when your endpoint is down.
          Google Workspace steps are in beta and need that Google service connected on the Integrations page.
        </p>
      </div>

      <WorkflowBuilder
        open={builder.open}
        workflow={builder.workflow}
        capabilities={capabilities}
        focus={builder.focus ?? null}
        onClose={() => setBuilder({ open: false, workflow: null })}
        onSaved={onSaved}
        onShowSecret={(workflow) => setBuilder({ open: true, workflow: stripSecret(workflow), focus: 'secret' })}
        onRefreshConnection={refreshConnection}
      />
      <RunHistorySheet workflow={historyFor} onClose={() => setHistoryFor(null)} />
      <TestRunDialog workflow={testFor} onClose={() => setTestFor(null)} />

      <Dialog open={deleteFor !== null} onOpenChange={(open) => !open && !deleting && setDeleteFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleteFor?.name}”?</DialogTitle>
            <DialogDescription>
              It stops running right away and its run history is deleted too. Calls and tags it already added stay as they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFor(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : null}
              {deleting ? 'Deleting…' : 'Delete workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

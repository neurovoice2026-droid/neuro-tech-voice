'use client'

import { useState } from 'react'
import { FlaskConical, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { TESTABLE_ACTION_TYPES, type WorkflowSummary, type WorkflowTestResult } from '@/lib/workflows/types'
import { ActionResultList } from './ActionResultList'
import { readApiError } from './api'

interface TestRunDialogProps {
  workflow: WorkflowSummary | null
  onClose: () => void
}

export function TestRunDialog({ workflow, onClose }: TestRunDialogProps) {
  return (
    <Dialog open={workflow !== null} onOpenChange={(open) => !open && onClose()}>
      {workflow ? <TestRunBody key={workflow.id} workflow={workflow} onClose={onClose} /> : null}
    </Dialog>
  )
}

function TestRunBody({ workflow, onClose }: { workflow: WorkflowSummary; onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<WorkflowTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const testable = workflow.actions.filter((action) => (TESTABLE_ACTION_TYPES as readonly string[]).includes(action.type)).length

  async function run(useSample: boolean) {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useSample ? { use_sample: true } : {}),
      })
      if (!res.ok) throw new Error(await readApiError(res, 'The test couldn’t run. Please try again.'))
      const data = (await res.json()) as WorkflowTestResult
      setResult(data)
      if (data.ok) toast.success('Test sent')
      else toast.error('A step failed during the test')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The test couldn’t run. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-purple-600" aria-hidden="true" /> Send a test
        </DialogTitle>
        <DialogDescription>
          Sends this workflow’s webhook and Slack steps now, marked as a test. Texts, emails, tags and Google steps never run in a test,
          and tests don’t count in the run history.
        </DialogDescription>
      </DialogHeader>

      {testable === 0 ? (
        <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          This workflow has no webhook or Slack steps, so there’s nothing a test can send. Its steps run for real on your next matching call.
        </p>
      ) : running ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Sending… a slow endpoint can take up to 45 seconds with retries.
          </p>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : result ? (
        <div className="space-y-3" aria-live="polite">
          <p className="text-xs text-muted-foreground">
            {result.source === 'latest_call'
              ? `Used your latest call${result.call_started_at ? ` from ${new Date(result.call_started_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}.`
              : 'You have no calls yet, so we used a sample call. Its details are made up and labelled as a sample.'}
          </p>
          <ActionResultList results={result.results} />
        </div>
      ) : error ? (
        <p className="text-xs text-destructive" role="alert">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          The test uses your most recent call, so your endpoint sees real data with <code className="font-mono">&quot;test&quot;: true</code>. Prefer made-up data? Send a sample instead.
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={running}>Close</Button>
        {testable > 0 ? (
          <>
            <Button type="button" variant="outline" onClick={() => void run(true)} disabled={running}>
              Send a sample
            </Button>
            <Button type="button" onClick={() => void run(false)} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Send />}
              {result || error ? 'Send again' : 'Send test'}
            </Button>
          </>
        ) : null}
      </DialogFooter>
    </DialogContent>
  )
}

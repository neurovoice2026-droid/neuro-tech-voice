'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { WorkflowWithSecret } from '@/lib/workflows/types'
import { readApiError } from './api'

/**
 * The workflow's webhook signing secret, for the owner to copy into the system
 * that receives the webhook. Loaded on demand and never kept in the list data.
 */
export function SigningSecretField({ workflowId }: { workflowId: string | null }) {
  const [secret, setSecret] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rotating, setRotating] = useState(false)

  const load = useCallback(async () => {
    if (!workflowId) return
    setState('loading')
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res))
      const data = (await res.json()) as WorkflowWithSecret
      setSecret(data.signing_secret)
      setState('idle')
    } catch {
      setState('error')
    }
  }, [workflowId])

  useEffect(() => {
    void load()
  }, [load])

  async function copy() {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Couldn’t copy. Reveal the secret and copy it by hand.')
    }
  }

  async function rotate() {
    if (!workflowId) return
    setRotating(true)
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotate_secret: true }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      const data = (await res.json()) as WorkflowWithSecret
      setSecret(data.signing_secret)
      setRevealed(true)
      setConfirmOpen(false)
      toast.success('New signing secret created', { description: 'Update it in the system that receives your webhook.' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We couldn’t create a new secret. Please try again.')
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs font-medium text-foreground">Signing secret</p>
      </div>

      {!workflowId ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Your secret is created when you save the workflow. Open the workflow again to copy it.
        </p>
      ) : state === 'loading' ? (
        <Skeleton className="h-8 w-full" />
      ) : state === 'error' ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          We couldn’t load the secret.
          <Button type="button" size="xs" variant="outline" onClick={() => void load()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-1.5">
            <code
              className="min-w-0 flex-1 truncate rounded-md border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
              aria-label={revealed ? 'Signing secret' : 'Signing secret, hidden'}
            >
              {secret ? (revealed ? secret : '•'.repeat(32)) : 'Not available'}
            </code>
            <Button type="button" size="icon-sm" variant="outline" onClick={() => setRevealed((v) => !v)} disabled={!secret} aria-label={revealed ? 'Hide secret' : 'Show secret'}>
              {revealed ? <EyeOff /> : <Eye />}
            </Button>
            <Button type="button" size="icon-sm" variant="outline" onClick={() => void copy()} disabled={!secret} aria-label="Copy secret">
              {copied ? <Check className="text-green-600" /> : <Copy />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Every request carries an <code className="font-mono">X-NTV-Signature</code> header made with this secret, so your system can check it came from us.
            </p>
            <Button type="button" size="xs" variant="ghost" onClick={() => setConfirmOpen(true)}>
              <RefreshCw /> New secret
            </Button>
          </div>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={(open) => !rotating && setConfirmOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new signing secret?</DialogTitle>
            <DialogDescription>
              The current secret stops working right away. Deliveries will fail signature checks until you paste the new secret into the system that receives this webhook.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={rotating}>Cancel</Button>
            <Button type="button" onClick={() => void rotate()} disabled={rotating}>
              {rotating ? <Loader2 className="animate-spin" /> : null}
              {rotating ? 'Creating…' : 'Create new secret'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

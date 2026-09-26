'use client'

import { useState } from 'react'
import { Loader2, LogIn, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { signOut } from '@/lib/auth/actions'
import { expectedDeletionConfirmation, isDeletionConfirmed } from '@/app/api/account/confirmation'
import { RequestError, errorMessage, requestJson } from '@/components/skills/request'

type Phase = 'confirm' | 'deleting' | 'reauth' | 'deleted' | 'incomplete'

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgName: string | null
}

export function DeleteAccountDialog({ open, onOpenChange, orgName }: DeleteAccountDialogProps) {
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState<Phase>('confirm')
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const expected = expectedDeletionConfirmation(orgName)
  const confirmed = isDeletionConfirmed(typed, orgName)

  const close = (next: boolean) => {
    if (phase === 'deleting' || phase === 'deleted' || phase === 'incomplete') return
    if (!next) {
      setTyped('')
      setError(null)
      setPhase('confirm')
    }
    onOpenChange(next)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!confirmed) return
    setPhase('deleting')
    setError(null)
    try {
      await requestJson('/api/account', { method: 'DELETE', body: { confirm: typed } })
      setPhase('deleted')
      window.setTimeout(() => window.location.assign('/'), 2500)
    } catch (err) {
      if (err instanceof RequestError && err.code === 'reauth_required') {
        setPhase('reauth')
        return
      }
      if (err instanceof RequestError && err.code === 'deletion_incomplete') {
        // Subscriptions and services are already stopped; retrying from here
        // can't help, support finishes the deletion.
        setError(err.message)
        setPhase('incomplete')
        return
      }
      setError(errorMessage(err, 'We couldn’t delete your account. Please try again.'))
      setPhase('confirm')
    }
  }

  const reauthenticate = async () => {
    setSigningOut(true)
    try {
      // The server action signs out and redirects to the login page.
      await signOut()
    } catch {
      if (phase === 'incomplete') {
        // The dialog can't be dismissed in this state; leave the dashboard instead.
        window.location.assign('/')
        return
      }
      setSigningOut(false)
      setError('We couldn’t sign you out. Please use Sign out in the menu.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" showCloseButton={phase === 'confirm' || phase === 'reauth'}>
        {phase === 'deleted' ? (
          <div className="space-y-2 py-2 text-center" role="status">
            <DialogTitle>Your account has been deleted</DialogTitle>
            <DialogDescription>Thank you for using Neuro Tech Voice. Taking you to the homepage…</DialogDescription>
          </div>
        ) : phase === 'incomplete' ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>We couldn’t finish deleting your account</DialogTitle>
              <DialogDescription>{error}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={reauthenticate} disabled={signingOut}>
                {signingOut && <Loader2 className="animate-spin" aria-hidden="true" />}
                Sign out
              </Button>
            </DialogFooter>
          </div>
        ) : phase === 'reauth' ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Please sign in again</DialogTitle>
              <DialogDescription>
                For your security, deleting an account needs a recent sign-in. Sign in again, come back to Settings, and delete
                your account within 30 minutes.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)} disabled={signingOut}>
                Cancel
              </Button>
              <Button onClick={reauthenticate} disabled={signingOut}>
                {signingOut ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
                Sign in again
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <TriangleAlert className="size-4" aria-hidden="true" />
                Delete your account
              </DialogTitle>
              <DialogDescription>This can’t be undone. When you confirm, we will:</DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>cancel your plan and phone number subscriptions,</li>
              <li>release your phone numbers, so they stop taking calls,</li>
              <li>delete your agent, cloned voices, documents, calls, recordings, messages and bookings,</li>
              <li>disconnect Google and remove your sign-in.</li>
            </ul>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm" className="block leading-normal break-words">
                Type <span className="font-semibold text-foreground">{expected}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                disabled={phase === 'deleting'}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'delete-error' : undefined}
              />
            </div>
            {error && (
              <p id="delete-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {phase === 'deleting' && (
              <p className="text-xs text-muted-foreground" role="status">
                Deleting everything. This can take a few minutes for a busy account; please keep this window open.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={phase === 'deleting'}>
                Keep my account
              </Button>
              <Button type="submit" variant="destructive" disabled={!confirmed || phase === 'deleting'}>
                {phase === 'deleting' && <Loader2 className="animate-spin" aria-hidden="true" />}
                {phase === 'deleting' ? 'Deleting…' : 'Delete account'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

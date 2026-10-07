'use client'

import { useId, useState, useTransition } from 'react'
import { AlertTriangle, Loader2, LogIn, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signOut } from '@/lib/auth/actions'
import {
  DELETED_ITEMS, RETAINED_ITEMS, expectedDeletionConfirmation, isDeletionConfirmed,
} from '@/lib/account/confirmation'

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessName: string | null
}

interface ApiErrorBody {
  error?: unknown
  details?: { reason?: unknown } | null
}

async function readError(res: Response): Promise<{ message: string; reason: string | null }> {
  const fallback = 'Your account could not be deleted. Please try again.'
  try {
    const body = (await res.json()) as ApiErrorBody
    return {
      message: typeof body.error === 'string' && body.error ? body.error : fallback,
      reason: typeof body.details?.reason === 'string' ? body.details.reason : null,
    }
  } catch (err) {
    // Not JSON (proxy error page, empty body): the generic message is all we have.
    if (err instanceof SyntaxError || err instanceof TypeError) return { message: fallback, reason: null }
    throw err
  }
}

export function DeleteAccountDialog({ open, onOpenChange, businessName }: DeleteAccountDialogProps) {
  const [typed, setTyped] = useState('')
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputId = useId()
  const hintId = useId()
  const expected = expectedDeletionConfirmation(businessName)
  const confirmed = isDeletionConfirmed(typed, businessName)

  function close(next: boolean) {
    if (isPending) return
    if (!next) {
      setTyped('')
      setNeedsSignIn(false)
    }
    onOpenChange(next)
  }

  function handleDelete() {
    if (!confirmed) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/account', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ confirm: typed }),
        })
        if (res.status === 202) {
          // A toast would not survive the full-page redirect: the login page
          // explains it (?account_deleted=1).
          window.location.assign('/login?account_deleted=1')
          return
        }
        const { message, reason } = await readError(res)
        if (reason === 'reauth_required') {
          setNeedsSignIn(true)
          return
        }
        toast.error('Your account was not deleted', { description: message })
      } catch (err) {
        toast.error('Your account was not deleted', {
          description: err instanceof Error && err.message ? err.message : 'Please check your connection and try again.',
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-red-100 p-1.5">
              <Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" />
            </div>
            Delete your account?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes your account and its data, here and at every provider we use. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section aria-labelledby={`${hintId}-deleted`}>
            <h3 id={`${hintId}-deleted`} className="mb-1.5 font-semibold text-foreground">What is deleted</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {DELETED_ITEMS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
          <section aria-labelledby={`${hintId}-kept`}>
            <h3 id={`${hintId}-kept`} className="mb-1.5 font-semibold text-foreground">What we must keep by law</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {RETAINED_ITEMS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          {needsSignIn ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <div className="space-y-2">
                <p>For your security, sign in again, then come back to Settings and delete your account within 30 minutes.</p>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void signOut()}>
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign in again
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={inputId}>
                Type <span className="font-semibold text-foreground">{expected}</span> to confirm
              </Label>
              <Input
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                aria-describedby={`${hintId}-hint`}
                aria-invalid={typed.length > 0 && !confirmed}
                disabled={isPending}
              />
              <p id={`${hintId}-hint`} className="text-xs text-muted-foreground">
                {businessName?.trim() ? 'Your business name, exactly as shown.' : 'Type DELETE in capital letters.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => close(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={!confirmed || isPending || needsSignIn}
          >
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Deleting…</>
            ) : (
              'Delete my account'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

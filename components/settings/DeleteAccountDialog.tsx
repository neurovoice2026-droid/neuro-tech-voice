'use client'

import { useId, useState, useTransition } from 'react'
import { AlertTriangle, LogIn, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Field } from '@/components/shared/FormSection'
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

function ItemList({ id, title, items }: { id: string; title: string; items: readonly string[] }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </h3>
      <ul className="mt-2.5 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[13px] leading-[19px] text-foreground/80">
            <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#8c86a0]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <span
            aria-hidden="true"
            className="mb-2 grid size-10 place-items-center rounded-full bg-destructive-soft text-destructive"
          >
            <Trash2 className="size-[18px]" />
          </span>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your account and its data, here and at every provider we use. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-5 rounded-2xl bg-secondary p-4 sm:p-5">
            <ItemList id={`${hintId}-deleted`} title="What is deleted" items={DELETED_ITEMS} />
            <div aria-hidden="true" className="h-px bg-[#e2e0e8]" />
            <ItemList id={`${hintId}-kept`} title="What we must keep by law" items={RETAINED_ITEMS} />
          </div>

          {needsSignIn ? (
            <Alert variant="warning">
              <AlertTriangle aria-hidden="true" />
              <AlertDescription className="text-foreground/80">
                For your security, sign in again, then come back to Settings and delete your account within 30 minutes.
              </AlertDescription>
              <AlertAction>
                <Button type="button" size="sm" variant="outline" onClick={() => void signOut()}>
                  <LogIn aria-hidden="true" />
                  Sign in again
                </Button>
              </AlertAction>
            </Alert>
          ) : (
            <Field
              htmlFor={inputId}
              label={<span>Type <span className="font-semibold">{expected}</span> to confirm</span>}
              hint={businessName?.trim() ? 'Your business name, exactly as shown.' : 'Type DELETE in capital letters.'}
            >
              <Input
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                aria-invalid={typed.length > 0 && !confirmed}
                disabled={isPending}
              />
            </Field>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive-solid"
            onClick={handleDelete}
            disabled={!confirmed || needsSignIn}
            loading={isPending}
            loadingText="Deleting…"
          >
            Delete my account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

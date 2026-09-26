'use client'

import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'
import { formatPhoneNumber } from '@/lib/utils'
import type { PhoneNumberView } from '@/lib/twilio/types'
import { errorMessage, phoneApi } from './api'

interface ReleaseNumberDialogProps {
  number: PhoneNumberView | null
  onClose: () => void
  onReleased: (id: string) => void
}

export function ReleaseNumberDialog({ number, onClose, onReleased }: ReleaseNumberDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const readable = number ? formatPhoneNumber(number.number) : ''

  function handleOpenChange(open: boolean) {
    if (open || pending) return
    setError(null)
    onClose()
  }

  async function release() {
    if (!number) return
    setPending(true)
    setError(null)
    try {
      const result = await phoneApi<{ success: true; billing_warning: string | null }>(`/api/phone/${number.id}`, {
        method: 'DELETE',
      })
      toast.success(`${readable} was released`)
      if (result.billing_warning) toast.warning(result.billing_warning, { duration: 12_000 })
      onReleased(number.id)
      setPending(false)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <Dialog open={number !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Release {readable}?</DialogTitle>
          <DialogDescription>This gives the number back to the phone provider.</DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Your agent stops answering calls to this number right away, and texts can no longer be sent from it.</li>
          <li>The ${PHONE_NUMBER_MONTHLY_PRICE_USD}/month charge for this number stops.</li>
          <li>A released number usually can’t be recovered, so you may not get it back later.</li>
          <li>Your call history stays in your dashboard.</li>
        </ul>

        {error && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Keep number
          </Button>
          <Button variant="destructive" onClick={release} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {pending ? 'Releasing…' : 'Release number'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

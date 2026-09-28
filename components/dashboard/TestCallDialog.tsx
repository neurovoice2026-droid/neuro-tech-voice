'use client'

import Link from 'next/link'
import { AudioLines, Copy, CheckCheck, Phone } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TestCallPanel } from '@/components/voice/TestCallPanel'
import { formatPhoneNumber } from '@/lib/utils'

interface TestCallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  phoneNumber: string | null
  agentName: string
}

export function TestCallDialog({ open, onOpenChange, phoneNumber, agentName }: TestCallDialogProps) {
  const [copied, setCopied] = useState(false)
  const [callActive, setCallActive] = useState(false)

  function copy() {
    if (!phoneNumber) return
    navigator.clipboard
      .writeText(phoneNumber)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch((error: unknown) => {
        console.warn('[test-call] copying the number failed', error)
        toast.error('Couldn’t copy the number. Select it and copy it instead.')
      })
  }

  function handleOpenChange(next: boolean) {
    // Closing ends a live call (the panel hangs up when it unmounts).
    if (!next) setCallActive(false)
    onOpenChange(next)
  }

  return (
    // A stray click outside shouldn't cut a live call; Escape and the close button still work.
    <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal={callActive}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 p-1.5" aria-hidden="true">
              <AudioLines className="h-4 w-4 text-purple-600" />
            </span>
            Test your agent
          </DialogTitle>
          <DialogDescription>Hear exactly what your callers will hear, before they do.</DialogDescription>
        </DialogHeader>

        {open && (
          <TestCallPanel
            agentName={agentName}
            hasPhoneNumber={phoneNumber !== null}
            onActiveChange={setCallActive}
            className="border-0 p-0 sm:p-0"
          />
        )}

        <div className="border-t pt-4">
          {phoneNumber ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Or call your number from any phone</p>
              <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-primary/20 bg-purple-50 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 font-mono text-base font-bold text-foreground sm:text-lg">
                  <Phone className="h-4 w-4 shrink-0 text-purple-600" aria-hidden="true" />
                  <span className="truncate">{formatPhoneNumber(phoneNumber)}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={copy} className="h-8 shrink-0 gap-1.5">
                  {copied ? (
                    <><CheckCheck className="h-4 w-4 text-green-600" aria-hidden="true" /> Copied</>
                  ) : (
                    <><Copy className="h-4 w-4" aria-hidden="true" /> Copy</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Calls to your number are real calls: they show up in Calls and count toward your plan minutes.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              To take real calls, {agentName} needs a phone number.{' '}
              <Link href="/phone" className="font-medium text-primary underline-offset-4 hover:underline">
                Get a number
              </Link>{' '}
              in a few seconds.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

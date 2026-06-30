'use client'

import { Phone, Copy, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatPhoneNumber } from '@/lib/utils'

interface TestCallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  phoneNumber: string | null
  agentName: string
}

export function TestCallDialog({ open, onOpenChange, phoneNumber, agentName }: TestCallDialogProps) {
  const [copied, setCopied] = useState(false)

  function copy() {
    if (!phoneNumber) return
    navigator.clipboard.writeText(phoneNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-purple-100 p-1.5">
              <Phone className="h-4 w-4 text-purple-600" />
            </div>
            Test Your Agent
          </DialogTitle>
          <DialogDescription>
            Call the number below to speak with <strong>{agentName}</strong> directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {phoneNumber ? (
            <>
              <div className="flex items-center justify-between rounded-xl border-2 border-primary/20 bg-purple-50 px-5 py-4">
                <span className="font-mono text-xl font-bold text-foreground">
                  {formatPhoneNumber(phoneNumber)}
                </span>
                <Button size="sm" variant="ghost" onClick={copy} className="gap-1.5">
                  {copied ? (
                    <><CheckCheck className="h-4 w-4 text-green-500" /> Copied</>
                  ) : (
                    <><Copy className="h-4 w-4" /> Copy</>
                  )}
                </Button>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">1.</span>
                  Call the number from any phone
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">2.</span>
                  Speak naturally — the agent will respond
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">3.</span>
                  The call will appear in your Recent Calls list
                </li>
              </ul>
            </>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              No phone number assigned yet. Add one from the{' '}
              <a href="/phone" className="underline font-medium">Phone Numbers</a> page.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

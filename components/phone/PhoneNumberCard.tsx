'use client'

import { useState } from 'react'
import {
  AlertTriangle, Bot, CheckCircle2, Copy, Loader2, MessageSquare, Phone, PhoneOff, RefreshCw, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { FlagIcon } from '@/components/shared/FlagIcon'
import { cn, formatPhoneNumber } from '@/lib/utils'
import type { PhoneNumberView } from '@/lib/twilio/types'

interface PhoneNumberCardProps {
  number: PhoneNumberView
  toggling: boolean
  reconnecting: boolean
  /** A voice pipeline is configured, so the number can be moved to the app router. */
  canReconnect: boolean
  onToggle: (number: PhoneNumberView, active: boolean) => void
  onReconnect: (number: PhoneNumberView) => void
  onRelease: (number: PhoneNumberView) => void
}

export function PhoneNumberCard({ number: n, toggling, reconnecting, canReconnect, onToggle, onReconnect, onRelease }: PhoneNumberCardProps) {
  const [copied, setCopied] = useState(false)
  const connected = n.routing_status === 'connected'
  const readable = formatPhoneNumber(n.number)
  const switchId = `number-active-${n.id}`

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(n.number)
      setCopied(true)
      toast.success('Number copied')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Couldn’t copy the number. Please copy it by hand.')
    }
  }

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              n.is_active ? 'bg-green-50' : 'bg-muted'
            )}
            aria-hidden="true"
          >
            {n.is_active ? <Phone className="size-4 text-green-600" /> : <PhoneOff className="size-4 text-muted-foreground" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {n.country && <FlagIcon country={n.country} />}
              <p className="font-mono text-sm font-semibold break-all text-foreground">{readable}</p>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={copyNumber}
                aria-label={`Copy ${readable}`}
                title="Copy number"
              >
                {copied ? <CheckCircle2 className="text-green-600" /> : <Copy />}
              </Button>
            </div>

            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {!n.is_active ? 'Not answered while paused' : n.agent_name ? `Answered by ${n.agent_name}` : 'Answered by your AI agent'}
              </span>
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {connected ? (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  <CheckCircle2 aria-hidden="true" />
                  Connected to Neuro Tech Voice
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  <AlertTriangle aria-hidden="true" />
                  Needs reconnect
                </Badge>
              )}
              {n.sms_capable ? (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  <MessageSquare aria-hidden="true" />
                  Calls and texts
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground" title="This number can’t send text messages, so confirmations by text are off.">
                  Calls only
                </Badge>
              )}
              {!n.is_active && (
                <Badge variant="outline" className="text-muted-foreground">
                  Paused
                </Badge>
              )}
            </div>

            {!connected && (
              <p className="mt-2 text-xs text-amber-800">
                {n.routing_error ??
                  (n.legacy_import
                    ? 'This number still runs on the previous voice setup, so your latest agent settings don’t apply to its calls yet. Reconnect it to move it over.'
                    : 'Calls to this number aren’t reaching your agent yet. Reconnect it to fix this.')}
              </p>
            )}
            {!n.is_active && connected && (
              <p className="mt-2 text-xs text-muted-foreground">
                Paused: callers hear a short “we can’t take your call” message and the call is logged as missed.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 sm:shrink-0 sm:justify-end sm:border-t-0 sm:pt-0">
          {!connected && canReconnect && (
            <Button variant="outline" size="sm" onClick={() => onReconnect(n)} disabled={reconnecting} aria-busy={reconnecting}>
              {reconnecting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {reconnecting ? 'Reconnecting…' : 'Reconnect'}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id={switchId}
              checked={n.is_active}
              disabled={toggling}
              onCheckedChange={(checked) => onToggle(n, checked)}
              aria-label={n.is_active ? `Pause ${readable}` : `Resume ${readable}`}
            />
            <label htmlFor={switchId} className="w-14 text-xs text-muted-foreground">
              {toggling ? 'Saving…' : n.is_active ? 'Active' : 'Paused'}
            </label>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onRelease(n)}
            aria-label={`Release ${readable}`}
            title="Release number"
          >
            <Trash2 className="text-red-500" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  )
}

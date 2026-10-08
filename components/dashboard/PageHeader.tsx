'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { LiveDot } from '@/components/shared/LiveDot'
import { OrbInline } from '@/components/shared/OrbLoader'
import { PageHeader as SharedPageHeader } from '@/components/shared/PageHeader'
import { StatusChip } from '@/components/shared/StatusChip'
import { errorMessage, parseApiError } from '@/hooks/useVoiceCatalog'
import type { AgentPatchResponse } from '@/hooks/useAgent'
import type { Agent, Organization } from '@/types'

interface PageHeaderProps {
  org: Organization
  agent: Agent | null
  /** False when the org has no active number: an active agent then reads "No number", not "Live". */
  hasPhoneNumber?: boolean
  onAgentToggle?: (active: boolean) => void
}

/**
 * Hour and "Thursday, 8 October" for now, in the org's time zone when it has
 * one (the same on the server and in the browser), else in the local zone.
 */
function nowParts(timeZone: string | undefined): { hour: number; date: string } {
  const now = new Date()
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now)
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
    return { hour: Number(part('hour')), date: `${part('weekday')}, ${part('day')} ${part('month')}` }
  } catch (err) {
    // Unknown zone name: fall back to the browser's own zone.
    console.warn('Invalid organization time zone', timeZone, err)
    return {
      hour: now.getHours(),
      date: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).replace(' ', ', '),
    }
  }
}

export function PageHeader({ org, agent, hasPhoneNumber = true, onAgentToggle }: PageHeaderProps) {
  const [isActive, setIsActive] = useState(agent?.is_active ?? false)
  const [isPending, startTransition] = useTransition()

  const { hour, date } = nowParts(org.timezone || undefined)
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = org.name ?? 'there'

  function handleToggle(checked: boolean) {
    setIsActive(checked)
    // Everything is caught here: a rejection inside the transition would reach
    // the error boundary and replace the whole dashboard.
    startTransition(async () => {
      try {
        const res = await fetch('/api/agent/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ is_active: checked }),
        })
        if (!res.ok) throw await parseApiError(res, 'Failed to update the agent status.')
        const json = (await res.json()) as Partial<AgentPatchResponse>
        // The server's row is the truth (a 200 means the update was written).
        const active = typeof json.agent?.is_active === 'boolean' ? json.agent.is_active : checked
        setIsActive(active)
        onAgentToggle?.(active)

        const problem = json.sync?.find((s) => s.status === 'failed' || s.status === 'degraded')
        if (problem) {
          toast.warning('The voice provider was not updated', {
            description: `${problem.error ?? 'The provider did not confirm the change.'} Open the Agent page to retry.`,
            duration: 10_000,
          })
        }
      } catch (err) {
        setIsActive(!checked)
        toast.error('Could not change the agent status', { description: errorMessage(err, 'Please try again.') })
      }
    })
  }

  return (
    <SharedPageHeader
      eyebrow={<span suppressHydrationWarning>{date}</span>}
      title={<span suppressHydrationWarning>{greeting}, {name}</span>}
      description="Here is what your agent has handled today."
      actions={
        agent && (
          <div className="flex max-w-full items-center gap-2 rounded-full bg-white py-1.5 pr-2 pl-2 shadow-pill">
            {/* Fixed 20 px slot: the orb takes the dot's place while the toggle saves, so the pill keeps its width. */}
            <span className="grid size-5 shrink-0 place-items-center">
              {isPending ? (
                <OrbInline state="working" />
              ) : (
                // Static dot: the pinging dot is kept for calls in progress.
                <LiveDot active={false} tone={!isActive ? 'idle' : hasPhoneNumber ? 'success' : 'warning'} />
              )}
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{agent.name}</span>
            {/* One grid cell holds an invisible "Paused" chip as a sizer, so switching between
                Live and Paused does not change the pill's width (its left edge stays put). */}
            <span className="grid">
              <StatusChip tone="muted" aria-hidden="true" className="invisible col-start-1 row-start-1">
                Paused
              </StatusChip>
              <span aria-live="polite" className="col-start-1 row-start-1 flex">
                {!isActive ? (
                  <StatusChip tone="muted">Paused</StatusChip>
                ) : hasPhoneNumber ? (
                  <StatusChip tone="success">Live</StatusChip>
                ) : (
                  <StatusChip tone="warning" title="Active, but it has no phone number to answer on">
                    No number
                  </StatusChip>
                )}
                {isPending && <span className="sr-only">Updating…</span>}
              </span>
            </span>
            <Switch
              checked={isActive}
              onCheckedChange={handleToggle}
              disabled={isPending}
              aria-label="Toggle agent"
            />
          </div>
        )
      }
    />
  )
}

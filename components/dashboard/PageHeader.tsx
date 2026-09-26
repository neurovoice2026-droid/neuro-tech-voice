'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { LiveDot } from '@/components/shared/LiveDot'
import { ProviderSyncChip } from '@/components/agent/ProviderSyncStatus'
import { describeAgentStatus } from '@/components/agent/agent-health'
import type { Agent, Organization } from '@/types'

interface PageHeaderProps {
  org: Organization
  agent: Agent | null
  onAgentToggle?: (active: boolean) => void
}

function greetingFor(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export function PageHeader({ org, agent, onAgentToggle }: PageHeaderProps) {
  const [isActive, setIsActive] = useState(agent?.is_active ?? false)
  const [pending, setPending] = useState(false)
  // Follow the agent when the dashboard reloads it (derived state).
  const [trackedActive, setTrackedActive] = useState(agent?.is_active ?? false)
  if (agent && agent.is_active !== trackedActive) {
    setTrackedActive(agent.is_active)
    setIsActive(agent.is_active)
  }

  const greeting = greetingFor(new Date().getHours())
  const name = org.name ?? 'there'
  const status = agent ? describeAgentStatus({ ...agent, is_active: isActive }) : null

  async function handleToggle(checked: boolean) {
    setIsActive(checked)
    setPending(true)
    try {
      const res = await fetch('/api/agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: checked }),
      })
      if (!res.ok) throw new Error(String(res.status))
      onAgentToggle?.(checked)
      toast.success(checked ? 'Your agent is answering calls again' : 'Your agent is paused and won’t answer calls')
    } catch {
      setIsActive(!checked)
      toast.error('We couldn’t change your agent’s status. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground" suppressHydrationWarning>
          {greeting}, {name}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your AI voice agent today.</p>
      </div>

      {agent && status && (
        <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card px-4 py-2.5 shadow-sm sm:w-auto sm:max-w-sm sm:shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <LiveDot active={isActive} />
            <div className="min-w-0 flex-1">
              <Link href="/agent" className="block truncate text-sm font-medium text-foreground hover:underline">
                {agent.name}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{status.statusLabel}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                disabled={pending}
                aria-label={isActive ? 'Pause your agent' : 'Turn your agent on'}
              />
            </div>
          </div>
          {isActive && (
            <div className="flex flex-wrap items-center gap-2">
              <ProviderSyncChip providerSync={agent.provider_sync} />
              {status.sync.state === 'attention' && (
                <Link href="/agent" className="text-xs text-primary underline-offset-4 hover:underline">
                  Review
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

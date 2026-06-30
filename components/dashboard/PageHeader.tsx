'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { LiveDot } from '@/components/shared/LiveDot'
import type { Agent, Organization } from '@/types'

interface PageHeaderProps {
  org: Organization
  agent: Agent | null
  onAgentToggle?: (active: boolean) => void
}

export function PageHeader({ org, agent, onAgentToggle }: PageHeaderProps) {
  const [isActive, setIsActive] = useState(agent?.is_active ?? false)
  const [, startTransition] = useTransition()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = org.name ?? 'there'

  function handleToggle(checked: boolean) {
    setIsActive(checked)
    startTransition(async () => {
      await fetch('/api/agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: checked }),
      })
      onAgentToggle?.(checked)
    })
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}, {name} 👋
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your AI voice agent today.
        </p>
      </div>

      {agent && (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-sm">
          <LiveDot active={isActive} />
          <span className="text-sm font-medium text-foreground">{agent.name}</span>
          <Badge
            variant="outline"
            className={isActive
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-gray-200 bg-gray-50 text-gray-500'}
          >
            {isActive ? 'Active' : 'Paused'}
          </Badge>
          <Switch
            checked={isActive}
            onCheckedChange={handleToggle}
            aria-label="Toggle agent"
          />
        </div>
      )}
    </div>
  )
}

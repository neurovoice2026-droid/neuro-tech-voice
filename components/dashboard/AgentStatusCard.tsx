'use client'

import Link from 'next/link'
import { AlertTriangle, Bot, Mic, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LiveDot } from '@/components/shared/LiveDot'
import { StatusPill, backupStatusCopy, providerStatusCopy } from '@/components/agent/ProviderStatusCard'
import { PROVIDER_LABEL, providerProblem, useAgentStatus } from '@/hooks/useAgentStatus'
import type { Agent } from '@/types'

interface AgentStatusCardProps {
  agent: Agent | null
}

export function AgentStatusCard({ agent }: AgentStatusCardProps) {
  if (!agent) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Agent Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No agent configured.</p>
        </CardContent>
      </Card>
    )
  }
  return <AgentStatusDetails agent={agent} />
}

function AgentStatusDetails({ agent }: { agent: Agent }) {
  const { status, isLoading, error } = useAgentStatus()
  const isLive = agent.is_active
  const primary = status?.providers.find((p) => p.role === 'primary')
  const backup = status?.providers.find((p) => p.role === 'fallback')
  const problem = providerProblem(status)
  const routingProblem = status?.numbers.some((n) => n.routing_status === 'failed')

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Agent Status</CardTitle>
          <Link
            href="/agent"
            className="rounded-md p-1.5 hover:bg-muted transition-colors text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Agent settings"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
            <Bot className="h-5 w-5 text-purple-600" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-foreground">{agent.name}</p>
            {agent.voice_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mic className="h-3 w-3" aria-hidden="true" /> {agent.voice_name}
              </p>
            )}
          </div>
          <div className="ml-auto" aria-label={isLive ? 'Agent is live' : 'Agent is paused'} role="img">
            <LiveDot active={isLive} />
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={agent.is_active
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-gray-200 bg-gray-50 text-gray-500'}
          >
            {agent.is_active ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        {/* Voice providers */}
        <div className="space-y-2 rounded-lg border px-3 py-2.5">
          {isLoading && !status ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading provider status">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : status ? (
            <dl className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Primary · {PROVIDER_LABEL[primary?.provider ?? 'elevenlabs']}</dt>
                <dd>{primary ? <StatusPill copy={providerStatusCopy(primary.status, primary.last_synced_at)} /> : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Backup · {PROVIDER_LABEL[backup?.provider ?? 'cartesia']}</dt>
                <dd><StatusPill copy={backupStatusCopy(status)} /></dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">{error ?? 'Provider status unavailable.'}</p>
          )}
          {(problem || routingProblem) && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {problem ? `${PROVIDER_LABEL[problem.provider]} is not up to date.` : 'A phone number is not routed correctly.'}{' '}
                <Link href={problem ? '/agent' : '/phone'} className="underline underline-offset-2">Review</Link>
              </span>
            </p>
          )}
        </div>

        {/* Prompt preview */}
        {agent.system_prompt && (
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground line-clamp-3">
              {agent.system_prompt}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

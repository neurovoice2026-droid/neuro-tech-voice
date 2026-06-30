'use client'

import { Bot, Mic, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LiveDot } from '@/components/shared/LiveDot'
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

  const isLive = agent.is_active

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Agent Status</CardTitle>
          <a
            href="/agent"
            className="rounded-md p-1.5 hover:bg-muted transition-colors text-muted-foreground"
          >
            <Settings className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
            <Bot className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-foreground">{agent.name}</p>
            {agent.voice_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mic className="h-3 w-3" /> {agent.voice_name}
              </p>
            )}
          </div>
          <div className="ml-auto">
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

'use client'

import Link from 'next/link'
import { Bot, Globe2, Mic, Settings, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LiveDot } from '@/components/shared/LiveDot'
import { ProviderSyncChip } from '@/components/agent/ProviderSyncStatus'
import { describeAgentStatus } from '@/components/agent/agent-health'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { TONE_PROFILES, normalizeTone } from '@/lib/voice/tone'
import { cn } from '@/lib/utils'
import type { Agent } from '@/types'

interface AgentStatusCardProps {
  agent: Agent | null
}

export function AgentStatusCard({ agent }: AgentStatusCardProps) {
  if (!agent) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Agent status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Your agent isn’t set up yet.</p>
          <Link href="/agent" className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline">
            Set up your agent
          </Link>
        </CardContent>
      </Card>
    )
  }

  const status = describeAgentStatus(agent)
  const voice = agent.cartesia_voice_name ?? agent.voice_name
  const language = AGENT_LANGUAGES.find((l) => l.value === agent.language)?.label ?? agent.language
  const tone = TONE_PROFILES[normalizeTone(agent.tone)].label

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Agent status</CardTitle>
          <Link
            href="/agent"
            className="relative rounded-md p-1.5 text-muted-foreground transition-colors after:absolute after:-inset-1.5 hover:bg-muted"
            aria-label="Agent settings"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{agent.name}</p>
            <p className={cn('text-xs', status.answering ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground')}>
              {status.statusLabel}
            </p>
          </div>
          <div className="ml-auto">
            <LiveDot active={status.answering} />
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
          {voice && (
            <div className="flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              <dt className="sr-only">Voice</dt>
              <dd className="truncate">{voice}</dd>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">Language</dt>
            <dd>{language}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">Tone</dt>
            <dd>{tone} tone</dd>
          </div>
        </dl>

        <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2">
          <ProviderSyncChip providerSync={agent.provider_sync} />
          <p className="text-xs text-muted-foreground">{status.answering ? status.sync.detail : status.statusDetail}</p>
        </div>
      </CardContent>
    </Card>
  )
}

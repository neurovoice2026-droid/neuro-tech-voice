'use client'

import Link from 'next/link'
import { AlertTriangle, Bot, Mic, Settings } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import { StatusPill, backupStatusCopy, providerStatusCopy } from '@/components/agent/ProviderStatusCard'
import { PROVIDER_LABEL, providerProblem, useAgentStatus } from '@/hooks/useAgentStatus'
import { cn, formatPhoneNumber } from '@/lib/utils'
import type { Agent } from '@/types'
import { CardError } from './CardError'

interface AgentStatusCardProps {
  agent: Agent | null
  /** False when the org has no active number: an active agent is then "No number", not "Live". */
  hasPhoneNumber?: boolean
}

function SettingsLink() {
  return (
    <Link
      href="/agent"
      className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'tap-44 -my-1 -mr-2 text-muted-foreground')}
      aria-label="Agent settings"
    >
      <Settings aria-hidden="true" />
    </Link>
  )
}

export function AgentStatusCard({ agent, hasPhoneNumber = true }: AgentStatusCardProps) {
  if (!agent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">No agent configured.</p>
        </CardContent>
      </Card>
    )
  }
  return <AgentStatusDetails agent={agent} hasPhoneNumber={hasPhoneNumber} />
}

/** "en" → "English" (falls back to the code). */
function languageName(code: string | null | undefined): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code.toUpperCase()
  } catch (err) {
    console.warn('Unknown language code', code, err)
    return code.toUpperCase()
  }
}

/** One label/value line of the status list (hairline between rows). */
function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-rule px-5 py-2 last:border-b-0">
      <dt className="min-w-0 truncate text-[13px] text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 shrink-0 items-center justify-end text-[13px] text-foreground">{children}</dd>
    </div>
  )
}

function AgentStatusDetails({ agent, hasPhoneNumber }: { agent: Agent; hasPhoneNumber: boolean }) {
  const { status, isLoading, error, refetch } = useAgentStatus()
  const isLive = agent.is_active && hasPhoneNumber
  const primary = status?.providers.find((p) => p.role === 'primary')
  const backup = status?.providers.find((p) => p.role === 'fallback')
  const problem = providerProblem(status)
  const routingProblem = status?.numbers.some((n) => n.routing_status === 'failed')
  const language = languageName(agent.language)
  const numbers = status?.numbers ?? []

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Agent status</CardTitle>
        <CardAction className="self-center">
          <SettingsLink />
        </CardAction>
      </CardHeader>

      {/* Agent identity */}
      <div className="flex items-center gap-3 border-t border-rule px-5 py-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
          <Bot className="size-[18px] text-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-[22px] font-medium text-foreground">{agent.name}</p>
          {agent.voice_name && (
            <p className="flex items-center gap-1 truncate text-xs leading-4 text-muted-foreground">
              <Mic className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{agent.voice_name}</span>
            </p>
          )}
        </div>
        {/* Static dot: the pinging dot is kept for calls in progress. */}
        {isLive ? (
          <StatusChip tone="success" dot>
            <span className="sr-only">Agent is </span>Live
          </StatusChip>
        ) : agent.is_active ? (
          <StatusChip tone="warning" dot title="Active, but it has no phone number to answer on">
            <span className="sr-only">Agent has </span>No number
          </StatusChip>
        ) : (
          <StatusChip tone="muted" dot>
            <span className="sr-only">Agent is </span>Paused
          </StatusChip>
        )}
      </div>

      {/* Status list */}
      {isLoading && !status ? (
        <OrbLoader
          size={32}
          layout="row"
          label="Loading provider status…"
          // Reserves the rows it replaces (44 px each).
          className={cn('border-t border-rule px-5', language ? 'min-h-[176px]' : 'min-h-[132px]')}
        />
      ) : status ? (
        <dl className="border-t border-rule">
          {language && <Row label="Language">{language}</Row>}
          <Row label="Phone">
            {numbers.length === 0 ? (
              <Link href="/phone" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
                Add a number
              </Link>
            ) : (
              <span className="tabular-nums">
                {formatPhoneNumber(numbers[0].number)}
                {numbers.length > 1 && <span className="text-muted-foreground"> · {numbers.length} numbers</span>}
              </span>
            )}
          </Row>
          <Row label={`Primary · ${PROVIDER_LABEL[primary?.provider ?? 'elevenlabs']}`}>
            {primary ? <StatusPill copy={providerStatusCopy(primary.status, primary.last_synced_at)} /> : '—'}
          </Row>
          <Row label={`Backup · ${PROVIDER_LABEL[backup?.provider ?? 'cartesia']}`}>
            <StatusPill copy={backupStatusCopy(status)} />
          </Row>
        </dl>
      ) : (
        <>
          {language && (
            <dl className="border-t border-rule">
              <Row label="Language">{language}</Row>
            </dl>
          )}
          <CardError
            message="Provider status could not be loaded."
            detail={error}
            onRetry={() => void refetch()}
            className="border-t border-rule"
          />
        </>
      )}

      {(problem || routingProblem) && (
        <p className="flex items-start gap-2 border-t border-rule bg-warning-soft px-5 py-3 text-[13px] leading-[19px] text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {problem ? `${PROVIDER_LABEL[problem.provider]} is not up to date.` : 'A phone number is not routed correctly.'}{' '}
            <Link href={problem ? '/agent' : '/phone'} className="font-medium underline underline-offset-2">Review</Link>
          </span>
        </p>
      )}

      {/* Prompt preview */}
      {agent.system_prompt && (
        <div className="border-t border-rule px-5 py-4">
          <div className="rounded-xl bg-secondary px-3 py-2.5">
            <p className="line-clamp-3 text-xs leading-[18px] text-muted-foreground">{agent.system_prompt}</p>
          </div>
        </div>
      )}
    </Card>
  )
}

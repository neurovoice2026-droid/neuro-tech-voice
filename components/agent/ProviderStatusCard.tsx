'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircle, AlertTriangle, CheckCircle2, CircleSlash, Clock, Loader2, Phone, RotateCw, ShieldCheck, Volume2,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { VOICE_SYNC_COPY, VoiceSyncBadge } from '@/components/voice/VoiceSyncBadge'
import { PROVIDER_LABEL } from '@/hooks/useAgentStatus'
import { cn, formatPhoneNumber } from '@/lib/utils'
import type { AgentStatusView, ProviderResourceStatus, ProviderResourceView } from '@/types'

type Tone = 'ok' | 'busy' | 'warn' | 'error' | 'muted'

export interface StatusCopy {
  label: string
  tone: Tone
  description: string
}

const PRIMARY_COPY: Record<ProviderResourceView['status'], StatusCopy> = {
  ready: { label: 'Ready', tone: 'ok', description: 'Your latest settings are live.' },
  pending: { label: 'Syncing', tone: 'busy', description: 'Applying your latest settings.' },
  failed: { label: 'Failed', tone: 'error', description: 'The voice agent could not be set up. Calls cannot be answered by it yet.' },
  degraded: { label: 'Degraded', tone: 'warn', description: 'Calls are answered, but with your previous settings.' },
  not_configured: { label: 'Not configured', tone: 'muted', description: 'This provider is not available on the platform.' },
  disabled: { label: 'Disabled', tone: 'muted', description: 'This provider is turned off for your agent.' },
}

const ROUTING_COPY: Record<ProviderResourceStatus, StatusCopy> = {
  ready: { label: 'Ready', tone: 'ok', description: 'Calls to this number reach your agent.' },
  pending: { label: 'Connecting', tone: 'busy', description: 'Routing is being applied.' },
  failed: { label: 'Failed', tone: 'error', description: 'Routing could not be applied.' },
  degraded: { label: 'Partly applied', tone: 'warn', description: 'Calls are answered, but part of the routing is missing.' },
}

export const ROUTING_MODE_SHORT: Record<'app_routed' | 'native_elevenlabs', string> = {
  app_routed: 'Smart routing with failover',
  native_elevenlabs: 'Direct ElevenLabs',
}

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400',
  busy: '',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: '',
  muted: 'text-muted-foreground',
}

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === 'ok') return <CheckCircle2 aria-hidden="true" />
  if (tone === 'busy') return <Loader2 className="animate-spin" aria-hidden="true" />
  if (tone === 'warn') return <AlertTriangle aria-hidden="true" />
  if (tone === 'error') return <AlertCircle aria-hidden="true" />
  return <CircleSlash aria-hidden="true" />
}

export function StatusPill({ copy, className }: { copy: StatusCopy; className?: string }) {
  const variant = copy.tone === 'error' ? 'destructive' : copy.tone === 'busy' ? 'secondary' : 'outline'
  return (
    <Badge variant={variant} title={copy.description} className={cn(TONE_CLASS[copy.tone], className)}>
      <ToneIcon tone={copy.tone} />
      {copy.label}
    </Badge>
  )
}

/** Copy for a provider's sync status (primary agent, or the backup's own sync state). */
export function providerStatusCopy(status: ProviderResourceView['status']): StatusCopy {
  return PRIMARY_COPY[status] ?? PRIMARY_COPY.pending
}

export function routingStatusCopy(status: ProviderResourceStatus): StatusCopy {
  return ROUTING_COPY[status] ?? ROUTING_COPY.pending
}

function lastSync(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `Last synced ${formatDistanceToNow(date, { addSuffix: true })}`
}

/** Whether the backup voice agent is in use: Enabled / Disabled / Not configured. */
export function backupStatusCopy(view: AgentStatusView): StatusCopy {
  const fallback = view.providers.find((p) => p.role === 'fallback')
  if (!fallback || !fallback.configured) {
    return { label: 'Not configured', tone: 'muted', description: 'No backup voice agent is available on the platform.' }
  }
  if (!view.fallback_enabled || !fallback.enabled || fallback.status === 'disabled') {
    return { label: 'Disabled', tone: 'muted', description: 'New calls are not moved to a backup voice agent.' }
  }
  return { label: 'Enabled', tone: 'ok', description: 'New calls go to the backup voice agent if ElevenLabs is unavailable.' }
}

interface ProviderStatusCardProps {
  status: AgentStatusView | null
  isLoading: boolean
  error: string | null
  isRetrying: boolean
  onRetry: () => void
  onRefresh: () => void
}

export function ProviderStatusCard({ status, isLoading, error, isRetrying, onRetry, onRefresh }: ProviderStatusCardProps) {
  if (!status) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Voice providers</CardTitle>
          {error && !isLoading && <CardDescription role="alert">{error}</CardDescription>}
          {error && !isLoading && (
            <CardAction>
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RotateCw aria-hidden="true" /> Reload
              </Button>
            </CardAction>
          )}
        </CardHeader>
        {(isLoading || !error) && (
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading provider status">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </CardContent>
        )}
      </Card>
    )
  }

  const primary = status.providers.find((p) => p.role === 'primary')
  const fallback = status.providers.find((p) => p.role === 'fallback')
  const primaryCopy = primary ? providerStatusCopy(primary.status) : PRIMARY_COPY.not_configured
  const fbCopy = backupStatusCopy(status)
  const fallbackActive = fbCopy.label === 'Enabled'
  const fallbackSync = fallback && fallbackActive ? providerStatusCopy(fallback.status) : null
  const canRetry =
    status.providers.some((p) => p.configured && p.enabled && p.status !== 'ready') ||
    status.voice.status === 'failed' ||
    status.numbers.some((n) => n.routing_status === 'failed' || n.routing_status === 'degraded')

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Voice providers</CardTitle>
        <CardDescription>Where your agent runs and whether your latest settings reached it.</CardDescription>
        <CardAction>
          <Button
            variant={canRetry ? 'default' : 'outline'}
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            aria-label="Retry synchronisation with the voice providers"
          >
            {isRetrying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
            {isRetrying ? 'Syncing…' : 'Retry sync'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Primary */}
        <Tile title="Primary voice agent" subtitle={PROVIDER_LABEL[primary?.provider ?? 'elevenlabs']} icon={ShieldCheck}>
          <StatusPill copy={primaryCopy} />
          <p className="text-xs text-muted-foreground">{primaryCopy.description}</p>
          {primary && lastSync(primary.last_synced_at) && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" aria-hidden="true" /> {lastSync(primary.last_synced_at)}
            </p>
          )}
          {primary?.last_error && <ErrorText>{primary.last_error}</ErrorText>}
        </Tile>

        {/* Backup */}
        <Tile title="Backup voice agent" subtitle={PROVIDER_LABEL[fallback?.provider ?? 'cartesia']} icon={ShieldCheck}>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill copy={fbCopy} />
            {fallbackSync && fallback?.status !== 'ready' && <StatusPill copy={fallbackSync} />}
          </div>
          <p className="text-xs text-muted-foreground">{fbCopy.description}</p>
          {fallbackActive && fallback?.last_error && <ErrorText>{fallback.last_error}</ErrorText>}
        </Tile>

        {/* Voice */}
        <Tile title="Voice" subtitle="Applied to the primary agent" icon={Volume2}>
          <VoiceSyncBadge status={status.voice.status} />
          <p className="text-xs text-muted-foreground">{VOICE_SYNC_COPY[status.voice.status].description}</p>
          {status.voice.error && status.voice.status !== 'synced' && <ErrorText>{status.voice.error}</ErrorText>}
        </Tile>

        {/* Phone routing */}
        <Tile title="Phone routing" subtitle={status.numbers.length ? `${status.numbers.length} number${status.numbers.length > 1 ? 's' : ''}` : 'No numbers yet'} icon={Phone}>
          {status.numbers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              <Link href="/phone" className="text-primary underline-offset-4 hover:underline">Buy a number</Link> to start taking calls.
            </p>
          ) : (
            <ul className="space-y-2">
              {status.numbers.map((n) => {
                const copy = routingStatusCopy(n.routing_status)
                return (
                  <li key={n.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs">{formatPhoneNumber(n.number)}</span>
                      <StatusPill copy={copy} />
                    </div>
                    <p className="text-xs text-muted-foreground">{ROUTING_MODE_SHORT[n.routing_mode]}</p>
                    {n.routing_error && n.routing_status !== 'ready' && <ErrorText>{n.routing_error}</ErrorText>}
                  </li>
                )
              })}
            </ul>
          )}
          {status.numbers.length > 0 && (
            <Link href="/phone" className="text-xs text-primary underline-offset-4 hover:underline">
              Manage routing
            </Link>
          )}
        </Tile>
      </CardContent>
    </Card>
  )
}

function Tile({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-muted/20 p-3" aria-label={title}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-xs font-medium">{title}</h3>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="break-words text-xs text-destructive">{children}</p>
}

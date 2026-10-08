'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircle, AlertTriangle, AudioLines, Bot, CheckCircle2, CircleSlash, Clock, LifeBuoy, Phone, RotateCw,
  type LucideIcon,
} from 'lucide-react'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader } from '@/components/ui/card'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { StatusChip, type StatusTone } from '@/components/shared/StatusChip'
import { VOICE_SYNC_COPY, VoiceSyncBadge } from '@/components/voice/VoiceSyncBadge'
import { PROVIDER_LABEL } from '@/hooks/useAgentStatus'
import { formatPhoneNumber } from '@/lib/utils'
import type { AgentStatusView, ProviderResourceStatus, ProviderResourceView } from '@/types'

type Tone = 'ok' | 'busy' | 'waiting' | 'warn' | 'error' | 'muted'

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

/** Sync/routing tone → soft status chip tone (spec §3.4: status colours are small and soft). */
const CHIP_TONE: Record<Tone, StatusTone> = {
  ok: 'success',
  busy: 'neutral',
  waiting: 'warning',
  warn: 'warning',
  error: 'danger',
  muted: 'muted',
}

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === 'ok') return <CheckCircle2 aria-hidden="true" />
  // A sync or routing change in flight: the "connecting" orb, never a spinner.
  if (tone === 'busy') return <OrbInline state="connecting" />
  if (tone === 'waiting') return <Clock aria-hidden="true" />
  if (tone === 'warn') return <AlertTriangle aria-hidden="true" />
  if (tone === 'error') return <AlertCircle aria-hidden="true" />
  return <CircleSlash aria-hidden="true" />
}

/** Status chip for a provider, the backup agent or a number's routing (icon + text, never colour alone). */
export function StatusPill({ copy, className }: { copy: StatusCopy; className?: string }) {
  return (
    <StatusChip tone={CHIP_TONE[copy.tone]} icon={<ToneIcon tone={copy.tone} />} title={copy.description} className={className}>
      {copy.label}
    </StatusChip>
  )
}

const NOT_CREATED: StatusCopy = {
  label: 'Pending',
  tone: 'waiting',
  description: 'The voice agent is created when you activate your agent or save a change.',
}

/** Copy for a provider's sync status (primary agent, or the backup's own sync state). */
export function providerStatusCopy(status: ProviderResourceView['status'], lastSyncedAt?: string | null): StatusCopy {
  // Pending and never synced: nothing is running yet, so no "syncing" orb.
  if (status === 'pending' && lastSyncedAt === null) return NOT_CREATED
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

const INK_LINK =
  'rounded-sm text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function CardHead({ children }: { children?: React.ReactNode }) {
  return (
    <CardHeader className="border-b">
      {/* A page section (h2) set as a CardTitle, like every panel title and "Test your agent" beside it; the provider rows are its h3s. */}
      <h2 data-slot="card-title" className="text-[15px] leading-[22px] font-medium">
        Voice providers
      </h2>
      <CardDescription>Where your agent runs and whether your latest settings reached it.</CardDescription>
      {children}
    </CardHeader>
  )
}

function RetryButton({ variant, loading, onClick }: { variant: 'default' | 'outline'; loading?: boolean; onClick?: () => void }) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      loading={loading}
      loadingState="connecting"
      loadingText="Syncing…"
      aria-label="Retry synchronisation with the voice providers"
    >
      <RotateCw aria-hidden="true" />
      Retry sync
    </Button>
  )
}

/** pt-6: the title lines up with "Test your agent" in the band next to it (xl). */
const CARD_CLASS = 'gap-0 pt-6 pb-0'

export function ProviderStatusCard({ status, isLoading, error, isRetrying, onRetry, onRefresh }: ProviderStatusCardProps) {
  if (!status) {
    return (
      <Card className={CARD_CLASS}>
        {error && !isLoading ? (
          <CardHead />
        ) : (
          <CardHead>
            {/* Holds the Retry button's place (hidden, not focusable) so the header keeps its height. */}
            <CardAction className="invisible" aria-hidden="true">
              <RetryButton variant="outline" />
            </CardAction>
          </CardHead>
        )}
        {error && !isLoading ? (
          <div className="p-5">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RotateCw aria-hidden="true" /> Reload
                </Button>
              </AlertAction>
            </Alert>
          </div>
        ) : (
          // Sized to the four provider rows it stands in for (one or two numbers), so nothing below moves
          // when they arrive; beside the test band (xl) the panel stretches to the band's height anyway.
          <OrbLoader
            size={32}
            layout="row"
            label="Checking providers…"
            className="min-h-[450px] flex-1 justify-center px-5 sm:min-h-[430px]"
          />
        )}
      </Card>
    )
  }

  const primary = status.providers.find((p) => p.role === 'primary')
  const fallback = status.providers.find((p) => p.role === 'fallback')
  const primaryCopy = primary ? providerStatusCopy(primary.status, primary.last_synced_at) : PRIMARY_COPY.not_configured
  const fbCopy = backupStatusCopy(status)
  const fallbackActive = fbCopy.label === 'Enabled'
  const fallbackSync = fallback && fallbackActive ? providerStatusCopy(fallback.status, fallback.last_synced_at) : null
  const canRetry =
    status.providers.some((p) => p.configured && p.enabled && p.status !== 'ready') ||
    status.voice.status === 'failed' ||
    status.numbers.some((n) => n.routing_status === 'failed' || n.routing_status === 'degraded')
  const primarySynced = primary ? lastSync(primary.last_synced_at) : null

  return (
    <Card className={CARD_CLASS}>
      <CardHead>
        <CardAction>
          <RetryButton variant={canRetry ? 'default' : 'outline'} loading={isRetrying} onClick={onRetry} />
        </CardAction>
      </CardHead>

      <Row
        title="Primary voice agent"
        subtitle={PROVIDER_LABEL[primary?.provider ?? 'elevenlabs']}
        icon={Bot}
        status={<StatusPill copy={primaryCopy} />}
      >
        <Description>{primaryCopy.description}</Description>
        {primarySynced && (
          <p className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" /> {primarySynced}
          </p>
        )}
        {primary?.last_error && <ErrorText>{primary.last_error}</ErrorText>}
      </Row>

      <Row
        title="Backup voice agent"
        subtitle={PROVIDER_LABEL[fallback?.provider ?? 'cartesia']}
        icon={LifeBuoy}
        status={
          <span className="flex flex-wrap justify-end gap-1.5">
            <StatusPill copy={fbCopy} />
            {fallbackSync && fallback?.status !== 'ready' && <StatusPill copy={fallbackSync} />}
          </span>
        }
      >
        <Description>{fbCopy.description}</Description>
        {fallbackActive && fallback?.last_error && <ErrorText>{fallback.last_error}</ErrorText>}
      </Row>

      <Row title="Voice" subtitle="Applied to the primary agent" icon={AudioLines} status={<VoiceSyncBadge status={status.voice.status} />}>
        <Description>{VOICE_SYNC_COPY[status.voice.status].description}</Description>
        {status.voice.error && status.voice.status !== 'synced' && <ErrorText>{status.voice.error}</ErrorText>}
      </Row>

      <Row
        title="Phone routing"
        subtitle={status.numbers.length ? `${status.numbers.length} number${status.numbers.length > 1 ? 's' : ''}` : 'No numbers yet'}
        icon={Phone}
        status={
          status.numbers.length > 0 ? (
            <Link href="/phone" className={INK_LINK}>
              Manage routing
            </Link>
          ) : null
        }
      >
        {status.numbers.length === 0 ? (
          <Description>
            <Link href="/phone" className={INK_LINK}>Buy a number</Link> to start taking calls.
          </Description>
        ) : (
          <ul className="mt-1 space-y-2.5">
            {status.numbers.map((n) => {
              const copy = routingStatusCopy(n.routing_status)
              return (
                <li key={n.id} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-[19px] font-medium tabular-nums">{formatPhoneNumber(n.number)}</span>
                      <span className="block text-xs leading-4 text-muted-foreground">{ROUTING_MODE_SHORT[n.routing_mode]}</span>
                    </span>
                    <StatusPill copy={copy} />
                  </div>
                  {n.routing_error && n.routing_status !== 'ready' && <ErrorText>{n.routing_error}</ErrorText>}
                </li>
              )
            })}
          </ul>
        )}
      </Row>
    </Card>
  )
}

/** One provider/resource as a list row: icon disc, title · subtitle, trailing chip, details below. */
function Row({
  title,
  subtitle,
  icon: Icon,
  status,
  children,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  status?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // last:flex-1: beside the test band (xl) the panel stretches to the band's height; the last row takes the rest.
    <section className="flex gap-3 border-b border-rule px-5 py-4 last:flex-1 last:border-b-0" aria-label={title}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-foreground" aria-hidden="true">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm leading-5 font-medium">{title}</h3>
            <p className="truncate text-xs leading-4 text-muted-foreground">{subtitle}</p>
          </div>
          {status}
        </div>
        {children}
      </div>
    </section>
  )
}

function Description({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-[19px] text-muted-foreground">{children}</p>
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-4 break-words text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

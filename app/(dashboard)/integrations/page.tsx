'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { Check, ShieldCheck, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { WorkInProgressBadge } from '@/components/shared/WorkInProgressBadge'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { StatusChip } from '@/components/shared/StatusChip'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ─── Integration definitions ──────────────────────────────────────────────────
interface IntegrationDef {
  id: string
  name: string
  description: string
  capabilities: string[]
  logoSrc?: string
  category: string
  recommended?: boolean
  workInProgress?: boolean
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Let your agent check your free times and book appointments during calls (Agent → Call handling → Appointments).',
    capabilities: ['Book appointments during calls', 'Check real-time availability', 'Respects your opening hours', 'Bookings land in your calendar'],
    logoSrc: '/integrari/google_calendar.svg',
    category: 'Google Workspace',
    recommended: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send follow-up emails, call summaries, and confirmations automatically after every call.',
    capabilities: ['Send call summaries', 'Automated follow-up emails', 'Email confirmations', 'Custom email templates'],
    logoSrc: '/integrari/google_mail.svg',
    category: 'Google Workspace',
    workInProgress: true,
    recommended: true,
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Log every call, capture leads, and track outcomes in a spreadsheet automatically.',
    capabilities: ['Log calls automatically', 'Capture leads & contacts', 'Track call outcomes', 'Export call data'],
    logoSrc: '/integrari/google_sheets.svg',
    category: 'Google Workspace',
    workInProgress: true,
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    description: 'Generate call reports, meeting notes, and documentation automatically from conversations.',
    capabilities: ['Auto-generate call reports', 'Create meeting notes', 'Build knowledge base', 'Document workflows'],
    logoSrc: '/integrari/google_docs.svg',
    category: 'Google Workspace',
    workInProgress: true,
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Store call recordings, transcripts, and reports organized in your Drive automatically.',
    capabilities: ['Store call recordings', 'Organize transcripts', 'Shared team folders', 'Automatic file naming'],
    logoSrc: '/integrari/google_drive.svg',
    category: 'Google Workspace',
    workInProgress: true,
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Send real-time call data to any external service, CRM, or automation platform.',
    capabilities: ['Real-time call events', 'Custom payload format', 'Retry on failure', 'HMAC signature verification'],
    category: 'Developer',
  },
]

interface IntegrationCardProps {
  integration: IntegrationDef
  connected: boolean
  busy: boolean
  onConnect: (i: IntegrationDef) => void
  onDisconnect: (i: IntegrationDef) => void
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

/** Connect (outline, connecting orb) / Disconnect (ghost) pill. Same handlers and disabled rules as before. */
function ConnectButton({ integration, connected, busy, onConnect, onDisconnect }: IntegrationCardProps) {
  return (
    <Button
      size="sm"
      variant={connected ? 'ghost' : 'outline'}
      disabled={integration.workInProgress}
      loading={busy}
      loadingState={connected ? 'working' : 'connecting'}
      loadingText={connected ? 'Disconnecting…' : 'Connecting…'}
      title={integration.workInProgress ? 'Coming soon' : undefined}
      onClick={() => (connected ? onDisconnect(integration) : onConnect(integration))}
      className={cn('tap-44 shrink-0', connected && 'text-muted-foreground hover:text-destructive')}
    >
      {connected ? 'Disconnect' : 'Connect'}
    </Button>
  )
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return connected ? (
    <StatusChip tone="success" dot>Connected</StatusChip>
  ) : (
    <span className="text-xs leading-4 text-muted-foreground">Not connected</span>
  )
}

/**
 * What the integration does: a quiet check list (like the plan cards' features).
 * `muted` (work in progress) greys the text instead of fading it, so it stays ≥ 4.5:1.
 */
function CapabilityList({
  capabilities,
  columns = 1,
  muted = false,
}: {
  capabilities: string[]
  columns?: 1 | 2
  muted?: boolean
}) {
  return (
    <ul
      className={cn('grid gap-x-6 gap-y-1.5', columns === 2 && 'max-w-[560px] sm:grid-cols-2')}
      aria-label="What it does"
    >
      {capabilities.map((cap) => (
        <li
          key={cap}
          className={cn(
            'flex items-start gap-2 text-[13px] leading-[19px]',
            muted ? 'text-muted-foreground' : 'text-foreground/80'
          )}
        >
          <Check aria-hidden className="mt-[3px] size-3.5 shrink-0 text-muted-foreground" />
          {cap}
        </li>
      ))}
    </ul>
  )
}

// ─── Google tile (tinted, like the site's Google Workspace cards) ────────────
function GoogleTile(props: IntegrationCardProps) {
  const { integration, connected } = props
  return (
    <Card variant="tinted" className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white shadow-hair">
          {integration.logoSrc && (
            <Image src={integration.logoSrc} alt="" width={28} height={28} className="size-7 object-contain" />
          )}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {integration.recommended && !connected && <Badge variant="outline">Recommended</Badge>}
          {integration.workInProgress && <WorkInProgressBadge />}
        </div>
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        <h3 className="text-[15px] leading-[22px] font-medium text-foreground">{integration.name}</h3>
        <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">{integration.description}</p>
        {/* Work-in-progress tiles quieten what they promise (as before), not their name. */}
        <div className="mt-4">
          <CapabilityList capabilities={integration.capabilities} muted={integration.workInProgress} />
        </div>
      </div>

      <div className="mt-5 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <ConnectionStatus connected={connected} />
        <ConnectButton {...props} />
      </div>
    </Card>
  )
}

// ─── Developer row (white panel) ──────────────────────────────────────────────
function DeveloperRow(props: IntegrationCardProps) {
  const { integration, connected } = props
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
        <Webhook aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] leading-[22px] font-medium text-foreground">{integration.name}</h3>
          {connected && <StatusChip tone="success" dot>Connected</StatusChip>}
        </div>
        <p className="mt-1 max-w-[62ch] text-[13px] leading-[19px] text-muted-foreground">{integration.description}</p>
        <div className="mt-3">
          <CapabilityList capabilities={integration.capabilities} columns={2} />
        </div>
      </div>
      <div className="self-start">
        <ConnectButton {...props} />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [supabase] = useState(() => createClient())
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  // Presentation only: during the first load each section shows an orb instead of tiles
  // that would flip from "Connect" to "Connected" a moment later; the headings stay.
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('integrations').select('type, is_active')
    const map: Record<string, boolean> = {}
    for (const row of (data ?? []) as { type: string; is_active: boolean }[]) {
      map[row.type] = row.is_active
    }
    setConnected(map)
    setLoaded(true)
  }, [supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Coming back from the Google OAuth page with the browser's Back button can restore
  // this page from the back/forward cache with the Connect pill still busy: clear it.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(null)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // Toast feedback when returning from the Google OAuth redirect.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const ok = sp.get('connected')
    const err = sp.get('error')
    if (ok) {
      toast.success(`Connected ${ok.replace('google_', 'Google ').replace('_', ' ')}`)
      refresh()
    }
    if (err) toast.error(`Connection failed: ${err.replace(/_/g, ' ')}`)
    if (ok || err) window.history.replaceState({}, '', '/integrations')
  }, [refresh])

  const handleConnect = useCallback((integration: IntegrationDef) => {
    // Google Workspace integrations go through OAuth.
    if (integration.category === 'Google Workspace') {
      // Presentation only: the pill shows the connecting orb while the browser leaves.
      setBusy(integration.id)
      window.location.href = `/api/integrations/google/connect?type=${integration.id}`
      return
    }

    // Webhook is configured inline with a URL.
    const url = window.prompt('Enter the webhook URL that should receive call events:')
    if (!url) return
    setBusy(integration.id)
    fetch(`/api/integrations/${integration.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { url } }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (res.ok) {
          toast.success('Webhook connected')
          setConnected((p) => ({ ...p, [integration.id]: true }))
        } else {
          toast.error(data.error ?? 'Failed to connect')
        }
      })
      .catch(() => toast.error('Failed to connect'))
      .finally(() => setBusy(null))
  }, [])

  const handleDisconnect = useCallback((integration: IntegrationDef) => {
    setBusy(integration.id)
    fetch(`/api/integrations/${integration.id}`, { method: 'DELETE' })
      .then(async (res) => {
        if (res.ok) {
          toast.success(`Disconnected ${integration.name}`)
          setConnected((p) => ({ ...p, [integration.id]: false }))
        } else {
          const data = await res.json()
          toast.error(data.error ?? 'Failed to disconnect')
        }
      })
      .catch(() => toast.error('Failed to disconnect'))
      .finally(() => setBusy(null))
  }, [])

  const googleIntegrations = INTEGRATIONS.filter((i) => i.category === 'Google Workspace')
  const devIntegrations = INTEGRATIONS.filter((i) => i.category === 'Developer')
  const connectedCount = INTEGRATIONS.filter((i) => connected[i.id]).length

  const cardProps = (i: IntegrationDef): IntegrationCardProps => ({
    integration: i,
    connected: !!connected[i.id],
    busy: busy === i.id,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
  })

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Integrations"
        title="Integrations"
        description="Connect your tools to automate workflows and supercharge your AI agent."
        meta={
          loaded && connectedCount > 0 ? (
            <StatusChip tone="success" dot className="tabular-nums">{connectedCount} connected</StatusChip>
          ) : undefined
        }
      />

      <div className="space-y-10">
        {/* Google Workspace */}
        <section aria-labelledby="integrations-google">
          <SectionHeading
            title={<span id="integrations-google">Google Workspace</span>}
            description="Calendar, mail, sheets, docs and files, connected through your Google account."
            action={
              <span className="hidden text-[13px] leading-[19px] text-muted-foreground tabular-nums sm:inline">
                {googleIntegrations.length} integrations
              </span>
            }
          />
          {loaded ? (
            // Three columns only once the tiles have room next to the sidebar (xl).
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {googleIntegrations.map((i) => (
                <GoogleTile key={i.id} {...cardProps(i)} />
              ))}
            </div>
          ) : (
            // One panel where the tiles land (white, like the other list loaders): about one tile
            // tall on a phone, two rows from sm, so the Developer section stays below the fold.
            <Card className="py-0">
              <OrbLoader label="Loading integrations…" className="min-h-[360px] sm:min-h-[690px]" />
            </Card>
          )}
          <p className="mt-4 flex max-w-[760px] items-start gap-2 text-xs leading-[18px] text-muted-foreground">
            <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0" />
            Connecting Google services opens a secure OAuth authorization window. We request only the minimum permissions needed. You can revoke access at any time from your Google Account settings.
          </p>
        </section>

        {/* Developer */}
        <section aria-labelledby="integrations-developer">
          <SectionHeading
            title={<span id="integrations-developer">Developer</span>}
            description="Send call events to your own systems."
            action={
              <span className="hidden text-[13px] leading-[19px] text-muted-foreground tabular-nums sm:inline">
                {devIntegrations.length} integration
              </span>
            }
          />
          <Card className="gap-0 py-0">
            {loaded ? (
              <div className="divide-y divide-rule">
                {devIntegrations.map((i) => (
                  <DeveloperRow key={i.id} {...cardProps(i)} />
                ))}
              </div>
            ) : (
              // Compact card body (< 240 px): its own 32 orb, the height of the webhook row.
              <OrbLoader size={32} className="min-h-[142px]" />
            )}
          </Card>
        </section>
      </div>
    </PageContainer>
  )
}

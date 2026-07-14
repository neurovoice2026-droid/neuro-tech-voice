'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { CheckCircle2, Link2, ExternalLink, Webhook, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkInProgressBadge } from '@/components/shared/WorkInProgressBadge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ─── Integration definitions ──────────────────────────────────────────────────
interface IntegrationDef {
  id: string
  name: string
  description: string
  capabilities: string[]
  logoSrc?: string
  logoBg: string
  category: string
  recommended?: boolean
  workInProgress?: boolean
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Automatically schedule appointments and send reminders based on call outcomes.',
    capabilities: ['Book appointments from calls', 'Send calendar invites', 'Check real-time availability', 'Sync call follow-ups'],
    logoSrc: '/integrari/google_calendar.svg',
    logoBg: 'bg-blue-50',
    category: 'Google Workspace',
    workInProgress: true,
    recommended: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send follow-up emails, call summaries, and confirmations automatically after every call.',
    capabilities: ['Send call summaries', 'Automated follow-up emails', 'Email confirmations', 'Custom email templates'],
    logoSrc: '/integrari/google_mail.svg',
    logoBg: 'bg-red-50',
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
    logoBg: 'bg-green-50',
    category: 'Google Workspace',
    workInProgress: true,
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    description: 'Generate call reports, meeting notes, and documentation automatically from conversations.',
    capabilities: ['Auto-generate call reports', 'Create meeting notes', 'Build knowledge base', 'Document workflows'],
    logoSrc: '/integrari/google_docs.svg',
    logoBg: 'bg-blue-50',
    category: 'Google Workspace',
    workInProgress: true,
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Store call recordings, transcripts, and reports organized in your Drive automatically.',
    capabilities: ['Store call recordings', 'Organize transcripts', 'Shared team folders', 'Automatic file naming'],
    logoSrc: '/integrari/google_drive.svg',
    logoBg: 'bg-yellow-50',
    category: 'Google Workspace',
    workInProgress: true,
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Send real-time call data to any external service, CRM, or automation platform.',
    capabilities: ['Real-time call events', 'Custom payload format', 'Retry on failure', 'HMAC signature verification'],
    logoBg: 'bg-gray-100',
    category: 'Developer',
  },
]

// ─── Card component ───────────────────────────────────────────────────────────
function IntegrationCard({
  integration,
  connected,
  busy,
  onConnect,
  onDisconnect,
}: {
  integration: IntegrationDef
  connected: boolean
  busy: boolean
  onConnect: (i: IntegrationDef) => void
  onDisconnect: (i: IntegrationDef) => void
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 p-5 transition-all duration-200',
        connected
          ? 'border-green-400 bg-green-50/40 shadow-sm'
          : 'border-border bg-card hover:border-purple-200 hover:shadow-sm'
      )}
    >
      {/* Badges */}
      <div className="absolute -top-2.5 left-4 flex gap-1.5">
        {connected && (
          <span className="flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-0.5 text-[10px] font-semibold text-white">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Connected
          </span>
        )}
        {integration.recommended && !connected && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            Recommended
          </span>
        )}
        {integration.workInProgress && <WorkInProgressBadge />}
      </div>

      <div className="flex items-start justify-between gap-4">
        {/* Logo + info */}
        <div className="flex items-start gap-3">
          <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl p-2', integration.logoBg)}>
            {integration.logoSrc ? (
              <Image
                src={integration.logoSrc}
                alt={integration.name}
                width={28}
                height={28}
                className="object-contain"
              />
            ) : (
              <Webhook className="h-5 w-5 text-gray-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{integration.name}</h3>
              <Badge variant="secondary" className="text-[10px]">{integration.category}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-sm">
              {integration.description}
            </p>
          </div>
        </div>

        {/* CTA */}
        <Button
          size="sm"
          variant={connected ? 'outline' : 'default'}
          disabled={busy || integration.workInProgress}
          title={integration.workInProgress ? 'Coming soon' : undefined}
          onClick={() => (connected ? onDisconnect(integration) : onConnect(integration))}
          className={cn(
            'shrink-0',
            connected
              ? 'border-green-300 text-green-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
              : 'purple-glow'
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : connected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>

      {/* Capabilities */}
      <div className={cn('mt-4 grid grid-cols-2 gap-1.5', integration.workInProgress && 'opacity-60')}>
        {integration.capabilities.map((cap) => (
          <div key={cap} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', connected ? 'bg-green-500' : 'bg-gray-300')} />
            {cap}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [supabase] = useState(() => createClient())
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('integrations').select('type, is_active')
    const map: Record<string, boolean> = {}
    for (const row of (data ?? []) as { type: string; is_active: boolean }[]) {
      map[row.type] = row.is_active
    }
    setConnected(map)
  }, [supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

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

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your tools to automate workflows and supercharge your AI agent.
        </p>
      </div>

      {/* Google Workspace section */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm border">
              <Image src="/integrari/google_calendar.svg" alt="Google" width={16} height={16} className="object-contain" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Google Workspace</h2>
          </div>
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">{googleIntegrations.length} integrations</span>
        </div>

        <div className="space-y-4">
          {googleIntegrations.map((i) => (
            <IntegrationCard
              key={i.id}
              integration={i}
              connected={!!connected[i.id]}
              busy={busy === i.id}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>
      </div>

      {/* Developer section */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
              <Link2 className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Developer</h2>
          </div>
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">{devIntegrations.length} integration</span>
        </div>

        <div className="space-y-4">
          {devIntegrations.map((i) => (
            <IntegrationCard
              key={i.id}
              integration={i}
              connected={!!connected[i.id]}
              busy={busy === i.id}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>
      </div>

      {/* OAuth note */}
      <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connecting Google services opens a secure OAuth authorization window. We request only the minimum permissions needed. You can revoke access at any time from your Google Account settings.
        </p>
      </div>
    </div>
  )
}

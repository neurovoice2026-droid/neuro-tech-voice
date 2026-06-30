'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowRight, ArrowLeft, CheckCircle2, Link2, ExternalLink, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { cn } from '@/lib/utils'

// ─── Integration data ──────────────────────────────────────────────────────────
interface Integration {
  id: string
  name: string
  description: string
  capabilities: string[]
  logoSrc: string
  logoBg: string
  recommended?: boolean
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Automatically schedule appointments, send reminders, and manage your calendar based on call outcomes.',
    capabilities: ['Book appointments from calls', 'Send calendar invites', 'Check availability in real-time', 'Sync call follow-ups'],
    logoSrc: '/integrari/google_calendar.svg',
    logoBg: 'bg-blue-50',
    recommended: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send follow-up emails, summaries, and confirmations automatically after every call.',
    capabilities: ['Send call summaries', 'Automated follow-up emails', 'Email confirmations', 'Custom email templates'],
    logoSrc: '/integrari/google_mail.svg',
    logoBg: 'bg-red-50',
    recommended: true,
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Log every call, capture leads, and track outcomes in a spreadsheet automatically.',
    capabilities: ['Log calls automatically', 'Capture leads & contacts', 'Track call outcomes', 'Export call data'],
    logoSrc: '/integrari/google_sheets.svg',
    logoBg: 'bg-green-50',
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    description: 'Generate call reports, meeting notes, and documentation automatically from your conversations.',
    capabilities: ['Auto-generate call reports', 'Create meeting notes', 'Build knowledge base', 'Document workflows'],
    logoSrc: '/integrari/google_docs.svg',
    logoBg: 'bg-blue-50',
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Store call recordings, transcripts, and reports organized in your Drive automatically.',
    capabilities: ['Store call recordings', 'Organize transcripts', 'Shared team folders', 'Automatic file naming'],
    logoSrc: '/integrari/google_drive.svg',
    logoBg: 'bg-yellow-50',
  },
]

// ─── Integration Card ─────────────────────────────────────────────────────────
interface IntegrationCardProps {
  integration: Integration
  connected: boolean
  onToggle: () => void
}

function IntegrationCard({ integration, connected, onToggle }: IntegrationCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-5 transition-all duration-200',
        connected
          ? 'border-green-400 bg-green-50/50 shadow-sm'
          : 'border-border bg-white hover:border-purple-200 hover:shadow-sm'
      )}
    >
      {integration.recommended && !connected && (
        <div className="absolute -top-2.5 left-4">
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            Recommended
          </span>
        </div>
      )}

      {connected && (
        <div className="absolute -top-2.5 left-4">
          <span className="flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-0.5 text-[10px] font-semibold text-white">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Connected
          </span>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl p-2', integration.logoBg)}>
            <Image
              src={integration.logoSrc}
              alt={integration.name}
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{integration.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed max-w-xs">
              {integration.description.split('.')[0]}.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant={connected ? 'outline' : 'default'}
          onClick={onToggle}
          className={cn(
            'shrink-0 ml-4',
            connected
              ? 'border-green-300 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
              : 'purple-glow'
          )}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>

      {/* Capabilities */}
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {integration.capabilities.map((cap) => (
          <div key={cap} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', connected ? 'bg-green-500' : 'bg-gray-300')} />
            {cap}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step5Integrations ────────────────────────────────────────────────────────
export function Step5Integrations() {
  const { setStep } = useOnboardingStore()
  const [connected, setConnected] = useState<Record<string, boolean>>({})

  function toggle(id: string) {
    setConnected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const connectedCount = Object.values(connected).filter(Boolean).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-xl bg-purple-100 p-2.5">
          <Link2 className="h-7 w-7 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Connect your tools</h2>
          <p className="mt-1 text-muted-foreground">
            Integrate Google Workspace to supercharge your AI agent. All optional — you can add these later.
          </p>
        </div>
      </div>

      {/* Connected count banner */}
      {connectedCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <Sparkles className="h-4 w-4 text-green-600" />
          <p className="text-sm font-medium text-green-800">
            {connectedCount} integration{connectedCount > 1 ? 's' : ''} connected — your agent is getting smarter!
          </p>
        </div>
      )}

      {/* Integration cards */}
      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            connected={!!connected[integration.id]}
            onToggle={() => toggle(integration.id)}
          />
        ))}
      </div>

      {/* Note */}
      <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connecting Google services will open a secure OAuth authorization window. We only request the minimum permissions needed for each integration. You can revoke access at any time from your dashboard.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep(4)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(6)}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Skip for now
          </button>
          <Button onClick={() => setStep(6)} className="purple-glow px-6">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

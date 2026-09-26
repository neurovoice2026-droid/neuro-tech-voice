'use client'

import Link from 'next/link'
import { AudioLines, UploadCloud, Settings, BarChart2, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface QuickActionsProps {
  onTestCall?: () => void
  onKnowledgeUpload?: () => void
}

type QuickAction =
  | { icon: LucideIcon; label: string; description: string; href: string }
  | { icon: LucideIcon; label: string; description: string; onClick?: () => void }

const baseClass =
  'flex h-auto w-full min-w-0 flex-col items-start gap-0.5 rounded-lg border border-border bg-background px-3 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4'

export function QuickActions({ onTestCall, onKnowledgeUpload }: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      icon: AudioLines,
      label: 'Test your agent',
      description: 'Talk to it in your browser',
      onClick: onTestCall,
    },
    {
      icon: UploadCloud,
      label: 'Add documents',
      description: 'Price lists, FAQs, policies',
      onClick: onKnowledgeUpload,
    },
    {
      icon: Settings,
      label: 'Agent settings',
      description: 'Greeting, voice and hours',
      href: '/agent',
    },
    {
      icon: BarChart2,
      label: 'Call history',
      description: 'Transcripts and outcomes',
      href: '/calls',
    },
  ]

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) =>
            'href' in a ? (
              <Link key={a.label} href={a.href} className={baseClass}>
                <a.icon className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.description}</span>
              </Link>
            ) : (
              <button key={a.label} type="button" className={baseClass} onClick={a.onClick} disabled={!a.onClick}>
                <a.icon className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.description}</span>
              </button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

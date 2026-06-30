'use client'

import { Phone, UploadCloud, Settings, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface QuickActionsProps {
  onTestCall?: () => void
  onKnowledgeUpload?: () => void
}

const baseClass =
  'flex h-auto flex-col items-start gap-0.5 rounded-lg border border-border bg-background px-4 py-3 text-left hover:bg-muted transition-colors cursor-pointer w-full'

export function QuickActions({ onTestCall, onKnowledgeUpload }: QuickActionsProps) {
  const actions = [
    {
      icon: Phone,
      label: 'Test Call',
      description: 'Test your agent',
      onClick: onTestCall,
    },
    {
      icon: UploadCloud,
      label: 'Upload Knowledge',
      description: 'Add context',
      onClick: onKnowledgeUpload,
    },
    {
      icon: Settings,
      label: 'Configure Agent',
      description: 'Edit settings',
      href: '/agent',
    },
    {
      icon: BarChart2,
      label: 'View Analytics',
      description: 'See trends',
      href: '/calls',
    },
  ]

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) =>
            a.href ? (
              <a key={a.label} href={a.href} className={baseClass}>
                <a.icon className="mb-1 h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.description}</span>
              </a>
            ) : (
              <button key={a.label} className={baseClass} onClick={a.onClick}>
                <a.icon className="mb-1 h-4 w-4 text-muted-foreground" />
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

'use client'

import Link from 'next/link'
import { Phone, UploadCloud, Settings, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface QuickActionsProps {
  onTestCall?: () => void
  onKnowledgeUpload?: () => void
}

/** Tinted action tile (the site's grouping surface); keyboard focus draws the ring outline. */
const tileClass =
  'flex min-h-[104px] w-full cursor-pointer flex-col items-start gap-0.5 rounded-2xl bg-secondary p-4 text-left transition-[background-color,scale] duration-200 ease-site outline-none hover:bg-secondary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring'

function TileBody({ icon: Icon, label, description }: { icon: typeof Phone; label: string; description: string }) {
  return (
    <>
      <span className="mb-auto grid size-8 place-items-center rounded-full bg-white shadow-hair">
        <Icon className="size-4 text-foreground" aria-hidden="true" />
      </span>
      <span className="mt-3 text-sm leading-5 font-medium text-foreground">{label}</span>
      <span className="text-xs leading-4 text-muted-foreground">{description}</span>
    </>
  )
}

export function QuickActions({ onTestCall, onKnowledgeUpload }: QuickActionsProps) {
  const actions = [
    {
      icon: Phone,
      label: 'Test call',
      description: 'Test your agent',
      onClick: onTestCall,
    },
    {
      icon: UploadCloud,
      label: 'Upload knowledge',
      description: 'Add context',
      onClick: onKnowledgeUpload,
    },
    {
      icon: Settings,
      label: 'Configure agent',
      description: 'Edit settings',
      href: '/agent',
    },
    {
      icon: BarChart2,
      label: 'View analytics',
      description: 'See trends',
      href: '/calls',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) =>
            a.href ? (
              <Link key={a.label} href={a.href} className={tileClass}>
                <TileBody icon={a.icon} label={a.label} description={a.description} />
              </Link>
            ) : (
              <button key={a.label} type="button" className={tileClass} onClick={a.onClick} aria-haspopup="dialog">
                <TileBody icon={a.icon} label={a.label} description={a.description} />
              </button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

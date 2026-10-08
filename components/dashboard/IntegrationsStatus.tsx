import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Link2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusChip } from '@/components/shared/StatusChip'
import { cn } from '@/lib/utils'
import type { Integration, IntegrationType } from '@/types'

interface IntegrationMeta {
  label: string
  logoSrc?: string   // path in /public
  workInProgress?: boolean
}

const INTEGRATION_META: Record<IntegrationType, IntegrationMeta> = {
  google_calendar: { label: 'Google Calendar', logoSrc: '/integrari/google_calendar.svg', workInProgress: true },
  gmail:           { label: 'Gmail',           logoSrc: '/integrari/google_mail.svg',     workInProgress: true },
  google_sheets:   { label: 'Google Sheets',   logoSrc: '/integrari/google_sheets.svg',   workInProgress: true },
  google_docs:     { label: 'Google Docs',     logoSrc: '/integrari/google_docs.svg',     workInProgress: true },
  google_drive:    { label: 'Google Drive',    logoSrc: '/integrari/google_drive.svg',    workInProgress: true },
  webhook:         { label: 'Webhook' },
}

interface IntegrationsStatusProps {
  integrations: Integration[]
}

export function IntegrationsStatus({ integrations }: IntegrationsStatusProps) {
  const all: IntegrationType[] = ['google_calendar', 'gmail', 'google_sheets', 'google_docs', 'google_drive', 'webhook']
  const connectedMap = new Map(integrations.map((i) => [i.type, i]))

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Integrations</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/integrations"
            aria-label="Manage integrations"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'tap-44 -my-1 -mr-2 text-muted-foreground')}
          >
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      <ul className="border-t border-rule">
        {all.map((type) => {
          const meta = INTEGRATION_META[type]
          const isConnected = connectedMap.get(type)?.is_active ?? false

          return (
            // flex-wrap + a name column with a floor width: when the card is too narrow, the
            // status chip wraps under the row instead of squeezing the provider name.
            // "Work in progress" is plain meta text here (the Integrations page carries the
            // warning badge) so the compact card does not stack five amber chips.
            <li key={type} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-5 py-2.5 last:border-b-0">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white shadow-hair">
                {meta.logoSrc ? (
                  <Image src={meta.logoSrc} alt="" width={16} height={16} className="object-contain" />
                ) : (
                  <Link2 className="size-4 text-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-[1_1_8.5rem]">
                <p className="truncate text-sm font-medium text-foreground">{meta.label}</p>
                {meta.workInProgress && (
                  <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">Work in progress</p>
                )}
              </div>
              {isConnected ? (
                <StatusChip tone="success" dot className="ml-auto">Connected</StatusChip>
              ) : (
                <StatusChip tone="muted" className="ml-auto">Not connected</StatusChip>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

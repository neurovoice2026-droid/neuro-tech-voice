import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ExternalLink, Webhook, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BetaBadge } from '@/components/integrations/BetaBadge'
import type { Integration, IntegrationType } from '@/types'

type GoogleType = Exclude<IntegrationType, 'webhook'>

const GOOGLE_META: Record<GoogleType, { label: string; logoSrc: string; logoBg: string }> = {
  google_calendar: { label: 'Google Calendar', logoSrc: '/integrari/google_calendar.svg', logoBg: 'bg-blue-50' },
  gmail: { label: 'Gmail', logoSrc: '/integrari/google_mail.svg', logoBg: 'bg-red-50' },
  google_sheets: { label: 'Google Sheets', logoSrc: '/integrari/google_sheets.svg', logoBg: 'bg-green-50' },
  google_docs: { label: 'Google Docs', logoSrc: '/integrari/google_docs.svg', logoBg: 'bg-blue-50' },
  google_drive: { label: 'Google Drive', logoSrc: '/integrari/google_drive.svg', logoBg: 'bg-yellow-50' },
}

const GOOGLE_ORDER: GoogleType[] = ['google_calendar', 'gmail', 'google_sheets', 'google_docs', 'google_drive']

interface IntegrationsStatusProps {
  /** Only type and is_active are read, so callers can select just those columns. */
  integrations: Pick<Integration, 'type' | 'is_active'>[]
}

export function IntegrationsStatus({ integrations }: IntegrationsStatusProps) {
  const active = new Set(integrations.filter((i) => i.is_active).map((i) => i.type))

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Integrations</CardTitle>
          <Link
            href="/integrations"
            aria-label="Open integrations"
            className="relative rounded-md p-1.5 text-muted-foreground transition-colors after:absolute after:-inset-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {GOOGLE_ORDER.map((type) => {
          const meta = GOOGLE_META[type]
          const connected = active.has(type)
          return (
            <div key={type} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.logoBg}`}>
                  <Image src={meta.logoSrc} alt="" width={18} height={18} className="object-contain" />
                </div>
                <span className="truncate text-sm font-medium">{meta.label}</span>
                <BetaBadge />
              </div>
              {connected ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" aria-label="Connected" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-gray-300" aria-label="Not connected" />
              )}
            </div>
          )
        })}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100">
              <Webhook className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
            </div>
            <span className="truncate text-sm font-medium">Slack and webhooks</span>
          </div>
          <Link
            href="/workflows"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-purple-600 hover:underline"
          >
            Workflows <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

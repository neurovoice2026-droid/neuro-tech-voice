import Image from 'next/image'
import { CheckCircle2, XCircle, ExternalLink, Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Integration, IntegrationType } from '@/types'

interface IntegrationMeta {
  label: string
  logoSrc?: string   // path in /public
  logoBg: string
}

const INTEGRATION_META: Record<IntegrationType, IntegrationMeta> = {
  google_calendar: { label: 'Google Calendar', logoSrc: '/integrari/google_calendar.svg', logoBg: 'bg-blue-50' },
  gmail:           { label: 'Gmail',            logoSrc: '/integrari/google_mail.svg',     logoBg: 'bg-red-50'  },
  google_sheets:   { label: 'Google Sheets',    logoSrc: '/integrari/google_sheets.svg',   logoBg: 'bg-green-50' },
  google_docs:     { label: 'Google Docs',      logoSrc: '/integrari/google_docs.svg',     logoBg: 'bg-blue-50'  },
  webhook:         { label: 'Webhook',           logoBg: 'bg-gray-100'                                          },
}

interface IntegrationsStatusProps {
  integrations: Integration[]
}

export function IntegrationsStatus({ integrations }: IntegrationsStatusProps) {
  const all: IntegrationType[] = ['google_calendar', 'gmail', 'google_sheets', 'google_docs', 'webhook']
  const connectedMap = new Map(integrations.map((i) => [i.type, i]))

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Integrations</CardTitle>
          <a
            href="/integrations"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {all.map((type) => {
          const meta = INTEGRATION_META[type]
          const isConnected = connectedMap.get(type)?.is_active ?? false

          return (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.logoBg}`}>
                  {meta.logoSrc ? (
                    <Image
                      src={meta.logoSrc}
                      alt={meta.label}
                      width={18}
                      height={18}
                      className="object-contain"
                    />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 text-gray-500" />
                  )}
                </div>
                <span className="text-sm font-medium">{meta.label}</span>
              </div>
              {isConnected ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-300" />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

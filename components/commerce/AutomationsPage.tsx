'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Ban, Store, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommerceCardError } from './ListScaffold'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatTile } from '@/components/shared/StatTile'
import { StatusChip } from '@/components/shared/StatusChip'
import { commerceErrorMessage } from '@/hooks/useCommerceApi'
import { enableBlocked, saveAutomation, useCommerceAutomations } from '@/hooks/useCommerceAutomations'
import { useCurrentConnection } from '@/hooks/useCommerceConnections'
import { AUTOMATION_TYPES, type AutomationDto, type AutomationType, type ConnectionDto } from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { isConfigured } from './AutomationCard'
import { AutomationForm } from './AutomationForm'
import { AutomationRuns } from './AutomationRuns'
import { formatCount } from './format'
import { AUTOMATION_TYPE_DESCRIPTION, AUTOMATION_TYPE_LABEL } from './labels'

function readTab(raw: string | null): AutomationType {
  return raw && (AUTOMATION_TYPES as readonly string[]).includes(raw) ? (raw as AutomationType) : 'cod_confirmation'
}

const STATS: Array<{ key: keyof AutomationDto['stats']; label: string }> = [
  { key: 'eligible', label: 'Eligibile' },
  { key: 'scheduled', label: 'Programate' },
  { key: 'calling', label: 'În apel' },
  { key: 'completed', label: 'Finalizate' },
  { key: 'suppressed', label: 'Suprimate' },
  { key: 'failed', label: 'Eșuate' },
]

function AutomationPanel({ automation, connection, onChanged }: { automation: AutomationDto; connection: ConnectionDto; onChanged: (a: AutomationDto) => void }) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const configured = isConfigured(automation)
  const consentGiven = Boolean(automation.consent_confirmed_at)
  const canToggle = automation.available && configured && (automation.enabled || consentGiven)
  const switchId = `enable-${automation.type}`

  async function toggle(enabled: boolean) {
    setToggling(true)
    try {
      const next = await saveAutomation(automation.type, { connection_id: connection.id, enabled })
      onChanged(next)
      toast.success(next.enabled ? 'Automatizarea este activă' : 'Automatizarea este în pauză')
    } catch (err) {
      const blocked = enableBlocked(err)
      if (blocked) {
        toast.warning('Automatizarea nu poate fi activată încă', {
          description: blocked.message,
          duration: 10_000,
          ...(blocked.href && blocked.action && blocked.href !== '/magazin/automatizari'
            ? { action: { label: blocked.action, onClick: () => router.push(blocked.href!) } }
            : {}),
        })
      } else {
        toast.error('Starea automatizării nu a putut fi schimbată', { description: commerceErrorMessage(err, 'Încearcă din nou.') })
      }
    } finally {
      setToggling(false)
    }
  }

  let blockedHint: string | null = null
  if (!configured) blockedHint = 'Salvează configurația de mai jos înainte de activare.'
  else if (!consentGiven && !automation.enabled) blockedHint = 'Confirmă acordul clienților (mai jos) înainte de activare.'

  return (
    <div className="space-y-8">
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] leading-[22px] font-medium text-foreground">{AUTOMATION_TYPE_LABEL[automation.type]}</h2>
              {!automation.available ? (
                <StatusChip tone="muted" icon={<Ban aria-hidden="true" />}>Indisponibil</StatusChip>
              ) : !configured ? (
                <StatusChip tone="muted" dot>Neconfigurat</StatusChip>
              ) : automation.enabled ? (
                <StatusChip tone="success" dot>Activă</StatusChip>
              ) : (
                <StatusChip tone="muted" dot>În pauză</StatusChip>
              )}
            </div>
            <p className="mt-1 max-w-[62ch] text-[13px] leading-[19px] text-muted-foreground">{AUTOMATION_TYPE_DESCRIPTION[automation.type]}</p>
            {blockedHint && automation.available && <p className="mt-2 text-[13px] leading-[19px] text-muted-foreground">{blockedHint}</p>}
          </div>
          {automation.available && (
            <div className="flex items-center gap-3 self-start rounded-full bg-white py-1.5 pr-2 pl-3 shadow-pill">
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden={!toggling}>
                {toggling && <OrbInline state="working" label="Se salvează" />}
              </span>
              <label htmlFor={switchId} className="text-[13px] font-medium text-foreground select-none">
                {automation.enabled ? 'Activă' : 'În pauză'}
              </label>
              <Switch id={switchId} checked={automation.enabled} onCheckedChange={(v) => void toggle(v)} disabled={toggling || !canToggle} />
            </div>
          )}
        </div>
        {!automation.available && (
          <div className="px-5 pb-5">
            <Alert>
              <Ban aria-hidden="true" />
              <AlertTitle>Indisponibilă pe această platformă</AlertTitle>
              <AlertDescription>{automation.unavailable_reason ?? 'Platforma magazinului nu oferă datele necesare acestei automatizări.'}</AlertDescription>
              <AlertAction>
                <Link href="/magazin/conexiuni" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                  Vezi capabilitățile conexiunii
                </Link>
              </AlertAction>
            </Alert>
          </div>
        )}
        {configured && automation.available && (
          <div className="grid grid-cols-2 gap-3 border-t border-rule p-5 sm:grid-cols-3 lg:grid-cols-6">
            {STATS.map(({ key, label }) => (
              <StatTile key={key} size="sm" label={label} value={formatCount(automation.stats[key])} />
            ))}
          </div>
        )}
      </Card>

      {automation.available && (
        <Card className="gap-0 px-5 py-2">
          {/* Keyed on the template, not its row id: the first save or a consent confirmation turns a null id
              into a string, and that must not remount the form and discard what is typed in it. */}
          <AutomationForm key={`${connection.id}:${automation.type}`} automation={automation} connectionId={connection.id} onSaved={onChanged} />
        </Card>
      )}

      {automation.available && configured ? (
        <AutomationRuns automation={automation} />
      ) : automation.available ? (
        <EmptyState icon={Workflow} title="Istoricul apare după configurare" description="Salvează configurația și activează automatizarea ca să vezi apelurile ei aici." />
      ) : null}
    </div>
  )
}

export function AutomationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = readTab(searchParams.get('tip'))
  const { connection, isLoading: connectionLoading, error: connectionError, refetch: refetchConnection } = useCurrentConnection()
  const { automations, isLoading, error, refetch, replaceAutomation } = useCommerceAutomations(connection?.id ?? null)

  const selectTab = useCallback(
    (value: string) => {
      // The tab lives in the URL so a reload (or a link from the overview) lands on the same template.
      router.replace(`/magazin/automatizari?tip=${readTab(value)}`, { scroll: false })
    },
    [router],
  )

  let body: React.ReactNode
  if (connectionLoading || (connection && isLoading)) {
    body = (
      <Card className="py-0">
        <OrbLoader label="Se încarcă automatizările…" className="min-h-[360px]" />
      </Card>
    )
  } else if (!connection) {
    body = connectionError ? (
      <Card className="gap-0 py-0">
        <CommerceCardError message="Conexiunea magazinului nu a putut fi citită." detail={connectionError} onRetry={refetchConnection} className="py-8" />
      </Card>
    ) : (
      <EmptyState
        icon={Store}
        title="Conectează magazinul mai întâi"
        description="Automatizările folosesc comenzile și clienții sincronizați; apar după conectarea platformei."
        action={
          <Link href="/magazin/conexiuni" className={buttonVariants({ size: 'sm' })}>
            Conectează magazinul
            <ArrowRight aria-hidden="true" />
          </Link>
        }
      />
    )
  } else if (error && automations.length === 0) {
    body = (
      <Card className="gap-0 py-0">
        <CommerceCardError message="Automatizările nu au putut fi încărcate." detail={error} onRetry={refetch} className="py-8" />
      </Card>
    )
  } else {
    body = (
      <Tabs value={tab} onValueChange={(v) => selectTab(String(v))} className="gap-6">
        <TabsList variant="line" aria-label="Automatizări">
          {AUTOMATION_TYPES.map((type) => {
            const automation = automations.find((a) => a.type === type)
            return (
              <TabsTrigger key={type} value={type} className={cn(automation && !automation.available && 'text-muted-foreground')}>
                {AUTOMATION_TYPE_LABEL[type]}
                {automation?.enabled && <span aria-hidden="true" className="size-1.5 rounded-full bg-success-dot" />}
                {automation?.enabled && <span className="sr-only">(activă)</span>}
              </TabsTrigger>
            )
          })}
        </TabsList>
        {error && (
          <Card className="gap-0 py-0">
            <CommerceCardError role="status" message="Automatizările nu au putut fi reîmprospătate." detail={error} onRetry={refetch} />
          </Card>
        )}
        {AUTOMATION_TYPES.map((type) => {
          const automation = automations.find((a) => a.type === type)
          return (
            <TabsContent key={type} value={type}>
              {automation ? (
                <AutomationPanel automation={automation} connection={connection} onChanged={replaceAutomation} />
              ) : (
                <EmptyState icon={Workflow} title="Șablonul nu a fost returnat" description="Reîncarcă pagina; dacă persistă, contactează echipa de suport." />
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Magazin"
        title="Automatizări"
        description="Apelurile pe care agentul le dă singur: când sună, cât de des, ce spune și cui nu sună."
      />
      {body}
    </PageContainer>
  )
}

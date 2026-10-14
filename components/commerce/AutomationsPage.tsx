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
import { AUTOMATION_TYPE_DESCRIPTION, AUTOMATION_TYPE_LABEL, STORE_PATHS, automationHref } from './labels'

/** The query parameter that selects the template (`/store/automations?type=`). */
const TAB_PARAM = 'type'

function readTab(raw: string | null): AutomationType {
  return raw && (AUTOMATION_TYPES as readonly string[]).includes(raw) ? (raw as AutomationType) : 'cod_confirmation'
}

const STATS: Array<{ key: keyof AutomationDto['stats']; label: string }> = [
  { key: 'eligible', label: 'Eligible' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'calling', label: 'Calling' },
  { key: 'completed', label: 'Completed' },
  { key: 'suppressed', label: 'Suppressed' },
  { key: 'failed', label: 'Failed' },
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
      toast.success(next.enabled ? 'Automation turned on' : 'Automation turned off')
    } catch (err) {
      const blocked = enableBlocked(err)
      if (blocked) {
        toast.warning('The automation cannot be enabled yet', {
          description: blocked.message,
          duration: 10_000,
          // No action when it points at this very page.
          ...(blocked.href && blocked.action && blocked.href !== STORE_PATHS.automations
            ? { action: { label: blocked.action, onClick: () => router.push(blocked.href!) } }
            : {}),
        })
      } else {
        toast.error('The automation state could not be changed', { description: commerceErrorMessage(err, 'Try again.') })
      }
    } finally {
      setToggling(false)
    }
  }

  let blockedHint: string | null = null
  if (!configured) blockedHint = 'Save the configuration below before enabling.'
  else if (!consentGiven && !automation.enabled) blockedHint = 'Confirm customer consent (below) before enabling.'

  return (
    <div className="space-y-8">
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] leading-[22px] font-medium text-foreground">{AUTOMATION_TYPE_LABEL[automation.type]}</h2>
              {!automation.available ? (
                <StatusChip tone="muted" icon={<Ban aria-hidden="true" />}>Unavailable</StatusChip>
              ) : !configured ? (
                <StatusChip tone="muted" dot>Not set up</StatusChip>
              ) : automation.enabled ? (
                <StatusChip tone="success" dot>On</StatusChip>
              ) : (
                <StatusChip tone="muted" dot>Off</StatusChip>
              )}
            </div>
            <p className="mt-1 max-w-[62ch] text-[13px] leading-[19px] text-muted-foreground">{AUTOMATION_TYPE_DESCRIPTION[automation.type]}</p>
            {blockedHint && automation.available && <p className="mt-2 text-[13px] leading-[19px] text-muted-foreground">{blockedHint}</p>}
          </div>
          {automation.available && (
            <div className="flex items-center gap-3 self-start rounded-full bg-white py-1.5 pr-2 pl-3 shadow-pill">
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden={!toggling}>
                {toggling && <OrbInline state="working" label="Saving" />}
              </span>
              <label htmlFor={switchId} className="text-[13px] font-medium text-foreground select-none">
                {automation.enabled ? 'On' : 'Off'}
              </label>
              <Switch id={switchId} checked={automation.enabled} onCheckedChange={(v) => void toggle(v)} disabled={toggling || !canToggle} />
            </div>
          )}
        </div>
        {!automation.available && (
          <div className="px-5 pb-5">
            <Alert>
              <Ban aria-hidden="true" />
              <AlertTitle>Unavailable on this platform</AlertTitle>
              <AlertDescription>{automation.unavailable_reason ?? 'The store platform does not provide the data this automation needs.'}</AlertDescription>
              <AlertAction>
                <Link href={STORE_PATHS.connections} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                  View connection capabilities
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
        <EmptyState icon={Workflow} title="History appears after setup" description="Save the configuration and enable the automation to see its calls here." />
      ) : null}
    </div>
  )
}

export function AutomationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = readTab(searchParams.get(TAB_PARAM))
  const { connection, isLoading: connectionLoading, error: connectionError, refetch: refetchConnection } = useCurrentConnection()
  const { automations, isLoading, error, refetch, replaceAutomation } = useCommerceAutomations(connection?.id ?? null)

  const selectTab = useCallback(
    (value: string) => {
      // The tab lives in the URL so a reload (or a link from the overview) lands on the same template.
      router.replace(automationHref(readTab(value)), { scroll: false })
    },
    [router],
  )

  let body: React.ReactNode
  if (connectionLoading || (connection && isLoading)) {
    body = (
      <Card className="py-0">
        <OrbLoader label="Loading automations…" className="min-h-[360px]" />
      </Card>
    )
  } else if (!connection) {
    body = connectionError ? (
      <Card className="gap-0 py-0">
        <CommerceCardError message="The store connection could not be read." detail={connectionError} onRetry={refetchConnection} className="py-8" />
      </Card>
    ) : (
      <EmptyState
        icon={Store}
        title="Connect your store first"
        description="Automations work on synced orders and customers; they appear once the platform is connected."
        action={
          <Link href={STORE_PATHS.connections} className={buttonVariants({ size: 'sm' })}>
            Connect store
            <ArrowRight aria-hidden="true" />
          </Link>
        }
      />
    )
  } else if (error && automations.length === 0) {
    body = (
      <Card className="gap-0 py-0">
        <CommerceCardError message="Automations could not be loaded." detail={error} onRetry={refetch} className="py-8" />
      </Card>
    )
  } else {
    body = (
      <Tabs value={tab} onValueChange={(v) => selectTab(String(v))} className="gap-6">
        <TabsList variant="line" aria-label="Automations">
          {AUTOMATION_TYPES.map((type) => {
            const automation = automations.find((a) => a.type === type)
            return (
              <TabsTrigger key={type} value={type} className={cn(automation && !automation.available && 'text-muted-foreground')}>
                {AUTOMATION_TYPE_LABEL[type]}
                {automation?.enabled && <span aria-hidden="true" className="size-1.5 rounded-full bg-success-dot" />}
                {automation?.enabled && <span className="sr-only">(enabled)</span>}
              </TabsTrigger>
            )
          })}
        </TabsList>
        {error && (
          <Card className="gap-0 py-0">
            <CommerceCardError role="status" message="Automations could not be refreshed." detail={error} onRetry={refetch} />
          </Card>
        )}
        {AUTOMATION_TYPES.map((type) => {
          const automation = automations.find((a) => a.type === type)
          return (
            <TabsContent key={type} value={type}>
              {automation ? (
                <AutomationPanel automation={automation} connection={connection} onChanged={replaceAutomation} />
              ) : (
                <EmptyState icon={Workflow} title="The template was not returned" description="Reload the page; if it keeps happening, contact support." />
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
        eyebrow="Store"
        title="Automations"
        description="The calls the agent places on its own: when it calls, how often, what it says and whom it never calls."
      />
      {body}
    </PageContainer>
  )
}

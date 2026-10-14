'use client'

import Link from 'next/link'
import { ArrowRight, Package, RefreshCw, Store, Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CommerceCardError } from './ListScaffold'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { StatTile } from '@/components/shared/StatTile'
import type { AutomationDto, CommerceOverviewDto, ConnectionDto } from '@/lib/commerce/types'
import { platformName } from '@/lib/commerce/platforms'
import { cn } from '@/lib/utils'
import { AutomationCard } from './AutomationCard'
import { formatCount, formatDateTime, relativeTime } from './format'
import { STORE_PATHS, SYNC_STATUS_LABEL } from './labels'
import { ProblemsList } from './ProblemsList'
import { RunsTable } from './RunsTable'
import { ConnectionStatusChip } from './StatusChips'

// The store overview, shared by /store and the e-commerce dashboard:
// connection + last sync, the three counts, the call queue, the automation
// tiles, the latest automation calls and the problems to fix. Everything on
// it comes from GET /api/commerce/overview.

interface StoreOverviewProps {
  overview: CommerceOverviewDto | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onAutomationChanged: (automation: AutomationDto) => void
  /** 'full' = the /store page (every block); 'compact' = the dashboard strip (no recent runs table). */
  variant?: 'full' | 'compact'
  className?: string
}

const QUEUE_LABEL: Array<{ key: keyof CommerceOverviewDto['queue']; label: string }> = [
  { key: 'eligible', label: 'Eligible' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'calling', label: 'Calling' },
  { key: 'completed', label: 'Completed' },
  { key: 'suppressed', label: 'Suppressed' },
  { key: 'failed', label: 'Failed' },
]

const STAT_LINK = 'underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground'

function ConnectionSummary({ connection }: { connection: ConnectionDto }) {
  const syncing = connection.sync?.status === 'running' || connection.sync?.status === 'pending'
  const lastOk = connection.last_successful_sync_at
  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
            <Store className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] leading-[22px] font-medium text-foreground">
                {connection.display_name?.trim() || connection.store_domain}
              </h3>
              <ConnectionStatusChip status={connection.status} />
            </div>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
              {platformName(connection.platform)} · <span className="break-all">{connection.store_domain}</span>
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[19px] text-muted-foreground">
              {syncing ? (
                <>
                  <OrbInline state="connecting" />
                  <span>{SYNC_STATUS_LABEL[connection.sync?.status ?? 'running']}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Last successful sync:{' '}
                    {lastOk ? (
                      <time dateTime={lastOk} title={formatDateTime(lastOk)} className="text-foreground">
                        {relativeTime(lastOk)}
                      </time>
                    ) : (
                      <span className="text-foreground">never</span>
                    )}
                  </span>
                </>
              )}
            </p>
            {connection.error_message && (connection.status === 'error' || connection.status === 'degraded') && (
              <p className="mt-2 text-[13px] leading-[19px] text-destructive">{connection.error_message}</p>
            )}
          </div>
        </div>
        <Link href={STORE_PATHS.connections} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start sm:shrink-0')}>
          Connection
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </Card>
  )
}

function NoConnection() {
  return (
    <EmptyState
      icon={Store}
      title="The store is not connected"
      description="Connect the store platform to see orders, customers and products here and to start automated calls."
      action={
        <Link href={STORE_PATHS.connections} className={buttonVariants({ size: 'sm' })}>
          Connect store
          <ArrowRight aria-hidden="true" />
        </Link>
      }
    />
  )
}

export function StoreOverview({ overview, isLoading, error, onRetry, onAutomationChanged, variant = 'full', className }: StoreOverviewProps) {
  if (isLoading) {
    return (
      <Card className={cn('py-0', className)}>
        <OrbLoader label="Loading the store overview…" className="min-h-[320px]" />
      </Card>
    )
  }
  if (!overview) {
    return (
      <Card className={cn('gap-0 py-0', className)}>
        <CommerceCardError message="The store overview could not be loaded." detail={error} onRetry={onRetry} className="py-8" />
      </Card>
    )
  }

  const { connection, automations, queue, recent_runs: recentRuns, problems } = overview
  const counts = connection?.counts ?? null

  return (
    <div className={cn('space-y-8', className)}>
      {error && (
        <Card className="gap-0 py-0">
          <CommerceCardError
            role="status"
            message="The overview could not be refreshed; the numbers below may be out of date."
            detail={error}
            onRetry={onRetry}
          />
        </Card>
      )}

      {problems.length > 0 && (
        <section aria-labelledby="overview-problems">
          <SectionHeading as="h2" title={<span id="overview-problems">To fix</span>} description="What keeps the store or the automated calls from working." />
          <ProblemsList problems={problems} />
        </section>
      )}

      <section aria-labelledby="overview-connection">
        <SectionHeading as="h2" title={<span id="overview-connection">Connection</span>} description="The store platform and the last sync." />
        {connection ? <ConnectionSummary connection={connection} /> : <NoConnection />}
      </section>

      {connection && (
        <section aria-labelledby="overview-counts">
          <SectionHeading as="h2" title={<span id="overview-counts">Synced data</span>} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Orders" value={formatCount(counts?.orders)} icon={Package} hint={<Link href={STORE_PATHS.orders} className={STAT_LINK}>View orders</Link>} />
            <StatTile label="Customers" value={formatCount(counts?.customers)} icon={Users} hint={<Link href={STORE_PATHS.customers} className={STAT_LINK}>View customers</Link>} />
            <StatTile label="Products" value={formatCount(counts?.products)} icon={Store} hint={<Link href={STORE_PATHS.products} className={STAT_LINK}>View products</Link>} />
          </div>
        </section>
      )}

      <section aria-labelledby="overview-queue">
        <SectionHeading as="h2" title={<span id="overview-queue">Call queue</span>} description="The automated calls, by status." />
        <Card className="gap-0 py-0">
          <CardContent className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-3 lg:grid-cols-6">
            {QUEUE_LABEL.map(({ key, label }) => (
              <StatTile key={key} size="sm" label={label} value={formatCount(queue[key])} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="overview-automations">
        <SectionHeading
          as="h2"
          title={<span id="overview-automations">Automations</span>}
          description="Enable or pause each automation; the full settings live on its page."
          action={
            <Link href={STORE_PATHS.automations} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-my-1')}>
              All settings
              <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        {automations.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {automations.map((automation) => (
              <AutomationCard key={automation.type} automation={automation} onChanged={onAutomationChanged} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Store}
            title="Automations appear once the store is connected"
            description="Each platform provides different data, so the available automations are known after connecting."
          />
        )}
      </section>

      {variant === 'full' && (
        <section aria-labelledby="overview-runs">
          <SectionHeading as="h2" title={<span id="overview-runs">Recent automated calls</span>} description="The latest calls placed by automations." />
          <RunsTable
            runs={recentRuns}
            isLoading={false}
            error={null}
            onRetry={onRetry}
            footerLink={{ href: STORE_PATHS.automations, label: 'View the full history in Automations' }}
          />
        </section>
      )}

      {variant === 'compact' && recentRuns.length > 0 && (
        <div className="flex justify-end">
          <Link href={STORE_PATHS.overview} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-mr-2')}>
            Full store overview
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}

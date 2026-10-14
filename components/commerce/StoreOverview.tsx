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
import { SYNC_STATUS_LABEL } from './labels'
import { ProblemsList } from './ProblemsList'
import { RunsTable } from './RunsTable'
import { ConnectionStatusChip } from './StatusChips'

// The store overview, shared by /magazin and the e-commerce dashboard:
// connection + last sync, the three counts, the call queue, the automation
// tiles, the latest automation calls and the problems to fix. Everything on
// it comes from GET /api/commerce/overview.

interface StoreOverviewProps {
  overview: CommerceOverviewDto | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onAutomationChanged: (automation: AutomationDto) => void
  /** 'full' = the /magazin page (every block); 'compact' = the dashboard strip (no recent runs table). */
  variant?: 'full' | 'compact'
  className?: string
}

const QUEUE_LABEL: Array<{ key: keyof CommerceOverviewDto['queue']; label: string }> = [
  { key: 'eligible', label: 'Eligibile' },
  { key: 'scheduled', label: 'Programate' },
  { key: 'calling', label: 'În apel' },
  { key: 'completed', label: 'Finalizate' },
  { key: 'suppressed', label: 'Suprimate' },
  { key: 'failed', label: 'Eșuate' },
]

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
                    Ultima sincronizare reușită:{' '}
                    {lastOk ? (
                      <time dateTime={lastOk} title={formatDateTime(lastOk)} className="text-foreground">
                        {relativeTime(lastOk)}
                      </time>
                    ) : (
                      <span className="text-foreground">niciodată</span>
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
        <Link href="/magazin/conexiuni" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start sm:shrink-0')}>
          Conexiune
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
      title="Magazinul nu este conectat"
      description="Conectează platforma magazinului ca să vezi comenzile, clienții și produsele aici și să pornești apelurile automate."
      action={
        <Link href="/magazin/conexiuni" className={buttonVariants({ size: 'sm' })}>
          Conectează magazinul
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
        <OrbLoader label="Se încarcă prezentarea magazinului…" className="min-h-[320px]" />
      </Card>
    )
  }
  if (!overview) {
    return (
      <Card className={cn('gap-0 py-0', className)}>
        <CommerceCardError message="Prezentarea magazinului nu a putut fi încărcată." detail={error} onRetry={onRetry} className="py-8" />
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
            message="Prezentarea nu a putut fi reîmprospătată; cifrele de mai jos pot fi vechi."
            detail={error}
            onRetry={onRetry}
          />
        </Card>
      )}

      {problems.length > 0 && (
        <section aria-labelledby="overview-problems">
          <SectionHeading as="h2" title={<span id="overview-problems">De rezolvat</span>} description="Ce împiedică magazinul sau apelurile automate să funcționeze." />
          <ProblemsList problems={problems} />
        </section>
      )}

      <section aria-labelledby="overview-connection">
        <SectionHeading as="h2" title={<span id="overview-connection">Conexiune</span>} description="Platforma magazinului și ultima sincronizare." />
        {connection ? <ConnectionSummary connection={connection} /> : <NoConnection />}
      </section>

      {connection && (
        <section aria-labelledby="overview-counts">
          <SectionHeading as="h2" title={<span id="overview-counts">Date sincronizate</span>} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Comenzi" value={formatCount(counts?.orders)} icon={Package} hint={<Link href="/magazin/comenzi" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">Vezi comenzile</Link>} />
            <StatTile label="Clienți" value={formatCount(counts?.customers)} icon={Users} hint={<Link href="/magazin/clienti" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">Vezi clienții</Link>} />
            <StatTile label="Produse" value={formatCount(counts?.products)} icon={Store} hint={<Link href="/magazin/produse" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">Vezi produsele</Link>} />
          </div>
        </section>
      )}

      <section aria-labelledby="overview-queue">
        <SectionHeading as="h2" title={<span id="overview-queue">Coada de apeluri</span>} description="Apelurile automate, după starea lor." />
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
          title={<span id="overview-automations">Automatizări</span>}
          description="Pornește sau pune în pauză fiecare automatizare; setările complete sunt în pagina ei."
          action={
            <Link href="/magazin/automatizari" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-my-1')}>
              Toate setările
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
            title="Automatizările apar după conectarea magazinului"
            description="Fiecare platformă oferă alte date, așa că automatizările disponibile se stabilesc după conectare."
          />
        )}
      </section>

      {variant === 'full' && (
        <section aria-labelledby="overview-runs">
          <SectionHeading as="h2" title={<span id="overview-runs">Apeluri automate recente</span>} description="Ultimele apeluri plasate de automatizări." />
          <RunsTable
            runs={recentRuns}
            isLoading={false}
            error={null}
            onRetry={onRetry}
            footerLink={{ href: '/magazin/automatizari', label: 'Vezi istoricul complet în Automatizări' }}
          />
        </section>
      )}

      {variant === 'compact' && recentRuns.length > 0 && (
        <div className="flex justify-end">
          <Link href="/magazin" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-mr-2')}>
            Prezentarea completă a magazinului
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}

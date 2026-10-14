'use client'

import Link from 'next/link'
import { ArrowRight, Bot, RotateCw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { OrbInline } from '@/components/shared/OrbLoader'
import { RunOutcomeChip, RunStatusChip } from '@/components/commerce/StatusChips'
import { automationTypeLabel, runSummaryLine } from '@/components/commerce/labels'
import { useRunForCall } from '@/hooks/useCommerceRuns'
import { cn } from '@/lib/utils'

// The e-commerce context of a call in the call sheet: the automation run it
// was placed for ("Apel automat · Confirmare ramburs · Comanda #1234 ·
// Confirmată"). Rendered only for calls that carry a commerce_run_id; when
// the run cannot be read, the section says so and offers a retry instead of
// disappearing.

const SECTION = 'py-6 first:pt-0 last:pb-0'
const HEADING = 'mb-3 flex items-center gap-1.5 text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase'

export function CallCommerceSection({ callId }: { callId: string }) {
  const { run, isLoading, error, refetch } = useRunForCall(callId)

  if (!isLoading && !error && !run) return null

  return (
    <section aria-labelledby="call-commerce-title" className={SECTION}>
      <h3 id="call-commerce-title" className={HEADING}>
        <Bot className="size-3.5" aria-hidden="true" />
        Apel automat
      </h3>
      {isLoading ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground" role="status">
          <OrbInline state="working" />
          Se încarcă detaliile apelului automat…
        </p>
      ) : error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4 text-[13px] leading-[19px] text-muted-foreground">
          <p className="min-w-0 flex-1">{error}</p>
          <Button type="button" variant="outline" size="xs" onClick={refetch}>
            <RotateCw aria-hidden="true" />
            Încearcă din nou
          </Button>
        </div>
      ) : run ? (
        <div className="space-y-3 rounded-2xl p-4 shadow-hair">
          <p className="text-sm font-medium text-foreground">{runSummaryLine(run)}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <RunStatusChip status={run.status} />
            <RunOutcomeChip outcome={run.outcome} />
            <span className="text-xs leading-4 text-muted-foreground tabular-nums">
              încercarea {run.attempt}/{run.max_attempts}
            </span>
          </div>
          {run.summary && <p className="text-[13px] leading-[19px] text-muted-foreground">{run.summary}</p>}
          <Link
            href={`/magazin/automatizari?tip=${run.automation_type}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'tap-44')}
          >
            Deschide {automationTypeLabel(run.automation_type)}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </section>
  )
}

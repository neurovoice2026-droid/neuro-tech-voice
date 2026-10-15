'use client'

import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MINUTES_ACTION_ROW, MinutesActionLinks } from '@/components/billing/MinutesActionLinks'
import type { CommerceOverviewDto } from '@/lib/commerce/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import type { BusinessType } from '@/types'
import { problemActions, type ProblemOrgPlan } from './labels'

type Problem = CommerceOverviewDto['problems'][number]

/** Problems that stop calls outright read as red; the rest (a failing webhook, a sync error) as a warning. */
const BLOCKING = new Set<Problem['code']>(['no_connection', 'credentials_expired', 'no_phone_number', 'encryption_not_configured', 'minutes_exhausted'])

/**
 * The organization's plan and business type, for the out-of-minutes choice:
 * from the app store when a page already loaded the organization, otherwise
 * one read of the owner's own row (RLS) once a minutes_exhausted problem is
 * shown. Null until known; the list then shows the server's single button.
 */
function useOrgPlan(needed: boolean): ProblemOrgPlan | null {
  const stored = useAppStore((s) => s.organization)
  const [fetched, setFetched] = useState<ProblemOrgPlan | null>(null)

  useEffect(() => {
    if (!needed || stored) return
    let live = true
    async function load() {
      try {
        const { data, error } = await createClient().from('organizations').select('plan, business_type').single()
        if (error) throw new Error(error.message)
        const row = data as { plan: string | null; business_type: BusinessType | null } | null
        if (live && row) setFetched({ plan: row.plan ?? null, business_type: row.business_type ?? null })
      } catch (err) {
        // The generic "Buy minutes" button stays; nothing else depends on this read.
        console.warn('store overview: plan lookup failed', err instanceof Error ? err.message : err)
      }
    }
    void load()
    return () => {
      live = false
    }
  }, [needed, stored])

  if (stored) return { plan: stored.plan ?? null, business_type: stored.business_type ?? null }
  return fetched
}

/**
 * The overview's problem list: each a message from the server and the
 * buttons that fix it. Out of minutes offers the choice of the dashboard
 * banner: the next plan up or 100 minutes (components/commerce/labels.ts
 * problemActions).
 */
export function ProblemsList({ problems, id }: { problems: Problem[]; id?: string }) {
  const org = useOrgPlan(problems.some((p) => p.code === 'minutes_exhausted'))
  if (problems.length === 0) return null
  return (
    <ul id={id} aria-label="Problems to fix" className="space-y-3">
      {problems.map((problem) => {
        const actions = problemActions(problem, org)
        return (
          <li key={problem.code}>
            <Alert variant={BLOCKING.has(problem.code) ? 'destructive' : 'warning'}>
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{problem.message}</AlertTitle>
              <AlertDescription>
                {BLOCKING.has(problem.code)
                  ? 'Until it is fixed, automations cannot call customers.'
                  : 'Automations keep running, but some data may arrive late.'}
              </AlertDescription>
              {actions.length > 0 && (
                <AlertAction className={cn(MINUTES_ACTION_ROW, actions.length > 1 && 'sm:max-w-72 sm:flex-col sm:items-stretch')}>
                  <MinutesActionLinks actions={actions} />
                </AlertAction>
              )}
            </Alert>
          </li>
        )
      })}
    </ul>
  )
}

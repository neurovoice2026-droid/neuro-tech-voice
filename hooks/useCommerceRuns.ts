'use client'

import type { RunDto } from '@/lib/commerce/types'
import { CANCELLABLE_RUN_STATUSES } from '@/components/commerce/labels'
import { buildQuery, commerceRequest, useCommercePaged, useCommerceQuery } from './useCommerceApi'

const RUNS_PATH = '/api/commerce/runs'

export type RunsParams = {
  automation_id?: string
  connection_id?: string
  status?: string
  call_id?: string
}

/** Paged GET /api/commerce/runs; `null` params = nothing to load yet (e.g. the automation is not configured). */
export function useCommerceRuns(params: RunsParams | null, limit = 25) {
  return useCommercePaged<RunDto>(params ? RUNS_PATH : null, params ?? {}, {
    fallback: 'Apelurile automate nu au putut fi încărcate.',
    limit,
  })
}

/** The run a call was placed for (CallDetailSheet), or null when the call was not an automation. */
export function useRunForCall(callId: string | null) {
  const path = callId ? `${RUNS_PATH}?${buildQuery({ call_id: callId, limit: 1 })}` : null
  const query = useCommerceQuery<{ items: RunDto[] }>(path, { fallback: 'Detaliile apelului automat nu au putut fi încărcate.' })
  return { run: query.data?.items[0] ?? null, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function isCancellable(run: Pick<RunDto, 'status'>): boolean {
  return CANCELLABLE_RUN_STATUSES.includes(run.status)
}

export async function cancelRun(id: string): Promise<RunDto> {
  const res = await commerceRequest<{ run: RunDto }>(`${RUNS_PATH}/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    json: {},
    fallback: 'Apelul nu a putut fi anulat.',
  })
  return res.run
}

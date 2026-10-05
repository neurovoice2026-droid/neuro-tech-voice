import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { redact } from '@/lib/security/redact'
import type { ProviderEvent } from '@/lib/observability/telemetry'

/** Inserts one telemetry row. Throws on failure; the caller decides how to log it. */
export async function persistProviderEvent(event: ProviderEvent): Promise<void> {
  const { error } = await createAdminClient().from('provider_events').insert({
    system: event.system,
    kind: event.kind,
    operation: event.operation ?? null,
    ok: event.ok,
    latency_ms: event.latencyMs ?? null,
    status: event.status ?? null,
    error_code: event.errorCode ?? null,
    org_id: event.orgId ?? null,
    agent_id: event.agentId ?? null,
    call_id: event.callId ?? null,
    details: event.details ? redact(event.details) : null,
  })
  if (error) throw new Error(`provider_events insert failed: ${error.message}`)
}

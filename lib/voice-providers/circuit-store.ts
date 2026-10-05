import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CircuitState, CircuitStore, CircuitKey } from './circuit-breaker'

/**
 * Breaker state shared by every serverless instance, in `provider_circuit_state`
 * (service-role only). Writes are optimistic on the `version` column.
 */
export class SupabaseCircuitStore implements CircuitStore {
  async read(provider: CircuitKey): Promise<{ state: CircuitState; version: number } | null> {
    const { data, error } = await createAdminClient()
      .from('provider_circuit_state')
      .select('state, version')
      .eq('provider', provider)
      .maybeSingle()
    if (error) throw new Error(`provider_circuit_state read failed: ${error.message}`)
    if (!data) return null
    return { state: data.state as CircuitState, version: data.version as number }
  }

  async write(provider: CircuitKey, state: CircuitState, expectedVersion: number | null): Promise<boolean> {
    const admin = createAdminClient()
    if (expectedVersion === null) {
      const { error } = await admin
        .from('provider_circuit_state')
        .insert({ provider, state, version: 1, updated_at: new Date().toISOString() })
      if (!error) return true
      if (error.code === '23505') return false // another instance inserted first
      throw new Error(`provider_circuit_state insert failed: ${error.message}`)
    }
    const { data, error } = await admin
      .from('provider_circuit_state')
      .update({ state, version: expectedVersion + 1, updated_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('version', expectedVersion)
      .select('version')
    if (error) throw new Error(`provider_circuit_state update failed: ${error.message}`)
    return (data?.length ?? 0) > 0
  }
}

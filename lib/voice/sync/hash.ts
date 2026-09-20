import { createHash } from 'node:crypto'

// Deterministic hashing for provider sync. The hash of the config we would
// push is stored in agents.provider_sync.<provider>.hash, so a save that
// changes nothing a provider sees costs no API call.

/** Bump when the shape of what we push changes in a way the config itself doesn't show. */
export const SYNC_SCHEMA_VERSION = 1

/**
 * JSON with object keys sorted at every level, so two equal configs always
 * serialise to the same string. `undefined` properties are dropped (as
 * JSON.stringify does); array order is kept because it is meaningful.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => (item === undefined ? null : sortKeys(item)))
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key]
      if (item !== undefined) out[key] = sortKeys(item)
    }
    return out
  }
  return value
}

export function configHash(value: unknown): string {
  return createHash('sha256')
    .update(stableStringify({ v: SYNC_SCHEMA_VERSION, value }))
    .digest('hex')
}

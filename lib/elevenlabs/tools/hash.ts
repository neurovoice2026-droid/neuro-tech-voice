// Stable fingerprints for tool reconciliation. Pure.

import { createHash } from 'node:crypto'

/** Bump when the hashing itself changes (forces one PATCH of every platform tool). */
const TOOL_HASH_VERSION = 1

/** JSON with object keys sorted at every depth (arrays keep their order). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v === undefined ? null : v)).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** Fingerprint of the tool_config we send: equal hashes = no PATCH needed. */
export function toolConfigHash(config: unknown): string {
  return createHash('sha256').update(`ntv-tool:v${TOOL_HASH_VERSION}:${stableStringify(config)}`).digest('hex').slice(0, 32)
}

/**
 * One-way fingerprint of a secret value, stored to detect rotation without
 * storing the value. 64 bits of a SHA-256 over a ≥ 32-character secret: not
 * reversible, and unique enough to notice a change.
 */
export function secretFingerprint(value: string): string {
  return createHash('sha256').update(`ntv-tool-key-fingerprint:v1:${value}`).digest('hex').slice(0, 16)
}

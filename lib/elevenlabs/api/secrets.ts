import 'server-only'
// ElevenLabs Agents workspace secrets. Verified against the official OpenAPI
// spec (2026-10):
//
//   POST  /v1/convai/secrets               PostWorkspaceSecretRequest {type: 'new', name, value}
//   GET   /v1/convai/secrets               page_size ≤ 100, search (name prefix), cursor
//   GET   /v1/convai/secrets/{secret_id}
//   PATCH /v1/convai/secrets/{secret_id}   PatchWorkspaceSecretRequest {type: 'update', name, value}
//   DELETE /v1/convai/secrets/{secret_id}  (refused while the secret is in use)
//   GET   /v1/convai/secrets/{secret_id}/dependencies/{tools|agents|phone_numbers}
//
// A stored secret is referenced as ConvAISecretLocator {secret_id} (tool
// request headers): its value never appears in a tool config. Every workspace
// tool could reference any secret, so ONLY platform secrets are stored here,
// never tenant credentials. Values never leave this module except in the
// request body, and nothing here logs them.

import { NO_RETRY } from '@/lib/voice-providers/http'
import { req, type Ctx } from '../client'

const BASE = '/v1/convai/secrets'
const enc = encodeURIComponent

/** PostWorkspaceSecretResponseModel / ConvAIWorkspaceStoredSecretConfig (subset). */
export interface ELSecret {
  type?: 'stored'
  secret_id: string
  name: string
}

/** GetWorkspaceSecretsResponseModel. */
export interface ELSecretsPage {
  secrets: ELSecret[]
  next_cursor?: string | null
}

/** SecretDependencyResourceType. */
export type SecretDependencyType = 'tools' | 'agents' | 'phone_numbers'

/** Creates a secret. Never retried: a retry after a late upstream success would create a duplicate. */
export function createSecret(params: { name: string; value: string }, ctx?: Ctx) {
  return req<ELSecret>('secrets.create', BASE, { method: 'POST', body: { type: 'new', name: params.name, value: params.value }, retry: NO_RETRY, ctx })
}

/** Replaces the value (rotation). The same body twice gives the same result, so it may be retried. */
export function updateSecret(secretId: string, params: { name: string; value: string }, ctx?: Ctx) {
  return req<ELSecret>('secrets.update', `${BASE}/${enc(secretId)}`, {
    method: 'PATCH',
    body: { type: 'update', name: params.name, value: params.value },
    idempotent: true,
    ctx,
  })
}

export function getSecret(secretId: string, ctx?: Ctx) {
  return req<ELSecret>('secrets.get', `${BASE}/${enc(secretId)}`, { ctx })
}

export function listSecrets(params: { search?: string; cursor?: string | null; page_size?: number } = {}, ctx?: Ctx) {
  return req<ELSecretsPage>('secrets.list', BASE, {
    query: {
      search: params.search,
      cursor: params.cursor ?? undefined,
      page_size: Math.max(1, Math.min(100, Math.floor(params.page_size ?? 100))),
    },
    ctx,
  })
}

/** Deletes a secret; the provider refuses while a tool, agent or number still uses it. */
export function deleteSecret(secretId: string, ctx?: Ctx) {
  return req<void>('secrets.delete', `${BASE}/${enc(secretId)}`, { method: 'DELETE', responseKind: 'none', ctx })
}

/** Resources that reference the secret (ids only are used). */
export function secretDependencies(secretId: string, resourceType: SecretDependencyType, params: { cursor?: string | null; page_size?: number } = {}, ctx?: Ctx) {
  return req<{ dependencies: Array<{ id?: string; type?: string }>; next_cursor?: string | null }>(
    'secrets.dependencies',
    `${BASE}/${enc(secretId)}/dependencies/${enc(resourceType)}`,
    { query: { cursor: params.cursor ?? undefined, page_size: Math.max(1, Math.min(100, Math.floor(params.page_size ?? 20))) }, ctx },
  )
}

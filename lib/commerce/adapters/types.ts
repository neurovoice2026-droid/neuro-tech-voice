import 'server-only'
// The adapter contract every store platform implements (lib/commerce/adapters/*).
// Routes, the sync worker and the webhook route only ever talk to this
// interface: no platform URL, header or payload shape leaks outside an
// adapter. Credentials reach an adapter already decrypted (ConnectionSecrets)
// and never leave it.

import type { Logger } from '@/lib/observability/logger'
import type {
  CommerceCapabilities,
  CommerceEvent,
  CommercePlatform,
  NormalizedCart,
  NormalizedCustomer,
  NormalizedOrder,
  NormalizedProduct,
  SyncResource,
} from '../types'

/** Decrypted credentials; the shape depends on the platform (validated by the adapter's schema). */
export type ConnectionSecrets = Record<string, unknown>

/** What an adapter needs about a connection, with its secrets in the clear (server memory only). */
export interface AdapterConnection {
  id: string
  orgId: string
  platform: CommercePlatform
  storeUrl: string
  storeDomain: string
  secrets: ConnectionSecrets
  capabilities: CommerceCapabilities
  /** Topics/ids of registered webhooks (webhook_config.registrations). */
  webhookRegistrations: WebhookRegistration[]
  /** Public HTTPS URL of this connection's webhook endpoint (lib/commerce/webhooks/url.ts). */
  webhookUrl: string | null
}

export interface WebhookRegistration {
  topic: string
  externalId: string
  /** How the registration was made: by the API, or by the merchant (companion plugin, manual). */
  source: 'api' | 'manual'
}

/** The merchant's input on the connect form, validated by the route against the adapter's schema. */
export interface ConnectInput {
  storeUrl: string
  secrets: ConnectionSecrets
}

export type ConnectionFailureCode =
  | 'invalid_url'
  | 'unreachable'
  | 'unauthorized'
  | 'forbidden'
  | 'not_a_store'
  | 'api_version_unsupported'
  | 'rate_limited'
  | 'timeout'
  | 'redirect'
  | 'invalid_response'
  | 'not_configured'
  | 'ssrf_blocked'

export class ConnectionError extends Error {
  constructor(
    readonly code: ConnectionFailureCode,
    /** Merchant-facing, Romanian, never containing a secret, a token or the raw provider body. */
    readonly publicMessage: string,
    /** Whether a retry later could succeed (network, rate limit) or the input must change (unauthorized). */
    readonly retryable: boolean,
    detail?: string,
  ) {
    super(detail ?? publicMessage)
    this.name = 'ConnectionError'
  }
}

/** What validateConnection learned from the real platform. */
export interface ValidatedStore {
  /** Canonical https origin (lower-case host, no trailing slash). */
  storeUrl: string
  storeDomain: string
  displayName: string | null
  currency: string | null
  countryCode: string | null
  timezone: string | null
  language: string | null
  /** Platform/API version seen, for the merchant-facing status. */
  platformVersion: string | null
  capabilities: CommerceCapabilities
  /** Secrets to store (may add derived values, e.g. a generated webhook secret). */
  secrets: ConnectionSecrets
}

export interface SyncCheckpoint {
  /** Provider-specific cursor of the last completed page (null = from the start). */
  cursor: string | null
  /** Only records modified after this instant (incremental syncs). */
  modifiedAfter: string | null
  /** Pages fetched so far in this job (bounded per run). */
  pages: number
}

export interface SyncBatch {
  resource: SyncResource
  products?: NormalizedProduct[]
  customers?: NormalizedCustomer[]
  orders?: NormalizedOrder[]
  carts?: NormalizedCart[]
  /** Checkpoint to persist after this batch is written. */
  checkpoint: SyncCheckpoint
  /** No more pages after this one. */
  done: boolean
}

export type VerificationFailure = { ok: false; reason: 'missing_signature' | 'bad_signature' | 'unknown_topic' | 'malformed' | 'not_supported'; status: 401 | 400 }

export interface VerifiedCommerceEvent {
  ok: true
  topic: string
  /** Provider delivery/event id, or null (the route then hashes the raw body). */
  deliveryId: string | null
  /** External id of the resource the event is about, when it is cheap to read. */
  externalResourceId: string | null
  payload: unknown
}

export interface RawWebhookRequest {
  headers: Headers
  /** The exact bytes received (signatures are computed over them). */
  rawBody: Uint8Array
  url: URL
}

export interface CommerceAdapter {
  platform: CommercePlatform
  /** The platform's capabilities for this connection (no I/O: decided at validation and stored). */
  getCapabilities(connection: Pick<AdapterConnection, 'capabilities' | 'webhookRegistrations'>): CommerceCapabilities
  /** Validates the merchant's input against the real platform. Throws ConnectionError. */
  validateConnection(input: ConnectInput, log: Logger): Promise<ValidatedStore>
  /** Registers the webhooks the platform supports. Throws ConnectionError; returns [] when the platform has none. */
  registerWebhooks(connection: AdapterConnection, log: Logger): Promise<WebhookRegistration[]>
  unregisterWebhooks(connection: AdapterConnection, log: Logger): Promise<void>
  /** One page per iteration; the worker persists each batch and its checkpoint before asking for the next. */
  syncPage(connection: AdapterConnection, resource: SyncResource, checkpoint: SyncCheckpoint, mode: 'initial' | 'incremental', log: Logger): Promise<SyncBatch>
  /** Verifies the signature over the raw bytes and parses the body. Never throws for a bad request. */
  verifyWebhook(request: RawWebhookRequest, connection: AdapterConnection): Promise<VerifiedCommerceEvent | VerificationFailure>
  /** Turns a verified delivery into normalized events (may be empty or 'ignored'). */
  normalizeEvent(event: VerifiedCommerceEvent, connection: AdapterConnection): CommerceEvent[]
  fetchOrder(connection: AdapterConnection, externalId: string, log: Logger): Promise<NormalizedOrder | null>
  fetchCustomer(connection: AdapterConnection, externalId: string, log: Logger): Promise<NormalizedCustomer | null>
  fetchProduct(connection: AdapterConnection, externalId: string, log: Logger): Promise<NormalizedProduct | null>
}

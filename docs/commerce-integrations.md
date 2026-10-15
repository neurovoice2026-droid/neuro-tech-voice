# E-commerce vertical (Store): store connections, automations and operations

This document describes the e-commerce vertical of Neuro Tech Voice: how a
store organization is onboarded, how store platforms are connected and
synchronized, how the outbound automations decide whom to call, how the
agent uses store data during a call, and how to operate it. Code lives in
`lib/commerce/*`, the routes in `app/api/commerce/*`, the UI in
`components/onboarding/commerce/*` and `components/commerce/*`, the schema in
`supabase/migrations/024_commerce.sql`.

## 1. Data flows and tenancy

```
 store platform ──webhook──▶ /api/commerce/webhooks/[platform]/[publicId]
       ▲   │                         │ signature over raw bytes, idempotency row
       │   └────polling──────────────┤ (commerce_webhook_events, service-only)
       │                             ▼
  adapter (lib/commerce/adapters/*)  commerce worker (cron step `commerce`)
   validate · syncPage · webhooks     ├─ process events → mirrors (orders/customers/products/carts)
                                      ├─ sync jobs (claimed with a lease, resumable)
                                      ├─ scheduler → commerce_automation_runs
                                      ├─ dispatch due runs → startOutboundCall(...)
                                      └─ reconcile finished calls → run outcome
```

* **Tenant boundary.** Every commerce row carries `org_id` and
  `connection_id`. Routes resolve the organization with `requireOrg()`, then
  load rows with the service role scoped by that id (`lib/commerce/api.ts`).
  Webhooks resolve the connection from the random `webhook_public_id` in the
  URL, never from anything in the body. Tools resolve the store from the call
  row (`calls.commerce_run_id`, the organization of the call), never from the
  model's arguments. Nothing accepts an organization id from the browser.
* **Business type.** `organizations.business_type` is `services` (every
  organization that existed before migration 024, backfilled once) or
  `ecommerce`; `NULL` means a new sign-up still has to choose (Step 0). The
  server decides the flow from the row (`lib/commerce/business-type.ts`); the
  columns are written by `POST /api/onboarding/business-type` only (a trigger
  refuses tenant writes). The choice is one-time and enforced by that route,
  not by the UI: it accepts a value only while `business_type` is `NULL` (the
  backfilled `services` may be confirmed as `services`, keeping the step the
  organization reached), and answers 409 `precondition_failed` with reason
  `already_selected` to any later request, including before onboarding
  completes and including a repeat of the same value; after completion the
  reason is `onboarding_completed`. Service organizations keep the original
  onboarding, dashboard and navigation unchanged; store organizations get the
  store onboarding, the store overview and the **Store** section of the
  dashboard (`/store/*`: orders, customers, products, automations,
  connections, do-not-call, settings).
* **Credentials.** Store credentials are an AES-256-GCM envelope
  (`lib/commerce/crypto.ts`) keyed by `COMMERCE_CREDENTIALS_ENCRYPTION_KEY`,
  with the organization and connection ids as authenticated data: a blob moved
  to another row does not decrypt. Tenants cannot read the column (column-level
  grant), the DTOs never include it, logs never carry a secret. Without the key
  the product fails closed: no connection can be created.
* **Mirrors.** `commerce_products`, `commerce_customers`, `commerce_orders`
  (+ `commerce_order_items`) and `commerce_carts` keep only the fields the
  product needs, unique per `(connection_id, external_id)`, written by UPSERT.
  Phone numbers are normalized to E.164 at import (`lib/commerce/phone.ts`,
  national formats resolved with the order's or the store's country); only
  numbers that normalize are ever dialed. Re-imports never undo a do-not-call
  flag.

## 2. Platforms: prerequisites, scopes and capabilities

The adapter decides what a connection can do from the real platform and
stores it in `commerce_connections.capabilities`; the UI only offers an
automation whose capability is true. Nothing is ever shown as "connected"
before the credentials were validated against the platform.

| Platform | Access | Data | Real-time events | Abandoned carts | Phone numbers |
|---|---|---|---|---|---|
| WooCommerce (`wc/v3`) | REST consumer key/secret, HTTPS, Read/Write for webhooks | orders, customers, products | webhooks `order.created/updated`, `product.updated`, `customer.updated` (signed) | only through the companion plugin webhook (`ntv.cart.updated`) | `billing.phone` / `shipping.phone` |
| Shopify (GraphQL Admin, pinned version in `lib/commerce/adapters/shopify.ts`) | OAuth authorization code grant, offline token | orders, customers, products, abandoned checkouts | webhook subscriptions (orders, products, customers, checkouts) | yes, when the app has protected customer data (phone) access | requires Shopify's protected customer data approval (Level 2 for phone) |
| Magento / Adobe Commerce (`/rest/V1`) | integration access token (admin-created integration) | orders, customers, products | none in Open Source (polling every `COMMERCE_POLL_MINUTES`, default 15) | not available | `telephone` on addresses |
| PrestaShop (Webservice 1.7/8) | Webservice key with GET on orders, order_details, customers, addresses, products, order_states, configurations, currencies, countries | orders, customers, products | none (polling) | not available | `phone_mobile` / `phone` on addresses |
| Custom (JSON REST contract v1, §3) | bearer / header key / basic | what the endpoints implement | merchant-sent signed webhooks (optional) | `cart.updated` events or `/carts` polling when implemented | as returned by the store |

### WooCommerce: creating keys and what the connector registers

1. WordPress admin → WooCommerce → Settings → Advanced → REST API → *Add key*.
   Description "Neuro Tech Voice", user: an Administrator, permissions
   **Read/Write** (webhook registration needs write; a Read key still works
   with polling and the connection says so).
2. Paste the consumer key and secret in the connect form (never shown again).
   The connector validates with `GET /wp-json/wc/v3/system_status` (falls back
   to `orders?per_page=1`), reads the store name, currency and country, and
   probes the key's permission level.
3. Webhooks are created with `POST /wp-json/wc/v3/webhooks` with a random
   secret chosen by the platform (stored encrypted with the keys). Deliveries
   are verified with `X-WC-Webhook-Signature = base64(HMAC-SHA256(raw body,
   secret))` over the exact bytes; the creation "ping" (`webhook_id=…`, no
   signature) is answered 200 and ignored; the dedupe key combines the
   delivery id with a hash of the body (WooCommerce delivery ids repeat within
   a second). WooCommerce disables a webhook after 5 failed deliveries;
   reconnecting re-registers. A delivery that fails verification is only
   logged (`commerce.webhook.rejected`): an unverified request never writes
   to the connection or raises a dashboard problem, so whoever learns the URL
   cannot fake a webhook failure. The connection keeps the time of the last
   verified delivery instead (`webhook_config.last_delivery_at`).
4. Abandoned carts: the standard REST API has no cart resource. A companion
   WordPress plugin (or any code on the store; none ships with the platform)
   must POST to the connection's webhook URL with topic `ntv.cart.updated`
   and the same signature scheme. The URL is shown, with a copy button, on
   the connection card (Store → Connections, onboarding step 3) when the key
   may manage webhooks; the secret is the one of the webhooks this
   connection created in WooCommerce → Settings → Advanced → Webhooks (the
   platform never displays it). The body
   is `{cart_id, customer: {phone, email, first_name, last_name}, items:
   [{name, quantity}], total, currency, abandoned_at, status}` (`status` one
   of `open | abandoned | recovered | expired`; only `abandoned` carts are
   called, `open` means the checkout is still in progress). Until such a
   registration exists the abandoned-cart automation is shown as unavailable.
5. Imports page with `per_page=100` and `modified_after` where WooCommerce
   supports it (orders, products); customers have no modification filter and
   are re-listed by id (bounded pages per run).

### Shopify: app, installation, scopes, webhooks

* Create an app in the Shopify Dev Dashboard (non-embedded, authorization
  code grant). Set `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` and register
  the redirect URI `https://<public origin>/api/commerce/oauth/shopify/callback`
  (`VOICE_PUBLIC_BASE_URL` / `NEXT_PUBLIC_APP_URL`). Declare the same scopes
  as `SHOPIFY_SCOPES` (default `read_orders,read_customers,read_products,read_checkouts`).
* The merchant types the `*.myshopify.com` domain; the start route sets an
  httpOnly state cookie and redirects to Shopify; the callback verifies the
  HMAC (hex HMAC-SHA256 of the sorted query, client secret), the state nonce
  and the shop, exchanges the code, then creates the connection like any other
  platform (validation with the `shop` query and the granted scopes,
  encrypted token, webhook subscriptions through the GraphQL Admin API, first
  import). Tokens never appear in URLs, logs or responses.
* Webhooks are verified with `X-Shopify-Hmac-Sha256 = base64(HMAC-SHA256(raw
  body, client secret))`; `X-Shopify-Webhook-Id` (one per delivery), else
  `X-Shopify-Event-Id`, combined with a hash of the body, is the dedupe key.
* Until `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are set, the Shopify
  card of the connect page and of onboarding step 2 is shown disabled with
  "Not available yet" (`GET /api/commerce/connections` and
  `GET /api/commerce/onboarding/state` return `config.shopify`, booleans
  only), instead of failing after the redirect to Shopify.
* **Protected customer data.** Shopify redacts names, addresses, phones and
  e-mails (also in webhooks) until the app is approved for protected customer
  data (Level 2 for phone). Without it the connection reports
  `customer_phone: false` and no calling automation can be enabled: request
  the access in the Partner Dashboard before launch. Development stores and
  custom-distribution apps have it without review.
* Abandoned checkouts come from `checkouts/create|update` webhooks and the
  `abandonedCheckouts` query (under `read_orders`/`read_checkouts`); they are
  only usable when the phone is readable.

### Magento / Adobe Commerce and PrestaShop (polling)

* Magento: Admin → System → Integrations → *Add New Integration*; grant
  view access to Sales › Orders, Customers, Catalog › Products and Stores ›
  Configuration; activate and copy all four keys (Consumer Key, Consumer
  Secret, Access Token, Access Token Secret). With the four keys the
  connector signs every request with OAuth 1.0a (HMAC-SHA256); with the
  access token alone it sends a Bearer header, which Magento 2.4.4+ rejects
  unless `oauth/consumer/enable_integration_as_bearer` is enabled on the
  store. The connector validates
  with `GET /rest/V1/store/storeConfigs` and reads with `searchCriteria`
  paging (`pageSize=100`, `updated_at` filters for incremental passes). Open
  Source has no standard webhooks: data is refreshed every
  `COMMERCE_POLL_MINUTES` (default 15) and the connection says so. Abandoned
  carts are not available.
* PrestaShop: Advanced Parameters → Webservice → enable, add a key with GET on
  `orders, order_details, customers, addresses, products, stock_availables,
  order_states, configurations, currencies, countries`. Basic auth with the key
  as user name; JSON output; `date_upd` filters. No webhooks: polling as
  above. Dates are converted with the shop's `PS_TIMEZONE` when readable.

### Automation availability per platform

`automationAvailability()` (`lib/commerce/automations/config.ts`) hides an
automation when the connection cannot read orders, cannot read customer
phone numbers, or (abandoned cart) has no cart event source. The reason is
shown to the merchant in Romanian.

## 3. Custom connector contract (version 1)

Base URL = the store URL entered (https only, public host, port 443/8443;
see §6). Authentication: `bearer` (`Authorization: Bearer <token>`),
`api_key_header` (`<header name>: <token>`) or `basic` (`Authorization: Basic
base64(user:password)`). All responses are JSON.

| Endpoint | Response |
|---|---|
| `GET /health` | `{ ok: true, contract_version: "1", store: { name, currency, country, timezone, language? }, capabilities: { orders, customers, products, carts, webhooks } }` |
| `GET /orders?cursor=&limit=100&modified_after=<ISO>` | `{ items: Order[], next_cursor: string \| null }` |
| `GET /customers?…`, `GET /products?…`, `GET /carts?…` | same envelope with `Customer[]`, `Product[]`, `Cart[]` |

Record shapes (unknown fields ignored, lists capped at 100 per page):

* `Order { id, number, created_at, updated_at, status: pending|processing|on_hold|completed|cancelled|refunded|failed, financial_status: pending|paid|refunded|partially_refunded|voided, fulfillment_status: unfulfilled|partial|fulfilled|cancelled, payment_method, payment_method_title, is_cod, currency, total, customer: { id?, name, phone, email, country }, shipping: { city, country, summary }, items: [{ id, product_id?, sku?, name, quantity, unit_price?, total? }] }`
* `Customer { id, email?, first_name?, last_name?, phone?, country?, marketing_consent?, call_consent?, orders_count?, updated_at }`
* `Product { id, sku?, name, status?, price?, currency?, stock_status?, stock_quantity?, url?, updated_at }`
* `Cart { id, customer: { id?, name?, phone, email? }, items: [{ name, quantity }], total, currency, status: open|abandoned|recovered, abandoned_at?, recovered_order_id?, updated_at }`

Webhooks (optional, needs `webhook_secret` in the connect form): `POST` to the
connection's webhook URL with `X-NTV-Signature: sha256=<hex HMAC-SHA256(raw
body, secret)>`, `X-NTV-Event-Id` (unique), `X-NTV-Topic`
(`order.created|order.updated|product.updated|customer.updated|cart.updated`),
`X-NTV-Timestamp` (unix seconds, ±5 minutes), body `{ data: <record> }`.
The webhook URL is shown, with a copy button, on the connection card (Store →
Connections, onboarding step 3), with "Waiting for the first event" until a
verified delivery arrives. Until then, and whenever no verified delivery
arrived in the last 24 hours, the store keeps being polled every 15 minutes;
only then does it fall back to the hourly safety net (§7).

The connection test calls `GET /health` and the first page of `/orders`.

## 4. Automations

Three templates per connection (`commerce_automations`, one row per type):

| Type | Trigger | Default delay | Default window | Caps |
|---|---|---|---|---|
| `cod_confirmation` | order created/updated whose payment method is cash on delivery (`cod`, `cashondelivery`, `ps_cashondelivery`, titles matching *ramburs / cash on delivery / plata la livrare*, plus the merchant's list) and still open (not cancelled, paid, refunded or shipped) | 15 min | 09:00–20:00 Mon–Sat, store time zone | 50/day per automation, 1/day per customer, 2 dials per order, retry after 120 min |
| `abandoned_cart` | a cart/checkout event the store reports as `abandoned`, with the contact phone (platform capability); `open` carts (checkout in progress) and `expired` ones are never called | 60 min, never under 30 | same | one run per cart; cancelled when the customer orders, the cart is recovered or it is still open at dial time |
| `order_follow_up` | the order reaches the configured status (`fulfilled` = shipped/delivered or completed) | 24 h | same | same |

Enabling (`PUT /api/commerce/automations/[type]`) needs the consent
confirmation, the platform capability, a usable connection, the encryption
key and, once the organization has launched, an active agent and a number
that can place calls. Before launch (store onboarding step 4) the agent is
not active yet and no number can exist, so the automation is saved enabled
without those two; it starts calling once both exist, because dispatch
refuses every call while the agent is paused or no number can dial (a run
due before that ends `skipped` with the reason).

Eligibility (`lib/commerce/automations/eligibility.ts`, pure, re-checked at
dispatch): automation enabled **and** merchant consent confirmed; the
order/cart was created **after the automation was enabled** (an import never
dials historical orders); a phone number that normalizes to E.164; the
customer (or the number) is not on the do-not-call list; the order is still
open; minimum total when set; then the delay and the call window produce
`scheduled_for`. One run per automation and event (`idempotency_key`), one
active run per automation and order/cart (partial unique index).

Dispatch (`dispatch.ts`): the cron claims due runs atomically
(`commerce_claim_automation_runs`: `scheduled|retry_waiting → calling` with
a lease), re-checks every rule against the current rows (consent, enabled,
connection, do-not-call, order state, window, daily caps, plan minutes),
then calls `startOutboundCall({ orgId, toNumber, purpose: 'outbound',
commerceRunId, variables })`. The call row carries `commerce_run_id` and the
typed script values. A provider timeout or a connection lost before the
answer (ElevenLabs on a native number, Twilio `calls.create` on an
app-routed number: the call may already be ringing) leaves the run `calling`
with `dispatch_uncertain` and the call id: it is **never dialed again
automatically** unless a provider event later settles that call (a reported
no-answer retries as usual; a row still ringing hours later ends the run as
`failed` with `dispatch_uncertain`). Only an error the provider actually
answered with, or a failure before any connection was made, counts as a
definite dispatch failure (retried up to `max_attempts`); a run whose dispatch crashed before a
call id exists is settled as failed by the recovery sweep. A retry unlinks
the previous attempt's call before dialing. Preconditions the merchant must
fix (paused agent, no outbound number, used-up minutes) end the run as
`skipped` with the reason (`startOutboundCall` refuses them); provider failures retry up to `max_attempts` and
the run shows a generic Romanian message (the provider's or database's text
stays in the server log).

Reconciliation (`reconcile.ts`, from the post-call pipeline and a safety-net
sweep): only the run's current call (`call_id`) can settle it, a late or
replayed event for an earlier attempt is ignored. An outcome recorded by a
tool during the call wins (`confirmed`, `not_confirmed`,
`callback_requested`, `opted_out`); otherwise the call status decides
(`no_answer`, `voicemail`, `failed`, or `not_confirmed` for a conversation
that recorded nothing). Unanswered calls retry within the automation's
limits; the provider's call status stays on the call.

Consent: enabling needs the checkbox text stored as `consent_version`
`2026-10-v2` (bumped whenever the wording changes) with the user and time;
every campaign script and the baseline prompt disclose the AI assistant and
honor "nu mă mai sunați" through the
`mark_do_not_call` tool, which suppresses the customer (and guests by number)
immediately and cancels their queued runs.

## 5. The agent: prompt, variables and tools

* Store organizations get the Romanian baseline prompt
  (`lib/commerce/prompt.ts`, editable in onboarding/Agent) and, at sync time,
  the platform rules of `lib/voice-providers/prompt-commerce.ts`.
* Campaign calls carry typed variables resolved server-side
  (`lib/commerce/automations/variables.ts`): `call_reason`, `store_name`,
  `order_number`, `items_summary`, `order_total`, `customer_name`,
  `delivery_city`, `agent_name`. Scripts may only use these names; platform
  variables (`ntv_*`, `secret__*`) are rejected. ElevenLabs receives them as
  dynamic variables (placeholders with `call_reason = inbound` for calls the
  agent did not place, kept on every store agent even while the store is
  disconnected or in error, so the prompt never references a variable that
  has neither a value nor a placeholder); the Cartesia fallback reads them
  from `get_call_context`, which answers them only when the caller id of the
  request is the callee of that campaign call on that line (both numbers
  match, as for the store tool); a withheld or unknown caller id, or a call
  the customer placed themselves, gets `call_reason = inbound` and no order.
* Tools (`lib/commerce/tools/handlers.ts`), attached as ElevenLabs platform
  webhook tools (`elevenlabs.tool.commerce_*`) and as one Cartesia webhook tool
  `store_assistant` with an `action` parameter: `get_order_status`,
  `get_order_items`, `get_product_availability` (read-only),
  `record_cod_confirmation`, `record_callback_request`, `mark_do_not_call`
  (idempotent per call through `tool_invocations`, audited). On a campaign
  call the order is the run's order; on an inbound call the caller must give
  the order number **and** the full name on the order (or call from the
  order's number) before anything is disclosed, to `get_order_status` and
  again to `get_order_items` (nothing is kept between tool calls); a first
  name alone is answered with a request for the full name, and a mismatch
  never reveals whether the order exists. No tool cancels, refunds, edits
  addresses or takes payments.

## 6. Security

* SSRF guard (`lib/commerce/safe-fetch.ts`): https only, no credentials in
  the URL, ports 443/8443, no local names, IP literals and every resolved
  address checked against loopback/private/link-local/metadata/multicast
  ranges on each request, redirects never followed, timeouts and response
  size limits. DNS rebinding between the check and the connection cannot be
  excluded with the platform `fetch`; the per-request check and the port
  allow-list keep the surface small.
* Webhooks: raw bytes read once (1 MiB limit), signature compared in constant
  time, one idempotency row per `(connection, dedupe key)`, 2xx after the
  durable write, processing in the worker, per-connection delivery rate
  limit. Bodies, headers and credentials are never logged.
* RLS (migration 024): tenants `SELECT` their own mirrors, automations, runs
  and audit entries; every write goes through the routes; `commerce_sync_jobs`
  and `commerce_webhook_events` have no tenant privileges; the claim functions
  are plain functions executable by the service role only (no SECURITY
  DEFINER); `business_type`, `commerce_profile` and `calls.commerce_run_id`
  are guarded by triggers.
* Routes: `requireOrg()` + e-commerce check, `assertSameOrigin()` on every
  state change, Zod bodies with size limits, rate limits
  (`commerceConnect`, `commerceSync`, `commerceAutomationWrite`,
  `commerceRead`, `commerceWebhook`), DTOs without secrets, masked phone
  numbers and e-mails, cursor paging with bounded limits.

## 7. Jobs, scheduling, recovery, monitoring

The commerce worker (`lib/commerce/worker.ts`) is the `commerce` step of
`/api/cron/voice-maintenance` (bearer `CRON_SECRET`), so it runs with the
existing schedule: every 5 minutes with `supabase/ops/schedule_voice_maintenance.sql`
(pg_cron + pg_net) or on Vercel Pro, daily on Hobby without it. Each run,
within `COMMERCE_WORKER_BUDGET_MS` (default 45 s):

1. claims up to 25 verified webhook events (`commerce_claim_webhook_events`,
   90 s lease) and applies them; events the budget does not reach are handed
   back at once without counting an attempt;
2. claims up to 10 due runs and dispatches them (180 s lease); runs the
   budget does not reach are handed back undialed (`scheduled`, attempt
   refunded), never left `calling`;
3. claims up to 3 sync jobs (`commerce_claim_sync_jobs`, 120 s lease) and
   runs each for a 20 s slice (≤ 8 pages), persisting the checkpoint after
   every page and handing the job back as `pending` (attempt refunded: only
   failures and expired leases count toward `max_attempts`) to continue
   next tick; the per-resource watermark of every finished resource reaches
   the connection's `sync_cursor` (merged key by key) when the job succeeds;
4. queues an incremental `all` job for every active connection whose last
   sync is older than its polling interval (an hourly safety net only for
   stores whose webhooks are known to work: registered through the platform
   API, or a verified merchant-sent delivery within the last 24 hours;
   otherwise the platform's interval, 15 minutes by default), settles
   dispatches whose lease expired without a
   call id, reconciles calls whose post-call event was lost, re-wraps
   credentials still under a previous key version, and once a day
   runs retention.

The first import does not wait for a tick: right after a connect (keys or
the Shopify callback) the route runs one slice of the queued job after its
response (`next/server` `after()`, `kickInitialSync` in `lib/commerce/sync.ts`).
It claims the job by id with the same lease a worker claim takes (a
compare-and-set on status and attempt count), so a tick running at the same
moment never runs it twice; what the slice leaves pending continues on the
next ticks.

Backoff: transient failures retry with 1, 2, 4… minutes (±20 %, max 60) up to
`max_attempts`; invalid credentials, forbidden scopes and malformed mappings
fail at once and put the connection in `error` (reconnect) or `degraded`
(retrying). Expired leases are claimable again (crash recovery). Every claim
uses `FOR UPDATE SKIP LOCKED`, so overlapping cron runs never process the
same row twice.

Monitoring: the store overview lists problems with links (expired
credentials, webhook registration failures, sync errors, missing number, no consent,
paused agent, exhausted minutes, encryption not configured); the audit log
(`/api/commerce/audit`) records connect/disconnect/sync/enable/queue/suppress
and every call start and result; logs use the `commerce.*` events with
org/connection/run ids and never a number in the clear.

## 8. Retention, PII and opt-out

* Mirrors live as long as the connection; *Disconnect* erases credentials
  and webhooks and pauses automations but keeps data; *Delete store data*
  (Store → Settings) removes the connection and everything under it (cascade).
* Webhook payloads are cleared once processed (a delivery still queued keeps
  its body until it is processed) and purged after
  `COMMERCE_WEBHOOK_PAYLOAD_RETENTION_DAYS` (7); processed events after 90
  days; the number dialed by a settled run after `COMMERCE_RUN_PHONE_RETENTION_DAYS`
  (90); finished sync jobs after 30 days; audit entries after 365 days.
* Do-not-call: set by the customer on a call (`mark_do_not_call`), by an
  operator (Customers → *Do not call*), never cleared by an import; lifting it
  is an explicit operator action with a reason, audited (Store → Do-not-call list).
* Order addresses are kept as a one-line summary and city only; the agent
  confirms the delivery city, never reads a full address unless asked.

## 9. Runbook

| Symptom | Where to look | Action |
|---|---|---|
| Connection `error` | overview problems, audit `sync.failed` | reconnect with new keys / re-authorize Shopify |
| Connection `degraded` | `error_message`, `commerce_sync_jobs` | transient; retried with backoff; check the store's availability |
| Webhooks not arriving | logs `commerce.webhook.rejected` (reason), `webhook_config.last_delivery_at`, `last_error` (registration) | secret rotated on the store? reconnect; WooCommerce disables after 5 failures |
| Runs stay `scheduled` | the cron runs? `maintenance_state`, Vercel/pg_cron logs | schedule the maintenance (§7); check the call window/time zone |
| Runs `skipped` | `error_code` (`no_phone_number`, `agent_inactive`, `minutes_exhausted`) | fix the precondition; the next eligible event creates a new run |
| Run `failed` with `dispatch_uncertain` | audit `run.failed` | check Calls for a call to that number before any manual re-dial |
| Key rotation | `commerce_connections.credential_key_version` | set the new key, bump `COMMERCE_CREDENTIALS_KEY_VERSION`, keep the old one in `..._PREVIOUS`; the maintenance cron re-wraps every readable connection under the new key (a manual *Test* does the same for one connection); remove `..._PREVIOUS` only once no row has `credential_key_version` below the current version. A row left behind (two rotations without the cron running in between) shows `credentials_unreadable` and needs a reconnect |

## 10. Local testing and dummy stores

* Unit tests: `npm test` covers encryption, SSRF, adapters (signatures over
  raw bytes, failure classes, capability reporting), ingestion and
  idempotency, upserts and tenant boundaries, eligibility, scheduling,
  dispatch (atomic claim, uncertain result, retries), reconciliation, tools
  (authorization by call/org/order), route ownership and the migration.
* Migration 024 was verified on PostgreSQL 16 with Supabase-like roles
  (001–024, then 024 twice; backfill once; tenant reads scoped; writes and
  the credential column refused; claims and uniqueness as designed).
* A dummy WooCommerce: any WordPress + WooCommerce on a public https host
  (a tunnel works) with a Read/Write key; place a test order with payment
  method *Cash on delivery* and a phone in your own number's format. Enable
  the COD automation with consent, keep the delay at 15 minutes and the
  window open; the run appears under Store → Automations, then dials your number
  from the org's outbound-capable line at the scheduled time. No automated
  test places a real call: the live check is this manual flow.
* Shopify: a development store with the app installed has protected
  customer data without review.
* Custom: a few lines of Express implementing §3 behind https.

## 11. Plans and billing

* **Two plan families, one trial.** `organizations.plan` (CHECK of migration
  026) holds the service plans (`starter`, `pro`, `business`, `custom`) or the
  store plans (`store_starter` $100, `store_growth` $250, `store_scale` $500,
  `store_enterprise` from $1,000 a month, sales-led; annual = ten months).
  `PLANS` in `types/index.ts` is the source of truth (prices, minutes, the
  extra-minute price `overage_per_min`, `family`). An online store may hold
  only the trial or a store plan, every other organization only the trial or
  a service plan: `planAllowedFor` is
  enforced by `POST /api/billing/checkout` and `POST /api/onboarding/complete`
  (409 `plan_not_available`), and the billing page and the launch step show
  `plansForBusinessType(org.business_type)` only.
* **Minutes.** Store plans work like the others (`docs/billing.md`): included
  minutes per billing period (350 / 950 / 2,000 / 4,500, about 1.5 minutes per
  order-confirmation call), reset on each Stripe renewal, then a hard cap.
  Past the included minutes, calls draw on prepaid extra minutes: packs of
  100 / 500 / 1,000 / 2,500 bought on the billing page (`/billing#minutes`) at
  the plan's extra-minute price ($0.25 Store Starter, $0.22 Store Growth,
  $0.20 Store Scale, $0.18 Store Enterprise) less 0 / 4 / 8 / 12%, or bought
  automatically by auto top-up. Nothing is billed after the fact.
* **Automations out of minutes.** When the organization has no minutes left
  (included and extra, `lib/telephony/quota.ts`), a due run is not dialed:
  dispatch defers it (tried again every 30 minutes inside the call window,
  `minutes_wait_since`) for up to 24 hours after its scheduled time, then
  skips it with the reason `minutes_exhausted`. The overview shows the
  problem `minutes_exhausted` with "Buy minutes" (`/billing#minutes`); the
  owner also gets the "out of minutes" e-mail once per period. Auto top-up
  runs in the maintenance cron before the automations dial, so an
  organization with it on rarely reaches this state.
* **Capacity and entitlements.** Call concurrency and entitlements of a store
  plan are those of its service equivalent: the listed service plan priced
  nearest (Store Starter: Growth, which has Starter's; Store Growth: Pro;
  Store Scale: Business), and Enterprise for Store Enterprise
  (`lib/pages/entitlements.ts` `STORE_PLAN_EQUIVALENT`, `call-limits.ts`).
* **Plan changes.** A store with an active store-plan subscription switches
  plans in place (prorated, `POST /api/billing/checkout` answers
  `{ updated: true, plan }`); a new subscription goes through Stripe
  Checkout.
* **No manual Stripe setup.** No plan needs a price id in the env, service
  or store: `ensurePlanPriceId` (`lib/stripe/store-prices.ts`) uses an env pin
  (`STRIPE_<PLAN>[_ANNUAL]_PRICE_ID`) only while Stripe reports it bills
  exactly the `PLANS` price and it is tagged `metadata.ntv_plan` for the plan
  (on the price, else on its product), otherwise the Stripe price carrying the lookup
  key `ntv_<plan>_<month|year>`, otherwise it creates the product (metadata
  `ntv_plan`, name and description from `PLANS`) and a recurring USD price
  with that lookup key and metadata `{ ntv_plan, ntv_interval }`. Both creates
  carry a Stripe idempotency key derived from the plan and the amount, so two
  cold lambdas racing on the first checkout share one product and one price
  (details: `docs/billing.md`, section 2). Checkout also stamps `ntv_plan` on
  the subscription. The billing webhook resolves the plan from the env price
  map, then the price itself (`resolvePlanFromPrice`: its metadata, then its
  lookup key), and only then the subscription's `ntv_plan`: Stripe never
  rewrites that stamp when the price changes (Customer Portal plan switch), so
  the price must win. A price nobody tagged resets the organization to the
  trial as before.


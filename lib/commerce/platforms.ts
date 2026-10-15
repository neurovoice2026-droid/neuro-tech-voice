// The store platforms as the UI presents them (client-safe: names, merchant
// copy, what each connector reads, the fields of its connect form). The
// server-side truth about what a connection can do is its stored
// capabilities (lib/commerce/adapters/*): this catalog only describes.

import type { CommercePlatform } from './types'

export interface ConnectField {
  key: string
  label: string
  /** 'secret' fields are never echoed back after submission. */
  type: 'text' | 'url' | 'secret' | 'select'
  placeholder?: string
  help?: string
  required: boolean
  options?: Array<{ value: string; label: string }>
}

export interface PlatformDescriptor {
  id: CommercePlatform
  name: string
  /** One line under the card title. */
  tagline: string
  /** How the connection works, in plain English. */
  howItWorks: string
  /** What the connector reads from the store. */
  reads: string[]
  /** Truthful limits shown on the card before connecting. */
  limits: string[]
  /** 'credentials' = a form with keys; 'oauth' = a redirect to the platform. */
  connectMode: 'credentials' | 'oauth'
  fields: ConnectField[]
  /** Step-by-step instructions for the merchant (keys, permissions). */
  instructions: string[]
  docsUrl: string
}

export const PLATFORM_CATALOG: Record<CommercePlatform, PlatformDescriptor> = {
  woocommerce: {
    id: 'woocommerce',
    name: 'WooCommerce (WordPress)',
    tagline: 'REST API keys; orders, customers and products in real time through webhooks.',
    howItWorks:
      'You create a REST API key pair with read/write permissions in WooCommerce. The platform reads orders, customers and products and registers signed webhooks for new orders and updates.',
    reads: ['Orders (payment method, status, total, items, contact phone)', 'Customers (name, phone, email)', 'Products (name, SKU, price, stock)'],
    limits: ['Abandoned carts are not part of the standard WooCommerce API: the automation appears only once code on your store (a companion plugin) sends cart events to the connection’s webhook address, as the documentation describes.'],
    connectMode: 'credentials',
    fields: [
      { key: 'store_url', label: 'Store URL', type: 'url', placeholder: 'https://your-store.com', required: true, help: 'HTTPS only.' },
      { key: 'consumer_key', label: 'Consumer key', type: 'secret', placeholder: 'ck_…', required: true },
      { key: 'consumer_secret', label: 'Consumer secret', type: 'secret', placeholder: 'cs_…', required: true },
    ],
    instructions: [
      'In WordPress: WooCommerce → Settings → Advanced → REST API → Add key.',
      'Description: “Neuro Tech Voice”, Permissions: Read/Write (required for webhooks).',
      'Copy the Consumer key and Consumer secret here. You will not be able to see them again after saving.',
    ],
    docsUrl: 'https://woocommerce.com/document/woocommerce-rest-api/',
  },
  shopify: {
    id: 'shopify',
    name: 'Shopify',
    tagline: 'Installed through OAuth; orders, customers, products and abandoned checkouts through webhooks.',
    howItWorks:
      'You are sent to Shopify to approve the app (read permissions). The platform receives an encrypted offline token and registers webhooks for orders, customers, products and checkouts.',
    reads: ['Orders (payment gateway, financial and fulfillment status, total, items, phone)', 'Customers (name, phone, email, marketing consent)', 'Products (name, SKU, price, stock)', 'Abandoned checkouts (if the app has access to contact details)'],
    limits: ['Customer phone numbers and addresses require Shopify’s “protected customer data” approval for the app; without it, automated calls cannot be enabled.'],
    connectMode: 'oauth',
    fields: [{ key: 'shop_domain', label: 'Store domain', type: 'text', placeholder: 'your-store.myshopify.com', required: true }],
    instructions: ['Enter the store’s myshopify.com domain and press “Continue in Shopify”.', 'Approve the requested permissions; you will be brought back here automatically.'],
    docsUrl: 'https://shopify.dev/docs/apps/build/authentication-authorization',
  },
  magento: {
    id: 'magento',
    name: 'Magento / Adobe Commerce',
    tagline: 'Integration keys; periodic sync of orders, customers and products.',
    howItWorks:
      'You create an Integration in the Magento admin and copy its four keys (Consumer Key, Consumer Secret, Access Token, Access Token Secret). The platform reads orders, customers and products through REST and refreshes them periodically (polling).',
    reads: ['Orders (payment method, status, total, items, phone)', 'Customers (name, phone, email)', 'Products (name, SKU, price, stock)'],
    limits: ['Magento Open Source has no standard webhooks: data arrives with a delay of a few minutes (the sync interval is shown).', 'Abandoned carts are not available without a dedicated module.'],
    connectMode: 'credentials',
    fields: [
      { key: 'store_url', label: 'Store URL', type: 'url', placeholder: 'https://your-store.com', required: true },
      { key: 'access_token', label: 'Access token (Integration)', type: 'secret', required: true },
      {
        key: 'consumer_key',
        label: 'Consumer key',
        type: 'secret',
        required: false,
        help: 'Magento 2.4.4+ does not accept the token alone (Bearer) unless that is explicitly enabled; fill in Consumer key, Consumer secret and Access token secret together for OAuth signing.',
      },
      { key: 'consumer_secret', label: 'Consumer secret', type: 'secret', required: false },
      { key: 'access_token_secret', label: 'Access token secret', type: 'secret', required: false },
    ],
    instructions: [
      'Admin → System → Extensions → Integrations → Add New Integration.',
      'Resources: Sales → Operations → Orders (view), Customers → All Customers (view), Catalog → Products (view), Stores → Settings → Configuration (view).',
      'Activate the integration and copy the Consumer Key, Consumer Secret, Access Token and Access Token Secret.',
      'Only if the store has “enable_integration_as_bearer” turned on is the Access Token alone enough.',
    ],
    docsUrl: 'https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-token/',
  },
  prestashop: {
    id: 'prestashop',
    name: 'PrestaShop',
    tagline: 'Webservice key; periodic sync of orders, customers and products.',
    howItWorks:
      'You enable the PrestaShop Webservice and create a key with read permissions. The platform reads orders, customers, addresses and products and refreshes them periodically (polling).',
    reads: ['Orders (payment module, state, total, items)', 'Customers and addresses (name, phone, email)', 'Products (name, reference, price, stock)'],
    limits: ['PrestaShop has no standard webhooks: data arrives with a delay of a few minutes.', 'Abandoned carts are not available without a dedicated module.'],
    connectMode: 'credentials',
    fields: [
      { key: 'store_url', label: 'Store URL', type: 'url', placeholder: 'https://your-store.com', required: true },
      { key: 'webservice_key', label: 'Webservice key', type: 'secret', required: true },
    ],
    instructions: [
      'Admin → Advanced Parameters → Webservice → enable the Webservice.',
      'Add a key with GET permissions on: orders, customers, addresses, products, order_details, order_states, configurations.',
      'Copy the key here.',
    ],
    docsUrl: 'https://devdocs.prestashop-project.org/8/webservice/',
  },
  custom: {
    id: 'custom',
    name: 'Custom store (API)',
    tagline: 'Documented JSON REST connector, with a connection test and signed webhooks.',
    howItWorks:
      'You expose three JSON endpoints on your store (orders, customers, products) following the documented contract and, optionally, send HMAC-SHA256 signed webhooks. The platform reads them with the authentication you choose.',
    reads: ['Orders, customers and products in the documented format (docs/commerce-integrations.md)'],
    limits: ['There is no automatic discovery: the endpoints must follow the contract.', 'Abandoned carts appear only if you implement the cart.updated event with the customer phone number.'],
    connectMode: 'credentials',
    fields: [
      { key: 'store_url', label: 'API base URL', type: 'url', placeholder: 'https://api.your-store.com/ntv', required: true },
      {
        key: 'auth_scheme',
        label: 'Authentication',
        type: 'select',
        required: true,
        options: [
          { value: 'bearer', label: 'Bearer token' },
          { value: 'api_key_header', label: 'API key in a header' },
          { value: 'basic', label: 'Basic (user:password)' },
        ],
      },
      { key: 'auth_header_name', label: 'Header name (for an API key in a header)', type: 'text', placeholder: 'X-API-Key', required: false },
      { key: 'auth_token', label: 'Token / key / user:password', type: 'secret', required: true },
      { key: 'webhook_secret', label: 'Webhook secret (optional)', type: 'secret', required: false, help: 'If the store sends webhooks, sign them with HMAC-SHA256 using this secret.' },
    ],
    instructions: ['Implement the endpoints from the documentation (GET /orders, /customers, /products with cursor pagination).', 'The connection test calls GET /health and the first page of /orders.'],
    docsUrl: 'https://github.com/neurovoice2026-droid/neuro-tech-voice/blob/main/docs/commerce-integrations.md#3-custom-connector-contract-version-1',
  },
}

export const PLATFORM_ORDER: readonly CommercePlatform[] = ['woocommerce', 'shopify', 'magento', 'prestashop', 'custom']

/**
 * Why a platform cannot be connected on a deployment that lacks its setup
 * (GET /api/commerce/connections and the onboarding state report it in
 * `config`): its card is shown disabled with this note, before any redirect.
 */
export const PLATFORM_UNAVAILABLE_NOTE: Partial<Record<CommercePlatform, string>> = {
  shopify: 'The Shopify app is not set up on this platform yet. Choose another platform, or contact support.',
}

export function platformName(platform: string | null | undefined): string {
  return platform && Object.hasOwn(PLATFORM_CATALOG, platform) ? PLATFORM_CATALOG[platform as CommercePlatform].name : 'Store'
}

// The store platforms as the UI presents them (client-safe: names, Romanian
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
  /** How the connection works, in plain Romanian. */
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
    tagline: 'Chei REST API; comenzi, clienți și produse în timp real prin webhook-uri.',
    howItWorks:
      'Creezi o pereche de chei REST API cu drepturi de citire/scriere în WooCommerce. Platforma citește comenzile, clienții și produsele și înregistrează webhook-uri semnate pentru comenzi noi și actualizări.',
    reads: ['Comenzi (metodă de plată, status, total, produse, telefonul de contact)', 'Clienți (nume, telefon, e-mail)', 'Produse (nume, SKU, preț, stoc)'],
    limits: ['Coșurile abandonate nu există în API-ul standard WooCommerce: automatizarea apare doar dacă instalezi plugin-ul companion documentat.'],
    connectMode: 'credentials',
    fields: [
      { key: 'store_url', label: 'Adresa magazinului', type: 'url', placeholder: 'https://magazinul-tau.ro', required: true, help: 'Doar HTTPS.' },
      { key: 'consumer_key', label: 'Consumer key', type: 'secret', placeholder: 'ck_…', required: true },
      { key: 'consumer_secret', label: 'Consumer secret', type: 'secret', placeholder: 'cs_…', required: true },
    ],
    instructions: [
      'În WordPress: WooCommerce → Setări → Avansat → REST API → Adaugă cheie.',
      'Descriere: „Neuro Tech Voice”, Permisiuni: Citire/Scriere (necesar pentru webhook-uri).',
      'Copiază Consumer key și Consumer secret aici. Nu le vei mai putea vedea după salvare.',
    ],
    docsUrl: 'https://woocommerce.com/document/woocommerce-rest-api/',
  },
  shopify: {
    id: 'shopify',
    name: 'Shopify',
    tagline: 'Instalare prin OAuth; comenzi, clienți, produse și checkout-uri abandonate prin webhook-uri.',
    howItWorks:
      'Ești trimis în Shopify ca să aprobi aplicația (permisiuni de citire). Platforma primește un token offline, criptat, și înregistrează webhook-uri pentru comenzi, clienți, produse și checkout-uri.',
    reads: ['Comenzi (gateway de plată, status financiar și de livrare, total, produse, telefon)', 'Clienți (nume, telefon, e-mail, acord marketing)', 'Produse (nume, SKU, preț, stoc)', 'Checkout-uri abandonate (dacă aplicația are acces la datele de contact)'],
    limits: ['Telefonul și adresa clienților necesită aprobarea Shopify pentru „protected customer data” pe aplicație; fără ea, apelurile automate nu pot fi activate.'],
    connectMode: 'oauth',
    fields: [{ key: 'shop_domain', label: 'Domeniul magazinului', type: 'text', placeholder: 'magazinul-tau.myshopify.com', required: true }],
    instructions: ['Introdu domeniul myshopify.com al magazinului și apasă „Continuă în Shopify”.', 'Aprobă permisiunile cerute; vei fi adus înapoi aici automat.'],
    docsUrl: 'https://shopify.dev/docs/apps/build/authentication-authorization',
  },
  magento: {
    id: 'magento',
    name: 'Magento / Adobe Commerce',
    tagline: 'Chei de integrare; sincronizare periodică a comenzilor, clienților și produselor.',
    howItWorks:
      'Creezi o Integrare în adminul Magento și copiezi cele patru chei (Consumer Key, Consumer Secret, Access Token, Access Token Secret). Platforma citește comenzile, clienții și produsele prin REST și le reîmprospătează periodic (polling).',
    reads: ['Comenzi (metodă de plată, status, total, produse, telefon)', 'Clienți (nume, telefon, e-mail)', 'Produse (nume, SKU, preț, stoc)'],
    limits: ['Magento Open Source nu are webhook-uri standard: datele ajung cu o întârziere de câteva minute (interval de sincronizare afișat).', 'Coșurile abandonate nu sunt disponibile fără un modul dedicat.'],
    connectMode: 'credentials',
    fields: [
      { key: 'store_url', label: 'Adresa magazinului', type: 'url', placeholder: 'https://magazinul-tau.ro', required: true },
      { key: 'access_token', label: 'Access token (Integrare)', type: 'secret', required: true },
      {
        key: 'consumer_key',
        label: 'Consumer key',
        type: 'secret',
        required: false,
        help: 'Magento 2.4.4+ nu acceptă token-ul singur (Bearer) decât dacă e activat explicit; completează Consumer key, Consumer secret și Access token secret împreună pentru semnarea OAuth.',
      },
      { key: 'consumer_secret', label: 'Consumer secret', type: 'secret', required: false },
      { key: 'access_token_secret', label: 'Access token secret', type: 'secret', required: false },
    ],
    instructions: [
      'Admin → System → Extensions → Integrations → Add New Integration.',
      'Resurse: Sales → Operations → Orders (view), Customers → All Customers (view), Catalog → Products (view), Stores → Settings → Configuration (view).',
      'Activează integrarea și copiază Consumer Key, Consumer Secret, Access Token și Access Token Secret.',
      'Doar dacă magazinul are activat „enable_integration_as_bearer”, Access Token singur este suficient.',
    ],
    docsUrl: 'https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-token/',
  },
  prestashop: {
    id: 'prestashop',
    name: 'PrestaShop',
    tagline: 'Cheie Webservice; sincronizare periodică a comenzilor, clienților și produselor.',
    howItWorks:
      'Activezi Webservice-ul PrestaShop și creezi o cheie cu drepturi de citire. Platforma citește comenzile, clienții, adresele și produsele și le reîmprospătează periodic (polling).',
    reads: ['Comenzi (modul de plată, stare, total, produse)', 'Clienți și adrese (nume, telefon, e-mail)', 'Produse (nume, referință, preț, stoc)'],
    limits: ['PrestaShop nu are webhook-uri standard: datele ajung cu o întârziere de câteva minute.', 'Coșurile abandonate nu sunt disponibile fără un modul dedicat.'],
    connectMode: 'credentials',
    fields: [
      { key: 'store_url', label: 'Adresa magazinului', type: 'url', placeholder: 'https://magazinul-tau.ro', required: true },
      { key: 'webservice_key', label: 'Cheie Webservice', type: 'secret', required: true },
    ],
    instructions: [
      'Admin → Parametri avansați → Webservice → activează Webservice-ul.',
      'Adaugă o cheie cu drepturi GET pe: orders, customers, addresses, products, order_details, order_states, configurations.',
      'Copiază cheia aici.',
    ],
    docsUrl: 'https://devdocs.prestashop-project.org/8/webservice/',
  },
  custom: {
    id: 'custom',
    name: 'Magazin personalizat (API)',
    tagline: 'Conector JSON REST documentat, cu test de conexiune și webhook semnat.',
    howItWorks:
      'Expui pe magazinul tău trei endpoint-uri JSON (comenzi, clienți, produse) conform contractului documentat și, opțional, trimiți webhook-uri semnate HMAC-SHA256. Platforma le citește cu autentificarea aleasă.',
    reads: ['Comenzi, clienți și produse în formatul documentat (docs/commerce-integrations.md)'],
    limits: ['Nu există descoperire automată: endpoint-urile trebuie să respecte contractul.', 'Coșurile abandonate apar doar dacă implementezi evenimentul cart.updated cu telefonul clientului.'],
    connectMode: 'credentials',
    fields: [
      { key: 'store_url', label: 'Adresa de bază a API-ului', type: 'url', placeholder: 'https://api.magazinul-tau.ro/ntv', required: true },
      {
        key: 'auth_scheme',
        label: 'Autentificare',
        type: 'select',
        required: true,
        options: [
          { value: 'bearer', label: 'Bearer token' },
          { value: 'api_key_header', label: 'Cheie în header' },
          { value: 'basic', label: 'Basic (utilizator:parolă)' },
        ],
      },
      { key: 'auth_header_name', label: 'Numele header-ului (pentru cheie în header)', type: 'text', placeholder: 'X-API-Key', required: false },
      { key: 'auth_token', label: 'Token / cheie / utilizator:parolă', type: 'secret', required: true },
      { key: 'webhook_secret', label: 'Secret webhook (opțional)', type: 'secret', required: false, help: 'Dacă magazinul trimite webhook-uri, semnează-le HMAC-SHA256 cu acest secret.' },
    ],
    instructions: ['Implementează endpoint-urile din documentație (GET /orders, /customers, /products cu paginare prin cursor).', 'Testul de conexiune apelează GET /health și prima pagină din /orders.'],
    docsUrl: 'https://github.com/neurovoice2026-droid/neuro-tech-voice/blob/main/docs/commerce-integrations.md#3-custom-connector-contract-version-1',
  },
}

export const PLATFORM_ORDER: readonly CommercePlatform[] = ['woocommerce', 'shopify', 'magento', 'prestashop', 'custom']

export function platformName(platform: string | null | undefined): string {
  return platform && Object.hasOwn(PLATFORM_CATALOG, platform) ? PLATFORM_CATALOG[platform as CommercePlatform].name : 'Magazin'
}

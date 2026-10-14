// Romanian copy tables of the store onboarding: statuses, capabilities, the
// form's option lists and the reasons our routes return. Pure data.

import type { StatusTone } from '@/components/shared/StatusChip'
import type { AutomationConfig, AutomationType, CommerceCapabilities, ConnectionStatus, SyncJobStatus } from '@/lib/commerce/types'

// ─── Step 1 option lists ──────────────────────────────────────────────────────

export const COUNTRIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'RO', label: 'România' },
  { value: 'MD', label: 'Republica Moldova' },
  { value: 'HU', label: 'Ungaria' },
  { value: 'BG', label: 'Bulgaria' },
  { value: 'DE', label: 'Germania' },
  { value: 'AT', label: 'Austria' },
  { value: 'IT', label: 'Italia' },
  { value: 'ES', label: 'Spania' },
  { value: 'FR', label: 'Franța' },
  { value: 'GB', label: 'Regatul Unit' },
  { value: 'IE', label: 'Irlanda' },
  { value: 'NL', label: 'Țările de Jos' },
  { value: 'BE', label: 'Belgia' },
  { value: 'PL', label: 'Polonia' },
  { value: 'CZ', label: 'Cehia' },
  { value: 'SK', label: 'Slovacia' },
  { value: 'GR', label: 'Grecia' },
  { value: 'PT', label: 'Portugalia' },
  { value: 'SE', label: 'Suedia' },
  { value: 'DK', label: 'Danemarca' },
  { value: 'NO', label: 'Norvegia' },
  { value: 'FI', label: 'Finlanda' },
  { value: 'CH', label: 'Elveția' },
  { value: 'TR', label: 'Turcia' },
  { value: 'US', label: 'Statele Unite' },
  { value: 'CA', label: 'Canada' },
]

export const TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Europe/Bucharest', label: 'Europe/Bucharest (România)' },
  { value: 'Europe/Chisinau', label: 'Europe/Chisinau (Moldova)' },
  { value: 'Europe/Budapest', label: 'Europe/Budapest' },
  { value: 'Europe/Sofia', label: 'Europe/Sofia' },
  { value: 'Europe/Athens', label: 'Europe/Athens' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw' },
  { value: 'Europe/Prague', label: 'Europe/Prague' },
  { value: 'Europe/Vienna', label: 'Europe/Vienna' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Europe/Rome', label: 'Europe/Rome' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam' },
  { value: 'Europe/Brussels', label: 'Europe/Brussels' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich' },
  { value: 'Europe/Stockholm', label: 'Europe/Stockholm' },
  { value: 'Europe/Copenhagen', label: 'Europe/Copenhagen' },
  { value: 'Europe/Oslo', label: 'Europe/Oslo' },
  { value: 'Europe/Helsinki', label: 'Europe/Helsinki' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Dublin', label: 'Europe/Dublin' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Chicago', label: 'America/Chicago' },
  { value: 'America/Denver', label: 'America/Denver' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'America/Toronto', label: 'America/Toronto' },
  { value: 'UTC', label: 'UTC' },
]

export const CURRENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'RON', label: 'RON – leu românesc' },
  { value: 'EUR', label: 'EUR – euro' },
  { value: 'MDL', label: 'MDL – leu moldovenesc' },
  { value: 'USD', label: 'USD – dolar american' },
  { value: 'GBP', label: 'GBP – liră sterlină' },
  { value: 'HUF', label: 'HUF – forint' },
  { value: 'BGN', label: 'BGN – leva' },
  { value: 'PLN', label: 'PLN – zlot' },
  { value: 'CZK', label: 'CZK – coroană cehă' },
  { value: 'CHF', label: 'CHF – franc elvețian' },
]

/** Romanian names of the agent languages (lib/agent-languages.ts keeps the English ones). */
export const LANGUAGE_LABELS_RO: Record<string, string> = {
  en: 'Engleză',
  ro: 'Română',
  es: 'Spaniolă',
  fr: 'Franceză',
  de: 'Germană',
  it: 'Italiană',
  pt: 'Portugheză',
  pl: 'Poloneză',
  nl: 'Neerlandeză',
  ja: 'Japoneză',
  ko: 'Coreeană',
  zh: 'Chineză (mandarină)',
  ar: 'Arabă',
  hi: 'Hindi',
}

// ─── Connections ──────────────────────────────────────────────────────────────

export const CONNECTION_STATUS: Record<ConnectionStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Neconectat', tone: 'muted' },
  connecting: { label: 'Se conectează', tone: 'info' },
  active: { label: 'Activ', tone: 'success' },
  degraded: { label: 'Parțial funcțional', tone: 'warning' },
  disconnected: { label: 'Deconectat', tone: 'muted' },
  error: { label: 'Eroare', tone: 'danger' },
}

export const SYNC_STATUS: Record<SyncJobStatus | 'idle', string> = {
  idle: 'Nicio sincronizare în curs',
  pending: 'Sincronizare în așteptare',
  running: 'Sincronizare în curs',
  succeeded: 'Sincronizare finalizată',
  failed: 'Sincronizarea a eșuat',
  cancelled: 'Sincronizare anulată',
}

export const CAPABILITY_LABELS: ReadonlyArray<{ key: keyof Pick<CommerceCapabilities, 'orders' | 'customers' | 'products' | 'webhooks' | 'abandoned_carts' | 'customer_phone'>; label: string }> = [
  { key: 'orders', label: 'Comenzi' },
  { key: 'customers', label: 'Clienți' },
  { key: 'products', label: 'Produse' },
  { key: 'customer_phone', label: 'Telefonul clienților' },
  { key: 'webhooks', label: 'Evenimente în timp real (webhook-uri)' },
  { key: 'abandoned_carts', label: 'Coșuri abandonate' },
]

/** Codes the Shopify callback may append as ?commerce_error=; anything else gets the generic line. */
export const OAUTH_ERRORS: Record<string, string> = {
  access_denied: 'Instalarea a fost refuzată în Shopify. Poți încerca din nou când ești gata.',
  invalid_shop: 'Domeniul magazinului nu este un domeniu myshopify.com valid.',
  state_mismatch: 'Sesiunea de instalare a expirat. Pornește din nou conectarea.',
  hmac_invalid: 'Răspunsul primit de la Shopify nu a putut fi verificat. Pornește din nou conectarea.',
  not_configured: 'Conectarea cu Shopify nu este configurată pe această platformă.',
  token_exchange_failed: 'Shopify nu a emis un token de acces. Încearcă din nou.',
  unreachable: 'Shopify nu a răspuns. Încearcă din nou în câteva momente.',
}

export function oauthErrorMessage(code: string): string {
  return OAUTH_ERRORS[code] ?? `Conectarea cu Shopify nu a reușit (cod: ${code.slice(0, 40)}).`
}

// ─── Automations ──────────────────────────────────────────────────────────────

export const AUTOMATION_TITLES: Record<AutomationType, string> = {
  cod_confirmation: 'Confirmarea comenzilor ramburs',
  abandoned_cart: 'Recuperarea coșurilor abandonate',
  order_follow_up: 'Follow-up după livrare/status',
}

export const AUTOMATION_DESCRIPTIONS: Record<AutomationType, string> = {
  cod_confirmation: 'Sună clienții cu comenzi noi plătite ramburs ca să confirme comanda înainte de expediere.',
  abandoned_cart: 'Sună clienții care au lăsat un coș neterminat și au telefonul în comandă, după un interval de așteptare.',
  order_follow_up: 'Sună clienții după ce comanda ajunge la statusul ales, ca să verifice că totul este în regulă.',
}

export const CONSENT_TEXT =
  'Confirm că am temei legal și acordul clienților pentru a fi contactați telefonic de magazin, inclusiv prin asistent AI, și că voi respecta cererile de a nu mai fi sunați.'

/** Why PUT /api/commerce/automations/[type] refused to enable (details.reason). */
export const AUTOMATION_ENABLE_REASONS: Record<string, string> = {
  no_consent: 'Bifează mai întâi confirmarea temeiului legal.',
  unavailable: 'Această automatizare nu este disponibilă pe platforma magazinului tău.',
  agent_inactive: 'Agentul nu este încă activ. O poți activa după lansare, din Magazin → Automatizări.',
  no_phone_number: 'Nu există încă un număr de telefon pentru apeluri. O poți activa după lansare, când ai un număr.',
  encryption_not_configured: 'Criptarea credențialelor nu este configurată pe platformă.',
  connection_inactive: 'Conexiunea cu magazinul nu este activă.',
}

const DAY_LABELS: Record<string, string> = { mon: 'Lu', tue: 'Ma', wed: 'Mi', thu: 'Jo', fri: 'Vi', sat: 'Sâ', sun: 'Du' }

export function formatDays(days: string[]): string {
  if (!days.length) return 'nicio zi'
  return days.map((d) => DAY_LABELS[d.toLowerCase().slice(0, 3)] ?? d).join(', ')
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const ORDER_STATUS_RO: Record<string, string> = {
  pending: 'în așteptare',
  processing: 'în procesare',
  on_hold: 'în așteptare (on hold)',
  completed: 'finalizată',
  fulfilled: 'livrată',
  cancelled: 'anulată',
  refunded: 'rambursată',
  failed: 'eșuată',
  draft: 'ciornă',
  unknown: 'necunoscut',
}

/** Trigger / contact-rule lines of an automation card, from its config. */
export function automationRules(type: AutomationType, config: AutomationConfig): { trigger: string; contact: string } {
  if (type === 'cod_confirmation') {
    const methods = config.cod_payment_methods.length ? config.cod_payment_methods.join(', ') : 'metodele ramburs recunoscute de platformă'
    return {
      trigger: `Comandă nouă cu plata ramburs (${methods})`,
      contact: 'Clientul comenzii, dacă are un număr de telefon valid în comandă și nu este în lista „Nu suna”',
    }
  }
  if (type === 'abandoned_cart') {
    const min = config.min_order_total !== null ? ` cu valoare de cel puțin ${config.min_order_total}` : ''
    return {
      trigger: `Coș abandonat${min}, după ${formatMinutes(config.delay_minutes)}`,
      contact: 'Clientul coșului, dacă telefonul este cunoscut și nu este în lista „Nu suna”',
    }
  }
  return {
    trigger: `Comanda trece în statusul „${ORDER_STATUS_RO[config.follow_up_status] ?? config.follow_up_status}”`,
    contact: 'Clientul comenzii, dacă are un număr de telefon valid și nu este în lista „Nu suna”',
  }
}

// ─── Launch checklist ─────────────────────────────────────────────────────────

/**
 * Dashboard pages a checklist item may point to that are a step of this very flow. Before the
 * launch the dashboard redirects to /onboarding, so such an item is fixed by moving to its step;
 * every other page (phone number, billing…) is reachable only after the launch.
 */
const CHECKLIST_STEP_BY_PATH: ReadonlyArray<readonly [prefix: string, step: number]> = [
  ['/magazin/conexiuni', 3],
  ['/magazin/automatizari', 4],
  ['/agent', 5],
]

export function checklistStepFor(href: string | null | undefined): number | null {
  if (!href) return null
  const path = href.split(/[?#]/)[0]
  const hit = CHECKLIST_STEP_BY_PATH.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return hit ? hit[1] : null
}

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

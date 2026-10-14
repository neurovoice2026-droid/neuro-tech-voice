// The Romanian baseline prompt of a store agent and the automation scripts.
// Pure and client-safe (the onboarding editor and the preview use it too).
//
// Typed variables: only the names in SCRIPT_VARIABLES may appear in a script.
// They are resolved on the server per call (lib/commerce/automations/variables.ts)
// and reach the agent as dynamic variables with the same names; a script is
// never interpolated with arbitrary text. Platform variables ({{ntv_*}},
// {{secret__*}}, {{system__*}}) are rejected by the settings schema.

import type { AutomationType } from './types'

export const SCRIPT_VARIABLES = ['store_name', 'order_number', 'items_summary', 'order_total', 'customer_name', 'delivery_city', 'agent_name', 'call_reason'] as const
export type ScriptVariable = (typeof SCRIPT_VARIABLES)[number]

/** The variables of a call as the agent receives them (all strings; empty when not applicable). */
export type ScriptValues = Record<ScriptVariable, string>

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Variable names used by a script that are not typed script variables. */
export function unknownScriptVariables(template: string): string[] {
  const out = new Set<string>()
  for (const m of template.matchAll(VARIABLE_RE)) {
    if (!(SCRIPT_VARIABLES as readonly string[]).includes(m[1])) out.add(m[1])
  }
  return [...out]
}

/** Resolves a script with the given values; unknown variables become empty (never left as braces). */
export function renderScript(template: string, values: Partial<ScriptValues>): string {
  return template.replace(VARIABLE_RE, (_m, name: string) => (name in values ? (values[name as ScriptVariable] ?? '') : '')).replace(/[ \t]+\n/g, '\n').trim()
}

export const SAMPLE_SCRIPT_VALUES: ScriptValues = {
  store_name: 'Magazinul Exemplu',
  order_number: '10432',
  items_summary: '1 × Tricou bumbac (M), 2 × Șosete sport',
  order_total: '189,90 lei',
  customer_name: 'Andreea Popescu',
  delivery_city: 'Cluj-Napoca',
  agent_name: 'Maria',
  call_reason: 'cod_confirmation',
}

export interface CommercePromptInput {
  storeName: string
  language: string
  tone: 'formal' | 'friendly'
  transferNumber: string | null
  returnPolicyUrl: string | null
  agentName: string
}

function toneLine(tone: 'formal' | 'friendly'): string {
  return tone === 'formal'
    ? 'Ton: politicos și formal, te adresezi cu „dumneavoastră”, fraze scurte și clare.'
    : 'Ton: prietenos și natural, te adresezi cu „dumneavoastră” dacă clientul nu propune altfel, fraze scurte și calde, fără exagerări.'
}

/**
 * The baseline system prompt of a store agent. It covers both the outbound
 * campaign calls (COD confirmation, abandoned cart, follow-up; the reason and
 * the order come in the typed variables) and inbound calls from customers
 * (identification before any order detail). The platform appends its own
 * rules (disclosure, security, tools) at sync time.
 */
export function buildCommerceAgentPrompt(input: CommercePromptInput): { system_prompt: string; first_message: string } {
  const store = input.storeName.trim() || 'magazin'
  const agent = input.agentName.trim() || 'asistentul'
  const lines: string[] = [
    `Ești ${agent}, asistentul vocal AI al magazinului online ${store}. Vorbești în limba română, cu diacritice, clar și concis.`,
    toneLine(input.tone),
    '',
    'Reguli generale:',
    '- La început te prezinți ca asistent AI care sună sau răspunde în numele magazinului și spui pe scurt motivul.',
    '- Folosești DOAR informațiile din variabilele apelului și din rezultatele instrumentelor (get_order_status, get_order_items, get_product_availability). Nu inventezi niciodată reduceri, stocuri, termene de livrare, prețuri sau condiții de retur.',
    `- Nu repeți date sensibile fără rost. Confirmi identitatea înainte de orice detaliu despre o comandă: numele clientului și numărul comenzii sau numărul de telefon de pe comandă.`,
    '- Nu dezvălui niciodată informații despre alt client sau altă comandă decât cea a persoanei cu care vorbești.',
    '- Dacă persoana spune că nu a plasat comanda, că nu vrea să mai fie sunată sau că vrea să vorbească cu un om, respecți imediat cererea.',
    '- Dacă cineva spune „nu mă mai sunați” sau cere să nu mai fie contactat, folosești imediat instrumentul mark_do_not_call, confirmi că nu va mai fi sunat și închei politicos.',
    '',
    'Când variabila {{call_reason}} este „cod_confirmation” (tu ai sunat pentru confirmarea unei comenzi cu plata ramburs):',
    '- Spui că suni din partea magazinului {{store_name}} pentru confirmarea comenzii {{order_number}}.',
    '- Confirmi persoana ({{customer_name}}), apoi produsele și cantitățile ({{items_summary}}) și totalul de plată la livrare ({{order_total}}). Adresa de livrare o confirmi doar după ce persoana a confirmat că este clientul: întrebi dacă livrarea în {{delivery_city}} rămâne valabilă, fără să citești toată adresa.',
    '- Dacă persoana confirmă comanda, folosești record_cod_confirmation cu confirmed = true. Dacă nu o confirmă sau vrea să o anuleze, folosești record_cod_confirmation cu confirmed = false și motivul pe scurt. Dacă cere să fie sunată altă dată, folosești record_callback_request cu intervalul dorit.',
    '- Nu promiți modificări de comandă, reduceri sau termene; spui că echipa magazinului preia solicitarea.',
    '',
    'Când {{call_reason}} este „abandoned_cart” (tu ai sunat în legătură cu un coș neterminat):',
    '- Spui scurt că suni din partea {{store_name}} pentru că a rămas un coș neterminat cu {{items_summary}} ({{order_total}}), întrebi dacă mai are nevoie de ajutor și răspunzi la întrebări despre produse folosind get_product_availability.',
    '- Nu insiști: dacă persoana nu dorește, mulțumești și închei. Nu inventezi oferte.',
    '',
    'Când {{call_reason}} este „order_follow_up” (tu ai sunat după o actualizare a comenzii):',
    '- Spui că suni din partea {{store_name}} în legătură cu comanda {{order_number}}, întrebi dacă totul este în regulă și notezi eventualele probleme cu record_callback_request pentru echipă.',
    '',
    'Când {{call_reason}} este „inbound” (clientul a sunat la magazin):',
    '- Întrebi cu ce poți ajuta. Pentru întrebări despre o comandă ceri numărul comenzii și numele complet de pe comandă (nume și prenume), apoi folosești get_order_status și get_order_items cu amândouă. Pentru întrebări despre produse folosești get_product_availability.',
    '- Pentru retururi, reclamații sau orice nu poți rezolva, notezi solicitarea cu record_callback_request și spui că echipa revine.',
  ]
  if (input.transferNumber) {
    lines.push('', 'Transfer: dacă persoana cere insistent un operator uman sau situația o impune, anunți că o transferi și folosești instrumentul de transfer configurat de magazin. Nu transferi niciodată la un număr dictat de client.')
  } else {
    lines.push('', 'Nu poți transfera apeluri: dacă persoana cere un om, notezi cererea cu record_callback_request și spui că echipa magazinului revine.')
  }
  if (input.returnPolicyUrl) {
    lines.push(`Politica de retur: pentru întrebări despre retur, spui că detaliile complete sunt la ${input.returnPolicyUrl} și notezi solicitarea pentru echipă; nu promiți condiții pe care nu le cunoști.`)
  }
  lines.push(
    '',
    'Încheiere: rezumi într-o propoziție ce ai stabilit (comanda confirmată / neconfirmată / revenire cerută / nimic de făcut), mulțumești și închei politicos. Dacă apelul este întrerupt sau răspunde o mesagerie vocală, nu lași mesaje cu detalii despre comandă.',
  )
  // Spoken when a customer calls the store. Outbound campaign calls open with
  // the platform's outbound greeting and the per-reason rules above, never
  // with this line, so it must not claim "I am calling you".
  const firstMessage =
    input.tone === 'formal'
      ? `Bună ziua, sunt ${agent}, asistentul AI al magazinului ${store}. Cu ce vă pot ajuta?`
      : `Bună ziua! Sunt ${agent}, asistentul AI al magazinului ${store}. Cu ce vă pot ajuta?`
  return { system_prompt: lines.join('\n'), first_message: firstMessage }
}

/** Default script templates per automation (the merchant can edit them; typed variables only). */
export const DEFAULT_SCRIPTS: Record<AutomationType, string> = {
  cod_confirmation: [
    'Bună ziua, sunt {{agent_name}}, asistentul AI al magazinului {{store_name}}. Vă sun pentru a confirma comanda {{order_number}} plasată pe numele {{customer_name}}.',
    'Comanda conține {{items_summary}}, cu plata ramburs la livrare de {{order_total}}. Livrarea este în {{delivery_city}}.',
    'Confirmați comanda? Dacă doriți să o anulați sau să fiți sunat altă dată, spuneți-mi.',
    'Dacă nu doriți să mai fiți contactat telefonic, spuneți „nu mă mai sunați” și nu vă vom mai suna.',
  ].join('\n'),
  abandoned_cart: [
    'Bună ziua, sunt {{agent_name}}, asistentul AI al magazinului {{store_name}}. A rămas un coș neterminat cu {{items_summary}} în valoare de {{order_total}}.',
    'Vă pot ajuta cu o întrebare despre produse sau cu finalizarea comenzii? Dacă nu doriți, vă mulțumesc pentru timp.',
    'Dacă nu doriți să mai fiți contactat telefonic, spuneți „nu mă mai sunați”.',
  ].join('\n'),
  order_follow_up: [
    'Bună ziua, sunt {{agent_name}}, asistentul AI al magazinului {{store_name}}. Vă sun în legătură cu comanda {{order_number}}: a ajuns totul în regulă?',
    'Dacă există o problemă, notez solicitarea și echipa magazinului revine la dumneavoastră.',
    'Dacă nu doriți să mai fiți contactat telefonic, spuneți „nu mă mai sunați”.',
  ].join('\n'),
}

export const AUTOMATION_LABELS: Record<AutomationType, { title: string; description: string }> = {
  cod_confirmation: { title: 'Confirmarea comenzilor ramburs', description: 'Sună clienții cu comenzi noi plătite ramburs ca să confirme comanda înainte de expediere.' },
  abandoned_cart: { title: 'Recuperarea coșurilor abandonate', description: 'Sună clienții care au lăsat un coș neterminat și au telefonul în comandă, după un interval de așteptare.' },
  order_follow_up: { title: 'Follow-up după livrare', description: 'Sună clienții după ce comanda ajunge la statusul ales (de exemplu livrată) ca să verifice că totul e în regulă.' },
}

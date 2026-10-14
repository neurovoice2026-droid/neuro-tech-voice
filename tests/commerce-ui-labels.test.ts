import { describe, expect, it } from 'vitest'
import {
  AUTOMATION_TYPE_DESCRIPTION,
  AUTOMATION_TYPE_LABEL,
  CONNECTION_STATUSES,
  CONNECTION_STATUS_LABEL,
  CONNECTION_STATUS_TONE,
  CONSENT_TEXT,
  ENABLE_BLOCKED_REASON,
  FINANCIAL_STATUSES,
  FINANCIAL_STATUS_LABEL,
  FOLLOW_UP_STATUS_LABEL,
  FULFILLMENT_STATUSES,
  FULFILLMENT_STATUS_LABEL,
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABEL,
  RUN_OUTCOMES,
  RUN_OUTCOME_LABEL,
  RUN_OUTCOME_TONE,
  RUN_STATUSES,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  SCRIPT_VARIABLES,
  STOCK_STATUSES,
  STOCK_STATUS_LABEL,
  STOCK_STATUS_TONE,
  SUPPRESSION_SOURCES,
  SUPPRESSION_SOURCE_LABEL,
  SYNC_STATUSES,
  SYNC_STATUS_LABEL,
  WEEKDAY_LABEL,
  connectionStatusLabel,
  runOutcomeLabel,
  runStatusLabel,
  runSummaryLine,
  suppressionSourceLabel,
} from '@/components/commerce/labels'
import { SCRIPT_VARIABLES as SERVER_SCRIPT_VARIABLES } from '@/lib/commerce/prompt'
import { AUTOMATION_TYPES } from '@/lib/commerce/types'
import { WEEKDAYS } from '@/lib/scheduling/time'

// Guards the copy the compiler cannot: a total map with a blank or an
// English leftover still type-checks. Every map is checked against its
// value list (same length, every key present, non-empty label) and the
// Romanian strings keep their diacritics (no "s" for "ș").

function expectTotal<K extends string>(map: Record<K, string>, values: readonly K[]) {
  expect(Object.keys(map).sort()).toEqual([...values].sort())
  for (const value of values) expect(map[value].trim().length, `label for ${value}`).toBeGreaterThan(0)
}

function expectTotalTone<K extends string>(map: Record<K, string>, values: readonly K[]) {
  expect(Object.keys(map).sort()).toEqual([...values].sort())
  for (const value of values) expect(map[value]).toMatch(/^(neutral|muted|brand|success|warning|danger|info|outline)$/)
}

describe('commerce labels are total', () => {
  it('run statuses', () => {
    expectTotal(RUN_STATUS_LABEL, RUN_STATUSES)
    expectTotalTone(RUN_STATUS_TONE, RUN_STATUSES)
    expect(RUN_STATUS_LABEL).toEqual({
      eligible: 'Eligibil',
      scheduled: 'Programat',
      calling: 'În apel',
      completed: 'Finalizat',
      suppressed: 'Suprimat',
      skipped: 'Omis',
      failed: 'Eșuat',
      retry_waiting: 'Reîncercare',
      cancelled: 'Anulat',
    })
  })

  it('run outcomes', () => {
    expectTotal(RUN_OUTCOME_LABEL, RUN_OUTCOMES)
    expectTotalTone(RUN_OUTCOME_TONE, RUN_OUTCOMES)
    expect(RUN_OUTCOME_LABEL).toEqual({
      confirmed: 'Confirmată',
      not_confirmed: 'Neconfirmată',
      callback_requested: 'Revenire cerută',
      voicemail: 'Mesagerie vocală',
      no_answer: 'Fără răspuns',
      opted_out: 'Nu mai suna',
      failed: 'Eșuat',
    })
  })

  it('connection statuses', () => {
    expectTotal(CONNECTION_STATUS_LABEL, CONNECTION_STATUSES)
    expectTotalTone(CONNECTION_STATUS_TONE, CONNECTION_STATUSES)
    expect(CONNECTION_STATUS_LABEL).toEqual({
      draft: 'Neconfigurat',
      connecting: 'Se conectează',
      active: 'Conectat',
      degraded: 'Conectat cu probleme',
      disconnected: 'Deconectat',
      error: 'Eroare',
    })
  })

  it('records, sync, automations and sources', () => {
    expectTotal(ORDER_STATUS_LABEL, ORDER_STATUSES)
    expectTotalTone(ORDER_STATUS_TONE, ORDER_STATUSES)
    expectTotal(FINANCIAL_STATUS_LABEL, FINANCIAL_STATUSES)
    expectTotal(FULFILLMENT_STATUS_LABEL, FULFILLMENT_STATUSES)
    expectTotal(PRODUCT_STATUS_LABEL, PRODUCT_STATUSES)
    expectTotal(STOCK_STATUS_LABEL, STOCK_STATUSES)
    expectTotalTone(STOCK_STATUS_TONE, STOCK_STATUSES)
    expectTotal(SYNC_STATUS_LABEL, SYNC_STATUSES)
    expectTotal(SUPPRESSION_SOURCE_LABEL, SUPPRESSION_SOURCES)
    expectTotal(AUTOMATION_TYPE_LABEL, AUTOMATION_TYPES)
    expectTotal(AUTOMATION_TYPE_DESCRIPTION, AUTOMATION_TYPES)
    expectTotal(WEEKDAY_LABEL, WEEKDAYS)
    expectTotal(FOLLOW_UP_STATUS_LABEL, [...ORDER_STATUSES, 'fulfilled'])
    expect(SUPPRESSION_SOURCE_LABEL.customer_opt_out).toBe('Clientul a cerut')
  })

  it('covers every enable-blocked reason of the contract with a message', () => {
    for (const reason of ['no_consent', 'unavailable', 'agent_inactive', 'no_phone_number', 'encryption_not_configured', 'connection_inactive']) {
      expect(ENABLE_BLOCKED_REASON[reason]?.message.length, reason).toBeGreaterThan(10)
    }
  })

  it('keeps the Romanian diacritics (comma-below ș/ț, never cedilla or plain ASCII)', () => {
    const all = [
      ...Object.values(RUN_STATUS_LABEL), ...Object.values(RUN_OUTCOME_LABEL), ...Object.values(CONNECTION_STATUS_LABEL),
      ...Object.values(ORDER_STATUS_LABEL), ...Object.values(AUTOMATION_TYPE_DESCRIPTION), CONSENT_TEXT,
      ...SCRIPT_VARIABLES.map((v) => v.description),
    ].join(' ')
    expect(all).not.toMatch(/[şţŞŢ]/)
    expect(all).toMatch(/[șțăâî]/)
  })

  it('documents every typed script variable of the server, in its order, with a description', () => {
    // The help box and the form's variable check read this list; the server (and the
    // default scripts) use lib/commerce/prompt.ts, so a name missing here would make the
    // form reject a script the server accepts.
    expect(SCRIPT_VARIABLES.map((v) => v.name)).toEqual([...SERVER_SCRIPT_VARIABLES])
    expect(SCRIPT_VARIABLES.map((v) => v.name)).toContain('agent_name')
    expect(SCRIPT_VARIABLES.map((v) => v.name)).toContain('delivery_city')
    for (const v of SCRIPT_VARIABLES) expect(v.description.trim().length, v.name).toBeGreaterThan(10)
  })

  it('reads unknown values as themselves rather than blank', () => {
    expect(runStatusLabel('completed')).toBe('Finalizat')
    expect(runStatusLabel('brand_new')).toBe('brand_new')
    expect(runStatusLabel(null)).toBe('—')
    expect(runOutcomeLabel(null)).toBeNull()
    expect(connectionStatusLabel(undefined)).toBe('Neconfigurat')
    expect(suppressionSourceLabel('provider')).toBe('Platforma magazinului')
  })

  it('builds the call sheet summary line', () => {
    expect(runSummaryLine({ automation_type: 'cod_confirmation', reference: '1234', outcome: 'confirmed', status: 'completed' })).toBe(
      'Apel automat · Confirmare ramburs · Comanda #1234 · Confirmată',
    )
    expect(runSummaryLine({ automation_type: 'abandoned_cart', reference: 'C-9', outcome: null, status: 'scheduled' })).toBe(
      'Apel automat · Coș abandonat · Comanda #C-9 · Programat',
    )
  })
})

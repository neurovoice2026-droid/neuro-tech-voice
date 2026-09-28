import { describe, expect, it } from 'vitest'
import { sampleCallData } from './payload'
import { buildRawEmail, encodeMimeHeader, googleErrorMessage, sheetRange, sheetRow } from './report'
import {
  DEFAULT_SLACK_MESSAGE,
  buildTemplateVars,
  escapeSlackText,
  formatDuration,
  renderTemplate,
  singleLine,
  unknownTemplateVariables,
} from './templates'
import type { WorkflowCallData } from './types'

const org = { name: 'Clinica Dentară', timezone: 'Europe/Bucharest' }

function call(overrides: Partial<WorkflowCallData> = {}): WorkflowCallData {
  return {
    ...sampleCallData(new Date('2026-09-17T10:04:00Z')),
    call_id: 'c1',
    agent_name: 'Ana',
    caller_number: '+40712345678',
    from_number: '+40712345678',
    started_at: '2026-09-17T10:00:00Z',
    ...overrides,
  }
}

describe('renderTemplate', () => {
  it('fills known variables, aliases and whitespace inside braces', () => {
    const vars = buildTemplateVars(call(), org)
    expect(renderTemplate('{{ caller_number }} / {{caller}} / {{agent}} / {{agent_name}}', vars)).toBe('+40712345678 / +40712345678 / Ana / Ana')
  })

  it('uses the organisation time zone for date and time', () => {
    const vars = buildTemplateVars(call(), org)
    expect(vars.date).toBe('17 Sep 2026')
    expect(vars.time).toBe('13:00')
  })

  it('renders unknown variables as empty text', () => {
    expect(renderTemplate('Hi {{nope}}!', {})).toBe('Hi !')
    expect(unknownTemplateVariables('{{nope}} {{summary}} {{Caller}}')).toEqual(['nope'])
  })

  it('escapes call data for Slack but leaves the owner’s own markup alone', () => {
    const vars = buildTemplateVars(call({ summary: 'Caller said <!channel> & left' }), org)
    const text = renderTemplate('<!here> {{summary}}', vars, { escape: escapeSlackText })
    expect(text).toBe('<!here> Caller said &lt;!channel&gt; &amp; left')
  })

  it('keeps the default Slack message identical to the product page sample', () => {
    const vars = buildTemplateVars(call({ direction: 'inbound', caller_number: '+1 555 0142', from_number: null, sentiment: null, summary: null }), org)
    expect(renderTemplate(DEFAULT_SLACK_MESSAGE, vars).trim()).toBe(':telephone_receiver: inbound call from +1 555 0142 (n/a).')
  })

  it('reports the other party on outbound calls', () => {
    const vars = buildTemplateVars(call({ direction: 'outbound', to_number: '+40799999999', caller_number: null }), org)
    expect(vars.caller_number).toBe('+40799999999')
  })

  it('formats durations and collapses one-line text', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(185)).toBe('3m 05s')
    expect(singleLine('Call back   \n +40 ')).toBe('Call back +40')
  })
})

describe('email MIME', () => {
  it('strips line breaks from headers and encodes non-ASCII subjects', () => {
    expect(encodeMimeHeader('Hello\r\nBcc: attacker@example.com')).toBe('Hello Bcc: attacker@example.com')
    expect(encodeMimeHeader('Programare nouă')).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/)
    const raw = Buffer.from(buildRawEmail({ to: ['a@example.com\r\nBcc: x@example.com'], subject: 'Apel ș', body: 'Rezumat: bună ziua' }), 'base64url').toString('utf8')
    const headerBlock = raw.split('\r\n\r\n')[0]
    expect(headerBlock.split('\r\n').filter((line) => line.startsWith('Bcc'))).toEqual([])
    expect(headerBlock).toContain('Content-Transfer-Encoding: base64')
    const body = raw.split('\r\n\r\n')[1]
    expect(Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe('Rezumat: bună ziua')
  })
})

describe('sheets', () => {
  it('quotes tab names and defaults to the first tab', () => {
    expect(sheetRange(undefined)).toBe('A1')
    expect(sheetRange("Bob's leads")).toBe("'Bob''s leads'!A1")
  })

  it('writes one row per call in the header order', () => {
    const row = sheetRow(call({ tags: ['vip', 'follow-up'], outcome: 'message_taken' }), org)
    expect(row).toHaveLength(12)
    expect(row[0]).toBe('17 Sep 2026')
    expect(row[2]).toBe('+40712345678')
    expect(row[6]).toBe('Message taken')
    expect(row[9]).toBe('vip, follow-up')
  })
})

describe('googleErrorMessage', () => {
  const gaxios = (status: number, error?: unknown) => Object.assign(new Error('Request failed'), { response: { status, data: { error } } })

  it('asks for a reconnect when access was revoked or expired', () => {
    expect(googleErrorMessage(gaxios(400, 'invalid_grant'), 'Gmail')).toMatch(/Reconnect Gmail/)
    expect(googleErrorMessage(gaxios(401), 'Gmail')).toMatch(/Reconnect Gmail/)
  })

  it('points at the step settings for 400, 403 and 404', () => {
    expect(googleErrorMessage(gaxios(400, { message: 'Unable to parse range' }), 'Google Sheets')).toMatch(/tab name/)
    expect(googleErrorMessage(gaxios(403, { message: 'The caller does not have permission' }), 'Google Sheets')).toMatch(/can open it/)
    expect(googleErrorMessage(gaxios(404), 'Google Sheets')).toMatch(/couldn’t find/)
  })

  it('treats limits, outages, timeouts and network failures as temporary', () => {
    expect(googleErrorMessage(gaxios(429), 'Google Docs')).toMatch(/limiting requests/)
    expect(googleErrorMessage(gaxios(503), 'Google Docs')).toMatch(/temporary problem/)
    expect(googleErrorMessage(Object.assign(new Error('timeout of 15000ms exceeded'), { code: 'ECONNABORTED' }), 'Google Docs')).toMatch(/too long/)
    expect(googleErrorMessage(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }), 'Google Docs')).toMatch(/couldn’t reach Google Docs/)
  })

  it('never echoes upstream text', () => {
    const message = googleErrorMessage(gaxios(418, { message: 'internal detail sk-123' }), 'Google Drive')
    expect(message).toBe('Google Drive couldn’t complete this step.')
  })
})

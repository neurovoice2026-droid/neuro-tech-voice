import { describe, expect, it } from 'vitest'
import { csvCell, exportValue, guardFormula, toCsv, toJsonRows, type ExportCallRow } from './csv'

describe('guardFormula (CSV injection)', () => {
  it('neutralises cells that spreadsheets would evaluate', () => {
    expect(guardFormula('=HYPERLINK("http://evil","click")')).toBe('\'=HYPERLINK("http://evil","click")')
    expect(guardFormula('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)")
    expect(guardFormula('+cmd|" /C calc"!A0')).toBe('\'+cmd|" /C calc"!A0')
    expect(guardFormula('-2+3+cmd|x')).toBe("'-2+3+cmd|x")
    expect(guardFormula('\t=1+1')).toBe("'\t=1+1")
    expect(guardFormula('\r=1+1')).toBe("'\r=1+1")
  })

  it('leaves phone numbers, plain numbers and ordinary text alone', () => {
    expect(guardFormula('+40722123456')).toBe('+40722123456')
    expect(guardFormula('+40 722 123 456')).toBe('+40 722 123 456')
    expect(guardFormula('-42')).toBe('-42')
    // An inner minus would be evaluated as arithmetic, so it stays text.
    expect(guardFormula('+1 (415) 555-1234')).toBe("'+1 (415) 555-1234")
    expect(guardFormula('Caller asked about prices')).toBe('Caller asked about prices')
    expect(guardFormula('')).toBe('')
  })
})

describe('csvCell', () => {
  it('quotes separators, quotes and newlines after guarding', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell('=1,2')).toBe('"\'=1,2"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(12)).toBe('12')
  })
})

const row: ExportCallRow = {
  id: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
  caller_number: '+40722123456',
  direction: 'inbound',
  duration_seconds: 95,
  status: 'completed',
  outcome: 'booked',
  intent: 'book_appointment',
  sentiment: 'positive',
  tags: ['vip', 'new'],
  started_at: '2026-09-17T08:00:00.000Z',
  created_at: '2026-09-17T08:00:01.000Z',
  summary: '=cmd, booked a cut',
  extracted: { name: 'Ana', budget: '', email: 'ana@example.com' },
  transcript: [
    { role: 'agent', message: 'Bună ziua!' },
    { role: 'user', message: 'O programare, vă rog.' },
  ],
  agent_name: 'Maria',
}

describe('exportValue', () => {
  it('flattens tags, lead details and the transcript', () => {
    expect(exportValue(row, 'tags')).toBe('vip; new')
    expect(exportValue(row, 'extracted')).toBe('name: Ana; email: ana@example.com')
    expect(exportValue(row, 'transcript')).toBe('Agent: Bună ziua!\nCaller: O programare, vă rog.')
    expect(exportValue(row, 'created_at')).toBe('2026-09-17T08:00:00.000Z')
  })
})

describe('toCsv', () => {
  it('writes a BOM, a labelled header, CRLF rows and guarded cells', () => {
    const csv = toCsv([row], ['caller_number', 'outcome', 'summary', 'transcript'])
    expect(csv.startsWith('\uFEFFPhone number,Outcome,AI summary,Transcript\r\n')).toBe(true)
    expect(csv).toContain('+40722123456,booked,"\'=cmd, booked a cut","Agent: Bună ziua!\nCaller: O programare, vă rog."\r\n')
  })
})

describe('toJsonRows', () => {
  it('keeps structured values for developers', () => {
    expect(toJsonRows([row], ['tags', 'extracted', 'created_at', 'duration_seconds'])).toEqual([
      {
        id: row.id,
        tags: ['vip', 'new'],
        extracted: row.extracted,
        started_at: '2026-09-17T08:00:00.000Z',
        duration_seconds: 95,
      },
    ])
  })
})

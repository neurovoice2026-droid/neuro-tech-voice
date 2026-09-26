import { describe, expect, it } from 'vitest'
import {
  buildCallFilterOps,
  buildSearchFilter,
  CallFiltersSchema,
  CallListQuerySchema,
  chunk,
  escapeLikePattern,
  ExportBodySchema,
  exportBodyToSearchParams,
  ExportQuerySchema,
  MAX_SELECTED_IDS,
  pgTextArrayLiteral,
  quotePostgrestValue,
  safeTimeZone,
  sortColumn,
  zonedMidnightUtc,
} from './query'

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLikePattern('50%_off\\now')).toBe('50\\%\\_off\\\\now')
    expect(escapeLikePattern('plain')).toBe('plain')
  })
})

describe('quotePostgrestValue', () => {
  it('wraps in double quotes and escapes quotes and backslashes', () => {
    expect(quotePostgrestValue('a,b.c:(d)')).toBe('"a,b.c:(d)"')
    expect(quotePostgrestValue('say "hi" \\ bye')).toBe('"say \\"hi\\" \\\\ bye"')
  })
})

describe('buildSearchFilter', () => {
  it('returns null for blank input', () => {
    expect(buildSearchFilter('   \n\t ')).toBeNull()
  })

  it('combines full-text search with an escaped caller number match', () => {
    expect(buildSearchFilter('50% off')).toBe(
      'search_tsv.wfts(simple)."50% off",caller_number.ilike."%50\\\\% off%"'
    )
  })

  it('cannot break out of the or() group with commas, parentheses or quotes', () => {
    const filter = buildSearchFilter('x"),id.eq.1,(caller_number.ilike.*')
    expect(filter).toBe(
      'search_tsv.wfts(simple)."x\\"),id.eq.1,(caller_number.ilike.*",caller_number.ilike."%x\\"),id.eq.1,(caller\\\\_number.ilike.%"'
    )
    // Exactly one unquoted comma separates the two conditions.
    const unquoted = filter!.replace(/"(?:[^"\\]|\\.)*"/g, '')
    expect(unquoted).toBe('search_tsv.wfts(simple).,caller_number.ilike.')
  })

  it('matches phone-looking input on digits without the leading zero', () => {
    expect(buildSearchFilter('0722 123 456')).toBe(
      'search_tsv.wfts(simple)."0722 123 456",caller_number.ilike."%722123456%"'
    )
    expect(buildSearchFilter('+40 (722) 123-456')).toContain('caller_number.ilike."%40722123456%"')
  })

  it('strips control characters and collapses whitespace', () => {
    expect(buildSearchFilter('refund\u0000\u0007  please')).toBe(
      'search_tsv.wfts(simple)."refund please",caller_number.ilike."%refund please%"'
    )
  })
})

describe('pgTextArrayLiteral', () => {
  it('quotes every element so commas and braces stay literal', () => {
    expect(pgTextArrayLiteral(['vip'])).toBe('{"vip"}')
    expect(pgTextArrayLiteral(['a,b}', 'say "x"\\'])).toBe('{"a,b}","say \\"x\\"\\\\"}')
  })
})

describe('zonedMidnightUtc', () => {
  it('converts local midnight to UTC across DST in Europe/Bucharest', () => {
    // Summer (UTC+3)
    expect(zonedMidnightUtc('2026-07-01', 'Europe/Bucharest')).toBe('2026-06-30T21:00:00.000Z')
    // Winter (UTC+2)
    expect(zonedMidnightUtc('2026-01-15', 'Europe/Bucharest')).toBe('2026-01-14T22:00:00.000Z')
    // The DST switch day (clocks go forward at 03:00 local on 2026-03-29)
    expect(zonedMidnightUtc('2026-03-29', 'Europe/Bucharest')).toBe('2026-03-28T22:00:00.000Z')
    expect(zonedMidnightUtc('2026-03-29', 'Europe/Bucharest', 1)).toBe('2026-03-29T21:00:00.000Z')
  })

  it('handles zones west of UTC, month ends and bad input', () => {
    expect(zonedMidnightUtc('2026-02-28', 'America/New_York', 1)).toBe('2026-03-01T05:00:00.000Z')
    expect(zonedMidnightUtc('2026-09-17', 'UTC')).toBe('2026-09-17T00:00:00.000Z')
    expect(zonedMidnightUtc('17/09/2026', 'UTC')).toBeNull()
    expect(zonedMidnightUtc('2026-09-17', 'Not/AZone')).toBe('2026-09-17T00:00:00.000Z')
  })

  it('safeTimeZone falls back to UTC', () => {
    expect(safeTimeZone('Europe/Bucharest')).toBe('Europe/Bucharest')
    expect(safeTimeZone('Mars/Olympus')).toBe('UTC')
    expect(safeTimeZone(null)).toBe('UTC')
  })
})

describe('buildCallFilterOps', () => {
  it('hides test calls by default and adds nothing else for default filters', () => {
    expect(buildCallFilterOps(CallFiltersSchema.parse({}), 'UTC')).toEqual([{ op: 'eq', column: 'is_test', value: false }])
  })

  it('maps every filter, with the date range inclusive in the org time zone', () => {
    const filters = CallFiltersSchema.parse({
      search: 'refund',
      status: 'completed',
      direction: 'inbound',
      sentiment: 'negative',
      outcome: 'flagged',
      tag: 'vip',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-17',
      minDuration: '30',
      include_test: '1',
    })
    expect(buildCallFilterOps(filters, 'Europe/Bucharest')).toEqual([
      { op: 'or', value: 'search_tsv.wfts(simple)."refund",caller_number.ilike."%refund%"' },
      { op: 'eq', column: 'status', value: 'completed' },
      { op: 'eq', column: 'direction', value: 'inbound' },
      { op: 'eq', column: 'sentiment', value: 'negative' },
      { op: 'eq', column: 'outcome', value: 'flagged' },
      { op: 'contains', column: 'tags', value: '{"vip"}' },
      { op: 'gte', column: 'started_at', value: '2026-08-31T21:00:00.000Z' },
      { op: 'lt', column: 'started_at', value: '2026-09-17T21:00:00.000Z' },
      { op: 'gte', column: 'duration_seconds', value: 30 },
    ])
  })

  it('maps the date sort to the indexed started_at column', () => {
    expect(sortColumn('created_at')).toBe('started_at')
    expect(sortColumn('duration_seconds')).toBe('duration_seconds')
  })
})

describe('query schemas', () => {
  it('validates list parameters strictly', () => {
    expect(CallListQuerySchema.parse({ page: '2', limit: '50', dateFrom: '' })).toMatchObject({ page: 2, limit: 50, dateFrom: null })
    expect(CallListQuerySchema.safeParse({ limit: '500' }).success).toBe(false)
    expect(CallListQuerySchema.safeParse({ outcome: 'won' }).success).toBe(false)
    expect(CallListQuerySchema.safeParse({ sortBy: 'transcript' }).success).toBe(false)
    expect(CallListQuerySchema.safeParse({ dateTo: '2026-9-1' }).success).toBe(false)
    expect(CallListQuerySchema.safeParse({ search: 'x'.repeat(201) }).success).toBe(false)
  })

  it('validates export columns and selected ids', () => {
    const ok = ExportQuerySchema.parse({
      scope: 'selected',
      columns: 'caller_number,summary,summary',
      selectedIds: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f, 6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
    })
    expect(ok.columns).toEqual(['caller_number', 'summary'])
    expect(ok.selectedIds).toEqual(['6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'])
    expect(ExportQuerySchema.parse({}).columns).toContain('outcome')
    expect(ExportQuerySchema.safeParse({ columns: 'caller_number,search_tsv' }).success).toBe(false)
    expect(ExportQuerySchema.safeParse({ selectedIds: 'abc' }).success).toBe(false)
  })
})

describe('export POST body', () => {
  const ids = Array.from({ length: MAX_SELECTED_IDS }, (_, i) => `6f1c2d3e-4b5a-4c6d-8e7f-${String(i).padStart(12, '0')}`)

  it('carries the maximum selection that would not fit in a URL', () => {
    const body = ExportBodySchema.parse({ format: 'csv', scope: 'selected', columns: 'caller_number,outcome', selectedIds: ids })
    const params = ExportQuerySchema.parse(Object.fromEntries(exportBodyToSearchParams(body)))
    expect(params.scope).toBe('selected')
    expect(params.selectedIds).toHaveLength(MAX_SELECTED_IDS)
    expect(params.columns).toEqual(['caller_number', 'outcome'])
  })

  it('keeps the list filters and rejects oversized or invalid selections', () => {
    const body = ExportBodySchema.parse({ scope: 'filtered', outcome: 'booked', include_test: '1', search: 'refund' })
    const params = ExportQuerySchema.parse(Object.fromEntries(exportBodyToSearchParams(body)))
    expect(params.outcome).toBe('booked')
    expect(params.include_test).toBe(true)
    expect(params.search).toBe('refund')
    expect(ExportBodySchema.safeParse({ selectedIds: [...ids, ids[0]] }).success).toBe(false)
    const bad = ExportBodySchema.parse({ scope: 'selected', selectedIds: ['not-a-uuid'] })
    expect(ExportQuerySchema.safeParse(Object.fromEntries(exportBodyToSearchParams(bad))).success).toBe(false)
  })
})

describe('chunk', () => {
  it('splits in order and keeps the remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 100)).toEqual([])
    expect(chunk(Array.from({ length: 500 }, (_, i) => i), 100)).toHaveLength(5)
  })
})

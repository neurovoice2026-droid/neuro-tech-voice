// Leaked-password check: only the SHA-1 prefix leaves, matches are counted
// from the range body, every failure fails open, and nothing secret is logged.
import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callAt, installFetch, timeoutError, type FetchMock } from '@/tests/helpers/fetch'
import { checkPwnedPassword, PWNED_RANGE_URL, suffixCount } from './pwned-passwords'

// A distinctive password so "not in the request/logs" assertions cannot match by accident.
const PASSWORD = 'Tr0ub4dor&3-zebra'
const HASH = crypto.createHash('sha1').update(PASSWORD, 'utf8').digest('hex').toUpperCase()
const PREFIX = HASH.slice(0, 5)
const SUFFIX = HASH.slice(5)
const OTHER = '0018A45C4D1DEF81644B54AB7F969B88D65'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }

let fetchMock: FetchMock
beforeEach(() => {
  fetchMock = installFetch()
  for (const fn of [log.debug, log.info, log.warn, log.error]) fn.mockReset()
})

function body(lines: string[]): Response {
  return new Response(lines.join('\r\n'), { status: 200 })
}

function expectNothingSecretLogged() {
  const logged = JSON.stringify([log.debug.mock.calls, log.info.mock.calls, log.warn.mock.calls, log.error.mock.calls])
  for (const secret of [PASSWORD, PREFIX, SUFFIX, PREFIX + SUFFIX]) expect(logged).not.toContain(secret)
}

describe('checkPwnedPassword', () => {
  it('sends only the 5-character hash prefix, with padding and a timeout', async () => {
    fetchMock.mockResolvedValueOnce(body([`${OTHER}:3`]))
    await checkPwnedPassword(PASSWORD, { log })
    const call = callAt(fetchMock)
    expect(call.url.href).toBe(`${PWNED_RANGE_URL}${PREFIX}`)
    expect(call.method).toBe('GET')
    expect(call.headers.get('add-padding')).toBe('true')
    expect(call.rawBody).toBeUndefined()
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(SUFFIX)
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(PASSWORD)
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('reports a password found in a breach with its count', async () => {
    fetchMock.mockResolvedValueOnce(body([`${OTHER}:0`, `${SUFFIX}:9545824`]))
    await expect(checkPwnedPassword(PASSWORD, { log })).resolves.toEqual({ status: 'pwned', count: 9545824 })
    expect(log.info).toHaveBeenCalledWith('auth.pwned_check.match', expect.any(Object))
    expectNothingSecretLogged()
  })

  it('matches a lowercase suffix in the body', async () => {
    fetchMock.mockResolvedValueOnce(body([`${SUFFIX.toLowerCase()}:2`]))
    await expect(checkPwnedPassword(PASSWORD, { log })).resolves.toEqual({ status: 'pwned', count: 2 })
  })

  it('treats an absent suffix and a padding entry (count 0) as clean', async () => {
    fetchMock.mockResolvedValueOnce(body([`${OTHER}:12`]))
    await expect(checkPwnedPassword(PASSWORD, { log })).resolves.toEqual({ status: 'clean' })
    fetchMock.mockResolvedValueOnce(body([`${OTHER}:12`, `${SUFFIX}:0`]))
    await expect(checkPwnedPassword(PASSWORD, { log })).resolves.toEqual({ status: 'clean' })
    expect(log.warn).not.toHaveBeenCalled()
  })

  it.each([
    ['an HTTP error', () => fetchMock.mockResolvedValueOnce(new Response('upstream says no', { status: 503 })), 'http', 503],
    ['a timeout', () => fetchMock.mockRejectedValueOnce(timeoutError()), 'timeout', null],
    ['a network error', () => fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')), 'network', null],
    ['an unparseable body', () => fetchMock.mockResolvedValueOnce(new Response('<html>blocked</html>', { status: 200 })), 'bad_response', 200],
  ] as const)('fails open on %s and logs a warning', async (_name, arrange, reason, httpStatus) => {
    arrange()
    await expect(checkPwnedPassword(PASSWORD, { log })).resolves.toEqual({ status: 'unavailable', reason, httpStatus })
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.warn).toHaveBeenCalledWith('auth.pwned_check.unavailable', expect.objectContaining({ reason, http_status: httpStatus }))
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain('upstream says no')
    expectNothingSecretLogged()
  })
})

describe('suffixCount', () => {
  it('returns the count for the suffix, 0 when absent, null for a body with no valid line', () => {
    expect(suffixCount(`${OTHER}:4\r\n${SUFFIX}:7\r\n`, SUFFIX)).toBe(7)
    expect(suffixCount(`${OTHER}:4\n`, SUFFIX)).toBe(0)
    expect(suffixCount('', SUFFIX)).toBeNull()
    expect(suffixCount('not a range body', SUFFIX)).toBeNull()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

// The SmartBill client: every request carries a timeout (the billing webhook
// awaits it before answering Stripe), and an error says whether SmartBill
// refused the request (nothing issued, safe to retry) or gave no usable answer
// (it may have gone through). fetch is a mock: nothing reaches SmartBill.

import { invoices, SmartBillError } from './client'

const fetchMock = vi.fn()

const params = {
  companyVatCode: 'RO99999999',
  seriesName: 'NTV',
  issueDate: '2026-10-15',
  currency: 'USD',
  client: { name: 'Acme SRL' },
  products: [{ name: 'Pro', currency: 'USD', quantity: 1, price: 249 }],
}

const answer = (status: number, body: string) => fetchMock.mockResolvedValueOnce(new Response(body, { status }))

async function failure(): Promise<SmartBillError> {
  const err = await invoices.create(params).then(
    () => null,
    (e: unknown) => e,
  )
  if (!(err instanceof SmartBillError)) throw new Error('expected a SmartBillError')
  return err
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('SMARTBILL_USERNAME', 'billing@example.com')
  vi.stubEnv('SMARTBILL_TOKEN', 'token-for-tests')
})

describe('SmartBill client', () => {
  it('sends every request with a timeout signal and returns the issued number', async () => {
    answer(200, JSON.stringify({ series: 'NTV', number: '0042', url: 'https://smartbill.example/0042.pdf' }))
    await expect(invoices.create(params)).resolves.toMatchObject({ series: 'NTV', number: '0042' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ws.smartbill.ro/SBORO/api/invoice')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.signal?.aborted).toBe(false)
  })

  it('a timeout surfaces as the abort error, not as a SmartBill refusal', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }))
    await expect(invoices.create(params)).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('an HTTP 4xx and an errorText are refusals; a 5xx and an unreadable answer are not', async () => {
    answer(400, 'Seria nu exista')
    expect(await failure()).toMatchObject({ status: 400, refused: true })

    answer(200, JSON.stringify({ errorText: 'Clientul nu are CIF valid' }))
    expect(await failure()).toMatchObject({ status: 200, body: 'Clientul nu are CIF valid', refused: true })

    answer(503, 'Service unavailable')
    expect(await failure()).toMatchObject({ status: 503, refused: false })

    answer(200, '<html>maintenance</html>')
    expect(await failure()).toMatchObject({ status: 200, refused: false })
  })
})

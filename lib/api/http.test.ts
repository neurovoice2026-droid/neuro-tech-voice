import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  ApiError,
  handleRoute,
  jsonError,
  noStore,
  parseJson,
  parseSearchParams,
  zE164,
  zUuid,
} from './http'

afterEach(() => {
  vi.restoreAllMocks()
})

function post(body: BodyInit | null, headers?: Record<string, string>) {
  return new NextRequest('https://app.example.com/api/test', { method: 'POST', body, headers })
}

async function errorBody(res: Response) {
  return (await res.json()) as { error: { code: string; message: string } }
}

describe('jsonError', () => {
  it('uses the standard error shape', async () => {
    const res = jsonError(418, 'teapot', 'Short and stout', { 'x-extra': '1' })
    expect(res.status).toBe(418)
    expect(res.headers.get('x-extra')).toBe('1')
    expect(await res.json()).toEqual({ error: { code: 'teapot', message: 'Short and stout' } })
  })
})

describe('handleRoute', () => {
  it('passes successful responses through', async () => {
    const route = handleRoute(async () => Response.json({ ok: true }))
    const res = await route(post(null), {})
    expect(await res.json()).toEqual({ ok: true })
  })

  it('maps ApiError to its status, code and headers', async () => {
    const route = handleRoute(async () => {
      throw new ApiError(429, 'rate_limited', 'Slow down', { 'Retry-After': '30' })
    })
    const res = await route(post(null), {})
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('30')
    expect(await errorBody(res)).toEqual({ error: { code: 'rate_limited', message: 'Slow down' } })
  })

  it('maps ZodError to 400 validation_error with issue paths', async () => {
    const route = handleRoute(async () => {
      z.object({ agent: z.object({ name: z.string() }) }).parse({ agent: { name: 5 } })
      return new Response()
    })
    const res = await route(post(null), {})
    expect(res.status).toBe(400)
    const body = await errorBody(res)
    expect(body.error.code).toBe('validation_error')
    expect(body.error.message).toContain('agent.name')
  })

  it('hides unexpected errors behind a logged reference id', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const route = handleRoute(async () => {
      throw new Error('database password is hunter2')
    })
    const res = await route(post(null), {})
    expect(res.status).toBe(500)
    const body = await errorBody(res)
    expect(body.error.code).toBe('internal_error')
    expect(body.error.message).not.toContain('hunter2')
    const id = body.error.message.match(/Reference: (\w+)$/)?.[1]
    expect(id).toBeTruthy()
    expect(res.headers.get('x-request-id')).toBe(id)
    expect(log).toHaveBeenCalledWith('[api]', id, expect.any(Error))
  })

  it('rethrows Next.js control-flow errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const route = handleRoute(async () => redirect('/login'))
    await expect(route(post(null), {})).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') })
    expect(log).not.toHaveBeenCalled()
  })

  it('forwards the route context', async () => {
    const route = handleRoute(async (_req, ctx: { params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params
      return Response.json({ id })
    })
    const res = await route(post(null), { params: Promise.resolve({ id: 'abc' }) })
    expect(await res.json()).toEqual({ id: 'abc' })
  })
})

describe('parseJson', () => {
  const schema = z.object({ name: z.string().min(1) })

  it('returns validated data', async () => {
    await expect(parseJson(post(JSON.stringify({ name: 'Ana' })), schema)).resolves.toEqual({ name: 'Ana' })
  })

  it('rejects malformed JSON with 400 invalid_json', async () => {
    await expect(parseJson(post('{"name":'), schema)).rejects.toMatchObject({ status: 400, code: 'invalid_json' })
    await expect(parseJson(post(null), schema)).rejects.toMatchObject({ status: 400, code: 'invalid_json' })
  })

  it('rejects schema mismatches with 400 validation_error', async () => {
    await expect(parseJson(post(JSON.stringify({ name: '' })), schema)).rejects.toMatchObject({
      status: 400,
      code: 'validation_error',
    })
  })

  it('rejects bodies larger than maxBytes while reading', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(200) })
    await expect(parseJson(post(big), schema, { maxBytes: 100 })).rejects.toMatchObject({
      status: 413,
      code: 'payload_too_large',
    })
  })

  it('counts bytes, not characters', async () => {
    const body = JSON.stringify({ name: 'ț'.repeat(40) }) // 80 bytes of text + wrapper
    await expect(parseJson(post(body), schema, { maxBytes: 60 })).rejects.toMatchObject({ status: 413 })
  })

  it('rejects early on a large content-length header', async () => {
    const req = new Request('https://app.example.com/api/test', {
      method: 'POST',
      body: '{}',
      headers: { 'content-length': String(10 * 1024 * 1024) },
    })
    await expect(parseJson(req, z.object({}))).rejects.toMatchObject({ status: 413 })
  })

  it('defaults to 64 KB', async () => {
    const body = JSON.stringify({ name: 'x'.repeat(65 * 1024) })
    await expect(parseJson(post(body), schema)).rejects.toMatchObject({ status: 413 })
  })
})

describe('parseSearchParams', () => {
  const schema = z.object({
    q: z.string().optional(),
    limit: z.coerce.number().int().max(100).default(20),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
  })

  it('parses and coerces', () => {
    expect(parseSearchParams('https://x.test/api?q=hi&limit=5', schema)).toEqual({ q: 'hi', limit: 5 })
    expect(parseSearchParams(new URL('https://x.test/api'), schema)).toEqual({ limit: 20 })
  })

  it('collects repeated keys into arrays', () => {
    expect(parseSearchParams('/api?tag=a&tag=b', schema)).toMatchObject({ tag: ['a', 'b'] })
  })

  it('throws ApiError 400 on invalid input', () => {
    expect(() => parseSearchParams('/api?limit=500', schema)).toThrow(ApiError)
    try {
      parseSearchParams('/api?limit=500', schema)
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: 'validation_error' })
      expect((error as Error).message).toContain('limit')
    }
  })
})

describe('zUuid and zE164', () => {
  it('validates uuids like Postgres does', () => {
    expect(zUuid.safeParse('7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f').success).toBe(true)
    expect(zUuid.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(true)
    expect(zUuid.safeParse('7B0C6F4E-3F1A-4C2B-9D8E-1A2B3C4D5E6F').success).toBe(true)
    expect(zUuid.safeParse('not-a-uuid').success).toBe(false)
    expect(zUuid.safeParse("7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f' or 1=1").success).toBe(false)
  })

  it('validates E.164', () => {
    expect(zE164.safeParse('+40712345678').success).toBe(true)
    expect(zE164.safeParse('0712345678').success).toBe(false)
    expect(zE164.safeParse('+40 712 345 678').success).toBe(false)
  })
})

describe('noStore', () => {
  it('sets Cache-Control on mutable responses', () => {
    const res = noStore(Response.json({}))
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('copies responses with immutable headers', () => {
    const res = noStore(Response.redirect('https://app.example.com/login', 302))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://app.example.com/login')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})

// Deterministic test vectors for lib/security/signing.ts. The voice gateway
// copies this file verbatim into its tests so both sides sign and verify the
// same bytes. Dependency-free on purpose. Never use these secrets anywhere else.

export const SIGNING_VECTOR_SECRET = 'ntv-test-vector-secret-0123456789abcdef0123456789'

/** HMAC-SHA256 hex over `${timestamp}.${rawBody}`, header `t=<timestamp>,v1=<hex>`. */
export const INTERNAL_SIGNATURE_VECTORS = [
  {
    name: 'ascii json body',
    secret: SIGNING_VECTOR_SECRET,
    timestamp: 1767225600,
    rawBody: '{"session_id":"7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f","call_id":"7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f","type":"stream_started"}',
    header: 't=1767225600,v1=4d0e169b512a22526e8afc59291fe56fe0dc64585eef98d89dca589c67fd2287',
  },
  {
    name: 'utf-8 body (Romanian diacritics, emoji)',
    secret: SIGNING_VECTOR_SECRET,
    timestamp: 1767225900,
    rawBody: '{"message":"Bună ziua, mulțumim că ați sunat! 📞"}',
    header: 't=1767225900,v1=8d587bbb33981bf244c4419b1c4863fc89c07a75d81c8e5594ee3080b8170f34',
  },
  {
    name: 'empty body',
    secret: SIGNING_VECTOR_SECRET,
    timestamp: 1767226200,
    rawBody: '',
    header: 't=1767226200,v1=9b922b12cf657e76f81d8ee75bb300e1cb725c16efd40560ac11fa8bdbf40501',
  },
] as const

/**
 * Session token = base64url(JSON payload with keys in this exact order:
 * v, sid, org, agt, ch, mode, exp) + '.' + base64url(HMAC-SHA256 over the first part).
 */
export const SESSION_TOKEN_VECTORS = [
  {
    name: 'twilio cartesia_self',
    secret: SIGNING_VECTOR_SECRET,
    payload: {
      v: 1,
      sid: '7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f',
      org: '0f8e7d6c-5b4a-4938-8271-605f4e3d2c1b',
      agt: '11111111-2222-4333-8444-555555555555',
      ch: 'twilio',
      mode: 'cartesia_self',
      exp: 1767225720,
    },
    /** Seconds at which the token is still valid in tests. */
    validAt: 1767225600,
    token: 'eyJ2IjoxLCJzaWQiOiI3YjBjNmY0ZS0zZjFhLTRjMmItOWQ4ZS0xYTJiM2M0ZDVlNmYiLCJvcmciOiIwZjhlN2Q2Yy01YjRhLTQ5MzgtODI3MS02MDVmNGUzZDJjMWIiLCJhZ3QiOiIxMTExMTExMS0yMjIyLTQzMzMtODQ0NC01NTU1NTU1NTU1NTUiLCJjaCI6InR3aWxpbyIsIm1vZGUiOiJjYXJ0ZXNpYV9zZWxmIiwiZXhwIjoxNzY3MjI1NzIwfQ.l3C6KcQCQcbuXtv6pINbcZD2La1HmJoQ9yDM75SkOTA',
  },
  {
    name: 'browser elevenlabs',
    secret: SIGNING_VECTOR_SECRET,
    payload: {
      v: 1,
      sid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      org: '0f8e7d6c-5b4a-4938-8271-605f4e3d2c1b',
      agt: '11111111-2222-4333-8444-555555555555',
      ch: 'browser',
      mode: 'elevenlabs',
      exp: 1767225660,
    },
    validAt: 1767225600,
    token: 'eyJ2IjoxLCJzaWQiOiJhYWFhYWFhYS1iYmJiLTRjY2MtOGRkZC1lZWVlZWVlZWVlZWUiLCJvcmciOiIwZjhlN2Q2Yy01YjRhLTQ5MzgtODI3MS02MDVmNGUzZDJjMWIiLCJhZ3QiOiIxMTExMTExMS0yMjIyLTQzMzMtODQ0NC01NTU1NTU1NTU1NTUiLCJjaCI6ImJyb3dzZXIiLCJtb2RlIjoiZWxldmVubGFicyIsImV4cCI6MTc2NzIyNTY2MH0.N7tNt3u0GkUJukOWLlbFoXZzwEw7y6zZen0HKZTdcL8',
  },
] as const

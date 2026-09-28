import { describe, expect, it } from 'vitest'
import { configHash, stableStringify } from './hash'

describe('stableStringify', () => {
  it('sorts keys at every level and keeps array order', () => {
    expect(stableStringify({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}')
  })

  it('drops undefined properties like JSON.stringify', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}')
    expect(stableStringify([undefined, 1])).toBe('[null,1]')
  })
})

describe('configHash', () => {
  it('is a sha256 hex digest independent of key order', () => {
    const hash = configHash({ x: 1, y: { z: 'a' } })
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(configHash({ y: { z: 'a' }, x: 1 })).toBe(hash)
    expect(configHash({ x: 2, y: { z: 'a' } })).not.toBe(hash)
  })
})

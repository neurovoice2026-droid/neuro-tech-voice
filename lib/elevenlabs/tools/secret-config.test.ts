import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkToolKey, toolSecretProblems, toolSecretRequired, toolSecretValue } from './secret-config'

const KEY = 'tool-key-0123456789abcdef-0123456789abcdef'
const OLD = 'old-tool-key-0123456789abcdef-0123456789ab'

afterEach(() => vi.unstubAllEnvs())

describe('ELEVENLABS_TOOL_SECRET', () => {
  it('needs at least 32 characters', () => {
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', 'short-key')
    expect(toolSecretValue()).toBeNull()
    expect(checkToolKey('short-key')).toBe('not_configured')
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', `  ${KEY}  `)
    expect(toolSecretValue()).toBe(KEY)
  })

  it('checks the header against the current key and, during a rotation, the previous one', () => {
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', KEY)
    expect(checkToolKey(KEY)).toBe('valid')
    expect(checkToolKey(OLD)).toBe('invalid')
    expect(checkToolKey(null)).toBe('invalid')
    expect(checkToolKey(`${KEY} `)).toBe('invalid')
    vi.stubEnv('ELEVENLABS_TOOL_SECRET_PREVIOUS', OLD)
    expect(checkToolKey(OLD)).toBe('valid')
    expect(checkToolKey(KEY)).toBe('valid')
  })

  it('is required in production only', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(toolSecretRequired()).toBe(false)
    vi.stubEnv('NODE_ENV', 'production')
    expect(toolSecretRequired()).toBe(true)
  })

  it('reports presence and length problems, never the values', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', '')
    expect(toolSecretProblems()).toEqual([expect.objectContaining({ key: 'ELEVENLABS_TOOL_SECRET', severity: 'error' })])
    vi.stubEnv('NODE_ENV', 'development')
    expect(toolSecretProblems()).toEqual([expect.objectContaining({ key: 'ELEVENLABS_TOOL_SECRET', severity: 'warning' })])
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', 'abc')
    expect(toolSecretProblems()[0]).toMatchObject({ severity: 'error' })
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', KEY)
    vi.stubEnv('ELEVENLABS_TOOL_SECRET_PREVIOUS', OLD)
    const problems = toolSecretProblems()
    expect(problems).toEqual([expect.objectContaining({ key: 'ELEVENLABS_TOOL_SECRET_PREVIOUS', severity: 'warning' })])
    expect(JSON.stringify(problems)).not.toContain(KEY)
    expect(JSON.stringify(problems)).not.toContain(OLD)
  })
})

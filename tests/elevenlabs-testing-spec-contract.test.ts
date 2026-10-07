// Spec contract for the platform regression suite (slice G): every test the
// suite creates, and the run request, must match the official agent-testing
// schemas (tests/fixtures/elevenlabs-agent-testing-schema.json, extracted by
// scripts/extract-elevenlabs-testing-schema.mjs). No deprecated field
// (simulation success_condition, include_folders) may be sent.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => null }))

import { platformTestSuite } from '@/lib/voice-providers/agent-tests'

type Schema = Record<string, unknown>
let fixture: { roots: string[]; schemas: Record<string, Schema> }

beforeAll(() => {
  const path = fileURLToPath(new URL('./fixtures/elevenlabs-agent-testing-schema.json', import.meta.url))
  fixture = JSON.parse(readFileSync(path, 'utf8'))
})

function resolveRef(schema: Schema): Schema {
  let s = schema
  for (let i = 0; i < 20 && typeof s.$ref === 'string'; i++) {
    const target = fixture.schemas[(s.$ref as string).split('/').pop() as string]
    if (!target) throw new Error(`fixture is missing ${s.$ref}: re-run scripts/extract-elevenlabs-testing-schema.mjs`)
    s = target
  }
  return s
}

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

/** Minimal validator for the keywords the excerpt keeps (same rules as tests/elevenlabs-spec-contract.test.ts). */
function validate(value: unknown, raw: Schema, path: string): string[] {
  const schema = resolveRef(raw)
  if (schema.deprecated === true) return [`${path}: deprecated in the spec`]
  const branches = (schema.anyOf ?? schema.oneOf) as Schema[] | undefined
  if (branches) {
    let best: string[] | null = null
    for (const b of branches) {
      const errors = validate(value, b, path)
      if (errors.length === 0) return []
      if (!best || errors.length < best.length) best = errors
    }
    return best ?? [`${path}: no branch`]
  }
  const actual = typeOf(value)
  if ('const' in schema && value !== schema.const) return [`${path}: expected const ${JSON.stringify(schema.const)}`]
  const declared = schema.type as string | undefined
  if (declared && !(declared === actual || (declared === 'number' && actual === 'integer'))) return [`${path}: expected ${declared}, got ${actual}`]
  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).includes(value)) return [`${path}: ${JSON.stringify(value)} not in enum`]
  const errors: string[] = []
  if (actual === 'number' || actual === 'integer') {
    if (typeof schema.minimum === 'number' && (value as number) < schema.minimum) errors.push(`${path}: below minimum`)
    if (typeof schema.maximum === 'number' && (value as number) > schema.maximum) errors.push(`${path}: above maximum`)
  }
  if (actual === 'array') {
    const arr = value as unknown[]
    if (typeof schema.maxItems === 'number' && arr.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`)
    if (typeof schema.minItems === 'number' && arr.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`)
    if (schema.items) arr.forEach((item, i) => errors.push(...validate(item, schema.items as Schema, `${path}[${i}]`)))
  }
  if (actual === 'object') {
    const obj = value as Record<string, unknown>
    const props = schema.properties as Record<string, Schema> | undefined
    const extra = schema.additionalProperties
    for (const key of (schema.required as string[] | undefined) ?? []) if (!(key in obj)) errors.push(`${path}.${key}: required`)
    for (const [key, v] of Object.entries(obj)) {
      if (props && key in props) errors.push(...validate(v, props[key], `${path}.${key}`))
      else if (extra && typeof extra === 'object') errors.push(...validate(v, extra as Schema, `${path}.${key}`))
      else if (props || extra === false) errors.push(`${path}.${key}: not in the spec`)
    }
  }
  return errors
}

describe('platform regression suite vs the official agent-testing schemas', () => {
  it('the fixture holds the create and run request closures', () => {
    expect(fixture.roots).toEqual(['CreateResponseUnitTestRequest', 'CreateToolCallUnitTestRequest', 'RunAgentTestsRequestModel'])
  })

  it('every test body matches its create (and update) schema', () => {
    const suite = platformTestSuite({ transferToolId: 'tool_transfer_1' })
    expect(suite.every((d) => d.body)).toBe(true)
    for (const def of suite) {
      const body = def.body as NonNullable<typeof def.body>
      const root = body.type === 'llm' ? 'CreateResponseUnitTestRequest' : 'CreateToolCallUnitTestRequest'
      expect(validate(body, fixture.schemas[root], def.key)).toEqual([])
      // No telephony initiation source: a test-run webhook must never classify as a phone call.
      expect(body.conversation_initiation_source).toBeUndefined()
    }
  })

  it('the run request matches RunAgentTestsRequestModel', () => {
    const run = { tests: [{ test_id: 't1' }, { test_id: 't2' }] }
    expect(validate(run, fixture.schemas.RunAgentTestsRequestModel, 'run')).toEqual([])
    expect(validate({ ...run, repeat_count: 51 }, fixture.schemas.RunAgentTestsRequestModel, 'run')).not.toEqual([])
    expect(validate({ tests: [] }, fixture.schemas.RunAgentTestsRequestModel, 'run')).not.toEqual([])
  })
})

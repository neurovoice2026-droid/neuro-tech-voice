#!/usr/bin/env node
// Extracts the agent-testing request schemas (create LLM / tool tests, run
// tests) and every schema they reference from the official ElevenLabs
// OpenAPI spec into a small committed fixture,
// tests/fixtures/elevenlabs-agent-testing-schema.json, used by
// tests/elevenlabs-testing-spec-contract.test.ts (platform regression suite,
// lib/voice-providers/agent-tests.ts). The full spec is never committed.
//
//   curl -sSL https://api.elevenlabs.io/openapi.json -o /tmp/el-openapi.json
//   node scripts/extract-elevenlabs-testing-schema.mjs /tmp/el-openapi.json
//
// RunAgentTestsRequestModel.agent_config_override is not followed: it is the
// agent body, already covered by tests/elevenlabs-spec-contract.test.ts.
// Kept / dropped keywords: same as scripts/extract-elevenlabs-agent-schema.mjs.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOTS = ['CreateResponseUnitTestRequest', 'CreateToolCallUnitTestRequest', 'RunAgentTestsRequestModel']
const SKIP_PROPERTIES = { RunAgentTestsRequestModel: new Set(['agent_config_override']) }
const KEEP = new Set([
  'type', 'properties', 'required', 'enum', 'const', '$ref', 'anyOf', 'oneOf', 'allOf', 'items',
  'additionalProperties', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength',
  'maxLength', 'minItems', 'maxItems', 'default', 'deprecated', 'x-fern-enum', 'discriminator', 'nullable',
])

const specPath = process.argv[2]
if (!specPath) {
  console.error('Usage: node scripts/extract-elevenlabs-testing-schema.mjs <path-to-openapi.json> [output.json]')
  process.exit(2)
}
const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(process.argv[3] ?? resolve(here, '../tests/fixtures/elevenlabs-agent-testing-schema.json'))

const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const all = spec?.components?.schemas
if (!all || ROOTS.some((r) => !all[r])) {
  console.error(`Not an ElevenLabs OpenAPI document with the agent-testing schemas (${ROOTS.join(', ')}).`)
  process.exit(2)
}

function slim(node, isPropertyMap = false) {
  if (Array.isArray(node)) return node.map((n) => slim(n))
  if (!node || typeof node !== 'object') return node
  const out = {}
  for (const [k, v] of Object.entries(node)) {
    if (isPropertyMap) out[k] = slim(v)
    else if (k === 'properties') out[k] = slim(v, true)
    else if (KEEP.has(k)) out[k] = k === 'x-fern-enum' || k === 'default' || k === 'enum' || k === 'const' ? v : slim(v)
  }
  return out
}

const schemas = {}
const queue = [...ROOTS]
while (queue.length) {
  const name = queue.shift()
  if (schemas[name]) continue
  const raw = all[name]
  if (!raw) {
    console.error(`Dangling $ref: ${name}`)
    process.exit(2)
  }
  const node = slim(raw)
  for (const p of SKIP_PROPERTIES[name] ?? []) {
    if (node.properties?.[p]) node.properties[p] = {}
  }
  schemas[name] = node
  const visit = (n) => {
    if (Array.isArray(n)) return n.forEach(visit)
    if (!n || typeof n !== 'object') return
    for (const [k, v] of Object.entries(n)) {
      if (k === '$ref' && typeof v === 'string') queue.push(v.split('/').pop())
      else if (k !== 'x-fern-enum' && k !== 'default' && k !== 'enum' && k !== 'const') visit(v)
    }
  }
  visit(node)
}

const sorted = Object.fromEntries(Object.keys(schemas).sort().map((k) => [k, schemas[k]]))
const fixture = {
  source: 'https://api.elevenlabs.io/openapi.json',
  info_version: spec.info?.version ?? null,
  extracted_at: new Date().toISOString().slice(0, 10),
  roots: ROOTS,
  schemas: sorted,
}
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(fixture, null, 1)}\n`)
console.log(`Wrote ${Object.keys(sorted).length} schemas to ${outPath}`)

#!/usr/bin/env node
// Extracts the Create Agent request schema (and every schema it references)
// from the official ElevenLabs OpenAPI spec into a small committed fixture,
// tests/fixtures/elevenlabs-agent-schema.json, used by the spec-contract test
// (tests/elevenlabs-spec-contract.test.ts). The full spec (~2 MB) is never
// committed.
//
//   curl -sSL https://api.elevenlabs.io/openapi.json -o /tmp/el-openapi.json
//   node scripts/extract-elevenlabs-agent-schema.mjs /tmp/el-openapi.json
//
// Re-run it when the spec changes, then run `npx vitest run tests/elevenlabs-spec-contract.test.ts`:
// a field we send that disappeared, became deprecated or changed its enum
// fails the test before it fails a deploy.
//
// Kept: types, properties, required, enums, const, $ref, anyOf/oneOf,
// additionalProperties, numeric/length/item limits, defaults, deprecation
// markers (deprecated, x-fern-enum). Dropped: descriptions, titles, examples.
// The root's `workflow` property is not followed (the platform never sends it).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = 'Body_Create_Agent_v1_convai_agents_create_post'
const SKIP_ROOT_PROPERTIES = new Set(['workflow'])
const KEEP = new Set([
  'type', 'properties', 'required', 'enum', 'const', '$ref', 'anyOf', 'oneOf', 'allOf', 'items',
  'additionalProperties', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength',
  'maxLength', 'minItems', 'maxItems', 'default', 'deprecated', 'x-fern-enum', 'discriminator', 'nullable',
])

const specPath = process.argv[2]
if (!specPath) {
  console.error('Usage: node scripts/extract-elevenlabs-agent-schema.mjs <path-to-openapi.json> [output.json]')
  process.exit(2)
}
const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(process.argv[3] ?? resolve(here, '../tests/fixtures/elevenlabs-agent-schema.json'))

const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const all = spec?.components?.schemas
if (!all || !all[ROOT]) {
  console.error(`Not an ElevenLabs OpenAPI document: components.schemas.${ROOT} is missing.`)
  process.exit(2)
}

/** Keeps only validation-relevant keywords; property maps keep every property name. */
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
const queue = [ROOT]
while (queue.length) {
  const name = queue.shift()
  if (schemas[name]) continue
  const raw = all[name]
  if (!raw) {
    console.error(`Dangling $ref: ${name}`)
    process.exit(2)
  }
  const node = slim(raw)
  if (name === ROOT && node.properties) {
    for (const p of SKIP_ROOT_PROPERTIES) delete node.properties[p]
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
  root: ROOT,
  schemas: sorted,
}
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(fixture, null, 1)}\n`)
console.log(`Wrote ${Object.keys(sorted).length} schemas to ${outPath}`)

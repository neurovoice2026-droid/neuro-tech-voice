// Bundles the gateway into a single dist/index.js (Node 22+, ESM).
// Everything is bundled, including `ws` and `openai`, so the runtime image
// needs no node_modules. The shared app modules (lib/voice/contracts.ts,
// lib/voice/greetings.ts and their dependency-free imports) are pulled in
// through the '@/' alias, exactly like tsconfig paths.
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs']

function resolveAppModule(specifier) {
  const base = path.join(repoRoot, specifier.slice(2))
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const index = path.join(base, `index${ext}`)
      if (existsSync(index)) return index
    }
  }
  return null
}

const appAlias = {
  name: 'app-alias',
  setup(b) {
    b.onResolve({ filter: /^@\// }, (args) => {
      const resolved = resolveAppModule(args.path)
      if (!resolved) return { errors: [{ text: `Cannot resolve ${args.path} under ${repoRoot}` }] }
      return { path: resolved }
    })
    // The shared modules must stay runtime-dependency-free: a server-only or
    // Next import sneaking into greetings.ts would break the gateway silently.
    b.onResolve({ filter: /^(server-only|next(\/.*)?|react(\/.*)?)$/ }, (args) => ({
      errors: [{ text: `The gateway bundle must not import '${args.path}' (imported from ${args.importer})` }],
    }))
  },
}

await build({
  entryPoints: [path.join(here, 'src/index.ts')],
  outfile: path.join(here, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
  plugins: [appAlias],
  // ws and openai are CommonJS in places; ESM output needs a real `require`
  // for Node builtins and ws's optional native add-ons (bufferutil).
  banner: {
    js: "import { createRequire as __ntvCreateRequire } from 'node:module'; const require = __ntvCreateRequire(import.meta.url);",
  },
  define: {
    'process.env.NTV_GATEWAY_BUILD': JSON.stringify(new Date().toISOString()),
  },
})

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    // Same mapping as tsconfig paths and build.mjs: the shared app modules
    // (contracts, greetings) import each other through '@/…'.
    alias: [{ find: /^@\//, replacement: `${path.resolve(here, '../..')}/` }],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // End-to-end call simulations open real sockets on random ports; running
    // files in parallel is fine, tests inside a file share mock servers.
    pool: 'forks',
  },
})

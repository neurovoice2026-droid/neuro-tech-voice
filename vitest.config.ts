import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Next's `server-only` marker throws outside a React Server environment;
      // unit tests exercise the server modules directly.
      'server-only': path.resolve(__dirname, 'lib/testing/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'components/**/*.test.ts', 'store/**/*.test.ts', 'hooks/**/*.test.ts'],
    exclude: ['node_modules/**', 'services/**', '.next/**'],
  },
})

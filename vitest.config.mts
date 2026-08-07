import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'app/**/*.test.tsx'],
    // Generated Prisma client and build output contain no tests and are large.
    exclude: ['node_modules/**', '.next/**', 'lib/generated/**'],
  },
})

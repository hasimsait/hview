import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: {
    '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
    '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
  } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/plan/*.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportOnFailure: true,
      thresholds: { lines: 78, statements: 78, functions: 76, branches: 74 },
    },
  },
});
